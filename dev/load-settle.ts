// Level 2's load left standing for ten seconds, then driven up the bus street a little: does it stay put and whole?
// npx tsx dev/load-settle.ts
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create({ ...level, traffic: [], crowds: [], riders: [] });
const start = sim.cargoValue();
for (let i = 0; i < 600; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const settled = sim.cargoValue();
for (let i = 0; i < 600; i++) sim.step({ throttle: 0.6, steer: 0, handbrake: false });
for (let i = 0; i < 180; i++) sim.step({ throttle: -1, steer: 0, handbrake: false });
console.log(`load worth $${Math.round(start)} at the start (${sim.cargo.length} items); $${Math.round(settled)} after standing 10 s; $${Math.round(sim.cargoValue())} after 10 s up the street and a hard stop; ${sim.cargoOnTruck()}/${sim.cargo.length} aboard`);
process.exit(0);
