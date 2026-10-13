// Level 3's ponds: a pallet afloat, put in across the current, comes round to lie with its long side along it.
// npx tsx dev/float-turn.ts
import { quarry } from '../src/levels/quarry';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create({ ...quarry(), crowds: [] });
sim.teleport(80, 600, 0);
const o = sim.objects.objects.find((x) => x.desc.kind === 'pallet' && x.desc.pos[2] > 600)!;
o.knocked = true;
o.body.setTranslation({ x: 68, y: 4, z: 650 }, true);
let line = '';
for (let s = 0; s <= 60 * 20; s++) {
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  if (s % 120 === 0) {
    const r = o.body.rotation(), v = o.body.linvel();
    const ax = 1 - 2 * (r.y * r.y + r.z * r.z), az = 2 * (r.x * r.z - r.w * r.y);
    let off = Math.atan2(v.x, v.z) - Math.atan2(ax, az);
    off = ((((off + Math.PI / 2) % Math.PI) + Math.PI) % Math.PI) - Math.PI / 2;
    line += `${s / 60}s ${Math.round((off * 180) / Math.PI)}deg  `;
  }
}
console.log('long side off the current:', line);
process.exit(0);
