// After the coil avenue: does the physics' slowness wear off by itself while the truck waits on the descent?
import RAPIER from '@dimforge/rapier3d-compat';
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create(level);
const world = (sim as unknown as { world: RAPIER.World }).world;
world.profilerEnabled = true;
const at = (k: number) => { const s = level.checkpoints![k]; sim.teleport(s.pos[0], s.pos[1], s.yaw); };
const toi = (n = 120) => { let sum = 0, eng = 0; for (let i = 0; i < n; i++) { const t0 = performance.now(); sim.step({ throttle: 0, steer: 0, handbrake: true }); eng += performance.now() - t0; sum += world.timingCcdToiComputation(); } return `${(eng / n).toFixed(2)} (ccd ${(sum / n).toFixed(2)})`; };
at(8); console.log(`fresh: ${[0, 1, 2, 3].map(() => toi(300)).join('  ')}`);
at(7);
for (let i = 0; i < 60 * 20; i++) sim.step({ throttle: 0.6, steer: Math.sin(i / 50) * 0.4, handbrake: false });
at(8); console.log(`after, every 5 s: ${[0, 1, 2, 3, 4, 5].map(() => toi(300)).join('  ')}`);
process.exit(0);
