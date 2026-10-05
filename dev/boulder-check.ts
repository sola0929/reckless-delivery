// The truck driven into the boulders on the second hairpin at a fair lick: what the load loses, and whether it stops.
// npx tsx dev/boulder-check.ts
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const boulders = level.objects!.filter((o) => o.kind === 'boulder');
for (const speed of [4, 6, 7, 8, 10, 12]) {
  const sim = await Sim.create({ ...level, traffic: [], crowds: [], riders: [], machines: [] });
  const [bx, , bz] = boulders[1].pos;
  const sx = bx + 10 * Math.sin(2.6), sz = bz + 10 * Math.cos(2.6);
  const yaw = Math.atan2(bx - sx, bz - sz);
  sim.teleport(sx, sz, yaw);
  for (let i = 0; i < 30; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  sim.truck.body.setLinvel({ x: Math.sin(yaw) * speed, y: 0, z: Math.cos(yaw) * speed }, true);
  const before = sim.cargoValue();
  let slowest = Infinity;
  for (let i = 0; i < 60 * 3; i++) {
    sim.step({ throttle: 0.5, steer: 0, handbrake: false });
    if (i > 30) slowest = Math.min(slowest, Math.abs(sim.truck.forwardSpeed()));
  }
  console.log(`into the boulders at ${speed} m/s: load ${Math.round(before)} -> ${Math.round(sim.cargoValue())} (${(((before - sim.cargoValue()) / before) * 100).toFixed(1)}% lost), slowest after the hit ${slowest.toFixed(1)} m/s, boulders moved ${sim.objects.objects.filter((o) => o.desc.kind === 'boulder' && o.knocked).length}`);
}
process.exit(0);
