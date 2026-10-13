// Level 3's proving ground, the stockpile yard: driven along the snaking way between the heaps, and straight down the middle,
// at a steady speed. How far it gets, the most it leans, whether it goes over, how much of the load is left. npx tsx dev/lab-lane.ts
import { quarryLab } from '../src/levels/quarryLab';
import { Sim } from '../src/sim/sim';
const level = quarryLab();
const A = 16;
const snake: [number, number][] = [[A, -10], ...([[4.5, 8], [6, 27.5], [6.5, 48], [3, 66.5], [3, 82.5], [5.5, 100.5], [6.5, 121], [4, 140.5], [3, 157.5], [6, 176], [6.5, 196.5], [3.5, 215.5]] as const).map(([r, z], n) => [A + (n % 2 ? -1 : 1) * (r + 0.2), z] as [number, number]), [A, 228]];
const straight: [number, number][] = [[A, -10], [A, 228]];
for (const [name, way] of [['snaking', snake], ['straight', straight]] as const) {
  for (const want of [3, 6, 10]) {
    const sim = await Sim.create({ ...level, crowds: [] });
    sim.teleport(A, -12, 0);
    for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
    let leg = 0, lean = 0;
    for (let i = 0; i < 60 * 150 && leg < way.length - 1 && !sim.result; i++) {
      const p = sim.truck.body.translation();
      const r = sim.truck.body.rotation();
      while (leg < way.length - 1 && way[leg + 1][1] - p.z < 2) leg++;
      const [tx, tz] = way[Math.min(leg + 1, way.length - 1)];
      const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
      const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
      const speed = sim.truck.forwardSpeed();
      sim.step({ throttle: speed < want ? 0.9 : speed > want + 1 ? -0.6 : 0, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false });
      const up = 1 - 2 * (r.x * r.x + r.z * r.z);
      lean = Math.max(lean, (Math.acos(Math.min(1, up)) * 180) / Math.PI);
    }
    const p = sim.truck.body.translation();
    console.log(`${name} ${want * 3.6} km/h: reached z ${Math.round(p.z)}, most lean ${Math.round(lean)}°${sim.result ? ' ' + JSON.stringify(sim.result) : ''}, load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%`);
  }
}
