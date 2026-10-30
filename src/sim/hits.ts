import type RAPIER from '@dimforge/rapier3d-compat';
import { TRUCK } from '../config';
import type { LooseObject } from './objects';

// Things flung or falling at the truck: what a gust has carried off, a stack of stock come down off a stall. While each is
// still on its way on its own, its striking the truck or what is on it jolts the load, by how heavy it is and how fast it
// came; come to rest, the truck running into it is any other collision. Heavy stock is another matter: the truck running
// into a stack of it hurts the load too, by how fast the one meets the other. The physics makes the truck's frame solid, not its
// wheels and axles: what comes in low among those is stopped against them, beside the truck, as by a wheel.

/** The jolt to the load, metres a second: its speed against the truck's times its mass over this, kilograms; no more than so much. */
const HIT_MASS = 30;
const HIT_MOST = 14;
/** Heavy stock, packed solid: what its mass is set against in place of HIT_MASS. */
const STOCK_MASS = 15;
/** Running into a stack of heavy stock: by how much faster than this the truck is going, m/s, only (nosing into one at a
 * crawl brings it down on the truck but is not ramming it), times its mass over this; no more than so much, the harder
 * the faster. */
const RAM_FROM = 2.5;
const RAM_MASS = 15;
const RAM_MOST = 20;
/** The same thing not counted again for so long, seconds. */
const HIT_AGAIN = 0.6;
/** How fast something must itself be going, m/s, to be still on its way: under that it has come to rest. */
const FLYING = 3;
/** Nothing further from the truck than this, metres either way, can be striking it. */
const NEAR = 7;

export class Hits {
  /** What is followed, how fast each was going before this step, and when each last struck. */
  /** How far under the truck's frame something can be and still be under its wheels: where the truck goes over halls on their roofs, not all the way down to the floor. */
  below = Infinity;
  private readonly tracked = new Map<LooseObject, { vx: number; vy: number; vz: number; hit: number }>();
  private time = 0;
  /** The hardest the truck has run into heavy stock since the last step was told, as a jolt to the load. */
  private rammed = 0;

  /** Followed from now on, going at this velocity. */
  track(object: LooseObject, v: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }): void {
    if (!this.tracked.has(object)) this.tracked.set(object, { vx: v.x, vy: v.y, vz: v.z, hit: -Infinity });
  }

  /** The truck run into a piece of heavy stock going this fast: what it is stacked to sell comes down on the load. */
  ram(object: LooseObject, speed: number): void {
    if (!object.kind.crushes) return;
    this.rammed = Math.max(this.rammed, ramming(speed, object.body.mass()));
    const was = this.tracked.get(object);
    if (was) was.hit = this.time;
  }

  get any(): boolean {
    return this.tracked.size > 0;
  }

  /** Before a step: how fast each is going. */
  before(dt: number): void {
    this.time += dt;
    for (const [object, was] of this.tracked) {
      const v = object.body.linvel();
      was.vx = v.x;
      was.vy = v.y;
      was.vz = v.z;
    }
  }

  /** After a step: the hardest any of them struck the truck or its load in it, as a jolt to the load (metres a second). */
  struck(world: RAPIER.World, truck: RAPIER.RigidBody, load: Set<number>): number {
    const tv = truck.linvel();
    let worst = this.rammed;
    this.rammed = 0;
    for (const [object, was] of this.tracked) {
      if (this.time - was.hit < HIT_AGAIN || !object.body.isEnabled()) continue;
      // Once the truck has hit it, it is no longer coming at the truck: what it does now is the truck's doing.
      if (object.knocked && !object.kind.crushes) continue;
      // Heavy stock by how fast it and the truck meet; anything else by how fast it is going itself.
      const meeting = object.kind.crushes ? Math.hypot(was.vx - tv.x, was.vy - tv.y, was.vz - tv.z) : Math.hypot(was.vx, was.vy, was.vz);
      if (meeting < FLYING) continue;
      const o = object.body.translation(), t = truck.translation();
      if (Math.abs(o.x - t.x) > NEAR || Math.abs(o.z - t.z) > NEAR) continue;
      let touching = false;
      for (let k = 0; k < object.body.numColliders() && !touching; k++) {
        const mine = object.body.collider(k);
        world.contactPairsWith(mine, (other) => {
          const by = other.parent()?.handle;
          if (touching || by === undefined || (by !== truck.handle && !load.has(by))) return;
          world.contactPair(mine, other, (manifold) => {
            if (manifold.numContacts() > 0) touching = true;
          });
        });
      }
      if (!touching && underneath(object, truck, this.below)) {
        touching = true;
        const back = 0.3;
        object.body.setLinvel({ x: tv.x - (was.vx - tv.x) * back, y: object.body.linvel().y, z: tv.z - (was.vz - tv.z) * back }, true);
      }
      if (!touching) continue;
      was.hit = this.time;
      const impact = Math.hypot(was.vx - tv.x, was.vy - tv.y, was.vz - tv.z);
      // Heavy stock, packed solid, hits twice as hard as anything else of its weight.
      worst = Math.max(worst, Math.min(HIT_MOST, (impact * object.body.mass()) / (object.kind.crushes ? STOCK_MASS : HIT_MASS)));
      // Heavy stock the truck has run into: by how fast the truck was going, as when it is met before it is touched.
      if (object.kind.crushes) worst = Math.max(worst, ramming(Math.hypot(tv.x, tv.z), object.body.mass()));
    }
    return worst;
  }

  reset(): void {
    this.tracked.clear();
    this.rammed = 0;
    this.time = 0;
  }
}

/** The jolt to the load of the truck running into heavy stock going so fast, m/s: by how much faster than a crawl. */
function ramming(speed: number, mass: number): number {
  return Math.min(RAM_MOST, (Math.max(0, speed - RAM_FROM) * mass) / RAM_MASS);
}

/** Whether something is in under the truck's frame, between its wheels. */
function underneath(object: LooseObject, truck: RAPIER.RigidBody, below: number): boolean {
  const p = object.body.translation(), t = truck.translation(), r = truck.rotation();
  // Into the truck's own frame: its yaw only.
  const yaw = Math.atan2(2 * (r.w * r.y + r.x * r.z), 1 - 2 * (r.y * r.y + r.x * r.x));
  const dx = p.x - t.x, dz = p.z - t.z, c = Math.cos(yaw), s = Math.sin(yaw);
  const across = dx * c - dz * s, along = dx * s + dz * c;
  const [hw, hh, hl] = TRUCK.frame.half;
  return Math.abs(across) < hw && Math.abs(along) < hl && p.y < t.y - hh + 0.1 && p.y > t.y - hh - below;
}
