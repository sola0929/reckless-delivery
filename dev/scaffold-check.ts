// Knock the bottom of the scaffold by the path and see whether all of it comes down, and where. npx tsx dev/scaffold-check.ts
import { LEVELS } from '../src/levels/index';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(LEVELS.uptown());
const pieces = sim.objects.objects.filter((o) => o.kind.collapse);
const first = pieces[0];
for (let i = 0; i < 30; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
first.near = true;
first.body.wakeUp();
first.body.setLinvel({ x: 0, y: 0, z: 4 }, true);
let worst = 0;
const began = performance.now();
for (let i = 0; i < 60 * 5; i++) { const t0 = performance.now(); sim.step({ throttle: 0, steer: 0, handbrake: true }); worst = Math.max(worst, performance.now() - t0); }
console.log(`step: ${((performance.now() - began) / 300).toFixed(1)} ms on average, ${worst.toFixed(1)} ms at worst`);
const moved = pieces.filter((o) => { const p = o.body.translation(); const [x, y, z] = o.desc.pos; return Math.hypot(p.x - x, p.y - y, p.z - z) > 0.5; });
const tops = pieces.map((o) => o.body.translation().y - o.desc.pos[1]);
const out = pieces.map((o) => o.body.translation().z - o.desc.pos[2]);
console.log(`${pieces.length} pieces, ${pieces.filter((o) => o.knocked).length} knocked, ${moved.length} moved`);
console.log(`dropped: up to ${(-Math.min(...tops)).toFixed(1)} m; thrown along z (forward is +): ${Math.min(...out).toFixed(1)} to ${Math.max(...out).toFixed(1)} m`);
process.exit(0);
