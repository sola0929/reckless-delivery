import * as THREE from 'three';
import type { FlockDesc } from '../levels/types';

// Bats out of the dark of a mine: as the truck comes in at its mouth they come out past it all at once, at the driver's
// face and over the roof, and are gone. Nothing is felt of them; they are only seen.

const COUNT = 54;
const AWAY = 25;

interface Bat {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  /** Where it makes for: how far from the truck toward the eye, and how wide of that line. */
  toward: number;
  wide: THREE.Vector3;
  speed: number;
  size: number;
  phase: number;
  /** Seconds before it leaves its roost; seconds it has been flying; seconds since it went by, or -1. */
  wait: number;
  age: number;
  past: number;
}

/** One wing, out along +x from the body, its front toward +z: the other is this one mirrored. */
function wing(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const v = [[0, 0, 0.12], [0.3, 0, 0.1], [0.56, 0, 0.0], [0.34, 0, -0.06], [0.2, 0, -0.14], [0, 0, -0.1]];
  const tri = [0, 1, 5, 1, 4, 5, 1, 3, 4, 1, 2, 3];
  g.setAttribute('position', new THREE.Float32BufferAttribute(tri.flatMap((k) => v[k]), 3));
  return g;
}

export class FlockView {
  private readonly mesh: THREE.InstancedMesh;
  private readonly armed: boolean[];
  private bats: Bat[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly turn = new THREE.Matrix4();
  private readonly aim = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();

  constructor(scene: THREE.Scene, private readonly flocks: FlockDesc[]) {
    this.mesh = new THREE.InstancedMesh(wing(), new THREE.MeshBasicMaterial({ color: 0x17131c, side: THREE.DoubleSide }), COUNT * 2);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.armed = flocks.map(() => true);
  }

  update(dt: number, truck: { x: number; y: number; z: number }, eye: THREE.Vector3): void {
    for (const [n, flock] of this.flocks.entries()) {
      const d = Math.hypot(truck.x - flock.at[0], truck.z - flock.at[2]);
      if (d > flock.reach + AWAY) this.armed[n] = true;
      else if (d < flock.reach && this.armed[n] && Math.abs(truck.y - flock.at[1]) < 4) {
        this.armed[n] = false;
        this.bats = Array.from({ length: COUNT }, (_, k) => ({
          pos: new THREE.Vector3(flock.from[0] + (Math.random() - 0.5) * 3, flock.from[1] + Math.random() * 1.6, flock.from[2] + (Math.random() - 0.5) * 3),
          vel: new THREE.Vector3(0, 1, 0),
          toward: 0.25 + Math.random() * 0.8,
          wide: new THREE.Vector3((Math.random() - 0.5) * 4.4, (Math.random() - 0.3) * 2.2, (Math.random() - 0.5) * 4.4),
          speed: 13 + Math.random() * 8,
          size: 0.8 + Math.random() * 0.6,
          phase: Math.random() * 6.28,
          wait: (k / COUNT) * 0.9 * Math.random(),
          age: 0,
          past: -1,
        }));
      }
    }
    if (!this.bats.length) return;
    let shown = 0;
    for (const bat of this.bats) {
      if ((bat.wait -= dt) > 0) continue;
      bat.age += dt;
      if (bat.past < 0) {
        // For a point between the truck and the eye, wide of it by its own measure; turning toward it as it comes.
        this.aim.set(truck.x, truck.y + 1.6, truck.z).lerp(eye, bat.toward).add(bat.wide);
        const left = this.aim.distanceTo(bat.pos);
        this.aim.sub(bat.pos).normalize().multiplyScalar(bat.speed);
        bat.vel.lerp(this.aim, Math.min(1, dt * 6));
        if (left < 2.2 || bat.age > 4) bat.past = 0;
      } else {
        bat.past += dt;
        bat.vel.y += dt * 3;
      }
      bat.pos.addScaledVector(bat.vel, dt);
      bat.pos.y += Math.sin(bat.phase + bat.age * 9) * dt * 1.4;
      if (bat.past > 1.8) continue;
      this.fwd.copy(bat.vel).normalize();
      this.right.set(this.fwd.z, 0, -this.fwd.x).normalize();
      this.up.crossVectors(this.fwd, this.right);
      const flap = Math.sin(bat.phase + bat.age * 26) * 0.95, fade = bat.past > 1.3 ? (1.8 - bat.past) / 0.5 : 1;
      for (const side of [-1, 1]) {
        this.m.makeBasis(this.right, this.up, this.fwd).multiply(this.turn.makeRotationZ(side * flap)).scale(this.scale.set(side * bat.size * fade, bat.size * fade, bat.size * fade)).setPosition(bat.pos);
        this.mesh.setMatrixAt(shown++, this.m);
      }
    }
    this.mesh.count = shown;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.bats.every((bat) => bat.past > 1.8)) this.bats = [];
  }
}
