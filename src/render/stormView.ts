import * as THREE from 'three';
import type { Vec2 } from '../levels/types';

// The rest of a storm, on a level in one, besides the streaks of rain themselves: the rain splashing where it comes down
// round the truck; the waves breaking white up over the quay's edge; sheets of rain going by on the wind further off;
// and lightning, the whole sky lit for a moment and now and then a bolt out in it, the thunder after it as far off as it
// was. Only drawn: it wets nothing and pushes nothing.

/** Splashes: so many a second round the truck, how far out, how long each ring lasts, how wide it grows, metres. */
const SPLASHES = 420;
const SPLASH_REACH = 15;
const SPLASH_LIFE = 0.38;
const SPLASH_WIDE = 0.55;
const SPLASH_POOL = 256;
/** The surf: how many bits of spray in all, how often a wave breaks against each length of wall near enough, a second,
 * how near, metres, and how many bits each wave throws up. */
const SPRAY_POOL = 900;
const BREAKS = 0.9;
const SURF_SEEN = 80;
const SPRAY_EACH = 34;
/** How much of gravity the spray falls by: the air holds it up. */
const SPRAY_FALL = 0.62;
/** Sheets of rain going by: how many, how far off, how big, metres. */
const CURTAINS = 7;
const CURTAIN_NEAR = 18;
const CURTAIN_FAR = 70;
/** Lightning: seconds between flashes, at least and at most; how high over the truck the cloud it comes out of, low in a
 * typhoon, and kept so for it to be in the picture of a camera that looks down. */
const FLASH_MIN = 5;
const FLASH_MAX = 16;
const CLOUD = 55;

export interface SurfLine {
  from: Vec2;
  to: Vec2;
  /** How high the water is along it. */
  y: number;
  /** Which way is the land, across the ground: where the spray is thrown. */
  land: Vec2;
}

/** What the view needs to light up in a flash. */
export interface Sky {
  hemi: THREE.HemisphereLight;
  scene: THREE.Scene;
}

const POINTS_VERTEX = `
attribute float size;
attribute float alpha;
uniform float scale;
varying float vAlpha;
varying float vFog;
uniform float fogNear;
uniform float fogFar;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * scale / max(0.5, -mv.z);
  vAlpha = alpha;
  vFog = smoothstep(fogNear, fogFar, -mv.z);
}`;

/** A soft puff of spray. */
const PUFF_FRAGMENT = `
uniform vec3 color;
uniform vec3 fogColor;
varying float vAlpha;
varying float vFog;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = vAlpha * pow(max(0.0, 1.0 - d), 1.4);
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(color, fogColor, vFog), a * (1.0 - vFog));
}`;

/** A ring spreading where a drop came down. */
const RING_FRAGMENT = `
uniform vec3 color;
uniform vec3 fogColor;
varying float vAlpha;
varying float vFog;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float ring = smoothstep(0.16, 0.0, abs(d - 0.75)) + smoothstep(0.3, 0.0, d) * 0.7;
  float a = vAlpha * ring;
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(color, fogColor, vFog), a * (1.0 - vFog));
}`;

function pointsMaterial(fragment: string, color: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: POINTS_VERTEX,
    fragmentShader: fragment,
    uniforms: { scale: { value: 500 }, color: { value: new THREE.Color(color) }, fogColor: { value: new THREE.Color() }, fogNear: { value: 50 }, fogFar: { value: 150 } },
    transparent: true,
    depthWrite: false,
  });
}

