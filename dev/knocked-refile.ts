// After the coil avenue: refile only what has moved a long way (thrown objects, coils, cars), all at once. Does that mend the
// physics' slowness, and how long does it take? npx tsx dev/knocked-refile.ts
import RAPIER from '@dimforge/rapier3d-compat';
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create(level);
const world = (sim as unknown as { world: RAPIER.World }).world;
world.profilerEnabled = true;
const at = (k: number) => { const s = level.checkpoints![k]; sim.teleport(s.pos[0], s.pos[1], s.yaw); };
const toi = (n = 120) => { let sum = 0, eng = 0; for (let i = 0; i < n; i++) { const t0 = performance.now(); sim.step({ throttle: 0, steer: 0, handbrake: true }); eng += performance.now() - t0; sum += world.timingCcdToiComputation(); } return `${(eng / n).toFixed(2)} ms a step (ccd ${(sum / n).toFixed(2)})`; };
at(8);
console.log(`fresh on the way down: ${toi()}`);
at(7);
for (let i = 0; i < 60 * 20; i++) sim.step({ throttle: 0.6, steer: Math.sin(i / 50) * 0.4, handbrake: false });
at(8);
console.log(`after the avenue: ${toi()}`);
const far = sim.objects.objects.filter((o) => o.body.isEnabled() && Math.hypot(o.body.translation().x - o.desc.pos[0], o.body.translation().z - o.desc.pos[2]) > 5);
console.log(`objects more than 5 m from where they were put: ${far.length} (${[...new Set(far.map((o) => o.desc.kind))].join(', ')})`);
const t0 = performance.now();
const back = far.map((o) => ({ b: o.body, asleep: o.body.isSleeping() }));
for (const { b } of back) b.setEnabled(false);
world.step();
for (const { b, asleep } of back) { b.setEnabled(true); if (asleep) b.sleep(); }
console.log(`refiled just those (${(performance.now() - t0).toFixed(1)} ms): ${toi()}`);
// And then everything, for comparison.
const all: { b: RAPIER.RigidBody; asleep: boolean }[] = [];
world.forEachRigidBody((b) => { if (b.isEnabled()) all.push({ b, asleep: b.isSleeping() }); });
for (const { b } of all) b.setEnabled(false);
world.step();
for (const { b, asleep } of all) { b.setEnabled(true); if (asleep) b.sleep(); }
console.log(`refiled everything: ${toi()}`);
process.exit(0);
