// Headless check of the scooters ridden about the city and the people crossing its streets:
// they keep clear of the cars, of each other and of the truck; one that is hit costs the
// load something, though less than a car would; and the cars wait for people in the road.
// npx tsx dev/riders-test.ts
import { Quaternion } from 'three';
import { city, cityCell } from '../src/levels/city';
import { Sim } from '../src/sim/sim';
import { CAR_HALF } from '../src/sim/traffic';
import type { DriveInput } from '../src/sim/truck';

const idle: DriveInput = { throttle: 0, steer: 0, handbrake: false };
let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

/** Put the truck, as it stands at the start, somewhere else and turned to face east (-X), with its load turned with it. */
function faceEast(sim: Sim, x: number, z: number): void {
  const t = sim.truck.body.translation();
  const h = Math.SQRT1_2;
  const quarter = new Quaternion(0, -h, 0, h);
  for (const c of sim.cargo) {
    if (!c.body) continue;
    const p = c.body.translation();
    const r = c.body.rotation();
    c.body.setTranslation({ x: x - (p.z - t.z), y: p.y, z: z + (p.x - t.x) }, true);
    c.body.setRotation(new Quaternion(r.x, r.y, r.z, r.w).premultiply(quarter), true);
  }
  sim.truck.body.setTranslation({ x, y: t.y, z }, true);
  sim.truck.body.setRotation({ x: 0, y: -h, z: 0, w: h }, true);
}

const where = (rider: { body: { translation(): { x: number; z: number } } }) => rider.body.translation();
const [, busyZ] = cityCell(0, 31);

/**
 * Somewhere along the busy street, `offset` metres across it, with the longest clear run
 * to the east: nothing on that side of the road for as far as possible.
 */
function clearRun(sim: Sim, offset: number): number {
  const things = [...sim.traffic.cars, ...sim.riders.list].map(where).filter((p) => Math.abs(p.z - busyZ) < 9 && (p.z - busyZ) * offset > 0);
  let best = 0;
  let room = -1;
  for (let c = 6; c <= 30; c += 0.5) {
    const [x] = cityCell(c, 31);
    const nearest = Math.min(...things.map((p) => (p.x < x + 12 ? x + 12 - p.x : Infinity)));
    if (nearest > room) [best, room] = [x, nearest];
  }
  return best;
}

// 1. Left to themselves.
{
  const sim = await Sim.create(city());
  const riders = sim.riders.list;
  check('the city has scooters ridden about it', riders.length > 30, `${riders.length}`);
  let closestCar = Infinity;
  let closestRider = Infinity;
  let inRoad = 0;
  let closestWalker = Infinity;
  let slowest = Infinity;
  const turned = new Set<number>();
  const roads = riders.map((r) => r.road);
  for (let i = 0; i < 60 * 60; i++) {
    sim.step(idle);
    if (i % 3) continue;
    const walkers = sim.pedestrians.inRoad();
    inRoad = Math.max(inRoad, walkers.length);
    for (const car of sim.traffic.cars) {
      const c = car.body.translation();
      // How far each is from the outline of any car that is moving, the cars all running along X.
      if (car.speed > 3) for (const w of walkers) closestWalker = Math.min(closestWalker, Math.max(Math.abs(w.pos.x - c.x) - CAR_HALF.length, Math.abs(w.pos.z - c.z) - CAR_HALF.width));
    }
    riders.forEach((rider, n) => {
      if (rider.road !== roads[n]) turned.add(n);
      const p = where(rider);
      // They start wherever they are put; give them a few seconds to sort themselves out.
      if (i > 300) for (const car of sim.traffic.cars) {
        const c = car.body.translation();
        // How far apart their outlines are, taking each as a box along the road.
        const along = Math.abs(p.x - c.x) - CAR_HALF.length - 0.85;
        const across = Math.abs(p.z - c.z) - CAR_HALF.width - 0.3;
        if (Math.abs(car.lane.dir.x) > 0.9) closestCar = Math.min(closestCar, Math.max(along, across));
      }
      for (const other of riders) {
        if (other === rider) continue;
        const o = where(other);
        closestRider = Math.min(closestRider, Math.hypot(p.x - o.x, p.z - o.z));
      }
    });
    if (i > 600) slowest = Math.min(slowest, riders.reduce((sum, r) => sum + r.speed, 0) / riders.length);
  }
  check('nobody is knocked off with the truck parked in its yard', sim.riders.hits === 0, `${sim.riders.hits} hits`);
  check('they do not ride through the cars', closestCar > -0.15, `nearest ${closestCar.toFixed(2)} m`);
  check('nor through each other', closestRider > 0.4, `nearest ${closestRider.toFixed(2)} m`);
  check('they keep moving', slowest > 6, `mean speed never under ${(slowest * 3.6).toFixed(0)} km/h`);
  check('those on the back street turn round at its ends', turned.size >= 5, `${turned.size} turned`);
  check('people cross the road, though not all at once', inRoad >= 2 && inRoad <= 16, `as many as ${inRoad} at once`);
  check('and moving cars keep off them', closestWalker > 0.2, `nearest ${closestWalker.toFixed(2)} m`);
}

