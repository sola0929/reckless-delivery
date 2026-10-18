// Level 3: the truck driven into a building's edge rails on either floor; which go, and where they end. npx tsx dev/rails-ram.ts
import { LEVELS } from '../src/levels';
import { Sim } from '../src/sim/sim';
for (const [y, x, z, yaw] of [[10.5, -6, 1470, -1.2], [6, -6, 1470, -1.2], [10.5, 8, 1446, -2.6]] as const) {
  const sim = await Sim.create(LEVELS.quarry());
  const rails = sim.objects.objects.filter((o) => o.desc.kind === 'handrail' && o.desc.pos[2] > 1380);
  const at = new Map(rails.map((o) => [o, { ...o.body.translation() }]));
  sim.teleport(x, z, yaw, y);
  for (let k = 0; k < 30; k++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  for (let k = 0; k < 120; k++) sim.step({ throttle: 0.6, steer: 0, handbrake: false });
  for (let k = 0; k < 240; k++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const t = sim.truck.body.translation();
  console.log('--- floor', y, 'truck at', t.x.toFixed(1), t.y.toFixed(1), t.z.toFixed(1));
  for (const o of rails) {
    const a = at.get(o)!, b = o.body.translation();
    if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) > 0.15) console.log(' ', a.x.toFixed(1), a.y.toFixed(1), a.z.toFixed(1), '->', b.x.toFixed(1), b.y.toFixed(2), b.z.toFixed(1));
  }
}
