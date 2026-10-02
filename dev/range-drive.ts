// Flat out down the proving ground in a straight line: where the truck is each second. npx tsx dev/range-drive.ts [x]
import { range } from '../src/levels/range';
import { Sim } from '../src/sim/sim';

const x = Number(process.argv[2] ?? 0);
const sim = await Sim.create(range());
for (let i = 0; i < 90; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const t = sim.truck.body.translation();
for (const c of sim.cargo) if (c.body) { const p = c.body.translation(); c.body.setTranslation({ x: p.x + x - t.x, y: p.y, z: p.z }, true); }
sim.truck.body.setTranslation({ x, y: t.y, z: t.z }, true);
for (let i = 0; i <= 60 * 16; i++) {
  sim.step({ throttle: 1, steer: 0, handbrake: false });
  const p = sim.truck.body.translation();
  if (i % 60 === 0) console.log(`${i / 60}s  x ${p.x.toFixed(1)}  y ${p.y.toFixed(2)}  z ${p.z.toFixed(1)}  ${(sim.truck.forwardSpeed() * 3.6).toFixed(0)} km/h  load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%  rightings ${sim.rightings}`);
}
process.exit(0);
