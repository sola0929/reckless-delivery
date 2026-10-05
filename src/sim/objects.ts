import RAPIER from '@dimforge/rapier3d-compat';
import { Euler, Quaternion, Vector3 } from 'three';
import { GROUP, TRUCK, groups } from '../config';
import { OBJECT_KINDS, POLE_SPACING, type ObjectDesc, type ObjectKind } from '../levels/objects';
import type { Truck } from './truck';

export interface LooseObject {
  desc: ObjectDesc;
  kind: ObjectKind;
  body: RAPIER.RigidBody;
  /** Whether the truck has been near it while it was awake: after that, where it has got to is its own affair. */
  near: boolean;
  /** Whether it has been knocked yet. Until then it stands asleep where it was put. */
  knocked: boolean;
  /** How tall it stands, metres. */
  height: number;
  /** Whether it was hit hard enough to be left in pieces, if it is the kind of thing that can be. */
  wrecked: boolean;
  /** Seconds it has spent pressed against the front or back of the moving truck. */
  carried: number;
  /** Its velocity a step ago, once it is loose, to tell when it has hit something. */
  was: { x: number; y: number; z: number } | null;
  /** Seconds before another landing of its will be reported. */
  hush: number;
  /** For something explosive that has been knocked: seconds until it goes off. Below 0 otherwise. */
  fuse: number;
  /** For a pole: which of its wires have parted. 1 for those running ahead, 2 for those behind, 3 for both. */
  cut: number;
  /** Set while it is rolling free, let go by the level and not yet run into anything hard. */
  rolling?: boolean;
  /** While it rolls: how fast it is going down the hill. */
  pace?: number;
  /** For a firecracker lit by its neighbour: seconds until it goes. */
  tripIn?: number;
  /** For a piece of a scaffold coming down with the rest: seconds until it goes. */
  fallIn?: number;
  /** For something that walks about: where it is now and which way it faces, where it is going, and how long it stands pecking first. */
  walk?: { x: number; z: number; yaw: number; tx: number; tz: number; pause: number; peck: number };
}

