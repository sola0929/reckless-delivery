// A level's bounds, start, finish, save point and route, to plan a plan shot by. npx tsx dev/level-bounds.ts <level>
import { LEVELS } from '../src/levels';
const level = LEVELS[process.argv[2]]();
console.log('bounds', JSON.stringify(level.bounds), 'finish', JSON.stringify(level.finish?.pos), 'save', JSON.stringify(level.save?.pos));
console.log('route', JSON.stringify((level.route ?? []).map(([x, z]) => [Math.round(x), Math.round(z)])));
