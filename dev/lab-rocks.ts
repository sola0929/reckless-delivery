// Level 3's proving ground, the conveyors: the truck driven through the columns under them at a steady speed, several
// times each. How many rocks hit it and how much of the load is left. npx tsx dev/lab-rocks.ts
import { quarryLab } from '../src/levels/quarryLab';
import { Sim } from '../src/sim/sim';
const level = quarryLab();
const B = 64;
// Through the gaps in the rows of columns: the open side of each row in turn.
const way: [number, number][] = [[B, 2], [B, 102]];
for (const want of [3, 6, 10, 14]) {
  const out: string[] = [];
  for (let run = 0; run < 3; run++) {
    const sim = await Sim.create({ ...level, traffic: [], crowds: [], machines: [], rigs: [] });
    sim.teleport(B, -4 - run * 3.7, 0);
    for (let i = 0; i < 60 * (1 + run); i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
    let leg = 0, hits = 0;
    for (let i = 0; i < 60 * 60 && leg < way.length - 1; i++) {
      const p = sim.truck.body.translation();
      const r = sim.truck.body.rotation();
      while (leg < way.length - 1 && way[leg + 1][1] - p.z < 2) leg++;
      const [tx, tz] = way[Math.min(leg + 1, way.length - 1)];
      const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
      const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
      const speed = sim.truck.forwardSpeed();
      sim.step({ throttle: speed < want ? 0.9 : speed > want + 1 ? -0.6 : 0, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false });
      for (const b of sim.droppers.breaks) if (Math.hypot(b.x - p.x, b.z - p.z) < 3.5) hits++;
    }
    out.push(`z ${Math.round(sim.truck.body.translation().z)} ${hits} hits, ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%`);
  }
  console.log(`${want * 3.6} km/h: ${out.join(' | ')}`);
}
process.exit(0);
