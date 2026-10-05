// Things rolling down the avenue with nothing in their way: how straight, how fast and how far they get,
// made sharp or rounded, kept straight or left to themselves. npx tsx dev/roll-trial.ts
import { slopes } from '../src/levels/slopes';
import { Sim } from '../src/sim/sim';
for (const [name, sharp, free] of [['sharp, left alone', true, true], ['rounded, left alone', false, true], ['rounded, kept straight', false, false]] as const) {
  const level = slopes();
  level.traffic = [];
  level.rollers![0] = { ...level.rollers![0], sharp, free };
  const sim = await Sim.create(level);
  const pool = sim.objects.objects.slice(level.objects!.length);
  const foot = new Set<number>();
  let hop = 0;
  for (let i = 0; i < 60 * 45; i++) {
    sim.step({ throttle: 0, steer: 0, handbrake: true });
    pool.forEach((o, n) => { const p = o.body.translation(); if (p.y > -20 && p.z < 75) foot.add(n); if (o.rolling) hop = Math.max(hop, o.body.linvel().y); });
  }
  const out = pool.filter((o) => o.body.translation().y > -20);
  const rolling = out.filter((o) => o.rolling);
  console.log(`${name}: ${foot.size} reached the foot in 45 s; ${out.length - rolling.length} of ${out.length} ran into something; widest ${Math.max(0, ...rolling.map((o) => Math.abs(o.body.translation().x))).toFixed(1)} m from the middle (let go within 6.4); fastest ${Math.max(0, ...rolling.map((o) => Math.hypot(o.body.linvel().x, o.body.linvel().z))).toFixed(1)} m/s; most turned ${Math.max(0, ...rolling.map((o) => { const r = o.body.rotation(); const ax = 2 * (r.x * r.y - r.w * r.z), az = 2 * (r.y * r.z + r.w * r.x); return Math.abs(Math.atan2(az, Math.abs(ax)) * 57.3); })).toFixed(0)} deg off square; highest hop ${hop.toFixed(1)} m/s`);
}
process.exit(0);
