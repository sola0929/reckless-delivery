import type { Vec3 } from '../config';
import type { ObjectDesc, ObjectKindId } from './objects';
import type { Look, Relief } from './relief';
import type { CrowdDesc, DecalDesc, OutageDesc, PropDesc, SignDesc, Vec2 } from './types';

// Level 4's second place: the market, the old public market hall at the end of the waterfront street, the afternoon
// before the typhoon. Everyone is in buying what is left at twice the price, crossed out and written up again; the
// stallholders have stacked their stock high out in front of their stalls to sell it as fast as it goes, bottled water and
// rice and noodles by the case, crates of watermelons, cases of eggs; the old roof leaks, buckets under the drips. The way
// through winds through the hall's aisles, 6.5 m between the stalls, all over the hall, and the stacks out in them leave a
// way through that bends, three and a half to five metres wide: touch a stack and it comes down, onto the truck, the heavy
// ones onto its load. A little way in the power goes, and it is dark but for the headlights: the stacks, the turns, the
// cross aisles are seen only once they are lit. Two of those cross aisles go nowhere, stock stacked across their ends.
//
//   the greens        up from the south door, crates of greens stacked at the stalls: the stacks shown, harmless
//   the fruit         west, between two turns
//   the dry goods     north, the grocers' rice and bottled water stacked high, the way between bending one way and the
//                     other: the hard part; an aisle off to the left that goes nowhere
//   the eggs          east, the egg wholesalers' cases stacked at their fronts: they break, and splash
//   the fish          north, the fishmongers' boxes of fish on ice stacked high, an aisle off to the right that goes
//                     nowhere; east, south, and east out of the back door
//
// Hanging lamps over the aisles swing when the truck brushes them: only to be seen.

/** The hall, its eaves. */
export const HALL = { x0: -20, x1: 40, z0: 236, z1: 372 };
export const EAVE = 4.5;
/** The aisles, 6.5 m wide; the way through them, corner to corner, from the south door to the east one. */
export const AISLE = 6.5;
// The stretches across the hall each down the middle of three rows of stalls, so as to take out no more of them than they
// must: x and z both on the stalls' lines.
export const MARKET_ROUTE: Vec2[] = [[2.8, HALL.z0], [2.8, 269.1], [-10, 269.1], [-10, 311.1], [15.6, 311.1], [15.6, 356.1], [34.8, 356.1], [34.8, 340], [HALL.x1, 340]];
export const OUT = 340;

const HALF = AISLE / 2;
/** At each turn, the stalls on its inside cut off this far from the corner, across and along together; and none within
 * this far of the turn's middle either way, its outside too: the truck is long, and needs a little square to turn in. */
const CORNER_CUT = 6;
const CORNER_SQUARE = 5;
/** A stall: how long, how deep its counter, how deep the whole of it. The rows of them in the hall: their columns, two
 * stalls back to back and then a walkway for people, 6.4 m each, from this X; their lengths from this Z. */
const STALL = 3, COUNTER = 1.0, DEEP = 2.4;
const COLUMN = 6.4, COLUMN_X = HALL.x0 + 1.2, ROW_Z = HALL.z0 + 1.6;

/** What each stretch of the way is: by its place in the route. */
type Zone = 'greens' | 'fruit' | 'dry' | 'eggs' | 'fish';
const ZONES: Zone[] = ['greens', 'fruit', 'dry', 'eggs', 'fish', 'fish', 'fish', 'fish'];
/** The names over the stalls, and the prices they are shouting, by what they sell. */
const NAMES: Record<Zone, string[]> = {
  greens: ['阿珠菜攤', '大發青菜', '秀英蔬菜', '阿美青菜', '玉蘭菜攤', '有福青菜', '阿英蔬菜', '春美菜攤', '金玉青菜', '素芬菜攤', '老王蔥薑蒜', '黃家根莖'],
  fruit: ['林家水果', '鄭記果行', '甜蜜果園', '阿福水果', '大順水果', '好運水果', '鮮果屋', '阿財果行'],
  dry: ['永興雜貨', '福利商行', '大同米行', '金泰雜貨', '老吳乾貨', '順發商號', '新生雜貨', '合興米店'],
  eggs: ['林記蛋行', '阿嬌豆腐', '黃家蛋行', '老陳豆腐', '大成蛋行', '福記蛋行'],
  fish: ['阿海魚舖', '南安鮮魚', '海龍魚行', '阿雄海產', '新港鮮魚', '金漁海產', '大海魚行', '阿勇鮮魚'],
};
const PRICES: Record<Zone, string[]> = {
  greens: ['高麗菜 一顆150', '地瓜葉 一把50', '空心菜 一把60', '青江菜 一把50', '小白菜 一把60', '菠菜 一把70', '大白菜 一顆120', 'A菜 一把60', '青蔥 一把80', '紅蘿蔔 一斤40'],
  fruit: ['香蕉 一斤60', '柳丁 十顆150', '蘋果 四顆100', '芭樂 三顆100', '蓮霧 一斤120', '橘子 一斤50', '鳳梨 一顆80', '西瓜 一顆250'],
  dry: ['礦泉水 一箱120', '泡麵 一箱380', '白米 一包350', '罐頭 一打300', '衛生紙 一串199', '蠟燭 一包50', '電池 四顆100', '卡式瓦斯 三罐150'],
  eggs: ['雞蛋 一盒80', '豆腐 一塊30', '鴨蛋 十顆90', '豆干 一斤60', '皮蛋 六顆60', '雞蛋 一箱900'],
  fish: ['白帶魚 一斤300', '鯖魚 一尾80', '鮪魚 一斤450', '花枝 一斤350', '蝦子 一斤500', '透抽 一斤400', '虱目魚 一尾150', '蛤蜊 一斤120'],
};
/** What is heaped on each kind of stall's counter, colour by colour. */
const HEAPS: Record<Zone, number[]> = {
  greens: [0x4f8a4a, 0x7fae5a, 0x3f7a3a, 0x9cc46a],
  fruit: [0xf2a33a, 0xd23c2c, 0xe8c840, 0x9cc46a],
  dry: [0xd8c8a0, 0xc8372d, 0xe8b82e, 0xf2efe6],
  eggs: [0xf2e8d0, 0xe8dcc0, 0xf2f2ee, 0xd8c8a0],
  fish: [0xf2f2ee, 0xd8e8f0, 0x9aa4a8, 0xe07a5a],
};
/** How far in from the south door the power goes, metres. */
const POWER_OFF = 8;
const CANOPIES = [0xc8372d, 0x2f62a8, 0x3f9a5a, 0xe0b020, 0xd8d8d0];

