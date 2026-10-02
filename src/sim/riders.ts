import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { GROUP, PHYSICS, TRUCK, groups } from '../config';
import type { RiderLane } from '../levels/types';
import type { Traffic } from './traffic';
import type { Truck } from './truck';

/** A scooter's extent, with its rider. Its body's origin is on the road under its middle. */
export const SCOOTER_HALF = { width: 0.3, height: 0.5, length: 0.85 };
/**
 * What a scooter and its rider weigh when the truck hits them. Over the real thing, and
 * well under a car: enough that running one down is felt in the load.
 */
export const SCOOTER_MASS = 320;
const BRAKING = 7;
/** How hard they count on braking when closing on something that is itself moving: gently, since it may stop. */
const CLOSING = 3;
const ACCELERATION = 4;
/** The fastest they move across the road, m/s. */
const SWERVE = 3.4;
/** Their speed round a U-turn, and the least room they turn in. */
const TURNING = 4.5;
const TURN_ROOM = 2.2;
/** A rider walks back to their scooter at this speed, m/s, and is at it within this distance. */
const WALK = 3.2;
const REACH = 0.9;
/** They don't get back on while the truck is this close to it. */
const MOUNT_CLEARANCE = 6;
/** How long its rider lies in the road. */
const DOWN_SECONDS = 3;
/** Room left beside whatever is being passed: less for another scooter than for anything else. */
const ELBOW = 0.25;
const BERTH = 0.55;
const TRUCK_HALF_WIDTH = TRUCK.frame.half[0];
const TRUCK_HALF_LENGTH = TRUCK.frame.half[2];
const G = -PHYSICS.gravity;
const SOLID = groups(GROUP.prop, GROUP.all);
/** What a scooter that has been hit is: solid to the road and whatever is on it, but not to the truck or its load. */
/** How many steps the truck takes a scooter's blow over. */
const SHOVE_STEPS = 8;
const KNOCKED = groups(GROUP.prop, GROUP.all & ~GROUP.truck & ~GROUP.cargo);

interface Road {
  from: Vector3;
  dir: Vector3;
  /** Across the road, to the left of the way it runs. */
  left: Vector3;
  length: number;
  /** The band they keep to: metres to the left of the line, at its right edge and its left. */
  lo: number;
  hi: number;
  turnInto: Road | null;
}

export interface Rider {
  body: RAPIER.RigidBody;
  road: Road;
  /** Distance along the road, and to the left of its line. */
  s: number;
  d: number;
  speed: number;
  /** Speed across the road, to the left. */
  drift: number;
  /** The speed they would ride at with nothing in the way. */
  cruise: number;
  /** Where across the road they mean to be, and how long until they think again. */
  wish: number;
  mind: number;
  /** Whether, having passed the truck, they pull in right in front of it. */
  cuts: boolean;
  /** How far round a U-turn they are, radians; below 0 when not in one. */
  turn: number;
  /** How fast they and the truck came together when they were last hit, m/s. */
  impact: number;
  /** Seconds left as a loose wreck after a collision; 0 while being ridden. */
  knocked: number;
  /** While off it: whether they are walking back to it, and which way they face. */
  walking: boolean;
  facing: number;
  /** Whether the rider is on it. When not, where they are, and how long they have left lying there. */
  seated: boolean;
  person: Vector3;
  personVelocity: Vector3;
  down: number;
  /** Which way it points: radians about Y. */
  yaw: number;
  /** Tells one from another when they are drawn. */
  index: number;
  start: { road: Road; s: number; d: number };
}

/** Something on a road, as a rider on that road sees it. */
interface Obstacle {
  s: number;
  d: number;
  halfLength: number;
  halfWidth: number;
  /** Its speed along the road. */
  speed: number;
  rider: Rider | null;
  truck: boolean;
}

const q = new Quaternion();
const lean = new Quaternion();
const v = new Vector3();
const closing = new Vector3();
const heading = new Vector3();
const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(0, 0, 1);
const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));

