import type { Vec3 } from '../config';

// Cargo definitions, as plain data shared by the physics and the renderer.

/** 0 intact, 1 lightly damaged, 2 badly damaged, 3 destroyed. */
export type Stage = 0 | 1 | 2 | 3;

export const STAGE_NAMES = ['完好', '輕微受損', '嚴重受損', '全毀'] as const;

/** Health (out of 100) at or below which an item drops to stage 1, 2 and 3. */
export const STAGE_HP = [80, 45, 0] as const;

export interface PartDesc {
  shape: 'box' | 'cylinder' | 'sphere' | 'capsule' | 'dome' | 'cone';
  /**
   * box: half extents. cylinder / capsule: [radius, halfHeight, 0], along Y. sphere: [radius, 0, 0].
   * dome: [radius, 0, 0], half a sphere with its cut face downward, centred on its own middle. cone: [radius, halfHeight, 0],
   * its point up.
   */
  size: Vec3;
  /** A sphere or dome squashed to this share of its height: a crab's carapace. */
  flat?: number;
  /** A sphere drawn stretched or squashed along its own x, y and z: half a broken fish. Collided as the box round it. */
  scale?: Vec3;
  /** A cylinder or cone drawn with so many sides: three, and a flat cylinder is a triangle, an anchor's fluke. */
  sides?: number;
  /** Drawn but not collided with: the in-between balls of a smooth shape whose ends do the colliding. Never detaches. */
  ghost?: boolean;
  /** Relative to the item's origin. */
  pos: Vec3;
  /** Euler XYZ, radians. */
  rot?: Vec3;
  color: number;
  mass: number;
  /** Surface pattern drawn under the damage cracks. On a dome, 'flesh' is what shows on the cut face. */
  texture?: 'crate' | 'melon' | 'flesh' | 'rice' | 'sign' | 'cabbage' | 'noodles' | 'octopus' | 'sucker' | 'mahi';
  /** Stage at which this part drops off the item. Anything still attached comes apart at stage 3. */
  detachAt?: 1 | 2;
  /** A bottle's cap, of this colour: drawn on its top, and coming away with it, not a piece of its own. */
  cap?: number;
}

export type BurstKind = 'splinters' | 'water' | 'bone' | 'sparks' | 'pulp' | 'rice' | 'porcelain' | 'paintRed' | 'paintBlue' | 'paintYellow' | 'ice' | 'leaves' | 'grain' | 'shell' | 'ink';

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
   * How much being squeezed in a pile counts against it, beside a knock of the same strength; 0.4 if not given. Something
   * that gives and springs back, a cabbage, a carton, a crab's legs, takes being pressed by the load far better.
   */
  crush?: number;
  /**
   * Share of the price it is still worth as wreckage, if the wreckage stays on the truck.
   * Value runs from the full price at full health down to this at none.
   */
  salvage: number;
  friction: number;
  /**
   * Frozen smooth: against the bed or anything else it slides as on ice, its own friction and not the mean of its and the
   * other's, which would hold it nearly as well as anything.
   */
  slick?: boolean;
  /**
   * For something round: how much the bed has to gain or lose in speed, m/s², before it
   * rolls rather than staying where it was put. Friction alone holds nothing round: a ball
   * on a flat bed sets off at the lightest touch of the pedal. A sphere is held however it
   * lies; a cylinder only on its side, so that it stands or falls as before.
   */
  rolling?: number;
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
    rolling: 4,
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
    value: 600,
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
    value: 400,
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
    value: 500,
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
    value: 100,
    threshold: 4,
    maxHit: 75,
    give: 7,
    salvage: 0.1,
    friction: 0.5,
    rolling: 4,
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

const WASHER = 0xf2f3f1;
const WASHER_DARK = 0xd5d9dc;

/**
 * A top-loading washing machine: tall and square, enamel on steel, so it takes a knock better than a crate; but it stands
 * higher than the sides of the bed, and the lid goes at the first real knock, and then the drum is there to be seen.
 */
function washer(): CargoType {
  const [w, h, d] = [0.44, 0.66, 0.44];
  const lid = 0.022;
  return {
    id: 'washer',
    name: '洗衣機',
    value: 600,
    threshold: 7,
    maxHit: 28,
    give: 20,
    salvage: 0.3,
    friction: 0.5,
    hull: { shape: 'box', size: [w, h, d] },
    parts: [
      { shape: 'box', size: [w, h - lid, d], pos: [0, -lid, 0], color: WASHER, mass: 56 },
      // The lid on top, its window and handle; the control panel along the back with its dial and buttons.
      { shape: 'box', size: [w - 0.023, lid, d - 0.116], pos: [0, h - lid, 0.093], color: WASHER_DARK, mass: 2.5, detachAt: 1 },
      { shape: 'box', size: [0.22, 0.005, 0.151], pos: [0, h + 0.002, 0.104], color: 0x5a7a8c, mass: 0.116, detachAt: 1 },
      { shape: 'box', size: [0.104, 0.014, 0.017], pos: [0, h + 0.007, d - 0.052], color: 0x8c9096, mass: 0.116, detachAt: 1 },
      { shape: 'box', size: [w, 0.093, 0.081], pos: [0, h + 0.07, -d + 0.081], color: WASHER, mass: 1.8, detachAt: 2 },
      { shape: 'cylinder', size: [0.046, 0.014, 0], pos: [0.244, h + 0.081, -d + 0.176], rot: [Math.PI / 2, 0, 0], color: 0x3a3f46, mass: 0.116, detachAt: 2 },
      ...[-0.244, -0.139, -0.035].map((x): PartDesc => ({ shape: 'box', size: [0.032, 0.014, 0.007], pos: [x, h + 0.081, -d + 0.165], color: 0x4f8fd0, mass: 0.058, detachAt: 2 })),
      // The drum under the lid, seen once it has gone; and the brand's stripe down the front.
      { shape: 'cylinder', size: [0.348, 0.005, 0], pos: [0, h - lid - 0.001, 0.07], color: 0x8c9096, mass: 0.232 },
      { shape: 'cylinder', size: [0.267, 0.005, 0], pos: [0, h - lid + 0.001, 0.07], color: 0x3a3f46, mass: 0.116 },
      { shape: 'box', size: [w - 0.046, 0.035, 0.005], pos: [0, h - 0.232, d + 0.002], color: 0x4f8fd0, mass: 0.058 },
    ],
    debris: [
      { shape: 'box', size: [w, h, 0.035], pos: [0, 0, -d + 0.035], color: WASHER, mass: 12 },
      { shape: 'box', size: [0.035, h, d - 0.035], pos: [w - 0.035, 0, 0], color: WASHER, mass: 9 },
      { shape: 'box', size: [0.035, h, d - 0.035], pos: [-w + 0.035, 0, 0], color: WASHER, mass: 9 },
      { shape: 'cylinder', size: [0.336, 0.406, 0], pos: [0, -0.139, 0], color: 0x8c9096, mass: 14 },
    ],
    burst: 'sparks',
  };
}

const TOLEX = 0x26272b;
const GRILLE = 0x45474d;
const PIPING = 0xd8c48a;

/**
 * A guitar amplifier, a combo: a black box with a cloth grille across the front, a strip of knobs along the top and a
 * handle on it. Not to be thrown about: its knobs and handle come off, and a hard knock throws sparks.
 */
function amp(): CargoType {
  const [w, h, d] = [0.33, 0.27, 0.15];
  return {
    id: 'amp',
    name: '音箱',
    value: 300,
    threshold: 6,
    maxHit: 30,
    give: 18,
    salvage: 0.25,
    friction: 0.6,
    hull: { shape: 'box', size: [w, h, d] },
    parts: [
      { shape: 'box', size: [w, h, d], pos: [0, 0, 0], color: TOLEX, mass: 13.6 },
      // The grille cloth, inset in a frame of piping, and the maker's badge on it.
      { shape: 'box', size: [w - 0.03, h * 0.66, 0.006], pos: [0, -h * 0.22, d + 0.004], color: GRILLE, mass: 0.3, detachAt: 2 },
      { shape: 'box', size: [w - 0.02, 0.006, 0.007], pos: [0, h * 0.46, d + 0.005], color: PIPING, mass: 0.05 },
      { shape: 'box', size: [0.05, 0.016, 0.004], pos: [-w * 0.55, h * 0.3, d + 0.011], color: 0xf2efe6, mass: 0.02, detachAt: 1 },
      // The control panel along the top of the front, its knobs, and the jack.
      { shape: 'box', size: [w - 0.03, 0.035, 0.006], pos: [0, h - 0.055, d + 0.004], color: 0xb8b0a0, mass: 0.3 },
      ...[-0.22, -0.14, -0.06, 0.02, 0.1, 0.18].map((x): PartDesc => ({ shape: 'cylinder', size: [0.013, 0.012, 0], pos: [x, h - 0.055, d + 0.02], rot: [Math.PI / 2, 0, 0], color: 0x1a1b1e, mass: 0.03, detachAt: 2 })),
      { shape: 'cylinder', size: [0.009, 0.006, 0], pos: [0.26, h - 0.055, d + 0.012], rot: [Math.PI / 2, 0, 0], color: 0x9aa0a6, mass: 0.02 },
      // The handle on top, and the metal corners.
      { shape: 'box', size: [0.1, 0.018, 0.03], pos: [0, h + 0.025, 0], color: 0x1a1b1e, mass: 0.3, detachAt: 1 },
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sy): PartDesc => ({ shape: 'box', size: [0.024, 0.024, d + 0.004], pos: [sx * (w - 0.018), sy * (h - 0.018), 0], color: 0x9aa0a6, mass: 0.05 }))),
    ],
    debris: [
      { shape: 'box', size: [w, h, 0.02], pos: [0, 0, -d + 0.02], color: TOLEX, mass: 4 },
      { shape: 'box', size: [w, 0.02, d - 0.02], pos: [0, h - 0.02, 0], color: TOLEX, mass: 2.5 },
      { shape: 'cylinder', size: [0.14, 0.05, 0], pos: [0, -0.05, 0.04], rot: [Math.PI / 2, 0, 0], color: 0x3a3c42, mass: 3 },
      { shape: 'box', size: [w - 0.03, h * 0.66, 0.006], pos: [0, -h * 0.22, d], color: GRILLE, mass: 0.3 },
    ],
    burst: 'sparks',
  };
}

const BIKE = 0x2f8f9a;
const TYRE = 0x1e1f23;

/**
 * A town bicycle, standing: a step-through frame, two wheels, a saddle, upswept bars and a basket on the front. Its
 * mudguards, basket and bell come off; wrecked, it is a bent frame and two wheels.
 */
