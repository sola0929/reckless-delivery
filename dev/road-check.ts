// The road from the lane to the avenue: movers going to and fro, children crossing in waves, the van standing, the manholes
// blowing once the truck comes near. npx tsx dev/road-check.ts
import { LEVELS } from '../src/levels/index';
import { Sim } from '../src/sim/sim';
const level = LEVELS.uptown();
const sim = await Sim.create(level);
const movers = sim.riders.list.filter((r) => r.kind === 'movers');
const kids = sim.pedestrians.list.filter((p) => p.crowd.waves);
const van = sim.traffic.cars.find((c) => c.kind === 'van')!;
const vanAt = { ...van.body.translation() };
const was = movers.map((r) => ({ ...r.body.translation() }));
let spouts = 0;
let most = 0;
for (let i = 0; i < 60 * 40; i++) {
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  most = Math.max(most, sim.pedestrians.inRoad().filter((p) => p.crowd.waves).length);
  if (i % 600 === 0) console.log(`${i / 60}s: children in the road ${sim.pedestrians.inRoad().filter((p) => p.crowd.waves).length} of ${kids.length}; movers at ${movers.map((r) => r.body.translation().z.toFixed(1)).join(', ')}`);
}
console.log(`most children in the road at once: ${most}; movers moved ${movers.map((r, k) => Math.hypot(r.body.translation().x - was[k].x, r.body.translation().z - was[k].z).toFixed(1)).join(', ')} m`);
const v = van.body.translation();
console.log(`van: ${Math.hypot(v.x - vanAt.x, v.z - vanAt.z).toFixed(2)} m from where it was parked`);
// Bring the truck to the burst main.
const cover = sim.objects.objects[level.manholes![0].cover];
const [cx, cy, cz] = cover.desc.pos;
sim.truck.body.setTranslation({ x: cx + 30, y: cy + 1.2, z: cz }, true);
const covers = level.manholes!.map((h) => sim.objects.objects[h.cover]);
let lifts = 0;
let highest = 0;
for (let i = 0; i < 60 * 30; i++) {
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  for (const spout of sim.drainSpouts()) {
    spouts++;
    if (spout.lifted) lifts++;
  }
  for (const c of covers) highest = Math.max(highest, c.body.translation().y - c.desc.pos[1]);
}
const off = covers.map((c) => Math.hypot(c.body.translation().x - c.desc.pos[0], c.body.translation().z - c.desc.pos[2]).toFixed(1));
console.log(`truck at the main for 30 s: ${spouts} spouts, ${lifts} with the cover thrown up, highest ${highest.toFixed(1)} m; covers now ${off.join(', ')} m from their holes`);
process.exit(0);
