import * as THREE from 'three';
import { mulberry32 } from '../levels/sandbox';
import { heightAt } from '../levels/terrain';
import type { GateDesc, PropDesc, SignDesc, SlickDesc } from '../levels/types';
import type { Sim } from '../sim/sim';
import { TRAIN_HALF } from '../sim/trains';
import { buildingMesh } from './buildings';
import { BodySync, propMesh } from './meshes';
import { Shapes } from './shapes';
import { brakeLights, vehicleMesh } from './vehicles';

const FADED_OPACITY = 0.16;
const FADE_RATE = 8;
const DECAL_Y = 0.02;

interface Fader {
  material: THREE.MeshStandardMaterial;
  box: THREE.Box3;
  opacity: number;
}

const LIVERIES = [0xd8483a, 0x2f6fb0, 0xe0a020, 0x3f8f5f, 0x8a4fa0, 0xd06a2a];

function trainMesh(color: number): THREE.Group {
  const train = new THREE.Group();
  const { length, height, width } = TRAIN_HALF;
  const part = (size: [number, number, number], y: number, material: THREE.Material, x = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(x, y, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    train.add(mesh);
  };
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1b2a3a, roughness: 0.2, metalness: 0.4 });
  const warning = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 });
  part([length * 2, height * 2 - 0.6, width * 2], 0.3, paint);
  part([length * 2 - 0.4, 0.6, width * 2 - 0.5], -height + 0.3, dark);
  part([length * 2 - 3, 0.8, width * 2 + 0.04], 0.75, glass);
  part([length * 2 - 1, 0.2, width * 2 - 0.6], height + 0.1, dark);
  // A yellow nose at each end, since they run both ways.
  for (const end of [-1, 1]) part([0.5, height * 2 - 0.6, width * 2 + 0.04], 0.3, warning, end * (length - 0.2));
  return train;
}

