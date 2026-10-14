// The tutorial: can the truck get anywhere but along its one road? Flood over 0.5 m cells from the start, the solid props
// (walls, sheds, containers, sidings) in the way, the canal's water too, and list where it gets to off the road.
// npx tsx dev/tutorial-reach.ts
import { tutorial, RX, TRACK_Z, CANAL0, CANAL1, BAY_Z } from '../src/levels/tutorial';
import { heightAt } from '../src/levels/terrain';
const l = tutorial();
const [[x0, z0], [x1, z1]] = l.bounds!;
const S = 0.5, W = Math.ceil((x1 - x0) / S), H = Math.ceil((z1 - z0) / S);
const solid = new Uint8Array(W * H);
for (const p of l.props) {
  if (p.ghost || p.mass !== undefined || p.shape !== 'box' || p.pos[1] - p.size[1] > 1.2 || p.pos[1] + p.size[1] < 0.4) continue;
  const yaw = p.rot?.[1] ?? 0;
  const hx = Math.abs(Math.cos(yaw)) * p.size[0] + Math.abs(Math.sin(yaw)) * p.size[2], hz = Math.abs(Math.sin(yaw)) * p.size[0] + Math.abs(Math.cos(yaw)) * p.size[2];
  for (let j = Math.max(0, Math.floor((p.pos[2] - hz - z0) / S)); j <= Math.min(H - 1, Math.floor((p.pos[2] + hz - z0) / S)); j++)
    for (let i = Math.max(0, Math.floor((p.pos[0] - hx - x0) / S)); i <= Math.min(W - 1, Math.floor((p.pos[0] + hx - x0) / S)); i++) solid[j * W + i] = 1;
}
// The truck is 2.6 m wide: a gap narrower than that is shut. Grow every solid cell by 1.2 m.
const grown = new Uint8Array(W * H), R = Math.ceil(1.2 / S);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (solid[j * W + i]) for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
  const a = i + di, b = j + dj;
  if (a >= 0 && b >= 0 && a < W && b < H) grown[b * W + a] = 1;
}
const seen = new Uint8Array(W * H);
const cell = (x: number, z: number) => Math.floor((z - z0) / S) * W + Math.floor((x - x0) / S);
// The canal is jumped, not driven: flood from the start and, separately, from the far bank.
const flood = (x: number, z: number) => {
  const q = [cell(x, z)];
  seen[q[0]] = 1;
  while (q.length) {
    const c = q.pop()!, i = c % W, j = (c - i) / W;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj, n = nj * W + ni;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H || seen[n] || grown[n]) continue;
      const wx = x0 + (ni + 0.5) * S, wz = z0 + (nj + 0.5) * S;
      if (heightAt(l.terrain, wx, wz) < -0.5) continue;
      seen[n] = 1;
      q.push(n);
    }
  }
};
flood(l.spawn[0], l.spawn[2]);
flood(RX, CANAL1 + 4);
// Off the road: anything reached more than a few metres from the road's middle, past the bend.
const off = new Map<string, number>();
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
  if (!seen[j * W + i]) continue;
  const x = x0 + (i + 0.5) * S, z = z0 + (j + 0.5) * S;
  const onRoad = (z > 14 && Math.abs(x - RX) < 4.5) || (z < 14 && Math.abs(z) < 4.5 && x < RX) || (Math.hypot(x - (RX - 14), z - 14) < 18.5 && x > RX - 14 && z < 14);
  const crossing = Math.abs(z - TRACK_Z) < 4.6;
  if (onRoad) continue;
  const where = crossing ? 'along the railway' : z < 14 ? 'in the yard' : z < CANAL0 ? 'before the canal' : z < BAY_Z ? 'beyond the canal' : 'at the bay';
  off.set(where, (off.get(where) ?? 0) + S * S);
}
for (const [where, area] of off) console.log(`${where}: ${area.toFixed(0)} m² off the road`);
console.log('canal reached from the start (should be true):', !!seen[cell(RX, CANAL0 - 6)]);
console.log('bay reached from the far bank:', !!seen[cell(RX, BAY_Z)]);
console.log('far bank reached from the start without jumping:', !!seen[cell(RX, CANAL1 + 4)] && (() => { seen.fill(0); flood(l.spawn[0], l.spawn[2]); return !!seen[cell(RX, CANAL1 + 4)]; })());
process.exit(0);
