import * as THREE from 'three';

interface Piece {
  /** Where it is, how it is turned and its size; never added to the scene, only read into its instance. */
  body: THREE.Object3D;
  color: THREE.Color;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  /** Height of the ground it will come to rest on. */
  floor: number;
  resting: boolean;
  left: number;
}

const WOOD = [0x9a7448, 0x86633c, 0xb08a58];
const SECONDS = 14;
const MAX = 90;

/**
 * Bits flung from something that has been smashed: planks, poles, a sheet of awning. They
 * are only for show: they fly, land, lie about for a while and go, without touching anything.
 * All of them are one instanced mesh, so however many there are they cost one draw.
 */
export class Wreckage {
  /** In the same order as the instances. */
  private readonly pieces: Piece[] = [];
  private readonly mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.85 }), MAX);

  constructor(scene: THREE.Scene) {
    this.mesh.castShadow = true;
    // The pieces fly about, so bounds worked out once would be wrong.
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color());
    this.mesh.count = 0;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /**
   * A stall coming apart at `at`: its awning, in `cloth`, sails off, and planks and poles
   * scatter the way the thing that hit it was going, `push` m/s.
   */
  stall(at: { x: number; y: number; z: number }, cloth: number, push: { x: number; z: number }): void {
    const along = Math.hypot(push.x, push.z);
    const fling = (size: [number, number, number], color: number, height: number, lift: number) => {
      // The oldest piece goes to make room.
      if (this.pieces.length >= MAX) this.drop(this.pieces.reduce((a, b) => (b.left < a.left ? b : a)));
      const body = new THREE.Object3D();
      body.scale.set(...size);
      body.position.set(at.x + (Math.random() - 0.5) * 1.6, at.y + height, at.z + (Math.random() - 0.5) * 1.2);
      body.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      const piece: Piece = {
        body, color: new THREE.Color(color), floor: at.y + size[1] / 2 + 0.02, resting: false, left: SECONDS,
        velocity: new THREE.Vector3(
          push.x * (0.5 + Math.random() * 0.5) + (Math.random() - 0.5) * 5,
          lift + Math.random() * 3 + along * 0.15,
          push.z * (0.5 + Math.random() * 0.5) + (Math.random() - 0.5) * 5,
        ),
        spin: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 12),
      };
      this.pieces.push(piece);
      this.place(this.pieces.length - 1);
    };
    // The awning, torn in two.
    fling([1.3, 0.04, 1.7], cloth, 2.4, 5);
    fling([1.2, 0.04, 1.1], cloth, 2.4, 4);
    // Planks off the counter, and the poles that held the awning up.
    for (let i = 0; i < 7; i++) fling([0.9 + Math.random() * 0.7, 0.05, 0.16 + Math.random() * 0.1], WOOD[i % WOOD.length], 0.6, 3);
    for (let i = 0; i < 3; i++) fling([0.07, 0.07, 1.6 + Math.random() * 0.7], 0x3a3f46, 1.4, 3.5);
    this.show();
  }

  update(dt: number): void {
    if (!this.pieces.length) return;
    for (const piece of [...this.pieces]) {
      piece.left -= dt;
      if (piece.left <= 0) {
        this.drop(piece);
        continue;
      }
      const { body, velocity, spin } = piece;
      // Sinking out of sight at the end, rather than vanishing.
      if (piece.left < 1) body.position.y -= dt * 0.25;
      else if (piece.resting) continue;
      if (!piece.resting) {
        velocity.y -= 9.81 * dt;
        body.position.addScaledVector(velocity, dt);
        body.rotation.x += spin.x * dt;
        body.rotation.y += spin.y * dt;
        body.rotation.z += spin.z * dt;
        if (body.position.y < piece.floor && velocity.y < 0) {
          body.position.y = piece.floor;
          if (velocity.y < -4) {
            // One bounce, losing most of its speed.
            velocity.set(velocity.x * 0.4, -velocity.y * 0.25, velocity.z * 0.4);
            spin.multiplyScalar(0.4);
          } else {
            piece.resting = true;
            // Flat on the ground, facing whichever way it happened to be turned.
            body.rotation.set(0, body.rotation.y, 0);
          }
        }
      }
      this.place(this.pieces.indexOf(piece));
    }
    this.show();
  }

  clear(): void {
    this.pieces.length = 0;
    this.show();
  }

  /** Copies piece `i` into instance `i`. */
  private place(i: number): void {
    const piece = this.pieces[i];
    piece.body.updateMatrix();
    this.mesh.setMatrixAt(i, piece.body.matrix);
    this.mesh.setColorAt(i, piece.color);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
  }

  /** Takes a piece out, moving the last one into its place so the instances stay packed. */
  private drop(piece: Piece): void {
    const i = this.pieces.indexOf(piece);
    const last = this.pieces.pop()!;
    if (last !== piece) {
      this.pieces[i] = last;
      this.place(i);
    }
  }

  private show(): void {
    this.mesh.count = this.pieces.length;
    this.mesh.visible = this.pieces.length > 0;
  }
}
