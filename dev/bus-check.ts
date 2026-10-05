// The bus on level 2's first street: that it waits at the first stop until the truck comes up behind it, then pulls away,
// stops hard at the next stops with its brake lights on, and that people get off and on there. npx tsx dev/bus-check.ts
import { uptown } from '../src/levels/uptown';
import { heightAt } from '../src/levels/terrain';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create(level);
const bus = sim.traffic.cars.find((c) => c.lane.stops.length > 0)!;
const at = () => bus.body.translation();
for (let i = 0; i < 60 * 5; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const waited = at().z;
// Bring the truck up behind it.
sim.truck.body.setTranslation({ x: 86.1, y: heightAt(level.terrain, 86.1, waited - 22) + 0.9, z: waited - 22 }, true);
let stops = 0, hardest = 0, lit = 0, was = bus.speed, people = 0;
const before = sim.pedestrians.list.filter((p) => p.bus === 'aboard').length;
for (let i = 0; i < 60 * 70; i++) {
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  hardest = Math.max(hardest, (was - bus.speed) * 60);
  was = bus.speed;
  if (bus.braking && bus.speed > 0.5) lit++;
  if (sim.traffic.arrivals.length) stops++;
  people = Math.max(people, sim.pedestrians.list.filter((p) => p.bus === 'aboard').length);
}
console.log(`after 5 s with the truck far off, the bus had moved ${(waited - (726 + 30)).toFixed(1)} m; once the truck came up it made ${stops} stops in 70 s, braking at up to ${hardest.toFixed(1)} m/s² with its brake lights on for ${(lit / 60).toFixed(1)} s while moving; people on it at most ${people} (from ${before})`);
process.exit(0);
