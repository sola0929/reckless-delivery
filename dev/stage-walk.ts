// Level 1's concert stage: how many people are ever inside it over half a minute. npx tsx dev/stage-walk.ts

import { LEVELS } from '../src/levels';
import { Sim } from '../src/sim/sim';

const sim = await Sim.create(LEVELS.hillcity());
const [x0, z0, x1, z1] = [-241.7, 288.3, -235.8, 303.7];
let worst = 0;
for (let k = 0; k < 60 * 30; k++) {
  sim.step({ throttle: 0, brake: 0, steer: 0, boost: false, handbrake: false } as never, undefined as never);
  if (k % 30) continue;
  const inside = sim.pedestrians.list.filter((p) => p.pos.x > x0 + 0.3 && p.pos.x < x1 - 0.3 && p.pos.z > z0 + 0.3 && p.pos.z < z1 - 0.3).length;
  worst = Math.max(worst, inside);
}
console.log('most inside the stage at once:', worst);
