import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { GROUP, TRUCK, groups } from '../config';
import type { TrafficLane } from '../levels/types';
import type { Truck } from './truck';
import { CLEARANCE, VEHICLES, type VehicleKind, type VehicleSpec } from './vehicles';

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
/** How hard a bus brakes for its stop, m/s². */
const BUS_BRAKING = 7.5;
const ACCELERATION = 3;
/** How far ahead a car looks for something to stop for. */
const LOOKAHEAD = 40;
/** The truck counts as going a lane's way when it points within about 40 degrees of it (as a cosine). */
const SAME_WAY = 0.75;
export const CAR_MASS = 1200;
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
  stops: { at: number; seconds: number; crowd?: number }[];
  waitFor?: number;
  /** The lane its cars carry on along at its end, if any, and where along it they join it. */
  next: Lane | null;
  nextAt: number;
  /** The other lane every other car takes at the end, and whether the next one to get there takes it. */
  also: Lane | null;
  split: boolean;
  /** Where a car knocked out of the traffic goes back in. */
  respawn: Lane | null;
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
  /** How fast it and the truck came together when they last collided, m/s. */
  impact: number;
  kind: VehicleKind;
  /** Its size and weight. */
  spec: VehicleSpec;
  /** The speed it keeps to with the road clear. */
  cruise: number;
  /** Seconds until it may sound its horn again. */
  hush: number;
  /** The lane it started on, to go back to when everything is put back. */
  home: Lane;
  /** Whether its brake lights are on: slowing, or standing. */
  braking: boolean;
  /** For a bus: seconds left standing at a stop; which stop is next; and whether it is still waiting for the truck before it first sets off. */
  dwell: number;
  next: number;
  held: boolean;
}

/** A driver leans on the horn when the truck is coming at them, or sitting across their lane, within this far ahead. */
const HORN_REACH = 45;
/** And then leaves it alone for about this long. */
const HORN_REST = 1.1;
/** A car that has been brought to a stand sounds it only about this often, and only if it is near the front. */
const HORN_REST_STOPPED = 9;

/** What the vehicles of a lane are, where the level doesn't say: mostly cars. Nothing long is left parked. */
function kindOf(n: number, moving: boolean): VehicleKind {
  if (moving && n % 11 === 4) return 'bus';
  if (n % 5 === 2) return 'taxi';
  if (n % 7 === 3) return 'pickup';
  return 'car';
}

