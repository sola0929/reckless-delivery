// Places along the showcase's road to photograph: where, how high, and which way the road runs there. npx tsx dev/relief-places.ts
import { writeFileSync } from 'node:fs';
import { reliefShow } from '../src/levels/reliefShow';
import { heightAt } from '../src/levels/terrain';

const level = reliefShow();
const route = level.route!;
const along: number[] = [0];
for (let n = 1; n < route.length; n++) along.push(along[n - 1] + Math.hypot(route[n][0] - route[n - 1][0], route[n][1] - route[n - 1][1]));
const total = along[along.length - 1];
// The winding part by how far along the road it is, as a share of the whole; the straight north end by how far north.
const wanted: [string, number][] = [['1-bank', 0.045], ['2-cutting', 0.16], ['3-hairpin-a', 0.29], ['4-hairpin-b', 0.37], ['5-hairpin-c', 0.45], ['6-bridge', -336], ['7-steps', -386], ['8-quay', -436], ['9-street-a', -526], ['10-street-b', -566], ['11-street-c', -606], ['12-street-d', -646]];
const places = wanted.map(([name, mark]) => {
  const n = Math.max(1, mark < 0 ? route.findIndex(([, z]) => z >= -mark) : along.findIndex((d) => d >= mark * total));
  const [x, z] = route[n - 1];
  return { name, x, z, y: heightAt(level.terrain, x, z) + 0.9, yaw: Math.atan2(route[n][0] - x, route[n][1] - z) };
});
writeFileSync('dev/out/relief-places.json', JSON.stringify(places));
console.log(places.map((p) => `${p.name}: ${p.x.toFixed(0)}, ${p.z.toFixed(0)} at ${p.y.toFixed(1)}`).join('\n'));
