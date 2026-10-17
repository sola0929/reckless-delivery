// Each delivery's test spots, and its load: count and worth. npx tsx dev/level-facts.ts
import { LEVELS } from '../src/levels';
import { CARGO_TYPES } from '../src/sim/cargo-types';
for (const id of ['tutorial', 'hillcity', 'uptown', 'quarry']) {
  const level = LEVELS[id]();
  const value = level.cargo.reduce((sum, { type }) => sum + (CARGO_TYPES as Record<string, { value: number }>)[type].value, 0);
  console.log(id, level.cargo.length, value, JSON.stringify((level.checkpoints ?? []).map((c) => [c.name, Math.round(c.pos[0]), Math.round(c.pos[1]), +c.yaw.toFixed(2)])));
}
