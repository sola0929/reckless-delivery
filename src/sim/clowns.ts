import { Quaternion, Vector3 } from 'three';
import { PHYSICS, TRUCK } from '../config';
import type { ObjectDesc } from '../levels/objects';
import type { ClownDesc } from '../levels/types';
import type { LooseObject, ObjectSystem } from './objects';
import type { Truck } from './truck';

/** How many balls each juggles, how many times a second each crosses from hand to hand, how high they go over the hands, metres. */
export const JUGGLED = 3;
const THROWS = 1.2;
const ARC = 0.85;
/** How high the hands are over the ground, riding; how far apart. */
const HANDS = 1.5;
const SPREAD = 0.32;
/** A clown and the wheel under them, as far as the truck is concerned: so far round their middle. */
const REACH = 0.4;
/** How far ahead round their loop they look for the truck in their way, metres; how fast they stop and set off. */
const LOOK = 2.2;
const BRAKE = 4;
const PEDAL = 1.5;
/** The truck going slower than this, m/s, is waited for and backed away from; faster, it knocks them flying. */
const KNOCKS = 1.4;
/** What they back away at, the truck creeping up on them. */
const BACK = 1.0;
/**
 * A unicycle will not stand still: held up by the truck, rocking to and fro on the spot, a clown keeps their balance this
 * long, seconds, and then goes over; riding again, they get it back over so long. Halfway, they start to shout.
 */
const HOLD = 1.8;
const EASE = 1.2;
const SHOUT = 0.45;
/** How long a clown lies there; how fast they walk back; how near the truck may be while they get back on. */
const DOWN = 3;
const WALK = 1.6;
const CLEAR = 7;
/** How long a ball burns before it goes, once it is out of the hands: the first, then each next a little later. */
const FUSE = 1.15;
const FUSE_STEP = 0.2;
const G = -PHYSICS.gravity;
const WAITING_Y = -60;

export interface Clown {
  desc: ClownDesc;
  /** Metres round the loop, and its length. */
  s: number;
  long: number;
  speed: number;
  x: number;
  z: number;
  yaw: number;
  /** Riding round; thrown through the air; lying there; walking to the wheel; wheeling it back to the loop. */
  state: 'riding' | 'thrown' | 'down' | 'fetching' | 'returning';
  person: Vector3;
  personVelocity: Vector3;
  down: number;
  wheel: Vector3;
  wheelVelocity: Vector3;
  /** How far the thrown wheel has turned over, radians, and about which way across. */
  tumble: number;
  /** How near to going over they are, held up on the spot: 0 at ease, 1 gone. */
  strain: number;
  /** Whether the balls are in the air over their hands; the balls themselves, for when they are not. */
  juggling: boolean;
  balls: LooseObject[];
  lit: boolean[];
  index: number;
}

/** Where a point round a loop is, and which way along it. */
function along(loop: [number, number][], s: number): { x: number; z: number; yaw: number } {
  for (let k = 0; ; k = (k + 1) % loop.length) {
    const [ax, az] = loop[k], [bx, bz] = loop[(k + 1) % loop.length];
    const long = Math.hypot(bx - ax, bz - az);
    if (s <= long) return { x: ax + ((bx - ax) * s) / long, z: az + ((bz - az) * s) / long, yaw: Math.atan2(bx - ax, bz - az) };
    s -= long;
  }
}

/**
 * Where one of a juggler's balls is, about their middle and the way they face, at a time: three in a cascade from hand to
 * hand, each thrown up from one and caught in the other.
 */
export function juggled(k: number, time: number, yaw: number): { x: number; y: number; z: number } {
  const t = time * THROWS + k / JUGGLED;
  const throwN = Math.floor(t), p = t - throwN, from = throwN % 2 ? 1 : -1;
  const across = from * SPREAD * (1 - 2 * p), up = HANDS + 4 * ARC * p * (1 - p);
  // Out in front of them a little, across the way they face.
  return { x: Math.cos(yaw) * across + Math.sin(yaw) * 0.42, y: up, z: -Math.sin(yaw) * across + Math.cos(yaw) * 0.42 };
}

const q = new Quaternion();
const v = new Vector3();

/**
 * Clowns on unicycles, riding round loops of their own across the show's ring, juggling balls of fireworks with their
 * fuses lit. They stop for the truck in their way and back off from it creeping up, but a unicycle will not stand still:
 * held up, they rock on the spot, and before long go over, balls and all, down beside the truck. Run into, they go flying, the wheel
 * one way and they the other, and the balls go on the way the truck was going, to land in front of it and go off a moment
 * later. The clown lies there a while, gets up, fetches the wheel, gets back on, and is juggling again.
 */
export class Clowns {
  readonly list: Clown[] = [];
  /** Those the truck has just run into, those just begun to lose their balance, and those just gone over, for whoever tells the player. */
  fresh: Clown[] = [];
  wobbling: Clown[] = [];
  toppled: Clown[] = [];
  time = 0;

