// Headless check of the city level: the scenery stays put, traffic behaves, things and
// people get knocked flying, and a careful autopilot can drive the whole route.
// npx tsx dev/level-test.ts
import { Quaternion, Vector3 } from 'three';
import { city, cityCell } from '../src/levels/city';
import { Sim } from '../src/sim/sim';
import { CAR_HALF } from '../src/sim/traffic';
import { TRAIN_HALF } from '../src/sim/trains';
import type { DriveInput } from '../src/sim/truck';

const level = city();
const sim = await Sim.create(level);
const idle: DriveInput = { throttle: 0, steer: 0, handbrake: false };
const verbose = process.argv.includes('-v');
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
const wait = (seconds: number, input = idle) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) sim.step(input);
};
/** Carry the truck and its load somewhere else, keeping them together. */
function carryTo(x: number, z: number): void {
  const t = truckPos();
  const move = (body: { translation(): { x: number; y: number; z: number }; setTranslation(p: { x: number; y: number; z: number }, wake: boolean): void }) => {
    const p = body.translation();
    body.setTranslation({ x: p.x + x - t.x, y: p.y, z: p.z + z - t.z }, true);
  };
  for (const c of sim.cargo) if (c.body) move(c.body);
  move(sim.truck.body);
}

/** Carry the truck and its load somewhere else, turned to face east (-X). */
function faceEast(x: number, z: number): void {
  const t = truckPos();
  const h = Math.SQRT1_2;
  for (const c of sim.cargo) {
    if (!c.body) continue;
    const p = c.body.translation();
    c.body.setTranslation({ x: x - (p.z - t.z), y: p.y, z: z + (p.x - t.x) }, true);
    c.body.setRotation({ x: 0, y: -h, z: 0, w: h }, true);
  }
  sim.truck.body.setTranslation({ x, y: t.y, z }, true);
  sim.truck.body.setRotation({ x: 0, y: -h, z: 0, w: h }, true);
}

// 1. Left alone, the city stays as it was built.
wait(10);
const objects = sim.objects.objects;
const tipped = objects.filter((o) => {
  const r = o.body.rotation();
  return 1 - 2 * (r.x * r.x + r.z * r.z) < 0.9;
});
check('load intact after settling', sim.cargoValue() === sim.fullValue && sim.cargoOnTruck() === sim.cargo.length);
check('nothing falls over by itself', tipped.length === 0 && objects.every((o) => !o.knocked), `${objects.length} objects, ${tipped.length} tipped`);
const awake = objects.filter((o) => !o.body.isSleeping());
check('everything loose is asleep until disturbed', awake.length === 0, awake.slice(0, 6).map((o) => `${o.desc.kind} at ${o.desc.pos.map((n) => n.toFixed(0))}`).join('; '));

// 2. Traffic flows, loops, and keeps its distance.
const moving = sim.traffic.cars.filter((c) => c.lane.cruise > 0);
const starts = sim.traffic.cars.map((c) => c.s);
let closest = Infinity;
for (let i = 0; i < 60 * 30; i++) {
  sim.step(idle);
  for (const a of moving) for (const b of moving) {
    if (a !== b && a.lane === b.lane) closest = Math.min(closest, (b.s - a.s + a.lane.length) % a.lane.length);
  }
}
check('every moving car has moved', sim.traffic.cars.every((c, i) => c.lane.cruise === 0 || Math.abs(c.s - starts[i]) > 1), `${moving.length} cars`);
check('parked cars stay put', sim.traffic.cars.every((c, i) => c.lane.cruise > 0 || c.s === starts[i]), `${sim.traffic.cars.length - moving.length} cars`);
check('cars keep apart in their lanes', closest > CAR_HALF.length * 2, `closest ${closest.toFixed(1)} m`);

