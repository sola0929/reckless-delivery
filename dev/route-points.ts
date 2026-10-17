// A level's route, point by point with the heading out of each, and its test spots with their heights. npx tsx dev/route-points.ts <level>
import { LEVELS } from '../src/levels';
const level = LEVELS[process.argv[2]]();
const route = level.route ?? [];
route.forEach(([x, z], i) => {
  const next = route[i + 1];
  console.log(i, Math.round(x), Math.round(z), next ? +Math.atan2(next[0] - x, next[1] - z).toFixed(2) : '');
});
for (const c of level.checkpoints ?? []) console.log('spot', c.name, c.pos.map(Math.round).join(','), c.yaw.toFixed(2), c.y ?? '');
