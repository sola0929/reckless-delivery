import RAPIER from '@dimforge/rapier3d-compat';
import { Euler, Quaternion } from 'three';
import { GROUP, groups } from '../config';
import type { MachineDesc } from '../levels/types';

// The big machines of a quarry, going about it as if nobody else were there: a dump truck and a wheel loader that drive
// off anywhere in the yard, stop, back up, turn on the spot and set off again somewhere else; an excavator that crawls
// a little now and then and swings its house and its arm round, this way and that, without looking. They are
// kinematic: they go where they mean to go, over the gravel heaps and all, and whatever is in their way, the truck
// included, is pushed aside.

/** Half their size each way, how fast they go, m/s, and how fast they turn, radians a second. */
const SPECS = {
  dumper: { half: { width: 1.45, height: 1.6, length: 4.3 }, speed: 5, turn: 0.55 },
  loader: { half: { width: 1.3, height: 1.5, length: 3.6 }, speed: 4, turn: 0.85 },
  excavator: { half: { width: 1.6, height: 1.0, length: 2.3 }, speed: 1.1, turn: 0.4 },
} as const;
/** How far ahead of one machine another must be for it to give way, and how fast it may push the truck along. */
const KEEP_CLEAR = 9;
const PUSHING = 2;

export interface Machine {
  desc: MachineDesc;
  body: RAPIER.RigidBody;
  /** The excavator's house, boom and arm, which turn on its tracks. */
  upper: RAPIER.RigidBody | null;
  x: number;
  z: number;
  /** Which way it faces: radians about Y, 0 = toward +Z. */
  yaw: number;
  speed: number;
  /** Where it is going, and whether it goes there backwards; how long it stands first. */
  target: { x: number; z: number };
  backing: boolean;
  wait: number;
  /** The excavator's house: which way it faces, how fast it is swinging, and for how long more. */
  swing: number;
  swingSpeed: number;
  swingFor: number;
}

export class Machines {
  readonly list: Machine[] = [];
  private seed = 23;
  private readonly euler = new Euler(0, 0, 0, 'YXZ');
  private readonly quat = new Quaternion();

  constructor(world: RAPIER.World, descs: readonly MachineDesc[], private readonly ground: (x: number, z: number) => number) {
    const solid = groups(GROUP.prop, GROUP.all);
    for (const desc of descs) {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
      const box = (on: RAPIER.RigidBody, hx: number, hy: number, hz: number, x: number, y: number, z: number, rotX = 0) => {
        const shape = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(0.6).setCollisionGroups(solid);
        if (rotX) {
          this.quat.setFromEuler(this.euler.set(rotX, 0, 0));
          shape.setRotation({ x: this.quat.x, y: this.quat.y, z: this.quat.z, w: this.quat.w });
        }
        world.createCollider(shape, on);
      };
      let upper: RAPIER.RigidBody | null = null;
      if (desc.kind === 'dumper') {
        box(body, 1.35, 0.55, 4.0, 0, 1.25, 0);
        box(body, 1.45, 0.85, 2.5, 0, 2.65, -1.4);
        box(body, 1.15, 0.8, 1.0, 0, 2.6, 2.9);
      } else if (desc.kind === 'loader') {
        box(body, 1.2, 0.6, 2.4, 0, 1.15, -0.4);
        box(body, 0.9, 0.85, 0.9, 0, 2.6, -0.8);
        box(body, 1.55, 0.5, 0.45, 0, 0.85, 3.1);
      } else {
        box(body, 1.6, 0.5, 2.3, 0, 0.5, 0);
        upper = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
        box(upper, 1.4, 0.75, 1.7, 0, 1.75, -0.4);
        // The boom up and out, the arm down from its end, the bucket at the bottom: what sweeps round.
        box(upper, 0.28, 0.28, 2.4, 0.5, 3.0, 2.6, -0.45);
        box(upper, 0.24, 0.24, 1.5, 0.5, 2.6, 5.4, 0.9);
        box(upper, 0.65, 0.45, 0.45, 0.5, 1.2, 6.2);
      }
      const machine: Machine = { desc, body, upper, x: 0, z: 0, yaw: 0, speed: 0, target: { x: 0, z: 0 }, backing: false, wait: 0, swing: 0, swingSpeed: 0, swingFor: 0 };
      this.list.push(machine);
    }
    this.reset();
  }

