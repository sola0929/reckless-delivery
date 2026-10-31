import * as THREE from 'three';
import type { Hole, Rock } from '../sim/droppers';
import type { Rig, RigShape } from '../sim/rigs';
import { Shapes } from './shapes';

// Machines at work and the rocks falling off the conveyors: each part drawn where the physics has it, part of the
// way between its last two places; each machine's amber lamp flashing while it is moving across the road.

const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15 });
const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x8b8880, roughness: 0.95, flatShading: true });
const lampLit = new THREE.MeshBasicMaterial({ color: 0xffb030 });
const lampOut = new THREE.MeshBasicMaterial({ color: 0x6a4a18 });
const cableMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6 });
/** The site lamps on the conveyors over their holes: dark; amber, flashing, while one is about to go; red while its rocks come down. */
const darkLamp = new THREE.MeshStandardMaterial({ color: 0x7a5a20, roughness: 0.5 });
const warnLamp = new THREE.MeshBasicMaterial({ color: 0xffb020 });
const fallLamp = new THREE.MeshBasicMaterial({ color: 0xff3020 });
const lampHousing = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.7 });
/** What fades, as a building does, while it stands between the camera and the truck: how far, and how fast. */
const FADED_OPACITY = 0.16;
const FADE_RATE = 8;

/** A box turned, a cylinder, a lofted hull: put into the one mesh of the part they are on, corner by corner. */
const m4 = new THREE.Matrix4();
const v3 = new THREE.Vector3();
type P = [number, number, number];
function placed(p: P): P {
  v3.set(...p).applyMatrix4(m4);
  return [v3.x, v3.y, v3.z];
}
function turnedBox(shapes: Shapes, s: RigShape): void {
  m4.compose(new THREE.Vector3(...s.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(s.rot ?? [0, 0, 0]))), new THREE.Vector3(1, 1, 1));
  const [hx, hy, hz] = s.half;
  const c = (x: number, y: number, z: number) => placed([x * hx, y * hy, z * hz]);
  shapes.quad(c(1, -1, 1), c(1, -1, -1), c(1, 1, -1), c(1, 1, 1), s.color);
  shapes.quad(c(-1, -1, -1), c(-1, -1, 1), c(-1, 1, 1), c(-1, 1, -1), s.color);
  shapes.quad(c(-1, -1, 1), c(1, -1, 1), c(1, 1, 1), c(-1, 1, 1), s.color);
  shapes.quad(c(1, -1, -1), c(-1, -1, -1), c(-1, 1, -1), c(1, 1, -1), s.color);
  shapes.quad(c(-1, 1, 1), c(1, 1, 1), c(1, 1, -1), c(-1, 1, -1), s.color);
  shapes.quad(c(-1, -1, -1), c(1, -1, -1), c(1, -1, 1), c(-1, -1, 1), s.color);
}
function cylinder(shapes: Shapes, s: RigShape, sides = 10): void {
  m4.compose(new THREE.Vector3(...s.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(s.rot ?? [0, 0, 0]))), new THREE.Vector3(1, 1, 1));
  const [r, h] = s.half;
  const rim = (i: number, y: number) => placed([Math.cos((i / sides) * Math.PI * 2) * r, y, Math.sin((i / sides) * Math.PI * 2) * r]);
  const top = placed([0, h, 0]), foot = placed([0, -h, 0]);
  for (let i = 0; i < sides; i++) {
    shapes.quad(rim(i + 1, -h), rim(i, -h), rim(i, h), rim(i + 1, h), s.color);
    shapes.tri(top, rim(i + 1, h), rim(i, h), s.color);
    shapes.tri(foot, rim(i, -h), rim(i + 1, -h), s.color);
  }
}
/** A hull: its sides from the outline at its foot up to the one at its top, faced outward; its top closed over. */
function loft(shapes: Shapes, s: RigShape): void {
  const lo = s.lo ?? [], hi = s.hi ?? [], y0 = s.y0 ?? 0, y1 = s.y1 ?? 1, n = Math.min(lo.length, hi.length);
  if (n < 3) return;
  const cx = hi.reduce((a, p) => a + p[0], 0) / n, cz = hi.reduce((a, p) => a + p[1], 0) / n;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a: P = [lo[i][0], y0, lo[i][1]], b: P = [lo[j][0], y0, lo[j][1]], c: P = [hi[j][0], y1, hi[j][1]], d: P = [hi[i][0], y1, hi[i][1]];
    // Which way it faces, against the way out from the middle.
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = d[0] - a[0], wy = d[1] - a[1], wz = d[2] - a[2];
    const nx = uy * wz - uz * wy, nz = ux * wy - uy * wx;
    const out = nx * ((a[0] + b[0]) / 2 - cx) + nz * ((a[2] + b[2]) / 2 - cz) >= 0;
    if (out) shapes.quad(a, b, c, d, s.color);
    else shapes.quad(d, c, b, a, s.color);
    const t1: P = [cx, y1, cz];
    const up = (c[0] - t1[0]) * (d[2] - t1[2]) - (c[2] - t1[2]) * (d[0] - t1[0]) < 0;
    if (up) shapes.tri(t1, c, d, s.color);
    else shapes.tri(t1, d, c, s.color);
  }
}

