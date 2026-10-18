// Level 3's handrails: every one woken and left alone for 4 s; which move, and where they end up. npx tsx dev/rails-settle.ts
import { LEVELS } from '../src/levels';
import { Sim } from '../src/sim/sim';
const L = LEVELS.quarry();
const sim = await Sim.create(L);
const rails = sim.objects.objects.filter((o) => o.desc.kind === 'handrail' && o.desc.pos[2] > 1380);
const list = rails.length ? rails : sim.objects.objects;
const at = new Map(list.map((o) => [o, { ...o.body.translation() }]));
for (const o of list) o.body.wakeUp();
for (let k = 0; k < 240; k++) sim.step({ throttle: 0, steer: 0, handbrake: true });
let n = 0;
for (const o of list) {
  const a = at.get(o)!, b = o.body.translation();
  if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) > 0.15) { n++; console.log(a.x.toFixed(1), a.y.toFixed(1), a.z.toFixed(1), '->', b.x.toFixed(1), b.y.toFixed(2), b.z.toFixed(1)); }
}
console.log('rails', rails.length, 'moved', n);
