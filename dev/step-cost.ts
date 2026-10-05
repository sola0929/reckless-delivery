// How long a physics step takes on a level, and what in it: npx tsx dev/step-cost.ts <level> [<level> ...]
import { LEVELS } from '../src/levels/index';
import { Sim } from '../src/sim/sim';
for (const id of process.argv.slice(2)) {
  const level = LEVELS[id]();
  const sim = await Sim.create(level);
  for (let i = 0; i < 120; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const t0 = performance.now();
  for (let i = 0; i < 300; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const per = (performance.now() - t0) / 300;
  // And with the truck driving along its way for a bit.
  const t1 = performance.now();
  for (let i = 0; i < 300; i++) sim.step({ throttle: 0.6, steer: 0, handbrake: false });
  const moving = (performance.now() - t1) / 300;
  const awake = (sim as unknown as { world: { bodies: { forEach(f: (b: { isSleeping(): boolean; isDynamic(): boolean }) => void): void } } }).world;
  let n = 0, up = 0;
  awake.bodies.forEach((b) => { n++; if (b.isDynamic() && !b.isSleeping()) up++; });
  console.log(`${id}: ${per.toFixed(2)} ms a step standing, ${moving.toFixed(2)} ms driving; ${n} bodies, ${up} awake; ${level.crowds?.reduce((s, c) => s + c.count, 0)} people, ${level.traffic.reduce((s, l) => s + l.cars, 0)} cars, ${level.riders?.reduce((s, r) => s + r.riders, 0) ?? 0} riders`);
}
process.exit(0);