function bicycle(): CargoType {
  const wheel = 0.33;
  const axle = wheel - 0.5;
  const parts: PartDesc[] = [];
  for (const z of [-0.55, 0.55]) {
    parts.push({ shape: 'cylinder', size: [wheel, 0.022, 0], pos: [0, axle, z], rot: [0, 0, Math.PI / 2], color: TYRE, mass: 1.6 });
    parts.push({ shape: 'cylinder', size: [wheel - 0.05, 0.026, 0], pos: [0, axle, z], rot: [0, 0, Math.PI / 2], color: 0xc8ccd0, mass: 0.3 });
    parts.push({ shape: 'cylinder', size: [0.035, 0.04, 0], pos: [0, axle, z], rot: [0, 0, Math.PI / 2], color: 0x8c9096, mass: 0.1 });
    // The mudguard over it.
    parts.push({ shape: 'box', size: [0.04, 0.01, 0.2], pos: [0, axle + wheel + 0.03, z], color: 0xc8ccd0, mass: 0.15, detachAt: 1 });
  }
  // The frame: the low step-through tube, the seat tube, the stays to the back wheel, the head tube and the fork.
  parts.push({ shape: 'box', size: [0.025, 0.025, 0.36], pos: [0, axle + 0.08, 0.02], rot: [-0.25, 0, 0], color: BIKE, mass: 3.8 });
  parts.push({ shape: 'box', size: [0.025, 0.25, 0.025], pos: [0, axle + 0.28, -0.18], rot: [-0.25, 0, 0], color: BIKE, mass: 1.5 });
  parts.push({ shape: 'box', size: [0.02, 0.02, 0.2], pos: [0, axle + 0.02, -0.37], color: BIKE, mass: 0.6 });
  parts.push({ shape: 'box', size: [0.02, 0.02, 0.24], pos: [0, axle + 0.2, -0.38], rot: [0.75, 0, 0], color: BIKE, mass: 0.6 });
  parts.push({ shape: 'box', size: [0.03, 0.19, 0.03], pos: [0, axle + 0.33, 0.43], rot: [0.3, 0, 0], color: BIKE, mass: 1.2 });
  parts.push({ shape: 'box', size: [0.02, 0.17, 0.02], pos: [0, axle + 0.1, 0.5], rot: [0.3, 0, 0], color: 0x8c9096, mass: 0.5 });
  // The chain guard and the pedals.
  parts.push({ shape: 'box', size: [0.035, 0.07, 0.23], pos: [-0.04, axle + 0.01, -0.28], color: 0x8c9096, mass: 0.4 });
  parts.push({ shape: 'box', size: [0.13, 0.015, 0.04], pos: [0, axle - 0.02, -0.08], color: 0x2a2c31, mass: 0.2 });
  // The saddle on its post, the bars and their grips, the bell, and the basket over the front wheel.
  parts.push({ shape: 'box', size: [0.08, 0.035, 0.13], pos: [0, axle + 0.6, -0.27], color: 0x3a2a20, mass: 0.5, detachAt: 2 });
  parts.push({ shape: 'box', size: [0.28, 0.015, 0.02], pos: [0, axle + 0.56, 0.36], color: 0x8c9096, mass: 0.5 });
  for (const x of [-0.27, 0.27]) parts.push({ shape: 'box', size: [0.03, 0.02, 0.05], pos: [x, axle + 0.57, 0.33], color: 0x1e1f23, mass: 0.05 });
  parts.push({ shape: 'cylinder', size: [0.025, 0.015, 0], pos: [0.17, axle + 0.59, 0.37], color: 0xd8c48a, mass: 0.05, detachAt: 1 });
  parts.push({ shape: 'box', size: [0.17, 0.11, 0.13], pos: [0, axle + 0.47, 0.62], color: 0xb0b6bc, mass: 0.8, detachAt: 1 });
  return {
    id: 'bicycle',
    name: '腳踏車',
    value: 300,
    threshold: 6,
    maxHit: 30,
    give: 18,
    salvage: 0.2,
    friction: 0.7,
    hull: { shape: 'box', size: [0.25, 0.5, 0.88] },
    parts,
    debris: [
      { shape: 'cylinder', size: [wheel, 0.03, 0], pos: [0, axle, -0.55], rot: [0, 0, Math.PI / 2], color: TYRE, mass: 2 },
      { shape: 'cylinder', size: [wheel, 0.03, 0], pos: [0, axle, 0.55], rot: [0, 0, Math.PI / 2], color: TYRE, mass: 2 },
      { shape: 'box', size: [0.04, 0.2, 0.45], pos: [0, axle + 0.2, 0], rot: [0.4, 0, 0], color: BIKE, mass: 6 },
    ],
    burst: 'sparks',
  };
}

const AIRCON = 0xf7f7f3;

/**
 * A window air conditioner, brand new, still with its foam corners on and the energy label stuck on its side: a pale metal box with louvres across its front, a control strip with its knobs,
 * and the coil's fins across the back. Heavy, and not built to be dropped: the front comes off, then the knobs and the
 * fins; wrecked, its casing, the compressor and the fan.
 */
function aircon(): CargoType {
  const [w, h, d] = [0.33, 0.22, 0.3];
  const parts: PartDesc[] = [
    { shape: 'box', size: [w, h, d], pos: [0, 0, 0], color: AIRCON, mass: 25 },
    // The front: a dark grille with pale louvres across it, the control strip down its right side with two knobs.
    { shape: 'box', size: [w * 0.66, h - 0.03, 0.01], pos: [-w * 0.3, 0, d + 0.006], color: 0x4a4c50, mass: 0.8, detachAt: 1 },
    ...[0, 1, 2, 3, 4, 5, 6].map((k): PartDesc => ({ shape: 'box', size: [w * 0.62, 0.01, 0.014], pos: [-w * 0.3, -h + 0.05 + k * 0.058, d + 0.018], rot: [0.5, 0, 0], color: 0xf2f0ea, mass: 0.05, detachAt: 1 })),
    { shape: 'box', size: [w * 0.28, h - 0.03, 0.008], pos: [w * 0.66, 0, d + 0.005], color: 0xd6d2c6, mass: 0.3 },
    ...[0.05, -0.06].map((y): PartDesc => ({ shape: 'cylinder', size: [0.022, 0.012, 0], pos: [w * 0.66, y, d + 0.018], rot: [Math.PI / 2, 0, 0], color: 0x3a3a36, mass: 0.04, detachAt: 2 })),
    { shape: 'box', size: [0.05, 0.012, 0.004], pos: [w * 0.66, h - 0.04, d + 0.01], color: 0x2f6fb0, mass: 0.01 },
    // On top, toward the back, the slots the hot air goes out of: what says what it is, seen from above.
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((k): PartDesc => ({ shape: 'box', size: [w - 0.05, 0.004, 0.012], pos: [0, h + 0.002, -d + 0.04 + k * 0.034], color: 0x3a3c42, mass: 0.01 })),
    // Down each side, a block of vents; at the back, the coil's fins.
    ...[-1, 1].flatMap((sx) => [0, 1, 2, 3].map((k): PartDesc => ({ shape: 'box', size: [0.004, 0.012, d * 0.55], pos: [sx * (w + 0.002), h - 0.05 - k * 0.04, -d * 0.3], color: 0x3a3c42, mass: 0.01 }))),
    { shape: 'box', size: [w - 0.02, h - 0.02, 0.008], pos: [0, 0, -d - 0.004], color: 0x8c9096, mass: 0.6, detachAt: 2 },
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((k): PartDesc => ({ shape: 'box', size: [0.004, h - 0.03, 0.006], pos: [-w + 0.05 + k * 0.07, 0, -d - 0.012], color: 0x5a5e64, mass: 0.01, detachAt: 2 })),
    // New: the packing foam still on its four lower corners, the yellow energy label on its side, the lead tied up on top.
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz): PartDesc => ({ shape: 'box', size: [0.05, 0.06, 0.05], pos: [sx * (w - 0.02), -h + 0.05, sz * (d - 0.02)], color: 0xffffff, mass: 0.05, detachAt: 1 }))),
    { shape: 'box', size: [0.004, 0.07, 0.05], pos: [w + 0.004, 0, d * 0.35], color: 0xf2c12e, mass: 0.01, detachAt: 1 },
    { shape: 'box', size: [0.004, 0.035, 0.035], pos: [w + 0.006, 0.01, d * 0.35], color: 0x3f9a62, mass: 0.01, detachAt: 1 },
    { shape: 'cylinder', size: [0.06, 0.012, 0], pos: [w * 0.4, h + 0.012, -d * 0.55], color: 0xe8e8e2, mass: 0.1, detachAt: 1 },
  ];
  return {
    id: 'aircon',
    name: '冷氣',
    value: 300,
    threshold: 5.5,
    maxHit: 32,
    give: 16,
    salvage: 0.2,
    friction: 0.6,
    hull: { shape: 'box', size: [w, h, d] },
    parts,
    debris: [
      { shape: 'box', size: [w, 0.015, d], pos: [0, h - 0.015, 0], color: AIRCON, mass: 4 },
      { shape: 'box', size: [0.015, h, d], pos: [w - 0.015, 0, 0], color: AIRCON, mass: 3 },
      { shape: 'cylinder', size: [0.1, 0.12, 0], pos: [0.12, -0.08, -0.1], color: 0x3a3c42, mass: 12 },
      { shape: 'cylinder', size: [0.14, 0.02, 0], pos: [-0.12, 0, 0.1], rot: [Math.PI / 2, 0, 0], color: 0x5a5c62, mass: 2 },
    ],
    burst: 'sparks',
  };
}

const STEEL_POT = 0xc8ccd2;

/**
 * A big stainless stockpot, the kind a canteen boils its soup in: a tall steel drum with two handles and a lid. It takes a
 * fall that would wreck anything else, and only dents: the lid and the handles come off first.
 */
