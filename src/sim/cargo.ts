import RAPIER from '@dimforge/rapier3d-compat';
import { Euler, Quaternion, Vector3 } from 'three';
import { GROUP, PHYSICS, TRUCK, groups, type Vec3 } from '../config';
import { CARGO_TYPES, hitDamage, stageForHp, type CargoType, type CargoTypeId, type PartDesc, type Stage } from './cargo-types';
import type { Truck } from './truck';

export interface CargoPlacement {
  type: CargoTypeId;
  /** Position relative to the truck chassis. */
  pos: Vec3;
  /** Turn about the vertical axis, radians. */
  rotY?: number;
}

/** A loose piece that has come off an item. Worth nothing, but still gets in the way. */
export interface Debris {
  desc: PartDesc;
  body: RAPIER.RigidBody;
  /** The item it came off. */
  owner: CargoItem;
}

export type CargoEvent =
  /** Lost some value. `staged` is true when it also dropped a damage stage. */
  | { kind: 'damage'; item: CargoItem; loss: number; staged: boolean }
  /** One of the item's own parts came off; its existing mesh should follow `debris`. */
  | { kind: 'detach'; item: CargoItem; part: number; debris: Debris }
  /** A new loose piece appeared where the item was. */
  | { kind: 'debris'; item: CargoItem; debris: Debris }
  | { kind: 'destroyed'; item: CargoItem }
  /** Came off the truck and stayed off. It can still be fetched back. */
  | { kind: 'fallen'; item: CargoItem; loss: number }
  /** Back on the truck. */
  | { kind: 'recovered'; item: CargoItem; gain: number }
  /** A destroyed item's salvage changed in value, as pieces of it left the truck (negative) or came back. */
  | { kind: 'scrap'; item: CargoItem; change: number };

const CARGO_GROUPS = groups(GROUP.cargo, GROUP.all);
/** How quickly an item's steady load catches up with the force on it, per step. */
const LOAD_FOLLOW = 0.3;
/** No damage while the load settles after spawning. */
const GRACE_SECONDS = 0.75;
/** Seconds off the truck before an item counts as fallen. */
const FALLEN_SECONDS = 2.5;
/** After a thrown item lands in the bed, how long it and everything it landed on are spared. */
const LANDING_GRACE = 0.8;
/** How often a wreck's pieces are counted. */
const SCRAP_INTERVAL = 0.5;
/** One collision plays out over a few steps. It is judged once, on its strongest moment in this window. */
const HIT_WINDOW = 0.12;
/** Blows this close together are one incident, charged once for the worst of them. */
const INCIDENT_SECONDS = 1.0;
/** How much of the previous steps' jolt carries over into the running total, per step. */
const SHOCK_DECAY = 0.7;
/** Being squeezed in a pile counts for less than being knocked about by the same force. */
const SQUEEZE_WEIGHT = 0.4;

const q = new Quaternion();
const q2 = new Quaternion();
const e = new Euler();
const v = new Vector3();
const UP = new Vector3(0, 1, 0);

function partRotation(part: PartDesc, target: Quaternion): Quaternion {
  const [x, y, z] = part.rot ?? [0, 0, 0];
  return target.setFromEuler(e.set(x, y, z));
}

function shapeCollider(shape: PartDesc['shape'], size: Vec3): RAPIER.ColliderDesc {
  const [a, b, c] = size;
  switch (shape) {
    case 'box': return RAPIER.ColliderDesc.cuboid(a, b, c);
    case 'cylinder': return RAPIER.ColliderDesc.cylinder(b, a);
    case 'capsule': return RAPIER.ColliderDesc.capsule(b, a);
    case 'sphere': return RAPIER.ColliderDesc.ball(a);
    // Near enough: a squat drum of the same height, so that it lies on its face or its back.
    case 'dome': return RAPIER.ColliderDesc.cylinder(a * 0.45, a * 0.9);
  }
}

