// npx tsx dev/quarry-reach.ts
// Can the truck get from the start to the load-out without the stockpiles, or to the field without the dike or the crossing? Flood over 1 m cells, a step allowed where
// the ground rises or falls under 0.5 m to the next; the dike and the ford blocked.
import { quarry } from '../src/levels/quarry';
import { heightAt } from '../src/levels/terrain';
const l = quarry();
const [[x0, z0], [x1, z1]] = l.bounds!;
const W = Math.ceil(x1 - x0), H = Math.ceil(z1 - z0);
const h = new Float32Array(W * H);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) h[j * W + i] = heightAt(l.terrain, x0 + i + 0.5, z0 + j + 0.5);
const blocked = (x: number, z: number) => (x > 74 && x < 86 && z > 540 && z < 790) || (x > 60 && x < 110 && z > 850 && z < 1026);
function flood(blocked: (x: number, z: number) => boolean) {
const seen = new Uint8Array(W * H);
const start = Math.floor(l.spawn[2] - z0) * W + Math.floor(l.spawn[0] - x0);
const q = [start]; seen[start] = 1;
while (q.length) {
  const c = q.pop()!, i = c % W, j = (c - i) / W;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ni = i + di, nj = j + dj;
    if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
    const n = nj * W + ni;
    if (seen[n] || blocked(x0 + ni, z0 + nj) || Math.abs(h[n] - h[c]) > 0.5 || h[n] < -0.5) continue;
    seen[n] = 1; q.push(n);
  }
}
return seen;
}
const at = (seen: Uint8Array, x: number, z: number) => !!seen[Math.floor(z - z0) * W + Math.floor(x - x0)];
const seen = flood(blocked);
// The load-out taken away: can the descent still be reached?
console.log('descent reachable without the load-out:', at(flood((x, z) => blocked(x, z) || (x > 98 && x < 126 && z > 360 && z < 440)), 112, 478));
// The stockpile yard taken away: can the load-out still be reached, by the plant or anywhere else?
console.log('load-out reachable without the stockpiles:', at(flood((x, z) => blocked(x, z) || (x > 8 && x < 56 && z > 100 && z < 260)), 112, 345));
// The sand bar's melon field, and the site's gate over the main channel.
const f: [number, number] = [96, 1040];
const gate: [number, number] = [110, 1394];
console.log('site reachable without the bridge:', at(flood((x, z) => blocked(x, z) || (x > 120 && x < 136 && z > 1090 && z < 1358)), gate[0], gate[1]));
console.log('site reachable at all (should be true):', at(flood(() => false), gate[0], gate[1]));
// Past the dike, the crossing taken away: can the field be reached from the pump station's yard over the levee or the flats?
console.log('field reachable without the crossing:', at(flood((x, z) => (x > 60 && x < 110 && z > 850 && z < 1026)), f[0], f[1]));
console.log('field reachable without dike/crossing:', !!seen[Math.floor(f[1] - z0) * W + Math.floor(f[0] - x0)]);
// Where north of the dike's start can be reached at all, by rows of 32 m.
for (let z = 520; z < 1060; z += 32) {
  let line = '';
  for (let x = x0; x < x1; x += 4) line += seen[Math.floor(z - z0) * W + Math.floor(x - x0)] ? '#' : '.';
  console.log(String(z).padStart(5), line);
}
