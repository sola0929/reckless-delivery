// Headless check of the driver on foot: getting out, walking, the leash, picking up,
// throwing cargo back aboard, being run down, and overturning. npx tsx dev/foot-test.ts
import { DRIVER } from '../src/config';
import { city } from '../src/levels/city';
import { sandbox } from '../src/levels/sandbox';
import { NO_FOOT_INPUT, type FootInput } from '../src/sim/driver';
import { Sim } from '../src/sim/sim';
import type { DriveInput } from '../src/sim/truck';

let sim = await Sim.create();
const idle: DriveInput = { throttle: 0, steer: 0, handbrake: false };
let failures = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const foot = (extra: Partial<FootInput> = {}): FootInput => ({ ...NO_FOOT_INPUT, ...extra });
const step = (f: FootInput = NO_FOOT_INPUT, drive: DriveInput = idle) => sim.step(drive, f);
const wait = (seconds: number, f: FootInput = NO_FOOT_INPUT) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) step(f);
};
const truckAt = () => sim.truck.body.translation();
/** Carry the truck and its load somewhere else, keeping them together. */
function carryTo(x: number, z: number): void {
  const t = truckAt();
  for (const body of [...sim.cargo.flatMap((c) => (c.body ? [c.body] : [])), sim.truck.body]) {
    const p = body.translation();
    body.setTranslation({ x: p.x + x - t.x, y: p.y, z: p.z + z - t.z }, true);
  }
}
const fromTruck = () => Math.hypot(sim.driver.pos.x - truckAt().x, sim.driver.pos.z - truckAt().z);

/** Walk toward a point until close to it. Returns the seconds it took. */
function walkTo(x: number, z: number, run = false, near = 0.6, limit = 30): number {
  let steps = 0;
  while (steps < limit * 60) {
    const dx = x - sim.driver.pos.x;
    const dz = z - sim.driver.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < near) break;
    step(foot({ moveX: dx / d, moveZ: dz / d, run }));
    steps++;
  }
  return steps / 60;
}

// 1. Getting out.
wait(1);
for (let i = 0; i < 120; i++) step(NO_FOOT_INPUT, { throttle: 1, steer: 0, handbrake: false });
step(foot({ vehiclePressed: true }), { throttle: 1, steer: 0, handbrake: false });
check('cannot get out of a moving truck', sim.driver.mode === 'driving', `${(sim.truck.forwardSpeed() * 3.6).toFixed(0)} km/h`);
while (sim.truck.forwardSpeed() > 0.2) step(NO_FOOT_INPUT, { throttle: -1, steer: 0, handbrake: false });
wait(0.5);
step(foot({ vehiclePressed: true }));
check('gets out once stopped', sim.driver.mode === 'onFoot', `${fromTruck().toFixed(1)} m from the truck's centre`);
const parked = { ...truckAt() };
for (let i = 0; i < 60; i++) step(NO_FOOT_INPUT, { throttle: 1, steer: 0, handbrake: false });
check('the truck ignores the pedals with nobody in it', Math.hypot(truckAt().x - parked.x, truckAt().z - parked.z) < 0.1);

// 2. Walking and running.
const walkStart = sim.driver.pos.clone();
wait(2, foot({ moveX: 1, moveZ: 0 }));
const walked = sim.driver.pos.distanceTo(walkStart);
const runStart = sim.driver.pos.clone();
wait(2, foot({ moveX: 1, moveZ: 0, run: true }));
const ran = sim.driver.pos.distanceTo(runStart);
check('walks at about walking speed', Math.abs(walked - DRIVER.walkSpeed * 2) < 1, `${walked.toFixed(1)} m in 2 s`);
check('runs faster than it walks', ran > walked * 1.5, `${ran.toFixed(1)} m in 2 s`);

// 3. The leash.
wait(12, foot({ moveX: 1, moveZ: 0, run: true }));
check('cannot stray past the leash', fromTruck() <= DRIVER.leash + 0.01 && sim.driver.atLeash, `${fromTruck().toFixed(1)} m`);

// 4. Something falls off: put a small crate on the ground beside the truck.
const crate = sim.cargo.find((c) => c.type.id === 'smallCrate')!;
const full = sim.cargoValue();
const spot = { x: truckAt().x + 6, y: 0.3, z: truckAt().z - 1 };
crate.body!.setTranslation(spot, true);
crate.body!.setLinvel({ x: 0, y: 0, z: 0 }, true);
wait(3);
check('an item on the ground counts as fallen', crate.fallen && sim.cargoValue() < full, `load ${Math.round(full)} -> ${Math.round(sim.cargoValue())}`);

