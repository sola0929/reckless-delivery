// How fast the lifting bridge has to be taken to be jumped: one run at each speed, straight
// at it, and whether the truck comes down on the far bank. npx tsx dev/bridge-jump.ts
import { city, cityCell } from '../src/levels/city';
import { Sim } from '../src/sim/sim';
const out: string[] = [];
for (const kmh of [50, 55, 60, 65, 70, 90]) {
  const level = city();
  level.objects = []; level.riders = []; level.crowds = []; level.traffic = [];
  const sim = await Sim.create(level);
  for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const t = sim.truck.body.translation();
  // On the riverside road, lined up with the bridge, with room for a run at it.
  const [x, z] = cityCell(20.22, 21.6);
  const far = cityCell(20.22, 25.9)[1];
  const move = (b: any) => { const p = b.translation(); b.setTranslation({ x: p.x + x - t.x, y: p.y, z: p.z + z - t.z }, true); b.setLinvel({ x: 0, y: 0, z: kmh / 3.6 }, true); };
  for (const c of sim.cargo) if (c.body) move(c.body);
  move(sim.truck.body);
  let lowest = 9;
  for (let i = 0; i < 60 * 12 && !sim.result && sim.truck.body.translation().z < far; i++) {
    const p = sim.truck.body.translation();
    lowest = Math.min(lowest, p.y);
    const v = sim.truck.forwardSpeed();
    sim.step({ throttle: v < kmh / 3.6 ? 1 : 0, steer: Math.max(-0.1, Math.min(0.1, (p.x - x) * 0.1)), handbrake: false, boost: kmh > 85 });
  }
  const over = !sim.result && sim.truck.body.translation().z >= far;
  out.push(`${kmh}: ${over ? `over, ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}% left, lowest ${lowest.toFixed(1)} m` : sim.result?.failure ?? 'short'}`);
}
console.log(out.join(' | '));
