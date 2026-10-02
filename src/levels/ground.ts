import type { LevelDef, PitDesc } from './types';

/** A rectangle of ground: [minX, minZ, maxX, maxZ]. */
export type Tile = [number, number, number, number];

/**
 * A rectangle as a set of smaller ones that together cover it, leaving out the pits.
 *
 * A single slab can't have a hole in it. So the rectangle is cut along every pit's edges
 * into a grid, and each square of the grid that isn't inside a pit becomes a piece.
 * Without pits this is just the one rectangle.
 */
export function tilesAround([minX, minZ, maxX, maxZ]: Tile, pits: PitDesc[]): Tile[] {
  const cuts = (axis: 0 | 1, lo: number, hi: number): number[] => {
    const edges = [lo, hi];
    for (const pit of pits) {
      for (const edge of [pit.pos[axis] - pit.half[axis], pit.pos[axis] + pit.half[axis]]) {
        if (edge > lo && edge < hi) edges.push(edge);
      }
    }
    return [...new Set(edges)].sort((a, b) => a - b);
  };
  const xs = cuts(0, minX, maxX);
  const zs = cuts(1, minZ, maxZ);

  const tiles: Tile[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < zs.length; j++) {
      const x = (xs[i] + xs[i + 1]) / 2;
      const z = (zs[j] + zs[j + 1]) / 2;
      const inPit = pits.some((p) => Math.abs(x - p.pos[0]) < p.half[0] && Math.abs(z - p.pos[1]) < p.half[1]);
      if (!inPit) tiles.push([xs[i], zs[j], xs[i + 1], zs[j + 1]]);
    }
  }
  return tiles;
}

/** The whole of a level's ground, in pieces that leave its pits open. */
export function groundTiles(level: LevelDef): Tile[] {
  const { center, half } = level.ground;
  return tilesAround([center[0] - half[0], center[1] - half[1], center[0] + half[0], center[1] + half[1]], level.pits ?? []);
}