// 5. Fetch it, carry it, and throw it back aboard.
walkTo(spot.x + 0.8, spot.z, true);
step(foot({ grabPressed: true }));
check('picks up cargo within reach', sim.driver.held === crate && crate.held);
const carryFrom = sim.driver.pos.clone();
wait(1, foot({ moveX: 0, moveZ: 1, run: true }));
const carried = sim.driver.pos.distanceTo(carryFrom);
check('can still run with a load, a little slower', carried < DRIVER.runSpeed && carried > DRIVER.walkSpeed, `${carried.toFixed(1)} m in 1 s`);

// Aim at the middle of the bed and wind up until the landing point is over it.
const bed = () => {
  const t = truckAt();
  const r = sim.truck.body.rotation();
  const yaw = Math.atan2(2 * (r.w * r.y + r.x * r.z), 1 - 2 * (r.y * r.y + r.x * r.x));
  return { x: t.x - Math.sin(yaw) * 0.8, z: t.z - Math.cos(yaw) * 0.8 };
};
walkTo(truckAt().x + 5, truckAt().z - 0.8, false, 0.4);
const hpBefore = sim.cargo.map((c) => c.hp);
let wound = 0;
while (!sim.driver.plan?.inBed && wound < 5) {
  step(foot({ aim: bed(), charging: true }));
  wound += 1 / 60;
}
// Push the landing point a little further in from the wall before letting go.
wait(0.25, foot({ aim: bed(), charging: true }));
wound += 0.25;
check('winding up moves the landing point out to the bed', sim.driver.plan?.inBed === true, `after ${wound.toFixed(2)} s from ${fromTruck().toFixed(1)} m`);
step(foot({ aim: bed() }));
check('letting go throws it', sim.driver.held === null && crate.thrown);
wait(4);
check('it lands back on the truck', !crate.fallen && sim.truck.isOnBed(crate.body!.translation()), `load back to ${Math.round(sim.cargoValue())}`);
check('landing in the bed costs nothing', sim.cargo.every((c, i) => c.hp === hpBefore[i]));

// 6. A throw that misses is an ordinary fall.
const second = sim.cargo.filter((c) => c.type.id === 'smallCrate')[1];
second.body!.setTranslation({ x: sim.driver.pos.x + 1, y: 0.3, z: sim.driver.pos.z }, true);
wait(3);
step(foot({ grabPressed: true }));
const away = { x: sim.driver.pos.x + 20, z: sim.driver.pos.z };
wait(3, foot({ aim: away, charging: true }));
const reach = sim.driver.plan ? Math.hypot(sim.driver.plan.landing.x - sim.driver.pos.x, sim.driver.plan.landing.z - sim.driver.pos.z) : 0;
check('a full wind-up reaches the longest throw for its weight', Math.abs(reach - (DRIVER.throwMax - second.mass * DRIVER.throwPerKg)) < 0.1, `${reach.toFixed(1)} m`);
step(foot({ aim: away }));
wait(3);
const flew = Math.hypot(second.body!.translation().x - sim.driver.pos.x, second.body!.translation().z - sim.driver.pos.z);
check('it flies about as far as planned', Math.abs(flew - reach) < 3, `${flew.toFixed(1)} m`);
check('landing on the ground does damage it', second.hp < 100, `health ${second.hp.toFixed(0)}`);

// 7. Cancelling a wind-up keeps hold of the load.
walkTo(second.body!.translation().x - 0.8, second.body!.translation().z);
step(foot({ grabPressed: true }));
wait(0.5, foot({ aim: away, charging: true }));
step(foot({ aim: away, charging: true, cancelPressed: true }));
wait(0.5, foot({ aim: away, charging: true }));
step(foot({ aim: away }));
check('a cancelled throw is not thrown', sim.driver.held === second && sim.driver.charge === 0);
step(foot({ grabPressed: true }));
check('setting down lets go gently', sim.driver.held === null && !second.thrown);

// 8. Back into the cab.
step(foot({ vehiclePressed: true }));
check('cannot get in from a distance', sim.driver.mode === 'onFoot');
walkTo(truckAt().x + 2.3, truckAt().z + 2.6, true, 0.8);
step(foot({ vehiclePressed: true }));
check('gets back in at the door', sim.driver.mode === 'driving');
for (let i = 0; i < 90; i++) step(NO_FOOT_INPUT, { throttle: 1, steer: 0, handbrake: false });
check('and can drive off', sim.truck.forwardSpeed() > 3);

