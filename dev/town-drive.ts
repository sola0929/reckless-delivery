// The second delivery, driven along its marked way by a simple hand on the wheel. npx tsx dev/town-drive.ts [top speed, m/s]
import { hilltown as hills } from '../src/levels/hilltown';
import { heightAt } from '../src/levels/terrain';
import { Sim } from '../src/sim/sim';

const top = Number(process.argv[2] ?? 9);
const level = hills();
const sim = await Sim.create(level);
const route = level.route!;
for (let i = 0; i < 90; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const rest = sim.truck.body.translation();
console.log(`at rest: y ${rest.y.toFixed(2)} on ground at ${heightAt(level.terrain, rest.x, rest.z).toFixed(2)}, load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%`);
let leg = 0;
for (let i = 0; i <= 60 * 300 && leg < route.length - 1; i++) {
  const p = sim.truck.body.translation();
  const r = sim.truck.body.rotation();
  // Make for a point a little way on along the leg; on to the next leg when its end is near.
  const [bx, bz] = route[leg + 1];
  if (Math.hypot(bx - p.x, bz - p.z) < 8) leg++;
  const [ax, az] = route[Math.min(leg, route.length - 2)];
  const [cx, cz] = route[Math.min(leg + 1, route.length - 1)];
  const length = Math.hypot(cx - ax, cz - az);
  const t = Math.min(1, (((p.x - ax) * (cx - ax) + (p.z - az) * (cz - az)) / (length * length)) + 8 / length);
  const tx = ax + (cx - ax) * t, tz = az + (cz - az) * t;
  const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
  const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
  const speed = sim.truck.forwardSpeed();
  const want = Math.abs(off) > 0.35 ? Math.min(top, 5) : top;
  sim.step({ throttle: speed < want ? 0.8 : speed > want + 2 ? -0.4 : 0, steer: Math.max(-1, Math.min(1, -off * 2.2)), handbrake: false });
  if (i % 600 === 0) console.log(`${i / 60}s  leg ${leg}  x ${p.x.toFixed(1)}  y ${p.y.toFixed(1)} (ground ${heightAt(level.terrain, p.x, p.z).toFixed(1)})  z ${p.z.toFixed(1)}  ${(speed * 3.6).toFixed(0)} km/h  load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%  rightings ${sim.rightings}`);
}
const end = sim.truck.body.translation();
console.log(`ended on leg ${leg} of ${route.length - 1} at z ${end.z.toFixed(0)}, load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%, rightings ${sim.rightings}`);
process.exit(0);
