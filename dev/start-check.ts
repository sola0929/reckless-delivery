// Level 2's clock: still while the truck stands in the bay, running once it is through the barrier. npx tsx dev/start-check.ts
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create({ ...level, traffic: [], crowds: [], riders: [] });
for (let i = 0; i < 180; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const standing = sim.time;
let through = -1;
for (let i = 0; i < 600 && through < 0; i++) {
  sim.step({ throttle: 0.6, steer: 0, handbrake: false });
  if (sim.time > 0) through = sim.truck.body.translation().z;
}
console.log(`clock after 3 s standing: ${standing.toFixed(2)} s; it starts with the truck at z ${through.toFixed(1)} (the line is at ${16 * 45 + 6}); par ${level.par} s`);
process.exit(0);
