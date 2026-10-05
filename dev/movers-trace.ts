// Where the movers are, every two seconds. npx tsx dev/movers-trace.ts
import { LEVELS } from '../src/levels/index';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(LEVELS.uptown());
const movers = sim.riders.list.filter((r) => r.kind === 'movers');
for (let i = 0; i <= 60 * 30; i++) {
  if (i % 120 === 0) console.log(`${i / 60}s ` + movers.map((r) => `${r.load} z${r.body.translation().z.toFixed(1)} v${r.speed.toFixed(1)} d${r.d.toFixed(1)}${r.turn >= 0 ? ' turning' : ''}`).join(' | '));
  sim.step({ throttle: 0, steer: 0, handbrake: true });
}
process.exit(0);
