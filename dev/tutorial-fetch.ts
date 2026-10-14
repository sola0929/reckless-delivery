// The tutorial's crate, headless: stop by it, get out, walk over, pick it up, carry it to the back of the truck and throw
// it onto the bed, get back in; then on to the bay. Each step said as it is reached; the guide's test of each lesson too.
// npx tsx dev/tutorial-fetch.ts
import { tutorial, RX, CRATE_Z, BAY_Z } from '../src/levels/tutorial';
import { NO_FOOT_INPUT, type FootInput } from '../src/sim/driver';
import { Sim } from '../src/sim/sim';

const level = tutorial();
const sim = await Sim.create({ ...level, crowds: [] });
sim.teleport(RX, CRATE_Z - 4, 0);
const park = { throttle: 0, steer: 0, handbrake: true };
const foot = (f: Partial<FootInput>) => ({ ...NO_FOOT_INPUT, ...f });
for (let i = 0; i < 90; i++) sim.step(park);
const crate = sim.cargo.find((c) => c.bonus)!;
const say = (what: string) => {
  const p = crate.body?.translation();
  console.log(`${what}: driver ${sim.driver.mode} at ${sim.driver.pos.x.toFixed(1)},${sim.driver.pos.z.toFixed(1)}; crate ${p ? `${p.x.toFixed(1)},${p.y.toFixed(2)},${p.z.toFixed(1)}` : 'gone'} held ${crate.held} fallen ${crate.fallen}; aboard ${sim.cargoOnTruck()}, worth $${sim.cargoValue()}`);
};
say('parked by it');
sim.step(park, foot({ vehiclePressed: true }));
for (let i = 0; i < 60; i++) sim.step(park);
say('got out');
/** Walk to a point, on foot. */
const walk = (x: number, z: number, near = 0.9) => {
  for (let i = 0; i < 60 * 10; i++) {
    const dx = x - sim.driver.pos.x, dz = z - sim.driver.pos.z, d = Math.hypot(dx, dz);
    if (d < near) return true;
    sim.step(park, foot({ moveX: dx / d, moveZ: dz / d }));
  }
  return false;
};
const cp = crate.body!.translation();
walk(cp.x, cp.z, 1.1);
sim.step(park, foot({ grabPressed: true }));
for (let i = 0; i < 30; i++) sim.step(park);
say('picked up');
// Round to the back of the truck: its tail is to the south, the truck facing north.
const t = sim.truck.body.translation();
walk(t.x + 2, t.z - 6, 0.6);
walk(t.x, t.z - 6, 0.5);
// Face the bed and wind up a throw, then let go.
const aim = { x: t.x, z: t.z - 1.5 };
for (let i = 0; i < 25; i++) sim.step(park, foot({ aim, charging: true }));
sim.step(park, foot({ aim }));
for (let i = 0; i < 150; i++) sim.step(park);
say('thrown onto the bed');
walk(t.x - 1.9, t.z + 1.2, 0.8);
sim.step(park, foot({ vehiclePressed: true }));
for (let i = 0; i < 60; i++) sim.step(park);
say('back in');
console.log('lesson 4 done:', !crate.fallen && !crate.held && sim.driver.mode === 'driving');
// On to the bay and stop in it.
for (let i = 0; i < 60 * 30 && !sim.result; i++) {
  const p = sim.truck.body.translation(), v = sim.truck.forwardSpeed();
  const ahead = BAY_Z - p.z;
  const want = ahead > 12 ? 6 : ahead > 0.5 ? 2 : 0;
  sim.step({ throttle: v < want ? 0.6 : v > want + 0.5 ? -1 : 0, steer: Math.max(-1, Math.min(1, (RX - p.x) * 0.3)), handbrake: want === 0 && Math.abs(v) < 0.5 });
}
say('at the bay');
console.log('delivered:', !!sim.result, sim.result ? `value $${sim.result.value}, ${Math.round(sim.result.fraction * 100)}%` : '');
process.exit(0);