interface Moving {
  body: { translation(): { x: number; y: number; z: number }; rotation(): { x: number; y: number; z: number; w: number } };
  mesh: THREE.Object3D;
  was: { pos: THREE.Vector3; rot: THREE.Quaternion };
  now: { pos: THREE.Vector3; rot: THREE.Quaternion };
}

export class RigsView {
  private readonly moving: Moving[] = [];
  private readonly lamps: { rig: Rig; mesh: THREE.Mesh }[] = [];
  private readonly cables: { rig: Rig; mesh: THREE.Mesh; from: THREE.Vector3; to: Moving }[] = [];
  private readonly rocks: { rock: Rock; item: Moving }[] = [];
  /** Ropes from what floats to the quay or to the next boat: each a run of a few pieces, one instance each. */
  private readonly ropes: { from: THREE.Object3D; at: THREE.Vector3; to: THREE.Vector3; onto?: THREE.Object3D; color: number }[] = [];
  private ropeMesh?: THREE.InstancedMesh;
  private readonly spots: { hole: Hole; lamps: THREE.Mesh[] }[] = [];
  private readonly line = new THREE.Line3();
  private readonly near = new THREE.Vector3();
  private readonly at = new THREE.Vector3();
  private readonly toward = new THREE.Vector3();
  /** A ship's accommodation and the like: drawn apart from the rest of its part, to be faded; its box in the part's own frame. */
  private readonly faders: { group: THREE.Object3D; mesh: THREE.Mesh; material: THREE.MeshStandardMaterial; box: THREE.Box3; opacity: number }[] = [];
  private readonly ray = new THREE.Ray();
  private readonly inverse = new THREE.Matrix4();
  private readonly eye = new THREE.Vector3();
  private readonly aim = new THREE.Vector3();
  private readonly hit = new THREE.Vector3();
  private lastTime?: number;

