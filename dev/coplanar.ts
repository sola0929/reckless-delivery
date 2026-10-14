// Level 3's scenery: boxes that share a face with another box over some area, which draw flickering against each other.
// Only unturned boxes and boxes turned about Y alike. npx tsx dev/coplanar.ts
import { LEVELS } from '../src/levels';
// Level 3 unless another is named: LEVEL=tutorial npx tsx ...
const l = LEVELS[process.env.LEVEL ?? 'quarry']();
type B = { p: number[]; h: number[]; yaw: number; i: number };
const boxes: B[] = [];
l.props.forEach((p, i) => {
  if (p.shape !== 'box') return;
  const [rx, ry, rz] = p.rot ?? [0, 0, 0];
  if (Math.abs(rx) > 1e-3 || Math.abs(rz) > 1e-3) return;
  boxes.push({ p: p.pos, h: p.size, yaw: ry, i });
});
const cell = new Map<string, B[]>();
const key = (x: number, z: number) => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
for (const b of boxes) { const k = key(b.p[0], b.p[2]); (cell.get(k) ?? cell.set(k, []).get(k)!).push(b); }
let found = 0;
const E = 0.004;
for (const a of boxes) {
  const [cx, cz] = [Math.floor(a.p[0] / 4), Math.floor(a.p[2] / 4)];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const b of cell.get(`${cx + dx},${cz + dz}`) ?? []) {
    if (b.i <= a.i || Math.abs(Math.sin(a.yaw - b.yaw)) > 1e-3 || Math.abs(Math.cos(a.yaw - b.yaw)) < 0.999) continue;
    // In a's frame.
    const c = Math.cos(-a.yaw), s = Math.sin(-a.yaw);
    const rx = b.p[0] - a.p[0], rz = b.p[2] - a.p[2];
    const d = [rx * c + rz * s, b.p[1] - a.p[1], -rx * s + rz * c];
    for (let ax = 0; ax < 3; ax++) for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
      if (Math.abs(sa * a.h[ax] - (d[ax] + sb * b.h[ax])) > E) continue;
      // Faces on the same plane: do they overlap in the other two directions, and face the same way?
      if (sa !== sb) continue;
      const o = [0, 1, 2].filter((k) => k !== ax).map((k) => Math.min(a.h[k], d[k] + b.h[k]) - Math.max(-a.h[k], d[k] - b.h[k]));
      if (o[0] > 0.15 && o[1] > 0.15) { found++; if (found <= 40) console.log(`props ${a.i} & ${b.i} at ${a.p.map((v) => v.toFixed(1)).join(',')}: share a face ${o[0].toFixed(2)} x ${o[1].toFixed(2)}`); }
    }
  }
}
console.log(found, 'shared faces');
process.exit(0);
