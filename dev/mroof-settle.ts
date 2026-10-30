// The market roof's things, left alone ten seconds: which have moved more than 0.3 m or dropped (the gust's own aside).
// With `ice`, the ice yard's instead, from the dock's foot to the gate.
// npx tsx dev/mroof-settle.ts [ice]
import { harbour } from '../src/levels/harbour';
import { EAVE, HALL } from '../src/levels/harbourMarket';
import { ICE_YARD, SEA_WALL } from '../src/levels/harbourIce';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(harbour());
sim.teleport(-10, 200, 0, 0.5);
const ice = process.argv[2] === 'ice';
const on = sim.objects.objects.filter((o) => ice ? o.desc.pos[0] > ICE_YARD.x0 && o.desc.pos[0] < ICE_YARD.x1 && o.desc.pos[2] > ICE_YARD.z0 - 82 && o.desc.pos[2] < SEA_WALL.z0 : o.desc.pos[1] > EAVE - 0.3 && o.desc.pos[0] > HALL.x0 - 1 && o.desc.pos[0] < HALL.x1 + 1 && o.desc.pos[2] > HALL.z0 && o.desc.pos[2] < HALL.z1);
for (const o of on) o.body.wakeUp();
for (let i = 0; i < 600; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
let moved = 0;
for (const o of on) {
  const p = o.body.translation(), [x, y, z] = o.desc.pos, d = Math.hypot(p.x - x, p.z - z);
  if (d > 0.3 || p.y < y - 0.3) { moved++; console.log(`  ${o.desc.kind} at ${x.toFixed(1)},${y.toFixed(2)},${z.toFixed(1)}: now ${p.x.toFixed(1)},${p.y.toFixed(2)},${p.z.toFixed(1)}`); }
}
console.log(`${on.length} things ${ice ? 'in the ice yard' : 'on the roof'}, ${moved} moved`);
