// Level 4's market driven headless as a person would, many times over: along the middle of the way past the stacks,
// or kept off it to one side by so much, looking well ahead into the turns and nearer along the straights, slowing for
// the turns; at six speeds. And once with every stack brought down first, slowly, to be sure the way is never shut by
// what has come down. Says for each how much of the load is left, whether it got through, how long it took and what it
// knocked over, heavy stock and light apart.
// npx tsx dev/harbour-market.ts          V=<m/s> B=<m> for one run; TRACE=1 for where it is each second
import { harbour } from '../src/levels/harbour';
import { MARKET_ROUTE, marketLine } from '../src/levels/harbourMarket';
import { Sim } from '../src/sim/sim';

type P = [number, number];
const level = harbour();
/** How far ahead along the way it looks, in quarter metres: into a turn, and along a straight. */
const LOOK_TURN = 34, LOOK_STRAIGHT = 14;
const HEAVY = new Set(['waterPack', 'riceBag', 'melonCrate', 'fishBox']);
const LIGHT = new Set(['vegCrate', 'tissueBale', 'noodleBox', 'eggCase']);

/** The way, as points a quarter of a metre apart: the stacks' middle line through each turn's corner, kept `bias` metres
 * to its left (to its right if less than nought). */
function path(bias: number): P[] {
  const line: P[] = [[MARKET_ROUTE[0][0], MARKET_ROUTE[0][1] - 6], ...marketLine(), [MARKET_ROUTE.at(-1)![0] + 30, MARKET_ROUTE.at(-1)![1]]];
  const out: P[] = [];
  for (let k = 0; k + 1 < line.length; k++) {
    const [a, b] = [line[k], line[k + 1]];
    const long = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(long / 0.25));
    // To the left of the way going along it: +X going toward +Z.
    const lx = (b[1] - a[1]) / long, lz = -(b[0] - a[0]) / long;
    for (let i = 0; i < n; i++) out.push([a[0] + ((b[0] - a[0]) * i) / n + lx * bias, a[1] + ((b[1] - a[1]) * i) / n + lz * bias]);
  }
  return out;
}

interface Run { done: boolean; load: number; seconds: number; heavy: number; light: number; at: P; tries: number }