function stockpot(): CargoType {
  const [r, h] = [0.25, 0.22];
  return {
    id: 'stockpot',
    name: '湯鍋',
    value: 200,
    threshold: 11,
    maxHit: 16,
    give: 30,
    salvage: 0.5,
    friction: 0.45,
    hull: { shape: 'cylinder', size: [r, h, 0] },
    parts: [
      { shape: 'cylinder', size: [r, h, 0], pos: [0, 0, 0], color: STEEL_POT, mass: 18 },
      { shape: 'cylinder', size: [r + 0.012, 0.012, 0], pos: [0, h - 0.012, 0], color: 0xe2e5ea, mass: 0.4 },
      { shape: 'cylinder', size: [r + 0.006, 0.006, 0], pos: [0, -h + 0.03, 0], color: 0x9aa0a6, mass: 0.2 },
      { shape: 'cylinder', size: [r - 0.005, 0.012, 0], pos: [0, h + 0.012, 0], color: 0xdadde2, mass: 1.2, detachAt: 1 },
      { shape: 'box', size: [0.05, 0.025, 0.02], pos: [0, h + 0.05, 0], color: 0x2a2c31, mass: 0.1, detachAt: 1 },
      ...[-1, 1].map((sx): PartDesc => ({ shape: 'box', size: [0.03, 0.02, 0.07], pos: [sx * (r + 0.03), h - 0.06, 0], color: 0x9aa0a6, mass: 0.2, detachAt: 2 })),
      { shape: 'box', size: [0.004, 0.06, 0.08], pos: [r + 0.002, 0, 0.1], color: 0xc8372d, mass: 0.01 },
    ],
    debris: [
      { shape: 'cylinder', size: [r, h * 0.8, 0], pos: [0, -h * 0.2, 0], color: 0xa8acb2, mass: 15 },
      { shape: 'cylinder', size: [r - 0.005, 0.012, 0], pos: [0, h, 0], color: 0xdadde2, mass: 1.2 },
    ],
    burst: 'sparks',
  };
}

const COOKER_RED = 0xc8262a;

/**
 * The rice cooker every kitchen in Taiwan has: a round red body on little feet, a cream lid with a black knob, chrome
 * bands, black handles at its sides and the switch on its front. It takes a knock or two; its lid and knob come off first.
 */
function riceCooker(): CargoType {
  // Drawn larger than life (a real one is about 0.34 m across), or from the chase camera it is a dot: every measure is a
  // real one's times k.
  const k = 1.6;
  const [r, h] = [0.17 * k, 0.13 * k];
  return {
    id: 'riceCooker',
    name: '電鍋',
    value: 200,
    threshold: 7,
    maxHit: 30,
    give: 18,
    salvage: 0.25,
    friction: 0.6,
    hull: { shape: 'cylinder', size: [r, h + 0.04 * k, 0] },
    parts: [
      { shape: 'cylinder', size: [r, h, 0], pos: [0, -0.02 * k, 0], color: COOKER_RED, mass: 3.6 },
      { shape: 'cylinder', size: [r + 0.006 * k, 0.01 * k, 0], pos: [0, h - 0.025 * k, 0], color: 0xd8dce0, mass: 0.15 },
      { shape: 'cylinder', size: [r + 0.004 * k, 0.012 * k, 0], pos: [0, -h, 0], color: 0xd8dce0, mass: 0.15 },
      { shape: 'cylinder', size: [r - 0.012 * k, 0.03 * k, 0], pos: [0, h + 0.015 * k, 0], color: 0xf2ecd8, mass: 0.5, detachAt: 1 },
      { shape: 'cylinder', size: [0.03 * k, 0.018 * k, 0], pos: [0, h + 0.06 * k, 0], color: 0x1a1b1e, mass: 0.05, detachAt: 1 },
      ...[-1, 1].map((sx): PartDesc => ({ shape: 'box', size: [0.02 * k, 0.018 * k, 0.05 * k], pos: [sx * (r + 0.018 * k), h - 0.05 * k, 0], color: 0x1a1b1e, mass: 0.08, detachAt: 2 })),
      { shape: 'box', size: [0.035 * k, 0.022 * k, 0.012 * k], pos: [0, -h * 0.35, r + 0.006 * k], color: 0x1a1b1e, mass: 0.03, detachAt: 2 },
      { shape: 'box', size: [0.05 * k, 0.012 * k, 0.004 * k], pos: [0, h * 0.25, r + 0.003 * k], color: 0xf2efe6, mass: 0.01 },
      ...[0, 1, 2].map((n): PartDesc => ({ shape: 'cylinder', size: [0.018 * k, 0.012 * k, 0], pos: [Math.cos(n * 2.1) * (r - 0.04 * k), -h - 0.032 * k, Math.sin(n * 2.1) * (r - 0.04 * k)], color: 0x2a2c31, mass: 0.02 })),
    ],
    debris: [
      { shape: 'cylinder', size: [r, h * 0.7, 0], pos: [0, -0.04 * k, 0], color: COOKER_RED, mass: 3 },
      { shape: 'cylinder', size: [r - 0.012 * k, 0.03 * k, 0], pos: [0, h, 0], color: 0xf2ecd8, mass: 0.5 },
      { shape: 'cylinder', size: [r - 0.03 * k, h * 0.5, 0], pos: [0, 0.02 * k, 0], color: 0xb0b6bc, mass: 0.8 },
    ],
    burst: 'sparks',
  };
}

/**
 * A standing lightbox, the kind every shop puts out on the pavement: an upright box with 阿月 down both faces in white on red,
 * a white frame, on a heavy black foot. Light and tall, it goes over easily; a face cracks, and comes away.
 */
function lightbox(): CargoType {
  const [w, h, d] = [0.3, 0.45, 0.1];
  const parts: PartDesc[] = [
    { shape: 'box', size: [w, h, d], pos: [0, 0.03, 0], color: 0xf2efe6, mass: 4 },
    { shape: 'box', size: [w + 0.04, 0.05, d + 0.06], pos: [0, -h - 0.02, 0], color: 0x1e1f23, mass: 4 },
    { shape: 'box', size: [w + 0.015, 0.015, d + 0.015], pos: [0, h + 0.045, 0], color: 0xf2efe6, mass: 0.2 },
  ];
  for (const sz of [-1, 1]) parts.push({ shape: 'box', size: [w - 0.025, h - 0.03, 0.006], pos: [0, 0.03, sz * (d + 0.004)], color: 0xffffff, mass: 0.2, texture: 'sign', detachAt: sz < 0 ? 1 : 2 });
  // A string of LEDs round the edge of each face, red, yellow, green and blue in turn; they come off with the face.
  const LED = [0xff4a3a, 0xffd23a, 0x4adf6a, 0x4ab0ff];
  for (const sz of [-1, 1]) {
    let n = 0;
    const bulb = (x: number, y: number) => parts.push({ shape: 'box', size: [0.014, 0.014, 0.008], pos: [x, 0.03 + y, sz * (d + 0.012)], color: LED[n++ % LED.length], mass: 0.005, detachAt: sz < 0 ? 1 : 2 });
    for (let x = -w + 0.03; x <= w - 0.03; x += 0.06) { bulb(x, h - 0.012); bulb(x, -h + 0.012); }
    for (let y = -h + 0.07; y <= h - 0.07; y += 0.06) { bulb(-w + 0.012, y); bulb(w - 0.012, y); }
  }
  // And on top, a little lit crown: a yellow bar with a red light at each end.
  parts.push({ shape: 'box', size: [w * 0.6, 0.03, 0.03], pos: [0, h + 0.09, 0], color: 0xffd23a, mass: 0.1, detachAt: 1 });
  for (const sx of [-1, 1]) parts.push({ shape: 'sphere', size: [0.035, 0, 0], pos: [sx * w * 0.6, h + 0.09, 0], color: 0xff4a3a, mass: 0.05, detachAt: 1 });
  return {
    id: 'lightbox',
    name: '招牌',
    value: 200,
    threshold: 6,
    maxHit: 32,
    give: 16,
    salvage: 0.2,
    friction: 0.6,
    hull: { shape: 'box', size: [w + 0.04, h + 0.06, d + 0.03] },
    parts,
    debris: [
      { shape: 'box', size: [w, h * 0.6, d], pos: [0, -h * 0.3, 0], color: 0xf2efe6, mass: 3 },
      { shape: 'box', size: [w + 0.04, 0.05, d + 0.06], pos: [0, -h - 0.02, 0], color: 0x1e1f23, mass: 4 },
    ],
    burst: 'porcelain',
  };
}

/**
 * A loudhailer, the site foreman's: a white flared horn on a grey body, a red pistol grip with its trigger under it, the
 * strap. Drawn twice life size, or from above it would be a dot. Its horn comes off, then the grip.
 */
function megaphone(): CargoType {
  const k = 2;
  const parts: PartDesc[] = [
    { shape: 'cylinder', size: [0.07 * k, 0.09 * k, 0], pos: [0, 0, -0.06 * k], rot: [Math.PI / 2, 0, 0], color: 0x8a9096, mass: 1.6 },
    { shape: 'cylinder', size: [0.12 * k, 0.05 * k, 0], pos: [0, 0, 0.08 * k], rot: [Math.PI / 2, 0, 0], color: 0xf2f2ee, mass: 0.6, detachAt: 2 },
    { shape: 'cylinder', size: [0.15 * k, 0.03 * k, 0], pos: [0, 0, 0.15 * k], rot: [Math.PI / 2, 0, 0], color: 0xf2f2ee, mass: 0.4, detachAt: 2 },
    { shape: 'cylinder', size: [0.13 * k, 0.005 * k, 0], pos: [0, 0, 0.181 * k], rot: [Math.PI / 2, 0, 0], color: 0x3a3c42, mass: 0.05, detachAt: 2 },
    { shape: 'box', size: [0.025 * k, 0.07 * k, 0.03 * k], pos: [0, -0.1 * k, -0.08 * k], rot: [0.25, 0, 0], color: 0xc8372d, mass: 0.3, detachAt: 1 },
    { shape: 'box', size: [0.012 * k, 0.025 * k, 0.012 * k], pos: [0, -0.08 * k, -0.04 * k], color: 0x1a1b1e, mass: 0.02, detachAt: 1 },
    { shape: 'box', size: [0.015 * k, 0.06 * k, 0.005 * k], pos: [0.072 * k, 0.03 * k, -0.06 * k], color: 0x2a2c31, mass: 0.02 },
    { shape: 'box', size: [0.03 * k, 0.012 * k, 0.004 * k], pos: [0, 0.03 * k, -0.149 * k], color: 0xffd23a, mass: 0.01 },
  ];
  return {
    id: 'megaphone',
    name: '大聲公',
    value: 230,
    threshold: 6,
    maxHit: 30,
    give: 18,
    salvage: 0.2,
    friction: 0.6,
    hull: { shape: 'box', size: [0.15 * k, 0.15 * k, 0.18 * k] },
    parts,
    debris: [
      { shape: 'cylinder', size: [0.07 * k, 0.09 * k, 0], pos: [0, 0, -0.06 * k], rot: [Math.PI / 2, 0, 0], color: 0x8a9096, mass: 1.6 },
      { shape: 'cylinder', size: [0.15 * k, 0.03 * k, 0], pos: [0, 0, 0.15 * k], rot: [Math.PI / 2, 0, 0], color: 0xf2f2ee, mass: 0.4 },
    ],
    burst: 'sparks',
  };
}

