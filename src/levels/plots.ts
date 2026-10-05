import { heightAt, type TerrainDesc } from './terrain';
import type { PropDesc, Vec2 } from './types';

// Buildings on ground that is not level: where they go along a road's edge, and what they stand on.

export interface Plot {
  /** The middle of the plot. */
  x: number;
  z: number;
  /** The turn about Y that lays a box's X along the frontage. */
  yaw: number;
  /** Along the frontage, and back from it, metres. */
  width: number;
  depth: number;
  /** Which sides face the street, as a building wants them: -X, +X, -Z, +Z. */
  open: [boolean, boolean, boolean, boolean];
  /** How many came before it along the edge. */
  n: number;
}

/**
 * Plots side by side along an edge, such as the outer edge of a road's pavement: each as wide
 * as `width` says, `depth` deep, and facing the edge. `side` is which side of the edge they
 * stand on, as it runs. `skip` leaves a gap in place of a plot: an alley, a yard.
 */
export function plots(edge: readonly (readonly number[])[], side: 'left' | 'right', options: { width: number | ((n: number) => number); depth: number; setback?: number; skip?: (n: number) => boolean }): Plot[] {
  const along: number[] = [0];
  for (let n = 1; n < edge.length; n++) along.push(along[n - 1] + Math.hypot(edge[n][0] - edge[n - 1][0], edge[n][1] - edge[n - 1][1]));
  const total = along[along.length - 1];
  const at = (s: number): Vec2 => {
    let n = 1;
    while (n < edge.length - 1 && along[n] < s) n++;
    const t = (s - along[n - 1]) / Math.max(1e-6, along[n] - along[n - 1]);
    return [edge[n - 1][0] + (edge[n][0] - edge[n - 1][0]) * t, edge[n - 1][1] + (edge[n][1] - edge[n - 1][1]) * t];
  };
  const out: Plot[] = [];
  const sign = side === 'left' ? 1 : -1;
  for (let s = 0, n = 0; ; n++) {
    const width = typeof options.width === 'number' ? options.width : options.width(n);
    if (s + width > total) break;
    const a = at(s);
    const b = at(s + width);
    s += width;
    if (options.skip?.(n)) continue;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
    const back = options.depth / 2 + (options.setback ?? 0);
    out.push({
      x: (a[0] + b[0]) / 2 + dz * sign * back,
      z: (a[1] + b[1]) / 2 - dx * sign * back,
      yaw: Math.atan2(-dz, dx),
      // No wider than the straight line between its ends: on a bend that is a little less.
      width: length,
      depth: options.depth,
      open: [false, false, side === 'right', side === 'left'],
      n,
    });
  }
  return out;
}

/**
 * A building put down on the ground as it finds it: its floor at the height of the ground at
 * its street door (or at its middle, if it faces no street), and under it a footing down to the
 * lowest ground it stands over, so that no corner of it hangs in the air.
 */
export function seat(terrain: TerrainDesc | undefined, building: PropDesc, color = ((Math.round(((building.color >> 16) & 255) * 0.78) << 16) | (Math.round(((building.color >> 8) & 255) * 0.78) << 8) | Math.round((building.color & 255) * 0.78))): PropDesc[] {
  const [hx, hy, hz] = building.size;
  const yaw = building.rot?.[1] ?? 0;
  const cos = Math.cos(yaw), sin = Math.sin(yaw);
  const ground = (lx: number, lz: number) => heightAt(terrain, building.pos[0] + lx * cos + lz * sin, building.pos[2] - lx * sin + lz * cos);
  let low = Infinity;
  const nx = Math.max(2, Math.ceil(hx)), nz = Math.max(2, Math.ceil(hz));
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) low = Math.min(low, ground(-hx + (2 * hx * i) / nx, -hz + (2 * hz * j) / nz));
  const doors = ([[-hx, 0], [hx, 0], [0, -hz], [0, hz]] as const).filter((_, n) => building.building?.open[n]);
  const floor = doors.length ? Math.max(...doors.map(([lx, lz]) => ground(lx, lz))) : ground(0, 0);
  const seated: PropDesc = { ...building, pos: [building.pos[0], floor + hy, building.pos[2]] };
  if (floor - low < 0.05) return [seated];
  const half = (floor - low) / 2 + 0.25;
  return [seated, { shape: 'box', size: [hx, half, hz], pos: [building.pos[0], floor - half, building.pos[2]], rot: building.rot, color }];
}