// 3. Stop across the boulevard: traffic must brake rather than ram the truck.
const boulevardZ = cityCell(17, 12)[1];
// A straight run at the boulevard.
const [approachX, approachZ] = cityCell(17.25, 10.4);
sim.reset();
wait(1);
carryTo(approachX, approachZ);
while (truckPos().z < boulevardZ - 9) sim.step({ throttle: 0.5, steer: 0, handbrake: false });
while (sim.truck.forwardSpeed() > 0.2) sim.step({ throttle: -1, steer: 0, handbrake: false });
const parkedAt = { ...truckPos() };
const valueBefore = sim.cargoValue();
wait(30);
const shoved = Math.hypot(truckPos().x - parkedAt.x, truckPos().z - parkedAt.z);
check('truck stopped across the boulevard', Math.abs(parkedAt.z - boulevardZ) < 9, `z = ${parkedAt.z.toFixed(1)}, lanes at ${boulevardZ - 3.5} and ${boulevardZ}`);
check('traffic drives straight into a truck stopped across the road', shoved > 0.3, `truck moved ${shoved.toFixed(2)} m, load at ${Math.round((sim.cargoValue() / valueBefore) * 100)}%`);

// But a truck going their way is only slow traffic: they queue behind it.
sim.reset();
wait(1);
const streetZ = cityCell(0, 30.67)[1];
// Dropped in well ahead of the next car in that lane, so that it has room to see the truck and stop.
const inLane = sim.traffic.cars.filter((c) => c.lane.cruise > 0 && Math.abs(c.lane.from.z - streetZ) < 0.5).map((c) => c.lane.from.x + c.lane.dir.x * c.s).sort((a, b) => b - a);
const follower = inLane.find((x) => x < 100 && x > -100)!;
faceEast(follower - 45, streetZ);
wait(1.5);
const queuedAt = { ...truckPos() };
const queuedValue = sim.cargoValue();
wait(20);
const nudged = Math.hypot(truckPos().x - queuedAt.x, truckPos().z - queuedAt.z);
check('traffic queues behind a truck stopped in its lane', nudged < 0.3 && sim.cargoValue() > queuedValue * 0.97, `truck moved ${nudged.toFixed(2)} m`);
check('cars are queued behind it', sim.traffic.cars.filter((c) => c.lane.cruise > 0 && c.speed < 0.5).length >= 2);

// 4. Pulling out in front of traffic gets the truck hit: it should cost part of the load, never most of it.
const kept: number[] = [];
for (const delay of [1.5, 4.5, 7.5]) {
  sim.reset();
  wait(1);
  carryTo(approachX, approachZ);
  wait(delay);
  for (let i = 0; i < 60 * 14; i++) {
    const z = truckPos().z;
    const speed = sim.truck.forwardSpeed();
    const throttle = z < boulevardZ - 12 ? 1 : z < boulevardZ + 2 ? (speed < 3 ? 0.4 : 0) : speed > 0.3 ? -1 : 0;
    sim.step({ throttle, steer: 0, handbrake: false });
  }
  kept.push(sim.cargoValue() / sim.fullValue);
}
const percent = `kept ${kept.map((k) => `${Math.round(k * 100)}%`).join(', ')}`;
check('being hit by a car never costs most of the load', Math.min(...kept) > 0.45, percent);

// 5. Driving through the stock in front of the market stalls sends it flying, without wrecking the load.
sim.reset();
wait(1);
const [sx, sz] = cityCell(17, 6.5);
// Down one side of the market lane, through the goods stacked in front of the stalls.
const [mx, mz] = cityCell(27, 14.1);
carryTo(mx + 2.2, mz);
wait(0.5);
let highest = 0;
for (let i = 0; i < 60 * 4; i++) {
  sim.step({ throttle: 1, steer: 0, handbrake: false });
  if (i % 6 === 0) for (const o of objects) if (o.knocked) highest = Math.max(highest, o.body.translation().y);
}
const knocked = objects.filter((o) => o.knocked);
check('ploughing through the market knocks things flying', knocked.length >= 5, `${knocked.length} objects`);
check('and they go up in the air, not just along the ground', highest > 1, `highest ${highest.toFixed(1)} m`);
check('at little cost to the load', sim.cargoValue() / sim.fullValue > 0.85, `${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%`);
sim.reset();
check('a reset stands everything back up', objects.every((o) => !o.knocked && o.body.isSleeping()));

// 6. Pedestrians: they run from the truck, get sent flying if it catches them, and get up again.
const people = sim.pedestrians.list;
check('the city has people in it', people.length > 50, `${people.length}`);
wait(1);
// A long clear road to do it on.
carryTo(sx - 3.5, sz);
const victim = people[0];
/** Stand the victim in the road ahead of the truck, facing nothing in particular. */
const standAhead = (metres: number) => {
  const t = truckPos();
  victim.pos.set(t.x, victim.crowd.y, t.z + metres);
  victim.state = 'wait';
  victim.timer = 10;
};

