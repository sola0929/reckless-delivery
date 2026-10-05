import * as THREE from 'three';
import type { Machine } from '../sim/machines';
import { Shapes } from './shapes';

// The quarry's machines, in their yellow, each drawn where the physics has it, part of the way between its last two places.

const YELLOW = 0xf2b51e;
const DEEP = 0xc98d12;
const DARK = 0x2a2e34;
const GLASS = 0x1b2a3a;
const TYRE = 0x17181a;
const HUB = 0x9aa0a6;
const STEEL = 0x8c9096;

const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15 });

/** A dump truck: a cab at the front, the tipping body behind, six big wheels. */
function dumper(s: Shapes): void {
  for (const x of [-1.3, 1.3]) for (const z of [2.8, -0.8, -3.0]) s.wheel(x, 0.85, z, 0.85, 0.35, TYRE, HUB);
  s.box(0, 1.25, 0, 1.2, 0.35, 4.0, DARK);
  s.box(0, 2.6, 2.9, 1.15, 0.8, 1.0, YELLOW);
  s.box(0, 2.9, 3.91, 1.0, 0.4, 0.02, GLASS);
  for (const x of [-1.16, 1.16]) s.box(x, 2.9, 3.0, 0.02, 0.35, 0.6, GLASS);
  s.box(0, 2.65, -1.4, 1.45, 0.85, 2.5, DEEP);
  s.box(0, 3.25, -1.4, 1.3, 0.28, 2.35, 0x8a7d6a);
  s.box(0, 3.6, 1.0, 1.45, 0.08, 0.5, DEEP);
  s.box(0, 3.55, 2.9, 0.15, 0.08, 0.15, 0xffb030);
}

/** A wheel loader: the bucket out in front on its arms, the engine behind, the cab between. */
function loader(s: Shapes): void {
  for (const x of [-1.15, 1.15]) for (const z of [1.5, -2.0]) s.wheel(x, 0.75, z, 0.75, 0.32, TYRE, HUB);
  s.box(0, 1.15, -0.4, 1.0, 0.45, 2.4, YELLOW);
  s.box(0, 2.6, -0.8, 0.9, 0.85, 0.9, YELLOW);
  s.box(0, 2.8, 0.11, 0.8, 0.5, 0.02, GLASS);
  for (const x of [-0.91, 0.91]) s.box(x, 2.8, -0.8, 0.02, 0.5, 0.7, GLASS);
  s.box(0, 1.5, -2.6, 1.0, 0.5, 0.4, DEEP);
  for (const x of [-0.8, 0.8]) s.box(x, 1.25, 2.1, 0.12, 0.15, 1.1, DEEP);
  s.box(0, 0.85, 3.1, 1.55, 0.5, 0.45, STEEL);
  s.box(0, 1.3, 2.75, 1.55, 0.06, 0.12, DARK);
  s.box(0, 3.5, -0.8, 0.15, 0.08, 0.15, 0xffb030);
}

/** An excavator's tracks. */
function tracks(s: Shapes): void {
  for (const x of [-1.15, 1.15]) {
    s.box(x, 0.5, 0, 0.45, 0.5, 2.3, DARK);
    for (const z of [-1.6, 0, 1.6]) s.box(x, 0.5, z, 0.47, 0.25, 0.25, 0x4a4f55);
  }
  s.box(0, 0.75, 0, 0.8, 0.25, 1.2, 0x4a4f55);
}

/** An excavator's house, with its cab, its counterweight, and the boom, arm and bucket out in front, stepped as they rise and fall. */
function house(s: Shapes): void {
  s.box(0, 1.75, -0.4, 1.4, 0.75, 1.7, YELLOW);
  s.box(0, 1.6, -2.0, 1.4, 0.55, 0.3, DARK);
  s.box(-0.75, 2.85, 0.6, 0.6, 0.35, 0.6, YELLOW);
  s.box(-0.75, 2.9, 1.21, 0.5, 0.25, 0.02, GLASS);
  // The boom, rising out to its elbow at about five metres; the arm, coming down to the bucket.
  for (let k = 0; k < 6; k++) s.box(0.5, 2.3 + k * 0.28, 0.6 + k * 0.85, 0.28, 0.28, 0.45, YELLOW);
  for (let k = 0; k < 4; k++) s.box(0.5, 3.6 - k * 0.6, 5.1 + k * 0.3, 0.24, 0.32, 0.24, DEEP);
  s.box(0.5, 1.2, 6.2, 0.65, 0.45, 0.45, STEEL);
  s.box(-0.75, 3.3, 0.6, 0.12, 0.06, 0.12, 0xffb030);
}

export class MachinesView {
  private readonly meshes: { body: THREE.Mesh; upper: THREE.Mesh | null }[] = [];
  private readonly was: { pos: THREE.Vector3; rot: THREE.Quaternion; up: THREE.Quaternion }[];
  private readonly now: { pos: THREE.Vector3; rot: THREE.Quaternion; up: THREE.Quaternion }[];

  constructor(scene: THREE.Scene, private readonly machines: readonly Machine[]) {
    const mesh = (draw: (s: Shapes) => void) => {
      const shapes = new Shapes();
      draw(shapes);
      const m = new THREE.Mesh(shapes.geometry(), material);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    for (const machine of machines) {
      const kind = machine.desc.kind;
      this.meshes.push({ body: mesh(kind === 'dumper' ? dumper : kind === 'loader' ? loader : tracks), upper: kind === 'excavator' ? mesh(house) : null });
    }
    const pose = () => machines.map(() => ({ pos: new THREE.Vector3(), rot: new THREE.Quaternion(), up: new THREE.Quaternion() }));
    this.was = pose();
    this.now = pose();
    this.snap();
  }

  private read(i: number): void {
    const m = this.machines[i];
    const t = m.body.translation();
    const r = m.body.rotation();
    this.now[i].pos.set(t.x, t.y, t.z);
    this.now[i].rot.set(r.x, r.y, r.z, r.w);
    const u = (m.upper ?? m.body).rotation();
    this.now[i].up.set(u.x, u.y, u.z, u.w);
  }

  /** Call after every physics step. */
  capture(): void {
    this.machines.forEach((_, i) => {
      this.was[i].pos.copy(this.now[i].pos);
      this.was[i].rot.copy(this.now[i].rot);
      this.was[i].up.copy(this.now[i].up);
      this.read(i);
    });
  }

  snap(): void {
    this.machines.forEach((_, i) => {
      this.read(i);
      this.was[i].pos.copy(this.now[i].pos);
      this.was[i].rot.copy(this.now[i].rot);
      this.was[i].up.copy(this.now[i].up);
    });
    this.apply(1);
  }

  apply(alpha: number): void {
    this.meshes.forEach(({ body, upper }, i) => {
      body.position.lerpVectors(this.was[i].pos, this.now[i].pos, alpha);
      body.quaternion.slerpQuaternions(this.was[i].rot, this.now[i].rot, alpha);
      if (upper) {
        upper.position.copy(body.position);
        upper.quaternion.slerpQuaternions(this.was[i].up, this.now[i].up, alpha);
      }
    });
  }
}
