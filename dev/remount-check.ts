// A rider knocked off their scooter gets up, walks back to it and rides on.
import { city } from '../src/levels/city';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(city());
const idle = { throttle: 0, steer: 0, handbrake: true };
for (let i = 0; i < 120; i++) sim.step(idle);
const rider = sim.riders.list[20];
const at = rider.body.translation();
sim.riders.blast(at.x, at.z, 1.5);
const off = sim.riders.list.filter((r) => !r.seated);
let walked = false;
let seconds = 0;
for (; seconds < 20 && off.some((r) => !r.seated); seconds += 1 / 60) {
  sim.step(idle);
  walked ||= off.some((r) => r.walking);
}
for (let i = 0; i < 180; i++) sim.step(idle);
const ok = off.length > 0 && walked && off.every((r) => r.seated && r.speed > 5);
console.log(`${ok ? 'PASS' : 'FAIL'}  ${off.length} knocked off; walked back: ${walked}; riding again after ${seconds.toFixed(1)} s at ${off.map((r) => (r.speed * 3.6).toFixed(0)).join(', ')} km/h`);