/**
 * Where to be across the road, given where one would like to be and the stretches of it
 * that are taken: out of whatever one is in the way of, and not through anything alongside.
 * `beside` is where across the road each thing is that cannot be got across in front of:
 * there is no going past those, only away from them.
 */
function steer(taken: [number, number][], lo: number, hi: number, wish: number, d: number, beside: number[] = []): number {
  taken.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const span of taken) {
    const last = merged[merged.length - 1];
    if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
    else merged.push([span[0], span[1]]);
  }
  for (const [a, b] of merged) {
    if (d <= a || d >= b) continue;
    // In line with something: out by the nearer side that there is room on.
    const leftward = b <= hi && !beside.some((at) => at > d && at < b);
    const rightward = a >= lo && !beside.some((at) => at < d && at > a);
    if (leftward && rightward) return b - d < d - a ? b : a;
    return leftward ? b : rightward ? a : d;
  }
  let target = clamp(wish, lo, hi);
  for (const [a, b] of merged) {
    if (d <= a && target > a) target = a;
    if (d >= b && target < b) target = b;
  }
  return target;
}

/**
 * Scooters, ridden in swarms along the busier roads. They are quicker than the cars and
 * wait for nothing: they go round whatever is in front, on either side, through any gap
 * wide enough, and pull back in as soon as they are past. The truck is one more thing to
 * go round.
 *
 * They are moved by hand until the truck is about to touch one. The two never do touch:
 * something that small and that heavy goes under the nose of a truck and tips it over,
 * which is not what running into a scooter does. Instead the crash is settled here, by
 * weight and speed: the truck is checked by its share and no more, the scooter is flung
 * aside to tumble along the road, and its rider goes over the handlebars. A while later,
 * once the truck has gone, both are back on the road.
 */
export class Riders {
  readonly list: Rider[] = [];
  /** How many have been knocked off since the last reset. */
  hits = 0;
  /** Those knocked off during the latest step. */
  fresh: Rider[] = [];
  private readonly roads: Road[];
  private events: Rider[] = [];
  /** What the truck still has coming to it from scooters it has hit: so much a step, for so many steps. */
  private shoves: { x: number; z: number; left: number }[] = [];
  private seed = 11;

  constructor(world: RAPIER.World, lanes: RiderLane[]) {
    this.roads = lanes.map((lane) => {
      const from = new Vector3(lane.from[0], 0, lane.from[1]);
      const dir = new Vector3(lane.to[0] - lane.from[0], 0, lane.to[1] - lane.from[1]);
      const length = dir.length();
      dir.normalize();
      return { from, dir, left: new Vector3(dir.z, 0, -dir.x), length, lo: Math.min(...lane.band), hi: Math.max(...lane.band), turnInto: null };
    });
    lanes.forEach((lane, i) => {
      if (lane.turnInto !== undefined) this.roads[i].turnInto = this.roads[lane.turnInto];
    });

    lanes.forEach((lane, i) => {
      const road = this.roads[i];
      for (let n = 0; n < lane.riders; n++) {
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
        world.createCollider(
          // Rounded at the edges, so that sliding along the road it doesn't catch on the joins between its slabs.
          RAPIER.ColliderDesc.roundCuboid(SCOOTER_HALF.width - 0.12, SCOOTER_HALF.height - 0.12, SCOOTER_HALF.length - 0.12, 0.12)
            .setTranslation(0, SCOOTER_HALF.height + 0.05, 0)
            .setMass(SCOOTER_MASS)
            .setFriction(0.5)
            .setCollisionGroups(SOLID),
          body,
        );
        // They set out in bunches of four, as they come away from a light.
        const bunches = Math.ceil(lane.riders / 4);
        const s = (((Math.floor(n / 4) + 0.3) / bunches) * road.length + (n % 4) * 4.5 + this.random() * 1.5) % road.length;
        const d = road.lo + this.random() * (road.hi - road.lo);
        const rider: Rider = {
          body, road, s, d, speed: 0, drift: 0, cruise: 13 + this.random() * 4.5, wish: d, mind: this.random() * 3, cuts: false, turn: -1, impact: 0,
          knocked: 0, walking: false, facing: 0, seated: true, person: new Vector3(), personVelocity: new Vector3(), down: 0, yaw: Math.atan2(road.dir.x, road.dir.z), index: this.list.length,
          start: { road, s, d },
        };
        rider.speed = rider.cruise;
        this.place(rider, true);
        this.list.push(rider);
      }
    });
  }

