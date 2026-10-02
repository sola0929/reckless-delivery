import * as THREE from 'three';
import type { BattleDesc } from '../levels/types';
import { TANK_HALF, type Battle, SHELL_RING } from '../sim/battle';
import { Shapes } from './shapes';

// What a battle looks like: the circle where a shell is about to land and the mark it
// leaves, a gun's line and its tracers, a launcher's aim and its rocket, a tank and the
// way its gun is pointing, smoke, mud and wire.

/** The two armies. */
const ARMY = [0x4f7a9a, 0xc8713a];
const WARN = 0xff3a2a;
const DARK = 0x2a2e34;
const flat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
const glow = (color: number, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });

function solid(shapes: Shapes): THREE.Mesh {
  const mesh = new THREE.Mesh(shapes.geometry(), flat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A thin bright bar from one point to another: a sight line, a tracer. */
class Beam {
  readonly mesh: THREE.Mesh;
  constructor(scene: THREE.Scene, color: number, thick = 0.05) {
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, 1).translate(0, 0, 0.5), glow(color, 0.85));
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  set(from: THREE.Vector3, to: THREE.Vector3, visible: boolean, swell = 1): void {
    this.mesh.visible = visible;
    if (!visible) return;
    this.mesh.position.copy(from);
    this.mesh.lookAt(to);
    this.mesh.scale.set(swell, swell, from.distanceTo(to));
  }
}

/**
 * In smoke: sheets of haze laid one above another round the truck, thin over it and thick
 * further out. How far out, metres, and how much each sheet hides there, 0 to 1. Together
 * they leave the truck and what is right beside it dim, and nothing at all past the last.
 */
const VEIL_OUT = [0, 3, 6, 9, 12, 15, 600];
const VEIL_HIDES = [0.1, 0.12, 0.24, 0.4, 0.55, 0.64, 0.64];
const VEIL_HEIGHTS = [0.5, 1.5, 2.6, 3.8, 5.5];

const a = new THREE.Vector3();
const b = new THREE.Vector3();
const m = new THREE.Matrix4();
const s = new THREE.Vector3();
const flatTurn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const upright = new THREE.Quaternion();

export class BattleView {
  private readonly rings: THREE.Mesh[] = [];
  private readonly fills: THREE.Mesh[] = [];
  private readonly scars: THREE.InstancedMesh;
  private readonly tracers: THREE.InstancedMesh;
  private readonly launchers: { group: THREE.Group; sight: Beam }[] = [];
  private readonly turrets: { turret: THREE.Group; lamp: THREE.MeshBasicMaterial; sight: Beam }[] = [];
  private readonly shots: THREE.Mesh[] = [];
  private readonly smoke: THREE.InstancedMesh | null = null;
  private readonly clear = { near: 0, far: 0, color: new THREE.Color() };
  private readonly haze = new THREE.Color(0x8d8f8a);
  private time = 0;
  /** Called for each puff a rocket leaves behind it. */
  onTrail: ((at: THREE.Vector3) => void) | null = null;

  constructor(private readonly scene: THREE.Scene, private readonly battle: Battle, desc: BattleDesc = {}) {
    // Where shells are due: a ring, and a disc inside it that fills as the time runs out.
    for (let i = 0; i < 24; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2), glow(WARN, 0.9));
      const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), glow(WARN, 0.3));
      ring.visible = fill.visible = false;
      ring.renderOrder = fill.renderOrder = 2;
      scene.add(ring, fill);
      this.rings.push(ring);
      this.fills.push(fill);
    }
    this.scars = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20), new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 1, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }), 80);
    this.scars.count = 0;
    this.scars.frustumCulled = false;
    scene.add(this.scars);

    this.tracers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, 2.2), glow(0xffe07a), 260);
    this.tracers.count = 0;
    this.tracers.frustumCulled = false;
    scene.add(this.tracers);

    for (const state of battle.launchers) {
      const shapes = new Shapes();
      // Kneeling, in his army's colour, the tube on his shoulder.
      shapes.box(0, 0.35, -0.1, 0.22, 0.35, 0.3, 0x3a3f36);
      shapes.box(0, 0.95, 0, 0.24, 0.3, 0.18, ARMY[state.desc.side]);
      shapes.cylinder(0, 1.25, 0, 0.17, 0.26, 0xe8c9a8, ARMY[state.desc.side], 8);
      shapes.box(0.26, 1.3, 0.2, 0.09, 0.09, 0.75, 0x4a5240);
      const group = new THREE.Group();
      group.add(solid(shapes));
      group.position.set(...state.desc.pos);
      scene.add(group);
      this.launchers.push({ group, sight: new Beam(scene, WARN, 0.045) });
    }

    for (const state of battle.tanks) {
      const colour = ARMY[state.desc.side];
      const hull = new Shapes();
      const { width, height, length } = TANK_HALF;
      for (const side of [-1, 1]) {
        hull.box(side * (width - 0.3), 0.45, 0, 0.32, 0.45, length, DARK);
        for (let i = -3; i <= 3; i++) hull.wheel(side * (width - 0.3), 0.4, i * 0.9, 0.36, 0.34, 0x1c1d20, 0x4a4f48, 8);
      }
      hull.box(0, 1.05, 0, width - 0.35, 0.45, length - 0.25, colour);
      hull.box(0, 1.2, length - 0.5, width - 0.5, 0.25, 0.4, colour);
      hull.box(0, height * 2 - 0.3, -length + 0.7, width - 0.6, 0.12, 0.5, DARK);
      const base = solid(hull);
      const top = new Shapes();
      top.box(0, 0.35, -0.2, 1, 0.35, 1.35, colour);
      top.cylinder(0, 0.7, -0.4, 0.4, 0.12, DARK, DARK, 8);
      top.box(0, 0.4, 2.6, 0.12, 0.12, 1.9, DARK);
      top.box(0, 0.4, 4.4, 0.17, 0.17, 0.2, DARK);
      const turret = new THREE.Group();
      turret.add(solid(top));
      const lamp = glow(0x304030);
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), lamp);
      light.position.set(0.6, 0.85, -0.9);
      turret.add(light);
      turret.position.y = height * 2 - 0.45;
      const tank = new THREE.Group();
      tank.add(base, turret);
      tank.position.set(state.desc.pos[0], 0, state.desc.pos[1]);
      tank.rotation.y = state.desc.rotY;
      scene.add(tank);
      this.turrets.push({ turret, lamp, sight: new Beam(scene, WARN, 0.07) });
    }

    for (let i = 0; i < 8; i++) {
      const shot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 8).rotateX(Math.PI / 2), glow(0xfff2c0));
      shot.visible = false;
      scene.add(shot);
      this.shots.push(shot);
    }

    this.patches(desc);
    this.smoke = this.bank(desc);
  }

  /** Mud as dark wet ground, wire as coils standing in rows across it. */
  private patches(desc: BattleDesc): void {
    const patches = desc.patches ?? [];
    const mud = patches.filter((p) => p.kind === 'mud');
    const wire = patches.filter((p) => p.kind === 'wire');
    if (mud.length) {
      const pools = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.35, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), mud.length * 9);
      let n = 0;
      mud.forEach((p, k) => {
        for (let i = 0; i < 9; i++) {
          // The same every time: placed by number, not by chance.
          const u = ((i * 0.618 + k * 0.37) % 1) * 2 - 1;
          const w = ((i * 0.382 + k * 0.71) % 1) * 2 - 1;
          const radius = 1.1 + ((i * 0.27) % 1) * 1.3;
          m.compose(a.set(p.pos[0] + u * Math.max(0, p.half[0] - radius), 0.035 + i * 0.002, p.pos[1] + w * Math.max(0, p.half[1] - radius)), upright, s.set(radius * 1.3, 1, radius));
          pools.setMatrixAt(n++, m);
        }
      });
      pools.receiveShadow = true;
      pools.frustumCulled = false;
      this.scene.add(pools);
    }
    if (wire.length) {
      const loop = new THREE.TorusGeometry(0.5, 0.03, 5, 14);
      const count = wire.reduce((sum, p) => sum + Math.ceil((p.half[0] * 2) / 0.45) * Math.max(1, Math.round(p.half[1] / 0.9)), 0);
      const coils = new THREE.InstancedMesh(loop, new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.5, metalness: 0.6 }), count);
      const turned = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
      let n = 0;
      for (const p of wire) {
        const rows = Math.max(1, Math.round(p.half[1] / 0.9));
        for (let row = 0; row < rows; row++) {
          const z = p.pos[1] + (rows === 1 ? 0 : -p.half[1] + 0.6 + (row * (p.half[1] * 2 - 1.2)) / (rows - 1));
          for (let x = -p.half[0]; x < p.half[0]; x += 0.45) {
            m.compose(a.set(p.pos[0] + x + 0.2, 0.52, z), turned, s.set(1, 1, 1));
            coils.setMatrixAt(n++, m);
          }
        }
      }
      coils.count = n;
      coils.castShadow = true;
      coils.frustumCulled = false;
      this.scene.add(coils);
    }
  }

  /** A bank of smoke: a heap of grey puffs, thick enough to hide what is in it from outside. */
  private bank(desc: BattleDesc): THREE.InstancedMesh | null {
    const banks = desc.smoke ?? [];
    if (!banks.length) return null;
    const each = 46;
    const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x9a9c97, transparent: true, opacity: 0.42, depthWrite: false }), banks.length * each);
    let n = 0;
    banks.forEach((bank, k) => {
      for (let i = 0; i < each; i++) {
        const angle = i * 2.4 + k;
        const out = Math.sqrt((i + 0.5) / each) * bank.radius;
        const size = 4 + ((i * 0.37) % 1) * 4;
        m.compose(a.set(bank.pos[0] + Math.cos(angle) * out, 1.5 + ((i * 0.61) % 1) * 4.5, bank.pos[1] + Math.sin(angle) * out), upright, s.set(size, size * 0.7, size));
        puffs.setMatrixAt(n++, m);
      }
    });
    puffs.frustumCulled = false;
    puffs.renderOrder = 3;
    this.scene.add(puffs);
    return puffs;
  }

  update(dt: number, truck: THREE.Vector3, desc: BattleDesc = {}): void {
    this.time += dt;
    const { battle } = this;
    const blink = (rate: number) => Math.sin(this.time * rate) > 0;

    this.rings.forEach((ring, i) => {
      const shell = battle.shells[i];
      const fill = this.fills[i];
      ring.visible = fill.visible = !!shell;
      if (!shell) return;
      const done = 1 - shell.left / shell.total;
      ring.position.set(shell.x, 0.09, shell.z);
      ring.scale.setScalar(SHELL_RING);
      fill.position.set(shell.x, 0.08, shell.z);
      fill.scale.setScalar(SHELL_RING * done);
      // Faster as it comes.
      (ring.material as THREE.MeshBasicMaterial).opacity = blink(8 + done * 30) ? 0.95 : 0.45;
    });
    if (this.scars.count !== battle.scars.length) {
      battle.scars.forEach((scar, i) => {
        const size = 2.4 + ((scar.x * 7.3 + scar.z * 3.1) % 1) * 1;
        this.scars.setMatrixAt(i, m.compose(a.set(scar.x, 0.04 + i * 0.0004, scar.z), flatTurn, s.set(size, size, 1)));
      });
      this.scars.count = battle.scars.length;
      this.scars.instanceMatrix.needsUpdate = true;
    }

    // Every round in the air, as a streak along the way it is going.
    const shown = Math.min(battle.rounds.length, 260);
    for (let i = 0; i < shown; i++) {
      const round = battle.rounds[i];
      this.tracers.setMatrixAt(i, m.makeRotationY(Math.atan2(round.dir.x, round.dir.z)).setPosition(round.pos));
    }
    this.tracers.count = shown;
    this.tracers.instanceMatrix.needsUpdate = true;

    battle.launchers.forEach((launcher, i) => {
      const { group, sight } = this.launchers[i];
      group.rotation.y = launcher.yaw;
      const [x, y, z] = launcher.desc.pos;
      a.set(x, y + 1.3, z);
      b.copy(launcher.aim).setY(launcher.aim.y + 0.4);
      // The sight line: steady at first, flickering faster and faster as it is about to fire.
      sight.set(a, b, launcher.lock > 0.02 && (launcher.lock < 0.4 || blink(10 + launcher.lock * 50)));
    });

    battle.tanks.forEach((tank, i) => {
      const { turret, lamp, sight } = this.turrets[i];
      turret.rotation.y = tank.yaw - tank.desc.rotY;
      lamp.color.set(tank.hostile ? (blink(14) ? 0xff2a1a : 0x5a1008) : 0x304030);
      a.set(tank.desc.pos[0] + Math.sin(tank.yaw) * 4.4, 1.95, tank.desc.pos[1] + Math.cos(tank.yaw) * 4.4);
      b.set(a.x + Math.sin(tank.yaw) * 40, 1.2, a.z + Math.cos(tank.yaw) * 40);
      // Always to be seen, and steady, while it shells the other army; flickering while it follows the truck.
      // Either way it swells as the shot comes.
      sight.set(a, b, !tank.hostile || tank.held || blink(16 + tank.lock * 40), 1 + tank.charge * 4);
    });

    this.shots.forEach((shot, i) => {
      const p = battle.projectiles[i];
      shot.visible = !!p;
      if (!p) return;
      shot.position.copy(p.pos);
      shot.lookAt(a.copy(p.pos).add(p.dir));
      shot.scale.setScalar(p.kind === 'shell' ? 1.3 : 1);
      if (p.kind === 'rocket') this.onTrail?.(p.pos);
    });

    this.hazeOver(truck, desc);
  }

  /**
   * The haze that closes round a truck inside a bank of smoke: flat sheets, one above
   * another, each clearer in the middle than further out. They go where the truck goes, so
   * what can be seen is a patch round the truck however far back the view is pulled.
   */
  private veil(): THREE.Mesh[] {
    const around = 48;
    const points: number[] = [];
    const tints: number[] = [];
    const corner = (ring: number, k: number) => {
      const angle = (k / around) * Math.PI * 2;
      points.push(Math.cos(angle) * VEIL_OUT[ring], 0, Math.sin(angle) * VEIL_OUT[ring]);
      tints.push(1, 1, 1, VEIL_HIDES[ring]);
    };
    for (let ring = 0; ring < VEIL_OUT.length - 1; ring++) {
      for (let k = 0; k < around; k++) {
        corner(ring, k); corner(ring + 1, k + 1); corner(ring + 1, k);
        corner(ring, k); corner(ring, k + 1); corner(ring + 1, k + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(tints, 4));
    const material = new THREE.MeshBasicMaterial({ color: this.haze, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide });
    return VEIL_HEIGHTS.map((height, i) => {
      const sheet = new THREE.Mesh(geometry, material);
      sheet.position.y = height;
      sheet.visible = false;
      sheet.frustumCulled = false;
      sheet.renderOrder = 4 + i;
      this.scene.add(sheet);
      return sheet;
    });
  }

  /** Inside a bank of smoke, what can be seen closes in to a patch round the truck, and that dim. */
  private hazeOver(truck: THREE.Vector3, desc: BattleDesc): void {
    const fog = this.scene.fog;
    if (!(fog instanceof THREE.Fog) || !desc.smoke?.length) return;
    let deep = 0;
    for (const bank of desc.smoke) deep = Math.max(deep, 1 - Math.hypot(truck.x - bank.pos[0], truck.z - bank.pos[1]) / bank.radius);
    const thick = Math.min(1, Math.max(0, deep) * 3);
    // What the air is like outside is remembered while outside, and gone back to on the way out.
    if (thick === 0 && this.thick === 0) {
      this.clear.near = fog.near;
      this.clear.far = fog.far;
      this.clear.color.copy(fog.color);
      return;
    }
    this.thick = thick;
    this.sheets ??= this.veil();
    for (const sheet of this.sheets) {
      sheet.visible = thick > 0;
      sheet.position.set(truck.x, sheet.position.y, truck.z);
    }
    (this.sheets[0].material as THREE.MeshBasicMaterial).opacity = thick;
    fog.color.copy(this.clear.color).lerp(this.haze, thick);
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(fog.color);
    // The puffs are what the bank looks like from outside. With the truck inside, the fog does the hiding, and
    // they thin almost to nothing: a view pulled back out through them would otherwise see nothing at all.
    if (this.smoke) (this.smoke.material as THREE.MeshBasicMaterial).opacity = 0.42 - thick * 0.36;
  }

  private thick = 0;
  private sheets: THREE.Mesh[] | null = null;
}