/**
 * The stacks out in the aisles: along which stretch of the way (by its place in the route), from and to how far along
 * it, on which side (+1 the left going along it, -1 the right), how far out into the aisle from the stalls' fronts, and
 * of what. Laid so that the way between bends a little one way and the other and is nowhere narrower than about 4 m, and
 * none within ten metres after a turn or eight before one: a truck seven and a half metres long needs that to come
 * straight out of a turn, and to line up for the next.
 */
type Pile = [number, number, number, -1 | 1, number, ObjectKindId];
const PILES: Pile[] = [
  // The greens: crates of greens, light, to be learnt on: one side, the other, the one again.
  [0, 5, 9, 1, 1.2, 'vegCrate'], [0, 12, 16, -1, 1.2, 'vegCrate'], [0, 18, 22, 1, 1.2, 'vegCrate'], [0, 21, 24, -1, 0.84, 'melonCrate'],
  // The fruit, between two turns, has none: the truck needs all of it to swing round.
  // The dry goods, once the truck is straight out of the turn: water stacked two deep on the left; then, four and a half
  // metres on, two deep on the right. Either way past is wide, but they do not line up: the truck must swing across
  // between them, which it can slowly and cannot fast. The second puts it over toward the aisle off to the left, which
  // goes nowhere.
  [2, 18, 23, 1, 1.6, 'waterPack'],
  [2, 27.5, 33, -1, 1.6, 'waterPack'],
  // The eggs: one stack of cases, out on the left.
  [3, 12, 17, 1, 1.2, 'eggCase'],
  // The fish, once the truck is straight: boxes of fish on ice on the left, and again on the left, the truck kept over to
  // the right past the aisle off that way that goes nowhere; then on the right.
  [4, 16, 21, 1, 1.6, 'fishBox'],
  [4, 28, 33, 1, 1.6, 'fishBox'],
  [4, 34.5, 38, -1, 1.2, 'fishBox'],
  // The last three stretches, each between two turns, have none.
];
/**
 * The cross aisles that go nowhere: off which stretch, how far along it, to which side, how long from the way's middle,
 * and what is stacked across the far end. In the dark they look like any turn.
 */
type Branch = [number, number, -1 | 1, number, ObjectKindId];
const BRANCHES: Branch[] = [
  [2, 26.75, 1, 12.2, 'riceBag'],
  [4, 27.75, -1, 12.2, 'fishBox'],
];
/** Where turns come close together and leave the floor open between them, the stock brought out there: by the fruit, the
 * eggs and dry goods, and the back door, the fishmongers' to go. Each so far from the careful way past at least, metres,
 * and so far apart. */
type Goods = 'fruit' | 'eggs' | 'fish';
const STAGED: { x0: number; z0: number; x1: number; z1: number; goods: Goods; every: number }[] = [
  { x0: -17, z0: 262, x1: 9, z1: 277, goods: 'fruit', every: 2.6 },
  { x0: -17, z0: 304, x1: 22, z1: 318, goods: 'eggs', every: 2.6 },
  { x0: 19, z0: 333, x1: 39.2, z1: 364, goods: 'fish', every: 2.6 },
];
const STAGED_CLEAR = 3.3;
/** What is brought out in each, by turns: a kind, how many high. */
const STAGED_GOODS: Record<Goods, [ObjectKindId, number][]> = {
  fruit: [['fruitCrate', 2], ['melonCrate', 2], ['fruitCrate', 3], ['fruitCrate', 1], ['basin', 1]],
  eggs: [['eggCase', 3], ['noodleBox', 3], ['tissueBale', 2], ['eggCase', 2], ['riceSack', 1]],
  fish: [['fishBox', 3], ['fishBox', 2], ['iceChest', 1], ['foamBox', 3], ['basin', 1]],
};
/** How high each of those is, to stack them. */
const STAGED_UP: Partial<Record<ObjectKindId, number>> = { fruitCrate: 0.3, melonCrate: 0.4, eggCase: 0.32, noodleBox: 0.34, tissueBale: 0.44, fishBox: 0.3, foamBox: 0.32 };
/** The cross aisles that go nowhere: where each meets the way, and its far end. For the test of backing out of them. */
export function deadEnds(): { junction: Vec2; end: Vec2 }[] {
  return BRANCHES.map(([leg, s, side, long]) => {
    const { from, dir, left } = legOf(leg);
    const junction: Vec2 = [from[0] + dir[0] * s, from[1] + dir[1] * s];
    return { junction, end: [junction[0] + left[0] * side * long, junction[1] + left[1] * side * long] };
  });
}
/** Where a cross aisle meets the way, its two corners cut off as a turn's are, and a square cleared round its middle: in the
 * dark it is to look like any turn, and a truck fooled into it must be able to turn in and back out. */
const BRANCH_CUT = CORNER_CUT;
/** How far out over the aisle the top of a stack leans, as a share of a piece's width across: a stack whose weight is then
 * still over its foot, standing until it is knocked. */
const LEAN_OUT = 0.35;
/** Each kind of stock's piece, across, along and up, metres; and how many it is stacked high: higher than the truck's load,
 * as everything is piled up for the storm. */
const PIECE: Partial<Record<ObjectKindId, [number, number, number, number]>> = {
  vegCrate: [0.6, 0.46, 0.28, 7],
  melonCrate: [0.84, 0.6, 0.4, 5],
  waterPack: [0.8, 0.6, 0.3, 9],
  riceBag: [0.84, 0.56, 0.3, 9],
  tissueBale: [0.72, 0.52, 0.44, 4],
  noodleBox: [0.64, 0.48, 0.34, 6],
  eggCase: [0.6, 0.6, 0.32, 5],
  fishBox: [0.72, 0.48, 0.3, 6],
};

