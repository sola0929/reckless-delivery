import type { Vec3 } from '../config';

// Street furniture and clutter: things that stand about until something hits them, and then
// go flying. Each is one loose rigid body built from a few simple parts.

export interface ObjectPart {
  shape: 'box' | 'cylinder' | 'cone';
  /** box: half extents. cylinder / cone: [radius, halfHeight, unused]. */
  size: Vec3;
  /** Relative to the object's origin, which is at ground level under its middle. */
  pos: Vec3;
  /** Euler XYZ, radians. */
  rot?: Vec3;
  color: number;
  /** Drawn but not solid: a tree's crown, a canopy. */
  ghost?: boolean;
  /** Its share of the object's mass, relative to the other solid parts. Defaults to 1. */
  weight?: number;
}

/** What is thrown up when the object is first knocked. */
export type KnockEffect = 'leaves' | 'water' | 'splinters' | 'sparks';

export interface ObjectKind {
  mass: number;
  parts: ObjectPart[];
  effect?: KnockEffect;
  /** Keeps spouting for a while from where it stood, like a broken hydrant. */
  geyser?: boolean;
}

const WOOD = 0x9a7448;
const STEEL = 0x8e9499;
const DARK = 0x3a3f46;

const box = (size: Vec3, pos: Vec3, color: number, extra: Partial<ObjectPart> = {}): ObjectPart => ({ shape: 'box', size, pos, color, ...extra });
const cyl = (radius: number, halfHeight: number, pos: Vec3, color: number, extra: Partial<ObjectPart> = {}): ObjectPart =>
  ({ shape: 'cylinder', size: [radius, halfHeight, 0], pos, color, ...extra });
const cone = (radius: number, halfHeight: number, pos: Vec3, color: number, extra: Partial<ObjectPart> = {}): ObjectPart =>
  ({ shape: 'cone', size: [radius, halfHeight, 0], pos, color, ...extra });

/** A heavy foot. Anything tall and thin needs one, or it falls over as soon as it is set down. */
const foot = (radius: number, color: number): ObjectPart => cyl(radius, 0.05, [0, 0.05, 0], color, { weight: 8 });

function tree(crown: number, color: number): ObjectKind {
  return {
    // Heavy enough to check the truck: a tree is the one thing on the pavement worth steering round.
    mass: Math.round(900 * crown),
    effect: 'leaves',
    parts: [foot(0.34, 0x5a3f28), cyl(0.18, 1.3, [0, 1.3, 0], 0x6b4a2e), cone(crown, crown * 1.2, [0, 2.6 + crown * 0.9, 0], color, { ghost: true })],
  };
}

function stall(awning: number): ObjectKind {
  return {
    mass: 420,
    effect: 'splinters',
    parts: [
      box([1.1, 0.42, 0.7], [0, 0.42, 0], WOOD),
      cyl(0.05, 1.25, [1.0, 1.25, 0.6], DARK, { ghost: true }),
      cyl(0.05, 1.25, [-1.0, 1.25, 0.6], DARK, { ghost: true }),
      cyl(0.05, 1.25, [1.0, 1.25, -0.6], DARK, { ghost: true }),
      cyl(0.05, 1.25, [-1.0, 1.25, -0.6], DARK, { ghost: true }),
      box([1.35, 0.05, 0.95], [0, 2.5, 0], awning, { ghost: true }),
    ],
  };
}

const crate = (color: number): ObjectKind => ({ mass: 12, effect: 'splinters', parts: [box([0.22, 0.2, 0.22], [0, 0.2, 0], color)] });

