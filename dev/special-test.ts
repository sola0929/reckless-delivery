// Headless check of the things that do more than fall over when hit: a cylinder of gas goes
// off a moment after it is knocked, sets off its neighbours, throws what is near it, and
// costs a truck beside it some of its load without ending the run.
// npx tsx dev/special-test.ts
import { city } from '../src/levels/city';
import { OBJECT_KINDS, type ObjectKind } from '../src/levels/objects';
import { Sim } from '../src/sim/sim';
import type { DriveInput } from '../src/sim/truck';

const idle: DriveInput = { throttle: 0, steer: 0, handbrake: true };
let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const level = city();
const kinds = new Set(level.objects!.map((o) => o.kind));
check('the market sells more than one thing', ['fruitOrange', 'fruitMelon', 'snackCartRed', 'fishStall', 'flowerStall', 'clothesRack', 'chickenCage', 'stallRed'].filter((k) => kinds.has(k as never)).length >= 7);
check('there is fruit to drive through, and paint', level.objects!.some((o) => (OBJECT_KINDS[o.kind] as ObjectKind).juice !== undefined && o.kind.startsWith('fruit')) && kinds.has('paintWhite'));
check('a feast is laid in the back street', level.objects!.filter((o) => o.kind === 'banquetTable').length >= 12 && kinds.has('tent') && kinds.has('firecrackers'));

const sim = await Sim.create(level);
for (let i = 0; i < 180; i++) sim.step(idle);
const cylinders = sim.objects.objects.filter((o) => o.kind.explosive);
const apart = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

// 1. The kitchen at the feast: three cylinders close together.
const kitchen = cylinders.filter((o) => cylinders.filter((p) => apart(o.body.translation(), p.body.translation()) < 6).length >= 3);
check('the feast has its gas standing together', kitchen.length >= 3, `${kitchen.length} cylinders`);
const first = kitchen[0];
const at = first.body.translation();
const near = sim.objects.objects.filter((o) => o !== first && apart(o.body.translation(), at) < 6);
const people = sim.pedestrians.list.filter((p) => Math.hypot(p.pos.x - at.x, p.pos.z - at.z) < 6);
// Knock it, as running into it would.
first.body.setLinvel({ x: 3, y: 0, z: 0 }, true);
let blasts = 0;
let high = 0;
for (let i = 0; i < 60 * 3; i++) {
  sim.step(idle);
  blasts += sim.drainBlasts().length;
  high = Math.max(high, first.body.translation().y);
}
check('a knocked cylinder goes off', blasts >= 1 && high > 4, `it went ${high.toFixed(1)} m up`);
check('and sets off the ones beside it', blasts >= 3, `${blasts} explosions`);
check('throwing what stood near', near.filter((o) => o.knocked).length >= near.length * 0.8 && near.length > 8, `${near.filter((o) => o.knocked).length} of ${near.length} objects`);
check('and whoever stood near', people.length > 0 && people.every((p) => p.state === 'down' || Math.hypot(p.pos.x - at.x, p.pos.z - at.z) > 3), `${people.length} people`);
check('far from the truck, it costs the load nothing', sim.cargoValue() === sim.fullValue && !sim.result);

// 2. Beside the truck.
sim.reset();
for (let i = 0; i < 180; i++) sim.step(idle);
check('a reset puts the gas back', cylinders.every((o) => !o.knocked && o.fuse < 0 && o.body.isSleeping()));
const t = sim.truck.body.translation();
const move = (body: { translation(): { x: number; y: number; z: number }; setTranslation(p: { x: number; y: number; z: number }, wake: boolean): void }, x: number, z: number) => {
  const p = body.translation();
  // Up onto the terrace the feast is laid on, and a little over, to be set down on it.
  body.setTranslation({ x: p.x + x - t.x, y: p.y + 0.7, z: p.z + z - t.z }, true);
};
// At the foot of the feast's steps, a truck's length from the stoves and their gas.
for (const c of sim.cargo) if (c.body) move(c.body, at.x - 6, at.z + 2.5);
move(sim.truck.body, at.x - 6, at.z + 2.5);
for (let i = 0; i < 120; i++) sim.step(idle);
const before = sim.cargoValue() / sim.fullValue;
first.body.setLinvel({ x: -3, y: 0, z: 0 }, true);
blasts = 0;
for (let i = 0; i < 60 * 5; i++) {
  sim.step(idle);
  blasts += sim.drainBlasts().length;
}
const after = sim.cargoValue() / sim.fullValue;
check('beside the truck, it costs the load something', blasts >= 1 && after < before - 0.01, `${(before * 100).toFixed(0)}% before, ${(after * 100).toFixed(0)}% after ${blasts} explosions`);
check('but not most of it, and the run goes on', after > 0.7 && !sim.result, sim.result?.failure ?? 'still going');

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