/** Spilt oil: overlapping dark pools with a sheen, and a few streaks of colour where it is thin. */
function slickMesh(slicks: SlickDesc[]): THREE.Group {
  const group = new THREE.Group();
  const rand = mulberry32(11);
  const oil = new THREE.MeshStandardMaterial({ color: 0x16181e, roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const sheens = [0x7a4fd0, 0x2fb0a8, 0xd0a030].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.6, transparent: true, opacity: 0.28, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  );
  const disc = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
  let layer = 0;
  let ground = 0;
  const pool = (x: number, z: number, rx: number, rz: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(disc, material);
    // Each a hair above the last, so that none of them shimmer against each other.
    mesh.position.set(x, ground + 0.03 + layer++ * 0.0015, z);
    mesh.scale.set(rx, 1, rz);
    mesh.rotation.y = rand() * Math.PI;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  for (const { pos, half, y } of slicks) {
    ground = y ?? 0;
    const count = Math.round((half[0] * half[1]) / 7);
    const inside = (radius: number): [number, number] => [
      pos[0] + (rand() * 2 - 1) * Math.max(0, half[0] - radius),
      pos[1] + (rand() * 2 - 1) * Math.max(0, half[1] - radius),
    ];
    for (let i = 0; i < count; i++) {
      const radius = 1.6 + rand() * 2.6;
      pool(...inside(radius), radius, radius * (0.6 + rand() * 0.4), oil);
    }
    for (let i = 0; i < count / 2; i++) {
      const radius = 0.6 + rand() * 1.4;
      pool(...inside(radius), radius * 1.6, radius * 0.5, sheens[i % sheens.length]);
    }
  }
  return group;
}

/** The face of a 'slippery road' sign: a yellow triangle with a skidding car, and the words under it. */
function slipperyTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#f4f4f0';
  g.fillRect(0, 0, 256, 320);
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(128, 22);
  g.lineTo(236, 208);
  g.lineTo(20, 208);
  g.closePath();
  g.fillStyle = '#ffd21f';
  g.fill();
  g.lineWidth = 14;
  g.strokeStyle = '#16181c';
  g.stroke();
  // The car, seen from behind and leaning, over two wavy skid marks.
  g.save();
  g.translate(128, 128);
  g.rotate(-0.22);
  g.fillStyle = '#16181c';
  g.fillRect(-30, -22, 60, 30);
  g.fillRect(-22, -42, 44, 24);
  g.fillRect(-34, 6, 16, 14);
  g.fillRect(18, 6, 16, 14);
  g.restore();
  g.lineWidth = 7;
  g.lineCap = 'round';
  for (const x of [100, 156]) {
    g.beginPath();
    g.moveTo(x, 158);
    g.bezierCurveTo(x - 16, 170, x + 16, 180, x - 6, 194);
    g.stroke();
  }
  g.fillStyle = '#16181c';
  g.font = '900 52px "Microsoft JhengHei", "PingFang TC", sans-serif';
  g.textAlign = 'center';
  g.fillText('小心地滑', 128, 282);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** The face of a 'people on foot only' sign: a blue disc with a walking figure, and the words under it. */
function pedestrianTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#f4f4f0';
  g.fillRect(0, 0, 256, 320);
  g.fillStyle = '#1f5fbf';
  g.beginPath();
  g.arc(128, 118, 100, 0, Math.PI * 2);
  g.fill();
  // A figure walking: head, body, a leg forward and a leg back, an arm swinging.
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#ffffff';
  g.lineCap = 'round';
  g.beginPath();
  g.arc(132, 54, 14, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 20;
  g.beginPath();
  g.moveTo(128, 80);
  g.lineTo(120, 140);
  g.moveTo(120, 140);
  g.lineTo(150, 196);
  g.moveTo(120, 140);
  g.lineTo(96, 196);
  g.moveTo(126, 92);
  g.lineTo(158, 128);
  g.moveTo(126, 92);
  g.lineTo(100, 124);
  g.stroke();
  g.fillStyle = '#1f2a36';
  g.font = 'bold 50px sans-serif';
  g.textAlign = 'center';
  g.fillText('行人專用', 128, 290);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** The faces of the diversion signs: a blue square with a white turn-round arrow; a yellow board with an arrow to the left and
 * the words for a diversion; a blue board with an arrow straight on, to the temple square. */
/** The faces of the notices: a yellow board with two children and the word for a school; an orange one for works in the road. */
function noticeTexture(kind: 'school' | 'works' | 'bends'): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#f4f4f0';
  g.fillRect(0, 0, 256, 320);
  g.fillStyle = kind === 'school' ? '#f2c12e' : '#f07a1a';
  g.beginPath();
  g.moveTo(128, 14);
  g.lineTo(242, 128);
  g.lineTo(128, 242);
  g.lineTo(14, 128);
  g.closePath();
  g.fill();
  g.strokeStyle = '#1f2a36';
  g.lineWidth = 8;
  g.stroke();
  g.fillStyle = '#1f2a36';
  g.strokeStyle = '#1f2a36';
  g.lineCap = 'round';
  if (kind === 'bends') {
    // The road winding one way and back the other, and back again.
    g.lineWidth = 16;
    g.beginPath();
    g.moveTo(128, 205);
    g.bezierCurveTo(70, 175, 190, 150, 128, 120);
    g.bezierCurveTo(70, 95, 180, 75, 140, 52);
    g.stroke();
    g.beginPath();
    g.moveTo(152, 34);
    g.lineTo(118, 50);
    g.lineTo(150, 70);
    g.closePath();
    g.fill();
  } else if (kind === 'school') {
    // Two children walking, the bigger holding the smaller's hand.
    for (const [x, s] of [[104, 1], [156, 0.8]] as const) {
      g.beginPath();
      g.arc(x, 92 + (1 - s) * 30, 12 * s, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 14 * s;
      g.beginPath();
      g.moveTo(x, 110 + (1 - s) * 30);
      g.lineTo(x, 150);
      g.moveTo(x, 150);
      g.lineTo(x - 12 * s, 182);
      g.moveTo(x, 150);
      g.lineTo(x + 12 * s, 182);
      g.stroke();
    }
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(104, 128);
    g.lineTo(156, 134);
    g.stroke();
  } else {
    // A man with a shovel at a heap.
    g.beginPath();
    g.arc(112, 84, 13, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 14;
    g.beginPath();
    g.moveTo(110, 100);
    g.lineTo(100, 148);
    g.lineTo(84, 184);
    g.moveTo(100, 148);
    g.lineTo(122, 182);
    g.moveTo(108, 112);
    g.lineTo(150, 140);
    g.stroke();
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(130, 110);
    g.lineTo(170, 168);
    g.stroke();
    g.beginPath();
    g.moveTo(150, 190);
    g.quadraticCurveTo(180, 150, 200, 190);
    g.fill();
  }
  g.font = 'bold 44px sans-serif';
  g.textAlign = 'center';
  g.fillText(kind === 'school' ? '前有學校' : kind === 'bends' ? '連續彎路' : '水管搶修', 128, 292);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** A school's name in white on blue, in a gold frame. */
function nameTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 112;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#d9a62e';
  g.fillRect(0, 0, 512, 112);
  g.fillStyle = '#1f4f9a';
  g.fillRect(8, 8, 496, 96);
  g.fillStyle = '#ffffff';
  g.font = 'bold 72px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('山城國小', 256, 60);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function arrowTexture(kind: 'uturn' | 'detour' | 'ahead'): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#f4f4f0';
  g.fillRect(0, 0, 256, 320);
  const board = kind === 'detour' ? '#f2c12e' : '#1f5fbf';
  const ink = kind === 'detour' ? '#1f2a36' : '#ffffff';
  g.fillStyle = board;
  g.fillRect(16, 16, 224, 224);
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineWidth = 26;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const head = (x: number, y: number, dx: number, dy: number) => {
    g.beginPath();
    g.moveTo(x + dx * 34, y + dy * 34);
    g.lineTo(x - dy * 30, y + dx * 30);
    g.lineTo(x + dy * 30, y - dx * 30);
    g.closePath();
    g.fill();
  };
  g.beginPath();
  if (kind === 'uturn') {
    g.moveTo(170, 200);
    g.lineTo(170, 110);
    g.arc(128, 110, 42, 0, Math.PI, true);
    g.lineTo(86, 160);
    g.stroke();
    head(86, 170, 0, 1);
  } else if (kind === 'detour') {
    g.moveTo(190, 128);
    g.lineTo(80, 128);
    g.stroke();
    head(70, 128, -1, 0);
  } else {
    g.moveTo(128, 210);
    g.lineTo(128, 80);
    g.stroke();
    head(128, 70, 0, -1);
  }
  g.fillStyle = '#1f2a36';
  g.font = 'bold 44px sans-serif';
  g.textAlign = 'center';
  g.fillText(kind === 'uturn' ? '請迴轉' : kind === 'detour' ? '遶境改道' : '往廟埕', 128, 292);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function signMeshes(signs: SignDesc[]): THREE.Group {
  const group = new THREE.Group();
  const faces: Partial<Record<SignDesc['kind'], THREE.Material>> = {};
  const faceOf = (kind: SignDesc['kind']) => (faces[kind] ??= new THREE.MeshBasicMaterial({ map: kind === 'pedestrian' ? pedestrianTexture() : kind === 'slippery' ? slipperyTexture() : kind === 'school' || kind === 'works' || kind === 'bends' ? noticeTexture(kind) : kind === 'schoolName' ? nameTexture() : arrowTexture(kind) }));
  const steel = new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.6 });
  for (const sign of signs) {
    const root = new THREE.Group();
    root.position.set(...sign.pos);
    root.rotation.y = sign.rotY;
    if (sign.kind === 'schoolName') {
      // Upright, its middle where it is put: over a gate, on a wall.
      const plate = new THREE.Mesh(new THREE.BoxGeometry(6, 1.31, 0.1), [steel, steel, steel, steel, faceOf(sign.kind), steel]);
      root.add(plate);
      group.add(root);
      continue;
    }
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8), steel);
    post.position.y = 1.1;
    post.castShadow = true;
    // Leaning well back: the game is watched from above, and a sign stood upright would be edge-on.
    const board = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 0.06), [steel, steel, steel, steel, faceOf(sign.kind), steel]);
    board.position.set(0, 2.5, -0.5);
    board.rotation.x = -0.9;
    board.castShadow = true;
    root.add(post, board);
    group.add(root);
  }
  return group;
}

