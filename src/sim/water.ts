import type RAPIER from '@dimforge/rapier3d-compat';
import type { PitDesc } from '../levels/types';

/** Under water things weigh this share of what they do in air, and are slowed this hard. */
const SUNK_GRAVITY = 0.12;
const DRAG = 3;

export interface Splash {
  x: number;
  y: number;
  z: number;
  /** Roughly how big the thing was, kg. */
  mass: number;
}

/**
 * The pits that are full of water. Whatever goes under the surface sinks slowly to the
 * bottom instead of dropping, and makes a splash on the way in.
 */
export class Water {
  private readonly pools: PitDesc[];
  private readonly wet = new Map<number, RAPIER.RigidBody>();
  private splashes: Splash[] = [];

  constructor(pits: PitDesc[]) {
    this.pools = pits.filter((p) => p.water !== undefined);
  }

  /** The pool a point on the map is over, if any. */
  poolAt(x: number, z: number): PitDesc | null {
    for (const p of this.pools) if (Math.abs(x - p.pos[0]) < p.half[0] && Math.abs(z - p.pos[1]) < p.half[1]) return p;
    return null;
  }

  /** Whether a point is below the surface of a pool. */
  under(p: { x: number; y: number; z: number }): boolean {
    const pool = this.poolAt(p.x, p.z);
    return pool !== null && p.y < (pool.base ?? 0) - pool.water!;
  }

  /** Call every step for each body that might fall in. Returns whether it is under water. */
  soak(body: RAPIER.RigidBody): boolean {
    if (!this.pools.length) return false;
    const p = body.translation();
    const under = this.under(p);
    const was = this.wet.has(body.handle);
    if (under && !was) {
      this.wet.set(body.handle, body);
      body.setGravityScale(SUNK_GRAVITY, true);
      body.setLinearDamping(DRAG);
      body.setAngularDamping(DRAG);
      this.splashes.push({ x: p.x, y: p.y, z: p.z, mass: body.mass() });
    } else if (!under && was) this.dry(body);
    return under;
  }

  drainSplashes(): Splash[] {
    const out = this.splashes;
    this.splashes = [];
    return out;
  }

  /** Forget everything. Bodies that still exist are given their weight back. */
  reset(): void {
    for (const body of this.wet.values()) if (body.isValid()) this.dry(body);
    this.wet.clear();
    this.splashes = [];
  }

  private dry(body: RAPIER.RigidBody): void {
    this.wet.delete(body.handle);
    body.setGravityScale(1, true);
    body.setLinearDamping(0);
    body.setAngularDamping(0);
  }
}
