// Level 3's proving ground, the dike: where along it each machine's moving parts come over the road, low enough to hit a
// truck, through a long while of their rounds. Shows the stretches no machine reaches, where a truck can wait. npx tsx dev/lab-reach.ts
import { quarryLab } from '../src/levels/quarryLab';
import { Sim } from '../src/sim/sim';
const level = quarryLab();
const sim = await Sim.create({ ...level, crowds: [], traffic: [] });
sim.teleport(112, 70, 0);
// The truck out of the way, but near enough for the machines to be awake: lifted off above the far pond.
sim.truck.body.setTranslation({ x: 112, y: 40, z: 70 }, true);
sim.truck.body.setGravityScale(0, true);
const reach = new Map<number, [number, number]>();
const DIKE_TOP = 2.2;
for (let i = 0; i < 60 * 25; i++) {
  sim.truck.body.setTranslation({ x: 112, y: 40, z: 70 }, true);
  sim.truck.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  sim.rigs.list.forEach((rig, n) => {
    for (let k = 1; k < rig.parts.length; k++) {
      const body = rig.parts[k].body;
      for (let c = 0; c < body.numColliders(); c++) {
        const col = body.collider(c);
        const p = col.translation();
        const aabb = col.shape as unknown as { halfExtents?: { x: number; y: number; z: number }; radius?: number };
        const r = aabb.halfExtents ? Math.min(aabb.halfExtents.x, aabb.halfExtents.z) : aabb.radius ?? 0.5;
        const low = p.y - (aabb.halfExtents?.y ?? aabb.radius ?? 0.5);
        // Over the road (within the dike's width of its middle there, near enough) and low enough to meet a truck 3 m high.
        if (low > DIKE_TOP + 3.0) continue;
        const mid = level.rigs![n].pos[0];
        const off = Math.abs(p.x - 112);
        if (off > 7.5) continue;
        const [a, b] = reach.get(n) ?? [Infinity, -Infinity];
        reach.set(n, [Math.min(a, p.z - r), Math.max(b, p.z + r)]);
        void mid;
      }
    }
  });
}
const rows = [...reach.entries()].map(([n, [a, b]]) => ({ kind: level.rigs![n].kind, at: level.rigs![n].pos[2], a, b })).sort((p, q) => p.a - q.a);
for (const r of rows) console.log(`${r.kind.padEnd(9)} at ${r.at}: z ${r.a.toFixed(1)} .. ${r.b.toFixed(1)}`);
