import * as THREE from 'three';
import { OBJECT_KINDS, type ObjectPart } from '../levels/objects';
import type { Rider } from '../sim/riders';

const SCOOTERS = [OBJECT_KINDS.scooterRed, OBJECT_KINDS.scooterBlue, OBJECT_KINDS.scooterWhite, OBJECT_KINDS.scooterBlack, OBJECT_KINDS.scooterYellow, OBJECT_KINDS.scooterTeal];
const JACKETS = [0x3a6fb3, 0xb33a3a, 0x4a8f5a, 0xe0c341, 0x8a5fb3, 0xd9792b, 0x2f3b4a, 0xd9d9d9, 0x3aa6a6];
const HELMETS = [0xf0f0ec, 0x22252a, 0xd0392c, 0xf2c12e, 0x2f62a8, 0xe89ab0];
const TROUSERS = 0x2f343c;

/** The parts of a scooter that is being ridden: all of one that is parked, less the stand. */
const partsOf = (index: number): ObjectPart[] => SCOOTERS[index % SCOOTERS.length].parts.filter((part) => part.pos[1] > 0.05);

interface Slot {
  mesh: THREE.InstancedMesh;
  index: number;
  local: THREE.Matrix4;
}

/**
 * Draws the scooters that are ridden about, and whoever is on each. They move too fast to
 * be drawn where the physics last left them, so each is drawn part of the way between its
 * last two places, as the truck is.
 */
export class RidersView {
  private readonly slots: Slot[][] = [];
  private readonly meshes: THREE.InstancedMesh[] = [];
  private readonly torsos: THREE.InstancedMesh;
  private readonly heads: THREE.InstancedMesh;
  private readonly legs: THREE.InstancedMesh;
  private readonly was: { pos: THREE.Vector3; rot: THREE.Quaternion }[];
  private readonly now: { pos: THREE.Vector3; rot: THREE.Quaternion }[];
  private readonly base = new THREE.Matrix4();
  private readonly part = new THREE.Matrix4();
  private readonly out = new THREE.Matrix4();
  private readonly pos = new THREE.Vector3();
  private readonly rot = new THREE.Quaternion();
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly one = new THREE.Vector3(1, 1, 1);

