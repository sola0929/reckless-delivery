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
  /** A lamp that flashes: lit and dark by turns. */
  flash?: boolean;
  /** A length of wire running off to the next pole: 1 for the one ahead, -1 for the one behind. */
  wire?: 1 | -1;
  /** How it lies once that wire has parted: hanging from the pole instead of reaching for the next. */
  slack?: Omit<ObjectPart, 'slack'>;
}

/** What is thrown up when the object is first knocked. */
export type KnockEffect = 'leaves' | 'water' | 'splinters' | 'sparks' | 'feathers' | 'toys' | 'straw' | 'grain' | 'bees' | 'dust' | 'bamboo' | 'paper' | 'ash' | 'shards' | 'rice';

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
  /** Set off by a wheel rolling over it, not only by being knocked; and when it goes, it sets off any like it close by, one after another. */
  trip?: boolean;
  /** How long after: seconds. A mine does not wait. */
  fuse?: number;
  /** What it is when it goes off, for whoever tells the player; and how hard, beside a cylinder of gas. */
  bang?: { kind: 'gas' | 'drum' | 'mine'; power: number };
  /** Left alone by other blasts: neither thrown by them nor set off. A mine stays where it was laid. */
  stable?: boolean;
  /** Goes on banging and flashing for a while where it stood: a string of firecrackers. */
  /** Goes off like firecrackers when knocked: for so many seconds, or for the usual time. */
  crackle?: boolean | number;
  /** Stands firm against the truck unless the truck is going at least this fast, m/s: a crash barrier. */
  sturdy?: number;
  /** Walks about within this many metres of where it was put, stopping now and then to peck: a hen. */
  wanders?: number;
  /** Startled by the truck coming within this many metres, going at any speed: it is off, flapping, before it is hit. */
  flee?: number;
  /** Lies flat in the road: the traffic drives over it, and other things pass over it too; only the truck and what falls on it move it. */
  underfoot?: boolean;
  /** Part of something put up in pieces, a scaffold: when one piece is knocked, those next to it come down a moment later, and theirs, until all of it is down. */
  collapse?: boolean;
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

/** A stall with its goods laid out on the counter: rows of little things in the trade's colours. */
function stocked(awning: number, goods: number[]): ObjectKind {
  const plain = stall(awning);
  const wares: ObjectPart[] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) wares.push(box([0.11, 0.08 + ((i + j) % 2) * 0.03, 0.11], [-0.82 + i * 0.55, 0.92, -0.45 + j * 0.45], goods[(i + j * 2) % goods.length], { ghost: true }));
  // And a crate of them on the ground in front.
  wares.push(box([0.24, 0.16, 0.2], [0.6, 0.16, 0.95], 0xa07a4a, { ghost: true }), box([0.2, 0.05, 0.16], [0.6, 0.35, 0.95], goods[0], { ghost: true }));
  return { ...plain, parts: [...plain.parts, ...wares] };
}

/** A striped canvas awning on four steel poles, four metres by five: knocked, the whole of it goes over. */
function awning(color: number): ObjectKind {
  const parts: ObjectPart[] = [];
  for (const x of [-2, 2]) for (const z of [-2.5, 2.5]) parts.push(cyl(0.05, 1.7, [x, 1.7, z], 0x8c9096));
  for (let k = 0; k < 4; k++) parts.push(box([0.5, 0.04, 2.55], [-1.5 + k, 3.42, 0], k % 2 ? color : 0xf2efe6, { ghost: true }));
  for (const z of [-2.55, 2.55]) parts.push(box([2.05, 0.18, 0.02], [0, 3.22, z], color, { ghost: true }));
  for (const x of [-2.05, 2.05]) parts.push(box([0.02, 0.18, 2.55], [x, 3.22, 0], color, { ghost: true }));
  return { mass: 45, parts };
}

/** A radio with a speaker either side, on a stool: playing loud. */
const RADIO: ObjectKind = { mass: 9, parts: [box([0.2, 0.25, 0.2], [0, 0.25, 0], 0x6e5a40), box([0.32, 0.14, 0.12], [0, 0.64, 0], 0x2a2e33), cyl(0.07, 0.01, [-0.18, 0.64, 0.12], 0x8c8a84, { ghost: true, rot: [Math.PI / 2, 0, 0] }), cyl(0.07, 0.01, [0.18, 0.64, 0.12], 0x8c8a84, { ghost: true, rot: [Math.PI / 2, 0, 0] })] };

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

/** How far it is from one power pole to the next, metres: they stand at the corners of the map's squares. */
export const POLE_SPACING = 16;

/**
 * A power pole. Its wires hang in a curve to half way to the next pole, `ahead` of it and
 * `behind`, where they meet the wires of that one; and they come down with it.
 */
function pole(ahead: boolean, behind: boolean): ObjectKind {
  const wire = 0x1c1d20;
  const half = POLE_SPACING / 2;
  /** One wire from the pole out to the middle of the span, in three straight lengths, each a little flatter than the last. */
  const hang = (x: number, top: number, sag: number, way: number): ObjectPart[] => {
    const drops = [0, 0.56, 0.89, 1].map((share) => top - sag * share);
    return [0, 1, 2].map((n) => {
      const length = half / 3;
      const fall = drops[n] - drops[n + 1];
      const size: Vec3 = [0.02, 0.02, Math.hypot(length, fall) / 2];
      // Parted, the first two lengths hang straight down from where they were made fast, swinging out a little, and the third is gone.
      const hanging: Omit<ObjectPart, 'slack'> = {
        shape: 'box', size: n < 2 ? size : [0, 0, 0], color: wire, ghost: true,
        pos: [x + way * 0.05 * n, top - length * (n + 0.5), way * (0.1 + 0.12 * n)], rot: [Math.PI / 2 - way * 0.05, 0, 0],
      };
      return box(size, [x, (drops[n] + drops[n + 1]) / 2, way * length * (n + 0.5)], wire, { ghost: true, rot: [way * Math.atan2(fall, length), 0, 0], wire: way as 1 | -1, slack: hanging });
    });
  };
  const ways = [...(ahead ? [1] : []), ...(behind ? [-1] : [])];
  return {
    mass: 700,
    effect: 'sparks',
    parts: [
      foot(0.34, 0x8a8880),
      cyl(0.14, 3.6, [0, 3.6, 0], 0x9a9892),
      box([0.95, 0.05, 0.05], [0, 6.7, 0], 0x6a5a48, { ghost: true }),
      ...[-0.85, 0, 0.85].map((x) => cyl(0.05, 0.09, [x, 6.84, 0], 0xe6e2d8, { ghost: true })),
      cyl(0.28, 0.4, [0.36, 5.3, 0], 0x8f979d, { ghost: true }),
      box([0.3, 0.04, 0.04], [0.2, 5.8, 0], 0x6a5a48, { ghost: true }),
      // Three thin wires along the top, and one thick cable slung lower down.
      ...ways.flatMap((way) => [-0.85, 0, 0.85].flatMap((x) => hang(x, 6.92, 0.5, way))),
      ...ways.flatMap((way) => hang(-0.18, 5.9, 0.6, way).map((part) => ({ ...part, size: [0.04, 0.04, part.size[2]] as Vec3, slack: { ...part.slack!, size: [part.slack!.size[2] ? 0.04 : 0, part.slack!.size[2] ? 0.04 : 0, part.slack!.size[2]] as Vec3 } }))),
    ],
  };
}

/**
 * One storey of one bay of a scaffold, as one piece: the frame at its near end (local -Z), the steel plank over it at the top
 * of the storey, cross braces or green net on its face (local +X, which faces the street once it is turned), braces behind
 * too where they are low down; at the top, the rail; in some, a ladder. Only the frame's legs and the plank are solid: the
 * rest is too thin to matter to a truck, and fewer solid parts are what keep the whole lot coming down at once cheap.
 */
