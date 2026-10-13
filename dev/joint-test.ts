// Rapier joints on their own: does a prismatic joint hold a hanging body to a fixed one, and to a moving one? npx tsx dev/joint-test.ts
import RAPIER from '@dimforge/rapier3d-compat';
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
const fixed = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0));
const box = (body: RAPIER.RigidBody, mass: number) => world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setMass(mass), body);
// A: hanging off the fixed body.
const a = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0));
box(a, 2500);
const ja = world.createImpulseJoint(RAPIER.JointData.prismatic({ x: 0, y: 5, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }), fixed, a, true) as RAPIER.PrismaticImpulseJoint;
ja.setMotorMaxForce(150000);
// B: a jib turning on the fixed body, and something hanging off the jib.
const jib = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(20, 1.3, 0));
box(jib, 14000);
world.createImpulseJoint(RAPIER.JointData.revolute({ x: 20, y: 1.3, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }), fixed, jib, true);
const b = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(20, 5, 8));
box(b, 2500);
const jb = world.createImpulseJoint(RAPIER.JointData.prismatic({ x: 0, y: 3.7, z: 8 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }), jib, b, true) as RAPIER.PrismaticImpulseJoint;
jb.setMotorMaxForce(150000);
for (const v of [0, 1, -1]) {
  for (let i = 0; i < 60; i++) {
    ja.configureMotorVelocity(v, 40);
    jb.configureMotorVelocity(v, 40);
    world.step();
  }
  console.log(`told ${v}: A at y ${a.translation().y.toFixed(2)}, B at y ${b.translation().y.toFixed(2)} (jib y ${jib.translation().y.toFixed(2)})`);
}
process.exit(0);
