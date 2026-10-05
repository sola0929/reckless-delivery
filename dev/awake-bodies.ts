// After a few seconds at a jump point: which bodies the physics is keeping awake, by what they are. npx tsx dev/awake-bodies.ts [jump]
import RAPIER from '@dimforge/rapier3d-compat';
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create(level);
const world = (sim as unknown as { world: RAPIER.World }).world;
const k = Number(process.argv[2] ?? 1) - 1;
const spot = level.checkpoints![k];
sim.teleport(spot.pos[0], spot.pos[1], spot.yaw);
for (let i = 0; i < 300; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const objects = new Map(sim.objects.objects.map((o) => [o.body.handle, o.desc.kind]));
const cargo = new Set(sim.cargo.filter((c) => c.body).map((c) => c.body!.handle));
const counts = new Map<string, number>();
let dynamic = 0, kinematic = 0, colliders = 0;
world.forEachRigidBody((b) => {
  if (b.isKinematic()) { kinematic++; if (!b.isSleeping()) counts.set('kinematic (awake)', (counts.get('kinematic (awake)') ?? 0) + 1); return; }
  if (!b.isDynamic()) return;
  dynamic++;
  if (b.isSleeping()) return;
  const what = b.handle === sim.truck.body.handle ? 'truck' : cargo.has(b.handle) ? 'cargo' : objects.get(b.handle) ?? 'other';
  counts.set(what, (counts.get(what) ?? 0) + 1);
});
world.forEachCollider(() => colliders++);
console.log(`${spot.name}: ${dynamic} dynamic bodies, ${kinematic} kinematic, ${colliders} colliders. Awake:`);
console.log([...counts].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w} ${n}`).join(', '));
process.exit(0);
