// A hidden thing dropped in the water goes back where it was left: level 3's loudhailer, lifted off the island and let go over
// the pond, then where it is two and a half seconds later. npx tsx dev/hidden-water.ts
import { Vector3 } from 'three';
import { LEVELS } from '../src/levels';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(LEVELS.quarry());
const PARK = { throttle: 0, steer: 0, handbrake: true };
sim.teleport(79.5, 730, Math.PI);
for (let k = 0; k < 30; k++) sim.step(PARK);
const mp = sim.cargo.find((c) => c.type.id === 'megaphone')!;
const home = mp.body!.translation();
console.log('home', home.x.toFixed(1), home.y.toFixed(2), home.z.toFixed(1));
sim.cargoSystem.hold(mp);
sim.cargoSystem.release(mp, new Vector3(89, 5, 718), new Vector3(0, 0, 0), false);
for (let k = 0; k < 40; k++) sim.step(PARK);
let p = mp.body!.translation();
console.log('in the pond', p.x.toFixed(1), p.y.toFixed(2), p.z.toFixed(1), 'soaked', mp.soaked.toFixed(2));
for (let k = 0; k < 120; k++) sim.step(PARK);
p = mp.body!.translation();
console.log('later', p.x.toFixed(1), p.y.toFixed(2), p.z.toFixed(1), 'pinned', mp.pinned, 'taken', mp.taken);
// Picked up again from the island and set down on it: it stays on it, not through it.
sim.cargoSystem.hold(mp);
sim.cargoSystem.release(mp, new Vector3(97, 4.6, 722), new Vector3(0, 0, 0), false);
for (let k = 0; k < 120; k++) sim.step(PARK);
p = mp.body!.translation();
console.log('set down again', p.x.toFixed(1), p.y.toFixed(2), p.z.toFixed(1), '(island top 3.85)');
