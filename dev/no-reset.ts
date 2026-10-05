// The coil avenue for twenty seconds, then back to the start without a restart: is the physics slower there anyway?
// npx tsx dev/no-reset.ts
import RAPIER from '@dimforge/rapier3d-compat';
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create(level);
const world = (sim as unknown as { world: RAPIER.World }).world;
let engine = 0;
const step = world.step.bind(world);
world.step = ((...args: Parameters<typeof world.step>) => { const t0 = performance.now(); step(...args); engine += performance.now() - t0; }) as typeof world.step;
const census = () => {
  let pairs = 0, touching = 0;
  const kinds = new Map<string, number>();
  world.forEachCollider((c) => {
    world.contactPairsWith(c, (other) => {
      pairs++;
      world.contactPair(c, other, (m) => { if (m.numContacts() > 0) touching++; });
      const b = c.parent();
      const what = b?.isFixed() ? 'fixed' : b?.isKinematic() ? 'kinematic' : b?.isSleeping() ? 'asleep' : 'awake';
      kinds.set(what, (kinds.get(what) ?? 0) + 1);
    });
  });
  let awakeDyn = 0, awakeKin = 0;
  world.forEachRigidBody((b) => { if (!b.isSleeping()) { if (b.isDynamic()) awakeDyn++; else if (b.isKinematic()) awakeKin++; } });
  return `${pairs / 2} contact pairs (${touching / 2} touching) [${[...kinds].map(([k, n]) => `${k} ${n}`).join(', ')}]; awake ${awakeDyn} dynamic, ${awakeKin} kinematic`;
};
world.profilerEnabled = true;
const stages = ['timingStep', 'timingCollisionDetection', 'timingBroadPhase', 'timingNarrowPhase', 'timingSolver', 'timingVelocityAssembly', 'timingVelocityResolution', 'timingVelocityUpdate', 'timingVelocityWriteback', 'timingCcd', 'timingCcdToiComputation', 'timingCcdBroadPhase', 'timingCcdNarrowPhase', 'timingCcdSolver', 'timingIslandConstruction', 'timingUserChanges'] as const;
let sums: Record<string, number> = {};
const time = () => {
  engine = 0;
  sums = {};
  for (let i = 0; i < 300; i++) {
    sim.step({ throttle: 0, steer: 0, handbrake: true });
    for (const k of stages) sums[k] = (sums[k] ?? 0) + ((world as unknown as Record<string, () => number>)[k]?.call(world) ?? 0);
  }
  return `${(engine / 300).toFixed(2)} [${stages.map((k) => `${k.replace('timing', '')} ${(sums[k] / 300).toFixed(2)}`).join(', ')}]`;
};
time();
const fresh = time();
console.log(`fresh: ${census()}`);
const avenue = level.checkpoints![7];
sim.teleport(avenue.pos[0], avenue.pos[1], avenue.yaw);
for (let i = 0; i < 60 * 20; i++) sim.step({ throttle: 0.6, steer: Math.sin(i / 50) * 0.4, handbrake: false });
const start = level.checkpoints![0];
if (process.argv[2] === 'reset') sim.reset();
else sim.teleport(start.pos[0], start.pos[1], start.yaw);
time();
console.log(`after: ${census()}`);
const after = time();
const ccd: string[] = [];
const kindOf = new Map(sim.objects.objects.map((o) => [o.body.handle, o.desc.kind]));
world.forEachRigidBody((b) => {
  if (!b.isCcdEnabled()) return;
  const p = b.translation();
  ccd.push(`${b.handle === sim.truck.body.handle ? 'truck' : kindOf.get(b.handle) ?? (b.isKinematic() ? 'kinematic' : 'other')}${b.isEnabled() ? '' : ' (disabled)'}${b.isSleeping() ? ' asleep' : ''} at ${p.x.toFixed(0)},${p.y.toFixed(0)},${p.z.toFixed(0)}`);
});
console.log(`with CCD on: ${ccd.length}: ${ccd.join(' | ')}`);
const toi = () => { let sum = 0; for (let i = 0; i < 120; i++) { sim.step({ throttle: 0, steer: 0, handbrake: true }); sum += world.timingCcdToiComputation(); } return (sum / 120).toFixed(2); };
console.log(`ccd time now ${toi()}`);
let n = 0;
world.forEachRigidBody((b) => { if (b.isKinematic() && b.isEnabled()) { b.setEnabled(false); n++; } });
console.log(`with ${n} kinematic bodies switched off: ccd time ${toi()}`);
const cargoBodies = new Set(sim.cargo.filter((c) => c.body).map((c) => c.body!.handle));
let off = 0;
const coilsSet = new Set(sim.objects.objects.filter((o) => o.desc.kind === 'steelCoil' && o.desc.pos[1] < -50).map((o) => o.body.handle));
// The coils, waiting out of the world: put back in for a step and taken out again.
world.forEachRigidBody((b) => { if (coilsSet.has(b.handle)) b.setEnabled(true); });
console.log(`coils put back in the world: ccd time ${toi()}`);
world.forEachRigidBody((b) => { if (coilsSet.has(b.handle)) b.setEnabled(false); });
console.log(`and out again: ccd time ${toi()}`);
world.forEachRigidBody((b) => { if (b.isDynamic() && b.isEnabled() && b.handle !== sim.truck.body.handle && !cargoBodies.has(b.handle)) { b.setEnabled(false); off++; } });
console.log(`with ${off} loose objects switched off too: ccd time ${toi()}`);
let fastest = 0, lowest = 0;
world.forEachRigidBody((b) => { if (!b.isDynamic() || !b.isEnabled()) return; const v = b.linvel(); fastest = Math.max(fastest, Math.hypot(v.x, v.y, v.z)); lowest = Math.min(lowest, b.translation().y); });
console.log(`fastest dynamic body ${fastest.toFixed(1)} m/s; lowest at y ${lowest.toFixed(0)}`);
console.log(`engine at the start: ${fresh} fresh; ${after} after the avenue`);

process.exit(0);
