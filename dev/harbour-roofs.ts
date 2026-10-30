// Level 4's way over the roofs, headless: from the foot of the carport up it, round onto the roofs, down the diagonal,
// round onto the front, over the billboard and onto the market's roof; at steady speeds, steered by looking ahead along
// the way as a driver does. OUT=metres to keep to the outside of every turn (0); LOOK=metres ahead (6).
// What the load kept, the top speed, where it ended: through, stuck, fallen into the lane, into the drain.
// HANG=1 instead: the truck stood in the narrowest place with its left wheels out over the hole in the parapet, and
// driven on slowly, then backed: does it come out, fall, or hang there?
// npx tsx dev/harbour-roofs.ts
import { harbour } from '../src/levels/harbour';
import { ROOF_FORKS, ROOF_SPOTS, ROOF_WAY } from '../src/levels/harbourRoofs';
import { Sim } from '../src/sim/sim';
import type { Vec2 } from '../src/levels/types';

const level = harbour();
// FORK=0 or 1: round the fallen tower on its north side or its south.
const way: Vec2[] = [[103.775, 346], ...(process.env.FORK ? ROOF_FORKS[Number(process.env.FORK)] : ROOF_WAY), ROOF_SPOTS.over, [30, ROOF_SPOTS.over[1] + 1.4]];
const lengths = way.slice(1).map((p, k) => Math.hypot(p[0] - way[k][0], p[1] - way[k][1]));
const total = lengths.reduce((a, b) => a + b, 0);
/** The point so far along the way, pushed `out` to the left of it. */
function along(s: number, out = 0): Vec2 {
  for (let k = 0; k < lengths.length; k++) {
    if (s <= lengths[k] || k === lengths.length - 1) {
      const t = Math.min(1, s / lengths[k]), [ax, az] = way[k], [bx, bz] = way[k + 1];
      const ux = (bx - ax) / lengths[k], uz = (bz - az) / lengths[k];
      return [ax + (bx - ax) * t - uz * out, az + (bz - az) * t + ux * out];
    }
    s -= lengths[k];
  }
  return way.at(-1)!;
}
function nearest(x: number, z: number): number {
  let best = 0, bestD = Infinity, base = 0;
  for (let k = 0; k < lengths.length; k++) {
    const [ax, az] = way[k], [bx, bz] = way[k + 1], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengths[k] ** 2));
    const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
    if (d < bestD) { bestD = d; best = base + t * lengths[k]; }
    base += lengths[k];
  }
  return best;
}
/** Which way the way turns there: +1 left, -1 right, 0 straight. */
function bend(s: number): number {
  const [ax, az] = along(s - 3), [bx, bz] = along(s), [cx, cz] = along(s + 3);
  const cross = (bx - ax) * (cz - bz) - (bz - az) * (cx - bx);
  return Math.abs(cross) < 0.15 ? 0 : Math.sign(cross) * -1;
}

async function drive(want: number, out: number, look: number) {
  const sim = await Sim.create(level);
  sim.teleport(way[0][0], way[0][1], 0);
  for (let i = 0; i < 90; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  let top = 0, s = 0, lowY = 99, still = 0;
  const seen: number[] = [];
  for (let i = 0; i < 60 * 60 && !sim.result; i++) {
    const p = sim.truck.body.translation(), r = sim.truck.body.rotation();
    s = nearest(p.x, p.z);
    if (s > total - 3) break;
    // Out to the far side of a turn: left of the way on a right turn, right of it on a left.
    const [ax, az] = along(s + look, -bend(s + look) * out);
    const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
    const off = Math.atan2(fx * (az - p.z) - fz * (ax - p.x), fx * (ax - p.x) + fz * (az - p.z));
    const speed = sim.truck.forwardSpeed();
    top = Math.max(top, speed);
    if (p.x < 100.4) lowY = Math.min(lowY, p.y);
    still = Math.abs(speed) < 0.3 ? still + 1 : 0;
    if (still > 60 * 4) break;
    const before = sim.cargoValue();
    // HUMAN=1: steering as a person does, a fifth of a second behind what they see.
    const want$ = Math.max(-1, Math.min(1, -off * 2.2));
    seen.push(want$);
    const steer = process.env.HUMAN ? seen[Math.max(0, seen.length - 13)] : want$;
    sim.step({ throttle: speed < want ? 1 : speed > want + 1 ? -0.6 : 0.1, steer, handbrake: false });
    if (process.env.TRACE && (i % 45 === 0 || before - sim.cargoValue() > 3)) console.log(`   ${(i / 60).toFixed(1)} s, ${s.toFixed(0)} m: ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} ${(speed * 3.6).toFixed(0)} km/h${before - sim.cargoValue() > 3 ? ` lost ${(before - sim.cargoValue()).toFixed(0)}` : ''}`);
  }
  const p = sim.truck.body.translation();
  const kept = Math.round((sim.cargoValue() / sim.fullValue) * 100);
  const end = sim.result ? sim.result.failure ?? 'done' : s > total - 3 ? 'over onto the market roof' : lowY < 2 ? 'down off the roofs' : 'stuck';
  console.log(`${(want * 3.6).toFixed(0)} km/h${out ? `, ${out} m wide` : ''}: ${end} at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} (${s.toFixed(0)} of ${total.toFixed(0)} m), load ${kept}%, top ${(top * 3.6).toFixed(0)} km/h`);
}

async function hang() {
  // Along the front's run, west, at a walk: steered left toward the parapet so as to come to a hole in it, held there,
  // then backed out. Does it come back, go over, or hang on the edge?
  for (const [name, x, steer, hold] of [['into the first hole, gently', 71, -0.35, 2.2], ['into the first hole, sharply', 70, -1, 1.6], ['into the second hole', 64.5, -0.5, 2.0]] as const) {
    const sim = await Sim.create(level);
    sim.teleport(x, 346.8, -Math.PI / 2, 3.7);
    for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
    const report = (what: string) => { const p = sim.truck.body.translation(), r = sim.truck.body.rotation(); const lean = Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (r.x * r.x + r.z * r.z)))) * 180 / Math.PI; console.log(`  ${name}, ${what}: at ${p.x.toFixed(1)},${p.y.toFixed(2)},${p.z.toFixed(1)}, leaning ${lean.toFixed(0)}°${sim.result ? ` ${sim.result.failure}` : ''}`); };
    for (let i = 0; i < 60 * hold; i++) { const v = sim.truck.forwardSpeed(); sim.step({ throttle: v < 2 ? 0.6 : 0, steer: i < 30 ? 0 : steer, handbrake: false }); }
    report('steered at it');
    for (let i = 0; i < 60 * 2; i++) { const v = sim.truck.forwardSpeed(); sim.step({ throttle: v < 1.5 ? 0.6 : 0, steer: 0, handbrake: false }); }
    report('on 2 s more');
    for (let i = 0; i < 60 * 4; i++) sim.step({ throttle: -0.8, steer: 0, handbrake: false });
    report('backed 4 s');
  }
}

if (process.env.HANG) await hang();
else for (const v of (process.env.SPEEDS ?? '3,5,7,10').split(',').map(Number)) await drive(v, Number(process.env.OUT ?? 0), Number(process.env.LOOK ?? 6));
