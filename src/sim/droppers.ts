import RAPIER from '@dimforge/rapier3d-compat';
import { GROUP, PHYSICS, groups } from '../config';
import type { DropperDesc } from '../levels/types';

// Rocks shaken off conveyors overhead, falling through the holes in the nets under them. Each hole drops a
// few now and then, after a moment's warning; a rock is a real body as it falls, so what it lands on feels
// the weight of it, and it breaks on the first thing it meets and is gone, leaving nothing in the road.

/** How many rocks may be falling at once, all the conveyors together. */
const POOL = 96;
/** Where they wait: out of the world. */
const WAITING_Y = -80;
/** How far from the truck, metres, the conveyors go on dropping things. */
const AWAKE_WITHIN = 120;
/** A rock has met something once its fall is this much slower or faster than falling freely, m/s, in a step. */
const MET = 1.2;
/** Seconds between the rocks of one fall. */
const SPREAD = 0.22;
/** Steps a rock holds together after it hits something, pressing on into it, before it breaks: what it lands in is crushed. */
const HOLD = 12;
/** Seconds between puffs of grit from a hole while it is about to go. */
const TRICKLE = 0.12;

export interface Rock {
  body: RAPIER.RigidBody;
  /** Half its size each way. */
  half: [number, number, number];
  falling: boolean;
  /** Its downward speed last step, to tell when it has hit something. */
  vy: number;
  /** Steps left before it breaks, from the step it hits something (0 while it has hit nothing), so that what it hit feels it. */
  hit: number;
  /** How fast it was falling when it hit, m/s. */
  impact: number;
}

export interface Hole {
  at: [number, number, number];
  /** Its warning lamps, from it. */
  lamps: readonly [number, number, number][];
  every: [number, number];
  burst: [number, number];
  tell: number;
  /** Seconds between its falls: the same each time, so that its beat can be learnt by watching. */
  period: number;
  /** Seconds to the next fall; whether its warning has begun, and to the next puff of grit; rocks still to come in this fall, and when. */
  next: number;
  warned: boolean;
  puff: number;
  left: number;
  gap: number;
  /** For its warning lamps: 'warn' from the first grit until it lets go, 'fall' until its last rock is down. */
  light: 'off' | 'warn' | 'fall';
  /** Seconds the 'fall' light has left. */
  lit: number;
}

export class Droppers {
  readonly rocks: Rock[] = [];
  readonly holes: Hole[] = [];
  private seed = 31;
  /** Since the last call: grit trickling from holes about to drop (`first` when the belt has just begun to judder), and rocks breaking, with how heavy they were. */
  tells: { x: number; y: number; z: number; first: boolean }[] = [];
  breaks: { x: number; y: number; z: number; size: number; mass: number; impact: number }[] = [];
  private turn = 0;

