// The way down the hill, fresh, and after twenty seconds on the coil avenue without a restart: how much the avenue leaves
// the physics slower further on. npx tsx dev/after-avenue.ts
import RAPIER from '@dimforge/rapier3d-compat';
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const noHens = process.argv[2] === 'no-hens';
const sim = await Sim.create(noHens ? { ...level, objects: level.objects!.map((o) => (o.kind.startsWith('chicken') ? { ...o, pos: [o.pos[0], -200, o.pos[2]] as [number, number, number] } : o)) } : level);
const world = (sim as unknown as { world: RAPIER.World }).world;
let engine = 0;
const step = world.step.bind(world);
world.step = ((...args: Parameters<typeof world.step>) => { const t0 = performance.now(); step(...args); engine += performance.now() - t0; }) as typeof world.step;
const at = (k: number) => { const s = level.checkpoints![k]; sim.teleport(s.pos[0], s.pos[1], s.yaw); };
const time = () => { engine = 0; for (let i = 0; i < 300; i++) sim.step({ throttle: 0, steer: 0, handbrake: true }); return (engine / 300).toFixed(2); };
at(8); time();
const fresh = time();
at(7);
for (let i = 0; i < 60 * 20; i++) sim.step({ throttle: 0.6, steer: Math.sin(i / 50) * 0.4, handbrake: false });
at(8); time();
const slow = time();
// Refiled a slice at a time, a slice a step, skipping whatever has gone from the world meanwhile.
const handles: number[] = [];
world.forEachRigidBody((b) => { if (b.isEnabled()) handles.push(b.handle); });
const slices = Number(process.argv[3] ?? 60);
const per = Math.ceil(handles.length / slices);
const body = (h: number) => world.getRigidBody(h);
let worst = 0;
let back: { h: number; asleep: boolean }[] = [];
for (let k = 0; k <= slices; k++) {
  const t0 = performance.now();
  for (const { h, asleep } of back) { const b = body(h); if (b) { b.setEnabled(true); if (asleep) b.sleep(); } }
  back = [];
  if (k < slices) for (const h of handles.slice(k * per, (k + 1) * per)) { const b = body(h); if (b && b.isEnabled()) { back.push({ h, asleep: b.isSleeping() }); b.setEnabled(false); } }
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  worst = Math.max(worst, performance.now() - t0);
}
console.log(`${noHens ? 'without hens' : 'with hens'}: engine on the way down: ${fresh} ms a step fresh, ${slow} after the avenue, ${time()} after refiling in ${slices} slices (worst step meanwhile ${worst.toFixed(1)} ms)`);
process.exit(0);
