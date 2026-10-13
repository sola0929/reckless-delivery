// Level 3's ball cranes, once settled (after 8 s): how low each ball's middle comes above its crane's feet and how far out
// from the crane it goes round, and how high its middle is over the dike's road. On the first, low jib: low 5.24 / 5.37 /
// 5.12 / 5.50, out 10.0 / 10.2 / 9.9 / 10.3, over the road about 3.0-3.6. Now: over the road 2.0-2.8, out the same.
// npx tsx dev/ball-path.ts
import { quarry } from '../src/levels/quarry';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create({ ...quarry(), crowds: [] });
sim.teleport(80, 640, 0);
const balls = sim.rigs.list.filter((r) => r.desc.kind === 'ball');
const lows = balls.map(() => 99), rs = balls.map(() => [99, 0]), over = balls.map(() => [] as number[]);
for (let s = 0; s < 60 * 25; s++) {
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  if (s < 60 * 8) continue;
  balls.forEach((rig, i) => {
    const p = rig.parts[2].body.translation(), [cx, cy, cz] = rig.desc.pos;
    lows[i] = Math.min(lows[i], p.y - cy);
    const r = Math.hypot(p.x - cx, p.z - cz);
    rs[i] = [Math.min(rs[i][0], r), Math.max(rs[i][1], r)];
    // Over the road on the dike (its middle at x 77.5 there, 6.5 m wide, its top at 6.2): the ball's middle above the road.
    if (Math.abs(p.x - 77.5) < 3.25 && Math.abs(p.z - cz) < 5) over[i].push(p.y - 6.2);
  });
}
console.log(balls.map((_, i) => `low ${lows[i].toFixed(2)} out ${rs[i][0].toFixed(1)}-${rs[i][1].toFixed(1)} over road ${over[i].length ? Math.min(...over[i]).toFixed(2) + '..' + Math.max(...over[i]).toFixed(2) : '-'}`).join(' | '));
process.exit(0);