/** How far out into the aisle a pile really stands: as many pieces deep as fit in what it was given, none overlapping. */
function rowsOf(kind: ObjectKindId, deep: number): number {
  return Math.max(1, Math.floor(deep / PIECE[kind]![0] + 0.05));
}
/** How far out into the aisle a pile reaches: its foot, and the lean of its top out over the aisle beyond that. */
const depthOf = (kind: ObjectKindId, deep: number) => (rowsOf(kind, deep) + LEAN_OUT) * PIECE[kind]![0];

export interface MarketParts {
  props: PropDesc[];
  objects: ObjectDesc[];
  decals: DecalDesc[];
  crowds: CrowdDesc[];
  signs: SignDesc[];
  lamps: Vec3[];
  outage: OutageDesc;
}

/** A stretch of the way: where it starts, its heading as a unit along the ground, its length, and the unit to its left. */
function legOf(n: number): { from: Vec2; dir: Vec2; long: number; left: Vec2 } {
  const [a, b] = [MARKET_ROUTE[n], MARKET_ROUTE[n + 1]];
  const long = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dir: Vec2 = [(b[0] - a[0]) / long, (b[1] - a[1]) / long];
  // Going toward +Z, the left is +X: the truck faces +Z with +X on its left.
  return { from: a, dir, long, left: [dir[1], -dir[0]] };
}

/** The way a careful driver takes past the stacks, as points along the route: each turn wide through the corner's
 * middle; along each stretch held where it is as long as it can be, three quarters of a metre clear of the stacks, and going over
 * smoothly from the way past one to the way past the next: for the driver that tries it headless. */
export function marketLine(): Vec2[] {
  const out: Vec2[] = [];
  const CLEAR = 0.75, TRUCK_HALF = 1.3;
  for (let n = 0; n + 1 < MARKET_ROUTE.length; n++) {
    const { from, dir, long, left } = legOf(n);
    if (n) out.push(from);
    // Each stretch where stacks stand, and between which offsets from the aisle's middle the truck can pass them.
    const spans: [number, number, number, number][] = [];
    for (const [leg, s0, s1] of PILES) {
      if (leg !== n) continue;
      let l = 0, r = 0;
      for (const [leg2, a0, a1, side, deep, kind] of PILES) if (leg2 === n && a0 < s1 && a1 > s0) side > 0 ? (l = Math.max(l, depthOf(kind, deep))) : (r = Math.max(r, depthOf(kind, deep)));
      spans.push([s0, s1, -(HALF - r) + TRUCK_HALF + CLEAR, HALF - l - TRUCK_HALF - CLEAR]);
    }
    spans.sort((p, q) => p[0] - q[0]);
    // Kept where it is as far as each allows: the least going across.
    const held: [number, number][] = [[0, 0]];
    let off = 0;
    for (const [s0, s1, lo, hi] of spans) {
      off = Math.max(lo, Math.min(hi, off));
      held.push([s0, off], [s1, off]);
    }
    held.push([long, 0]);
    held.sort((p, q) => p[0] - q[0]);
    const last = n === MARKET_ROUTE.length - 2;
    for (let s = n ? HALF + 1 : 0; s <= (last ? long : long - HALF - 1); s += 1.5) {
      const k = held.findIndex(([at]) => at > s);
      const [s0, o0] = held[Math.max(0, k - 1)], [s1, o1] = held[k < 0 ? held.length - 1 : k];
      const o = s1 > s0 ? o0 + ((o1 - o0) * (s - s0)) / (s1 - s0) : o0;
      out.push([from[0] + dir[0] * s + left[0] * o, from[1] + dir[1] * s + left[1] * o]);
    }
  }
  return out;
}

