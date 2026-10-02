import { Quaternion, Vector3 } from 'three';
import { PHYSICS, TRUCK } from '../config';
import type { CrowdDesc } from '../levels/types';
import type { Truck } from './truck';

export type PedestrianState = 'walk' | 'wait' | 'flee' | 'down';

export interface Pedestrian {
  pos: Vector3;
  /** Direction they face: radians about Y, 0 = toward +Z. */
  yaw: number;
  state: PedestrianState;
  /** Ground speed right now, m/s, for animation. */
  speed: number;
  color: number;
  crowd: CrowdDesc;
  home: Vector3;
  target: Vector3;
  velocity: Vector3;
  /** Seconds left in the current wait, dash or spell on the ground. */
  timer: number;
  /** Their own strolling pace. */
  pace: number;
  /** How long they freeze before running from the truck, and how long they have been frozen. */
  reaction: number;
  alarm: number;
  /** At a crossing: which end of it they are at, or are making for. */
  far: boolean;
  /** The colour of what is on their head, if anything is. */
  hat: number | null;
}

/** How far back from each end of a crossing people wait: the width of pavement they stand on. */
const KERBSIDE = 2.5;
/** They cross if nothing will reach them within this long. It takes them longer than that to get over. */
const LOOK_SECONDS = 3;

/** Something driving or riding along a road. */
export interface Vehicle {
  x: number;
  z: number;
  vx: number;
  vz: number;
}

const CLOTHES = [0x3a6fb3, 0xb33a3a, 0x4a8f5a, 0xe0c341, 0x8a5fb3, 0xd9792b, 0x2f3b4a, 0xd9d9d9, 0x3aa6a6];
const VEST = 0xf07a1a;
const DASH_SPEED = 5;
/** The truck has to be going at least this fast to send someone flying, or to scare them. */
const HIT_SPEED = 1.5;
const SCARE_SPEED = 3;
const DOWN_SECONDS = 3;
const HALF_WIDTH = TRUCK.frame.half[0] + 0.3;
const HALF_LENGTH = TRUCK.frame.half[2] + 0.3;
const G = -PHYSICS.gravity;
const q = new Quaternion();
const local = new Vector3();

/**
 * People milling about in set areas. They are not solid: the truck doesn't stop for them or
 * swerve round them, it sends them flying. They do try to get out of its way, usually too
 * late, and they pick themselves up again afterwards.
 */
export class Pedestrians {
  readonly list: Pedestrian[] = [];
  /** How many have been sent flying since the last reset. */
  hits = 0;
  private events: Pedestrian[] = [];
  private seed = 7;

  constructor(private readonly crowds: CrowdDesc[]) {
    this.populate();
  }

  private populate(): void {
    this.list.length = 0;
    this.seed = 7;
    let n = 0;
    for (const crowd of this.crowds) {
      for (let i = 0; i < crowd.count; i++) {
        const far = this.random() < 0.5;
        const pos = this.pointIn(crowd, far);
        this.list.push({
          pos,
          yaw: this.random() * Math.PI * 2,
          state: 'wait',
          speed: 0,
          color: crowd.workers ? VEST : CLOTHES[n++ % CLOTHES.length],
          hat: crowd.workers ? (i % 4 ? 0xf2c12e : 0xf2efe6) : null,
          crowd,
          home: pos.clone(),
          target: this.pointIn(crowd, far),
          velocity: new Vector3(),
          far,
          // Those at a crossing set off at different moments, not in a body.
          timer: this.random() * (crowd.crossing ? 9 : 2),
          pace: 1.2 + this.random() * 0.8,
          reaction: 0.3 + this.random() * 0.3,
          alarm: 0,
        });
      }
    }
  }