/** How far a car's edges are rounded off, metres. */
const CAR_ROUND = 0.16;
const CAR_COLORS = [0xd9d9d9, 0x2f3b4a, 0xb33a3a, 0x3a6fb3, 0xe0c341, 0x4a8f5a, 0x8a8f96, 0x1c1c1f];
const q = new Quaternion();
const nose = new Quaternion();
const ACROSS = new Vector3(1, 0, 0);
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
  /** Cars that ran into the truck, or were run into by it, during the latest step. */
  fresh: TrafficCar[] = [];
  /** Cars that a wreck was shoved into during the latest step: where, and how fast the two met. */
  pileups: { x: number; z: number; speed: number; heavy?: boolean }[] = [];
  /** Where a horn was sounded during the latest step, and how hard it was leant on, 0 to 1. */
  horns: { x: number; z: number; long: number; car: number }[] = [];
  /** Buses that pulled in at a stop during the latest step: which stop, and where their door is. */
  arrivals: { car: TrafficCar; stop: { at: number; seconds: number; crowd?: number }; door: { x: number; z: number } }[] = [];
  private lanes = 0;
  /** Lanes whose cars go two ways at the end, to set back to the first way when everything is put back. */
  private readonly splits: Lane[] = [];

  constructor(world: RAPIER.World, lanes: TrafficLane[], private readonly ground?: (x: number, z: number) => number) {
    let n = 0;
    const made: Lane[] = [];
    for (const desc of lanes) {
      const from = new Vector3(desc.from[0], CAR_Y, desc.from[1]);
      const dir = new Vector3(desc.to[0] - desc.from[0], 0, desc.to[1] - desc.from[1]);
      const length = dir.length();
      dir.normalize();
      q.setFromAxisAngle(UP, Math.atan2(dir.x, dir.z));
      const lane: Lane = { from, dir, length, cruise: desc.speed, facing: { x: q.x, y: q.y, z: q.z, w: q.w }, stops: desc.stops ?? [], waitFor: desc.waitFor, next: null, nextAt: desc.nextAt ?? 0, also: null, split: false, respawn: null };
      made.push(lane);

      // Evenly spaced along the lane, with each lane shifted so they don't arrive in a row.
      const shift = (this.lanes++ * 0.37) % 1;
      for (let i = 0; i < desc.cars; i++) {
        // A bus begins at its first stop.
        const s = i === 0 && desc.stops?.length ? desc.stops[0].at : desc.scatter ? ((i + 0.15 + Math.random() * 0.7) / desc.cars) * length : ((i + shift) / desc.cars) * length;
        const body = world.createRigidBody(
          RAPIER.RigidBodyDesc.kinematicPositionBased().setRotation(lane.facing),
        );
        // Two boxes, a long low body and a shorter cabin on top, matching how the car is
        // drawn. One tall box would leave anyone standing on the bonnet hovering above it.
        const kind = desc.kinds?.[i] ?? kindOf(n, desc.speed > 0);
        const spec = VEHICLES[kind];
        for (const part of spec.boxes) {
          // Rounded off at the edges. The road is laid in slabs, and a square-edged box
          // shoved along it catches its leading edge on the join between two of them and
          // stops dead, as if it had hit a wall: with whatever is pushing it stopped behind.
          const [hx, hy, hz] = part.half;
          world.createCollider(
            RAPIER.ColliderDesc.roundCuboid(hx - CAR_ROUND, hy - CAR_ROUND, hz - CAR_ROUND, CAR_ROUND)
              .setTranslation(...part.pos)
              .setMass(spec.mass * part.massShare)
              // A car is on wheels: once it has been hit it rolls away from a shove. With an
              // ordinary box's grip, two wrecks against the bumper are more than the truck can push.
              .setFriction(0.15)
              .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
              .setCollisionGroups(groups(GROUP.prop, GROUP.all)),
            body,
          );
        }
        const cruise = desc.speed > 0 && spec.crawl ? spec.crawl : desc.speed;
        const bus = i === 0 && lane.stops.length > 0;
        const car: TrafficCar = { body, lane, s, startS: s, speed: cruise, color: CAR_COLORS[n % CAR_COLORS.length], knocked: 0, impact: 0, kind, spec, cruise, hush: 0, home: lane, braking: false, dwell: 0, next: bus ? this.stopAfter(lane, s) : 0, held: i === 0 && lane.waitFor !== undefined };
        this.place(car, true);
        this.cars.push(car);
        n++;
      }
    }
    lanes.forEach((desc, k) => {
      if (desc.next !== undefined) made[k].next = made[desc.next] ?? null;
      if (desc.also !== undefined) {
        made[k].also = made[desc.also] ?? null;
        this.splits.push(made[k]);
      }
      if (desc.respawn !== undefined) made[k].respawn = made[desc.respawn] ?? null;
    });
  }

  /**
   * `walkers` are people out in the road, and `scooters` whatever is being ridden along it:
   * cars wait for the one and keep behind the other, as they do for each other.
   */
  update(dt: number, truck: Truck, walkers: readonly { x: number; z: number }[] = [], scooters: readonly { x: number; z: number }[] = []): void {
    const t = truck.body.translation();
    const r = truck.body.rotation();
    q.set(r.x, r.y, r.z, r.w);
    const truckForward = new Vector3(0, 0, 1).applyQuaternion(q);
    const truckSide = new Vector3(1, 0, 0).applyQuaternion(q);
    const tv = truck.body.linvel();
    const truckSpeed = Math.hypot(tv.x, tv.z);
    this.fresh = [];
    this.pileups = [];
    this.horns = [];
    this.arrivals = [];
    // Cars already knocked loose, wherever the crash has left them.
    const wrecks = this.cars.filter((car) => car.knocked > 0).map((car) => car.body.translation());

    for (const car of this.cars) {
      const { lane } = car;
      if (car.knocked > 0) {
        car.knocked -= dt;
        if (car.knocked <= 0) {
          v.copy(lane.from).addScaledVector(lane.dir, car.s);
          if (Math.hypot(t.x - v.x, t.z - v.z) > (lane.stops.length ? car.spec.half.length + 6 : RETURN_CLEARANCE)) this.restore(car);
          else car.knocked = 0.5;
        }
        continue;
      }
      const { half } = car.spec;
      // A bus waiting for the truck to come up behind it before it pulls away: so that it is there to be got past, however soon the truck arrives.
      if (car.held) {
        v.copy(lane.from).addScaledVector(lane.dir, car.s);
        if (Math.hypot(t.x - v.x, t.z - v.z) < lane.waitFor!) car.held = false;
        else {
          car.speed = 0;
          car.braking = true;
          this.place(car, false);
          continue;
        }
      }
      // At a stop: standing, brake lights on, while people get off and on.
      if (car.dwell > 0) {
        car.speed = 0;
        car.braking = true;
        if ((car.dwell -= dt) <= 0) car.next = (car.next + 1) % lane.stops.length;
        this.place(car, false);
        continue;
      }
      let gap = LOOKAHEAD;

      // The car ahead in the same lane, wrapping around the loop; or, on a lane that leads on into another, only those ahead on
      // it (one that has just come in at its start is behind, not ahead) and those at the start of the next.
      for (const other of this.cars) {
        if (other === car || other.knocked > 0) continue;
        let ahead: number;
        if (other.lane === lane) ahead = lane.next ? other.s - car.s : (other.s - car.s + lane.length) % lane.length;
        else if (lane.next && other.lane === lane.next) ahead = lane.length - car.s + other.s - lane.nextAt;
        else if (lane.also && other.lane === lane.also) ahead = lane.length - car.s + other.s;
        else continue;
        // Two at the same spot (both just come in at a lane's start): the one that came first goes first.
        if (ahead < 0 || (Math.abs(ahead) < 0.01 && this.cars.indexOf(other) > this.cars.indexOf(car))) continue;
        gap = Math.min(gap, ahead - other.spec.half.length - half.length);
      }

      // Someone on foot is given room on both sides: they are on their way across the lane.
      for (const walker of walkers) {
        v.set(walker.x - lane.from.x, 0, walker.z - lane.from.z);
        const ahead = v.dot(lane.dir) - car.s;
        if (ahead > 0 && Math.abs(v.x * lane.dir.z - v.z * lane.dir.x) < half.width + 2.4) gap = Math.min(gap, ahead - half.length);
      }
      for (const scooter of scooters) {
        v.set(scooter.x - lane.from.x, 0, scooter.z - lane.from.z);
        const ahead = v.dot(lane.dir) - car.s;
        if (ahead > 0 && Math.abs(v.x * lane.dir.z - v.z * lane.dir.x) < half.width + 0.5) gap = Math.min(gap, ahead - half.length - 0.85);
      }

      // The truck, if any part of it is in this lane ahead and it is going their way: then it
      // is slow traffic, to be followed. Across the lane or coming the wrong way it is not
      // something a driver in town expects, and they drive straight into it. Its reach along
      // and across the lane depends on which way it is pointing.
      v.set(t.x - lane.from.x, 0, t.z - lane.from.z);
      const along = v.dot(lane.dir) - car.s;
      const across = Math.abs(v.x * lane.dir.z - v.z * lane.dir.x);
      const alongF = Math.abs(truckForward.dot(lane.dir));
      const alongS = Math.abs(truckSide.dot(lane.dir));
      const reachAlong = alongF * TRUCK_HALF_LENGTH + alongS * TRUCK_HALF_WIDTH;
      const reachAcross = alongS * TRUCK_HALF_LENGTH + alongF * TRUCK_HALF_WIDTH;
      const sameWay = truckForward.dot(lane.dir) > SAME_WAY;
      // In their lane and not going their way: across it, or coming straight at them.
      car.hush -= dt;
      // Only on the road the lane is on: not at the truck somewhere out past the end of it, through a wall.
      const onIt = along < lane.length - car.s + reachAlong + 6;
      if (car.hush <= 0 && lane.cruise > 0 && !sameWay && across < reachAcross + half.width && along > reachAlong && along < HORN_REACH && onIt) {
        // Bearing down on it they keep at it. Once they have had to stop, it is only now and
        // then: a queue of standing cars all leaning on their horns is a racket.
        const rest = car.speed > 2 ? HORN_REST : HORN_REST_STOPPED;
        car.hush = rest * (0.7 + ((car.s * 7.3) % 1) * 0.6);
        // Of those standing, only whoever is at the front has the truck to sound it at.
        if (car.speed > 2 || along <= reachAlong + half.length + 14) this.horns.push({ x: lane.from.x + lane.dir.x * car.s, z: lane.from.z + lane.dir.z * car.s, long: truckForward.dot(lane.dir) < -SAME_WAY ? 1 : 0.5, car: this.cars.indexOf(car) });
      }
      if (sameWay && across < reachAcross + half.width + 0.4 && along > -reachAlong) {
        gap = Math.min(gap, along - reachAlong - half.length);
      }

      // About to be touched by a car that has been knocked loose: it is knocked loose too.
      // A car still driven by hand cannot be moved by anything, so a wreck shoved into the
      // back of one, with the truck behind it, stops the truck like a wall.
      v.copy(lane.from).addScaledVector(lane.dir, car.s);
      if (wrecks.some((w) => Math.abs((w.x - v.x) * lane.dir.x + (w.z - v.z) * lane.dir.z) < half.length + CAR_HALF.length + 0.5 && Math.abs((w.x - v.x) * lane.dir.z - (w.z - v.z) * lane.dir.x) < half.width + CAR_HALF.length)) {
        car.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        car.body.setLinvel({ x: lane.dir.x * car.speed, y: 0, z: lane.dir.z * car.speed }, true);
        car.knocked = KNOCKED_SECONDS;
        car.impact = 0;
        this.pileups.push({ x: v.x, z: v.z, speed: Math.max(car.speed, 5) });
        car.speed = 0;
        continue;
      }

      // About to touch the truck: from here on the crash is the physics engine's business.
      const closing = (car.speed + truckSpeed) * dt * 2 + 0.25;
      if (across < reachAcross + half.width + 0.25 && Math.abs(along) < reachAlong + half.length + closing) {
        car.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        car.body.setLinvel({ x: lane.dir.x * car.speed, y: 0, z: lane.dir.z * car.speed }, true);
        car.knocked = KNOCKED_SECONDS;
        car.impact = Math.hypot(lane.dir.x * car.speed - tv.x, lane.dir.z * car.speed - tv.z);
        // Whoever was driving it has something to say, if they were driving it.
        if (lane.cruise > 0) this.horns.push({ x: t.x, z: t.z, long: 1, car: this.cars.indexOf(car) });
        car.hush = HORN_REST;
        car.speed = 0;
        this.fresh.push(car);
        continue;
      }

      // The fastest speed from which it can still stop in the room it has.
      const room = Math.max(0, gap - STOP_GAP);
      let target = Math.min(car.cruise, Math.sqrt(2 * BRAKING * room));
      let hard = BRAKING * 1.5;
      // A bus pulls in late and hard: kept up to speed until the last moment, and then stood on its brakes.
      const stop = car.kind === 'bus' ? lane.stops[car.next] : undefined;
      if (stop) {
        const until = (stop.at - car.s + lane.length) % lane.length;
        if (until < 0.4 && car.speed < 1.2) {
          car.speed = 0;
          car.dwell = stop.seconds;
          car.braking = true;
          v.copy(lane.from).addScaledVector(lane.dir, car.s);
          // The door is on the kerb side, toward the front.
          this.arrivals.push({ car, stop, door: { x: v.x - lane.dir.z * (half.width + 0.4) + lane.dir.x * half.length * 0.55, z: v.z + lane.dir.x * (half.width + 0.4) + lane.dir.z * half.length * 0.55 } });
          this.place(car, false);
          continue;
        }
        target = Math.min(target, Math.sqrt(2 * BUS_BRAKING * Math.max(0, until - 0.2)));
        hard = BUS_BRAKING * 1.3;
      }
      car.braking = target < car.speed - 0.05;
      if (target < car.speed) car.speed = Math.max(target, car.speed - hard * dt);
      else car.speed = Math.min(target, car.speed + ACCELERATION * dt);

      car.s += car.speed * dt;
      if (car.s >= lane.length) {
        car.s -= lane.length;
        // On into the next lane, if this one leads into one; it starts where this one ends.
        if (lane.next) {
          // Every other car the other way, where there is one.
          const other = lane.also && (lane.split = !lane.split);
          const into = other ? lane.also! : lane.next;
          if (!other) car.s += lane.nextAt;
          car.lane = into;
          car.next = into.stops.findIndex((stop) => stop.at >= car.s);
          if (car.next < 0) car.next = 0;
          car.cruise = Math.min(car.spec.crawl ?? Infinity, into.cruise) || car.cruise;
        }
        this.place(car, true);
      } else this.place(car, false);
    }
  }

  reset(): void {
    this.fresh = [];
    for (const lane of this.splits) lane.split = false;
    for (const car of this.cars) {
      car.lane = car.home;
      car.s = car.startS;
      this.restore(car, true);
      car.speed = car.cruise;
      car.dwell = 0;
      car.braking = false;
      car.held = car === this.cars.find((c) => c.lane === car.lane) && car.lane.waitFor !== undefined;
      car.next = car.lane.stops.length ? this.stopAfter(car.lane, car.s) : 0;
    }
  }

  /** A car run into by something heavy: knocked loose and thrown the way that was going, harder the faster. */
  ram(body: RAPIER.RigidBody, velocity: { x: number; z: number }): void {
    const car = this.cars.find((c) => c.body === body);
    if (!car || car.knocked > 0) return;
    const p = body.translation();
    const speed = Math.hypot(velocity.x, velocity.z);
    car.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    car.body.setLinvel({ x: car.lane.dir.x * car.speed * 0.5 + velocity.x * 0.9, y: Math.min(4, speed * 0.25), z: car.lane.dir.z * car.speed * 0.5 + velocity.z * 0.9 }, true);
    car.body.setAngvel({ x: (velocity.z / Math.max(1, speed)) * 1.5, y: 1.2, z: (-velocity.x / Math.max(1, speed)) * 1.5 }, true);
    car.knocked = KNOCKED_SECONDS;
    car.impact = speed;
    car.speed = 0;
    this.pileups.push({ x: p.x, z: p.z, speed: Math.max(speed, 6), heavy: true });
  }

  /** The first stop at or beyond a place along a lane, by its place in the lane's list. */
  private stopAfter(lane: Lane, s: number): number {
    const n = lane.stops.findIndex((stop) => stop.at >= s - 0.5);
    return n < 0 ? 0 : n;
  }

  /** Put a knocked car back on its lane, facing the right way, to pull away from a standstill. */
  private restore(car: TrafficCar, back = false): void {
    const zero = { x: 0, y: 0, z: 0 };
    car.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    car.body.setLinvel(zero, true);
    car.body.setAngvel(zero, true);
    car.body.setRotation(car.lane.facing, true);
    car.knocked = 0;
    car.speed = 0;
    // Knocked out of the traffic, it comes back in from out of sight; put back at the start of a run, it is where it began.
    if (car.lane.respawn && !back) {
      car.lane = car.lane.respawn;
      car.s = 0;
      car.next = 0;
      car.body.setRotation(car.lane.facing, true);
    }
    this.place(car, true);
  }

  /** Move a car to its place on its lane: a smooth kinematic move, or an instant jump. */
  private place(car: TrafficCar, jump: boolean): void {
    v.copy(car.lane.from).addScaledVector(car.lane.dir, car.s);
    if (!this.ground) {
      v.y = CLEARANCE + car.spec.half.height;
      if (jump) car.body.setTranslation(v, true);
      else car.body.setNextKinematicTranslation(v);
      return;
    }
    // On ground that rises and falls: as high as the road is under its two ends, and nose up or down as the road goes.
    const reach = car.spec.half.length;
    const ahead = this.ground(v.x + car.lane.dir.x * reach, v.z + car.lane.dir.z * reach);
    const behind = this.ground(v.x - car.lane.dir.x * reach, v.z - car.lane.dir.z * reach);
    v.y = (ahead + behind) / 2 + CLEARANCE + car.spec.half.height;
    const f = car.lane.facing;
    q.set(f.x, f.y, f.z, f.w).multiply(nose.setFromAxisAngle(ACROSS, -Math.atan2(ahead - behind, 2 * reach)));
    if (jump) {
      car.body.setTranslation(v, true);
      car.body.setRotation(q, true);
    } else {
      car.body.setNextKinematicTranslation(v);
      car.body.setNextKinematicRotation(q);
    }
  }
}
