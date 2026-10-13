import * as THREE from 'three';
import type { BirdDesc } from '../levels/types';

/** How near the truck may come before a bird is up, metres; how far its horn carries to them. */
const SHY = 20;
const HORN = 45;
/** Those this near one that goes up go with it, a moment after. */
const FLOCK = 10;
/** Where one comes down again: at least this far from the truck, and not much further from where it rose than this. */
const SAFE = 32;
const RANGE = 110;
/** How fast it flies, m/s; how high it goes, at least and per metre it flies. */
const SPEED = 7;
const LIFT = 4;
const LIFT_PER = 0.07;
/** Wingbeats a second. */
const BEAT = 3.2;

interface Bird {
  root: THREE.Group;
  body: THREE.Group;
  wings: THREE.Object3D[];
  /** The place it stands at, or is flying to: an index into the places. */
  spot: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  /** How far through its flight, 0 to 1; -1 standing. */
  t: number;
  long: number;
  /** Seconds before it goes up, once something has put it up: -1 when nothing has. */
  going: number;
  /** Seconds before it will go up again, after coming down. */
  calm: number;
  flap: number;
}

/**
 * Egrets standing about the water. The truck coming near, or its horn, puts them up: each flies off, rising and falling
 * on an arc, wings beating then gliding, and comes down at one of the others' places that is clear and away from the
 * truck. Only for the look of it: they are not in the physics.
 */
export class Birds {
  private readonly birds: Bird[] = [];
  private readonly places: THREE.Vector3[];
  private readonly taken = new Set<number>();
  private heardHorn = -1;

  constructor(scene: THREE.Scene, descs: BirdDesc[]) {
    const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a3a30, flatShading: true });
    const beak = new THREE.MeshStandardMaterial({ color: 0xe0b030, flatShading: true });
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      return mesh;
    };
    this.places = descs.map((d) => new THREE.Vector3(...d.pos));
    descs.forEach((d, i) => {
      if (d.empty) return;
      const root = new THREE.Group();
      const body = new THREE.Group();
      body.position.y = 0.75;
      body.add(box(0.24, 0.28, 0.64, white, 0, 0, 0));
      body.add(box(0.08, 0.48, 0.08, white, 0, 0.27, 0.32));
      body.add(box(0.03, 0.03, 0.2, beak, 0, 0.5, 0.44));
      root.add(body);
      for (const x of [-0.04, 0.04]) root.add(box(0.03, 0.6, 0.03, dark, x, 0.3, 0));
      const wings: THREE.Object3D[] = [];
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.12, 0.08, 0);
        pivot.add(box(0.9, 0.03, 0.36, white, side * 0.45, 0, 0));
        pivot.visible = false;
        body.add(pivot);
        wings.push(pivot);
      }
      root.position.copy(this.places[i]);
      root.rotation.y = d.yaw;
      scene.add(root);
      this.taken.add(i);
      this.birds.push({ root, body, wings, spot: i, from: new THREE.Vector3(), to: new THREE.Vector3(), t: -1, long: 0, going: -1, calm: 0, flap: Math.random() });
    });
  }

  /** `honked` is when the truck last sounded its horn, by the run's clock; -1 if it has not. */
  update(dt: number, truck: THREE.Vector3, honked: number): void {
    const horn = honked >= 0 && honked !== this.heardHorn;
    if (horn) this.heardHorn = honked;
    for (const b of this.birds) {
      if (b.t >= 0) {
        this.fly(b, dt);
        continue;
      }
      b.calm = Math.max(0, b.calm - dt);
      const away = Math.hypot(b.root.position.x - truck.x, b.root.position.z - truck.z);
      if (b.going < 0 && b.calm <= 0 && (away < SHY || (horn && away < HORN))) this.startle(b, Math.random() * 0.25);
      if (b.going >= 0 && (b.going -= dt) <= 0) this.rise(b, truck);
    }
  }

  /** It is going: and, a moment after, those standing near it. */
  private startle(b: Bird, delay: number): void {
    b.going = delay;
    for (const o of this.birds) {
      if (o === b || o.t >= 0 || o.going >= 0 || o.calm > 0) continue;
      if (o.root.position.distanceTo(b.root.position) < FLOCK) o.going = delay + 0.15 + Math.random() * 0.5;
    }
  }

  private rise(b: Bird, truck: THREE.Vector3): void {
    b.going = -1;
    const here = b.root.position;
    // Somewhere clear, away from the truck, not too far: any of those.
    const choices = this.places
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => !this.taken.has(i) && Math.hypot(p.x - truck.x, p.z - truck.z) > SAFE && p.distanceTo(here) < RANGE && p.distanceTo(here) > 8);
    let spot = b.spot;
    const stay = !choices.length;
    if (choices.length) spot = choices[Math.floor(Math.random() * choices.length)].i;
    this.taken.delete(b.spot);
    this.taken.add(spot);
    b.spot = spot;
    b.from.copy(here);
    b.to.copy(this.places[spot]);
    b.long = Math.max(12, b.from.distanceTo(b.to));
    // Back where it was, nowhere else clear: a wide round out over the water first.
    if (stay) b.long = 40;
    b.t = 0;
    for (const w of b.wings) w.visible = true;
  }

  private fly(b: Bird, dt: number): void {
    b.t = Math.min(1, b.t + (dt * SPEED) / b.long);
    const t = b.t;
    const p = b.root.position;
    const was = p.clone();
    p.lerpVectors(b.from, b.to, t);
    // Round and back when it has nowhere else to go.
    if (b.from.distanceTo(b.to) < 1) {
      const a = t * Math.PI * 2;
      p.x += Math.sin(a) * 14;
      p.z += (1 - Math.cos(a)) * 8;
    }
    p.y += Math.sin(t * Math.PI) * (LIFT + b.long * LIFT_PER);
    const dx = p.x - was.x, dz = p.z - was.z;
    if (Math.hypot(dx, dz) > 1e-4) b.root.rotation.y = Math.atan2(dx, dz);
    // Leaning into the climb, level in the glide, legs trailing.
    b.body.rotation.x = t < 0.5 ? -0.25 : 0.1;
    b.flap += dt * BEAT;
    const gliding = t > 0.55 && t < 0.9;
    const beat = gliding ? 0.15 : Math.sin(b.flap * Math.PI * 2) * 0.8;
    b.wings[0].rotation.z = -beat;
    b.wings[1].rotation.z = beat;
    if (t >= 1) {
      b.t = -1;
      b.calm = 4;
      b.body.rotation.x = 0;
      for (const w of b.wings) w.visible = false;
    }
  }
}