  constructor(scene: THREE.Scene, private readonly riders: readonly Rider[]) {
    const n = Math.max(1, riders.length);
    const counts = { box: 0, cylinder: 0, cone: 0 };
    riders.forEach((_, i) => partsOf(i).forEach((part) => counts[part.shape]++));
    const material = () => new THREE.MeshStandardMaterial({ roughness: 0.7 });
    const shapes = {
      box: new THREE.InstancedMesh(new THREE.BoxGeometry(2, 2, 2), material(), Math.max(1, counts.box)),
      cylinder: new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 2, 12), material(), Math.max(1, counts.cylinder)),
      cone: new THREE.InstancedMesh(new THREE.ConeGeometry(1, 2, 10), material(), Math.max(1, counts.cone)),
    };
    this.torsos = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.21, 0.42, 4, 10), material(), n);
    this.heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 12, 10), material(), n);
    this.legs = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.085, 0.42, 3, 8).translate(0, -0.25, 0), material(), n * 2);

    const next = { box: 0, cylinder: 0, cone: 0 };
    const color = new THREE.Color();
    const euler = new THREE.Euler();
    const turn = new THREE.Quaternion();
    riders.forEach((_, i) => {
      this.slots.push(partsOf(i).map((part) => {
        const mesh = shapes[part.shape];
        const index = next[part.shape]++;
        const [a, b, c] = part.size;
        const [rx, ry, rz] = part.rot ?? [0, 0, 0];
        const local = new THREE.Matrix4().compose(new THREE.Vector3(...part.pos), turn.setFromEuler(euler.set(rx, ry, rz)), new THREE.Vector3(a, b, part.shape === 'box' ? c : a));
        mesh.setColorAt(index, color.set(part.color));
        return { mesh, index, local };
      }));
      this.torsos.setColorAt(i, color.set(JACKETS[(i * 5) % JACKETS.length]));
      this.heads.setColorAt(i, color.set(HELMETS[(i * 3) % HELMETS.length]));
      this.legs.setColorAt(i * 2, color.set(TROUSERS));
      this.legs.setColorAt(i * 2 + 1, color.set(TROUSERS));
    });

    shapes.box.count = counts.box;
    shapes.cylinder.count = counts.cylinder;
    shapes.cone.count = counts.cone;
    this.torsos.count = this.heads.count = riders.length;
    this.legs.count = riders.length * 2;
    this.meshes = [shapes.box, shapes.cylinder, shapes.cone, this.torsos, this.heads, this.legs];
    for (const mesh of this.meshes) {
      mesh.castShadow = true;
      // Spread along whole streets; the default bounds would cull them wrongly.
      mesh.frustumCulled = false;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      scene.add(mesh);
    }

    const pose = () => riders.map(() => ({ pos: new THREE.Vector3(), rot: new THREE.Quaternion() }));
    this.was = pose();
    this.now = pose();
    this.snap();
    this.apply(1);
  }

  /** Call after every physics step. */
  capture(): void {
    this.riders.forEach((rider, i) => {
      this.was[i].pos.copy(this.now[i].pos);
      this.was[i].rot.copy(this.now[i].rot);
      this.read(i, rider);
      // Back to the start of its road: don't glide there across the map.
      if (this.was[i].pos.distanceToSquared(this.now[i].pos) > 25) this.was[i].pos.copy(this.now[i].pos);
    });
  }

  snap(): void {
    this.riders.forEach((rider, i) => {
      this.read(i, rider);
      this.was[i].pos.copy(this.now[i].pos);
      this.was[i].rot.copy(this.now[i].rot);
    });
  }

  apply(alpha: number): void {
    this.riders.forEach((rider, i) => {
      this.pos.lerpVectors(this.was[i].pos, this.now[i].pos, alpha);
      this.rot.slerpQuaternions(this.was[i].rot, this.now[i].rot, alpha);
      this.base.compose(this.pos, this.rot, this.one);
      for (const slot of this.slots[i]) slot.mesh.setMatrixAt(slot.index, this.out.multiplyMatrices(this.base, slot.local));

      if (rider.seated) {
        // Sitting up, leaning a little into the wind, knees forward and feet on the board.
        this.place(this.torsos, i, 0, 1.12, -0.22, 0.22);
        this.place(this.heads, i, 0, 1.58, -0.12, 0);
        this.place(this.legs, i * 2, 0.13, 0.84, -0.12, -1.15);
        this.place(this.legs, i * 2 + 1, -0.13, 0.84, -0.12, -1.15);
        return;
      }
      // Thrown off: on their back in the road, and then on their feet, walking back to it.
      const lying = rider.down > 0;
      const stride = rider.walking ? Math.sin(performance.now() * 0.012 + i) * 0.65 : 0;
      this.euler.set(lying ? -Math.PI / 2 : 0, lying ? rider.yaw : rider.facing, 0);
      this.base.compose(rider.person, this.rot.setFromEuler(this.euler), this.one);
      const lift = lying ? 0.25 : 0;
      this.place(this.torsos, i, 0, 1.05 + lift, 0, 0);
      this.place(this.heads, i, 0, 1.62 + lift, 0, 0);
      this.place(this.legs, i * 2, 0.11, 0.72 + lift, 0, stride);
      this.place(this.legs, i * 2 + 1, -0.11, 0.72 + lift, 0, -stride);
    });
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
  }

  private read(i: number, rider: Rider): void {
    const t = rider.body.translation();
    const r = rider.body.rotation();
    this.now[i].pos.set(t.x, t.y, t.z);
    this.now[i].rot.set(r.x, r.y, r.z, r.w);
  }

  /** Set one part of a figure, at an offset from whatever `base` is and tipped forward about its own middle. */
  private place(mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, tip: number): void {
    this.part.makeRotationX(tip).setPosition(x, y, z);
    mesh.setMatrixAt(index, this.out.multiplyMatrices(this.base, this.part));
  }
}
