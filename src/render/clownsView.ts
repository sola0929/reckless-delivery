import * as THREE from 'three';
import { JUGGLED, juggled } from '../sim/clowns';
import type { MirrorClown as Clown } from '../sim/mirror';

/** Each one's suit, ruff, hat and hair. */
const COSTUMES: [number, number, number, number][] = [
  [0xe8544a, 0xf2c12e, 0x3f7fd0, 0xf28a2e],
  [0x3f7fd0, 0xffffff, 0xf2c12e, 0xd8302a],
  [0x4fa86a, 0xf08ac0, 0xe8544a, 0xf2c12e],
];
/** How far up the figure is lifted onto the saddle, riding. */
const RIDING = 0.22;
/** The face, calm and flushed with the effort of keeping up. */
const FACE = new THREE.Color(0xfaf4ee), FLUSHED = new THREE.Color(0xf2a49a);
/** Sweat drops flying off the head at once. */
const DROPS = 4;

interface Arm {
  group: THREE.Group;
  sleeve: THREE.Mesh;
  glove: THREE.Mesh;
}

interface Figure {
  wheel: THREE.Group;
  /** The wheel itself, turning on its hub. */
  spin: THREE.Group;
  person: THREE.Group;
  legs: THREE.Object3D[];
  arms: Arm[];
  balls: THREE.Group[];
  face: THREE.MeshStandardMaterial;
  eyes: THREE.Object3D[];
  crosses: THREE.Object3D[];
  brows: THREE.Mesh[];
  smile: THREE.Mesh;
  gasp: THREE.Mesh;
  cheeks: THREE.Mesh[];
  drops: THREE.Mesh[];
  /** The one on the forehead, when it is getting too much. */
  bead: THREE.Mesh;
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Draws the clowns: the unicycle, the clown on it in a spotted suit with pompom buttons, a frilled ruff, a white face,
 * a red nose, white gloves, a pointed hat; the balls going up and round over their hands. Held up on the spot (the sim's
 * strain) they rock and tremble harder and harder, the arms go out, the juggling goes wild, they sweat, flush, and the
 * smile turns to raised brows and an open mouth; thrown, the eyes are crosses. The clown and the wheel are drawn each
 * where they are then; the balls are the object system's, and drawn with the rest of what is loose.
 */
export class ClownsView {
  private readonly figures: Figure[];