/** Unit shapes that an instance matrix scales up to a prop's size. */
const UNIT = {
  box: () => new THREE.BoxGeometry(2, 2, 2),
  cylinder: () => new THREE.CylinderGeometry(1, 1, 2, 16),
  cone: () => new THREE.ConeGeometry(1, 2, 14),
};

/**
 * Scenery that never moves or fades, drawn as one instanced mesh per shape. A city has
 * thousands of these (trees, pavements, fences), far too many to draw one by one.
 */
function staticProps(props: PropDesc[]): THREE.InstancedMesh[] {
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  return (Object.keys(UNIT) as (keyof typeof UNIT)[]).flatMap((shape) => {
    const group = props.filter((p) => p.shape === shape);
    if (!group.length) return [];
    const mesh = new THREE.InstancedMesh(UNIT[shape](), new THREE.MeshStandardMaterial({ roughness: 0.85 }), group.length);
    group.forEach((p, i) => {
      const [a, b, c] = p.size;
      if (shape === 'box') scale.set(a, b, c);
      else scale.set(a, b, a);
      const [rx, ry, rz] = p.rot ?? [0, 0, 0];
      matrix.compose(position.set(...p.pos), rotation.setFromEuler(euler.set(rx, ry, rz)), scale);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.set(p.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Instances are spread across the whole map; the default bounds would cull them wrongly.
    mesh.frustumCulled = false;
    return [mesh];
  });
}

/** Paving: rows of bricks laid end to end, each a little lighter or darker than the next. Two metres of it to a side. */
function pavingTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const rand = mulberry32(31);
  const rows = 8;
  const columns = 4;
  for (let row = 0; row < rows; row++) {
    for (let column = -1; column < columns; column++) {
      const shade = Math.round(214 + rand() * 41);
      g.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
      // Each row set off by half a brick from the last.
      g.fillRect((column + (row % 2) * 0.5) * (size / columns), row * (size / rows), size / columns, size / rows);
    }
  }
  g.fillStyle = 'rgba(70, 70, 70, 0.5)';
  for (let row = 0; row < rows; row++) {
    g.fillRect(0, row * (size / rows), size, 2);
    for (let column = 0; column < columns; column++) g.fillRect((column + (row % 2) * 0.5) * (size / columns), row * (size / rows), 2, size / rows);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** All the pavements as one mesh, the bricks running on from one slab to the next. */
function pavedMesh(props: PropDesc[]): THREE.Mesh {
  const position: number[] = [];
  const normal: number[] = [];
  const uv: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const tint = new THREE.Color();
  const face = (corners: [number, number, number][], n: [number, number, number], flat: [number, number, number] = n) => {
    const first = position.length / 3;
    for (const [x, y, z] of corners) {
      position.push(x, y, z);
      normal.push(...n);
      // By where it is in the world; up the side of a kerb, by its height.
      uv.push((flat[0] ? z : x) / 2, (flat[1] ? z : y) / 2);
      colors.push(tint.r, tint.g, tint.b);
    }
    index.push(first, first + 1, first + 2, first, first + 2, first + 3);
  };
  const turn = new THREE.Euler();
  const spot = new THREE.Vector3();
  for (const p of props) {
    const [hx, hy, hz] = p.size;
    tint.set(p.color);
    // Where each corner is, and which way each face looks: as it lies, or, if it is turned (a pavement on a slope), turned about its middle.
    turn.set(...(p.rot ?? [0, 0, 0]));
    const at = (x: number, y: number, z: number): [number, number, number] => {
      if (!p.rot) return [p.pos[0] + x, p.pos[1] + y, p.pos[2] + z];
      spot.set(x, y, z).applyEuler(turn);
      return [p.pos[0] + spot.x, p.pos[1] + spot.y, p.pos[2] + spot.z];
    };
    const side = (corners: [number, number, number][], n: [number, number, number]) => {
      if (!p.rot) return face(corners, n);
      spot.set(...n).applyEuler(turn);
      face(corners, [spot.x, spot.y, spot.z], n);
    };
    const [x0, x1, y0, y1, z0, z1] = [-hx, hx, -hy, hy, -hz, hz];
    side([at(x0, y1, z1), at(x1, y1, z1), at(x1, y1, z0), at(x0, y1, z0)], [0, 1, 0]);
    side([at(x1, y0, z1), at(x1, y0, z0), at(x1, y1, z0), at(x1, y1, z1)], [1, 0, 0]);
    side([at(x0, y0, z0), at(x0, y0, z1), at(x0, y1, z1), at(x0, y1, z0)], [-1, 0, 0]);
    side([at(x0, y0, z1), at(x1, y0, z1), at(x1, y1, z1), at(x0, y1, z1)], [0, 0, 1]);
    side([at(x1, y0, z0), at(x0, y0, z0), at(x0, y1, z0), at(x1, y1, z0)], [0, 0, -1]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: pavingTexture(), vertexColors: true, roughness: 0.9 }));
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** How far up a crossing gate's arm stands when it is open, radians, and how fast it swings. */
const GATE_UP = 1.4;
const GATE_RATE = 1.6;
const gateMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });

/** The arm of a crossing gate, hinged at the origin and reaching along +X: yellow and black by turns, with a weight behind the hinge. */
function gateArm(length: number): THREE.Mesh {
  const shapes = new Shapes();
  const pieces = Math.round(length / 0.6);
  for (let i = 0; i < pieces; i++) shapes.box(((i + 0.5) * length) / pieces, 0, 0, length / pieces / 2, 0.06, 0.06, i % 2 ? 0x1c1d20 : 0xf2c12e, undefined, 0);
  shapes.box(-0.45, 0, 0, 0.45, 0.16, 0.1, 0x30363d);
  // A red lamp at the tip, and one half way.
  for (const at of [length - 0.15, length / 2]) shapes.box(at, 0.11, 0, 0.07, 0.05, 0.07, 0xd0302a);
  const mesh = new THREE.Mesh(shapes.geometry(), gateMaterial);
  mesh.castShadow = true;
  return mesh;
}

interface Gate {
  desc: GateDesc;
  pivot: THREE.Group;
  angle: number;
  broken: boolean;
}

/** Draws everything in the level that isn't the truck or its cargo. */
export class LevelView {
  private readonly syncs: BodySync[] = [];
  /** Each vehicle's brake lights, to light while it brakes. */
  private readonly brakes: { car: Sim['traffic']['cars'][number]; mesh: THREE.Mesh }[] = [];
  private readonly faders: Fader[] = [];
  private readonly finishGlow: THREE.Mesh | null = null;
  /** One pair of materials per railway track: the lamps and the panels that show its signal. */
  private readonly signals: { lamp: THREE.MeshBasicMaterial; panel: THREE.MeshBasicMaterial }[] = [];
  private readonly gates: Gate[] = [];
  private broken: THREE.Vector3[] = [];
  private readonly ray = new THREE.Ray();
  private readonly hit = new THREE.Vector3();
  private time = 0;
  /** Notes rising from whatever is playing music, and what is playing it. */
  private readonly notes: { body: Sim['objects']['objects'][number]; sprites: THREE.Sprite[] }[] = [];
  /** Fires: a glow at the mouth and sparks going up, from each thing with a fire in it. */
  private readonly fires: { body: Sim['objects']['objects'][number]; glow: THREE.Sprite; sparks: THREE.Sprite[] }[] = [];

  constructor(scene: THREE.Scene, private readonly sim: Sim) {
    const { props, decals, finish } = sim.level;

    // A level may have none of these: adding nothing is an error to three.
    for (const mesh of staticProps(props.filter((p) => p.mass === undefined && !p.fade && !p.paving))) scene.add(mesh);
    const paved = props.filter((p) => p.paving);
    if (paved.length) scene.add(pavedMesh(paved));
    for (const desc of props) {
      if (!desc.fade) continue;
      const mesh = desc.building ? buildingMesh(desc, desc.building) : propMesh(desc);
      scene.add(mesh);
      this.faders.push(this.fader(mesh, desc));
    }
    for (const prop of sim.props) {
      if (prop.desc.mass === undefined) continue;
      const mesh = propMesh(prop.desc);
      scene.add(mesh);
      this.syncs.push(new BodySync(prop.body, mesh));
    }

    for (const [n, car] of sim.traffic.cars.entries()) {
      const mesh = vehicleMesh(car.kind, car.color, n);
      const brakes = brakeLights(car.kind);
      mesh.add(brakes);
      this.brakes.push({ car, mesh: brakes });
      scene.add(mesh);
      this.syncs.push(new BodySync(car.body, mesh));
    }

    for (const train of sim.trains.trains) {
      const mesh = trainMesh(LIVERIES[train.track % LIVERIES.length]);
      scene.add(mesh);
      this.syncs.push(new BodySync(train.body, mesh));
    }
    this.addSignals(scene);
    for (const desc of sim.level.gates ?? []) {
      const pivot = new THREE.Group();
      pivot.position.set(...desc.pos);
      if (desc.reach < 0) pivot.rotation.y = Math.PI;
      pivot.rotation.z = GATE_UP;
      pivot.add(gateArm(desc.length));
      scene.add(pivot);
      this.gates.push({ desc, pivot, angle: GATE_UP, broken: false });
    }
    if (sim.level.slicks?.length) scene.add(slickMesh(sim.level.slicks));
    if (sim.level.signs?.length) scene.add(signMeshes(sim.level.signs));

    if (decals.length) scene.add(this.decalMesh(sim));
    // Fires: glowing at the furnace's mouth, sparks drifting up out of its chimney.
    if (sim.level.fires?.length) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const g = canvas.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255,240,180,1)');
      grad.addColorStop(0.4, 'rgba(255,150,40,0.8)');
      grad.addColorStop(1, 'rgba(255,80,20,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      const map = new THREE.CanvasTexture(canvas);
      for (const index of sim.level.fires) {
        const thing = sim.objects.objects[index];
        if (!thing) continue;
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.scale.set(1.6, 1.6, 1);
        scene.add(glow);
        const sparks = Array.from({ length: 16 }, () => {
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
          sprite.scale.set(0.2, 0.2, 1);
          scene.add(sprite);
          return sprite;
        });
        this.fires.push({ body: thing, glow, sparks });
      }
    }
    // Music: notes drifting up from each radio, a few at a time.
    if (sim.level.music?.length) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const g = canvas.getContext('2d')!;
      g.fillStyle = '#ffffff';
      g.font = 'bold 52px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('♪', 32, 34);
      const map = new THREE.CanvasTexture(canvas);
      const tints = [0xff5a8a, 0xffd23a, 0x5ad2ff, 0x9aff6a];
      for (const index of sim.level.music) {
        const thing = sim.objects.objects[index];
        if (!thing) continue;
        const sprites = tints.map((color) => {
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, depthWrite: false }));
          sprite.scale.set(0.9, 0.9, 1);
          scene.add(sprite);
          return sprite;
        });
        this.notes.push({ body: thing, sprites });
      }
    }

    if (finish) {
      // A glowing box over the delivery bay, visible from a distance.
      this.finishGlow = new THREE.Mesh(
        new THREE.BoxGeometry(finish.half[0] * 2, 4, finish.half[1] * 2),
        new THREE.MeshBasicMaterial({ color: 0x4dff88, transparent: true, opacity: 0.2, depthWrite: false }),
      );
      this.finishGlow.position.set(finish.pos[0], 2 + heightAt(sim.level.terrain, finish.pos[0], finish.pos[1]), finish.pos[1]);
      scene.add(this.finishGlow);
    }
  }

  /** Call after every physics step. */
  capture(): void {
    for (const s of this.syncs) s.capture();
  }

  snap(): void {
    for (const s of this.syncs) s.snap();
    // A reset mends the gates.
    for (const gate of this.gates) {
      gate.broken = false;
      gate.pivot.visible = true;
    }
  }

  /** Where a gate has been driven through since the last call. */
  takeBroken(): THREE.Vector3[] {
    const out = this.broken;
    this.broken = [];
    return out;
  }

  apply(alpha: number): void {
    for (const s of this.syncs) s.apply(alpha);
  }

  /** Fade out whatever stands between the camera and the truck, and animate the delivery bay. */
  update(dt: number, camera: THREE.Camera, truck: THREE.Vector3): void {
    this.time += dt;
    for (const { body, glow, sparks } of this.fires) {
      const p = body.body.translation();
      const lit = !body.knocked;
      glow.visible = lit;
      // At its mouth, which faces the way it is turned; flames licking up out of it.
      const r = body.body.rotation();
      const mouth = new THREE.Vector3(0, 1.1, 1.5).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
      glow.position.set(p.x + mouth.x, p.y + mouth.y + Math.abs(Math.sin(this.time * 9)) * 0.25, p.z + mouth.z);
      glow.scale.setScalar(2.2 + Math.sin(this.time * 13) * 0.35 + Math.sin(this.time * 7.3) * 0.3);
      sparks.forEach((spark, k) => {
        const t = (this.time * 0.7 + k / sparks.length) % 1;
        spark.visible = lit;
        spark.position.set(p.x + Math.sin((t + k) * 9) * 0.3, p.y + 4.9 + t * 4, p.z + Math.cos((t + k) * 7) * 0.3);
        (spark.material as THREE.SpriteMaterial).opacity = 1 - t;
      });
    }
    for (const { body, sprites } of this.notes) {
      const p = body.body.translation();
      sprites.forEach((sprite, k) => {
        const t = (this.time * 0.55 + k / sprites.length) % 1;
        sprite.visible = !body.knocked;
        sprite.position.set(p.x + Math.sin((t + k) * 6) * 0.5, p.y + 1 + t * 2.6, p.z + Math.cos((t + k) * 5) * 0.3);
        (sprite.material as THREE.SpriteMaterial).opacity = Math.sin(t * Math.PI);
      });
    }
    for (const { car, mesh } of this.brakes) mesh.visible = car.braking && car.knocked <= 0;
    if (this.finishGlow) {
      (this.finishGlow.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(this.time * 3) * 0.07;
    }

    // Signals: flashing red while a train is due, steady green otherwise.
    const flash = Math.sin(this.time * 14) > 0;
    this.signals.forEach(({ lamp, panel }, track) => {
      const red = this.sim.trains.warning(track);
      lamp.color.set(red ? (flash ? 0xff2a1a : 0x551008) : 0x30ff70);
      // The lamps flash; the ground under the train's path just turns red, steadily.
      panel.color.set(red ? 0xff2a1a : 0x30d868);
      panel.opacity = red ? 0.6 : 0.22;
    });

    // The gates: down while their track's signal is red. One driven through while it is down is gone.
    const at = this.sim.truck.body.translation();
    const moving = Math.abs(this.sim.truck.forwardSpeed()) > 1;
    for (const gate of this.gates) {
      const target = this.sim.trains.warning(gate.desc.track) ? 0 : GATE_UP;
      gate.angle += Math.max(-GATE_RATE * dt, Math.min(GATE_RATE * dt, target - gate.angle));
      gate.pivot.rotation.z = gate.angle;
      if (gate.broken || gate.angle > 0.35 || !moving) continue;
      const [x, y, z] = gate.desc.pos;
      const along = (at.x - x) * gate.desc.reach;
      if (along > -1.3 && along < gate.desc.length + 1.3 && Math.abs(at.z - z) < 3.9) {
        gate.broken = true;
        gate.pivot.visible = false;
        this.broken.push(new THREE.Vector3(at.x, y, z));
      }
    }

    const reach = camera.position.distanceTo(truck);
    this.ray.origin.copy(camera.position);
    this.ray.direction.copy(truck).sub(camera.position).normalize();
    const ease = 1 - Math.exp(-FADE_RATE * dt);
    for (const f of this.faders) {
      const point = this.ray.intersectBox(f.box, this.hit);
      const blocking = point !== null && point.distanceTo(camera.position) < reach;
      const target = blocking ? FADED_OPACITY : 1;
      if (f.opacity === target) continue;
      f.opacity += (target - f.opacity) * ease;
      if (Math.abs(f.opacity - target) < 0.01) f.opacity = target;
      f.material.opacity = f.opacity;
      // Only pay for transparency while something is actually see-through.
      const transparent = f.opacity < 1;
      if (f.material.transparent !== transparent) {
        f.material.transparent = transparent;
        f.material.depthWrite = !transparent;
        f.material.needsUpdate = true;
      }
    }
  }

  private addSignals(scene: THREE.Scene): void {
    const lampShape = new THREE.SphereGeometry(0.3, 12, 8);
    const hoodShape = new THREE.BoxGeometry(0.9, 0.9, 0.5);
    const hood = new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 0.8 });
    for (const signal of this.sim.level.signals ?? []) {
      const materials = (this.signals[signal.track] ??= {
        lamp: new THREE.MeshBasicMaterial({ color: 0x30ff70 }),
        panel: new THREE.MeshBasicMaterial({ color: 0x30d868, transparent: true, opacity: 0.3, depthWrite: false }),
      });
      if (signal.panel) {
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(signal.panel[0], signal.panel[1]).rotateX(-Math.PI / 2), materials.panel);
        panel.position.set(...signal.pos);
        scene.add(panel);
        continue;
      }
      const lamp = new THREE.Mesh(lampShape, materials.lamp);
      lamp.position.set(...signal.pos);
      const box = new THREE.Mesh(hoodShape, hood);
      box.position.set(...signal.pos);
      // The lamp faces up as much as sideways: it is mostly seen from above.
      lamp.scale.set(1, 1.6, 1.2);
      scene.add(lamp, box);
    }
  }

  private fader(mesh: THREE.Mesh, desc: PropDesc): Fader {
    const [hx, hy, hz] = desc.size;
    const [x, y, z] = desc.pos;
    // Slightly fattened, so the truck is revealed before it is right behind a corner.
    const pad = 1.5;
    return {
      material: mesh.material as THREE.MeshStandardMaterial,
      box: new THREE.Box3(new THREE.Vector3(x - hx - pad, y - hy, z - hz - pad), new THREE.Vector3(x + hx + pad, y + hy, z + hz + pad)),
      opacity: 1,
    };
  }

  /** All the ground markings as one instanced mesh. */
  private decalMesh(sim: Sim): THREE.InstancedMesh {
    const { decals } = sim.level;
    const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.InstancedMesh(geometry, material, decals.length);
    mesh.receiveShadow = true;

    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();
    const across = new THREE.Vector3(1, 0, 0);
    const along = new THREE.Vector3(0, 0, 1);
    const lean = new THREE.Quaternion();
    decals.forEach((d, i) => {
      rotation.setFromAxisAngle(up, d.rotY ?? 0);
      // On a slope it lies along the slope: turned first, then leant over, and stretched to cover the same ground.
      const [sx, sz] = d.tilt ?? [0, 0];
      const back = -Math.atan(sz);
      const side = Math.atan(sx * Math.cos(back));
      if (side) rotation.premultiply(lean.setFromAxisAngle(along, side));
      if (back) rotation.premultiply(lean.setFromAxisAngle(across, back));
      // Later decals sit a hair higher, so overlapping ones stack in the order they were listed.
      const y = (d.base ?? 0) + (d.y ?? DECAL_Y) + i * 1e-5;
      const turned = Math.abs(Math.sin(d.rotY ?? 0));
      const wide = 1 / Math.cos(side) - 1;
      const long = 1 / Math.cos(back) - 1;
      matrix.compose(new THREE.Vector3(d.pos[0], y, d.pos[1]), rotation, new THREE.Vector3(d.size[0] * (1 + wide * (1 - turned) + long * turned), 1, d.size[1] * (1 + long * (1 - turned) + wide * turned)));
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.set(d.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }
}
