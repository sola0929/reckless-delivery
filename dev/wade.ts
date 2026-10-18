// On foot in the river's ford: how high they stand, whether they count as on the ground. npx tsx dev/wade.ts
import { LEVELS } from '../src/levels';
import { NO_FOOT_INPUT } from '../src/sim/driver';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(LEVELS.quarry());
const PARK = { throttle: 0, steer: 0, handbrake: true };
sim.teleport(110, 953, 0, -1.05);
for (let k = 0; k < 60; k++) sim.step(PARK);
for (let k = 0; k < 30 && sim.driver.mode === 'driving'; k++) sim.step(PARK, { ...NO_FOOT_INPUT, vehiclePressed: true });
const d = sim.driver as any;
for (let k = 0; k < 120; k++) {
  sim.step(PARK, { ...NO_FOOT_INPUT, moveX: -1, moveZ: 0.3, jumpPressed: k === 60 });
  if (k % 10 === 0 || (k > 58 && k < 75 && k % 3 === 0)) console.log(k, d.mode, d.pos.x.toFixed(2), d.pos.y.toFixed(2), 'air', d.airborne, 'below', d.blockedBelow, 'speed', d.speed?.toFixed?.(2), 'sinking', d.sinking);
}
