import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { TRUCK, type Vec3 } from '../config';
import type { PropDesc } from '../levels/types';
import type { Truck } from '../sim/truck';

/** Copies a physics body's transform onto a mesh, interpolating between fixed steps. */
export class BodySync {
  private readonly prevPos = new THREE.Vector3();
  private readonly prevRot = new THREE.Quaternion();
  private readonly currPos = new THREE.Vector3();
  private readonly currRot = new THREE.Quaternion();

  constructor(readonly body: RAPIER.RigidBody, readonly object: THREE.Object3D) {
    this.snap();
  }

  /** Call after every physics step. */
  capture(): void {
    this.prevPos.copy(this.currPos);
    this.prevRot.copy(this.currRot);
    this.read();
    // A teleport, such as a car looping back to the start of its lane: don't glide across the map.
    if (this.prevPos.distanceToSquared(this.currPos) > 25) this.prevPos.copy(this.currPos);
  }

  /** Jump to the body's current transform with no interpolation, e.g. after a reset. */
  snap(): void {
    this.read();
    this.prevPos.copy(this.currPos);
    this.prevRot.copy(this.currRot);
  }

  apply(alpha: number): void {
    this.object.position.lerpVectors(this.prevPos, this.currPos, alpha);
    this.object.quaternion.slerpQuaternions(this.prevRot, this.currRot, alpha);
  }

  private read(): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.currPos.set(t.x, t.y, t.z);
    this.currRot.set(r.x, r.y, r.z, r.w);
  }
}

function shadowed<T extends THREE.Mesh>(mesh: T): T {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function boxMesh(half: Vec3, material: THREE.Material): THREE.Mesh {
  return shadowed(new THREE.Mesh(new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2), material));
}

export function propMesh(desc: PropDesc): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({ color: desc.color, roughness: 0.8 });
  const [a, b] = desc.size;
  const mesh =
    desc.shape === 'box' ? boxMesh(desc.size, material)
    : desc.shape === 'cylinder' ? shadowed(new THREE.Mesh(new THREE.CylinderGeometry(a, a, b * 2, 24), material))
    : shadowed(new THREE.Mesh(new THREE.ConeGeometry(a, b * 2, 20), material));
  mesh.position.set(...desc.pos);
  if (desc.rot) mesh.rotation.set(...desc.rot);
  return mesh;
}

