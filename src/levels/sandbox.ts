import { TRUCK } from '../config';
import type { CargoPlacement } from '../sim/cargo';
import type { LevelDef, PropDesc } from './types';

// The sandbox: a flat test course with no goal, used for tuning and by the headless checks.

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildProps(): PropDesc[] {
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

/** The standard mixed load: crates, small crates, water jars and a skeleton. */
export function standardLoad(): CargoPlacement[] {
  const cargo: CargoPlacement[] = [];
  const floor = TRUCK.frame.pos[1] + TRUCK.frame.half[1];
  const gap = 0.01;
  const rowZ = (row: number) => 1.5 - row * 0.84;
  const columns = [-0.74, 0, 0.74];

  // Half heights of the items, to stand them on the floor.
  // Front four rows: crates three abreast, with small crates stacked on top.
  const big = 0.35;
  const small = 0.25;
  for (let row = 0; row < 4; row++) {
    for (const x of columns) cargo.push({ type: 'crate', pos: [x, floor + big + gap, rowZ(row)] });
  }
  for (const z of [1.1, -0.2]) {
    for (const x of [-0.4, 0.4]) cargo.push({ type: 'smallCrate', pos: [x, floor + big * 2 + small + gap * 3, z] });
  }

  // Then a row of water jars, standing upright.
  const jar = 0.33;
  for (const x of columns) cargo.push({ type: 'jar', pos: [x, floor + jar + gap, rowZ(4)] });

  // And a skeleton lying across the back, against the tailgate.
  cargo.push({ type: 'skeleton', pos: [0.08, floor + 0.12 + gap, rowZ(5) - 0.1], rotY: Math.PI / 2 });

  return cargo;
}

export function sandbox(): LevelDef {
  return {
    id: 'sandbox',
    name: '測試場',
    brief: '自由駕駛，沒有終點',
    ground: { center: [0, 0], half: [300, 300], style: 'grid' },
    bounds: [[-150, -150], [150, 250]],
    spawn: [0, 0.9, 0],
    heading: 0,
    props: buildProps(),
    decals: [],
    cargo: standardLoad(),
    traffic: [],
    stars: [0.6, 0.8],
    par: 120,
  };
}
