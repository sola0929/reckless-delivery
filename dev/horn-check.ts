// Whether the traffic sounds its horn at a truck driving at it down its own lane, and not at one going its way.
import { Quaternion } from 'three';
import { city, cityCell } from '../src/levels/city';
import { Sim } from '../src/sim/sim';
const [, busyZ] = cityCell(0, 31);
for (const [label, z, expect] of [['against the traffic', busyZ + 1.75, true], ['with the traffic', busyZ - 1.75, false]] as const) {
  const level = city();
  level.riders = []; level.crowds = [];
  const sim = await Sim.create(level);
  for (let i = 0; i < 120; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const t = sim.truck.body.translation(); const h = Math.SQRT1_2; const quarter = new Quaternion(0, -h, 0, h);
  const [x] = cityCell(14, 31);
  for (const c of sim.cargo) { if (!c.body) continue; const p = c.body.translation(); const r = c.body.rotation(); c.body.setTranslation({ x: x - (p.z - t.z), y: p.y, z: z + (p.x - t.x) }, true); c.body.setRotation(new Quaternion(r.x, r.y, r.z, r.w).premultiply(quarter), true); }
  sim.truck.body.setTranslation({ x, y: t.y, z }, true); sim.truck.body.setRotation({ x: 0, y: -h, z: 0, w: h }, true);
  let horns = 0;
  for (let i = 0; i < 60 * 6; i++) { sim.step({ throttle: sim.truck.forwardSpeed() < 6 ? 0.6 : 0, steer: 0, handbrake: false }); horns += sim.drainHorns().length; }
  console.log(`${horns > 0 === expect ? 'PASS' : 'FAIL'}  driving ${label}: ${horns} horns in six seconds`);
}
