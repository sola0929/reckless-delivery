// Level 4's alleys: the truck stood at the first one's mouth for two minutes; how much of what the roofs send is lying
// about the street at the end of each half minute. npx tsx dev/harbour-gust-pile.ts
import { harbour } from '../src/levels/harbour';
import { Sim } from '../src/sim/sim';

const level = harbour();
const sim = await Sim.create(level);
sim.teleport(1.5, 150, 0);
const pools = sim.wind.list.slice(0, 3).map((g) => g.pool);
const out: string[] = [];
for (let i = 1; i <= 60 * 120; i++) {
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  if (i % (60 * 30) === 0) out.push(`${i / 60} s: ${pools.map((pool) => pool.filter((o) => o.body.isEnabled() && o.body.translation().y > -1).length).join(' / ')}`);
}
console.log('lying about, alleys 1 / 2 / 3 —', out.join('  '));
