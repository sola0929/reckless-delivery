import * as THREE from 'three';
import { GUST_WARN, type GustState } from '../sim/wind';

// The banners at an alley's mouth, the warning of its gusts: a shop's tall cloth banners on bamboo poles, the kind put out
// along every street here. Between gusts they hang and stir; as a gust comes they swing round to stand out straight the
// way it blows, snapping, until it has gone by.

const POLE = 3.2;
const CLOTH: [number, number] = [0.55, 1.6];
const COLORS = [0xe07a28, 0xd23c2c, 0xe0b020, 0x3f9a94];

interface Banner {
  gust: GustState;
  /** Turns about its pole; and the cloth itself, about where it is tied along the pole. */
  pivot: THREE.Group;
  cloth: THREE.Mesh;
  /** The way it hangs when nothing is blowing; the way the gust blows; how far round it has swung toward it, 0 to 1. */
  rest: number;
  downwind: number;
  out: number;
  seed: number;
}

export class WindView {
  private readonly banners: Banner[] = [];
  private time = 0;

  constructor(scene: THREE.Scene, gusts: GustState[]) {
    let n = 0;
    for (const gust of gusts) {
      const { desc } = gust;
      const downwind = Math.atan2(desc.to[0] - desc.from[0], desc.to[1] - desc.from[1]);
      for (const [x, y, z] of desc.flags) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, POLE, 6), new THREE.MeshStandardMaterial({ color: 0xc9b27a }));
        pole.position.set(x, y + POLE / 2, z);
        pole.castShadow = true;
        scene.add(pole);
        // Stood on the ground, a weighted foot; up on a front, a bracket.
        const foot = y < 0.5 ? new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0x33363b })) : new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0x5a5f66 }));
        foot.position.set(x - (y < 0.5 ? 0 : 0.15), y + 0.06, z);
        scene.add(foot);
        const pivot = new THREE.Group();
        pivot.position.set(x, y + POLE - 0.1, z);
        const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.015, CLOTH[1], CLOTH[0]), new THREE.MeshStandardMaterial({ color: COLORS[n % COLORS.length], side: THREE.DoubleSide }));
        // Tied along the pole by its edge: its middle out from it.
        cloth.geometry.translate(0, -CLOTH[1] / 2, CLOTH[0] / 2);
        cloth.castShadow = true;
        pivot.add(cloth);
        scene.add(pivot);
        this.banners.push({ gust, pivot, cloth, rest: downwind + Math.PI * (0.5 + (n % 3) * 0.4), downwind, out: 0, seed: n * 1.7 });
        n++;
      }
    }
  }

  update(dt: number): void {
    this.time += dt;
    for (const b of this.banners) {
      // Out once its gust is warned of; back, slowly, once it is gone by.
      const want = b.gust.warned ? 1 : 0;
      b.out += (want - b.out) * Math.min(1, dt * (want ? 1 / (GUST_WARN * 0.35) : 1.2));
      const flap = Math.sin(this.time * (b.gust.strength > 0 ? 16 : 3) + b.seed) * (b.gust.strength > 0 ? 0.22 : 0.06);
      b.pivot.rotation.y = lerpAngle(b.rest, b.downwind, b.out) + flap;
      // Hanging, it falls in against its pole; blown, it stands out flat.
      b.cloth.rotation.z = 0;
      b.cloth.rotation.y = 0;
      b.cloth.scale.z = 0.45 + 0.55 * b.out;
    }
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}
