import type { ObjectDesc, ObjectKindId } from './objects';
import { Relief, type Look } from './relief';
import { containerModel } from './city';
import { TRUCK } from '../config';
import type { CargoPlacement } from '../sim/cargo';
import { heightAt } from './terrain';
import { type CrowdDesc, type DecalDesc, type GateDesc, type LessonDesc, type LevelDef, type PropDesc, type SignalDesc, type SignDesc, type TrackDesc, type Vec2, STARS } from './types';

// The tutorial, 新手上路: one road through the back of a freight company's yard to the warehouse next door, each stretch
// of it there to teach one thing, in this order:
//
//   the yard        out of the freight company's yard, along between its shed and the containers, round a bend:
//                   the throttle and the steering
//   the crossing    a railway across the way, the train held back until the truck comes and then sent across in front of
//                   it: the brake
//   the bridge      a short run from the crossing to a bridge over the canal that has fallen in, its last slab tipped
//                   up: the boost, to fly the gap
//   the safe        lying at the roadside beyond, fallen off someone's lorry: out of the cab, pick it up, put it aboard
//   the bay         the warehouse's loading bay: the delivery
//
// It is a practice run: nothing fails it. Down the canal or hit by the train, the truck is put back to try again.
// Walls of sheds, containers and fences close the road in on both sides all the way: there is nowhere else to go.

const ASPHALT: Look = { tag: 'paved', color: 0x5b626b, wall: 0x55585c };
const YARD: Look = { tag: 'paved', color: 0x8d8f8c, wall: 0x7a7c7a };
const WATER: Look = { tag: 'water', color: 0x4f6f6a, wall: 0x6f6f68 };

/** The road's width; the north road's middle; the first leg's, along X. */
const ROAD_WIDE = 8;
const HALF = ROAD_WIDE / 2;
export const RX = 72;
/** The railway, along X across the north road. */
export const TRACK_Z = 70;
/** The run from the crossing to the tipped slab, the slab's run and rise, the canal's width. */
export const RUN = 24;
const KICK_RUN = 3.5;
export const KICK = 0.8;
export const GAP = 25;
export const RAMP_Z = TRACK_Z + 4 + RUN;
export const CANAL0 = RAMP_Z + KICK_RUN;
export const CANAL1 = CANAL0 + GAP;
const CANAL_Y = -3.5;
/** Where the safe lies along the road; the bay. */
export const CRATE_Z = CANAL1 + 55;
/** How far right of the road's middle the safe lies: at the kerb, clear of a truck driving up the middle. */
const SAFE_X = 3.3;
export const BAY_Z = CRATE_Z + 55;
const END_Z = BAY_Z + 10;

const MIN: Vec2 = [-24, -30];
const MAX: Vec2 = [128, END_Z + 16];

/** What the tutorial teaches, in order. */
function lessons(): LessonDesc[] {
  return [
    {
      keys: '按住 <b>W</b> 前進，用 <b>A</b> <b>D</b> 轉彎，開到前面的光圈',
      pad: '按住 <b>RT</b> 前進，用<b>左搖桿</b>轉彎，開到前面的光圈',
      help: '轉彎時放慢一點，車頭對準路再加油門。',
      goal: [RX, 30],
      done: { pastZ: 30 },
      retry: { pos: [4, 0], yaw: Math.PI / 2 },
    },
    {
      keys: '火車來了！按 <b>S</b> 煞車，停在白線前，等火車過去',
      pad: '火車來了！按 <b>LT</b> 煞車，停在白線前，等火車過去',
      help: '看到紅燈閃就提早煞車：S 按得越久煞得越重。',
      from: 38,
      done: { pastZ: TRACK_Z + 6, stopBefore: TRACK_Z - 3 },
      retry: { pos: [RX, 34], yaw: 0 },
    },
    {
      keys: '前面橋斷了！等火車過去，按住 <b>Shift</b> 急加速，從翹起的橋板飛過去',
      pad: '前面橋斷了！等火車過去，按住 <b>X</b> 急加速，從翹起的橋板飛過去',
      help: '先在白線前等火車過去；起步就一直按住急加速不要放開，對準橋板中間衝。',
      goal: [RX, CANAL1 + 8],
      done: { pastZ: CANAL1 + 6 },
      // Back south of the crossing, to wait for the train again: from a standstill there, the boost is what makes the gap.
      retry: { pos: [RX, TRACK_Z - 7], yaw: 0 },
    },
    {
      keys: '路邊有一個掉落的保險箱，把它撿上車',
      pad: '路邊有一個掉落的保險箱，把它撿上車',
      help: '車要停下來才能下車。舉起保險箱走到車尾兩三步外（很重，丟不遠），對準車斗按住蓄力，畫面上的落點落在車斗裡再放開。',
      from: CANAL1 + 6,
      goal: [RX + SAFE_X, CRATE_Z],
      done: 'found',
      retry: { pos: [RX, CANAL1 + 10], yaw: 0 },
    },
    {
      keys: '開進倉庫的卸貨區，停下來交貨',
      pad: '開進倉庫的卸貨區，停下來交貨',
      help: '開進黃色框裡停住，等一下就會交貨。',
      done: 'delivered',
      retry: { pos: [RX, CRATE_Z + 6], yaw: 0 },
    },
  ];
}