// A slow truck: they have time to get out of the way.
wait(1.2, { throttle: 0.6, steer: 0, handbrake: false });
standAhead(14);
let fled = false;
for (let i = 0; i < 60 * 3; i++) {
  sim.step({ throttle: sim.truck.forwardSpeed() < 6 ? 0.5 : 0, steer: 0, handbrake: false });
  fled ||= (victim.state as string) === 'flee';
}
check('someone in the way of a slow truck runs clear', fled && sim.pedestrians.hits === 0, `at ${(sim.truck.forwardSpeed() * 3.6).toFixed(0)} km/h`);

// A fast one: it arrives before they have moved.
wait(2, { throttle: 1, steer: 0, handbrake: false, boost: true });
standAhead(11);
for (let i = 0; i < 60 * 2 && sim.pedestrians.hits === 0; i++) sim.step({ throttle: 1, steer: 0, handbrake: false, boost: true });
check('a fast truck sends them flying', sim.pedestrians.hits >= 1 && (victim.state as string) === 'down', `at ${(sim.truck.forwardSpeed() * 3.6).toFixed(0)} km/h`);
let peak = 0;
for (let i = 0; i < 60 * 6; i++) {
  sim.step(idle);
  peak = Math.max(peak, victim.pos.y);
}
check('they fly through the air', peak > 0.8, `${peak.toFixed(1)} m up`);
check('and get up again afterwards', (victim.state as string) !== 'down');


// 7. The closed road: driving past the warnings ends in the hole.
sim.reset();
wait(1);
carryTo(...cityCell(24, 14.1));
for (let i = 0; i < 60 * 15 && !sim.result; i++) sim.step({ throttle: sim.truck.forwardSpeed() < 10 ? 1 : 0, steer: 0, handbrake: false });
check('driving into the dug-up road ends the run', sim.result?.failure === 'pit', `truck at y = ${truckPos().y.toFixed(2)}`);

// The lifting bridge: crawling onto it ends in the river.
sim.reset();
wait(1);
carryTo(...cityCell(20.22, 22.3));
for (let i = 0; i < 60 * 20 && !sim.result; i++) sim.step({ throttle: sim.truck.forwardSpeed() < 6 ? 0.6 : 0, steer: 0, handbrake: false });
check('creeping over the open bridge ends in the river', sim.result?.failure === 'water', `truck at y = ${truckPos().y.toFixed(2)}`);
// It may hang on the lip a while before it slides in: the sinking starts when it is under.
for (let i = 0; i < 60 * 8 && !sim.water.under(truckPos()); i++) sim.step(idle);
wait(4);
check('and the truck sinks slowly, not like a stone', truckPos().y < -1 && truckPos().y > -3.4, `y = ${truckPos().y.toFixed(2)} four seconds later`);

// 8. The railway. Every signal gives fair warning, and is green again between trains.
sim.reset();
const tracks = level.tracks!;
const crossingX = tracks[0].watchX;
const lane = cityCell(29.22, 0)[0];
/** Whether a train on this track is over the road, or within a truck's width of it. */
const overRoad = (track: number) => sim.trains.trains.some((t) => t.track === track && Math.abs(t.x - crossingX) < TRAIN_HALF.length + 8);
const redFor = tracks.map(() => 0);
const greenSteps = tracks.map(() => 0);
let shortest = Infinity;
let unwarned = 0;
const watched = 60 * 60;
for (let i = 0; i < watched; i++) {
  sim.step(idle);
  tracks.forEach((_, t) => {
    const red = sim.trains.warning(t);
    if (overRoad(t)) {
      if (!red) unwarned++;
      // The moment a train arrives: how long had the signal been red?
      // (Trains already close when the clock starts are not counted.)
      else if (redFor[t] > 0 && i > 60 * 5) shortest = Math.min(shortest, redFor[t] / 60);
      redFor[t] = 0;
    } else if (red) redFor[t]++;
    else {
      redFor[t] = 0;
      greenSteps[t]++;
    }
  });
}
const greenShare = greenSteps.map((n) => n / watched);
check('the crossing has six tracks', tracks.length === 6);
check('no train reaches the road unannounced', unwarned === 0 && shortest >= 3, `least warning ${shortest.toFixed(1)} s`);
check('every track is clear some of the time, none of them most of it', Math.min(...greenShare) > 0.15 && Math.max(...greenShare) < 0.6, greenShare.map((g) => `${Math.round(g * 100)}%`).join(', '));
// How long all six are green together: a dash straight across needs about five seconds.
let allClear = 0;
let longestClear = 0;
for (let i = 0; i < watched; i++) {
  sim.step(idle);
  allClear = tracks.every((_, t) => !sim.trains.warning(t)) ? allClear + 1 : 0;
  longestClear = Math.max(longestClear, allClear);
}
check('there is never time to dash across all six', longestClear / 60 < 3, `longest all-clear ${(longestClear / 60).toFixed(1)} s`);

