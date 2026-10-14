// The bridge's lorries over a minute: how many are on the deck at a time, and the gaps between them along the road.
// npx tsx dev/bridge-lorries.ts
import { quarry } from '../src/levels/quarry';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create({ ...quarry(), crowds: [] });
sim.teleport(40, 1000, 0);
const counts: number[] = []; let tightest = Infinity, widest = 0;
for (let i = 0; i < 60 * 60; i++) {
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  if (i % 30) continue;
  const zs = sim.traffic.cars.filter((c) => c.spec && c.body).map((c) => c.body.translation()).filter((p) => p.z > 1096 && p.z < 1352 && p.x > 120).map((p) => p.z).sort((a, b) => a - b);
  counts.push(zs.length);
  for (let k = 1; k < zs.length; k++) tightest = Math.min(tightest, zs[k] - zs[k - 1]);
  // The longest stretch of deck with no lorry on it, ends included.
  const edges = [1096, ...zs, 1352];
  for (let k = 1; k < edges.length; k++) widest = Math.max(widest, edges[k] - edges[k - 1]);
}
console.log('on the deck: min', Math.min(...counts), 'max', Math.max(...counts), 'mean', (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1), '| tightest gap', tightest.toFixed(1), 'm | widest empty stretch', widest.toFixed(0), 'm');
process.exit(0);
