import RAPIER from '@dimforge/rapier3d-compat';
import { Euler, Quaternion, Vector3 } from 'three';
import { GROUP, groups } from '../config';
import { OBJECT_KINDS, type ObjectDesc, type ObjectKind } from '../levels/objects';
import type { Truck } from './truck';

export interface LooseObject {
  desc: ObjectDesc;
  kind: ObjectKind;
  body: RAPIER.RigidBody;
  /** Whether it has been knocked yet. Until then it stands asleep where it was put. */
  knocked: boolean;
  /** How tall it stands, metres. */
  height: number;
  /** Its velocity a step ago, once it is loose, to tell when it has hit something. */
  was: { x: number; y: number; z: number } | null;
  /** Seconds before another landing of its will be reported. */
  hush: number;
}

/** Something already knocked loose has come down on the ground, or bounced off something. */
export interface LandEvent {
  object: LooseObject;
  /** How abruptly it was stopped or turned, m/s. */
  strength: number;
}

/** An object was hit hard enough to send it flying, for the first time. */
export interface KnockEvent {
  object: LooseObject;
  /** Where it stood. */
  at: { x: number; y: number; z: number };
}

/** Faster than this and it counts as knocked, m/s. */
const KNOCK_SPEED = 1.5;
/** The upward toss a knocked object gets, as a speed in m/s: a base amount, more per m/s it was hit at, up to a limit. */
const LIFT_BASE = 1.5;
const LIFT_PER_SPEED = 0.3;
const LIFT_MAX = 6;
/** Above this mass, kg, things are tossed less and less: a bin flies, a tree only topples. */
const LIFT_FULL_MASS = 60;
/** A loose thing whose velocity changes by this much in one step, m/s, has landed or bounced. */
const LAND_CHANGE = 3;
/** And isn't reported again for this long: one landing is several steps of contact. */
const LAND_HUSH = 0.25;
const STEP = 1 / 60;
const q = new Quaternion();
const e = new Euler();
const v = new Vector3();
const side = new Vector3();
/** Sideways speed given to something heavy when the truck hits it, m/s. */
const SHOVE = 4;
const SOLID = groups(GROUP.prop, GROUP.all);
/** What something caught beneath the truck becomes: solid to everything but the truck. */
const PASSING_UNDER = groups(GROUP.prop, GROUP.all & ~GROUP.truck);
/** The space beneath the truck's frame, in its own coordinates: half extents, and how far below its centre. */
const UNDER_HALF = { x: 1.2, y: 0.3, z: 3.5 };
/** Nothing standing taller than this fits under there: a post with its foot under the bumper is being pushed, not driven over. */
const UNDER_HEIGHT = 0.7;
const UNDER_DROP = 0.42;
/** The whole of the truck, and a little more: half extents, and how far above its centre. */
const AROUND_HALF = { x: 1.5, y: 1.1, z: 4.0 };
const AROUND_RISE = 0.4;

/** Whether an object has gone over: tipped more than half way to the ground. */
function lying(object: LooseObject): boolean {
  const r = object.body.rotation();
  return 1 - 2 * (r.x * r.x + r.z * r.z) < 0.5;
}

/**
 * Every loose object in the level. They are ordinary rigid bodies, put to sleep where they
 * stand so that a city full of them costs nothing until something disturbs one.
 */
export class ObjectSystem {
  readonly objects: LooseObject[] = [];
  /** Objects knocked during the latest step. */
  fresh: KnockEvent[] = [];
  private landings: LandEvent[] = [];
  private events: KnockEvent[] = [];
  private readonly byCollider = new Map<number, LooseObject>();
  private under = new Set<LooseObject>();
  private readonly underShape = new RAPIER.Cuboid(UNDER_HALF.x, UNDER_HALF.y, UNDER_HALF.z);
  private readonly aroundShape = new RAPIER.Cuboid(AROUND_HALF.x, AROUND_HALF.y, AROUND_HALF.z);
  private seed = 3;

