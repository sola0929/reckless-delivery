// Level 3's radio: the truck on the platform by the second building; on foot across its lower floor, in at the men's
// corner's door, the radio off the cable drum, back to the truck and into its bed. npx tsx dev/radio-fetch.ts
import { LEVELS } from '../src/levels';
import { NO_FOOT_INPUT, type FootInput } from '../src/sim/driver';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(LEVELS.quarry());
const PARK = { throttle: 0, steer: 0, handbrake: true };
const r = sim.cargo.find((c) => c.type.id === 'radio')!;
const p0 = r.body!.translation();
console.log('radio', p0.x.toFixed(2), p0.y.toFixed(2), p0.z.toFixed(2), 'mass', r.body!.mass().toFixed(1));
sim.teleport(2, 1465.5, -Math.PI / 2, 6);
for (let k = 0; k < 60; k++) sim.step(PARK);
for (let k = 0; k < 30 && sim.driver.mode === 'driving'; k++) sim.step(PARK, { ...NO_FOOT_INPUT, vehiclePressed: true });
const d = sim.driver;
const say = (what: string) => console.log(what.padEnd(10), d.mode, d.pos.x.toFixed(2), d.pos.y.toFixed(2), d.pos.z.toFixed(2), d.held ? 'holding' : '');
const go = (x: number, z: number, label: string) => {
  for (let k = 0; k < 600; k++) {
    const dx = x - d.pos.x, dz = z - d.pos.z, far = Math.hypot(dx, dz);
    if (far < 0.3) break;
    sim.step(PARK, { ...NO_FOOT_INPUT, moveX: dx / Math.max(far, 1), moveZ: dz / Math.max(far, 1) });
  }
  say(label);
};
say('out');
for (const [x, z] of [[-9.95, 1466], [-9.95, 1487.1], [-11.6, 1487.1], [-12.2, 1493.2]] as const) go(x, z, 'in');
const q = r.body!.translation();
console.log('radio now', q.x.toFixed(2), q.y.toFixed(2), q.z.toFixed(2));
sim.step(PARK, { ...NO_FOOT_INPUT, grabPressed: true });
for (let k = 0; k < 10; k++) sim.step(PARK);
say('grab');
for (const [x, z] of [[-11.6, 1487.1], [-9.95, 1487.1], [-9.95, 1466], [6.5, 1463]] as const) go(x, z, "back");
const t = sim.truck.body.translation();
const aim = { x: t.x, z: t.z };
let plan = d.plan;
for (let k = 0; k < 200; k++) { sim.step(PARK, { ...NO_FOOT_INPUT, aim, charging: true } as FootInput); plan = d.plan; if (plan?.inBed) break; }
sim.step(PARK, { ...NO_FOOT_INPUT, aim, charging: false } as FootInput);
for (let k = 0; k < 120; k++) sim.step(PARK);
const e = r.body!.translation(); console.log("truck", t.x.toFixed(1), t.z.toFixed(1), "plan", plan?.inBed, "radio", e.x.toFixed(1), e.y.toFixed(2), e.z.toFixed(1));
console.log('in bed', sim.truck.isOnBed(r.body!.translation()), 'found', r.aboardOnce, 'health', (r as any).health?.toFixed?.(0));