/**
 * A steel toolbox, red, the cantilever kind: its lid with a handle across it, the catches at the front, a spanner and a
 * hammer handle sticking out of the top tray. Heavy for its size; its lid and the tools come off.
 */
function toolbox(): CargoType {
  const k = 1.5;
  const [w, h, d] = [0.27 * k, 0.12 * k, 0.12 * k];
  return {
    id: 'toolbox',
    name: '工具箱',
    value: 230,
    threshold: 8,
    maxHit: 26,
    give: 24,
    salvage: 0.35,
    friction: 0.6,
    hull: { shape: 'box', size: [w, h + 0.03 * k, d] },
    parts: [
      { shape: 'box', size: [w, h, d], pos: [0, -0.02 * k, 0], color: 0xc8262a, mass: 12 },
      { shape: 'box', size: [w + 0.005, 0.025 * k, d + 0.005], pos: [0, h - 0.01 * k, 0], color: 0xa81f22, mass: 1.5, detachAt: 2 },
      { shape: 'box', size: [w * 0.55, 0.012 * k, 0.012 * k], pos: [0, h + 0.05 * k, 0], color: 0x1a1b1e, mass: 0.3, detachAt: 2 },
      ...[-1, 1].map((sx): PartDesc => ({ shape: 'box', size: [0.012 * k, 0.03 * k, 0.012 * k], pos: [sx * w * 0.55, h + 0.03 * k, 0], color: 0x1a1b1e, mass: 0.05, detachAt: 2 })),
      ...[-1, 1].map((sx): PartDesc => ({ shape: 'box', size: [0.03 * k, 0.02 * k, 0.006 * k], pos: [sx * w * 0.6, h - 0.04 * k, d + 0.004], color: 0xd8dce0, mass: 0.03 })),
      { shape: 'box', size: [w - 0.01, 0.004 * k, 0.003 * k], pos: [0, -h * 0.2, d + 0.003], color: 0x7a1518, mass: 0.01 },
      { shape: 'box', size: [0.13 * k, 0.012 * k, 0.025 * k], pos: [-w * 0.3, h + 0.04 * k, d * 0.5], rot: [0, 0.3, 0.4], color: 0xb0b6bc, mass: 0.2, detachAt: 1 },
      { shape: 'box', size: [0.015 * k, 0.11 * k, 0.015 * k], pos: [w * 0.4, h + 0.06 * k, -d * 0.4], rot: [0.3, 0, -0.5], color: 0xd9a62e, mass: 0.2, detachAt: 1 },
    ],
    debris: [
      { shape: 'box', size: [w, h * 0.8, d], pos: [0, -0.04 * k, 0], color: 0xa81f22, mass: 10 },
      { shape: 'box', size: [w, 0.025 * k, d], pos: [0, h, 0], color: 0xa81f22, mass: 1.5 },
    ],
    burst: 'sparks',
  };
}

/**
 * The men's radio, an old portable cassette one: silver, a speaker either side of the cassette door, the tuning dial
 * along the top, a handle over it and the aerial up at a slant. Drawn a little over life size. The aerial goes first,
 * then the handle and the speakers' grilles.
 */
function radio(): CargoType {
  const k = 1.6;
  const [w, h, d] = [0.2 * k, 0.11 * k, 0.06 * k];
  const SILVER = 0xb8bcc2, BLACK = 0x2a2c31;
  return {
    id: 'radio',
    name: '收音機',
    value: 230,
    threshold: 6,
    maxHit: 30,
    give: 18,
    salvage: 0.25,
    friction: 0.6,
    hull: { shape: 'box', size: [w, h + 0.03 * k, d] },
    parts: [
      { shape: 'box', size: [w, h, d], pos: [0, 0, 0], color: SILVER, mass: 3.6 },
      ...[-1, 1].flatMap((sx): PartDesc[] => [
        { shape: 'cylinder', size: [0.075 * k, 0.006 * k, 0], pos: [sx * w * 0.6, -0.01 * k, d + 0.004], rot: [Math.PI / 2, 0, 0], color: BLACK, mass: 0.2, detachAt: 2 },
        { shape: 'cylinder', size: [0.025 * k, 0.004 * k, 0], pos: [sx * w * 0.6, -0.01 * k, d + 0.012], rot: [Math.PI / 2, 0, 0], color: SILVER, mass: 0.02, detachAt: 2 },
      ]),
      { shape: 'box', size: [0.05 * k, 0.04 * k, 0.004 * k], pos: [0, -0.03 * k, d + 0.003], color: 0x3a3e46, mass: 0.05 },
      { shape: 'box', size: [w * 0.85, 0.012 * k, 0.004 * k], pos: [0, h - 0.025 * k, d + 0.003], color: 0xe0a040, mass: 0.02 },
      ...[-0.6, -0.2, 0.2, 0.6].map((x): PartDesc => ({ shape: 'box', size: [0.012 * k, 0.006 * k, 0.012 * k], pos: [x * w, h + 0.004 * k, d * 0.4], color: BLACK, mass: 0.01 })),
      { shape: 'box', size: [w * 0.7, 0.01 * k, 0.012 * k], pos: [0, h + 0.05 * k, 0], color: BLACK, mass: 0.2, detachAt: 2 },
      ...[-1, 1].map((sx): PartDesc => ({ shape: 'box', size: [0.01 * k, 0.025 * k, 0.01 * k], pos: [sx * w * 0.68, h + 0.025 * k, 0], color: BLACK, mass: 0.03, detachAt: 2 })),
      { shape: 'cylinder', size: [0.003 * k, 0.16 * k, 0], pos: [w * 0.85 + 0.06 * k, h + 0.14 * k, -d * 0.5], rot: [0, 0, -0.45], color: 0xd8dce0, mass: 0.02, detachAt: 1 },
    ],
    debris: [
      { shape: 'box', size: [w, h * 0.7, d], pos: [0, -h * 0.3, 0], color: SILVER, mass: 3 },
      { shape: 'box', size: [w * 0.5, h * 0.3, d], pos: [w * 0.4, h * 0.6, 0], color: SILVER, mass: 0.6 },
    ],
    burst: 'sparks',
  };
}

const SACKING = 0xe8e0c8;
const SACKING_DARK = 0xd2c7a8;
const RICE = 0xf2e6bf;

/**
 * A sack of rice: heavy and soft. It takes almost anything, and hardly slides, so it is what the rest is packed against. Cheap.
 * Torn open at last, it spills its rice.
 */
function sack(): CargoType {
  const [w, h, d] = [0.38, 0.14, 0.26];
  return {
    id: 'sack',
    name: '米袋',
    value: 80,
    threshold: 10,
    maxHit: 12,
    give: 30,
    salvage: 0.6,
    friction: 0.95,
    hull: { shape: 'box', size: [w, h, d] },
    parts: [
      // A pillow of sacking: flat on top and below, rounded along its sides where it bulges, and the corners pinched into
      // ears where it was sewn up.
      { shape: 'box', size: [w - 0.05, h, d - h], pos: [0, 0, 0], color: SACKING, mass: 22 },
      ...[-1, 1].map((side): PartDesc => ({ shape: 'cylinder', size: [h, w - 0.05, 0], pos: [0, 0, side * (d - h)], rot: [0, 0, Math.PI / 2], color: SACKING, mass: 2 })),
      ...[-1, 1].map((side): PartDesc => ({ shape: 'box', size: [0.05, h * 0.8, d - h], pos: [side * (w - 0.03), -0.01, 0], color: SACKING_DARK, mass: 0.5 })),
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz): PartDesc => ({ shape: 'box', size: [0.05, 0.03, 0.05], pos: [sx * (w - 0.01), -0.02, sz * (d - 0.06)], rot: [0, sx * sz * 0.6, 0], color: SACKING_DARK, mass: 0.1 }))),
      // The printing on it: 米 in red on a white square, big enough to read from the cab; a blue band either side.
      { shape: 'box', size: [0.16, 0.004, 0.16], pos: [0, h + 0.002, 0], color: 0xffffff, mass: 0.05, texture: 'rice' },
      ...[-1, 1].map((side): PartDesc => ({ shape: 'box', size: [0.025, 0.004, d - h], pos: [side * 0.25, h + 0.002, 0], color: 0x2f62a8, mass: 0.02 })),
    ],
    debris: [
      { shape: 'box', size: [w * 0.55, 0.05, d], pos: [-w * 0.45, -h + 0.05, 0], color: SACKING, mass: 3 },
      { shape: 'box', size: [w * 0.55, 0.05, d], pos: [w * 0.45, -h + 0.05, 0.02], rot: [0, 0.3, 0], color: SACKING_DARK, mass: 3 },
      { shape: 'dome', size: [0.22, 0, 0], pos: [0, -h + 0.02, 0], color: RICE, mass: 18 },
    ],
    burst: 'rice',
  };
}

const CRATE_RED = 0xc8372d;
const GLASS = [0x3f8f5a, 0x8a5a2a, 0x3f8f5a, 0xd9e6e8];

/**
 * A plastic crate of soda in glass bottles: the one thing on this load that minds being shaken. The bottles break, and
 * what was in them goes everywhere; the crate itself holds together until the last.
 */
function soda(): CargoType {
  const [w, h, d] = [0.22, 0.16, 0.17];
  const bottles: PartDesc[] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const [x, z] = [-0.15 + i * 0.1, -0.1 + j * 0.1];
    // Each cap drawn on its bottle: a cap of its own, two hundredths of a kilo, thrown loose with every bottle, was a body
    // the physics could hardly keep still, and four crates of them made the truck's way down any steps slow.
    bottles.push({ shape: 'cylinder', size: [0.032, 0.05, 0], pos: [x, h + 0.02, z], color: GLASS[(i + j) % GLASS.length], mass: 0.32, detachAt: (i + j) % 2 ? 1 : 2, cap: 0xd9b24a });
  }
  return {
    id: 'soda',
    name: '汽水箱',
    value: 180,
    threshold: 5,
    maxHit: 40,
    give: 14,
    salvage: 0.15,
    friction: 0.6,
    hull: { shape: 'box', size: [w, h + 0.03, d] },
    parts: [
      { shape: 'box', size: [w, h, d], pos: [0, -0.03, 0], color: CRATE_RED, mass: 12 },
      // Its handholds, and the white lettering band.
      ...[-1, 1].map((side): PartDesc => ({ shape: 'box', size: [0.07, 0.025, 0.004], pos: [0, h - 0.07, side * (d + 0.002)], color: 0x2a1a12, mass: 0.05 })),
      ...[-1, 1].map((side): PartDesc => ({ shape: 'box', size: [w - 0.03, 0.02, 0.004], pos: [0, -0.04, side * (d + 0.002)], color: 0xf4f2ec, mass: 0.05 })),
      ...bottles,
    ],
    debris: [
      { shape: 'box', size: [w, 0.08, d], pos: [0, -h + 0.05, 0], color: CRATE_RED, mass: 6 },
      { shape: 'box', size: [w, 0.06, 0.02], pos: [0, -0.02, d - 0.02], rot: [0.4, 0, 0], color: CRATE_RED, mass: 1.5 },
      ...[0, 1, 2].map((i): PartDesc => ({ shape: 'cylinder', size: [0.032, 0.05, 0], pos: [-0.1 + i * 0.1, -h + 0.18, 0], rot: [0, 0, Math.PI / 2], color: GLASS[i], mass: 0.3 })),
    ],
    burst: 'water',
    leaks: true,
  };
}

