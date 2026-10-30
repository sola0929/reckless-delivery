// Level 4's flooded lane, one thing at a time, headless at three speeds: a wheel over an open drain; the truck's side
// along the bucket truck's legs; how fast the water lets it go on a clear run.
// npx tsx dev/harbour-flood.ts
import { harbour } from '../src/levels/harbour';
import { Sim } from '../src/sim/sim';

const level = harbour();
async function run(name: string, z: number, from: number, to: number, want: number) {
  const sim = await Sim.create(level);
  sim.teleport(from, z, Math.PI / 2);
  for (let i = 0; i < 90; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  let top = 0, lean = 0, bump = 0, lastVy = 0;
  for (let i = 0; i < 60 * 30 && !sim.result; i++) {
    const p = sim.truck.body.translation(), r = sim.truck.body.rotation(), v = sim.truck.body.linvel();
    if (p.x > to) break;
    const speed = sim.truck.forwardSpeed();
    top = Math.max(top, speed);
    lean = Math.max(lean, Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (r.x * r.x + r.z * r.z)))) * 180 / Math.PI);
    bump = Math.max(bump, Math.abs(v.y - lastVy) * 60);
    lastVy = v.y;
    const off = z - p.z;
    sim.step({ throttle: speed < want ? 1 : speed > want + 1 ? -0.6 : 0.1, steer: Math.max(-1, Math.min(1, -off * 0.8)), handbrake: false });
  }
  const p = sim.truck.body.translation();
  const kept = Math.round((sim.cargoValue() / sim.fullValue) * 100);
  console.log(`${name} ${(want * 3.6).toFixed(0)} km/h: at ${p.x.toFixed(1)},${p.z.toFixed(2)} load ${kept}%, top ${(top * 3.6).toFixed(0)} km/h, lean ${lean.toFixed(1)}°, worst jolt ${bump.toFixed(0)} m/s²`);
}
for (const v of [3, 6, 10]) await run('over the first drain', 339.4, 42, 56, v);
for (const v of [3, 6, 10]) await run('clear, down the dock side', 337.6, 42, 58, v);
for (const v of [3, 6, 10]) await run('rubbing the legs', 338.5, 66, 90, v);
