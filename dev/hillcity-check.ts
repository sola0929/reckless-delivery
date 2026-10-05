// The city on a hillside: that it builds, that the truck and what stands in it rest where they are put,
// and that the truck can be driven up its first slope. npx tsx dev/hillcity-check.ts
import { hillcity } from '../src/levels/hillcity';
import { heightAt } from '../src/levels/terrain';
import { Sim } from '../src/sim/sim';

const began = Date.now();
const level = hillcity();
console.log(`made in ${Date.now() - began} ms: ${level.props.length} props, ${level.objects?.length} objects, ${level.decals.length} decals, ground of ${(level.terrain!.stepped!.indices.length / 3) | 0} triangles`);
const sim = await Sim.create(level);
const world = (sim as unknown as { world: { bodies: { forEach(f: (b: { isDynamic(): boolean; translation(): { x: number; y: number; z: number } }) => void): void } } }).world;
const before = new Map<unknown, { x: number; y: number; z: number }>();
world.bodies.forEach((b) => { if (b.isDynamic()) before.set(b, { ...b.translation() }); });
for (let i = 0; i < 240; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
let moved = 0, worst = 0;
world.bodies.forEach((b) => {
  const was = before.get(b);
  if (!was) return;
  const now = b.translation();
  const far = Math.hypot(now.x - was.x, now.y - was.y, now.z - was.z);
  if (far > 0.3) moved++;
  worst = Math.max(worst, far);
});
const t = sim.truck.body.translation();
console.log(`after 4 s at rest: truck at height ${t.y.toFixed(2)} over ground at ${heightAt(level.terrain, t.x, t.z).toFixed(2)}; ${moved} of ${before.size} loose bodies moved more than 0.3 m (the most, ${worst.toFixed(2)} m); load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%`);
// Up the first slope: straight north out of the depot along the route.
const route = level.route!;
let leg = 0;
for (let i = 0; i < 60 * 40 && leg < 6; i++) {
  const p = sim.truck.body.translation();
  const r = sim.truck.body.rotation();
  while (leg < route.length - 1 && Math.hypot(route[leg + 1][0] - p.x, route[leg + 1][1] - p.z) < 6) leg++;
  const [tx, tz] = route[leg + 1];
  const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
  const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
  const speed = sim.truck.forwardSpeed();
  sim.step({ throttle: speed < 8 ? 0.9 : 0, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false });
}
const end = sim.truck.body.translation();
console.log(`driven: reached leg ${leg} at ${end.x.toFixed(0)}, ${end.z.toFixed(0)} (row ${(end.z / 16).toFixed(1)}), height ${end.y.toFixed(2)} over ground at ${heightAt(level.terrain, end.x, end.z).toFixed(2)}; load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%`);
process.exit(0);
