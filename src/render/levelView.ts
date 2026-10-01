import * as THREE from 'three';
import type { PropDesc } from '../levels/types';
import type { Sim } from '../sim/sim';
import { CAR_HALF } from '../sim/traffic';
import { BodySync, propMesh } from './meshes';

const FADED_OPACITY = 0.16;
const FADE_RATE = 8;
const DECAL_Y = 0.02;

interface Fader {
  material: THREE.MeshStandardMaterial;
  box: THREE.Box3;
  opacity: number;
}

function carMesh(color: number): THREE.Group {
  const car = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1b2a3a, roughness: 0.2, metalness: 0.4 });
  const { width, height, length } = CAR_HALF;

  const body = new THREE.Mesh(new THREE.BoxGeometry(width * 2, height * 1.1, length * 2), paint);
  body.position.y = -height * 0.45;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(width * 1.8, height * 0.9, length * 1.05), glass);
  cabin.position.set(0, height * 0.5, -length * 0.1);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 1.82, 0.06, length * 1.0), paint);
  roof.position.set(0, height * 0.96, -length * 0.1);
  for (const part of [body, cabin, roof]) {
    part.castShadow = true;
    part.receiveShadow = true;
    car.add(part);
  }
  return car;
}

/** Unit shapes that an instance matrix scales up to a prop's size. */
const UNIT = {
  box: () => new THREE.BoxGeometry(2, 2, 2),
  cylinder: () => new THREE.CylinderGeometry(1, 1, 2, 16),
  cone: () => new THREE.ConeGeometry(1, 2, 14),
};

/**
 * Scenery that never moves or fades, drawn as one instanced mesh per shape. A city has
 * thousands of these (trees, pavements, fences), far too many to draw one by one.
 */
function staticProps(props: PropDesc[]): THREE.InstancedMesh[] {
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  return (Object.keys(UNIT) as (keyof typeof UNIT)[]).flatMap((shape) => {
    const group = props.filter((p) => p.shape === shape);
    if (!group.length) return [];
    const mesh = new THREE.InstancedMesh(UNIT[shape](), new THREE.MeshStandardMaterial({ roughness: 0.85 }), group.length);
    group.forEach((p, i) => {
      const [a, b, c] = p.size;
      if (shape === 'box') scale.set(a, b, c);
      else scale.set(a, b, a);
      const [rx, ry, rz] = p.rot ?? [0, 0, 0];
      matrix.compose(position.set(...p.pos), rotation.setFromEuler(euler.set(rx, ry, rz)), scale);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.set(p.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Instances are spread across the whole map; the default bounds would cull them wrongly.
    mesh.frustumCulled = false;
    return [mesh];
  });
}

/** Draws everything in the level that isn't the truck or its cargo. */
export class LevelView {
  private readonly syncs: BodySync[] = [];
  private readonly faders: Fader[] = [];
  private readonly finishGlow: THREE.Mesh | null = null;
  private readonly ray = new THREE.Ray();
  private readonly hit = new THREE.Vector3();
  private time = 0;

  constructor(scene: THREE.Scene, sim: Sim) {
    const { props, decals, finish } = sim.level;

    scene.add(...staticProps(props.filter((p) => p.mass === undefined && !p.fade)));
    for (const desc of props) {
      if (!desc.fade) continue;
      const mesh = propMesh(desc);
      scene.add(mesh);
      this.faders.push(this.fader(mesh, desc));
    }
    for (const prop of sim.props) {
      if (prop.desc.mass === undefined) continue;
      const mesh = propMesh(prop.desc);
      scene.add(mesh);
      this.syncs.push(new BodySync(prop.body, mesh));
    }

    for (const car of sim.traffic.cars) {
      const mesh = carMesh(car.color);
      scene.add(mesh);
      this.syncs.push(new BodySync(car.body, mesh));
    }

    if (decals.length) scene.add(this.decalMesh(sim));

    if (finish) {
      // A glowing box over the delivery bay, visible from a distance.
      this.finishGlow = new THREE.Mesh(
        new THREE.BoxGeometry(finish.half[0] * 2, 4, finish.half[1] * 2),
        new THREE.MeshBasicMaterial({ color: 0x4dff88, transparent: true, opacity: 0.2, depthWrite: false }),
      );
      this.finishGlow.position.set(finish.pos[0], 2, finish.pos[1]);
      scene.add(this.finishGlow);
    }
  }

  /** Call after every physics step. */
  capture(): void {
    for (const s of this.syncs) s.capture();
  }

  snap(): void {
    for (const s of this.syncs) s.snap();
  }

  apply(alpha: number): void {
    for (const s of this.syncs) s.apply(alpha);
  }

  /** Fade out whatever stands between the camera and the truck, and animate the delivery bay. */
  update(dt: number, camera: THREE.Camera, truck: THREE.Vector3): void {
    this.time += dt;
    if (this.finishGlow) {
      (this.finishGlow.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(this.time * 3) * 0.07;
    }

    const reach = camera.position.distanceTo(truck);
    this.ray.origin.copy(camera.position);
    this.ray.direction.copy(truck).sub(camera.position).normalize();
    const ease = 1 - Math.exp(-FADE_RATE * dt);
    for (const f of this.faders) {
      const point = this.ray.intersectBox(f.box, this.hit);
      const blocking = point !== null && point.distanceTo(camera.position) < reach;
      const target = blocking ? FADED_OPACITY : 1;
      if (f.opacity === target) continue;
      f.opacity += (target - f.opacity) * ease;
      if (Math.abs(f.opacity - target) < 0.01) f.opacity = target;
      f.material.opacity = f.opacity;
      // Only pay for transparency while something is actually see-through.
      const transparent = f.opacity < 1;
      if (f.material.transparent !== transparent) {
        f.material.transparent = transparent;
        f.material.depthWrite = !transparent;
        f.material.needsUpdate = true;
      }
    }
  }

  private fader(mesh: THREE.Mesh, desc: PropDesc): Fader {
    const [hx, hy, hz] = desc.size;
    const [x, y, z] = desc.pos;
    // Slightly fattened, so the truck is revealed before it is right behind a corner.
    const pad = 1.5;
    return {
      material: mesh.material as THREE.MeshStandardMaterial,
      box: new THREE.Box3(new THREE.Vector3(x - hx - pad, y - hy, z - hz - pad), new THREE.Vector3(x + hx + pad, y + hy, z + hz + pad)),
      opacity: 1,
    };
  }

  /** All the ground markings as one instanced mesh. */
  private decalMesh(sim: Sim): THREE.InstancedMesh {
    const { decals } = sim.level;
    const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.InstancedMesh(geometry, material, decals.length);
    mesh.receiveShadow = true;

    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();
    decals.forEach((d, i) => {
      rotation.setFromAxisAngle(up, d.rotY ?? 0);
      // Later decals sit a hair higher, so overlapping ones stack in the order they were listed.
      const y = (d.y ?? DECAL_Y) + i * 1e-5;
      matrix.compose(new THREE.Vector3(d.pos[0], y, d.pos[1]), rotation, new THREE.Vector3(d.size[0], 1, d.size[1]));
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.set(d.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }
}
