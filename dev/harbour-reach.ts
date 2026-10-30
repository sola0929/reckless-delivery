// Level 4: can the truck get anywhere on the ground but along its one way? Flood over 0.25 m cells from the
// start, the solid props in the way (anything standing in the band a truck's body is in), steps of more than 0.3 m too,
// water and the ground only fallen on too; and say whether each place is reached from the start, on the ground.
// npx tsx dev/harbour-reach.ts
import { harbour } from '../src/levels/harbour';
import { heightAt } from '../src/levels/terrain';
const l = harbour();
const [[x0, z0], [x1, z1]] = l.bounds!;
const S = 0.25, W = Math.ceil((x1 - x0) / S), H = Math.ceil((z1 - z0) / S);
const at = (i: number, j: number) => heightAt(l.terrain, x0 + (i + 0.5) * S, z0 + (j + 0.5) * S);
const tag = (i: number, j: number) => l.terrain!.surface?.(x0 + (i + 0.5) * S, z0 + (j + 0.5) * S)?.tag;
const solid = new Uint8Array(W * H);
for (const p of l.props) {
  if (p.ghost || p.mass !== undefined || p.wheelsOnly) continue;
  const mark = (i: number, j: number, lo: number, hi: number) => {
    // Only what stands in the band a loaded truck is in, over the ground there: up to 3.3 m, a pole above that is got under.
    const g = at(i, j);
    if (hi > g + 0.35 && lo < g + 3.3) solid[j * W + i] = 1;
  };
  if (p.shape === 'cylinder' && p.rot && (Math.abs(p.rot[2]) > 0.3 || Math.abs(p.rot[0]) > 0.3)) {
    // Laid over: along its length, as rod() lays it (rot [0, b, -tip]).
    const tip = -p.rot[2], b = p.rot[1], d = [Math.sin(tip) * Math.cos(b), Math.cos(tip), -Math.sin(tip) * Math.sin(b)];
    for (let t = -p.size[1]; t <= p.size[1]; t += 0.25) {
      const x = p.pos[0] + d[0] * t, y = p.pos[1] + d[1] * t, z = p.pos[2] + d[2] * t;
      for (let j = Math.floor((z - p.size[0] - z0) / S); j <= Math.floor((z + p.size[0] - z0) / S); j++)
        for (let i = Math.floor((x - p.size[0] - x0) / S); i <= Math.floor((x + p.size[0] - x0) / S); i++) if (i >= 0 && j >= 0 && i < W && j < H) mark(i, j, y - p.size[0], y + p.size[0]);
    }
    continue;
  }
  const yaw = p.rot?.[1] ?? 0;
  const r = p.shape === 'box' ? [p.size[0], p.size[2]] : [p.size[0], p.size[0]];
  const hx = Math.abs(Math.cos(yaw)) * r[0] + Math.abs(Math.sin(yaw)) * r[1], hz = Math.abs(Math.sin(yaw)) * r[0] + Math.abs(Math.cos(yaw)) * r[1];
  // Tilted about Z (a ramp, a roof): its ends stand at other heights; take its span up and down.
  const tz = p.rot?.[2] ?? 0, rise = Math.abs(Math.sin(tz)) * p.size[0];
  for (let j = Math.max(0, Math.floor((p.pos[2] - hz - z0) / S)); j <= Math.min(H - 1, Math.floor((p.pos[2] + hz - z0) / S)); j++)
    for (let i = Math.max(0, Math.floor((p.pos[0] - hx - x0) / S)); i <= Math.min(W - 1, Math.floor((p.pos[0] + hx - x0) / S)); i++) {
      const dx = x0 + (i + 0.5) * S - p.pos[0], y = p.pos[1] + (rise ? Math.tan(tz) * dx : 0);
      mark(i, j, y - p.size[1] - (rise ? 0.1 : 0), y + p.size[1]);
    }
}
// The truck is 2.6 m wide: grow every solid cell by 1.25 m, on cells a quarter of a metre across.
const grown = new Uint8Array(W * H), R = Math.ceil(1.2 / S);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (solid[j * W + i]) for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
  const a = i + di, b = j + dj;
  if (a >= 0 && b >= 0 && a < W && b < H) grown[b * W + a] = 1;
}
const seen = new Uint8Array(W * H);
const cell = (x: number, z: number) => Math.floor((z - z0) / S) * W + Math.floor((x - x0) / S);
const flood = (x: number, z: number) => {
  seen.fill(0);
  const q = [cell(x, z)];
  seen[q[0]] = 1;
  while (q.length) {
    const c = q.pop()!, i = c % W, j = (c - i) / W;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj, n = nj * W + ni;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H || seen[n] || grown[n]) continue;
      if (Math.abs(at(ni, nj) - at(i, j)) > 0.3) continue;
      const t = tag(ni, nj);
      if (t === 'water' || t === 'drop') continue;
      seen[n] = 1;
      q.push(n);
    }
  }
};
const places: [string, number, number, boolean][] = [
  ['the boat row arcade (yes)', -6.2, 125, true],
  ['the square at the market door (yes)', 2, 230, true],
  ['the market aisle, dry goods (yes)', -10, 290, true],
  ['the market aisle, fish (yes)', 15.6, 340, true],
  ['the dry goods aisle that goes nowhere (yes)', -1, 294.75, true],
  ['the fish aisle that goes nowhere (yes)', 7, 337.75, true],
  ['between the two (no)', 2.8, 316, false],
  ['the lane behind the cold stores (yes)', 62, 339.3, true],
  ['the net store by the carport (no)', 110.5, 372, false],
  ['the drain (no)', 47, 360, false],
  ['the ice plant dock (no: only from the roof)', -44, 300, false],
  ['the ice yard (no)', -44, 340, false],
  ['the ramp up the sea wall (no)', -44, 375, false],
  ['the back of the boat row, past the boat on the street (yes, through the arcade)', 0, 140, true],
];
flood(l.spawn[0], l.spawn[2]);
let ok = true;
if (process.env.WHERE) { let far = -99; for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (seen[j * W + i]) far = Math.max(far, z0 + j * S); console.log("furthest north reached:", far); for (let z = +(process.env.Z0 ?? far - 2); z <= +(process.env.Z0 ?? far - 2) + 10; z += 1) { let line = ""; for (let x = +(process.env.X0 ?? -10); x <= +(process.env.X0 ?? -10) + 20; x += 0.5) { const c = cell(x, z); line += seen[c] ? "." : grown[c] ? (solid[c] ? "#" : "+") : "?"; } console.log(z.toFixed(0).padStart(4), line); } }
for (const [name, x, z, want] of places) {
  const got = !!seen[cell(x, z)];
  if (got !== want) ok = false;
  console.log(`${got === want ? 'ok ' : 'BAD'} ${name}: ${got ? 'reached' : 'not reached'}`);
}
// And from the ice yard: is the dock reached up its ramp, and the gate up the iced ramp?
flood(-50, 336);
for (const [name, x, z] of [['the dock', -44, 300], ['the far side of the lorry', -38, 344], ['up the ramp', -44, 378], ['through the gate', -44, 395]] as const)
  console.log(`${seen[cell(x, z)] ? 'ok ' : 'BAD'} ${name} from the ice yard: ${seen[cell(x, z)] ? 'reached' : 'not reached'}`);
// And out through the gate: the outer quay is reached down its ramp; the pier and the ship's ramp only over the boats.
flood(-44, 402);
for (const [name, x, z, want] of [['the outer quay', -40, 440, true], ["the gangway's head", -32, 440, true], ['the pier', 49, 450, false], ["the foot of the ship's ramp", 49.7, 466, false]] as const) {
  const got = !!seen[cell(x, z)];
  if (got !== want) ok = false;
  console.log(`${got === want ? 'ok ' : 'BAD'} ${name} from the gate: ${got ? 'reached' : 'not reached'}`);
}
console.log(ok ? 'all as it should be' : 'SOMETHING IS OPEN THAT SHOULD NOT BE, OR SHUT');
process.exit(0);
