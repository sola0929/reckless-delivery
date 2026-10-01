// Headless check of salvage value: what a damaged or destroyed item is still worth.
// npx tsx dev/salvage-test.ts
import { sandbox } from '../src/levels/sandbox';
import type { CargoItem } from '../src/sim/cargo';
import { Sim } from '../src/sim/sim';

const sim = await Sim.create({ ...sandbox(), props: [] });
const idle = { throttle: 0, steer: 0, handbrake: false };
let failures = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
const wait = (seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) sim.step(idle);
};
/** Take health off an item directly, as an impact would. */
const hurt = (item: CargoItem, amount: number) => (sim.cargoSystem as unknown as { damage(i: CargoItem, a: number): void }).damage(item, amount);
const near = (a: number, b: number) => Math.abs(a - b) < 0.5;

wait(1.5);
const full = sim.cargoValue();
check('an undamaged load is worth its full price', near(full, sim.fullValue), `$${Math.round(full)}`);

// 1. Value falls smoothly from the full price to the salvage share.
const crate = sim.cargo.find((c) => c.type.id === 'crate')!;
const price = crate.type.value;
const salvage = crate.type.salvage;
hurt(crate, 50);
check('at half health it is worth more than half', near(crate.value, price * (salvage + (1 - salvage) * 0.5)), `$${crate.value.toFixed(0)} of $${price}`);
hurt(crate, 49);
const battered = crate.value;
check('at 1% health it is worth just over the salvage share', battered > price * salvage && battered < price * (salvage + 0.02), `$${battered.toFixed(1)}`);

// 2. Being finished off must not pay.
hurt(crate, 5);
wait(0.1);
check('destroying it does not raise its value', crate.stage === 3 && crate.value <= battered, `$${crate.value.toFixed(1)}`);
check('a wreck with all its pieces aboard is worth the salvage share', near(crate.value, price * salvage), `${crate.pieces.length} pieces`);
wait(1);
check('and the load total counts it', near(sim.cargoValue(), full - price * (1 - salvage)), `$${Math.round(sim.cargoValue())}`);
check('and it would be delivered', near(sim.deliverableValue(), sim.cargoValue()));

// 3. Salvage is worth only as much as is left of it.
const t = sim.truck.body.translation();
const half = Math.floor(crate.pieces.length / 2);
crate.pieces.slice(0, half).forEach((p, i) => p.body.setTranslation({ x: t.x + 8, y: 0.3, z: t.z + i }, true));
let scrapEvents = 0;
for (let i = 0; i < 60; i++) {
  sim.step(idle);
  for (const e of sim.drainEvents()) if (e.kind === 'scrap' && e.item === crate && e.change < 0) scrapEvents++;
}
const expected = price * salvage * ((crate.pieces.length - half) / crate.pieces.length);
check('with some pieces off the truck it is worth that much less', near(crate.value, expected), `${half} of ${crate.pieces.length} off: $${crate.value.toFixed(1)}`);
check('and the loss is reported', scrapEvents > 0);
crate.pieces.forEach((p, i) => p.body.setTranslation({ x: t.x + 8, y: 0.3, z: t.z + i }, true));
wait(1);
check('with every piece gone it is worth nothing', crate.value === 0);

// 4. An intact item off the truck is worth nothing until it is back.
const other = sim.cargo.find((c) => c.type.id === 'jar')!;
const before = sim.cargoValue();
other.body!.setTranslation({ x: t.x + 6, y: 0.4, z: t.z }, true);
wait(3.5);
check('an item that fell off counts for nothing, salvage or not', other.fallen && near(sim.cargoValue(), before - other.type.value), `load $${Math.round(before)} -> $${Math.round(sim.cargoValue())}`);

// 5. Something that sheds parts before it is destroyed: every piece counts.
const skeleton = sim.cargo.find((c) => c.type.id === 'skeleton')!;
hurt(skeleton, 100);
wait(1);
check('a skeleton falls into as many pieces as it has bones', skeleton.pieces.length === skeleton.type.parts.length, `${skeleton.pieces.length} pieces`);
check('and is worth its salvage while they stay aboard', skeleton.value > 0 && skeleton.value <= skeleton.type.value * skeleton.type.salvage + 0.01, `$${skeleton.value.toFixed(0)} of $${skeleton.type.value}`);

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
