// The tutorial's broken bridge: from a standstill at the crossing's stop line, the train gone by, flat out with the boost and without, does the
// truck clear the canal? It must with the boost, and must not without.
// npx tsx dev/tutorial-jump.ts
import { tutorial, RX, TRACK_Z, CANAL1 } from '../src/levels/tutorial';
import { Sim } from '../src/sim/sim';

const level = tutorial();
for (const [from, label] of [[TRACK_Z - 7, 'from the stop line, where a retry starts too']] as const) {
  for (const boost of [false, true]) {
    const sim = await Sim.create({ ...level, crowds: [] });
    sim.teleport(RX, from, 0);
    // Waiting for the train, as at the line one would: until its lamps have gone red and out again.
    let red = false;
    for (let i = 0; i < 60 * 12; i++) {
      sim.step({ throttle: 0, steer: 0, handbrake: true });
      if (sim.trains.warning(0)) red = true;
      else if (red && i > 90) break;
    }
    let top = 0, mishap: string | null = null, landed = false;
    for (let i = 0; i < 60 * 8 && !mishap && !landed; i++) {
      sim.step({ throttle: 1, steer: 0, handbrake: false, boost });
      top = Math.max(top, sim.truck.forwardSpeed());
      mishap = sim.takeMishap();
      const p = sim.truck.body.translation();
      if (p.z > CANAL1 + 6 && p.y > 0) landed = true;
    }
    console.log(`${label}, ${boost ? 'boost' : 'throttle only'}: ${landed ? 'over' : mishap ?? 'neither'}, top ${(top * 3.6).toFixed(0)} km/h, load ${Math.round(sim.cargoValue() / sim.fullValue * 100)}%`);
  }
}
process.exit(0);
