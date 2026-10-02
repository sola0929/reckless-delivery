import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { GROUP, groups } from '../config';
import type { BattleDesc, CrossfireDesc, LauncherDesc, ShellZone, TankDesc } from '../levels/types';
import type { Truck } from './truck';

// A battle going on around the truck: shells that fall where a circle has warned they will,
// the two armies' fire at each other going across the road, rocket launchers that lock on
// and then fire straight, and tanks that mind their own business until one of their own
// soldiers is run down.
//
// Nothing aimed at the truck is sprung on it: each shows what it is about to do, and leaves
// time to be somewhere else. None of it is got through just by going flat out in a straight
// line: the shells are laid where that would take the truck.

/** A shell on its way down. */
export interface Shell {
  x: number;
  z: number;
  /** Seconds until it lands, and how long it was given. */
  left: number;
  total: number;
}

/** Something fired in a straight line: a rocket, or a tank's shell. */
export interface Projectile {
  kind: 'rocket' | 'shell';
  pos: Vector3;
  dir: Vector3;
  speed: number;
  /** Metres it has left to fly. */
  left: number;
}

/** One stray round on its way across the road. */
export interface Round {
  pos: Vector3;
  dir: Vector3;
  /** Metres it has left to fly before it meets something, or the far side. */
  left: number;
}

export interface LauncherState {
  desc: LauncherDesc;
  /** Whether it can see the truck, and how far along it is to firing, 0 to 1. */
  sees: boolean;
  lock: number;
  /** What it is aiming at, and the way it faces. */
  aim: Vector3;
  yaw: number;
  cooldown: number;
}

export interface TankState {
  desc: TankDesc;
  /** Which way the turret points: radians about Y, in the world. */
  yaw: number;
  /** Roused: it has been run into, and is after whoever did it. */
  hostile: boolean;
  lock: number;
  cooldown: number;
  /** Seconds the truck has been out of its reach. */
  lost: number;
  /** Where the gun is being laid, and whether it has stopped following. */
  aim: Vector3;
  held: boolean;
  /** How near the next shot is, 0 to 1: its line swells with this. */
  charge: number;
  /** Seconds until it next fires at the other army. */
  idle: number;
}

/** Something going off: where, what, and whether it struck the truck itself. */
export interface Burst {
  x: number;
  y: number;
  z: number;
  kind: 'shell' | 'rocket' | 'tank';
  power: number;
  /** How far it reaches, when that is less than the usual. */
  radius?: number;
  /** A direct hit: the truck is thrown, not just shaken. */
  direct: boolean;
}

export type BattleSound = { kind: 'launch' | 'cannon' | 'gun' | 'whistle'; x: number; z: number; far?: boolean };

const SHELL_SECONDS = 2.2;
/** The circle a shell is to land in, metres across its radius: with any of the truck in it, the truck is hit. */
export const SHELL_RING = 2.8;
/** How far a shell's blast reaches, and how far either way from where the truck is going they are scattered: across, along. */
const SHELL_REACH = 7;
const SHELL_SCATTER = [10, 16];
const ROUND_SPEED = 75;
const GUN_TICK = 0.11;
// A launcher is quick to lock and its rocket is slow: it can be seen coming, from a long way off, and steered out of the way of.
const LOCK_SECONDS = 1.4;
const ROCKET_SPEED = 17;
const ROCKET_REST = 5.5;
/** For this long before it fires, a tank's gun no longer follows the truck: the shell goes where it was pointing then. */
const AIM_HOLD = 0.5;
/** How fast a rocket in flight can come round after the truck, radians a second: very little. */
const ROCKET_TURN = 0.12;
/** A tank shelling the other army fires this often, to the second; for this long before each shot its line swells. */
const IDLE_EVERY = 6;
const IDLE_WARNING = 1.5;
/** After the truck has been thrown by a direct hit, nothing locks on to it for this long: time to land and get going. */
const RESPITE = 6;
/** A tank this near to where one of its soldiers was run down takes notice. */
const ROUSE_REACH = 60;
const SHELL_SPEED = 62;
const TANK_TURN = 0.6;
const TANK_LOCK_SECONDS = 1.3;
const TANK_REST = 7;
/** A roused tank gives up once the truck has been this far off for this long. */
export const TANK_REACH = 42;
const TANK_FORGET = 2;
export const TANK_HALF = { width: 1.7, height: 0.95, length: 3.3 };
/** Height of a launcher's eye, of a rocket in flight, and of a tank's gun. */
const EYE = 1.4;
const MUZZLE = 1.95;
const STATIC = groups(GROUP.all, GROUP.ground);

