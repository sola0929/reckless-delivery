// The quarry's machines going about for a minute; and a crash barrier on the way down hit slowly and then fast.
// npx tsx dev/quarry-check.ts
import { Quaternion, Vector3 } from 'three';
import { uptown } from '../src/levels/uptown';
import { heightAt } from '../src/levels/terrain';
import { Sim } from '../src/sim/sim';
const level = uptown();
const h = (x: number, z: number) => heightAt(level.terrain!, x, z);
{
  const sim = await Sim.create({ ...level, traffic: [], crowds: [], riders: [] });
  const ms = sim.machines.list;
  const was = ms.map((m) => ({ x: m.x, z: m.z }));
  let path = ms.map(() => 0), swung = ms.map(() => 0), worst = 0;
  const t0 = performance.now();
  for (let i = 0; i < 60 * 60; i++) {
    const before = ms.map((m) => ({ x: m.x, z: m.z, s: m.swing }));
    const s0 = performance.now();
    sim.step({ throttle: 0, steer: 0, handbrake: true });
    worst = Math.max(worst, performance.now() - s0);
    ms.forEach((m, k) => {
      path[k] += Math.hypot(m.x - before[k].x, m.z - before[k].z);
      swung[k] += Math.abs(m.swing - before[k].s);
    });
  }
  console.log(`machines for 60 s (${((performance.now() - t0) / 3600).toFixed(1)} ms a step, ${worst.toFixed(1)} at worst):`);
  ms.forEach((m, k) => {
    const p = m.body.translation();
    console.log(`  ${m.desc.kind}: drove ${path[k].toFixed(0)} m, now ${Math.hypot(m.x - was[k].x, m.z - was[k].z).toFixed(0)} m from its start, swung ${(swung[k] * 57.3).toFixed(0)} deg, ${(p.y - h(p.x, p.z)).toFixed(2)} m above the ground`);
  });
}
for (const speed of [3, 10]) {
  const sim = await Sim.create({ ...level, traffic: [], crowds: [], riders: [], machines: [] });
  // On the first leg, going down it and veering at the barrier on its downhill side.
  const z = 1015;
  const x = -302 + 0.5;
  const yaw = Math.PI + 0.5;
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);
  sim.truck.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
  sim.truck.body.setTranslation({ x, y: h(x, z) + 1.2, z }, true);
  sim.truck.body.setLinvel({ x: Math.sin(yaw) * speed, y: 0, z: Math.cos(yaw) * speed }, true);
  const rails = sim.objects.objects.filter((o) => o.desc.kind === 'guardrail');
  let lowest = Infinity, fastest = 0;
  for (let i = 0; i < 60 * 4; i++) {
    sim.step({ throttle: speed > 5 ? 1 : 0, steer: 0, handbrake: false });
    lowest = Math.min(lowest, sim.truck.body.translation().y);
    const v = sim.truck.body.linvel();
    fastest = Math.max(fastest, Math.hypot(v.x, v.z));
  }
  const p = sim.truck.body.translation();
  console.log(`barrier hit at ${speed} m/s (fastest ${fastest.toFixed(1)}): ${rails.filter((r) => r.knocked).length} barrier lengths knocked; truck now at x ${p.x.toFixed(1)} (barrier at -305.7), height ${p.y.toFixed(1)} (started ${h(x, z).toFixed(1)}, lowest ${lowest.toFixed(1)})`);
}
process.exit(0);
