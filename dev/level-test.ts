// Headless check of the city level: traffic, cars yielding to the truck, and a full
// delivery driven by a simple autopilot. npx tsx dev/level-test.ts
import { Quaternion, Vector3 } from 'three';
import { city } from '../src/levels/city';
import { Sim } from '../src/sim/sim';
import { CAR_HALF } from '../src/sim/traffic';
import type { DriveInput } from '../src/sim/truck';

const sim = await Sim.create(city());
const idle: DriveInput = { throttle: 0, steer: 0, handbrake: false };
let failures = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const truckPos = () => sim.truck.body.translation();
const heading = () => {
  const r = sim.truck.body.rotation();
  const f = new Vector3(0, 0, 1).applyQuaternion(new Quaternion(r.x, r.y, r.z, r.w));
  return Math.atan2(f.x, f.z);
};

// 1. The load survives being spawned on the road.
for (let i = 0; i < 180; i++) sim.step(idle);
check('load intact after settling', sim.cargoValue() === sim.fullValue && sim.cargoOnTruck() === sim.cargo.length);

// 2. Traffic flows, loops, and keeps its distance.
const starts = sim.traffic.cars.map((c) => c.s);
let closest = Infinity;
for (let i = 0; i < 60 * 40; i++) {
  sim.step(idle);
  for (const a of sim.traffic.cars) {
    for (const b of sim.traffic.cars) {
      if (a !== b && a.lane === b.lane) closest = Math.min(closest, (b.s - a.s + a.lane.length) % a.lane.length);
    }
  }
}
const moving = sim.traffic.cars.filter((c) => c.lane.cruise > 0);
const parkedCars = sim.traffic.cars.filter((c) => c.lane.cruise === 0);
check('every moving car has moved', sim.traffic.cars.every((c, i) => c.lane.cruise === 0 || Math.abs(c.s - starts[i]) > 1), `${moving.length} cars`);
check('parked cars stay put', sim.traffic.cars.every((c, i) => c.lane.cruise > 0 || c.s === starts[i]), `${parkedCars.length} cars`);
check('cars keep apart in their lanes', closest > CAR_HALF.length * 2, `closest ${closest.toFixed(1)} m`);

// 3. Drive into the first cross street and stop there: traffic must brake rather than ram the truck.
sim.reset();
for (let i = 0; i < 60; i++) sim.step(idle);
while (truckPos().z < 68) sim.step({ throttle: 0.5, steer: 0, handbrake: false });
while (sim.truck.forwardSpeed() > 0.2) sim.step({ throttle: -1, steer: 0, handbrake: false });
const parkedAt = { ...truckPos() };
const valueBefore = sim.cargoValue();
for (let i = 0; i < 60 * 30; i++) sim.step(idle);
const shoved = Math.hypot(truckPos().x - parkedAt.x, truckPos().z - parkedAt.z);
check('truck stopped across the street', Math.abs(parkedAt.z - 80) < 9, `z = ${parkedAt.z.toFixed(1)}`);
check('traffic stops for a truck blocking the street', shoved < 0.3 && sim.cargoValue() === valueBefore, `truck moved ${shoved.toFixed(2)} m`);
const queued = sim.traffic.cars.filter((c) => c.lane.cruise > 0 && c.speed < 0.5).length;
check('cars are queued behind it', queued >= 2, `${queued} stopped`);

// 4. Pulling out in front of traffic gets the truck hit. That must hurt in proportion: a car
// is far lighter than the loaded truck, so it should cost part of the load, never all of it.
const kept: number[] = [];
for (const wait of [1.5, 4.5, 7.5]) {
  sim.reset();
  for (let i = 0; i < 60 * (1 + wait); i++) sim.step(idle);
  for (let i = 0; i < 60 * 12; i++) {
    // Up to the street, creep across it, and stop in the far lanes.
    const z = truckPos().z;
    const speed = sim.truck.forwardSpeed();
    const throttle = z < 70 ? 1 : z < 84 ? (speed < 3 ? 0.4 : 0) : speed > 0.3 ? -1 : 0;
    sim.step({ throttle, steer: 0, handbrake: false });
  }
  kept.push(sim.cargoValue() / sim.fullValue);
}
const percent = `kept ${kept.map((k) => `${Math.round(k * 100)}%`).join(', ')}`;
check('being hit by a car costs some of the load', Math.min(...kept) < 0.97, percent);
check('but never most of it', Math.min(...kept) > 0.45, percent);