  constructor(scene: THREE.Scene, private readonly clowns: readonly Clown[], private readonly now: () => number) {
    const paint = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const mesh = (geometry: THREE.BufferGeometry, color: number | THREE.Material, at: [number, number, number] = [0, 0, 0]) => {
      const m = new THREE.Mesh(geometry, typeof color === 'number' ? paint(color) : color);
      m.position.set(...at);
      m.castShadow = true;
      return m;
    };
    const sweat = new THREE.MeshStandardMaterial({ color: 0x9fd8f5, roughness: 0.1, transparent: true, opacity: 0.85 });
    const drop = () => new THREE.SphereGeometry(0.035, 7, 5).scale(1, 1.5, 1);
    this.figures = clowns.map((_, i) => {
      const [suit, ruff, hat, hair] = COSTUMES[i % COSTUMES.length];
      // The unicycle: a tyre round a rim, spokes, the fork up to the saddle, the pedals.
      const wheel = new THREE.Group(), spin = new THREE.Group();
      spin.position.y = 0.45;
      spin.add(mesh(new THREE.TorusGeometry(0.4, 0.05, 8, 24).rotateY(Math.PI / 2), 0x24262a));
      spin.add(mesh(new THREE.TorusGeometry(0.36, 0.02, 6, 24).rotateY(Math.PI / 2), 0xc8ccd0));
      for (let k = 0; k < 3; k++) spin.add(mesh(new THREE.BoxGeometry(0.015, 0.72, 0.015).rotateX((k * Math.PI) / 3), 0xc8ccd0));
      spin.add(mesh(new THREE.BoxGeometry(0.03, 0.3, 0.05).translate(0.14, -0.15, 0), 0x8a8f96), mesh(new THREE.BoxGeometry(0.03, 0.3, 0.05).translate(-0.14, 0.15, 0), 0x8a8f96));
      wheel.add(spin);
      for (const s of [-1, 1]) wheel.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6), 0xe8544a, [s * 0.07, 0.75, 0]));
      wheel.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12), 0xe8544a, [0, 1.07, 0]));
      wheel.add(mesh(new THREE.BoxGeometry(0.14, 0.05, 0.28), 0x24262a, [0, 1.15, 0]));
      // The clown, standing: feet at the ground. Big shoes, baggy legs, a spotted suit with pompom buttons.
      const person = new THREE.Group();
      const legs = [-1, 1].map((s) => {
        const leg = new THREE.Group();
        leg.position.set(s * 0.12, 0.85, 0);
        leg.add(mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.8).translate(0, -0.4, 0), suit));
        leg.add(mesh(new THREE.BoxGeometry(0.16, 0.1, 0.36).translate(0, -0.82, 0.08), 0xd8302a));
        leg.add(mesh(new THREE.SphereGeometry(0.09, 8, 6).scale(1, 0.7, 1.2), 0xd8302a, [0, -0.8, 0.24]));
        person.add(leg);
        return leg;
      });
      person.add(mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.62), suit, [0, 1.15, 0]));
      [[0.14, 1.3, 0.19], [-0.13, 1.12, 0.22], [0.15, 0.97, 0.23], [-0.16, 1.35, 0.13], [0.21, 1.12, 0.12], [-0.21, 0.98, 0.14]].forEach(([x, y, z], k) =>
        person.add(mesh(new THREE.SphereGeometry(0.04, 6, 5), [0xffffff, 0xf2c12e, 0x3f7fd0][k % 3], [x, y, z])));
      for (const [y, z] of [[1.33, 0.23], [1.15, 0.255], [0.97, 0.265]]) person.add(mesh(new THREE.SphereGeometry(0.055, 8, 6), [0xffffff, ruff, hat][Math.round(y * 10) % 3], [0, y, z]));
      // A frilled ruff: a ring of puffs round a collar.
      person.add(mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 14), ruff, [0, 1.48, 0]));
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        person.add(mesh(new THREE.SphereGeometry(0.075, 7, 5).scale(1, 0.6, 1), k % 2 ? ruff : 0xffffff, [Math.sin(a) * 0.27, 1.48 + (k % 2) * 0.02, Math.cos(a) * 0.27]));
      }
      // The face: white, a red nose, cheeks, brows; eyes, or crosses for eyes; a smile, or a mouth open wide.
      const face = paint(0xfaf4ee);
      person.add(mesh(new THREE.SphereGeometry(0.19, 14, 10), face, [0, 1.68, 0]));
      person.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), 0xd8302a, [0, 1.67, 0.19]));
      const ink = paint(0x24262a);
      const eyes: THREE.Object3D[] = [], crosses: THREE.Object3D[] = [], brows: THREE.Mesh[] = [], cheeks: THREE.Mesh[] = [];
      for (const s of [-1, 1]) {
        const eye = mesh(new THREE.SphereGeometry(0.03, 6, 5), ink, [s * 0.07, 1.74, 0.16]);
        const cross = new THREE.Group();
        cross.position.set(s * 0.07, 1.74, 0.165);
        cross.rotation.x = -0.45;
        for (const r of [-1, 1]) cross.add(mesh(new THREE.BoxGeometry(0.07, 0.014, 0.014).rotateZ(r * 0.8), ink));
        const brow = mesh(new THREE.BoxGeometry(0.07, 0.016, 0.016), ink, [s * 0.07, 1.8, 0.15]);
        brow.rotation.x = -0.6;
        const cheek = mesh(new THREE.SphereGeometry(0.035, 7, 5).scale(1, 0.6, 0.4), 0xf28a8a, [s * 0.11, 1.64, 0.145]);
        cheek.rotation.y = s * 0.7;
        person.add(eye, cross, brow, cheek, mesh(new THREE.SphereGeometry(0.11, 8, 6), hair, [s * 0.18, 1.7, -0.03]));
        eyes.push(eye), crosses.push(cross), brows.push(brow), cheeks.push(cheek);
      }
      const lips = paint(0xd8302a);
      const smile = mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 12, Math.PI).rotateZ(Math.PI), lips, [0, 1.62, 0.165]);
      smile.rotation.x = -0.35;
      const gasp = mesh(new THREE.TorusGeometry(0.03, 0.016, 6, 12), lips, [0, 1.59, 0.168]);
      gasp.rotation.x = -0.4;
      gasp.add(mesh(new THREE.CircleGeometry(0.03, 10), 0x5a1a1a));
      person.add(smile, gasp);
      person.add(mesh(new THREE.ConeGeometry(0.14, 0.4, 12), hat, [0, 2.0, 0]));
      person.add(mesh(new THREE.SphereGeometry(0.05, 6, 5), 0xffffff, [0, 2.21, 0]));
      // Sweat: drops flying off either side of the head, one bead on the forehead.
      const drops = Array.from({ length: DROPS }, () => mesh(drop(), sweat));
      const bead = mesh(drop(), sweat, [0.09, 1.79, 0.15]);
      person.add(...drops, bead);
      // Arms out to white gloves.
      const arms = [-1, 1].map((s) => {
        const group = new THREE.Group();
        group.position.set(s * 0.25, 1.4, 0);
        const sleeve = mesh(new THREE.CylinderGeometry(0.055, 0.055, 1).translate(0, 0.5, 0), suit);
        const glove = mesh(new THREE.SphereGeometry(0.075, 8, 6).scale(1, 1.15, 0.8), 0xffffff);
        group.add(sleeve, glove);
        person.add(group);
        return { group, sleeve, glove };
      });
      const balls = Array.from({ length: JUGGLED }, () => {
        const ball = new THREE.Group();
        ball.add(mesh(new THREE.SphereGeometry(0.2, 12, 9), 0xd8302a));
        ball.add(mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.07, 14), 0xf2c12e));
        ball.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14), 0x2a2c30, [0, 0.25, 0]));
        const spark = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe07a }));
        spark.position.y = 0.33;
        ball.add(spark);
        scene.add(ball);
        return ball;
      });
      scene.add(wheel, person);
      return { wheel, spin, person, legs, arms, balls, face, eyes, crosses, brows, smile, gasp, cheeks, drops, bead };
    });
    this.update();
  }

  /** Call once a frame. */
  update(): void {
    const time = this.now();
    this.clowns.forEach((clown, i) => {
      const f = this.figures[i];
      const riding = clown.state === 'riding';
      const lying = clown.state === 'thrown' || clown.state === 'down';
      const strain = riding ? clown.strain : 0;
      if (riding) {
        // Never still on one wheel: a wobble, more when they are holding their place than when they ride; held up
        // there, rocking to and fro on the wheel and trembling, more and more until they go over.
        const wobble = Math.sin(time * 2.4 + i) * (clown.speed < 0.3 ? 0.06 : 0.03) * (1 + strain * 0.8);
        const rock = Math.sin(time * (2.6 + strain * 1.2) + i) * 0.07 * smooth(0, 0.6, strain);
        const tremble = Math.sin(time * 23 + i * 3) * 0.012 * smooth(0.5, 1, strain);
        const fx = Math.sin(clown.yaw), fz = Math.cos(clown.yaw);
        const x = clown.x + fx * rock, z = clown.z + fz * rock;
        f.wheel.position.set(x, 0, z);
        f.wheel.rotation.set(0, clown.yaw, wobble + tremble, 'YXZ');
        f.spin.rotation.x = ((clown.s + rock) / 0.45) % (Math.PI * 2);
        f.person.position.set(x, RIDING, z);
        f.person.rotation.set(-rock * 1.2 + tremble, clown.yaw, (wobble + tremble) * 1.3, 'YXZ');
        // Pedalling: the legs go round with the wheel.
        f.legs.forEach((leg, k) => (leg.rotation.x = Math.sin(f.spin.rotation.x + k * Math.PI) * 0.35 - 0.2));
        // Hands where the balls are thrown from and caught; losing it, the arms go out and wave for balance.
        const flail = smooth(0.4, 0.85, strain);
        f.arms.forEach((arm, k) => {
          const side = k ? 1 : -1;
          arm.group.rotation.set(1.8 - flail * (0.8 + Math.sin(time * 5 + k * 2) * 0.3), 0, side * (0.12 + flail * (1.0 + Math.sin(time * 4 + k) * 0.25)));
          this.reach(arm, 0.45 + flail * 0.2);
        });
      } else {
        // Thrown, lying there, or up and walking: the wheel each where it is, lying over or wheeled along.
        f.wheel.position.copy(clown.wheel).setY(clown.wheel.y - 0.45);
        f.wheel.rotation.set(0, clown.yaw, clown.state === 'returning' ? 0 : clown.tumble, 'YXZ');
        f.person.position.copy(clown.person);
        if (lying) f.person.position.y += 0.25;
        f.person.rotation.set(lying ? -Math.PI / 2 : 0, clown.yaw, 0, 'YXZ');
        const stride = lying ? 0 : Math.sin(time * 9 + i) * 0.5;
        f.legs.forEach((leg, k) => (leg.rotation.x = k ? stride : -stride));
        f.arms.forEach((arm, k) => {
          arm.group.rotation.set(lying ? 0.4 : Math.PI, 0, (k ? -1 : 1) * (lying ? 2.4 : 0.15));
          this.reach(arm, 0.6);
        });
      }
      // The face: the smile goes to raised brows and an open mouth, the white to red; thrown, crosses for eyes.
      const worry = riding ? smooth(0.2, 0.7, strain) : lying ? 1 : 0.5;
      f.eyes.forEach((eye) => (eye.visible = !lying));
      f.crosses.forEach((cross) => (cross.visible = lying));
      f.brows.forEach((brow, k) => {
        brow.rotation.z = (k ? -1 : 1) * 0.5 * worry;
        brow.position.y = 1.8 + worry * 0.025;
      });
      const gasping = lying || strain > 0.45;
      f.smile.visible = !gasping;
      f.gasp.visible = gasping;
      f.gasp.scale.setScalar(1 + (lying ? 0.4 : smooth(0.45, 1, strain) * 0.6));
      f.face.color.lerpColors(FACE, FLUSHED, riding ? smooth(0.15, 0.9, strain) : clown.state === 'returning' ? 0.3 : 0);
      f.cheeks.forEach((cheek) => cheek.scale.setScalar(1 + strain * 0.8));
      // Sweat flying off the head, more and faster the longer they are held; a bead running on the forehead.
      const sweating = smooth(0.2, 0.5, strain);
      f.drops.forEach((drop, k) => {
        const u = (time * (1.4 + strain * 1.6) + k / DROPS) % 1;
        const side = k % 2 ? 1 : -1;
        drop.visible = sweating > 0 && u < 0.85;
        drop.position.set(side * (0.16 + u * 0.45), 1.8 + u * 0.35 - u * u * 0.9, 0.04 + (k >> 1) * 0.06);
        drop.scale.setScalar(sweating * (1 - u * 0.4));
      });
      f.bead.visible = strain > 0.5;
      f.bead.position.y = 1.8 - ((time * 0.4 + i * 0.3) % 1) * 0.1;
      f.balls.forEach((ball, k) => {
        ball.visible = riding && clown.juggling;
        if (!ball.visible) return;
        // Losing it, the balls go wild: higher, wider, out of step.
        const at = juggled(k, time + Math.sin(time * 3 + k) * 0.06 * strain, clown.yaw);
        const wild = smooth(0.3, 1, strain);
        ball.position.set(clown.x + at.x + Math.sin(time * 4 + k * 2) * 0.2 * wild, at.y + Math.abs(Math.sin(time * 3 + k)) * 0.4 * wild, clown.z + at.z + Math.cos(time * 3.5 + k) * 0.2 * wild);
        ball.rotation.set(time * 4 + k, time * 3, 0);
      });
    });
  }

  /** An arm drawn out to its length, the glove at the end. */
  private reach(arm: Arm, length: number): void {
    arm.sleeve.scale.y = length;
    arm.glove.position.y = length + 0.04;
  }
}
