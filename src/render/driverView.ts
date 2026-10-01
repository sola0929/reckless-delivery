import * as THREE from 'three';
import { DRIVER } from '../config';
import type { Driver } from '../sim/driver';

const ARC_POINTS = 22;
const GRAVITY = new THREE.Vector3(0, -9.81, 0);

/** A capsule limb hanging from a pivot at its top, so rotating the pivot swings it. */
function limb(radius: number, length: number, material: THREE.Material): THREE.Group {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), material);
  mesh.position.y = -length / 2;
  mesh.castShadow = true;
  pivot.add(mesh);
  return pivot;
}

/**
 * The driver on foot: a smooth white figure in a red cap. Also draws the aids that go with it: the arc and landing point of a throw being
 * wound up, and the ring showing how far from the truck it may go.
 */
export class DriverView {
  readonly root = new THREE.Group();
  private readonly figure = new THREE.Group();
  private readonly torso: THREE.Group;
  private readonly arms: THREE.Group[] = [];
  private readonly legs: THREE.Group[] = [];
  private readonly arc: THREE.InstancedMesh;
  private readonly landing: THREE.Mesh;
  private readonly leash: THREE.LineLoop;
  private phase = 0;
  private lift = 0;
  private tuck = 0;

  constructor(scene: THREE.Scene) {
    const skin = new THREE.MeshStandardMaterial({ color: 0xe9e9e6, roughness: 0.55 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0xe23a2a, roughness: 0.7 });

    this.torso = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 6, 16), skin);
    body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 16), skin);
    head.position.y = 1.47;
    // A cap, whose peak shows which way they face. Seen from above, a plain round head doesn't.
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.285, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), cloth);
    crown.position.y = 1.5;
    const peak = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.035, 20, 1, false, -Math.PI / 2, Math.PI), cloth);
    peak.scale.z = 1.5;
    peak.position.set(0, 1.52, 0.2);
    for (const part of [body, head, crown, peak]) {
      part.castShadow = true;
      this.torso.add(part);
    }

    for (const side of [1, -1]) {
      const arm = limb(0.085, 0.42, skin);
      arm.position.set(side * 0.37, 1.28, 0);
      this.arms.push(arm);
      const leg = limb(0.1, 0.4, skin);
      leg.position.set(side * 0.14, 0.6, 0);
      this.legs.push(leg);
      this.torso.add(arm);
      this.figure.add(leg);
    }
    this.figure.add(this.torso);
    this.root.add(this.figure);
    this.root.visible = false;
    scene.add(this.root);

    // The path of the throw, as a string of dots.
    this.arc = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false }),
      ARC_POINTS,
    );
    this.arc.renderOrder = 10;
    this.arc.frustumCulled = false;
    this.landing = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.5, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9, depthTest: false }),
    );
    this.landing.renderOrder = 10;

    const circle: number[] = [];
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      circle.push(Math.cos(a) * DRIVER.leash, 0, Math.sin(a) * DRIVER.leash);
    }
    this.leash = new THREE.LineLoop(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(circle, 3)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }),
    );
    this.leash.frustumCulled = false;
    for (const aid of [this.arc, this.landing, this.leash]) {
      aid.visible = false;
      scene.add(aid);
    }
  }

  update(dt: number, driver: Driver, truck: THREE.Vector3): void {
    const out = driver.mode !== 'driving';
    // The driver moves once per physics step; ease toward them so the figure and the camera
    // following it stay smooth at higher frame rates. Just out of the cab, start in place.
    if (!this.root.visible) this.root.position.copy(driver.pos);
    else this.root.position.lerp(driver.pos, 1 - Math.exp(-30 * dt));
    this.root.visible = out;
    this.leash.visible = out;
    this.arc.visible = this.landing.visible = driver.plan !== null;
    if (!out) return;

    this.root.rotation.y = driver.yaw;
    this.leash.position.set(truck.x, 0.06, truck.z);
    (this.leash.material as THREE.LineBasicMaterial).color.set(driver.atLeash ? 0xff5040 : 0xffffff);

    const down = driver.mode === 'down';
    // Knocked flat on their back; otherwise upright.
    this.figure.rotation.x += ((down ? -Math.PI / 2 : 0) - this.figure.rotation.x) * (1 - Math.exp(-14 * dt));
    this.figure.position.y = down ? 0.3 : 0;

    // Arms and legs swing as they walk, faster and wider when running.
    this.phase += driver.speed * dt * 2.4;
    const stride = Math.sin(this.phase) * 0.75 * Math.min(1, driver.speed / DRIVER.walkSpeed);
    // In the air, both legs tuck back.
    this.tuck += ((driver.airborne && !down ? 1 : 0) - this.tuck) * (1 - Math.exp(-16 * dt));
    this.legs[0].rotation.x = stride * (1 - this.tuck) + 0.9 * this.tuck;
    this.legs[1].rotation.x = -stride * (1 - this.tuck) + 0.9 * this.tuck;

    // Carrying, both arms go straight up to hold the load overhead.
    this.lift += ((driver.held ? 1 : 0) - this.lift) * (1 - Math.exp(-12 * dt));
    const up = Math.PI * 0.97 * this.lift;
    this.arms[0].rotation.x = -stride * (1 - this.lift) - up;
    this.arms[1].rotation.x = stride * (1 - this.lift) - up;
    // Leaning back as a throw is wound up.
    const wound = Math.min(1, driver.charge / 1.5);
    this.torso.rotation.x = -0.3 * wound;

    const plan = driver.plan;
    if (!plan) return;
    const p = new THREE.Vector3();
    const dot = new THREE.Matrix4();
    for (let i = 0; i < ARC_POINTS; i++) {
      const t = (i / (ARC_POINTS - 1)) * plan.time;
      p.copy(plan.start).addScaledVector(plan.velocity, t).addScaledVector(GRAVITY, 0.5 * t * t);
      this.arc.setMatrixAt(i, dot.makeTranslation(p.x, p.y, p.z));
    }
    this.arc.instanceMatrix.needsUpdate = true;
    const color = plan.inBed ? 0x4dff88 : 0xffd166;
    (this.arc.material as THREE.MeshBasicMaterial).color.set(color);
    (this.landing.material as THREE.MeshBasicMaterial).color.set(color);
    this.landing.position.copy(plan.landing);
  }
}
