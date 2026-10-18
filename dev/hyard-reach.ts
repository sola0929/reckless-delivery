// Level 3: can the truck get from the start into the pump house yard by the clear pond (ground only, props not counted)?
import { quarry } from '../src/levels/quarry';
import { heightAt } from '../src/levels/terrain';
const l = quarry();
const [[x0, z0], [x1, z1]] = l.bounds!;
const W = Math.ceil(x1 - x0), H = Math.ceil(z1 - z0);
const h = new Float32Array(W * H);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) h[j * W + i] = heightAt(l.terrain, x0 + i + 0.5, z0 + j + 0.5);
const seen = new Uint8Array(W * H);
const start = Math.floor(l.spawn[2] - z0) * W + Math.floor(l.spawn[0] - x0);
const q = [start]; seen[start] = 1;
while (q.length) {
  const c = q.pop()!, i = c % W, j = (c - i) / W;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ni = i + di, nj = j + dj;
    if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
    const n = nj * W + ni;
    if (seen[n] || Math.abs(h[n] - h[c]) > 0.5) continue;
    seen[n] = 1; q.push(n);
  }
}
const at = (x: number, z: number) => !!seen[Math.floor(z - z0) * W + Math.floor(x - x0)];
console.log('h yard', at(130, 680), 'heights', heightAt(l.terrain, 130, 680).toFixed(1), heightAt(l.terrain, 100, 790).toFixed(1));
for (let z = 640; z < 820; z += 12) { let line = ''; for (let x = 60; x < 160; x += 3) line += at(x, z) ? '#' : '.'; console.log(String(z).padStart(4), line); }
