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
  /** In a charge: the X at which this one is shot down. */
  fallAt?: number;
  /** Going to a bus to get on it; or on it, out of sight. */
  bus?: 'boarding' | 'aboard';
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
/** The two armies: what their soldiers wear, and on their heads. */
const UNIFORM = [0x4f7a9a, 0xc8713a];
const HELMET = [0x2f4a5c, 0x7a4424];
const DASH_SPEED = 5;
/** The truck has to be going at least this fast to send someone flying, or to scare them. */
const HIT_SPEED = 1.5;
const SCARE_SPEED = 3;
/** Nobody on foot comes nearer than this to a truck that is standing or crawling, metres from its sides. */
const BERTH = 1.7;
const DOWN_SECONDS = 3;
/** Where those who are not on the field at the moment are kept: well under it. */
const OFFSTAGE = -40;
const offstage = (p: Pedestrian) => p.pos.y < OFFSTAGE / 2;
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
  /** Those run down during the latest step. */
  fresh: Pedestrian[] = [];
  private events: Pedestrian[] = [];
  private seed = 7;
  private clock = 0;

  /** `ground` is how high the ground is at a place, where it is not level: people keep their feet on it. */
  constructor(private readonly crowds: CrowdDesc[], private readonly ground?: (x: number, z: number) => number, private readonly keepOut: [number, number, number, number][] = []) {
    this.populate();
  }

  private populate(): void {
    this.list.length = 0;
    this.seed = 7;
    let n = 0;
    for (const crowd of this.crowds) {
      // Dancers stand in rows, evenly spread over their patch.
      const [x0, z0, x1, z1] = crowd.area;
      const cols = Math.max(1, Math.round(Math.sqrt((crowd.count * (x1 - x0)) / Math.max(1, z1 - z0))));
      const rows = Math.ceil(crowd.count / cols);
      for (let i = 0; i < crowd.count; i++) {
        const far = this.random() < 0.5;
        const pos = crowd.dance !== undefined ? new Vector3(x0 + ((i % cols) + 0.5) * ((x1 - x0) / cols), crowd.y, z0 + (Math.floor(i / cols) + 0.5) * ((z1 - z0) / rows)) : this.pointIn(crowd, far);
        if (this.ground) pos.y = this.ground(pos.x, pos.z) + (crowd.raised ?? 0);
        // Those who charge are not there until their wave comes up.
        if (crowd.charge) pos.y = OFFSTAGE;
        this.list.push({
          pos,
          yaw: crowd.dance ?? this.random() * Math.PI * 2,
          state: 'wait',
          speed: 0,
          color: crowd.army !== undefined ? UNIFORM[crowd.army] : crowd.workers ? VEST : crowd.clothes ? crowd.clothes[i % crowd.clothes.length] : CLOTHES[n++ % CLOTHES.length],
          hat: crowd.army !== undefined ? HELMET[crowd.army] : crowd.workers ? (i % 4 ? 0xf2c12e : 0xf2efe6) : crowd.hat ?? null,
          crowd,
          home: pos.clone(),
          target: crowd.dance !== undefined ? pos.clone() : this.pointIn(crowd, far),
          velocity: new Vector3(),
          far,
          // Those at a crossing set off at different moments, not in a body.
          timer: crowd.charge ? (crowd.charge.phase ?? 0) + 1 + this.random() * 1.2 : crowd.waves ? this.untilWave(crowd) : this.random() * (crowd.crossing ? 9 : 2),
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
    this.fresh = [];
    this.clock += dt;

    for (const p of this.list) {
      // On a bus: nowhere to be seen, and nothing to do until it lets them off.
      if (p.bus === 'aboard') continue;
      if (p.crowd.fenced) this.keepIn(p);
      if (p.state === 'down') {
        this.tumble(p, dt);
        continue;
      }
      // Waiting for the next wave of a charge: nowhere to be seen, and then up at their own end and running.
      if (offstage(p)) {
        if ((p.timer -= dt) <= 0) this.goOver(p);
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
        this.fresh.push(p);
        continue;
      }

      // The truck bearing down on them: after a moment's shock, bolt sideways out of its
      // path. The moment is what catches them out. A slow truck gives them plenty of time;
      // a fast one arrives before they have moved.
      let threatened = false;
      if (p.state !== 'flee' && truckSpeed > SCARE_SPEED && p.crowd.dance === undefined) {
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
          if (p.bus === 'boarding') p.bus = undefined;
        }
      }
      if (!threatened) p.alarm = 0;

      // Soldiers only, and nobody in a city: a truck standing, or crawling, is not walked up to,
      // and whoever it has stopped beside moves off, so that it does not run them down the
      // moment it sets off, and bring their tanks down on it.
      if (p.crowd.army !== undefined && truckSpeed <= SCARE_SPEED && p.state !== 'flee' && Math.abs(local.x) < HALF_WIDTH + BERTH && Math.abs(local.z) < HALF_LENGTH + BERTH) {
        const ox = p.pos.x - t.x;
        const oz = p.pos.z - t.z;
        const out = Math.hypot(ox, oz) || 1;
        p.target.set(p.pos.x + (ox / out) * 3, p.pos.y, p.pos.z + (oz / out) * 3);
        p.state = 'walk';
      }

      // Dancing: on the spot, facing the way the rows face, until knocked down; then back to their place, and on.
      if (p.crowd.dance !== undefined && p.state === 'wait') {
        p.speed = 0;
        p.yaw = p.crowd.dance;
        continue;
      }
      if (p.state === 'wait') {
        p.speed = 0;
        if ((p.timer -= dt) <= 0) {
          // At a crossing, over to the other side, once there is a gap in the traffic.
          if (p.crowd.crossing && !p.crowd.waves && !this.gap(p, vehicles)) {
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
      const pace = p.state === 'flee' ? DASH_SPEED : p.crowd.follows ? p.pace * 2 : p.crowd.charge ? 3.6 + p.pace * 0.5 : p.pace;
      const dx = p.target.x - p.pos.x;
      const dz = p.target.z - p.pos.z;
      const left = Math.hypot(dx, dz);
      const arrived = left < 0.3 || (p.state === 'flee' && (p.timer -= dt) <= 0);
      if (arrived && p.crowd.charge) {
        // Out of the truck's way, and on with the charge; or, somehow, all the way across.
        const [x0, , x1] = p.crowd.area;
        const end = p.crowd.charge.from === 'low' ? x1 : x0;
        if (Math.abs(p.pos.x - end) < 1.5) this.standDown(p);
        else {
          p.target.set(end, p.crowd.y, p.pos.z);
          p.state = 'walk';
        }
        continue;
      }
      if (arrived && p.crowd.dance !== undefined) {
        p.state = 'wait';
        p.speed = 0;
        continue;
      }
      if (arrived && p.bus === 'boarding') {
        // On the bus: out of sight until it lets them off somewhere.
        p.bus = 'aboard';
        p.pos.y = -100;
        p.speed = 0;
        continue;
      }
      if (arrived) {
        p.state = 'wait';
        p.timer = p.crowd.waves ? this.untilWave(p.crowd) : p.crowd.crossing ? 3 + this.random() * 16 : p.crowd.follows ? 0.1 : 0.4 + this.random() * 2.5;
        continue;
      }
      const nextX = p.pos.x + (dx / left) * pace * dt;
      const nextZ = p.pos.z + (dz / left) * pace * dt;
      if ((this.ground && Math.abs(this.ground(nextX, nextZ) + (p.crowd.raised ?? 0) - p.pos.y) > 0.6) || this.keepOut.some(([x0, z0, x1, z1]) => nextX > x0 && nextX < x1 && nextZ > z0 && nextZ < z1)) {
        p.state = 'wait';
        p.timer = 0.6;
        p.speed = 0;
        continue;
      }
      p.pos.x = nextX;
      p.pos.z = nextZ;
      if (this.ground) p.pos.y = this.ground(p.pos.x, p.pos.z) + (p.crowd.raised ?? 0);
      p.yaw = Math.atan2(dx, dz);
      p.speed = pace;
      // In a charge, and this is as far as this one gets: down, thrown forward by his own run.
      if (p.crowd.charge && p.fallAt !== undefined && p.state === 'walk' && (p.crowd.charge.from === 'low' ? p.pos.x >= p.fallAt : p.pos.x <= p.fallAt)) {
        p.velocity.set((dx / left) * 2.5, 2.4, (dz / left) * 2.5 + (this.random() - 0.5) * 1.5);
        p.state = 'down';
        p.timer = 1.6;
        p.speed = 0;
      }
    }
  }

  /**
   * A bus at a stop, its door at a place: some of those on it get off and walk away into the
   * crowd waiting there; and some of that crowd walk to the door and get on.
   */
  busStop(door: { x: number; z: number }, crowd: CrowdDesc, off: number, on: number): void {
    for (const p of this.list.filter((q) => q.bus === 'aboard').slice(0, off)) {
      p.bus = undefined;
      p.crowd = crowd;
      p.pos.set(door.x, this.ground ? this.ground(door.x, door.z) : crowd.y, door.z);
      p.target.copy(this.pointIn(crowd, this.random() < 0.5));
      p.state = 'walk';
    }
    const waiting = this.list.filter((q) => q.crowd === crowd && !q.bus && (q.state === 'walk' || q.state === 'wait'));
    for (const p of waiting.slice(0, on)) {
      p.bus = 'boarding';
      p.target.set(door.x, p.pos.y, door.z);
      p.state = 'walk';
    }
  }

  /**
   * The truck's horn, sounded at a place by something facing a given way: everyone near
   * enough who is on their feet runs, away from it and out to whichever side of its path
   * they are already on.
   */
  scare(x: number, z: number, fx: number, fz: number, reach: number): void {
    for (const p of this.list) {
      if (p.state === 'down' || offstage(p) || p.crowd.dance !== undefined) continue;
      const dx = p.pos.x - x;
      const dz = p.pos.z - z;
      const away = Math.hypot(dx, dz);
      if (away > reach) continue;
      const across = dx * fz - dz * fx;
      const side = across === 0 ? (this.random() < 0.5 ? -1 : 1) : Math.sign(across);
      const out = away || 1;
      const rx = (dx / out) * 0.6 + fz * side;
      const rz = (dz / out) * 0.6 - fx * side;
      const length = Math.hypot(rx, rz) || 1;
      p.target.set(p.pos.x + (rx / length) * 7, p.pos.y, p.pos.z + (rz / length) * 7);
      p.state = 'flee';
      p.timer = 1.5;
      p.alarm = 0;
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

  /** Seconds until the next wave of a crossing that goes over in waves, and a moment more, each their own. */
  private untilWave(crowd: CrowdDesc): number {
    const every = crowd.waves!;
    return every - (this.clock % every) + this.random() * 1.5;
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
      if (away > radius || p.state === 'down' || offstage(p)) continue;
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

  /** A wave of a charge goes over: this one comes up at his army's end of the field and runs for the other. */
  private goOver(p: Pedestrian): void {
    const charge = p.crowd.charge!;
    const [x0, z0, x1, z1] = p.crowd.area;
    const low = charge.from === 'low';
    p.pos.set(low ? x0 : x1, p.crowd.y, z0 + this.random() * (z1 - z0));
    p.target.set(low ? x1 : x0, p.crowd.y, p.pos.z);
    // How far he gets: a few go down almost at once, most somewhere in the middle, none arrives.
    const [nearest, furthest] = charge.falls ?? [0.2, 0.8];
    const share = nearest + this.random() * (furthest - nearest);
    p.fallAt = low ? x0 + (x1 - x0) * share : x1 - (x1 - x0) * share;
    p.velocity.set(0, 0, 0);
    p.alarm = 0;
    p.state = 'walk';
  }

  /** Out of a charge, one way or another: gone until the next wave. */
  private standDown(p: Pedestrian): void {
    const { every, phase = 0 } = p.crowd.charge!;
    p.pos.y = OFFSTAGE;
    p.state = 'wait';
    p.speed = 0;
    // Until the cycle next comes round to this crowd's moment in it.
    const into = (((this.clock - phase - 1) % every) + every) % every;
    p.timer = every - into + this.random() * 1.2;
  }

  reset(): void {
    this.clock = 0;
    this.populate();
    this.hits = 0;
    this.events = [];
  }

  /** Through the air, along the ground, and then a lie-down before getting up. */
  private tumble(p: Pedestrian, dt: number): void {
    const floor = this.ground ? this.ground(p.pos.x, p.pos.z) : p.crowd.y;
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
    // Thrown along the ground: not through a wall, nor over the edge of a drop.
    const tx = p.pos.x + p.velocity.x * dt, tz = p.pos.z + p.velocity.z * dt;
    if ((this.ground && Math.abs(this.ground(tx, tz) - p.pos.y) > 0.6) || this.keepOut.some(([x0, z0, x1, z1]) => tx > x0 && tx < x1 && tz > z0 && tz < z1)) p.velocity.set(0, p.velocity.y, 0);
    p.pos.x += p.velocity.x * dt;
    p.pos.z += p.velocity.z * dt;
    if ((p.timer -= dt) <= 0) {
      // In a charge, that was the end of him. Anyone else is up again, and back toward where they belong.
      if (p.crowd.charge) return this.standDown(p);
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
