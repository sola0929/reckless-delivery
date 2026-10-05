// The hens left alone for twenty seconds: how far each has wandered from where she was put, and that none has gone off on her
// own, fallen through the ground, or been put up with nothing near. npx tsx dev/hens-check.ts
import { uptown } from '../src/levels/uptown';
import { heightAt } from '../src/levels/terrain';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create({ ...level, traffic: [], riders: [], machines: [] });
const hens = sim.objects.objects.filter((o) => o.kind.wanders);
let walked = 0;
for (let i = 0; i < 60 * 20; i++) {
  const before = hens.map((h) => ({ ...h.body.translation() }));
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  hens.forEach((h, k) => (walked += Math.hypot(h.body.translation().x - before[k].x, h.body.translation().z - before[k].z)));
}
const off = hens.map((h) => Math.hypot(h.body.translation().x - h.desc.pos[0], h.body.translation().z - h.desc.pos[2]));
const low = Math.min(...hens.map((h) => h.body.translation().y - heightAt(level.terrain!, h.body.translation().x, h.body.translation().z)));
console.log(`${hens.length} hens: walked ${(walked / hens.length).toFixed(1)} m each on average in 20 s; now 0-${Math.max(...off).toFixed(1)} m from home; lowest ${low.toFixed(2)} m above the ground; ${hens.filter((h) => h.knocked).length} put up`);
process.exit(0);