/** Six crates, the simplest load there is: two rows of three. */
function tutorialLoad(): CargoPlacement[] {
  const floor = TRUCK.frame.pos[1] + TRUCK.frame.half[1];
  const cargo: CargoPlacement[] = [];
  for (const z of [0.9, 0.1]) for (const x of [-0.74, 0, 0.74]) cargo.push({ type: 'crate', pos: [x, floor + 0.35 + 0.01, z] });
  // And the safe lying at the roadside, against the wall, fallen off someone else's lorry: out of the way of wheels.
  cargo.push({ type: 'safe', pos: [RX + SAFE_X, 0.37, CRATE_Z], rotY: 0.3, found: true });
  return cargo;
}

export function tutorial(): LevelDef {
  const relief = new Relief(MIN, MAX, 8, () => ({ h: 0, look: YARD }));
  const props: PropDesc[] = [];
  const decals: DecalDesc[] = [];
  const signs: SignDesc[] = [];
  const crowds: CrowdDesc[] = [];
  const later: (() => void)[] = [];
  const objects: ObjectDesc[] = [];
  let ground: (x: number, z: number) => number = () => 0;
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, y?: number) => later.push(() => objects.push({ kind, pos: [x, y ?? ground(x, z), z], rotY }));
  const box = (size: [number, number, number], pos: [number, number, number], color: number, extra: Partial<PropDesc> = {}) => props.push({ shape: 'box', size, pos, color, ...extra });
  /** A shed of corrugated sheet, drawn as level 1's are, over the rectangle given; which of its sides face the road. */
  const ROOFS = [0x3f6f8a, 0x4a7a4a, 0xa04a3a, 0x6a7a8a, 0x2f5f8a, 0x8a6a3a];
  const shed = (x0: number, z0: number, x1: number, z1: number, high: number, open: [boolean, boolean, boolean, boolean], seed: number) =>
    box([(x1 - x0) / 2, high / 2, (z1 - z0) / 2], [(x0 + x1) / 2, high / 2, (z0 + z1) / 2], ROOFS[seed % ROOFS.length], { fade: true, building: { style: 'shed', open, crown: 0, seed }, mapColor: 0x7d858c });
  /** A wall of concrete, 2.4 m, along X or along Z. */
  const wall = (x0: number, z0: number, x1: number, z1: number) => box([(x1 - x0) / 2, 1.2, (z1 - z0) / 2], [(x0 + x1) / 2, 1.2, (z0 + z1) / 2], 0xb4b2aa, { mapColor: 0x9a9890 });
  const COLORS = [0x3f6f8a, 0x8a4a3a, 0x4a7a4a, 0xb08a3a, 0x6a5a8a];

  // ---- The road: out of the yard east, round to the north, up to the canal; on from the far side to the warehouse. ----
  relief.ribbon([{ x: MIN[0] + 6, z: 0, h: 0 }, { x: RX, z: 0, h: 0, round: 14 }, { x: RX, z: CANAL0, h: 0 }], ROAD_WIDE, ASPHALT);
  relief.ribbon([{ x: RX, z: CANAL1, h: 0 }, { x: RX, z: END_Z, h: 0 }], ROAD_WIDE, ASPHALT);
  // The canal, right across, its banks upright.
  relief.area([[MIN[0], CANAL0], [MAX[0], CANAL0], [MAX[0], CANAL1], [MIN[0], CANAL1]], CANAL_Y, WATER);

  // ---- The yard: the freight company's shed along the south, containers stacked two high along the north; its gate shut
  // behind the truck. Pallets and cones about the shed's doors. ----
  shed(MIN[0] + 4, -24, 58, -6, 9, [false, false, false, true], 11);
  signs.push({ kind: 'freight', pos: [20, 7.6, -5.9], rotY: 0 });
  wall(MIN[0] + 2, -6, MIN[0] + 4, 8);
  // The containers, end to end with no gaps between them, two high and here and there three, along the north of the first
  // leg and round the inside of the bend; the X row runs on to the bend's corner, the Z row starts behind it.
  const CONTAINER_STEP = 6.1;
  const stack = (x: number, z: number, turned: boolean, n: number) => {
    containerModel(props, x, 0, z, turned, COLORS[n % COLORS.length]);
    containerModel(props, x, 2.6, z, turned, COLORS[(n + 2) % COLORS.length]);
    if (n % 4 === 2) containerModel(props, x, 5.2, z, turned, COLORS[(n + 4) % COLORS.length]);
  };
  const CORNER_X = RX - HALF - 2.4 + 1.2 - 3.05;
  for (let k = 0, x = CORNER_X; x > MIN[0] + 4 + 3.05; k++, x -= CONTAINER_STEP) stack(x, 6.6, true, k);
  let rowEnd = 0;
  for (let k = 0, z = 6.6 + 1.2 + 3.1; z < TRACK_Z - 4.6 - 3.1; k++, z += CONTAINER_STEP) {
    stack(RX - HALF - 2.4, z, false, k + 3);
    rowEnd = z + 3.1;
  }
  // From the last of them to the railway's fence, the yard's gate onto the road, shut: sheet steel between two posts.
  {
    const z0 = rowEnd + 0.05, z1 = TRACK_Z - 4.6 - 0.2, x = RX - HALF - 1.6;
    box([0.06, 1.1, (z1 - z0) / 2 - 0.55], [x, 1.1, (z0 + z1) / 2], 0x3f6f8a, { mapColor: 0x6a7278 });
    for (const z of [z0 + 0.3, z1 - 0.3]) box([0.3, 1.4, 0.3], [x, 1.4, z], 0xb4b2aa, { mapColor: 0x6a7278 });
  }
  // Behind them, inside the bend, the company's other sheds, with lanes between: what shows over the containers.
  shed(MIN[0] + 4, 12, 26, 38, 10, [false, false, false, false], 21);
  shed(31, 12, 58, 32, 8, [false, false, false, false], 22);
  shed(MIN[0] + 4, 44, 44, 60, 7, [false, false, false, false], 23);
  for (const [x, z] of [[-6, -4.6], [-4.4, -4.6], [8, -4.8], [30, -4.8], [31.6, -4.8]] as const) object('pallet', x, z);
  for (const x of [14, 18, 40, 44]) object('cone', x, -4.6);
  crowds.push({ area: [0, -5.5, 12, -4.8], count: 2, y: 0, workers: true, fenced: true });
  // Round the bend: the shed goes on round its outside, the containers' yard fills its inside.
  shed(58, -24, RX + HALF + 18, -6, 9, [false, false, false, true], 12);

  // ---- Up to the crossing: a warehouse on the east of the way, its doors on it; the containers on the west. ----
  shed(RX + HALF + 0.5, -6, RX + HALF + 22, TRACK_Z - 5, 10, [true, false, false, false], 13);
  shed(RX + HALF + 26, -2, MAX[0] - 2, TRACK_Z - 8, 8, [false, false, false, false], 26);
  for (const z of [20, 36, 52]) object('pallet', RX + HALF + 0.2 - 0.9, z);
  object('cone', RX + HALF - 0.4, 44);

  // ---- The crossing: one track, the train kept back in a covered siding either side, out of sight; lamps, gates, stop
  // lines; fences along the track to the sidings. ----
  const tracks: TrackDesc[] = [{ z: TRACK_Z, direction: 1, speed: 10, period: 60, phase: 0, watchX: RX, await: 40 }];
  const signals: SignalDesc[] = [{ pos: [RX, 0.2, TRACK_Z], track: 0, panel: [ROAD_WIDE - 0.6, 3.6] }];
  const gates: GateDesc[] = [];
  const SHED_GAP = 16;
  for (const side of [-1, 1]) {
    // The covered siding: long enough for the train to wait in, and solid.
    const near = RX + side * (HALF + SHED_GAP), far = side < 0 ? MIN[0] : MAX[0];
    box([Math.abs(far - near) / 2, 4, 5], [(near + far) / 2, 4, TRACK_Z], 0x5a6a72, { fade: true, building: { style: 'shed', open: [side > 0, side < 0, false, false], crown: 0, seed: 20 + side }, mapColor: 0x6a7278 });
    box([0.05, 2.6, 2.4], [near - side * 0.06, 2.6, TRACK_Z], 0x15181c, { ghost: true });
    // The track bed and the rails, from siding to siding.
    decals.push({ pos: [RX + side * (HALF + SHED_GAP / 2), TRACK_Z], size: [SHED_GAP, 3.4], color: 0x4f4840, y: 0.04 });
    // Fences along both sides of the track bed, from the road's edge to the siding.
    for (const fz of [TRACK_Z - 4.6, TRACK_Z + 4.6]) wall(Math.min(near, RX + side * (HALF + 0.4)), fz - 0.15, Math.max(near, RX + side * (HALF + 0.4)), fz + 0.15);
  }
  for (const offset of [-0.75, 0.75]) box([(MAX[0] - MIN[0]) / 2, 0.06, 0.09], [(MIN[0] + MAX[0]) / 2, 0.06, TRACK_Z + offset], 0x5a5f66);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = RX + sx * (HALF + 0.5), pz = TRACK_Z + sz * 2.5;
    box([0.1, 1.3, 0.1], [px, 1.3, pz], 0x30363d);
    signals.push({ pos: [px, 2.9, pz], track: 0 });
  }
  for (const side of [-1, 1]) decals.push({ pos: [RX, TRACK_Z + side * 2.9], size: [ROAD_WIDE - 0.6, 0.4], color: 0xf2f2ee, y: 0.06 });
  for (const reach of [1, -1] as const) {
    const px = RX - reach * (HALF + 0.5), pz = TRACK_Z - reach * 2.5;
    gates.push({ pos: [px + reach * 0.25, 1.05, pz], reach, length: ROAD_WIDE - 0.4, track: 0 });
    box([0.28, 0.4, 0.24], [px, 1.05, pz], 0xf2c12e, { ghost: true });
    for (const turn of [Math.PI / 4, -Math.PI / 4]) box([0.7, 0.08, 0.03], [px, 2.25, pz - reach * 0.14], 0xf2efe6, { rot: [0, 0, turn], ghost: true });
  }
  object('signWarn', RX - HALF + 0.3, TRACK_Z - 9);
  object('signWarn', RX + HALF - 0.3, TRACK_Z - 9);

  // ---- From the crossing to the canal: the works on the broken bridge. Fences of hoarding along both sides, the sign, barrels;
  // the site's office and its men behind the west fence. ----
  for (const side of [-1, 1]) {
    const x = RX + side * (HALF + 0.5);
    box([0.1, 1.1, (CANAL0 - TRACK_Z - 5) / 2], [x, 1.1, (TRACK_Z + 4.8 + CANAL0) / 2], 0xe8e2d0, { mapColor: 0x9a9890 });
    for (let z = TRACK_Z + 6; z < CANAL0; z += 3) box([0.06, 0.06, 1.4], [x - side * 0.08, 1.6, z], 0xd04a2a, { ghost: true });
  }
  shed(RX + HALF + 1, TRACK_Z + 5, RX + HALF + 20, CANAL0 - 2, 6, [true, false, false, false], 14);
  for (const y of [0, 2.6]) containerModel(props, RX - HALF - 6, y, TRACK_Z + 9, false, 0xd8d2c4);
  crowds.push({ area: [RX - HALF - 14, TRACK_Z + 6, RX - HALF - 10, CANAL0 - 3], count: 2, y: 0, workers: true, fenced: true });
  // The works' yard behind the west hoarding: a store shed at the back; culverts, rebar, gravel and a mixer for the new bridge.
  shed(MIN[0] + 4, TRACK_Z + 8, RX - HALF - 20, CANAL0 - 3, 7, [false, true, false, false], 24);
  object('culvertStack', RX - HALF - 17, TRACK_Z + 12);
  object('rebar', RX - HALF - 17, TRACK_Z + 18, Math.PI / 2);
  object('gravelPile', RX - HALF - 6, CANAL0 - 6);
  object('mixer', RX - HALF - 12, CANAL0 - 6, 0.4);
  for (let k = 0; k < 3; k++) object('cementBag', RX - HALF - 3 + (k % 2) * 0.8, TRACK_Z + 14 + k * 0.6);
  // East of the works, past the hoarding's shed: another shed, to the edge.
  shed(RX + HALF + 24, TRACK_Z + 7, MAX[0] - 2, CANAL0 - 3, 8, [false, false, false, false], 25);
  // The sign over the way just past the crossing, on a gantry from one side of the road to the other.
  const SIGN_Z = TRACK_Z + 5.4;
  signs.push({ kind: 'brokenBridge', pos: [RX, 4.6, SIGN_Z], rotY: Math.PI });
  for (const side of [-1, 1]) box([0.1, 2.6, 0.1], [RX + side * (HALF + 0.3), 2.6, SIGN_Z], 0x30363d);
  box([HALF + 0.4, 0.08, 0.08], [RX, 5.4, SIGN_Z], 0x30363d, { ghost: true });
  for (const side of [-1, 1]) object('barrel', RX + side * (HALF - 0.6), RAMP_Z - 1.5);
  // The bridge, fallen in: the last slab on this side tipped up, its end broken; the slabs that went down lying in the water;
  // the far side's end broken off square, rods sticking out.
  {
    const long = Math.hypot(KICK_RUN, KICK), a = Math.atan2(KICK, KICK_RUN);
    box([HALF - 0.4, 0.12, long / 2], [RX, KICK / 2 - 0.1, RAMP_Z + KICK_RUN / 2], 0x8a8c88, { rot: [-a, 0, 0] });
    for (let x = RX - HALF + 1; x < RX + HALF - 0.6; x += 0.9) box([0.02, 0.02, long / 2], [x, KICK / 2 + 0.03, RAMP_Z + KICK_RUN / 2], 0x6a6c68, { rot: [-a, 0, 0], ghost: true });
    decals.push({ pos: [RX, RAMP_Z - 1], size: [ROAD_WIDE - 0.4, 1.2], color: 0xe8b81e, y: 0.05 });
    for (let x = RX - HALF + 0.5; x < RX + HALF; x += 1.4) decals.push({ pos: [x, RAMP_Z - 1], size: [0.3, 1.2], rotY: 0.7, color: 0x24262a, y: 0.06 });
    box([HALF - 0.6, 0.35, 3], [RX - 0.8, CANAL_Y + 0.6, CANAL0 + 4], 0x8a8c88, { rot: [0.35, 0.1, 0.2], ghost: true });
    box([HALF - 1.2, 0.35, 2.6], [RX + 1.2, CANAL_Y + 0.4, CANAL1 - 3.5], 0x7f817d, { rot: [-0.3, -0.15, -0.12], ghost: true });
    for (let x = RX - HALF + 0.8; x < RX + HALF; x += 1.1) {
      props.push({ shape: 'cylinder', size: [0.03, 0.35, 0], pos: [x, -0.2, CANAL1 + 0.15], rot: [Math.PI / 2 + 0.25, 0, 0], color: 0x6a4a3a, ghost: true });
    }
    // The bridge's piers, standing in the water where its middle was.
    for (const side of [-1, 1]) props.push({ shape: 'cylinder', size: [0.5, 2.4, 0], pos: [RX + side * 2.5, CANAL_Y + 0.6, (CANAL0 + CANAL1) / 2], color: 0x9a9890 });
  }
  // Rails along both banks of the canal, either side of the bridge.
  for (const z of [CANAL0 - 0.3, CANAL1 + 0.3]) for (const side of [-1, 1]) {
    const from = RX + side * (HALF + 0.6), to = side < 0 ? MIN[0] : MAX[0];
    box([Math.abs(to - from) / 2, 0.55, 0.06], [(from + to) / 2, 0.55, z], 0x9aa0a6, { mapColor: 0x8a9096 });
  }

  // ---- Beyond the canal: a lane of small works. Pavements either side; terraces of workshops, shutters up, scooters
  // parked in front, poles along the west kerb; on the east a builder's merchant, its yard open to the road. The safe at
  // the kerb where the lorry it came off swerved; then the warehouse at the end, its loading bay. ----
  const KERB = 0.15, WALK = 2.5, FRONT = HALF + WALK, DEEP = 12;
  const STREET0 = CANAL1 + 1, STREET1 = BAY_Z - 8;
  for (const side of [-1, 1]) box([WALK / 2, KERB / 2, (STREET1 - STREET0) / 2], [RX + side * (HALF + WALK / 2), KERB / 2, (STREET0 + STREET1) / 2], 0xb0aba0, { paving: true, mapColor: 0x9a9890, mapUnder: true });
  const onWalk = (kind: ObjectKindId, x: number, z: number, rotY = 0) => object(kind, x, z, rotY, KERB);
  const FACADES = [0xd8c9a8, 0xc9b28a, 0xe0d6c4, 0xb9a48c, 0xd4c4a8, 0xa8b4b0, 0xc4a890];
  /** A terrace of workshops, two to four storeys, along one side of the lane from z0 to z1, fronts on the pavement. */
  const terrace = (side: number, z0: number, z1: number, seed: number) => {
    const widths = [7, 6, 8, 6.5, 7.5];
    for (let z = z0, n = 0; z1 - z > 0.5; n++) {
      let w = widths[(seed + n) % widths.length];
      if (z1 - z - w < 4) w = z1 - z;
      const tall = [3.2, 4.8, 6.4, 4.8][(seed + n * 3) % 4];
      box([DEEP / 2, tall, w / 2], [RX + side * (FRONT + DEEP / 2), tall, z + w / 2], FACADES[(seed + n * 3) % FACADES.length], { fade: true, mapColor: 0x7d858c, building: { style: 'old', open: [side > 0, side < 0, false, false], crown: 0, seed: seed * 97 + n * 31 } });
      z += w;
    }
  };
  // The west: workshops all the way, scooters in front of them in twos and threes, pots by the doors.
  terrace(-1, STREET0, STREET1, 3);
  const SCOOTERS: ObjectKindId[] = ['scooterRed', 'scooterBlue', 'scooterWhite', 'scooterBlack', 'scooterYellow', 'scooterTeal'];
  for (const [z, count] of [[STREET0 + 9, 3], [STREET0 + 30, 2], [CRATE_Z + 8, 3], [CRATE_Z + 30, 2], [STREET1 - 12, 3]] as const) {
    for (let k = 0; k < count; k++) onWalk(SCOOTERS[(Math.round(z) + k) % SCOOTERS.length], RX - HALF - 1.3, z + k * 0.9, Math.PI / 2);
  }
  for (const z of [STREET0 + 18, STREET0 + 44, CRATE_Z + 20, STREET1 - 22]) {
    onWalk('flowerPotTall', RX - FRONT + 0.4, z);
    onWalk('flowerPotLow', RX - FRONT + 0.4, z + 1.1);
  }
  for (let z = STREET0 + 4; z < STREET1; z += 26) onWalk('utilityPole', RX - HALF - 0.35, z);
  for (const z of [STREET0 + 24, CRATE_Z + 14]) onWalk('bin', RX - HALF - 0.5, z);
  // The east: workshops, then the builder's merchant: its shed at the back of a yard of bricks, cement, pipes and gravel,
  // the yard open to the pavement through a gap in its low wall; then workshops again.
  const YARD0 = CRATE_Z - 16, YARD1 = CRATE_Z + 12;
  terrace(1, STREET0, YARD0, 8);
  terrace(1, YARD1, STREET1, 13);
  shed(RX + FRONT + DEEP - 2, YARD0, RX + FRONT + DEEP + 10, YARD1, 7, [true, false, false, false], 15);
  for (const [z0, z1] of [[YARD0, CRATE_Z - 6], [CRATE_Z + 2, YARD1]] as const) box([0.12, 0.45, (z1 - z0) / 2], [RX + FRONT - 0.12, KERB + 0.45, (z0 + z1) / 2], 0xb4b2aa, { mapColor: 0x9a9890 });
  for (let k = 0; k < 3; k++) object('bricks', RX + FRONT + 2, YARD0 + 2.5 + k * 1.6);
  for (let k = 0; k < 4; k++) object('cementBag', RX + FRONT + 5 + (k % 2) * 0.8, YARD0 + 2.5 + Math.floor(k / 2) * 0.6);
  object('gravelPile', RX + FRONT + 6, YARD1 - 4);
  for (let k = 0; k < 3; k++) object('concretePipe', RX + FRONT + 3, YARD1 - 7 + k * 0.5, Math.PI / 2);
  object('forklift', RX + FRONT + 7, CRATE_Z - 2, -Math.PI / 2);
  object('wheelbarrow', RX + FRONT + 1.5, CRATE_Z + 4, 0.4);
  for (const z of [CRATE_Z - 9, CRATE_Z + 7]) object('pallet', RX + FRONT + 8, z);
  crowds.push({ area: [RX + FRONT + 3, CRATE_Z - 4, RX + FRONT + 6, CRATE_Z], count: 2, y: 0, workers: true, fenced: true });
  for (const z of [STREET0 + 14, YARD1 + 10]) {
    for (let k = 0; k < 2; k++) onWalk(SCOOTERS[(Math.round(z) + k + 2) % SCOOTERS.length], RX + HALF + 1.3, z + k * 0.9, -Math.PI / 2);
  }
  onWalk('tyreStack', RX + FRONT - 0.6, STREET0 + 26);
  onWalk('gasCylinder', RX + FRONT - 0.5, YARD1 + 18);
  for (let k = 0; k < 4; k++) decals.push({ pos: [RX - 1.2 + k * 0.05, CRATE_Z - 10 + k * 2.5], size: [0.35, 4], rotY: 0.18, color: 0x2a2c2e, y: 0.05 });
  for (let k = 0; k < 4; k++) decals.push({ pos: [RX + 1.2 + k * 0.05, CRATE_Z - 10 + k * 2.5], size: [0.35, 4], rotY: 0.18, color: 0x2a2c2e, y: 0.05 });
  object('pallet', RX - 1.8, CRATE_Z + 3, 0.6);
  // The warehouse: across the end of the road, its bay open to it, the bay marked out in yellow.
  const BAY_HALF: Vec2 = [3.6, 5];
  box([HALF + 22, 5, 6], [RX, 5, END_Z + 6], 0x9aa3a8, { fade: true, building: { style: 'shed', open: [false, false, true, false], crown: 0, seed: 17 }, mapColor: 0x7d858c });
  // The bay's forecourt, walled on both sides from the road's walls to the warehouse: 20 m across.
  const COURT = 10;
  for (const side of [-1, 1]) {
    box([(COURT - HALF) / 2, 1.2, 0.15], [RX + side * (HALF + (COURT - HALF) / 2), 1.2, BAY_Z - 8], 0xb4b2aa, { mapColor: 0x9a9890 });
    box([0.15, 1.2, (END_Z - BAY_Z + 8) / 2], [RX + side * COURT, 1.2, (BAY_Z - 8 + END_Z) / 2], 0xb4b2aa, { mapColor: 0x9a9890 });
    // The gateway's pillars, either side of the way in, capped; the gate itself slid back along the wall.
    box([0.35, 1.72, 0.35], [RX + side * (HALF + 0.3), 1.7, BAY_Z - 8], 0xc9584a, { mapColor: 0x9a9890 });
    box([0.42, 0.08, 0.42], [RX + side * (HALF + 0.3), 3.48, BAY_Z - 8], 0x3a3f45, { ghost: true });
    for (let k = 0; k < 6; k++) box([0.03, 1.25, 0.03], [RX + side * (HALF + 1.2 + k * 0.7), 1.35, BAY_Z - 8.35], 0x3a3f45, { ghost: true });
    for (const y of [0.2, 2.55]) box([2.1, 0.04, 0.03], [RX + side * (HALF + 0.95 + 2.1), y, BAY_Z - 8.35], 0x3a3f45, { ghost: true });
  }
  for (const side of [-1, 1]) decals.push({ pos: [RX + side * BAY_HALF[0], BAY_Z], size: [0.25, BAY_HALF[1] * 2], color: 0xf2c12e, y: 0.06 });
  for (const dz of [-1, 1]) decals.push({ pos: [RX, BAY_Z + dz * BAY_HALF[1]], size: [BAY_HALF[0] * 2, 0.25], color: 0xf2c12e, y: 0.06 });
  signs.push({ kind: 'unload', pos: [RX, 6.2, END_Z - 0.1], rotY: Math.PI });
  for (const [x, z] of [[RX - HALF + 0.8, BAY_Z + 3], [RX + HALF - 0.8, BAY_Z - 2]] as const) object('pallet', x, z);
  crowds.push({ area: [RX + HALF - 1.4, BAY_Z + 4, RX + HALF - 0.6, BAY_Z + 7], count: 1, y: 0, workers: true, fenced: true });
  // The forecourt's sides: the warehouse's forklift parked, pallets stacked, roll cages, a bin.
  object('forklift', RX - COURT + 2, BAY_Z + 1, Math.PI / 2);
  for (let k = 0; k < 3; k++) object('pallet', RX + COURT - 1.6, BAY_Z - 5 + k * 1.4, 0.1 * k);
  for (const z of [BAY_Z - 4, BAY_Z - 2.4]) object('box', RX - COURT + 1.2, z, 0.3);
  object('bin', RX + COURT - 1, BAY_Z + 6);

  const { terrain } = relief.build();
  ground = (x, z) => heightAt(terrain, x, z);
  for (const add of later) add();

  return {
    id: 'tutorial',
    name: '新手上路',
    brief: '從貨運行後院出發：學開車、煞車、飛越斷橋、下車撿貨，最後到倉庫卸貨',
    ground: { center: [(MIN[0] + MAX[0]) / 2, (MIN[1] + MAX[1]) / 2], half: [(MAX[0] - MIN[0]) / 2 + 200, (MAX[1] - MIN[1]) / 2 + 200], style: 'asphalt' },
    terrain,
    sinks: ['water'],
    bounds: [MIN, MAX],
    spawn: [4, 0.9, 0],
    heading: Math.PI / 2,
    props,
    objects,
    decals,
    signs,
    crowds,
    tracks,
    signals,
    gates,
    cargo: tutorialLoad(),
    traffic: [],
    route: [[4, 0], [RX - 14, 0], [RX, 14], [RX, BAY_Z]],
    checkpoints: lessons().map((lesson, n) => ({ name: `第 ${n + 1} 步`, pos: lesson.retry.pos, yaw: lesson.retry.yaw })),
    finish: { pos: [RX, BAY_Z], half: BAY_HALF },
    practice: true,
    lessons: lessons(),
    stars: STARS,
    par: 600,
  };
}
