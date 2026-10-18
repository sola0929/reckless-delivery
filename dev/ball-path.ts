// Level 3's demolition balls: for the one nearest the island's stones, over 20 s, how close and how high the ball comes to
// the dike's edge by the stones and to each stone. npx tsx dev/ball-path.ts
import { LEVELS } from '../src/levels';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(LEVELS.quarry());
sim.teleport(79.5, 745, Math.PI);
for (let k = 0; k < 30; k++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const balls = sim.rigs.list.filter((r) => r.desc.kind === 'ball');
const rig = balls.sort((a, b) => Math.abs(a.parts[2].body.translation().z - 722) - Math.abs(b.parts[2].body.translation().z - 722))[0];
console.log('balls', balls.length, 'nearest at', JSON.stringify(rig.desc.pos ?? rig.desc));
const spots: [string, number, number, number][] = [['edge', 82.8, 722.2, 6.0], ['s1', 84.4, 722.2, 5.5], ['s2', 87.6, 721.6, 4.95], ['s3', 90.8, 722.4, 4.45], ['dike', 80, 722, 6.2]];
const best = new Map<string, [number, number]>();
for (let k = 0; k < 60 * 20; k++) {
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  const b = rig.parts[2].body.translation();
  for (const [name, x, z, y] of spots) {
    const flat = Math.hypot(b.x - x, b.z - z);
    const cur = best.get(name);
    if (!cur || flat < cur[0]) best.set(name, [flat, b.y - (y + 0.85)]);
  }
}
for (const [name, [flat, dy]] of best) console.log(name, 'closest across', flat.toFixed(2), 'ball centre above their middle', dy.toFixed(2));
