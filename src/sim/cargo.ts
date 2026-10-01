import RAPIER from '@dimforge/rapier3d-compat';
import { Euler, Quaternion, Vector3 } from 'three';
import { GROUP, PHYSICS, groups, type Vec3 } from '../config';
import { CARGO_TYPES, stageForHp, type CargoType, type CargoTypeId, type PartDesc, type Stage } from './cargo-types';
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
}

export type CargoEvent =
  /** Lost some value. `staged` is true when it also dropped a damage stage. */
  | { kind: 'damage'; item: CargoItem; loss: number; staged: boolean }
  /** One of the item's own parts came off; its existing mesh should follow `debris`. */
  | { kind: 'detach'; item: CargoItem; part: number; debris: Debris }
  /** A new loose piece appeared where the item was. */
  | { kind: 'debris'; item: CargoItem; debris: Debris }
  | { kind: 'destroyed'; item: CargoItem }
  /** Fell off the truck and stayed off. */
  | { kind: 'lost'; item: CargoItem; loss: number };

const CARGO_GROUPS = groups(GROUP.cargo, GROUP.all);
/** How quickly an item's steady load catches up with the force on it, per step. */
const LOAD_FOLLOW = 0.3;
/** No damage while the load settles after spawning. */
const GRACE_SECONDS = 0.75;
/** Seconds off the truck before an item counts as lost. */
const LOST_SECONDS = 2.5;
/** One collision plays out over a few steps. It is judged once, on its strongest moment in this window. */
const HIT_WINDOW = 0.12;
/** How much of the previous steps' jolt carries over into the running total, per step. */
const SHOCK_DECAY = 0.7;
/** Being squeezed in a pile counts for less than being knocked about by the same force. */
const SQUEEZE_WEIGHT = 0.4;

const q = new Quaternion();
const q2 = new Quaternion();
const e = new Euler();
const v = new Vector3();

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
  }
}

export class CargoItem {
  readonly type: CargoType;
  /** Null once destroyed. */
  body: RAPIER.RigidBody | null;
  hp = 100;
  stage: Stage = 0;
  lost = false;
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

  constructor(type: CargoType, body: RAPIER.RigidBody) {
    this.type = type;
    this.body = body;
    this.mass = type.parts.reduce((m, p) => m + p.mass, 0);
    this.attached = type.parts.map(() => true);
    this.partColliders = type.parts.map(() => null);
  }

  /** What the item is worth right now. */
  get value(): number {
    return this.lost || this.stage === 3 ? 0 : (this.type.value * this.hp) / 100;
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

  constructor(private readonly world: RAPIER.World) {}

  /** Remove everything and load the truck afresh. */
  load(placements: CargoPlacement[], truckPos: Vec3): void {
    for (const item of this.items) if (item.body) this.world.removeRigidBody(item.body);
    for (const d of this.debris) this.world.removeRigidBody(d.body);
    this.items.length = 0;
    this.debris.length = 0;
    this.byCollider.clear();
    this.events = [];
    this.age = 0;
    this.seed = 1;

    for (const place of placements) {
      const type: CargoType = CARGO_TYPES[place.type];
      q.setFromEuler(e.set(0, place.rotY ?? 0, 0));
      // No CCD on cargo: riding a fast-moving bed, it stalls the items in world space
      // and they slide out through the tailgate.
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(truckPos[0] + place.pos[0], truckPos[1] + place.pos[1], truckPos[2] + place.pos[2])
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
      );
      const item = new CargoItem(type, body);
      item.lastPos.set(truckPos[0] + place.pos[0], truckPos[1] + place.pos[1], truckPos[2] + place.pos[2]);

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
    for (const item of this.items) {
      const body = item.body;
      if (!body || item.lost) continue;
      const t = body.translation();
      item.lastPos.set(t.x, t.y, t.z);

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
        // Damage grows with how hard the hit was, with no ceiling: a heavy crash should
        // cost far more than a nudge.
        if (impact > item.type.threshold) {
          if (item.hitPeak === 0) item.hitWindow = HIT_WINDOW;
          item.hitPeak = Math.max(item.hitPeak, impact);
        }
        if (item.hitPeak > 0 && (item.hitWindow -= dt) <= 0) {
          const peak = item.hitPeak;
          item.hitPeak = 0;
          this.damage(item, (peak - item.type.threshold) * item.type.fragility);
        }
      }

      if (!item.body) continue;
      item.offTruckTime = truck.isOnBed(t) ? 0 : item.offTruckTime + dt;
      if (item.offTruckTime > LOST_SECONDS) {
        const loss = item.value;
        item.lost = true;
        this.events.push({ kind: 'lost', item, loss });
      }
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
    this.events.push({ kind: 'damage', item, loss: before - item.value, staged: newStage !== oldStage });

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
    const debris = { desc: part, body: piece };
    this.debris.push(debris);
    return debris;
  }

  /** Seeded, so headless runs repeat exactly. */
  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}
