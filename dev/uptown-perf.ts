// How long a physics step takes on level 2 with everything going, at each of its jump points. npx tsx dev/uptown-perf.ts
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create(level);
for (const spot of level.checkpoints!.filter((_, k) => !process.argv[2] || process.argv.slice(2).map(Number).includes(k + 1))) {
  sim.teleport(spot.pos[0], spot.pos[1], spot.yaw);
  for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  let total = 0, worst = 0;
  for (let i = 0; i < 300; i++) {
    const t0 = performance.now();
    sim.step({ throttle: 0.3, steer: 0, handbrake: false });
    const ms = performance.now() - t0;
    total += ms;
    worst = Math.max(worst, ms);
  }
  console.log(`${spot.name.padEnd(8, '　')} ${(total / 300).toFixed(1)} ms a step on average, ${worst.toFixed(1)} at worst`);
}
process.exit(0);
