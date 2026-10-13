// Level 3's ponds: a pallet and a cone thrown into the water either side of the dike float off toward where the water
// goes out; a sandbag sinks. npx tsx dev/float-test.ts
import { quarry } from '../src/levels/quarry';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create({ ...quarry(), crowds: [] });
sim.teleport(80, 600, 0);
const pick = (kind: string) => sim.objects.objects.find((o) => o.desc.kind === kind && o.desc.pos[2] > 600)!;
const throws: [string, number, number][] = [['pallet', 66, 650], ['cone', 96, 640], ['sandbag', 68, 620]];
const got = throws.map(([kind, x, z]) => {
  const o = pick(kind);
  o.knocked = true;
  o.body.setTranslation({ x, y: 5, z }, true);
  o.body.setLinvel({ x: 0, y: -2, z: 0 }, true);
  return o;
});
for (let s = 0; s <= 60 * 40; s++) {
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  if (s % (60 * 10) === 0) console.log(`${s / 60}s ` + got.map((o, i) => { const p = o.body.translation(); return `${throws[i][0]} ${p.x.toFixed(1)},${p.y.toFixed(2)},${p.z.toFixed(1)}${o.body.isEnabled() ? '' : ' gone'}`; }).join(' | '));
}
console.log('splashes', JSON.stringify(sim.drainSplashes().map((s) => [Math.round(s.x), Math.round(s.z), Math.round(s.mass)])));
process.exit(0);
