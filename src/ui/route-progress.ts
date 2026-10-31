import type { Vec2 } from '../levels/types';

/** Furthest position on the authored route, not the distance driven in circles. */
export class RouteProgress {
  private readonly segments: { x: number; z: number; dx: number; dz: number; length: number; start: number }[] = [];
  private total = 0;
  private furthest = 0;
  private previous = 0;
  private last: Vec2 | null = null;

  constructor(route: readonly Vec2[] = []) {
    for (let i = 1; i < route.length; i++) {
      const [x, z] = route[i - 1], dx = route[i][0] - x, dz = route[i][1] - z;
      const length = Math.hypot(dx, dz);
      if (!length) continue;
      this.segments.push({ x, z, dx, dz, length, start: this.total });
      this.total += length;
    }
  }

  get fraction(): number | null { return this.total ? Math.min(1, this.furthest / this.total) : null; }

  reset(x: number, z: number): void {
    this.furthest = this.previous = 0;
    this.last = null;
    this.update(x, z);
  }

  update(x: number, z: number): void {
    const travelled = this.last ? Math.hypot(x - this.last[0], z - this.last[1]) : Infinity;
    let bestDistance = Infinity, bestAlong = this.previous;
    for (const s of this.segments) {
      const t = Math.max(0, Math.min(1, ((x - s.x) * s.dx + (z - s.z) * s.dz) / s.length ** 2));
      const along = s.start + t * s.length;
      // At a crossing prefer continuity. Teleports/checkpoint resets intentionally reproject.
      if (travelled < 40 && Math.abs(along - this.previous) > travelled * 3 + 30) continue;
      const distance = Math.hypot(x - s.x - t * s.dx, z - s.z - t * s.dz);
      const score = distance + (this.last ? Math.abs(along - this.previous) * .015 : 0);
      if (score < bestDistance && distance < 45) { bestDistance = score; bestAlong = along; }
    }
    this.previous = bestAlong;
    this.furthest = Math.max(this.furthest, bestAlong);
    this.last = [x, z];
  }
}
