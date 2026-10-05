// After the coil avenue and a restart, which loose objects the physics keeps spending its swept-collision time on: found by
// switching ranges of them off and halving. npx tsx dev/ccd-culprits.ts
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
for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const toi = () => { let sum = 0; for (let i = 0; i < 20; i++) { sim.step({ throttle: 0, steer: 0, handbrake: true }); sum += world.timingCcdToiComputation(); } return sum / 20; };
const objects = sim.objects.objects.filter((o) => o.body.isEnabled());
const base = toi();
console.log(`ccd time ${base.toFixed(2)} ms with ${objects.length} objects in`);
const found: typeof objects = [];
const search = (lo: number, hi: number) => {
  const some = objects.slice(lo, hi);
  some.forEach((o) => o.body.setEnabled(false));
  const without = toi();
  some.forEach((o) => o.body.setEnabled(true));
  if (base - without < base * 0.15) return;
  if (hi - lo <= 1) { found.push(objects[lo]); console.log(`  ${objects[lo].desc.kind} at ${objects[lo].desc.pos.map((v) => v.toFixed(0)).join(',')}: ${(base - without).toFixed(2)} ms`); return; }
  const mid = (lo + hi) >> 1;
  search(lo, mid);
  search(mid, hi);
};
search(0, objects.length);
console.log(`${found.length} found`);
process.exit(0);
