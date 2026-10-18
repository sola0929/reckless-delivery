// The two blocks of level 3's river boulder at (104.3, 955.1): where each is and its top. npx tsx dev/rock-pair.ts
import { LEVELS } from '../src/levels';
const level = LEVELS.quarry();
for (const p of level.props.filter((p) => p.shape === 'box' && Math.hypot(p.pos[0] - 104.3, p.pos[2] - 955.1) < 0.5)) console.log(JSON.stringify(p.pos.map((v) => +v.toFixed(2))), JSON.stringify(p.size.map((v) => +v.toFixed(2))), JSON.stringify(p.rot?.map((v) => +v.toFixed(2))), 'top', (p.pos[1] + p.size[1]).toFixed(2));
