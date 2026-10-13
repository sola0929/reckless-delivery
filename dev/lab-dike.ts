// Level 3's proving ground, the dike: driven along its middle at a steady speed, a few times each, starting at different
// moments in the machines' rounds. Whether it gets to the end, falls off, how much of the load is left. npx tsx dev/lab-dike.ts
import { quarryLab } from '../src/levels/quarryLab';
import { Sim } from '../src/sim/sim';
const level = quarryLab();
const C = 112;
const way: [number, number][] = [[C, -6], [C, 17], [C + 2.5, 32], [C + 2.5, 38], [C - 2.5, 46], [C - 2.5, 52], [C + 2.5, 62.5], [C + 2.5, 78.5], [C - 2.5, 87], [C - 2.5, 93], [C + 2.5, 100], [C + 2.5, 106], [C - 2.5, 114], [C - 2.5, 122], [C + 2.5, 130], [C + 2.5, 166]];
for (const want of [6, 10, 14]) {
  const out: string[] = [];
  for (const wait of [0, 2, 4, 6]) {
    const sim = await Sim.create({ ...level, crowds: [] });
    sim.teleport(C, -2, 0);
    for (let i = 0; i < 60 * (1 + wait); i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
    let leg = 0;
    for (let i = 0; i < 60 * 90 && leg < way.length - 1 && !sim.result; i++) {
      const p = sim.truck.body.translation();
      const r = sim.truck.body.rotation();
      while (leg < way.length - 1 && way[leg + 1][1] - p.z < 3) leg++;
      const [tx, tz] = way[Math.min(leg + 1, way.length - 1)];
      const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
      const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
      const speed = sim.truck.forwardSpeed();
      sim.step({ throttle: speed < want ? 0.9 : speed > want + 1 ? -0.6 : 0, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false });
    }
    const p = sim.truck.body.translation();
    out.push(`${sim.result ? sim.result.failure ?? 'done' : 'z ' + Math.round(p.z)} ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%`);
  }
  console.log(`${(want * 3.6).toFixed(0)} km/h: ${out.join(' | ')}`);
}
