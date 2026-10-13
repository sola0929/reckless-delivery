// Level 3's proving ground, the stockpiles: the truck driven along a lane with its left wheels so far up the heap beside it,
// on each of the three heaps. How far over it leans, how much of the load it keeps, and whether it goes over.
// npx tsx dev/lab-heaps.ts
import { quarryLab } from '../src/levels/quarryLab';
import { Sim } from '../src/sim/sim';
const level = quarryLab();
// Straight stretches of each heap's lane: its middle X, half its width, and where it runs.
const stretches = [
  { name: '緩（8/18/35°）', x: 16, half: 4, z0: -10, z1: 38 },
  { name: '中（10/25/45°）', x: 16, half: 4, z0: 102, z1: 145 },
  { name: '陡（15/33/55°）', x: 16, half: 4, z0: 202, z1: 234 },
];
for (const s of stretches) {
  const row: string[] = [];
  for (const up of [0.5, 1.5, 2.5, 3.5, 4.5]) {
    const sim = await Sim.create({ ...level, traffic: [], crowds: [], machines: [], objects: [] });
    // Left of the way north is +X: the truck's left wheels this far past the lane's edge.
    const x = s.x + s.half + up - 1.3;
    sim.teleport(s.x, s.z0, 0);
    for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
    let lean = 0, over = false, reached = -9;
    for (let i = 0; i < 60 * 14; i++) {
      const p = sim.truck.body.translation();
      if (p.z > s.z1) break;
      const r = sim.truck.body.rotation();
      // How far over: the truck's up against the world's.
      const upY = 1 - 2 * (r.x * r.x + r.z * r.z);
      if (i > 60) lean = Math.max(lean, (Math.acos(Math.min(1, upY)) * 180) / Math.PI);
      if (upY < 0.3) over = true;
      const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
      const tx = x, tz = p.z + 8;
      const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
      const speed = sim.truck.forwardSpeed();
      sim.step({ throttle: speed < 3.5 ? 0.7 : 0, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false });
      if (i > 60) reached = Math.max(reached, p.x + 1.3 - (s.x + s.half));
    }
    row.push(`aim ${up} m up (got ${reached.toFixed(1)}): lean ${lean.toFixed(0)}°, load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%${over || sim.result?.failure ? ' OVER' : ''}`);
  }
  console.log(`${s.name}\n  ${row.join('\n  ')}`);
}
process.exit(0);
