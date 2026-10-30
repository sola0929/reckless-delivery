// Level 4's market: into each of its aisles that go nowhere, as a driver fooled in the dark would, and back out. Put on the
// way 14 m short of where the aisle goes off it, it drives up, turns in and on until the stock across the end is a couple
// of metres off; then backs out straight until it is back out on the way. Says whether it got in and out, how long it
// took, and how much of the load is left.
// npx tsx dev/market-deadend.ts      SIGN=1 the other way round on the wheel backing
import { harbour } from '../src/levels/harbour';
import { deadEnds, marketLine } from '../src/levels/harbourMarket';
import { Sim } from '../src/sim/sim';

const level = harbour();
for (const { junction, end } of deadEnds()) {
  const sim = await Sim.create(level);
  // Where the careful way is beside the junction, and 14 m back along it.
  const line = marketLine();
  let k = 0;
  for (let i = 0; i < line.length; i++) if (Math.hypot(line[i][0] - junction[0], line[i][1] - junction[1]) < Math.hypot(line[k][0] - junction[0], line[k][1] - junction[1])) k = i;
  const back = line[Math.max(0, k - 9)], before = line[Math.max(0, k - 1)];
  sim.teleport(back[0], back[1], Math.atan2(before[0] - back[0], before[1] - back[1]));
  for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const out: [number, number] = [(end[0] - junction[0]) / Math.hypot(end[0] - junction[0], end[1] - junction[1]), (end[1] - junction[1]) / Math.hypot(end[0] - junction[0], end[1] - junction[1])];
  const stop: [number, number] = [end[0] - out[0] * 6, end[1] - out[1] * 6];
  // In: to the junction's middle, then down the aisle, at a walking pace.
  const way: [number, number][] = [before, junction, [junction[0] + out[0] * 4, junction[1] + out[1] * 4], stop];
  let at = 0, i = 0;
  const into = () => (sim.truck.body.translation().x - junction[0]) * out[0] + (sim.truck.body.translation().z - junction[1]) * out[1];
  for (; i < 60 * 60 && at < way.length; i++) {
    const p = sim.truck.body.translation(), r = sim.truck.body.rotation();
    const [tx, tz] = way[at];
    if (Math.hypot(tx - p.x, tz - p.z) < (at === way.length - 1 ? 1.2 : 3)) { at++; continue; }
    const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
    const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
    const speed = sim.truck.forwardSpeed();
    sim.step({ throttle: speed < 2 ? 1 : 0, steer: Math.max(-1, Math.min(1, -off * 2.2)), handbrake: false });
  }
  const inAt = i, deepest = into();
  for (let j = 0; j < 60; j++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  // Out: backing straight, until its front is out past the way's middle.
  let t = 0;
  // Looking back over its shoulder at the far side of the way, the wheel turned to bring its tail toward it.
  const aim: [number, number] = [junction[0] - out[0] * 3, junction[1] - out[1] * 3];
  for (; t < 60 * 60 && into() > -1; t++) {
    const p = sim.truck.body.translation(), r = sim.truck.body.rotation();
    const fx = -2 * (r.x * r.z + r.w * r.y), fz = -(1 - 2 * (r.x * r.x + r.y * r.y));
    const off = Math.atan2(fx * (aim[1] - p.z) - fz * (aim[0] - p.x), fx * (aim[0] - p.x) + fz * (aim[1] - p.z));
    sim.step({ throttle: sim.truck.forwardSpeed() > -2 ? -1 : 0, steer: Math.max(-1, Math.min(1, (process.env.SIGN ? -1 : 1) * off * 2.2)), handbrake: false });
  }
  const load = Math.round((sim.cargoValue() / sim.fullValue) * 100);
  console.log(`dead end at ${junction.map((n) => n.toFixed(1)).join(',')}: ${deepest > 5 ? 'in' : 'NOT in'} (${deepest.toFixed(1)} m down it, ${(inAt / 60).toFixed(0)} s), ${into() <= -1 ? 'out' : 'STUCK backing'} in ${(t / 60).toFixed(0)} s, load ${load}%`);
}
process.exit(0);
