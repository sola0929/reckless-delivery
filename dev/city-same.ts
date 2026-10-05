// The first level after changes to what it runs on: still on the flat, the truck and the traffic where they always were. npx tsx dev/city-same.ts
import { city } from '../src/levels/city';
import { Sim } from '../src/sim/sim';
const level = city();
const sim = await Sim.create(level);
for (let i = 0; i < 300; i++) sim.step({ throttle: i > 120 ? 0.9 : 0, steer: 0, handbrake: i <= 120 });
const t = sim.truck.body.translation();
const cars = sim.traffic.cars.map((c) => c.body.translation().y);
const riders = sim.riders.list.map((r) => r.body.translation().y);
console.log(`city: terrain ${!!level.terrain}; truck ${t.x.toFixed(2)}, ${t.y.toFixed(3)}, ${t.z.toFixed(2)}; car heights ${Math.min(...cars).toFixed(2)} to ${Math.max(...cars).toFixed(2)}; rider heights ${Math.min(...riders).toFixed(2)} to ${Math.max(...riders).toFixed(2)}; decals with base or tilt ${level.decals.filter((d) => d.base || d.tilt).length}; load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%`);
process.exit(0);