const PORCELAIN = 0xf4f4f0, PORCELAIN_SHADE = 0xdcdcd6;

/**
 * A toilet, bare, as it comes off the lorry to be fitted: the pedestal, the bowl with its seat, the cistern at the back
 * with its lid. Low and heavy for its size, so it stays where it is put; but it is porcelain. A hard knock cracks it, and a
 * landing from a height breaks it in pieces.
 */
function toilet(): CargoType {
  // A big one, the showroom kind: the one thing on its load.
  const k = 1.6;
  const sized = (p: PartDesc): PartDesc => ({ ...p, size: [p.size[0] * k, p.size[1] * k, p.size[2] * k], pos: [p.pos[0] * k, p.pos[1] * k, p.pos[2] * k], mass: p.mass * 1.6 });
  const t: CargoType = {
    id: 'toilet',
    name: '馬桶',
    value: 900,
    threshold: 5,
    maxHit: 46,
    give: 9,
    salvage: 0.1,
    friction: 0.85,
    hull: { shape: 'box', size: [0.22 * k, 0.38 * k, 0.36 * k] },
    parts: [
      { shape: 'box', size: [0.13, 0.17, 0.19], pos: [0, -0.21, -0.06], color: PORCELAIN, mass: 14 },
      { shape: 'cylinder', size: [0.21, 0.08, 0], pos: [0, 0.04, -0.1], color: PORCELAIN, mass: 10 },
      { shape: 'cylinder', size: [0.215, 0.012, 0], pos: [0, 0.13, -0.1], color: PORCELAIN_SHADE, mass: 1 },
      { shape: 'cylinder', size: [0.14, 0.013, 0], pos: [0, 0.135, -0.1], color: 0x7a7e80, mass: 0.1 },
      { shape: 'box', size: [0.2, 0.17, 0.08], pos: [0, 0.19, 0.27], color: PORCELAIN, mass: 10 },
      { shape: 'box', size: [0.21, 0.015, 0.09], pos: [0, 0.37, 0.27], color: PORCELAIN_SHADE, mass: 2, detachAt: 1 },
      { shape: 'cylinder', size: [0.025, 0.008, 0], pos: [0, 0.39, 0.27], color: 0xb8bcc0, mass: 0.1 },
    ],
    debris: [
      { shape: 'box', size: [0.13, 0.12, 0.17], pos: [0, -0.24, -0.05], color: PORCELAIN, mass: 12 },
      { shape: 'box', size: [0.15, 0.06, 0.12], pos: [0.06, 0.02, -0.16], rot: [0.3, 0.4, 0.2], color: PORCELAIN, mass: 5 },
      { shape: 'box', size: [0.12, 0.05, 0.1], pos: [-0.08, 0.04, -0.02], rot: [-0.2, 0.9, 0.3], color: PORCELAIN_SHADE, mass: 4 },
      { shape: 'box', size: [0.18, 0.12, 0.07], pos: [0, 0.16, 0.27], rot: [0.2, 0, 0.1], color: PORCELAIN, mass: 8 },
    ],
    burst: 'porcelain',
  };
  return { ...t, parts: t.parts.map(sized), debris: t.debris!.map(sized) };
}

/**
 * A tin of paint, a band of its colour round it. Round: on its side it rolls; standing, it stays. It takes a knock, but
 * burst, its paint goes everywhere, over the bed and the truck.
 */
function paint(id: string, band: number, burst: BurstKind): CargoType {
  // The big tins, twenty litres.
  const k = 1.4;
  const sized = (p: PartDesc): PartDesc => ({ ...p, size: [p.size[0] * k, p.size[1] * k, p.size[2] * k], pos: [p.pos[0] * k, p.pos[1] * k, p.pos[2] * k], mass: p.mass * 2.2 });
  const t: CargoType = {
    id,
    name: '油漆桶',
    value: 100,
    threshold: 4.5,
    maxHit: 60,
    give: 8,
    salvage: 0.05,
    friction: 0.6,
    rolling: 3,
    hull: { shape: 'cylinder', size: [0.15 * k, 0.19 * k, 0] },
    parts: [
      { shape: 'cylinder', size: [0.15, 0.19, 0], pos: [0, 0, 0], color: 0xe4e6e4, mass: 9 },
      { shape: 'cylinder', size: [0.152, 0.07, 0], pos: [0, -0.02, 0], color: band, mass: 0.2 },
      { shape: 'cylinder', size: [0.14, 0.012, 0], pos: [0, 0.195, 0], color: 0x8c9096, mass: 0.3, detachAt: 2 },
      { shape: 'box', size: [0.13, 0.008, 0.008], pos: [0, 0.23, 0], color: 0x5f646a, mass: 0.05 },
    ],
    burst,
    leaks: true,
  };
  return { ...t, parts: t.parts.map(sized) };
}

/**
 * A bundle of reinforcing bars, six and a half metres long, wired together in three places: longer than the bed, it lies
 * on top of the load and sticks out a long way past the tailgate. Steel: nothing hurts it. But nothing holds it either:
 * smooth on smooth crates, it shoots forward under hard braking and slides off the back going up a slope, and once it is
 * off it is all off.
 */
function rebar(): CargoType {
  const half = 3.2;
  const bars: PartDesc[] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) bars.push({ shape: 'cylinder', size: [0.025, half, 0], pos: [-0.12 + i * 0.08, -0.07 + j * 0.07, 0], rot: [Math.PI / 2, 0, 0], color: (i + j) % 2 ? 0x6a4a32 : 0x7a5a3e, mass: 26 });
  return {
    id: 'rebar',
    name: '鋼筋',
    value: 330,
    threshold: 14,
    maxHit: 8,
    give: 20,
    salvage: 0.8,
    friction: 1.0,
    hull: { shape: 'box', size: [0.16, 0.11, half] },
    parts: [
      ...bars,
      ...[-2.2, 0, 2.2].map((z): PartDesc => ({ shape: 'box', size: [0.17, 0.12, 0.02], pos: [0, 0, z], color: 0x3a3f45, mass: 0.2 })),
      // A red rag tied on its end, as the law wants of a load sticking out.
      { shape: 'box', size: [0.1, 0.12, 0.004], pos: [0, -0.18, -half - 0.01], color: 0xd8302a, mass: 0.05 },
    ],
    burst: 'sparks',
  };
}

/** A capsule from one point to another: a crab's leg. Its rounded ends reach both points. */
function limb(a: Vec3, b: Vec3, r: number, color: number, mass: number, detachAt?: 1 | 2): PartDesc {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], long = Math.hypot(d[0], d[1], d[2]);
  return {
    shape: 'capsule', size: [r, Math.max(0.01, long / 2 - r), 0], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    rot: [0, Math.atan2(-d[2], d[0]), -Math.acos(d[1] / long)], color, mass, detachAt,
  };
}

const TUNA_BACK = 0x1c2a44, TUNA_SIDE = 0xc4ccd4, TUNA_FIN = 0x2a3650, FINLET = 0xe8c020, TUNA_RED = 0xa8242c;

/**
 * A bluefin tuna, frozen whole, the fish of the season, for the reefer's hold: two metres of it lying on its side as it lay
 * on the auction floor, the dark of its back along one edge, silver below, yellow finlets down to the tail. Two hundred
 * kilos, frozen hard, and as smooth as ice: nothing in the bed holds it. It slides the length of the bed at every slope and
 * every brake, into whatever is in the way. A knock bruises it, and it is worth less for every one.
 */