/** Rain in sheets, streaked downward, thickest in the middle and fading out to every edge. */
function curtainTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d')!;
  for (let k = 0; k < 220; k++) {
    const x = Math.random() * 128, y = Math.random() * 256, long = 30 + Math.random() * 90;
    g.strokeStyle = `rgba(220,228,234,${0.08 + Math.random() * 0.16})`;
    g.lineWidth = 1 + Math.random() * 2.5;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - long * 0.12, y + long);
    g.stroke();
  }
  // Soft all round.
  const data = g.getImageData(0, 0, 128, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 128; x++) {
    const ex = Math.sin((x / 127) * Math.PI), ey = Math.sin((y / 255) * Math.PI);
    data.data[(y * 128 + x) * 4 + 3] *= ex * ey;
  }
  g.putImageData(data, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

export class StormView {
  private time = 0;
  // The splashes, each where and when it came down.
  private readonly splashes: THREE.Points;
  private readonly splashBirth = new Float32Array(SPLASH_POOL).fill(-9);
  private splashNext = 0;
  private splashOwed = 0;
  // The spray: where each bit is, how fast it goes, how old it is and how long it lasts, how big it ends.
  private readonly spray: THREE.Points;
  private readonly sprayVel = new Float32Array(SPRAY_POOL * 3);
  private readonly sprayAge = new Float32Array(SPRAY_POOL).fill(9);
  private readonly sprayLife = new Float32Array(SPRAY_POOL).fill(1);
  private readonly sprayGrow = new Float32Array(SPRAY_POOL);
  private readonly sprayBase = new Float32Array(SPRAY_POOL);
  private sprayNext = 0;
  /** How hard a squall is pouring down, 0 to 1: the sheets of rain going by thicker. */
  pour = 0;
  private readonly curtains: { sprite: THREE.Sprite; age: number; life: number; strength: number }[] = [];
  // Lightning: when the next flash comes, how far into this one, how bright it is, and its bolt if it has one.
  private nextFlash = 3 + Math.random() * 6;
  private flashAge = 9;
  private flashStrength = 0;
  private readonly bolt: THREE.Mesh;
  private readonly boltMaterial: THREE.MeshBasicMaterial;
  /**
   * The light as it is without the flash, and as the flash last left it. Something else may set the light too, as the
   * power going off in the market darkens it: where it has been set since, that is what is flashed over, not the storm's
   * own grey.
   */
  private readonly under = { hemi: 0, sky: new THREE.Color(), fog: new THREE.Color() };
  private readonly left = { hemi: -1, sky: new THREE.Color(), fog: new THREE.Color() };
  private readonly lit = new THREE.Color(0xdfe8f4);

  constructor(private readonly sky: Sky, private readonly surf: SurfLine[], private readonly ground: (x: number, z: number) => number) {
    const scene = sky.scene;

    const at = new THREE.BufferGeometry();
    at.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPLASH_POOL * 3), 3));
    at.setAttribute('size', new THREE.BufferAttribute(new Float32Array(SPLASH_POOL), 1));
    at.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(SPLASH_POOL), 1));
    this.splashes = new THREE.Points(at, pointsMaterial(RING_FRAGMENT, 0xd8e0e6));
    this.splashes.frustumCulled = false;
    this.splashes.renderOrder = 2;
    scene.add(this.splashes);

    const bits = new THREE.BufferGeometry();
    bits.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPRAY_POOL * 3), 3));
    bits.setAttribute('size', new THREE.BufferAttribute(new Float32Array(SPRAY_POOL), 1));
    bits.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(SPRAY_POOL), 1));
    this.spray = new THREE.Points(bits, pointsMaterial(PUFF_FRAGMENT, 0xe6ecee));
    this.spray.frustumCulled = false;
    this.spray.renderOrder = 2;
    scene.add(this.spray);

    const map = curtainTexture();
    for (let k = 0; k < CURTAINS; k++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, opacity: 0, depthWrite: false, fog: true }));
      sprite.renderOrder = 3;
      scene.add(sprite);
      this.curtains.push({ sprite, age: 9, life: 1, strength: 0 });
    }

    this.boltMaterial = new THREE.MeshBasicMaterial({ color: 0xeaf2ff, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.bolt = new THREE.Mesh(new THREE.BufferGeometry(), this.boltMaterial);
    this.bolt.frustumCulled = false;
    this.bolt.visible = false;
    scene.add(this.bolt);
  }

  /**
   * Each frame. `focus` the truck (or whoever is on foot); `indoors` under a roof, where the rain and the sea are not
   * seen; `wind` across the ground, m/s. Gives back a flash of lightning if one has just come, and how near it was, 0 to 1.
   */
  update(dt: number, camera: THREE.PerspectiveCamera, viewHeight: number, focus: THREE.Vector3, indoors: boolean, wind: Vec2): { near: number } | null {
    this.time += dt;
    const fog = this.sky.scene.fog instanceof THREE.Fog ? this.sky.scene.fog : null;
    const scale = viewHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));
    for (const points of [this.splashes, this.spray]) {
      const u = (points.material as THREE.ShaderMaterial).uniforms;
      u.scale.value = scale;
      if (fog) {
        u.fogColor.value.copy(fog.color);
        u.fogNear.value = fog.near;
        u.fogFar.value = fog.far;
      }
    }
    this.splash(dt, focus, indoors);
    this.breakWaves(dt, focus, wind);
    this.sweep(dt, camera.position, focus, indoors, wind);
    return this.lightning(dt, camera, focus, indoors);
  }

  private splash(dt: number, focus: THREE.Vector3, indoors: boolean): void {
    const geometry = this.splashes.geometry;
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute, size = geometry.getAttribute('size') as THREE.BufferAttribute, alpha = geometry.getAttribute('alpha') as THREE.BufferAttribute;
    if (!indoors) {
      this.splashOwed += SPLASHES * dt;
      while (this.splashOwed >= 1) {
        this.splashOwed--;
        const n = this.splashNext;
        this.splashNext = (n + 1) % SPLASH_POOL;
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * SPLASH_REACH;
        const x = focus.x + Math.cos(a) * r, z = focus.z + Math.sin(a) * r;
        pos.setXYZ(n, x, this.ground(x, z) + 0.04, z);
        this.splashBirth[n] = this.time;
      }
    }
    for (let n = 0; n < SPLASH_POOL; n++) {
      const age = (this.time - this.splashBirth[n]) / SPLASH_LIFE;
      size.setX(n, age < 1 ? 0.12 + age * SPLASH_WIDE : 0);
      alpha.setX(n, age < 1 ? 0.34 * (1 - age) : 0);
    }
    pos.needsUpdate = size.needsUpdate = alpha.needsUpdate = true;
  }

  /** A wave breaking against a length of wall: a sheet of white thrown up off it and over toward the land, on the wind. */
  private breakWaves(dt: number, focus: THREE.Vector3, wind: Vec2): void {
    for (const line of this.surf) {
      const [ax, az] = line.from, [bx, bz] = line.to, lx = bx - ax, lz = bz - az, long = Math.hypot(lx, lz);
      const t = Math.max(0, Math.min(1, ((focus.x - ax) * lx + (focus.z - az) * lz) / (long * long)));
      if (Math.hypot(ax + lx * t - focus.x, az + lz * t - focus.z) > SURF_SEEN) continue;
      // Along the part of it that can be seen, one wave after another at no set beat.
      const seen = Math.min(1, (SURF_SEEN * 2) / long);
      if (Math.random() > BREAKS * seen * dt) continue;
      const along = Math.max(0, Math.min(1, t + (Math.random() - 0.5) * (SURF_SEEN * 1.2) / long));
      this.throwUp(ax + lx * along, line.y, az + lz * along, lx / long, lz / long, line.land, wind);
    }
    const geometry = this.spray.geometry;
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute, size = geometry.getAttribute('size') as THREE.BufferAttribute, alpha = geometry.getAttribute('alpha') as THREE.BufferAttribute;
    for (let n = 0; n < SPRAY_POOL; n++) {
      const age = (this.sprayAge[n] += dt), life = this.sprayLife[n];
      if (age >= life) {
        alpha.setX(n, 0);
        continue;
      }
      const k = n * 3, v = this.sprayVel;
      v[k + 1] -= 9.81 * SPRAY_FALL * dt;
      const drag = Math.exp(-1.2 * dt);
      v[k] *= drag;
      v[k + 2] *= drag;
      pos.setXYZ(n, pos.getX(n) + v[k] * dt, pos.getY(n) + v[k + 1] * dt, pos.getZ(n) + v[k + 2] * dt);
      const s = age / life;
      size.setX(n, this.sprayBase[n] + this.sprayGrow[n] * Math.sqrt(s));
      alpha.setX(n, (this.sprayBase[n] < 0.3 ? 0.9 : 0.5) * Math.min(1, s * 8) * (1 - s));
    }
    pos.needsUpdate = size.needsUpdate = alpha.needsUpdate = true;
  }

  private throwUp(x: number, y: number, z: number, ux: number, uz: number, land: Vec2, wind: Vec2): void {
    const pos = this.spray.geometry.getAttribute('position') as THREE.BufferAttribute;
    const wide = 3 + Math.random() * 5, hard = 0.7 + Math.random() * 0.5;
    for (let k = 0; k < SPRAY_EACH; k++) {
      const n = this.sprayNext;
      this.sprayNext = (n + 1) % SPRAY_POOL;
      const along = (Math.random() - 0.5) * wide;
      pos.setXYZ(n, x + ux * along, y + Math.random() * 0.4, z + uz * along);
      const up = (5 + Math.random() * 4.5) * hard, over = 0.8 + Math.random() * 2.2;
      this.sprayVel[n * 3] = land[0] * over + wind[0] * 0.35 + (Math.random() - 0.5) * 0.8;
      this.sprayVel[n * 3 + 1] = up;
      this.sprayVel[n * 3 + 2] = land[1] * over + wind[1] * 0.35 + (Math.random() - 0.5) * 0.8;
      this.sprayAge[n] = -Math.random() * 0.25;
      // Most of it a cloud of fine spray growing as it goes; the rest drops, thrown higher and falling sooner.
      const drop = k % 3 === 0;
      this.sprayLife[n] = drop ? 0.9 + Math.random() * 0.5 : 1.3 + Math.random() * 0.9;
      this.sprayBase[n] = drop ? 0.12 + Math.random() * 0.12 : 0.5;
      this.sprayGrow[n] = drop ? 0.1 : 1.2 + Math.random() * 1.8;
      if (drop) this.sprayVel[n * 3 + 1] *= 1.2;
    }
  }

  /** Sheets of rain going by on the wind, a way off: each comes up out of nothing, crosses, and thins away again. */
  private sweep(dt: number, camera: THREE.Vector3, focus: THREE.Vector3, indoors: boolean, wind: Vec2): void {
    const [wx, wz] = wind, speed = Math.max(1, Math.hypot(wx, wz));
    for (const c of this.curtains) {
      c.age += dt;
      if (c.age >= c.life) {
        // Upwind of the truck, off to one side or the other, to be carried across.
        const across = (Math.random() - 0.5) * 2 * CURTAIN_FAR, back = CURTAIN_NEAR + Math.random() * (CURTAIN_FAR - CURTAIN_NEAR);
        const ux = wx / speed, uz = wz / speed;
        c.sprite.position.set(focus.x - ux * back - uz * across, focus.y + 6 + Math.random() * 5, focus.z - uz * back + ux * across);
        const tall = 22 + Math.random() * 14;
        c.sprite.scale.set(tall * 1.2, tall, 1);
        c.age = 0;
        c.life = 7 + Math.random() * 7;
        c.strength = 0.1 + Math.random() * 0.12;
      }
      c.sprite.position.x += wx * 1.3 * dt;
      c.sprite.position.z += wz * 1.3 * dt;
      const s = c.age / c.life;
      // Not right up against the camera, where a sheet is only a grey wash.
      const close = Math.min(1, Math.max(0, (c.sprite.position.distanceTo(camera) - 10) / 12));
      (c.sprite.material as THREE.SpriteMaterial).opacity = indoors ? 0 : c.strength * (1 + 2 * this.pour) * Math.sin(s * Math.PI) * close;
    }
  }

  /**
   * Now and then a flash: the whole sky lit for a moment, twice or three times in quick succession, then gone. The nearer
   * it is, the brighter; a near one is a bolt to be seen, out in the rain, coming down out of the cloud to the sea.
   */
  private lightning(dt: number, camera: THREE.PerspectiveCamera, focus: THREE.Vector3, indoors: boolean): { near: number } | null {
    let struck: { near: number } | null = null;
    if ((this.nextFlash -= dt) <= 0) {
      this.nextFlash = FLASH_MIN + Math.random() * (FLASH_MAX - FLASH_MIN);
      const near = Math.random() ** 1.6;
      this.flashAge = 0;
      this.flashStrength = 0.35 + 0.65 * near;
      // Under a roof the bolt itself is not seen, only the light of it through the skylights and the doors.
      if (!indoors && near > 0.3 && Math.random() < 0.8) this.drawBolt(camera, focus, near);
      else this.bolt.visible = false;
      struck = { near };
    }
    this.flashAge += dt;
    const t = this.flashAge;
    // Its pulses: a first, a dip, a second brighter, a flicker as it goes.
    const pulse = (at: number, wide: number) => Math.max(0, 1 - Math.abs(t - at) / wide);
    const f = this.flashStrength * Math.max(pulse(0.03, 0.05) * 0.7, pulse(0.14, 0.07), pulse(0.27, 0.05) * 0.5, t < 0.6 ? 0.25 * (1 - t / 0.6) : 0) * (indoors ? 0.35 : 1);
    this.flashOver(f);
    this.boltMaterial.opacity = Math.min(1, f * 1.6);
    // Gone in under a roof while one is still in the sky: not seen from in there either.
    if (indoors) this.bolt.visible = false;
    if (t > 0.6) this.bolt.visible = false;
    return struck;
  }

  /** The light lit up by so much of a flash, over whatever it is without one. */
  private flashOver(f: number): void {
    const { hemi, scene } = this.sky, under = this.under, left = this.left;
    const sky = scene.background instanceof THREE.Color ? scene.background : null, fog = scene.fog instanceof THREE.Fog ? scene.fog.color : null;
    // Left as the flash left it: what was under it still is. Changed since: that is what is under it now.
    if (hemi.intensity !== left.hemi) under.hemi = hemi.intensity;
    if (sky && !sky.equals(left.sky)) under.sky.copy(sky);
    if (fog && !fog.equals(left.fog)) under.fog.copy(fog);
    const k = Math.min(1, f * 0.8);
    hemi.intensity = left.hemi = under.hemi * (1 + 2.4 * f);
    if (sky) left.sky.copy(sky.copy(under.sky).lerp(this.lit, k * (0.25 + 0.75 * brightness(under.sky))));
    if (fog) left.fog.copy(fog.copy(under.fog).lerp(this.lit, k * (0.25 + 0.75 * brightness(under.fog))));
  }

  /** A bolt out ahead of the camera, so far off as it is near: a jagged line down from the cloud, with a branch or two. */
  private drawBolt(camera: THREE.PerspectiveCamera, focus: THREE.Vector3, near: number): void {
    const look = new THREE.Vector3();
    camera.getWorldDirection(look);
    const turn = Math.atan2(look.x, look.z) + (Math.random() - 0.5) * 1.3;
    // Near enough to be seen below the top of the picture: from up here the horizon is not far above it.
    const far = 130 - near * 70;
    const foot = new THREE.Vector3(focus.x + Math.sin(turn) * far, focus.y - 4, focus.z + Math.cos(turn) * far);
    const top = new THREE.Vector3(foot.x + (Math.random() - 0.5) * 40, focus.y + CLOUD + Math.random() * 25, foot.z + (Math.random() - 0.5) * 40);
    const out: number[] = [];
    const strip = (points: THREE.Vector3[], wide: number) => {
      for (let k = 0; k + 1 < points.length; k++) {
        const a = points[k], b = points[k + 1];
        const side = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(camera.position, a)).normalize();
        const w0 = wide * (1 - (k / points.length) * 0.4), w1 = wide * (1 - ((k + 1) / points.length) * 0.4);
        const p = [a.clone().addScaledVector(side, -w0), a.clone().addScaledVector(side, w0), b.clone().addScaledVector(side, w1), b.clone().addScaledVector(side, -w1)];
        for (const i of [0, 1, 2, 0, 2, 3]) out.push(p[i].x, p[i].y, p[i].z);
      }
    };
    const jag = (from: THREE.Vector3, to: THREE.Vector3, steps: number, rough: number) => {
      const points = [from.clone()];
      for (let k = 1; k < steps; k++) {
        const p = from.clone().lerp(to, k / steps);
        p.x += (Math.random() - 0.5) * rough;
        p.z += (Math.random() - 0.5) * rough;
        p.y += (Math.random() - 0.5) * rough * 0.3;
        points.push(p);
      }
      points.push(to.clone());
      return points;
    };
    const main = jag(top, foot, 16, 14);
    strip(main, 1.1 + near * 1.1);
    for (let b = 0; b < 2; b++) {
      const from = main[3 + Math.floor(Math.random() * 8)];
      const to = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 30, -12 - Math.random() * 18, (Math.random() - 0.5) * 30));
      strip(jag(from, to, 7, 6), 0.5 + near * 0.4);
    }
    this.bolt.geometry.dispose();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    this.bolt.geometry = geometry;
    this.bolt.visible = true;
  }

  /** Back to a quiet sky: for when the level starts over. */
  clear(): void {
    this.sprayAge.fill(9);
    this.splashBirth.fill(-9);
    this.flashAge = 9;
    this.bolt.visible = false;
    this.flashOver(0);
  }
}

/** How light a colour is, 0 to 1: a flash shows far less in the dark of a hall with its power off than out under the sky. */
function brightness(c: THREE.Color): number {
  return Math.min(1, (c.r + c.g + c.b) / 3 / 0.45);
}
