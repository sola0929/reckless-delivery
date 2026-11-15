import type { ObjectDesc, ObjectKindId } from './objects';
import { along, alongRot, bar, beside, carousel, coaster, coasterCar, kiosk, pirateShips, PIRATE, raftLift, rail, teaTable, waterSlide, wayPoints, dropUnder, type PlanPiece, type ProfilePoint } from './parkParts';
import { Relief, type Look, type P2 } from './relief';
import { standardLoad } from './sandbox';
import { type CrowdDesc, type DecalDesc, type FordDesc, type LevelDef, type PropDesc, type RigDesc, type SignDesc, type Vec2, type WaveDesc, STARS } from './types';

// A proving ground for level 5, the amusement park: its rides, each at the size the level is to have, one after another
// going north through a park, from the coaches' bay outside its gate to the splash pool at the foot of its big slide.
//
//   A  the queue and the gate   from the coaches' bay into the queue for the gate: one lane between planters, zigzagging
//                               up to the turnstiles in square bends; through them, round the flowers in the square
//   B  the teacups              three turntables side by side, each turning its own way at its own pace, cups going round
//                               on each: on at one end, across all three, off at the other
//   C  the roller coaster       up its station's ramp onto the track itself: the lift hill, the first drop down into a
//                               mine's tunnel through a rock, out round a helix climbing round a spire with nothing at its
//                               edge, back over the rock, a drop and a hill to come over slowly or fly off, the brake run
//   D  the pirate ships         two ships swinging over the way, a lane under each, a quarter of a swing apart
//   E  the water rides          across the shallows of the wave pool as its waves come in, throwing what floats in it at
//                               the truck and the truck at the beach; up the lift to the tower; down the big slide; into
//                               its splash pool and out

const PAVE: Look = { tag: 'paving', color: 0xd4c6ad, wall: 0x9a8e7a };
const GRASS: Look = { tag: 'grass', color: 0x6f9e52, wall: 0x5a7a44 };
/** The ground under the rides that run up high, fenced off: come down on it, off them, is a fall. */
const DROP: Look = { tag: 'drop', color: 0x6a9a4e, wall: 0x5a7a44 };
const POOL: Look = { tag: 'pool', color: 0x4fa8c8, wall: 0xe8f0f2 };
const SAND: Look = { tag: 'sand', color: 0xf0dcae, wall: 0xd8c08a };

const P = Math.PI;

/**
 * The queue for the gate: one lane between planters, zigzagging north from the coaches' bay to the turnstiles in square
 * bends left and right, each as tight as the truck turns (its middle goes round nine metres at the least, at a crawl).
 */
const GATE: Vec2 = [0, 0];
const QUEUE_WIDE = 7.5;
const QUEUE = wayPoints([GATE[0] + 0.7, GATE[1] - 121], 0, [{ long: 6 }, { radius: 9.5, turn: P / 4 }, { long: 8 }, { radius: 9.5, turn: -P / 2 }, { long: 22 }, { radius: 9.5, turn: P / 2 }, { long: 22 }, { radius: 9.5, turn: -P / 2 }, { long: 9 }, { radius: 9.5, turn: P / 4 }, { long: 6 }], [[0, 0], [1, 0]], 1);
/** The yard the queue winds across, walled: its sides, its south end at the queue's mouth. */
const YARD = { x0: GATE[0] - 15, x1: GATE[0] + 17, z0: GATE[1] - 121, z1: GATE[1] - 3 };

/** The teacups' tables, south to north: their middles, how fast each turns which way (radians a second), how many cups on it. */
const TABLES: [number, number, number, number][] = [[0, 88, 0.2, 2], [7, 118, -0.26, 2], [0, 148, 0.2, 4]];
/** The planters round them, so far from each middle; the gap in them at the south end and the north, radians either side. */
const TEA_FENCE = 11.2;
const TEA_GAP = 0.55;

/** The coaster: its way, from the foot of the ramp up to its station to the foot of the ramp down off its brake run. */
const COASTER_AT: Vec2 = [6, 180];
const COASTER_PLAN: PlanPiece[] = [{ long: 112 }, { radius: 14, turn: P / 2 }, { long: 6 }, { radius: 14, turn: -P / 2 }, { long: 10 }, { radius: 12, turn: 1.5 * P }, { long: 105 }];
const COASTER_PROFILE: ProfilePoint[] = [[0, 0], [8, 1.2, 4], [30, 1.2, 8], [80, 12.4, 14], [86, 12.4, 14], [112, 3.0, 12], [172, 3.0, 12], [230, 10.0, 10], [256, 10.0, 10], [274, 3.5, 10], [286, 6.2, 8], [298, 3.0, 8], [316, 3.0, 6], [333.6, 0]];
const RIDE = wayPoints(COASTER_AT, 0, COASTER_PLAN, COASTER_PROFILE, 1);
const RIDE_END = RIDE[RIDE.length - 1];
/** Metres along it: the station, the lift, the tunnel through the rock, the helix, the brake run. */
const STATION: [number, number] = [10, 30];
const TUNNEL: [number, number] = [109, 162];
const HELIX: [number, number] = [172, 228.5];
const BRAKES: [number, number] = [298, 314];

/** The ships' middle (D); the wave pool's lane, where the truck crosses it (its middle line, x), from its south end to its north. */
const SHIPS: Vec2 = [RIDE_END.x - 10, RIDE_END.z + 50];
const LANE = SHIPS[0] - PIRATE.gap;
const PZ0 = SHIPS[1] + 50, PZ1 = PZ0 + 64;
/** Across the wave pool, from its lane's middle: the machine house's face, where the deep water shelves, the lane's edges, the beach. */
const WAVE_HOUSE = LANE - 36, SHELF = LANE - 18, LANE_W = LANE - 6, LANE_E = LANE + 6, BEACH = LANE + 15, BEACH_END = LANE + 30;
const WATER = -0.1;

/** Where the park is paved: its ways and squares; lawn everywhere else, the coaster's grounds among it. */
function paved(x: number, z: number): boolean {
  if (z < -3) return x > -40 && x < 40;
  if (z < 66) return Math.abs(x) < 30;
  if (z < 162) return Math.abs(x - 3) < 26;
  if (z < COASTER_AT[1] + 40) return Math.abs(x - COASTER_AT[0]) < 14;
  if (z < SHIPS[1] - 40) return x < RIDE_END.x + 8 && x > RIDE_END.x - 26 && z > RIDE_END.z - 10;
  if (z < PZ0) return Math.abs(x - SHIPS[0]) < 26;
  if (z < PZ1 + 8) return x < BEACH_END + 14;
  return Math.abs(x - LANE) < 5;
}