/** Something has blown up. */
export interface Blast {
  x: number;
  y: number;
  z: number;
  /** What it was, and how hard it went, beside a cylinder of gas. */
  kind: 'gas' | 'drum' | 'mine' | 'shell' | 'rocket' | 'tank';
  power: number;
  /** How far it reaches, metres, when that is not as far as a cylinder of gas does. */
  radius?: number;
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
/** Things this heavy, kg, rolling, go through cars and small things in their way rather than stop at them. */
const RAMS_ABOVE = 1000;
/** How far the edges of something made to roll are rounded off, metres. */
const ROLL_EDGE = 0.06;
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
/** How long a knocked cylinder of gas rolls about before it goes off, and how far its blast reaches. */
const FUSE_SECONDS = 0.45;
export const BLAST_RADIUS = 10;
/** The speed, m/s, given to something light right beside it. Heavier things get less. */
const BLAST_SPEED = 18;
/** Lighter than this, kg, a loose thing is slowed as it rolls or slides. */
const ROLLS_BELOW = 120;
const SOLID = groups(GROUP.prop, GROUP.all);
/** Something lying flat in the road, as a manhole cover: the traffic drives over it, and it is not knocked about by other things. */
const FLAT = groups(GROUP.prop, GROUP.all & ~GROUP.prop);
const solidOf = (kind: ObjectKind) => (kind.underfoot ? FLAT : SOLID);
/** On ground that is not level: how near the truck must come, metres, before something that has stirred is left to itself. */
/** How near the truck's body, metres, a held thing must be to be let go. */
const HELD_MARGIN = 1.2;
/** What something caught beneath the truck becomes: solid to everything but the truck. */
const PASSING_UNDER = groups(GROUP.prop, GROUP.all & ~GROUP.truck);
/** And what something light becomes once the truck has hit it: solid to neither the truck nor what it carries. */
const PASSING_THROUGH = groups(GROUP.prop, GROUP.all & ~GROUP.truck & ~GROUP.cargo);
/** The space beneath the truck's frame, in its own coordinates: half extents, and how far below its centre. */
const UNDER_HALF = { x: 1.2, y: 0.3, z: 3.5 };
/** Nothing standing taller than this fits under there: a post with its foot under the bumper is being pushed, not driven over. */
const UNDER_HEIGHT = 0.7;
const UNDER_DROP = 0.42;
/** Above this speed, m/s, the truck's meeting with anything light is settled by hand. */
const MEET_SPEED = 2;
/** Lighter than this, kg, a thing that has been knocked is never left to wedge beneath the truck or against it. */
const UNDER_MASS = 150;
/** The whole of the truck, and a little more: half extents, and how far above its centre. */
const AROUND_HALF = { x: 1.5, y: 1.1, z: 4.0 };
const AROUND_RISE = 0.4;
/**
 * The space just ahead of the truck's nose and just behind its tail, below the level of the
 * cab roof: half extents, and how far along the truck it is from the middle.
 */
const NOSE_HALF = { x: 1.45, y: 0.9, z: 0.45 };
const NOSE_ALONG = 4.05;
/** How far inside the cab's walls something must be to count as having got into it. */
const CAB_SKIN = 0.15;
/** Something pressed there this long while the truck is moving is let through. */
const CARRIED_SECONDS = 0.45;
const CARRYING_SPEED = 2;
/** Hit at this speed or more, m/s, a thing that can be wrecked is. */
const WRECK_SPEED = 3;

/**
 * A box with its edges taken off. The ground is laid in slabs, and a square-edged box shoved
 * along it catches its leading edge on the join between two of them and stops dead: a
 * market stall standing on such a join met the truck like a wall. Slivers are left square.
 */
function roundedBox(a: number, b: number, c: number): RAPIER.ColliderDesc {
  const round = Math.min(0.05, Math.min(a, b, c) * 0.45);
  return round < 0.015 ? RAPIER.ColliderDesc.cuboid(a, b, c) : RAPIER.ColliderDesc.roundCuboid(a - round, b - round, c - round, round);
}

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
  /** What blew up during the latest step. */
  blasts: Blast[] = [];
  /** Where a live wire has just parted and is left hanging. */
  private arcs: { x: number; y: number; z: number }[] = [];
  private events: KnockEvent[] = [];
  private readonly byCollider = new Map<number, LooseObject>();
  private under = new Set<LooseObject>();
  /** Driven things (cars, scooters) that something heavy and rolling ran into during the latest step: whoever drives them is to let go of them. */
  rammed: { body: RAPIER.RigidBody; by: LooseObject }[] = [];
  private readonly underShape = new RAPIER.Cuboid(UNDER_HALF.x, UNDER_HALF.y, UNDER_HALF.z);
  private readonly aroundShape = new RAPIER.Cuboid(AROUND_HALF.x, AROUND_HALF.y, AROUND_HALF.z);
  private readonly noseShape = new RAPIER.Cuboid(NOSE_HALF.x, NOSE_HALF.y, NOSE_HALF.z);
  private readonly cabShape = new RAPIER.Cuboid(TRUCK.cab.half[0] - CAB_SKIN, TRUCK.cab.half[1] - CAB_SKIN, TRUCK.cab.half[2] - CAB_SKIN);
  private riding = new Set<LooseObject>();
  private seed = 3;

