// The steps of level 2 taken at different speeds, steering for the turn on the landing: what the load loses, and where it ends. npx tsx dev/steps-and-coils.ts
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const base = uptown();
// The way down, in the city's frame: the right-hand half of the first flight, round on the landing, the right-hand half of the second.
const way: [number, number][] = [[82, 960.4], [55, 960.4], [50, 958], [45, 953.5], [41, 952.4], [10, 952.4]];
for (const speed of [4, 6, 8, 10, 12]) {
  const sim = await Sim.create({ ...base, traffic: [], crowds: [], rollers: [] });
  const t0 = sim.truck.body.translation();
  const q = { x: 0, y: Math.sin(-Math.PI / 4), z: 0, w: Math.cos(-Math.PI / 4) };
  const [x, z, y] = [86, 960.4, 35.9];
  sim.truck.body.setTranslation({ x, y, z }, true);
  sim.truck.body.setRotation(q, true);
  for (const c of sim.cargo) if (c.body) { const p = c.body.translation(); c.body.setTranslation({ x: x - (p.z - t0.z), y: p.y - t0.y + y, z: z + (p.x - t0.x) }, true); c.body.setRotation(q, true); }
  for (let i = 0; i < 90; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const before = sim.cargoValue();
  let leg = 0;
  for (let i = 0; i < 60 * 25 && leg < way.length - 1; i++) {
    const p = sim.truck.body.translation(); const r = sim.truck.body.rotation();
    while (leg < way.length - 1 && Math.hypot(way[leg + 1][0] - p.x, way[leg + 1][1] - p.z) < 3.5) leg++;
    const [tx, tz] = way[Math.min(leg + 1, way.length - 1)];
    const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
    const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
    const v = sim.truck.forwardSpeed();
    sim.step({ throttle: v < speed ? 0.9 : v > speed + 1 ? -0.6 : 0, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false });
  }
  const end = sim.truck.body.translation();
  console.log(`at ${speed * 3.6} km/h: load ${Math.round((before / sim.fullValue) * 100)}% -> ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%, ${sim.cargo.filter((c) => c.fallen).length} pieces out; got to leg ${leg} of ${way.length - 1} (${end.x.toFixed(0)}, ${end.z.toFixed(0)})`);
}
process.exit(0);