  /** Call once per physics step, before the world steps. `walkers` are people in the road. */
  update(dt: number, truck: Truck, traffic: Traffic, walkers: readonly { x: number; z: number }[]): void {
    const t = truck.body.translation();
    const r = truck.body.rotation();
    q.set(r.x, r.y, r.z, r.w);
    const truckForward = new Vector3(0, 0, 1).applyQuaternion(q);
    const truckSide = new Vector3(1, 0, 0).applyQuaternion(q);
    const tv = truck.body.linvel();
    q.invert();
    const toTruck = q.clone();

    this.fresh = [];
    for (const shove of this.shoves) {
      truck.body.applyImpulse({ x: shove.x, y: 0, z: shove.z }, true);
      shove.left--;
    }
    this.shoves = this.shoves.filter((shove) => shove.left > 0);
    const seen = this.roads.map((road) => this.obstacles(road, t, tv, truckForward, truckSide, traffic, walkers));

    for (const rider of this.list) {
      if (rider.knocked > 0) {
        this.recover(rider, dt, t);
        continue;
      }

      // A car knocked loose and sliding into them takes them with it: left as they are they
      // would stop it dead, and the truck behind it.
      const here = this.where(rider);
      if (traffic.cars.some((car) => car.knocked > 0 && Math.hypot(car.body.translation().x - here.x, car.body.translation().z - here.z) < car.spec.half.length + 0.6)) {
        this.knock(rider, here, { x: 0, y: 0, z: 0 }, 1, v.set(rider.road.left.x, 0, rider.road.left.z), null);
        rider.impact = 0;
        this.hits--;
        this.events.pop();
        continue;
      }

      const { road } = rider;
      if (rider.turn >= 0) this.goRound(rider, dt);
      else {
        this.ride(rider, dt, seen[this.roads.indexOf(road)]);
        if (rider.s >= road.length) {
          if (road.turnInto) rider.turn = 0;
          else {
            // Back to the start, and in wherever there is room there.
            rider.s -= road.length;
            const taken: [number, number][] = [];
            for (const o of seen[this.roads.indexOf(road)]) {
              if (o.rider !== rider && Math.abs(o.s - rider.s) < o.halfLength + 6) taken.push([o.d - o.halfWidth - 0.8, o.d + o.halfWidth + 0.8]);
            }
            rider.d = steer(taken, road.lo, road.hi, rider.d, rider.d);
            this.place(rider, true);
            continue;
          }
        }
      }
      this.place(rider, false);

      // About to touch the truck: from here on the crash is the physics engine's business.
      // Judged from the truck: how far off the scooter is to the side and fore and aft, and
      // how fast it is closing each way. Riding past a hand's breadth away is not a crash.
      const at = this.where(rider);
      v.set(at.x - t.x, 0, at.z - t.z).applyQuaternion(toTruck);
      closing.set(at.vx - tv.x, 0, at.vz - tv.z).applyQuaternion(toTruck);
      // The scooter's own reach each way depends on which way it points, seen from the truck.
      heading.set(Math.sin(rider.yaw), 0, Math.cos(rider.yaw)).applyQuaternion(toTruck);
      const reachAcross = Math.abs(heading.x) * SCOOTER_HALF.length + Math.abs(heading.z) * SCOOTER_HALF.width;
      const reachAlong = Math.abs(heading.z) * SCOOTER_HALF.length + Math.abs(heading.x) * SCOOTER_HALF.width;
      const across = Math.abs(v.x) - Math.abs(closing.x) * dt * 2;
      const along = Math.abs(v.z) - Math.abs(closing.z) * dt * 2;
      if (across < TRUCK_HALF_WIDTH + reachAcross + 0.15 && along < TRUCK_HALF_LENGTH + reachAlong + 0.1) this.knock(rider, at, tv, v.x < 0 ? -1 : 1, truckSide, truck);
    }
  }