// 9. In the city: stand in a busy lane and get run down.
sim = await Sim.create(city());
wait(1);
// Past the chicane, a little short of the boulevard.
carryTo(4.5, 168);
wait(0.5);
step(foot({ vehiclePressed: true }));
const jar = sim.cargo.find((c) => c.type.id === 'jar')!;
jar.body!.setTranslation({ x: sim.driver.pos.x + 1, y: 0.4, z: sim.driver.pos.z }, true);
wait(3);
step(foot({ grabPressed: true }));
walkTo(sim.driver.pos.x, 188.5, false, 0.3);
let hit = false;
for (let i = 0; i < 60 * 40 && !hit; i++) {
  step();
  hit = sim.driver.mode === 'down';
}
check('standing in traffic gets the driver run down', hit);
check('and whatever they held is knocked out of their hands', sim.driver.held === null && !jar.held);
wait(DRIVER.downSeconds + 0.2);
check('they get up again shortly after', sim.driver.mode === 'onFoot');
wait(3);
check('the dropped jar is damaged', jar.hp < 100, `health ${jar.hp.toFixed(0)}`);

// 10. Overturning ends the run.
sim.reset();
wait(1);
const at = truckAt();
sim.truck.body.setTranslation({ x: at.x, y: at.y + 1.5, z: at.z }, true);
sim.truck.body.setRotation({ x: 0, y: 0, z: 1, w: 0 }, true);
wait(5);
check('an overturned truck fails the level', sim.result?.failure === 'overturned' && sim.result.stars === 0);

// 11. Nothing they walk into should hold on to them: walking straight back off it must work.
sim = await Sim.create(city());
wait(1);
// Beside the cars parked along the street east of the depot.
carryTo(-107.5, 150);
wait(0.5);
step(foot({ vehiclePressed: true }));
function walksAwayFrom(name: string, fromX: number, fromZ: number, intoX: number): void {
  walkTo(fromX, fromZ, true, 0.4);
  wait(2.5, foot({ moveX: intoX, moveZ: 0 }));
  const touching = sim.driver.pos.clone();
  wait(1, foot({ moveX: -intoX, moveZ: 0 }));
  const moved = sim.driver.pos.distanceTo(touching);
  check(`walks straight back off ${name}`, moved > DRIVER.walkSpeed * 0.8, `${moved.toFixed(1)} m in 1 s`);
}
const parkedCar = sim.traffic.cars
  .filter((c) => c.lane.cruise === 0)
  .map((c) => ({ x: c.lane.from.x + c.lane.dir.x * c.s, z: c.lane.from.z + c.lane.dir.z * c.s }))
  .sort((p, r) => Math.hypot(p.x - truckAt().x, p.z - truckAt().z) - Math.hypot(r.x - truckAt().x, r.z - truckAt().z))[0];
walksAwayFrom('a parked car', parkedCar.x - 3, parkedCar.z, 1);
walksAwayFrom('the side of the truck', truckAt().x + 5, truckAt().z - 1, -1);
const building = sim.level.props
  .filter((p) => p.fade && !p.ghost)
  .sort((p, r) => Math.hypot(p.pos[0] - truckAt().x, p.pos[2] - truckAt().z) - Math.hypot(r.pos[0] - truckAt().x, r.pos[2] - truckAt().z))[0];
walksAwayFrom('a building', building.pos[0] - building.size[0] - 3, building.pos[2], 1);

// 12. Jumping, and not with a heavy load.
sim = await Sim.create();
wait(1);
step(foot({ vehiclePressed: true }));
wait(0.5);
const ground = sim.driver.pos.y;
function jumpHeight(): number {
  let top = 0;
  step(foot({ jumpPressed: true }));
  for (let i = 0; i < 90; i++) {
    step();
    top = Math.max(top, sim.driver.pos.y - ground);
  }
  return top;
}
const empty = jumpHeight();
check('jumps about a metre and a half', empty > 1.45 && empty < 1.75, `${empty.toFixed(2)} m`);
check('and comes back down', Math.abs(sim.driver.pos.y - ground) < 0.05 && !sim.driver.airborne);
const light = sim.cargo.find((c) => c.type.id === 'smallCrate')!;
const heavy = sim.cargo.find((c) => c.type.id === 'crate')!;
light.body!.setTranslation({ x: sim.driver.pos.x + 1, y: 0.3, z: sim.driver.pos.z }, true);
wait(1);
step(foot({ grabPressed: true }));
const withLight = jumpHeight();
check('can jump carrying something light', sim.driver.held === light && withLight > 1, `${light.mass} kg, ${withLight.toFixed(2)} m`);
step(foot({ grabPressed: true }));
wait(1);
heavy.body!.setTranslation({ x: sim.driver.pos.x - 1.2, y: 0.4, z: sim.driver.pos.z }, true);
light.body!.setTranslation({ x: sim.driver.pos.x + 8, y: 0.3, z: sim.driver.pos.z }, true);
wait(1);
step(foot({ grabPressed: true }));
const withHeavy = jumpHeight();
check('cannot jump carrying something heavy', sim.driver.held === heavy && withHeavy < 0.05, `${heavy.mass} kg, ${withHeavy.toFixed(2)} m`);
step(foot({ grabPressed: true }));
wait(0.5);