/** Boards running the length of the bed: dark, so that the load stands out against them. */
function plankTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d')!;
  const boards = 8;
  for (let i = 0; i < boards; i++) {
    const shade = 46 + ((i * 37) % 3) * 7;
    g.fillStyle = `rgb(${shade + 16}, ${shade + 6}, ${shade - 4})`;
    g.fillRect((i * 128) / boards, 0, 128 / boards, 256);
    g.fillStyle = 'rgba(0, 0, 0, 0.5)';
    g.fillRect((i * 128) / boards, 0, 1.5, 256);
    // Board ends, staggered from one board to the next.
    g.fillRect((i * 128) / boards, (i * 97) % 256, 128 / boards, 1.5);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const scuffs = new Map<number, THREE.Texture>();

/** Paintwork after a few knocks: scratches down to the metal, and soot. More of both at each stage. */
function scuffTexture(stage: number): THREE.Texture {
  const cached = scuffs.get(stage);
  if (cached) return cached;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  let seed = 5 + stage * 13;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  g.lineCap = 'round';
  for (let i = 0; i < stage * 9; i++) {
    g.strokeStyle = i % 3 ? 'rgba(40, 30, 26, 0.7)' : 'rgba(190, 190, 185, 0.9)';
    g.lineWidth = 1 + rand() * 2.2;
    const x = rand() * size;
    const y = rand() * size;
    const angle = rand() * Math.PI;
    const length = 12 + rand() * 40;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length * 0.3);
    g.stroke();
  }
  for (let i = 0; i < stage * 5; i++) {
    g.fillStyle = `rgba(22, 18, 16, ${0.1 + rand() * 0.12 * stage})`;
    g.beginPath();
    g.arc(rand() * size, rand() * size, 8 + rand() * 20, 0, Math.PI * 2);
    g.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  scuffs.set(stage, texture);
  return texture;
}

/** Something that has come off the truck and is on its way to the ground. */
interface Shed {
  object: THREE.Object3D;
  /** Where it belongs, to be put back on a reset. */
  home: { position: THREE.Vector3; quaternion: THREE.Quaternion };
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  resting: boolean;
}

export class TruckMesh {
  readonly root = new THREE.Group();
  private readonly paint = new THREE.MeshStandardMaterial({ color: 0xe2532f, roughness: 0.5 });
  private readonly lampA = new THREE.MeshStandardMaterial({ color: 0xfff6cf, emissive: 0xffe9a0, emissiveIntensity: 0.6 });
  private readonly lampB = this.lampA.clone();
  private cab!: THREE.Mesh;
  private cabShape!: Float32Array;
  private bumper!: THREE.Mesh;
  private bumperY = 0;
  /** Right mirror, left mirror, driver's door: the order they come off in. */
  private readonly loose: THREE.Object3D[] = [];
  private readonly shed: Shed[] = [];
  private damage = 0;
  private readonly steerPivots: THREE.Group[] = [];
  private readonly wheels: THREE.Mesh[] = [];
  private readonly brakeLamp = new THREE.MeshStandardMaterial({ color: 0x7a1010, emissive: 0xff2010, emissiveIntensity: 0 });

  constructor() {
    const paint = this.paint;
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.8 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x1b2a3a, roughness: 0.15, metalness: 0.4 });
    const tyre = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.95 });
    const hub = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.4, metalness: 0.6 });

    const place = (mesh: THREE.Mesh, pos: Vec3) => {
      mesh.position.set(...pos);
      this.root.add(mesh);
    };

    place(boxMesh(TRUCK.frame.half, dark), TRUCK.frame.pos);
    // The cab is cut into a mesh fine enough to be dented.
    const [chx, chy, chz] = TRUCK.cab.half;
    this.cab = shadowed(new THREE.Mesh(new THREE.BoxGeometry(chx * 2, chy * 2, chz * 2, 6, 5, 5), paint));
    this.cabShape = Float32Array.from(this.cab.geometry.getAttribute('position').array);
    place(this.cab, TRUCK.cab.pos);

    // The bed walls are solid to the physics, but drawn as a board below and open rails
    // above, so the load stays visible from the camera behind.
    const wall = (half: Vec3, pos: Vec3) => {
      const [hx, hy, hz] = half;
      const [x, y, z] = pos;
      const alongZ = hz > hx;
      const boardHalf = hy * TRUCK.wallBoard;
      const rail = 0.04;
      place(boxMesh([hx, boardHalf, hz], paint), [x, y - hy + boardHalf, z]);
      place(boxMesh([hx, rail, hz], paint), [x, y + hy - rail, z]);
      // Posts from the board up to the top rail.
      const length = alongZ ? hz : hx;
      const posts = Math.max(2, Math.round(length / 0.7) + 1);
      const postHalf = hy - boardHalf;
      for (let i = 0; i < posts; i++) {
        const at = -length + rail + (i / (posts - 1)) * (length - rail) * 2;
        place(
          boxMesh(alongZ ? [hx, postHalf, rail] : [rail, postHalf, hz], paint),
          alongZ ? [x, y + hy - postHalf, z + at] : [x + at, y + hy - postHalf, z],
        );
      }
    };
    const [sx, sy, sz] = TRUCK.sideWall.pos;
    wall(TRUCK.sideWall.half, [sx, sy, sz]);
    wall(TRUCK.sideWall.half, [-sx, sy, sz]);
    wall(TRUCK.tailgate.half, TRUCK.tailgate.pos);

    // Cab details: windscreen, side windows, headlights.
    const [cw, ch, cl] = TRUCK.cab.half;
    const [, cy, cz] = TRUCK.cab.pos;
    const cabFront = cz + cl + 0.01;
    place(boxMesh([cw * 0.85, ch * 0.4, 0.02], glass), [0, cy + ch * 0.4, cabFront]);
    place(boxMesh([cw + 0.01, ch * 0.35, cl * 0.55], glass), [0, cy + ch * 0.42, cz + 0.1]);
    place(boxMesh([cw * 0.2, 0.1, 0.02], this.lampA), [cw * 0.7, cy - ch * 0.65, cabFront]);
    place(boxMesh([cw * 0.2, 0.1, 0.02], this.lampB), [-cw * 0.7, cy - ch * 0.65, cabFront]);

    // Brake lights, across the top of the tailgate so the high camera can see them.
    const [tw, th] = TRUCK.tailgate.half;
    const [, ty, tz] = TRUCK.tailgate.pos;
    for (const x of [tw * 0.72, -tw * 0.72]) {
      place(boxMesh([tw * 0.24, 0.05, 0.1], this.brakeLamp), [x, ty + th + 0.03, tz]);
    }

    this.addTrim(place, paint, dark, glass);

    const w = TRUCK.wheel;
    const tyreGeo = new THREE.CylinderGeometry(w.radius, w.radius, w.width, 24).rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(w.radius * 0.5, w.radius * 0.5, w.width + 0.02, 6).rotateZ(Math.PI / 2);
    for (const [x, y, z] of w.positions) {
      const pivot = new THREE.Group();
      pivot.position.set(x, y - w.restLength, z);
      const wheel = shadowed(new THREE.Mesh(tyreGeo, tyre));
      wheel.add(new THREE.Mesh(hubGeo, hub));

      pivot.add(wheel);
      this.root.add(pivot);
      this.steerPivots.push(pivot);
      this.wheels.push(wheel);
    }
  }

  /** Everything that makes it look like a truck and does nothing: bumpers, mirrors, mudguards, lamps, the floor of the bed. */
  private addTrim(place: (mesh: THREE.Mesh, pos: Vec3) => void, paint: THREE.Material, dark: THREE.Material, glass: THREE.Material): void {
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd0d4d8, roughness: 0.28, metalness: 0.75 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xa83c20, roughness: 0.55 });
    const amber = new THREE.MeshStandardMaterial({ color: 0xffb030, emissive: 0xff9010, emissiveIntensity: 0.5 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6 });

    const [cw, ch, cl] = TRUCK.cab.half;
    const [, cy, cz] = TRUCK.cab.pos;
    const front = cz + cl;
    const roof = cy + ch;
    const [fw, fh, fl] = TRUCK.frame.half;

    // Roof: a darker cap, a visor over the windscreen, marker lamps.
    place(boxMesh([cw * 0.94, 0.045, cl * 0.92], trim), [0, roof + 0.045, cz]);
    place(boxMesh([cw * 0.9, 0.03, 0.13], dark), [0, roof - 0.12, front + 0.12]);
    for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) place(boxMesh([0.06, 0.03, 0.05], amber), [x * cw, roof + 0.1, cz + cl * 0.72]);
    // A pillar down the middle of the windscreen, and wipers.
    place(boxMesh([0.025, ch * 0.4, 0.012], paint), [0, cy + ch * 0.4, front + 0.03]);
    for (const x of [-0.45, 0.4]) {
      const wiper = boxMesh([cw * 0.26, 0.012, 0.01], dark);
      wiper.rotation.z = 0.35;
      place(wiper, [x * cw, cy + ch * 0.12, front + 0.04]);
    }

    // The nose: grille with bright slats, indicators outboard of the headlamps, a bumper and a plate.
    place(boxMesh([cw * 0.42, 0.17, 0.02], dark), [0, cy - ch * 0.62, front + 0.01]);
    for (const dy of [-0.1, -0.03, 0.04, 0.11]) place(boxMesh([cw * 0.4, 0.012, 0.03], chrome), [0, cy - ch * 0.62 + dy, front + 0.02]);
    for (const side of [-1, 1]) place(boxMesh([0.05, 0.1, 0.02], amber), [side * cw * 0.95, cy - ch * 0.65, front + 0.01]);
    this.bumper = boxMesh([fw + 0.07, 0.13, 0.11], chrome);
    this.bumperY = 0.03;
    place(this.bumper, [0, this.bumperY, fl + 0.07]);
    place(boxMesh([0.26, 0.07, 0.01], white), [0, 0.03, fl + 0.185]);

    // Each side of the cab: a door seam and handle, a step, and a mirror out on its arm.
    /** A group of parts that can come off in one piece, placed where its middle is. */
    const assembly = (at: Vec3, parts: [THREE.Mesh, Vec3][]): THREE.Group => {
      const group = new THREE.Group();
      group.position.set(...at);
      for (const [mesh, pos] of parts) {
        mesh.position.set(pos[0] - at[0], pos[1] - at[1], pos[2] - at[2]);
        group.add(mesh);
      }
      this.root.add(group);
      return group;
    };
    const mirrors: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const x = side * cw;
      place(boxMesh([0.11, 0.03, 0.32], dark), [x + side * 0.06, -0.08, cz + 0.05]);
      const mz = cz + cl * 0.8;
      mirrors.push(assembly([x + side * 0.2, cy + ch * 0.38, mz], [
        [boxMesh([0.13, 0.015, 0.015], dark), [x + side * 0.13, cy + ch * 0.42, mz]],
        [boxMesh([0.03, 0.17, 0.1], dark), [x + side * 0.26, cy + ch * 0.36, mz]],
        [boxMesh([0.005, 0.15, 0.085], glass), [x + side * 0.26, cy + ch * 0.36, mz - 0.101]],
      ]));
      // The door: a panel below the window, with its handle. Behind it, the dark of the cab.
      const doorY = cy - ch * 0.44;
      const doorHalf: Vec3 = [0.014, ch * 0.5, cl * 0.6];
      place(boxMesh([0.004, doorHalf[1] - 0.03, doorHalf[2] - 0.03], dark), [x + side * 0.004, doorY, cz + 0.02]);
      const door = assembly([x + side * 0.018, doorY, cz + 0.02], [
        [boxMesh(doorHalf, paint), [x + side * 0.018, doorY, cz + 0.02]],
        [boxMesh([0.012, 0.022, 0.09], chrome), [x + side * 0.04, cy - ch * 0.12, cz - cl * 0.36]],
        [boxMesh([0.004, doorHalf[1], 0.012], dark), [x + side * 0.034, doorY, cz + 0.02 - doorHalf[2]]],
      ]);
      if (side > 0) this.loose[2] = door;
    }
    this.loose[0] = mirrors[0];
    this.loose[1] = mirrors[1];

    // An exhaust stack up the back corner of the cab.
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.7, 12), chrome);
    place(shadowed(stack), [-(cw + 0.1), cy + 0.1, cz - cl + 0.14]);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.16, 12), dark);
    place(tip, [-(cw + 0.1), cy + 0.98, cz - cl + 0.14]);

    // Mudguards over every wheel, with a flap behind the rear ones.
    for (const [x, , z] of TRUCK.wheel.positions) {
      const reach = TRUCK.wheel.radius + 0.14;
      // Outboard of the bed's sides, so that nothing shows through its floor.
      const gx = x + Math.sign(x) * 0.06;
      place(boxMesh([0.2, 0.025, reach], dark), [gx, 0.34, z]);
      for (const end of [-1, 1]) place(boxMesh([0.2, 0.09, 0.025], dark), [gx, 0.26, z + end * reach]);
      if (z < 0) place(boxMesh([0.2, 0.2, 0.015], dark), [gx, -0.05, z - reach - 0.02]);
    }

    // Slung under the frame: a fuel tank one side, a toolbox the other.
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.2, 16).rotateX(Math.PI / 2), chrome);
    place(shadowed(tank), [-(fw - 0.2), -fh - 0.2, 0.55]);
    for (const end of [-0.4, 0.4]) place(boxMesh([0.26, 0.26, 0.025], dark), [-(fw - 0.2), -fh - 0.2, 0.55 + end]);
    place(boxMesh([0.2, 0.2, 0.5], dark), [fw - 0.22, -fh - 0.2, 0.55]);
    place(boxMesh([0.01, 0.03, 0.08], chrome), [fw - 0.01, -fh - 0.15, 0.55]);

    // The tail: an underrun bar, lamps that light with the brakes, a plate.
    place(boxMesh([fw, 0.05, 0.05], dark), [0, -fh - 0.12, -fl - 0.03]);
    for (const side of [-1, 1]) {
      place(boxMesh([0.16, 0.07, 0.02], this.brakeLamp), [side * (fw - 0.24), 0, -fl - 0.01]);
      place(boxMesh([0.06, 0.07, 0.02], amber), [side * (fw - 0.5), 0, -fl - 0.01]);
    }
    place(boxMesh([0.26, 0.07, 0.01], white), [0, 0, -fl - 0.01]);

    // The bed: a planked floor, and a stout post at each corner.
    const [sx, sy, sz] = TRUCK.sideWall.pos;
    const [, shy, shz] = TRUCK.sideWall.half;
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry((sx - 0.08) * 2, 0.02, shz * 2),
      new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.9 }),
    );
    floor.receiveShadow = true;
    place(floor, [0, fh + 0.011, sz]);
    for (const side of [-1, 1]) for (const end of [-1, 1]) {
      place(boxMesh([0.07, shy + 0.03, 0.07], trim), [side * sx, sy + 0.03, sz + end * (shz - 0.04)]);
    }
  }

  /**
   * Make the truck look as battered as it is: 0 as new, 3 a wreck. Scratches and soot on
   * the paint, dents in the cab, a mirror gone, then the other, a lamp out and the bumper
   * hanging, and finally the driver's door. None of it changes how it drives.
   */
  setDamage(stage: number, scene: THREE.Scene, velocity: { x: number; y: number; z: number }): void {
    if (stage === this.damage) return;
    if (stage < this.damage) this.repair();
    for (let s = this.damage + 1; s <= stage; s++) {
      this.paint.map = scuffTexture(s);
      this.paint.needsUpdate = true;
      this.dent(s / 3);
      if (s === 1) this.drop(this.loose[0], scene, velocity, -1);
      if (s === 2) {
        this.drop(this.loose[1], scene, velocity, 1);
        this.lampB.emissiveIntensity = 0;
        this.lampB.color.set(0x4a4a44);
      }
      if (s === 3) this.drop(this.loose[2], scene, velocity, 1);
      if (s >= 2) {
        // One end of the bumper has let go.
        this.bumper.rotation.z = s === 2 ? 0.1 : 0.2;
        this.bumper.position.y = this.bumperY - (s === 2 ? 0.1 : 0.2);
      }
    }
    this.damage = stage;
  }

  /** Where smoke comes out once the engine is suffering, in the world. */
  smokePoint(target: THREE.Vector3): THREE.Vector3 {
    const [, ch, cl] = TRUCK.cab.half;
    const [, cy, cz] = TRUCK.cab.pos;
    return this.root.localToWorld(target.set(0, cy - ch * 0.35, cz + cl + 0.15));
  }

  /** Let fall whatever has come off. */
  updatePieces(dt: number): void {
    for (const piece of this.shed) {
      if (piece.resting) continue;
      const { object, velocity, spin } = piece;
      velocity.y -= 9.81 * dt;
      object.position.addScaledVector(velocity, dt);
      object.rotation.x += spin.x * dt;
      object.rotation.y += spin.y * dt;
      object.rotation.z += spin.z * dt;
      if (object.position.y < 0.12 && velocity.y < 0) {
        object.position.y = 0.12;
        // One bounce, then it lies flat where it stopped: these are all thin from side to side.
        if (velocity.y < -3) velocity.set(velocity.x * 0.4, -velocity.y * 0.25, velocity.z * 0.4);
        else {
          piece.resting = true;
          object.rotation.set(0, object.rotation.y, Math.PI / 2);
        }
      }
    }
  }

  private drop(object: THREE.Object3D, scene: THREE.Scene, velocity: { x: number; y: number; z: number }, side: number): void {
    const home = { position: object.position.clone(), quaternion: object.quaternion.clone() };
    // Outward from the side of the truck it was on.
    const out = new THREE.Vector3(side, 0, 0).applyQuaternion(this.root.quaternion);
    scene.attach(object);
    this.shed.push({
      object, home, resting: false,
      velocity: new THREE.Vector3(velocity.x * 0.6 + out.x * 2.5, 2.5, velocity.z * 0.6 + out.z * 2.5),
      spin: new THREE.Vector3(4 + Math.random() * 4, Math.random() * 3, 3 + Math.random() * 4),
    });
  }

  /** Put everything back as it left the factory. */
  private repair(): void {
    for (const { object, home } of this.shed) {
      this.root.add(object);
      object.position.copy(home.position);
      object.quaternion.copy(home.quaternion);
    }
    this.shed.length = 0;
    this.paint.map = null;
    this.paint.needsUpdate = true;
    this.lampB.copy(this.lampA);
    this.bumper.rotation.z = 0;
    this.bumper.position.y = this.bumperY;
    this.dent(0);
    this.damage = 0;
  }

  /**
   * Push the cab's panels in: the nose back, the sides inward, the roof down, each by an
   * amount that varies smoothly over the surface. `amount` runs from 0, undented, to 1.
   */
  private dent(amount: number): void {
    const [hx, hy, hz] = TRUCK.cab.half;
    const position = this.cab.geometry.getAttribute('position');
    const base = this.cabShape;
    const wave = (a: number, b: number) => Math.sin(a * 5.3 + 1.7) * Math.sin(b * 4.1 + 0.6) * 0.5 + 0.5;
    for (let i = 0; i < position.count; i++) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      const z = base[i * 3 + 2];
      const front = Math.max(0, z / hz - 0.55) / 0.45;
      const flank = Math.max(0, Math.abs(x) / hx - 0.9) / 0.1;
      const top = Math.max(0, y / hy - 0.9) / 0.1;
      position.setXYZ(
        i,
        x - Math.sign(x) * amount * 0.11 * flank * wave(y, z),
        y - amount * 0.12 * top * wave(x * 1.3, z),
        z - amount * 0.16 * front * wave(x, y),
      );
    }
    position.needsUpdate = true;
    this.cab.geometry.computeVertexNormals();
  }

  /** Pose the wheels from the vehicle controller's suspension, steering and spin. */
  updateWheels(truck: Truck): void {
    const c = truck.controller;
    TRUCK.wheel.positions.forEach(([, y], i) => {
      const pivot = this.steerPivots[i];
      pivot.position.y = y - (c.wheelSuspensionLength(i) ?? TRUCK.wheel.restLength);
      pivot.rotation.y = c.wheelSteering(i) ?? 0;
      this.wheels[i].rotation.x = c.wheelRotation(i) ?? 0;
    });
    this.brakeLamp.emissiveIntensity = truck.brakeLevel > 0 ? 1.5 + truck.brakeLevel * 2.5 : 0;
  }

  /** World position of the bottom of a wheel, where tyre smoke comes from. */
  wheelContact(i: number, target: THREE.Vector3): THREE.Vector3 {
    const pivot = this.steerPivots[i];
    target.set(pivot.position.x, pivot.position.y - TRUCK.wheel.radius, pivot.position.z);
    return this.root.localToWorld(target);
  }
}
