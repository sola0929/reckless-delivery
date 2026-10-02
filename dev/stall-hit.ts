// Drive into each market stall near the way in, twice, and say what the truck met: how much
// speed it lost, whether the stall gave way, and what stands close by it. npx tsx dev/stall-hit.ts
import { city, cityCell } from '../src/levels/city';
import { Sim } from '../src/sim/sim';
const level = city();
const [ex, ez] = cityCell(27, 14);
const stalls = level.objects!.filter((o) => o.kind.startsWith('stall') && Math.hypot(o.pos[0] - ex, o.pos[2] - ez) < 40);
for (const desc of stalls) {
  const sim = await Sim.create(level);
  for (let i = 0; i < 30; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const stall = sim.objects.objects.find((o) => o.desc === desc)!;
  const [x, , z] = desc.pos;
  const near = [
    ...level.objects!.filter((o) => o !== desc && Math.hypot(o.pos[0] - x, o.pos[2] - z) < 2.2).map((o) => `${o.kind}@${(o.pos[0] - x).toFixed(1)},${(o.pos[2] - z).toFixed(1)},y${o.pos[1].toFixed(1)}`),
    ...level.props.filter((p) => !p.ghost && !p.paving && p.pos[1] + p.size[1] > 0.2 && Math.abs(p.pos[0] - x) < p.size[0] + 1.6 && Math.abs(p.pos[2] - z) < (p.shape === 'box' ? p.size[2] : p.size[0]) + 1.6).map((p) => `STATIC ${p.building ? 'building' : p.shape} top ${(p.pos[1] + p.size[1]).toFixed(1)} edge ${(Math.abs(p.pos[0] - x) - p.size[0]).toFixed(1)},${(Math.abs(p.pos[2] - z) - (p.shape === 'box' ? p.size[2] : p.size[0])).toFixed(1)}`),
  ];
  const out: string[] = [];
  for (const attempt of [1, 2]) {
    const t = sim.truck.body.translation();
    const at = stall.body.translation();
    const move = (b: any) => { const p = b.translation(); b.setTranslation({ x: p.x + at.x - t.x, y: p.y, z: p.z + at.z - 13 - t.z }, true); b.setLinvel({ x: 0, y: 0, z: 11 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true); };
    for (const c of sim.cargo) if (c.body) move(c.body);
    move(sim.truck.body);
    let lowest = 99;
    for (let i = 0; i < 100; i++) { sim.step({ throttle: 1, steer: 0, handbrake: false }); if (i > 30) lowest = Math.min(lowest, sim.truck.forwardSpeed()); }
    const now = stall.body.translation();
    out.push(`hit ${attempt}: truck down to ${(lowest * 3.6).toFixed(0)} km/h, stall ${stall.knocked ? (stall.wrecked ? 'wrecked' : 'knocked') : 'unmoved'}, moved ${Math.hypot(now.x - at.x, now.z - at.z).toFixed(1)} m`);
  }
  console.log(`${desc.kind} at col ${(17.5 - x / 16).toFixed(2)} row ${(z / 16).toFixed(2)} rotY ${(desc.rotY ?? 0).toFixed(2)} | ${out.join(' | ')}\n   near: ${near.join(' ; ') || 'nothing'}`);
}
