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
}

const CLOTHES = [0x3a6fb3, 0xb33a3a, 0x4a8f5a, 0xe0c341, 0x8a5fb3, 0xd9792b, 0x2f3b4a, 0xd9d9d9, 0x3aa6a6];
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
        const pos = this.pointIn(crowd);
        this.list.push({
          pos,
          yaw: this.random() * Math.PI * 2,
          state: 'wait',
          speed: 0,
          color: CLOTHES[n++ % CLOTHES.length],
          crowd,
          home: pos.clone(),
          target: this.pointIn(crowd),
          velocity: new Vector3(),
          timer: this.random() * 2,
          pace: 1.2 + this.random() * 0.8,
          reaction: 0.3 + this.random() * 0.3,
          alarm: 0,
        });
      }
    }
  }

  /** Call once per physics step. */
  update(dt: number, truck: Truck): void {
    const t = truck.body.translation();
    const r = truck.body.rotation();
    const tv = truck.body.linvel();
    const truckSpeed = Math.hypot(tv.x, tv.z);
    q.set(r.x, r.y, r.z, r.w).invert();

    for (const p of this.list) {
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
          p.target.copy(this.pointIn(p.crowd));
          p.state = 'walk';
        }
        continue;
      }

      const pace = p.state === 'flee' ? DASH_SPEED : p.pace;
      const dx = p.target.x - p.pos.x;
      const dz = p.target.z - p.pos.z;
      const left = Math.hypot(dx, dz);
      const arrived = left < 0.3 || (p.state === 'flee' && (p.timer -= dt) <= 0);
      if (arrived) {
        p.state = 'wait';
        p.timer = 0.4 + this.random() * 2.5;
        continue;
      }
      p.pos.x += (dx / left) * pace * dt;
      p.pos.z += (dz / left) * pace * dt;
      p.yaw = Math.atan2(dx, dz);
      p.speed = pace;
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

  private pointIn(crowd: CrowdDesc): Vector3 {
    const [x0, z0, x1, z1] = crowd.area;
    return new Vector3(x0 + this.random() * (x1 - x0), crowd.y, z0 + this.random() * (z1 - z0));
  }

  /** Seeded, so headless runs repeat exactly. */
  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}
