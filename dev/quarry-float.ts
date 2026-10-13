// Level 3: people standing in the air or in the floor, and loose things put well above or below what is under them: the
// ground, or a floor, a ramp, a deck, whatever solid is there (found by a ray down through the level's fixed things).
// npx tsx dev/quarry-float.ts
import RAPIER from '@dimforge/rapier3d-compat';
import { GROUP, groups } from '../src/config';
import { quarry } from '../src/levels/quarry';
import { Sim } from '../src/sim/sim';
const l = quarry();
const sim = await Sim.create({ ...l, crowds: [], traffic: [] });
sim.step({ throttle: 0, steer: 0, handbrake: true });
/** The top of whatever fixed is under a place, from a little above the height given. */
const under = (x: number, z: number, y: number) => {
  const hit = sim.world.castRay(new RAPIER.Ray({ x, y: y + 0.6, z }, { x: 0, y: -1, z: 0 }), 60, true, undefined, groups(GROUP.all, GROUP.ground));
  return hit ? y + 0.6 - hit.timeOfImpact : -99;
};
for (const c of l.crowds ?? []) {
  const [x0, z0, x1, z1] = c.area;
  const at = [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]].map(([x, z]) => under(x, z, c.y) - c.y);
  const worst = at.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
  if (Math.abs(worst) > 0.5) console.log(`crowd at ${((x0 + x1) / 2).toFixed(0)},${((z0 + z1) / 2).toFixed(0)} y ${c.y.toFixed(1)}: what is under it differs by ${worst.toFixed(1)} m`);
}
for (const o of l.objects ?? []) {
  const d = o.pos[1] - under(o.pos[0], o.pos[2], o.pos[1]);
  if (d > 1.2 || d < -0.3) console.log(`${o.kind} at ${o.pos[0].toFixed(0)},${o.pos[2].toFixed(0)}: ${d.toFixed(1)} m ${d > 0 ? 'above' : 'below'} what is under it`);
}
process.exit(0);
