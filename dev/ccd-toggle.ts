// After the coil avenue and a restart: does taking one object out of the world and putting it back mend the physics' slowness,
// or does the slowness come back with it? And does it ever mend by itself? npx tsx dev/ccd-toggle.ts
import RAPIER from '@dimforge/rapier3d-compat';
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create(level);
const world = (sim as unknown as { world: RAPIER.World }).world;
world.profilerEnabled = true;
const avenue = level.checkpoints![7];
sim.teleport(avenue.pos[0], avenue.pos[1], avenue.yaw);
for (let i = 0; i < 60 * 20; i++) sim.step({ throttle: 0.6, steer: Math.sin(i / 50) * 0.4, handbrake: false });
sim.reset();
const toi = (n = 60) => { let sum = 0; for (let i = 0; i < n; i++) { sim.step({ throttle: 0, steer: 0, handbrake: true }); sum += world.timingCcdToiComputation(); } return (sum / n).toFixed(2); };
console.log(`after the restart: ${toi()}`);
const one = sim.objects.objects.find((o) => o.desc.kind === 'bench' && o.body.isEnabled())!;
one.body.setEnabled(false);
console.log(`one bench out: ${toi()}`);
one.body.setEnabled(true);
console.log(`and back in: ${toi()}; a while later: ${toi(600)}`);
// Every body out of the world, a step, and back in: the physics' map of where things are made afresh.
const t0 = performance.now();
const was: RAPIER.RigidBody[] = [];
world.forEachRigidBody((b) => { if (b.isEnabled()) { was.push(b); b.setEnabled(false); } });
sim.step({ throttle: 0, steer: 0, handbrake: true });
for (const b of was) b.setEnabled(true);
sim.step({ throttle: 0, steer: 0, handbrake: true });
console.log(`all out and back in (${(performance.now() - t0).toFixed(0)} ms): ${toi()}; a while later: ${toi(600)}`);
process.exit(0);