export function parkLab(): LevelDef {
  const relief = new Relief([-130, -170], [110, 650], 8, (x, z) => ({ h: 0, look: paved(x, z) ? PAVE : GRASS }));
  const props: PropDesc[] = [];
  const decals: DecalDesc[] = [];
  const rigs: RigDesc[] = [];
  const objects: ObjectDesc[] = [];
  const crowds: CrowdDesc[] = [];
  const fords: FordDesc[] = [];
  const signs: SignDesc[] = [];
  const waves: WaveDesc[] = [];
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, y = 0) => objects.push({ kind, pos: [x, y, z], rotY });
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, extra: Partial<PropDesc> = {}) =>
    props.push({ shape: 'box', size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color, ...extra });
  /** A planter: a long box of concrete faced in tile, a hedge along its top; solid, as anything that holds a hedge is. */
  const planter = (x0: number, z0: number, x1: number, z1: number, high = 0.75) => {
    box(x0, 0, z0, x1, high, z1, 0xe8dcc6, { mapColor: 0x6f9e52 });
    box(x0 + 0.06, high, z0 + 0.06, x1 - 0.06, high + 0.05, z1 - 0.06, 0x6a4a30, { ghost: true });
    box(x0 + 0.12, high + 0.05, z0 + 0.12, x1 - 0.12, high + 0.55, z1 - 0.12, 0x4f8a3a, { ghost: true });
  };

  // ------------------------------------------------------------------------------------------------------------------
  // A: the coaches' bay, the queue for the gate across its yard, the gate, the square inside it.
  {
    const [gx, gz] = GATE;
    // The coaches' bay: two coaches drawn up at the kerb either side, their doors open; the kerb's bollards; flags on
    // poles along the forecourt; the boards with the prices on them; the hawkers' carts.
    for (const [x, z, color] of [[-24, -150, 0x3f7fd0], [26, -146, 0xf2a52e]] as const) {
      box(x - 1.3, 0.35, z - 6, x + 1.3, 3.4, z + 6, color, { mapColor: 0x6a7480 });
      box(x - 1.32, 1.6, z - 5.6, x + 1.32, 2.8, z + 4.6, 0x2a3a48, { ghost: true });
      box(x - 1.32, 3.4, z - 6.02, x + 1.32, 3.5, z + 6.02, 0xf2efe6, { ghost: true });
      box(x - 1.32, 1.3, z + 5.4, x + 1.32, 3.0, z + 6.04, 0x2a3a48, { ghost: true });
      for (const dz of [-4, 3.8]) for (const side of [-1, 1]) props.push({ shape: 'cylinder', size: [0.5, 0.18, 0], pos: [x + side * 1.2, 0.5, z + dz], rot: [0, 0, P / 2], color: 0x24262a, ghost: true });
    }
    for (let x = -36; x <= 36; x += 3) if (Math.abs(x) > 8) object('bollard', gx + x, gz - 136);
    for (const x of [-34, -26, 26, 34]) for (const z of [-132, -124]) {
      bar(props, [gx + x, 0, gz + z], [gx + x, 7, gz + z], 0.07, 0xd8dce0);
      box(gx + x + 0.08, 4.8, gz + z - 0.02, gx + x + 1.9, 6.8, gz + z + 0.02, [0xe8544a, 0xf2c12e, 0x3f7fd0, 0x4fa86a][((x + z) / 2 + 100) % 4 | 0], { ghost: true });
    }
    for (const [x, z] of [[-10, -128], [12, -130]] as const) {
      bar(props, [gx + x - 1.4, 0, gz + z], [gx + x - 1.4, 2.6, gz + z], 0.06, 0x5a6068);
      bar(props, [gx + x + 1.4, 0, gz + z], [gx + x + 1.4, 2.6, gz + z], 0.06, 0x5a6068);
      signs.push({ pos: [gx + x, 2.0, gz + z - 0.06], rotY: P, kind: 'name', text: '全票 899 元', colors: ['#ffffff', '#2a3a48', '#d23a32'], wide: 2.7 });
    }
    object('balloonCart', gx - 6, gz - 134, 0.4);
    object('popcornCart', gx + 7, gz - 133, -0.3);
    object('mascotBear', gx - 3.5, gz - 127, 0.2);
    for (let k = 0; k < 4; k++) object('stroller', gx + 14 + k * 0.85, gz - 139, 0.1);
    crowds.push({ area: [gx - 20, gz - 144, gx + 20, gz - 124], count: 40, y: 0 });

    // The yard the queue winds across: walled along its sides and across its south end but for the queue's mouth, lawn
    // and palms between the lanes; the queue between planters, railings along them, zigzagging north under shade roofs;
    // people waiting in it; misting fans at its bends, drinks machines, posts and belts.
    const { x0, x1, z0, z1 } = YARD;
    const mouth = QUEUE[0].x;
    for (const x of [x0, x1]) planter(x - 0.4, z0, x + 0.4, z1, 1.0);
    planter(x0 - 0.4, z0 - 0.8, mouth - QUEUE_WIDE / 2 - 0.4, z0, 1.0);
    planter(mouth + QUEUE_WIDE / 2 + 0.4, z0 - 0.8, x1 + 0.4, z0, 1.0);
    for (const x of [x0, x1]) for (let z = z0 + 4; z < z1 - 4; z += 8) bar(props, [x, 1.0, z], [x, 2.2, z], 0.04, 0xb8bec4, { ghost: true });
    for (const x of [x0, x1]) rail(props, [{ s: 0, x, y: 0, z: z0, yaw: 0, grade: 0 }, { s: 1, x, y: 0, z: z1, yaw: 0, grade: 0 }], 0, 2.2, 0.04, 0xb8bec4);
    const half = QUEUE_WIDE / 2;
    for (const side of [-1, 1]) {
      along(props, QUEUE, 0.6, 0.75, 0xe8dcc6, { mapColor: 0x6f9e52 }, side * (half + 0.3), 0.75);
      along(props, QUEUE, 0.5, 0.5, 0x4f8a3a, { ghost: true }, side * (half + 0.3), 1.3);
      for (let k = 0; k < QUEUE.length; k += 3) bar(props, beside(QUEUE[k], side * (half + 0.05), 0.75), beside(QUEUE[k], side * (half + 0.05), 1.85), 0.035, 0xb8bec4, { ghost: true });
      rail(props, QUEUE, side * (half + 0.05), 1.85, 0.03, 0xb8bec4);
      rail(props, QUEUE, side * (half + 0.05), 1.35, 0.025, 0xb8bec4);
    }
    for (let k = 4; k < QUEUE.length - 4; k += 7) {
      const p = QUEUE[k];
      props.push({ shape: 'box', size: [half + 0.6, 0.06, 3.6], pos: beside(p, 0, 4.6), rot: alongRot(p.yaw, 0), color: (k / 7) % 2 < 1 ? 0xe8544a : 0xf2efe6, ghost: true, fade: true, overhead: true });
    }
    for (let k = 4; k < QUEUE.length - 4; k += 14) for (const side of [-1, 1]) bar(props, beside(QUEUE[k], side * (half + 0.3), 1.25), beside(QUEUE[k], side * (half + 0.3), 4.6), 0.09, 0xf2efe6, { ghost: true });
    for (let k = 8; k < QUEUE.length - 4; k += 9) {
      const p = QUEUE[k];
      crowds.push({ area: [p.x - 2, p.z - 2, p.x + 2, p.z + 2], count: 5, y: 0 });
    }
    QUEUE.forEach((p, k) => {
      if (k < 2 || k > QUEUE.length - 3) return;
      const turn = Math.atan2(Math.sin(QUEUE[k + 1].yaw - QUEUE[k - 1].yaw), Math.cos(QUEUE[k + 1].yaw - QUEUE[k - 1].yaw));
      if (Math.abs(turn) < 0.15 || k % 5 !== 0) return;
      const out = turn > 0 ? -1 : 1;
      const [x, , z] = beside(p, out * (half - 0.7));
      object('mistFan', x, z, p.yaw + (out > 0 ? -P / 2 : P / 2));
    });
    for (const [k, side] of [[30, 1], [62, -1]] as const) {
      const [x, , z] = beside(QUEUE[k], side * (half - 0.6));
      object('vending', x, z, QUEUE[k].yaw + (side > 0 ? -P / 2 : P / 2));
      const [bx, , bz] = beside(QUEUE[k + 2], side * (half - 0.5));
      object('bin', bx, bz);
    }
    // Posts and belts down two straights, a stroller left in it, a family's cool box; the fast lane's sign.
    for (const [a, b] of [[22, 34], [72, 84]]) for (let k = a; k < b; k += 2) {
      const [x, , z] = beside(QUEUE[k], 1.4);
      object('queuePost', x, z, QUEUE[k].yaw);
    }
    for (const [k, across, kind] of [[44, -1.5, 'stroller'], [52, 1.6, 'iceChest'], [96, -1.2, 'stroller'], [104, 1.3, 'cutout']] as const) {
      const [x, , z] = beside(QUEUE[k], across);
      object(kind, x, z, QUEUE[k].yaw);
    }
    for (let z = z0 + 6; z < z1 - 6; z += 12) for (const x of [x0 + 2.4, x1 - 2.4]) object(z % 24 < 12 ? 'palm' : 'tree', x, z);
    {
      const p = QUEUE[0];
      const [x, , z] = beside(p, -(half + 1.6), 0);
      signs.push({ pos: [x, 2.2, z], rotY: p.yaw + P, kind: 'name', text: '入園 等候 60 分', colors: ['#2a3a48', '#f2c12e', '#f2efe6'], wide: 3.8 });
    }

    // The ticket hall each side of the gate: booths with their windows to the queue and a canopy, a wall on out to the edges.
    for (const side of [-1, 1]) {
      const xa = gx + side * 8, xb = gx + side * 40;
      box(Math.min(xa, xb), 0, gz - 3, Math.max(xa, xb), 4.2, gz + 3, 0xf2e6cc, { fade: true, mapColor: 0xb0a080 });
      box(Math.min(xa, xb) - 0.3, 4.2, gz - 4.5, Math.max(xa, xb) + 0.3, 4.6, gz + 3.5, 0x3f7fd0, { ghost: true, fade: true });
      for (let k = 0; k < 5; k++) {
        const x = gx + side * (11 + k * 5.5);
        box(x - 1.6, 1.0, gz - 3.06, x + 1.6, 2.6, gz - 3.0, 0x2a3a48, { ghost: true });
        box(x - 1.7, 2.7, gz - 3.1, x + 1.7, 3.3, gz - 3.02, [0xe8544a, 0xf2c12e, 0x4fa86a, 0xf08ac0, 0x7fb8ef][k], { ghost: true });
        box(x - 1.7, 0.95, gz - 3.4, x + 1.7, 1.0, gz - 3.0, 0xf2efe6, { ghost: true });
      }
    }
    // The arch over the gate, the park's name across it; the turnstiles across the gate, four lanes between low rails.
    for (const side of [-1, 1]) {
      box(gx + side * 8 - 0.9, 0, gz - 1.2, gx + side * 8 + 0.9, 8.5, gz + 1.2, 0xf08ac0, { mapColor: 0xc06090 });
      props.push({ shape: 'sphere', size: [1.0, 1.0, 1.0], pos: [gx + side * 8, 9.3, gz], color: 0xf2c12e, ghost: true });
    }
    box(gx - 8, 7.0, gz - 0.6, gx + 8, 8.4, gz + 0.6, 0x3f7fd0, { ghost: true, fade: true, overhead: true });
    signs.push({ pos: [gx, 7.7, gz - 0.65], rotY: P, kind: 'name', text: '幸福島樂園', colors: ['#3f7fd0', '#ffffff', '#f2c12e'], wide: 12 });
    for (const x of [-4.5, -1.5, 1.5, 4.5]) object('turnstile', gx + x, gz + 0.5);
    for (const x of [-6, -3, 0, 3, 6]) box(gx + x - 0.05, 0, gz - 1.5, gx + x + 0.05, 1.0, gz + 1.5, 0xb8bec4, { ghost: true });

    // The square: round its bed of flowers in the middle, the shops and stalls round its edges, people about it.
    planter(gx - 5, gz + 26, gx + 5, gz + 36, 0.6);
    for (let k = 0; k < 6; k++) props.push({ shape: 'sphere', size: [0.9, 0.5, 0.9], pos: [gx - 3.5 + (k % 3) * 3.5, 1.05, gz + 28.5 + Math.floor(k / 3) * 5], color: [0xf08ac0, 0xf2c12e, 0xe8544a][k % 3], ghost: true });
    object('mascotBear', gx - 6.5, gz + 24, 0.4);
    object('mascotBear', gx + 6.3, gz + 37.5, 2.8);
    object('cutout', gx + 2.5, gz + 22.5, 0.2);
    object('balloonCart', gx - 9, gz + 16, 0.3);
    object('balloonCart', gx + 11, gz + 44, -0.5);
    object('popcornCart', gx + 9.5, gz + 18, -0.2);
    object('iceCreamCart', gx - 10, gz + 42, 0.6);
    for (let k = 0; k < 6; k++) object('stroller', gx - 18 + (k % 3) * 0.8, gz + 10 + Math.floor(k / 3) * 1.4, 0.1);
    for (let z = gz + 12; z <= gz + 52; z += 10) {
      object('souvenirStall', gx - 21, z, P / 2);
      object('souvenirStall', gx + 21, z + 4, -P / 2);
      object('parkLamp', gx - 15, z + 5);
      object('parkLamp', gx + 15, z);
      object('bench', gx - 16.5, z + 2, P / 2);
      object('bin', gx + 16.5, z + 7);
    }
    for (const z of [gz + 8, gz + 58]) for (const x of [-26, 26]) object('palm', gx + x, z);
    const SHOPS: [number, number, string, number, number, 'flat' | 'pitched' | 'dome', number, 'counter' | 'shop' | 'toilets'][] = [
      [-1, 14, '紀念品店', 0xf6e2c0, 0xd23a32, 'pitched', 4.4, 'shop'], [-1, 27, '玩具城', 0xd8ecf2, 0x3f7fd0, 'dome', 3.6, 'shop'], [-1, 39, '照相館', 0xf8d8e4, 0xf08ac0, 'flat', 3.6, 'counter'], [-1, 52, '寄物櫃', 0xe8eef2, 0x5a6068, 'flat', 4.4, 'counter'],
      [1, 15, '冰淇淋', 0xfff0dc, 0xf08ac0, 'dome', 3.4, 'counter'], [1, 27, '爆米花屋', 0xfff4c8, 0xd23a32, 'pitched', 3.8, 'counter'], [1, 40, '歡樂餐廳', 0xe0f0d8, 0x4fa86a, 'pitched', 5.0, 'shop'], [1, 54, '服務中心', 0xdce8f6, 0x2f6fb0, 'flat', 4.0, 'shop'],
    ];
    for (const [side, z, name, wall, roofColor, roof, hw, front] of SHOPS) {
      kiosk(props, signs, { at: [gx + side * 26.5, gz + z], yaw: side < 0 ? P / 2 : -P / 2, half: [hw, 3.2], high: 4.2, wall, trim: 0xffffff, roof, roofColor, name, front, awning: [roofColor, 0xffffff] });
    }
    for (let z = gz + 6; z < gz + 64; z += 9) for (const x of [-33, 33]) object(z % 2 ? 'treeTall' : 'tree', gx + x, z);
    crowds.push({ area: [gx - 14, gz + 8, gx + 14, gz + 60], count: 70, y: 0 });
    // On north out of the square to the teacups: lamps either side.
    for (let z = gz + 64; z < 76; z += 6) for (const x of [-7, 7]) object('parkLamp', gx + x, z);
  }

  // ------------------------------------------------------------------------------------------------------------------
  // B: the teacups' three tables, and the carousel beside them.
  {
    TABLES.forEach(([x, z, spin, cups], k) => rigs.push(teaTable([x, z], spin, cups, k, [[0xf4e6d4, 0xf2a7bf], [0xe6f2ee, 0x8fd3c0], [0xfff2d8, 0xf6c66a]][k] as [number, number])));
    // Round each, planters, but at the gaps: on at the south end, off at the north, and between one table and the next,
    // where a short way of paving between planters joins them, to stop on and wait for the next to come round right.
    const ends: number[][] = TABLES.map(() => []);
    ends[0].push(-P / 2);
    ends[TABLES.length - 1].push(P / 2);
    for (let k = 0; k < TABLES.length - 1; k++) {
      const [ax, az] = TABLES[k], [bx, bz] = TABLES[k + 1];
      const a = Math.atan2(bz - az, bx - ax);
      ends[k].push(a);
      ends[k + 1].push(a + P);
      for (const side of [-1, 1]) {
        const p0: Vec2 = [ax + Math.cos(a + side * (TEA_GAP - 0.1)) * TEA_FENCE, az + Math.sin(a + side * (TEA_GAP - 0.1)) * TEA_FENCE];
        const p1: Vec2 = [bx + Math.cos(a + P - side * (TEA_GAP - 0.1)) * TEA_FENCE, bz + Math.sin(a + P - side * (TEA_GAP - 0.1)) * TEA_FENCE];
        const long = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), yaw = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]);
        const mid: [number, number, number] = [(p0[0] + p1[0]) / 2, 0.4, (p0[1] + p1[1]) / 2];
        props.push({ shape: 'box', size: [0.45, 0.4, long / 2 + 0.4], pos: mid, rot: [0, yaw, 0], color: 0xf6e8d4, mapColor: 0x6f9e52 });
        props.push({ shape: 'sphere', size: [0.6, 0.45, long / 2 + 0.3], pos: [mid[0], 1.0, mid[2]], rot: [0, yaw, 0], color: 0x4f8a3a, ghost: true });
      }
    }
    for (const [k, [cx, cz]] of TABLES.entries()) {
      const n = 34;
      for (let j = 0; j < n; j++) {
        const a = (j / n) * P * 2 + P / n;
        const x = cx + Math.cos(a) * TEA_FENCE, z = cz + Math.sin(a) * TEA_FENCE;
        if (ends[k].some((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < TEA_GAP)) continue;
        props.push({ shape: 'box', size: [0.45, 0.4, 1.15], pos: [x, 0.4, z], rot: [0, -a, 0], color: 0xf6e8d4, mapColor: 0x6f9e52 });
        props.push({ shape: 'sphere', size: [0.6, 0.45, 1.1], pos: [x, 1.0, z], rot: [0, -a, 0], color: j % 2 ? 0x4f8a3a : 0x5a9a42, ghost: true });
      }
    }
    const [sx, sz] = TABLES[0];
    signs.push({ pos: [sx, 4.4, sz - TEA_FENCE - 1.5], rotY: P, kind: 'name', text: '瘋狂咖啡杯', colors: ['#f28cb0', '#ffffff', '#d9a830'], wide: 8 });
    for (const side of [-1, 1]) bar(props, [sx + side * 5.6, 0, sz - TEA_FENCE - 1.5], [sx + side * 5.6, 5.1, sz - TEA_FENCE - 1.5], 0.14, 0xd9a830);
    // Outside, the tea party's things: tables under parasols, carts; the dessert kiosk and the toilets; trees round it all.
    const cx = 3, cz = TABLES[1][1];
    for (const [x, z] of [[24, -14], [26, -2], [27, 10], [-22, -24], [-24, 24]]) {
      object('table', cx + x, cz + z);
      object('umbrella', cx + x, cz + z);
      object('chair', cx + x + 1, cz + z, 0.4);
      object('chair', cx + x - 1, cz + z + 0.4, 2.6);
    }
    kiosk(props, signs, { at: [cx + 34, cz + 4], yaw: -P / 2, half: [4.5, 3.4], high: 4.0, wall: 0xf8e8ec, trim: 0xffffff, roof: 'dome', roofColor: 0xf28cb0, name: '下午茶', front: 'counter', awning: [0xf28cb0, 0xffffff] });
    kiosk(props, signs, { at: [cx + 33, cz - 22], yaw: -P / 2, half: [4.0, 3.0], high: 3.6, wall: 0xe8eef2, trim: 0xffffff, roof: 'flat', roofColor: 0x5a8ab0, name: '洗手間', front: 'toilets' });
    for (let z = cz - 34; z <= cz + 34; z += 9) {
      object(z % 2 ? 'tree' : 'palm', cx + 40, z);
      object(z % 2 ? 'palm' : 'treeTall', cx - 50, z);
    }
    object('iceCreamCart', sx - 9, sz - 16, 0.3);
    object('popcornCart', sx + 10, sz - 17, -0.4);
    object('balloonCart', cx + 17, cz + 30, 0.2);
    crowds.push({ area: [cx + 18, cz - 30, cx + 30, cz + 30], count: 25, y: 0 }, { area: [cx - 20, cz - 30, cx - 14, cz + 30], count: 14, y: 0 });
    // The carousel to the west: its own turning floor under a striped roof.
    rigs.push(carousel([cx - 31, cz]));
    for (let z = TABLES[2][1] + TEA_FENCE + 2; z < COASTER_AT[1]; z += 6) for (const x of [-7, 11]) object('parkLamp', x, z);
  }

  // ------------------------------------------------------------------------------------------------------------------
  // C: the coaster.
  const overTunnel = (x: number, z: number) => RIDE.some((p) => p.s >= TUNNEL[0] - 2 && p.s <= TUNNEL[1] + 2 && Math.hypot(p.x - x, p.z - z) < 6.5);
  const ride = coaster(props, { start: COASTER_AT, yaw: 0, plan: COASTER_PLAN, profile: COASTER_PROFILE, station: STATION, lift: [30, 80], brakes: BRAKES, carried: (x, z) => overTunnel(x, z) });
  dropUnder(relief, ride, 2.4, 7, DROP);
  {
    const [sx, sz] = COASTER_AT;
    // The station: a platform along the track at its height, the train waiting on its siding the other side, a roof over
    // all of it, the ride's name.
    box(sx + 2.2, 0, sz + STATION[0], sx + 6.5, 1.2, sz + STATION[1], 0xd8d4c8);
    box(sx + 2.2, 1.2, sz + STATION[0], sx + 2.5, 1.22, sz + STATION[1], 0xf2c12e, { ghost: true });
    for (let z = sz + STATION[0] + 2; z < sz + STATION[1]; z += 3) box(sx + 2.6, 1.2, z - 0.05, sx + 2.7, 2.2, z + 0.05, 0xf2c12e, { ghost: true });
    const siding = wayPoints([sx - 6.2, sz + STATION[0]], 0, [{ long: 20 }], [[0, 1.2], [20, 1.2]], 1);
    box(sx - 8.2, 0, sz + STATION[0], sx - 4.2, 1.2, sz + STATION[1], 0x4a5056);
    for (let n = 0; n < 4; n++) coasterCar(props, siding[3 + Math.round(n * 3.4)], n === 3);
    for (const x of [sx - 9, sx + 7]) for (let z = sz + STATION[0] + 1; z <= sz + STATION[1]; z += 6.4) bar(props, [x, 0, z], [x, 6.5, z], 0.22, 0xf2efe6);
    box(sx - 9.6, 6.5, sz + STATION[0] - 0.5, sx + 7.6, 6.9, sz + STATION[1] + 0.5, 0xd23a32, { ghost: true, fade: true, overhead: true });
    signs.push({ pos: [sx, 7.6, sz + STATION[0] - 0.6], rotY: P, kind: 'name', text: '旋風飛車', colors: ['#d23a32', '#ffffff', '#f2c12e'], wide: 8 });
    crowds.push({ area: [sx + 3, sz + STATION[0] + 2, sx + 6, sz + STATION[1] - 2], count: 14, y: 0, raised: 1.2 });
    kiosk(props, signs, { at: [sx + 16, sz + 22], yaw: -P / 2, half: [4.0, 3.0], high: 3.8, wall: 0xf2e6cc, trim: 0xffffff, roof: 'flat', roofColor: 0xd23a32, name: '照片販售', front: 'counter', awning: [0xd23a32, 0xffffff] });

    // The mine: a hill of rock the track runs into at the foot of its first drop, through a tunnel turning one way and
    // the other inside it, lit by lanterns, its mouths framed in timber; out of it round the helix, then back over its top.
    const tunnel = ride.filter((p) => p.s >= TUNNEL[0] && p.s <= TUNNEL[1]);
    const W = 3.6 / 2;
    // Wider than the track inside, for the truck to come round its bends: its floor of planks out to its walls.
    const IN = W + 0.9;
    along(props, tunnel, 2 * IN, 0.12, 0x7a5a3a, { mapColor: 0x8a745c }, 0, -0.005);
    for (let k = 0; k < tunnel.length; k += 2) props.push({ shape: 'box', size: [IN - 0.05, 0.004, 0.05], pos: beside(tunnel[k], 0, -0.002), rot: alongRot(tunnel[k].yaw, tunnel[k].grade), color: 0x5a4028, ghost: true });
    for (const side of [-1, 1]) along(props, tunnel, 0.7, 4.6, 0x9a4e2c, { mapColor: 0xa85a34 }, side * (IN + 0.35), 3.8);
    along(props, tunnel, 2 * IN + 1.4, 0.5, 0x6a5848, { ghost: true, fade: true, overhead: true }, 0, 4.3);
    for (let k = 0; k < tunnel.length; k += 6) {
      const p = tunnel[k];
      for (const side of [-1, 1]) {
        props.push({ shape: 'sphere', size: [0.16, 0.2, 0.16], pos: beside(p, side * (IN - 0.1), 2.6), color: 0xffc860, ghost: true, glow: true });
        bar(props, beside(p, side * (IN - 0.1), 0), beside(p, side * (IN - 0.1), 3.9), 0.12, 0x6a4a30, { ghost: true });
      }
      props.push({ shape: 'box', size: [IN, 0.12, 0.14], pos: beside(p, 0, 3.95), rot: alongRot(p.yaw, p.grade), color: 0x6a4a30, ghost: true, fade: true, overhead: true });
    }
    for (const p of [tunnel[0], tunnel[tunnel.length - 1]]) {
      for (const side of [-1, 1]) bar(props, beside(p, side * (IN + 0.2), -0.2), beside(p, side * (IN + 0.2), 4.4), 0.24, 0x5a3e28);
      props.push({ shape: 'box', size: [IN + 0.5, 0.3, 0.3], pos: beside(p, 0, 4.4), rot: alongRot(p.yaw, 0), color: 0x5a3e28, ghost: true, fade: true, overhead: true });
    }
    signs.push({ pos: beside(tunnel[0], 0, 5.3), rotY: tunnel[0].yaw + P, kind: 'name', text: '黃金礦坑', colors: ['#5a3e28', '#f2c12e', '#2a2420'], wide: 4 });
    // The rock round it: red sandstone in layers, as a western mine's is, cut square and leaning a little, each layer set
    // back from the one under it; flat on top, where scrub and a few pines grow, low enough for the track to come back
    // over it. Its sides hide the tunnel's walls end to end.
    const SAND = [0xb5653d, 0xa85a34, 0xc47a4c, 0x9a4e2c];
    const BAND = 0xd9a273;
    const jig = (n: number) => { const r = Math.sin(n * 12.9898) * 43758.5453; return r - Math.floor(r) - 0.5; };
    for (let k = 0; k < tunnel.length; k += 5) {
      const p = tunnel[k];
      for (const side of [-1, 1]) {
        const n = k * 2 + (side > 0 ? 1 : 0);
        const wide = 2.4 + jig(n) * 0.8, high = 2.2 + jig(n + 7) * 0.5;
        const [x0, , z0] = beside(p, side * (IN + 0.7 + wide));
        props.push({ shape: 'box', size: [wide, high, 3.4], pos: [x0, p.y - 3 + high, z0], rot: [jig(n + 1) * 0.12, p.yaw + jig(n + 2) * 0.3, side * 0.06], color: SAND[n % 4], ghost: true, fade: true });
        props.push({ shape: 'box', size: [wide + 0.05, 0.18, 3.42], pos: [x0, p.y - 3 + high * 2 - 0.4, z0], rot: [jig(n + 1) * 0.12, p.yaw + jig(n + 2) * 0.3, side * 0.06], color: BAND, ghost: true, fade: true });
        const [x1, , z1] = beside(p, side * (IN + 0.5 + wide * 0.6));
        const up = 1.4 + jig(n + 3) * 0.4;
        props.push({ shape: 'box', size: [wide * 0.8, up, 2.8], pos: [x1, p.y - 3 + high * 2 + up - 0.1, z1], rot: [jig(n + 4) * 0.1, p.yaw + jig(n + 5) * 0.35, side * 0.05], color: SAND[(n + 1) % 4], ghost: true, fade: true });
        if (n % 3 === 0) props.push({ shape: 'sphere', size: [1.1, 0.5, 1.3], pos: [x1, p.y - 3 + high * 2 + up * 2, z1], color: 0x6a8a3a, ghost: true, fade: true });
        if (n % 5 === 2) {
          const top = p.y - 3 + high * 2 + up * 2 - 0.1;
          props.push({ shape: 'cylinder', size: [0.12, 0.5, 0], pos: [x1, top + 0.5, z1], color: 0x5a3e28, ghost: true, fade: true });
          props.push({ shape: 'cone', size: [0.9, 1.3, 0], pos: [x1, top + 2.1, z1], color: 0x3f6a34, ghost: true, fade: true });
        }
      }
      // Over the tunnel's roof, the rock's flat top joining the two sides.
      props.push({ shape: 'box', size: [IN + 1.6, 0.55, 2.8], pos: beside(p, 0, 5.0), rot: alongRot(p.yaw, 0), color: SAND[k % 4], ghost: true, fade: true, overhead: true });
    }
    // Its mouths: the rock face round each a little proud, darker where the tunnel goes in.
    for (const [p, back] of [[tunnel[0], -1], [tunnel[tunnel.length - 1], 1]] as const) {
      const [x, , z] = [p.x + Math.sin(p.yaw) * back * 0.6, 0, p.z + Math.cos(p.yaw) * back * 0.6];
      props.push({ shape: 'box', size: [IN + 3.2, 0.9, 0.5], pos: [x, p.y + 5.0, z], rot: [0, p.yaw, 0], color: SAND[1], ghost: true, fade: true, overhead: true });
    }
    // The helix's middle: a butte of the same sandstone, in layers set back one above another, a fall of water down its
    // side into a pool at its foot.
    const h0 = ride[HELIX[0]];
    const [mx, mz] = [h0.x + Math.cos(h0.yaw) * 12, h0.z - Math.sin(h0.yaw) * 12];
    props.push({ shape: 'cylinder', size: [5.6, 7, 0], pos: [mx, 7, mz], color: SAND[0] });
    for (const [r, y0, y1, c] of [[6.8, 0, 4.4, 0], [6.0, 4.4, 8.6, 2], [5.0, 8.6, 12.4, 1], [3.8, 12.4, 15.6, 3]] as const) {
      for (let j = 0; j < 7; j++) {
        const a = (j / 7) * P * 2 + r;
        const w = r * 0.5 + jig(j + r) * 0.6;
        props.push({ shape: 'box', size: [w, (y1 - y0) / 2, r * 0.45], pos: [mx + Math.cos(a) * r * 0.55, (y0 + y1) / 2, mz + Math.sin(a) * r * 0.55], rot: [jig(j * 3 + r) * 0.08, -a + jig(j) * 0.3, jig(j * 5) * 0.08], color: SAND[(j + c) % 4], ghost: true });
      }
      props.push({ shape: 'cylinder', size: [r * 0.98, 0.16, 0], pos: [mx, y1 - 0.2, mz], color: BAND, ghost: true });
    }
    props.push({ shape: 'sphere', size: [2.6, 0.8, 2.6], pos: [mx, 15.9, mz], color: 0x6a8a3a, ghost: true });
    for (const [dx, dz] of [[1.2, 0.6], [-1.0, -0.8]]) {
      props.push({ shape: 'cylinder', size: [0.14, 0.6, 0], pos: [mx + dx, 16.4, mz + dz], color: 0x5a3e28, ghost: true });
      props.push({ shape: 'cone', size: [1.0, 1.6, 0], pos: [mx + dx, 18.4, mz + dz], color: 0x3f6a34, ghost: true });
    }
    box(mx + 6.0, 0.2, mz - 1.0, mx + 6.1, 12.2, mz + 1.0, 0xcfeef8, { ghost: true });
    props.push({ shape: 'cylinder', size: [2.0, 0.06, 0], pos: [mx + 7.4, 0.06, mz], color: 0x4fa8c8, ghost: true });
    // Down off the ride: its fence round the grounds under it, the photo shop's lawn with trees, benches.
    for (let k = 0; k < ride.length; k += 6) {
      const p = ride[k];
      if (p.y < 2.4 || (p.s >= TUNNEL[0] && p.s <= TUNNEL[1])) continue;
      for (const side of [-1, 1]) object('fence', p.x + Math.cos(p.yaw) * side * 7.6, p.z - Math.sin(p.yaw) * side * 7.6, p.yaw + P / 2);
    }
    for (let k = 20; k < ride.length; k += 19) {
      const [x, , z] = beside(ride[k], (k % 2 ? 1 : -1) * 11);
      if (Math.hypot(x - mx, z - mz) < 18) continue;
      object(k % 2 ? 'treeTall' : 'tree', x, z);
    }
    for (let z = RIDE_END.z - 40; z < RIDE_END.z - 8; z += 8) {
      object('parkLamp', RIDE_END.x - 12, z);
      object('bench', RIDE_END.x - 15, z + 3, P / 2);
    }
  }

  // ------------------------------------------------------------------------------------------------------------------
  // D: the pirate ships, and the games stalls round them.
  {
    const [cx, cz] = SHIPS;
    rigs.push(...pirateShips(props, SHIPS, [0, 0.25]));
    for (const side of [-1, 1]) {
      box(cx + side * 8.4 - 1.2, 0, cz - 9, cx + side * 8.4 + 1.2, 0.6, cz + 9, 0x8a6a40);
      for (let z = cz - 8; z <= cz + 8; z += 2) object('queuePost', cx + side * 9.9, z);
      for (let z = cz - 26; z <= cz + 26; z += 8) {
        if (Math.abs(z - cz) < 12) continue;
        object('gameStall', cx + side * 10.5, z, side < 0 ? P / 2 : -P / 2);
        object('plushGiant', cx + side * 8.6, z + 1.4, side * 0.5);
      }
    }
    signs.push({ pos: [cx, 2.6, cz - 14], rotY: P, kind: 'name', text: '海盜船', colors: ['#2a6f9e', '#f2c12e', '#9e3a2a'], wide: 5 });
    for (const side of [-1, 1]) kiosk(props, signs, { at: [cx + side * 19, cz + side * 8], yaw: side < 0 ? P / 2 : -P / 2, half: [6, 3.6], high: 4.4, wall: side < 0 ? 0x2a3a5a : 0x5a2a3a, trim: 0xf2c12e, roof: 'flat', roofColor: 0x1c2230, name: side < 0 ? '電子遊樂場' : '套圈圈', nameColors: ['#1c2230', '#f2c12e', '#f08ac0'], front: 'shop' });
    for (const [x, z] of [[-13, -32], [13, -32], [-13, 32], [13, 32]]) object('parkLamp', cx + x, cz + z);
    crowds.push({ area: [cx - 14, cz - 30, cx - 11, cz + 30], count: 20, y: 0 }, { area: [cx + 11, cz - 30, cx + 14, cz + 30], count: 20, y: 0 });
  }

  // ------------------------------------------------------------------------------------------------------------------
  // E: the wave pool. Its machine house along its west side, the deep water in front of it shelving up to the shallows the
  // truck wades north along, the beach east of them. A wave every few seconds, every third a big one: seen rising out over
  // the deep water, breaking as it comes up onto the shallows and running in across them and up the beach, taking what
  // floats there with it, rings and mattresses and banana boats, into the truck, and the truck toward the beach's loungers.
  {
    relief.area([[WAVE_HOUSE, PZ0], [BEACH_END, PZ0], [BEACH_END, PZ1], [WAVE_HOUSE, PZ1]], (x) => {
      if (x < SHELF) return -1.6;
      if (x < LANE_W) return -1.6 + (1.1 * (x - SHELF)) / (LANE_W - SHELF);
      if (x < LANE_E) return -0.5 + (0.1 * (x - LANE_W)) / (LANE_E - LANE_W);
      if (x < BEACH) return -0.4 + (0.55 * (x - LANE_E)) / (BEACH - LANE_E);
      return 0.15;
    }, POOL);
    relief.area([[BEACH, PZ0], [BEACH_END, PZ0], [BEACH_END, PZ1], [BEACH, PZ1]], 0.15, SAND);
    // In at the south end down a ramp off the paving, out at the north up another.
    relief.area([[LANE_W, PZ0 - 10], [LANE_E, PZ0 - 10], [LANE_E, PZ0], [LANE_W, PZ0]], (_x, z) => (-0.45 * (z - (PZ0 - 10))) / 10, POOL);
    relief.area([[LANE_W, PZ1], [LANE_E, PZ1], [LANE_E, PZ1 + 10], [LANE_W, PZ1 + 10]], (_x, z) => -0.45 + (0.45 * (z - PZ1)) / 10, POOL);
    fords.push({ pos: [(WAVE_HOUSE + BEACH) / 2, (PZ0 + PZ1) / 2], half: [(BEACH - WAVE_HOUSE) / 2, (PZ1 - PZ0) / 2], flow: [0.15, 0], surface: WATER, drag: 0.3, sideGrip: 0.7 });
    fords.push({ pos: [LANE, PZ0 - 3], half: [6, 3], flow: [0, 0], surface: WATER, drag: 0.3 });
    fords.push({ pos: [LANE, PZ1 + 3], half: [6, 3], flow: [0, 0], surface: WATER, drag: 0.3 });
    // The pool's coping round its south and north ends, but where the ramps come in.
    for (const z of [PZ0, PZ1]) for (const [a, b] of [[WAVE_HOUSE, LANE_W - 0.4], [LANE_E + 0.4, BEACH]]) box(a, 0, z - 0.35, b, 0.35, z + 0.35, 0xf2f2ee, { mapColor: 0xe8f0f2 });
    waves.push({ from: [LANE_W, PZ0 + 1], to: [LANE_W, PZ1 - 1], inland: [1, 0], reach: BEACH_END - LANE_W - 4, period: 6.5, phase: 0.3, big: 3, force: 1.5, y: WATER, sea: -1.3, out: LANE_W - WAVE_HOUSE - 4, tint: 0x3f9cc4, takes: true });
    // The machine house: a long block along the west side, the grilles of its chambers in a row at the water, the pool's
    // name and the board saying when the next wave comes; the lifeguards' high chairs.
    box(WAVE_HOUSE - 7, -1.6, PZ0 - 3, WAVE_HOUSE, 6.5, PZ1 + 3, 0xe8eef2, { mapColor: 0xb0b8c0 });
    box(WAVE_HOUSE - 7.3, 6.5, PZ0 - 3.3, WAVE_HOUSE + 0.4, 7.0, PZ1 + 3.3, 0x2f6fb0, { ghost: true });
    for (let z = PZ0 + 2; z < PZ1 - 1; z += 5) box(WAVE_HOUSE - 0.02, -1.2, z - 1.8, WAVE_HOUSE + 0.04, 0.5, z + 1.8, 0x2a3a48, { ghost: true });
    for (let z = PZ0 + 4.5; z < PZ1 - 1; z += 5) box(WAVE_HOUSE, -1.6, z - 0.4, WAVE_HOUSE + 0.4, 1.0, z + 0.4, 0xf2f2ee, { ghost: true });
    signs.push({ pos: [WAVE_HOUSE + 0.06, 4.8, (PZ0 + PZ1) / 2], rotY: P / 2, kind: 'name', text: '衝浪造浪池', colors: ['#2f6fb0', '#ffffff', '#f2a52e'], wide: 12 });
    signs.push({ pos: [WAVE_HOUSE + 0.06, 2.6, PZ0 + 12], rotY: P / 2, kind: 'name', text: '大浪 每 3 波', colors: ['#2a3a48', '#f2c12e', '#f2efe6'], wide: 4.5 });
    const chair = (x: number, z: number, y0: number) => {
      for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) bar(props, [x + dx, y0, z + dz], [x + dx * 0.6, 2.6, z + dz * 0.6], 0.07, 0xf2efe6);
      box(x - 0.7, 2.6, z - 0.7, x + 0.7, 2.75, z + 0.7, 0xf2efe6);
      box(x - 0.5, 2.75, z - 0.1, x + 0.5, 3.5, z + 0.1, 0xd23a32, { ghost: true });
      props.push({ shape: 'cone', size: [1.1, 0.35, 0], pos: [x, 4.5, z], color: 0xd23a32, ghost: true });
      bar(props, [x, 2.75, z], [x, 4.2, z], 0.04, 0xf2efe6, { ghost: true });
    };
    chair(BEACH + 2, PZ0 + 18, 0.15);
    chair(BEACH + 2, PZ1 - 16, 0.15);
    chair(WAVE_HOUSE + 2.2, PZ0 + 32, -1.6);
    // In the shallows, a mushroom fountain and a lifeguard's float, fixed, to be wound round; a line of buoys where the deep begins.
    for (const [x, z] of [[LANE + 2.6, PZ0 + 16], [LANE + 2.6, PZ0 + 48]] as const) {
      bar(props, [x, -0.5, z], [x, 2.6, z], 0.35, 0x3fb0e0);
      props.push({ shape: 'sphere', size: [2.4, 0.9, 2.4], pos: [x, 2.7, z], color: [0xf0609a, 0xf6d55c][(z - PZ0) % 2 | 0], ghost: true });
      props.push({ shape: 'cylinder', size: [2.3, 0.05, 0], pos: [x, 2.5, z], color: 0xffffff, ghost: true });
      props.push({ shape: 'cylinder', size: [0.9, 0.25, 0], pos: [x, -0.25, z], color: 0x3fb0e0 });
    }
    box(LANE - 3.6, -0.5, PZ0 + 32 - 1.6, LANE - 0.4, 0.25, PZ0 + 32 + 1.6, 0xf2c12e);
    box(LANE - 3.5, 0.25, PZ0 + 32 - 1.5, LANE - 0.5, 0.3, PZ0 + 32 + 1.5, 0xd23a32, { ghost: true });
    for (let z = PZ0 + 3; z < PZ1 - 2; z += 3) object('buoy', SHELF + 2, z, 0, WATER - 0.2);
    // What floats in the shallows and the deep edge of them, for the waves to throw: rings, mattresses, banana boats, the
    // big slide's rafts out of the way of the slide.
    const FLOATS: [ObjectKindId, number, number][] = [
      ['swimRing', -4, 4], ['floatMat', -1, 7], ['swimRingBlue', 2, 9], ['bananaBoat', -5, 13], ['swimRing', 3, 15], ['rideRaft', -2, 18],
      ['floatMat', 4, 21], ['swimRingBlue', -5, 25], ['swimRing', 0, 27], ['bananaBoat', 3, 30], ['floatMat', -4, 36], ['rideRaft', 1, 39],
      ['swimRingBlue', 4, 41], ['swimRing', -1, 47], ['floatMat', 3, 50], ['bananaBoat', -4, 53], ['swimRing', 1, 57], ['swimRingBlue', -2, 60],
      ['floatMat', -9, 10], ['swimRing', -10, 20], ['bananaBoat', -9, 34], ['swimRingBlue', -10, 46], ['floatMat', -9, 56],
    ];
    for (const [kind, x, z] of FLOATS) {
      const at = LANE + x, ground = at < LANE_W ? -1.6 + (1.1 * (at - SHELF)) / (LANE_W - SHELF) : -0.5 + (0.1 * (at - LANE_W)) / (LANE_E - LANE_W);
      object(kind, at, PZ0 + z, z * 0.7, Math.max(ground, WATER - 0.3));
    }
    // The beach: rows of loungers under parasols, the rings for hire, palms, showers, a snack bar; people on it, in the shallows.
    for (let z = PZ0 + 4; z < PZ1 - 3; z += 4.5) for (const x of [BEACH + 4, BEACH + 8.5]) {
      object('lounger', x, z, -P / 2, 0.15);
      if ((z - PZ0) % 9 < 4.5) object('umbrella', x + 1.6, z + 1.2, 0, 0.15);
    }
    for (const z of [PZ0 + 10, PZ0 + 40]) object('ringRack', BEACH + 1.5, z, -P / 2, 0.15);
    for (let z = PZ0 + 2; z < PZ1; z += 10) object('palm', BEACH + 12, z, 0, 0.15);
    for (const z of [PZ0 + 26, PZ1 - 6]) {
      bar(props, [BEACH + 1, 0.15, z], [BEACH + 1, 2.6, z], 0.05, 0xc8ccd0);
      bar(props, [BEACH + 1, 2.6, z], [BEACH + 0.4, 2.6, z], 0.04, 0xc8ccd0, { ghost: true });
    }
    kiosk(props, signs, { at: [BEACH_END + 6, (PZ0 + PZ1) / 2], yaw: -P / 2, half: [6, 3.4], high: 3.8, wall: 0xfff0d0, trim: 0xffffff, roof: 'pitched', roofColor: 0x3fb0e0, name: '海灘小吃', front: 'counter', awning: [0x3fb0e0, 0xffffff] });
    crowds.push({ area: [BEACH + 2, PZ0 + 2, BEACH + 12, PZ1 - 2], count: 34, y: 0.15 }, { area: [BEACH_END + 1, PZ0, BEACH_END + 5, PZ1], count: 14, y: 0 });
    // Between the ships and the pool: the paving, a pair of lamps either side of the ramp in.
    for (const x of [LANE_W - 2, LANE_E + 2]) object('parkLamp', x, PZ0 - 12);
  }
  // The lift up out of the north end of the pool to the tower, and the tower's deck.
  const TOP = 12;
  const L0 = PZ1 + 12;
  const lift = wayPoints([LANE, L0], 0, [{ long: 72 }], [[0, 0], [5, 0, 4], [70, TOP, 6], [72, TOP]], 1);
  raftLift(props, lift);
  const T0 = L0 + 72, T1 = T0 + 14;
  // Along the lift, palms and flowering shrubs on the lawn, a path for the staff beside it.
  for (let z = L0 + 6; z < T1; z += 9) for (const side of [-1, 1]) {
    object(z % 18 < 9 ? 'palm' : 'tree', LANE + side * 11, z);
    props.push({ shape: 'sphere', size: [1.4, 0.8, 1.4], pos: [LANE + side * 7.5, 0.4, z + 4], color: [0x4f8a3a, 0x5a9a42][(z / 9) % 2 | 0], ghost: true });
    props.push({ shape: 'sphere', size: [0.5, 0.35, 0.5], pos: [LANE + side * 7.2, 0.95, z + 3.6], color: [0xf08ac0, 0xf2c12e, 0xe8544a][(z / 9) % 3 | 0], ghost: true });
  }
  {
    const rx = LANE;
    box(rx - 8, TOP - 0.4, T0 - 0.5, rx + 8, TOP, T1, 0xd8dcd6, { mapColor: 0x9aa0a6 });
    for (const x of [rx - 7.4, rx + 7.4]) for (const z of [T0 + 0.5, T1 - 0.6]) bar(props, [x, 0, z], [x, TOP - 0.4, z], 0.4, 0xf2efe6);
    for (const x of [rx - 8, rx + 8]) box(x - 0.05, TOP, T0, x + 0.05, TOP + 1.1, T1, 0xf2c12e, { ghost: true });
    for (const x of [rx - 7.6, rx + 7.6]) bar(props, [x, TOP, T0 + 2], [x, TOP + 4.6, T0 + 2], 0.14, 0x2f6fb0);
    box(rx - 8.4, TOP + 4.6, T0 + 1, rx + 8.4, TOP + 4.8, T1 - 1, 0x2f6fb0, { ghost: true, fade: true, overhead: true });
    signs.push({ pos: [rx, TOP + 5.6, T0 + 1], rotY: P, kind: 'name', text: '激流大滑水道', colors: ['#2f6fb0', '#ffffff', '#f2a52e'], wide: 9 });
    crowds.push({ area: [rx - 7, T0 + 2, rx - 4, T1 - 2], count: 8, y: 0, raised: TOP });
    for (const z of [T0 + 4, T0 + 9]) objects.push({ kind: 'rideRaft', pos: [rx + 5, TOP, z], rotY: z });
  }
  const slide = waterSlide(props, {
    start: [LANE, T1], yaw: 0,
    plan: [{ long: 10 }, { radius: 18, turn: P / 2 }, { long: 25 }, { radius: 18, turn: -P }, { long: 30 }, { long: 12 }],
    profile: [[0, TOP], [10, TOP, 6], [38, 9.0, 8], [63, 5.6, 10], [120, 2.2, 10], [150, 0.4, 6], [161.5, 0.0]],
    tube: [70, 112],
  });
  dropUnder(relief, [...lift.filter((p) => p.y > 2.4), ...slide.filter((p) => p.y > 1.6)], 1.6, 6.5, DROP);
  relief.area([[LANE - 8.5, T0 - 1], [LANE + 8.5, T0 - 1], [LANE + 8.5, T1 + 1], [LANE - 8.5, T1 + 1]], 0, DROP);
  // The splash pool at its foot, on the way the slide comes down, and the way up out of it at its far end.
  const end = slide[slide.length - 1];
  const dx = Math.sin(end.yaw), dz = Math.cos(end.yaw);
  /** A point so far on from the slide's foot and so far across, to the left. */
  const on = (ahead: number, across = 0): Vec2 => [end.x + dx * ahead + dz * across, end.z + dz * ahead - dx * across];
  const POOL_LONG = 20, RAMP = 12, POOL_HALF = 11;
  const rect = (a0: number, a1: number, half: number): P2[] => [on(a0, -half), on(a1, -half), on(a1, half), on(a0, half)];
  {
    relief.area(rect(-4, POOL_LONG + RAMP + 24, POOL_HALF + 9), 0, PAVE);
    relief.area(rect(-1, POOL_LONG, POOL_HALF), -1.2, POOL);
    relief.area(rect(POOL_LONG, POOL_LONG + RAMP, 6), (x, z) => -1.2 + (1.2 * ((x - end.x) * dx + (z - end.z) * dz - POOL_LONG)) / RAMP, POOL);
    const [mx, mz] = on((POOL_LONG + RAMP) / 2 - 1);
    const across = Math.abs(dx) > 0.5;
    fords.push({ pos: [mx, mz], half: across ? [(POOL_LONG + RAMP) / 2 + 1, POOL_HALF] : [POOL_HALF, (POOL_LONG + RAMP) / 2 + 1], flow: [dx * 0.4, dz * 0.4], surface: -0.25, drag: 0.35 });
    {
      const [lx, lz] = on(8, POOL_HALF + 2.5);
      for (const [ox, oz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) bar(props, [lx + ox, 0, lz + oz], [lx + ox * 0.6, 2.4, lz + oz * 0.6], 0.07, 0xf2efe6);
      box(lx - 0.7, 2.4, lz - 0.7, lx + 0.7, 2.55, lz + 0.7, 0xf2efe6);
      box(lx - 0.5, 2.55, lz - 0.1, lx + 0.5, 3.3, lz + 0.1, 0xd23a32, { ghost: true });
      props.push({ shape: 'cone', size: [1.1, 0.35, 0], pos: [lx, 4.3, lz], color: 0xd23a32, ghost: true });
      bar(props, [lx, 2.55, lz], [lx, 4.0, lz], 0.04, 0xf2efe6, { ghost: true });
      for (let k = 0; k < 6; k++) {
        const [ux, uz] = on(3 + k * 3.2, -(POOL_HALF + 3));
        object('umbrella', ux, uz);
        object('lounger', ux + 1, uz, end.yaw);
      }
      const [kx, kz] = on(POOL_LONG + RAMP + 6, -(POOL_HALF + 8));
      kiosk(props, signs, { at: [kx, kz], yaw: end.yaw + P / 2, half: [6, 3.4], high: 3.8, wall: 0xd8f0f6, trim: 0xffffff, roof: 'pitched', roofColor: 0x2f6fb0, name: '更衣室', front: 'toilets' });
    }
    for (const side of [-1, 1]) for (let k = 2; k < POOL_LONG; k += 4) {
      const [x, z] = on(k, side * (POOL_HALF - 0.5));
      object('buoy', x, z, 0, -0.25);
    }
    for (const side of [-1, 1]) {
      const [ax, az] = on(0, side * (POOL_HALF + 2)), [bx, bz] = on(POOL_LONG + RAMP, side * (POOL_HALF + 6));
      crowds.push({ area: [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)], count: 16, y: 0 });
    }
  }
  const out = on(POOL_LONG + RAMP + 14);

  const built = relief.build();
  return {
    id: 'parklab',
    name: '第五關試驗場',
    brief: '遊樂園的設施：入園排隊、三座咖啡杯轉盤、雲霄飛車軌道、海盜船、造浪池和大滑水道；按數字鍵跳到各站',
    ground: { center: [-10, 240], half: [120, 410], style: 'asphalt' },
    terrain: built.terrain,
    sinks: ['drop'],
    bounds: [[-130, -170], [110, 650]],
    spawn: [0, 0.9, -146],
    heading: 0,
    props,
    decals,
    objects,
    crowds,
    fords,
    signs,
    waves,
    cargo: standardLoad(),
    traffic: [],
    rigs,
    route: [
      [0, -140], [QUEUE[0].x, QUEUE[0].z - 4], ...QUEUE.filter((_, k) => k % 3 === 0).map((p) => [p.x, p.z] as Vec2), [0, 4], [GATE[0] - 9, 25], [GATE[0] - 9, 40], [0, 60],
      [0, TABLES[0][1] - TEA_FENCE - 4], ...TABLES.map(([x, z]) => [x, z] as Vec2), [0, TABLES[2][1] + TEA_FENCE + 4],
      ...ride.filter((_, k) => k % 3 === 0).map((p) => [p.x, p.z] as Vec2), [RIDE_END.x - 6, RIDE_END.z + 6],
      [LANE, SHIPS[1] - 30], [LANE, SHIPS[1] + 30], [LANE, PZ0 - 6], [LANE - 2.6, PZ0 + 10], [LANE - 2.6, PZ0 + 20], [LANE + 3.4, PZ0 + 29], [LANE + 3.4, PZ0 + 35], [LANE - 2.6, PZ0 + 44], [LANE - 2.6, PZ0 + 52], [LANE, PZ1 + 6],
      ...slide.filter((_, k) => k % 10 === 0).map((p) => [p.x, p.z] as Vec2), on(POOL_LONG + RAMP + 8),
    ],
    checkpoints: [
      { name: 'A 入園排隊', pos: [0, -140], yaw: 0 },
      { name: 'A 廣場', pos: [0, 6], yaw: 0 },
      { name: 'B 咖啡杯', pos: [0, TABLES[0][1] - TEA_FENCE - 8], yaw: 0 },
      { name: 'C 雲霄飛車', pos: [COASTER_AT[0], COASTER_AT[1] - 8], yaw: 0 },
      { name: 'C 第一個下坡', pos: [COASTER_AT[0], COASTER_AT[1] + 84], yaw: 0, y: 12.4 },
      { name: 'D 海盜船', pos: [LANE, SHIPS[1] - 30], yaw: 0 },
      { name: 'E 造浪池', pos: [LANE, PZ0 - 14], yaw: 0 },
      { name: 'E 滑水道', pos: [LANE, T0 + 4], yaw: 0, y: TOP },
    ],
    finish: { pos: out, half: [6, 6] },
    stars: STARS,
    par: 800,
  };
}