function tuna(): CargoType {
  // Lying on its left side: its back toward -x, its belly toward +x, its right flank up; head toward +z.
  const z = (v: number) => v + 0.107;
  // Its body, deep in the middle and drawn out to a point at the snout and a thin wrist at the tail: a close run of balls,
  // silver, with a smaller dark run along the back; spaced as close as this, their outline is smooth.
  const SPINE = [[0.95, 0.1], [0.8, 0.17], [0.62, 0.23], [0.4, 0.27], [0.15, 0.285], [-0.1, 0.27], [-0.33, 0.22], [-0.52, 0.16], [-0.67, 0.11], [-0.78, 0.08]];
  const RUN: number[][] = [];
  for (let k = 0; k < SPINE.length - 1; k++) for (let t = 0; t < 1; t += 0.25) RUN.push([SPINE[k][0] + (SPINE[k + 1][0] - SPINE[k][0]) * t, SPINE[k][1] + (SPINE[k + 1][1] - SPINE[k][1]) * t]);
  RUN.push(SPINE[SPINE.length - 1]);
  const body: PartDesc[] = RUN.flatMap(([at, r]): PartDesc[] => [
    { shape: 'sphere', size: [r, 0, 0], pos: [0, 0, z(at)], color: TUNA_SIDE, mass: r * 15 },
    { shape: 'sphere', size: [r * 0.86, 0, 0], pos: [-r * 0.33, 0, z(at)], color: TUNA_BACK, mass: r * 10 },
  ]);
  const finlets: PartDesc[] = [];
  for (const [i, k] of [0.15, 0.12, 0.1, 0.09].entries()) {
    finlets.push({ shape: 'box', size: [0.03, 0.008, 0.022], pos: [-k - 0.03, 0, z(-0.62 - i * 0.1)], color: FINLET, mass: 0.1, detachAt: i % 2 ? 1 : 2 });
    finlets.push({ shape: 'box', size: [0.03, 0.008, 0.022], pos: [k + 0.02, 0, z(-0.62 - i * 0.1)], color: FINLET, mass: 0.1, detachAt: i % 2 ? 2 : 1 });
  }
  const fish: CargoType = {
    id: 'tuna',
    name: '冷凍黑鮪魚',
    value: 1200,
    threshold: 6.5,
    maxHit: 30,
    give: 14,
    salvage: 0.35,
    friction: 0.3,
    slick: true,
    hull: { shape: 'box', size: [0.3, 0.28, 1.16] },
    parts: [
      ...body,
      { shape: 'capsule', size: [0.07, 0.06, 0], pos: [0, 0, z(-0.9)], rot: ALONG_Z, color: TUNA_FIN, mass: 4 },
      // The tail, a crescent; the first dorsal fin, swept back, and the fin below; the long pectoral fin along the upper flank.
      { shape: 'box', size: [0.22, 0.012, 0.05], pos: [-0.176, 0, z(-1.13)], rot: [0, 2.498, 0], color: TUNA_FIN, mass: 3, detachAt: 2 },
      { shape: 'box', size: [0.22, 0.012, 0.05], pos: [0.176, 0, z(-1.13)], rot: [0, 0.6435, 0], color: TUNA_FIN, mass: 3, detachAt: 2 },
      { shape: 'box', size: [0.1, 0.012, 0.12], pos: [-0.38, 0, z(0.25)], rot: [0, -0.5, 0], color: TUNA_FIN, mass: 1, detachAt: 1 },
      { shape: 'box', size: [0.06, 0.01, 0.07], pos: [-0.25, 0, z(-0.4)], rot: [0, -0.6, 0], color: FINLET, mass: 0.4, detachAt: 2 },
      { shape: 'box', size: [0.06, 0.01, 0.07], pos: [0.25, 0, z(-0.4)], rot: [0, 0.6, 0], color: FINLET, mass: 0.4, detachAt: 1 },
      { shape: 'box', size: [0.035, 0.01, 0.19], pos: [-0.02, 0.272, z(0.4)], rot: [0, 0.18, 0], color: TUNA_FIN, mass: 0.6, detachAt: 1 },
      ...finlets,
      // The eye, big and round, the line of the gill cover behind it, and the mouth.
      { shape: 'cylinder', size: [0.045, 0.006, 0], pos: [-0.02, 0.166, z(0.8)], color: 0xe8e4d6, mass: 0.1 },
      { shape: 'cylinder', size: [0.026, 0.006, 0], pos: [-0.02, 0.172, z(0.8)], color: 0x101216, mass: 0.1 },
      { shape: 'box', size: [0.16, 0.006, 0.012], pos: [0.02, 0.232, z(0.62)], rot: [0, 0.35, 0], color: 0x5a6470, mass: 0.1 },
      { shape: 'box', size: [0.05, 0.005, 0.008], pos: [0.04, 0.118, z(0.9)], rot: [0, 0.5, 0], color: 0x2a3038, mass: 0.05 },
    ],
    // Broken in two across the middle, red where it broke, the tail on its own.
    debris: [
      { shape: 'capsule', size: [0.27, 0.25, 0], pos: [0, 0, z(0.45)], rot: ALONG_Z, color: TUNA_SIDE, mass: 90 },
      { shape: 'capsule', size: [0.25, 0.2, 0], pos: [0, 0, z(-0.3)], rot: ALONG_Z, color: TUNA_BACK, mass: 70 },
      { shape: 'box', size: [0.18, 0.16, 0.06], pos: [0.05, 0.02, z(0.05)], rot: [0.2, 0.3, 0.1], color: TUNA_RED, mass: 6 },
      { shape: 'box', size: [0.12, 0.1, 0.05], pos: [-0.08, 0.05, z(-0.1)], rot: [-0.3, 0.8, 0.2], color: TUNA_RED, mass: 4 },
      { shape: 'capsule', size: [0.09, 0.18, 0], pos: [0, 0, z(-0.85)], rot: ALONG_Z, color: TUNA_FIN, mass: 8 },
    ],
    burst: 'ice',
  };
  // Drawn two metres and a third long, and made a tenth smaller, so that it lies across the bed between its sides.
  const k = 0.9;
  const sized = (p: PartDesc): PartDesc => ({ ...p, size: [p.size[0] * k, p.size[1] * k, p.size[2] * k], pos: [p.pos[0] * k, p.pos[1] * k, p.pos[2] * k] });
  return { ...fish, hull: { shape: 'box', size: fish.hull!.size.map((v) => v * k) as Vec3 }, parts: fish.parts.map(sized), debris: fish.debris!.map(sized) };
}

/** A cone from a point on its base out along a direction, its point at the far end: a spine, a claw's finger, a fluke's bill. */
function spike(base: Vec3, dir: Vec3, r: number, long: number, color: number, mass: number, detachAt?: 1 | 2): PartDesc {
  const n = Math.hypot(dir[0], dir[1], dir[2]), d = [dir[0] / n, dir[1] / n, dir[2] / n];
  return {
    shape: 'cone', size: [r, long / 2, 0], pos: [base[0] + (d[0] * long) / 2, base[1] + (d[1] * long) / 2, base[2] + (d[2] * long) / 2],
    rot: [0, Math.atan2(-d[2], d[0]), -Math.acos(Math.max(-1, Math.min(1, d[1])))], color, mass, detachAt,
  };
}

const IRON = 0x474d55, IRON_LIGHT = 0x6a7179;

/**
 * An anchor, the old kind every child draws, lying flat as it is stowed, its stock turned in line with its arms: a shank,
 * thick at its foot, with a ring through its head and the stock across it there, balls on the stock's ends; at its foot two
 * arms curving out and up to pointed flukes. A hundred and thirty kilos of iron, all ends and corners: nothing in the bed
 * stands up to it, and its arms and flukes catch on whatever it slides into. Nothing hurts it.
 */
function anchor(): CargoType {
  // Flat in its own x-z plane, the head toward +z.
  const parts: PartDesc[] = [
    limb([0, 0, -0.78], [0, 0, -0.2], 0.06, IRON, 30),
    limb([0, 0, -0.2], [0, 0, 0.76], 0.048, IRON, 25),
    { shape: 'sphere', size: [0.07, 0, 0], pos: [0, 0, -0.8], color: IRON, mass: 8 },
  ];
  for (const side of [1, -1]) {
    // The arm, in three lengths round a curve, thinning out to the fluke.
    const arc: Vec3[] = [[0, 0, -0.8], [side * 0.22, 0, -0.85], [side * 0.4, 0, -0.75], [side * 0.5, 0, -0.55]];
    for (let k = 0; k < 3; k++) parts.push(limb(arc[k], arc[k + 1], 0.055 - k * 0.006, IRON, 7));
    // The fluke: a flat triangle on the arm's end, pointing on along it, and a knob at its point.
    const [x2, , z2] = arc[2], [x3, , z3] = arc[3], l = Math.hypot(x3 - x2, z3 - z2), dx = (x3 - x2) / l, dz = (z3 - z2) / l;
    parts.push({ shape: 'cylinder', sides: 3, size: [0.15, 0.025, 0], pos: [x3 + dx * 0.02, 0, z3 + dz * 0.02], rot: [0, Math.atan2(dx, dz), 0], color: IRON, mass: 8 });
    parts.push({ shape: 'sphere', size: [0.03, 0, 0], pos: [x3 + dx * 0.18, 0, z3 + dz * 0.16], color: IRON_LIGHT, mass: 0.3 });
  }
  // The stock across the head, balls on its ends; the eye; the ring through it, round, of eight short lengths.
  parts.push(limb([-0.46, 0, 0.55], [0.46, 0, 0.55], 0.04, IRON, 14));
  for (const x of [-0.5, 0.5]) parts.push({ shape: 'sphere', size: [0.065, 0, 0], pos: [x, 0, 0.55], color: IRON_LIGHT, mass: 2 });
  parts.push({ shape: 'sphere', size: [0.06, 0, 0], pos: [0, 0, 0.78], color: IRON, mass: 1 });
  const round = (k: number): Vec3 => [0.14 * Math.cos((k * Math.PI) / 4), 0, 0.94 + 0.14 * Math.sin((k * Math.PI) / 4)];
  for (let k = 0; k < 8; k++) parts.push(limb(round(k), round(k + 1), 0.024, IRON_LIGHT, 0.4));
  return {
    id: 'anchor',
    name: '船錨',
    value: 600,
    threshold: 14,
    maxHit: 10,
    give: 20,
    salvage: 0.8,
    friction: 0.9,
    parts,
    burst: 'sparks',
  };
}

const LEAF_OUTER = 0x6f9e4e, LEAF_MID = 0x98c068, LEAF_PALE = 0xa8cc78;

/**
 * A cabbage, of the kind that costs as much as meat the week a typhoon comes: round, so it rolls wherever the bed tips, and
 * light, so it bounces. Its loose outer leaves come off at the first knock, and a real one bursts it. Cheap any other
 * week; they go by the dozen.
 */
function cabbage(): CargoType {
  const r = 0.15;
  // The head: the pale heart on top, and round it the leaves wrapped over it, each bulging out of it a little, darker.
  const wraps = [0, 1, 2, 3, 4].map((i): PartDesc => {
    const a = i * 1.2566 + 0.3;
    return { shape: 'sphere', size: [0.112, 0, 0], pos: [Math.sin(a) * 0.05, -0.03 + (i % 2) * 0.015, Math.cos(a) * 0.05], color: i % 2 ? LEAF_PALE : LEAF_MID, mass: 0.2, texture: 'cabbage' };
  });
  // The loose outer leaves below, cupped open round it.
  const open = [0.4, 2.5, 4.5].map((a, i): PartDesc => {
    const n: Vec3 = [Math.sin(a) * 0.85, 0.5, Math.cos(a) * 0.85];
    return { shape: 'cylinder', size: [0.1, 0.004, 0], pos: [Math.sin(a) * 0.1, -0.07, Math.cos(a) * 0.1], rot: [0, Math.atan2(-n[2], n[0]), -Math.acos(n[1] / Math.hypot(...n))], color: LEAF_OUTER, mass: 0.05, detachAt: i < 2 ? 1 : 2 };
  });
  return {
    id: 'cabbage',
    name: '高麗菜',
    value: 100,
    threshold: 5.5,
    maxHit: 50,
    give: 10,
    crush: 0.08,
    salvage: 0.1,
    friction: 0.6,
    rolling: 4,
    hull: { shape: 'sphere', size: [r, 0, 0] },
    parts: [
      { shape: 'sphere', size: [0.125, 0, 0], pos: [0, 0.02, 0], color: 0xd2e6a8, mass: 0.9, texture: 'cabbage' },
      ...wraps,
      { shape: 'cylinder', size: [0.032, 0.012, 0], pos: [0, -r + 0.006, 0], color: 0xe6ecc8, mass: 0.05 },
      ...open,
    ],
    // The heart, and its leaves torn off round it.
    debris: [
      { shape: 'sphere', size: [0.09, 0, 0], pos: [0, -0.05, 0], color: 0xd2e6a8, mass: 0.6, texture: 'cabbage' },
      ...[0, 1, 2, 3].map((i): PartDesc => ({ shape: 'cylinder', size: [0.09, 0.004, 0], pos: [Math.sin(i * 1.7) * 0.14, -0.12, Math.cos(i * 1.7) * 0.14], rot: [0.3, i * 1.7, 0.2], color: i % 2 ? LEAF_MID : LEAF_OUTER, mass: 0.1 })),
    ],
    burst: 'leaves',
  };
}

