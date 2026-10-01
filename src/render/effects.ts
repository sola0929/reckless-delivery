import * as THREE from 'three';

interface Puff {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  life: number;
  size: number;
}

const MAX_PUFFS = 200;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const MATRIX = new THREE.Matrix4();

/** Pooled tyre smoke: puffs that swell, drift upward and fade out. */
export class Smoke {
  readonly mesh: THREE.InstancedMesh;
  private readonly puffs: Puff[] = [];
  private cursor = 0;

  constructor() {
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0xe9e6e0, transparent: true, opacity: 0.32, depthWrite: false }),
      MAX_PUFFS,
    );
    this.mesh.frustumCulled = false;
    for (let i = 0; i < MAX_PUFFS; i++) {
      this.puffs.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 1, life: 1, size: 0 });
      this.mesh.setMatrixAt(i, HIDDEN);
    }
  }

  /** Spawn one puff at a world position, drifting with the given velocity. */
  emit(at: THREE.Vector3, drift: THREE.Vector3): void {
    const p = this.puffs[this.cursor];
    this.cursor = (this.cursor + 1) % MAX_PUFFS;
    p.pos.copy(at);
    p.pos.x += (Math.random() - 0.5) * 0.3;
    p.pos.z += (Math.random() - 0.5) * 0.3;
    p.vel.copy(drift);
    p.vel.y += 0.6 + Math.random() * 0.6;
    p.age = 0;
    p.life = 0.5 + Math.random() * 0.4;
    p.size = 0.3 + Math.random() * 0.25;
  }

  update(dt: number): void {
    this.puffs.forEach((p, i) => {
      if (p.age >= p.life) return;
      p.age += dt;
      if (p.age >= p.life) {
        this.mesh.setMatrixAt(i, HIDDEN);
        return;
      }
      p.pos.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(Math.exp(-2.5 * dt));
      const t = p.age / p.life;
      // Swell quickly, then shrink away to nothing.
      const scale = p.size * (0.5 + 2 * t) * (1 - t * t);
      MATRIX.makeScale(scale, scale, scale).setPosition(p.pos);
      this.mesh.setMatrixAt(i, MATRIX);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.puffs.forEach((p, i) => {
      p.age = p.life;
      this.mesh.setMatrixAt(i, HIDDEN);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
