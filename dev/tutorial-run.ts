// The tutorial driven headless, up to past the crossing: flat out without braking (the train must catch it), and braking
// for the red lamps, at a few speeds (it must stop in time and cross after).
// npx tsx dev/tutorial-run.ts
import { tutorial, RX, TRACK_Z } from '../src/levels/tutorial';
import { Sim } from '../src/sim/sim';

const level = tutorial();
const way: [number, number][] = [[4, 0], [RX - 16, 0], [RX - 6, 2], [RX, 14], [RX, TRACK_Z + 12]];
for (const want of [8, 12, 16, 25]) for (const brakes of [false, true]) {
  const sim = await Sim.create({ ...level, crowds: [] });
  let leg = 0, mishap: string | null = null, waited = 0, top = 0;
  for (let i = 0; i < 60 * 40 && !mishap; i++) {
    const p = sim.truck.body.translation(), r = sim.truck.body.rotation();
    while (leg < way.length - 1 && Math.hypot(way[leg + 1][0] - p.x, way[leg + 1][1] - p.z) < 4) leg++;
    if (p.z > TRACK_Z + 8) break;
    const [tx, tz] = way[Math.min(leg + 1, way.length - 1)];
    const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
    const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
    const speed = sim.truck.forwardSpeed();
    top = Math.max(top, speed);
    // Braking: once the lamps are red, stop short of the line and wait.
    const red = sim.trains.warning(0) && p.z < TRACK_Z - 4;
    const hold = brakes && red && p.z > TRACK_Z - 45;
    if (hold && speed < 0.5) waited += 1 / 60;
    sim.step({ throttle: hold ? (speed > 0.3 ? -1 : 0) : speed < want ? 1 : 0.1, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false });
    mishap = sim.takeMishap();
  }
  const p = sim.truck.body.translation();
  console.log(`${(want * 3.6).toFixed(0)} km/h ${brakes ? 'braking for the lamps' : 'flat out'}: ${mishap ?? (p.z > TRACK_Z + 6 ? 'across' : `stopped at ${p.z.toFixed(1)}`)}${brakes ? `, waited ${waited.toFixed(1)} s` : ''}, top ${(top * 3.6).toFixed(0)}`);
}
process.exit(0);
