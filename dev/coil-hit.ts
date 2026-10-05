// A truck driven fast up level 2's avenue into the coils: whether any passes into or through it. npx tsx dev/coil-hit.ts
import { uptown } from '../src/levels/uptown';
import { heightAt } from '../src/levels/terrain';
import { Sim } from '../src/sim/sim';
const level = { ...uptown(), traffic: [], crowds: [], riders: [] };
const sim = await Sim.create(level);
const x = -216 - 1.75, z0 = 850;
sim.truck.body.setTranslation({ x, y: heightAt(level.terrain, x, z0) + 1, z: z0 }, true);
const coils = sim.objects.objects.filter((o) => o.desc.kind === 'steelCoil');
let inside = 0, hits = 0, through = 0;
const ahead = new Map<unknown, boolean>();
for (let i = 0; i < 60 * 25; i++) {
  sim.step({ throttle: 1, steer: 0, handbrake: false, boost: true } as never);
  const t = sim.truck.body.translation(); const r = sim.truck.body.rotation();
  const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
  for (const c of coils) {
    const p = c.body.translation();
    if (p.y < -20) continue;
    const along = (p.x - t.x) * fx + (p.z - t.z) * fz, across = Math.abs((p.x - t.x) * fz - (p.z - t.z) * fx);
    if (across < 1.3 && Math.abs(along) < 3.5 && Math.abs(p.y - t.y) < 1.5) inside++;
    const was = ahead.get(c);
    if (across < 1.3 && Math.abs(p.y - t.y) < 2) { if (was === true && along < -4) through++; ahead.set(c, along > 0); }
    if (!c.rolling && c.knocked) hits++;
  }
  if (t.z > 1000) break;
}
console.log(`fast up the avenue: steps with a coil inside the truck ${inside}, coils passed through ${through}, truck reached z ${sim.truck.body.translation().z.toFixed(0)} at ${(sim.truck.forwardSpeed() * 3.6).toFixed(0)} km/h, load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%`);
process.exit(0);
