import RAPIER from '@dimforge/rapier3d-compat';
import type { StillWaterDesc } from '../levels/types';
import type { Splash } from './water';

/**
 * Afloat, a thing weighs what it always does and lies on the surface, which is solid; but nothing holds it there but the
 * water, so it slides over it as the slow current takes it, at the current's pace, and its turning soon dies away.
 */
const FLOAT_GRIP = 0.002;
const TAKE = 0.9;
/** How fast something long comes round to the current: radians a second for each radian it is off it, and how quickly. */
const TURN = 0.4;
const TURN_TAKE = 2;
const FLOAT_SPIN_DRAG = 1.5;
/** Sinking, it goes down slowly; this far under, it is gone, out of the physics. */
const SINK_GRAVITY = 0.12;
const SINK_DRAG = 3;
const GONE = 1.5;
/** A thing whose middle is less than this above the surface is in the water; above that, or out past its edge, it is out. */
const WET = 0.6;
/** How near the outlet what floats turns round in front of it rather than going on into it, metres. */
const EDDY = 4;

interface Wet {
  body: RAPIER.RigidBody;
  water: StillWaterDesc;
  sinking: boolean;
  /** Colliders made to pass through the ground as it sinks, to be made solid again. */
  sensors: RAPIER.Collider[];
  /** How it fell, slowed and held the ground before it went in, to be given back when it comes out. */
  was: { gravity: number; drag: number; spinDrag: number; grip: [number, RAPIER.CoefficientCombineRule][] };
}

/**
 * Still water lying over ground that is its own surface, as the settling ponds' is. What goes in is made to do as it
 * would in water: something light floats, the slow current carrying it toward where the water goes out and round in
 * front of it there; something heavy goes down, slowly, through the surface, and is gone.
 */
export class Afloat {
  private readonly wet = new Map<number, Wet>();
  private splashes: Splash[] = [];

  constructor(private readonly waters: StillWaterDesc[]) {}

  get any(): boolean {
    return this.waters.length > 0;
  }

  /** Call every step for each loose body that might go in, saying whether it is the kind that sinks. */
  step(body: RAPIER.RigidBody, sinks: boolean, dt: number): void {
    const p = body.translation();
    let w = this.wet.get(body.handle);
    if (!w) {
      const water = this.waters.find((s) => p.x > s.area[0] && p.x < s.area[2] && p.z > s.area[1] && p.z < s.area[3] && p.y < s.surface + WET);
      if (!water) return;
      w = { body, water, sinking: sinks, sensors: [], was: { gravity: body.gravityScale(), drag: body.linearDamping(), spinDrag: body.angularDamping(), grip: [] } };
      this.wet.set(body.handle, w);
      this.splashes.push({ x: p.x, y: water.surface, z: p.z, mass: body.mass(), muddy: water.muddy });
      if (sinks) {
        for (let i = 0; i < body.numColliders(); i++) {
          const c = body.collider(i);
          if (c.isSensor()) continue;
          c.setSensor(true);
          w.sensors.push(c);
        }
        body.setGravityScale(SINK_GRAVITY, true);
        body.setLinearDamping(SINK_DRAG);
        body.setAngularDamping(SINK_DRAG);
      } else {
        for (let i = 0; i < body.numColliders(); i++) {
          const c = body.collider(i);
          w.was.grip.push([c.friction(), c.frictionCombineRule()]);
          // Its own slipperiness, not the ground's grip under the water, decides how it slides.
          c.setFriction(FLOAT_GRIP);
          c.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
        }
        body.setAngularDamping(FLOAT_SPIN_DRAG);
      }
    }
    if (w.sinking) {
      if (p.y < w.water.surface - GONE && body.isEnabled()) body.setEnabled(false);
      return;
    }
    // Knocked up out of the water, by a machine or the truck, or carried out over its edge: out of it, as it was. Coming
    // down in it again, it goes in again, with a splash.
    const s = w.water;
    if (p.y > s.surface + WET || p.x < s.area[0] || p.x > s.area[2] || p.z < s.area[1] || p.z > s.area[3]) {
      this.dry(w);
      this.wet.delete(body.handle);
      return;
    }
    // Toward the outlet; near it, round and round in front of it, held off it a little way.
    const dx = s.outlet[0] - p.x, dz = s.outlet[1] - p.z, d = Math.hypot(dx, dz) || 1;
    const ux = dx / d, uz = dz / d;
    let vx = ux * s.drift, vz = uz * s.drift;
    if (d < EDDY) {
      const inward = (d - EDDY * 0.6) / EDDY;
      vx = (-uz + ux * inward) * s.drift;
      vz = (ux + uz * inward) * s.drift;
    }
    const v = body.linvel(), m = body.mass();
    body.applyImpulse({ x: (vx - v.x) * TAKE * m * dt, y: 0, z: (vz - v.z) * TAKE * m * dt }, true);
    // Something long comes round to lie along the current, as a plank or a pipe does: its long side, end on to the way it goes.
    const shape = body.collider(0)?.shape as { halfExtents?: { x: number; z: number } } | undefined;
    const half = shape?.halfExtents;
    if (half && Math.abs(half.x - half.z) > 0.08) {
      const r = body.rotation();
      // Its long axis, as it lies now, turned into the level.
      const lx = half.x > half.z ? 1 : 0, lz = 1 - lx;
      const ax = (1 - 2 * (r.y * r.y + r.z * r.z)) * lx + 2 * (r.x * r.z + r.w * r.y) * lz;
      const az = 2 * (r.x * r.z - r.w * r.y) * lx + (1 - 2 * (r.x * r.x + r.y * r.y)) * lz;
      // How far round it is from lying along the current, either end first.
      let off = Math.atan2(vx, vz) - Math.atan2(ax, az);
      off = ((off + Math.PI / 2) % Math.PI + Math.PI) % Math.PI - Math.PI / 2;
      const w = body.angvel();
      body.setAngvel({ x: w.x, y: w.y + (TURN * off - w.y) * TURN_TAKE * dt, z: w.z }, true);
    }
  }

  drainSplashes(): Splash[] {
    const out = this.splashes;
    this.splashes = [];
    return out;
  }

  /** As it was before it went in. */
  private dry(w: Wet): void {
    for (const c of w.sensors) c.setSensor(false);
    w.body.setEnabled(true);
    w.body.setGravityScale(w.was.gravity, true);
    w.body.setLinearDamping(w.was.drag);
    w.body.setAngularDamping(w.was.spinDrag);
    w.was.grip.forEach(([grip, rule], i) => {
      w.body.collider(i).setFriction(grip);
      w.body.collider(i).setFrictionCombineRule(rule);
    });
  }

  /** Forget everything; whatever still exists is as it was before it went in. */
  reset(): void {
    for (const w of this.wet.values()) if (w.body.isValid()) this.dry(w);
    this.wet.clear();
    this.splashes = [];
  }
}
