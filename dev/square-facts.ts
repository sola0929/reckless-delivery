// Level 2's small square off the coil road (columns 26-28, rows 54-55): its fountain, and what stands in it.
import { LEVELS } from '../src/levels';
const level = LEVELS.uptown();
const [x0, x1, z0, z1] = [-168, -136, 856, 888];
console.log('fountains', JSON.stringify((level.fountains ?? []).filter(([x, , z]) => x > x0 && x < x1 && z > z0 && z < z1)));
console.log((level.objects ?? []).filter((o) => o.pos[0] > x0 && o.pos[0] < x1 && o.pos[2] > z0 && o.pos[2] < z1).map((o) => `${o.kind}@${o.pos[0].toFixed(1)},${o.pos[1].toFixed(1)},${o.pos[2].toFixed(1)}`).join(' '));