export class CargoItem {
  readonly type: CargoType;
  /** Null once destroyed. */
  body: RAPIER.RigidBody | null;
  hp = 100;
  stage: Stage = 0;
  /** Off the truck and not counted toward the load, until it is brought back. */
  fallen = false;
  /** Being carried by the driver: it goes where they go and nothing can hurt it. */
  held = false;
  /** In the air after being thrown, until it first hits something. */
  thrown = false;
  /** Seconds left during which impacts do no damage. */
  immune = 0;
  /** Not part of the original load: picked up along the way for extra value. */
  bonus = false;
  readonly mass: number;
  /** Which parts are still on the item. */
  readonly attached: boolean[];
  /** Per-part colliders, for items without a hull. */
  readonly partColliders: (RAPIER.Collider | null)[];
  /** Last known position, kept after the body is gone. */
  readonly lastPos = new Vector3();
  /** Strongest impact so far, m/s. For tuning. */
  peakImpact = 0;

  /** Contact force gathered this step, and the smoothed steady load it is compared with. */
  force = 0;
  load = 0;
  /** Running totals of recent velocity jolts and force spikes, m/s. */
  knock = 0;
  squeeze = 0;
  readonly prevVel = new Vector3();
  offTruckTime = 0;
  /** Strongest impact of the collision in progress (0 when there is none), and the time left to judge it. */
  hitPeak = 0;
  hitWindow = 0;
  /** Health already taken by the incident in progress, and the time until it is over. */
  incidentDealt = 0;
  incidentLeft = 0;

  constructor(type: CargoType, body: RAPIER.RigidBody) {
    this.type = type;
    this.body = body;
    this.mass = type.parts.reduce((m, p) => m + p.mass, 0);
    this.attached = type.parts.map(() => true);
    this.partColliders = type.parts.map(() => null);
  }

  /** Every piece that has come off it. */
  readonly pieces: Debris[] = [];
  /** Once destroyed: the share of its pieces still on the truck, 0 to 1. */
  scrapShare = 0;
  scrapCheck = 0;

  /**
   * What the item is worth right now, if it is aboard.
   *
   * Even a wreck is worth something as salvage, so value falls from the full price at full
   * health to the salvage share at none, with no jump at the moment of destruction (which
   * would make finishing off a battered item pay). After that the salvage is worth only as
   * much as is left of it: lose half the pieces off the truck and it is worth half.
   */
  get value(): number {
    const { value, salvage } = this.type;
    if (this.stage === 3) return value * salvage * this.scrapShare;
    return value * (salvage + (1 - salvage) * (this.hp / 100));
  }
}

/** Owns every cargo item: spawning, impact damage, falling apart, and being lost. */
export class CargoSystem {
  readonly items: CargoItem[] = [];
  readonly debris: Debris[] = [];
  private readonly byCollider = new Map<number, CargoItem>();
  private events: CargoEvent[] = [];
  private age = 0;
  private seed = 1;
  /** Seconds left during which nothing on the bed takes damage, after a throw lands there. */
  private bedCalm = 0;

  /** `damageScale` multiplies all impact damage: below 1 for a forgiving level, above for a harsh one. */
  constructor(private readonly world: RAPIER.World, private readonly damageScale = 1) {}

