// The avenue's coils for a minute with the truck halfway up: how many come down each pavement, and how many down the road.
// npx tsx dev/pavement-coils.ts
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create({ ...level, traffic: [], crowds: [], riders: [] });
const ax = (17.5 - 31) * 16;
sim.teleport(ax - 20, 16 * 60, 0);
const coils = sim.objects.objects.filter((o) => o.desc.kind === 'steelCoil' && o.desc.pos[1] < -50);
const seen = new Map<number, 'road' | 'pavement'>();
for (let i = 0; i < 60 * 60; i++) {
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  coils.forEach((c, k) => {
    const p = c.body.translation();
    if (p.y < 0 || Math.abs(p.z - 16 * 60) > 3) return;
    seen.set(k * 1000 + Math.floor(i / 600), Math.abs(p.x - ax) > 8 ? 'pavement' : 'road');
  });
}
const all = [...seen.values()];
console.log(`${coils.length} coils in the pool; past halfway in a minute: ${all.filter((v) => v === 'road').length} on the road, ${all.filter((v) => v === 'pavement').length} on the pavements`);
process.exit(0);
