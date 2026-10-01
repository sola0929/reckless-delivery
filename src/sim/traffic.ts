import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { GROUP, TRUCK, groups } from '../config';
import type { TrafficLane } from '../levels/types';
import type { Truck } from './truck';

/** The car's overall extent, used for following distances and for telling when something is in its way. */
export const CAR_HALF = { width: 0.9, height: 0.65, length: 2.1 };
const CAR_Y = 0.2 + CAR_HALF.height;
/** The two boxes a car is made of, relative to its centre: for the physics and the drawing alike. */
export const CAR_BODY = {
  half: [CAR_HALF.width, CAR_HALF.height * 0.55, CAR_HALF.length] as [number, number, number],
  pos: [0, -CAR_HALF.height * 0.45, 0] as [number, number, number],
  massShare: 0.75,
};
export const CAR_CABIN = {
  half: [CAR_HALF.width * 0.9, CAR_HALF.height * 0.45, CAR_HALF.length * 0.525] as [number, number, number],
  pos: [0, CAR_HALF.height * 0.5, -CAR_HALF.length * 0.1] as [number, number, number],
  massShare: 0.25,
};

/** Bumper-to-bumper distance at which a car has come to a stop. */
const STOP_GAP = 2.5;
const BRAKING = 6;
const ACCELERATION = 3;
/** How far ahead a car looks for something to stop for. */
const LOOKAHEAD = 40;
const CAR_MASS = 1200;
/** How long a car lies where it was knocked before returning to its lane. */
const KNOCKED_SECONDS = 8;
/** It only returns once the truck is at least this far from its place in the lane. */
const RETURN_CLEARANCE = 18;
const TRUCK_HALF_WIDTH = TRUCK.frame.half[0];
const TRUCK_HALF_LENGTH = TRUCK.frame.half[2];

export interface Lane {
  from: Vector3;
  dir: Vector3;
  /** Rotation that points a car along the lane. */
  facing: { x: number; y: number; z: number; w: number };
  length: number;
  cruise: number;
}

export interface TrafficCar {
  body: RAPIER.RigidBody;
  lane: Lane;
  /** Distance along the lane. */
  s: number;
  startS: number;
  speed: number;
  color: number;
  /** Seconds left as a loose wreck after a collision; 0 while driving normally. */
  knocked: number;
}

const CAR_COLORS = [0xd9d9d9, 0x2f3b4a, 0xb33a3a, 0x3a6fb3, 0xe0c341, 0x4a8f5a, 0x8a8f96, 0x1c1c1f];
const q = new Quaternion();
const v = new Vector3();
const UP = new Vector3(0, 1, 0);

/**
 * Cars that follow fixed lanes and loop, braking for the truck and for each other.
 *
 * While driving they are kinematic: they go exactly where the lane says. But a kinematic
 * body has no mass, so one hitting the truck would shove it aside like a bulldozer and
 * batter the whole load. So the moment a car is about to touch the truck it becomes an
 * ordinary 1.2-tonne body, the crash is settled by momentum, and the car is knocked out
 * of its lane. A while later, once the truck has moved off, it goes back.
 */
export class Traffic {
  readonly cars: TrafficCar[] = [];
  private lanes = 0;

  constructor(world: RAPIER.World, lanes: TrafficLane[]) {
    let n = 0;
    for (const desc of lanes) {
      const from = new Vector3(desc.from[0], CAR_Y, desc.from[1]);
      const dir = new Vector3(desc.to[0] - desc.from[0], 0, desc.to[1] - desc.from[1]);
      const length = dir.length();
      dir.normalize();
      q.setFromAxisAngle(UP, Math.atan2(dir.x, dir.z));
      const lane: Lane = { from, dir, length, cruise: desc.speed, facing: { x: q.x, y: q.y, z: q.z, w: q.w } };

      // Evenly spaced along the lane, with each lane shifted so they don't arrive in a row.
      const shift = (this.lanes++ * 0.37) % 1;
      for (let i = 0; i < desc.cars; i++) {
        const s = ((i + shift) / desc.cars) * length;
        const body = world.createRigidBody(
          RAPIER.RigidBodyDesc.kinematicPositionBased().setRotation(lane.facing),
        );
        // Two boxes, a long low body and a shorter cabin on top, matching how the car is
        // drawn. One tall box would leave anyone standing on the bonnet hovering above it.
        for (const part of [CAR_BODY, CAR_CABIN]) {
          world.createCollider(
            RAPIER.ColliderDesc.cuboid(...part.half)
              .setTranslation(...part.pos)
              .setMass(CAR_MASS * part.massShare)
              .setFriction(0.6)
              .setCollisionGroups(groups(GROUP.prop, GROUP.all)),
            body,
          );
        }
        const car: TrafficCar = { body, lane, s, startS: s, speed: desc.speed, color: CAR_COLORS[n % CAR_COLORS.length], knocked: 0 };
        this.place(car, true);
        this.cars.push(car);
        n++;
      }
    }
  }

