import * as THREE from 'three';
import { CAMERA } from '../config';
import { loadChoice } from '../graphics-choice';
import { groundTiles } from '../levels/ground';
import { terrainMesh } from '../levels/terrain';
import type { LevelDef } from '../levels/types';

export interface View {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  /** Where the sun stands, from whatever it is lighting. */
  sunOffset: THREE.Vector3;
}

/** The light at each time of day: the sky, the light from all round (from above, from below, how much), the sun (its colour, how much), and where it stands. */
const LIGHT = {
  day: { sky: 0x9fc4e0, above: 0xdcecff, below: 0x5a5648, all: 1.1, sun: 0xfff2dc, strength: 2.2, from: [-25, 45, -18] },
  dusk: { sky: 0xe0b08a, above: 0xffe2c8, below: 0x6a5c50, all: 1.35, sun: 0xffc48a, strength: 2.3, from: [-40, 26, -14] },
};

/** The way the light comes from, on the flat, for drawing the lie of the land: the same side as the sun stands. */
const RELIEF_FROM = [-0.81, -0.58];

/** A line round the ground at every metre of height, as on a map: close together where it is steep, none where it is level. */
function contoured(material: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vHeight;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeight = position.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vHeight;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float nearLine = abs(fract(vHeight + 0.5) - 0.5) / max(fwidth(vHeight), 0.0001);
        diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.7, 1.6, nearLine));`,
      );
  };
  return material;
}

function groundTexture(ground: LevelDef['ground'], plain = false): THREE.Texture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const earth = ground.style === 'earth';
  // Plain: nearly white, so that the colours the ground is given show as they are, with only a grain over them.
  g.fillStyle = plain ? '#f2f2f2' : earth ? '#8a7a5e' : '#5b626b';
  g.fillRect(0, 0, size, size);
  // Speckle, so the ground reads as moving even between grid lines.
  for (let i = 0; i < 2500; i++) {
    const shade = 80 + Math.random() * 40;
    g.fillStyle = plain ? `rgba(${shade + 110}, ${shade + 110}, ${shade + 104}, 0.6)` : earth ? `rgba(${shade + 46}, ${shade + 28}, ${shade - 4}, 0.5)` : `rgba(${shade}, ${shade + 6}, ${shade + 12}, 0.5)`;
    g.fillRect(Math.random() * size, Math.random() * size, earth ? 3 : 2, earth ? 3 : 2);
  }
  // A 10 m grid for the test course, to judge speed and distance by.
  if (ground.style === 'grid') {
    g.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    g.lineWidth = 4;
    g.strokeRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** The ground as flat rectangles that leave the pits open, textured by where they are: one tile per 10 m. */
/** A wall of dressed stone blocks, courses offset, the mortar between them darker: for the upright faces of the ground. */
function stoneTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#8c867b';
  g.fillRect(0, 0, size, size);
  const course = 32;
  for (let row = 0; row < size / course; row++) {
    const shift = row % 2 ? 32 : 0;
    for (let col = -1; col < size / 64 + 1; col++) {
      const shade = 168 + ((row * 7 + col * 13) % 5) * 7;
      g.fillStyle = `rgb(${shade}, ${shade - 5}, ${shade - 14})`;
      g.fillRect(col * 64 + shift + 2, row * course + 2, 60, course - 4);
    }
  }
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = `rgba(60, 55, 48, ${Math.random() * 0.12})`;
    g.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The upright faces of ground built of pieces (walls between levels), taken out of it to be drawn as stone, with the texture running along each. */
function wallGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry | null {
  const pos = geometry.getAttribute('position');
  const index = geometry.getIndex()!;
  const keep: number[] = [];
  const out: number[] = [];
  const uv: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < index.count; i += 3) {
    const [ia, ib, ic] = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);
    n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    if (Math.abs(n.y) > 0.3) {
      keep.push(ia, ib, ic);
      continue;
    }
    // Along the wall, and up it: a metre of wall is half the texture.
    for (const p of [a, b, c]) {
      out.push(p.x + n.x * 0.01, p.y, p.z + n.z * 0.01);
      uv.push((p.x * -n.z + p.z * n.x) / 2, p.y / 2);
    }
  }
  if (!out.length) return null;
  geometry.setIndex(keep);
  const walls = new THREE.BufferGeometry();
  walls.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  walls.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  walls.computeVertexNormals();
  return walls;
}

function groundGeometry(level: LevelDef): THREE.BufferGeometry {
  if (level.terrain) {
    // Ground that rises and falls: the same triangles as are driven on, coloured corner by corner.
    const { positions, indices } = terrainMesh(level.terrain);
    const count = positions.length / 3;
    const uvs = new Float32Array(count * 2);
    const colors = new Float32Array(count * 3);
    const tint = new THREE.Color();
    for (let n = 0; n < count; n++) {
      uvs[n * 2] = positions[n * 3] / 10;
      uvs[n * 2 + 1] = positions[n * 3 + 2] / 10;
      tint.setHex(level.terrain.colors[n]).toArray(colors, n * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    // Seen from above, a slope lit as it really would be hardly differs from the flat. So the
    // lie of the land is drawn in as well: whatever leans toward the light is brightened, and
    // whatever leans away from it darkened, by a good deal more than the sun would do it.
    const normals = geometry.getAttribute('normal');
    // Not where the ground is in pieces with walls between: a wall is plain enough as it is.
    for (let n = 0; n < count && !level.terrain.stepped; n++) {
      const shade = Math.max(0.5, Math.min(1.4, 1 + 2.6 * (normals.getX(n) * RELIEF_FROM[0] + normals.getZ(n) * RELIEF_FROM[1])));
      for (let k = 0; k < 3; k++) colors[n * 3 + k] *= shade;
    }
    return geometry;
  }
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const [x0, z0, x1, z1] of groundTiles(level)) {
    const first = positions.length / 3;
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) {
      positions.push(x, 0, z);
      normals.push(0, 1, 0);
      uvs.push(x / 10, z / 10);
    }
    indices.push(first, first + 2, first + 1, first, first + 3, first + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

export function createView(canvas: HTMLCanvasElement, level: LevelDef): View {
  // On a machine with two graphics chips, ask for the stronger. Edges are smoothed unless
  // the picture has been turned right down: that costs too much on a weak chip.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: loadChoice() !== 'low', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const light = LIGHT[level.light ?? 'day'];
  scene.background = new THREE.Color(light.sky);
  scene.fog = new THREE.Fog(light.sky, 90, 260);

  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.5, 400);

  scene.add(new THREE.HemisphereLight(light.above, light.below, light.all));
  const sun = new THREE.DirectionalLight(light.sun, light.strength);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = sun.shadow.camera;
  s.left = s.bottom = -40;
  s.right = s.top = 40;
  s.near = 1;
  s.far = 140;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const ground = new THREE.Mesh(
    groundGeometry(level),
    level.terrain?.stepped
      ? new THREE.MeshStandardMaterial({ map: groundTexture(level.ground, true), roughness: 0.95, vertexColors: true })
      : level.terrain
      ? contoured(new THREE.MeshStandardMaterial({ map: groundTexture(level.ground, true), roughness: 0.95, vertexColors: true }))
      : new THREE.MeshStandardMaterial({ map: groundTexture(level.ground), roughness: 0.95 }),
  );
  ground.receiveShadow = true;
  // Hills throw shadows.
  ground.castShadow = !!level.terrain;
  scene.add(ground);
  // Where the ground is built of pieces, the walls between its levels are stone.
  const walls = level.terrain?.stepped ? wallGeometry(ground.geometry) : null;
  if (walls) {
    const mesh = new THREE.Mesh(walls, new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.95, side: THREE.DoubleSide }));
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
  }

  // Each pit is a box seen from the inside: a floor and four walls of earth.
  const earth = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1, side: THREE.BackSide });
  for (const pit of level.pits ?? []) {
    // Ground that rises and falls has its pits dug in it already.
    if (!level.terrain) {
      const hole = new THREE.Mesh(new THREE.BoxGeometry(pit.half[0] * 2, pit.depth, pit.half[1] * 2), earth);
      hole.position.set(pit.pos[0], -pit.depth / 2, pit.pos[1]);
      hole.receiveShadow = true;
      scene.add(hole);
    }
    if (pit.water === undefined) continue;
    // Water: see-through enough to watch things go down into it.
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(pit.half[0] * 2, pit.half[1] * 2).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x2f78c4, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.72, depthWrite: false }),
    );
    surface.position.set(pit.pos[0], (pit.base ?? 0) - pit.water, pit.pos[1]);
    surface.receiveShadow = true;
    surface.renderOrder = 1;
    scene.add(surface);
  }

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  return { renderer, scene, camera, sun, sunOffset: new THREE.Vector3(...light.from) };
}

/** Keep the shadow frustum centred on the truck. */
export function aimSun(view: View, focus: THREE.Vector3): void {
  view.sun.target.position.copy(focus);
  view.sun.position.copy(focus).add(view.sunOffset);
}
