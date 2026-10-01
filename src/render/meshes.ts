import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { TRUCK, type Vec3 } from '../config';
import type { CargoDesc, PropDesc } from '../sim/sandbox';
import type { Truck } from '../sim/truck';

/** Copies a physics body's transform onto a mesh, interpolating between fixed steps. */
export class BodySync {
  private readonly prevPos = new THREE.Vector3();
  private readonly prevRot = new THREE.Quaternion();
  private readonly currPos = new THREE.Vector3();
  private readonly currRot = new THREE.Quaternion();

  constructor(readonly body: RAPIER.RigidBody, readonly object: THREE.Object3D) {
    this.snap();
  }

  /** Call after every physics step. */
  capture(): void {
    this.prevPos.copy(this.currPos);
    this.prevRot.copy(this.currRot);
    this.read();
  }

  /** Jump to the body's current transform with no interpolation, e.g. after a reset. */
  snap(): void {
    this.read();
    this.prevPos.copy(this.currPos);
    this.prevRot.copy(this.currRot);
  }

  apply(alpha: number): void {
    this.object.position.lerpVectors(this.prevPos, this.currPos, alpha);
    this.object.quaternion.slerpQuaternions(this.prevRot, this.currRot, alpha);
  }

  private read(): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.currPos.set(t.x, t.y, t.z);
    this.currRot.set(r.x, r.y, r.z, r.w);
  }
}

function shadowed<T extends THREE.Mesh>(mesh: T): T {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function boxMesh(half: Vec3, material: THREE.Material): THREE.Mesh {
  return shadowed(new THREE.Mesh(new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2), material));
}

export function propMesh(desc: PropDesc): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({ color: desc.color, roughness: 0.8 });
  const [a, b] = desc.size;
  const mesh =
    desc.shape === 'box' ? boxMesh(desc.size, material)
    : desc.shape === 'cylinder' ? shadowed(new THREE.Mesh(new THREE.CylinderGeometry(a, a, b * 2, 24), material))
    : shadowed(new THREE.Mesh(new THREE.ConeGeometry(a, b * 2, 20), material));
  mesh.position.set(...desc.pos);
  if (desc.rot) mesh.rotation.set(...desc.rot);
  return mesh;
}

let crateTexture: THREE.Texture | undefined;

function getCrateTexture(): THREE.Texture {
  if (crateTexture) return crateTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  g.lineWidth = 3;
  for (let i = 1; i < 4; i++) {
    g.beginPath();
    g.moveTo(0, (i * size) / 4);
    g.lineTo(size, (i * size) / 4);
    g.stroke();
  }
  // Frame and diagonal brace.
  g.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  g.lineWidth = 12;
  g.strokeRect(0, 0, size, size);
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(size, size);
  g.stroke();
  crateTexture = new THREE.CanvasTexture(canvas);
  crateTexture.colorSpace = THREE.SRGBColorSpace;
  return crateTexture;
}

export function cargoMesh(desc: CargoDesc): THREE.Mesh {
  return boxMesh(
    desc.half,
    new THREE.MeshStandardMaterial({ color: desc.color, map: getCrateTexture(), roughness: 0.85 }),
  );
}

export class TruckMesh {
  readonly root = new THREE.Group();
  private readonly steerPivots: THREE.Group[] = [];
  private readonly wheels: THREE.Mesh[] = [];
  private readonly brakeLamp = new THREE.MeshStandardMaterial({ color: 0x7a1010, emissive: 0xff2010, emissiveIntensity: 0 });

  constructor() {
    const paint = new THREE.MeshStandardMaterial({ color: 0xe2532f, roughness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.8 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x1b2a3a, roughness: 0.15, metalness: 0.4 });
    const lamp = new THREE.MeshStandardMaterial({ color: 0xfff6cf, emissive: 0xffe9a0, emissiveIntensity: 0.6 });
    const tyre = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.95 });
    const hub = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.4, metalness: 0.6 });

    const place = (mesh: THREE.Mesh, pos: Vec3) => {
      mesh.position.set(...pos);
      this.root.add(mesh);
    };

    place(boxMesh(TRUCK.frame.half, dark), TRUCK.frame.pos);
    place(boxMesh(TRUCK.cab.half, paint), TRUCK.cab.pos);
    const [sx, sy, sz] = TRUCK.sideWall.pos;
    place(boxMesh(TRUCK.sideWall.half, paint), [sx, sy, sz]);
    place(boxMesh(TRUCK.sideWall.half, paint), [-sx, sy, sz]);
    place(boxMesh(TRUCK.tailgate.half, paint), TRUCK.tailgate.pos);

    // Cab details: windscreen, side windows, headlights.
    const [cw, ch, cl] = TRUCK.cab.half;
    const [, cy, cz] = TRUCK.cab.pos;
    const cabFront = cz + cl + 0.01;
    place(boxMesh([cw * 0.85, ch * 0.4, 0.02], glass), [0, cy + ch * 0.4, cabFront]);
    place(boxMesh([cw + 0.01, ch * 0.35, cl * 0.55], glass), [0, cy + ch * 0.42, cz + 0.1]);
    place(boxMesh([cw * 0.2, 0.1, 0.02], lamp), [cw * 0.7, cy - ch * 0.65, cabFront]);
    place(boxMesh([cw * 0.2, 0.1, 0.02], lamp), [-cw * 0.7, cy - ch * 0.65, cabFront]);

    // Brake lights, across the top of the tailgate so the high camera can see them.
    const [tw, th] = TRUCK.tailgate.half;
    const [, ty, tz] = TRUCK.tailgate.pos;
    for (const x of [tw * 0.72, -tw * 0.72]) {
      place(boxMesh([tw * 0.24, 0.05, 0.1], this.brakeLamp), [x, ty + th + 0.03, tz]);
    }

    const w = TRUCK.wheel;
    const tyreGeo = new THREE.CylinderGeometry(w.radius, w.radius, w.width, 24).rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(w.radius * 0.5, w.radius * 0.5, w.width + 0.02, 6).rotateZ(Math.PI / 2);
    for (const [x, y, z] of w.positions) {
      const pivot = new THREE.Group();
      pivot.position.set(x, y - w.restLength, z);
      const wheel = shadowed(new THREE.Mesh(tyreGeo, tyre));
      wheel.add(new THREE.Mesh(hubGeo, hub));
      pivot.add(wheel);
      this.root.add(pivot);
      this.steerPivots.push(pivot);
      this.wheels.push(wheel);
    }
  }

  /** Pose the wheels from the vehicle controller's suspension, steering and spin. */
  updateWheels(truck: Truck): void {
    const c = truck.controller;
    TRUCK.wheel.positions.forEach(([, y], i) => {
      const pivot = this.steerPivots[i];
      pivot.position.y = y - (c.wheelSuspensionLength(i) ?? TRUCK.wheel.restLength);
      pivot.rotation.y = c.wheelSteering(i) ?? 0;
      this.wheels[i].rotation.x = c.wheelRotation(i) ?? 0;
    });
    this.brakeLamp.emissiveIntensity = truck.brakeLevel > 0 ? 1.5 + truck.brakeLevel * 2.5 : 0;
  }

  /** World position of the bottom of a wheel, where tyre smoke comes from. */
  wheelContact(i: number, target: THREE.Vector3): THREE.Vector3 {
    const pivot = this.steerPivots[i];
    target.set(pivot.position.x, pivot.position.y - TRUCK.wheel.radius, pivot.position.z);
    return this.root.localToWorld(target);
  }
}