// 2. The truck stopped across their road: they go round it.
{
  const sim = await Sim.create(city());
  const x = clearRun(sim, -1);
  faceEast(sim, x, busyZ - 3.5);
  const before = sim.riders.list.filter((r) => Math.abs(where(r).z - busyZ) < 9 && where(r).x > x + 10).length;
  for (let i = 0; i < 60 * 25; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const t = sim.truck.body.translation();
  check('scooters go round a truck standing in the road', sim.riders.hits === 0 && Math.hypot(t.x - x, t.z - (busyZ - 3.5)) < 1.5, `${sim.riders.hits} hits, ${before} had it ahead of them`);
}

// 3. The truck driving along with them: they overtake it.
{
  const sim = await Sim.create(city());
  const x = clearRun(sim, -1);
  faceEast(sim, x, busyZ - 3.5);
  let passed = 0;
  const behind = new Set(sim.riders.list.filter((r) => r.road.dir.x < -0.9 && Math.abs(where(r).z - busyZ) < 9 && where(r).x > x));
  // As far as the end of the road allows.
  for (let i = 0; i < 60 * 30 && sim.truck.body.translation().x > cityCell(33, 31)[0]; i++) {
    const speed = sim.truck.forwardSpeed();
    const t = sim.truck.body.translation();
    // Hold about 30 km/h, and the lane.
    sim.step({ throttle: speed < 8.5 ? 0.5 : 0, steer: Math.max(-0.3, Math.min(0.3, (busyZ - 3.5 - t.z) * 0.15)), handbrake: false });
    for (const rider of behind) if (where(rider).x < sim.truck.body.translation().x - 6) {
      behind.delete(rider);
      passed++;
    }
  }
  check('scooters overtake a truck going their way', passed >= 2 && sim.riders.hits === 0, `${passed} passed it, ${sim.riders.hits} hits`);
  check('which costs the load nothing', sim.cargoValue() > sim.fullValue * 0.995, `${((sim.cargoValue() / sim.fullValue) * 100).toFixed(1)}% left`);
}

// 4. A scooter running into the truck, and a car doing the same: nose to nose, each given no room to avoid it.
async function struck(by: 'scooter' | 'car'): Promise<{ left: number; hit: boolean; speed: number; shove: number; lean: number }> {
  // The busy street with nothing on it but the one scooter, or the one car, heading west.
  const level = city();
  const west = (lane: { from: [number, number]; to: [number, number] }) => Math.abs(lane.from[1] - busyZ) < 9 && lane.to[0] > lane.from[0];
  level.riders = by === 'scooter' ? level.riders!.filter(west).slice(0, 1).map((lane) => ({ ...lane, riders: 1 })) : [];
  level.traffic = by === 'car' ? level.traffic.filter((lane) => lane.speed > 0 && west(lane)).slice(0, 1).map((lane) => ({ ...lane, cars: 1 })) : [];
  level.crowds = [];
  const sim = await Sim.create(level);
  // Nothing done to a load in its first moments counts against it: let those pass, and the thing get well onto the map.
  const it = by === 'scooter' ? sim.riders.list[0] : sim.traffic.cars[0];
  for (let i = 0; i < 60 * 60 && !(i > 180 && Math.abs(where(it).x) < 150 && it.speed > 9); i++) sim.step(idle);
  const speed = it.speed;
  // Set down just ahead of it, facing it: nose to nose.
  faceEast(sim, where(it).x + (by === 'scooter' ? 5.4 : 7.4), where(it).z);
  // Two seconds: long enough for the damage to be counted, too short for the next thing along to arrive.
  let shove = 0;
  let lean = 0;
  for (let i = 0; i < 60 * 1.5; i++) {
    sim.step({ throttle: 0, steer: 0, handbrake: true });
    const r = sim.truck.body.rotation();
    lean = Math.max(lean, Math.acos(Math.min(1, 1 - 2 * (r.x * r.x + r.z * r.z))) * 57.3);
    // The blow itself, before anything else has had time to arrive.
    if (i < 30) shove = Math.max(shove, Math.abs(sim.truck.body.linvel().x));
  }
  const hit = by === 'scooter' ? sim.riders.hits === 1 : sim.traffic.cars.filter((c) => c.knocked > 0).length === 1;
  return { left: sim.cargoValue() / sim.fullValue, hit, speed, shove, lean };
}
const scooter = await struck('scooter');
const car = await struck('car');
const kmh = (speed: number) => `${(speed * 3.6).toFixed(0)} km/h`;
check('a scooter given no room hits the truck', scooter.hit, `at ${kmh(scooter.speed)}`);
check('which costs the load something', scooter.left < 0.997 && scooter.left > 0.9, `${(scooter.left * 100).toFixed(1)}% left, the truck shoved to ${scooter.shove.toFixed(1)} m/s`);
check('without tipping the truck at all', scooter.lean < 2, `leant ${scooter.lean.toFixed(1)} degrees at most`);
check('and less than a car does, which also shoves the truck harder', car.hit && car.left < scooter.left - 0.01 && car.shove > scooter.shove * 1.5, `${(car.left * 100).toFixed(1)}% left after a car at ${kmh(car.speed)}, the truck shoved to ${car.shove.toFixed(1)} m/s`);

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
