import type { Vec3 } from '../config';

// Cargo definitions, as plain data shared by the physics and the renderer.

/** 0 intact, 1 lightly damaged, 2 badly damaged, 3 destroyed. */
export type Stage = 0 | 1 | 2 | 3;

export const STAGE_NAMES = ['完好', '輕微受損', '嚴重受損', '全毀'] as const;

/** Health (out of 100) at or below which an item drops to stage 1, 2 and 3. */
export const STAGE_HP = [80, 45, 0] as const;

export interface PartDesc {
  shape: 'box' | 'cylinder' | 'sphere' | 'capsule';
  /** box: half extents. cylinder / capsule: [radius, halfHeight, 0], along Y. sphere: [radius, 0, 0]. */
  size: Vec3;
  /** Relative to the item's origin. */
  pos: Vec3;
  /** Euler XYZ, radians. */
  rot?: Vec3;
  color: number;
  mass: number;
  /** Surface pattern drawn under the damage cracks. */
  texture?: 'crate';
  /** Stage at which this part drops off the item. Anything still attached comes apart at stage 3. */
  detachAt?: 1 | 2;
}

export type BurstKind = 'splinters' | 'water' | 'bone';

export interface CargoType {
  id: string;
  name: string;
  /** Price when intact. */
  value: number;
  /**
   * Impacts below this do no damage. In m/s: roughly the speed of a drop onto something hard.
   * For scale, speed bumps taken flat out reach about 2.5 and landing the ramp jump about 5.
   */
  threshold: number;
  /** Health lost per m/s of impact above the threshold. */
  fragility: number;
  friction: number;
  /**
   * One collider for the whole item until it is destroyed. Without it, every part
   * collides on its own, which suits spindly things like a skeleton.
   */
  hull?: Pick<PartDesc, 'shape' | 'size'>;
  parts: PartDesc[];
  /** Pieces left behind when destroyed. Defaults to the parts still attached. */
  debris?: PartDesc[];
  /** Particles thrown out on damage. */
  burst: BurstKind;
  /** Keeps dripping once badly damaged. */
  leaks?: boolean;
}

const WOOD = 0xb98a55;
const WOOD_DARK = 0x96693c;

function crate(id: string, name: string, h: number, mass: number, value: number, color: number): CargoType {
  const lid = h * 0.14;
  const t = h * 0.11;
  const wall = h - lid - t;
  return {
    id,
    name,
    value,
    threshold: 3.5,
    fragility: 7,
    friction: 0.7,
    hull: { shape: 'box', size: [h, h, h] },
    parts: [
      { shape: 'box', size: [h, h - lid, h], pos: [0, -lid, 0], color, mass: mass * 0.85, texture: 'crate' },
      { shape: 'box', size: [h, lid, h], pos: [0, h - lid, 0], color, mass: mass * 0.15, texture: 'crate', detachAt: 2 },
    ],
    // Loose planks: a base and four sides.
    debris: [
      { shape: 'box', size: [h, t, h], pos: [0, -h + t, 0], color: WOOD_DARK, mass: mass * 0.25 },
      { shape: 'box', size: [t, wall, h], pos: [h - t, -lid + t, 0], color, mass: mass * 0.15 },
      { shape: 'box', size: [t, wall, h], pos: [-h + t, -lid + t, 0], color, mass: mass * 0.15 },
      { shape: 'box', size: [h - 2 * t, wall, t], pos: [0, -lid + t, h - t], color: WOOD_DARK, mass: mass * 0.15 },
      { shape: 'box', size: [h - 2 * t, wall, t], pos: [0, -lid + t, -h + t], color: WOOD_DARK, mass: mass * 0.15 },
    ],
    burst: 'splinters',
  };
}

const CLAY = 0xb5633c;
const CLAY_DARK = 0x8c4426;

function jar(): CargoType {
  const shards: PartDesc[] = [
    { shape: 'cylinder', size: [0.28, 0.03, 0], pos: [0, -0.3, 0], color: CLAY_DARK, mass: 2 },
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    shards.push({
      shape: 'box',
      size: [0.14, 0.16 + (i % 3) * 0.05, 0.025],
      pos: [Math.sin(a) * 0.26, -0.07, Math.cos(a) * 0.26],
      rot: [0, a, 0],
      color: i % 2 ? CLAY : CLAY_DARK,
      mass: 1,
    });
  }
  return {
    id: 'jar',
    name: '水罐',
    value: 300,
    threshold: 3.2,
    fragility: 8,
    friction: 0.6,
    // Squat enough to slide before it tips over.
    hull: { shape: 'cylinder', size: [0.3, 0.33, 0] },
    parts: [
      { shape: 'cylinder', size: [0.3, 0.24, 0], pos: [0, -0.09, 0], color: CLAY, mass: 15 },
      { shape: 'cylinder', size: [0.22, 0.045, 0], pos: [0, 0.195, 0], color: CLAY_DARK, mass: 1.5 },
      { shape: 'cylinder', size: [0.15, 0.045, 0], pos: [0, 0.285, 0], color: CLAY, mass: 1.5, detachAt: 2 },
    ],
    debris: shards,
    burst: 'water',
    leaks: true,
  };
}

const BONE = 0xece6d2;
const BONE_DARK = 0xcfc7ae;
const ALONG_Z: Vec3 = [Math.PI / 2, 0, 0];

/** Lies on its back with the head toward +Z. Every bone collides on its own. */
function skeleton(): CargoType {
  return {
    id: 'skeleton',
    name: '骷髏骨架',
    value: 600,
    threshold: 3.5,
    fragility: 6,
    friction: 0.6,
    parts: [
      // Ribcage, pelvis, skull, arms, legs.
      { shape: 'box', size: [0.2, 0.11, 0.24], pos: [0, 0, 0.36], color: BONE, mass: 4 },
      { shape: 'box', size: [0.17, 0.085, 0.12], pos: [0, 0, -0.03], color: BONE_DARK, mass: 3 },
      { shape: 'sphere', size: [0.16, 0, 0], pos: [0, 0.04, 0.77], color: BONE, mass: 2, detachAt: 2 },
      { shape: 'capsule', size: [0.055, 0.3, 0], pos: [0.3, 0, 0.26], rot: ALONG_Z, color: BONE, mass: 1.5, detachAt: 1 },
      { shape: 'capsule', size: [0.055, 0.3, 0], pos: [-0.3, 0, 0.26], rot: ALONG_Z, color: BONE, mass: 1.5, detachAt: 2 },
      { shape: 'capsule', size: [0.065, 0.4, 0], pos: [0.11, 0, -0.63], rot: ALONG_Z, color: BONE_DARK, mass: 2.5, detachAt: 2 },
      { shape: 'capsule', size: [0.065, 0.4, 0], pos: [-0.11, 0, -0.63], rot: ALONG_Z, color: BONE_DARK, mass: 2.5 },
    ],
    burst: 'bone',
  };
}

export const CARGO_TYPES = {
  crate: crate('crate', '木箱', 0.35, 25, 100, WOOD),
  smallCrate: crate('smallCrate', '小木箱', 0.25, 10, 50, 0xd9b36c),
  jar: jar(),
  skeleton: skeleton(),
} satisfies Record<string, CargoType>;

export type CargoTypeId = keyof typeof CARGO_TYPES;

export function stageForHp(hp: number): Stage {
  if (hp <= STAGE_HP[2]) return 3;
  if (hp <= STAGE_HP[1]) return 2;
  if (hp <= STAGE_HP[0]) return 1;
  return 0;
}
