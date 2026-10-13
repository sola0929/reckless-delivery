// How the river handles the truck, against the same in still water, with its boulders cleared away: carried sideways
// standing; and with the same throttle, wheel hard over upstream (left) and downstream (right), how far it turns and how
// fast it is going after. npx tsx dev/river-push.ts
import { quarryLab } from '../src/levels/quarryLab';
import { Sim } from '../src/sim/sim';
const level1 = quarryLab();
const level0 = { ...level1, props: level1.props.filter((p) => !(Math.abs(p.pos[0] - 176) < 14 && p.pos[1] < 1.5 && p.pos[2] > -8 && p.pos[2] < 152)) };
const calm = { ...level0, fords: level0.fords!.map((f) => ({ ...f, flow: [0, 0] as [number, number] })) };
const heading = (sim: Sim) => { const r = sim.truck.body.rotation(); return (Math.atan2(2 * (r.x * r.z + r.w * r.y), 1 - 2 * (r.x * r.x + r.y * r.y)) * 180) / Math.PI; };
for (const [name, level] of [['river', level0], ['still', calm]] as const) {
  const out: string[] = [];
  for (const [what, throttle, steer] of [['standing', 0, 0], ['upstream', 0.5, 1], ['downstream', 0.5, -1]] as const) {
    const sim = await Sim.create({ ...level, crowds: [], traffic: [] });
    // Down into it off the ramp and stopped in it, a little way in.
    sim.teleport(176, -16, 0);
    for (let i = 0; i < 30; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
    for (let i = 0; i < 400 && sim.truck.body.translation().z < 6; i++) sim.step({ throttle: 0.9, steer: 0, handbrake: false });
    for (let i = 0; i < 90; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
    // Up to 4 m/s, then the wheel over (or, standing, let go).
    for (let i = 0; i < 300 && throttle && sim.truck.forwardSpeed() < 4; i++) sim.step({ throttle: 0.9, steer: 0, handbrake: false });
    const x0 = sim.truck.body.translation().x, h0 = heading(sim);
    for (let i = 0; i < (throttle ? 100 : 180); i++) sim.step({ throttle, steer, handbrake: false });
    const v = sim.truck.body.linvel();
    out.push(`${what}: ${(sim.truck.body.translation().x - x0).toFixed(1)} m across, turned ${(heading(sim) - h0).toFixed(0)}°, going ${Math.hypot(v.x, v.z).toFixed(1)} m/s (${v.x.toFixed(1)} across)`);
  }
  console.log(`${name}: ${out.join(' | ')}`);
}
process.exit(0);