  constructor(private readonly world: RAPIER.World, descs: ObjectDesc[]) {
    for (const desc of descs) {
      const kind: ObjectKind = OBJECT_KINDS[desc.kind];
      q.setFromEuler(e.set(0, desc.rotY ?? 0, 0));
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(...desc.pos)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
          .setSleeping(true),
      );
      const solid = kind.parts.filter((p) => !p.ghost);
      const height = Math.max(...solid.map((p) => p.pos[1] + p.size[1]));
      const object: LooseObject = { desc, kind, body, knocked: false, height, was: null, hush: 0 };
      const shares = solid.reduce((sum, p) => sum + (p.weight ?? 1), 0);
      for (const part of solid) {
        const [a, b, c] = part.size;
        const shape =
          part.shape === 'box' ? RAPIER.ColliderDesc.cuboid(a, b, c)
          : part.shape === 'cylinder' ? RAPIER.ColliderDesc.cylinder(b, a)
          : RAPIER.ColliderDesc.cone(b, a);
        const [rx, ry, rz] = part.rot ?? [0, 0, 0];
        q.setFromEuler(e.set(rx, ry, rz));
        const collider = world.createCollider(
          shape
            .setTranslation(...part.pos)
            .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
            .setMass((kind.mass * (part.weight ?? 1)) / shares)
            .setFriction(0.7)
            .setRestitution(0.15)
            .setCollisionGroups(SOLID),
          body,
        );
        this.byCollider.set(collider.handle, object);
      }
      this.objects.push(object);
    }
  }

  /** Call once per physics step, after the world has stepped. */
  update(truck?: Truck, stalled = false): void {
    this.fresh = [];
    if (truck) this.clearBeneath(truck, stalled);
    for (const object of this.objects) {
      if (object.body.isSleeping()) {
        object.was = null;
        continue;
      }
      if (object.knocked) {
        this.listen(object);
        continue;
      }
      const v = object.body.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      if (speed < KNOCK_SPEED) continue;
      object.knocked = true;
      const [x, y, z] = object.desc.pos;
      const event = { object, at: { x, y, z } };
      this.events.push(event);
      this.fresh.push(event);

      // Left to the solver, something hit by the truck is just shoved along in front of it.
      // Toss it up and spin it, harder the harder it was hit, so that it flies instead.
      const mass = object.body.mass();
      const lift = Math.min(LIFT_MAX, LIFT_BASE + speed * LIFT_PER_SPEED) * Math.min(1, LIFT_FULL_MASS / mass);
      object.body.applyImpulse({ x: v.x * mass * 0.25, y: lift * mass, z: v.z * mass * 0.25 }, true);
      // Something heavy goes over in a direction of the truck's choosing, not at random.
      if (truck && mass > LIFT_FULL_MASS && this.shoveAside(object, truck, mass, speed)) continue;
      const spin = mass * 0.35 * Math.min(speed, 12);
      object.body.applyTorqueImpulse({ x: (this.random() - 0.5) * spin, y: (this.random() - 0.5) * spin * 0.5, z: (this.random() - 0.5) * spin }, true);
    }
  }

  /** Watch a loose thing for the moment it hits the ground, or anything else. */
  private listen(object: LooseObject): void {
    const now = object.body.linvel();
    const was = object.was;
    object.was = { x: now.x, y: now.y, z: now.z };
    object.hush -= STEP;
    if (!was || object.hush > 0) return;
    // Gravity alone changes its fall by a little each step; that is not a landing.
    const change = Math.hypot(now.x - was.x, now.y - was.y + 9.81 * STEP, now.z - was.z);
    if (change < LAND_CHANGE) return;
    object.hush = LAND_HUSH;
    this.landings.push({ object, strength: change });
  }

  drainLandings(): LandEvent[] {
    const out = this.landings;
    this.landings = [];
    return out;
  }

  /**
   * Whatever has ended up beneath the truck stops being solid to it until it is clear again.
   * Otherwise a felled tree or a flattened stall wedges under the frame, and the truck sits
   * on it with its wheels in the air. The same goes for whatever the truck is jammed
   * against when it is `stalled`: a barrel pinned between the bumper and a kerb gives way.
   */
  private clearBeneath(truck: Truck, stalled: boolean): void {
    const t = truck.body.translation();
    const r = truck.body.rotation();
    q.set(r.x, r.y, r.z, r.w);
    const touching = (shape: RAPIER.Cuboid, lift: number, take: (object: LooseObject) => void) => {
      v.set(0, lift, 0).applyQuaternion(q);
      this.world.intersectionsWithShape(
        { x: t.x + v.x, y: t.y + v.y, z: t.z + v.z }, r, shape,
        (collider) => {
          const object = this.byCollider.get(collider.handle);
          if (object) take(object);
          return true;
        },
        undefined, groups(GROUP.all, GROUP.prop),
      );
    };
    const found = new Set<LooseObject>();
    touching(this.underShape, -UNDER_DROP, (object) => {
      if (object.height < UNDER_HEIGHT || lying(object)) found.add(object);
    });
    // Once let through, a thing stays so until it is right out from the truck: turned solid
    // again while still inside it, it would be thrown out like a cork.
    if (stalled || this.under.size) {
      touching(this.aroundShape, AROUND_RISE, (object) => {
        if (stalled || this.under.has(object)) found.add(object);
      });
    }
    for (const object of found) if (!this.under.has(object)) this.setGroups(object, PASSING_UNDER);
    for (const object of this.under) if (!found.has(object)) this.setGroups(object, SOLID);
    this.under = found;
  }

  /**
   * Something heavy that the truck has just hit goes over forward and to one side, so that
   * it comes down beside the truck: not back across the cab onto the load, which is where a
   * pole struck low would otherwise land. Returns whether it was the truck that hit it.
   */
  private shoveAside(object: LooseObject, truck: Truck, mass: number, speed: number): boolean {
    const t = truck.body.translation();
    const p = object.body.translation();
    if (Math.hypot(p.x - t.x, p.z - t.z) > 7) return false;
    const r = truck.body.rotation();
    q.set(r.x, r.y, r.z, r.w);
    side.set(1, 0, 0).applyQuaternion(q);
    v.set(0, 0, 1).applyQuaternion(q);
    const across = (p.x - t.x) * side.x + (p.z - t.z) * side.z;
    // Hit square on, it could go either way.
    const way = Math.abs(across) < 0.25 ? (this.random() < 0.5 ? -1 : 1) : Math.sign(across);
    object.body.applyImpulse({ x: side.x * way * SHOVE * mass, y: 0, z: side.z * way * SHOVE * mass }, true);
    // The way its top is to fall: ahead and outward. Turning about (up x that) takes it there.
    const fx = v.x + side.x * way * 0.9;
    const fz = v.z + side.z * way * 0.9;
    const rate = (1.2 + Math.min(speed, 12) * 0.12) / Math.hypot(fx, fz);
    object.body.setAngvel({ x: fz * rate, y: 0, z: -fx * rate }, true);
    return true;
  }

  private setGroups(object: LooseObject, collisionGroups: number): void {
    for (let i = 0; i < object.body.numColliders(); i++) object.body.collider(i).setCollisionGroups(collisionGroups);
  }

  /** Seeded, so headless runs repeat exactly. */
  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  drainEvents(): KnockEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** Stand everything back up where it started. */
  reset(): void {
    const zero = { x: 0, y: 0, z: 0 };
    for (const object of this.under) this.setGroups(object, SOLID);
    this.under.clear();
    this.fresh = [];
    for (const object of this.objects) {
      // Whatever was never disturbed is still where it belongs, and is best left asleep.
      if (!object.knocked && object.body.isSleeping()) continue;
      const [x, y, z] = object.desc.pos;
      q.setFromEuler(e.set(0, object.desc.rotY ?? 0, 0));
      object.body.setTranslation({ x, y, z }, false);
      object.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, false);
      object.body.setLinvel(zero, false);
      object.body.setAngvel(zero, false);
      object.body.sleep();
      object.knocked = false;
      object.was = null;
      object.hush = 0;
    }
    this.landings = [];
    this.events = [];
    this.seed = 3;
  }
}
