import * as THREE from 'three';
import type { Hole, Rock } from '../sim/droppers';
import type { Rig } from '../sim/rigs';
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
  private readonly spots: { hole: Hole; lamps: THREE.Mesh[] }[] = [];
  private readonly line = new THREE.Line3();
  private readonly near = new THREE.Vector3();
  private readonly at = new THREE.Vector3();
  private readonly toward = new THREE.Vector3();

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
        const shapes = new Shapes();
        const group = new THREE.Group();
        for (const s of part.shapes) {
          if (s.kind === 'ball') {
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
        const mesh = new THREE.Mesh(shapes.geometry(), material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
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
}
