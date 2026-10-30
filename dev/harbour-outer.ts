// Level 4's outer harbour, headless: from the gate down onto the quay, over the pontoon and the rafted boats, along the
// pier, up the ship's ramp and along her open side to the square on her fore deck, at steady speeds, steered by looking
// ahead along the way; HUMAN=1 a fifth of a second late. FROM=pontoon|pier|ship starts further on. CAREFUL=1 creeps over the
// plates between the boats as a careful driver would. On the ship it keeps to the side of the lane the next loose container
// is not on, and waits for it when it is coming across.
// FULL=1: the whole level from its start, along its route; says where the save point was passed. SAVE=1 with it: after
// passing it, fail on purpose (back to the save) and drive on from there.
// settle: the truck parked; after a while, how many things on the decks and ashore have moved, and how far.
// npx tsx dev/harbour-outer.ts [way|settle] [kmh...]
import { harbour } from '../src/levels/harbour';
import { OUTER_SPOTS, OUTER_WAY, SHIP } from '../src/levels/harbourOuter';
import { Sim } from '../src/sim/sim';
import type { Vec2 } from '../src/levels/types';
import { marketLine } from '../src/levels/harbourMarket';
import { ROOF_AT, ROOF_SPOTS, ROOF_WAY } from '../src/levels/harbourRoofs';
import { JOINT, MARKET_ROOF_WAY } from '../src/levels/harbourMarketRoof';
import { ICE_WAY } from '../src/levels/harbourIce';

const level = harbour();
const what = process.argv[2] ?? 'way';
// The whole way, put together from the lines each place's own test drives: the street's weave, the market's aisles, the
// lane, the roofs, the market roof, down the canopy, the ice yard, then out.
const FULL_WAY: Vec2[] = [
  [0, 4], [-0.7, 12], [-0.7, 28], [2.4, 35], [2.4, 49], [-2.2, 59], [-2.2, 72], [1.8, 80], [2.4, 90], [-1.5, 97], [-4.5, 104], [-6.15, 111], [-6.15, 138], [-3, 145], [-2.8, 152], [-2.8, 165], [2.4, 172], [2.6, 192], [-2.8, 201], [-3.1, 220], [0, 225], [2.8, 230],
  ...marketLine(),
  [44, 339.4], [47.5, 340.6], [52, 340.2], [60, 339.9], [64.5, 339], [70, 338.2], [73, 338], [76, 338], [82, 340.5], [90, 341.3], [97.5, 341.3], [100.5, 342.3], [103, 344.5], [103.775, 347],
  ...ROOF_WAY, ROOF_SPOTS.over, [44, 364.7], [41, 364.4], ...MARKET_ROOF_WAY,
  [-22, JOINT.z1 - 6.5], [-35, JOINT.z1 - 6], [-41.5, JOINT.z1 - 4], [-44, JOINT.z1], [-44, 318], ...ICE_WAY, ...OUTER_WAY.slice(1),
];

