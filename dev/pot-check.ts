// Level 2's hidden soup pot on top of the scaffold across the temple path: where it sits; then the truck driven into the
// scaffold, and where the pot ends up and how hurt. npx tsx dev/pot-check.ts
import { LEVELS } from '../src/levels';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(LEVELS.uptown());
const pot = sim.cargo.find((c) => c.type.id === 'stockpot')!;
const say = (when: string) => { const p = pot.body!.translation(); console.log(when, `pot ${p.x.toFixed(1)},${p.y.toFixed(2)},${p.z.toFixed(1)} hp ${pot.hp.toFixed(0)}`); };
for (let k = 0; k < 120; k++) sim.step({ throttle: 0, steer: 0, handbrake: true });
say('settled (2 s):');
sim.teleport(8, 896, 0);
for (let k = 0; k < 60; k++) sim.step({ throttle: 0, steer: 0, handbrake: true });
say('truck at the scaffold, before:');
for (let k = 0; k < 60 * 3; k++) sim.step({ throttle: 1, steer: 0, handbrake: false });
for (let k = 0; k < 60 * 5; k++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const t = sim.truck.body.translation();
say(`after driving in (truck ${t.x.toFixed(1)},${t.z.toFixed(1)}):`);
