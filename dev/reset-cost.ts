// A run, then a restart: is a step at the start as cheap after it as it was fresh, and what is left awake? npx tsx dev/reset-cost.ts
import RAPIER from '@dimforge/rapier3d-compat';
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create(level);
const world = (sim as unknown as { world: RAPIER.World }).world;
// The physics engine's own step, timed apart from the rest.
let engine = 0;
const step = world.step.bind(world);
world.step = ((...args: Parameters<typeof world.step>) => { const t0 = performance.now(); step(...args); engine += performance.now() - t0; }) as typeof world.step;
const time = (label: string) => {
  let total = 0, worst = 0;
  engine = 0;
  for (let i = 0; i < 600; i++) {
    const t0 = performance.now();
    sim.step({ throttle: 0, steer: 0, handbrake: true });
    const ms = performance.now() - t0;
    total += ms;
    worst = Math.max(worst, ms);
  }
  let awake = 0, dynamicAwake = 0;
  world.forEachRigidBody((b) => { if (!b.isSleeping() && !b.isFixed()) { awake++; if (b.isDynamic()) dynamicAwake++; } });
  console.log(`${label}: ${(total / 600).toFixed(2)} ms a step (engine ${(engine / 600).toFixed(2)}), ${worst.toFixed(1)} at worst; ${awake} bodies awake (${dynamicAwake} dynamic); ${world.colliders.len()} colliders, ${world.bodies.len()} bodies`);
};
time('fresh, standing at the start');
// A run: to each jump point in turn, driving hard into whatever is there.
for (const spot of level.checkpoints!) {
  sim.teleport(spot.pos[0], spot.pos[1], spot.yaw);
  for (let i = 0; i < 60 * 6; i++) sim.step({ throttle: 1, steer: Math.sin(i / 40) * 0.6, handbrake: false });
}
sim.reset();
time('restarted, standing at the start');
let ccd = 0;
world.forEachRigidBody((b) => { if (b.isCcdEnabled()) ccd++; });
console.log(`bodies with CCD on: ${ccd}`);
world.forEachRigidBody((b) => { if (b.isCcdEnabled() && b.handle !== sim.truck.body.handle) b.enableCcd(false); });
time('restarted, CCD off on all but the truck');
sim.reset();
time('restarted again');
process.exit(0);
