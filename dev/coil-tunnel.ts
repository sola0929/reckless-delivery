// Level 2's coil hill: the truck driven flat out up it into the coils, a few times; how often a coil's middle ends up inside
// the truck's own box (through the cab, into the load). npx tsx dev/coil-tunnel.ts
import { Quaternion, Vector3 } from 'three';
import { LEVELS } from '../src/levels';
import { Sim } from '../src/sim/sim';
let inside = 0, hits = 0;
const v = new Vector3(), q = new Quaternion();
for (let run = 0; run < 4; run++) {
  const sim = await Sim.create(LEVELS.uptown());
  const coils = sim.objects.objects.filter((o) => o.body.mass() > 2000);
  sim.teleport(-219 + (run % 2 ? 2 : -2), 845 + run * 30, 0);
  for (let k = 0; k < 60 * 7; k++) {
    sim.step({ throttle: 1, steer: 0, handbrake: false, boost: true });
    const t = sim.truck.body.translation(), r = sim.truck.body.rotation();
    q.set(r.x, r.y, r.z, r.w).invert();
    for (const c of coils) {
      const p = c.body.translation();
      v.set(p.x - t.x, p.y - t.y, p.z - t.z).applyQuaternion(q);
      if (Math.abs(v.x) < 1.6 && Math.abs(v.z) < 4.5 && Math.abs(v.y) < 2.5) hits++;
      // Its middle within the cab, or down among the load below the top of the bed's walls: through, not on.
      if (Math.abs(v.x) < 1.1 && ((v.z > 1.9 && v.z < 3.7 && v.y > 0.2 && v.y < 1.8) || (v.z > -3.6 && v.z < 1.8 && v.y > 0.2 && v.y < 1.25))) { inside++; if (inside < 12) { const lv = c.body.linvel(); console.log(`run ${run} step ${k} local ${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)} rolling ${c.rolling} knocked ${c.knocked} ccd ${c.body.isCcdEnabled()} coil v ${lv.x.toFixed(1)},${lv.y.toFixed(1)},${lv.z.toFixed(1)} truck v ${sim.truck.forwardSpeed().toFixed(1)} at ${t.x.toFixed(1)},${t.y.toFixed(1)},${t.z.toFixed(1)} enabled ${sim.truck.body.isEnabled()} result ${sim.result?.failure ?? (sim.result ? "done" : "none")} sleeping ${sim.truck.body.isSleeping()} coilgroups ${(c.body.collider(0).collisionGroups()>>>0).toString(16)} enabledColl ${c.body.collider(0).isEnabled()}`); const w = (sim as any).world; for (let n = 0; n < c.body.numColliders(); n++) w.contactPairsWith(c.body.collider(n), (o: any) => { if (o.parent() !== sim.truck.body) return; w.contactPair(c.body.collider(n), o, (m: any) => console.log("   pair with truck: contacts", m.numContacts(), "normal", m.normal().x.toFixed(2), m.normal().y.toFixed(2), m.normal().z.toFixed(2))); }); } }
    }
  }
}
console.log('steps a coil was touching close:', hits, ' steps a coil was inside the truck:', inside);
