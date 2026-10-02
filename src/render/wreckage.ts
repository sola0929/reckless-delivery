import * as THREE from 'three';

interface Piece {
  mesh: THREE.Mesh;
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
 */
export class Wreckage {
  private readonly pieces: Piece[] = [];
  private readonly plank = new THREE.BoxGeometry(1, 1, 1);

  constructor(private readonly scene: THREE.Scene) {}

  /**
   * A stall coming apart at `at`: its awning, in `cloth`, sails off, and planks and poles
   * scatter the way the thing that hit it was going, `push` m/s.
   */
  stall(at: { x: number; y: number; z: number }, cloth: number, push: { x: number; z: number }): void {
    const along = Math.hypot(push.x, push.z);
    const fling = (size: [number, number, number], color: number, height: number, lift: number) => {
      const mesh = new THREE.Mesh(this.plank, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
      mesh.scale.set(...size);
      mesh.position.set(at.x + (Math.random() - 0.5) * 1.6, at.y + height, at.z + (Math.random() - 0.5) * 1.2);
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.pieces.push({
        mesh, floor: at.y + size[1] / 2 + 0.02, resting: false, left: SECONDS,
        velocity: new THREE.Vector3(
          push.x * (0.5 + Math.random() * 0.5) + (Math.random() - 0.5) * 5,
          lift + Math.random() * 3 + along * 0.15,
          push.z * (0.5 + Math.random() * 0.5) + (Math.random() - 0.5) * 5,
        ),
        spin: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 12),
      });
    };
    // The awning, torn in two.
    fling([1.3, 0.04, 1.7], cloth, 2.4, 5);
    fling([1.2, 0.04, 1.1], cloth, 2.4, 4);
    // Planks off the counter, and the poles that held the awning up.
    for (let i = 0; i < 7; i++) fling([0.9 + Math.random() * 0.7, 0.05, 0.16 + Math.random() * 0.1], WOOD[i % WOOD.length], 0.6, 3);
    for (let i = 0; i < 3; i++) fling([0.07, 0.07, 1.6 + Math.random() * 0.7], 0x3a3f46, 1.4, 3.5);
    while (this.pieces.length > MAX) this.drop(this.pieces[0]);
  }

  update(dt: number): void {
    for (const piece of [...this.pieces]) {
      piece.left -= dt;
      if (piece.left <= 0) {
        this.drop(piece);
        continue;
      }
      // Sinking out of sight at the end, rather than vanishing.
      if (piece.left < 1) piece.mesh.position.y -= dt * 0.25;
      if (piece.resting) continue;
      const { mesh, velocity, spin } = piece;
      velocity.y -= 9.81 * dt;
      mesh.position.addScaledVector(velocity, dt);
      mesh.rotation.x += spin.x * dt;
      mesh.rotation.y += spin.y * dt;
      mesh.rotation.z += spin.z * dt;
      if (mesh.position.y < piece.floor && velocity.y < 0) {
        mesh.position.y = piece.floor;
        if (velocity.y < -4) {
          // One bounce, losing most of its speed.
          velocity.set(velocity.x * 0.4, -velocity.y * 0.25, velocity.z * 0.4);
          spin.multiplyScalar(0.4);
        } else {
          piece.resting = true;
          // Flat on the ground, facing whichever way it happened to be turned.
          mesh.rotation.set(0, mesh.rotation.y, 0);
        }
      }
    }
  }

  clear(): void {
    for (const piece of [...this.pieces]) this.drop(piece);
  }

  private drop(piece: Piece): void {
    this.scene.remove(piece.mesh);
    (piece.mesh.material as THREE.Material).dispose();
    this.pieces.splice(this.pieces.indexOf(piece), 1);
  }
}
