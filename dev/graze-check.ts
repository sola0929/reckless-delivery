// A lorry on level 3's bridge brushing past the parked truck, or running into it: is it a crash, how hard does the load feel it.
// npx tsx dev/graze-check.ts <metres over towards the oncoming lane> [seconds]   (2.6 misses, 2.35 brushes, 0 is head on)
import { LEVELS } from '../src/levels';
import { Sim } from '../src/sim/sim';
const level = LEVELS.quarry();
const offset = Number(process.argv[2] ?? 2.2);
const sim = await Sim.create({ ...level, crowds: [] });
const cp = level.checkpoints!.find((c) => c.name === 'E 便橋')!;
sim.teleport(cp.pos[0] + offset, cp.pos[1] + 150, 0);
const park = { throttle: 0, steer: 0, handbrake: true };
let topTruck = 0;
for (let i = 0; i < 60 * Number(process.argv[3] ?? 1.5); i++) {
  sim.step(park);
  const tv = sim.truck.body.linvel();
  topTruck = Math.max(topTruck, Math.hypot(tv.x, tv.z));
}
const knocked = sim.traffic.cars.filter((c) => c.kind === 'dumpTruck' && c.knocked > 0).length;
console.log(`offset ${offset}: hits ${sim.traffic.hits}, lorries knocked ${knocked}, truck top speed ${topTruck.toFixed(2)}, value ${Math.round(sim.cargoValue())}/${sim.fullValue}`);
import { Quaternion, Vector3 } from 'three';
for (const c of sim.traffic.cars.filter((c) => c.knocked > 0)) { const r = c.body.rotation(); const p = c.body.translation(); console.log('  knocked lorry z', p.z.toFixed(1), 'y', p.y.toFixed(2), 'up', new Vector3(0, 1, 0).applyQuaternion(new Quaternion(r.x, r.y, r.z, r.w)).y.toFixed(2), 'v', Math.hypot(c.body.linvel().x, c.body.linvel().z).toFixed(1)); }
console.log('  impacts', sim.traffic.cars.filter((c) => c.knocked > 0).map((c) => c.impact.toFixed(1)).join(', '));
