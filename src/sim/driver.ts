import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { DRIVER, GROUP, PHYSICS, TRUCK, groups } from '../config';
import type { CargoItem, CargoSystem } from './cargo';
import type { Riders } from './riders';
import type { Traffic } from './traffic';
import type { Trains } from './trains';
import type { Truck } from './truck';

/** What the player is asking of the driver this step. Presses are true for one step only. */
export interface FootInput {
  /** Direction to walk, in world space on the ground plane; length up to 1. */
  moveX: number;
  moveZ: number;
  run: boolean;
  /** Get out of, or back into, the truck. */
  vehiclePressed: boolean;
  /** Pick something up, or set down what is held. */
  grabPressed: boolean;
  jumpPressed: boolean;
  /** The point on the ground the player is pointing at, if any. */
  aim: { x: number; z: number } | null;
  /** Held down to wind up a throw; letting go throws. */
  charging: boolean;
  /** Abandon a throw being wound up. */
  cancelPressed: boolean;
}

export const NO_FOOT_INPUT: FootInput = {
  moveX: 0, moveZ: 0, run: false, vehiclePressed: false, grabPressed: false, jumpPressed: false, aim: null, charging: false, cancelPressed: false,
};

/** A throw as it would go if released now. */
export interface ThrowPlan {
  start: Vector3;
  velocity: Vector3;
  landing: Vector3;
  /** Seconds in the air. */
  time: number;
  /** Whether the landing point is over the truck bed. */
  inBed: boolean;
}

export type DriverMode = 'driving' | 'onFoot' | 'down';

/** What is solid to the driver: everything, loose cargo included. */
const WORLD = groups(GROUP.all, GROUP.ground | GROUP.truck | GROUP.prop | GROUP.cargo);
const G = -PHYSICS.gravity;
const ANGLE = Math.PI / 4;
/** The tallest thing they can walk up onto without jumping: kerbs, and the gradient of a ramp. */
const STEP = 0.35;
/** How close they come to a wall before stopping. */
const SKIN = 0.02;
/** The ray that feels for the ground starts this far above the feet and reaches this far below them. */
const PROBE_FROM = 0.1;
const PROBE = 0.08;
/** How far above a surface their feet are held. */
const CLEARANCE = 0.05;
const UP_AXIS = { x: 0, y: 1, z: 0 };
const DOWN_AXIS = { x: 0, y: -1, z: 0 };
/** The fastest they can fall, m/s. */
const TERMINAL = 30;
const UP = new Vector3(0, 1, 0);
const UPRIGHT = { x: 0, y: 0, z: 0, w: 1 };
const q = new Quaternion();
const v = new Vector3();

/**
 * The driver, when out of the cab. They can walk within reach of the truck, pick up one
 * piece of cargo at a time, carry it overhead and throw it, and be run down by traffic.
 */
export class Driver {
  mode: DriverMode = 'driving';
  /** Where their feet are. */
  readonly pos = new Vector3();
  /** Direction they face: radians about Y, 0 = toward +Z. */
  yaw = 0;
  /** Ground speed, m/s, for animation. */
  speed = 0;
  held: CargoItem | null = null;
  /** Seconds the current throw has been wound up; 0 when not winding up. */
  charge = 0;
  /** The throw that would happen on release, while one is being wound up. */
  plan: ThrowPlan | null = null;
  /** Off the ground: jumping or falling. */
  airborne = false;
  /** Seconds left to show that a jump was refused because the load is too heavy. */
  tooHeavyLeft = 0;
  /** True while pressing against the limit of how far they may go from the truck. */
  atLeash = false;
  /** Seconds left lying on the ground. */
  downLeft = 0;

  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;
  private readonly shape: RAPIER.Capsule;
  private readonly velocity = new Vector3();
  /** Vertical speed, m/s. */
  private rise = 0;
  private airTime = 0;
  /** Whether something is underfoot. */
  private blockedBelow = false;
  private readonly ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  private safeLeft = 0;
  /** A cancelled wind-up stays cancelled until the button is let go. */
  private cancelled = false;
  private wasCharging = false;
  private seed = 5;

