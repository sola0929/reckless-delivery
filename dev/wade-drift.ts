// Wading in level 3's ford: upstream, downstream, standing. npx tsx dev/wade-drift.ts
import { LEVELS } from '../src/levels';
import { NO_FOOT_INPUT } from '../src/sim/driver';
import { Sim } from '../src/sim/sim';
for (const [label, mx] of [['upstream', 1], ['downstream', -1], ['standing', 0]] as const) {
  const sim = await Sim.create(LEVELS.quarry());
  const PARK = { throttle: 0, steer: 0, handbrake: true };
  sim.teleport(100, 953, 0, -1.05);
  for (let k = 0; k < 60; k++) sim.step(PARK);
  for (let k = 0; k < 30 && sim.driver.mode === 'driving'; k++) sim.step(PARK, { ...NO_FOOT_INPUT, vehiclePressed: true });
  const d = sim.driver;
  for (let k = 0; k < 30; k++) sim.step(PARK, { ...NO_FOOT_INPUT, moveZ: 1 }); // off the truck's side, onto the bed
  const x0 = d.pos.x;
  for (let k = 0; k < 60; k++) sim.step(PARK, { ...NO_FOOT_INPUT, moveX: mx });
  console.log(label.padEnd(10), 'm/s', (d.pos.x - x0).toFixed(2), 'y', d.pos.y.toFixed(2), d.mode);
}
