// Level 3's ways between its places, driven headless at a steady speed along points down the middle of the way (weaving
// round the parked lorries): whether each gets through, and what of the load is left. npx tsx dev/quarry-legs.ts
import { quarry } from '../src/levels/quarry';
import { Sim } from '../src/sim/sim';
const level = quarry();
const legs: [string, [number, number][]][] = [
  ['gate to the stockpiles', [[32, 20], [32, 54]]],
  ['high street', [[32, 280], [32, 298], [40, 306], [104, 306], [112, 314], [112, 344]]],
  ['descent', [[112, 450], [112, 470], [104, 482], [88, 482], [80, 492], [80, 540]]],
  ['pump station', [[82.5, 787], [83, 794], [86, 806], [86, 824], [93, 848], [94, 856]]],
];
for (const [name, way] of legs) {
  const out: string[] = [];
  for (const want of [4, 7]) {
    const sim = await Sim.create({ ...level, crowds: [] });
    const [x0, z0] = way[0], [x1, z1] = way[1];
    sim.teleport(x0, z0, Math.atan2(x1 - x0, z1 - z0));
    for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
    let leg = 0;
    for (let i = 0; i < 60 * 60 && leg < way.length - 1 && !sim.result; i++) {
      const p = sim.truck.body.translation();
      const r = sim.truck.body.rotation();
      while (leg < way.length - 1 && Math.hypot(way[leg + 1][0] - p.x, way[leg + 1][1] - p.z) < 3) leg++;
      const [tx, tz] = way[Math.min(leg + 1, way.length - 1)];
      const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
      const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
      const speed = sim.truck.forwardSpeed();
      sim.step({ throttle: speed < want ? 0.9 : speed > want + 1 ? -0.6 : 0, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false });
    }
    const p = sim.truck.body.translation();
    out.push(`${(want * 3.6).toFixed(0)} km/h ${leg >= way.length - 1 ? 'through' : `stuck at ${p.x.toFixed(0)},${p.z.toFixed(0)}`}, load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%${sim.result ? ' ' + sim.result.failure : ''}`);
  }
  console.log(`${name}: ${out.join(' | ')}`);
}
process.exit(0);
