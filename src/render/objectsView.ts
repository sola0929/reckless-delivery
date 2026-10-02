import * as THREE from 'three';
import type { LooseObject } from '../sim/objects';
import type { Pedestrian } from '../sim/pedestrians';

type Shape = 'box' | 'cylinder' | 'cone';

interface PartSlot {
  mesh: THREE.InstancedMesh;
  index: number;
  /** The part's place, turn and size within its object. */
  local: THREE.Matrix4;
}

interface Entry {
  object: LooseObject;
  slots: PartSlot[];
  /** Whether it was already drawn at rest, so needn't be touched again until it wakes. */
  settled: boolean;
}

const UNIT: Record<Shape, () => THREE.BufferGeometry> = {
  box: () => new THREE.BoxGeometry(2, 2, 2),
  cylinder: () => new THREE.CylinderGeometry(1, 1, 2, 12),
  cone: () => new THREE.ConeGeometry(1, 2, 10),
};

/**
 * Draws every loose object in the level. There are a couple of thousand, each of a few
 * parts, so the parts are drawn as three instanced meshes, one per shape, and only the
 * objects that are actually moving have their instances updated.
 */
export class ObjectsView {
  private readonly entries: Entry[] = [];
  private readonly meshes: THREE.InstancedMesh[] = [];
  private readonly body = new THREE.Matrix4();
  private readonly world = new THREE.Matrix4();
  private readonly pos = new THREE.Vector3();
  private readonly rot = new THREE.Quaternion();
  private readonly one = new THREE.Vector3(1, 1, 1);

  constructor(scene: THREE.Scene, objects: readonly LooseObject[]) {
    const counts: Record<Shape, number> = { box: 0, cylinder: 0, cone: 0 };
    for (const o of objects) for (const p of o.kind.parts) counts[p.shape]++;

    const byShape = {} as Record<Shape, THREE.InstancedMesh>;
    for (const shape of Object.keys(counts) as Shape[]) {
      if (!counts[shape]) continue;
      const mesh = new THREE.InstancedMesh(UNIT[shape](), new THREE.MeshStandardMaterial({ roughness: 0.8 }), counts[shape]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Spread across the whole map; the default bounds would cull them wrongly.
      mesh.frustumCulled = false;
      byShape[shape] = mesh;
      this.meshes.push(mesh);
      scene.add(mesh);
    }

    const next: Record<Shape, number> = { box: 0, cylinder: 0, cone: 0 };
    const euler = new THREE.Euler();
    const turn = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    for (const object of objects) {
      const slots = object.kind.parts.map((part) => {
        const mesh = byShape[part.shape];
        const index = next[part.shape]++;
        const [a, b, c] = part.size;
        scale.set(a, b, part.shape === 'box' ? c : a);
        const [rx, ry, rz] = part.rot ?? [0, 0, 0];
        const local = new THREE.Matrix4().compose(new THREE.Vector3(...part.pos), turn.setFromEuler(euler.set(rx, ry, rz)), scale);
        mesh.setColorAt(index, color.set(part.color));
        return { mesh, index, local };
      });
      this.entries.push({ object, slots, settled: false });
    }
    for (const mesh of this.meshes) mesh.instanceColor!.needsUpdate = true;
    this.update();
  }

  /** Redraw everything, e.g. after a reset has put it all back. */
  refresh(): void {
    for (const entry of this.entries) entry.settled = false;
    this.update();
  }

  update(): void {
    let changed = false;
    for (const entry of this.entries) {
      const asleep = entry.object.body.isSleeping();
      if (asleep && entry.settled) continue;
      entry.settled = asleep;
      changed = true;
      const t = entry.object.body.translation();
      const r = entry.object.body.rotation();
      this.body.compose(this.pos.set(t.x, t.y, t.z), this.rot.set(r.x, r.y, r.z, r.w), this.one);
      for (const slot of entry.slots) slot.mesh.setMatrixAt(slot.index, this.world.multiplyMatrices(this.body, slot.local));
    }
    if (changed) for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
  }
}

const SKIN = 0xe8c9a8;
const TROUSERS = 0x2f343c;

/** Draws the pedestrians: a body, a head and two legs each, as four instanced meshes. */
export class PedestriansView {
  private readonly bodies: THREE.InstancedMesh;
  private readonly heads: THREE.InstancedMesh;
  private readonly legs: THREE.InstancedMesh;
  private readonly strides: number[];
  private readonly base = new THREE.Matrix4();
  private readonly part = new THREE.Matrix4();
  private readonly out = new THREE.Matrix4();
  private readonly turn = new THREE.Quaternion();
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly one = new THREE.Vector3(1, 1, 1);

  constructor(scene: THREE.Scene, private readonly people: readonly Pedestrian[]) {
    const n = Math.max(1, people.length);
    const material = () => new THREE.MeshStandardMaterial({ roughness: 0.75 });
    this.bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 10), material(), n);
    this.heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 12, 10), material(), n);
    this.legs = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.085, 0.42, 3, 8).translate(0, -0.25, 0), material(), n * 2);
    this.strides = people.map((_, i) => i * 1.7);
    const color = new THREE.Color();
    people.forEach((p, i) => {
      this.bodies.setColorAt(i, color.set(p.color));
      this.heads.setColorAt(i, color.set(SKIN));
      this.legs.setColorAt(i * 2, color.set(TROUSERS));
      this.legs.setColorAt(i * 2 + 1, color.set(TROUSERS));
    });
    for (const mesh of [this.bodies, this.heads, this.legs]) {
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.count = people.length;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      scene.add(mesh);
    }
    this.legs.count = people.length * 2;
  }

  update(dt: number): void {
    this.people.forEach((p, i) => {
      const down = p.state === 'down';
      // Standing, they turn to face where they are going. Knocked down, they lie on their back.
      this.euler.set(down ? -Math.PI / 2 : 0, p.yaw, 0);
      this.base.compose(p.pos, this.turn.setFromEuler(this.euler), this.one);
      const lift = down ? 0.25 : 0;
      this.place(this.bodies, i, 0, 1.05 + lift, 0, 0);
      this.place(this.heads, i, 0, 1.62 + lift, 0, 0);
      this.strides[i] += p.speed * dt * 2.6;
      const swing = down ? 0 : Math.sin(this.strides[i]) * 0.7 * Math.min(1, p.speed / 1.5);
      this.place(this.legs, i * 2, 0.11, 0.72 + lift, 0, swing);
      this.place(this.legs, i * 2 + 1, -0.11, 0.72 + lift, 0, -swing);
    });
    for (const mesh of [this.bodies, this.heads, this.legs]) mesh.instanceMatrix.needsUpdate = true;
  }

  /** Set one instance, at an offset within the figure and swung about its own top. */
  private place(mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, swing: number): void {
    this.part.makeRotationX(swing).setPosition(x, y, z);
    mesh.setMatrixAt(index, this.out.multiplyMatrices(this.base, this.part));
  }
}
