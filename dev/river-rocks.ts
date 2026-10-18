// Level 3's river crossing: the boulders in its middle stretch, with their tops, and the water's surface there.
import { LEVELS } from '../src/levels';
const level = LEVELS.quarry();
const rocks = level.props.filter((p) => p.shape === 'box' && (p.color === 0x7d7a72 || p.color === 0x858278) && p.size[1] > 0.7 && p.size[1] < 1.25 && p.pos[2] > 900 && p.pos[2] < 980);
for (const r of rocks) console.log(r.pos.map((v) => v.toFixed(1)).join(','), 'half', r.size.map((v) => v.toFixed(2)).join(','), 'top', (r.pos[1] + r.size[1]).toFixed(2), 'turn', r.rot?.[1].toFixed(2));
console.log('fords', JSON.stringify(level.fords?.map((f) => ({ pos: f.pos, half: f.half, surface: f.surface, flow: f.flow }))));