function scaffoldBay(face: 'brace' | 'net', top: boolean, ladder: boolean): ObjectKind {
  const RED = 0xd0502a;
  const DEEP = 0xb8441f;
  const STEEL_GREY = 0x6a6f75;
  const F = -0.9;
  const ghost = { ghost: true };
  const brace = (x: number): ObjectPart[] => [box([0.015, 0.015, 1.24], [x, 0.85, 0], RED, { ghost: true, rot: [-0.757, 0, 0] }), box([0.015, 0.015, 1.24], [x, 0.85, 0], DEEP, { ghost: true, rot: [0.757, 0, 0] })];
  return {
    mass: 110,
    effect: 'dust',
    collapse: true,
    parts: [
      // The frame: two legs, solid; its bars, pins, sleeves and base plates.
      ...[0.6, -0.6].map((x) => box([0.035, 0.85, 0.035], [x, 0.85, F], RED)),
      box([0.6, 0.03, 0.03], [0, 1.67, F], RED, ghost),
      box([0.6, 0.022, 0.022], [0, 1.4, F], DEEP, ghost),
      box([0.022, 0.16, 0.022], [0.42, 1.53, F], DEEP, { ghost: true, rot: [0, 0, 0.8] }),
      box([0.022, 0.16, 0.022], [-0.42, 1.53, F], DEEP, { ghost: true, rot: [0, 0, -0.8] }),
      ...[0.6, -0.6].flatMap((x): ObjectPart[] => [
        cyl(0.045, 0.06, [x, 1.62, F], STEEL_GREY, ghost),
        box([0.05, 0.03, 0.05], [x, 0.95, F], STEEL_GREY, ghost),
        box([0.09, 0.012, 0.09], [x, 0.012, F], 0x4a4f55, ghost),
      ]),
      // The plank, solid; its hooks, holes and striped toe boards.
      box([0.6, 0.025, 0.84], [0, 1.73, 0], 0x9aa0a6),
      ...[-0.88, 0.88].map((z) => box([0.62, 0.03, 0.025], [0, 1.74, z], 0x3a3f45, ghost)),
      ...[-0.6, -0.2, 0.2, 0.6].map((z) => box([0.5, 0.004, 0.08], [0, 1.756, z], 0x7a8086, ghost)),
      ...[-0.6, 0.6].flatMap((x): ObjectPart[] => [-0.66, -0.22, 0.22, 0.66].map((z, k) => box([0.012, 0.07, 0.22], [x, 1.82, z], k % 2 ? 0x1c1d20 : 0xf2c12e, ghost))),
      // The face, and behind.
      ...(face === 'brace'
        ? [...brace(0.66), ...brace(-0.66)]
        : [box([0.012, 0.84, 0.89], [0.66, 0.85, 0], 0x2f8a4a, ghost), ...[0.3, 0.85, 1.4].map((y) => box([0.016, 0.012, 0.89], [0.66, y, 0], 0x23703a, ghost))]),
      ...(top
        ? [...[-0.88, 0.88].map((z) => box([0.03, 0.55, 0.03], [0.6, 2.25, z], RED, ghost)), box([0.03, 0.03, 0.9], [0.6, 2.78, 0], RED, ghost), box([0.025, 0.025, 0.9], [0.6, 2.25, 0], DEEP, ghost)]
        : []),
      ...(ladder
        ? [
            ...[-0.22, 0.22].map((x) => box([0.025, 0.95, 0.025], [x, 0.85, 0], 0xb0b6bc, { ghost: true, rot: [0.55, 0, 0] })),
            ...Array.from({ length: 6 }, (_, k): ObjectPart => box([0.22, 0.015, 0.015], [0, 0.2 + k * 0.28, -0.32 + k * 0.17], 0x8c9096, ghost)),
          ]
        : []),
    ],
  };
}