// Setting off the moment a signal is still green always gets the truck across that track.
let caught = 0;
let crossings = 0;
let slowest = 0;
for (let attempt = 0; attempt < 12; attempt++) {
  sim.reset();
  wait(1 + attempt * 0.77);
  const track = attempt % tracks.length;
  carryTo(lane, tracks[track].z - 10);
  wait(0.3);
  // Wait for green, then for the very last moment of it.
  for (let i = 0; i < 60 * 20 && sim.trains.warning(track); i++) sim.step(idle);
  for (let i = 0; i < 60 * 20 && !sim.trains.warning(track); i++) sim.step(idle);
  for (let i = 0; i < 60 * 20 && sim.trains.warning(track); i++) sim.step(idle);
  // Green again: sit through it and go on its last step, as the worst case.
  while (!sim.result) {
    sim.step(idle);
    if (sim.trains.warning(track)) break;
  }
  const setOff = sim.time;
  while (!sim.result && truckPos().z < tracks[track].z + 5.5) sim.step({ throttle: 1, steer: 0, handbrake: false });
  slowest = Math.max(slowest, sim.time - setOff);
  crossings++;
  if (sim.drainStrikes().length) caught++;
}
check('setting off as the signal turns red still clears the track', caught === 0, `${crossings} crossings, ${caught} caught, ${slowest.toFixed(1)} s to cross`);

// And stopping on a track is the end of the run.
sim.reset();
wait(1);
carryTo(lane, tracks[2].z);
const leftAt = { ...truckPos() };
let thrown = 0;
for (let i = 0; i < 60 * 15 && thrown === 0; i++) {
  sim.step(idle);
  thrown += sim.drainStrikes().length;
}
wait(1);
const flung = Math.hypot(truckPos().x - leftAt.x, truckPos().z - leftAt.z);
check('a truck left on the track is sent flying by a train', thrown === 1 && flung > 8, `thrown ${flung.toFixed(0)} m, ${sim.cargoOnTruck()}/${sim.cargo.length} still aboard`);
check('which is not in itself the end of the run', sim.result === null || sim.result.failure === 'overturned', sim.result?.failure ?? 'still going');


// 9. A careful driver follows the marked route from one end to the other.
sim.reset();
wait(1);

const path = level.route!;
let leg = 0;
/** Where the truck is along the route: the leg it is on, and how far along that. */
function locate(): number {
  const p = truckPos();
  for (;;) {
    const [ax, az] = path[leg];
    const [bx, bz] = path[leg + 1];
    const length = Math.hypot(bx - ax, bz - az);
    const along = ((p.x - ax) * (bx - ax) + (p.z - az) * (bz - az)) / length;
    if (along < length || leg === path.length - 2) return Math.max(0, Math.min(length, along));
    leg++;
  }
}
/** The point on the route `distance` further on from where the truck is. */
function ahead(distance: number): [number, number] {
  let left = locate() + distance;
  for (let i = leg; i < path.length - 1; i++) {
    const [ax, az] = path[i];
    const [bx, bz] = path[i + 1];
    const length = Math.hypot(bx - ax, bz - az);
    if (left <= length) return [ax + ((bx - ax) * left) / length, az + ((bz - az) * left) / length];
    left -= length;
  }
  return path[path.length - 1];
}