// 5. A careful autopilot completes the delivery.
sim.reset();
for (let i = 0; i < 60; i++) sim.step(idle);

// Around the roadworks on the wrong side of the road, left along the second busy street,
// right over the humpback bridge, through the school zone, round the roundabout, up the
// middle of the market, across the last busy street, then left and right to the delivery bay.
const route: [number, number][] = [
  [-5.25, 86], [2.5, 101], [2.5, 130], [-4.5, 146],
  [-1, 153], [12, 157.5], [126, 157.5], [141, 158.5], [147.5, 168], [147.5, 178],
  [147, 300], [144.5, 316], [144.5, 356], [142.3, 368], [142.3, 380], [148, 395],
  [148, 436], [144.5, 446], [144.5, 508],
  [147, 522], [160, 527.5], [196, 527.5], [212, 531], [216.75, 544], [216.75, 560],
];
/** Streets the route crosses or joins: where they are, and the z at which to wait for a gap. */
const crossings = [{ x: 0, z: 80, waitAt: 66 }, { x: 0, z: 154, waitAt: 140 }, { x: 148, z: 450, waitAt: 436 }];

function gapInTraffic(streetZ: number): boolean {
  const x = truckPos().x;
  return sim.traffic.cars.every((car) => {
    if (Math.abs(car.lane.from.z - streetZ) > 7) return true;
    const carX = car.lane.from.x + car.lane.dir.x * car.s;
    const ahead = (x - carX) * car.lane.dir.x;
    // Unsafe if the car reaches us within the time it takes to get clear.
    return ahead < -6 || ahead > car.speed * 3.5 + 8;
  });
}

let waypoint = 0;
let steps = 0;
const cleared = new Set<number>();
while (!sim.result && steps < 60 * 420) {
  const p = truckPos();
  const [wx, wz] = route[waypoint];
  const dist = Math.hypot(wx - p.x, wz - p.z);
  const last = waypoint === route.length - 1;
  if (!last && dist < 5) {
    waypoint++;
    if (process.argv.includes('-v')) console.log(`  waypoint ${waypoint} at (${p.x.toFixed(0)}, ${p.z.toFixed(0)}) t=${(steps / 60).toFixed(0)}s value ${Math.round(sim.cargoValue())} on truck ${sim.cargoOnTruck()}`);
  }

  let error = Math.atan2(wx - p.x, wz - p.z) - heading();
  error = Math.atan2(Math.sin(error), Math.cos(error));
  const speed = sim.truck.forwardSpeed();
  let limit = Math.abs(error) > 0.35 ? 4 : 9;
  if (last) limit = dist < 1.5 ? 0 : Math.min(limit, 1.5 + dist * 0.5);

  // Hold at the kerb until there is a gap, then commit.
  for (const c of crossings) {
    if (cleared.has(c.z) || p.z < c.waitAt - 12 || Math.abs(p.x - c.x) > 12) continue;
    if (p.z >= c.waitAt - 1.5) {
      if (gapInTraffic(c.z)) cleared.add(c.z);
      else limit = 0;
    } else limit = Math.min(limit, 1 + (c.waitAt - p.z) * 0.6);
  }

  const throttle = speed < limit - 0.5 ? 0.45 : speed > limit + 0.8 || limit === 0 ? -1 : 0;
  // Brake in pulses, as a careful driver would, so the load stays put.
  const brake = throttle < 0 && steps % 18 < 9;
  sim.step({ throttle: throttle < 0 ? (brake ? -1 : 0) : throttle, steer: Math.max(-1, Math.min(1, error * 2.2)), handbrake: false });
  steps++;
}

if (!sim.result) console.log('  stuck at', truckPos().x.toFixed(1), truckPos().z.toFixed(1), 'speed', sim.truck.forwardSpeed().toFixed(2), 'heading', heading().toFixed(2), 'value', Math.round(sim.cargoValue()));
const result = sim.result;
check('autopilot reached the delivery bay', result !== null, `waypoint ${waypoint + 1}/${route.length} after ${(steps / 60).toFixed(0)} s`);
if (result) {
  check('careful delivery passes', result.stars >= 1, `${Math.floor(result.fraction * 100)}% of value, ${result.stars} star(s), ${result.seconds.toFixed(0)} s`);
  // Driving is ignored once delivered.
  const at = { ...truckPos() };
  for (let i = 0; i < 120; i++) sim.step({ throttle: 1, steer: 0, handbrake: false });
  check('truck stays parked after delivery', Math.hypot(truckPos().x - at.x, truckPos().z - at.z) < 0.3);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
