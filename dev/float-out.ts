// Level 3's ponds: a pallet afloat beside the dike, thrown up out of the water on to the dike, must fall back and lie
// there, not hang in the air. npx tsx dev/float-out.ts
import { quarry } from '../src/levels/quarry';
import { Sim } from '../src/sim/sim';
import { heightAt } from '../src/levels/terrain';
const level = quarry();
const sim = await Sim.create({ ...level, crowds: [] });
sim.teleport(80, 600, 0);
const o = sim.objects.objects.find((x) => x.desc.kind === 'pallet' && x.desc.pos[2] > 600)!;
o.knocked = true;
o.body.setTranslation({ x: 70, y: 4, z: 650 }, true);
for (let s = 0; s < 60 * 4; s++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const afloat = o.body.translation();
// Thrown up and across on to the dike's top, as a machine's swing would.
o.body.setLinvel({ x: 5, y: 7, z: 0 }, true);
for (let s = 0; s < 60 * 4; s++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const p = o.body.translation();
console.log(`afloat at ${afloat.x.toFixed(1)},${afloat.y.toFixed(2)}; thrown, now ${p.x.toFixed(1)},${p.y.toFixed(2)},${p.z.toFixed(1)}, ground there ${heightAt(level.terrain, p.x, p.z).toFixed(2)}`);
process.exit(0);
