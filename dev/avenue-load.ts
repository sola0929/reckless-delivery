// The coil avenue from the truck's arrival at its foot: how long a step takes, how many coils are out, and when the first
// reaches the bottom half of the hill. npx tsx dev/avenue-load.ts
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create(level);
const ax = (17.5 - 31) * 16;
// Coming along the road toward the avenue's foot, and then stopping there.
sim.teleport(ax + 70, 16 * 51 - 2.25, -Math.PI / 2);
const coils = sim.objects.objects.filter((o) => o.desc.kind === 'steelCoil' && o.desc.pos[1] < -50);
let firstLow = -1;
const window: number[] = [];
for (let i = 0; i < 60 * 40; i++) {
  const t0 = performance.now();
  sim.step({ throttle: i < 60 * 8 ? 0.5 : 0, steer: 0, handbrake: i >= 60 * 8 });
  window.push(performance.now() - t0);
  if (firstLow < 0 && coils.some((c) => c.body.translation().y > 0 && c.body.translation().z < 16 * 58)) firstLow = i / 60;
  if (i % 300 === 299) {
    const out = coils.filter((c) => c.body.translation().y > 0).length;
    console.log(`${((i + 1) / 60).toFixed(0)} s: ${(window.reduce((a, b) => a + b, 0) / window.length).toFixed(1)} ms a step, ${Math.max(...window).toFixed(1)} at worst; ${out} coils out`);
    window.length = 0;
  }
}
console.log(`first coil into the lower half of the hill at ${firstLow.toFixed(1)} s`);
process.exit(0);
