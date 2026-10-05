// The trial level made from a real place: what was built, and whether the truck gets up its way through. npx tsx dev/jiufen-check.ts
import { buildJiufen, jiufen } from '../src/levels/jiufen';
import { Sim } from '../src/sim/sim';

const { report } = buildJiufen();
console.log(`built in ${report.milliseconds} ms: ${report.pieces} pieces, ${report.triangles} triangles, ${report.walls} walls, steepest road ${(report.steepest * 100).toFixed(0)}%, tightest bend ${report.tightest.toFixed(1)} m radius`);
const level = jiufen();
console.log(`${level.props.filter((p) => p.building).length} houses, ${level.objects?.length ?? 0} things standing`);
const run = await Sim.create(level);
const route = level.route!;
let leg = 0, slowest = 99, where = '';
const total = 60 * 420;
let i = 0;
for (; i < total && leg < route.length - 1; i++) {
  const p = run.truck.body.translation();
  const r = run.truck.body.rotation();
  while (leg < route.length - 1 && Math.hypot(route[leg + 1][0] - p.x, route[leg + 1][1] - p.z) < 7) leg++;
  const [ax, az] = route[Math.min(leg, route.length - 2)];
  const [cx, cz] = route[Math.min(leg + 1, route.length - 1)];
  const length = Math.hypot(cx - ax, cz - az) || 1;
  const t = Math.min(1, ((p.x - ax) * (cx - ax) + (p.z - az) * (cz - az)) / (length * length) + 9 / length);
  const tx = ax + (cx - ax) * t, tz = az + (cz - az) * t;
  const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
  const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
  const speed = run.truck.forwardSpeed();
  const want = Math.abs(off) > 0.3 ? 4.5 : 9;
  run.step({ throttle: speed < want ? 0.9 : speed > want + 2 ? -0.4 : 0, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false });
  if (i > 300 && i % 60 === 0 && speed < slowest) { slowest = speed; where = `${p.x.toFixed(0)}, ${p.z.toFixed(0)}`; }
}
const end = run.truck.body.translation();
console.log(`${leg >= route.length - 1 ? 'PASS' : 'FAIL'}  the truck gets up the way through  (reached leg ${leg} of ${route.length - 1} at ${end.x.toFixed(0)}, ${end.z.toFixed(0)}, height ${end.y.toFixed(0)} m, in ${(i / 60).toFixed(0)} s; slowest ${slowest.toFixed(1)} m/s at ${where}; load ${Math.round((run.cargoValue() / run.fullValue) * 100)}%; rightings ${run.rightings})`);
process.exit(0);
