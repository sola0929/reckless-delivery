import * as THREE from 'three';
import type { Slab } from '../levels/types';
import type { Shard, Skylight, Skylights } from '../sim/skylights';
import { Shapes } from './shapes';
import { signSheet } from './signs';

// The skylights in the market's roof: their frames, in the steel; their sheet, milky with dirt, the hall's dark showing
// through, and the purlins it lies on, which go with it when it is broken; and the shards of one broken.

type P = [number, number, number];

const SKYLIGHT = 0xd9e2d2;
const FRAME = 0x6a7276;
const PURLIN = 0x4f565c;
/** How much of a broken one, from its foot up, is gone. */
const GONE = 0.55;
/** The drawn sheet's face over the solid slab under it, and the skylight's over that. */
const FACE = 0.03, SHEET_LIFT = 0.0125;

const matrixOf = (slab: Slab) =>
  new THREE.Matrix4().compose(new THREE.Vector3(...slab.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...slab.rot)), new THREE.Vector3(1, 1, 1));

/** A box in a slab's own terms, drawn into `s` where the slab is. */
function boxIn(s: Shapes, m: THREE.Matrix4, cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, color: number): void {
  const v = new THREE.Vector3();
  const at = (x: number, y: number, z: number): P => (v.set(x, y, z).applyMatrix4(m), [v.x, v.y, v.z]);
  const x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy, z0 = cz - hz, z1 = cz + hz;
  s.quad(at(x1, y0, z1), at(x1, y0, z0), at(x1, y1, z0), at(x1, y1, z1), color);
  s.quad(at(x0, y0, z0), at(x0, y0, z1), at(x0, y1, z1), at(x0, y1, z0), color);
  s.quad(at(x0, y0, z1), at(x1, y0, z1), at(x1, y1, z1), at(x0, y1, z1), color);
  s.quad(at(x1, y0, z0), at(x0, y0, z0), at(x0, y1, z0), at(x1, y1, z0), color);
  s.quad(at(x0, y1, z1), at(x1, y1, z1), at(x1, y1, z0), at(x0, y1, z0), color);
  s.quad(at(x0, y0, z0), at(x1, y0, z0), at(x1, y0, z1), at(x0, y0, z1), color);
}

/** Where on a pane, from its foot (0) to its head (1), in its slab's own X: the foot is the end of its X that is lower. */
const across = (slab: Slab) => {
  const footward = Math.sin(slab.rot[2]) > 0 ? -1 : 1;
  return (u: number) => footward * slab.size[0] * (1 - 2 * u);
};

/** A pane's frame where it laps the steel: along its foot, and its ends; along its head too unless that is the ridge. */
function frameIn(s: Shapes, slab: Slab, ridge: boolean): void {
  const m = matrixOf(slab), [hx, hy, hz] = slab.size, top = hy + FACE, x = across(slab);
  for (const u of ridge ? [0] : [0, 1]) boxIn(s, m, x(u) - Math.sign(x(u)) * 0.045, top + 0.025, 0, 0.045, 0.01, hz, FRAME);
  for (const z of [-hz + 0.03, hz - 0.03]) boxIn(s, m, 0, top + 0.025, z, hx, 0.01, 0.03, FRAME);
}