  /** Where each scooter that is being ridden is, and how it is moving. */
  moving(): { x: number; z: number; vx: number; vz: number }[] {
    return this.list.filter((rider) => rider.knocked <= 0).map((rider) => this.where(rider));
  }

  /** Where every scooter is, ridden or lying in the road: all of them are in the way of a car. */
  inTheWay(): { x: number; z: number }[] {
    return this.list.map((rider) => (rider.knocked > 0 ? rider.body.translation() : this.where(rider)));
  }

  /** A scooter, if one is being ridden through this spot: which way, and how fast. */
  at(x: number, z: number, radius: number): { dirX: number; dirZ: number; speed: number } | null {
    for (const rider of this.list) {
      if (rider.knocked > 0 || rider.speed < 2) continue;
      const p = this.where(rider);
      if (Math.hypot(p.x - x, p.z - z) > SCOOTER_HALF.length + radius) continue;
      const speed = Math.hypot(p.vx, p.vz);
      return { dirX: p.vx / speed, dirZ: p.vz / speed, speed };
    }
    return null;
  }

  /** Knock off everyone riding within `radius` of a blast, away from it. */
  blast(x: number, z: number, radius: number): void {
    for (const rider of this.list) {
      if (rider.knocked > 0) continue;
      const at = this.where(rider);
      const away = Math.hypot(at.x - x, at.z - z);
      if (away > radius) continue;
      v.set(at.x - x, 0, at.z - z).normalize();
      this.knock(rider, at, { x: 0, y: 0, z: 0 }, 1, v, null);
      // Nothing ran into it: the load has nothing to answer for.
      rider.impact = 0;
      this.hits--;
      this.events.pop();
    }
  }

