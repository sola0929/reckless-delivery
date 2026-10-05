// The forest road: can something as wide as the truck get out from between the trunks that line the way? npx tsx dev/forest-check.ts
import { hilltown as battlefield } from '../src/levels/hilltown';

const level = battlefield();
const trunks = level.props.filter((p) => p.shape === 'cylinder' && !p.rot && p.pos[2] > 262 && p.pos[2] < 440 && p.mapColor === 0x3f5a38);
const way = level.route!.filter(([, z]) => z >= 262 && z <= 400);
const fromWay = (x: number, z: number) => {
  let nearest = Infinity;
  for (let n = 0; n < way.length - 1; n++) {
    const [ax, az] = way[n];
    const [bx, bz] = way[n + 1];
    const length = Math.hypot(bx - ax, bz - az);
    const dx = (bx - ax) / length, dz = (bz - az) / length;
    const t = Math.max(0, Math.min(length, (x - ax) * dx + (z - az) * dz));
    nearest = Math.min(nearest, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return nearest;
};
// Flood out from the way in, over every place the middle of a truck 2.5 m wide could be.
const CELL = 0.4, X0 = -40, Z0 = 264, W = Math.ceil(180 / CELL), H = Math.ceil(180 / CELL);
const blocked = new Uint8Array(W * H);
for (const t of trunks) {
  const reach = t.size[0] + 1.25;
  for (let i = Math.floor((t.pos[0] - reach - X0) / CELL); i <= (t.pos[0] + reach - X0) / CELL; i++) {
    for (let j = Math.floor((t.pos[2] - reach - Z0) / CELL); j <= (t.pos[2] + reach - Z0) / CELL; j++) {
      if (i < 0 || j < 0 || i >= W || j >= H) continue;
      if (Math.hypot(X0 + (i + 0.5) * CELL - t.pos[0], Z0 + (j + 0.5) * CELL - t.pos[2]) < reach) blocked[j * W + i] = 1;
    }
  }
}
// The way in, at the foot, is open, of course: shut it, so that the question is only whether there is a way out through the trees.
for (let j = 0; Z0 + (j + 0.5) * CELL < 267; j++) for (let i = 0; i < W; i++) blocked[j * W + i] = 1;
const seen = new Uint8Array(W * H);
const start = Math.floor((270 - Z0) / CELL) * W + Math.floor((way[0][0] - X0) / CELL);
const queue = [start];
seen[start] = 1;
let furthest = 0, where = '';
while (queue.length) {
  const at = queue.pop()!;
  const i = at % W, j = Math.floor(at / W);
  const x = X0 + (i + 0.5) * CELL, z = Z0 + (j + 0.5) * CELL;
  const off = fromWay(x, z);
  if (off > furthest) { furthest = off; where = `${x.toFixed(1)}, ${z.toFixed(1)}`; }
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ni = i + di, nj = j + dj;
    if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
    const next = nj * W + ni;
    if (!seen[next] && !blocked[next]) { seen[next] = 1; queue.push(next); }
  }
}
console.log(`${trunks.length} trunks; the furthest a truck can get from the middle of the way is ${furthest.toFixed(1)} m, at ${where}`);
process.exit(0);
