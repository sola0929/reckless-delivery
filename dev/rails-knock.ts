// Level 3's handrails: one on each floor's west edge knocked as a truck would; what goes with it, and where they come to rest.
import { LEVELS } from '../src/levels';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(LEVELS.quarry());
const rails = sim.objects.objects.filter((o) => o.desc.kind === 'handrail' && o.desc.pos[2] > 1380);
const at = new Map(rails.map((o) => [o, { ...o.body.translation() }]));
for (const y of [6, 10.5]) {
  const r = rails.find((o) => Math.abs(o.desc.pos[0] + 15.2) < 0.1 && Math.abs(o.desc.pos[1] - y) < 0.1 && Math.abs(o.desc.pos[2] - 1470) < 1.3)!;
  r.body.wakeUp(); r.body.setLinvel({ x: -4, y: 1, z: 2 }, true);
}
for (let k = 0; k < 360; k++) sim.step({ throttle: 0, steer: 0, handbrake: true });
for (const o of rails) {
  const a = at.get(o)!, b = o.body.translation();
  if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) > 0.15) console.log(a.x.toFixed(1), a.y.toFixed(1), a.z.toFixed(1), '->', b.x.toFixed(1), b.y.toFixed(2), b.z.toFixed(1), 'sleep', o.body.isSleeping());
}
