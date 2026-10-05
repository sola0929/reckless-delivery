// Left alone, the scaffold stands. npx tsx dev/scaffold-still.ts
import { LEVELS } from '../src/levels/index';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(LEVELS.uptown());
for (let i = 0; i < 60 * 20; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
console.log(`${sim.objects.objects.filter((o) => o.kind.collapse && o.knocked).length} pieces down after 20 s alone`);
process.exit(0);
