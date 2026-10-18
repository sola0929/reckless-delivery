// Level 2's soup pot left alone: its height every half second for three seconds, and the top scaffold piece under it.
import { LEVELS } from '../src/levels';
import { Sim } from '../src/sim/sim';
const level = LEVELS.uptown();
const sim = await Sim.create(level);
const pot = sim.cargo.find((c) => c.type.id === 'stockpot')!;
const placed = level.cargo.find((c) => c.type === 'stockpot')!;
console.log('placed at', placed.pos.map((v) => v.toFixed(2)).join(','));
for (let k = 0; k <= 180; k++) {
  if (k % 30 === 0) {
    const p = pot.body!.translation();
    const top = sim.objects.objects.find((o) => Math.abs(o.body.translation().x - p.x) < 1.2 && Math.abs(o.body.translation().z - 915) < 1.5 && o.body.translation().y > 24);
    console.log((k / 60).toFixed(1), 's pot y', p.y.toFixed(2), 'top piece y', top ? top.body.translation().y.toFixed(2) : 'none');
  }
  sim.step({ throttle: 0, steer: 0, handbrake: true });
}
