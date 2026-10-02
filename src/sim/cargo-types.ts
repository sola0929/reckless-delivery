import type { Vec3 } from '../config';

// Cargo definitions, as plain data shared by the physics and the renderer.

/** 0 intact, 1 lightly damaged, 2 badly damaged, 3 destroyed. */
export type Stage = 0 | 1 | 2 | 3;

export const STAGE_NAMES = ['完好', '輕微受損', '嚴重受損', '全毀'] as const;

/** Health (out of 100) at or below which an item drops to stage 1, 2 and 3. */
export const STAGE_HP = [80, 45, 0] as const;

export interface PartDesc {
  shape: 'box' | 'cylinder' | 'sphere' | 'capsule' | 'dome';
  /**
   * box: half extents. cylinder / capsule: [radius, halfHeight, 0], along Y. sphere: [radius, 0, 0].
   * dome: [radius, 0, 0], half a sphere with its cut face downward, centred on its own middle.
   */
  size: Vec3;
  /** Relative to the item's origin. */
  pos: Vec3;
  /** Euler XYZ, radians. */
  rot?: Vec3;
  color: number;
  mass: number;
  /** Surface pattern drawn under the damage cracks. On a dome, 'flesh' is what shows on the cut face. */
  texture?: 'crate' | 'melon' | 'flesh';
  /** Stage at which this part drops off the item. Anything still attached comes apart at stage 3. */
  detachAt?: 1 | 2;
}

export type BurstKind = 'splinters' | 'water' | 'bone' | 'sparks' | 'pulp';

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
  /**
   * The most health a single hit can take, approached but never reached: harder hits always
   * cost more, by less and less. It keeps one crash, however fast, from writing an item off.
   */
  maxHit: number;
  /**
   * How many m/s above the threshold it takes to get about two thirds of the way to maxHit.
   * Small values make an item brittle: it takes nearly the full hit from a modest knock.
   */
  give: number;
  /**
   * Share of the price it is still worth as wreckage, if the wreckage stays on the truck.
   * Value runs from the full price at full health down to this at none.
   */
  salvage: number;
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
    threshold: 6,
    maxHit: 34,
    give: 18,
    salvage: 0.2,
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
    threshold: 4.5,
    maxHit: 44,
    give: 14,
    salvage: 0.2,
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
  const limb = (radius: number, x: number, z: number, mass: number, color: number, detachAt?: 1 | 2): PartDesc => ({
    shape: 'capsule', size: [radius, z < -0.2 ? 0.2 : 0.15, 0], pos: [x, 0, z], rot: ALONG_Z, color, mass, detachAt,
  });
  const ribs: PartDesc[] = [0, 1, 2, 3].map((i) => ({
    shape: 'box', size: [0.19 - i * 0.012, 0.03, 0.03], pos: [0, 0.03, 0.12 + i * 0.13], color: BONE, mass: 0.6,
  }));
  return {
    id: 'skeleton',
    name: '骷髏骨架',
    value: 600,
    threshold: 4.5,
    maxHit: 40,
    give: 16,
    salvage: 0.2,
    friction: 0.6,
    parts: [
      // Spine, ribs and pelvis.
      { shape: 'capsule', size: [0.035, 0.3, 0], pos: [0, 0, 0.22], rot: ALONG_Z, color: BONE_DARK, mass: 2 },
      ...ribs,
      { shape: 'box', size: [0.16, 0.06, 0.08], pos: [0, 0, -0.1], color: BONE_DARK, mass: 2.4 },
      // Skull and jaw.
      { shape: 'sphere', size: [0.15, 0, 0], pos: [0, 0.05, 0.8], color: BONE, mass: 2, detachAt: 2 },
      { shape: 'box', size: [0.09, 0.035, 0.05], pos: [0, 0, 0.65], color: BONE_DARK, mass: 0.4 },
      // Arms: the left goes first, then the right.
      limb(0.045, 0.27, 0.42, 0.8, BONE, 1),
      limb(0.04, 0.29, 0.06, 0.7, BONE_DARK, 1),
      limb(0.045, -0.27, 0.42, 0.8, BONE, 2),
      limb(0.04, -0.29, 0.06, 0.7, BONE_DARK, 2),
      // Legs: thigh and shin. One leg stays on to the end.
      limb(0.055, 0.11, -0.42, 1.4, BONE, 2),
      limb(0.045, 0.11, -0.88, 1.1, BONE_DARK, 2),
      limb(0.055, -0.11, -0.42, 1.4, BONE),
      limb(0.045, -0.11, -0.88, 1.1, BONE_DARK),
    ],
    burst: 'bone',
  };
}

