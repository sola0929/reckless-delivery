import { city, cityCell } from './city';
import { Heights, heightOf, lift, type Profile } from './lift';
import type { LevelDef } from './types';

// The city of the first level, as it is, on a hillside: the same streets, blocks and obstacles,
// with the ground climbing and falling between them. A trial of putting height into a map drawn
// on squares, not a level in its own right yet.
//
// Where it slopes (rows of the city's map, counted from the south; each is 16 m):
//   rows  6 -  8   the road out of the depot climbs to the boulevard: 8 m, 17%
//   rows 14 - 17   the market lane climbs: 9 m, 14%
//   rows 20 - 21   and comes down again to the river: 6 m, 19%
//   rows 29 - 30   the street with the humps climbs to the busy street: 5 m, 16%
// Everything else is level: the depot, the boulevard, the river and its bridge, the roadworks,
// the busy street, the railway and the old town.
//
// And one place where the ground differs from east to west: beside the road out of the depot
// the blocks do not slope with it. Those on its east are a terrace at the height of the top, held
// by a wall the road climbs beside; those on its west stay down at the height of the depot, so
// that the road rises above them with a drop at its edge.

const CELL = 16;
/** The north edge of a row. */
const edge = (row: number) => (row + 0.5) * CELL;
/** The two edges of a run of columns, in X: the lesser first. Columns run the other way from X. */
const columns = (from: number, to: number): [number, number] => [cityCell(to, 0)[0] - CELL / 2, cityCell(from, 0)[0] + CELL / 2];

const PROFILE: Profile = [
  [edge(5), 0], [edge(8), 8],
  [edge(13), 8], [edge(17), 17],
  [edge(19), 17], [edge(21), 11],
  [edge(28), 11], [edge(30), 16],
];

/** The ground of the city on its hillside, on squares of `cell` (16, or a whole fraction of it); and, where `beyond` gives a height, that instead. */
export function cityHeights(cell = CELL, beyond?: (x: number, z: number) => number | null): Heights {
  const heights = new Heights(cell, [0, edge(5)], (x, z) => beyond?.(x, z) ?? heightOf(PROFILE, z));
  // +X is west here: the higher columns are to the east.
  const [upperFrom, upperTo] = columns(18, 23);
  const [lowerFrom, lowerTo] = columns(10, 16);
  heights.level([upperFrom, edge(5), upperTo, edge(8)], 8);
  heights.level([lowerFrom, edge(5), lowerTo, edge(8)], 0);
  return heights;
}

export const CITY_LOOKS = {
  ground: { tag: 'road', color: 0x5b626b, wall: 0x70757c },
  pit: { tag: 'pit', color: 0x4a3a2a, wall: 0x4a3a2a },
  footing: 0x8d8a84,
};

export function hillcity(): LevelDef {
  const heights = cityHeights();
  return {
    ...lift(city(), heights, CITY_LOOKS),
    id: 'hillcity',
    name: '坡上的城市',
    brief: '第一關的城市，原樣搬到山坡上：同樣的街道，多了上下坡',
  };
}