  /** Remove everything and load the truck afresh. */
  load(placements: CargoPlacement[], truckPos: Vec3, heading: number): void {
    for (const item of this.items) if (item.body) this.world.removeRigidBody(item.body);
    for (const d of this.debris) this.world.removeRigidBody(d.body);
    this.items.length = 0;
    this.debris.length = 0;
    this.byCollider.clear();
    this.events = [];
    this.age = 0;
    this.seed = 1;
    this.bedCalm = 0;

    for (const place of placements) {
      const type: CargoType = CARGO_TYPES[place.type];
      q.setFromEuler(e.set(0, heading + (place.rotY ?? 0), 0));
      // Where it sits in the world, given which way the truck faces.
      v.set(...place.pos).applyAxisAngle(UP, heading);
      const at = { x: truckPos[0] + v.x, y: truckPos[1] + v.y, z: truckPos[2] + v.z };
      // No CCD on cargo: riding a fast-moving bed, it stalls the items in world space
      // and they slide out through the tailgate.
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(at.x, at.y, at.z)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
      );
      const item = new CargoItem(type, body);
      item.lastPos.set(at.x, at.y, at.z);

      const add = (desc: RAPIER.ColliderDesc, mass: number): RAPIER.Collider => {
        desc
          .setMass(mass)
          .setFriction(type.friction)
          .setRestitution(0.1)
          .setCollisionGroups(CARGO_GROUPS)
          .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
          .setContactForceEventThreshold(0);
        const collider = this.world.createCollider(desc, body);
        this.byCollider.set(collider.handle, item);
        return collider;
      };
      if (type.hull) add(shapeCollider(type.hull.shape, type.hull.size), item.mass);
      else {
        type.parts.forEach((part, i) => {
          partRotation(part, q);
          const desc = shapeCollider(part.shape, part.size)
            .setTranslation(...part.pos)
            .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
          item.partColliders[i] = add(desc, part.mass);
        });
      }
      this.items.push(item);
    }
  }

  /** Feed in one contact force event from the physics step. */
  addForce(colliderA: number, colliderB: number, magnitude: number): void {
    const a = this.byCollider.get(colliderA);
    const b = this.byCollider.get(colliderB);
    if (a) a.force += magnitude;
    if (b && b !== a) b.force += magnitude;
  }

  /** Call once per physics step, after the world has stepped and forces are fed in. */
  update(truck: Truck): void {
    const dt = PHYSICS.dt;
    this.age += dt;
    this.bedCalm -= dt;
    for (const item of this.items) {
      const body = item.body;
      if (!body) {
        this.countScrap(item, truck, dt);
        continue;
      }
      const t = body.translation();
      item.lastPos.set(t.x, t.y, t.z);
      if (item.held) {
        this.quiet(item, body);
        continue;
      }
      const onBed = truck.isOnBed(t);

      // A thrown item that comes down in the bed lands for free, and so does whatever it
      // lands on. Anywhere else, the landing counts like any other impact.
      if (item.thrown && item.force > 0) {
        item.thrown = false;
        if (onBed) {
          item.immune = LANDING_GRACE;
          this.bedCalm = LANDING_GRACE;
        }
      }
      if (item.immune > 0 && !onBed) item.immune = 0;
      item.immune -= dt;
      if (item.immune > 0 || (onBed && this.bedCalm > 0)) {
        this.quiet(item, body);
        this.settle(item, onBed, dt);
        continue;
      }

      // Two things hurt an item, both measured in m/s and both added up over the last few
      // steps, because the solver spreads one collision across several.
      //
      // Knock: how abruptly its own velocity changed, gravity aside. This is what a drop,
      // a landing or a crash does.
      const lv = body.linvel();
      const dv = Math.hypot(lv.x - item.prevVel.x, lv.y - item.prevVel.y - PHYSICS.gravity * dt, lv.z - item.prevVel.z);
      item.prevVel.set(lv.x, lv.y, lv.z);
      // Merely being held up against gravity reads as g * dt; take that off.
      item.knock = item.knock * SHOCK_DECAY + Math.max(0, dv + PHYSICS.gravity * dt);

      // Squeeze: a sudden rise in the force pressing on it, relative to its mass. This is
      // what being caught in a pile-up does, even when the item itself barely moves. Steady
      // load doesn't count: the bottom of a stack is carrying weight, not being hit.
      const spike = item.force - item.load;
      item.load += (item.force - item.load) * LOAD_FOLLOW;
      item.force = 0;
      item.squeeze = item.squeeze * SHOCK_DECAY + Math.max(0, (spike * dt) / item.mass);

      const impact = Math.max(item.knock, item.squeeze * SQUEEZE_WEIGHT);
      if (this.age > GRACE_SECONDS) {
        item.peakImpact = Math.max(item.peakImpact, impact);
        // Damage grows with how hard the hit was, levelling off for the very hardest.
        if (impact > item.type.threshold) {
          if (item.hitPeak === 0) item.hitWindow = HIT_WINDOW;
          item.hitPeak = Math.max(item.hitPeak, impact);
        }
        // One crash hits an item several times over: into the cab, back off it, then the
        // rest of the load piling in. Charge the incident for its worst blow only, topping
        // up if a later one turns out harder.
        if (item.incidentLeft > 0 && (item.incidentLeft -= dt) <= 0) item.incidentDealt = 0;
        if (item.hitPeak > 0 && (item.hitWindow -= dt) <= 0) {
          const due = hitDamage(item.type, item.hitPeak) * this.damageScale;
          item.hitPeak = 0;
          if (item.incidentLeft <= 0) item.incidentLeft = INCIDENT_SECONDS;
          if (due > item.incidentDealt) {
            const extra = due - item.incidentDealt;
            item.incidentDealt = due;
            this.damage(item, extra);
          }
        }
      }

      if (item.body) this.settle(item, onBed, dt);
    }
  }

  /**
   * Shake everything on the bed as if the truck had been checked by this many m/s: what
   * hitting a tree does to the load, beyond the little the solver passes on by itself.
   */
  jolt(amount: number, truck: Truck): void {
    for (const item of this.items) {
      if (item.body && !item.held && truck.isOnBed(item.body.translation())) item.knock += amount;
    }
  }

  /** Track whether an item is on the truck, and report it falling off or coming back. */
  private settle(item: CargoItem, onBed: boolean, dt: number): void {
    item.offTruckTime = onBed ? 0 : item.offTruckTime + dt;
    if (!item.fallen && item.offTruckTime > FALLEN_SECONDS) {
      item.fallen = true;
      // Extra items found along the way were never part of the load, so losing one costs nothing.
      this.events.push({ kind: 'fallen', item, loss: item.bonus ? 0 : item.value });
    } else if (item.fallen && onBed && !item.thrown) {
      item.fallen = false;
      this.events.push({ kind: 'recovered', item, gain: item.value });
    }
  }

  /** Forget an item's recent motion and load, so nothing that happened while it was spared counts later. */
  private quiet(item: CargoItem, body: RAPIER.RigidBody): void {
    const lv = body.linvel();
    item.prevVel.set(lv.x, lv.y, lv.z);
    item.load = item.force;
    item.force = 0;
    item.knock = item.squeeze = item.hitPeak = 0;
  }

  /** Hand an item to the driver: it stops being a physical object until it is put down or thrown. */
  hold(item: CargoItem): void {
    const body = item.body!;
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    for (let i = 0; i < body.numColliders(); i++) body.collider(i).setEnabled(false);
    item.held = true;
    item.thrown = false;
    if (!item.fallen) {
      // Lifted straight off the truck.
      item.fallen = true;
      this.events.push({ kind: 'fallen', item, loss: item.bonus ? 0 : item.value });
    }
  }

  /** Let go of a held item at a position, with a velocity. `thrown` marks it as in flight. */
  release(item: CargoItem, at: Vector3, velocity: Vector3, thrown: boolean): void {
    const body = item.body!;
    body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    for (let i = 0; i < body.numColliders(); i++) body.collider(i).setEnabled(true);
    body.setTranslation(at, true);
    body.setLinvel(velocity, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    item.held = false;
    item.thrown = thrown;
    // Set down by hand, it gets a moment to come to rest unharmed.
    item.immune = thrown ? 0 : 0.6;
    item.offTruckTime = FALLEN_SECONDS;
    this.quiet(item, body);
  }

  /**
   * Shove everything loose out from under the truck, to either side. Used when the truck
   * has just been set back on its wheels: it would otherwise come down on top of its own
   * spilled load and be left stranded there.
   */
  clearFootprint(truck: Truck): void {
    const t = truck.body.translation();
    const r = truck.body.rotation();
    const halfWidth = TRUCK.frame.half[0] + 0.7;
    const halfLength = TRUCK.frame.half[2] + 0.7;
    const zero = { x: 0, y: 0, z: 0 };
    const bodies = [...this.items.map((i) => i.body), ...this.debris.map((d) => d.body)];
    for (const body of bodies) {
      if (!body) continue;
      const p = body.translation();
      q.set(r.x, r.y, r.z, r.w);
      v.set(p.x - t.x, p.y - t.y, p.z - t.z).applyQuaternion(q2.copy(q).invert());
      if (Math.abs(v.x) > halfWidth || Math.abs(v.z) > halfLength || v.y > 2.5) continue;
      v.x = (v.x < 0 ? -1 : 1) * (halfWidth + 0.6 + this.random());
      v.applyQuaternion(q);
      body.setTranslation({ x: t.x + v.x, y: p.y + 0.2, z: t.z + v.z }, true);
      body.setLinvel(zero, true);
      body.setAngvel(zero, true);
    }
  }

  /** Events since the last call. */
  drainEvents(): CargoEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  private damage(item: CargoItem, amount: number): void {
    const before = item.value;
    const oldStage = item.stage;
    item.hp = Math.max(0, item.hp - amount);
    const newStage = stageForHp(item.hp);
    item.stage = newStage;
    // Destroyed where it sits: all of its wreckage starts out aboard, or none of it.
    if (newStage === 3) item.scrapShare = item.fallen ? 0 : 1;
    // An item lying off the truck is already off the books; further damage shows when it comes back.
    const loss = item.fallen ? 0 : before - item.value;
    this.events.push({ kind: 'damage', item, loss, staged: newStage !== oldStage });

    // Pass through every stage on the way, so a single huge hit still sheds parts in order.
    for (let s = oldStage + 1; s <= newStage; s++) {
      if (s === 3) this.destroy(item);
      else item.type.parts.forEach((part, i) => {
        if (part.detachAt === s && item.attached[i]) this.detach(item, i);
      });
    }
  }

  private detach(item: CargoItem, index: number): void {
    const part = item.type.parts[index];
    item.attached[index] = false;
    const collider = item.partColliders[index];
    if (collider) {
      this.byCollider.delete(collider.handle);
      this.world.removeCollider(collider, true);
      item.partColliders[index] = null;
    }
    const debris = this.spawnDebris(item, part);
    this.events.push({ kind: 'detach', item, part: index, debris });
  }

  private destroy(item: CargoItem): void {
    const type = item.type;
    if (type.debris) {
      for (const desc of type.debris) this.events.push({ kind: 'debris', item, debris: this.spawnDebris(item, desc) });
    } else {
      type.parts.forEach((_, i) => {
        if (item.attached[i]) this.detach(item, i);
      });
    }
    const body = item.body!;
    for (let i = 0; i < body.numColliders(); i++) this.byCollider.delete(body.collider(i).handle);
    this.world.removeRigidBody(body);
    item.body = null;
    this.events.push({ kind: 'destroyed', item });
  }

  /** Create a loose body for a piece, at the place it occupies on the item, flung outward a little. */
  private spawnDebris(item: CargoItem, part: PartDesc): Debris {
    const body = item.body!;
    const t = body.translation();
    const r = body.rotation();
    const lv = body.linvel();
    q.set(r.x, r.y, r.z, r.w);
    v.set(...part.pos).applyQuaternion(q);
    const kick = 1.2;
    const dir = v.lengthSq() > 1e-6 ? v.clone().normalize() : new Vector3(0, 1, 0);
    partRotation(part, q2).premultiply(q);

    const piece = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(t.x + v.x, t.y + v.y, t.z + v.z)
        .setRotation({ x: q2.x, y: q2.y, z: q2.z, w: q2.w })
        .setLinvel(lv.x + dir.x * kick, lv.y + dir.y * kick + 0.8, lv.z + dir.z * kick)
        .setAngvel({ x: this.random() * 6 - 3, y: this.random() * 6 - 3, z: this.random() * 6 - 3 }),
    );
    this.world.createCollider(
      shapeCollider(part.shape, part.size).setMass(part.mass).setFriction(0.7).setRestitution(0.2).setCollisionGroups(CARGO_GROUPS),
      piece,
    );
    const debris = { desc: part, body: piece, owner: item };
    this.debris.push(debris);
    item.pieces.push(debris);
    return debris;
  }

  /** For a destroyed item, keep count of how much of its wreckage is still on the truck. */
  private countScrap(item: CargoItem, truck: Truck, dt: number): void {
    // Twice a second is plenty, and keeps a piece bouncing on the wall from flickering the total.
    item.scrapCheck -= dt;
    if (item.scrapCheck > 0 || !item.pieces.length) return;
    item.scrapCheck = SCRAP_INTERVAL;

    let aboard = 0;
    v.set(0, 0, 0);
    for (const piece of item.pieces) {
      const p = piece.body.translation();
      if (truck.isOnBed(p)) aboard++;
      v.x += p.x;
      v.y += p.y;
      v.z += p.z;
    }
    // The item itself is gone; say it is wherever its pieces are, for anything pointing at it.
    item.lastPos.copy(v).divideScalar(item.pieces.length);

    const before = item.value;
    item.scrapShare = aboard / item.pieces.length;
    const change = item.value - before;
    if (change !== 0) this.events.push({ kind: 'scrap', item, change });
  }

  /** Seeded, so headless runs repeat exactly. */
  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}