  /**
   * `held`: on ground that is not level, nothing stays asleep by itself, and anything set down on a
   * slope would lean and fall over before the truck ever came by. There, whatever nobody has
   * been near is held as it was put, however it stirs.
   */
  constructor(private readonly world: RAPIER.World, descs: ObjectDesc[], private readonly held = false) {
    for (const desc of descs) {
      const kind: ObjectKind = OBJECT_KINDS[desc.kind];
      q.setFromEuler(e.set(desc.tilt ?? 0, desc.rotY ?? 0, 0, 'YXZ'));
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(...desc.pos)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
          // Light things don't roll on and on: a barrel or a can slows as if the road dragged at it.
          // Heavy ones are left alone, to fall as they should.
          .setLinearDamping(kind.mass < ROLLS_BELOW ? 0.25 : 0)
          .setAngularDamping(kind.mass < ROLLS_BELOW ? 1.8 : 0)
          .setSleeping(true),
      );
      const solid = kind.parts.filter((p) => !p.ghost);
      const height = Math.max(...solid.map((p) => p.pos[1] + p.size[1]));
      const object: LooseObject = { desc, kind, body, near: false, knocked: false, wrecked: false, carried: 0, height, was: null, hush: 0, fuse: -1, cut: 0 };
      const shares = solid.reduce((sum, p) => sum + (p.weight ?? 1), 0);
      for (const part of solid) {
        const [a, b, c] = part.size;
        const shape =
          part.shape === 'box' ? roundedBox(a, b, c)
          : part.shape === 'cylinder' ? (desc.rolls ? RAPIER.ColliderDesc.roundCylinder(b - ROLL_EDGE, a - ROLL_EDGE, ROLL_EDGE) : RAPIER.ColliderDesc.cylinder(b, a))
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
            .setCollisionGroups(solidOf(kind)),
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
    this.rammed = [];
    this.blasts = [];
    // Firecrackers on the ground: set off by the truck rolling over them, and each sets off those beside it a moment later.
    for (const object of this.objects) {
      if (object.fallIn !== undefined && (object.fallIn -= STEP) <= 0) this.fall(object);
      if (object.kind.wanders && !object.knocked && !object.near) this.stroll(object);
      // Birds and the like, startled: up and away from the truck in a flurry, before it is on them.
      if (object.kind.flee && truck && !object.knocked && !object.near) {
        const p = object.body.translation();
        const t = truck.body.translation();
        const away = Math.hypot(p.x - t.x, p.z - t.z);
        if (away < object.kind.flee && Math.abs(p.y - t.y) < 4) {
          object.near = true;
          const out = Math.max(away, 0.5);
          object.body.wakeUp();
          // Each her own way: away from it, give or take, and up off the ground, wings going.
          const turn = (this.random() - 0.5) * 1.6;
          const ox = (p.x - t.x) / out, oz = (p.z - t.z) / out;
          const run = 3.5 + this.random() * 2;
          object.body.setLinvel({ x: (ox * Math.cos(turn) - oz * Math.sin(turn)) * run, y: 3 + this.random() * 2.5, z: (ox * Math.sin(turn) + oz * Math.cos(turn)) * run }, true);
          object.body.setAngvel({ x: 0, y: (this.random() - 0.5) * 6, z: 0 }, true);
        }
      }
      if (!object.kind.trip || object.knocked) continue;
      const p = object.body.translation();
      const t = truck?.body.translation();
      if (object.tripIn !== undefined && (object.tripIn -= STEP) <= 0) this.trip(object);
      else if (object.tripIn === undefined && t && truck && this.against(truck, p) && Math.abs(p.y - t.y) < 2) this.trip(object);
    }
    if (truck) {
      this.clearBeneath(truck, stalled);
      this.meet(truck);
    }
    for (const object of this.objects) {
      if (object.fuse >= 0 && (object.fuse -= STEP) < 0) this.explode(object);
      if (object.body.isSleeping()) {
        object.was = null;
        continue;
      }
      if (object.knocked) {
        this.listen(object);
        continue;
      }
      if (object.rolling) {
        // Rolling free is not being knocked. Run into something, it is: from then on it is like anything else that has been hit.
        // How it goes meanwhile is whoever let it go's affair.
        if (!this.meets(object)) continue;
        object.rolling = false;
      }
      const v = object.body.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      // A scaffold is tied together and to the house: something flung at it does not bring it down. Only the truck does,
      // or the pieces next to it going.
      // So does a crash barrier, against anything but the truck going fast.
      if ((object.kind.collapse || object.kind.sturdy) && this.held && !object.near && object.fallIn === undefined) {
        const p = object.body.translation();
        const t = truck?.body.translation();
        const tv = truck?.body.linvel();
        const hard = !object.kind.sturdy || (tv !== undefined && Math.hypot(tv.x, tv.z) >= object.kind.sturdy);
        if (t && truck && this.against(truck, p) && hard) object.near = true;
        else {
          this.stand(object);
          continue;
        }
      }
      if (speed < KNOCK_SPEED) {
        if (this.held && !object.near) {
          const p = object.body.translation();
          const t = truck?.body.translation();
          // The truck is here: from now on it is pushed about like anything else. Otherwise, back as it was put. A crash
          // barrier only gives way to a truck going fast enough to go through it.
          const v = truck?.body.linvel();
          const hard = !object.kind.sturdy || (v !== undefined && Math.hypot(v.x, v.z) >= object.kind.sturdy);
          if (t && truck && this.against(truck, p) && hard) object.near = true;
          else this.stand(object);
        }
        continue;
      }
      object.knocked = true;
      this.partWires(object);
      if (object.kind.collapse) this.spread(object);
      // Something light that the truck has just hit is tossed up, below; and it is not to
      // come up under the truck's nose and toss the truck. It stops being solid to the
      // truck here and now, not a step later.
      if (truck && object.kind.mass < UNDER_MASS && !this.under.has(object)) {
        const t = truck.body.translation();
        const p = object.body.translation();
        if (Math.hypot(p.x - t.x, p.z - t.z) < 6) {
          this.setGroups(object, this.letThrough(object));
          this.under.add(object);
        }
      }
      if (object.kind.explosive) object.fuse = object.kind.fuse ?? FUSE_SECONDS;
      object.wrecked = object.kind.wrecked !== undefined && speed >= WRECK_SPEED;
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

  /**
   * A cylinder of gas going off: everything loose within reach is thrown outward and up, the
   * lighter the further, and the cylinder itself goes up like a rocket. Anything else
   * explosive that it reaches follows a moment later.
   */
  private explode(object: LooseObject): void {
    const at = object.body.translation();
    const bang = object.kind.bang ?? { kind: 'gas' as const, power: 1 };
    this.blasts.push({ x: at.x, y: at.y, z: at.z, ...bang });
    this.throwFrom(at, object);
  }

  /** Throw everything loose that is within reach of a blast, whatever caused it. `object` is the thing that blew up, if it was one of these. */
  throwFrom(at: { x: number; y: number; z: number; radius?: number }, object: LooseObject | null = null): void {
    const reach = at.radius ?? BLAST_RADIUS;
    for (const other of this.objects) {
      if (other.kind.stable && other !== object) continue;
      const p = other.body.translation();
      const dx = p.x - at.x;
      const dz = p.z - at.z;
      const away = Math.hypot(dx, dz);
      if (away > reach) continue;
      if (other === object) {
        other.body.setLinvel({ x: (this.random() - 0.5) * 6, y: 15, z: (this.random() - 0.5) * 6 }, true);
        other.body.setAngvel({ x: 9, y: 2, z: 7 }, true);
        continue;
      }
      const mass = other.body.mass();
      const push = BLAST_SPEED * (1 - away / reach) * Math.min(1, 150 / mass);
      const out = Math.max(away, 0.3);
      other.body.applyImpulse({ x: (dx / out) * push * mass, y: push * 0.7 * mass, z: (dz / out) * push * mass }, true);
      other.body.applyTorqueImpulse({ x: (this.random() - 0.5) * mass * 2, y: 0, z: (this.random() - 0.5) * mass * 2 }, true);
      // Blown over, not run into: it is not for the truck's load to answer for.
      if (!other.knocked) {
        other.knocked = true;
        this.partWires(other);
        other.wrecked = other.kind.wrecked !== undefined && push >= WRECK_SPEED;
        const [x, y, z] = other.desc.pos;
        this.events.push({ object: other, at: { x, y, z } });
        if (other.kind.explosive) other.fuse = 0.12 + this.random() * 0.3;
      }
    }
  }

  /**
   * A pole going over takes its wires with it: they part, on both sides of it, and the
   * halves left on the poles next along drop and hang there, live.
   */
  private partWires(pole: LooseObject): void {
    if (!pole.kind.parts.some((part) => part.wire)) return;
    pole.cut = 3;
    const [x, y, z] = pole.desc.pos;
    this.arcs.push({ x, y: y + 6.6, z });
    for (const other of this.objects) {
      if (other === pole || other.knocked || !other.kind.parts.some((part) => part.wire)) continue;
      const dx = x - other.desc.pos[0];
      const dz = z - other.desc.pos[2];
      if (Math.hypot(dx, dz) > POLE_SPACING + 1.5) continue;
      // Which of its sides the fallen pole was on: its wires run along its own Z.
      const turn = other.desc.rotY ?? 0;
      // Only the poles in the same row: the one over the road is as near, but nothing joins the two.
      if (Math.abs(dx * Math.cos(turn) - dz * Math.sin(turn)) > 1.5) continue;
      const ahead = dx * Math.sin(turn) + dz * Math.cos(turn) > 0;
      const bit = ahead ? 1 : 2;
      if (!other.kind.parts.some((part) => part.wire === (ahead ? 1 : -1)) || other.cut & bit) continue;
      other.cut |= bit;
      this.arcs.push({ x: other.desc.pos[0], y: other.desc.pos[1] + 1.8, z: other.desc.pos[2] });
    }
  }

  /** Wires that have parted since the last call: where the loose end of each is. */
  drainArcs(): { x: number; y: number; z: number }[] {
    const out = this.arcs;
    this.arcs = [];
    return out;
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
   * The truck meeting something light at speed is settled here rather than left to the
   * solver. At 80 km/h the truck is a third of a metre into a parked scooter before the
   * solver hears of it, and what the solver does about that is throw the truck in the air.
   * So whatever light thing the truck is about to reach is sent on its way with the truck's
   * own speed, the truck gives up its share of momentum for it, level and through its
   * middle, and the two never press on each other. The rest follows as for any knock: it is
   * tossed, spun and heard.
   */
  private meet(truck: Truck): void {
    const tv = truck.body.linvel();
    const speed = Math.hypot(tv.x, tv.z);
    // Slowly, things are nudged and leant on in the ordinary way.
    if (speed < MEET_SPEED) return;
    const t = truck.body.translation();
    const ahead = STEP * 2;
    const met: LooseObject[] = [];
    this.world.intersectionsWithShape(
      { x: t.x + tv.x * ahead, y: t.y + AROUND_RISE, z: t.z + tv.z * ahead }, truck.body.rotation(), this.aroundShape,
      (collider) => {
        const object = this.byCollider.get(collider.handle);
        if (object && !object.knocked && object.kind.mass < UNDER_MASS && !this.under.has(object) && !met.includes(object) && (!object.kind.sturdy || speed >= object.kind.sturdy)) met.push(object);
        return true;
      },
      undefined, groups(GROUP.all, GROUP.prop),
    );
    const mass = truck.body.mass();
    for (const object of met) {
      const own = object.body.mass();
      object.body.setLinvel({ x: tv.x * 1.05, y: 0, z: tv.z * 1.05 }, true);
      this.setGroups(object, this.letThrough(object));
      this.under.add(object);
      const share = (own * mass) / (mass + own);
      truck.body.applyImpulse({ x: -tv.x * share, y: 0, z: -tv.z * share }, true);
    }
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
    const touching = (shape: RAPIER.Cuboid, lift: number, take: (object: LooseObject) => void, along = 0) => {
      v.set(0, lift, along).applyQuaternion(q);
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
    // Whatever fits under the frame, or has fallen flat; and anything light at all, standing
    // or not. A scooter is taller than the frame is high, but once the nose has been lifted
    // by the first of a row the next goes under it still standing, the truck climbs onto
    // them, and over it goes.
    touching(this.underShape, -UNDER_DROP, (object) => {
      if (object.height < UNDER_HEIGHT || lying(object) || object.kind.mass < UNDER_MASS) found.add(object);
    });
    // And anything light is done with the truck once the truck has sent it flying: from
    // then until it is clear, the truck goes through it rather than be lifted or tripped
    // by it.
    touching(this.aroundShape, AROUND_RISE, (object) => {
      if (object.knocked && object.kind.mass < UNDER_MASS) found.add(object);
    });
    // Something thin hit fast can end up inside the cab before the physics has caught it.
    // It is not left there: it is let out the way it came.
    touching(this.cabShape, TRUCK.cab.pos[1], (object) => found.add(object), TRUCK.cab.pos[2]);

    // A pole or a barrier arm caught across the nose and pushed along for as long as the
    // truck keeps going: after a moment of that it is let through, to drop where it is.
    // What has come to rest on the cab roof or in the bed is left alone: it is lying there
    // like anything else would.
    const riding = new Set<LooseObject>();
    if (Math.abs(truck.forwardSpeed()) > CARRYING_SPEED) {
      for (const along of [NOSE_ALONG, -NOSE_ALONG]) {
        touching(this.noseShape, 0.3, (object) => {
          if (object.knocked) riding.add(object);
        }, along);
      }
    }
    for (const object of this.riding) if (!riding.has(object)) object.carried = 0;
    for (const object of riding) {
      object.carried += STEP;
      if (object.carried > CARRIED_SECONDS) found.add(object);
    }
    this.riding = riding;

    // Once let through, a thing stays so until it is right out from the truck: turned solid
    // again while still inside it, it would be thrown out like a cork.
    if (stalled || this.under.size || found.size) {
      touching(this.aroundShape, AROUND_RISE, (object) => {
        if (stalled || this.under.has(object)) found.add(object);
      });
    }
    // A crash barrier still standing is never gone through: it holds, or it is broken first.
    for (const object of found) if (object.kind.sturdy && !object.near) found.delete(object);
    for (const object of found) if (!this.under.has(object)) this.setGroups(object, this.letThrough(object));
    for (const object of this.under) if (!found.has(object)) this.setGroups(object, solidOf(object.kind));
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

  /** What something is while the truck is passing over or through it. A light thing in the air is kept off the load as well. */
  private letThrough(object: LooseObject): number {
    return object.kind.mass < UNDER_MASS ? PASSING_THROUGH : PASSING_UNDER;
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

  /** Back exactly as it was put, still, and asleep. */
  /** Let one go where it is put, lying as it is turned, moving and spinning as given: to roll until it meets something. */
  release(object: LooseObject, at: { x: number; y: number; z: number }, turn: { x: number; y: number; z: number; w: number }, way: { x: number; z: number }, pace: number, radius: number): void {
    if (this.under.delete(object)) this.setGroups(object, solidOf(object.kind));
    object.body.enableCcd(true);
    object.body.setLinearDamping(0);
    object.body.setAngularDamping(0.05);
    object.body.setTranslation(at, true);
    object.body.setRotation(turn, true);
    object.body.setLinvel({ x: way.x * pace, y: 0, z: way.z * pace }, true);
    object.body.setAngvel({ x: (way.z * pace) / radius, y: 0, z: (-way.x * pace) / radius }, true);
    Object.assign(object, { rolling: true, pace, knocked: false, near: true, wrecked: false, carried: 0, was: null, hush: 0, fuse: -1 });
  }

  /**
   * Whether something rolling is up against anything but what it rolls on and the others rolling with it. What it
   * rolls on is whatever it touches from above: the ground, or a pavement or a kerb that is not ground. What it meets
   * side on (a car, a wall, the truck) it has run into.
   */
  private meets(object: LooseObject): boolean {
    let met = false;
    // Something much heavier than what it meets (a coil of steel against a car, a lamp, a stall) goes through it and
    // throws it aside; against the truck, or anything that does not give, it is brought up short.
    const heavy = object.kind.mass >= RAMS_ABOVE;
    for (let n = 0; n < object.body.numColliders() && !met; n++) {
      const own = object.body.collider(n);
      this.world.contactPairsWith(own, (other) => {
        if (met || (other.collisionGroups() >>> 16) & GROUP.ground || this.byCollider.get(other.handle)?.rolling) return;
        this.world.contactPair(own, other, (manifold) => {
          if (manifold.numContacts() === 0 || Math.abs(manifold.normal().y) >= 0.7) return;
          const body = other.parent();
          const loose = this.byCollider.get(other.handle);
          const truck = ((other.collisionGroups() >>> 16) & GROUP.truck) !== 0;
          if (heavy && body?.isKinematic()) {
            if (!this.rammed.some((r) => r.body === body)) this.rammed.push({ body, by: object });
          } else if (heavy && !truck && !loose && body?.isDynamic() && body.mass() < object.body.mass()) {
            // A car it has already thrown aside, still against it: on it goes.
          } else if (heavy && loose && loose.kind.mass < object.kind.mass / 4) {
            // Thrown aside, and on it goes.
          } else met = true;
        });
      });
    }
    return met;
  }

  /** A firecracker going off: knocked, as if hit, and its neighbours lit to go off in turn. */
  private trip(object: LooseObject): void {
    object.knocked = true;
    object.tripIn = undefined;
    const p = object.body.translation();
    // A little jump and a twitch, as a string does going off: not thrown.
    object.body.applyImpulse({ x: (this.random() - 0.5) * 0.6, y: 1.2, z: (this.random() - 0.5) * 0.6 }, true);
    object.body.applyTorqueImpulse({ x: 0, y: (this.random() - 0.5) * 0.4, z: 0 }, true);
    const event = { object, at: { x: p.x, y: p.y, z: p.z } };
    this.events.push(event);
    this.fresh.push(event);
    for (const other of this.objects) {
      if (other === object || !other.kind.trip || other.knocked || other.tripIn !== undefined) continue;
      const q = other.body.translation();
      if (Math.hypot(q.x - p.x, q.z - p.z) < 1.3) other.tripIn = 0.12 + this.random() * 0.1;
    }
  }

  /** A piece of a scaffold letting go: no longer held, pushed over the way the scaffold falls, and those beside it to follow. */
  private fall(object: LooseObject): void {
    object.fallIn = undefined;
    this.spread(object);
    if (object.knocked) return;
    object.near = true;
    const [lx, lz] = object.desc.lean ?? [this.random() - 0.5, this.random() - 0.5];
    const m = object.body.mass();
    const push = m * (1.2 + this.random() * 0.8);
    object.body.wakeUp();
    object.body.applyImpulse({ x: lx * push + (this.random() - 0.5) * m * 0.6, y: 0, z: lz * push + (this.random() - 0.5) * m * 0.6 }, true);
    // Toppled about the line across its fall, top first.
    object.body.applyTorqueImpulse({ x: lz * m * 0.5, y: (this.random() - 0.5) * m * 0.2, z: -lx * m * 0.5 }, true);
  }

  /** Something thrown up from below, as a manhole cover by the water under it: let go and sent off at this velocity, tumbling. */
  launch(object: LooseObject, velocity: { x: number; y: number; z: number }, tumble = 8): void {
    object.near = true;
    object.body.wakeUp();
    object.body.setLinvel(velocity, true);
    object.body.setAngvel({ x: (this.random() - 0.5) * tumble, y: (this.random() - 0.5) * 4, z: (this.random() - 0.5) * tumble }, true);
  }

  /** How high the ground is, where the level has height in it: for things that walk about on it. */
  ground?: (x: number, z: number) => number;

  /** A step of a hen's day: over toward somewhere near her doorstep, turning as she goes; there, a while pecking; then off again. */
  private stroll(object: LooseObject): void {
    const [hx, hy, hz] = object.desc.pos;
    const w = (object.walk ??= { x: hx, z: hz, yaw: object.desc.rotY ?? 0, tx: hx, tz: hz, pause: this.random() * 2, peck: 0 });
    if (w.pause > 0) {
      w.pause -= STEP;
      w.peck += STEP;
    } else {
      const dx = w.tx - w.x, dz = w.tz - w.z;
      const left = Math.hypot(dx, dz);
      if (left < 0.1) {
        const reach = object.kind.wanders!;
        const a = this.random() * Math.PI * 2, d = this.random() * reach;
        w.tx = hx + Math.cos(a) * d;
        w.tz = hz + Math.sin(a) * d;
        w.pause = 0.4 + this.random() * 2.2;
        w.peck = 0;
      } else {
        const want = Math.atan2(dx, dz);
        w.yaw += Math.atan2(Math.sin(want - w.yaw), Math.cos(want - w.yaw)) * Math.min(1, STEP * 6);
        const pace = Math.min(left, 0.45 * STEP);
        w.x += (dx / left) * pace;
        w.z += (dz / left) * pace;
      }
    }
    // Head down and up again while she stands: tipped forward a little in time.
    const tip = w.pause > 0 ? Math.max(0, Math.sin(w.peck * 9)) * 0.35 : 0;
    const y = this.ground ? this.ground(w.x, w.z) : hy;
    q.setFromEuler(e.set(tip, w.yaw, 0, 'YXZ'));
    object.body.setTranslation({ x: w.x, y, z: w.z }, true);
    object.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    object.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    object.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  /** Light the pieces of a scaffold next to this one, where they were put up: they go a moment later. */
  private spread(object: LooseObject): void {
    const [x, y, z] = object.desc.pos;
    for (const other of this.objects) {
      if (other === object || !other.kind.collapse || other.knocked || other.fallIn !== undefined || (other.near && !other.body.isSleeping())) continue;
      const [ox, oy, oz] = other.desc.pos;
      if (Math.abs(ox - x) < 2.6 && Math.abs(oy - y) < 2 && Math.abs(oz - z) < 2.2) other.fallIn = 0.04 + this.random() * 0.1;
    }
  }

  /** Whether a place is within reach of the truck's body: inside it, or within a little of it all round. */
  private against(truck: Truck, p: { x: number; y: number; z: number }): boolean {
    const t = truck.body.translation();
    const r = truck.body.rotation();
    v.set(p.x - t.x, p.y - t.y, p.z - t.z).applyQuaternion(q.set(-r.x, -r.y, -r.z, r.w));
    return Math.abs(v.x) < TRUCK.frame.half[0] + HELD_MARGIN && Math.abs(v.z) < TRUCK.frame.half[2] + 0.9 + HELD_MARGIN && Math.abs(v.y) < 3;
  }

  /** Take one away again, to where it waits to be let go. */
  park(object: LooseObject): void {
    if (this.under.delete(object)) this.setGroups(object, solidOf(object.kind));
    Object.assign(object, { rolling: false, knocked: false, near: false, wrecked: false, carried: 0, was: null, hush: 0, fuse: -1 });
    this.stand(object);
  }

  private stand(object: LooseObject): void {
    if (object.walk) return;
    const [x, y, z] = object.desc.pos;
    const p = object.body.translation();
    if (Math.abs(p.x - x) + Math.abs(p.y - y) + Math.abs(p.z - z) > 0.01) {
      q.setFromEuler(e.set(object.desc.tilt ?? 0, object.desc.rotY ?? 0, 0, 'YXZ'));
      object.body.setTranslation({ x, y, z }, false);
      object.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, false);
    }
    object.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    object.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    object.body.sleep();
  }

  /** Stand everything back up where it started. */
  reset(): void {
    const zero = { x: 0, y: 0, z: 0 };
    for (const object of this.under) this.setGroups(object, solidOf(object.kind));
    this.under.clear();
    this.fresh = [];
    this.arcs = [];
    for (const object of this.objects) {
      object.cut = 0;
      // Whatever was never disturbed is still where it belongs, and is best left asleep. A piece of a scaffold that its
      // neighbour had just set going has been disturbed, though it has not moved yet: left with that, it would come down
      // again, and the rest after it.
      const going = object.fallIn !== undefined || object.near;
      object.fallIn = undefined;
      const walked = object.walk !== undefined;
      object.walk = undefined;
      if (!object.knocked && !object.rolling && !going && !walked && object.body.isSleeping()) continue;
      const [x, y, z] = object.desc.pos;
      q.setFromEuler(e.set(object.desc.tilt ?? 0, object.desc.rotY ?? 0, 0, 'YXZ'));
      object.body.setTranslation({ x, y, z }, false);
      object.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, false);
      object.body.setLinvel(zero, false);
      object.body.setAngvel(zero, false);
      object.body.sleep();
      object.knocked = false;
      object.tripIn = undefined;
      object.fallIn = undefined;
      object.rolling = false;
      object.near = false;
      object.wrecked = false;
      object.carried = 0;
      object.was = null;
      object.hush = 0;
      object.fuse = -1;
    }
    this.blasts = [];
    this.landings = [];
    this.riding.clear();
    this.events = [];
    this.seed = 3;
  }
}
