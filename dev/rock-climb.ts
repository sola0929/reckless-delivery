// Level 3's toolbox on the river boulder: the truck stopped beside it in the current; out, onto the low rock, the boulder's
// lower block, its top; pick the toolbox up and throw it into the truck. npx tsx dev/rock-climb.ts
import { LEVELS } from '../src/levels';
import { NO_FOOT_INPUT, type FootInput } from '../src/sim/driver';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(LEVELS.quarry());
const PARK = { throttle: 0, steer: 0, handbrake: true };
const tb = sim.cargo.find((c) => c.type.id === 'toolbox')!;
const p0 = tb.body!.translation();
console.log('toolbox', p0.x.toFixed(1), p0.y.toFixed(2), p0.z.toFixed(1), 'mass', tb.body!.mass().toFixed(1));
sim.teleport(110, 953, 0, -1.05);
for (let k = 0; k < 60; k++) sim.step(PARK);
for (let k = 0; k < 30 && sim.driver.mode === 'driving'; k++) sim.step(PARK, { ...NO_FOOT_INPUT, vehiclePressed: true });
const d = sim.driver;
const say = (what: string) => { const t = sim.truck.body.translation(); console.log(what.padEnd(12), d.mode, d.pos.x.toFixed(2), d.pos.y.toFixed(2), d.pos.z.toFixed(2), d.held ? 'holding' : '', ' truck', t.x.toFixed(1), t.z.toFixed(1)); };
say('out');
const go = (x: number, z: number, jump: boolean, label: string) => {
  for (let k = 0; k < 240; k++) {
    const dx = x - d.pos.x, dz = z - d.pos.z, far = Math.hypot(dx, dz);
    if (far < 0.25 && !d.airborne) break;
    sim.step(PARK, { ...NO_FOOT_INPUT, moveX: dx / Math.max(far, 1), moveZ: dz / Math.max(far, 1), jumpPressed: jump && k === 0 });
    if (d.mode === 'down') break;
  }
  for (let k = 0; k < 20; k++) sim.step(PARK);
  say(label);
};
go(107.8, 954.8, false, 'by low rock');
go(106.6, 954.8, true, 'low rock');
go(105.4, 955.0, true, 'lower block');
go(104.5, 955.2, true, 'top');
const t = tb.body!.translation();
console.log('toolbox now', t.x.toFixed(1), t.y.toFixed(2), t.z.toFixed(1), 'pinned', tb.pinned);
go(t.x + 0.5, t.z, false, 'by toolbox');
sim.step(PARK, { ...NO_FOOT_INPUT, grabPressed: true });
for (let k = 0; k < 10; k++) sim.step(PARK);
say('grabbed');
// Throw at the truck's bed: hold the wind-up, aiming at it, then let go.
const bed = sim.truck.body.translation();
const aim = { x: bed.x, z: bed.z - 1 };
let plan = d.plan;
for (let k = 0; k < 200; k++) { sim.step(PARK, { ...NO_FOOT_INPUT, aim, charging: true } as FootInput); plan = d.plan; if (plan?.inBed) break; }
sim.step(PARK, { ...NO_FOOT_INPUT, aim, charging: false } as FootInput);
for (let k = 0; k < 180; k++) sim.step(PARK);
const e = tb.body!.translation();
console.log('throw in bed:', plan?.inBed, ' toolbox at', e.x.toFixed(1), e.y.toFixed(2), e.z.toFixed(1), 'on bed', sim.truck.isOnBed(e), 'found', tb.aboardOnce);