  /**
   * Call once per physics step. `vehicles` is the traffic: nobody steps out in front of it.
   * The truck is not among it; people step out in front of that.
   */
  update(dt: number, truck: Truck, vehicles: readonly Vehicle[] = []): void {
    const t = truck.body.translation();
    const r = truck.body.rotation();
    const tv = truck.body.linvel();
    const truckSpeed = Math.hypot(tv.x, tv.z);
    q.set(r.x, r.y, r.z, r.w).invert();

    for (const p of this.list) {
      if (p.crowd.fenced) this.keepIn(p);
      if (p.state === 'down') {
        this.tumble(p, dt);
        continue;
      }

      // Under the truck's wheels: thrown ahead of it and to whichever side they were nearer.
      local.set(p.pos.x - t.x, 0, p.pos.z - t.z).applyQuaternion(q);
      if (truckSpeed > HIT_SPEED && Math.abs(local.x) < HALF_WIDTH && Math.abs(local.z) < HALF_LENGTH) {
        const side = local.x < 0 ? -1 : 1;
        // Sideways relative to the way the truck is travelling.
        const sx = (tv.z / truckSpeed) * side;
        const sz = (-tv.x / truckSpeed) * side;
        p.velocity.set(tv.x * 1.1 + sx * 3, 4 + truckSpeed * 0.15, tv.z * 1.1 + sz * 3);
        p.state = 'down';
        p.timer = DOWN_SECONDS;
        p.speed = 0;
        this.hits++;
        this.events.push(p);
        continue;
      }

      // The truck bearing down on them: after a moment's shock, bolt sideways out of its
      // path. The moment is what catches them out. A slow truck gives them plenty of time;
      // a fast one arrives before they have moved.
      let threatened = false;
      if (p.state !== 'flee' && truckSpeed > SCARE_SPEED) {
        const dx = p.pos.x - t.x;
        const dz = p.pos.z - t.z;
        const along = (dx * tv.x + dz * tv.z) / truckSpeed;
        const across = (dx * tv.z - dz * tv.x) / truckSpeed;
        threatened = along > 0 && along < truckSpeed * 1.1 + 5 && Math.abs(across) < 3.2;
        if (threatened && (p.alarm += dt) > p.reaction) {
          const side = across === 0 ? (this.random() < 0.5 ? -1 : 1) : Math.sign(across);
          p.target.set(p.pos.x + (tv.z / truckSpeed) * side * 6, p.pos.y, p.pos.z - (tv.x / truckSpeed) * side * 6);
          p.state = 'flee';
          p.timer = 1.1;
        }
      }
      if (!threatened) p.alarm = 0;

      if (p.state === 'wait') {
        p.speed = 0;
        if ((p.timer -= dt) <= 0) {
          // At a crossing, over to the other side, once there is a gap in the traffic.
          if (p.crowd.crossing && !this.gap(p, vehicles)) {
            p.timer = 0.4;
            continue;
          }
          p.far = !p.far;
          p.target.copy(this.pointIn(p.crowd, p.far));
          p.state = 'walk';
        }
        continue;
      }

      // Those going after something keep up with it.
      const pace = p.state === 'flee' ? DASH_SPEED : p.crowd.follows ? p.pace * 2 : p.pace;
      const dx = p.target.x - p.pos.x;
      const dz = p.target.z - p.pos.z;
      const left = Math.hypot(dx, dz);
      const arrived = left < 0.3 || (p.state === 'flee' && (p.timer -= dt) <= 0);
      if (arrived) {
        p.state = 'wait';
        p.timer = p.crowd.crossing ? 3 + this.random() * 16 : p.crowd.follows ? 0.1 : 0.4 + this.random() * 2.5;
        continue;
      }
      p.pos.x += (dx / left) * pace * dt;
      p.pos.z += (dz / left) * pace * dt;
      p.yaw = Math.atan2(dx, dz);
      p.speed = pace;
    }
  }

  /** Hold someone to their patch: stopped at its edge, with no speed left to carry them through it. */
  private keepIn(p: Pedestrian): void {
    const [x0, z0, x1, z1] = p.crowd.area;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const x = clamp(p.pos.x, x0, x1);
    const z = clamp(p.pos.z, z0, z1);
    if (x !== p.pos.x) p.velocity.x = 0;
    if (z !== p.pos.z) p.velocity.z = 0;
    p.pos.x = x;
    p.pos.z = z;
    p.target.x = clamp(p.target.x, x0, x1);
    p.target.z = clamp(p.target.z, z0, z1);
  }

