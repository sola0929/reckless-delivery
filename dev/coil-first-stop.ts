// The first few coils on the avenue to stop rolling: where, and everything touching them at that moment. npx tsx dev/coil-first-stop.ts
import RAPIER from '@dimforge/rapier3d-compat';
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create({ ...level, traffic: [], crowds: [], riders: [] });
const world = (sim as unknown as { world: RAPIER.World }).world;
const ax = (17.5 - 31) * 16;
sim.teleport(ax - 30, 16 * 60, 0);
const all = sim.objects.objects;
const coils = all.filter((o) => o.desc.kind === 'steelCoil' && o.desc.pos[1] < -50);
const was = coils.map(() => false);
let told = 0;
for (let i = 0; i < 60 * 90 && told < 5; i++) {
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  coils.forEach((c, k) => {
    const rolling = !!(c as unknown as { rolling?: boolean }).rolling;
    if (was[k] && !rolling && told < 5) {
      told++;
      const p = c.body.translation();
      const touching: string[] = [];
      for (let n = 0; n < c.body.numColliders(); n++) {
        world.contactPairsWith(c.body.collider(n), (other) => {
          const body = other.parent();
          const loose = all.find((o) => o.body === body);
          world.contactPair(c.body.collider(n), other, (m) => {
            if (m.numContacts() === 0) return;
            touching.push(`${loose ? loose.desc.kind : body?.isFixed() ? 'fixed' : body?.isKinematic() ? 'kinematic' : 'dynamic'} normal y ${m.normal().y.toFixed(2)} at ${other.translation().x.toFixed(1)},${other.translation().y.toFixed(1)},${other.translation().z.toFixed(1)} groups ${(other.collisionGroups() >>> 16).toString(16)}`);
          });
        });
      }
      console.log(`${(i / 60).toFixed(1)} s: stopped at x ${(p.x - ax).toFixed(1)} from the middle, z ${p.z.toFixed(1)}, y ${p.y.toFixed(1)}; touching: ${touching.join(' | ') || 'nothing'}`);
    }
    was[k] = rolling;
  });
}
process.exit(0);