const ENAMEL = 0xe9ecee;
const ENAMEL_DARK = 0xcfd4d9;
const TRIM = 0x3a3f46;

/**
 * A fridge: steel, so it shrugs off knocks that would split a crate, and worth a lot. But
 * it stands taller than the sides of the bed and slides easily, so it is the first thing
 * over the side in a hard turn, and it is heavy enough to hurt what it lands on.
 *
 * Its doors come off: the freezer door at the first real damage, the main one later. What
 * was behind them, the shelves and what was on them, is then there to be seen.
 */
function fridge(): CargoType {
  const [w, h, d] = [0.36, 0.85, 0.34];
  const door = 0.035;
  const shell = d - door;
  // The front of the cabinet, which the doors close against.
  const face = shell - door;
  // Where the freezer ends and the fridge begins.
  const split = 0.24;
  const inside = (size: Vec3, x: number, y: number, color: number): PartDesc => ({ shape: 'box', size, pos: [x, y, face + size[2]], color, mass: 0.2 });
  return {
    id: 'fridge',
    name: '冰箱',
    value: 500,
    threshold: 7.5,
    maxHit: 26,
    give: 22,
    salvage: 0.3,
    friction: 0.45,
    hull: { shape: 'box', size: [w, h, d] },
    parts: [
      { shape: 'box', size: [w, h, shell], pos: [0, 0, -door], color: ENAMEL, mass: 53 },
      // Doors and their handles.
      { shape: 'box', size: [w - 0.01, (h + split) / 2 - 0.015, door], pos: [0, (split - h) / 2, shell], color: ENAMEL_DARK, mass: 5, detachAt: 2 },
      { shape: 'box', size: [w - 0.01, (h - split) / 2 - 0.015, door], pos: [0, (h + split) / 2, shell], color: ENAMEL_DARK, mass: 3, detachAt: 1 },
      { shape: 'box', size: [0.02, 0.16, 0.02], pos: [-w + 0.08, -0.05, d + 0.02], color: TRIM, mass: 0.5, detachAt: 2 },
      { shape: 'box', size: [0.02, 0.09, 0.02], pos: [-w + 0.08, split + 0.14, d + 0.02], color: TRIM, mass: 0.5, detachAt: 1 },
      // Inside: the lining, the bar between the two compartments, shelves, and the shopping.
      { shape: 'box', size: [w - 0.03, h - 0.03, 0.004], pos: [0, 0, face + 0.004], color: 0xbcd4de, mass: 0.2 },
      inside([w - 0.01, 0.025, door], 0, split, ENAMEL),
      inside([w - 0.05, 0.01, 0.028], 0, -0.52, 0xf4f7f8),
      inside([w - 0.05, 0.01, 0.028], 0, -0.2, 0xf4f7f8),
      inside([w - 0.05, 0.01, 0.028], 0, 0.55, 0xf4f7f8),
      inside([0.05, 0.1, 0.025], -0.2, -0.41, 0x4f8fd0),
      inside([0.07, 0.06, 0.025], 0.02, -0.45, 0xe0b020),
      inside([0.05, 0.08, 0.025], 0.2, -0.43, 0xd8434a),
      inside([0.09, 0.07, 0.025], -0.12, -0.12, 0x5a9a4a),
      inside([0.05, 0.09, 0.025], 0.17, -0.1, 0xf2f2f2),
      inside([0.12, 0.06, 0.025], 0, 0.62, 0x9fd0e8),
    ],
    // Panels: back, two sides, top and bottom.
    debris: [
      { shape: 'box', size: [w, h, 0.03], pos: [0, 0, -d + 0.03], color: ENAMEL, mass: 14 },
      { shape: 'box', size: [0.03, h, shell - 0.03], pos: [w - 0.03, 0, -door], color: ENAMEL, mass: 11 },
      { shape: 'box', size: [0.03, h, shell - 0.03], pos: [-w + 0.03, 0, -door], color: ENAMEL, mass: 11 },
      { shape: 'box', size: [w - 0.06, 0.03, shell - 0.03], pos: [0, h - 0.03, -door], color: ENAMEL_DARK, mass: 6 },
      { shape: 'box', size: [w - 0.06, 0.2, shell - 0.06], pos: [0, -h + 0.2, -door], color: TRIM, mass: 15 },
    ],
    burst: 'sparks',
  };
}