/**
 * A carton of cup noodles, the other thing everyone buys before a typhoon, taped shut: red bands top and bottom, and on
 * every side a big steaming cup of them, its lid peeled back. Big and light, five kilos, the lightest thing in the bed for
 * its size: it is thrown about by everything else and bounces off the walls. Knocked open, the lid's flaps come off; burst,
 * the cups go everywhere.
 */
function noodles(): CargoType {
  const [w, h, d] = [0.34, 0.22, 0.24];
  return {
    id: 'noodles',
    name: '泡麵箱',
    value: 100,
    threshold: 7,
    maxHit: 24,
    give: 18,
    crush: 0.15,
    salvage: 0.3,
    friction: 0.75,
    hull: { shape: 'box', size: [w, h, d] },
    parts: [
      { shape: 'box', size: [w, h, d], pos: [0, 0, 0], color: WHITE, mass: 4.6, texture: 'noodles' },
      // The flaps of its lid, meeting along the middle, and the tape over the join and down both ends.
      ...[-1, 1].map((side): PartDesc => ({ shape: 'box', size: [w - 0.008, 0.004, d / 2 - 0.006], pos: [0, h + 0.004, side * (d / 2)], color: 0xd42a22, mass: 0.1, detachAt: 2 })),
      { shape: 'box', size: [w - 0.004, 0.003, 0.035], pos: [0, h + 0.009, 0], color: 0xc8a46a, mass: 0.01, detachAt: 1 },
      ...[-1, 1].map((side): PartDesc => ({ shape: 'box', size: [0.003, 0.07, 0.035], pos: [side * (w + 0.003), h - 0.07, 0], color: 0xc8a46a, mass: 0.01, detachAt: 1 })),
    ],
    // The carton flattened, and the cups out of it.
    debris: [
      { shape: 'box', size: [w, 0.02, d], pos: [0, -h + 0.02, 0], color: 0xf4efe2, mass: 0.6 },
      ...[0, 1, 2, 3, 4].map((i): PartDesc => ({ shape: 'cylinder', size: [0.085, 0.065, 0], pos: [-0.24 + i * 0.12, -0.1 + (i % 2) * 0.05, i % 2 ? 0.1 : -0.1], rot: [Math.PI / 2, i * 0.9, 0], color: 0xf8f4ea, mass: 0.12 })),
      ...[0, 1, 2].map((i): PartDesc => ({ shape: 'cylinder', size: [0.089, 0.005, 0], pos: [-0.15 + i * 0.15, -0.16, 0.02 * i], rot: [0.2, 0, 0.1 * i], color: 0xf2c12e, mass: 0.01 })),
    ],
    burst: 'grain',
  };
}

const CRAB = 0xcf4a2a, CRAB_LIGHT = 0xe8764a, CRAB_PALE = 0xf2dcc0, CRAB_SPINE = 0x9c2c1a;

/**
 * A king crab, cooked, bright red: a low spiny carapace the size of a plate, and legs, jointed and knobbed, that reach the
 * width of a door, the right claw the bigger. Hardly anything to it but its legs, each of which goes its own way: it is
 * thrown about by any knock and lands all elbows, and the legs come off, one by one. Dear for what it weighs.
 */
function kingCrab(): CargoType {
  const parts: PartDesc[] = [
    // The carapace, a low dome, and the head forward of it; the pale underside showing below its rim.
    { shape: 'dome', size: [0.2, 0, 0], flat: 0.5, pos: [0, 0.05, -0.01], color: CRAB, mass: 2 },
    { shape: 'dome', size: [0.1, 0, 0], flat: 0.6, pos: [0, 0.03, 0.14], color: CRAB, mass: 0.3 },
    { shape: 'cylinder', size: [0.185, 0.018, 0], pos: [0, -0.004, -0.01], color: CRAB_PALE, mass: 0.4 },
    spike([0, 0.05, 0.22], [0, 0.2, 1], 0.02, 0.08, CRAB_SPINE, 0.02),
  ];
  // Its spines, standing out of the carapace all over.
  for (const [x, z] of [[0, 0.06], [0, -0.06], [0.07, 0.02], [-0.07, 0.02], [0.12, -0.04], [-0.12, -0.04], [0.06, -0.13], [-0.06, -0.13], [0.15, 0.05], [-0.15, 0.05], [0.1, 0.1], [-0.1, 0.1]]) {
    const y = 0.5 * Math.sqrt(Math.max(0, 0.04 - x * x - (z + 0.01) ** 2));
    parts.push(spike([x, y - 0.005, z], [x * 2, 1, z * 2], 0.016, 0.035, CRAB_SPINE, 0.01));
  }
  // Its eyes, on short stalks.
  for (const s of [-1, 1]) parts.push(limb([s * 0.03, 0.06, 0.17], [s * 0.04, 0.1, 0.2], 0.01, CRAB_LIGHT, 0.01), { shape: 'sphere', size: [0.018, 0, 0], pos: [s * 0.04, 0.105, 0.205], color: 0x1a1210, mass: 0.01 });
  for (const s of [-1, 1]) {
    // Three walking legs a side, each up from the body to its first joint, out to the next, and down to a pointed foot.
    for (const [j, a] of [0.6, 0.1, -0.4].entries()) {
      const o: Vec3 = [s * Math.cos(a), 0, Math.sin(a)];
      const off = j === 1 ? undefined : ((s > 0) === (j === 0) ? 1 : 2);
      const base: Vec3 = [s * 0.16 * Math.cos(a), 0.02, -0.01 + 0.16 * Math.sin(a)];
      const knee: Vec3 = [base[0] + o[0] * 0.24, 0.14, base[2] + o[2] * 0.24];
      const ankle: Vec3 = [knee[0] + o[0] * 0.2, 0.12, knee[2] + o[2] * 0.2];
      const foot: Vec3 = [ankle[0] + o[0] * 0.13, -0.1, ankle[2] + o[2] * 0.13];
      parts.push(limb(base, knee, 0.045, CRAB, 0.25, off), limb(knee, ankle, 0.038, CRAB, 0.18, off), limb(ankle, foot, 0.028, CRAB, 0.1, off));
      parts.push({ shape: 'sphere', size: [0.05, 0, 0], pos: knee, color: CRAB_LIGHT, mass: 0.03, detachAt: off }, { shape: 'sphere', size: [0.042, 0, 0], pos: ankle, color: CRAB_LIGHT, mass: 0.03, detachAt: off });
      parts.push(spike(foot, [o[0] * 0.4, -1, o[2] * 0.4], 0.024, 0.07, CRAB_SPINE, 0.01, off));
    }
    // The claws, forward: an arm up to an elbow, the palm, and its two fingers, the right one the bigger.
    const big = s > 0 ? 1.3 : 1, off = s > 0 ? 2 : undefined;
    const shoulder: Vec3 = [s * 0.1, 0.02, 0.16], elbow: Vec3 = [s * 0.2, 0.1, 0.29], wrist: Vec3 = [s * 0.21, 0.06, 0.42];
    const palm: Vec3 = [s * 0.2, 0.06, 0.42 + 0.12 * big];
    parts.push(limb(shoulder, elbow, 0.038, CRAB, 0.15), limb(elbow, wrist, 0.034, CRAB, 0.12, off), { shape: 'sphere', size: [0.042, 0, 0], pos: elbow, color: CRAB_LIGHT, mass: 0.03 });
    parts.push(limb(wrist, palm, 0.05 * big, CRAB, 0.2 * big, off));
    parts.push(spike(palm, [-s * 0.25, -0.1, 1], 0.026 * big, 0.11 * big, CRAB_SPINE, 0.03, off), spike([palm[0], palm[1] + 0.03 * big, palm[2]], [-s * 0.1, 0.45, 1], 0.02 * big, 0.09 * big, CRAB_SPINE, 0.02, off));
  }
  return {
    id: 'kingCrab',
    name: '帝王蟹',
    value: 800,
    threshold: 5.5,
    maxHit: 32,
    give: 14,
    crush: 0.2,
    salvage: 0.2,
    friction: 0.8,
    parts,
    // Broken, the carapace and its legs torn off it, a claw.
    debris: [
      { shape: 'dome', size: [0.2, 0, 0], flat: 0.5, pos: [0, 0.05, 0], color: CRAB, mass: 2 },
      ...[0, 1, 2, 3, 4].map((i): PartDesc => limb([Math.sin(i * 1.3) * 0.25, 0, Math.cos(i * 1.3) * 0.25], [Math.sin(i * 1.3 + 0.4) * 0.5, 0.02, Math.cos(i * 1.3 + 0.4) * 0.5], 0.04, CRAB, 0.3)),
      limb([0.15, 0, 0.3], [0.2, 0, 0.5], 0.06, CRAB_LIGHT, 0.4),
    ],
    burst: 'shell',
  };
}

/**
 * Balls of changing size laid close along a line, so close that their outline is smooth: a body drawn out of a run of them.
 * `at` is where along it, 0 to 1, and how big there. All but the ones at `solid` are only drawn.
 */
function run(from: Vec3, to: Vec3, at: number[][], step: number, look: Omit<PartDesc, 'shape' | 'size' | 'pos'>, solid: number[] = []): PartDesc[] {
  const parts: PartDesc[] = [];
  for (let k = 0; k < at.length - 1; k++) for (let t = 0; t < 1 - 1e-6; t += step) {
    const s = at[k][0] + (at[k + 1][0] - at[k][0]) * t, r = at[k][1] + (at[k + 1][1] - at[k][1]) * t;
    parts.push({ ...look, shape: 'sphere', size: [r, 0, 0], pos: [from[0] + (to[0] - from[0]) * s, from[1] + (to[1] - from[1]) * s, from[2] + (to[2] - from[2]) * s], ghost: t !== 0 || !solid.includes(k) });
  }
  return parts;
}

