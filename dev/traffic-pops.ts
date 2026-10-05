// Where on a level its traffic appears or vanishes (a car moving further in one step than it could drive), and how near the
// way through each place is. npx tsx dev/traffic-pops.ts <level>
import { LEVELS } from '../src/levels/index';
import { Sim } from '../src/sim/sim';
const level = LEVELS[process.argv[2] ?? 'uptown']();
const sim = await Sim.create(level);
const route = level.route!;
const offRoute = (x: number, z: number) => Math.min(...route.slice(1).map((b, n) => {
  const a = route[n]; const dx = b[0] - a[0], dz = b[1] - a[1]; const L = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}));
const was = new Map<unknown, { x: number; z: number }>();
const pops = new Map<string, number>();
for (let i = 0; i < 60 * 90; i++) {
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  for (const car of sim.traffic.cars) {
    const p = car.body.translation();
    const b = was.get(car);
    if (b && Math.hypot(p.x - b.x, p.z - b.z) > 3) for (const q of [b, p]) {
      const d = offRoute(q.x, q.z);
      if (d < 40) { const k = `${q.x.toFixed(0)},${q.z.toFixed(0)} (${d.toFixed(0)} m from the way)`; pops.set(k, (pops.get(k) ?? 0) + 1); }
    }
    was.set(car, { x: p.x, z: p.z });
  }
}
console.log(pops.size ? [...pops].map(([k, n]) => `${k} x${n}`).join('\n') : 'no car appears or vanishes within 40 m of the way');
process.exit(0);
