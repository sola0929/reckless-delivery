// The terrain's tag and height at some points of level 3. npx tsx dev/tag-at.ts
import { LEVELS } from '../src/levels';
const level = LEVELS.quarry();
for (const [x, z] of [[96, 940], [104, 955], [80, 940], [90, 600], [96, 1040]]) console.log(x, z, JSON.stringify(level.terrain?.surface?.(x, z)));
