// Level 1's building site in the roadworks: its scaffold boards, floor slabs, columns, the office and the ground there,
// and the fences round it. npx tsx dev/site-facts.ts
import { city } from '../src/levels/city';
import { cityHeights } from '../src/levels/hillcity';
const flat = city();
const h = cityHeights();
const boards = flat.props.filter((p) => p.ghost && p.color === 0xb98a55 && p.shape === 'box' && Math.abs(p.size[1] - 0.03) < 0.001);
for (const p of boards) console.log('board', p.pos.map((v) => +v.toFixed(2)).join(','), 'half', p.size.map((v) => +v.toFixed(2)).join(','));
const slabs = flat.props.filter((p) => !p.ghost && p.color === 0xa9a59b && Math.abs(p.size[1] - 0.14) < 0.001);
for (const p of slabs) console.log('slab', p.pos.map((v) => +v.toFixed(2)).join(','), 'half', p.size.map((v) => +v.toFixed(2)).join(','));
const b0 = boards[0];
console.log('ground there', h.at(b0.pos[0], b0.pos[2]).toFixed(1));
const near = (flat.objects ?? []).filter((o) => Math.hypot(o.pos[0] - b0.pos[0], o.pos[2] - b0.pos[2]) < 30);
console.log('objects', near.map((o) => `${o.kind}@${o.pos[0].toFixed(0)},${o.pos[2].toFixed(0)}`).join(' '));
