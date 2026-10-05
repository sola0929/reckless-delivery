// Level 2: down the steps and through the temple square at full throttle, twice over: how long the physics takes, and how many
// loose pieces of the load there are by the end. npx tsx dev/soda-bench.ts
import RAPIER from '@dimforge/rapier3d-compat';
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create(level);
const world = (sim as unknown as { world: RAPIER.World }).world;
world.profilerEnabled = true;
const cargo = (sim as unknown as { cargoSystem: { debris: { body: RAPIER.RigidBody }[] } }).cargoSystem;
let rapier = 0, all = 0, worst = 0, n = 0;
for (const k of [1, 2, 1, 2]) {
  const s = level.checkpoints![k];
  sim.teleport(s.pos[0], s.pos[1], s.yaw);
  for (let i = 0; i < 360; i++) {
    const t0 = performance.now();
    sim.step({ throttle: 1, steer: Math.sin(i / 40) * 0.3, handbrake: false });
    const ms = performance.now() - t0;
    all += ms; worst = Math.max(worst, ms); rapier += world.timingStep(); n++;
    if (ms > 25) console.log(`  slow step: point ${k + 1}, step ${i}, ${ms.toFixed(0)} ms (rapier ${world.timingStep().toFixed(0)}), pieces ${cargo.debris.length}`);
  }
}
const loose = cargo.debris.filter((d) => d.body.isEnabled());
console.log(`${(all / n).toFixed(2)} ms a step (rapier ${(rapier / n).toFixed(2)}), worst ${worst.toFixed(1)}; pieces ${cargo.debris.length}, still in the physics ${loose.length}, awake ${loose.filter((d) => !d.body.isSleeping()).length}`);
process.exit(0);
