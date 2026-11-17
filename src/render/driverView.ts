import * as THREE from 'three';
import { DRIVER } from '../config';
import type { MirrorDriver as Driver } from '../sim/mirror';

const ARC_POINTS = 22;
/** A shove let go: seconds to thrust forward, to stay there, and to come back to standing. */
const SHOVE_IN = 0.15, SHOVE_HOLD = 0.15, SHOVE_BACK = 0.3;
/** Height of the hips, where the legs hang from and the body bends; and from there to the soles. */
const HIP = 0.6, LEG = 0.5;
/** Their shape seen through what hides them: a pale yellow, the colour of the game's aiming aids, not the red truck's. */
const SILHOUETTE = 0xffd98a;
const GRAVITY = new THREE.Vector3(0, -9.81, 0);
/** How much of its own colour the figure shows in the dark, without any light on it. */
const DARK_GLOW = 0.28;

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
  /** A headlamp on the cap, worn only in the dark; its glass, lit when it is on. */
  readonly lamp = new THREE.Group();
  private readonly glass = new THREE.MeshBasicMaterial({ color: 0x3a3a36 });
  /** What the figure is made of, and the colour of each: in the dark, a little of its own light. */
  private readonly worn: THREE.MeshStandardMaterial[];
  private phase = 0;
  private lift = 0;
  private tuck = 0;
  /** Squared up to the truck to shove it, 0 to 1; how far drawn back, 0 to 1; seconds since the last shove; shoves seen so far. */
  private brace = 0;
  private drawn = 0;
  private sinceShove = 99;
  private shoveCount = 0;

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
    // The headlamp: its strap round the cap, the lamp at the front of the crown above the peak, tipped down a little.
    const black = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.6 });
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.272, 0.022, 6, 28).rotateX(Math.PI / 2), black);
    strap.position.y = 1.6;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.08), black);
    housing.position.set(0, 1.63, 0.29);
    housing.rotation.x = 0.35;
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.04, 14), this.glass);
    glass.position.set(0, 1.62, 0.334);
    glass.rotation.x = 0.35;
    this.lamp.add(strap, housing, glass);
    this.lamp.visible = false;
    this.torso.add(this.lamp);
    this.worn = [skin, cloth];

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

    // Behind the truck, or anything else solid, they are still seen: their shape in one flat colour through it. Each part
    // is drawn twice. The second, flat, only where something already drawn is nearer, and drawn after the world and before
    // the figure itself, so that the figure does not show through its own arms and legs, only through what is in front.
    const seen = new THREE.MeshBasicMaterial({ color: SILHOUETTE, depthFunc: THREE.GreaterDepth, depthWrite: false });
    const parts: THREE.Mesh[] = [];
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) parts.push(o);
    });
    for (const part of parts) {
      part.renderOrder = 2;
      const shape = new THREE.Mesh(part.geometry, seen);
      shape.renderOrder = 1;
      part.add(shape);
    }

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

  /**
   * In the dark (0 to 1, by how dark): the headlamp on, and the figure a little lit of itself, as if by what the lamp throws
   * back, so whoever is played is never only a black shape.
   */
  inTheDark(k: number): void {
    this.lamp.visible = k > 0.01;
    this.glass.color.setHex(k > 0.5 ? 0xfff6e0 : 0x3a3a36);
    for (const m of this.worn) m.emissive.copy(m.color).multiplyScalar(DARK_GLOW * k);
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

    // The figure turns quickly but not in a blink: a tenth of a second or so round to the way they face.
    const turn = Math.atan2(Math.sin(driver.yaw - this.root.rotation.y), Math.cos(driver.yaw - this.root.rotation.y));
    this.root.rotation.y += turn * (1 - Math.exp(-28 * dt));
    this.leash.position.set(truck.x, 0.06, truck.z);
    (this.leash.material as THREE.LineBasicMaterial).color.set(driver.atLeash ? 0xff5040 : 0xffffff);

    const down = driver.mode === 'down';
    // Knocked flat on their back; otherwise upright.
    this.figure.rotation.x += ((down ? -Math.PI / 2 : 0) - this.figure.rotation.x) * (1 - Math.exp(-14 * dt));
    // Drawn a touch lower than the physics has them, which holds their feet just clear of the ground.
    this.figure.position.y = down ? 0.3 : -0.04;

    // Arms and legs swing as they walk, faster and wider when running.
    this.phase += driver.speed * dt * 2.4;
    const stride = Math.sin(this.phase) * 0.75 * Math.min(1, driver.speed / DRIVER.walkSpeed);
    // In the air they hold a leaping pose: one leg ahead, one trailing, arms thrown forward.
    // (Negative turns a limb forward, positive back.)
    this.tuck += ((driver.airborne && !down ? 1 : 0) - this.tuck) * (1 - Math.exp(-18 * dt));
    this.legs[0].rotation.x = stride * (1 - this.tuck) - 0.45 * this.tuck;
    this.legs[1].rotation.x = -stride * (1 - this.tuck) + 0.35 * this.tuck;

    // Carrying, both arms go straight up to hold the load overhead.
    this.lift += ((driver.held ? 1 : 0) - this.lift) * (1 - Math.exp(-12 * dt));
    const up = Math.PI * 0.97 * this.lift;
    const free = 1 - this.lift;
    const leap = -0.9 * this.tuck;
    this.arms[0].rotation.x = (-stride * (1 - this.tuck) + leap) * free - up;
    this.arms[1].rotation.x = (stride * (1 - this.tuck) + leap) * free - up;
    // Leaning back as a throw is wound up.
    const wound = Math.min(1, driver.charge / 1.5);
    this.torso.rotation.x = -0.3 * wound;
    // Shoving the truck. Wound up: leaning back, both arms raised level and drawn back along their sides, further the longer
    // it is held, trembling once it is as hard as it goes. Let go: all at once forward, arms thrust out; a moment there; back.
    if (driver.shoves !== this.shoveCount) {
      if (driver.shoves > this.shoveCount) this.sinceShove = 0;
      this.shoveCount = driver.shoves;
    }
    this.sinceShove += dt;
    const s = this.sinceShove;
    const thrust = s < SHOVE_IN ? 1 - (1 - s / SHOVE_IN) ** 3 : s < SHOVE_IN + SHOVE_HOLD ? 1 : Math.max(0, 1 - (s - SHOVE_IN - SHOVE_HOLD) / SHOVE_BACK);
    const pulled = driver.shove ? Math.min(1, (driver.shove.power - DRIVER.shoveLeast) / (1 - DRIVER.shoveLeast)) : 0;
    this.brace += ((driver.shove ? 1 : 0) - this.brace) * (1 - Math.exp(-14 * dt));
    this.drawn += (pulled - this.drawn) * (1 - Math.exp(-14 * dt));
    const level = Math.max(this.brace, thrust);
    const shake = driver.shove && pulled >= 1 ? (Math.random() - 0.5) * 0.06 : 0;
    for (const arm of this.arms) {
      arm.rotation.x += (-Math.PI / 2 - arm.rotation.x) * level;
      arm.position.z = -0.3 * this.drawn * this.brace * (1 - thrust) + 0.22 * thrust;
    }
    this.torso.position.set(0, 0, 0);
    if (level > 0.01) {
      const back = this.drawn * this.brace * (1 - thrust);
      const lean = -0.4 * back + 0.5 * thrust + shake;
      // Bent at the hips, not at the feet: the body stays over the legs as it leans.
      this.torso.rotation.x = lean;
      this.torso.position.set(0, HIP * (1 - Math.cos(lean)), -HIP * Math.sin(lean));
      // And the feet set to it: one ahead and one braced behind while drawing back, a long lunge as it goes.
      const ahead = -0.3 * back - 0.55 * thrust, behind = 0.5 * back + 0.65 * thrust;
      this.legs[0].rotation.x += (ahead - this.legs[0].rotation.x) * level;
      this.legs[1].rotation.x += (behind - this.legs[1].rotation.x) * level;
      // Feet apart, the hips come down, so that both stay on the ground.
      const a = this.legs[0].rotation.x, b = this.legs[1].rotation.x;
      this.figure.position.y -= LEG * (2 - Math.cos(a) - Math.cos(b)) / 2;
    }
    this.torso.rotation.z = shake * 0.6;

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
