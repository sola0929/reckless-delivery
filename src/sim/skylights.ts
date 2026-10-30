import RAPIER from '@dimforge/rapier3d-compat';
import { Euler, Quaternion, Vector3 } from 'three';
import { GROUP, PHYSICS, groups } from '../config';
import type { RoofSkylight, Slab } from '../levels/types';

/** Bits of a broken skylight's sheet, so many: shared by them all, only the one the truck is on being broken at a time. */
const SHARDS = 12;
/** How long after one breaks what went through it is still falling, seconds. */
const FALLING_SECONDS = 3;
/** Where shards wait unseen. */
const WAITING_Y = -400;

export interface Pane {
  slab: Slab;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  /** Which end of its local X is the ridge, where its upper edge is the other pane's and not steel; 0 if neither. */
  ridgeEnd: -1 | 0 | 1;
}

export interface Skylight {
  desc: RoofSkylight;
  panes: Pane[];
  /** Broken through. */
  broken: boolean;
}

export interface Shard {
  body: RAPIER.RigidBody;
  half: [number, number, number];
}

const SOLID = groups(GROUP.ground, GROUP.all);
// Falling in, its bits fall onto the market and whatever is there, but do not get in the truck's way.
const FALLING = groups(GROUP.prop, GROUP.ground | GROUP.prop);

/**
 * The skylights in roofs that can be fallen through: solid as the roof round them until a wheel is wholly on one's sheet.
 * Then the sheet is broken and gone, all its panes, and what was on it goes through.
 */
export class Skylights {
  readonly lights: Skylight[] = [];
  readonly shards: Shard[] = [];
  /** Since the last call: where one broke. */
  breaks: { x: number; y: number; z: number }[] = [];
  /** Seconds since one last broke. */
  private since = Infinity;
  private readonly panes = new Map<number, { light: Skylight; pane: Pane }>();
  private readonly at = new Vector3();
  private readonly turn = new Quaternion();
  private seed = 17;

  constructor(world: RAPIER.World, descs: readonly RoofSkylight[]) {
    const q = new Quaternion(), e = new Euler();
    for (const desc of descs) {
      const light: Skylight = { desc, panes: [], broken: false };
      for (const { slab, ridge } of desc.panes) {
        q.setFromEuler(e.set(...slab.rot));
        // Without a mass, as the roof round it: see the props' in Sim.
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...slab.pos).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
        const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(...slab.size).setDensity(0).setFriction(0.8).setCollisionGroups(SOLID), body);
        // The ridge is the higher end: where its local X rises.
        const pane: Pane = { slab, body, collider, ridgeEnd: ridge ? (Math.sin(slab.rot[2]) > 0 ? 1 : -1) : 0 };
        light.panes.push(pane);
        this.panes.set(collider.handle, { light, pane });
      }
      this.lights.push(light);
    }
    if (!descs.length) return;
    for (let n = 0; n < SHARDS; n++) {
      const half: [number, number, number] = [0.22 + (n % 3) * 0.08, 0.006, 0.18 + (n % 4) * 0.07];
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, WAITING_Y - n * 2, 0));
      world.createCollider(RAPIER.ColliderDesc.cuboid(...half).setMass(1.5).setFriction(0.6).setCollisionGroups(FALLING), body);
      body.setEnabled(false);
      this.shards.push({ body, half });
    }
  }

  private random(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  /** Call once per physics step, after the world has stepped: whether a wheel is wholly on a skylight's sheet. */
  update(wheels: RAPIER.DynamicRayCastVehicleController): void {
    this.breaks = [];
    if (!this.lights.length) return;
    this.since += PHYSICS.dt;
    for (let i = 0; i < wheels.numWheels(); i++) {
      const ground = wheels.wheelGroundObject(i);
      const on = ground && this.panes.get(ground.handle);
      if (!on || on.light.broken) continue;
      const contact = wheels.wheelContactPoint(i);
      if (!contact) continue;
      // Where on its sheet, in its own terms: a tyre over an edge that laps the steel is on the steel; over the ridge, on
      // the other pane.
      const { pane } = on, r = pane.body.rotation(), p = pane.body.translation();
      this.at.set(contact.x - p.x, contact.y - p.y, contact.z - p.z).applyQuaternion(this.turn.set(r.x, r.y, r.z, r.w).invert());
      const [a, , c] = pane.slab.size, edge = on.light.desc.edge;
      const inX = pane.ridgeEnd === 0 ? Math.abs(this.at.x) < a - edge : pane.ridgeEnd * this.at.x > -(a - edge);
      if (inX && Math.abs(this.at.z) < c - edge) this.breakThrough(on.light, pane);
    }
  }

  private breakThrough(light: Skylight, under: Pane): void {
    light.broken = true;
    this.since = 0;
    for (const pane of light.panes) pane.collider.setEnabled(false);
    // The sheet in bits, falling in, about where the wheel went through.
    const { pos, size, rot } = under.slab;
    const q = new Quaternion().setFromEuler(new Euler(...rot));
    for (const shard of this.shards) {
      const local = new Vector3((this.random() - 0.5) * 2 * size[0] * 0.9, size[1] + 0.05, (this.random() - 0.5) * 2 * Math.min(size[2], 3) * 0.9).applyQuaternion(q);
      shard.body.setEnabled(true);
      shard.body.setTranslation({ x: pos[0] + local.x, y: pos[1] + local.y, z: pos[2] + local.z }, true);
      shard.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      shard.body.setLinvel({ x: (this.random() - 0.5) * 1.5, y: -1 - this.random() * 2, z: (this.random() - 0.5) * 1.5 }, true);
      shard.body.setAngvel({ x: (this.random() - 0.5) * 8, y: (this.random() - 0.5) * 8, z: (this.random() - 0.5) * 8 }, true);
    }
    this.breaks.push({ x: pos[0], y: pos[1], z: pos[2] });
  }

  /** Whether a skylight broken through is under a place, across the ground. */
  brokenUnder(x: number, z: number): boolean {
    return this.lights.some((light) => light.broken && light.panes.some(({ slab: { pos, size, rot } }) => Math.abs(x - pos[0]) < size[0] * Math.cos(rot[2]) && Math.abs(z - pos[2]) < size[2]));
  }

  /** Whether what went through one may still be coming down. */
  get falling(): boolean {
    return this.since < FALLING_SECONDS;
  }

  /** Every skylight whole again. */
  reset(): void {
    this.breaks = [];
    this.since = Infinity;
    for (const light of this.lights) {
      if (!light.broken) continue;
      light.broken = false;
      for (const pane of light.panes) pane.collider.setEnabled(true);
    }
    this.shards.forEach((shard, n) => {
      shard.body.setTranslation({ x: 0, y: WAITING_Y - n * 2, z: 0 }, false);
      shard.body.setEnabled(false);
    });
  }
}
