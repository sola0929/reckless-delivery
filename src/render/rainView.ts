import * as THREE from 'three';

// Rain, on a level in a storm: streaks falling slant with the wind in a box round the camera, each one put back up top
// once it is down below the camera's feet, so that however far the truck goes it is always in the rain. Only drawn: it
// wets nothing and pushes nothing.

/** How many streaks at most, how far round the camera they fall (across, down from above it), how fast, and how long each is. */
const DROPS = 3600;
/** How many of them fall in the steady rain: the rest come with a gust. */
const STEADY = 0.68;
/** A gust this hard, m/s, brings them all. */
const HEAVIEST = 12;
const SPREAD = 26;
const ABOVE = 16;
const BELOW = 6;
const FALL = 24;
const STREAK = 0.9;

export class RainView {
  private readonly lines: THREE.LineSegments;
  private readonly heads = new Float32Array(DROPS * 3);
  /** Each streak's own length, as a share of STREAK: the nearer and faster ones longer. */
  private readonly long = new Float32Array(DROPS);
  private readonly wind: THREE.Vector3;
  /** The steady wind it falls slant with, and on top of it a gust's, for now. */
  private readonly steady: THREE.Vector3;
  private readonly gust = new THREE.Vector3();
  /** Whether the streaks have been put round the camera yet: they start out round nought. */
  private placed = false;

  /** `wind`: which way and how hard it blows the rain, metres a second across the ground. */
  constructor(scene: THREE.Scene, wind: [number, number] = [5, 2]) {
    this.steady = new THREE.Vector3(wind[0], -FALL, wind[1]);
    this.wind = this.steady.clone();
    for (let n = 0; n < DROPS; n++) {
      this.heads[n * 3] = (Math.random() - 0.5) * SPREAD * 2;
      this.heads[n * 3 + 1] = Math.random() * (ABOVE + BELOW) - BELOW;
      this.heads[n * 3 + 2] = (Math.random() - 0.5) * SPREAD * 2;
      this.long[n] = 0.6 + Math.random() * 0.9;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DROPS * 6), 3));
    // Each streak bright at its head, fading to nothing up its tail; some catch the light more than others.
    const colors = new Float32Array(DROPS * 6), head = new THREE.Color(0xdde6ee), tail = new THREE.Color(0x6a7680);
    for (let n = 0; n < DROPS; n++) {
      const bright = 0.55 + Math.random() * 0.45;
      colors.set([head.r * bright, head.g * bright, head.b * bright, tail.r * bright, tail.g * bright, tail.b * bright], n * 6);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false }));
    this.lines.frustumCulled = false;
    geometry.setDrawRange(0, Math.round(DROPS * STEADY) * 2);
    this.lines.renderOrder = 3;
    scene.add(this.lines);
  }

  /** A gust where the camera is, metres a second across the ground: the rain driven along it, near flat. Eased in and out. */
  /** How hard a squall is pouring down, 0 to 1: every streak falling, and brighter. */
  private pouring = 0;
  pour(k: number): void {
    this.pouring = k;
    (this.lines.material as THREE.LineBasicMaterial).opacity = 0.5 + 0.3 * k;
  }

  /** Shown or not: not under a roof. */
  show(on: boolean): void {
    this.lines.visible = on;
  }

  blow(x: number, z: number, dt: number): void {
    this.gust.lerp(new THREE.Vector3(x, 0, z), Math.min(1, dt * 6));
    this.wind.copy(this.steady).add(this.gust);
    // Heavier in a gust, and in a squall.
    const share = STEADY + (1 - STEADY) * Math.max(this.pouring, Math.min(1, this.gust.length() / HEAVIEST));
    this.lines.geometry.setDrawRange(0, Math.round(DROPS * share) * 2);
  }

  /** Each frame: the streaks moved on, kept round the camera, and laid out as lines along the way they fall. */
  update(dt: number, camera: THREE.Vector3): void {
    const step = this.wind.clone().multiplyScalar(Math.min(dt, 0.05));
    const tail = this.wind.clone().normalize().multiplyScalar(-STREAK);
    const out = this.lines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const at = out.array as Float32Array;
    for (let n = 0; n < DROPS; n++) {
      const k = n * 3;
      this.heads[k] += step.x;
      this.heads[k + 1] += step.y;
      this.heads[k + 2] += step.z;
      // Where they are in the world, so that driving through them they stream past: down past the camera's feet, up top
      // again; left behind or gone ahead across the ground, round to the far side of the box.
      if (!this.placed) for (const [axis, c] of [[0, camera.x], [1, camera.y], [2, camera.z]] as const) this.heads[k + axis] += c;
      if (this.heads[k + 1] < camera.y - BELOW) {
        this.heads[k] = camera.x + (Math.random() - 0.5) * SPREAD * 2;
        this.heads[k + 1] = camera.y + ABOVE;
        this.heads[k + 2] = camera.z + (Math.random() - 0.5) * SPREAD * 2;
      } else if (this.heads[k + 1] > camera.y + ABOVE + 4) this.heads[k + 1] = camera.y + Math.random() * ABOVE;
      for (const [axis, c] of [[0, camera.x], [2, camera.z]] as const) {
        const rel = this.heads[k + axis] - c;
        if (Math.abs(rel) > SPREAD) this.heads[k + axis] = c + ((((rel + SPREAD) % (SPREAD * 2)) + SPREAD * 2) % (SPREAD * 2)) - SPREAD;
      }
      const x = this.heads[k], y = this.heads[k + 1], z = this.heads[k + 2];
      at[n * 6] = x;
      at[n * 6 + 1] = y;
      at[n * 6 + 2] = z;
      const l = this.long[n];
      at[n * 6 + 3] = x + tail.x * l;
      at[n * 6 + 4] = y + tail.y * l;
      at[n * 6 + 5] = z + tail.z * l;
    }
    this.placed = true;
    out.needsUpdate = true;
  }
}
