// The charges on the battlefield: waves that come up, run, fall and are gone. npx tsx dev/charge-check.ts
import { battlefield } from '../src/levels/battlefield';
import { Sim } from '../src/sim/sim';

const sim = await Sim.create(battlefield());
const stop = { throttle: 0, steer: 0, handbrake: true };
const men = sim.pedestrians.list.filter((p) => p.crowd.charge);
const first = men.filter((p) => p.crowd === men[0].crowd);
const [x0, , x1] = first[0].crowd.area;
let line = '';
for (let i = 0; i <= 60 * 34; i++) {
  sim.step(stop);
  if (i % 120) continue;
  const up = first.filter((p) => p.pos.y > -1);
  const running = up.filter((p) => p.state === 'walk').length;
  const down = up.filter((p) => p.state === 'down').length;
  const furthest = up.length ? Math.max(...up.map((p) => (p.pos.x - x0) / (x1 - x0))) : 0;
  line += `${i / 60}s: ${running} running, ${down} down, furthest ${(furthest * 100).toFixed(0)}%\n`;
}
console.log(`${men.length} men in ${new Set(men.map((p) => p.crowd)).size} charges; the first, ${first.length} of them:\n${line}tanks roused: ${sim.battle.tanks.filter((t) => t.hostile).length}, counted as run down: ${sim.pedestrians.hits}`);
process.exit(0);