  update(dt: number, truck: Truck): void {
    const t = truck.body.translation();
    const r = truck.body.rotation();
    q.set(r.x, r.y, r.z, r.w);
    const truckForward = new Vector3(0, 0, 1).applyQuaternion(q);
    const truckSide = new Vector3(1, 0, 0).applyQuaternion(q);
    const tv = truck.body.linvel();
    const truckSpeed = Math.hypot(tv.x, tv.z);

    for (const car of this.cars) {
      const { lane } = car;
      if (car.knocked > 0) {
        car.knocked -= dt;
        if (car.knocked <= 0) {
          v.copy(lane.from).addScaledVector(lane.dir, car.s);
          if (Math.hypot(t.x - v.x, t.z - v.z) > RETURN_CLEARANCE) this.restore(car);
          else car.knocked = 0.5;
        }
        continue;
      }
      let gap = LOOKAHEAD;

      // The car ahead in the same lane, wrapping around the loop.
      for (const other of this.cars) {
        if (other === car || other.lane !== lane) continue;
        const ahead = (other.s - car.s + lane.length) % lane.length;
        gap = Math.min(gap, ahead - CAR_HALF.length * 2);
      }

      // The truck, if any part of it is in this lane ahead. Its reach along and across
      // the lane depends on which way it is pointing.
      v.set(t.x - lane.from.x, 0, t.z - lane.from.z);
      const along = v.dot(lane.dir) - car.s;
      const across = Math.abs(v.x * lane.dir.z - v.z * lane.dir.x);
      const alongF = Math.abs(truckForward.dot(lane.dir));
      const alongS = Math.abs(truckSide.dot(lane.dir));
      const reachAlong = alongF * TRUCK_HALF_LENGTH + alongS * TRUCK_HALF_WIDTH;
      const reachAcross = alongS * TRUCK_HALF_LENGTH + alongF * TRUCK_HALF_WIDTH;
      if (across < reachAcross + CAR_HALF.width + 0.4 && along > -reachAlong) {
        gap = Math.min(gap, along - reachAlong - CAR_HALF.length);
      }

      // About to touch the truck: from here on the crash is the physics engine's business.
      const closing = (car.speed + truckSpeed) * dt * 2 + 0.25;
      if (across < reachAcross + CAR_HALF.width + 0.25 && Math.abs(along) < reachAlong + CAR_HALF.length + closing) {
        car.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        car.body.setLinvel({ x: lane.dir.x * car.speed, y: 0, z: lane.dir.z * car.speed }, true);
        car.knocked = KNOCKED_SECONDS;
        car.speed = 0;
        continue;
      }

      // The fastest speed from which it can still stop in the room it has.
      const room = Math.max(0, gap - STOP_GAP);
      const target = Math.min(lane.cruise, Math.sqrt(2 * BRAKING * room));
      if (target < car.speed) car.speed = Math.max(target, car.speed - BRAKING * 1.5 * dt);
      else car.speed = Math.min(target, car.speed + ACCELERATION * dt);

      car.s += car.speed * dt;
      if (car.s >= lane.length) {
        car.s -= lane.length;
        this.place(car, true);
      } else this.place(car, false);
    }
  }

  reset(): void {
    for (const car of this.cars) {
      car.s = car.startS;
      this.restore(car);
      car.speed = car.lane.cruise;
    }
  }

  /** Put a knocked car back on its lane, facing the right way, to pull away from a standstill. */
  private restore(car: TrafficCar): void {
    const zero = { x: 0, y: 0, z: 0 };
    car.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    car.body.setLinvel(zero, true);
    car.body.setAngvel(zero, true);
    car.body.setRotation(car.lane.facing, true);
    car.knocked = 0;
    car.speed = 0;
    this.place(car, true);
  }

  /** Move a car to its place on its lane: a smooth kinematic move, or an instant jump. */
  private place(car: TrafficCar, jump: boolean): void {
    v.copy(car.lane.from).addScaledVector(car.lane.dir, car.s);
    if (jump) car.body.setTranslation(v, true);
    else car.body.setNextKinematicTranslation(v);
  }
}
