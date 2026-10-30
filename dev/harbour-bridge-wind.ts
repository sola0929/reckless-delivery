// Level 4's billboard across the drain, in the wind: the truck stood at its foot for half a minute while the gusts come
// down the drain's slot. How many things the wind brings across the billboard, how many of them over its face at the
// height of a load, and how many strike the truck standing there; then crossing it at a walk and at speed.
// npx tsx dev/harbour-bridge-wind.ts
import { harbour } from '../src/levels/harbour';
import { ROOF_SPOTS } from '../src/levels/harbourRoofs';
import { Sim } from '../src/sim/sim';

const level = harbour();
const OVER = { x0: 40, x1: 57, z0: 343, z1: 353 };
{
  const sim = await Sim.create(level);
  sim.teleport(ROOF_SPOTS.front[0] - 9, ROOF_SPOTS.front[1], -Math.PI / 2, 3.7);
  const crossed = new Set<number>(), overFace = new Set<number>();
  const before = sim.cargoValue();
  for (let i = 0; i < 60 * 30; i++) {
    sim.step({ throttle: 0, steer: 0, handbrake: true });
    sim.objects.objects.forEach((o, n) => {
      if (!o.body.isEnabled() || o.body.isSleeping()) return;
      const p = o.body.translation();
      if (p.x > OVER.x0 && p.x < OVER.x1 && p.z > OVER.z0 && p.z < OVER.z1) {
        crossed.add(n);
        if (p.y > 3.6 && p.y < 7) overFace.add(n);
      }
    });
  }
  console.log(`stood 30 s at its foot: ${crossed.size} things came across the billboard's line, ${overFace.size} of them over its face at a load's height; load ${Math.round((sim.cargoValue() / before) * 100)}%`);
}