/** Whether carrying on would put the truck in the path of a moving car in the next few seconds. */
function conflict(): boolean {
  const pace = Math.max(sim.truck.forwardSpeed(), 4);
  const fwd = heading();
  for (const car of sim.traffic.cars) {
    if (car.lane.cruise === 0 || car.knocked > 0) continue;
    // Cars going our way are following traffic, not crossing traffic.
    if (car.lane.dir.x * Math.sin(fwd) + car.lane.dir.z * Math.cos(fwd) > 0.6) continue;
    const cx = car.lane.from.x + car.lane.dir.x * car.s;
    const cz = car.lane.from.z + car.lane.dir.z * car.s;
    for (let time = 0.25; time <= 3.5; time += 0.25) {
      const [ax, az] = ahead(pace * time);
      const fx = cx + car.lane.dir.x * car.speed * time;
      const fz = cz + car.lane.dir.z * car.speed * time;
      if (Math.hypot(ax - fx, az - fz) < 6.5) return true;
    }
  }
  return false;
}

interface Hold {
  at: [number, number];
  /** A railway track to watch the signal of; otherwise it is cross traffic that is waited for. */
  track?: number;
  passed: boolean;
}
// Where a driver would stop and look: joining the boulevard, turning left across its far
// carriageway, joining the busy street and turning left across it, and before each of the
// six railway tracks.
const holds: Hold[] = [
  { at: cityCell(17.22, 11.2), passed: false },
  { at: cityCell(26, 12.22), passed: false },
  { at: cityCell(22.22, 30.1), passed: false },
  { at: cityCell(28.3, 30.89), passed: false },
  ...tracks.map((t, track): Hold => ({ at: [lane, t.z - 10], track, passed: false })),
];
// And where they would slow right down: the humps, and the plate over the trench.
const crawl: [number, number][] = [cityCell(22.22, 29.4), cityCell(22.22, 29.95), cityCell(24.6875, 26.8125), cityCell(24.6875, 28.1875), cityCell(27, 41)];
// And the one place to do the opposite: the run-up to the lifting bridge.
// [minX, minZ, maxX, maxZ, limit]: the broken road, the terrace steps, the oily corner.
const slow: [number, number, number, number, number][] = [
  [cityCell(27.6, 0)[0], cityCell(0, 21.5)[1], cityCell(21.4, 0)[0], cityCell(0, 22.5)[1], 4],
  [cityCell(24, 0)[0], cityCell(0, 40.5)[1], cityCell(20.8, 0)[0], cityCell(0, 41.5)[1], 3],
  [cityCell(15.2, 0)[0], cityCell(0, 40.5)[1], cityCell(11.5, 0)[0], cityCell(0, 42.6)[1], 3],
];
const [bridgeX, bridgeFrom] = cityCell(20.22, 22.6);
const bridgeTo = cityCell(20.22, 24.4)[1];

