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

const textures = new Map<string, THREE.Texture>();

/** Surface texture for a damage stage: the base pattern with cracks drawn over it. */
function damageTexture(base: 'plain' | 'crate', stage: Stage): THREE.Texture {
  const key = `${base}${stage}`;
  const cached = textures.get(key);
  if (cached) return cached;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);

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
  g.strokeStyle = 'rgba(15, 8, 4, 0.85)';
  g.lineCap = 'round';
  for (let i = 0; i < cracks; i++) {
    let x = rand() * size;
    let y = rand() * size;
    let angle = rand() * Math.PI * 2;
    g.lineWidth = 1.5 + rand() * (stage >= 2 ? 3 : 1.2);
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
      g.fillStyle = `rgba(20, 12, 6, ${0.12 + rand() * 0.14})`;
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
    case 'sphere': return new THREE.SphereGeometry(a, 16, 12);
  }
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
  return mesh;
}

interface ItemView {
  item: CargoItem;
  group: THREE.Group;
  sync: BodySync | null;
  /** One per part; null once that part has come off. */
  meshes: (THREE.Mesh | null)[];
  flash: number;
  leakLeft: number;
  leakTimer: number;
}

/** Draws the cargo: parts, damage stages, pieces falling off, and the mess it makes. */
export class CargoViews {
  private readonly views = new Map<CargoItem, ItemView>();
  private readonly loose: { sync: BodySync; mesh: THREE.Mesh }[] = [];
  private readonly at = new THREE.Vector3();

  constructor(private readonly scene: THREE.Scene, private readonly bursts: Bursts) {}

  /** Throw away every mesh and build the load again, e.g. after a reset. */
  rebuild(sim: Sim): void {
    for (const view of this.views.values()) this.scene.remove(view.group);
    for (const piece of this.loose) this.scene.remove(piece.mesh);
    this.views.clear();
    this.loose.length = 0;

    for (const item of sim.cargo) {
      const group = new THREE.Group();
      const meshes = item.type.parts.map((part) => {
        const mesh = partMesh(part, 0);
        if (item.type.id === 'skeleton' && part.shape === 'sphere') addEyeSockets(mesh, part.size[0]);
        group.add(mesh);
        return mesh;
      });
      this.scene.add(group);
      this.views.set(item, {
        item, group, meshes,
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
        this.bursts.emit(item.lastPos, item.type.burst, item.type.burst === 'water' ? 60 : 30, 4.5);
        break;
      case 'lost':
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
    for (const view of this.views.values()) {
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
          this.bursts.emit(this.at.copy(view.group.position), 'water', 1, 0.8);
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

function addEyeSockets(skull: THREE.Mesh, radius: number): void {
  const socket = new THREE.SphereGeometry(radius * 0.26, 8, 6);
  const dark = new THREE.MeshBasicMaterial({ color: 0x15120e });
  // The skeleton lies on its back, so the face points up.
  for (const x of [-0.42, 0.42]) {
    const eye = new THREE.Mesh(socket, dark);
    eye.position.set(x * radius, radius * 0.8, radius * 0.25);
    skull.add(eye);
  }
}
