// Level 2's draft: what it is made of, and whether the truck gets along the way through, down the steps and
// through the lane, with the traffic, the people and the coils taken away. npx tsx dev/uptown-check.ts
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';

const began = Date.now();
const level = uptown();
console.log(`made in ${Date.now() - began} ms: ground of ${(level.terrain!.stepped!.indices.length / 3) | 0} triangles; ${level.props.length} props (${level.props.filter((p) => p.building).length} houses), ${level.objects?.length} things, ${level.decals.length} markings`);
const bare = { ...level, traffic: [], crowds: [], rollers: [] };
const sim = await Sim.create(bare);
const route = level.route!;
let leg = 0, slowest = 99, where = '';
let i = 0;
for (; i < 60 * 300 && leg < route.length - 1; i++) {
  const p = sim.truck.body.translation();
  const r = sim.truck.body.rotation();
  while (leg < route.length - 1 && Math.hypot(route[leg + 1][0] - p.x, route[leg + 1][1] - p.z) < 3.5) leg++;
  const [ax, az] = route[Math.min(leg, route.length - 2)];
  const [cx, cz] = route[Math.min(leg + 1, route.length - 1)];
  const length = Math.hypot(cx - ax, cz - az) || 1;
  const t = Math.min(1, ((p.x - ax) * (cx - ax) + (p.z - az) * (cz - az)) / (length * length) + 4.5 / length);
  const tx = ax + (cx - ax) * t, tz = az + (cz - az) * t;
  const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
  const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
  const speed = sim.truck.forwardSpeed();
  const want = Math.abs(off) > 0.3 ? 3.5 : 7;
  sim.step({ throttle: speed < want ? 0.9 : speed > want + 2 ? -0.5 : 0, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false });
  if (i > 300 && i % 60 === 0 && speed < slowest) { slowest = speed; where = `${p.x.toFixed(0)}, ${p.z.toFixed(0)}`; }
}
// Stop in the bay, as a driver would, to hand the load over.
for (let k = 0; k < 60 * 4; k++) sim.step({ throttle: -1, steer: 0, handbrake: true });
const end = sim.truck.body.translation();
const done = !!sim.result && !sim.result.failure;
console.log(`${leg >= route.length - 1 || done ? 'PASS' : 'FAIL'}  the truck gets through  (reached leg ${leg} of ${route.length - 1} at ${end.x.toFixed(0)}, ${end.z.toFixed(0)}, height ${end.y.toFixed(1)}, in ${(i / 60).toFixed(0)} s; slowest ${slowest.toFixed(1)} m/s at ${where}; load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%; rightings ${sim.rightings}; delivered ${done})`);
process.exit(0);
