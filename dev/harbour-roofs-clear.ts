// Level 4's way over the roofs, on paper: how far each room built on the roofs, the water tower, and each fixed or loose
// thing put out stands from the way's middle, against how far out the way reaches there. Rooms and the tower must stand
// clear of it; the loose things say whether they are on the way, at its edge, or off it.
// npx tsx dev/harbour-roofs-clear.ts
import { ROOF_FORKS, ROOF_HALF, ROOF_ROOMS, ROOF_WAY } from '../src/levels/harbourRoofs';
import { harbour } from '../src/levels/harbour';

// Built first: the roofs note what stands solid on them as they are made.
const level = harbour();

// FORK=0 or 1: along one of the ways round the fallen tower in place of the way itself.
const WAY = process.env.FORK ? ROOF_FORKS[Number(process.env.FORK)] : ROOF_WAY;
const fine: [number, number][] = [];
for (let k = 0; k + 1 < WAY.length; k++) {
  const [ax, az] = WAY[k], [bx, bz] = WAY[k + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1);
  for (let i = 0; i < n; i++) fine.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]);
}
/** How near a rectangle comes to the way's middle, and where along it. */
function near(x0: number, z0: number, x1: number, z1: number): [number, number] {
  let best = Infinity, at = 0;
  fine.forEach(([x, z], i) => {
    const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1), d = Math.hypot(dx, dz);
    if (d < best) { best = d; at = i; }
  });
  return [best, at];
}
let bad = 0;
for (const [x0, z0, x1, z1, into] of ROOF_ROOMS) {
  const [d, i] = near(x0, z0, x1, z1);
  const need = ROOF_HALF(fine[i][0]) + 0.1;
  if (d < need && !into) bad++;
  if (d < need || process.env.ALL) console.log(`${d < need ? (into ? 'INTO' : 'IN  ') : 'ok  '}  ${x0}..${x1} × ${z0}..${z1}: ${d.toFixed(2)} m from the way (needs ${need.toFixed(2)}) near ${fine[i].map((v) => v.toFixed(1)).join(',')}`);
}
// The loose things on the roofs, by how far they stand from the way's middle: the truck's side is 1.3 out.
for (const o of level.objects ?? []) {
  const [x, y, z] = o.pos;
  if (y < 3.5 || y > 5.6 || x < 54 || x > 100.5 || z < 344 || z > 384) continue;
  const [d] = near(x, z, x, z);
  const where = d < 1.5 ? 'ON THE WAY' : d < ROOF_HALF(x) + 0.4 ? 'at its edge' : 'off it';
  if (process.env.ALL || d < ROOF_HALF(x) + 0.4) console.log(`   ${o.kind} at ${x.toFixed(1)},${z.toFixed(1)}: ${d.toFixed(1)} m, ${where}`);
}
console.log(bad ? `${bad} rooms in the way` : 'no room in the way');
