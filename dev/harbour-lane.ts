// Level 4's way up, headless at three speeds: out of the market's back door along the lane, round into the fallen carport,
// up it and round onto the roofs. The careful way keeps its wheels off the flooded lane's open drains and goes between the
// bucket truck's legs and the dock; STRAIGHT=1 goes straight down the middle of the lane.
// npx tsx dev/harbour-lane.ts
import { harbour } from '../src/levels/harbour';
import { Sim } from '../src/sim/sim';
import type { DriveInput } from '../src/sim/truck';

const level = harbour();
type Point = [number, number];

async function drive(name: string, way: Point[], want: number, seconds = 120) {
  const sim = await Sim.create(level);
  const [x0, z0] = way[0], [x1, z1] = way[1];
  sim.teleport(x0, z0, Math.atan2(x1 - x0, z1 - z0));
  for (let i = 0; i < 90; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  let leg = 0, top = 0, tilt = 0, low = 99, lane = 0;
  for (let i = 0; i < 60 * seconds && leg < way.length - 1 && !sim.result; i++) {
    const p = sim.truck.body.translation(), r = sim.truck.body.rotation();
    while (leg < way.length - 1 && Math.hypot(way[leg + 1][0] - p.x, way[leg + 1][1] - p.z) < 3) leg++;
    const [tx, tz] = way[Math.min(leg + 1, way.length - 1)];
    const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
    const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
    const speed = sim.truck.forwardSpeed();
    top = Math.max(top, speed);
    if (p.z > 346 && p.z < 362) low = Math.min(low, speed);
    if (p.x < 100 && p.z < 344) lane = Math.max(lane, speed);
    const upY = 1 - 2 * (r.x * r.x + r.z * r.z);
    tilt = Math.max(tilt, Math.acos(Math.max(-1, Math.min(1, upY))) * 180 / Math.PI);
    // Slower into the turns: the target for the last few metres before each.
    const near = Math.hypot(tx - p.x, tz - p.z) < 8 && leg + 2 < way.length ? Math.min(want, 4) : want;
    const input: DriveInput = { throttle: speed < near ? 1 : speed > near + 1 ? -0.6 : 0.1, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false };
    sim.step(input);
    if (process.env.TRACE && i % 30 === 0) console.log('  ', (i / 60).toFixed(1), p.x.toFixed(1), p.y.toFixed(2), p.z.toFixed(1), speed.toFixed(1), leg);
  }
  const p = sim.truck.body.translation();
  const kept = Math.round((sim.cargoValue() / sim.fullValue) * 100);
  const end = sim.result ? (sim.result.failure ?? 'delivered') : leg >= way.length - 1 ? 'through' : `stuck`;
  console.log(`${name} ${(want * 3.6).toFixed(0)} km/h: ${end} at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} leg ${leg}, load ${kept}%, top ${(top * 3.6).toFixed(0)} km/h, in the lane ${(lane * 3.6).toFixed(0)} km/h, slowest on the carport ${(low * 3.6).toFixed(0)} km/h, most lean ${tilt.toFixed(0)}°`);
}

const careful: Point[] = [[44, 339.4], [47.5, 340.6], [52, 340.2], [60, 339.9], [64.5, 339], [70, 338.2], [73, 338], [88, 338], [93, 337.5], [98, 338.5], [103, 341], [103.75, 346], [103.75, 366], [102, 370], [94, 370.5], [80, 370.5]];
const straight: Point[] = [[44, 339.4], [98, 339.4], [103, 341], [103.75, 346], [103.75, 366], [102, 370], [94, 370.5], [80, 370.5]];
for (const v of [3, 6, 10]) await drive(process.env.STRAIGHT ? 'straight' : 'careful', process.env.STRAIGHT ? straight : careful, v);
