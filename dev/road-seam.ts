// Heights of the ground down the branch south off the road (column 25) and across where it meets the road: any step shows. npx tsx dev/road-seam.ts
import RAPIER from '@dimforge/rapier3d-compat';
import { LEVELS } from '../src/levels/index';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(LEVELS.uptown());
const world = (sim as unknown as { world: RAPIER.World }).world;
sim.step({ throttle: 0, steer: 0, handbrake: true });
const groundAt = (x: number, z: number) => {
  const hit = world.castRay(new RAPIER.Ray({ x, y: 200, z }, { x: 0, y: -1, z: 0 }), 400, true, undefined, undefined, undefined, sim.truck.body);
  return hit ? 200 - hit.timeOfImpact : NaN;
};
for (const x of [(17.5 - 25) * 16 - 4, (17.5 - 25) * 16, (17.5 - 25) * 16 + 2]) {
  let last = NaN, worst = 0, where = 0;
  for (let z = 16 * 48; z <= 16 * 51 + 4; z += 0.5) {
    const h = groundAt(x, z);
    if (Math.abs(h - last) > worst) { worst = Math.abs(h - last); where = z; }
    last = h;
  }
  console.log(`x ${x}: biggest step ${worst.toFixed(2)} m at z ${where}`);
}
process.exit(0);
