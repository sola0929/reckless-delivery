// Knock the scaffold down, start again, and see that all of it is back up. npx tsx dev/scaffold-reset.ts
import { LEVELS } from '../src/levels/index';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(LEVELS.uptown());
const pieces = sim.objects.objects.filter((o) => o.kind.collapse);
const out = () => pieces.filter((o) => { const p = o.body.translation(); const [x, y, z] = o.desc.pos; return Math.hypot(p.x - x, p.y - y, p.z - z) > 0.05; });
for (let i = 0; i < 30; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
pieces[0].near = true;
pieces[0].body.wakeUp();
pieces[0].body.setLinvel({ x: 0, y: 0, z: 4 }, true);
for (let i = 0; i < 60 * 8; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
console.log(`down: ${out().length} of ${pieces.length} out of place, ${pieces.filter((o) => o.knocked).length} knocked, ${pieces.filter((o) => !o.knocked && o.body.isSleeping() && out().includes(o)).length} out of place but neither knocked nor awake`);
sim.reset();
console.log(`after reset: ${out().length} out of place`);
for (let i = 0; i < 60 * 3; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
console.log(`3 s later: ${out().length} out of place, ${pieces.filter((o) => o.knocked).length} knocked`);
// Again, but started again while it is still coming down.
pieces[0].near = true;
pieces[0].body.wakeUp();
pieces[0].body.setLinvel({ x: 0, y: 0, z: 4 }, true);
for (let i = 0; i < 12; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
sim.reset();
for (let i = 0; i < 60 * 5; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
console.log(`started again mid-fall, 5 s later: ${out().length} out of place, ${pieces.filter((o) => o.knocked).length} knocked`);
// And driven into by the truck, the way it is in play.
const [, fy, fz] = pieces[0].desc.pos;
const mid = pieces.reduce((sum, o) => sum + o.desc.pos[0], 0) / pieces.length;
sim.truck.body.setTranslation({ x: mid, y: fy + 1.2, z: fz - 14 }, true);
sim.truck.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
for (let i = 0; i < 60 * 6; i++) sim.step({ throttle: 0.8, steer: 0, handbrake: false });
console.log(`driven into: ${out().length} out of place, ${pieces.filter((o) => o.knocked).length} knocked`);
sim.reset();
for (let i = 0; i < 60 * 5; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const left = out();
console.log(`started again, 5 s later: ${left.length} out of place, ${pieces.filter((o) => o.knocked).length} knocked; near ${pieces.filter((o) => o.near).length}`);
process.exit(0);
