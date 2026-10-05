// Fresh vs after the coil avenue: how many times a step our code touches bodies, by method.
import RAPIER from '@dimforge/rapier3d-compat';
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const counts = new Map<string, number>();
const R = RAPIER.RigidBody.prototype as any, C = RAPIER.Collider.prototype as any;
for (const [proto, names] of [[R, ['setTranslation', 'setRotation', 'setLinvel', 'setAngvel', 'setNextKinematicTranslation', 'setNextKinematicRotation', 'wakeUp', 'sleep', 'setEnabled', 'setGravityScale', 'applyImpulse', 'addForce', 'resetForces', 'setBodyType', 'enableCcd', 'setLinearDamping', 'setAngularDamping', 'lockRotations']], [C, ['setCollisionGroups', 'setSensor', 'setFriction', 'setTranslationWrtParent']]] as const) {
  for (const n of names) { const f = proto[n]; if (!f) continue; proto[n] = function (...a: unknown[]) { counts.set(n, (counts.get(n) ?? 0) + 1); return f.apply(this, a); }; }
}
const level = uptown();
const sim = await Sim.create(level);
const at = (k: number) => { const s = level.checkpoints![k]; sim.teleport(s.pos[0], s.pos[1], s.yaw); };
const tally = (label: string, n = 300) => { counts.clear(); for (let i = 0; i < n; i++) sim.step({ throttle: 0, steer: 0, handbrake: true }); console.log(`${label}: ${[...counts].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / n).toFixed(1)}`).join(', ')}`); };
at(8); for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true }); tally('fresh');
at(7); for (let i = 0; i < 60 * 20; i++) sim.step({ throttle: 0.6, steer: Math.sin(i / 50) * 0.4, handbrake: false });
at(8); for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true }); tally('after');
process.exit(0);