const q = new Quaternion();
const v = new Vector3();
const w = new Vector3();

/** Shortest signed difference between two angles. */
const turn = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export class Battle {
  readonly shells: Shell[] = [];
  readonly projectiles: Projectile[] = [];
  readonly rounds: Round[] = [];
  readonly launchers: LauncherState[];
  readonly tanks: TankState[];
  /** Where shells have landed, for the marks they leave. */
  readonly scars: { x: number; z: number }[] = [];
  /** What went off during the latest step. */
  bursts: Burst[] = [];
  /** How many machine-gun rounds found the truck during the latest step. */
  hits = 0;
  sounds: BattleSound[] = [];
  /** Whatever is locking on to the truck at the moment, if anything: the furthest along. */
  threat: { kind: 'rocket' | 'tank'; lock: number } | null = null;
  private clock = 0;
  private gunTick = 0;
  private respite = 0;
  private lull = 0;
  private readonly fire: { desc: CrossfireDesc; due: number }[];
  private readonly zones: { desc: ShellZone; wait: number }[];
  private seed = 23;

  constructor(private readonly world: RAPIER.World, desc: BattleDesc = {}) {
    this.zones = (desc.shelling ?? []).map((zone) => ({ desc: zone, wait: 1 }));
    this.fire = (desc.crossfire ?? []).map((zone) => ({ desc: zone, due: 0 }));
    this.launchers = (desc.launchers ?? []).map((launcher) => ({ desc: launcher, sees: false, lock: 0, aim: new Vector3(), yaw: 0, cooldown: 0 }));
    this.tanks = (desc.tanks ?? []).map((tank) => {
      // A tank doesn't move, and nothing moves it.
      q.setFromAxisAngle(v.set(0, 1, 0), tank.rotY);
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(tank.pos[0], TANK_HALF.height, tank.pos[1]).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
      world.createCollider(RAPIER.ColliderDesc.cuboid(TANK_HALF.width, TANK_HALF.height, TANK_HALF.length).setFriction(0.6).setCollisionGroups(groups(GROUP.ground, GROUP.all)), body);
      return { desc: tank, yaw: tank.gun ?? tank.rotY, hostile: false, lock: 0, cooldown: 0, lost: 0, aim: new Vector3(), held: false, charge: 0, idle: 2 + (tank.pos[1] % 4) };
    });
  }

  /** Call once per physics step, after the world has stepped. */
  update(dt: number, truck: Truck): void {
    this.clock += dt;
    this.bursts = [];
    this.sounds = [];
    this.hits = 0;
    this.threat = null;
    const at = truck.body.translation();
    const lv = truck.body.linvel();
    const r = truck.body.rotation();
    q.set(r.x, r.y, r.z, r.w).invert();
    /** Whether a point is inside the truck, near enough. */
    const strikes = (p: { x: number; y: number; z: number }, margin = 0) => {
      v.set(p.x - at.x, p.y - at.y, p.z - at.z).applyQuaternion(q);
      return Math.abs(v.x) < 1.5 + margin && Math.abs(v.z) < 3.9 + margin && v.y > -0.8 && v.y < 2.4;
    };

    this.respite -= dt;
    this.shell(dt, at, lv, strikes);
    this.crossfire(dt, at, strikes);
    this.launch(dt, at);
    this.hunt(dt, at);
    this.fly(dt, at, strikes);
  }

  reset(): void {
    this.clock = 0;
    this.gunTick = 0;
    this.seed = 23;
    this.shells.length = this.projectiles.length = this.scars.length = this.rounds.length = 0;
    this.respite = this.lull = 0;
    for (const zone of this.fire) zone.due = 0;
    this.bursts = [];
    this.sounds = [];
    this.threat = null;
    for (const zone of this.zones) zone.wait = 1;
    for (const launcher of this.launchers) Object.assign(launcher, { sees: false, lock: 0, cooldown: 0 });
    for (const tank of this.tanks) Object.assign(tank, { yaw: tank.desc.gun ?? tank.desc.rotY, hostile: false, lock: 0, cooldown: 0, lost: 0, held: false, charge: 0, idle: 2 + (tank.desc.pos[1] % 4) });
  }

  /**
   * Shells: small ones, and many, coming down all about where a truck in a zone being shelled
   * will be when they land, each with a circle to show where. Speed is no help: they are
   * scattered about where it is going, not where it is. The way through is to steer between
   * the circles, with whatever the ground leaves room for.
   */
  private shell(dt: number, at: { x: number; y: number; z: number }, lv: { x: number; z: number }, strikes: (p: { x: number; y: number; z: number }, margin?: number) => boolean): void {
    this.lull -= dt;
    for (const zone of this.zones) {
      const [x0, z0, x1, z1] = zone.desc.area;
      // Only while the truck is there to be shelled, or close.
      if (at.x < x0 - 15 || at.x > x1 + 15 || at.z < z0 - 15 || at.z > z1 + 15) continue;
      if ((zone.wait -= dt) > 0) continue;
      zone.wait = zone.desc.every * (0.6 + this.random() * 0.8);
      const x = at.x + lv.x * SHELL_SECONDS + (this.random() - 0.5) * 2 * SHELL_SCATTER[0];
      const z = at.z + lv.z * SHELL_SECONDS + (this.random() - 0.5) * 2 * SHELL_SCATTER[1];
      if (this.lull > 0 || x < x0 || x > x1 || z < z0 || z > z1) continue;
      this.shells.push({ x, z, left: SHELL_SECONDS, total: SHELL_SECONDS });
      if (this.random() < 0.3) this.sounds.push({ kind: 'whistle', x, z });
    }
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const shell = this.shells[i];
      if ((shell.left -= dt) > 0) continue;
      this.shells.splice(i, 1);
      const direct = strikes({ x: shell.x, y: at.y, z: shell.z }, SHELL_RING * 0.7);
      // Hit: a moment for it to come down before any more are called.
      if (direct) this.lull = 1.5;
      this.bursts.push({ x: shell.x, y: 0.3, z: shell.z, kind: 'shell', power: 0.85, radius: SHELL_REACH, direct });
      this.scars.push({ x: shell.x, z: shell.z });
      if (this.scars.length > 80) this.scars.shift();
    }
  }

  /**
   * The two armies shooting at each other: rounds cross the road from both sides, at all
   * angles, all along the stretch round the truck. None is aimed at it. One that passes
   * through it goes through the load. Anything solid in the way stops a round.
   */
  private crossfire(dt: number, at: { x: number; y: number; z: number }, strikes: (p: { x: number; y: number; z: number }, margin?: number) => boolean): void {
    this.gunTick -= dt;
    for (const zone of this.fire) {
      const [x0, z0, x1, z1] = zone.desc.area;
      if (at.z < z0 - 30 || at.z > z1 + 30) continue;
      if (this.gunTick <= 0) this.sounds.push({ kind: 'gun', x: this.random() < 0.5 ? x0 : x1, z: at.z + (this.random() - 0.5) * 30 });
      zone.due += zone.desc.rate * dt;
      while (zone.due >= 1) {
        zone.due--;
        const fromLow = this.random() < 0.5;
        const slant = (this.random() - 0.5) * 0.7;
        const dir = new Vector3((fromLow ? 1 : -1) * Math.cos(slant), 0, Math.sin(slant));
        const pos = new Vector3(fromLow ? x0 : x1, 0.8 + this.random() * 1.1, Math.max(z0, Math.min(z1, at.z + (this.random() - 0.5) * 70)));
        const reach = (x1 - x0) / Math.cos(slant);
        const hit = this.world.castRay(new RAPIER.Ray(pos, dir), reach, true, undefined, STATIC);
        this.rounds.push({ pos, dir, left: hit ? hit.timeOfImpact : reach });
      }
    }
    if (this.gunTick <= 0) this.gunTick = GUN_TICK;
    const step = ROUND_SPEED * dt;
    for (let i = this.rounds.length - 1; i >= 0; i--) {
      const round = this.rounds[i];
      let hit = false;
      // In three, so that it cannot step clean over the truck.
      for (const part of [1 / 3, 2 / 3, 1]) hit ||= strikes(w.copy(round.pos).addScaledVector(round.dir, step * part));
      if (hit) this.hits++;
      round.pos.addScaledVector(round.dir, step);
      if (hit || (round.left -= step) <= 0) this.rounds.splice(i, 1);
    }
  }

  /** One of an army's soldiers has been run down here: its tanks that are near take notice. */
  rouse(army: number, x: number, z: number): void {
    for (const tank of this.tanks) {
      if (tank.desc.side !== army || tank.hostile || Math.hypot(tank.desc.pos[0] - x, tank.desc.pos[1] - z) > ROUSE_REACH) continue;
      tank.hostile = true;
      tank.lost = 0;
      tank.lock = 0;
      tank.cooldown = Math.max(tank.cooldown, 1);
    }
  }

  /**
   * Rocket launchers: lock on while the truck is in sight, the aim on the middle of it until
   * the moment of firing. The rocket is slow, and flies on down that line, turning after the
   * truck only a very little, until it runs into something: a truck that moves is missed,
   * though perhaps not by enough to be out of the blast of whatever it hits instead. Cover
   * breaks the lock.
   */
  private launch(dt: number, at: { x: number; y: number; z: number }): void {
    // One at a time: while a rocket is in the air, or another launcher is locking, the rest wait.
    let busy = this.projectiles.some((p) => p.kind === 'rocket');
    for (const launcher of this.launchers) {
      const [x, y, z] = launcher.desc.pos;
      launcher.cooldown -= dt;
      const dx = at.x - x;
      const dz = at.z - z;
      const away = Math.hypot(dx, dz);
      launcher.sees = away < launcher.desc.range && away > 4 && this.clear(x, y + EYE, z, at.x, at.y + 0.3, at.z);
      if (launcher.sees) {
        launcher.aim.set(at.x, at.y, at.z);
        launcher.yaw = Math.atan2(dx, dz);
      }
      if (!launcher.sees || launcher.cooldown > 0 || this.respite > 0 || busy) {
        launcher.lock = Math.max(0, launcher.lock - dt * 1.5);
        continue;
      }
      busy = true;
      launcher.lock += dt / LOCK_SECONDS;
      if (!this.threat || (this.threat.kind === 'rocket' && launcher.lock > this.threat.lock)) this.threat = { kind: 'rocket', lock: Math.min(1, launcher.lock) };
      if (launcher.lock < 1) continue;
      launcher.lock = 0;
      launcher.cooldown = ROCKET_REST;
      // Level, at where the truck is now, and on past there until it meets something.
      const dir = new Vector3(dx, 0, dz).normalize();
      this.projectiles.push({ kind: 'rocket', pos: new Vector3(x + dir.x * 0.8, y + EYE - 0.3, z + dir.z * 0.8), dir, speed: ROCKET_SPEED, left: launcher.desc.range + 60 });
      this.sounds.push({ kind: 'launch', x, z });
    }
  }

  /**
   * Tanks: left alone, they shell the other army, far off, down a line that can be seen: a
   * truck that is crossing it when one fires is hit like anything else. Roused, a tank turns
   * its gun on the truck, slowly. For the last half second the gun stays where it is, and
   * then it fires down that line. Out of its reach for a couple of seconds, it gives up and
   * goes back to the war.
   */
  private hunt(dt: number, at: { x: number; y: number; z: number }): void {
    for (const tank of this.tanks) {
      const [x, z] = tank.desc.pos;
      tank.cooldown -= dt;
      const dx = at.x - x;
      const dz = at.z - z;
      const away = Math.hypot(dx, dz);
      if (!tank.hostile) {
        const rest = tank.desc.gun ?? tank.desc.rotY;
        const off = turn(tank.yaw, rest);
        tank.yaw += Math.max(-TANK_TURN * dt, Math.min(TANK_TURN * dt, off));
        tank.lock = 0;
        tank.held = false;
        // Only where there is someone to see it. Always at the same interval, and the line swells as the shot comes: it can be timed.
        const ready = away < 110 && Math.abs(off) < 0.05;
        if (ready) tank.idle -= dt;
        tank.charge = ready ? Math.max(0, Math.min(1, 1 - tank.idle / IDLE_WARNING)) : 0;
        if (!ready || tank.idle > 0) continue;
        tank.idle = IDLE_EVERY;
        tank.charge = 0;
        const dir = new Vector3(Math.sin(tank.yaw), 0, Math.cos(tank.yaw));
        this.projectiles.push({ kind: 'shell', pos: new Vector3(x + dir.x * 4.4, MUZZLE, z + dir.z * 4.4), dir, speed: SHELL_SPEED, left: 140 });
        this.sounds.push({ kind: 'cannon', x, z, far: true });
        continue;
      }
      tank.lost = away > TANK_REACH ? tank.lost + dt : 0;
      if (tank.lost > TANK_FORGET && !tank.held) {
        tank.hostile = false;
        continue;
      }
      let laid = true;
      let off = 0;
      if (!tank.held) {
        tank.aim.set(at.x, at.y + 0.2, at.z);
        off = turn(tank.yaw, Math.atan2(dx, dz));
        tank.yaw += Math.max(-TANK_TURN * dt, Math.min(TANK_TURN * dt, off));
        laid = Math.abs(off) < 0.06 && away <= TANK_REACH && this.respite <= 0 && tank.cooldown <= 0;
      }
      tank.lock = laid ? Math.min(1, tank.lock + dt / TANK_LOCK_SECONDS) : Math.max(0, tank.lock - dt);
      tank.held = laid && tank.lock >= 1 - AIM_HOLD / TANK_LOCK_SECONDS;
      tank.charge = tank.held ? 1 : 0;
      // How near it is to firing: mostly how far the gun still has to come round.
      const nearness = laid ? 0.6 + tank.lock * 0.4 : Math.max(0, 0.6 * (1 - Math.abs(off) / Math.PI));
      if (!this.threat || this.threat.kind === 'rocket' || nearness > this.threat.lock) this.threat = { kind: 'tank', lock: nearness };
      if (tank.lock < 1) continue;
      tank.lock = 0;
      tank.held = false;
      tank.cooldown = TANK_REST;
      // From the muzzle, down the line the gun settled on.
      const from = new Vector3(x + Math.sin(tank.yaw) * 4.4, MUZZLE, z + Math.cos(tank.yaw) * 4.4);
      const dir = new Vector3().subVectors(tank.aim, from);
      const far = dir.length();
      dir.multiplyScalar(1 / far);
      this.projectiles.push({ kind: 'shell', pos: from, dir, speed: SHELL_SPEED, left: far + 1 });
      this.sounds.push({ kind: 'cannon', x, z });
    }
  }

  /** Whatever has been fired flies on in a straight line until it meets the truck, something solid, the ground, or the end of its reach. */
  private fly(dt: number, at: { x: number; z: number }, strikes: (p: { x: number; y: number; z: number }, margin?: number) => boolean): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const step = p.speed * dt;
      const tank = p.kind === 'shell';
      if (!tank) {
        // A rocket comes round after the truck, but only a very little: not enough to catch one that has got out of the way.
        const flat = Math.hypot(p.dir.x, p.dir.z);
        const yaw = Math.atan2(p.dir.x, p.dir.z);
        const round = yaw + Math.max(-ROCKET_TURN * dt, Math.min(ROCKET_TURN * dt, turn(yaw, Math.atan2(at.x - p.pos.x, at.z - p.pos.z))));
        p.dir.set(Math.sin(round) * flat, p.dir.y, Math.cos(round) * flat);
      }
      let burst: Burst | null = null;
      // In two halves, so that it cannot step clean over the truck.
      for (const part of [0.5, 1]) {
        w.copy(p.pos).addScaledVector(p.dir, step * part);
        if (strikes(w)) burst = { x: w.x, y: w.y, z: w.z, kind: tank ? 'tank' : 'rocket', power: tank ? 1.3 : 1, direct: true };
        if (burst) this.respite = RESPITE;
        if (burst) break;
      }
      if (!burst) {
        const hit = this.world.castRay(new RAPIER.Ray(p.pos, p.dir), step, true, undefined, STATIC);
        const stop = hit ? hit.timeOfImpact : p.pos.y + p.dir.y * step < 0.1 ? step : p.left < step ? p.left : -1;
        if (stop >= 0) {
          w.copy(p.pos).addScaledVector(p.dir, Math.max(0, stop - 0.3));
          burst = { x: w.x, y: Math.max(0.3, w.y), z: w.z, kind: tank ? 'tank' : 'rocket', power: 1, direct: false };
        }
      }
      if (burst) {
        this.bursts.push(burst);
        this.projectiles.splice(i, 1);
        continue;
      }
      p.pos.addScaledVector(p.dir, step);
      p.left -= step;
    }
  }

  /** Whether there is nothing solid between two points. */
  private clear(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
    v.set(x1 - x0, y1 - y0, z1 - z0);
    const length = v.length();
    v.multiplyScalar(1 / length);
    const hit = this.world.castRay(new RAPIER.Ray({ x: x0, y: y0, z: z0 }, v), length - 2, true, undefined, STATIC);
    return hit === null;
  }

  /** Seeded, so headless runs repeat exactly. */
  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}
