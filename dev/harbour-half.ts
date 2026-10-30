// Level 4's first half driven headless, leg by leg, at three speeds: the street round the capsized boat by the arcade, the
// market's aisles, the climb and the roof down to the ice plant's dock, the ice yard and the ramp to the gate.
// npx tsx dev/harbour-half.ts [leg]
import { harbour } from '../src/levels/harbour';
import { marketLine } from '../src/levels/harbourMarket';
import { Sim } from '../src/sim/sim';
import type { DriveInput } from '../src/sim/truck';

const level = harbour();
type Point = [number, number];

async function drive(name: string, way: Point[], want: number, floor = 0, seconds = 150, reach = 3.5) {
  const sim = await Sim.create(level);
  const [x0, z0] = way[0], [x1, z1] = way[1];
  sim.teleport(x0, z0, Math.atan2(x1 - x0, z1 - z0), floor);
  for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  let leg = 0, top = 0, tilt = 0;
  for (let i = 0; i < 60 * seconds && leg < way.length - 1 && !sim.result; i++) {
    const p = sim.truck.body.translation(), r = sim.truck.body.rotation();
    while (leg < way.length - 1 && Math.hypot(way[leg + 1][0] - p.x, way[leg + 1][1] - p.z) < reach) leg++;
    const [tx, tz] = way[Math.min(leg + 1, way.length - 1)];
    const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
    const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
    const speed = sim.truck.forwardSpeed();
    top = Math.max(top, speed);
    const upY = 1 - 2 * (r.x * r.x + r.z * r.z);
    tilt = Math.max(tilt, (Math.acos(Math.max(-1, Math.min(1, upY))) * 180) / Math.PI);
    const input: DriveInput = { throttle: speed < want ? 1 : speed > want + 1 ? -0.6 : 0.1, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false };
    sim.step(input);
    if (process.env.TRACE && i % 60 === 0) console.log('  ', (i / 60).toFixed(0), p.x.toFixed(1), p.y.toFixed(2), p.z.toFixed(1), speed.toFixed(1), leg);
  }
  const p = sim.truck.body.translation();
  const kept = Math.round((sim.cargoValue() / sim.fullValue) * 100);
  const end = sim.result ? (sim.result.failure ?? 'delivered') : leg >= way.length - 1 ? 'through' : `stuck`;
  console.log(`${name} ${(want * 3.6).toFixed(0)} km/h: ${end} at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} leg ${leg}/${way.length - 1}, load ${kept}%, top ${(top * 3.6).toFixed(0)} km/h, most lean ${tilt.toFixed(0)}°`);
}

const legs: Record<string, [Point[], number]> = {
  street: [[[0, 4], [-0.7, 12], [-0.7, 28], [2.4, 35], [2.4, 49], [-2.2, 59], [-2.2, 72], [1.8, 80], [2.4, 90], [-1.5, 97], [-4.5, 104], [-6.15, 111], [-6.15, 138], [-3, 145], [-2.8, 152], [-2.8, 165], [2.4, 172], [2.6, 192], [-2.8, 201], [-3.1, 220], [0, 225], [2, 232]], 0],
  market: [[[2.8, 230], ...marketLine(), [90, 340]], 0],
  roof: [[[90, 340], [100, 346], [101, 356], [96, 364], [86, 364], [40, 364], [12, 364], [10, 358], [10, 296], [6, 290], [-20, 290], [-50, 290], [-56, 296], [-56, 318], [-56, 334]], 0],
  ice: [[[-56, 322], [-56, 334], [-70, 342], [-100, 346], [-110, 356], [-108, 372], [-98, 380.2], [-50, 380.2], [-44, 376], [-38, 378], [-35, 386], [-35, 398]], 0],
};
const only = process.argv[2];
for (const [name, [way, floor]] of Object.entries(legs)) {
  if (only && only !== name) continue;
  for (const v of process.env.TRACE ? [+process.env.TRACE] : [3, 6, 10]) await drive(name, way, v, floor, 150, 3.5);
}
process.exit(0);