  /** The balls, waiting out of the way: these go after the level's own in the list of its objects. */
  static waiting(descs: ClownDesc[]): ObjectDesc[] {
    return descs.flatMap((desc, n) => Array.from({ length: JUGGLED }, (_, k): ObjectDesc => ({ kind: 'fireworkBall', pos: [desc.loop[0][0] + k, WAITING_Y - n * 2, desc.loop[0][1]] })));
  }

  /** @param first where in the object system's list the first of the balls is */
  constructor(private readonly objects: ObjectSystem, descs: ClownDesc[], first: number) {
    descs.forEach((desc, index) => {
      const long = desc.loop.reduce((sum, [ax, az], k) => sum + Math.hypot(desc.loop[(k + 1) % desc.loop.length][0] - ax, desc.loop[(k + 1) % desc.loop.length][1] - az), 0);
      const balls = objects.objects.slice(first + index * JUGGLED, first + (index + 1) * JUGGLED);
      const clown: Clown = {
        desc, s: 0, long, speed: 0, x: 0, z: 0, yaw: 0, state: 'riding', person: new Vector3(), personVelocity: new Vector3(), down: 0,
        wheel: new Vector3(), wheelVelocity: new Vector3(), tumble: 0, strain: 0, juggling: true, balls, lit: balls.map(() => false), index,
      };
      this.list.push(clown);
      this.mount(clown, desc.start % long);
    });
    this.stowAll();
  }

  /** Call once per physics step, before the world steps. */
  update(dt: number, truck: Truck): void {
    this.time += dt;
    this.fresh = [];
    this.wobbling = [];
    this.toppled = [];
    const t = truck.body.translation(), r = truck.body.rotation(), tv = truck.body.linvel();
    q.set(r.x, r.y, r.z, r.w).invert();
    const fast = Math.hypot(tv.x, tv.z);
    /** How far a point is inside the truck's outline grown by so much; below 0 outside it. */
    const inside = (x: number, z: number, grown: number) => {
      v.set(x - t.x, 0, z - t.z).applyQuaternion(q);
      return Math.min(TRUCK.frame.half[0] + grown - Math.abs(v.x), TRUCK.frame.half[2] + grown - Math.abs(v.z));
    };

    for (const clown of this.list) {
      // A ball that has gone off is gone.
      clown.balls.forEach((ball, k) => {
        if (clown.lit[k] && ball.fuse < 0) {
          clown.lit[k] = false;
          this.objects.stow(ball);
        }
      });
      if (clown.state === 'riding') {
        if (inside(clown.x, clown.z, REACH) > 0) {
          if (fast > KNOCKS) {
            this.knock(clown, tv);
            this.fresh.push(clown);
            continue;
          }
          // Crept up on: back away round the loop, keeping their distance, as long as they can keep their balance.
          clown.speed = 0;
          clown.s = (clown.s - BACK * dt + clown.long) % clown.long;
          if (this.strain(clown, dt, true, t)) continue;
        } else {
          // The truck across the way ahead: stop and wait for it, wobbling where they are.
          let blocked = false;
          for (let d = 0.5; d <= LOOK && !blocked; d += 0.5) {
            const p = along(clown.desc.loop, (clown.s + d) % clown.long);
            blocked = inside(p.x, p.z, REACH + 0.3) > 0;
          }
          clown.speed = blocked ? Math.max(0, clown.speed - BRAKE * dt) : Math.min(clown.desc.speed, clown.speed + PEDAL * dt);
          clown.s = (clown.s + clown.speed * dt) % clown.long;
          if (this.strain(clown, dt, blocked && clown.speed < 0.5, t)) continue;
        }
        const p = along(clown.desc.loop, clown.s);
        clown.x = p.x;
        clown.z = p.z;
        clown.yaw = p.yaw;
        continue;
      }
      this.recover(clown, dt, t);
    }
  }

  /** Held up on the spot or not: nearer going over, or getting their balance back. Whether they have gone over. */
  private strain(clown: Clown, dt: number, held: boolean, truck: { x: number; z: number }): boolean {
    const was = clown.strain;
    clown.strain = held ? clown.strain + dt / HOLD : Math.max(0, clown.strain - dt / EASE);
    if (was < SHOUT && clown.strain >= SHOUT) this.wobbling.push(clown);
    if (clown.strain < 1) return false;
    // Over, toward the truck that held them up, the balls let go every way round them: down against it.
    const away = Math.max(0.3, Math.hypot(clown.x - truck.x, clown.z - truck.z));
    this.knock(clown, { x: ((truck.x - clown.x) / away) * 1.6, y: 0, z: ((truck.z - clown.z) / away) * 1.6 }, 1.6);
    this.toppled.push(clown);
    return true;
  }