  constructor(private readonly world: RAPIER.World, descs: readonly DropperDesc[]) {
    for (const desc of descs) for (const at of desc.spots) this.holes.push({ at, lamps: desc.lamps ?? [], every: desc.every, burst: desc.burst, tell: desc.tell, period: 0, next: 0, warned: false, puff: 0, left: 0, gap: 0, light: 'off', lit: 0 });
    if (!this.holes.length) return;
    for (let n = 0; n < POOL; n++) {
      // Lumps of rock of a few sizes: a basin to half an oil drum.
      const half: [number, number, number] = [0.32 + (n % 4) * 0.06, 0.26 + (n % 3) * 0.05, 0.32 + ((n + 1) % 4) * 0.05];
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, WAITING_Y - n * 2, 0).setCcdEnabled(false));
      const density = 2600;
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(...half).setMass(density * 8 * half[0] * half[1] * half[2]).setFriction(0.7).setRestitution(0.1).setCollisionGroups(groups(GROUP.prop, GROUP.all)),
        body,
      );
      body.setEnabled(false);
      this.rocks.push({ body, half, falling: false, vy: 0, hit: 0, impact: 0 });
    }
    this.reset();
  }

  private random(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  /** Call once per physics step, after the world has stepped. */
  update(dt: number, truck: { x: number; z: number }): void {
    this.tells = [];
    this.breaks = [];
    // Those that hit something a few steps ago break now; those that hit something this step are marked.
    for (const rock of this.rocks) {
      if (!rock.falling) continue;
      const p = rock.body.translation();
      if ((rock.hit > 0 && --rock.hit === 0) || p.y < WAITING_Y / 2) {
        if (p.y >= WAITING_Y / 2) this.breaks.push({ x: p.x, y: p.y, z: p.z, size: rock.half[0] + rock.half[1] + rock.half[2], mass: rock.body.mass(), impact: rock.impact });
        this.stow(rock);
        continue;
      }
      const vy = rock.body.linvel().y;
      // Falling freely, it gains g each second. Anything else is something in the way.
      if (rock.hit === 0 && Math.abs(vy - (rock.vy + PHYSICS.gravity * dt)) > MET) {
        rock.hit = HOLD;
        rock.impact = -rock.vy;
      }
      rock.vy = vy;
    }
    for (const hole of this.holes) {
      const [x, , z] = hole.at;
      if (Math.hypot(x - truck.x, z - truck.z) > AWAKE_WITHIN) continue;
      if (hole.light === 'fall' && hole.left === 0 && (hole.lit -= dt) <= 0) hole.light = 'off';
      if (hole.left > 0) {
        if ((hole.gap -= dt) <= 0) {
          this.drop(hole);
          hole.left--;
          hole.gap = SPREAD;
        }
        continue;
      }
      hole.next -= dt;
      // Before it goes, grit keeps trickling from it, all the time it is about to.
      if (hole.next <= hole.tell && (hole.puff -= dt) <= 0) {
        this.tells.push({ x, y: hole.at[1], z, first: !hole.warned });
        hole.warned = true;
        hole.light = 'warn';
        hole.puff = TRICKLE;
      }
      if (hole.next <= 0) {
        hole.left = hole.burst[1];
        hole.gap = 0;
        hole.light = 'fall';
        // Lit on until the last of them is down: as long as the fall itself, from that high.
        hole.lit = Math.sqrt((2 * hole.at[1]) / -PHYSICS.gravity) + 0.2;
        hole.warned = false;
        hole.puff = 0;
        hole.next = hole.period;
      }
    }
  }

  /** A rock off the belt, through the hole: the next free one, or the one that has been falling longest. */
  private drop(hole: Hole): void {
    let rock = this.rocks.find((r) => !r.falling);
    if (!rock) {
      rock = this.rocks[this.turn++ % this.rocks.length];
      this.stow(rock);
    }
    const [x, y, z] = hole.at;
    rock.body.setEnabled(true);
    rock.body.setTranslation({ x: x + (this.random() - 0.5) * 0.6, y: y - 0.6, z: z + (this.random() - 0.5) * 0.6 }, true);
    const a = this.random() * Math.PI;
    rock.body.setRotation({ x: Math.sin(a) * 0.3, y: Math.cos(a), z: 0.2, w: 0.9 }, true);
    rock.body.setLinvel({ x: 0, y: -0.5, z: 0 }, true);
    rock.body.setAngvel({ x: (this.random() - 0.5) * 4, y: 0, z: (this.random() - 0.5) * 4 }, true);
    rock.falling = true;
    rock.hit = 0;
    rock.vy = -0.5;
  }

  private stow(rock: Rock): void {
    rock.falling = false;
    rock.hit = 0;
    rock.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    rock.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    rock.body.setTranslation({ x: 0, y: WAITING_Y, z: 0 }, false);
    rock.body.setEnabled(false);
  }

  reset(): void {
    this.seed = 31;
    this.turn = 0;
    for (const rock of this.rocks) this.stow(rock);
    // Each hole its own beat, somewhere in it to begin with, so that they do not all go together.
    for (const hole of this.holes) {
      hole.period = hole.every[0] + this.random() * (hole.every[1] - hole.every[0]);
      hole.next = hole.tell + this.random() * hole.period;
      hole.warned = false;
      hole.puff = 0;
      hole.left = 0;
      hole.light = 'off';
      hole.lit = 0;
    }
  }
}