  /** Call once per physics step, before the world steps. */
  update(dt: number, truck: { x: number; z: number }): void {
    for (const m of this.list) {
      if (m.desc.parked) continue;
      const spec = SPECS[m.desc.kind];
      // The house swings round, faster or slower, one way or the other, now and then stopping.
      if (m.upper && (m.swingFor -= dt) <= 0) {
        m.swingFor = 1.5 + this.random() * 3;
        m.swingSpeed = this.random() < 0.2 ? 0 : (this.random() < 0.5 ? -1 : 1) * (0.5 + this.random() * 0.8);
      }
      m.swing += m.swingSpeed * dt;

      if (m.wait > 0) {
        m.wait -= dt;
        m.speed = 0;
      } else {
        const dx = m.target.x - m.x;
        const dz = m.target.z - m.z;
        const left = Math.hypot(dx, dz);
        if (left < 2.5) this.pick(m);
        else {
          // Facing where it is going, or away from it when it backs there.
          const want = Math.atan2(dx, dz) + (m.backing ? Math.PI : 0);
          const off = Math.atan2(Math.sin(want - m.yaw), Math.cos(want - m.yaw));
          m.yaw += Math.max(-spec.turn * dt, Math.min(spec.turn * dt, off));
          let cruise = Math.abs(off) > 0.9 ? 1.2 : spec.speed * (m.backing ? 0.5 : 1);
          // Another machine across its way: it stops, and goes somewhere else.
          const fx = Math.sin(m.yaw) * (m.backing ? -1 : 1);
          const fz = Math.cos(m.yaw) * (m.backing ? -1 : 1);
          const blocked = this.list.some((o) => o !== m && (o.x - m.x) * fx + (o.z - m.z) * fz > 0 && Math.hypot(o.x - m.x, o.z - m.z) < KEEP_CLEAR);
          if (blocked) {
            this.pick(m);
            cruise = 0;
          }
          // The truck right in front: it shoves it along, but not at full tilt.
          const ahead = (truck.x - m.x) * fx + (truck.z - m.z) * fz;
          if (ahead > 0 && ahead < spec.half.length + 5 && Math.abs((truck.x - m.x) * fz - (truck.z - m.z) * fx) < spec.half.width + 2) cruise = Math.min(cruise, PUSHING);
          m.speed += Math.max(-3 * dt, Math.min(1.5 * dt, cruise - m.speed));
          m.x += fx * m.speed * dt;
          m.z += fz * m.speed * dt;
        }
      }
      this.place(m, false);
    }
  }

  /** Somewhere else to go in its yard: forward mostly, sometimes back up a little first; and sometimes a stand before it goes. */
  private pick(m: Machine): void {
    const [x0, z0, x1, z1] = m.desc.area;
    m.backing = this.random() < 0.3;
    const reach = m.backing ? 6 + this.random() * 8 : 1e9;
    for (let tries = 0; tries < 8; tries++) {
      const x = x0 + this.random() * (x1 - x0);
      const z = z0 + this.random() * (z1 - z0);
      if (Math.hypot(x - m.x, z - m.z) < reach && Math.hypot(x - m.x, z - m.z) > 6) {
        m.target = { x, z };
        break;
      }
    }
    if (this.random() < 0.35) m.wait = 0.8 + this.random() * 2.5;
  }

  /** Put a machine where it is, on the ground: following the lie of it under its four corners. */
  private place(m: Machine, now: boolean): void {
    const spec = SPECS[m.desc.kind];
    const { width, length } = spec.half;
    const sx = Math.sin(m.yaw), cz = Math.cos(m.yaw);
    const h = (along: number, across: number) => this.ground(m.x + sx * along + cz * across, m.z + cz * along - sx * across);
    const front = (h(length * 0.8, -width * 0.8) + h(length * 0.8, width * 0.8)) / 2;
    const back = (h(-length * 0.8, -width * 0.8) + h(-length * 0.8, width * 0.8)) / 2;
    const right = (h(length * 0.8, width * 0.8) + h(-length * 0.8, width * 0.8)) / 2;
    const left = (h(length * 0.8, -width * 0.8) + h(-length * 0.8, -width * 0.8)) / 2;
    const y = Math.max((front + back) / 2, this.ground(m.x, m.z));
    const pitch = -Math.atan2(front - back, length * 1.6);
    const roll = Math.atan2(right - left, width * 1.6);
    this.quat.setFromEuler(this.euler.set(pitch, m.yaw, roll));
    const at = { x: m.x, y, z: m.z };
    const rot = { x: this.quat.x, y: this.quat.y, z: this.quat.z, w: this.quat.w };
    if (now) {
      m.body.setTranslation(at, true);
      m.body.setRotation(rot, true);
    } else {
      m.body.setNextKinematicTranslation(at);
      m.body.setNextKinematicRotation(rot);
    }
    if (m.upper) {
      this.quat.setFromEuler(this.euler.set(pitch, m.yaw + m.swing, roll));
      const turned = { x: this.quat.x, y: this.quat.y, z: this.quat.z, w: this.quat.w };
      if (now) {
        m.upper.setTranslation(at, true);
        m.upper.setRotation(turned, true);
      } else {
        m.upper.setNextKinematicTranslation(at);
        m.upper.setNextKinematicRotation(turned);
      }
    }
  }

  reset(): void {
    this.seed = 23;
    for (const m of this.list) {
      [m.x, m.z] = m.desc.pos;
      m.yaw = m.desc.yaw;
      m.speed = 0;
      m.wait = 0;
      m.swing = 0;
      m.swingSpeed = 0;
      m.swingFor = 0;
      m.target = { x: m.x, z: m.z };
      this.pick(m);
      this.place(m, true);
    }
  }

  /** Seeded, so headless runs repeat exactly. */
  private random(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}