/** A hen: body, head, comb, tail. */
function chicken(color: number): ObjectKind {
  return {
    mass: 2.5,
    effect: 'feathers',
    flee: 6,
    wanders: 2.5,
    parts: [
      box([0.13, 0.13, 0.19], [0, 0.26, 0], color),
      box([0.07, 0.08, 0.08], [0, 0.44, 0.18], color, { ghost: true }),
      box([0.02, 0.04, 0.05], [0, 0.55, 0.18], 0xd0302a, { ghost: true }),
      box([0.02, 0.03, 0.03], [0, 0.42, 0.27], 0xf2b51e, { ghost: true }),
      box([0.09, 0.1, 0.04], [0, 0.38, -0.2], color, { ghost: true, rot: [-0.5, 0, 0] }),
      ...[-0.05, 0.05].map((x) => box([0.012, 0.07, 0.012], [x, 0.07, 0], 0xe0a030, { ghost: true })),
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
  stallFruit: stocked(0xc8443a, [0xe0b020, 0xe8892a, 0x6a9a3a, 0xc8372d]),
  stallVeg: stocked(0x3a8f4f, [0x6a9a3a, 0x8fbf4a, 0xd9cba0, 0x4f7a3a]),
  stallClothes: stocked(0x3a7fc8, [0xe8e2d0, 0x2f62a8, 0xc8443a, 0x2a2e33]),
  stallSnack: stocked(0xe0b020, [0xb5482f, 0xd9a62e, 0xf2efe6, 0x7a4a34]),
  radio: RADIO,
  /** A tall blue-glazed pot with a slender plant. */
  flowerPotTall: { mass: 18, effect: 'shards', parts: [cyl(0.2, 0.36, [0, 0.36, 0], 0x2f5f9a), cyl(0.22, 0.03, [0, 0.72, 0], 0x23497a), cyl(0.04, 0.35, [0, 1.05, 0], 0x5a7a3a, { ghost: true }), cone(0.28, 0.35, [0, 1.35, 0], 0x4f8a4a, { ghost: true })] },
  /** A wide low basin of flowers, pink and yellow. */
  flowerPotLow: { mass: 16, effect: 'shards', parts: [cyl(0.42, 0.12, [0, 0.12, 0], 0xc9a27e), cyl(0.38, 0.03, [0, 0.25, 0], 0x5a3a24, { ghost: true }), ...[0, 1.1, 2.2, 3.3, 4.4, 5.5].map((a, k): ObjectPart => box([0.07, 0.07, 0.07], [Math.cos(a) * 0.22, 0.32, Math.sin(a) * 0.22], k % 2 ? 0xe86a9a : 0xf2c12e, { ghost: true })), box([0.25, 0.06, 0.25], [0, 0.29, 0], 0x4f8a4a, { ghost: true })] },
  /** A big brown water jar, a lotus leaf floating in it. */
  flowerPotJar: { mass: 30, effect: 'shards', parts: [cyl(0.36, 0.3, [0, 0.3, 0], 0x6e4a2e), cyl(0.3, 0.04, [0, 0.62, 0], 0x5a3a24), cyl(0.27, 0.01, [0, 0.6, 0], 0x4f8fa8, { ghost: true }), cyl(0.12, 0.01, [0.08, 0.62, 0.05], 0x4f8a4a, { ghost: true })] },
  /** A glazed clay pot with a leafy plant in it: it breaks. */
  /**
   * A builder's scaffold, the frame kind put up all over Taiwan, in pieces that stack: a door-shaped frame of steel tube 1.2 m
   * across and 1.7 m high; a steel plank laid across two frames; a pair of cross braces between two frames along the face; a
   * length of green safety net hung on the face. Each piece's base is at the bottom of its storey.
   */
  scaffoldFrame: {
    mass: 60,
    effect: 'dust',
    collapse: true,
    parts: [
      box([0.035, 0.85, 0.035], [0.6, 0.85, 0], 0xd0502a),
      box([0.035, 0.85, 0.035], [-0.6, 0.85, 0], 0xd0502a),
      box([0.6, 0.03, 0.03], [0, 1.67, 0], 0xd0502a, { ghost: true }),
      box([0.6, 0.022, 0.022], [0, 1.4, 0], 0xb8441f, { ghost: true }),
      box([0.022, 0.16, 0.022], [0.42, 1.53, 0], 0xb8441f, { ghost: true, rot: [0, 0, 0.8] }),
      box([0.022, 0.16, 0.022], [-0.42, 1.53, 0], 0xb8441f, { ghost: true, rot: [0, 0, -0.8] }),
      // The joint pins at the top of each leg, the sleeves the braces clip to, a base plate under each foot.
      ...[0.6, -0.6].flatMap((x): ObjectPart[] => [
        cyl(0.045, 0.06, [x, 1.62, 0], 0x6a6f75, { ghost: true }),
        box([0.05, 0.03, 0.05], [x, 0.95, 0], 0x6a6f75, { ghost: true }),
        box([0.09, 0.012, 0.09], [x, 0.012, 0], 0x4a4f55, { ghost: true }),
      ]),
    ],
  },
  scaffoldBayBrace: scaffoldBay('brace', false, false),
  scaffoldBayBraceLadder: scaffoldBay('brace', false, true),
  scaffoldBayNet: scaffoldBay('net', false, false),
  scaffoldBayNetLadder: scaffoldBay('net', false, true),
  scaffoldBayTop: scaffoldBay('net', true, false),
  scaffoldBayTopLadder: scaffoldBay('net', true, true),
  /** A three-seat sofa, its length along Z: it bursts in stuffing. */
  sofa: {
    mass: 45,
    effect: 'feathers',
    parts: [
      box([0.42, 0.18, 0.95], [0, 0.3, 0], 0x3f6b5a),
      box([0.12, 0.28, 0.95], [-0.32, 0.7, 0], 0x355c4d),
      ...[-0.9, 0.9].map((z) => box([0.42, 0.14, 0.08], [0, 0.58, z], 0x355c4d)),
      ...[-0.6, 0, 0.6].map((z) => box([0.3, 0.06, 0.28], [0.06, 0.52, z], 0x4a7c69, { ghost: true })),
      ...[-0.85, 0.85].flatMap((z) => [-0.3, 0.3].map((x) => box([0.04, 0.06, 0.04], [x, 0.06, z], 0x2a1a12, { ghost: true }))),
    ],
  },
  /** A tall fridge, white: it goes over with a clang. */
  fridge: {
    mass: 70,
    effect: 'sparks',
    parts: [
      box([0.36, 0.85, 0.34], [0, 0.85, 0], 0xe8ecef),
      box([0.37, 0.006, 0.35], [0, 1.12, 0], 0x9aa0a6, { ghost: true }),
      box([0.02, 0.18, 0.02], [0.3, 1.4, 0.36], 0x8c9096, { ghost: true }),
      box([0.02, 0.22, 0.02], [0.3, 0.8, 0.36], 0x8c9096, { ghost: true }),
    ],
  },
  /** A wardrobe of brown veneer, its length along Z: it splits. */
  wardrobe: {
    mass: 60,
    effect: 'splinters',
    parts: [
      box([0.3, 0.95, 0.6], [0, 0.95, 0], 0x8a5a36),
      box([0.31, 0.006, 0.6], [0, 0.95, 0], 0x5a3a24, { ghost: true }),
      box([0.31, 0.95, 0.006], [0, 0.95, 0], 0x5a3a24, { ghost: true }),
      ...[-0.06, 0.06].map((z) => box([0.02, 0.06, 0.015], [0.31, 1.0, z], 0xd9a62e, { ghost: true })),
    ],
  },
  /** A mattress, laid flat. */
  mattress: {
    mass: 20,
    effect: 'feathers',
    parts: [box([0.7, 0.1, 0.95], [0, 0.1, 0], 0xf0ece2), box([0.71, 0.02, 0.96], [0, 0.1, 0], 0x6a8ec8, { ghost: true })],
  },
  /** An old television set, all box behind its screen. */
  tvSet: {
    mass: 25,
    effect: 'sparks',
    parts: [box([0.35, 0.28, 0.3], [0, 0.28, 0], 0x2a2e34), box([0.28, 0.21, 0.01], [0, 0.3, 0.3], 0x4a5a6a, { ghost: true })],
  },
  /** Four metres of steel crash barrier on two posts, as along every mountain road: it takes a scrape; a truck going fast goes through it. */
  guardrail: {
    mass: 160,
    effect: 'sparks',
    sturdy: 6,
    parts: [
      box([0.06, 0.17, 2.0], [0.1, 0.62, 0], 0xc9ced3),
      box([0.065, 0.04, 2.0], [0.12, 0.62, 0], 0xa8adb2, { ghost: true }),
      ...[-1.6, 1.6].map((z) => box([0.06, 0.4, 0.06], [-0.05, 0.4, z], 0x8c9096)),
      ...[-1.0, 1.0].map((z) => box([0.07, 0.06, 0.12], [0.17, 0.62, z], 0xf2c12e, { ghost: true })),
    ],
  },
  /** An iron manhole cover, flush with the road. Water under it throws it up. */
  manholeCover: {
    mass: 45,
    underfoot: true,
    effect: 'sparks',
    parts: [cyl(0.4, 0.025, [0, 0.025, 0], 0x4a4f55), cyl(0.3, 0.003, [0, 0.051, 0], 0x5a6068, { ghost: true }), box([0.28, 0.003, 0.02], [0, 0.052, 0], 0x3a3f45, { ghost: true }), box([0.02, 0.003, 0.28], [0, 0.052, 0], 0x3a3f45, { ghost: true })],
  },
  /** A builder's banner hung on a scaffold's face: blue, with white bands. */
  scaffoldBanner: {
    mass: 10,
    collapse: true,
    parts: [box([0.015, 0.8, 2.6], [0, 0.85, 0], 0x2a5fa8), ...[0.35, 1.35].map((y) => box([0.02, 0.08, 2.6], [0, y, 0], 0xf0ece2, { ghost: true })), box([0.02, 0.22, 1.6], [0, 0.85, 0], 0xf2c12e, { ghost: true })],
  },
  scaffoldBrace: {
    mass: 16,
    collapse: true,
    parts: [box([0.015, 0.015, 1.24], [0, 0.85, 0], 0xd0502a, { rot: [-0.757, 0, 0] }), box([0.015, 0.015, 1.24], [0, 0.85, 0], 0xb8441f, { ghost: true, rot: [0.757, 0, 0] })],
  },
  scaffoldNet: {
    mass: 12,
    collapse: true,
    parts: [box([0.012, 0.84, 0.89], [0, 0.85, 0], 0x2f8a4a), ...[0.3, 0.85, 1.4].map((y) => box([0.016, 0.012, 0.89], [0, y, 0], 0x23703a, { ghost: true }))],
  },
  /** A terracotta pot with a round bush in flower, red and pink all over: azalea. */
  flowerPotBloom: {
    mass: 16,
    effect: 'shards',
    parts: [
      cyl(0.26, 0.2, [0, 0.2, 0], 0xb5533c),
      cyl(0.29, 0.04, [0, 0.4, 0], 0x9a4530),
      cyl(0.34, 0.2, [0, 0.66, 0], 0x3f7a3f, { ghost: true }),
      cyl(0.24, 0.08, [0, 0.9, 0], 0x4a8a46, { ghost: true }),
      ...Array.from({ length: 14 }, (_, k): ObjectPart => {
        const a = k * 2.4;
        const r = k % 2 ? 0.34 : 0.2;
        const y = k % 2 ? 0.55 + (k % 3) * 0.12 : 0.92;
        return box([0.06, 0.045, 0.06], [Math.cos(a) * r, y, Math.sin(a) * r], k % 3 ? 0xe0326a : 0xff8fb8, { ghost: true });
      }),
    ],
  },
  /** A white glazed pot with stems of yellow chrysanthemums standing up out of it. */
  flowerPotYellow: {
    mass: 14,
    effect: 'shards',
    parts: [
      cyl(0.22, 0.24, [0, 0.24, 0], 0xeef0ea),
      cyl(0.23, 0.03, [0, 0.38, 0], 0x2f6fb0),
      cyl(0.2, 0.02, [0, 0.49, 0], 0x5a3a24, { ghost: true }),
      ...Array.from({ length: 7 }, (_, k): ObjectPart[] => {
        const a = k * 0.9;
        const r = k === 0 ? 0 : 0.14;
        const h = 0.75 + (k % 3) * 0.1;
        return [
          box([0.015, (h - 0.5) / 2, 0.015], [Math.cos(a) * r, (h + 0.5) / 2, Math.sin(a) * r], 0x4f8a4a, { ghost: true }),
          box([0.075, 0.04, 0.075], [Math.cos(a) * r, h, Math.sin(a) * r], k % 2 ? 0xf2c12e : 0xffa020, { ghost: true }),
        ];
      }).flat(),
    ],
  },
  flowerPot: { mass: 14, effect: 'shards', parts: [cyl(0.24, 0.22, [0, 0.22, 0], 0xb5533c), cyl(0.27, 0.04, [0, 0.44, 0], 0x9a4530), cyl(0.22, 0.02, [0, 0.46, 0], 0x5a3a24, { ghost: true }), ...[0, 1.3, 2.6, 3.9, 5.2].map((a): ObjectPart => box([0.06, 0.2, 0.16], [Math.cos(a) * 0.12, 0.62, Math.sin(a) * 0.12], 0x3f8a3f, { ghost: true, rot: [Math.sin(a) * 0.5, a, Math.cos(a) * 0.5] }))] },
  /** A caterer's stand: a steel top on four legs, a great wok over a ring of blue flame, a steamer. Heavy, but it goes over. */
  wokStand: {
    mass: 260,
    effect: 'sparks',
    parts: [
      box([0.9, 0.06, 1.3], [0, 0.82, 0], 0x8c9096),
      ...[-0.8, 0.8].flatMap((x): ObjectPart[] => [-1.2, 1.2].map((z) => box([0.05, 0.4, 0.05], [x, 0.4, z], 0x3a3f45))),
      cyl(0.8, 0.12, [0, 1.0, 0.4], 0x2a2e33),
      cone(0.45, 0.2, [0, 0.7, 0.4], 0x3a8fff, { ghost: true }),
      cyl(0.5, 0.35, [0, 1.25, -0.7], 0xb08a5a),
    ],
  },
  awningRed: awning(0xc8372d),
  awningBlue: awning(0x2f6fb0),
  /** A god's sedan chair on its carrying poles, for the bearers to take on their shoulders. */
  palanquinChair: {
    mass: 600,
    parts: [
      cyl(0.05, 2.3, [0.8, 1.4, 0], 0x6e2a22, { rot: [Math.PI / 2, 0, 0] }),
      cyl(0.05, 2.3, [-0.8, 1.4, 0], 0x6e2a22, { rot: [Math.PI / 2, 0, 0] }),
      box([0.62, 0.08, 0.74], [0, 1.48, 0], 0x6e2a22),
      box([0.55, 0.55, 0.65], [0, 2.1, 0], 0xc8372d),
      box([0.4, 0.4, 0.02], [0, 2.1, 0.66], 0xd9a62e, { ghost: true }),
      box([0.3, 0.3, 0.03], [0, 2.1, 0.67], 0x2a1a12, { ghost: true }),
      ...[-1, 1].map((x) => box([0.02, 0.4, 0.5], [x * 0.56, 2.1, 0], 0xd9a62e, { ghost: true })),
      box([0.75, 0.08, 0.85], [0, 2.72, 0], 0xd9a62e),
      box([0.5, 0.18, 0.6], [0, 2.92, 0], 0xc8372d),
      box([0.34, 0.06, 0.42], [0, 3.13, 0], 0xd9a62e),
      cyl(0.09, 0.12, [0, 3.3, 0], 0xd9a62e),
      ...[[-0.7, -0.8], [0.7, -0.8], [-0.7, 0.8], [0.7, 0.8]].map(([x, z]) => box([0.05, 0.25, 0.05], [x, 2.55, z], 0xe0322a, { ghost: true })),
    ],
  },
  /** A string of firecrackers laid flat on the ground, a pack of red: it goes off as soon as anything rolls over it. */
  firecrackerMat: {
    mass: 3,
    effect: 'sparks',
    crackle: 6,
    trip: true,
    // A string of them laid out on the ground: two rows of little red rolls along a fuse, gold paper at the head.
    parts: [
      box([1.1, 0.015, 0.16], [0, 0.015, 0], 0x2a1a12),
      ...Array.from({ length: 16 }, (_, k) => -1.0 + k * 0.133).flatMap((x): ObjectPart[] => [-0.06, 0.06].map((z) => cyl(0.032, 0.06, [x, 0.06, z], 0xd0302a, { ghost: true, rot: [Math.PI / 2, 0, 0] }))),
      box([1.12, 0.008, 0.008], [0, 0.1, 0], 0x6e5a40, { ghost: true }),
      box([0.1, 0.06, 0.16], [1.12, 0.06, 0], 0xe8c35a, { ghost: true }),
    ],
  },
  stallIncense: stocked(0xb8352b, [0xd9a62e, 0xc8372d, 0xe8892a, 0x7a2a22]),
  /** A carton of gold paper money, for burning: it bursts into a shower of gold. */
  paperBox: { mass: 6, effect: 'paper', parts: [box([0.3, 0.18, 0.22], [0, 0.18, 0], 0xd9a62e), box([0.31, 0.02, 0.23], [0, 0.3, 0], 0xb5482f, { ghost: true })] },
  /** The furnace paper money is burnt in: brick, with a roof and a chimney. Knocked down, it goes up in ash and smoke. */
  paperFurnace: {
    mass: 2500,
    effect: 'ash',
    parts: [
      // A two-tiered tower of brick, its mouth wide open and glowing, a tiled roof, a tall chimney.
      box([1.3, 0.9, 1.3], [0, 0.9, 0], 0xa8553c),
      box([0.75, 0.55, 0.05], [0, 1.0, 1.32], 0xff8a2a, { ghost: true }),
      box([0.6, 0.4, 0.06], [0, 1.0, 1.33], 0xffd25a, { ghost: true }),
      box([1.0, 0.6, 1.0], [0, 2.4, 0], 0xb8352b),
      box([1.5, 0.2, 1.5], [0, 3.15, 0], 0xd8742a),
      box([0.45, 0.8, 0.45], [0, 4.1, 0], 0xa8553c),
    ],
  },
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
  /**
   * The light at a junction: a mast at the corner with an arm out over the road. It only
   * ever flashes amber, and nobody takes any notice of it.
   */
  signalMast: {
    mass: 380,
    effect: 'sparks',
    parts: [
      foot(0.32, DARK),
      cyl(0.09, 2.7, [0, 2.7, 0], 0x6a7078),
      box([0.06, 0.06, 2.2], [0, 5.3, 2.1], 0x6a7078, { ghost: true }),
      box([0.2, 0.5, 0.18], [0, 4.95, 4.1], 0x24262a, { ghost: true }),
      box([0.13, 0.13, 0.03], [0, 5.1, 4.3], 0xffb020, { ghost: true, flash: true }),
      box([0.2, 0.5, 0.18], [0.35, 3.2, 0], 0x24262a, { ghost: true }),
      box([0.03, 0.13, 0.13], [0.56, 3.35, 0], 0xffb020, { ghost: true, flash: true }),
    ],
  },
  utilityPole: pole(true, true),
  /** The last pole of a run: wires on one side of it only. */
  utilityPoleAhead: pole(true, false),
  utilityPoleBehind: pole(false, true),
  utilityPoleBare: pole(false, false),
  /** The green box the power company leaves on the pavement. */
  transformerBox: {
    mass: 300,
    effect: 'sparks',
    parts: [box([0.6, 0.62, 0.32], [0, 0.72, 0], 0x4f7a5a), box([0.64, 0.05, 0.36], [0, 0.05, 0], 0x8b8f92), box([0.03, 0.5, 0.01], [0, 0.72, 0.33], 0x3a5a44, { ghost: true }), box([0.2, 0.12, 0.01], [-0.3, 1.05, 0.33], 0xf2c12e, { ghost: true })],
  },
  /** A bus shelter: a bench under a roof, and the sign with the routes on it. */
  busStop: {
    mass: 220,
    effect: 'sparks',
    parts: [
      box([1.5, 0.05, 0.25], [0, 0.45, -0.2], 0x8a8f96),
      box([0.06, 0.22, 0.2], [-1.2, 0.22, -0.2], DARK), box([0.06, 0.22, 0.2], [1.2, 0.22, -0.2], DARK),
      box([1.9, 1.0, 0.03], [0, 1.4, -0.55], 0xa9c8d2, { ghost: true }),
      cyl(0.04, 1.25, [-1.85, 1.25, -0.5], DARK, { ghost: true }), cyl(0.04, 1.25, [1.85, 1.25, -0.5], DARK, { ghost: true }),
      box([2.05, 0.05, 0.75], [0, 2.52, -0.1], 0x2f62a8, { ghost: true }),
      cyl(0.04, 1.3, [2.5, 1.3, 0.3], DARK, { ghost: true }),
      cyl(0.3, 0.03, [2.5, 2.75, 0.3], 0x2f62a8, { ghost: true, rot: [Math.PI / 2, 0, 0] }),
    ],
  },
  /** A betel-nut stand: a glass box edged in neon. What it sells is red, and so is what is left of it. */
  betelBooth: {
    mass: 190,
    effect: 'sparks',
    juice: 0x9a1f2a,
    parts: [
      box([0.95, 0.2, 0.7], [0, 0.2, 0], 0x8b8f92),
      box([0.9, 0.85, 0.65], [0, 1.25, 0], 0xbfe3d8),
      box([0.98, 0.06, 0.73], [0, 2.16, 0], 0x33383e, { ghost: true }),
      box([0.98, 0.05, 0.03], [0, 2.02, 0.68], 0xff4fa0, { ghost: true }), box([0.98, 0.05, 0.03], [0, 0.48, 0.68], 0x4fe08a, { ghost: true }),
      box([0.03, 0.8, 0.03], [-0.93, 1.25, 0.68], 0x4fe08a, { ghost: true }), box([0.03, 0.8, 0.03], [0.93, 1.25, 0.68], 0xff4fa0, { ghost: true }),
    ],
  },
  /** A claw machine, full of toys nobody has ever won. */
  clawPink: {
    mass: 95,
    effect: 'toys',
    parts: [
      box([0.42, 0.45, 0.42], [0, 0.45, 0], 0xe86a9a),
      box([0.4, 0.42, 0.4], [0, 1.32, 0], 0xcfe6ee),
      box([0.44, 0.1, 0.44], [0, 1.84, 0], 0xe86a9a, { ghost: true }),
      ...[[-0.18, 0xf2c12e], [0.02, 0x5f8fd0], [0.2, 0x4f9f7a]].map(([x, color]) => box([0.11, 0.11, 0.11], [x, 1.02, 0.1], color, { ghost: true })),
    ],
  },
  clawBlue: {
    mass: 95,
    effect: 'toys',
    parts: [
      box([0.42, 0.45, 0.42], [0, 0.45, 0], 0x3f7fc8),
      box([0.4, 0.42, 0.4], [0, 1.32, 0], 0xcfe6ee),
      box([0.44, 0.1, 0.44], [0, 1.84, 0], 0xf2c12e, { ghost: true }),
      ...[[-0.18, 0xe86a9a], [0.02, 0xf2efe6], [0.2, 0xd85a4a]].map(([x, color]) => box([0.11, 0.11, 0.11], [x, 1.02, 0.1], color, { ghost: true })),
    ],
  },
  /** A folding board stood in the road: yellow, with a warning on both faces. */
  slipBoard: {
    mass: 7,
    parts: [
      // Two boards leaning together at the top, their feet apart.
      box([0.34, 0.5, 0.03], [0, 0.48, 0.17], 0xf2c12e, { rot: [-0.32, 0, 0] }),
      box([0.34, 0.5, 0.03], [0, 0.48, -0.17], 0xf2c12e, { rot: [0.32, 0, 0] }),
      box([0.2, 0.2, 0.01], [0, 0.56, 0.18], 0x1c1d20, { rot: [-0.32, 0, Math.PI / 4], ghost: true }),
      box([0.2, 0.2, 0.01], [0, 0.56, -0.18], 0x1c1d20, { rot: [0.32, 0, Math.PI / 4], ghost: true }),
      box([0.24, 0.05, 0.01], [0, 0.2, 0.3], 0xd0302a, { rot: [-0.32, 0, 0], ghost: true }),
      box([0.24, 0.05, 0.01], [0, 0.2, -0.3], 0xd0302a, { rot: [0.32, 0, 0], ghost: true }),
    ],
  },
  /** A mine, half buried: a dark disc with a prong in the middle. It goes off the moment it is touched. */
  mine: {
    mass: 6,
    explosive: true,
    fuse: 0.02,
    bang: { kind: 'mine', power: 1.5 },
    stable: true,
    parts: [cyl(0.3, 0.05, [0, 0.05, 0], 0x4a5240), cyl(0.2, 0.02, [0, 0.11, 0], 0x33382c, { ghost: true }), cyl(0.04, 0.05, [0, 0.16, 0], 0xb5533c, { ghost: true })],
  },
  /** A drum of fuel: red, with a band. It goes up like the gas does. */
  oilDrum: {
    mass: 45,
    explosive: true,
    bang: { kind: 'drum', power: 1.2 },
    parts: [cyl(0.32, 0.46, [0, 0.46, 0], 0xb5362a), cyl(0.33, 0.04, [0, 0.62, 0], 0x2a2e33, { ghost: true }), cyl(0.33, 0.04, [0, 0.3, 0], 0x2a2e33, { ghost: true })],
  },
  sandbag: { mass: 30, parts: [box([0.45, 0.14, 0.24], [0, 0.14, 0], 0xb9a57a)] },
  /** A ridge tent: canvas over a pole, pegged down. Its length runs along Z. */
  armyTent: {
    mass: 40,
    parts: [
      box([0.55, 0.4, 1.5], [0, 0.4, 0], 0x6f7a4e),
      box([0.95, 0.95, 1.6], [0, 0, 0], 0x6f7a4e, { rot: [0, 0, Math.PI / 4], ghost: true }),
      box([0.3, 0.5, 0.02], [0, 0.5, 1.61], 0x4f5838, { ghost: true }),
    ],
  },
  /** A box of ammunition: olive, with a band. Nothing in it goes off. */
  ammoCrate: { mass: 22, effect: 'splinters', parts: [box([0.45, 0.22, 0.28], [0, 0.22, 0], 0x5d6a3e), box([0.46, 0.04, 0.29], [0, 0.3, 0], 0x3f4a2a, { ghost: true })] },
  jerrycan: { mass: 8, parts: [box([0.17, 0.24, 0.09], [0, 0.24, 0], 0x4f5b36), box([0.05, 0.03, 0.05], [0.08, 0.5, 0], 0x2a2e33, { ghost: true })] },
  /** A field kitchen: a stove on wheels with its chimney, and the pots on it. */
  fieldKitchen: {
    mass: 120,
    parts: [
      box([0.6, 0.45, 0.9], [0, 0.45, 0], 0x4a5240),
      cyl(0.08, 0.6, [0.3, 1.5, -0.5], 0x2a2e33, { ghost: true }),
      cyl(0.24, 0.12, [-0.1, 1.02, 0.3], STEEL, { ghost: true }),
      cyl(0.18, 0.1, [0.15, 1.0, -0.1], STEEL, { ghost: true }),
    ],
  },
  /** A jeep, parked: heavy, but it gives. */
  jeep: {
    mass: 650,
    effect: 'sparks',
    parts: [
      box([0.8, 0.42, 1.7], [0, 0.55, 0], 0x5d6a3e),
      box([0.78, 0.2, 0.55], [0, 1.15, 1.1], 0x55613a, { ghost: true }),
      box([0.74, 0.3, 0.03], [0, 1.45, 0.5], 0x9fb4bd, { ghost: true, rot: [-0.25, 0, 0] }),
      box([0.3, 0.3, 0.08], [0.35, 1.25, -0.3], 0x3a3f36, { ghost: true }),
      box([0.3, 0.3, 0.08], [-0.35, 1.25, -0.3], 0x3a3f36, { ghost: true }),
      ...[[-1, 1.1], [1, 1.1], [-1, -1.1], [1, -1.1]].map(([side, along]) => cyl(0.38, 0.13, [side * 0.82, 0.38, along], 0x1c1d20, { ghost: true, rot: [0, 0, Math.PI / 2] })),
      cyl(0.36, 0.1, [0, 1.05, -1.78], 0x1c1d20, { ghost: true, rot: [Math.PI / 2, 0, 0] }),
    ],
  },
  /** A handcart: a box on two wheels, with shafts. */
  cart: {
    mass: 45,
    effect: 'splinters',
    parts: [
      box([0.5, 0.25, 0.85], [0, 0.55, 0], WOOD),
      box([0.46, 0.02, 0.8], [0, 0.82, 0], 0x7a5a38, { ghost: true }),
      cyl(0.45, 0.04, [0.56, 0.45, 0], 0x5a4630, { ghost: true, rot: [0, 0, Math.PI / 2] }),
      cyl(0.45, 0.04, [-0.56, 0.45, 0], 0x5a4630, { ghost: true, rot: [0, 0, Math.PI / 2] }),
      box([0.03, 0.03, 0.6], [0.4, 0.6, 1.4], 0x7a5a38, { ghost: true }),
      box([0.03, 0.03, 0.6], [-0.4, 0.6, 1.4], 0x7a5a38, { ghost: true }),
    ],
  },
  haystack: { mass: 70, effect: 'straw', parts: [cyl(0.95, 0.55, [0, 0.55, 0], 0xd2b455), cone(0.95, 0.4, [0, 1.5, 0], 0xc4a548, { ghost: true })] },
  scarecrow: {
    mass: 12,
    effect: 'splinters',
    parts: [
      foot(0.2, DARK),
      cyl(0.04, 0.9, [0, 0.9, 0], WOOD),
      box([0.6, 0.04, 0.04], [0, 1.4, 0], WOOD, { ghost: true }),
      box([0.24, 0.3, 0.1], [0, 1.2, 0], 0x7a4a3a, { ghost: true }),
      cyl(0.16, 0.16, [0, 1.82, 0], 0xcdb98a, { ghost: true }),
      cone(0.3, 0.14, [0, 2.1, 0], 0x6b5a3a, { ghost: true }),
    ],
  },
  // ---- things that stand in a field or a wood: each goes its own way when it is hit
  /** A duck. They stand about in the road in dozens. */
  duck: { mass: 2, effect: 'feathers', parts: [box([0.11, 0.1, 0.17], [0, 0.16, 0], 0xf2efe6), box([0.06, 0.07, 0.07], [0, 0.34, 0.14], 0xf2efe6, { ghost: true }), box([0.03, 0.02, 0.05], [0, 0.33, 0.24], 0xe8a020, { ghost: true })] },
  /** A watermelon, left where it grew: it bursts. */
  melon: { mass: 7, juice: 0xe2485a, parts: [cyl(0.22, 0.2, [0, 0.2, 0], 0x3f8a48), cyl(0.225, 0.03, [0, 0.2, 0], 0x2f6a38, { ghost: true })] },
  /** Sacks of rice, stacked: they split. */
  riceSack: { mass: 26, effect: 'grain', parts: [box([0.42, 0.14, 0.26], [0, 0.14, 0], 0xd9cba0), box([0.4, 0.13, 0.25], [0.04, 0.41, 0.02], 0xcfc094, { rot: [0, 0.3, 0] }), box([0.2, 0.02, 0.05], [0, 0.29, 0.27], 0xb5362a, { ghost: true })] },
  /** A rack of greens put out to dry. */
  dryingRack: {
    mass: 12,
    effect: 'leaves',
    parts: [
      box([0.9, 0.03, 0.3], [0, 0.03, 0], WOOD, { weight: 5 }),
      cyl(0.03, 0.6, [-0.85, 0.63, 0], WOOD, { ghost: true }), cyl(0.03, 0.6, [0.85, 0.63, 0], WOOD, { ghost: true }),
      box([0.9, 0.02, 0.02], [0, 1.22, 0], WOOD, { ghost: true }),
      ...[-0.6, -0.2, 0.2, 0.6].map((x, i) => box([0.14, 0.26, 0.03], [x, 0.94, 0], i % 2 ? 0x6f9a4a : 0x8ab05a, { ghost: true })),
    ],
  },
  /** The stand-pipe a field is watered from. Broken off, it goes on spouting. */
  standpipe: { mass: 60, effect: 'water', geyser: true, parts: [cyl(0.09, 0.45, [0, 0.45, 0], 0x4a7fb5), cyl(0.14, 0.05, [0, 0.9, 0], 0x35608a), box([0.2, 0.05, 0.05], [0.2, 0.7, 0], 0x35608a, { ghost: true })] },
  /** A box of bees. They come out. */
  beehive: { mass: 14, effect: 'bees', parts: [box([0.28, 0.2, 0.24], [0, 0.32, 0], 0xe8d49a), box([0.3, 0.03, 0.26], [0, 0.55, 0], 0x8a6a44, { ghost: true }), box([0.06, 0.12, 0.06], [0.2, 0.06, 0.16], 0x6e5236, { ghost: true }), box([0.06, 0.12, 0.06], [-0.2, 0.06, -0.16], 0x6e5236, { ghost: true })] },
  /** The little tractor every farm has: heavy, and it rings. */
  tractor: {
    mass: 520,
    effect: 'sparks',
    parts: [
      box([0.55, 0.4, 1.2], [0, 0.6, 0], 0x3f8a5a),
      box([0.45, 0.3, 0.45], [0, 1.25, -0.5], 0x35704a, { ghost: true }),
      cyl(0.05, 0.4, [0.3, 1.5, 0.7], 0x2a2e33, { ghost: true }),
      ...[[-1, 0.7], [1, 0.7], [-1, -0.7], [1, -0.7]].map(([side, along]) => cyl(along < 0 ? 0.55 : 0.36, 0.14, [side * 0.7, along < 0 ? 0.55 : 0.36, along], 0x1c1d20, { ghost: true, rot: [0, 0, Math.PI / 2] })),
    ],
  },
  /** Bamboo: one cane. They grow in hundreds, and go down like grass. */
  bamboo: { mass: 4, effect: 'bamboo', parts: [cyl(0.045, 1.6, [0, 1.6, 0], 0x7fa850), cone(0.4, 0.5, [0, 3.5, 0], 0x6f9a4a, { ghost: true })] },
  /** Firewood, split and stacked. */
  woodpile: { mass: 34, effect: 'splinters', parts: [box([0.7, 0.3, 0.3], [0, 0.3, 0], 0x9a7448), box([0.66, 0.02, 0.28], [0, 0.61, 0], 0x7a5a38, { ghost: true }), ...[-0.5, -0.17, 0.17, 0.5].map((x) => cyl(0.1, 0.01, [x, 0.3, 0.305], 0xcfb07a, { ghost: true, rot: [Math.PI / 2, 0, 0] }))] },
  /** A length of trunk, sawn and left lying: it rolls. */
  logRound: { mass: 30, parts: [cyl(0.24, 0.9, [0, 0.24, 0], 0x7a5a38, { rot: [0, 0, Math.PI / 2] }), cyl(0.2, 0.905, [0, 0.24, 0], 0xcfb07a, { ghost: true, rot: [0, 0, Math.PI / 2] })] },
  /** A hen, white or brown, scratching about by a door: she is off, flapping, when the truck comes. */
  chickenWhite: chicken(0xf4f2ec),
  chickenBrown: chicken(0xc98a4a),
  chickenBlack: chicken(0x3a3330),
  /** A round bamboo tray of rice laid out to dry, and one of strips of radish. */
  trayGrain: { mass: 3, effect: 'rice', parts: [cyl(0.6, 0.03, [0, 0.04, 0], 0xb89a62), cyl(0.55, 0.02, [0, 0.08, 0], 0xf2c94c, { ghost: true })] },
  trayVeg: { mass: 3, effect: 'straw', parts: [cyl(0.6, 0.03, [0, 0.04, 0], 0xb89a62), cyl(0.55, 0.02, [0, 0.08, 0], 0xe8dcc0, { ghost: true }), ...[-0.3, 0, 0.3].map((x) => box([0.06, 0.02, 0.4], [x, 0.11, 0], 0xd9c8a0, { ghost: true, rot: [0, x * 2, 0] }))] },
  /** A wooden rake for turning rice, left lying. */
  rake: { mass: 2, effect: 'splinters', parts: [box([0.02, 0.02, 0.9], [0, 0.03, 0], 0x9a7448), box([0.4, 0.03, 0.04], [0, 0.04, 0.9], 0x7a5a38)] },
  /** A board of black and yellow chevrons on two posts at the outside of a bend, pointing the way round. */
  chevron: {
    mass: 20,
    parts: [
      ...[-0.5, 0.5].map((x) => box([0.04, 0.6, 0.04], [x, 0.6, 0], 0x8c9096)),
      box([0.75, 0.3, 0.02], [0, 1.45, 0], 0xf2c12e),
      ...[-0.45, 0, 0.45].flatMap((x): ObjectPart[] => [
        box([0.05, 0.16, 0.022], [x - 0.07, 1.53, 0], 0x1c1d20, { ghost: true, rot: [0, 0, 0.75] }),
        box([0.05, 0.16, 0.022], [x - 0.07, 1.37, 0], 0x1c1d20, { ghost: true, rot: [0, 0, -0.75] }),
      ]),
    ],
  },
  /** A boulder come down off the hillside: a truck does not shove it aside, it hits it. */
  boulder: { mass: 650, effect: 'dust', parts: [box([0.75, 0.55, 0.65], [0, 0.55, 0], 0x7d7a72, { rot: [0.15, 0.4, 0.1] }), box([0.5, 0.35, 0.55], [0.35, 0.95, -0.1], 0x8b8880, { ghost: true, rot: [0.3, 0.9, 0.2] })] },
  /** A lump of rock small enough to shift. */
  rockSmall: { mass: 38, effect: 'dust', parts: [box([0.3, 0.22, 0.26], [0, 0.22, 0], 0x8b8880, { rot: [0.2, 0.5, 0.15] })] },
  /** A post with boards on it, saying which way and how far. */
  trailSign: { mass: 9, effect: 'splinters', parts: [foot(0.18, DARK), cyl(0.05, 0.9, [0, 0.9, 0], WOOD), box([0.4, 0.09, 0.02], [0.2, 1.6, 0], 0xe8d49a, { ghost: true }), box([0.35, 0.09, 0.02], [-0.18, 1.35, 0], 0xe8d49a, { ghost: true })] },
  /** Racks of logs that mushrooms are grown on. */
  mushroomRack: {
    mass: 20,
    effect: 'splinters',
    parts: [
      box([0.7, 0.03, 0.3], [0, 0.03, 0], WOOD, { weight: 4 }),
      ...[-0.5, -0.17, 0.17, 0.5].flatMap((x) => [
        cyl(0.07, 0.55, [x, 0.6, 0], 0x5a4630, { ghost: true, rot: [0.35, 0, 0] }),
        cyl(0.08, 0.02, [x, 0.8, 0.1], 0xcdb98a, { ghost: true }),
        cyl(0.07, 0.02, [x, 0.5, -0.02], 0xcdb98a, { ghost: true }),
      ]),
    ],
  },
  /** A table of offerings before a wayside shrine: fruit, mostly. */
  offerings: { mass: 18, juice: 0xf08a24, parts: [box([0.5, 0.03, 0.3], [0, 0.6, 0], 0xb8433a), box([0.04, 0.3, 0.04], [0.42, 0.3, 0.22], 0x7a2a22), box([0.04, 0.3, 0.04], [-0.42, 0.3, -0.22], 0x7a2a22), box([0.04, 0.3, 0.04], [0.42, 0.3, -0.22], 0x7a2a22), box([0.04, 0.3, 0.04], [-0.42, 0.3, 0.22], 0x7a2a22), ...[-0.25, 0, 0.25].map((x) => cyl(0.09, 0.08, [x, 0.71, 0], 0xf08a24, { ghost: true }))] },
  /** A betel palm: a trunk like a pole and a tuft at the top. They stand in rows along every country road. */
  betelPalm: { mass: 240, effect: 'leaves', parts: [foot(0.24, 0x6e5236), cyl(0.11, 2.8, [0, 2.8, 0], 0x9a8a6a), cone(1.1, 0.5, [0, 6, 0], 0x4f8a4a, { ghost: true }), cone(0.7, 0.35, [0, 6.5, 0], 0x5d9a52, { ghost: true })] },
  /** The round mirror on a post at a blind corner. */
  mirror: { mass: 18, effect: 'sparks', parts: [foot(0.2, DARK), cyl(0.04, 1.2, [0, 1.2, 0], 0xe07a28), cyl(0.38, 0.03, [0, 2.6, 0.05], 0xe07a28, { ghost: true, rot: [Math.PI / 2, 0, 0] }), cyl(0.31, 0.035, [0, 2.6, 0.06], 0xcfe0e8, { ghost: true, rot: [Math.PI / 2, 0, 0] })] },
  /** A big glazed jar of water, as stands by every old house's door. */
  /** A coil of steel sheet, as it comes from the mill: three tonnes, and nothing stops it. */
  steelCoil: { mass: 3000, parts: [cyl(0.75, 0.6, [0, 0.6, 0], 0x9aa3ab), cyl(0.3, 0.605, [0, 0.6, 0], 0x3a3f45, { ghost: true }), cyl(0.755, 0.04, [0, 0.95, 0], 0xb5362a, { ghost: true }), cyl(0.755, 0.04, [0, 0.25, 0], 0xb5362a, { ghost: true })] },
  /** A length of iron handrail on two posts, two metres of it: down the middle of a flight of steps. */
  handrail: { mass: 22, parts: [box([0.04, 0.04, 1.0], [0, 1.0, 0], 0x59606a), cyl(0.03, 0.5, [0, 0.5, 0.85], 0x59606a), cyl(0.03, 0.5, [0, 0.5, -0.85], 0x59606a)] },
  /** A sign for a way meant for people on foot: a blue disc with a figure walking on it, on a post, and a white plate under it. */
  signWalk: {
    mass: 30,
    parts: [
      foot(0.22, STEEL),
      cyl(0.05, 1.15, [0, 1.15, 0], STEEL),
      cyl(0.36, 0.025, [0, 2.45, 0], 0x1f5fbf, { rot: [Math.PI / 2, 0, 0] }),
      box([0.035, 0.12, 0.01], [0.0, 2.48, 0.03], 0xffffff, { ghost: true, rot: [0, 0, 0.15] }),
      box([0.03, 0.1, 0.01], [0.06, 2.3, 0.03], 0xffffff, { ghost: true, rot: [0, 0, -0.45] }),
      box([0.03, 0.1, 0.01], [-0.06, 2.3, 0.03], 0xffffff, { ghost: true, rot: [0, 0, 0.45] }),
      box([0.04, 0.04, 0.01], [0.02, 2.66, 0.03], 0xffffff, { ghost: true }),
      box([0.3, 0.1, 0.02], [0, 1.95, 0], 0xf4f4f0),
    ],
  },
  vat: { mass: 55, effect: 'water', parts: [cyl(0.42, 0.4, [0, 0.4, 0], 0x7a4a34), cyl(0.36, 0.02, [0, 0.82, 0], 0x4f8fa8, { ghost: true })] },
  /** Something growing in a pot. */
  pot: { mass: 9, effect: 'leaves', parts: [cyl(0.2, 0.16, [0, 0.16, 0], 0xb5533c), cone(0.34, 0.3, [0, 0.62, 0], 0x4f8a4a, { ghost: true })] },
  /** The little blue lorry every farm has. */
  farmTruck: {
    mass: 700,
    effect: 'sparks',
    parts: [
      box([0.75, 0.3, 1.9], [0, 0.6, 0], 0x2f62a8),
      box([0.72, 0.42, 0.6], [0, 1.3, 1.2], 0x3a72b8, { ghost: true }),
      box([0.66, 0.2, 0.03], [0, 1.4, 1.81], 0x9fb4bd, { ghost: true }),
      box([0.75, 0.2, 0.04], [0, 1.1, -1.86], 0x28528e, { ghost: true }), box([0.04, 0.2, 1.2], [0.71, 1.1, -0.7], 0x28528e, { ghost: true }), box([0.04, 0.2, 1.2], [-0.71, 1.1, -0.7], 0x28528e, { ghost: true }),
      ...[[-1, 1.2], [1, 1.2], [-1, -1.2], [1, -1.2]].map(([side, along]) => cyl(0.33, 0.12, [side * 0.74, 0.33, along], 0x1c1d20, { ghost: true, rot: [0, 0, Math.PI / 2] })),
    ],
  },
  /** One leaf of a big timber gate: planks on a frame, with iron studs. Two of them shut a gateway; a lorry opens it. */
  woodGate: {
    mass: 95,
    effect: 'splinters',
    parts: [
      box([1.45, 1.3, 0.07], [0, 1.35, 0], 0x7a5230),
      box([1.45, 0.08, 0.09], [0, 0.6, 0], 0x5a3a22, { ghost: true }), box([1.45, 0.08, 0.09], [0, 2.1, 0], 0x5a3a22, { ghost: true }),
      ...[-0.9, 0, 0.9].flatMap((x) => [cyl(0.05, 0.02, [x, 0.6, 0.09], 0x2a2e33, { ghost: true, rot: [Math.PI / 2, 0, 0] }), cyl(0.05, 0.02, [x, 2.1, 0.09], 0x2a2e33, { ghost: true, rot: [Math.PI / 2, 0, 0] })]),
    ],
  },
  /** A young tree, no thicker than a wrist: it goes down under anything. */
  sapling: { mass: 40, effect: 'leaves', parts: [foot(0.18, 0x5a3f28), cyl(0.06, 1, [0, 1, 0], 0x6b4a2e), cone(0.75, 0.9, [0, 2.5, 0], 0x6aa85a, { ghost: true })] },
  /** What a fire leaves of a tree: a black trunk and a few stumps of branches. It goes over when it is hit. */
  deadTree: {
    mass: 320,
    effect: 'splinters',
    parts: [
      foot(0.3, 0x2a2420),
      cyl(0.17, 1.7, [0, 1.7, 0], 0x3a2f28),
      box([0.05, 0.7, 0.05], [0.4, 3, 0], 0x33291f, { ghost: true, rot: [0, 0, -0.7] }),
      box([0.05, 0.6, 0.05], [-0.33, 2.5, 0.1], 0x33291f, { ghost: true, rot: [0.3, 0, 0.8] }),
      box([0.04, 0.45, 0.04], [0.05, 3.7, -0.15], 0x33291f, { ghost: true, rot: [0.4, 0, 0.1] }),
    ],
  },
  /** Three lengths of steel girder, crossed: put down to stop tanks, and heavy enough to stop most things. */
  hedgehog: {
    mass: 260,
    effect: 'sparks',
    parts: [
      box([0.07, 0.9, 0.07], [0, 0.62, 0], 0x4a4540, { rot: [0.85, 0, 0] }),
      box([0.07, 0.9, 0.07], [0, 0.62, 0], 0x55504a, { rot: [-0.42, 0, 0.74] }),
      box([0.07, 0.9, 0.07], [0, 0.62, 0], 0x4a4540, { rot: [-0.42, 0, -0.74] }),
    ],
  },
  /** A length of concrete pipe, lying on its side: it rolls. */
  pipe: { mass: 90, parts: [cyl(0.34, 1.3, [0, 0.34, 0], 0xa9a59b, { rot: [0, 0, Math.PI / 2] }), cyl(0.26, 1.31, [0, 0.34, 0], 0x4a4f57, { rot: [0, 0, Math.PI / 2], ghost: true })] },
  /** Bricks on a pallet. */
  bricks: {
    mass: 110,
    parts: [box([0.6, 0.07, 0.5], [0, 0.07, 0], WOOD), box([0.55, 0.3, 0.45], [0, 0.44, 0], 0xb5533c), box([0.57, 0.02, 0.47], [0, 0.44, 0], 0x8a3f2c, { ghost: true }), box([0.4, 0.1, 0.45], [-0.1, 0.84, 0], 0xb5533c, { ghost: true })],
  },
  /** A bundle of reinforcing rods. */
  rebar: {
    mass: 70,
    effect: 'sparks',
    parts: [box([2.6, 0.08, 0.2], [0, 0.08, 0], 0x7a4a32), ...[-1.6, 0, 1.6].map((x) => box([0.04, 0.09, 0.22], [x, 0.09, 0], 0x2a2e34, { ghost: true }))],
  },
  wheelbarrow: {
    mass: 16,
    parts: [
      box([0.3, 0.14, 0.42], [0, 0.42, 0], 0x4f8d68),
      box([0.26, 0.02, 0.38], [0, 0.55, 0], 0x9c9a94, { ghost: true }),
      cyl(0.17, 0.05, [0, 0.17, 0.5], 0x1c1d20, { rot: [0, 0, Math.PI / 2] }),
      box([0.03, 0.03, 0.5], [0.28, 0.4, -0.55], DARK, { ghost: true, rot: [0.25, 0, 0] }), box([0.03, 0.03, 0.5], [-0.28, 0.4, -0.55], DARK, { ghost: true, rot: [0.25, 0, 0] }),
      box([0.03, 0.14, 0.03], [0.25, 0.14, -0.3], DARK), box([0.03, 0.14, 0.03], [-0.25, 0.14, -0.3], DARK),
    ],
  },
  /** A cement mixer: a drum tipped on a frame, on two wheels. */
  mixer: {
    mass: 130,
    parts: [
      box([0.45, 0.25, 0.6], [0, 0.45, 0], 0xe07a28),
      cyl(0.45, 0.5, [0, 1.15, 0.1], 0xe0a020, { rot: [0.6, 0, 0], ghost: true }),
      cyl(0.3, 0.06, [0, 1.6, 0.42], 0x30363d, { rot: [0.6, 0, 0], ghost: true }),
      cyl(0.2, 0.05, [0.48, 0.2, -0.3], 0x1c1d20, { rot: [0, 0, Math.PI / 2] }), cyl(0.2, 0.05, [-0.48, 0.2, -0.3], 0x1c1d20, { rot: [0, 0, Math.PI / 2] }),
      box([0.05, 0.2, 0.05], [0, 0.2, 0.5], DARK),
    ],
  },
  /** Pigeons, pecking about until something comes at them. */
  pigeons: {
    mass: 2,
    effect: 'feathers',
    parts: [[-0.3, 0.1], [0.1, -0.25], [0.35, 0.2], [-0.05, 0.3], [0, 0]].map(([x, z], n) => box([0.07, 0.06, 0.11], [x, 0.06, z], n % 2 ? 0x8a8f96 : 0xb9bcc0, { rot: [0, x * 5, 0] })),
  },
  /** A candidate's banner on a bamboo pole. */
  flagOrange: { mass: 6, parts: [foot(0.18, DARK), cyl(0.025, 1.5, [0, 1.5, 0], 0xc9b27a), box([0.02, 0.85, 0.28], [0, 2.05, 0.3], 0xe07a28, { ghost: true })] },
  flagPurple: { mass: 6, parts: [foot(0.18, DARK), cyl(0.025, 1.5, [0, 1.5, 0], 0xc9b27a), box([0.02, 0.85, 0.28], [0, 2.05, 0.3], 0x7a3fa0, { ghost: true })] },
  flagTeal: { mass: 6, parts: [foot(0.18, DARK), cyl(0.025, 1.5, [0, 1.5, 0], 0xc9b27a), box([0.02, 0.85, 0.28], [0, 2.05, 0.3], 0x3f9a94, { ghost: true })] },
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
  /** Set for one that is to roll: what is round of it is made with its edges rounded off, so that it rolls over the joins in the ground and does not catch on them. */
  rolls?: boolean;
  /** Where its base sits: [x, y, z], y being the height of the ground there. */
  pos: Vec3;
  rotY?: number;
  /** Leant forward (down toward where it faces, +Z once turned) by this much, radians: something laid along a slope. */
  tilt?: number;
  /** For a piece of something that collapses: the way it falls, [x, z]. */
  lean?: [number, number];
}
