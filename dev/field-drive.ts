// The battlefield, headless: does it build, does the truck stand still on it, and how far does a straight run get. npx tsx dev/field-drive.ts
import { battlefield } from '../src/levels/battlefield';
import { Sim } from '../src/sim/sim';

const sim = await Sim.create(battlefield());
for (let i = 0; i < 120; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const rest = sim.truck.body.translation();
console.log(`at rest: x ${rest.x.toFixed(2)} y ${rest.y.toFixed(2)} z ${rest.z.toFixed(2)}, load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%`);
for (let i = 0; i <= 60 * 14; i++) {
  sim.step({ throttle: 1, steer: 0, handbrake: false });
  const p = sim.truck.body.translation();
  if (i % 120 === 0) console.log(`${i / 60}s  x ${p.x.toFixed(1)}  y ${p.y.toFixed(2)}  z ${p.z.toFixed(1)}  ${(sim.truck.forwardSpeed() * 3.6).toFixed(0)} km/h  load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%  started ${sim.started}`);
}
process.exit(0);
