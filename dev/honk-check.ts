// The truck's horn: people near it run, in the city and on the battlefield alike. npx tsx dev/honk-check.ts
import { battlefield } from '../src/levels/battlefield';
import { city } from '../src/levels/city';
import { Sim } from '../src/sim/sim';

const stop = { throttle: 0, steer: 0, handbrake: true };
for (const [name, level] of [['city', city()], ['battlefield', battlefield()]] as const) {
  const sim = await Sim.create(level);
  for (let i = 0; i < 60; i++) sim.step(stop);
  // Put the truck down beside whoever is nearest to a crowd's middle, so that there is someone to hear it.
  const someone = sim.pedestrians.list.find((p) => !p.crowd.fenced)!;
  const t = sim.truck.body.translation();
  sim.truck.body.setTranslation({ x: someone.pos.x + 4, y: t.y, z: someone.pos.z }, true);
  for (let i = 0; i < 5; i++) sim.step(stop);
  const at = sim.truck.body.translation();
  const near = () => sim.pedestrians.list.filter((p) => Math.hypot(p.pos.x - at.x, p.pos.z - at.z) < 8).length;
  const before = near();
  sim.honk();
  const fleeing = sim.pedestrians.list.filter((p) => p.state === 'flee').length;
  for (let i = 0; i < 90; i++) sim.step(stop);
  console.log(`${name}: ${before} within 8 m before, ${fleeing} ran, ${near()} within 8 m a second and a half after`);
}
process.exit(0);
