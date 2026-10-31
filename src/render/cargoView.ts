import * as THREE from 'three';
import { drawMelonRind } from './textures';
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
/**
 * Over something hidden along the way, the pointer is blue; and where it was left, a small blue ring on the ground until it
 * is taken. Unlike the yellow one it is hidden behind whatever stands in front of it: seen through walls, it would give away
 * where the thing is.
 */
const HIDDEN_MARKER_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x5ec8ff, transparent: true, opacity: 0.95 });
const RING_SHAPE = new THREE.RingGeometry(0.75, 0.95, 40).rotateX(-Math.PI / 2);

const textures = new Map<string, THREE.Texture>();

/** Surface texture for a damage stage: the base pattern with cracks drawn over it. */
type Surface = NonNullable<PartDesc['texture']> | 'plain';

function damageTexture(base: Surface, stage: Stage): THREE.Texture {
  const key = `${base}${stage}`;
  const cached = textures.get(key);
  if (cached) return cached;

  // The noodle carton's picture is finer than the rest: it is the whole of what is on it.
  const size = base === 'noodles' ? 256 : 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);

  // Rind: green, with darker wavy stripes running from one end to the other.
  if (base === 'melon') drawMelonRind(g, size);
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

  if (base === 'sign') {
    // The canteen's name, 阿月, down a red lightbox's face in white: drawn squat, as the face it goes on is half as tall again
    // as it is wide.
    g.fillStyle = '#c8262a';
    g.fillRect(0, 0, size, size);
    g.fillStyle = '#ffffff';
    g.font = `bold ${Math.round(size * 0.5)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.save();
    g.scale(1, 1 / 1.5);
    g.fillText('阿', size / 2, size * 0.27 * 1.5);
    g.fillText('月', size / 2, size * 0.73 * 1.5);
    g.restore();
  }

  if (base === 'cabbage') {
    // Pale green leaves wrapped round one another: each one's edge a darker wavy line across, its rib a pale line from the
    // stalk up.
    g.fillStyle = '#b9d98a';
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 7; i++) {
      const x0 = (i / 7) * size, y = size * (0.18 + (i % 3) * 0.2);
      g.fillStyle = i % 2 ? '#a8cc78' : '#c6e29c';
      g.beginPath();
      g.moveTo(x0 - 6, size);
      g.lineTo(x0 - 6, y + 8);
      g.quadraticCurveTo(x0 + size / 14, y - 10, x0 + size / 7 + 6, y + 8);
      g.lineTo(x0 + size / 7 + 6, size);
      g.fill();
      g.strokeStyle = '#7fae5a';
      g.lineWidth = 2;
      g.stroke();
      g.strokeStyle = '#eef6d8';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x0 + size / 14, size);
      g.lineTo(x0 + size / 14 + 3, y + 4);
      g.stroke();
    }
  }

  if (base === 'noodles') {
    // A carton of cup noodles: red bands top and bottom edged in yellow, and on the cream between them one big cup of them,
    // drawn bold and outlined to be read across the yard: white, a red band round it, its yellow lid peeled back, the
    // noodles curling over the rim, steam rising. Drawn narrower than it is, as the carton's long faces stretch it.
    const u = size / 256;
    g.fillStyle = '#fbf6ea';
    g.fillRect(0, 0, size, size);
    g.fillStyle = '#d42a22';
    g.fillRect(0, 0, size, size * 0.12);
    g.fillRect(0, size * 0.9, size, size * 0.1);
    g.fillStyle = '#f4c20d';
    g.fillRect(0, size * 0.12, size, size * 0.03);
    g.fillRect(0, size * 0.87, size, size * 0.03);
    g.save();
    g.translate(size * 0.5, 0);
    g.scale(0.8, 1);
    const ink = '#3a2418';
    g.lineJoin = 'round';
    g.lineCap = 'round';
    // Steam.
    g.strokeStyle = '#a8a4a0';
    g.lineWidth = 7 * u;
    for (const x of [-6, 26, 58]) {
      g.beginPath();
      g.moveTo(x * u, 92 * u);
      g.bezierCurveTo((x - 16) * u, 76 * u, (x + 16) * u, 62 * u, x * u, 46 * u);
      g.stroke();
    }
    // The cup, wider at the top, and its red band.
    const cup = (y: number) => 78 - ((y - 104) / (214 - 104)) * 26;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(-cup(104) * u, 104 * u);
    g.lineTo(cup(104) * u, 104 * u);
    g.lineTo(cup(214) * u, 214 * u);
    g.lineTo(-cup(214) * u, 214 * u);
    g.closePath();
    g.fill();
    g.fillStyle = '#d42a22';
    g.beginPath();
    g.moveTo(-cup(148) * u, 148 * u);
    g.lineTo(cup(148) * u, 148 * u);
    g.lineTo(cup(184) * u, 184 * u);
    g.lineTo(-cup(184) * u, 184 * u);
    g.closePath();
    g.fill();
    // On the band, a white bowl of noodles, the maker's mark.
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(0, 160 * u, 15 * u, 0, Math.PI);
    g.fill();
    g.fillRect(-18 * u, 157 * u, 36 * u, 4 * u);
    g.strokeStyle = ink;
    g.lineWidth = 6 * u;
    g.beginPath();
    g.moveTo(-cup(104) * u, 104 * u);
    g.lineTo(-cup(214) * u, 214 * u);
    g.lineTo(cup(214) * u, 214 * u);
    g.lineTo(cup(104) * u, 104 * u);
    g.stroke();
    // The noodles in it, under the rim, and over it.
    g.fillStyle = '#f2c65a';
    g.beginPath();
    g.ellipse(0, 104 * u, 80 * u, 16 * u, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#d99a2a';
    g.lineWidth = 4 * u;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      for (let x = -70; x <= 70; x += 3) {
        const y = 96 + k * 5 + Math.sin(x / 5 + k * 1.7) * 3;
        if (x === -70) g.moveTo(x * u, y * u);
        else g.lineTo(x * u, y * u);
      }
      g.stroke();
    }
    g.strokeStyle = ink;
    g.lineWidth = 6 * u;
    g.beginPath();
    g.ellipse(0, 104 * u, 80 * u, 16 * u, 0, 0, Math.PI * 2);
    g.stroke();
    // The lid, peeled back off the far side and standing up, yellow, a red ring on it.
    g.save();
    g.translate(-34 * u, 74 * u);
    g.rotate(-0.42);
    g.fillStyle = '#f4c20d';
    g.beginPath();
    g.ellipse(0, 0, 58 * u, 24 * u, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#d42a22';
    g.lineWidth = 6 * u;
    g.beginPath();
    g.ellipse(0, 0, 32 * u, 12 * u, 0, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = ink;
    g.lineWidth = 6 * u;
    g.beginPath();
    g.ellipse(0, 0, 58 * u, 24 * u, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
    // A fork stuck in it.
    g.strokeStyle = ink;
    g.lineWidth = 7 * u;
    g.beginPath();
    g.moveTo(40 * u, 100 * u);
    g.lineTo(70 * u, 40 * u);
    g.stroke();
    g.strokeStyle = '#d8dcde';
    g.lineWidth = 4 * u;
    g.beginPath();
    g.moveTo(40 * u, 100 * u);
    g.lineTo(70 * u, 40 * u);
    g.stroke();
    g.restore();
  }

  if (base === 'octopus' || base === 'sucker') {
    // An octopus's skin: red-purple, mottled darker, flecked paler. Along its arms, rows of pale suckers round them.
    let seed = base === 'octopus' ? 5 : 9;
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    g.fillStyle = '#c4566a';
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = i % 3 ? 'rgba(140, 50, 72, 0.45)' : 'rgba(240, 150, 160, 0.4)';
      g.beginPath();
      g.ellipse(rand() * size, rand() * size, 4 + rand() * 10, 3 + rand() * 6, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
    if (base === 'sucker') {
      for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
        const x = (col + 0.5 + (row % 2) * 0.5) * (size / 4), y = (row + 0.5) * (size / 8);
        g.fillStyle = '#f4d0cc';
        g.beginPath();
        g.arc(x % size, y, size * 0.05, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#d88a90';
        g.beginPath();
        g.arc(x % size, y, size * 0.022, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  if (base === 'mahi') {
    // A mahi-mahi's flank: gold, greener toward one pole, flecked with small blue spots.
    let seed = 13;
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const shade = g.createLinearGradient(0, 0, 0, size);
    shade.addColorStop(0, '#e8c434');
    shade.addColorStop(0.55, '#e2c030');
    shade.addColorStop(1, '#b8c040');
    g.fillStyle = shade;
    g.fillRect(0, 0, size, size);
    g.fillStyle = '#2a5aa8';
    for (let i = 0; i < 34; i++) {
      g.beginPath();
      g.arc(rand() * size, rand() * size * 0.9, 1.6 + rand() * 2.2, 0, Math.PI * 2);
      g.fill();
    }
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
  const geometry = shapeGeometry(part);
  if (part.scale) geometry.scale(...part.scale);
  return part.flat ? geometry.scale(1, part.flat, 1) : geometry;
}

function shapeGeometry(part: PartDesc): THREE.BufferGeometry {
  const [a, b, c] = part.size;
  switch (part.shape) {
    case 'box': return new THREE.BoxGeometry(a * 2, b * 2, c * 2);
    case 'cylinder': return new THREE.CylinderGeometry(a, a, b * 2, part.sides ?? 20);
    case 'capsule': return new THREE.CapsuleGeometry(a, b * 2, 4, 10);
    case 'sphere': return new THREE.SphereGeometry(a, 20, 14);
    // The top half of a ball, moved down so that it is centred on its own middle.
    case 'dome': return new THREE.SphereGeometry(a, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, -a / 2, 0);
    case 'cone': return new THREE.ConeGeometry(a, b * 2, part.sides ?? 14);
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
  if (part.cap !== undefined) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.024, 10), new THREE.MeshStandardMaterial({ color: part.cap, roughness: 0.5 }));
    cap.position.y = part.size[1] + 0.012;
    mesh.add(cap);
  }
  if (part.shape === 'dome') {
    // The cut face, closing the open side of the half: a melon's red inside; anything else, its own colour.
    const radius = part.size[0];
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 24).rotateX(Math.PI / 2),
      part.texture === 'melon' ? new THREE.MeshStandardMaterial({ map: damageTexture('flesh', 0), roughness: 0.6 }) : material,
    );
    face.position.y = (-radius / 2) * (part.flat ?? 1);
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
  /** For something hidden along the way, the ring on the ground where it was left; gone once it is taken. */
  ring: THREE.Mesh | null;
  leakLeft: number;
  leakTimer: number;
}

/** Draws the cargo: parts, damage stages, pieces falling off, and the mess it makes. */
export class CargoViews {
  /** Whether something hidden along the way gets the marker over it before it has been found: only in the tutorial. */
  markHidden = false;
  private readonly views = new Map<CargoItem, ItemView>();
  private readonly loose: { sync: BodySync; mesh: THREE.Mesh }[] = [];
  private readonly at = new THREE.Vector3();
  private time = 0;

  /** Called with the colour of what a burst tin threw over the truck. */
  onSpill: ((color: number) => void) | null = null;

  constructor(private readonly scene: THREE.Scene, private readonly bursts: Bursts) {}

  /** Throw away every mesh and build the load again, e.g. after a reset. */
  rebuild(sim: Sim): void {
    for (const view of this.views.values()) {
      this.scene.remove(view.group, view.marker);
      if (view.ring) this.scene.remove(view.ring);
    }
    for (const piece of this.loose) this.scene.remove(piece.mesh);
    this.views.clear();
    this.loose.length = 0;

    for (const item of sim.cargo) {
      const group = new THREE.Group();
      // Put back from a save, an item may have lost parts already, or be no more than its pieces (drawn as they come).
      const meshes = item.type.parts.map((part, i) => {
        if (!item.attached[i]) return null;
        const mesh = partMesh(part, 0);
        if (item.type.id === 'skeleton' && part.shape === 'sphere') addFace(mesh, part.size[0]);
        group.add(mesh);
        return mesh;
      });
      if (item.body) this.scene.add(group);
      const hidden = item.bonus && !this.markHidden;
      const marker = new THREE.Mesh(MARKER_SHAPE, hidden ? HIDDEN_MARKER_MATERIAL : MARKER_MATERIAL);
      marker.visible = false;
      marker.renderOrder = 9;
      this.scene.add(marker);
      let ring: THREE.Mesh | null = null;
      if (hidden && !item.taken && item.body) {
        const at = item.body.translation();
        const half = item.type.hull ? item.type.hull.size[1] : 0.3;
        ring = new THREE.Mesh(RING_SHAPE, new THREE.MeshBasicMaterial({ color: 0x5ec8ff, transparent: true, opacity: 0.7, depthWrite: false }));
        ring.position.set(at.x, at.y - half + 0.04, at.z);
        ring.renderOrder = 2;
        this.scene.add(ring);
      }
      const view: ItemView = {
        item, group, meshes, marker, ring,
        sync: item.body ? new BodySync(item.body, group) : null,
        flash: 0, leakLeft: 0, leakTimer: 0,
      };
      this.views.set(item, view);
      if (item.stage > 0 && item.body) this.restyle(view);
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
        this.bursts.emit(item.lastPos, item.type.burst, item.type.burst === 'water' || item.type.burst === 'pulp' || item.type.burst.startsWith('paint') ? 60 : 30, 4.5);
        if (item.type.burst.startsWith('paint')) this.onSpill?.(item.type.parts[1].color);
        break;
      case 'fallen':
      case 'recovered':
      case 'scrap':
        break;
    }
  }

  /** Call after every physics step. */
  /** Every item drawn where its body now is, with no gliding there: after the truck has been picked up and put down elsewhere. */
  snap(): void {
    for (const view of this.views.values()) view.sync?.snap();
    for (const piece of this.loose) piece.sync.snap();
  }

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
      if (view.ring) {
        view.ring.visible = !item.taken;
        (view.ring.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(this.time * 3) * 0.25;
      }
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
          this.bursts.emit(this.at.copy(view.group.position), item.type.burst === 'pulp' || item.type.burst === 'ink' || item.type.burst.startsWith('paint') ? item.type.burst : 'water', 1, 0.8);
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
