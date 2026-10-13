// One clamshell crane on flat ground: does its grab go up and down when told to? npx tsx dev/grab-test.ts
import RAPIER from '@dimforge/rapier3d-compat';
import { Rigs } from '../src/sim/rigs';
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0));
const rigs = new Rigs(world, [{ kind: 'clamshell', pos: [0, 0, 0], yaw: 0, period: 12, phase: 0 }]);
const rig = rigs.list[0];
const joint = rig.joints[1] as RAPIER.PrismaticImpulseJoint;
for (const v of [2, -2, 2]) {
  for (let i = 0; i < 90; i++) {
    joint.configureMotorVelocity(v, 40);
    world.step();
  }
  const g = rig.parts[2].body.translation();
  console.log(`told ${v} m/s for 1.5 s: grab at y ${g.y.toFixed(2)}, jib at y ${rig.parts[1].body.translation().y.toFixed(2)}`);
}
process.exit(0);
