// Leave the truck at the start and count the bus street's scooters standing still, now and then. npx tsx dev/scooter-queue.ts
import { LEVELS } from '../src/levels/index';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(LEVELS.uptown());
const scooters = sim.riders.list.filter((r) => r.kind === 'scooter' && (r.road as unknown as { reach: unknown }).reach);
for (let i = 0; i <= 60 * 150; i++) {
  if (i % (60 * 15) === 0) console.log(`${i / 60}s: ${scooters.filter((r) => r.speed < 0.5 && r.knocked <= 0).length} of ${scooters.length} standing, ${scooters.filter((r) => r.d > -0.6).length} over the line`);
  sim.step({ throttle: 0, steer: 0, handbrake: true });
}
process.exit(0);