const VENEER = 0x8a5a34;
const VENEER_LIGHT = 0xa87242;

/**
 * A wardrobe: as tall as the fridge and wider, so it leaves the truck just as readily, but
 * it is thin board rather than steel. Lighter, cheaper, and it comes apart much sooner:
 * one door at the first knock, the other soon after, and the clothes are on show.
 */
function wardrobe(): CargoType {
  const [w, h, d] = [0.5, 0.8, 0.28];
  const door = 0.03;
  const board = 0.03;
  const shell = d - door;
  const face = shell - door;
  const clothes = [0xc8443a, 0x3a6fb3, 0xe0c341, 0x4a8f5a, 0xe8e8e8, 0x8a4fa0];
  return {
    id: 'wardrobe',
    name: '衣櫃',
    value: 350,
    threshold: 5,
    maxHit: 40,
    give: 15,
    salvage: 0.2,
    friction: 0.65,
    hull: { shape: 'box', size: [w, h, d] },
    parts: [
      { shape: 'box', size: [w, h, shell], pos: [0, 0, -door], color: VENEER, mass: 28, texture: 'crate' },
      { shape: 'box', size: [w / 2 - 0.01, h - 0.04, door], pos: [-w / 2, 0, shell], color: VENEER_LIGHT, mass: 5, texture: 'crate', detachAt: 1 },
      { shape: 'box', size: [w / 2 - 0.01, h - 0.04, door], pos: [w / 2, 0, shell], color: VENEER_LIGHT, mass: 5, texture: 'crate', detachAt: 2 },
      // Inside: a dark back, a rail, and what hangs from it.
      { shape: 'box', size: [w - 0.04, h - 0.04, 0.004], pos: [0, 0, face + 0.004], color: 0x3a2a1c, mass: 0.2 },
      { shape: 'cylinder', size: [0.012, w - 0.05, 0], pos: [0, h - 0.2, face + 0.03], rot: [0, 0, Math.PI / 2], color: 0xc8ccd0, mass: 0.3 },
      ...clothes.map((color, i): PartDesc => ({
        shape: 'box', size: [0.055, 0.26 + (i % 3) * 0.05, 0.02],
        pos: [-w + 0.13 + i * 0.148, h - 0.24 - (0.26 + (i % 3) * 0.05), face + 0.03], color, mass: 0.25,
      })),
    ],
    debris: [
      { shape: 'box', size: [w, h, board], pos: [0, 0, -d + board], color: VENEER, mass: 8 },
      { shape: 'box', size: [board, h, shell - board], pos: [w - board, 0, -door], color: VENEER, mass: 7 },
      { shape: 'box', size: [board, h, shell - board], pos: [-w + board, 0, -door], color: VENEER, mass: 7 },
      { shape: 'box', size: [w - 2 * board, board, shell - board], pos: [0, h - board, -door], color: VENEER_LIGHT, mass: 4 },
      { shape: 'box', size: [w - 2 * board, board, shell - board], pos: [0, -h + board, -door], color: VENEER_LIGHT, mass: 4 },
      // The clothes, in a heap.
      { shape: 'box', size: [0.2, 0.05, 0.16], pos: [-0.1, -h + 0.12, 0], color: 0xc8443a, mass: 0.6 },
      { shape: 'box', size: [0.18, 0.05, 0.15], pos: [0.15, -h + 0.2, 0.02], rot: [0, 0.6, 0], color: 0x3a6fb3, mass: 0.6 },
    ],
    burst: 'splinters',
  };
}

const STEEL = 0x3d4650;
const STEEL_LIGHT = 0x5b6673;

/**
 * A safe: small, enormously heavy and all but unbreakable. Nothing that happens on the way
 * will hurt it. What it does to everything else when it starts to slide is another matter.
 */
