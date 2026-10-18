// Why the driver cannot get out in level 3's river: the truck's speed, and each door point and whether it is blocked.
import { Vector3 } from 'three';
import { LEVELS } from '../src/levels';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(LEVELS.quarry());
const PARK = { throttle: 0, steer: 0, handbrake: true };
sim.teleport(110, 953, 0);
for (let k = 0; k < 60; k++) sim.step(PARK);
const d = sim.driver as any;
console.log('speed', sim.truck.forwardSpeed().toFixed(2), 'result', JSON.stringify(sim.result?.failure ?? sim.result), 'truck', JSON.stringify(sim.truck.body.translation()));
for (const side of [1, -1]) {
  const v = new Vector3();
  d.doorPoint(sim.truck, side, v);
  const centre = { x: v.x, y: v.y + 1.7 / 2 + 0.05, z: v.z };
  const hit = d.world.intersectionWithShape(centre, { x: 0, y: 0, z: 0, w: 1 }, d.shape, undefined, 0xffff0001 >>> 0, d.collider);
  console.log(side, v.x.toFixed(2), v.y.toFixed(2), v.z.toFixed(2), 'hit', hit ? `collider ${hit.handle} parent ${hit.parent()?.handle} fixed ${hit.parent()?.isFixed()} sensor ${hit.isSensor()}` : 'none');
}
