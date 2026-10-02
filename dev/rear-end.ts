// The truck runs into the back of cars going the same way, in the city as it is played:
// whether any of them stops it like a wall, and if so what was there. npx tsx dev/rear-end.ts
import { Quaternion } from 'three';
import { city } from '../src/levels/city';
import { Sim } from '../src/sim/sim';
let stuck = 0;
let runs = 0;
const level = city();
const lanes = level.traffic.filter((l) => l.speed > 0);
for (let n = 0; n < 12; n++) {
  const sim = await Sim.create(level);
  for (let i = 0; i < 200 + n * 37; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const desc = lanes[n % lanes.length];
  const east = desc.to[0] < desc.from[0];
  // A car on that lane, somewhere in the middle of the map.
  const car = sim.traffic.cars.filter((c) => c.lane.cruise > 0 && Math.abs(c.lane.from.z - desc.from[1]) < 0.1 && Math.abs(c.body.translation().x) < 150 && c.speed > 5)[n % 3];
  if (!car) continue;
  runs++;
  const speed = 18 + (n % 3) * 5;
  const p = car.body.translation();
  const t = sim.truck.body.translation(); const h = Math.SQRT1_2;
  const turn = east ? new Quaternion(0, -h, 0, h) : new Quaternion(0, h, 0, h);
  const dir = east ? -1 : 1;
  const x = p.x - dir * 13, z = p.z;
  for (const c of sim.cargo) { if (!c.body) continue; const q = c.body.translation(); const r = c.body.rotation(); c.body.setTranslation({ x: x + dir * (q.z - t.z), y: q.y, z: z - dir * (q.x - t.x) }, true); c.body.setRotation(new Quaternion(r.x, r.y, r.z, r.w).premultiply(turn), true); c.body.setLinvel({ x: dir * speed, y: 0, z: 0 }, true); }
  sim.truck.body.setTranslation({ x, y: t.y, z }, true); sim.truck.body.setRotation(turn, true);
  sim.truck.body.setLinvel({ x: dir * speed, y: 0, z: 0 }, true);
  let lowest = 99; let at = -1; let before = speed; const log: string[] = [];
  for (let i = 0; i < 130; i++) {
    const v0 = sim.truck.forwardSpeed();
    sim.step({ throttle: 1, steer: 0, handbrake: false });
    if (car.knocked > 0 && at < 0) { at = i; before = v0; }
    if (at >= 0) {
      lowest = Math.min(lowest, sim.truck.forwardSpeed());
      if (i - at < 40 && (i - at) % 4 === 0) { const cp = car.body.translation(); const cv = car.body.linvel(); const tp = sim.truck.body.translation(); const r = car.body.rotation(); log.push(`+${i - at}: truck ${(sim.truck.forwardSpeed() * 3.6).toFixed(0)} km/h; car ${(Math.hypot(cv.x, cv.z) * 3.6).toFixed(0)} km/h, ${(dir * (cp.x - tp.x)).toFixed(1)} m ahead, ${(cp.z - tp.z).toFixed(1)} across, y ${cp.y.toFixed(2)}, tilt ${(Math.acos(Math.min(1, 1 - 2 * (r.x * r.x + r.z * r.z))) * 57.3).toFixed(0)}, type ${car.body.bodyType()}`); }
    }
  }
  const wall = at >= 0 && lowest < before * 0.4;
  if (wall) stuck++;
  console.log(`run ${n}: lane z ${desc.from[1].toFixed(0)} ${east ? 'east' : 'west'}, truck ${(before * 3.6).toFixed(0)} km/h into a car at ${(car.lane.cruise * 3.6).toFixed(0)}: ${at < 0 ? 'never reached it' : `slowest ${(lowest * 3.6).toFixed(0)} km/h`}${wall ? '  <-- like a wall' : ''}; cars loose ${sim.traffic.cars.filter((c) => c.knocked > 0).length}, riders off ${sim.riders.list.filter((r) => r.knocked > 0).length}`);
  if (wall) console.log('   ' + log.join('\n   '));
}
console.log(stuck ? `${stuck} of ${runs} runs stopped the truck like a wall` : `none of ${runs} runs stopped the truck like a wall`);
