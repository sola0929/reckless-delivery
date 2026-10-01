import * as THREE from 'three';
import { CAMERA } from '../config';
import type { LevelDef } from '../levels/types';

export interface View {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
}

const SKY = 0x9fc4e0;
const SUN_OFFSET = new THREE.Vector3(-25, 45, -18);

function groundTexture(ground: LevelDef['ground']): THREE.Texture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#5b626b';
  g.fillRect(0, 0, size, size);
  // Speckle, so the ground reads as moving even between grid lines.
  for (let i = 0; i < 2500; i++) {
    const shade = 80 + Math.random() * 40;
    g.fillStyle = `rgba(${shade}, ${shade + 6}, ${shade + 12}, 0.5)`;
    g.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  // A 10 m grid for the test course, to judge speed and distance by.
  if (ground.style === 'grid') {
    g.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    g.lineWidth = 4;
    g.strokeRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // One tile per 10 m.
  tex.repeat.set(ground.half[0] / 5, ground.half[1] / 5);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createView(canvas: HTMLCanvasElement, level: LevelDef): View {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 90, 260);

  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.5, 400);

  scene.add(new THREE.HemisphereLight(0xdcecff, 0x5a5648, 1.1));
  const sun = new THREE.DirectionalLight(0xfff2dc, 2.2);
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
    new THREE.PlaneGeometry(level.ground.half[0] * 2, level.ground.half[1] * 2),
    new THREE.MeshStandardMaterial({ map: groundTexture(level.ground), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(level.ground.center[0], 0, level.ground.center[1]);
  ground.receiveShadow = true;
  scene.add(ground);

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  return { renderer, scene, camera, sun };
}

/** Keep the shadow frustum centred on the truck. */
export function aimSun(view: View, focus: THREE.Vector3): void {
  view.sun.target.position.copy(focus);
  view.sun.position.copy(focus).add(SUN_OFFSET);
}