  constructor(private readonly world: RAPIER.World) {
    const halfHeight = DRIVER.height / 2 - DRIVER.radius;
    this.shape = new RAPIER.Capsule(halfHeight, DRIVER.radius);
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    // The body is placed by hand each step, which to the physics engine means it has no mass
    // limit: anything it pressed on would have to give way completely. Standing among the
    // cargo in the bed, it drove the crates down into the truck, squashing the suspension
    // flat, shoving the truck along and wrecking the load. So it presses on nothing at all.
    // What stops the driver walking through things is the sweeping in move(), not this.
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(halfHeight, DRIVER.radius).setCollisionGroups(groups(GROUP.person, 0)),
      this.body,
    );
    this.body.setEnabled(false);
  }

  /** Call once per physics step, before the world steps. `canAct` is false once the level is over. */
  update(dt: number, input: FootInput, truck: Truck, cargo: CargoSystem, traffic: Traffic, riders: Riders, trains: Trains, canAct: boolean): void {
    this.plan = null;
    this.atLeash = false;
    if (this.mode === 'driving') {
      if (input.vehiclePressed && canAct) this.getOut(truck);
      return;
    }

    if (this.mode === 'down') {
      this.tumble(dt);
      this.downLeft -= dt;
      if (this.downLeft <= 0) {
        this.mode = 'onFoot';
        this.safeLeft = DRIVER.safeSeconds;
      }
      return;
    }

    this.safeLeft -= dt;
    if (input.vehiclePressed && !this.held && this.nearDoor(truck)) {
      this.mode = 'driving';
      this.body.setEnabled(false);
      this.charge = 0;
      return;
    }

    if (input.grabPressed) {
      if (this.held) this.setDown(cargo);
      else this.pickUp(truck, cargo);
    }
    this.windUp(dt, input, truck, cargo);
    this.walk(dt, input, truck);

    if (this.held?.body) {
      this.held.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y + DRIVER.carryHeight, z: this.pos.z });
      q.setFromAxisAngle(UP, this.yaw);
      this.held.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }

    if (this.safeLeft <= 0) this.checkTraffic(traffic, riders, trains, cargo);
  }

  reset(): void {
    this.mode = 'driving';
    this.body.setEnabled(false);
    this.held = null;
    this.charge = 0;
    this.plan = null;
    this.downLeft = 0;
    this.safeLeft = 0;
    this.speed = 0;
  }

  /** Out of their depth: put back beside the truck, flat on the ground, without whatever they were carrying. */
  fishOut(truck: Truck, cargo: CargoSystem): void {
    if (this.held) {
      v.set(this.pos.x, this.pos.y + DRIVER.carryHeight, this.pos.z);
      cargo.release(this.held, v, new Vector3(), false);
      this.held.immune = 0;
      this.held = null;
    }
    for (const side of [-1, 1]) {
      this.doorPoint(truck, side, v);
      const centre = { x: v.x, y: v.y + DRIVER.height / 2 + 0.05, z: v.z };
      // The first side tried is kept if both are blocked: better there than in the river.
      if (side < 0 && this.world.intersectionWithShape(centre, { x: 0, y: 0, z: 0, w: 1 }, this.shape, undefined, WORLD, this.collider)) continue;
      this.pos.copy(v);
      this.body.setTranslation(centre, true);
      break;
    }
    this.velocity.set(0, 0, 0);
    this.mode = 'down';
    this.downLeft = DRIVER.downSeconds;
    this.charge = 0;
    this.speed = 0;
    this.rise = 0;
  }

  /** How far a load of this mass can be thrown, in metres. */
  static throwRange(mass: number): number {
    return Math.max(DRIVER.throwShortest, DRIVER.throwMax - mass * DRIVER.throwPerKg);
  }

  /** Step out beside the cab, on the driver's side if there is room, else the other. */
  private getOut(truck: Truck): void {
    if (Math.abs(truck.forwardSpeed()) > DRIVER.exitSpeed) return;
    for (const side of [1, -1]) {
      this.doorPoint(truck, side, v);
      const centre = { x: v.x, y: v.y + DRIVER.height / 2 + 0.05, z: v.z };
      const blocked = this.world.intersectionWithShape(centre, { x: 0, y: 0, z: 0, w: 1 }, this.shape, undefined, WORLD, this.collider);
      if (blocked) continue;
      this.pos.copy(v);
      this.body.setEnabled(true);
      this.body.setTranslation(centre, true);
      this.mode = 'onFoot';
      this.rise = 0;
      this.speed = 0;
      // Facing away from the truck.
      const r = truck.body.rotation();
      const out = new Vector3(side, 0, 0).applyQuaternion(q.set(r.x, r.y, r.z, r.w));
      this.yaw = Math.atan2(out.x, out.z);
      return;
    }
  }

  private doorPoint(truck: Truck, side: number, target: Vector3): Vector3 {
    const t = truck.body.translation();
    const r = truck.body.rotation();
    const [x, y, z] = DRIVER.door;
    target.set(x * side, 0, z).applyQuaternion(q.set(r.x, r.y, r.z, r.w));
    return target.set(t.x + target.x, Math.max(0, t.y - TRUCK.wheel.radius - TRUCK.wheel.restLength) + y, t.z + target.z);
  }

  /** Whether they are standing close enough to a cab door to climb in. */
  nearDoor(truck: Truck): boolean {
    return [1, -1].some((side) => {
      this.doorPoint(truck, side, v);
      return Math.hypot(v.x - this.pos.x, v.z - this.pos.z) < DRIVER.doorReach;
    });
  }

  private walk(dt: number, input: FootInput, truck: Truck): void {
    let pace = 0;
    const moving = Math.hypot(input.moveX, input.moveZ) > 0.01;
    // Winding up a throw roots them to the spot.
    if (moving && this.charge === 0) {
      pace = input.run ? DRIVER.runSpeed : DRIVER.walkSpeed;
      if (this.held) pace *= Math.max(DRIVER.carrySlowest, 1 - this.held.mass * DRIVER.carrySlowPerKg);
    }
    const scale = moving ? pace / Math.hypot(input.moveX, input.moveZ) : 0;
    this.tooHeavyLeft -= dt;
    const grounded = this.fallOrLand(dt);
    if (input.jumpPressed && grounded && this.charge === 0) {
      if (this.held && this.held.mass > DRIVER.jumpMaxLoad) this.tooHeavyLeft = 1.2;
      else this.rise = DRIVER.jumpSpeed;
    }
    this.move(input.moveX * scale * dt, this.rise * dt, input.moveZ * scale * dt);

    // Not too far from the truck: past the limit, they are held at it.
    const t = truck.body.translation();
    const dx = this.pos.x - t.x;
    const dz = this.pos.z - t.z;
    const away = Math.hypot(dx, dz);
    if (away > DRIVER.leash) {
      this.pos.x = t.x + (dx / away) * DRIVER.leash;
      this.pos.z = t.z + (dz / away) * DRIVER.leash;
      this.place();
      this.atLeash = moving;
    }

    this.speed = pace;
    // Carrying, they face where the player points, ready to throw. Otherwise where they walk.
    if (this.held && input.aim) this.yaw = Math.atan2(input.aim.x - this.pos.x, input.aim.z - this.pos.z);
    else if (pace > 0) this.yaw = Math.atan2(input.moveX, input.moveZ);
  }

  /** Gravity, and coming back to earth. Returns whether they are standing on something. */
  private fallOrLand(dt: number): boolean {
    const grounded = this.blockedBelow && this.rise <= 0;
    if (grounded) this.rise = 0;
    else this.rise = Math.max(this.rise - DRIVER.gravity * dt, -TERMINAL);
    // A step or a kerb reads as a moment off the ground; only call it airborne if it lasts.
    this.airTime = grounded ? 0 : this.airTime + dt;
    this.airborne = this.airTime > 0.12;
    return grounded;
  }

  /**
   * Move by an amount, sliding along and stopping at whatever is in the way.
   *
   * This is done by hand, by sweeping their shape through the world, rather than with the
   * physics engine's character controller. That controller jams against anything that
   * isn't fixed scenery: walking into a parked car, standing on its roof, or landing a jump
   * beside it could each leave them unable to move. A sweep ignores whatever they are
   * already touching, as long as they aren't pushing further into it, so it can't.
   */
  private move(dx: number, dy: number, dz: number): void {
    this.slide(dx, dz);

    // Rising and falling: as far straight up or down as there is room for.
    let landed = false;
    if (dy !== 0) {
      const up = dy > 0;
      const hit = this.sweep(up ? UP_AXIS : DOWN_AXIS, Math.abs(dy));
      this.pos.y += (up ? 1 : -1) * (hit ? Math.max(0, hit.time_of_impact - CLEARANCE) : Math.abs(dy));
      if (hit) {
        // Landed on something, or bumped their head on it.
        landed = !up;
        this.rise = 0;
      }
    }
    this.pos.y = Math.max(0, this.pos.y);
    this.place();
    // Standing, if the fall was stopped (even by an edge off to one side) or the ground is right underfoot.
    this.blockedBelow = this.feelForGround() || landed;
  }

  /** Sweep their shape from where they stand (optionally raised) along a unit direction; the first thing hit within `distance`, if any. */
  private sweep(dir: { x: number; y: number; z: number }, distance: number, raised = 0): RAPIER.ColliderShapeCastHit | null {
    const centre = { x: this.pos.x, y: this.pos.y + DRIVER.height / 2 + raised, z: this.pos.z };
    // Whatever they are carrying rides just above their head and must not count as in their way.
    const carried = this.held?.body ?? undefined;
    return this.world.castShape(centre, UPRIGHT, dir, this.shape, 0, distance, false, undefined, WORLD, this.collider, carried);
  }

  /** Move across the ground: up to a wall and then along it, or up onto a low step. */
  private slide(dx: number, dz: number): void {
    let rx = dx;
    let rz = dz;
    // A second and third pass, to follow a wall and then the one it meets at a corner.
    for (let pass = 0; pass < 3; pass++) {
      const length = Math.hypot(rx, rz);
      if (length < 1e-5) return;
      const dir = { x: rx / length, y: 0, z: rz / length };
      const hit = this.sweep(dir, length + SKIN);
      if (!hit) {
        this.pos.x += rx;
        this.pos.z += rz;
        return;
      }
      const travel = Math.max(0, Math.min(length, hit.time_of_impact - SKIN));
      this.pos.x += dir.x * travel;
      this.pos.z += dir.z * travel;
      const left = length - travel;
      // Stepping up is for walking. In the air it would add to how high a jump can reach.
      if (left < 1e-5 || (this.blockedBelow && this.stepUp(dir, left))) return;

      // Carry on with whatever part of the move runs along the surface.
      const flat = Math.hypot(hit.normal2.x, hit.normal2.z);
      if (flat < 0.3) return;
      const nx = hit.normal2.x / flat;
      const nz = hit.normal2.z / flat;
      const into = dir.x * nx + dir.z * nz;
      rx = (dir.x - into * nx) * left;
      rz = (dir.z - into * nz) * left;
    }
  }

  /** Try to get past something low by going over it: up a kerb, up a ramp, onto a ledge at the top of a jump. */
  private stepUp(dir: { x: number; y: number; z: number }, distance: number): boolean {
    // Needs headroom, and a clear way forward once raised.
    if (this.sweep(UP_AXIS, STEP) || this.sweep(dir, distance + SKIN, STEP)) return false;
    this.pos.x += dir.x * distance;
    this.pos.z += dir.z * distance;
    this.pos.y += STEP;
    // Then back down onto whatever is there.
    const below = this.sweep(DOWN_AXIS, STEP);
    this.pos.y -= below ? Math.max(0, below.time_of_impact - CLEARANCE) : STEP;
    return true;
  }

  /** Whether there is something to stand on just under their feet. If so, stand them exactly on it. */
  private feelForGround(): boolean {
    this.ray.origin.x = this.pos.x;
    this.ray.origin.y = this.pos.y + PROBE_FROM;
    this.ray.origin.z = this.pos.z;
    const hit = this.world.castRay(this.ray, PROBE_FROM + PROBE, true, undefined, WORLD, this.collider, this.held?.body ?? undefined);
    if (!hit || this.rise > 0) return false;
    // Stand exactly on it. Usually that means settling the last few centimetres down. But the
    // surface can also be a little above their feet: coming over the edge of a car roof at the
    // top of a jump, the rounded bottom of the body clears the edge before the feet do. Left
    // like that they would be standing half inside the car, unable to move, so lift them onto it.
    const gap = hit.timeOfImpact - PROBE_FROM;
    if (Math.abs(gap - CLEARANCE) > 0.005) {
      this.pos.y -= gap - CLEARANCE;
      this.place();
    }
    return true;
  }

  private place(): void {
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y + DRIVER.height / 2, z: this.pos.z });
  }

  /** The nearest piece of cargo within reach that isn't on the truck, if any. */
  withinReach(truck: Truck, cargo: CargoSystem): CargoItem | null {
    let best: CargoItem | null = null;
    let bestDistance = DRIVER.reach;
    for (const item of cargo.items) {
      if (!item.body || item.held) continue;
      const p = item.body.translation();
      if (truck.isOnBed(p)) continue;
      const distance = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
      if (distance < bestDistance && Math.abs(p.y - this.pos.y) < 2) {
        best = item;
        bestDistance = distance;
      }
    }
    return best;
  }

  private pickUp(truck: Truck, cargo: CargoSystem): void {
    const item = this.withinReach(truck, cargo);
    if (!item) return;
    cargo.hold(item);
    this.held = item;
  }

  /** Put the load down gently at their feet. */
  private setDown(cargo: CargoSystem): void {
    const item = this.held!;
    v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(0.9).add(this.pos);
    v.y += 0.55;
    cargo.release(item, v, new Vector3(), false);
    this.held = null;
    this.charge = 0;
  }

  /** Build up, cancel or release a throw. */
  private windUp(dt: number, input: FootInput, truck: Truck, cargo: CargoSystem): void {
    if (!input.charging) this.cancelled = false;
    if (input.cancelPressed && this.charge > 0) {
      this.cancelled = true;
      this.charge = 0;
    }
    const winding = input.charging && this.held !== null && !this.cancelled;
    if (winding) {
      this.charge += dt;
      this.plan = this.planThrow(truck);
    } else if (this.wasCharging && this.held && this.charge > 0) {
      const plan = this.planThrow(truck);
      cargo.release(this.held, plan.start, plan.velocity, true);
      this.held = null;
      this.charge = 0;
    } else this.charge = 0;
    this.wasCharging = winding;
  }

  /** Work out the throw for the current wind-up: a 45 degree lob that comes down at the chosen range. */
  private planThrow(truck: Truck): ThrowPlan {
    const item = this.held!;
    const range = Math.min(Driver.throwRange(item.mass), DRIVER.throwMin + this.charge * DRIVER.throwRate);
    const dirX = Math.sin(this.yaw);
    const dirZ = Math.cos(this.yaw);
    const start = new Vector3(this.pos.x, this.pos.y + DRIVER.carryHeight, this.pos.z);
    const landing = new Vector3(this.pos.x + dirX * range, this.pos.y, this.pos.z + dirZ * range);
    const inBed = truck.isOverBed(landing.x, landing.z);
    // Over the bed it comes down onto the load; elsewhere onto the ground.
    if (inBed) landing.y = truck.body.translation().y + TRUCK.frame.half[1] + 0.8;
    else landing.y += 0.35;

    const drop = landing.y - start.y;
    const speed = Math.sqrt((G * range * range) / (range - drop));
    const flat = speed * Math.cos(ANGLE);
    return {
      start,
      velocity: new Vector3(dirX * flat, speed * Math.sin(ANGLE), dirZ * flat),
      landing,
      time: range / flat,
      inBed,
    };
  }

  /** Run down by a moving car, a scooter or a train: thrown aside, dropping whatever was held. */
  private checkTraffic(traffic: Traffic, riders: Riders, trains: Trains, cargo: CargoSystem): void {
    for (const car of traffic.cars) {
      if (car.knocked > 0 || car.speed < 2) continue;
      const { lane } = car;
      const dx = this.pos.x - (lane.from.x + lane.dir.x * car.s);
      const dz = this.pos.z - (lane.from.z + lane.dir.z * car.s);
      const along = dx * lane.dir.x + dz * lane.dir.z;
      const across = dx * lane.dir.z - dz * lane.dir.x;
      if (Math.abs(along) > car.spec.half.length + DRIVER.radius || Math.abs(across) > car.spec.half.width + DRIVER.radius) continue;
      this.knockDown(lane.dir.x, lane.dir.z, car.speed, across < 0 ? -1 : 1, cargo);
      return;
    }
    const scooter = riders.at(this.pos.x, this.pos.z, DRIVER.radius);
    if (scooter) {
      // A glancing blow next to a car's: half the speed is taken out of it.
      this.knockDown(scooter.dirX, scooter.dirZ, scooter.speed * 0.5, this.random() < 0.5 ? -1 : 1, cargo);
      return;
    }
    const train = trains.at(this.pos.x, this.pos.z, DRIVER.radius);
    if (train) this.knockDown(train.direction, 0, train.speed, this.random() < 0.5 ? -1 : 1, cargo);
  }

  /** Caught by a blast at this spot, if they are out of the cab and within `radius` of it: thrown away from it. */
  blast(x: number, z: number, radius: number, cargo: CargoSystem): void {
    if (this.mode !== 'onFoot') return;
    const dx = this.pos.x - x;
    const dz = this.pos.z - z;
    const away = Math.hypot(dx, dz);
    if (away < radius) this.knockDown(dx / Math.max(away, 0.3), dz / Math.max(away, 0.3), 7 * (1 - away / radius) + 2, 1, cargo);
  }

  /** Flung forward with whatever hit them and off to one side, losing hold of their load. */
  private knockDown(dirX: number, dirZ: number, speed: number, side: number, cargo: CargoSystem): void {
    this.velocity.set(dirX * speed * 0.9 + dirZ * side * 2.5, 4.5, dirZ * speed * 0.9 - dirX * side * 2.5);
    this.mode = 'down';
    this.downLeft = DRIVER.downSeconds;
    this.charge = 0;
    this.speed = 0;
    if (this.held) {
      v.set(this.pos.x, this.pos.y + DRIVER.carryHeight, this.pos.z);
      cargo.release(this.held, v, this.velocity.clone().multiplyScalar(0.8).setY(5.5), false);
      // It was knocked out of their hands, not set down: the landing counts.
      this.held.immune = 0;
      this.held = null;
    }
  }

  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /** Fly, land and slide to a stop after being hit. */
  private tumble(dt: number): void {
    const grounded = this.blockedBelow;
    this.airborne = !grounded;
    if (grounded && this.velocity.y <= 0) {
      this.velocity.y = 0;
      const slow = Math.exp(-6 * dt);
      this.velocity.x *= slow;
      this.velocity.z *= slow;
    } else this.velocity.y -= G * dt;
    this.move(this.velocity.x * dt, this.velocity.y * dt, this.velocity.z * dt);
  }
}
