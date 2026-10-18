// Level 3's island: out of the truck on the dike, a walk to the edge, then a jump at a time toward each stone and the
// island, walking straight at it; then pick up the loudhailer and the same back, holding it. npx tsx dev/island-hop.ts
import { LEVELS } from '../src/levels';
import { NO_FOOT_INPUT, type FootInput } from '../src/sim/driver';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(LEVELS.quarry());
const PARK = { throttle: 0, steer: 0, handbrake: true };
sim.teleport(79.5, 745, Math.PI);
for (let k = 0; k < 90; k++) sim.step(PARK);
for (let k = 0; k < 30 && sim.driver.mode === 'driving'; k++) sim.step(PARK, { ...NO_FOOT_INPUT, vehiclePressed: true });
console.log('truck', JSON.stringify(sim.truck.body.translation()), sim.driver.mode);
for (let k = 0; k < 60; k++) sim.step(PARK);
const d = sim.driver;
const say = (what: string) => console.log(what.padEnd(14), d.mode, d.pos.x.toFixed(2), d.pos.y.toFixed(2), d.pos.z.toFixed(2), d.held ? 'holding' : '');
/** Walk toward a point until there, or until off what they stand on: jump as they go, if asked. */
const go = (x: number, z: number, jump: boolean, label: string) => {
  for (let k = 0; k < 240; k++) {
    const dx = x - d.pos.x, dz = z - d.pos.z, far = Math.hypot(dx, dz);
    if (far < 0.25 && !d.airborne) break;
    const input: FootInput = { ...NO_FOOT_INPUT, moveX: dx / Math.max(far, 1), moveZ: dz / Math.max(far, 1), jumpPressed: jump && k === 0 };
    sim.step(PARK, input);
    if (d.mode === 'down') break;
  }
  for (let k = 0; k < 20; k++) sim.step(PARK);
  say(label);
};
go(82.9, 722.2, false, 'edge');
const path: [number, number][] = [[84.4, 722.2], [87.6, 721.6], [90.8, 722.4], [95.5, 722]];
for (const [x, z] of path) go(x, z, true, `-> ${x}`);
const mp = sim.cargo.find((c) => c.type.id === 'megaphone')!;
const m = mp.body!.translation();
go(m.x - 0.6, m.z, false, 'to megaphone');
sim.step(PARK, { ...NO_FOOT_INPUT, grabPressed: true });
for (let k = 0; k < 10; k++) sim.step(PARK);
say('picked up');
go(94.1, 722.2, false, 'island edge');
for (const [x, z] of [[90.8, 722.4], [87.6, 721.6], [84.4, 722.2], [82.4, 722.2]] as [number, number][]) go(x, z, true, `<- ${x}`);
// Then stand on the first stone while the ball comes round: knocked off?
go(84.4, 722.2, true, 'back on s1');
let knocked = false;
for (let k = 0; k < 60 * 20 && !knocked; k++) { sim.step(PARK); if (d.mode !== 'onFoot') knocked = true; }
say(knocked ? 'knocked' : 'never hit');