async function drive(want: number, bias: number, felled = false): Promise<Run> {
  const way = path(bias);
  const sim = await Sim.create(level);
  sim.teleport(way[0][0], way[0][1], 0, 0);
  if (felled) {
    // Every stack brought down at once, and let lie.
    const only = process.env.FELL && process.env.FELL !== 'all' ? process.env.FELL.split(',').map(Number) : null;
    for (const o of sim.objects.objects) if ((HEAVY.has(o.desc.kind) || LIGHT.has(o.desc.kind)) && (!only || (Math.abs(o.desc.pos[0] - only[0]) < 3 && Math.abs(o.desc.pos[2] - only[1]) < 4))) o.fallIn = 0.01;
  }
  if (process.env.HITS) { const struck = sim.hits.struck.bind(sim.hits); sim.hits.struck = (w, t, l) => { const h = struck(w, t, l); if (h > 0) console.log('   hit', h.toFixed(1)); return h; }; }
  for (let i = 0; i < 60 * (felled ? 6 : 1); i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  // Stuck, as a person would: back off a little, the wheel the other way, and try again; given up on after a minute of it.
  let at = 0, still = 0, i = 0, backing = 0, tries = 0;
  for (; i < 60 * 180; i++) {
    const p = sim.truck.body.translation(), r = sim.truck.body.rotation();
    let best = at;
    for (let k = at; k < Math.min(way.length, at + 80); k++) if (Math.hypot(way[k][0] - p.x, way[k][1] - p.z) < Math.hypot(way[best][0] - p.x, way[best][1] - p.z)) best = k;
    at = best;
    if (at >= way.length - 8) break;
    const heading = (k: number) => { const [a, b] = [way[Math.min(way.length - 1, k)], way[Math.min(way.length - 1, k + 8)]]; return Math.atan2(b[0] - a[0], b[1] - a[1]); };
    const turn = (k: number) => Math.abs(Math.atan2(Math.sin(heading(k) - heading(at)), Math.cos(heading(k) - heading(at))));
    const bend = Math.max(turn(at + 30), turn(at + 50));
    const pace = bend > 0.5 ? Math.min(want, 3) : want;
    const [tx, tz] = way[Math.min(way.length - 1, at + (bend > 0.5 ? LOOK_TURN : LOOK_STRAIGHT))];
    const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
    const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
    const speed = sim.truck.forwardSpeed();
    still = Math.abs(speed) < 0.2 && backing <= 0 ? still + 1 : 0;
    if (still > 60 * 3) { backing = 90; still = 0; tries++; }
    if (tries > 20) break;
    if (backing > 0) {
      backing--;
      sim.step({ throttle: -1, steer: Math.max(-1, Math.min(1, off * 2.2)), handbrake: false });
      continue;
    }
    sim.step({ throttle: speed < pace ? 1 : speed > pace + 1 ? -0.6 : 0.1, steer: Math.max(-1, Math.min(1, -off * 2.2)), handbrake: false });
    if (process.env.WATCH) { const [wx, wy, wz] = process.env.WATCH.split(',').map(Number); const u = sim.objects.objects.find((o) => Math.abs(o.desc.pos[0] - wx) < 0.05 && Math.abs(o.desc.pos[1] - wy) < 0.05 && Math.abs(o.desc.pos[2] - wz) < 0.05); if (u) { const w = u.body.translation(); const was = (u as unknown as { wy?: number }).wy; if (was === undefined || Math.abs(was - w.y) > 0.005) { (u as unknown as { wy?: number }).wy = w.y; console.log('   watch', (i / 60).toFixed(2), 'y', w.y.toFixed(3), 'asleep', u.body.isSleeping(), 'near', u.near, 'knocked', u.knocked, 'truck', p.x.toFixed(2), p.z.toFixed(2), 'groups', (u.body.collider(0).collisionGroups() & 0xffff).toString(16)); } } }
    if (process.env.CONTACTS) {
      const world = (sim as unknown as { world: { contactPairsWith: Function; contactPair: Function } }).world;
      const load = new Set(sim.cargoSystem.items.map((c) => c.body?.handle));
      const tv = sim.truck.body.linvel();
      for (const o of sim.objects.objects) {
        if (o.desc.kind !== 'waterPack' || !o.knocked) continue;
        const q = o.body.translation();
        if (Math.abs(q.x - p.x) > 6 || Math.abs(q.z - p.z) > 6) continue;
        world.contactPairsWith(o.body.collider(0), (other: { parent(): { handle: number } | null }) => {
          const by = other.parent()?.handle;
          if (by !== sim.truck.body.handle && !load.has(by)) return;
          world.contactPair(o.body.collider(0), other, (m: { numContacts(): number }) => {
            if (m.numContacts() === 0) return;
            const v = o.body.linvel();
            console.log('   contact', (i / 60).toFixed(2), by === sim.truck.body.handle ? 'truck' : 'LOAD', 'y', q.y.toFixed(2), 'rel', Math.hypot(v.x - tv.x, v.y - tv.y, v.z - tv.z).toFixed(2));
          });
        });
      }
    }
    if (process.env.FIRST) for (const o of sim.objects.objects) if ((process.env.FIRST === 'any' ? o.kind.collapse && o.desc.pos[2] > 278 : o.desc.kind === process.env.FIRST) && o.knocked && !(o as unknown as { told?: boolean }).told) { (o as unknown as { told?: boolean }).told = true; const q = o.body.translation(), v = o.body.linvel(); console.log('   first', (i / 60).toFixed(2), 'piece', o.desc.pos.map((n) => n.toFixed(2)).join(','), 'now', q.x.toFixed(2), q.y.toFixed(2), q.z.toFixed(2), 'v', Math.hypot(v.x, v.y, v.z).toFixed(2), o.knocked ? 'knocked' : 'falling', 'near', o.near, 'truck', p.x.toFixed(2), p.z.toFixed(2)); { const world = (sim as unknown as { world: { contactPairsWith: Function; contactPair: Function } }).world; for (let k = 0; k < o.body.numColliders(); k++) { const mine = o.body.collider(k); world.contactPairsWith(mine, (other: { parent(): { handle: number; isFixed(): boolean; mass(): number } | null; translation(): { x: number; y: number; z: number }; collisionGroups(): number }) => { world.contactPair(mine, other, (m: { numContacts(): number }) => { if (m.numContacts() > 0) { const q = other.translation(); console.log('      touching', other.parent()?.handle === sim.truck.body.handle ? 'TRUCK' : other.parent()?.isFixed() ? 'fixed' : 'loose', 'groups', (other.collisionGroups() >>> 16).toString(16), 'at', q.x.toFixed(2), q.y.toFixed(2), q.z.toFixed(2), 'mass', other.parent()?.mass().toFixed(0)); } }); }); } }
      if (process.env.FIRST_ONLY) { for (const item of sim.cargoSystem.items) if (item.body && !sim.truck.isOnBed(item.body.translation())) { const c = item.body.translation(); console.log('      cargo off the bed at', c.x.toFixed(2), c.y.toFixed(2), c.z.toFixed(2)); }
      for (const u of sim.objects.objects) if (Math.abs(u.desc.pos[0] - o.desc.pos[0]) < 0.9 && Math.abs(u.desc.pos[2] - o.desc.pos[2]) < 0.7) { const w = u.body.translation(); console.log('     ', u.desc.kind, u.desc.pos.map((n) => n.toFixed(2)).join(','), 'now', w.x.toFixed(2), w.y.toFixed(2), w.z.toFixed(2), 'near', u.near, 'knocked', u.knocked, 'asleep', u.body.isSleeping(), 'enabled', u.body.isEnabled()); } process.exit(0); } }
    if (process.env.TRACE && i % (+(process.env.EVERY ?? 60)) === 0) console.log('  ', (i / 60).toFixed(1), p.x.toFixed(2), p.z.toFixed(1), speed.toFixed(1), 'yaw', ((Math.atan2(fx, fz) * 180) / Math.PI).toFixed(0), 'aim', tx.toFixed(2), tz.toFixed(1));
  }
  const p = sim.truck.body.translation();
  if (process.env.WHY) {
    const world = (sim as unknown as { world: { contactPairsWith: Function; contactPair: Function } }).world;
    for (let k = 0; k < sim.truck.body.numColliders(); k++) {
      const mine = sim.truck.body.collider(k);
      world.contactPairsWith(mine, (other: { handle: number; parent(): { isFixed(): boolean; mass(): number } | null; translation(): { x: number; y: number; z: number }; collisionGroups(): number }) => {
        world.contactPair(mine, other, (m: { numContacts(): number }) => {
          if (m.numContacts() > 0 && ((other.collisionGroups() >>> 16) & 4) === 0) { const q = other.translation(); const o = sim.objects.objects.find((x) => x.body.collider(0).handle === other.handle); console.log('   touching', o ? o.desc.kind : other.parent()?.isFixed() ? 'fixed' : 'loose', q.x.toFixed(2), q.y.toFixed(2), q.z.toFixed(2)); }
        });
      });
    }
  }
  let heavy = 0, light = 0;
  if (!felled) for (const o of sim.objects.objects) if (o.knocked || o.fallIn !== undefined) HEAVY.has(o.desc.kind) ? heavy++ : LIGHT.has(o.desc.kind) && light++;
  if (process.env.DIAG) {
    // Which stacks came down: by kind and where each stood, to the nearest two metres.
    const where: Record<string, number> = {};
    for (const o of sim.objects.objects) if (o.knocked && (HEAVY.has(o.desc.kind) || LIGHT.has(o.desc.kind))) { const k = `${o.desc.kind} ${Math.round(o.desc.pos[0] / 2) * 2},${Math.round(o.desc.pos[2] / 2) * 2}`; where[k] = (where[k] ?? 0) + 1; }
    console.log(Object.entries(where).map(([k, n]) => `   ${k}: ${n}`).join(String.fromCharCode(10)));
  }
  return { done: at >= way.length - 8, load: Math.round((sim.cargoValue() / sim.fullValue) * 100), seconds: Math.round(i / 60), heavy, light, at: [p.x, p.z], tries };
}

const show = (r: Run) => `${r.done ? (r.tries ? `through, backed off ${r.tries}x` : 'through') : `STUCK at ${r.at[0].toFixed(0)},${r.at[1].toFixed(0)}`} ${String(r.load).padStart(3)}% in ${String(r.seconds).padStart(3)} s, heavy down ${String(r.heavy).padStart(3)}, light ${String(r.light).padStart(3)}`;
if (process.env.V) {
  console.log(show(await drive(+process.env.V, +(process.env.B ?? 0), !!process.env.FELL)));
} else {
  console.log('speed   off the middle  result');
  for (const v of [2.2, 3, 4.2, 6, 8, 10]) for (const b of [-0.4, 0, 0.4]) console.log(`${(v * 3.6).toFixed(0).padStart(3)} km/h  ${b >= 0 ? '+' : ''}${b.toFixed(1)} m         ${show(await drive(v, b))}`);
  console.log('every stack down first, 8 km/h:   ' + show(await drive(2.2, 0, true)));
}
process.exit(0);
