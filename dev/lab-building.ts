// Level 3's proving ground: the truck driven up through the building, ramp by ramp, to the roof. Does it get up, and how
// much of the load is left? npx tsx dev/lab-building.ts
import { quarryLab } from '../src/levels/quarryLab';
import { Sim } from '../src/sim/sim';
const level = quarryLab();
const sim = await Sim.create({ ...level, traffic: [], crowds: [] });
const E = 280, R = 9.5;
const arc = (cx: number, cz: number, from: number, to: number): [number, number][] => Array.from({ length: 7 }, (_, k) => {
  const a = from + ((to - from) * (k + 1)) / 7;
  return [cx + Math.sin(a) * R, cz + Math.cos(a) * R];
});
const W = 267.25, Ea = 292.75, Z0 = 143, Z1 = 169;
const way: [number, number][] = [
  [304, 60], [304, 120], [300, 131], [294, 134], [285, 133.5], ...arc(E - 3.25, Z0, Math.PI, Math.PI * 1.5),
  [W, 156], [W, Z1], ...arc(E - 3.25, Z1, Math.PI * 1.5, Math.PI * 2), [E + 3.25, Z1 + 9.5], ...arc(E + 3.25, Z1, 0, Math.PI / 2),
  [Ea, 156], [Ea, Z0], ...arc(E + 3.25, Z0, Math.PI / 2, Math.PI), [E - 3.25, Z0 - 9.5], ...arc(E - 3.25, Z0, Math.PI, Math.PI * 1.5),
  [W, 156], [W, Z1], ...arc(E - 3.25, Z1, Math.PI * 1.5, Math.PI * 2), [E + 6, 177],
];
sim.teleport(304, -12, 0);
for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
let leg = 0, i = 0, still = 0, top = 0;
for (; i < 60 * 240 && leg < way.length - 1 && still < 60 * 10 && !sim.result; i++) {
  const p = sim.truck.body.translation();
  const r = sim.truck.body.rotation();
  while (leg < way.length - 1 && Math.hypot(way[leg + 1][0] - p.x, way[leg + 1][1] - p.z) < 3.5) {
    leg++;
    if (leg % 4 === 0) console.log(`  at point ${leg}: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} after ${(i / 60).toFixed(0)} s`);
  }
  top = Math.max(top, p.y);
  const [ax, az] = way[Math.min(leg, way.length - 2)];
  const [cx, cz] = way[Math.min(leg + 1, way.length - 1)];
  const length = Math.hypot(cx - ax, cz - az) || 1;
  const t = Math.min(1, ((p.x - ax) * (cx - ax) + (p.z - az) * (cz - az)) / (length * length) + 3 / length);
  const tx = ax + (cx - ax) * t, tz = az + (cz - az) * t;
  const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
  const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
  const speed = sim.truck.forwardSpeed();
  const want = Math.abs(off) > 0.3 ? 2.5 : 4.5;
  sim.step({ throttle: speed < want ? 0.9 : speed > want + 1 ? -0.7 : 0, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false });
  still = Math.abs(speed) < 0.3 ? still + 1 : 0;
}
for (let n = 0; n < 60 * 4 && !sim.result; n++) sim.step({ throttle: -1, steer: 0, handbrake: true });
const end = sim.truck.body.translation();
console.log(`${sim.result ? (sim.result.failure ? `FAILED (${sim.result.failure})` : 'DELIVERED') : `stopped at point ${leg} of ${way.length - 1}`}: ${end.x.toFixed(1)}, ${end.y.toFixed(1)}, ${end.z.toFixed(1)}, highest ${top.toFixed(1)}, ${(i / 60).toFixed(0)} s; load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%`);
process.exit(0);
