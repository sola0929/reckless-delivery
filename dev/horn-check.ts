// Horns sounded at the truck while it stands on the way down the hill, where no traffic goes: there should be none.
// npx tsx dev/horn-check.ts
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create(level);
let horns = 0;
for (const z of [1000, 1006, 1012]) {
  sim.teleport(-302, z, Math.PI);
  for (let i = 0; i < 60 * 20; i++) {
    sim.step({ throttle: 0, steer: 0, handbrake: true });
    horns += sim.drainHorns().length;
  }
}
console.log(`horns at the truck on the first leg in a minute: ${horns}`);
process.exit(0);
