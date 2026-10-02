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
export type KnockEffect = 'leaves' | 'water' | 'splinters' | 'sparks' | 'feathers';

export interface ObjectKind {
  mass: number;
  parts: ObjectPart[];
  effect?: KnockEffect;
  /** Keeps spouting for a while from where it stood, like a broken hydrant. */
  geyser?: boolean;
  /** The colour of what it is full of. Run into, it bursts all over the truck, windscreen included. */
  juice?: number;
  /** Goes off a moment after it is knocked, and throws everything near it. */
  explosive?: boolean;
  /** Goes on banging and flashing for a while where it stood: a string of firecrackers. */
  crackle?: boolean;
  /**
   * How it looks once it has been hit hard: the same parts, one for one, moved, turned or
   * shrunk to nothing. Only the look changes; it is still one solid body.
   */
  wrecked?: ObjectPart[];
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

/**
 * A market stall: a counter in two halves, four poles and an awning. Hit hard, it folds up:
 * the counter breaks in the middle, the poles go over, and the awning is gone (the pieces
 * that fly off are drawn separately).
 */
function stall(awning: number): ObjectKind {
  const pole = (x: number, z: number): ObjectPart => cyl(0.05, 1.25, [x, 1.25, z], DARK, { ghost: true });
  // A pole lying where it fell, pointing outward.
  const fallen = (x: number, z: number, turn: number): ObjectPart => cyl(0.05, 1.1, [x, 0.5, z], DARK, { ghost: true, rot: [1.35, turn, 0] });
  return {
    mass: 420,
    effect: 'splinters',
    parts: [
      box([0.55, 0.42, 0.7], [-0.55, 0.42, 0], WOOD),
      box([0.55, 0.42, 0.7], [0.55, 0.42, 0], WOOD),
      pole(1.0, 0.6), pole(-1.0, 0.6), pole(1.0, -0.6), pole(-1.0, -0.6),
      box([1.35, 0.05, 0.95], [0, 2.5, 0], awning, { ghost: true }),
    ],
    wrecked: [
      box([0.55, 0.42, 0.7], [-0.62, 0.3, 0.05], 0x7a5a36, { rot: [0.12, 0.2, 0.42] }),
      box([0.55, 0.42, 0.7], [0.66, 0.26, -0.08], 0x7a5a36, { rot: [-0.1, -0.25, -0.5] }),
      fallen(1.3, 0.9, 0.6), fallen(-1.4, 0.7, -0.9), fallen(1.2, -1.0, 2.4), fallen(-1.1, -1.1, 3.6),
      box([0, 0, 0], [0, 0.4, 0], awning, { ghost: true }),
    ],
  };
}

/**
 * A scooter on its stand. They are parked in rows along every kerb, close enough together
 * that knocking one over takes its neighbours with it.
 */
function scooter(color: number): ObjectKind {
  const tyre = 0x1c1d20;
  return {
    mass: 110,
    effect: 'sparks',
    parts: [
      // The footboard and tail, low down and carrying most of the weight, and the seat on
      // top of it. The shield and the handlebars are for show: thin things like those catch
      // on the truck's nose.
      box([0.17, 0.13, 0.6], [0, 0.4, -0.08], color, { weight: 5 }),
      box([0.15, 0.05, 0.3], [0, 0.71, -0.3], 0x24262a),
      // The stand it is propped on: without it, two wheels in line hold nothing up.
      box([0.21, 0.03, 0.1], [0, 0.03, -0.22], DARK, { weight: 3 }),
      // The leg shield, the headlamp on it, and the handlebars across the top.
      box([0.16, 0.27, 0.05], [0, 0.66, 0.42], color, { rot: [-0.22, 0, 0], ghost: true }),
      box([0.09, 0.05, 0.03], [0, 0.86, 0.5], 0xfff2c0, { ghost: true }),
      box([0.29, 0.03, 0.04], [0, 0.99, 0.37], DARK, { ghost: true }),
      cyl(0.22, 0.06, [0, 0.22, 0.62], tyre, { rot: [0, 0, Math.PI / 2] }),
      cyl(0.22, 0.07, [0, 0.22, -0.52], tyre, { rot: [0, 0, Math.PI / 2] }),
    ],
  };
}

const FRUIT_WOOD = 0xa9854f;

/**
 * A fruit stall: a counter stacked with one kind of fruit, under a parasol. Run into, it
 * goes everywhere, and what it was selling is all over the truck.
 */
function fruitStall(fruit: number, leaf: number, shade: number): ObjectKind {
  const heap = (x: number, y: number, z: number, color: number): ObjectPart => box([0.2, 0.13, 0.17], [x, y, z], color, { ghost: true });
  const spilt = (x: number, z: number, color: number): ObjectPart => box([0.2, 0.13, 0.17], [x, 0.13, z], color, { ghost: true, rot: [0.4, x, 0.3] });
  return {
    mass: 260,
    effect: 'splinters',
    juice: fruit,
    parts: [
      box([1.05, 0.38, 0.55], [0, 0.38, 0], FRUIT_WOOD),
      heap(-0.7, 0.9, 0.2, fruit), heap(-0.23, 0.9, 0.2, fruit), heap(0.23, 0.9, 0.2, leaf), heap(0.7, 0.9, 0.2, fruit),
      heap(-0.47, 1.12, -0.15, fruit), heap(0, 1.12, -0.15, fruit), heap(0.47, 1.12, -0.15, leaf),
      cyl(0.04, 1.3, [0, 1.3, -0.5], DARK, { ghost: true }),
      cone(1.5, 0.28, [0, 2.75, -0.2], shade, { ghost: true }),
    ],
    wrecked: [
      box([1.05, 0.38, 0.55], [0.1, 0.3, 0], 0x8a6a40, { rot: [0.1, 0.3, 0.45] }),
      spilt(-1.3, 0.8, fruit), spilt(-0.6, 1.2, fruit), spilt(0.4, 1.4, leaf), spilt(1.2, 0.9, fruit),
      spilt(-0.9, -0.9, fruit), spilt(0.2, -1.2, fruit), spilt(1.1, -0.8, leaf),
      cyl(0.04, 1.2, [0.9, 0.4, -0.9], DARK, { ghost: true, rot: [1.4, 0.8, 0] }),
      box([0, 0, 0], [0, 0.4, 0], shade, { ghost: true }),
    ],
  };
}

/**
 * A snack cart: a steel box on wheels with a pan on top, a glass case of whatever is being
 * fried, and a roof over it on four posts.
 */
function snackCart(roof: number): ObjectKind {
  const post = (x: number, z: number): ObjectPart => cyl(0.03, 0.55, [x, 1.5, z], DARK, { ghost: true });
  return {
    mass: 190,
    effect: 'sparks',
    parts: [
      box([0.8, 0.38, 0.45], [0, 0.57, 0], 0xb9c0c6),
      cyl(0.2, 0.05, [-0.6, 0.2, 0.47], 0x1c1d20, { rot: [Math.PI / 2, 0, 0] }),
      cyl(0.2, 0.05, [0.6, 0.2, 0.47], 0x1c1d20, { rot: [Math.PI / 2, 0, 0] }),
      cyl(0.2, 0.05, [-0.6, 0.2, -0.47], 0x1c1d20, { rot: [Math.PI / 2, 0, 0] }),
      cyl(0.2, 0.05, [0.6, 0.2, -0.47], 0x1c1d20, { rot: [Math.PI / 2, 0, 0] }),
      cyl(0.24, 0.1, [-0.4, 1.05, 0], 0x4a4f57, { ghost: true }),
      box([0.36, 0.22, 0.32], [0.38, 1.17, 0], 0xbfd6dc, { ghost: true }),
      post(-0.75, 0.4), post(0.75, 0.4), post(-0.75, -0.4), post(0.75, -0.4),
      box([0.95, 0.05, 0.6], [0, 2.08, 0], roof, { ghost: true }),
    ],
    wrecked: [
      box([0.8, 0.38, 0.45], [0, 0.42, 0], 0x9aa2a8, { rot: [0.5, 0.2, 0.2] }),
      cyl(0.2, 0.05, [-0.9, 0.06, 0.9], 0x1c1d20),
      cyl(0.2, 0.05, [0.8, 0.2, 0.47], 0x1c1d20, { rot: [Math.PI / 2, 0, 0] }),
      cyl(0.2, 0.05, [-0.7, 0.2, -0.5], 0x1c1d20, { rot: [Math.PI / 2, 0.4, 0] }),
      cyl(0.2, 0.05, [1.1, 0.06, -1.0], 0x1c1d20),
      cyl(0.24, 0.1, [-1.1, 0.1, -0.3], 0x4a4f57, { ghost: true }),
      box([0.36, 0.22, 0.32], [0.9, 0.22, -0.6], 0xbfd6dc, { ghost: true, rot: [0.3, 0.6, 0.2] }),
      cyl(0.03, 0.55, [-0.9, 0.05, 0.3], DARK, { ghost: true, rot: [1.5, 0.3, 0] }),
      cyl(0.03, 0.55, [1.0, 0.05, 0.6], DARK, { ghost: true, rot: [1.5, 1.2, 0] }),
      cyl(0.03, 0.55, [-0.5, 0.05, -0.8], DARK, { ghost: true, rot: [1.5, 2.2, 0] }),
      cyl(0.03, 0.55, [0.7, 0.05, -0.9], DARK, { ghost: true, rot: [1.5, 3.3, 0] }),
      box([0, 0, 0], [0, 0.4, 0], roof, { ghost: true }),
    ],
  };
}

/**
 * A banquet tent, of the kind put up in the street for a temple feast: striped canvas on
 * four poles, each pole in a block of concrete. Only the blocks are solid.
 */
function tent(): ObjectKind {
  const half: [number, number] = [2.5, 1.9];
  const corners: [number, number][] = [[-half[0], -half[1]], [half[0], -half[1]], [-half[0], half[1]], [half[0], half[1]]];
  const stripes = [0xc8372d, 0xf0ece2, 0x2f62a8, 0xf0ece2, 0xc8372d];
  const strip = (i: number, size: Vec3): ObjectPart => box(size, [(i - 2) * 1.06, 2.75, 0], stripes[i], { ghost: true });
  return {
    mass: 240,
    effect: 'splinters',
    parts: [
      ...corners.map(([x, z]) => box([0.18, 0.15, 0.18], [x, 0.15, z], 0x8b8f92)),
      ...corners.map(([x, z]) => cyl(0.045, 1.3, [x, 1.45, z], 0xc9ced2, { ghost: true })),
      ...stripes.map((_, i) => strip(i, [0.53, 0.04, half[1] + 0.2])),
      // A valance round the edge, in the colour that flies off when the tent comes down.
      box([half[0] + 0.2, 0.14, 0.03], [0, 2.62, half[1] + 0.2], 0xc8372d, { ghost: true }),
      box([half[0] + 0.2, 0.14, 0.03], [0, 2.62, -half[1] - 0.2], 0xc8372d, { ghost: true }),
    ],
    wrecked: [
      ...corners.map(([x, z]) => box([0.18, 0.15, 0.18], [x, 0.15, z], 0x8b8f92)),
      ...corners.map(([x, z], i) => cyl(0.045, 1.3, [x * 0.8, 0.2, z * 0.7], 0xc9ced2, { ghost: true, rot: [1.45, i * 1.7, 0] })),
      // The canvas down in a heap over whatever was under it.
      ...stripes.map((_, i) => box([0.5, 0.03, half[1] * 0.8], [(i - 2) * 0.9, 0.5 + (i % 2) * 0.25, (i % 3) * 0.3 - 0.3], stripes[i], { ghost: true, rot: [0.25 - i * 0.12, 0.2 * i, 0.3 - i * 0.14] })),
      box([0, 0, 0], [0, 0.4, 0], 0xc8372d, { ghost: true }),
      box([0, 0, 0], [0, 0.4, 0], 0xc8372d, { ghost: true }),
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
  fruitOrange: fruitStall(0xf08a24, 0xf2a53a, 0x3f8f5a),
  fruitTomato: fruitStall(0xd8342c, 0xe0503a, 0xf0ece2),
  fruitMelon: fruitStall(0xe2485a, 0x3f8a48, 0xe0a020),
  fruitGrape: fruitStall(0x7a3fa0, 0x8f5ab8, 0xf0ece2),
  fruitMango: fruitStall(0xf2b21e, 0xf0c94a, 0xc8372d),
  snackCartRed: snackCart(0xc8372d),
  snackCartYellow: snackCart(0xe8b82e),
  /** A cylinder of gas, as stands beside every stove in the street: red, with a white band, to be seen in time. */
  gasCylinder: {
    mass: 36,
    explosive: true,
    parts: [
      cyl(0.21, 0.42, [0, 0.42, 0], 0xd8302a),
      cyl(0.215, 0.07, [0, 0.62, 0], 0xf2efe6, { ghost: true }),
      cyl(0.14, 0.06, [0, 0.9, 0], 0xd8302a),
      cyl(0.1, 0.06, [0, 1.02, 0], 0x2a2e33, { ghost: true }),
    ],
  },
  /** A rail of clothes for sale. */
  clothesRack: {
    mass: 28,
    parts: [
      box([0.9, 0.03, 0.25], [0, 0.03, 0], DARK, { weight: 6 }),
      cyl(0.03, 0.75, [-0.85, 0.78, 0], STEEL, { ghost: true }), cyl(0.03, 0.75, [0.85, 0.78, 0], STEEL, { ghost: true }),
      box([0.9, 0.025, 0.025], [0, 1.52, 0], STEEL, { ghost: true }),
      ...[0xd85a4a, 0x5f8fd0, 0xf0c94a, 0x4f9f7a, 0xe89ab0, 0xf2f2ee].map((color, i) => box([0.11, 0.36, 0.2], [-0.68 + i * 0.27, 1.1, 0], color, { ghost: true })),
    ],
  },
  /** Fish on ice, and tubs of whatever is still alive. */
  fishStall: {
    mass: 170,
    effect: 'water',
    parts: [
      box([1.0, 0.33, 0.5], [0, 0.33, 0], 0x6f9fc0),
      box([0.95, 0.05, 0.45], [0, 0.71, 0], 0xeef3f5, { ghost: true }),
      box([0.18, 0.04, 0.08], [-0.5, 0.79, 0.1], 0xc9ced2, { ghost: true }), box([0.2, 0.04, 0.08], [0.1, 0.79, -0.1], 0xe07a5a, { ghost: true }), box([0.16, 0.04, 0.08], [0.6, 0.79, 0.15], 0xc9ced2, { ghost: true }),
      cyl(0.32, 0.2, [-0.6, 0.2, 0.95], 0x2f62a8), cyl(0.32, 0.2, [0.5, 0.2, 1.0], 0xc8372d),
    ],
  },
  /** Buckets of cut flowers. */
  flowerStall: {
    mass: 60,
    effect: 'leaves',
    parts: [
      box([0.9, 0.2, 0.4], [0, 0.2, 0], 0x7a6a52),
      ...[0xe2485a, 0xf2c12e, 0xf2f2ee, 0xe89ab0, 0x8f5ab8].flatMap((color, i) => [
        cyl(0.13, 0.16, [-0.68 + i * 0.34, 0.56, 0], 0x4a5058, { ghost: true }),
        cone(0.2, 0.2, [-0.68 + i * 0.34, 0.92, 0], color, { ghost: true }),
      ]),
    ],
  },
  /** A cage of hens on their way to market. */
  chickenCage: {
    mass: 22,
    effect: 'feathers',
    parts: [box([0.5, 0.28, 0.36], [0, 0.28, 0], 0xb99a62), box([0.14, 0.12, 0.14], [-0.2, 0.68, 0.05], 0xf2efe6, { ghost: true }), box([0.14, 0.12, 0.14], [0.2, 0.68, -0.05], 0xc98a4a, { ghost: true })],
  },
  paintWhite: { mass: 9, juice: 0xf2f2ec, parts: [cyl(0.17, 0.19, [0, 0.19, 0], 0xd8d8d2), cyl(0.15, 0.01, [0, 0.39, 0], 0xf2f2ec, { ghost: true })] },
  paintYellow: { mass: 9, juice: 0xf2c12e, parts: [cyl(0.17, 0.19, [0, 0.19, 0], 0xd8d8d2), cyl(0.15, 0.01, [0, 0.39, 0], 0xf2c12e, { ghost: true })] },
  paintBlue: { mass: 9, juice: 0x2f62a8, parts: [cyl(0.17, 0.19, [0, 0.19, 0], 0xd8d8d2), cyl(0.15, 0.01, [0, 0.39, 0], 0x2f62a8, { ghost: true })] },
  /** A round table laid for ten, at a feast in the street. */
  banquetTable: {
    mass: 38,
    parts: [
      foot(0.32, DARK), cyl(0.05, 0.35, [0, 0.38, 0], DARK),
      cyl(0.88, 0.03, [0, 0.75, 0], 0xc8372d),
      cyl(0.3, 0.02, [0, 0.8, 0], 0xf2efe6, { ghost: true }),
      ...[0, 1, 2, 3, 4].map((i) => cyl(0.13, 0.02, [Math.cos(i * 1.257) * 0.56, 0.8, Math.sin(i * 1.257) * 0.56], i % 2 ? 0xf2efe6 : 0xe8b82e, { ghost: true })),
    ],
  },
  stool: { mass: 3, parts: [cyl(0.16, 0.21, [0, 0.21, 0], 0xc8372d)] },
  tent: tent(),
  /** A string of firecrackers hung on a pole, waiting for the procession. */
  firecrackers: {
    mass: 16,
    effect: 'sparks',
    crackle: true,
    parts: [foot(0.22, DARK), cyl(0.035, 1.2, [0, 1.2, 0], 0x9a7448), box([0.3, 0.02, 0.02], [0.28, 2.36, 0], 0x9a7448, { ghost: true }), box([0.07, 0.6, 0.07], [0.52, 1.74, 0], 0xd0302a, { ghost: true })],
  },
  scooterRed: scooter(0xc8372d),
  scooterBlue: scooter(0x2f62a8),
  scooterWhite: scooter(0xe6e6e0),
  scooterBlack: scooter(0x33363b),
  scooterYellow: scooter(0xe8b82e),
  scooterTeal: scooter(0x3f9a94),
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