function safe(): CargoType {
  const [w, h, d] = [0.32, 0.36, 0.3];
  return {
    id: 'safe',
    name: '保險箱',
    value: 450,
    threshold: 12,
    maxHit: 14,
    give: 30,
    salvage: 0.5,
    friction: 0.8,
    hull: { shape: 'box', size: [w, h, d] },
    parts: [
      { shape: 'box', size: [w, h, d - 0.03], pos: [0, 0, -0.03], color: STEEL, mass: 138 },
      { shape: 'box', size: [w - 0.05, h - 0.05, 0.03], pos: [0, 0, d - 0.03], color: STEEL_LIGHT, mass: 10 },
      { shape: 'cylinder', size: [0.07, 0.025, 0], pos: [0.06, 0.02, d + 0.02], rot: [Math.PI / 2, 0, 0], color: 0xd9b24a, mass: 1 },
      { shape: 'box', size: [0.02, 0.09, 0.02], pos: [-0.14, 0.02, d + 0.02], color: 0xd9b24a, mass: 1, detachAt: 2 },
      // Hinges, and feet to stand on.
      { shape: 'box', size: [0.02, 0.05, 0.02], pos: [w - 0.03, 0.2, d + 0.01], color: 0x23282e, mass: 0.2 },
      { shape: 'box', size: [0.02, 0.05, 0.02], pos: [w - 0.03, -0.2, d + 0.01], color: 0x23282e, mass: 0.2 },
    ],
    burst: 'sparks',
  };
}

const RIND_DARK = 0x1f5a2a;
const FLESH = 0xd8434a;
// Left white: the stripes and the colour of the rind are in its texture.
const WHITE = 0xffffff;

/**
 * A watermelon: round, so it never stays where it was put, and it splits at the first real
 * knock. Cheap enough that one is no loss. They are carried by the half dozen.
 *
 * Hurt, the red shows through the cracks in the rind and it drips. Destroyed, it is two
 * halves and some lumps of flesh in a spray of juice.
 */
function watermelon(): CargoType {
  const r = 0.24;
  const lumps: PartDesc[] = [0, 1, 2].map((i) => ({
    shape: 'box', size: [0.07, 0.05 + i * 0.015, 0.08], pos: [Math.sin(i * 2.1) * 0.1, -0.1, Math.cos(i * 2.1) * 0.1],
    rot: [0.3, i * 2.1, 0.2], color: FLESH, mass: 0.6, texture: 'flesh',
  }));
  return {
    id: 'watermelon',
    name: '西瓜',
    value: 60,
    threshold: 4,
    maxHit: 75,
    give: 7,
    salvage: 0.1,
    friction: 0.5,
    hull: { shape: 'sphere', size: [r, 0, 0] },
    parts: [
      { shape: 'sphere', size: [r, 0, 0], pos: [0, 0, 0], color: WHITE, mass: 6.8, texture: 'melon' },
      // The stalk end, so that it can be seen to roll.
      { shape: 'cylinder', size: [0.035, 0.025, 0], pos: [0, r, 0], color: RIND_DARK, mass: 0.2 },
    ],
    // Two halves, cut faces outward, and what fell out between them.
    debris: [
      { shape: 'dome', size: [r, 0, 0], pos: [0, 0, 0.07], rot: [-Math.PI / 2, 0, 0], color: WHITE, mass: 2.5, texture: 'melon' },
      { shape: 'dome', size: [r, 0, 0], pos: [0, 0, -0.07], rot: [Math.PI / 2, 0, 0], color: WHITE, mass: 2.5, texture: 'melon' },
      ...lumps,
    ],
    burst: 'pulp',
    leaks: true,
  };
}

export const CARGO_TYPES = {
  crate: crate('crate', '木箱', 0.35, 25, 100, WOOD),
  smallCrate: crate('smallCrate', '小木箱', 0.25, 10, 50, 0xd9b36c),
  jar: jar(),
  skeleton: skeleton(),
  fridge: fridge(),
  wardrobe: wardrobe(),
  safe: safe(),
  watermelon: watermelon(),
} satisfies Record<string, CargoType>;

export type CargoTypeId = keyof typeof CARGO_TYPES;

/** Health lost to an impact of a given strength (m/s). Rises steeply at first, then levels off toward maxHit. */
export function hitDamage(type: CargoType, impact: number): number {
  if (impact <= type.threshold) return 0;
  return type.maxHit * (1 - Math.exp(-(impact - type.threshold) / type.give));
}

export function stageForHp(hp: number): Stage {
  if (hp <= STAGE_HP[2]) return 3;
  if (hp <= STAGE_HP[1]) return 2;
  if (hp <= STAGE_HP[0]) return 1;
  return 0;
}
