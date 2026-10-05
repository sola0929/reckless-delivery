// Level 2's market lane: how far it is to the walls either side, and where the kerbs are, row by row.
import RAPIER from '@dimforge/rapier3d-compat';
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create(level);
const world = (sim as unknown as { world: RAPIER.World }).world;
for (let i = 0; i < 3; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const CELL = 16, xOf = (c: number) => (17.5 - c) * CELL, zOf = (r: number) => r * CELL;
for (let z = zOf(52) + 8; z <= zOf(58); z += 4) {
  const x0 = xOf(19);
  const g = (x: number) => { const h = world.castRay(new RAPIER.Ray({ x, y: 400, z }, { x: 0, y: -1, z: 0 }), 600, true); return h ? 400 - h.timeOfImpact : NaN; };
  const base = g(x0);
  let west = 0, east = 0;
  for (let d = 0; d < 12; d += 0.25) if (g(x0 + d) - base > 3) { west = d; break; }
  for (let d = 0; d < 12; d += 0.25) if (g(x0 - d) - base > 3) { east = d; break; }
  let kw = 0, ke = 0;
  for (let d = 0; d < 12; d += 0.25) if (g(x0 + d) - base > 0.08) { kw = d; break; }
  for (let d = 0; d < 12; d += 0.25) if (g(x0 - d) - base > 0.08) { ke = d; break; }
  if (z === zOf(54)) console.log(Array.from({ length: 49 }, (_, i) => `${(i / 2 - 12).toFixed(1)}:${g(x0 + i / 2 - 12).toFixed(1)}`).join(' '));
  console.log(`z ${z} (row ${(z / CELL).toFixed(2)}): +x wall ${west} kerb ${kw}; -x wall ${east} kerb ${ke}`);
}
process.exit(0);