  /** Riders knocked off since the last call. */
  drainEvents(): Rider[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  reset(): void {
    this.seed = 11;
    this.hits = 0;
    this.events = [];
    this.fresh = [];
    this.shoves = [];
    for (const rider of this.list) {
      Object.assign(rider, rider.start);
      this.restore(rider);
      rider.speed = rider.cruise;
      rider.wish = rider.d;
    }
  }

  /** Everything on or near a road, placed along and across it. */
  private obstacles(
    road: Road, t: { x: number; z: number }, tv: { x: number; z: number }, truckForward: Vector3, truckSide: Vector3,
    traffic: Traffic, walkers: readonly { x: number; z: number }[],
  ): Obstacle[] {
    const list: Obstacle[] = [];
    const add = (x: number, z: number, halfLength: number, halfWidth: number, speed: number, rider: Rider | null = null, truck = false) => {
      const dx = x - road.from.x;
      const dz = z - road.from.z;
      const s = dx * road.dir.x + dz * road.dir.z;
      const d = dx * road.left.x + dz * road.left.z;
      if (s < -8 || s > road.length + 8 || d < road.lo - 4 || d > road.hi + 4) return;
      list.push({ s, d, halfLength, halfWidth, speed, rider, truck });
    };

    // The truck's reach along and across the road depends on which way it is pointing.
    const alongF = Math.abs(truckForward.dot(road.dir));
    const alongS = Math.abs(truckSide.dot(road.dir));
    add(t.x, t.z, alongF * TRUCK_HALF_LENGTH + alongS * TRUCK_HALF_WIDTH, alongS * TRUCK_HALF_LENGTH + alongF * TRUCK_HALF_WIDTH, tv.x * road.dir.x + tv.z * road.dir.z, null, true);

    for (const car of traffic.cars) {
      const p = car.body.translation();
      // A wreck may be lying any way round.
      const half = car.spec.half;
      if (car.knocked > 0) add(p.x, p.z, half.length, half.length, 0);
      else {
        const sameWay = car.lane.dir.dot(road.dir);
        const along = Math.abs(sameWay) > 0.7;
        add(p.x, p.z, along ? half.length : half.width, along ? half.width : half.length, car.speed * sameWay);
      }
    }
    for (const rider of this.list) {
      const p = this.where(rider);
      if (rider.knocked > 0) {
        const at = rider.body.translation();
        add(at.x, at.z, SCOOTER_HALF.length, SCOOTER_HALF.length, 0, rider);
      } else add(p.x, p.z, SCOOTER_HALF.length, SCOOTER_HALF.width, p.vx * road.dir.x + p.vz * road.dir.z, rider);
    }
    for (const walker of walkers) add(walker.x, walker.z, 0.35, 0.35, 0);
    return list;
  }

  /** One step along the road: as fast as there is room for, and across it to wherever is clear. */
  private ride(rider: Rider, dt: number, obstacles: Obstacle[]): void {
    const { road } = rider;
    if ((rider.mind -= dt) <= 0) {
      rider.mind = 1.5 + this.random() * 4;
      rider.wish = road.lo + this.random() * (road.hi - road.lo);
      rider.cuts = this.random() < 0.45;
    }

    let limit = rider.cruise;
    let wish = rider.wish;
    const taken: [number, number][] = [];
    const beside: number[] = [];
    for (const o of obstacles) {
      if (o.rider === rider) continue;
      const ahead = o.s - rider.s;
      const gap = Math.abs(ahead) - o.halfLength - SCOOTER_HALF.length;
      const closing = rider.speed - o.speed;
      if (ahead < 0) {
        // Just past the truck, and of a mind to: straight across its bows.
        if (o.truck && rider.cuts && gap > 3.5 && gap < 10 && closing > 1) wish = o.d;
        // Otherwise what is behind matters only while it is still alongside.
        if (gap > 0.5) continue;
      } else if (gap > 4 + Math.max(0, closing) * 1.6 || (closing <= 0 && gap > 1)) continue;

      const clear = o.halfWidth + SCOOTER_HALF.width + (o.rider ? ELBOW : BERTH);
      taken.push([o.d - clear, o.d + clear]);
      // There is no getting across in front of something that is alongside, or that will be
      // reached before the far side of it could be.
      if (gap < 0.5 || (ahead > 0 && gap < Math.max(0, closing) * ((Math.abs(o.d - rider.d) + clear) / SWERVE) + 0.5)) beside.push(o.d);
      // Still in line with it: no faster than can be shed in the room there is, allowing that it may brake too.
      if (ahead > 0 && Math.abs(o.d - rider.d) < clear - 0.1) limit = Math.min(limit, Math.max(0, o.speed) + Math.sqrt(2 * CLOSING * Math.max(0, gap - 1.4)));
    }
    // Slowing for the turn at the end, and over to the kerb to have room to make it.
    let hi = road.hi;
    if (road.turnInto) {
      limit = Math.min(limit, Math.sqrt(TURNING * TURNING + 2 * BRAKING * Math.max(0, road.length - rider.s)));
      if (road.length - rider.s < 30) hi = Math.min(hi, -TURN_ROOM);
    }

    if (limit < rider.speed) rider.speed = Math.max(limit, rider.speed - BRAKING * 1.8 * dt);
    else rider.speed = Math.min(limit, rider.speed + ACCELERATION * dt);

    const target = steer(taken, road.lo, hi, wish, rider.d, beside);
    // No sideways without forwards: a scooter standing still can't shuffle across the road.
    const most = Math.min(SWERVE, rider.speed * 0.4);
    const want = clamp((target - rider.d) * 3, -most, most);
    rider.drift += clamp(want - rider.drift, -14 * dt, 14 * dt);
    rider.s += rider.speed * dt;
    rider.d += rider.drift * dt;
  }

  /** Round the end of one road and back down the other: half a circle about the end of the line. */
  private goRound(rider: Rider, dt: number): void {
    const { road } = rider;
    rider.speed = TURNING;
    rider.drift = 0;
    rider.s = road.length;
    rider.turn += (TURNING / Math.max(1.2, Math.abs(rider.d))) * dt;
    if (rider.turn < Math.PI || !road.turnInto) return;
    // The same spot, seen from the road going the other way.
    rider.road = road.turnInto;
    rider.s = 0;
    rider.turn = -1;
    rider.wish = rider.d;
  }

  /** Where a rider is and how they are moving, in the world. */
  private where(rider: Rider): { x: number; z: number; vx: number; vz: number } {
    const { road, s, d } = rider;
    if (rider.turn < 0) {
      return {
        x: road.from.x + road.dir.x * s + road.left.x * d,
        z: road.from.z + road.dir.z * s + road.left.z * d,
        vx: road.dir.x * rider.speed + road.left.x * rider.drift,
        vz: road.dir.z * rider.speed + road.left.z * rider.drift,
      };
    }
    const cos = Math.cos(rider.turn);
    const sin = Math.sin(rider.turn);
    const out = Math.max(1.2, Math.abs(d));
    const endX = road.from.x + road.dir.x * road.length;
    const endZ = road.from.z + road.dir.z * road.length;
    return {
      x: endX + road.left.x * d * cos + road.dir.x * out * sin,
      z: endZ + road.left.z * d * cos + road.dir.z * out * sin,
      vx: (-road.left.x * Math.sign(d || -1) * sin + road.dir.x * cos) * rider.speed,
      vz: (-road.left.z * Math.sign(d || -1) * sin + road.dir.z * cos) * rider.speed,
    };
  }

  /** Move a scooter to where its rider has got to, leaning into whatever swerve it is in. */
  private place(rider: Rider, jump: boolean): void {
    const at = this.where(rider);
    // Standing still it goes on pointing the way it was.
    if (Math.hypot(at.vx, at.vz) > 0.5) rider.yaw = Math.atan2(at.vx, at.vz);
    const tilt = rider.turn >= 0 ? -0.3 * Math.sign(rider.d || -1) : (rider.drift / SWERVE) * 0.3;
    q.setFromAxisAngle(UP, rider.yaw).multiply(lean.setFromAxisAngle(FORWARD, tilt));
    v.set(at.x, 0, at.z);
    if (jump) {
      rider.body.setTranslation(v, true);
      rider.body.setRotation(q, true);
    } else {
      rider.body.setNextKinematicTranslation(v);
      rider.body.setNextKinematicRotation(q);
    }
  }

  /**
   * Hit: by the `truck`, or thrown by something else when there is none. The scooter goes
   * the way the truck was going and off to `side` of it, and the rider over the handlebars.
   */
  private knock(rider: Rider, at: { x: number; z: number; vx: number; vz: number }, tv: { x: number; y: number; z: number }, side: number, truckSide: Vector3, truck: Truck | null): void {
    rider.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    rider.body.collider(0).setCollisionGroups(KNOCKED);
    if (truck) {
      // The truck loses what the scooter's weight takes out of it, level and through its
      // middle: slowed, or shoved sideways, but never tipped.
      // Over a few steps rather than in one, as a real blow is: all at once it would be
      // a harder knock to the load than a car's.
      const mass = truck.body.mass();
      const share = ((SCOOTER_MASS / (mass + SCOOTER_MASS)) * mass) / SHOVE_STEPS;
      this.shoves.push({ x: (at.vx - tv.x) * share, z: (at.vz - tv.z) * share, left: SHOVE_STEPS });
    }
    rider.body.setLinvel({ x: tv.x * 0.85 + at.vx * 0.15 + truckSide.x * side * 5, y: 3.2, z: tv.z * 0.85 + at.vz * 0.15 + truckSide.z * side * 5 }, true);
    rider.body.setAngvel({ x: truckSide.z * side * 4, y: side * 3, z: -truckSide.x * side * 4 }, true);
    rider.knocked = 1;
    rider.impact = Math.hypot(at.vx - tv.x, at.vz - tv.z);
    rider.speed = 0;
    rider.drift = 0;
    rider.turn = -1;
    rider.seated = false;
    rider.down = DOWN_SECONDS;
    rider.person.set(at.x, 0.9, at.z);
    // Carried along by the truck, and off to whichever side of it they were on.
    rider.personVelocity.set(at.vx * 0.4 + tv.x * 0.8 + truckSide.x * side * 3, 4.5, at.vz * 0.4 + tv.z * 0.8 + truckSide.z * side * 3);
    this.hits++;
    this.events.push(rider);
    this.fresh.push(rider);
  }

  /**
   * A rider who has been knocked off: they fly, lie where they land for a moment, get up,
   * walk back to wherever their scooter has ended up, stand it up and ride on from there.
   */
  private recover(rider: Rider, dt: number, truck: { x: number; z: number }): void {
    rider.walking = false;
    const p = rider.person;
    if (p.y > 0 || rider.personVelocity.y > 0 || rider.down > 0) {
      this.tumble(rider, dt);
      return;
    }
    const at = rider.body.translation();
    // Gone into the river or down a hole: there is no fetching it. They start again from where they set out.
    if (at.y < -1) {
      Object.assign(rider, rider.start);
      this.restore(rider);
      return;
    }
    const dx = at.x - p.x;
    const dz = at.z - p.z;
    const away = Math.hypot(dx, dz);
    if (away > REACH) {
      rider.walking = true;
      rider.facing = Math.atan2(dx, dz);
      p.x += (dx / away) * WALK * dt;
      p.z += (dz / away) * WALK * dt;
      return;
    }
    // At the scooter: but not while the truck is still on top of it.
    rider.facing = Math.atan2(rider.road.dir.x, rider.road.dir.z);
    if (Math.hypot(truck.x - at.x, truck.z - at.z) < MOUNT_CLEARANCE) return;
    // Back onto the road where the scooter lies, or as near to there as the road goes.
    const { road } = rider;
    const rx = at.x - road.from.x;
    const rz = at.z - road.from.z;
    rider.s = rx * road.dir.x + rz * road.dir.z;
    rider.d = rx * road.left.x + rz * road.left.z;
    rider.wish = clamp(rider.d, road.lo, road.hi);
    this.restore(rider);
  }

  /** A thrown rider: through the air, along the road, and a lie-down. */
  private tumble(rider: Rider, dt: number): void {
    const p = rider.person;
    const pv = rider.personVelocity;
    if (p.y > 0 || pv.y > 0) {
      pv.y -= G * dt;
      p.addScaledVector(pv, dt);
      if (p.y <= 0 && pv.y < 0) {
        p.y = 0;
        pv.y = 0;
      }
      return;
    }
    const slow = Math.exp(-5 * dt);
    pv.x *= slow;
    pv.z *= slow;
    p.x += pv.x * dt;
    p.z += pv.z * dt;
    rider.down -= dt;
  }

  /** Put a knocked scooter back on its road with its rider on it, to pull away from a standstill. */
  private restore(rider: Rider): void {
    const zero = { x: 0, y: 0, z: 0 };
    rider.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    rider.body.collider(0).setCollisionGroups(SOLID);
    rider.body.setLinvel(zero, true);
    rider.body.setAngvel(zero, true);
    rider.knocked = 0;
    rider.walking = false;
    rider.speed = 0;
    rider.drift = 0;
    rider.turn = -1;
    rider.seated = true;
    rider.d = clamp(rider.d, rider.road.lo, rider.road.hi);
    rider.s = clamp(rider.s, 0, rider.road.length - 1);
    this.place(rider, true);
  }

  /** Seeded, so headless runs repeat exactly. */
  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}