let steps = 0;
let waiting = 0;
/** Steps spent wanting to move and not moving: something is in the way, and needs a shove. */
let blocked = 0;
/** While crossing a track: the Z beyond which the truck's tail is clear of it. */
let clearAt: number | null = null;
const finishAt = path[path.length - 1];
while (!sim.result && steps < 60 * 900) {
  const p = truckPos();
  const [tx, tz] = ahead(7);
  let error = Math.atan2(tx - p.x, tz - p.z) - heading();
  error = Math.atan2(Math.sin(error), Math.cos(error));
  // How sharply the road bends over the next stretch.
  const [fx, fz] = ahead(16);
  let bend = Math.atan2(fx - p.x, fz - p.z) - heading();
  bend = Math.abs(Math.atan2(Math.sin(bend), Math.cos(bend)));

  const speed = sim.truck.forwardSpeed();
  let limit = Math.abs(error) > 0.3 || bend > 0.45 ? 4 : bend > 0.2 ? 6 : 9;
  if (crawl.some(([x, z]) => Math.hypot(x - p.x, z - p.z) < 9)) limit = Math.min(limit, 3);
  for (const [x0, z0, x1, z1, most] of slow) if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) limit = Math.min(limit, most);
  const runUp = Math.abs(p.x - bridgeX) < 3 && p.z > bridgeFrom && p.z < bridgeTo;
  if (runUp) limit = 17;
  const toFinish = Math.hypot(finishAt[0] - p.x, finishAt[1] - p.z);
  if (toFinish < 20) limit = toFinish < 1.5 ? 0 : Math.min(limit, 1.5 + toFinish * 0.5);

  if (clearAt !== null && p.z > clearAt) clearAt = null;
  const hold: Hold | undefined = clearAt !== null ? undefined : holds.find((h) => !h.passed && Math.hypot(h.at[0] - p.x, h.at[1] - p.z) < 9);
  const onRails = clearAt !== null || hold?.track !== undefined;
  if (onRails) limit = Math.min(limit, 7);
  if (hold && hold.track !== undefined) {
    const dist = Math.hypot(hold.at[0] - p.x, hold.at[1] - p.z);
    if (sim.trains.warning(hold.track)) limit = dist < 1 ? 0 : Math.min(limit, 1 + dist * 0.9);
    else if (dist < 2.5) {
      // Green, and close enough to be over before it could change: go, and don't stop till clear.
      hold.passed = true;
      clearAt = tracks[hold.track].z + 5.3;
    }
  } else if (hold && Math.hypot(hold.at[0] - p.x, hold.at[1] - p.z) < 7) {
    // Stop short and wait for a gap, as at a give-way line. Once past it, traffic brakes for the truck.
    if (conflict() && waiting < 60 * 40) {
      limit = 0;
      waiting++;
    } else {
      hold.passed = true;
      waiting = 0;
    }
  }

  let throttle = speed < limit - 0.5 ? 0.45 : speed > limit + 0.8 || limit === 0 ? -1 : 0;
  blocked = limit > 0 && Math.abs(speed) < 0.3 ? blocked + 1 : 0;
  if ((clearAt !== null || runUp || blocked > 90) && throttle > 0) throttle = 1;
  // Brake in pulses, as a careful driver would, so the load stays put. Between tracks there is no room for that.
  const brake = throttle < 0 && (onRails || speed > limit + 4 || steps % 18 < 9);
  sim.step({ throttle: throttle < 0 ? (brake ? -1 : 0) : throttle, steer: Math.max(-1, Math.min(1, error * 2.2)), handbrake: false });
  steps++;
  if (verbose && steps % 300 === 0) console.log(`  t=${steps / 60}s leg ${leg}/${path.length - 1} at (${p.x.toFixed(0)}, ${p.z.toFixed(0)}) speed ${speed.toFixed(1)} value ${Math.round(sim.cargoValue())} on truck ${sim.cargoOnTruck()}`);
}

if (!sim.result || sim.result.failure) {
  const p = truckPos();
  console.log(`  stopped at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}, y ${p.y.toFixed(2)}) heading ${heading().toFixed(2)} speed ${sim.truck.forwardSpeed().toFixed(1)}, value ${Math.round(sim.cargoValue())}, leg ${leg}, failure ${sim.result?.failure}, waited ${waiting}`);
}
const result = sim.result;
check('a careful driver reaches the delivery bay', result !== null && !result.failure, `leg ${leg + 1}/${path.length - 1} after ${(steps / 60).toFixed(0)} s`);
if (result && !result.failure) {
  check('careful delivery passes', result.stars >= 1, `${Math.floor(result.fraction * 100)}% of value, ${result.stars} star(s), ${result.seconds.toFixed(0)} s`);
  check('the route is well over a kilometre', result.seconds > 120, `${objects.filter((o) => o.knocked).length} objects knocked on the way, ${sim.pedestrians.hits} people hit`);
}

// 10. A careless one, at full speed down the same line, pays for it.
sim.reset();
wait(1);
leg = 0;
steps = 0;
while (!sim.result && steps < 60 * 120) {
  const p = truckPos();
  const [tx, tz] = ahead(9);
  let error = Math.atan2(tx - p.x, tz - p.z) - heading();
  error = Math.atan2(Math.sin(error), Math.cos(error));
  const speed = sim.truck.forwardSpeed();
  const limit = Math.abs(error) > 0.4 ? 9 : 17;
  sim.step({ throttle: speed < limit ? 1 : speed > limit + 2 ? -1 : 0, steer: Math.max(-1, Math.min(1, error * 2.2)), handbrake: false });
  steps++;
}
const reckless = sim.result?.failure ?? (sim.result ? `delivered ${Math.floor(sim.result.fraction * 100)}%` : `${Math.floor((sim.cargoValue() / sim.fullValue) * 100)}% left after 2 min`);
check('driving flat out does not get through unscathed', !sim.result || !!sim.result.failure || sim.result.stars < 3, `${reckless}, leg ${leg + 1}/${path.length - 1}`);

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