/** A pane's sheet into `glass`, and into `s` the purlin under it, the ridge's capping over it, a broken one's ragged edge. */
function paneIn(s: Shapes, glass: Shapes, slab: Slab, ridge: boolean, broken: boolean): void {
  const m = matrixOf(slab), [hx, hy, hz] = slab.size, top = hy + FACE, x = across(slab);
  const from = broken ? GONE : 0;
  boxIn(glass, m, (x(from) + x(1)) / 2, top + SHEET_LIFT, 0, Math.abs(x(1) - x(from)) / 2, 0.0075, hz, SKYLIGHT);
  if (broken) {
    boxIn(s, m, x(from), top + 0.012, 0, 0.05, 0.01, hz, 0x3c4246);
    // Shards still hanging in along it.
    const footward = Math.sign(x(0) - x(from));
    for (let k = 0, z = -hz + 0.3; z < hz - 0.5; k++, z += 0.55 + (k % 3) * 0.2) {
      const reach = 0.25 + (k % 2) * 0.3;
      boxIn(glass, m, x(from) + (footward * reach) / 2, top + SHEET_LIFT, z + 0.17, reach / 2, 0.0075, 0.17, SKYLIGHT);
    }
  }
  // The purlins it lies on, a metre and a half apart up the slope.
  const purlins = Math.max(1, Math.round((hx * 2) / 1.5));
  for (let k = 0; k < purlins; k++) boxIn(s, m, x((k + 0.5) / purlins), top - 0.12, 0, 0.04, 0.06, hz, PURLIN);
  // Along the ridge, the capping the two panes meet under.
  if (ridge) boxIn(s, m, x(1) - Math.sign(x(1)) * 0.06, top + 0.05, 0, 0.12, 0.04, hz, FRAME);
}

export class SkylightsView {
  private readonly steel = new THREE.MeshStandardMaterial({ vertexColors: true, map: signSheet(), roughness: 0.85, shadowSide: THREE.FrontSide });
  private readonly glass = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false, roughness: 0.35 });
  /** The frames, which stay; the sheets and what goes with them, as one while they are whole. */
  private readonly frames: THREE.Mesh;
  private sheets: THREE.Mesh[] = [];
  private readonly shards: { mesh: THREE.Mesh; shard: Shard }[] = [];
  private shown: boolean[] = [];

  constructor(private readonly scene: THREE.Scene, private readonly skylights: Skylights) {
    const s = new Shapes();
    for (const light of skylights.lights) for (const pane of light.desc.panes) frameIn(s, pane.slab, !!pane.ridge);
    this.frames = new THREE.Mesh(s.geometry(), this.steel);
    scene.add(this.frames);
    for (const shard of skylights.shards) {
      const [a, b, c] = shard.half;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(a * 2, b * 2, c * 2), new THREE.MeshStandardMaterial({ color: SKYLIGHT, transparent: true, opacity: 0.75, roughness: 0.35 }));
      mesh.visible = false;
      scene.add(mesh);
      this.shards.push({ mesh, shard });
    }
    this.build();
  }

  /** The sheets of those not broken through. */
  private build(): void {
    for (const mesh of this.sheets) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.shown = this.skylights.lights.map((light) => light.broken);
    const s = new Shapes(), glass = new Shapes();
    for (const light of this.skylights.lights.filter((l: Skylight) => !l.broken))
      for (const pane of light.desc.panes) paneIn(s, glass, pane.slab, !!pane.ridge, !!light.desc.broken);
    this.sheets = [new THREE.Mesh(s.geometry(), this.steel), new THREE.Mesh(glass.geometry(), this.glass)];
    for (const mesh of this.sheets) this.scene.add(mesh);
  }

  /** Each frame: those broken since; the shards where they are; what is up on the roof not drawn while the roof is not. */
  update(hidden?: (p: { x: number; y: number; z: number }) => boolean): void {
    if (this.skylights.lights.some((light, k) => light.broken !== this.shown[k])) this.build();
    const first = this.skylights.lights[0]?.desc.panes[0].slab.pos;
    const up = !(first && hidden?.({ x: first[0], y: first[1], z: first[2] }));
    this.frames.visible = up;
    for (const mesh of this.sheets) mesh.visible = up;
    for (const { mesh, shard } of this.shards) {
      mesh.visible = shard.body.isEnabled();
      if (!mesh.visible) continue;
      const p = shard.body.translation(), r = shard.body.rotation();
      mesh.position.set(p.x, p.y, p.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
      mesh.visible = !hidden?.(p);
    }
  }
}