/** A flat triangle lying in x-z, pointing along (dx, dz): a fin. */
function fin(pos: Vec3, dx: number, dz: number, r: number, color: number, mass: number, detachAt?: 1 | 2): PartDesc {
  return { shape: 'cylinder', sides: 3, size: [r, 0.004, 0], pos, rot: [0, Math.atan2(dx, dz), 0], color, mass, detachAt };
}

/**
 * A big octopus, fresh off the boat: a smooth round head leaning back over golden eyes, mottled red-purple, and eight arms
 * laid out over the floor all round it, waving, tapering, curled over at their tips, with the pale suckers along them. All
 * arms, each going its own way: anything knocks it about, and it comes down in a tangle. The suckers hold it where it lies.
 * The arms come off one by one; burst, it is ink everywhere.
 */
function octopus(): CargoType {
  const skin = { color: WHITE, texture: 'octopus' as const, mass: 0.1 };
  const parts: PartDesc[] = [
    // The head, leaning back from over the eyes.
    ...run([0, 0.03, 0.04], [0, 0.25, -0.24], [[0, 0.12], [0.2, 0.15], [0.45, 0.165], [0.7, 0.15], [0.9, 0.11], [1, 0.06]], 0.25, skin, [1, 3]),
  ];
  // The eyes, each a bulge with a gold eye in it, slit across.
  for (const s of [-1, 1]) {
    parts.push({ shape: 'sphere', size: [0.05, 0, 0], pos: [s * 0.085, 0.07, 0.1], color: WHITE, texture: 'octopus', mass: 0.05, ghost: true });
    parts.push({ shape: 'sphere', size: [0.03, 0, 0], pos: [s * 0.1, 0.085, 0.125], color: 0xe0c060, mass: 0.01, ghost: true });
    parts.push({ shape: 'box', size: [0.02, 0.004, 0.005], pos: [s * 0.108, 0.088, 0.152], rot: [0, s * 0.5, 0], color: 0x15121a, mass: 0.005, ghost: true });
  }
  for (let k = 0; k < 8; k++) {
    // Each arm down off the body onto the floor and out over it, in nine lengths, thinner each time, waving, curled over at
    // the tip one way or the other.
    const a0 = (k / 8) * Math.PI * 2 + Math.PI / 8, curl = k % 2 ? 1 : -1;
    const at = (i: number): Vec3 => {
      const s = i / 9, r = 0.07 + s * 0.4 - Math.max(0, s - 0.75) * 0.3;
      const a = a0 + Math.sin(s * 4 + k) * 0.13 + curl * Math.max(0, s - 0.65) ** 2 * 5;
      return [Math.sin(a) * r, -0.02 - Math.min(s * 4, 1) * 0.06 + Math.max(0, s - 0.85) * 0.2, Math.cos(a) * r];
    };
    const off = k % 2 ? 1 : 2;
    // Torn, an arm loses its end, the last two lengths of it.
    for (let i = 0; i < 9; i++) parts.push({ ...limb(at(i), at(i + 1), 0.068 - i * 0.0058, WHITE, 0.12, i >= 7 ? off : undefined), texture: 'sucker' });
  }
  const beast: CargoType = {
    id: 'octopus',
    name: '大章魚',
    value: 800,
    threshold: 5.5,
    maxHit: 32,
    give: 14,
    crush: 0.2,
    salvage: 0.2,
    friction: 1,
    leaks: true,
    parts,
    // The head, and arms torn off it.
    debris: [
      { shape: 'sphere', size: [0.15, 0, 0], pos: [0, 0.1, -0.1], color: WHITE, texture: 'octopus', mass: 1.5 },
      ...[0, 1, 2, 3].map((i): PartDesc => ({ ...limb([Math.sin(i * 1.6) * 0.2, -0.05, Math.cos(i * 1.6) * 0.2], [Math.sin(i * 1.6 + 0.5) * 0.45, -0.07, Math.cos(i * 1.6 + 0.5) * 0.45], 0.045, WHITE, 0.4), texture: 'sucker' as const })),
    ],
    burst: 'ink',
  };
  // Drawn at a common size and made a third bigger again: a big one, its arms the width of the bed between their tips.
  const k = 1.3;
  const sized = (p: PartDesc): PartDesc => ({ ...p, size: [p.size[0] * k, p.size[1] * k, p.size[2] * k], pos: [p.pos[0] * k, p.pos[1] * k, p.pos[2] * k], mass: p.mass * 1.5 });
  return { ...beast, parts: beast.parts.map(sized), debris: beast.debris!.map(sized) };
}

const MAHI_GREEN = 0x2f9a6a, MAHI_BLUE = 0x2a5aa8, MAHI_FIN = 0xf0d040, MAHI_BELLY = 0xf2ecc0;

/**
 * A mahi-mahi, the gold fish of the east coast's boats, fresh, lying on its side: a steep blunt forehead, gold flanks
 * flecked with blue, green along the back and pale along the belly, a blue fin the length of its back, a deep-forked yellow
 * tail. Flat and slippery and only twenty-odd kilos: it slides about the bed at every turn.
 */
function mahi(): CargoType {
  // Lying on its left side, flat in y: its back toward -x, its belly toward +x, head toward +z.
  const SPINE = [[0.55, 0.07], [0.5, 0.15], [0.42, 0.19], [0.3, 0.2], [0.15, 0.19], [0, 0.17], [-0.15, 0.14], [-0.28, 0.1], [-0.38, 0.07], [-0.45, 0.05]];
  const parts: PartDesc[] = [];
  for (let k = 0; k < SPINE.length - 1; k++) for (let t = 0; t < 1 - 1e-6; t += 0.25) {
    const z = SPINE[k][0] + (SPINE[k + 1][0] - SPINE[k][0]) * t, r = SPINE[k][1] + (SPINE[k + 1][1] - SPINE[k][1]) * t;
    parts.push(
      { shape: 'sphere', size: [r, 0, 0], flat: 0.45, pos: [0, 0, z], color: WHITE, texture: 'mahi', mass: r * 3 },
      { shape: 'sphere', size: [r * 0.8, 0, 0], flat: 0.5, pos: [-r * 0.32, 0, z], color: MAHI_GREEN, mass: r * 2 },
      { shape: 'sphere', size: [r * 0.72, 0, 0], flat: 0.48, pos: [r * 0.34, 0, z], color: MAHI_BELLY, mass: r },
    );
  }
  // The fin the length of its back, tall over the forehead and lower to the tail, swept back; the one under it to the tail;
  // the deep-forked tail; the pectoral fin on the upper flank.
  // Each a membrane between one point of the outline and the next, as tall as the fin is there, and a ragged edge on it.
  const membrane = (from: number, to: number, side: -1 | 1, tall: (i: number) => number) => {
    for (let i = from; i < to; i++) {
      const off = i % 3 === 0 ? undefined : i % 3 === 1 ? 1 : 2;
      const [z1, r1] = SPINE[i], [z2, r2] = SPINE[i + 1], h = tall(i - from), dx = side * (r2 - r1), dz = z2 - z1;
      parts.push({ shape: 'box', size: [h / 2, 0.003, Math.hypot(dx, dz) / 2 + 0.01], pos: [side * ((r1 + r2) / 2 + h / 2 - 0.01), 0, (z1 + z2) / 2], rot: [0, Math.atan2(dx, dz), 0], color: MAHI_BLUE, mass: 0.03, detachAt: off });
      parts.push(fin([side * ((r1 + r2) / 2 + h - 0.015), 0, (z1 + z2) / 2], side * 0.8, -0.6, 0.035, MAHI_BLUE, 0.01, off));
    }
  };
  membrane(1, 9, -1, (i) => 0.1 - i * 0.008);
  membrane(5, 9, 1, () => 0.05);
  parts.push({ shape: 'sphere', size: [0.045, 0, 0], flat: 0.5, pos: [0, 0, -0.48], color: MAHI_FIN, mass: 0.1 });
  for (const side of [-1, 1]) parts.push(fin([side * 0.075, 0, -0.58], side * 0.55, -0.83, 0.15, MAHI_FIN, 0.1, side > 0 ? 2 : 1));
  parts.push(fin([0.03, 0.088, 0.3], 0.2, -1, 0.07, MAHI_FIN, 0.02, 1));
  // The eye, ringed, and the mouth.
  parts.push({ shape: 'cylinder', size: [0.028, 0.005, 0], pos: [0, 0.074, 0.46], color: 0xf2eedc, mass: 0.01 }, { shape: 'cylinder', size: [0.016, 0.005, 0], pos: [0, 0.078, 0.46], color: 0x101216, mass: 0.01 });
  parts.push({ shape: 'box', size: [0.035, 0.004, 0.006], pos: [0.03, 0.03, 0.6], rot: [0, -0.4, 0], color: 0x3a3020, mass: 0.005 });
  return {
    id: 'mahi',
    name: '鬼頭刀',
    value: 400,
    threshold: 6,
    maxHit: 30,
    give: 14,
    crush: 0.25,
    salvage: 0.3,
    friction: 0.3,
    slick: true,
    hull: { shape: 'box', size: [0.21, 0.09, 0.66] },
    parts,
    // Broken across in two, red where it broke, and the tail on its own.
    debris: [
      { shape: 'sphere', size: [0.17, 0, 0], scale: [1, 0.45, 2], pos: [0, 0, 0.3], color: WHITE, texture: 'mahi', mass: 6 },
      { shape: 'sphere', size: [0.12, 0, 0], scale: [1, 0.5, 2.4], pos: [0, 0, -0.2], color: WHITE, texture: 'mahi', mass: 5 },
      { shape: 'box', size: [0.1, 0.05, 0.03], pos: [0.02, 0, 0.12], rot: [0.3, 0.4, 0], color: 0xc8484a, mass: 0.5 },
      fin([0, 0, -0.45], 0, -1, 0.15, MAHI_FIN, 0.3),
    ],
    burst: 'ice',
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
  washer: washer(),
  sack: sack(),
  soda: soda(),
  toilet: toilet(),
  paintRed: paint('paintRed', 0xc8372d, 'paintRed'),
  paintBlue: paint('paintBlue', 0x2f62a8, 'paintBlue'),
  paintYellow: paint('paintYellow', 0xe0b020, 'paintYellow'),
  rebar: rebar(),
  amp: amp(),
  bicycle: bicycle(),
  aircon: aircon(),
  stockpot: stockpot(),
  riceCooker: riceCooker(),
  lightbox: lightbox(),
  megaphone: megaphone(),
  toolbox: toolbox(),
  radio: radio(),
  tuna: tuna(),
  anchor: anchor(),
  cabbage: cabbage(),
  noodles: noodles(),
  kingCrab: kingCrab(),
  octopus: octopus(),
  mahi: mahi(),
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
