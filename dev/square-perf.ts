// Level 2 from a jump point at full throttle: Rapier's share of each step, the rest, and what is awake, second by second.
// npx tsx dev/square-perf.ts [jump point, 1-based]
import RAPIER from '@dimforge/rapier3d-compat';
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const k = Number(process.argv[2] ?? 3) - 1;
const level = uptown();
const sim = await Sim.create(level);
const world = (sim as unknown as { world: RAPIER.World }).world;
world.profilerEnabled = true;
const s = level.checkpoints![k];
sim.teleport(s.pos[0], s.pos[1], s.yaw);
for (let i = 0; i < 30; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const kindOf = new Map(sim.objects.objects.map((o) => [o.body.handle, o.desc.kind]));
for (let sec = 0; sec < 6; sec++) {
  let all = 0, rapier = 0, worst = 0;
  for (let i = 0; i < 60; i++) { const t0 = performance.now(); sim.step({ throttle: 1, steer: 0, handbrake: false }); const ms = performance.now() - t0; all += ms; worst = Math.max(worst, ms); rapier += world.timingStep(); }
  const kinds = new Map<string, number>(); let awake = 0;
  world.forEachRigidBody((b) => { if (!b.isEnabled() || b.isFixed() || b.isSleeping() || b.isKinematic()) return; awake++; const n = kindOf.get(b.handle) ?? 'other'; kinds.set(n, (kinds.get(n) ?? 0) + 1); });
  const t = sim.truck.body.translation();
  console.log(`${sec}s at ${t.x.toFixed(0)},${t.z.toFixed(0)}: ${(all / 60).toFixed(1)} ms (rapier ${(rapier / 60).toFixed(1)}), worst ${worst.toFixed(0)}; awake dynamic ${awake}: ${[...kinds].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, c]) => `${n}×${c}`).join(' ')}`);
}
process.exit(0);