export const OBJECT_KINDS = {
  tree: tree(1.3, 0x4f8a4a),
  treeTall: tree(1.6, 0x447d44),
  treeSmall: tree(1.0, 0x5d9a52),
  lamp: {
    mass: 400,
    effect: 'sparks',
    parts: [
      foot(0.3, DARK),
      cyl(0.07, 2.3, [0, 2.3, 0], DARK),
      box([0.08, 0.05, 0.5], [0, 4.55, 0.45], DARK, { ghost: true }),
      box([0.14, 0.06, 0.22], [0, 4.48, 0.85], 0xfff2c0, { ghost: true }),
    ],
  },
  signStop: { mass: 35, parts: [foot(0.22, STEEL), cyl(0.05, 1.1, [0, 1.1, 0], STEEL), cyl(0.32, 0.03, [0, 2.3, 0], 0xc8372d, { rot: [Math.PI / 2, 0, 0] })] },
  signBlue: { mass: 35, parts: [foot(0.22, STEEL), cyl(0.05, 1.1, [0, 1.1, 0], STEEL), box([0.3, 0.3, 0.03], [0, 2.3, 0], 0x2f6fc8)] },
  signWarn: { mass: 35, parts: [foot(0.22, STEEL), cyl(0.05, 1.1, [0, 1.1, 0], STEEL), box([0.3, 0.3, 0.03], [0, 2.3, 0], 0xe0b020, { rot: [0, 0, Math.PI / 4] })] },
  cone: { mass: 3, parts: [cone(0.3, 0.45, [0, 0.45, 0], 0xff6a1a)] },
  bin: { mass: 20, parts: [cyl(0.3, 0.45, [0, 0.45, 0], 0x3f7a4a), cyl(0.32, 0.04, [0, 0.92, 0], DARK)] },
  bench: {
    mass: 70,
    effect: 'splinters',
    parts: [box([0.9, 0.04, 0.24], [0, 0.45, 0], WOOD), box([0.9, 0.22, 0.03], [0, 0.72, -0.22], WOOD), box([0.05, 0.22, 0.2], [0.75, 0.22, 0], DARK), box([0.05, 0.22, 0.2], [-0.75, 0.22, 0], DARK)],
  },
  hydrant: { mass: 90, effect: 'water', geyser: true, parts: [cyl(0.14, 0.32, [0, 0.32, 0], 0xd0392c), cyl(0.18, 0.05, [0, 0.69, 0], 0xb02a20)] },
  mailbox: { mass: 45, parts: [foot(0.22, DARK), cyl(0.05, 0.4, [0, 0.4, 0], DARK), box([0.22, 0.3, 0.2], [0, 1.1, 0], 0x2f5fb8)] },
  barrel: { mass: 40, parts: [cyl(0.4, 0.55, [0, 0.55, 0], 0x3b7dd8)] },
  barrier: { mass: 14, parts: [box([1.4, 0.4, 0.1], [0, 0.55, 0], 0xf2c230), box([0.06, 0.3, 0.35], [1.1, 0.3, 0], DARK), box([0.06, 0.3, 0.35], [-1.1, 0.3, 0], DARK)] },
  fence: { mass: 10, effect: 'splinters', parts: [box([1.0, 0.5, 0.04], [0, 0.55, 0], 0xd08a2e), box([0.05, 0.6, 0.05], [0.9, 0.6, 0], DARK), box([0.05, 0.6, 0.05], [-0.9, 0.6, 0], DARK)] },
  bollard: { mass: 40, parts: [cyl(0.1, 0.45, [0, 0.45, 0], 0xd9d9d9)] },
  post: { mass: 35, parts: [cyl(0.12, 0.5, [0, 0.5, 0], 0xd9d9d9)] },
  /** The bar of a barrier gate or a level crossing; rests across two posts. */
  gateArm: { mass: 8, effect: 'splinters', parts: [box([3.4, 0.06, 0.06], [0, 0.06, 0], 0xe03a2a)] },
  toilet: { mass: 150, parts: [box([0.6, 1.1, 0.6], [0, 1.1, 0], 0x3a8fd0), box([0.63, 0.05, 0.63], [0, 2.25, 0], 0xe8e8e8)] },
  box: { mass: 4, parts: [box([0.3, 0.3, 0.3], [0, 0.3, 0], 0xc9a26b)] },
  pallet: { mass: 18, effect: 'splinters', parts: [box([0.6, 0.07, 0.5], [0, 0.07, 0], WOOD)] },
  crateOrange: crate(0xe8892a),
  crateRed: crate(0xc8443a),
  crateGreen: crate(0x6a9a3a),
  crateYellow: crate(0xe0c341),
  stallRed: stall(0xc8443a),
  stallBlue: stall(0x3a7fc8),
  stallYellow: stall(0xe0b020),
  stallGreen: stall(0x4a9a5a),
  table: { mass: 25, parts: [foot(0.3, DARK), cyl(0.45, 0.03, [0, 0.72, 0], 0xe8e8e8), cyl(0.05, 0.35, [0, 0.35, 0], DARK)] },
  chair: { mass: 4, parts: [box([0.2, 0.03, 0.2], [0, 0.42, 0], 0xc8443a), box([0.2, 0.2, 0.03], [0, 0.65, -0.18], 0xc8443a), box([0.18, 0.2, 0.18], [0, 0.2, 0], DARK)] },
  umbrella: { mass: 25, parts: [foot(0.32, DARK), cyl(0.04, 1.2, [0, 1.2, 0], DARK), cone(1.2, 0.3, [0, 2.5, 0], 0xe8e2d0, { ghost: true })] },
} satisfies Record<string, ObjectKind>;

export type ObjectKindId = keyof typeof OBJECT_KINDS;

/** One object placed in a level. */
export interface ObjectDesc {
  kind: ObjectKindId;
  /** Where its base sits: [x, y, z], y being the height of the ground there. */
  pos: Vec3;
  rotY?: number;
}