  constructor(scene: THREE.Scene, rigs: readonly Rig[], rocks: readonly Rock[], holes: readonly Hole[] = []) {
    // A small round lamp on a little black base, as on site barriers: big enough to be seen from the cab.
    const globe = new THREE.CylinderGeometry(0.2, 0.22, 0.3, 14);
    const base = new THREE.BoxGeometry(0.34, 0.12, 0.34);
    for (const hole of holes) {
      const lamps = hole.lamps.map(([dx, dy, dz]) => {
        const [x, y, z] = hole.at;
        const foot = new THREE.Mesh(base, lampHousing);
        foot.position.set(x + dx, y + dy - 0.06, z + dz);
        const lamp = new THREE.Mesh(globe, darkLamp);
        lamp.position.set(x + dx, y + dy + 0.15, z + dz);
        lamp.add(foot);
        foot.position.set(0, -0.21, 0);
        scene.add(lamp);
        return lamp;
      });
      this.spots.push({ hole, lamps });
    }
    for (const rig of rigs) {
      const items = rig.parts.map((part, n) => {
        const solid = new Shapes(), fading = new Shapes();
        let fades = false;
        const group = new THREE.Group();
        for (const s of part.shapes) {
          if (s.hidden) continue;
          const shapes = s.fade ? fading : solid;
          fades ||= !!s.fade;
          if (s.kind === 'loft') loft(shapes, s);
          else if (s.kind === 'cyl') cylinder(shapes, s);
          else if (s.rot) turnedBox(shapes, s);
          else if (s.kind === 'ball') {
            const ball = new THREE.Mesh(new THREE.SphereGeometry(s.half[0], 18, 12), new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.4, metalness: 0.6 }));
            ball.position.set(...s.pos);
            ball.castShadow = true;
            group.add(ball);
          } else if (s.tilt) {
            const lean = new THREE.Mesh(new THREE.BoxGeometry(s.half[0] * 2, s.half[1] * 2, s.half[2] * 2), new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.6 }));
            lean.position.set(...s.pos);
            lean.rotation.x = s.tilt;
            lean.castShadow = true;
            group.add(lean);
          } else shapes.box(...s.pos, ...s.half, s.color);
        }
        const mesh = new THREE.Mesh(solid.geometry(), material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        if (fades) {
          const geometry = fading.geometry(), own = material.clone();
          geometry.computeBoundingBox();
          const faded = new THREE.Mesh(geometry, own);
          faded.castShadow = true;
          faded.receiveShadow = true;
          group.add(faded);
          this.faders.push({ group, mesh: faded, material: own, box: geometry.boundingBox!.clone(), opacity: 1 });
        }
        if (rig.lamp.part === n) {
          const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.28), lampOut);
          lamp.position.set(...rig.lamp.at);
          group.add(lamp);
          this.lamps.push({ rig, mesh: lamp });
        }
        scene.add(group);
        const item = this.track(part.body, group);
        return item;
      });
      if (rig.cable) {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), cableMaterial);
        scene.add(mesh);
        // Where it hangs from, in the world: on the fixed part, in its frame.
        const base = rig.parts[0].body;
        const p = base.translation(), r = base.rotation();
        const from = new THREE.Vector3(...rig.cable.from).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).add(new THREE.Vector3(p.x, p.y, p.z));
        // The crane's cable hangs from its jib's head, which turns with the jib: then it is taken from that part each frame.
        this.cables.push({ rig, mesh, from, to: items[rig.cable.part] });
      }
    }
    // The ropes, once every rig is placed: from each to the quay or to another.
    const first = rigs.map((rig) => this.moving.find((m) => m.body === rig.parts[0]?.body)?.mesh);
    rigs.forEach((rig, k) => {
      for (const line of rig.desc.lines ?? []) {
        const from = first[k];
        if (!from) continue;
        this.ropes.push({ from, at: new THREE.Vector3(...line.at), to: new THREE.Vector3(...line.to), onto: line.rig !== undefined ? first[line.rig] : undefined, color: line.color ?? 0xe8e4d8 });
      }
    });
    if (this.ropes.length) {
      this.ropeMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5), new THREE.MeshStandardMaterial({ roughness: 0.8 }), this.ropes.length * ROPE_PIECES);
      this.ropeMesh.frustumCulled = false;
      this.ropes.forEach((rope, k) => { for (let i = 0; i < ROPE_PIECES; i++) this.ropeMesh!.setColorAt(k * ROPE_PIECES + i, new THREE.Color(rope.color)); });
      scene.add(this.ropeMesh);
    }
    for (const rock of rocks) {
      const geometry = new THREE.DodecahedronGeometry(1, 0);
      geometry.scale(...rock.half);
      const mesh = new THREE.Mesh(geometry, rockMaterial);
      mesh.castShadow = true;
      mesh.visible = false;
      scene.add(mesh);
      this.rocks.push({ rock, item: this.track(rock.body, mesh) });
    }
  }

  private track(body: Moving['body'], mesh: THREE.Object3D): Moving {
    const item: Moving = { body, mesh, was: { pos: new THREE.Vector3(), rot: new THREE.Quaternion() }, now: { pos: new THREE.Vector3(), rot: new THREE.Quaternion() } };
    this.moving.push(item);
    this.read(item);
    item.was.pos.copy(item.now.pos);
    item.was.rot.copy(item.now.rot);
    return item;
  }

  private read(item: Moving): void {
    const p = item.body.translation(), r = item.body.rotation();
    item.now.pos.set(p.x, p.y, p.z);
    item.now.rot.set(r.x, r.y, r.z, r.w);
  }

  /** Call after each physics step. */
  capture(): void {
    for (const item of this.moving) {
      item.was.pos.copy(item.now.pos);
      item.was.rot.copy(item.now.rot);
      this.read(item);
    }
  }

  /** Straight to where things are now: after a jump or a restart. */
  snap(): void {
    for (const item of this.moving) {
      this.read(item);
      item.was.pos.copy(item.now.pos);
      item.was.rot.copy(item.now.rot);
    }
  }

  /** `camera` and `truck`: lamps near the line between the two are left out, so as not to fill the view as the camera passes them. */
  apply(alpha: number, time: number, camera?: THREE.Vector3, truck?: THREE.Vector3): void {
    for (const item of this.moving) {
      item.mesh.position.lerpVectors(item.was.pos, item.now.pos, alpha);
      item.mesh.quaternion.slerpQuaternions(item.was.rot, item.now.rot, alpha);
    }
    if (this.ropeMesh) {
      // Each rope between its two ends as they are now, hanging a little in the middle.
      const a = new THREE.Vector3(), b = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      const m = new THREE.Matrix4(), turn = new THREE.Quaternion(), size = new THREE.Vector3();
      this.ropes.forEach((rope, k) => {
        a.copy(rope.at).applyQuaternion(rope.from.quaternion).add(rope.from.position);
        if (rope.onto) b.copy(rope.to).applyQuaternion(rope.onto.quaternion).add(rope.onto.position);
        else b.copy(rope.to);
        const sag = a.distanceTo(b) * 0.04;
        for (let i = 0; i < ROPE_PIECES; i++) {
          const t0 = i / ROPE_PIECES, t1 = (i + 1) / ROPE_PIECES;
          p.lerpVectors(a, b, t0).y -= sag * 4 * t0 * (1 - t0);
          q.lerpVectors(a, b, t1).y -= sag * 4 * t1 * (1 - t1);
          const long = p.distanceTo(q);
          turn.setFromUnitVectors(up, q.clone().sub(p).normalize());
          m.compose(p.clone().add(q).multiplyScalar(0.5), turn, size.set(0.035, long, 0.035));
          this.ropeMesh!.setMatrixAt(k * ROPE_PIECES + i, m);
        }
      });
      this.ropeMesh.instanceMatrix.needsUpdate = true;
    }
    for (const { rock, item } of this.rocks) {
      // A rock jumping from where it waited to the belt is not to be seen streaking up.
      item.mesh.visible = rock.falling;
      if (rock.falling && item.was.pos.distanceTo(item.now.pos) > 5) item.mesh.position.copy(item.now.pos);
    }
    const flash = time % 0.5 < 0.25;
    for (const { hole, lamps } of this.spots) {
      const material = hole.light === 'fall' ? fallLamp : hole.light === 'warn' && time % 0.24 < 0.14 ? warnLamp : darkLamp;
      for (const lamp of lamps) {
        lamp.material = material;
        if (!camera || !truck) continue;
        this.line.set(camera, truck);
        this.line.closestPointToPoint(lamp.position, true, this.near);
        lamp.visible = this.near.distanceTo(lamp.position) > 3 || this.near.distanceTo(truck) < 2;
      }
    }
    for (const { rig, mesh } of this.lamps) mesh.material = rig.warn && flash ? lampLit : lampOut;
    if (camera && truck) this.fade(camera, truck, Math.min(0.1, time - (this.lastTime ?? time)));
    this.lastTime = time;
    for (const cable of this.cables) {
      const to = this.at.set(...cable.rig.cable!.at).applyQuaternion(cable.to.mesh.quaternion).add(cable.to.mesh.position);
      let from = cable.from;
      if (cable.rig.cable!.part === 2) {
        // A crane's: from the head of its jib, which turns.
        const jib = this.moving.find((m) => m.body === cable.rig.parts[1].body)!.mesh;
        from = new THREE.Vector3(...cable.rig.cable!.from).sub(new THREE.Vector3(0, 1.3, 0)).applyQuaternion(jib.quaternion).add(jib.position);
      }
      // On to a ball: at the point of it facing up the cable, wherever the cable comes from.
      const onto = cable.rig.cable!.onto;
      if (onto) to.addScaledVector(this.toward.copy(from).sub(to).normalize(), onto);
      const length = from.distanceTo(to);
      cable.mesh.position.copy(from).add(to).multiplyScalar(0.5);
      cable.mesh.scale.set(1, length, 1);
      cable.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    }
  }

  /** Fading what is marked to fade while it is between the camera and the truck: looked for in each part's own frame, as it moves. */
  private fade(camera: THREE.Vector3, truck: THREE.Vector3, dt: number): void {
    const ease = 1 - Math.exp(-FADE_RATE * dt);
    for (const f of this.faders) {
      f.group.updateMatrixWorld();
      this.inverse.copy(f.group.matrixWorld).invert();
      this.eye.copy(camera).applyMatrix4(this.inverse);
      this.aim.copy(truck).applyMatrix4(this.inverse);
      this.ray.origin.copy(this.eye);
      this.ray.direction.copy(this.aim).sub(this.eye).normalize();
      const point = this.ray.intersectBox(f.box, this.hit);
      const target = point !== null && point.distanceTo(this.eye) < this.eye.distanceTo(this.aim) ? FADED_OPACITY : 1;
      if (f.opacity === target) continue;
      f.opacity += (target - f.opacity) * ease;
      if (Math.abs(f.opacity - target) < 0.01) f.opacity = target;
      // Only pay for transparency while it is actually see-through.
      const transparent = f.opacity < 1;
      f.material.opacity = f.opacity;
      if (f.material.transparent !== transparent) {
        f.material.transparent = transparent;
        f.material.depthWrite = !transparent;
        f.material.needsUpdate = true;
      }
    }
  }
}

/** How many straight pieces a rope is drawn in. */
const ROPE_PIECES = 4;
