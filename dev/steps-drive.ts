// The stepped sample: does it build, and does the truck get up the ramps and round onto the hill road. npx tsx dev/steps-drive.ts
import { steps } from '../src/levels/steps';
import { heightAt } from '../src/levels/terrain';
import { Sim } from '../src/sim/sim';

const level = steps();
const sim = await Sim.create(level);
for (let i = 0; i <= 60 * 16; i++) {
  sim.step({ throttle: i < 60 ? 0 : 0.7, steer: 0, handbrake: i < 60 });
  const p = sim.truck.body.translation();
  if (i % 120 === 0) console.log(`${i / 60}s  z ${p.z.toFixed(1)}  y ${p.y.toFixed(2)} (ground ${heightAt(level.terrain, p.x, p.z).toFixed(2)})  ${(sim.truck.forwardSpeed() * 3.6).toFixed(0)} km/h  load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%`);
}
process.exit(0);
