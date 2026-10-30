// Level 4's flooded lane at a steady speed, no slowing for the turns: past the open drains, between the bucket truck's
// legs and the dock, across in the deep water to pass the reefer lorry on the houses' side, and round into the carport,
// steered by looking ahead along the line as a driver does. What the load kept, how far the tail slid out, whether it
// got onto the carport. LOOK=metres ahead (6), GRIP=the deep water's side grip in place of the level's.
// npx tsx dev/harbour-squeeze.ts
import { harbour } from '../src/levels/harbour';
import { Sim } from '../src/sim/sim';

const level = harbour();
if (process.env.GRIP) level.fords![0].sideGrip = Number(process.env.GRIP);
if (process.env.WITHOUT) level.objects = level.objects!.filter((o) => o.kind !== process.env.WITHOUT);
type Point = [number, number];
const LINES: Record<string, Point[]> = {
  // Into the carport round a wide swing out beyond the reefer's end.
  wide: [[44, 339.4], [47.5, 340.4], [53.5, 339.9], [58, 339], [63, 338.1], [80, 338.1], [88, 340.6], [96, 340.9], [100.5, 340.6], [103.5, 340.4], [105.2, 342.6], [104.2, 346], [103.75, 350], [103.75, 360]],
  // Cutting in round the houses' corner.
  tight: [[44, 339.4], [47.5, 340.4], [53.5, 339.9], [58, 339], [63, 338.1], [79, 338.1], [86, 340.8], [92, 341.1], [98.5, 341.2], [102.6, 342.4], [103.75, 346], [103.75, 360]],
};
const line = LINES[process.env.LINE ?? 'wide'];
const lengths = line.slice(1).map((p, k) => Math.hypot(p[0] - line[k][0], p[1] - line[k][1]));
/** The point so far along the line. */
function along(s: number): Point {
  for (let k = 0; k < lengths.length; k++) {
    if (s <= lengths[k]) { const t = s / lengths[k]; return [line[k][0] + (line[k + 1][0] - line[k][0]) * t, line[k][1] + (line[k + 1][1] - line[k][1]) * t]; }
    s -= lengths[k];
  }
  return line.at(-1)!;
}
/** How far along the line its nearest point to a place is. */
function nearest(x: number, z: number): number {
  let best = 0, bestD = Infinity, base = 0;
  for (let k = 0; k < lengths.length; k++) {
    const [ax, az] = line[k], [bx, bz] = line[k + 1], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (lengths[k] ** 2)));
    const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
    if (d < bestD) { bestD = d; best = base + t * lengths[k]; }
    base += lengths[k];
  }
  return best;
}

async function run(want: number, look: number) {
  const sim = await Sim.create(level);
  sim.teleport(line[0][0], line[0][1], Math.PI / 2);
  for (let i = 0; i < 90; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  let top = 0, slide = 0, worst = 0, s = 0;
  const total = lengths.reduce((a, b) => a + b, 0);
  const seen: number[] = [];
  for (let i = 0; i < 60 * 40 && !sim.result; i++) {
    const p = sim.truck.body.translation(), r = sim.truck.body.rotation(), v = sim.truck.body.linvel();
    s = nearest(p.x, p.z);
    if (s > total - 2) break;
    const [ax, az] = along(s + look);
    const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
    const off = Math.atan2(fx * (az - p.z) - fz * (ax - p.x), fx * (ax - p.x) + fz * (az - p.z));
    const speed = sim.truck.forwardSpeed();
    top = Math.max(top, speed);
    slide = Math.max(slide, Math.abs(fz * v.x - fx * v.z));
    const before = sim.cargoValue();
    // HUMAN=1: steering as a person does, a fifth of a second behind what they see.
    const want$ = Math.max(-1, Math.min(1, -off * 2.2));
    seen.push(want$);
    const steer = process.env.HUMAN ? seen[Math.max(0, seen.length - 13)] : want$;
    sim.step({ throttle: speed < want ? 1 : speed > want + 1 ? -0.6 : 0.1, steer, handbrake: false });
    if (before - sim.cargoValue() > 0) { worst = Math.max(worst, p.x); if (process.env.TRACE) console.log('   loss at', p.x.toFixed(1), p.z.toFixed(1), 'heading', (Math.atan2(fx, fz) * 180 / Math.PI).toFixed(0), 'lost', (before - sim.cargoValue()).toFixed(0)); }
  }
  const p = sim.truck.body.translation();
  const kept = Math.round((sim.cargoValue() / sim.fullValue) * 100);
  const end = sim.result ? (sim.result.failure ?? 'done') : p.z > 352 ? 'onto the carport' : 'stuck';
  console.log(`${(want * 3.6).toFixed(0)} km/h, looking ${look} m: ${end} at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}, load ${kept}%, top ${(top * 3.6).toFixed(0)} km/h, tail out up to ${slide.toFixed(2)} m/s${worst ? `, last loss at x ${worst.toFixed(0)}` : ''}`);
}
const look = Number(process.env.LOOK ?? 6);
for (const v of [3, 5, 7, 10]) await run(v, look);
