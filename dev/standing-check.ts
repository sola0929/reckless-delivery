// Do the loose things of a level stay standing where they were put, before anything has touched them? npx tsx dev/standing-check.ts
import { city } from '../src/levels/city';
import { hills } from '../src/levels/hills';
import { hilltown } from '../src/levels/hilltown';
import { Sim } from '../src/sim/sim';

for (const [name, level] of [['city', city()], ['hills', hills()], ['hilltown', hilltown()]] as const) {
  const sim = await Sim.create(level);
  for (let i = 0; i < 180; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  let awake = 0, moved = 0;
  const kinds = new Map<string, number>();
  for (const object of sim.objects.objects) {
    const p = object.body.translation();
    const r = object.body.rotation();
    const [x, y, z] = object.desc.pos;
    // Upright is no turn about X or Z.
    const tipped = Math.abs(r.x) > 0.03 || Math.abs(r.z) > 0.03;
    const shifted = Math.hypot(p.x - x, p.y - y, p.z - z) > 0.1;
    if (!object.body.isSleeping()) awake++;
    if (tipped || shifted) {
      moved++;
      kinds.set(object.desc.kind, (kinds.get(object.desc.kind) ?? 0) + 1);
    }
  }
  console.log(`${name}: ${sim.objects.objects.length} things, ${awake} awake after 3 s, ${moved} no longer as they were put${moved ? ` (${[...kinds].map(([k, n]) => `${k} ${n}`).join(', ')})` : ''}`);
}
process.exit(0);
