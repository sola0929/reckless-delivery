// How long each level's way is, start to delivery, and its par time. npx tsx dev/route-lengths.ts
import { LEVELS } from '../src/levels/index';
for (const id of ['city', 'uptown'] as const) {
  const level = LEVELS[id]();
  const way = level.route ?? [];
  let length = 0;
  for (let i = 1; i < way.length; i++) length += Math.hypot(way[i][0] - way[i - 1][0], way[i][1] - way[i - 1][1]);
  console.log(`${id} (${level.name}): way ${Math.round(length)} m, par ${level.par} s`);
}
process.exit(0);
