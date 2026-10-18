// Level 1's route past the building site in the roadworks, and the low walls and fences there. npx tsx dev/site-route.ts
import { LEVELS } from '../src/levels';
const l = LEVELS.hillcity();
for (const [x, z] of l.route ?? []) if (x < -60 && x > -180 && z > 400 && z < 470) console.log('route', x.toFixed(1), z.toFixed(1));
const fences = l.props.filter((p) => !p.ghost && p.pos[0] < -80 && p.pos[0] > -125 && p.pos[2] > 420 && p.pos[2] < 460 && (p.size[0] > 3 || p.size[2] > 3) && p.size[1] < 1.5);
for (const p of fences.slice(0, 30)) console.log('wall', p.pos.map((v) => +v.toFixed(1)).join(','), p.size.map((v) => +v.toFixed(2)).join(','));
