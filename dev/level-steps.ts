// A level's physics step, from its start, driving on for ten seconds. npx tsx dev/level-steps.ts <level>
import { LEVELS } from '../src/levels/index';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(LEVELS[process.argv[2] ?? 'hillcity']());
let total = 0, worst = 0;
for (let i = 0; i < 600; i++) {
  const t0 = performance.now();
  sim.step({ throttle: 0.4, steer: 0, handbrake: false });
  const ms = performance.now() - t0;
  if (i > 30) { total += ms; worst = Math.max(worst, ms); }
}
console.log(`${process.argv[2]}: ${(total / 569).toFixed(1)} ms a step on average, ${worst.toFixed(1)} at worst`);
process.exit(0);
