// Coils let go on the avenue that have stopped on the way down: where, and what is next to each. npx tsx dev/stuck-coils.ts
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create({ ...level, traffic: [], crowds: [], riders: [] });
const ax = (17.5 - 31) * 16;
sim.teleport(ax - 30, 16 * 60, 0);
const coils = sim.objects.objects.filter((o) => o.desc.kind === 'steelCoil' && o.desc.pos[1] < -50);
for (let i = 0; i < 60 * 90; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const stuck = coils.filter((c) => { const p = c.body.translation(); const v = c.body.linvel(); return p.y > 0 && Math.hypot(v.x, v.z) < 0.3 && p.z > 16 * 52 + 8; });
console.log(`${stuck.length} of ${coils.length} stopped on the hill`);
for (const c of stuck) {
  const p = c.body.translation();
  const near = sim.objects.objects.filter((o) => o !== c && Math.hypot(o.body.translation().x - p.x, o.body.translation().z - p.z) < 2.5).map((o) => o.desc.kind);
  const props = level.props.filter((q) => Math.abs(q.pos[0] - p.x) < (q.shape === 'box' ? q.size[0] : q.size[0]) + 1.2 && Math.abs(q.pos[2] - p.z) < (q.shape === 'box' ? q.size[2] : q.size[0]) + 1.2 && q.pos[1] + q.size[1] > p.y - 1 && q.pos[1] - q.size[1] < p.y + 1 && !q.ghost).map((q) => (q.building ? 'house' : `${q.shape}`));
  console.log(`  x ${(p.x - ax).toFixed(1)} from the middle, z ${p.z.toFixed(0)}: by ${[...new Set(near)].join(', ') || 'nothing loose'}; ${[...new Set(props)].join(', ') || 'no fixed thing'}`);
}
process.exit(0);
