// How many cars are on the avenue going up and coming down, now and then. npx tsx dev/avenue-cars.ts
import { LEVELS } from '../src/levels/index';
import { Sim } from '../src/sim/sim';
const level = LEVELS.uptown();
const sim = await Sim.create(level);
const lanes = level.traffic!;
for (let i = 0; i <= 60 * 120; i++) {
  if (i % (60 * 15) === 0) {
    const counts = new Map<number, number>();
    for (const car of sim.traffic.cars) {
      const f = car.lane.from as unknown as { x: number; z: number };
      const k = lanes.findIndex((l) => Math.abs(l.from[0] - f.x) < 0.1 && Math.abs(l.from[1] - f.z) < 0.1);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    console.log(`${i / 60}s`, [...counts].sort((a, b) => a[0] - b[0]).filter(([k]) => k >= lanes.length - 20).map(([k, n]) => `${k}:${n}`).join(' '));
  }
  sim.step({ throttle: 0, steer: 0, handbrake: true });
}
console.log(lanes.slice(-20).map((l, k) => `${lanes.length - 20 + k}: ${l.from.map(Math.round)} -> ${l.to.map(Math.round)} cars ${l.cars} next ${l.next}`).join('\n'));
process.exit(0);
