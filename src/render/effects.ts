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

/** Pooled smoke: puffs that swell, drift upward and fade out. Pale and brief for tyres, dark and lingering for an engine. */
export class Smoke {
  readonly mesh: THREE.InstancedMesh;
  private readonly puffs: Puff[] = [];
  private cursor = 0;

  constructor(color = 0xe9e6e0, opacity = 0.32, private readonly lifeScale = 1, private readonly sizeScale = 1) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
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
    p.life = (0.5 + Math.random() * 0.4) * this.lifeScale;
    p.size = (0.3 + Math.random() * 0.25) * this.sizeScale;
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

interface Bit {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  scale: THREE.Vector3;
  rot: THREE.Quaternion;
  age: number;
  life: number;
}

/** What each kind of burst looks like: colours, piece size range, how stretched, how long it lasts. */
const BURST_STYLES = {
  splinters: { colors: [0xb98a55, 0x96693c, 0xd9b36c], size: [0.04, 0.09], stretch: 3.5, life: [0.9, 1.6] },
  water: { colors: [0x4aa3e8, 0x7cc4f5, 0x2f7fd0], size: [0.05, 0.1], stretch: 1, life: [0.5, 1.0] },
  pulp: { colors: [0xd8434a, 0xe86a70, 0x2f7a3a, 0xf2a0a4], size: [0.04, 0.09], stretch: 1.3, life: [0.6, 1.2] },
  bone: { colors: [0xece6d2, 0xcfc7ae], size: [0.03, 0.06], stretch: 2, life: [0.8, 1.3] },
  leaves: { colors: [0x4f8a4a, 0x5d9a52, 0x447d44, 0x7fae5a], size: [0.07, 0.14], stretch: 1.6, life: [1.0, 1.9] },
  sparks: { colors: [0xffe9a0, 0xfff6cf, 0xffc24a], size: [0.03, 0.05], stretch: 3, life: [0.25, 0.55] },
} as const;

export type BurstStyle = keyof typeof BURST_STYLES;

const MAX_BITS = 1200;
const GRAVITY = -9.81;
const GROUND = 0.03;
const COLOR = new THREE.Color();
const SCALE = new THREE.Vector3();

/** Pooled flying bits: wood splinters, water drops, bone chips. They fall and lie on the ground briefly. */
export class Bursts {
  readonly mesh: THREE.InstancedMesh;
  private readonly bits: Bit[] = [];
  private cursor = 0;

  constructor() {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.6 }), MAX_BITS);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    for (let i = 0; i < MAX_BITS; i++) {
      this.bits.push({
        pos: new THREE.Vector3(), vel: new THREE.Vector3(), scale: new THREE.Vector3(),
        rot: new THREE.Quaternion(), age: 1, life: 1,
      });
      this.mesh.setMatrixAt(i, HIDDEN);
      this.mesh.setColorAt(i, COLOR.set(0xffffff));
    }
  }

  /**
   * Throw `count` bits out from a point. `power` is their launch speed in m/s; `upward` above
   * 1 sends them more up than out, like a jet.
   */
  emit(at: THREE.Vector3, style: BurstStyle, count: number, power: number, upward = 1): void {
    const s = BURST_STYLES[style];
    const between = ([lo, hi]: readonly [number, number]) => lo + Math.random() * (hi - lo);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      const b = this.bits[i];
      this.cursor = (this.cursor + 1) % MAX_BITS;

      const angle = Math.random() * Math.PI * 2;
      const out = (power * (0.3 + Math.random() * 0.7)) / upward;
      b.pos.copy(at);
      b.pos.y += 0.1;
      b.vel.set(Math.cos(angle) * out, power * (0.5 + Math.random() * 0.8) * upward, Math.sin(angle) * out);
      const size = between(s.size);
      b.scale.set(size, size, size * s.stretch);
      b.rot.setFromEuler(new THREE.Euler(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3));
      b.age = 0;
      b.life = between(s.life);
      this.mesh.setColorAt(i, COLOR.set(s.colors[Math.floor(Math.random() * s.colors.length)]));
    }
    this.mesh.instanceColor!.needsUpdate = true;
  }

  update(dt: number): void {
    this.bits.forEach((b, i) => {
      if (b.age >= b.life) return;
      b.age += dt;
      if (b.age >= b.life) {
        this.mesh.setMatrixAt(i, HIDDEN);
        return;
      }
      b.vel.y += GRAVITY * dt;
      b.pos.addScaledVector(b.vel, dt);
      if (b.pos.y < GROUND) {
        b.pos.y = GROUND;
        b.vel.set(0, 0, 0);
      }
      // Shrink away over the last quarter of its life.
      const fade = Math.min(1, ((b.life - b.age) / b.life) * 4);
      MATRIX.compose(b.pos, b.rot, SCALE.copy(b.scale).multiplyScalar(fade));
      this.mesh.setMatrixAt(i, MATRIX);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.bits.forEach((b, i) => {
      b.age = b.life;
      this.mesh.setMatrixAt(i, HIDDEN);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
