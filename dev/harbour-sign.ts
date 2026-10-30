// Level 4's eatery sign, hung by one corner over the town lane: driven under at a steady speed along the lane, does it
// come down on the truck, and what does that cost the load. Also how far the quay's boats come to one another and to the
// quay's face as they roll. npx tsx dev/harbour-sign.ts
import { harbour } from '../src/levels/harbour';
import { Sim } from '../src/sim/sim';

const level = harbour();
for (const lane of [-2.6, -3.4, -4.0]) for (const kmh of [10, 18, 30]) {
  const sim = await Sim.create(level);
  const want = kmh / 3.6;
  sim.teleport(lane, 58, 0);
  for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const sign = sim.objects.objects.find((o) => o.desc.kind === 'shopSign' && o.desc.letGoWithin !== undefined)!;
  let landed = '', lost = 0;
  for (let i = 0; i < 60 * 6; i++) {
    const p = sim.truck.body.translation(), v = sim.truck.body.linvel();
    const speed = Math.hypot(v.x, v.z);
    const before = sim.cargoValue();
    sim.step({ throttle: speed < want ? 1 : 0, steer: (lane - p.x) * 0.3, handbrake: false });
    lost += before - sim.cargoValue();
    const s = sign.body.translation();
    if (!landed && sign.near && Math.hypot(sign.body.linvel().x, sign.body.linvel().y, sign.body.linvel().z) < 0.2 && i > 30) landed = `sign at rest at ${s.x.toFixed(1)},${s.y.toFixed(1)},${s.z.toFixed(1)}`;
    if (p.z > 100) break;
  }
  console.log(`x ${lane} ${kmh} km/h: ${landed || 'sign still moving'}, load lost ${lost.toFixed(0)} of ${sim.fullValue}`);
}
// The boats: nearest any two hulls' sides and the quay's face come over a minute, from their poses.
{
  const sim = await Sim.create(level);
  const boats = sim.rigs.list.filter((r) => r.desc.hull === 'vessel' && r.desc.heave && r.desc.pos[0] > 0 && r.desc.pos[0] < 40 && r.desc.pos[2] < 232);
  let quay = Infinity, apart = Infinity;
  for (let i = 0; i < 60 * 60; i++) {
    sim.step({ throttle: 0, steer: 0, handbrake: true });
    for (const b of boats) {
      const roll = 2 * Math.asin(Math.min(1, Math.abs(b.pose!.rot.z))) ;
      // The tyres' outside at the rail's height either side, swung by the roll.
      const reach = b.desc.half![0] + 0.46 + Math.sin(roll) * 1.2;
      quay = Math.min(quay, b.pose!.x - reach - 8);
      for (const o of boats) if (o !== b && Math.abs(o.desc.pos[2] - b.desc.pos[2]) < 6 && o.desc.pos[0] > b.desc.pos[0]) {
        const r2 = 2 * Math.asin(Math.min(1, Math.abs(o.pose!.rot.z)));
        apart = Math.min(apart, o.pose!.x - b.pose!.x - reach - (o.desc.half![0] + 0.46 + Math.sin(r2) * 1.2));
      }
    }
  }
  console.log(`boats: ${boats.length}; closest to the quay's face ${quay.toFixed(2)} m, to each other ${apart.toFixed(2)} m (tyre to tyre, rolled)`);
}