  /** Whether nothing is about to come past where someone at a crossing is standing. */
  private gap(p: Pedestrian, vehicles: readonly Vehicle[]): boolean {
    const [x0, z0, x1, z1] = p.crowd.area;
    const alongX = p.crowd.crossing === 'z';
    const middle = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2;
    const reach = (alongX ? z1 - z0 : x1 - x0) / 2 - KERBSIDE;
    for (const vehicle of vehicles) {
      if (Math.abs((alongX ? vehicle.z : vehicle.x) - middle) > reach) continue;
      const away = alongX ? p.pos.x - vehicle.x : p.pos.z - vehicle.z;
      const speed = alongX ? vehicle.vx : vehicle.vz;
      // Coming this way, and here within a few seconds.
      if (away * speed > 0 && Math.abs(away) < Math.abs(speed) * LOOK_SECONDS + 3) return false;
    }
    return true;
  }

  /** People who are out in the road at this moment, on their way across. */
  inRoad(): Pedestrian[] {
    return this.list.filter((p) => {
      const axis = p.crowd.crossing;
      if (!axis || p.state === 'down' || p.state === 'wait') return false;
      const [x0, z0, x1, z1] = p.crowd.area;
      const at = axis === 'x' ? p.pos.x : p.pos.z;
      const [lo, hi] = axis === 'x' ? [x0, x1] : [z0, z1];
      return at > lo + KERBSIDE && at < hi - KERBSIDE;
    });
  }

  /** Throw everyone within `radius` of a blast outward from it. */
  blast(x: number, z: number, radius: number): void {
    for (const p of this.list) {
      const dx = p.pos.x - x;
      const dz = p.pos.z - z;
      const away = Math.hypot(dx, dz);
      if (away > radius || p.state === 'down') continue;
      const out = Math.max(away, 0.3);
      const push = 9 * (1 - away / radius) + 2;
      p.velocity.set((dx / out) * push, 4 + push * 0.4, (dz / out) * push);
      p.state = 'down';
      p.timer = DOWN_SECONDS;
      p.speed = 0;
    }
  }

  /** Those sent flying since the last call. */
  drainEvents(): Pedestrian[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  reset(): void {
    this.populate();
    this.hits = 0;
    this.events = [];
  }

  /** Through the air, along the ground, and then a lie-down before getting up. */
  private tumble(p: Pedestrian, dt: number): void {
    const floor = p.crowd.y;
    if (p.pos.y > floor || p.velocity.y > 0) {
      p.velocity.y -= G * dt;
      p.pos.addScaledVector(p.velocity, dt);
      // Only on the way down: they may start a hair below the floor of wherever they belong.
      if (p.pos.y <= floor && p.velocity.y < 0) {
        p.pos.y = floor;
        p.velocity.y = 0;
      }
      return;
    }
    const slow = Math.exp(-5 * dt);
    p.velocity.x *= slow;
    p.velocity.z *= slow;
    p.pos.x += p.velocity.x * dt;
    p.pos.z += p.velocity.z * dt;
    if ((p.timer -= dt) <= 0) {
      // Up again, and back toward where they belong.
      p.state = 'walk';
      p.target.copy(p.home);
    }
  }

  /** Somewhere to stand in a crowd's patch. At a crossing that is on one pavement or the other: the far one, or the near. */
  private pointIn(crowd: CrowdDesc, far: boolean): Vector3 {
    const [x0, z0, x1, z1] = crowd.area;
    const x = x0 + this.random() * (x1 - x0);
    const z = z0 + this.random() * (z1 - z0);
    const kerb = this.random() * KERBSIDE;
    if (crowd.crossing === 'x') return new Vector3(far ? x1 - kerb : x0 + kerb, crowd.y, z);
    if (crowd.crossing === 'z') return new Vector3(x, crowd.y, far ? z1 - kerb : z0 + kerb);
    return new Vector3(x, crowd.y, z);
  }

  /** Seeded, so headless runs repeat exactly. */
  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}
