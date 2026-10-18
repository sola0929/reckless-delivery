// Level 3, building 2's lower floor: what has moved after a few seconds left alone. npx tsx dev/b2-settle.ts
import { LEVELS } from '../src/levels';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(LEVELS.quarry());
const at = new Map(sim.objects.objects.map((o) => [o, { ...o.body.translation() }]));
sim.teleport(18, 1468, -Math.PI / 2, 6);
for (const o of sim.objects.objects) o.body.wakeUp();
for (let k = 0; k < 240; k++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const moved: Record<string, string[]> = {};
for (const o of sim.objects.objects) {
  const a = at.get(o)!, b = o.body.translation();
  if (a.x < -17 || a.x > 15 || a.z < 1439 || a.z > 1501) continue;
  if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) > 0.2 || o.knocked) (moved[String((o as any).kind?.name ?? (o as any).kindId ?? "?")] ??= []).push(`${a.x.toFixed(1)},${a.y.toFixed(1)},${a.z.toFixed(1)}`);
}
console.log(JSON.stringify(moved, null, 1));
