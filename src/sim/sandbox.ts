import { TRUCK, type Vec3 } from '../config';

// The sandbox test course, as plain data shared by the physics and the renderer.

export interface PropDesc {
  shape: 'box' | 'cylinder' | 'cone';
  /** box: half extents. cylinder / cone: [radius, halfHeight, unused]. */
  size: Vec3;
  pos: Vec3;
  /** Euler XYZ, radians. */
  rot?: Vec3;
  color: number;
  /** Dynamic when set, static otherwise. */
  mass?: number;
}

export interface CargoDesc {
  half: Vec3;
  /** Position relative to the truck chassis. */
  pos: Vec3;
  mass: number;
  color: number;
}

export const GROUND_HALF: Vec3 = [300, 0.5, 300];

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildProps(): PropDesc[] {
  const props: PropDesc[] = [];
  const rand = mulberry32(7);

  // Speed bumps: cylinders lying across the road, mostly buried.
  for (const z of [30, 36, 42]) {
    props.push({ shape: 'cylinder', size: [0.5, 5, 0], pos: [0, -0.36, z], rot: [0, 0, Math.PI / 2], color: 0xe0b020 });
  }

  // Slalom cones.
  for (let i = 0; i < 7; i++) {
    props.push({ shape: 'cone', size: [0.3, 0.45, 0], pos: [i % 2 ? 3 : -3, 0.45, 62 + i * 13], color: 0xff6a1a, mass: 3 });
  }

  // Jump ramp.
  const rampAngle = 0.17;
  props.push({
    shape: 'box',
    size: [4, 0.25, 5],
    pos: [0, 5 * Math.sin(rampAngle) - 0.25, 175],
    rot: [-rampAngle, 0, 0],
    color: 0x8a6a4a,
  });

  // Rough ground off to the left: a field of small tilted slabs.
  for (let i = 0; i < 70; i++) {
    props.push({
      shape: 'box',
      size: [0.5 + rand() * 0.5, 0.14, 0.5 + rand() * 0.5],
      pos: [18 + rand() * 16, 0.02, 20 + rand() * 70],
      rot: [(rand() - 0.5) * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.3],
      color: 0x6f7f52,
    });
  }

  // Things to crash into.
  props.push({ shape: 'box', size: [6, 1, 0.5], pos: [0, 1, -40], color: 0x9a9a9a });
  for (let i = 0; i < 5; i++) {
    props.push({ shape: 'box', size: [0.5, 1.2, 0.5], pos: [-14, 1.2, 20 + i * 14], color: 0x7a8794 });
  }
  // A pile of loose barrels.
  for (let i = 0; i < 6; i++) {
    props.push({ shape: 'cylinder', size: [0.4, 0.55, 0], pos: [-22 + (i % 3) * 1.1, 0.55 + Math.floor(i / 3) * 1.12, 50], color: 0x3b7dd8, mass: 15 });
  }

  return props;
}

export function buildCargo(): CargoDesc[] {
  const cargo: CargoDesc[] = [];
  const floor = TRUCK.frame.pos[1] + TRUCK.frame.half[1];

  // Bottom layer: eighteen crates, three abreast, loaded from the cab backwards.
  const big = 0.35;
  for (let row = 0; row < 6; row++) {
    for (const x of [-0.74, 0, 0.74]) {
      cargo.push({ half: [big, big, big], pos: [x, floor + big + 0.01, 1.5 - row * 0.84], mass: 25, color: 0xb98a55 });
    }
  }
  // Top layer: eight smaller crates that stick up above the walls.
  const small = 0.25;
  for (const z of [1.1, -0.2, -1.5, -2.6]) {
    for (const x of [-0.4, 0.4]) {
      cargo.push({ half: [small, small, small], pos: [x, floor + big * 2 + small + 0.03, z], mass: 10, color: 0xd9b36c });
    }
  }
  return cargo;
}
