// Level 1's river where the lifting bridge crosses it: the banks, the bridge's column, the ground on each bank, and the
// railing and what stands along the north bank to the west of the bridge. npx tsx dev/river-facts.ts
import { city, cityCell } from '../src/levels/city';
import { cityHeights } from '../src/levels/hillcity';
const flat = city();
const river = flat.pits!.find((p) => p.water !== undefined)!;
const [z0, z1] = [river.pos[1] - river.half[1], river.pos[1] + river.half[1]];
console.log('river z', z0, z1, 'depth', river.depth, 'water', river.water, 'x', river.pos[0] - river.half[0], river.pos[0] + river.half[0]);
console.log('bridge column x', cityCell(20, 0)[0]);
const h = cityHeights();
for (const x of [cityCell(20, 0)[0], cityCell(20, 0)[0] + 40, cityCell(20, 0)[0] + 70]) console.log('x', x, 'south bank', h.at(x, z0 - 4).toFixed(1), 'north bank', h.at(x, z1 + 4).toFixed(1), 'north +12', h.at(x, z1 + 12).toFixed(1));
const west = cityCell(20, 0)[0];
console.log('objects on north bank west of bridge:', (flat.objects ?? []).filter((o) => o.pos[2] > z1 && o.pos[2] < z1 + 16 && o.pos[0] > west + 8 && o.pos[0] < west + 90).map((o) => `${o.kind}@${o.pos[0].toFixed(0)},${o.pos[2].toFixed(0)}`).join(' '));
