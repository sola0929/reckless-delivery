// How tight a circle the truck turns at full lock, at a few speeds. npx tsx dev/turning-circle.ts
import { sandbox } from '../src/levels/sandbox';
import { Sim } from '../src/sim/sim';

for (const want of [3, 5, 8]) {
  const level = sandbox();
  level.props = [];
  const sim = await Sim.create(level);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < 60 * 30; i++) {
    const speed = sim.truck.forwardSpeed();
    sim.step({ throttle: speed < want ? 0.7 : 0, steer: 1, handbrake: false });
    if (i < 60 * 10) continue;
    const p = sim.truck.body.translation();
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  console.log(`at ${want} m/s: the middle of the truck goes round a circle of radius ${(((maxX - minX) + (maxZ - minZ)) / 4).toFixed(1)} m`);
}
process.exit(0);
