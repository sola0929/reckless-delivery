// Off the market roof's west edge into the ice plant's bay, and off the fallen end bay's open south side into it: what
// is left of the load, at a few speeds, at a few places along the edge.
// npx tsx dev/harbour-bay-drop.ts
import { harbour } from '../src/levels/harbour';
import { EAVE } from '../src/levels/harbourMarket';
import { Sim } from '../src/sim/sim';

const starts: [string, number, number, number, number, number?][] = [
  ['roof z244', -16, 244, -Math.PI / 2, EAVE + 1.2],
  ['roof z250', -16, 250, -Math.PI / 2, EAVE + 1.2],
  ['roof z256', -16, 256, -Math.PI / 2, EAVE + 1.2],
  ['roof z262', -16, 262, -Math.PI / 2, EAVE + 1.2],
  ['roof z268', -16, 268, -Math.PI / 2, EAVE + 1.2],
  ['roof z274', -16, 274, -Math.PI / 2, EAVE + 1.2],
  ['roof z280', -16, 280, -Math.PI / 2, EAVE + 1.2],
  ['slope x-24', -24, 291, Math.PI, 4.2],
  ['slope x-30', -30, 291, Math.PI, 2.9],
  // Down the slope from its top, steered off its open south side.
  ['down left', -21, 289, -Math.PI / 2, 4.7, 1],
  ['down right', -21, 289, -Math.PI / 2, 4.7, -1],
  ['down left2', -21, 287, -Math.PI / 2, 4.7, 0.4],
];
let sum = 0, n = 0;
for (const kmh of (process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [15, 25, 35])) {
  const line: string[] = [];
  for (const [name, x, z, yaw, y, steer = 0] of starts) {
    const sim = await Sim.create(harbour());
    sim.teleport(x, z, yaw, y);
    for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
    for (let i = 0; i < 60 * 9; i++) {
      const v = sim.truck.forwardSpeed();
      sim.step({ throttle: v < kmh / 3.6 ? 1 : 0, steer: i > 30 && i < 90 ? steer : 0, handbrake: false });
    }
    for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
    const kept = Math.round((sim.cargoValue() / sim.fullValue) * 100), p = sim.truck.body.translation();
    sum += kept; n++;
    line.push(`${name} ${kept}% (${p.x.toFixed(0)},${p.y.toFixed(1)},${p.z.toFixed(0)})`);
  }
  console.log(`${kmh} km/h: ${line.join('  ')}`);
}
console.log(`mean kept ${(sum / n).toFixed(0)}%`);
