// Level 3's proving ground, the river bed: driven up it along the shortest way between the boulders that keeps clear of
// them and of the fast water by the ledge, and straight up the middle, at a steady speed, the current pushing across. How
// far it gets, how far it was carried off its line at worst, how much of the load is left. npx tsx dev/lab-river.ts
import { quarryLab } from '../src/levels/quarryLab';
import { Sim } from '../src/sim/sim';
const level = quarryLab();
const D = 176;
// The boulders: the lower block of each, as a circle round it.
const stones = level.props.filter((p) => p.shape === 'box' && p.pos[1] < 0 && p.size[1] >= 0.74 && Math.abs(p.pos[0] - D) < 14 && p.pos[2] > -10 && p.pos[2] < 152)
  .map((p) => [p.pos[0], p.pos[2], Math.hypot(p.size[0], p.size[2])] as const);
console.log(`${stones.length} boulders`);
// A grid over the river, half a metre square: free where the truck's middle can be, 1.9 m clear of every boulder across and more along (the truck is long), and more on the side the water carries it to (its corners reach further than its middle).
const X0 = D - 9, X1 = D + 11.5, Z0 = -14, Z1 = 156, S = 0.5;
const nx = Math.round((X1 - X0) / S) + 1, nz = Math.round((Z1 - Z0) / S) + 1;
const free = (i: number, j: number) => { const x = X0 + i * S, z = Z0 + j * S; return stones.every(([sx, sz, r]) => Math.hypot(x - sx - 0.8, (z - sz) / 1.7) > r + 1.9); };
const ok = Array.from({ length: nx * nz }, (_, k) => free(k % nx, Math.floor(k / nx)));
const dist = new Float64Array(nx * nz).fill(Infinity), from = new Int32Array(nx * nz).fill(-1);
const start = Math.round((D - X0) / S);
dist[start] = 0;
const open = [start];
while (open.length) {
  let best = 0;
  for (let k = 1; k < open.length; k++) if (dist[open[k]] < dist[open[best]]) best = k;
  const at = open.splice(best, 1)[0];
  const i = at % nx, j = Math.floor(at / nx);
  if (j === nz - 1) break;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const a = i + di, b = j + dj;
    if (a < 0 || a >= nx || b < 0 || b >= nz || !ok[b * nx + a]) continue;
    const d = dist[at] + Math.hypot(di, dj);
    if (d < dist[b * nx + a]) { if (dist[b * nx + a] === Infinity) open.push(b * nx + a); dist[b * nx + a] = d; from[b * nx + a] = at; }
  }
}
let end = -1;
for (let i = 0; i < nx; i++) if (dist[(nz - 1) * nx + i] < Infinity && (end < 0 || dist[(nz - 1) * nx + i] < dist[end])) end = (nz - 1) * nx + i;
if (end < 0) { console.log('no way through'); process.exit(0); }
const cells: [number, number][] = [];
for (let k = end; k >= 0; k = from[k]) cells.unshift([X0 + (k % nx) * S, Z0 + Math.floor(k / nx) * S]);
const weave = cells.filter((_, k) => k % 10 === 0);
let turns = 0;
for (let k = 2; k < weave.length; k++) if (Math.sign(weave[k][0] - weave[k - 1][0]) !== Math.sign(weave[k - 1][0] - weave[k - 2][0])) turns++;
console.log(`shortest way: ${dist[end].toFixed(0)} cells, swings across ${turns} times, widest swing ${Math.max(...weave.map(([x]) => x - D)).toFixed(1)} to ${Math.min(...weave.map(([x]) => x - D)).toFixed(1)}`);
const straight: [number, number][] = Array.from({ length: 345 }, (_, k) => [D, -14 + k * 0.5]);
for (const [name, way] of [['weaving', cells], ['straight', straight]] as const) {
  for (const want of [3, 6, 10]) {
    const sim = await Sim.create({ ...level, crowds: [], traffic: [] });
    sim.teleport(D, -16, 0);
    for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
    let near = 0, worst = 0;
    for (let i = 0; i < 60 * 120 && sim.truck.body.translation().z < 155 && !sim.result; i++) {
      const p = sim.truck.body.translation();
      const r = sim.truck.body.rotation();
      // The nearest point of the way, and one 8 m on along it.
      for (let k = near; k < Math.min(way.length, near + 40); k++) if (Math.hypot(way[k][0] - p.x, way[k][1] - p.z) < Math.hypot(way[near][0] - p.x, way[near][1] - p.z)) near = k;
      worst = Math.max(worst, Math.hypot(way[near][0] - p.x, way[near][1] - p.z));
      const [tx, tz] = way[Math.min(way.length - 1, near + 16)];
      const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
      // Aiming upstream of it by as far as the truck will drift sideways by the time it gets there, as a driver would.
      const v = sim.truck.body.linvel();
      const ax2 = tx - v.x * (8 / Math.max(1.5, Math.abs(sim.truck.forwardSpeed())));
      const off = Math.atan2(fx * (tz - p.z) - fz * (ax2 - p.x), fx * (ax2 - p.x) + fz * (tz - p.z));
      const speed = sim.truck.forwardSpeed();
      sim.step({ throttle: speed < want ? 0.9 : speed > want + 1 ? -0.6 : 0, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false });
    }
    const p = sim.truck.body.translation();
    console.log(`${name} ${(want * 3.6).toFixed(1)} km/h: reached x ${(p.x - D).toFixed(1)} z ${Math.round(p.z)}, carried off ${worst.toFixed(1)} m, load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%${sim.result ? ' ' + sim.result.failure : ''}`);
  }
}
process.exit(0);