// A jump should be brisk, not floaty.
step(foot({ jumpPressed: true }));
let airSteps = 0;
for (let i = 0; i < 120; i++) {
  step();
  if (sim.driver.pos.y - ground > 0.02) airSteps++;
}
check('a jump is over in well under a second', airSteps / 60 > 0.4 && airSteps / 60 < 0.8, `${(airSteps / 60).toFixed(2)} s in the air`);

// 13. Up onto the roof of a parked car, and able to walk about on it.
sim = await Sim.create({ ...sandbox(), props: [], traffic: [{ from: [10, -10], to: [10, 10], cars: 1, speed: 0 }] });
wait(1);
step(foot({ vehiclePressed: true }));
const roofCar = sim.traffic.cars[0];
const carZ = roofCar.lane.from.z + roofCar.lane.dir.z * roofCar.s;
walkTo(6.5, carZ, false, 0.3);
wait(0.3, foot({ moveX: 1, moveZ: 0 }));
step(foot({ moveX: 1, moveZ: 0, jumpPressed: true }));
wait(0.5, foot({ moveX: 1, moveZ: 0 }));
check('can jump onto a parked car', sim.driver.pos.y > 1.4 && !sim.driver.airborne, `standing at ${sim.driver.pos.y.toFixed(2)} m`);
const onRoof = sim.driver.pos.clone();
wait(0.1, foot({ moveX: 0, moveZ: -1 }));
const along = sim.driver.pos.distanceTo(onRoof);
check('and walk along its roof', along > DRIVER.walkSpeed * 0.08 && sim.driver.pos.y > 1.4, `${along.toFixed(2)} m in 0.1 s`);
// Forward off the cabin onto the bonnet, which is lower: they should stand on it, not hover at roof height.
wait(0.45, foot({ moveX: 0, moveZ: 1 }));
wait(0.3);
const bonnet = sim.driver.pos.y;
check('stands on the bonnet at the bonnet\'s height', bonnet > 0.9 && bonnet < 1.05 && !sim.driver.airborne, `${bonnet.toFixed(2)} m`);
wait(1.5, foot({ moveX: 1, moveZ: 0 }));
check('and step off the far side', sim.driver.pos.y < 0.1 && sim.driver.pos.x > 11, `at x = ${sim.driver.pos.x.toFixed(1)}`);

// 14. The driver weighs nothing as far as the truck is concerned. Dropped into the bed they
// stand on top of the load; they must not sink into it, squash the truck or push it along.
sim = await Sim.create({ ...sandbox(), props: [] });
wait(1.5);
step(foot({ vehiclePressed: true }));
wait(0.5);
const restingAt = { ...truckAt() };
const loadBefore = sim.cargoValue();
sim.driver.pos.set(restingAt.x + 0.3, restingAt.y + 2.6, restingAt.z + 0.2);
let sank = 0;
for (let i = 0; i < 120; i++) {
  step();
  sank = Math.max(sank, restingAt.y - truckAt().y);
}
check('stands on top of the cargo in the bed', sim.driver.pos.y > 1.9 && !sim.driver.airborne, `at ${sim.driver.pos.y.toFixed(2)} m`);
check('without pressing the truck down', sank < 0.01, `${(sank * 100).toFixed(1)} cm`);
wait(1, foot({ moveX: 0, moveZ: 1 }));
wait(1, foot({ moveX: 0, moveZ: -1 }));
wait(1.5);
const shifted = Math.hypot(truckAt().x - restingAt.x, truckAt().z - restingAt.z);
check('or pushing it along by walking on it', shifted < 0.02, `${(shifted * 100).toFixed(1)} cm`);
check('or harming the load', sim.cargoValue() === loadBefore && sim.cargoOnTruck() === sim.cargo.length);

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