function follower(way: Vec2[]) {
  const lengths = way.slice(1).map((p, k) => Math.hypot(p[0] - way[k][0], p[1] - way[k][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  const along = (s: number): Vec2 => {
    for (let k = 0; k < lengths.length; k++) {
      if (s <= lengths[k] || k === lengths.length - 1) {
        const t = Math.min(1, s / lengths[k]);
        return [way[k][0] + (way[k + 1][0] - way[k][0]) * t, way[k][1] + (way[k + 1][1] - way[k][1]) * t];
      }
      s -= lengths[k];
    }
    return way.at(-1)!;
  };
  // Near where it was last (the way passes over and under itself): within a window of the last place along it.
  const nearest = (x: number, z: number, was = -1) => {
    let best = 0, bestD = Infinity, base = 0;
    for (let k = 0; k < lengths.length; k++) {
      const [ax, az] = way[k], [bx, bz] = way[k + 1], dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengths[k] ** 2));
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      const at = base + t * lengths[k];
      if (d < bestD && (was < 0 || (at > was - 15 && at < was + 40))) { bestD = d; best = base + t * lengths[k]; }
      base += lengths[k];
    }
    return best;
  };
  /** How far along the way its k-th point is. */
  const at = (k: number) => lengths.slice(0, k).reduce((a, b) => a + b, 0);
  return { total, along, nearest, at };
}

async function drive(kmh: number) {
  const sim = await Sim.create(level);
  const full = !!process.env.FULL;
  const from = (full ? 'start' : process.env.FROM ?? 'quay') as keyof typeof OUTER_SPOTS;
  if (!full) { const [x, z, yaw, y] = OUTER_SPOTS[from]; sim.teleport(x, z, yaw, y); }
  // FULL with ROOFS=1: from the rooftops' front run, before the billboard and the save point.
  if (full && process.env.ROOFS) { const [x, z, yaw] = ROOF_SPOTS.front; sim.teleport(x, z, yaw, ROOF_AT(x)); }
  // DELAY=seconds: wait this long first, for the boats and the ship to be at another point in their rolling.
  for (let i = 0; i < 60 * (1 + +(process.env.DELAY ?? 0)); i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const f = follower(full ? FULL_WAY : OUTER_WAY);
  let saveAt = -1, backed = false, leg = 0;
  const GATE_K = FULL_WAY.length - OUTER_WAY.length + 1;
  const seen: number[] = [];
  let top = 0, still = 0, s = 0, backing = 0, tries = 0;
  const want = kmh / 3.6;
  const marks: string[] = [];
  const sides = new Map<number, number>();
  let lastMark = -1;
  for (let i = 0; i < 60 * (full ? 600 : 120) && !sim.result; i++) {
    if (sim.hasSave && saveAt < 0) { saveAt = s; marks.push('SAVE@' + s.toFixed(0) + 'm,' + (sim.time).toFixed(0) + 's'); }
    if (process.env.SAVE && saveAt >= 0 && !backed && s > saveAt + 25) { backed = true; sim.backToSave(); s = saveAt - 3; leg = 0; marks.push('BACK'); continue; }
    const p = sim.truck.body.translation(), r = sim.truck.body.rotation();
    s = f.nearest(p.x, p.z, i === 0 ? -1 : s);
    let [ax, az] = f.along(s + (Math.abs(sim.truck.forwardSpeed()) < 4 ? 4.5 : 6.5));
    let bend = false;
    // FULL, in the market's aisles, as the market's own drive does: looking further into a turn, and slowed for it.
    const aisles = full && p.y < 3 && p.x > -20 && p.x < 40 && p.z > 232 && p.z < 372;
    if (aisles) {
      const dir = (u: number) => { const a = f.along(u), b = f.along(u + 2); return Math.atan2(b[0] - a[0], b[1] - a[1]); };
      const turnBy = (u: number) => Math.abs(Math.atan2(Math.sin(dir(u) - dir(s)), Math.cos(dir(u) - dir(s))));
      bend = Math.max(turnBy(s + 7.5), turnBy(s + 12.5)) > 0.5;
      [ax, az] = f.along(s + (bend ? 8.5 : 3.5));
      while (leg < GATE_K && f.at(leg + 1) < s) leg++;
    } else if (full && leg < GATE_K) {
      // Elsewhere up to the gate: from point to point of the lines each place's own drives use, on to the next when within
      // 3 m of it (or once it is behind), and slowed for the last 8 m before each turn, as those drives do.
      while (leg < GATE_K && f.at(leg + 1) < s - 1) leg++;
      while (leg < GATE_K && Math.hypot(FULL_WAY[leg + 1][0] - p.x, FULL_WAY[leg + 1][1] - p.z) < 3) leg++;
      [ax, az] = FULL_WAY[leg + 1];
      bend = Math.hypot(ax - p.x, az - p.z) < 8;
    }
    // In the ship's lane: hold back by the hatches just short of the next container until it is on its way over to the
    // rail, then go by while it lies there.
    let wait = false;
    const ship = sim.rigs.list.find((rig) => rig.desc.loose)!;
    if (p.z > SHIP.z - SHIP.l + 14 && p.z - SHIP.z < 20) {
      const crates = ship.parts.slice(1).map((c, k) => ({ k, at: c.body.translation(), vx: c.body.linvel().x })).filter((c) => c.at.z - p.z > -5.5).sort((a, b) => a.at.z - b.at.z);
      const next = crates[0];
      if (next && next.at.z - p.z < 14) {
        if (!sides.has(next.k) && next.at.z - p.z < 8.5) {
          // Waiting by the hatches: off as soon as it is going over toward the rail and is clear of the way by the hatches;
          // it will lie there a while.
          if (next.vx < -0.3 && next.at.x - SHIP.x < -8.9) sides.set(next.k, -4.6);
          else wait = next.at.z - p.z < 6.6;
        }
        ax = SHIP.x + (sides.get(next.k) ?? -4.6);
      }
    }
    const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
    const off = Math.atan2(fx * (az - p.z) - fz * (ax - p.x), fx * (ax - p.x) + fz * (az - p.z));
    const speed = sim.truck.forwardSpeed();
    top = Math.max(top, speed);
    still = Math.abs(speed) < 0.3 ? still + 1 : 0;
    if (still > 60 * 12) break;
    // FULL: stuck against something, as a person would: back off a second and a half, the wheel the other way, then on.
    if ((full || process.env.RECOVER) && !wait && still > 90 && backing === 0) { backing = 90; tries++; still = 0; }
    if (backing > 0) { backing--; sim.step({ throttle: -1, steer: Math.max(-1, Math.min(1, off * 2.2)), handbrake: false }); continue; }
    const steerNow = Math.max(-1, Math.min(1, -off * 2.2));
    seen.push(steerNow);
    const steer = process.env.HUMAN ? seen[Math.max(0, seen.length - 13)] : steerNow;
    // Near the end, slow and stop in the square.
    const left = f.total - s;
    const onPlate = p.z > 430 && p.z < 445 && p.x > -8 && p.x < 53 && [2.55, 14.85, 26.75, 39.65, 52.9].some((x) => Math.abs(p.x - x) < 5);
    const aim = wait ? 0 : left < 12 ? Math.min(want, 1.2) : process.env.CAREFUL && onPlate ? Math.min(want, 1.6) : bend ? Math.min(want, 4) : want;
    const before = sim.cargoValue();
    sim.step({ throttle: speed < aim ? 1 : speed > aim + 1 ? -0.6 : 0.1, steer, handbrake: left < 3 });
    const lost = before - sim.cargoValue();
    const mark = Math.floor(s / 40);
    if (mark !== lastMark) { lastMark = mark; marks.push(`${s.toFixed(0)}m:${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%`); }
    if (process.env.TRACE && p.z > 495 && p.z < 515 && i % 6 === 0) { const c = sim.rigs.list.find((rig) => rig.desc.loose)!.parts[1].body; console.log(`     ${(i / 60).toFixed(1)} truck ${p.x.toFixed(1)},${p.z.toFixed(1)} v ${(speed * 3.6).toFixed(0)} wait ${wait} c0 ${c.translation().x.toFixed(1)},${c.translation().z.toFixed(1)} vx ${c.linvel().x.toFixed(2)}`); }
    if (process.env.TRACE && (i % 60 === 0 || lost > 3)) console.log(`   ${(i / 60).toFixed(1)} s: ${p.x.toFixed(1)},${p.y.toFixed(2)},${p.z.toFixed(1)} ${(speed * 3.6).toFixed(0)} km/h${lost > 3 ? ' lost ' + lost.toFixed(0) : ''}`);
  }
  // Stuck: can it be backed out? Reverse for three seconds and see how far it goes.
  if (process.env.BACK && !sim.result) { const was = sim.truck.body.translation(); const from = { x: was.x, z: was.z }; for (let i = 0; i < 180; i++) sim.step({ throttle: -1, steer: 0, handbrake: false }); const now = sim.truck.body.translation(); console.log('   backed out ' + Math.hypot(now.x - from.x, now.z - from.z).toFixed(1) + ' m, y ' + now.y.toFixed(2)); }
  for (let i = 0; i < 120 && !sim.result; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const p = sim.truck.body.translation();
  const kept = Math.round((sim.cargoValue() / sim.fullValue) * 100);
  const end = sim.result ? sim.result.failure ?? 'delivered' : s > f.total - 3 ? 'there' : 'stuck';
  console.log(`${kmh} km/h from ${from}: ${end} at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} (${s.toFixed(0)} of ${f.total.toFixed(0)} m), load ${kept}%, backed off ${tries}x, ${sim.time.toFixed(0)} s, top ${(top * 3.6).toFixed(0)} km/h  ${marks.join(' ')}`);
}

if (what === 'settle') {
  // Parked at each place a while: what has moved by itself.
  for (const at of Object.keys(OUTER_SPOTS) as (keyof typeof OUTER_SPOTS)[]) {
    const sim = await Sim.create(level);
    const [x, z, yaw, y] = OUTER_SPOTS[at];
    sim.teleport(x, z, yaw, y);
    const near = sim.objects.objects.filter((o) => Math.hypot(o.desc.pos[0] - x, o.desc.pos[2] - z) < 140);
    const start = near.map((o) => ({ ...o.body.translation() }));
    for (let i = 0; i < 60 * 10; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
    // What rides is carried: measured against where its deck has carried it, not where it was put.
    let moved = 0, worst = 0, under = 0;
    near.forEach((o, k) => {
      const p = o.body.translation();
      if (o.desc.free) return;
      if (o.desc.deck !== undefined) {
        const at = sim.rigs.carried(o.desc.deck, { x: o.desc.pos[0], y: o.desc.pos[1], z: o.desc.pos[2] });
        const d = Math.hypot(p.x - at.x, p.y - at.y, p.z - at.z);
        if (d > 0.3) { moved++; worst = Math.max(worst, d); }
        if (!o.riding) under++;
        return;
      }
      const d = Math.hypot(p.x - start[k].x, p.y - start[k].y, p.z - start[k].z);
      if (d > 0.3) { moved++; worst = Math.max(worst, d); if (process.env.TRACE) console.log(`   ${o.desc.kind} ${o.desc.pos.map((v) => v.toFixed(1))} moved ${d.toFixed(2)}`); }
    });
    console.log(`${at}: ${near.length} things, ${moved} moved (worst ${worst.toFixed(2)} m), ${under} let go off decks, result ${sim.result?.failure ?? 'none'}`);
  }
} else {
  for (const kmh of process.argv.slice(3).length ? process.argv.slice(3).map(Number) : [11, 18, 25, 36]) await drive(kmh);
}