export function market(relief: Relief, floor: Look): MarketParts {
  const props: PropDesc[] = [];
  const objects: ObjectDesc[] = [];
  const decals: DecalDesc[] = [];
  const crowds: CrowdDesc[] = [];
  const signs: SignDesc[] = [];
  const lamps: Vec3[] = [];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, more: Partial<PropDesc> = {}) =>
    props.push({ shape: 'box', size: [Math.abs(x1 - x0) / 2, (y1 - y0) / 2, Math.abs(z1 - z0) / 2], pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color, ...more });
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, y = 0, more: Partial<ObjectDesc> = {}) => objects.push({ kind, pos: [x, y, z], rotY, ...more });
  const rect = (x0: number, z0: number, x1: number, z1: number): [number, number][] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const sign = (text: string, x: number, y: number, z: number, rotY: number, wide: number, colors: [string, string, string]) => signs.push({ kind: 'name', text, pos: [x, y, z], rotY, wide, colors });

  // The hall: its walls, a door in the south and one in the east at the back; its floor.
  const wall = (x0: number, z0: number, x1: number, z1: number) => box(x0, 0, z0, x1, EAVE, z1, 0xc9c2b2, { fade: true });
  const [sx] = MARKET_ROUTE[0];
  const southDoor: [number, number] = [sx - 4, sx + 4], eastDoor: [number, number] = [OUT - 4, OUT + 4];
  wall(HALL.x0, HALL.z0 - 0.3, southDoor[0], HALL.z0);
  wall(southDoor[1], HALL.z0 - 0.3, HALL.x1, HALL.z0);
  wall(HALL.x0, HALL.z1, HALL.x1, HALL.z1 + 0.3);
  wall(HALL.x0 - 0.3, HALL.z0, HALL.x0, HALL.z1);
  wall(HALL.x1, HALL.z0, HALL.x1 + 0.3, eastDoor[0]);
  wall(HALL.x1, eastDoor[1], HALL.x1 + 0.3, HALL.z1);
  relief.area(rect(HALL.x0, HALL.z0, HALL.x1, HALL.z1), 0, floor);

  // The south door: its lintel, the shutter rolled up into its box above, the market's name over it; the square before
  // it with the shoppers' scooters along the wall either side and a fruit seller or two set up outside. The east door's
  // shutter half down, the market shutting early.
  box(southDoor[0], 3.9, HALL.z0 - 0.3, southDoor[1], EAVE, HALL.z0, 0xb8b0a0, { fade: true });
  box(southDoor[0], 3.55, HALL.z0 - 0.55, southDoor[1], 3.9, HALL.z0 - 0.3, 0x8a8f96, { fade: true, overhead: true });
  // Faded while the truck is just in at the door, under it from where the camera follows.
  signs.push({ kind: 'name', text: '南安公有零售市場', pos: [sx, 4.6, HALL.z0 - 0.45], rotY: Math.PI, wide: 7, colors: ['#1f4f9a', '#f2efe6', '#f2c12e'], fadeZone: [[sx - 5, 0, HALL.z0 - 2], [sx + 5, 4.4, HALL.z0 + 24]] });
  for (const [x0, x1] of [[HALL.x0 + 1, southDoor[0] - 1], [southDoor[1] + 1, HALL.x1 - 2]]) {
    for (let x = x0; x < x1; x += 0.95) object((['scooterRed', 'scooterWhite', 'scooterBlue', 'scooterBlack', 'scooterTeal'] as const)[((Math.round(x * 7) % 5) + 5) % 5], x, HALL.z0 - 1.6, 0);
  }
  for (const [x, z] of [[16, 228.5], [22, 228.5], [-8, 229]]) object(x > 20 ? 'fruitOrange' : x > 0 ? 'fruitMelon' : 'flowerStall', x, z, Math.PI);
  crowds.push({ area: [-6, 225, 34, 231], count: 10, y: 0 });

  // The rest of the square, at the street's end before the market's door, its traders packing up early for the storm.
  // A short easy stretch between the alleys and the dark market, and so full: things to knock over everywhere off the way
  // to the door, a few of them out on it.
  {
    const SCOOTERS = ['scooterRed', 'scooterWhite', 'scooterBlue', 'scooterBlack', 'scooterTeal'] as const;
    // Its edge on the harbour, as the street's quay has: a low wall capped yellow, bollards, old tyres hung over.
    box(8, 0, 215.7, 40, 0.55, 216, 0xa8a69c);
    box(8, 0.55, 215.65, 40, 0.65, 216.05, 0xe0b020, { ghost: true });
    for (let x = 12; x < 40; x += 9) {
      props.push({ shape: 'cylinder', size: [0.2, 0.3, 0], pos: [x, 0.3, 217], color: 0x2a2c30 });
      props.push({ shape: 'cylinder', size: [0.3, 0.06, 0], pos: [x, 0.62, 217], color: 0x2a2c30, ghost: true });
      props.push({ shape: 'cylinder', size: [0.42, 0.14, 0], pos: [x + 4, -0.6, 215.6], rot: [Math.PI / 2, 0, 0], color: 0x1f2124, ghost: true });
    }
    // Along it the fishermen's wives selling the last of the catch off the boats, their backs to the water, under a
    // striped canvas on poles; ice chests, boxes of fish packed to go, tubs, stools; a trolley of boxes loaded.
    for (let k = 0; k < 8; k++) box(10 + k * 3, 2.6, 217.4, 13 + k * 3, 2.66, 221.6, k % 2 ? 0xf2efe6 : 0x2f62a8, { ghost: true, fade: true, overhead: true, rot: [0.06, 0, 0] });
    for (const x of [10.2, 22, 33.8]) for (const z of [217.6, 221.4]) box(x - 0.05, 0, z - 0.05, x + 0.05, z < 219 ? 2.5 : 2.75, z + 0.05, 0x8a8f96);
    for (const x of [12.5, 17, 21.5, 26]) object('fishStall', x, 219.6, Math.PI);
    for (const x of [14.7, 23.8]) object('iceChest', x, 218, Math.PI / 2);
    for (const [x, z] of [[19.3, 218.2], [28.4, 218.4]]) object('basin', x, z);
    for (const [x, z] of [[15.2, 221.4], [24.2, 221.3], [11, 221.2]]) object('bucket', x, z);
    for (const [x, z] of [[13.6, 221.8], [18.4, 221.9], [22.9, 222], [27.2, 221.8]]) object('stool', x, z);
    for (let k = 0; k < 9; k++) object('fishBox', 29.6 + (k % 3) * 0.75, 218.2 + Math.floor(k / 3) * 0.55, 0, 0);
    for (let k = 0; k < 6; k++) object('fishBox', 29.6 + (k % 3) * 0.75, 218.2 + Math.floor(k / 3) * 0.55, 0, 0.34);
    object('crateTrolley', 33.2, 220.4, 0.3);
    object('gasCylinder', 35.4, 218.3);
    object('netHeap', 37.2, 218.6, 0.4);
    // The greengrocer's van backed up to the market's wall, its crates being got in: stacked behind it, one trolley
    // load tipped, the cabbages rolled out across the way to the door.
    props.push({ shape: 'box', size: [0.9, 0.7, 2.2], pos: [33.6, 0.9, 231.2], rot: [0, Math.PI / 2 + 0.06, 0], color: 0x2f62a8, vehicle: 'pickup' });
    for (let k = 0; k < 8; k++) object('vegCrate', 28.6 + (k % 2) * 0.7, 230.3 + Math.floor(k / 2) * 0.6 - (k >= 4 ? 1.2 : 0), 0, k >= 4 ? 0.3 : 0);
    object('crateTrolley', 7.2, 229.6, -0.4);
    for (const [x, z, a] of [[6.2, 228.4, 1.2], [5.6, 229.3, 2.4]] as const) object('vegCrate', x, z, a, 0, { tilt: 1.2 });
    for (const [x, z] of [[4.8, 228.1], [3.6, 229.6], [2.1, 228.9], [5.1, 230.6], [0.6, 230.1], [3.1, 231.4]]) object('cabbage', x, z);
    // The fruit sellers between: the melon man's and the orange woman's stalls, their umbrellas; one umbrella gone over
    // in a gust, a tarpaulin roped down over what is packed; a grandmother's trolley left, a table and its stools out
    // from the noodle stall by the door.
    object('umbrella', 19.2, 225.4, 0.8, 0, { tilt: 1.3 });
    object('tarpHeap', 26.6, 226.2, 0.3);
    for (const [x, z] of [[14.2, 226.6], [24, 226.8]]) for (let k = 0; k < 3; k++) object('fruitCrate', x + k * 0.6, z, 0);
    object('shoppingCart', 10.4, 226.8, 0.6);
    object('table', -1.6, 233);
    for (let k = 0; k < 4; k++) object('stool', -1.6 + Math.cos(k * 1.57 + 0.4) * 0.9, 233 + Math.sin(k * 1.57 + 0.4) * 0.9);
    // On the old town's corner a betel-nut stand, still lit, its scooters at the kerb.
    object('betelBooth', -5.4, 226.8, Math.PI / 2);
    for (let k = 0; k < 3; k++) object(SCOOTERS[k + 1], -3.9, 223.2 + k * 0.95, Math.PI / 2);
    // By the door, the market's notice on its stand: shut early for the typhoon. Cones across one side of the door.
    for (const x of [southDoor[1] + 2.1, southDoor[1] + 5.1]) box(x - 0.04, 0, 232.7, x + 0.04, 1.6, 232.78, 0x5a5f66);
    signs.push({ kind: 'name', text: '颱風警報　今日提早收市', colors: ['#c8262a', '#f2efe6', '#f2efe6'], wide: 3.4, pos: [southDoor[1] + 3.6, 1.75, 232.7], rotY: Math.PI });
    for (let k = 0; k < 4; k++) object('cone', southDoor[0] - 0.5 - k * 1.3, 233.4);
    // The drain along the market's wall, its grating.
    decals.push({ pos: [10, 235.1], size: [58, 0.35], color: 0x2a2e32 });
    for (let x = -18; x < 38; x += 0.9) decals.push({ pos: [x, 235.1], size: [0.06, 0.33], color: 0x55595e });
  }
  box(HALL.x1, 3.6, eastDoor[0], HALL.x1 + 0.3, EAVE, eastDoor[1], 0xb8b0a0, { fade: true });
  for (let k = 0; k < 6; k++) box(HALL.x1 + 0.3, 3.62 + k * 0.14, eastDoor[0], HALL.x1 + 0.36, 3.74 + k * 0.14, eastDoor[1], 0x9aa0a6, { fade: true, overhead: true });

  // The aisles: the route's stretches, each as wide as an aisle; at each turn the stalls' corner cut off on the inside.
  const aisles: [number, number, number, number][] = [];
  const corners: Vec2[] = [];
  const cuts: Vec2[] = [];
  const squares: Vec2[] = [];
  const turns = MARKET_ROUTE.slice(1, -1);
  for (let n = 0; n + 1 < MARKET_ROUTE.length; n++) {
    const [a, b] = [MARKET_ROUTE[n], MARKET_ROUTE[n + 1]];
    aisles.push([Math.min(a[0], b[0]) - HALF, Math.min(a[1], b[1]) - HALF, Math.max(a[0], b[0]) + HALF, Math.max(a[1], b[1]) + HALF]);
    if (n > 0) {
      const p = legOf(n - 1), q = legOf(n);
      corners.push([a[0] + (q.dir[0] - p.dir[0]) * HALF, a[1] + (q.dir[1] - p.dir[1]) * HALF]);
    }
  }
  // The cross aisles that go nowhere: as wide as any other, out from the way's side to their ends; their corners cut.
  const branchEnds: { at: Vec2; out: Vec2; along: Vec2; kind: ObjectKindId }[] = [];
  for (const [leg, s, side, long, kind] of BRANCHES) {
    const { from, dir, left } = legOf(leg);
    const out: Vec2 = [left[0] * side, left[1] * side];
    const p: Vec2 = [from[0] + dir[0] * s, from[1] + dir[1] * s], q: Vec2 = [p[0] + out[0] * long, p[1] + out[1] * long];
    const wx = Math.abs(dir[0]) * HALF, wz = Math.abs(dir[1]) * HALF;
    aisles.push([Math.min(p[0], q[0]) - wx, Math.min(p[1], q[1]) - wz, Math.max(p[0], q[0]) + wx, Math.max(p[1], q[1]) + wz]);
    squares.push(p);
    for (const k of [-1, 1]) cuts.push([p[0] + dir[0] * k * HALF + out[0] * HALF, p[1] + dir[1] * k * HALF + out[1] * HALF]);
    branchEnds.push({ at: q, out, along: dir, kind });
  }
  const inAisle = (x: number, z: number) =>
    cuts.some(([cx, cz]) => Math.abs(x - cx) + Math.abs(z - cz) < BRANCH_CUT) ||
    aisles.some(([x0, z0, x1, z1]) => x > x0 - 0.3 && x < x1 + 0.3 && z > z0 - 0.3 && z < z1 + 0.3) || corners.some(([cx, cz]) => Math.abs(x - cx) + Math.abs(z - cz) < CORNER_CUT) || [...turns, ...squares].some(([cx, cz]) => Math.abs(x - cx) < CORNER_SQUARE && Math.abs(z - cz) < CORNER_SQUARE);
  /** Which stretch of the way a place is nearest, for what the stalls there sell. */
  const zoneAt = (x: number, z: number): Zone => {
    let best = 0, near = Infinity;
    for (let n = 0; n + 1 < MARKET_ROUTE.length; n++) {
      const [a, b] = [MARKET_ROUTE[n], MARKET_ROUTE[n + 1]];
      const lx = b[0] - a[0], lz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * lx + (z - a[1]) * lz) / (lx * lx + lz * lz)));
      const d = Math.hypot(x - a[0] - lx * t, z - a[1] - lz * t);
      if (d < near) [near, best] = [d, n];
    }
    return ZONES[best];
  };

  // Where the stock is stacked out in the aisles: the stalls behind those set nothing else out on the floor, the stock
  // being what they are selling.
  const stacked: [number, number, number, number][] = PILES.map(([leg, s0, s1, side, deep, kind]) => {
    const { from, dir, left } = legOf(leg);
    const o0 = HALF - depthOf(kind, deep), o1 = HALF + 1.2;
    const xs = [s0, s1].flatMap((s) => [o0, o1].map((o) => from[0] + dir[0] * s + left[0] * side * o));
    const zs = [s0, s1].flatMap((s) => [o0, o1].map((o) => from[1] + dir[1] * s + left[1] * side * o));
    return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
  });
  const onStock = (x: number, z: number) => stacked.some(([x0, z0, x1, z1]) => x > x0 - 0.6 && x < x1 + 0.6 && z > z0 - 0.6 && z < z1 + 0.6);

  // A stall facing an aisle along Z: a tiled counter at its front with what it sells heaped on it and set out on the
  // floor before it, its crates stacked behind, a canopy, its name hung at the front, a bare bulb, its price on a board.
  // `front` its front's X; `side` -1 for one west of its aisle (going back toward -X), +1 east.
  let count = 0;
  const stall = (front: number, side: -1 | 1, z0: number, zone: Zone) => {
    const n = count++;
    const xAt = (d: number) => front + (side < 0 ? -d : d);
    const zm = z0 + STALL / 2, face = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    const closed = n % 8 === 5;
    box(xAt(0), 0, z0 + 0.08, xAt(COUNTER), 0.85, z0 + STALL - 0.08, 0xe4e4dc);
    box(xAt(-0.02), 0.15, z0 + 0.12, xAt(0), 0.6, z0 + STALL - 0.12, n % 2 ? 0x5f8fb0 : 0x3f7a6a, { ghost: true });
    for (let k = 0; k < 3; k++) box(xAt(DEEP - 0.55), k * 0.32, z0 + 0.3 + k * 0.15, xAt(DEEP - 0.05), k * 0.32 + 0.3, z0 + 0.9 + k * 0.15, [0x3f9a5a, 0xe0b020, 0xc8372d, 0x2f62a8][(n + k) % 4]);
    box(xAt(COUNTER), 0, z0, xAt(DEEP), 1.6, z0 + 0.06, 0x8a8f96);
    const canopy = CANOPIES[n % CANOPIES.length];
    box(xAt(-0.2), 2.6, z0, xAt(DEEP), 2.66, z0 + STALL, canopy, { ghost: true, rot: [0, 0, side * 0.08] });
    if (canopy !== 0xd8d8d0) for (let k = 1; k < 5; k += 2) box(xAt(-0.2), 2.67, z0 + k * 0.6, xAt(DEEP), 2.69, z0 + (k + 1) * 0.6, 0xf2efe6, { ghost: true, rot: [0, 0, side * 0.08] });
    for (const dz of [0.1, STALL - 0.1]) box(xAt(0.02), 0.85, z0 + dz - 0.03, xAt(0.08), 2.6, z0 + dz + 0.03, 0x8a8f96);
    const names = NAMES[zone], prices = PRICES[zone];
    sign(names[n % names.length], xAt(0.05), 2.35, zm, face, 2.2, n % 3 ? ['#c8262a', '#f2efe6', '#f2efe6'] : ['#f2c12e', '#c8262a', '#c8262a']);
    props.push({ shape: 'sphere', size: [0.09, 0.09, 0.09], pos: [xAt(0.8), 2.2, zm], color: 0xfff2b0, ghost: true });
    box(xAt(0.79), 2.29, zm - 0.01, xAt(0.81), 2.6, zm + 0.01, 0x2a2c30, { ghost: true });
    if (closed) {
      // Shut early: a blue tarpaulin over its counter.
      box(xAt(-0.05), 0.4, z0 + 0.05, xAt(COUNTER + 0.05), 1.05, z0 + STALL - 0.05, 0x2f62a8, { ghost: true });
      sign(n % 2 ? '今日提早收攤' : '颱風休息', xAt(-0.08), 1.3, zm, face, 1.6, ['#f2efe6', '#24262a', '#c8262a']);
      return;
    }
    sign(prices[n % prices.length], xAt(0.15), 1.25, z0 + 0.9, face, 1.1, ['#f2efe6', '#c8262a', '#f2c12e']);
    HEAPS[zone].forEach((c, k, all) => box(xAt(0.12), 0.85, z0 + 0.2 + k * ((STALL - 0.4) / all.length), xAt(COUNTER - 0.08), 0.85 + 0.15 + (k % 2) * 0.08, z0 + 0.2 + (k + 1) * ((STALL - 0.4) / all.length) - 0.06, c, { ghost: true }));
    // What it has set out on the floor in front, unless its stock is stacked there.
    const out = xAt(-0.35);
    if (onStock(out, zm)) return;
    if (zone === 'greens') {
      if (n % 2) for (const [dz, y] of [[-0.36, 0], [0, 0], [0.36, 0], [-0.18, 0.3], [0.18, 0.3], [0, 0.58]] as const) object('cabbage', out, z0 + 1.5 + dz, 0, y);
      else object('trayVeg', out, z0 + 1.5);
    } else if (zone === 'fruit') {
      for (const dz of [0.8, 2.2]) for (let k = 0; k < 2; k++) object('fruitCrate', out, z0 + dz, 0, k * 0.3);
      for (const dz of [0.6, 1.4, 2.2]) box(xAt(0.1), 1.6, z0 + dz - 0.15, xAt(0.3), 2.1, z0 + dz + 0.15, 0xe8c840, { ghost: true });
    } else if (zone === 'dry') {
      for (const dz of [0.8, 2.2]) object(n % 2 ? 'riceSack' : 'trayVeg', out, z0 + dz, 0.2);
    } else if (zone === 'eggs') {
      for (const dz of [0.7, 1.5, 2.3]) for (let k = 0; k < 3; k++) object('eggCase', out, z0 + dz, 0, k * 0.32);
    } else {
      object(n % 3 ? 'fishStall' : 'iceChest', out - side * 0.2, zm, Math.PI / 2);
      for (const dz of [0.3, 2.7]) object('foamBox', out, z0 + dz, 0);
    }
  };

  // The hall's stalls in their rows, back to back in pairs, a walkway for people between each pair and the next; none in
  // the aisles. Those that face an aisle along Z are its stalls, as above; the rest, the ones facing the walkways, a tiled
  // counter with what they sell heaped on it, most under a canopy, some shut under a tarpaulin.
  for (let x = COLUMN_X; x < HALL.x1 - 1; x += COLUMN) for (const dx of [0, DEEP]) {
    for (let z = ROW_Z; z < HALL.z1 - 1.6; z += STALL) {
      const x0 = x + dx, x1 = x0 + DEEP, cx = x0 + DEEP / 2, cz = z + STALL / 2;
      if (x1 > HALL.x1 - 0.3) continue;
      if (inAisle(cx, cz) || inAisle(x0, cz) || inAisle(x1, cz) || inAisle(cx, z) || inAisle(cx, z + STALL)) continue;
      const faces = dx ? 1 : -1, open = dx ? x1 : x0, zone = zoneAt(cx, cz);
      if (inAisle(open + faces * 0.8, cz)) {
        stall(open, (-faces) as -1 | 1, z, zone);
        continue;
      }
      const n = Math.round(x0 * 3 + z * 7);
      box(x0, 0, z + 0.05, x1, 0.85, z + 2.95, 0xd8d8d0);
      box(dx ? x1 : x0 - 0.02, 0.15, z + 0.1, dx ? x1 + 0.02 : x0, 0.6, z + 2.9, n % 2 ? 0x5f8fb0 : 0x3f7a6a, { ghost: true });
      if (n % 7 === 3) {
        box(x0 - 0.04, 0.4, z + 0.02, x1 + 0.04, 1.05, z + 2.98, 0x2f62a8, { ghost: true });
        continue;
      }
      const goods = HEAPS[zone];
      for (let k = 0; k < 3; k++) box(x0 + 0.3, 0.85, z + 0.25 + k * 0.85, x1 - 0.3, 0.97 + ((n + k) % 3) * 0.08, z + 0.95 + k * 0.85, goods[(n + k) % goods.length], { ghost: true });
      if (n % 5 !== 1) {
        const canopy = CANOPIES[n % CANOPIES.length];
        box(x0, 2.5, z, x1, 2.55, z + 3, canopy, { ghost: true });
        if (canopy !== 0xd8d8d0 && n % 2) for (let k = 1; k < 5; k += 2) box(x0, 2.56, z + k * 0.6, x1, 2.58, z + (k + 1) * 0.6, 0xf2efe6, { ghost: true });
      }
    }
  }
  // The people in the walkways, and in the aisles shopping.
  for (let x = COLUMN_X + DEEP * 2; x < HALL.x1 - 1.6; x += COLUMN) crowds.push({ area: [x + 0.2, HALL.z0 + 2, x + 1.4, HALL.z1 - 2], count: 9, y: 0 });
  for (const [x0, z0, x1, z1] of aisles) {
    const along = Math.max(x1 - x0, z1 - z0);
    crowds.push({ area: [x0 + 0.6, z0 + 0.6, x1 - 0.6, z1 - 0.6], count: Math.round(along / 2.2), y: 0 });
  }

  // The stock stacked out in the aisles: piece on piece, rows of stacks along each pile, the outermost row to the aisle a
  // piece lower, each leaning a little out toward the aisle and coming down that way, onto whatever touched it.
  for (const [leg, s0, s1, side, deep, kind] of PILES) {
    const { from, dir, left } = legOf(leg);
    const [across, along, up, high] = PIECE[kind]!;
    const out: Vec2 = [left[0] * side, left[1] * side];
    const lean: [number, number] = [-out[0], -out[1]];
    const yaw = Math.atan2(dir[0], dir[1]);
    const rows = rowsOf(kind, deep);
    for (let s = s0 + along / 2; s <= s1 - along / 2 + 0.01; s += along + 0.02) {
      for (let r = 0; r < rows; r++) {
        // From the stalls' fronts, HALF out from the way's middle, back in toward it, piece against piece.
        const o = HALF - across * (r + 0.5);
        const x = from[0] + dir[0] * s + out[0] * o, z = from[1] + dir[1] * s + out[1] * o;
        const layers = high - (r === rows - 1 && rows > 1 ? 1 : 0) - (Math.round(s * 3) % 2);
        // Piled up anyhow in the rush, each piece a little further out over the aisle than the one under it: still
        // standing, its weight over its foot, but ready to come over that way.
        const over = (across * LEAN_OUT) / Math.max(1, layers - 1);
        for (let k = 0; k < layers; k++) object(kind, x - out[0] * over * k, z - out[1] * over * k, yaw, k * up, { lean });
      }
    }
  }

  // Out in the aisles besides: the shoppers' trolleys left at the stalls; greengrocers' and grocers' trolleys of stock;
  // buckets and basins under the drips from the roof, the water coming down into them, wet round them.
  const at = (leg: number, s: number, off: number): Vec2 => {
    const { from, dir, left } = legOf(leg);
    return [from[0] + dir[0] * s + left[0] * off, from[1] + dir[1] * s + left[1] * off];
  };
  // None within a few metres of a turn: the truck needs the whole corner.
  for (const [leg, s, off, a] of [[0, 2.5, -2.4, 0.2], [0, 10.5, -2.4, 2.6], [2, 15.5, 2.4, 1.2], [2, 24, -2.3, -2.2], [3, 20, -2.4, 0.3], [4, 6, -2.4, 0.3], [4, 41, 2.4, 2.8]] as const) {
    const [x, z] = at(leg, s, off);
    object('shoppingCart', x, z, a);
  }
  for (const [leg, s, off] of [[0, 17.5, -2.1], [2, 16, -2.2], [4, 16.5, 2.1]] as const) {
    const [x, z] = at(leg, s, off);
    object('crateTrolley', x, z, Math.atan2(legOf(leg).dir[0], legOf(leg).dir[1]));
  }
  for (const [leg, s, off, kind] of [[0, 10.5, 1.2, 'bucket'], [2, 16, -0.4, 'basin'], [3, 22, 0.6, 'bucket'], [4, 17, 0.8, 'bucket'], [4, 40, -0.7, 'basin']] as const) {
    const [x, z] = at(leg, s, off);
    object(kind, x, z);
    box(x - 0.015, kind === 'bucket' ? 0.36 : 0.16, z - 0.015, x + 0.015, EAVE - 0.1, z + 0.015, 0x9fc4d8, { ghost: true });
    decals.push({ pos: [x + 0.2, z + 0.3], size: [1.6, 1.2], rotY: x, color: 0x6e7476 });
  }
  // At the end of each aisle that goes nowhere, the stock stacked right across it, high, the stall behind's; a trolley left
  // in it; a lamp over it.
  for (const { at: [x, z], out, along, kind } of branchEnds) {
    const [across, deep, up, high] = PIECE[kind]!;
    const yaw = Math.atan2(along[0], along[1]);
    for (let o = -HALF + deep / 2; o <= HALF - deep / 2 + 0.01; o += deep + 0.02) {
      const layers = high - (Math.round(o * 5) % 2 ? 1 : 0);
      for (const r of [0, 1]) {
        const bx = x - out[0] * (across * (r + 0.5)) + along[0] * o, bz = z - out[1] * (across * (r + 0.5)) + along[1] * o;
        for (let k = 0; k < layers - r; k++) object(kind, bx, bz, yaw, k * up, { lean: [-out[0], -out[1]] });
      }
    }
    object('crateTrolley', x - out[0] * 5 + along[0] * 2, z - out[1] * 5 + along[1] * 2, yaw);
    lamps.push([x - out[0] * 6, EAVE - 0.2, z - out[1] * 6]);
  }
  // The last stretches, the fishmongers packing up for the storm, each between two turns: at their stalls' fronts the empty
  // boxes stacked to go, three and two high, an ice chest, a basin of what is left on ice, a hose's bucket; their trolleys.
  for (const leg of [5, 6]) {
    const { long, dir } = legOf(leg);
    const yaw = Math.atan2(dir[0], dir[1]);
    for (let s = 5.5, k = 0; s <= long - 5; s += 1.7, k++) {
      const side = k % 2 ? 1 : -1, off = side * (HALF - 0.45);
      const [x, z] = at(leg, s, off);
      const what = (k + leg) % 4;
      if (what === 0) for (let h = 0; h < 3; h++) object('foamBox', x, z, yaw, h * 0.32);
      else if (what === 1) object('iceChest', x, z, yaw);
      else if (what === 2) {
        object('basin', x, z);
        object('foamBox', ...at(leg, s + 0.6, off - side * 0.1), yaw);
      } else for (let h = 0; h < 2; h++) object('foamBox', x, z, yaw + 0.2, h * 0.32);
    }
    const [tx, tz] = at(leg, long / 2, 1.0);
    object('crateTrolley', tx, tz, yaw + 0.4);
  }
  // The open floor where turns come close together: the stock brought out there, wherever there is floor for it off the
  // way; by the back door the fishmongers' to be loaded, boxes of fish on ice, ice chests, empty boxes, basins. The way past
  // it is wide, but a truck cutting the corners runs into it.
  {
    const line = marketLine();
    const off = (x: number, z: number) => {
      let near = Infinity;
      for (let k = 0; k + 1 < line.length; k++) {
        const [ax, az] = line[k], [bx, bz] = line[k + 1];
        const lx = bx - ax, lz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * lx + (z - az) * lz) / (lx * lx + lz * lz || 1)));
        near = Math.min(near, Math.hypot(x - ax - lx * t, z - az - lz * t));
      }
      return near;
    };
    const taken = (x: number, z: number) =>
      props.some((p) => p.pos[1] < 1.5 && Math.abs(p.pos[0] - x) < p.size[0] + 0.7 && Math.abs(p.pos[2] - z) < p.size[2] + 0.7) ||
      objects.some((o) => Math.hypot(o.pos[0] - x, o.pos[2] - z) < 1);
    for (const { x0, z0, x1, z1, goods, every } of STAGED) {
      let n = 0;
      for (let z = z0; z <= z1; z += every) {
        for (let x = x0 + ((n % 2) * every) / 2; x <= x1; x += every) {
          // Not in the way out of the door.
          if (Math.abs(z - OUT) < HALF + 1 && x > MARKET_ROUTE.at(-2)![0]) continue;
          if (off(x, z) < STAGED_CLEAR || taken(x, z)) continue;
          const all = STAGED_GOODS[goods], [kind, high] = all[(Math.abs(Math.round(x * 3) + Math.round(z * 7))) % all.length];
          const yaw = ((Math.abs(x * 13 + z * 7)) % 10) * 0.05;
          for (let h = 0; h < high; h++) object(kind, x, z, yaw, h * (STAGED_UP[kind] ?? 0));
        }
        n++;
      }
    }
  }
  // On the floor: leaves stripped off greens, bits of paper; the fish aisles wet.
  for (let n = 0; n + 1 < MARKET_ROUTE.length; n++) {
    const { long } = legOf(n);
    for (let k = 0; k < long / 1.6; k++) {
      const [x, z] = at(n, (k * 1.6 + ((k * 0.7) % 1.1)) % long, ((k * 2.3) % (AISLE - 1.2)) - HALF + 0.6);
      const fish = ZONES[n] === 'fish';
      decals.push({ pos: [x, z], size: fish ? [1.4, 0.9] : [0.35, 0.22], rotY: k * 1.3, color: fish ? 0x6e7476 : k % 3 ? [0x5d9a52, 0x7fae5a][k % 2] : 0xe8e2d0 });
    }
  }
  // The lamps hung over the aisles on their flexes, every so far, now one side and now the other.
  for (let n = 0; n + 1 < MARKET_ROUTE.length; n++) {
    const { long } = legOf(n);
    for (let s = 3; s < long - 2; s += 5) {
      const [x, z] = at(n, s, ((Math.round(s) % 2) * 2 - 1) * 1.4);
      lamps.push([x, EAVE - 0.2, z]);
    }
  }
  // The power off, once the truck is a little way in past the greens' first stalls: the emergency lights on their rods
  // over the aisles' edges every so far, now one side and now the other; the exit signs over the way, one along each
  // stretch and one before each turn, pointing the way out.
  // The back door's daylight under its shutter, half down, seen from in the dark.
  const outage: OutageDesc = { area: [HALL.x0, HALL.z0, HALL.x1, HALL.z1], from: HALL.z0 + POWER_OFF, exits: [], emergency: [], daylight: [{ pos: [HALL.x1 + 0.2, 0, OUT], rotY: -Math.PI / 2, wide: 8, high: 3.6 }], below: EAVE - 0.5 };
  for (let n = 0; n + 1 < MARKET_ROUTE.length; n++) {
    const { dir, long, left } = legOf(n);
    const facing = Math.atan2(-dir[0], -dir[1]);
    const next = n + 2 < MARKET_ROUTE.length ? legOf(n + 1).dir : dir;
    const turn = next[0] * left[0] + next[1] * left[1];
    const arrow = (turn > 0.5 ? -1 : turn < -0.5 ? 1 : 0) as -1 | 0 | 1;
    for (const s of long > 20 ? [long / 2 - 4, long - 7] : [long / 2]) {
      const [x, z] = at(n, s, 0);
      outage.exits.push({ pos: [x, 3.75, z], rotY: facing, arrow: s === long / 2 - 4 && long > 20 ? 0 : arrow });
    }
    for (let s = 6, k = n; s < long - 3; s += 9, k++) {
      const side = k % 2 ? 1 : -1;
      const [x, z] = at(n, s, side * (HALF - 0.3));
      outage.emergency.push({ pos: [x, 3.4, z], rotY: Math.atan2(-left[0] * side, -left[1] * side) });
    }
  }
  return { props, objects, decals, crowds, signs, lamps, outage };
}