  /** Thrown off by a blast: no truck in it, the balls dropped where they were. */
  blast(x: number, z: number, radius: number): void {
    for (const clown of this.list) {
      if (clown.state !== 'riding' || Math.hypot(clown.x - x, clown.z - z) > radius) continue;
      const away = Math.max(0.3, Math.hypot(clown.x - x, clown.z - z));
      this.knock(clown, { x: ((clown.x - x) / away) * 4, y: 0, z: ((clown.z - z) / away) * 4 });
    }
  }

  reset(): void {
    this.time = 0;
    for (const clown of this.list) this.mount(clown, clown.desc.start % clown.long);
    this.stowAll();
  }

  /** Run into, or blown off: they one way, the wheel another, the balls on with whatever hit them. */
  private knock(clown: Clown, by: { x: number; y: number; z: number }, scatter = 1.4): void {
    const side = Math.cos(clown.yaw), fore = -Math.sin(clown.yaw);
    clown.state = 'thrown';
    clown.person.set(clown.x, 1.1, clown.z);
    clown.personVelocity.set(by.x * 0.8 + side * 2, 4.5, by.z * 0.8 + fore * 2);
    clown.wheel.set(clown.x, 0.45, clown.z);
    clown.wheelVelocity.set(by.x * 0.7 - side * 2, 3, by.z * 0.7 - fore * 2);
    clown.tumble = 0;
    clown.down = DOWN;
    if (!clown.juggling) return;
    clown.juggling = false;
    clown.balls.forEach((ball, k) => {
      const at = juggled(k, this.time, clown.yaw);
      const spread = k - 1;
      this.objects.send(ball, { x: clown.x + at.x, y: at.y, z: clown.z + at.z }, { x: by.x + side * spread * scatter, y: 3 + k * 0.6, z: by.z + fore * spread * scatter });
      ball.knocked = true;
      ball.fuse = FUSE + k * FUSE_STEP;
      clown.lit[k] = true;
    });
  }

  /** Through the air, a lie-down, up, over to the wheel, back with it to the loop, and on. */
  private recover(clown: Clown, dt: number, truck: { x: number; z: number }): void {
    const fly = (p: Vector3, vel: Vector3, rest: number) => {
      if (p.y <= rest && vel.y <= 0) {
        p.y = rest;
        vel.set(0, 0, 0);
        return false;
      }
      vel.y -= G * dt;
      p.addScaledVector(vel, dt);
      return true;
    };
    const wheelFlying = fly(clown.wheel, clown.wheelVelocity, 0.45);
    if (wheelFlying) clown.tumble = Math.min(Math.PI / 2, clown.tumble + 6 * dt);
    if (clown.state === 'thrown') {
      if (!fly(clown.person, clown.personVelocity, 0)) clown.state = 'down';
      return;
    }
    if (clown.state === 'down') {
      if ((clown.down -= dt) <= 0) clown.state = 'fetching';
      return;
    }
    // On foot: to the wheel, then with it to the nearest of the loop.
    const goal = clown.state === 'fetching' ? clown.wheel : this.nearest(clown);
    const dx = goal.x - clown.person.x, dz = goal.z - clown.person.z, away = Math.hypot(dx, dz);
    if (away > 0.3) {
      clown.yaw = Math.atan2(dx, dz);
      clown.person.x += (dx / away) * Math.min(away, WALK * dt);
      clown.person.z += (dz / away) * Math.min(away, WALK * dt);
      if (clown.state === 'returning') clown.wheel.set(clown.person.x + Math.sin(clown.yaw) * 0.5, 0.45, clown.person.z + Math.cos(clown.yaw) * 0.5);
      return;
    }
    if (clown.state === 'fetching') {
      clown.state = 'returning';
      clown.tumble = 0;
      return;
    }
    // Back on, but not with the truck on top of them, nor before the last of the balls has gone off.
    if (Math.hypot(truck.x - clown.person.x, truck.z - clown.person.z) < CLEAR || clown.lit.some(Boolean)) return;
    this.mount(clown, this.nearest(clown).s);
  }

  /** The point of the loop nearest where the clown is standing. */
  private nearest(clown: Clown): { x: number; z: number; s: number } {
    let best = { x: 0, z: 0, s: 0 }, far = Infinity;
    for (let s = 0; s < clown.long; s += 0.5) {
      const p = along(clown.desc.loop, s), d = Math.hypot(p.x - clown.person.x, p.z - clown.person.z);
      if (d < far) [far, best] = [d, { x: p.x, z: p.z, s }];
    }
    return best;
  }

  /** Up on the wheel at a point of the loop, juggling, setting off from a standstill. */
  private mount(clown: Clown, s: number): void {
    const p = along(clown.desc.loop, s);
    Object.assign(clown, { s, speed: 0, x: p.x, z: p.z, yaw: p.yaw, state: 'riding', down: 0, tumble: 0, juggling: true, strain: 0 });
    clown.person.set(p.x, 0, p.z);
    clown.wheel.set(p.x, 0.45, p.z);
  }

  private stowAll(): void {
    for (const clown of this.list) {
      clown.lit = clown.balls.map(() => false);
      for (const ball of clown.balls) this.objects.stow(ball);
    }
  }
}
