import * as THREE from 'three';
import type { CargoEvent, CargoItem, Debris } from '../sim/cargo';
import type { PartDesc, Stage } from '../sim/cargo-types';
import type { Sim } from '../sim/sim';
import type { Bursts } from './effects';
import { BodySync } from './meshes';

/** How much darker an item gets at each damage stage. */
const STAGE_SHADE = [1, 0.9, 0.7, 0.55];
const FLASH = new THREE.Color(0xff3020);
const LEAK_SECONDS = 8;
const LEAK_INTERVAL = 0.05;

/** An arrowhead pointing down at a fallen item. Drawn over everything, so it shows behind buildings too. */
const MARKER_SHAPE = new THREE.ConeGeometry(0.28, 0.6, 4).rotateX(Math.PI);
const MARKER_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xffd166, depthTest: false, transparent: true, opacity: 0.95 });

const textures = new Map<string, THREE.Texture>();

/** Surface texture for a damage stage: the base pattern with cracks drawn over it. */
type Surface = NonNullable<PartDesc['texture']> | 'plain';

function damageTexture(base: Surface, stage: Stage): THREE.Texture {
  const key = `${base}${stage}`;
  const cached = textures.get(key);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);

  if (base === 'melon') {
    // Rind: green, with darker wavy stripes running from one end to the other.
    g.fillStyle = '#4f9a4a';
    g.fillRect(0, 0, size, size);
    g.strokeStyle = '#1f5a2a';
    g.lineWidth = 6;
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const x = ((i + 0.5) * size) / 9;
      g.beginPath();
      for (let y = 0; y <= size; y += 8) g.lineTo(x + Math.sin(y * 0.22 + i * 1.7) * 3.2, y);
      g.stroke();
    }
  }
  if (base === 'flesh') {
    // A cut face: pale rind at the rim, red inside, a ring of seeds.
    const mid = size / 2;
    g.fillStyle = '#3f8a42';
    g.fillRect(0, 0, size, size);
    for (const [radius, color] of [[0.49, '#d9efc0'], [0.44, '#f2959a'], [0.4, '#e0454d']] as const) {
      g.fillStyle = color;
      g.beginPath();
      g.arc(mid, mid, size * radius, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#1c1210';
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = size * (i % 2 ? 0.2 : 0.29);
      g.beginPath();
      g.ellipse(mid + Math.cos(a) * r, mid + Math.sin(a) * r, 3.4, 2, a, 0, Math.PI * 2);
      g.fill();
    }
  }

  if (base === 'rice') {
    // 米, printed in red on the white of a rice sack.
    g.fillStyle = '#c8372d';
    g.font = `bold ${Math.round(size * 0.82)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // Thickened with an outline in the same red: the plain bold face is too thin to read at a distance.
    g.strokeStyle = '#c8372d';
    g.lineWidth = size * 0.07;
    g.lineJoin = 'round';
    g.strokeText('米', size / 2, size / 2 + size * 0.04);
    g.fillText('米', size / 2, size / 2 + size * 0.04);
  }

  if (base === 'crate') {
    g.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    g.lineWidth = 3;
    for (let i = 1; i < 4; i++) {
      g.beginPath();
      g.moveTo(0, (i * size) / 4);
      g.lineTo(size, (i * size) / 4);
      g.stroke();
    }
    g.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    g.lineWidth = 12;
    g.strokeRect(0, 0, size, size);
  }

  // Cracks: jagged dark lines, more and heavier with each stage. Seeded so every
  // item at the same stage matches.
  let seed = 11 + stage * 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const cracks = [0, 3, 8, 12][stage];
  // A split melon shows red through the rind, not a dark line.
  const red = base === 'melon';
  g.strokeStyle = red ? 'rgba(226, 60, 70, 0.96)' : 'rgba(15, 8, 4, 0.85)';
  g.lineCap = 'round';
  for (let i = 0; i < cracks; i++) {
    let x = rand() * size;
    let y = rand() * size;
    let angle = rand() * Math.PI * 2;
    g.lineWidth = (1.5 + rand() * (stage >= 2 ? 3 : 1.2)) * (red ? 2.2 : 1);
    g.beginPath();
    g.moveTo(x, y);
    const segments = 3 + Math.floor(rand() * 4);
    for (let s = 0; s < segments; s++) {
      angle += (rand() - 0.5) * 1.6;
      const length = 10 + rand() * 22;
      x += Math.cos(angle) * length;
      y += Math.sin(angle) * length;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  if (stage >= 2) {
    // Scuffed, dirty patches.
    for (let i = 0; i < 6; i++) {
      g.fillStyle = red ? `rgba(200, 40, 52, ${0.5 + rand() * 0.3})` : `rgba(20, 12, 6, ${0.12 + rand() * 0.14})`;
      g.beginPath();
      g.arc(rand() * size, rand() * size, 8 + rand() * 16, 0, Math.PI * 2);
      g.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textures.set(key, texture);
  return texture;
}

function partGeometry(part: PartDesc): THREE.BufferGeometry {
  const [a, b, c] = part.size;
  switch (part.shape) {
    case 'box': return new THREE.BoxGeometry(a * 2, b * 2, c * 2);
    case 'cylinder': return new THREE.CylinderGeometry(a, a, b * 2, 20);
    case 'capsule': return new THREE.CapsuleGeometry(a, b * 2, 4, 10);
    case 'sphere': return new THREE.SphereGeometry(a, 20, 14);
    // The top half of a ball, moved down so that it is centred on its own middle.
    case 'dome': return new THREE.SphereGeometry(a, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, -a / 2, 0);
  }
  throw new Error(`no geometry for a ${part.shape}`);
}

function partMesh(part: PartDesc, stage: Stage): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(part.color).multiplyScalar(STAGE_SHADE[stage]),
    map: damageTexture(part.texture ?? 'plain', stage),
    roughness: 0.85,
  });
  const mesh = new THREE.Mesh(partGeometry(part), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(...part.pos);
  if (part.rot) mesh.rotation.set(...part.rot);
  if (part.shape === 'dome') {
    // The cut face, closing the open side of the half.
    const radius = part.size[0];
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 24).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: damageTexture('flesh', 0), roughness: 0.6 }),
    );
    face.position.y = -radius / 2;
    face.receiveShadow = true;
    mesh.add(face);
  }
  return mesh;
}

interface ItemView {
  item: CargoItem;
  group: THREE.Group;
  sync: BodySync | null;
  /** One per part; null once that part has come off. */
  meshes: (THREE.Mesh | null)[];
  flash: number;
  /** A bobbing pointer shown over the item while it lies off the truck, waiting to be fetched. */
  marker: THREE.Mesh;
  leakLeft: number;
  leakTimer: number;
}

/** Draws the cargo: parts, damage stages, pieces falling off, and the mess it makes. */
export class CargoViews {
  private readonly views = new Map<CargoItem, ItemView>();
  private readonly loose: { sync: BodySync; mesh: THREE.Mesh }[] = [];
  private readonly at = new THREE.Vector3();
  private time = 0;

  constructor(private readonly scene: THREE.Scene, private readonly bursts: Bursts) {}

  /** Throw away every mesh and build the load again, e.g. after a reset. */
  rebuild(sim: Sim): void {
    for (const view of this.views.values()) this.scene.remove(view.group, view.marker);
    for (const piece of this.loose) this.scene.remove(piece.mesh);
    this.views.clear();
    this.loose.length = 0;

    for (const item of sim.cargo) {
      const group = new THREE.Group();
      const meshes = item.type.parts.map((part) => {
        const mesh = partMesh(part, 0);
        if (item.type.id === 'skeleton' && part.shape === 'sphere') addFace(mesh, part.size[0]);
        group.add(mesh);
        return mesh;
      });
      this.scene.add(group);
      const marker = new THREE.Mesh(MARKER_SHAPE, MARKER_MATERIAL);
      marker.visible = false;
      marker.renderOrder = 9;
      this.scene.add(marker);
      this.views.set(item, {
        item, group, meshes, marker,
        sync: new BodySync(item.body!, group),
        flash: 0, leakLeft: 0, leakTimer: 0,
      });
    }
  }

  handle(event: CargoEvent): void {
    const view = this.views.get(event.item);
    if (!view) return;
    const { item } = view;

    switch (event.kind) {
      case 'damage': {
        view.flash = 1;
        const power = Math.min(1, event.loss / (item.type.value * 0.3));
        this.bursts.emit(item.lastPos, item.type.burst, 4 + Math.round(power * 14), 1.5 + power * 2.5);
        if (event.staged) {
          this.restyle(view);
          if (item.type.leaks && item.stage === 2) view.leakLeft = LEAK_SECONDS;
        }
        break;
      }
      case 'detach': {
        const mesh = view.meshes[event.part];
        if (!mesh) break;
        view.meshes[event.part] = null;
        // Re-parent to the scene, keeping its place in the world.
        this.scene.attach(mesh);
        (mesh.material as THREE.MeshStandardMaterial).emissive.setScalar(0);
        this.follow(event.debris, mesh);
        break;
      }
      case 'debris': {
        const mesh = partMesh(event.debris.desc, 2);
        this.scene.add(mesh);
        this.follow(event.debris, mesh);
        break;
      }
      case 'destroyed':
        this.scene.remove(view.group);
        view.sync = null;
        view.leakLeft = 0;
        this.bursts.emit(item.lastPos, item.type.burst, item.type.burst === 'water' || item.type.burst === 'pulp' ? 60 : 30, 4.5);
        break;
      case 'fallen':
      case 'recovered':
      case 'scrap':
        break;
    }
  }

  /** Call after every physics step. */
  capture(): void {
    for (const view of this.views.values()) view.sync?.capture();
    for (const piece of this.loose) piece.sync.capture();
  }

  apply(alpha: number): void {
    for (const view of this.views.values()) view.sync?.apply(alpha);
    for (const piece of this.loose) piece.sync.apply(alpha);
  }

  update(dt: number): void {
    this.time += dt;
    for (const view of this.views.values()) {
      const { item, marker } = view;
      marker.visible = item.fallen && !item.held && !item.thrown && item.body !== null;
      if (marker.visible) {
        marker.position.copy(view.group.position);
        marker.position.y += 1.5 + Math.sin(this.time * 4) * 0.15;
        marker.rotation.y = this.time * 2;
      }
      if (view.flash > 0) {
        view.flash = Math.max(0, view.flash - dt * 3.5);
        for (const mesh of view.meshes) {
          if (mesh) (mesh.material as THREE.MeshStandardMaterial).emissive.copy(FLASH).multiplyScalar(view.flash * 0.9);
        }
      }
      if (view.leakLeft > 0 && view.sync) {
        view.leakLeft -= dt;
        view.leakTimer += dt;
        if (view.leakTimer >= LEAK_INTERVAL) {
          view.leakTimer = 0;
          // Whatever it is full of: water from a jar, juice from a melon.
          this.bursts.emit(this.at.copy(view.group.position), item.type.burst === 'pulp' ? 'pulp' : 'water', 1, 0.8);
        }
      }
    }
  }

  private follow(debris: Debris, mesh: THREE.Mesh): void {
    this.loose.push({ sync: new BodySync(debris.body, mesh), mesh });
  }

  /** Give an item the look of its current damage stage. */
  private restyle(view: ItemView): void {
    const { stage, type } = view.item;
    view.meshes.forEach((mesh, i) => {
      if (!mesh) return;
      const part = type.parts[i];
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.map = damageTexture(part.texture ?? 'plain', stage);
      material.color.set(part.color).multiplyScalar(STAGE_SHADE[stage]);
    });
  }
}

/** A skull's face: eye sockets, a nose hole and a row of teeth. */
function addFace(skull: THREE.Mesh, radius: number): void {
  const dark = new THREE.MeshBasicMaterial({ color: 0x15120e });
  const socket = new THREE.SphereGeometry(radius * 0.27, 10, 8);
  // The skeleton lies on its back, so the face points up, and its chin is toward its feet (-Z).
  for (const x of [-0.42, 0.42]) {
    const eye = new THREE.Mesh(socket, dark);
    eye.position.set(x * radius, radius * 0.8, radius * 0.22);
    skull.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.14, radius * 0.3, 3), dark);
  nose.position.set(0, radius * 0.93, -radius * 0.22);
  nose.rotation.x = -Math.PI / 2;
  skull.add(nose);
  const tooth = new THREE.BoxGeometry(radius * 0.13, radius * 0.1, radius * 0.2);
  const ivory = new THREE.MeshStandardMaterial({ color: 0xf6f1e0, roughness: 0.6 });
  for (let i = -2; i <= 2; i++) {
    const t = new THREE.Mesh(tooth, ivory);
    t.position.set(i * radius * 0.17, radius * 0.66, -radius * 0.72);
    skull.add(t);
  }
}
