// Level 3: small solid props near where the truck can get, that look like things to knock over but are fixed: the rule is
// that what looks knockable is knockable. Lists solid props no bigger than a small machine within reach of the driven ways.
// npx tsx dev/static-small.ts [minZ]
import { LEVELS } from '../src/levels';
// Level 3 unless another is named: LEVEL=tutorial npx tsx ...
const l = LEVELS[process.env.LEVEL ?? 'quarry']();
const minZ = Number(process.argv[2] ?? -1e9);
/** How far from the level's route a thing may be and still be met: 12 m, or as given. */
const NEAR = Number(process.argv[3] ?? 12);
const route = l.route ?? [];
const offRoute = (x: number, z: number) => route.slice(1).every((b, i) => {
  const a = route[i], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) > NEAR;
});
const groups = new Map<string, number>();
for (const p of l.props) {
  if (p.ghost || p.mass !== undefined || p.pos[2] < minZ || offRoute(p.pos[0], p.pos[2])) continue;
  const [a, b, c] = p.size, big = Math.max(a, p.shape === 'box' ? c : a);
  // Columns, walls, slabs and buildings are fixed and look it; what is left is the size of a can, a box, a cart, a drum.
  if (big > 1.3 || b > 1.3 || (p.shape === 'box' && Math.min(a, c) < 0.07) || p.building) continue;
  const key = `${p.shape} ${p.size.map((v) => v.toFixed(2)).join('x')} #${p.color.toString(16)}`;
  groups.set(key, (groups.get(key) ?? 0) + 1);
  if (groups.get(key) === 1) console.log(key, 'first at', p.pos.map((v) => v.toFixed(0)).join(','));
}
console.log(groups.size, 'kinds');
process.exit(0);
