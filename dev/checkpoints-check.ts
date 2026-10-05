// Each testing jump point: the truck put down there, left for two seconds; is it on the ground, upright, and still there,
// with its load aboard? npx tsx dev/checkpoints-check.ts
import { Quaternion, Vector3 } from 'three';
import { uptown } from '../src/levels/uptown';
import { heightAt } from '../src/levels/terrain';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create(level);
for (const spot of level.checkpoints!) {
  sim.teleport(spot.pos[0], spot.pos[1], spot.yaw);
  for (let i = 0; i < 120; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const p = sim.truck.body.translation();
  const r = sim.truck.body.rotation();
  const up = new Vector3(0, 1, 0).applyQuaternion(new Quaternion(r.x, r.y, r.z, r.w));
  const moved = Math.hypot(p.x - spot.pos[0], p.z - spot.pos[1]);
  console.log(`${spot.name.padEnd(8, '　')} ${(p.y - heightAt(level.terrain!, p.x, p.z)).toFixed(2)} m above ground, tilt ${(Math.acos(Math.min(1, up.y)) * 57.3).toFixed(0)} deg, moved ${moved.toFixed(1)} m, load aboard ${sim.cargoOnTruck()}/${sim.cargo.length}`);
}
process.exit(0);
