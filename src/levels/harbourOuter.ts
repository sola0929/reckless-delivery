import type { Vec3 } from '../config';
import { containerModel } from './city';
import type { ObjectDesc, ObjectKindId } from './objects';
import type { Look, Relief } from './relief';
import type { CrowdDesc, LevelDef, PropDesc, RigDesc, SignDesc, StillWaterDesc, Vec2 } from './types';
import { fishingBoat, pontoon, reeferShip } from './vessels';

// Level 4's last places, out through the flood gate to the outer harbour, where the boats too big for the inner one lie
// and the reefer ship is loading the last of the catch before the port shuts for the storm. Our load is the last to go
// aboard: down onto the outer quay, out over the boats rafted across the basin to the pier the ship lies off, up her
// stern ramp, along her open side, to the deck forward where her crane is waiting.
//
//   the outer quay   down the ramp from the gate and round right on the quay, short and full: the gangway's head shut off
//                    for the storm with barriers, baskets, nets and drums along the edge, a kerb and the water past it
//   the boats        down the long gangway onto the pontoon, which rises and falls; across it and over four fishing boats
//                    lying side by side, each rocking on its own, crossed on steel plates laid from deck to deck; each a
//                    different boat at a different height, the way across stepping aside once; their decks cluttered
//   the pier         up off the last boat onto the pier and round left along it between the cartons waiting to go aboard
//                    and the reefer containers, to the ship's ramp
//   the ship         up her stern ramp; along her near side between her hatches and her rail, her containers there left
//                    loose and sliding across with her roll, her rail open in places; forward to her fore deck, the end
//
// Water all round: off any edge is into it. Nothing on a deck that moves stands still in the world while the deck moves:
// what is on the boats and the ship is carried by them until the truck comes to it.

export interface OuterParts {
  props: PropDesc[];
  objects: ObjectDesc[];
  signs: SignDesc[];
  rigs: RigDesc[];
  pools: NonNullable<LevelDef['pools']>;
  stillWater: StillWaterDesc[];
  crowds: CrowdDesc[];
}

/** The outer harbour's water, its surface and its bottom. */
export const SURF = -3, BED = -8;
/** The quay outside the sea wall, west of the basin; the ramp down to it from the gate; the pier across the basin. */
export const QUAY = { x0: -120, x1: -30, z0: 400, z1: 452 };
export const OUT_RAMP = { x0: -47.25, x1: -40.75, z0: 400, z1: 428, h: 4 };
export const PIER = { x0: 52.9, x1: 68.9, z0: 400, z1: 474 };
/** Where the way comes onto the boats off the pontoon, and where it goes over the last, straight, and up onto the pier. Before
 * that, each boat is crossed aslant: on at one place, off at another, the plates between them where each pair's gear
 * leaves room. */
const CROSS_A = 440, CROSS_B = 444;
const PONTOON = { x: -2.4, y: -1.9, z: CROSS_A, w: 4.5, l: 10 };
/** The ship: her middle, her deck's height, half her beam and length; her hatches; the forecastle's start. */
export const SHIP = { x: 60.9, y: 2.0, z: 524.4, w: 14, l: 50, hatch: 2.6, fore: 31 };
const HATCHES: [number, number][] = [[-27, -13], [-11, 3], [5, 19]];
/** Where the load is to be set down: on her fore deck under the crane, in the square painted there. */
export const FINISH = { pos: [SHIP.x - 3.5, SHIP.z + (HATCHES[2][1] + SHIP.fore) / 2] as Vec2, half: [5.5, 4.2] as Vec2 };

interface Boat {
  x: number;
  z: number;
  /** Bow north (0) or south (pi). */
  yaw: number;
  w: number;
  l: number;
  deck: number;
  color: number;
  kind: 'longline' | 'trawl' | 'squid';
  /** Where it is crossed on its west side and on its east, in the world. */
  west: number;
  east: number;
  gear: number;
  hold: number;
  heave: number;
  roll: number;
  period: number;
  phase: number;
  flags?: number[][];
}

const FLAG = { red: 0xd23c2c, yellow: 0xf2c12e, blue: 0x2f6fb0, green: 0x2e9a6a, white: 0xf2f0ea, pink: 0xe86a9a };
/** The four boats rafted across the basin, west to east: each a different boat, lying a different way, at its own height. */
const BOATS: Boat[] = [
  { x: 8.7, z: 440.6, yaw: 0, w: 5.7, l: 12.5, deck: -1.6, color: 0x2f6fb0, kind: 'longline', west: CROSS_A, east: 443.2, gear: 5.0, hold: -4.3, heave: 0.25, roll: 0.046, period: 4.8, phase: 0.1, flags: [[FLAG.red, FLAG.yellow, FLAG.blue], [FLAG.white, FLAG.red], [FLAG.green, FLAG.yellow, FLAG.red]] },
  { x: 20.8, z: 443, yaw: Math.PI, w: 5.5, l: 11, deck: -1.85, color: 0xd23c2c, kind: 'trawl', west: 443.2, east: 440.6, gear: 7.0, hold: -3.4, heave: 0.3, roll: 0.06, period: 3.9, phase: 0.55 },
  { x: 33.2, z: 441.4, yaw: 0, w: 6.0, l: 13.5, deck: -1.35, color: 0x2e9a6a, kind: 'squid', west: 440.6, east: CROSS_B, gear: 6.0, hold: -4.0, heave: 0.28, roll: 0.052, period: 5.6, phase: 0.3, flags: [[FLAG.pink, FLAG.white], [FLAG.yellow, FLAG.red, FLAG.blue]] },
  { x: 45.9, z: 444.8, yaw: Math.PI, w: 5.8, l: 13, deck: -1.0, color: 0xe0a020, kind: 'longline', west: CROSS_B, east: CROSS_B, gear: -4.6, hold: 7.6, heave: 0.22, roll: 0.04, period: 6.2, phase: 0.8 },
];
/** A boat's own frame: a point in the world, as along and across it from its middle, its deck's top at nought. */
const local = (b: Boat, x: number, y: number, z: number): Vec3 => (b.yaw === 0 ? [x - b.x, y - b.deck, z - b.z] : [b.x - x, y - b.deck, b.z - z]);

/** The way through, for the level's route and the test drives: from the gate to the square on the ship's fore deck. */
export const OUTER_WAY: Vec2[] = [
  [-44, 398], [-44, 426], [-43.2, 431.5], [-40.6, 436], [-36.5, 439.2], [-31, 440], [-5, 440], [3.52, 440.1], [8.7, 441.6], [13.88, 443.1], [15.45, 443.2], [20.8, 441.9], [26.45, 440.6], [27.45, 440.6], [33.2, 442.3],
  [39.2, CROSS_B], [PIER.x0, CROSS_B], [PIER.x0 + 4.1, 445], [PIER.x0 + 6.9, 448.4], [SHIP.x, 453.4], [SHIP.x, 464], [SHIP.x, SHIP.z - SHIP.l + 2], [SHIP.x - 3, SHIP.z - SHIP.l + 9],
  [SHIP.x - 8.1, SHIP.z - SHIP.l + 18], [SHIP.x - 8.1, SHIP.z + 17], [FINISH.pos[0], FINISH.pos[1]],
];
/** Places along it to start from: the quay below the ramp; the pontoon; the pier; the ship's stern. [x, z, yaw, y]. */
export const OUTER_SPOTS = {
  quay: [-44, 402, 0, 4] as [number, number, number, number],
  pontoon: [-12, CROSS_A, Math.PI / 2, -1.2] as [number, number, number, number],
  pier: [PIER.x0 + 6.3, 444, 0, 0] as [number, number, number, number],
  ship: [SHIP.x, 462, 0, 0] as [number, number, number, number],
};

export function outerHarbour(relief: Relief, looks: { quay: Look; water: Look; ramp: Look }, min: Vec2, max: Vec2, base: number): OuterParts {
  const props: PropDesc[] = [];
  const objects: ObjectDesc[] = [];
  const signs: SignDesc[] = [];
  const rigs: RigDesc[] = [];
  const add = (rig: RigDesc) => base + rigs.push(rig) - 1;
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, more: Partial<PropDesc> = {}) =>
    props.push({ shape: 'box', size: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2], pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color, ...more });
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, y = 0, more: Partial<ObjectDesc> = {}) => objects.push({ kind, pos: [x, y, z], rotY, ...more });
  const rod = (a: Vec3, b: Vec3, r: number, color: number, more: Partial<PropDesc> = {}) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], long = Math.hypot(d[0], d[1], d[2]);
    props.push({ shape: 'cylinder', size: [r, long / 2, 0], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [0, Math.atan2(-d[2], d[0]), -Math.acos(d[1] / long)], color, ...more });
  };
  const rect = (x0: number, z0: number, x1: number, z1: number): [number, number][] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const UP: Partial<PropDesc> = { ghost: true, fade: true, overhead: true };
  const STEEL = 0x5f666c, YELLOW = 0xe0b020, DARK = 0x2a2c30, CONCRETE = 0x9a9c98;

  // The ground: the sea outside the wall, deep; the quay and the pier at the street's height; the ramp down off the gate.
  relief.area(rect(min[0], 400, max[0], max[1]), BED, looks.water);
  relief.area(rect(QUAY.x0, QUAY.z0, QUAY.x1, QUAY.z1), 0, looks.quay);
  relief.area(rect(PIER.x0, PIER.z0, PIER.x1, PIER.z1), 0, looks.quay);
  relief.area(rect(OUT_RAMP.x0, OUT_RAMP.z0, OUT_RAMP.x1, OUT_RAMP.z1), (_x, z) => (OUT_RAMP.h * (OUT_RAMP.z1 - z)) / (OUT_RAMP.z1 - OUT_RAMP.z0), looks.ramp);
  const pools: OuterParts['pools'] = [{ area: [min[0] - 300, 400, max[0] + 300, max[1] + 300], surface: SURF, tint: 0x2c4a4c, flow: [0.06, 0.1], rain: true, waves: 0.32 }];
  const stillWater: StillWaterDesc[] = [{ area: [min[0] - 300, 400, max[0] + 300, max[1] + 300], surface: SURF, outlet: [140, 640], drift: 0.12, deep: true }];

  // The ramp down from the gate: a parapet each side, a rail along it, posts; its foot squared off and striped.
  const tilt = Math.atan2(OUT_RAMP.h, OUT_RAMP.z1 - OUT_RAMP.z0), long = Math.hypot(OUT_RAMP.h, OUT_RAMP.z1 - OUT_RAMP.z0), mid = (OUT_RAMP.z0 + OUT_RAMP.z1) / 2;
  const rampAt = (z: number) => (OUT_RAMP.h * (OUT_RAMP.z1 - z)) / (OUT_RAMP.z1 - OUT_RAMP.z0);
  for (const x of [OUT_RAMP.x0 - 0.2, OUT_RAMP.x1 + 0.2]) {
    props.push({ shape: 'box', size: [0.2, 0.45, long / 2], pos: [x, OUT_RAMP.h / 2 + 0.45, mid], rot: [tilt, 0, 0], color: 0xa4a49c });
    props.push({ shape: 'box', size: [0.05, 0.05, long / 2], pos: [x, OUT_RAMP.h / 2 + 1.2, mid], rot: [tilt, 0, 0], color: 0xd0a030, ghost: true });
    for (let z = OUT_RAMP.z0 + 1.5; z < OUT_RAMP.z1; z += 3) box(x - 0.03, rampAt(z) + 0.9, z - 0.03, x + 0.03, rampAt(z) + 1.2, z + 0.03, 0xd0a030, { ghost: true });
    for (let k = 0; k < 4; k++) box(x - 0.25, k * 0.28, OUT_RAMP.z1, x + 0.25, (k + 1) * 0.28, OUT_RAMP.z1 + 0.3, k % 2 ? DARK : YELLOW);
    // Its face down to the quay, ribbed where the shuttering was.
    for (let z = OUT_RAMP.z0 + 2; z < OUT_RAMP.z1 - 1; z += 2) box(x + Math.sign(x - OUT_RAMP.x0 - 3) * 0.21 - 0.02, 0, z - 0.02, x + Math.sign(x - OUT_RAMP.x0 - 3) * 0.21 + 0.02, Math.max(0.2, rampAt(z) - 0.1), z + 0.02, 0x8c8c84, { ghost: true });
  }
  for (const z of [OUT_RAMP.z1 + 0.6, OUT_RAMP.z1 + 2.8]) box(OUT_RAMP.x0, 0.008, z, OUT_RAMP.x1, 0.014, z + 0.12, 0xd8b02a, { ghost: true });
  // Washed up the ramp's lower half by the waves coming over the quay: a net in a heap on the west, floats and polystyrene
  // about it and the odd tyre; weed left in lines where the water stopped.
  {
    const slope = Math.atan2(OUT_RAMP.h, OUT_RAMP.z1 - OUT_RAMP.z0);
    object('netHeap', OUT_RAMP.x0 + 1.5, 417.5, 0.6, rampAt(417.5), { tilt: slope });
    for (const [x, z] of [[-44.2, 414.6], [-42.6, 419.2], [-45.4, 421.6], [-43.4, 425.8], [-46.2, 426.2], [-41.8, 413.2]]) object('buoy', x, z, x, rampAt(z));
    for (const [x, z, a] of [[-43.1, 416.6, 0.4], [-45.9, 412.4, 1.9], [-42.2, 426.4, 2.8]] as const) object('foamBox', x, z, a, rampAt(z), { tilt: slope });
    object('tyre', -44.6, 410.8, 0.3, rampAt(410.8));
    for (let k = 0; k < 9; k++) {
      const z = 412 + (k % 3) * 5 + Math.floor(k / 3) * 1.4, x = OUT_RAMP.x0 + 0.8 + ((k * 2.3) % 5);
      props.push({ shape: 'box', size: [0.25, 0.005, 0.7], pos: [x, rampAt(z) + 0.02, z], rot: [slope, k * 1.3, 0], color: 0x3d5a3a, ghost: true });
    }
  }

  // The sea wall's outer face: weep holes along it, the harbour's name painted up on it, iron rungs down it by the basin.
  for (let x = QUAY.x0 + 3; x < PIER.x1; x += 4) {
    // Not behind the gear stores, nor the ramp.
    if (x < -51.5 || (x > OUT_RAMP.x0 - 1 && x < OUT_RAMP.x1 + 1)) continue;
    box(x - 0.15, 0.9, 399.98, x + 0.15, 1.1, 400.04, 0x3a3c3a, { ghost: true });
    box(x - 0.1, 0, 400, x + 0.1, 0.9, 400.03, 0x6f746c, { ghost: true });
  }
  signs.push({ kind: 'name', text: '南安漁港　外港', colors: ['#a4a49c', '#2a4a6a', '#a4a49c'], wide: 9, pos: [-84, 4.6, 400.05], rotY: 0 });
  for (let y = SURF + 0.3; y < 5.6; y += 0.4) box(-28.6, y, 400, -28.0, y + 0.04, 400.25, 0x6a6e70, { ghost: true });

  // Along the wall's foot west of the ramp: the fishermen's gear stores, roller doors open on nets and floats; their
  // pickups and scooters out front; the corner where the nets are mended, under a tarpaulin on poles.
  for (const [x0, x1, s] of [[-120, -98, 201], [-97.5, -74, 202], [-73.5, -52, 203]] as const) {
    box(x0, 0, 400, x1, 4.6, 410, 0xd8cfbf, { fade: true, building: { style: 'shed', open: [false, false, false, true], crown: 0, seed: s } });
    signs.push({ kind: 'name', text: '漁具倉庫', colors: ['#2a4a6a', '#f2efe6', '#f2efe6'], wide: 3.2, pos: [(x0 + x1) / 2, 3.9, 410.08], rotY: 0 });
  }
  props.push({ shape: 'box', size: [0.9, 0.7, 2.2], pos: [-58, 0.9, 415], rot: [0, 0.08, 0], color: 0xe8e6e0, vehicle: 'pickup' });
  props.push({ shape: 'box', size: [0.9, 0.7, 2.2], pos: [-62.4, 0.9, 415.4], rot: [0, -0.1, 0], color: 0x2f62a8, vehicle: 'pickup' });
  const SCOOTERS = ['scooterRed', 'scooterBlue', 'scooterWhite', 'scooterBlack', 'scooterYellow', 'scooterTeal'] as const;
  for (let k = 0; k < 7; k++) object(SCOOTERS[(k * 5 + 2) % 6], -90 + k * 0.85, 411.4, (rand() - 0.5) * 0.2);
  props.push({ shape: 'box', size: [4.2, 0.03, 3.2], pos: [-82, 2.7, 424], rot: [0.1, 0, 0.04], color: 0x2f62a8, ...UP });
  for (const [x, z] of [[-86, 421], [-78, 421], [-86, 427], [-78, 427]]) rod([x, 0, z], [x, 2.6 + (z > 424 ? -0.25 : 0.35), z], 0.05, 0x8a8f96);
  for (const [x, z, a] of [[-83.5, 423.4, 0.3], [-80.2, 425.2, 2.2]] as const) object('netHeap', x, z, a);
  for (const [x, z] of [[-84.8, 425.6], [-81.4, 422.6], [-79.6, 426.2]]) object('stool', x, z);
  for (let k = 0; k < 10; k++) object('buoy', -86 + rand() * 6, 428.5 + rand() * 1.6, rand() * 3);

  // A boat hauled out on the hard: up on its keel blocks and props, the boat lift standing over it with its slings still
  // under it, the work on its hull half done.
  const hauled = add({ kind: 'float', hull: 'vessel', pos: [-96, 3.1, 432], yaw: Math.PI / 2, half: [3.4, 0, 9], period: 1, phase: 0,
    parts: fishingBoat({ w: 3.4, l: 9, color: 0x3f9a94, kind: 'trawl', gaps: [[-1, 0]], gear: 5.4, hold: -2.6 }) });
  void hauled;
  for (const x of [-102, -98, -94, -90]) {
    box(x - 0.5, 0, 431.4, x + 0.5, 0.55, 432.6, 0x6e5a42);
    for (const s of [-1, 1]) rod([x, 0, 432 + s * 3.7], [x, 1.8, 432 + s * 3.0], 0.07, 0x8a5a2a);
  }
  const LIFT = 0x2f62a8;
  for (const x of [-104.5, -87.5]) {
    for (const z of [426.5, 437.5]) box(x - 0.35, 0, z - 0.35, x + 0.35, 8.2, z + 0.35, LIFT);
    box(x - 0.4, 7.6, 426.1, x + 0.4, 8.6, 437.9, LIFT, UP);
    for (const z of [426.5, 437.5]) props.push({ shape: 'cylinder', size: [0.45, 0.3, 0], pos: [x, 0.45, z], rot: [0, 0, Math.PI / 2], color: DARK, ghost: true });
  }
  for (const z of [426.5, 437.5]) box(-104.5, 7.8, z - 0.3, -87.5, 8.4, z + 0.3, LIFT, UP);
  for (const x of [-100, -92]) for (const s of [-1, 1]) rod([x, 7.6, 432 + s * 5.5], [x, 0.9, 432 + s * 2.9], 0.04, 0x2a2c30, { ghost: true });
  object('ladder', -100, 435.3, 0.3);
  object('paintPail', -99.4, 436.3);
  object('paintPail', -100.6, 436.6, 1);
  // The yard's work stage up its side to the gap in its bulwark, at its deck's height: a landing of planks on scaffold
  // tubes, a steel stair down from it along the hull, yellow at each tread's edge; rails round. Solid, to be climbed.
  {
    const DECK_Y = 3.1, Z0 = 435.55, Z1 = 437.05, X0 = -97.6, X1 = -94.4, FOOT = X1 + DECK_Y / 0.84;
    const TUBE = 0x9aa0a6, PLANK = 0x9a7a50, NOSE = 0xe8b820, SEEN = { ghost: true, fade: true } as const;
    box(X0, DECK_Y - 0.1, Z0, X1, DECK_Y, Z1, PLANK, { fade: true });
    for (let x = X0 + 0.25; x < X1; x += 0.25) box(x - 0.01, DECK_Y, Z0, x + 0.01, DECK_Y + 0.004, Z1, 0x6e5a42, { ghost: true });
    for (const x of [X0 + 0.05, X1 - 0.05]) for (const z of [Z0 + 0.05, Z1 - 0.05]) rod([x, 0, z], [x, DECK_Y + 1, z], 0.04, TUBE);
    for (const y of [0.9, 2.0]) rod([X0 + 0.05, y, Z1 - 0.05], [X1 - 0.05, y, Z1 - 0.05], 0.03, TUBE, { ghost: true });
    const long = Math.hypot(FOOT - X1, DECK_Y), n = Math.round(DECK_Y / 0.3), mid = (Z0 + Z1) / 2;
    props.push({ shape: 'box', size: [long / 2, 0.05, (Z1 - Z0) / 2], pos: [(X1 + FOOT) / 2, DECK_Y / 2 - 0.1, mid], rot: [0, 0, -Math.atan2(DECK_Y, FOOT - X1)], color: 0x6f767c, fade: true });
    for (let i = 1; i < n; i++) {
      const x = X1 + ((FOOT - X1) * i) / n, y = DECK_Y - (DECK_Y * i) / n;
      box(x - 0.13, y - 0.04, Z0 + 0.05, x + 0.13, y, Z1 - 0.05, 0x8a9298, SEEN);
      box(x + 0.1, y - 0.045, Z0 + 0.05, x + 0.16, y + 0.005, Z1 - 0.05, NOSE, { ghost: true });
    }
    // Its rails: along the stair both sides, round the landing's open sides; the top ones solid.
    const rail = (a: Vec3, b: Vec3) => {
      rod([a[0], a[1] + 1, a[2]], [b[0], b[1] + 1, b[2]], 0.025, NOSE, { fade: true });
      rod([a[0], a[1] + 0.5, a[2]], [b[0], b[1] + 0.5, b[2]], 0.018, NOSE, { ghost: true });
      const m = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.3));
      for (let k = 0; k <= m; k++) {
        const t = k / m;
        rod([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + 1, a[2] + (b[2] - a[2]) * t], 0.02, NOSE, { ghost: true });
      }
    };
    for (const z of [Z0 + 0.03, Z1 - 0.03]) rail([X1, DECK_Y, z], [FOOT, 0, z]);
    rail([X0, DECK_Y, Z1 - 0.03], [X1, DECK_Y, Z1 - 0.03]);
    rail([X0 + 0.03, DECK_Y, Z0], [X0 + 0.03, DECK_Y, Z1]);
    box(FOOT - 0.1, 0, Z0, FOOT + 0.5, 0.05, Z1, 0x9a9c98, { ghost: true });
  }
  // On its deck by the wheelhouse, what the crew left stacked: fish boxes two high and four high against its side, and up
  // on the ledge round its upper tier a crate; one onto the next, a jump each, up onto its roof. Where on the boat, as it
  // lies: across it, up from its deck, along it from its middle.
  {
    const onBoat = (x: number, y: number, z: number): Vec3 => [-96 + z, 3.1 + y, 432 - x];
    const crate = (x: number, z: number, y0: number, y1: number, halfX: number, halfZ: number, color: number) => {
      const [wx, wy0, wz] = onBoat(x, y0, z);
      box(wx - halfZ, wy0, wz - halfX, wx + halfZ, wy0 + (y1 - y0), wz + halfX, color);
    };
    const FISH = [0x2f6ab8, 0xc8372d, 0xe8b82e, 0x2f6ab8];
    for (let k = 0; k < 2; k++) crate(-2.75, -4.6, k * 0.3, k * 0.3 + 0.29, 0.3, 0.35, FISH[(k + 1) % 4]);
    for (let k = 0; k < 4; k++) crate(-2.75, -5.4, k * 0.3, k * 0.3 + 0.29, 0.3, 0.35, FISH[k]);
    crate(-1.82, -6.2, 2.3, 3.1, 0.25, 0.32, 0x9a7a50);
    crate(-1.82, -6.2, 3.1, 3.12, 0.26, 0.33, 0x7a5f3c);
  }

  // The boats' fuel, at the quay's edge: the attendant's booth, its pump and hose to the water, the tanks behind a fence.
  box(-71.6, 0, 444, -68.4, 2.6, 446.6, 0xf2f0ea);
  box(-71.7, 1.4, 446.6, -68.3, 2.0, 446.7, 0x2f62a8, { ghost: true });
  box(-72, 2.6, 443.7, -68, 2.8, 446.9, 0x2f62a8);
  box(-70.6, 0.9, 446.62, -69.2, 2.0, 446.68, 0x2a3440, { ghost: true });
  signs.push({ kind: 'name', text: '漁船加油站', colors: ['#2f62a8', '#f2efe6', '#f2efe6'], wide: 3.4, pos: [-70, 3.3, 446.95], rotY: 0 });
  box(-66.4, 0, 449.2, -65.6, 1.6, 450.0, 0xe8e6de);
  box(-66.45, 1.0, 449.15, -65.55, 1.4, 450.05, 0xc8372d, { ghost: true });
  rod([-66, 1.2, 450], [-66, 0.3, 451.6], 0.05, DARK, { ghost: true });
  rod([-66, 0.3, 451.6], [-66, SURF + 1.6, 452.6], 0.05, DARK, { ghost: true });
  for (const x of [-74.5, -77.5]) {
    props.push({ shape: 'cylinder', size: [1.0, 2.2, 0], pos: [x, 1.3, 443.5], rot: [Math.PI / 2, 0, 0], color: 0xe8e6de });
    for (const z of [442, 445]) box(x - 0.8, 0, z - 0.2, x + 0.8, 0.4, z + 0.2, 0x9a9c98);
  }
  for (let x = -79.6; x < -72.2; x += 0.8) box(x - 0.03, 0, 440.6, x + 0.03, 1.4, 440.66, 0x8a8f96, { ghost: true });
  box(-79.6, 1.3, 440.6, -72.4, 1.36, 440.66, 0x8a8f96, { ghost: true });

  // The quay's edge: its coping, painted; a kerb against wheels; bollards; old tyres hung over for the boats.
  const edgeKerb = (x0: number, z0: number, x1: number, z1: number) => {
    box(x0, 0, z0, x1, 0.25, z1, 0xb8b8b0);
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const n = Math.floor((along ? Math.abs(x1 - x0) : Math.abs(z1 - z0)) / 1.2);
    for (let k = 0; k < n; k += 2) {
      const a = k * 1.2;
      if (along) box(Math.min(x0, x1) + a, 0.25, z0, Math.min(x0, x1) + a + 1.2, 0.26, z1, YELLOW, { ghost: true });
      else box(x0, 0.25, Math.min(z0, z1) + a, x1, 0.26, Math.min(z0, z1) + a + 1.2, YELLOW, { ghost: true });
    }
  };
  const bollard = (x: number, z: number) => {
    props.push({ shape: 'cylinder', size: [0.22, 0.32, 0], pos: [x, 0.32, z], color: DARK });
    props.push({ shape: 'cylinder', size: [0.32, 0.06, 0], pos: [x, 0.66, z], color: DARK, ghost: true });
  };
  edgeKerb(QUAY.x0, QUAY.z1 - 0.35, QUAY.x1, QUAY.z1);
  edgeKerb(QUAY.x1 - 0.35, QUAY.z0, QUAY.x1, CROSS_A - 2.6);
  edgeKerb(QUAY.x1 - 0.35, CROSS_A + 2.6, QUAY.x1, QUAY.z1 - 0.35);
  for (let x = QUAY.x0 + 6; x < QUAY.x1 - 2; x += 8) if (x < -67 || x > -64) bollard(x, QUAY.z1 - 1.1);
  for (const z of [406, 418, 430, 448]) bollard(QUAY.x1 - 1.1, z);
  for (let x = QUAY.x0 + 3; x < QUAY.x1; x += 3.6) props.push({ shape: 'cylinder', size: [0.4, 0.13, 0], pos: [x, -0.55, QUAY.z1 + 0.15], rot: [Math.PI / 2, 0, 0], color: 0x1e1f22, ghost: true });
  // Lamps along the quay's edge.
  for (const x of [-112, -92, -64, -38]) object('lamp', x, QUAY.z1 - 2.2, Math.PI);

  // Boats along the quay's edge, in for the storm, made fast to its bollards, doubled lines; at the fuel berth one taking
  // on fuel. None where the way comes round toward the edge.
  const moored = (x: number, z: number, yaw: number, w: number, l: number, color: number, kind: Boat['kind'], deck: number, phase: number, ties: [Vec3, Vec3][], flags?: number[][]) => {
    const lines = ties.map(([at, to]) => ({ at, to, color: rand() < 0.5 ? 0xe8e4d8 : 0x2f6fb0 }));
    return add({ kind: 'float', hull: 'vessel', pos: [x, deck, z], yaw, half: [w, 0, l], heave: 0.22, roll: 0.06, pitch: 0.015, period: 4.4 + phase * 1.5, phase,
      parts: fishingBoat({ w, l, color, kind, gaps: [], gear: l * 0.3, hold: -l * 0.25, flags }), lines });
  };
  // Boats lying along the quay (yaw pi/2: their bows east), their lines to the bollards fore and aft.
  for (const [x, color, kind, ph] of [[-108, 0xb3463a, 'longline', 0.2], [-88, 0x3f9a94, 'squid', 0.6], [-66, 0x2f6fb0, 'trawl', 0.35]] as const) {
    const w = 3.4, l = 9, z = QUAY.z1 + 1.1 + w;
    moored(x, z, Math.PI / 2, w, l, color, kind, SURF + 1.25, ph, [
      [[w - 0.2, 0.7, 5.5], [x + 6.5, 0.55, QUAY.z1 - 1.1]],
      [[w - 0.2, 0.7, -6.5], [x - 7.5, 0.55, QUAY.z1 - 1.1]],
    ], kind === 'squid' ? [[FLAG.red, FLAG.white, FLAG.blue], [FLAG.yellow, FLAG.green]] : undefined);
  }
  // One in the basin's corner under the end of the ice plant's chute, its hold open to the ice.
  const iceBoatX = QUAY.x1 + 1.3 + 3.3;
  moored(iceBoatX, 412.5, 0, 3.3, 9.5, 0xe0a020, 'longline', SURF + 1.2, 0.8, [
    [[-3.1, 0.7, 6], [QUAY.x1 - 1.1, 0.55, 418]],
    [[-3.1, 0.7, -6.5], [QUAY.x1 - 1.1, 0.55, 406]],
  ]);
  // The ice chute on from the crusher house over the wall: down on a trestle on the quay to over that boat's hold.
  const chuteFrom: Vec3 = [-35.5, 4.5, 403], chuteTo: Vec3 = [iceBoatX, 1.2, 409.6];
  rod(chuteFrom, [-31.2, 3.4, 406], 0.35, 0xb8c0c4, UP);
  rod([-31.2, 3.4, 406], chuteTo, 0.3, 0xb8c0c4, UP);
  rod(chuteTo, [iceBoatX, 0.4, 409.8], 0.24, 0x3a5f8a, UP);
  for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) box(-31.2 + dx - 0.1, 0, 406 + dz - 0.1, -31.2 + dx + 0.1, 3.2, 406 + dz + 0.1, STEEL);
  for (let y = 0.6; y < 3; y += 1.2) for (const [a, b] of [[[-0.8, -0.8], [0.8, 0.8]], [[0.8, -0.8], [-0.8, 0.8]]]) rod([-31.2 + a[0], y, 406 + a[1]], [-31.2 + b[0], y + 1.2, 406 + b[1]], 0.03, STEEL, { ghost: true });

  // Under the ramp's east wall: the co-op's container of storm gear, sandbags along the wall, fish boxes on pallets.
  containerModel(props, -36, 0, 402.4, true, 0x3f6f8a);
  signs.push({ kind: 'name', text: '漁會防颱物資', colors: ['#f2efe6', '#2a4a6a', '#f2efe6'], wide: 3, pos: [-36, 1.6, 403.65], rotY: 0 });
  for (let x = OUT_RAMP.x1 + 0.9; x < -39.2; x += 0.52) for (let layer = 0; layer < 3; layer++) object('sandbag', x + layer * 0.1, 400.5, Math.PI / 2, layer * 0.29);
  for (const [cx, cz] of [[-38.2, 412], [-38.2, 416]]) {
    object('pallet', cx, cz, Math.PI / 2);
    for (let k = 0; k < 12; k++) object('fishBox', cx + ((k % 4) >> 1) * 0.5 - 0.25, cz + (k % 2) * 0.74 - 0.37, Math.PI / 2, 0.14 + Math.floor(k / 4) * 0.3);
  }
  // West of the ramp's foot: ice in bags for the boats, delivered and left; their chests.
  for (const [cx, cz] of [[-51.4, 418], [-51.4, 422]]) {
    object('pallet', cx, cz, 0);
    for (let k = 0; k < 12; k++) object('iceBag', cx + (k % 2) * 0.72 - 0.36, cz + ((k % 4) >> 1) * 0.48 - 0.24, 0, 0.12 + Math.floor(k / 4) * 0.25);
  }
  for (const z of [425.2, 426.4, 427.6]) object('iceChest', -50.2, z, Math.PI / 2);

  // Where the way comes round on the quay: on the inside of the bend the boats' baskets in their banks; along the edge
  // ahead their gear under tarpaulins, nets, floats, drums of fuel; the gangway's head across the way, shut with barriers.
  const BASKETS = ['basketBlue', 'basketYellow', 'basketRed', 'basketGreen'] as const;
  let bank = 0;
  const baskets = (x: number, z: number, n: number) => {
    const kind = BASKETS[bank++ % 4];
    for (let j = 0; j < 2; j++) for (let k = 0; k < n - ((j + bank) % 2); k++) object(kind, x + (rand() - 0.5) * 0.04, z + (j - 0.5) * 0.46, (rand() - 0.5) * 0.06, k * 0.27);
  };
  for (const [x, z, n] of [[-37.6, 430.6, 6], [-35.2, 432.4, 5], [-33, 434.4, 6], [-38.4, 434.8, 4]] as const) baskets(x, z, n);
  for (const [x, z, a] of [[-49.6, 448.6, 0.1], [-45.4, 449.2, 1.5]] as const) object('tarpHeap', x, z, a);
  object('netHeap', -41.8, 449.6, 0.3);
  for (let k = 0; k < 12; k++) object('buoy', -40 + rand() * 3, 448.4 + rand() * 2.2, rand() * 3);
  for (const [x, z] of [[-35.6, 449.6], [-34.4, 449.6]]) object('tyreStack', x, z);
  for (const [x, z] of [[-32.2, 446.4], [-31.8, 447.4]]) object('waterDrum', x, z);
  // West of where the way comes round: a lorry with a crane on its back, in to take the boats' nets ashore, its boom
  // folded down over its load; its men out of the rain under a tarpaulin; floats in their nets heaped by it.
  const LORRY = { x: -55.5, z: 436 };
  box(LORRY.x - 1.2, 0.45, LORRY.z + 2.4, LORRY.x + 1.2, 2.9, LORRY.z + 4.3, 0x2f62a8);
  box(LORRY.x - 1.21, 1.9, LORRY.z + 4.3, LORRY.x + 1.21, 2.6, LORRY.z + 4.32, 0x2a3a4a, { ghost: true });
  box(LORRY.x - 1.25, 0.45, LORRY.z - 4.6, LORRY.x + 1.25, 1.25, LORRY.z + 2.3, 0x3a3f45);
  for (const side of [-1, 1]) box(LORRY.x + side * 1.225 - 0.025, 1.25, LORRY.z - 4.6, LORRY.x + side * 1.225 + 0.025, 1.8, LORRY.z + 0.6, 0xd8d6ce, { ghost: true });
  for (const z of [LORRY.z - 3.2, LORRY.z - 1.8, LORRY.z + 3.3]) for (const side of [-1, 1]) props.push({ shape: 'cylinder', size: [0.48, 0.2, 0], pos: [LORRY.x + side * 1.15, 0.48, z], rot: [0, 0, Math.PI / 2], color: 0x1e1f22, ghost: true });
  box(LORRY.x - 0.5, 1.25, LORRY.z + 1.2, LORRY.x + 0.5, 3.2, LORRY.z + 2.2, 0xe0b020);
  props.push({ shape: 'box', size: [0.3, 0.3, 3.6], pos: [LORRY.x, 3.35, LORRY.z - 1.6], rot: [0.03, 0, 0], color: 0xe0b020, ghost: true });
  box(LORRY.x - 0.25, 1.25, LORRY.z - 4.4, LORRY.x + 0.25, 3.1, LORRY.z - 4.0, 0x5f666c, { ghost: true });
  for (const [dz, c] of [[-2.6, 0x3f6a4a], [-0.6, 0x2f62a8]]) box(LORRY.x - 1.1, 1.25, LORRY.z + dz - 0.9, LORRY.x + 1.1, 2.05, LORRY.z + dz + 0.9, c, { ghost: true });
  for (const side of [-1, 1]) box(LORRY.x + side * 1.3, 0, LORRY.z + 0.6, LORRY.x + side * 2.1, 0.12, LORRY.z + 1.2, 0x5f666c);
  // Its poles going over outward; its sheet, in quarters edge to edge on their tops, only let down off them.
  for (const [x, z] of [[-60.6, 444.4], [-53.4, 444.4], [-60.6, 449.6], [-53.4, 449.6]] as const) object(z < 447 ? 'tarpPoleTall' : 'tarpPole', x, z, 0, 0, { lean: [Math.sign(x + 57) * 0.5, Math.sign(z - 447) * 0.4] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) object(sz < 0 ? 'tarpPanelFront' : 'tarpPanelBack', -57 + sx * 2, 447 + sz * 1.5, 0, 2.5 - sz * 1.5 * 0.087, { lean: [0, 0] });
  object('table', -57, 447);
  for (const [x, z, a] of [[-58.2, 447.2, 1.2], [-55.9, 446.5, -1.5]]) object('stool', x, z, a);
  object('gasCylinder', -59.6, 448.6);
  for (let k = 0; k < 22; k++) object('buoy', -51.2 + (rand() - 0.5) * 2.4, 444.4 + (rand() - 0.5) * 2.6, rand() * 3, 0);
  object('netHeap', -51.4, 444.6, 0.6);
  object('netHeap', -50.6, 446.8, 2.2);

  // The boats' men out on their decks: their scooters in a row by the gangway's head, a pickup left by the wall's foot.
  for (let k = 0; k < 6; k++) object(SCOOTERS[(k * 5 + 1) % 6], -40.2 + k * 0.85, 445.6, (rand() - 0.5) * 0.2);
  props.push({ shape: 'box', size: [0.9, 0.7, 2.2], pos: [-60.2, 0.9, 438.5], rot: [0, -0.35, 0], color: 0xc8372d, vehicle: 'pickup' });
  // The gangway's head: its hinge on the edge, a landing plate, the barriers across it and the notice, cones.
  props.push({ shape: 'cylinder', size: [0.22, 2.3, 0], pos: [QUAY.x1 - 0.1, 0.12, CROSS_A], rot: [Math.PI / 2, 0, 0], color: STEEL, ghost: true });
  box(QUAY.x1 - 2.6, 0, CROSS_A - 2.3, QUAY.x1, 0.03, CROSS_A + 2.3, 0x7d848b, { ghost: true });
  for (let x = QUAY.x1 - 2.4; x < QUAY.x1; x += 0.5) box(x, 0.03, CROSS_A - 2.2, x + 0.06, 0.04, CROSS_A + 2.2, YELLOW, { ghost: true });
  for (const dz of [-1.4, 1.4]) object('barrier', QUAY.x1 - 3.2, CROSS_A + dz, Math.PI / 2);
  for (const [x, z] of [[QUAY.x1 - 4.2, CROSS_A - 2.8], [QUAY.x1 - 4.4, CROSS_A + 2.9], [QUAY.x1 - 2.2, CROSS_A + 3.3]]) object('cone', x, z);
  for (const dx of [-0.9, 0.9]) rod([QUAY.x1 - 6 + dx, 0, CROSS_A + 4.6], [QUAY.x1 - 6 + dx, 1.7, CROSS_A + 4.6], 0.04, 0x8a8f96);
  signs.push({ kind: 'name', text: '颱風期間　浮動碼頭禁止進入', colors: ['#f2efe6', '#c8372d', '#c8372d'], wide: 2.4, pos: [QUAY.x1 - 6, 1.35, CROSS_A + 4.55], rotY: Math.PI });
  // The quay's floor: its slabs' joints, oil stains, standing water.
  const flat = (x0: number, z0: number, x1: number, z1: number, color: number, y = 0.012) => box(x0, y - 0.004, z0, x1, y, z1, color, { ghost: true });
  for (let x = -54; x < QUAY.x1; x += 6) if (x < OUT_RAMP.x0 - 0.5 || x > OUT_RAMP.x1 + 0.5) flat(x - 0.03, 412, x + 0.03, QUAY.z1 - 0.4, 0x7c807c);
  for (let z = 412; z < QUAY.z1; z += 6) flat(-54, z - 0.03, QUAY.x1 - 0.4, z + 0.03, 0x7c807c);
  for (const [x, z, r] of [[-46, 438, 1.6], [-38.5, 444, 2.2], [-52, 446, 1.4], [-34, 426, 1.1]] as const) props.push({ shape: 'cylinder', size: [r, 0.005, 0], pos: [x, 0.016, z], color: 0x5f6a6a, ghost: true });

  // The pontoon on its piles, and the gangway down onto it from the quay.
  const piles: Vec2[] = [[-2.5, -PONTOON.l - 0.9], [2.5, -PONTOON.l - 0.9], [-2.5, PONTOON.l + 0.9], [2.5, PONTOON.l + 0.9]];
  const pont = add({ kind: 'float', hull: 'vessel', pos: [PONTOON.x, PONTOON.y, PONTOON.z], yaw: 0, half: [PONTOON.w, 0, PONTOON.l], heave: 0.4, roll: 0.02, pitch: 0.015, period: 6, phase: 0, parts: pontoon(PONTOON.w, PONTOON.l, 0, piles) });
  for (const [x, z] of piles) {
    props.push({ shape: 'cylinder', size: [0.32, (PONTOON.y + 2.2 - BED) / 2, 0], pos: [PONTOON.x + x, (PONTOON.y + 2.2 + BED) / 2, PONTOON.z + z], color: 0x4a5056 });
    props.push({ shape: 'cylinder', size: [0.34, 0.05, 0], pos: [PONTOON.x + x, PONTOON.y + 2.2, PONTOON.z + z], color: YELLOW, ghost: true });
  }
  add({ kind: 'gangway', pos: [QUAY.x1, 0, CROSS_A], yaw: Math.PI / 2, half: [2.2, 0, 0], long: PONTOON.x - PONTOON.w + 1.9 - QUAY.x1, rests: pont, period: 1, phase: 0 });

  // The boats, and the plates across from deck to deck; their lines to each other, to the pontoon, to the pier.
  const boatIdx = BOATS.map((b, n) => {
    const gaps: [number, number][] = [[b.yaw === 0 ? -1 : 1, local(b, b.x, 0, b.west)[2]], [b.yaw === 0 ? 1 : -1, local(b, b.x, 0, b.east)[2]]];
    return add({ kind: 'float', hull: 'vessel', pos: [b.x, b.deck, b.z], yaw: b.yaw, half: [b.w, 0, b.l], heave: b.heave, roll: b.roll, pitch: 0.015, period: b.period, phase: b.phase,
      parts: fishingBoat({ w: b.w, l: b.l, color: b.color, kind: b.kind, gaps, gear: b.gear, hold: b.hold, flags: b.flags }),
      lines: n === 0
        ? [{ at: local(b, b.x - b.w + 0.3, b.deck + 0.7, b.z + 5.5), to: [PONTOON.w - 0.45, 0.1, 8.8], rig: undefined as number | undefined }, { at: local(b, b.x - b.w + 0.3, b.deck + 0.7, b.z - 8), to: [PONTOON.w - 0.45, 0.1, -8.8] }]
        : [] });
  });
  // Lines from the first to the pontoon's cleats (in the pontoon's frame), and between each and the next, fore and aft.
  const rigOf = (n: number) => rigs[n - base];
  rigOf(boatIdx[0]).lines!.forEach((line) => (line.rig = pont));
  for (let n = 0; n + 1 < BOATS.length; n++) {
    const a = BOATS[n], b = BOATS[n + 1], ax = a.x + a.w - 0.3, bx = b.x - b.w + 0.3;
    for (const z of [Math.min(a.z, b.z) + 6, Math.max(a.z, b.z) - 7.5]) rigOf(boatIdx[n]).lines!.push({ at: local(a, ax, a.deck + 0.7, z), to: local(b, bx, b.deck + 0.7, z + 1.2), rig: boatIdx[n + 1], color: n % 2 ? 0x2f6fb0 : 0xe8e4d8 });
  }
  const last = BOATS.at(-1)!;
  for (const z of [last.z - 7.5, last.z + 6.5]) rigOf(boatIdx.at(-1)!).lines!.push({ at: local(last, last.x + last.w - 0.3, last.deck + 0.7, z), to: [PIER.x0 + 1.1, 0.55, z + (z > last.z ? 3 : -3)] });
  const plate = (x: number, z: number, on: number, rests: number) => add({ kind: 'plate', pos: [x, 0, z], yaw: Math.PI / 2, half: [2.1, 0, 0], ends: [-0.45, 0.45], on, rests, period: 1, phase: 0 });
  plate(PONTOON.x + PONTOON.w + 0.45, CROSS_A, pont, boatIdx[0]);
  for (let n = 0; n + 1 < BOATS.length; n++) plate((BOATS[n].x + BOATS[n].w + BOATS[n + 1].x - BOATS[n + 1].w) / 2, BOATS[n].east, boatIdx[n], boatIdx[n + 1]);
  add({ kind: 'gangway', pos: [PIER.x0, 0, CROSS_B], yaw: -Math.PI / 2, half: [2.2, 0, 0], long: PIER.x0 - last.x, rests: boatIdx.at(-1)!, period: 1, phase: 0 });

  // What is on the boats' decks, carried by them: a net heaped where it was being mended across where the way goes over
  // the first; baskets, floats, fish boxes; a tarpaulin over gear on the second, fish boxes stacked in its way; on the squid
  // boat its catch, frozen and boxed for the reefer ship, on one side of the way across it and its ice chests and baskets
  // on the other; on the last, its line baskets, floats, a coil of rope.
  const onBoat = (n: number, kind: ObjectKindId, x: number, z: number, rotY = 0, up = 0) => object(kind, x, z, rotY, BOATS[n].deck + up, { deck: boatIdx[n] });
  onBoat(0, 'netHeap', 7.15, CROSS_A + 0.4, 0.4);
  for (let k = 0; k < 5; k++) onBoat(0, 'basketBlue', 11.55, 435.6, 0.1, k * 0.27);
  for (let k = 0; k < 4; k++) onBoat(0, 'basketYellow', 11.55, 435.1, -0.1, k * 0.27);
  for (const [x, z] of [[4.81, 443.4], [5.46, 443.9], [4.55, 444.4], [12.85, 443.2]]) onBoat(0, 'buoy', x, z, rand() * 3);
  for (let k = 0; k < 6; k++) onBoat(0, 'fishBox', 12.33 + (k % 2) * 0.76, 434.0, 0, Math.floor(k / 2) * 0.3);
  onBoat(1, 'tarpHeap', 17.13, 439.4, 0.2);
  for (let k = 0; k < 6; k++) onBoat(1, 'fishBox', 21.56 + (k % 2) * 0.76, 439.4, 0.3, Math.floor(k / 2) * 0.3);
  onBoat(1, 'waterDrum', 24.62, 443.6);
  onBoat(1, 'buoy', 17.59, 443.4, 1);
  for (let k = 0; k < 4; k++) onBoat(2, 'basketRed', 29.45, 444.0, 0, k * 0.27);
  for (let k = 0; k < 3; k++) onBoat(2, 'basketGreen', 29.45, 444.5, 0.1, k * 0.27);
  onBoat(2, 'iceChest', 31.2, 445.0, 0.5);
  onBoat(2, 'iceChest', 32.7, 445.7, 0.5);
  for (const [cx, cz] of [[35.95, 440.4], [34.45, 439.8]]) {
    onBoat(2, 'pallet', cx, cz, 0.5);
    for (let k = 0; k < 8; k++) onBoat(2, 'frozenCarton', cx + ((k % 2) - 0.5) * 0.62 * Math.cos(0.5), cz - ((k % 2) - 0.5) * 0.62 * Math.sin(0.5) + (((k % 4) >> 1) - 0.5) * 0.42, 0.5, 0.14 + Math.floor(k / 4) * 0.25);
  }
  onBoat(2, 'netHeap', 35.7, 437.6, 2.1);
  onBoat(3, 'ropeCoil', 42.87, 450.6);
  for (const [x, z, a] of [[49.05, 446.3, 0.2], [49.93, 445.8, 0.2]] as const) onBoat(3, 'iceChest', x, z, a);
  for (let k = 0; k < 5; k++) onBoat(3, 'basketBlue', 42.62, 440.2, 0, k * 0.27);
  for (let k = 0; k < 4; k++) onBoat(3, 'basketYellow', 42.62, 439.7, 0.1, k * 0.27);
  for (const [x, z] of [[47.79, 446.8], [47.03, 447.2], [48.42, 447.4]]) onBoat(3, 'buoy', x, z, rand() * 3);

  // The pier: its edges coped and kerbed but where the gangway comes up and the ramp comes down, bollards, tyres hung
  // over; the harbour office at its root; along its east side the reefer containers waiting, plugged in; along its west
  // the cartons of frozen fish on their pallets to go aboard, the forklift that brings them; cables across the way.
  edgeKerb(PIER.x0, PIER.z0, PIER.x0 + 0.35, CROSS_B - 3);
  edgeKerb(PIER.x0, CROSS_B + 3, PIER.x0 + 0.35, PIER.z1);
  edgeKerb(PIER.x1 - 0.35, PIER.z0, PIER.x1, PIER.z1);
  edgeKerb(PIER.x0, PIER.z1 - 0.35, SHIP.x - 3.6, PIER.z1);
  edgeKerb(SHIP.x + 3.6, PIER.z1 - 0.35, PIER.x1, PIER.z1);
  for (let z = 404; z < PIER.z1 - 2; z += 10) {
    if (Math.abs(z - CROSS_B) > 4) bollard(PIER.x0 + 1.1, z);
    bollard(PIER.x1 - 1.1, z);
  }
  for (const x of [PIER.x0 + 1.4, PIER.x1 - 1.4]) bollard(x, PIER.z1 - 1.2);
  for (const x of [PIER.x0 - 0.15, PIER.x1 + 0.15]) for (let z = 403; z < PIER.z1; z += 3.6) props.push({ shape: 'cylinder', size: [0.4, 0.13, 0], pos: [x, -0.55, z], rot: [0, 0, Math.PI / 2], color: 0x1e1f22, ghost: true });
  for (let x = PIER.x0 + 2; x < PIER.x1; x += 3.6) props.push({ shape: 'cylinder', size: [0.4, 0.13, 0], pos: [x, -0.55, PIER.z1 + 0.15], rot: [Math.PI / 2, 0, 0], color: 0x1e1f22, ghost: true });
  // The harbour office at the pier's root, its light mast.
  box(PIER.x0 + 1.5, 0, 401, PIER.x0 + 7.5, 3.2, 406, 0xe6e1d4);
  box(PIER.x0 + 1.2, 3.2, 400.7, PIER.x0 + 7.8, 3.45, 406.3, 0x5a6a72);
  for (const x of [PIER.x0 + 2.3, PIER.x0 + 4.6]) box(x, 1.2, 406, x + 1.6, 2.4, 406.06, 0x50606a, { ghost: true });
  box(PIER.x0 + 6.2, 0, 406, PIER.x0 + 7.1, 2.2, 406.06, 0x8a949a, { ghost: true });
  signs.push({ kind: 'name', text: '外港管理站', colors: ['#2a4a6a', '#f2efe6', '#f2efe6'], wide: 3.2, pos: [PIER.x0 + 4.5, 2.8, 406.1], rotY: 0 });
  rod([PIER.x0 + 10, 0, 403], [PIER.x0 + 10, 16, 403], 0.22, 0xb8c0c4);
  box(PIER.x0 + 8.8, 15.6, 402.4, PIER.x0 + 11.2, 16.6, 403.6, 0x5a6066, { ghost: true });
  // The reefers along the east side, two high in places, each its machinery at its end, plugged into the power posts.
  for (let k = 0; k < 9; k++) {
    const z = 409 + k * 6.4, two = k % 3 === 1;
    containerModel(props, PIER.x1 - 2.6, 0, z, false, 0xe8e8e0);
    box(PIER.x1 - 3.6, 0.3, z - 3.12, PIER.x1 - 1.6, 2.3, z - 3.02, 0x7a8288, { ghost: true });
    if (two) containerModel(props, PIER.x1 - 2.6, 2.6, z, false, 0xe8e8e0);
    rod([PIER.x1 - 3.0, 0.4, z - 3.1], [PIER.x1 - 0.8, 0.05, z - 3.4], 0.04, DARK, { ghost: true });
  }
  for (let z = 405.5; z < PIER.z1 - 4; z += 12.8) box(PIER.x1 - 1.0, 0, z - 0.3, PIER.x1 - 0.4, 1.3, z + 0.3, 0x3f6f8a);
  signs.push({ kind: 'name', text: '順發冷鏈　冷凍櫃', colors: ['#1f4f9a', '#f2efe6', '#f2efe6'], wide: 4.4, pos: [PIER.x1 - 3.85, 2.1, 431], rotY: -Math.PI / 2 });
  // The cartons on their pallets along the west side, waiting; the forklift by them; a pallet of them come off its forks.
  for (const z of [453.2, 456.6, 460]) {
    object('pallet', PIER.x0 + 2.2, z, 0);
    for (let k = 0; k < 18; k++) {
      const layer = Math.floor(k / 6), i = k % 6;
      object('frozenCarton', PIER.x0 + 2.2 + (i % 2) * 0.62 - 0.31, z + Math.floor(i / 2) * 0.42 - 0.42, 0, 0.14 + layer * 0.25);
    }
  }
  object('forklift', PIER.x0 + 2.6, 467.2, Math.PI / 2 + 0.2);
  for (const [x, z, a] of [[PIER.x0 + 4.4, 463.8, 0.6], [PIER.x0 + 3.4, 463.4, 1.9], [PIER.x0 + 3.9, 464.8, 2.8]] as const) object('frozenCarton', x, z, a);
  // Cables from the power posts across the way to the office, under their ramps; the way to the ship painted.
  for (const z of [436, 461.4]) {
    box(PIER.x0 + 4.2, 0, z - 0.25, PIER.x1 - 3.9, 0.07, z + 0.25, 0xe07020, { wheelsOnly: true });
    for (let x = PIER.x0 + 4.6; x < PIER.x1 - 3.9; x += 1) box(x, 0.07, z - 0.26, x + 0.5, 0.08, z + 0.26, DARK, { ghost: true });
  }
  for (const x of [SHIP.x - 3.2, SHIP.x + 3.2]) box(x - 0.06, 0.004, 446, x + 0.06, 0.012, PIER.z1 - 0.4, YELLOW, { ghost: true });
  for (let z = 448; z < PIER.z1 - 1; z += 3) box(SHIP.x - 0.6, 0.004, z, SHIP.x + 0.6, 0.012, z + 1.2, 0xe8e2d0, { ghost: true });
  signs.push({ kind: 'name', text: '冷凍運搬船　裝貨中　閒人勿近', colors: ['#f2efe6', '#c8372d', '#c8372d'], wide: 3.2, pos: [SHIP.x + 4.6, 1.4, 466.5], rotY: Math.PI });
  for (const dx of [-1.3, 1.3]) rod([SHIP.x + 4.6 + dx, 0, 466.55], [SHIP.x + 4.6 + dx, 1.8, 466.55], 0.04, 0x8a8f96);
  for (let k = 0; k < 3; k++) object('cone', SHIP.x + 4.2 + k * 0.9, 468.2);
  for (const [cx, cz] of [[PIER.x0 + 3, 420], [PIER.x0 + 3, 424.6]]) {
    object('pallet', cx, cz, 0);
    for (let k = 0; k < 12; k++) object('fishBox', cx + (k % 2) * 0.74 - 0.37, cz + ((k % 4) >> 1) * 0.5 - 0.25, 0, 0.14 + Math.floor(k / 4) * 0.3);
  }
  // Boats along the pier's east face, clear of the ship.
  for (const [z, color, ph] of [[414, 0xb3463a, 0.15], [436, 0x3f9a94, 0.7]] as const) {
    const w = 3.3, l = 9.5, x = PIER.x1 + 1.2 + w;
    moored(x, z, 0, w, l, color, 'longline', SURF + 1.2, ph, [[[-w + 0.2, 0.7, 6], [PIER.x1 - 1.1, 0.55, z + 8]], [[-w + 0.2, 0.7, -7], [PIER.x1 - 1.1, 0.55, z - 8]]]);
  }

  // The ship (her ramp turned to face the pier, so its sides are the other way about from hers): off the pier's head, stern to it, her ramp down onto it; held by her stern lines to the pier's bollards and
  // her bow lines out to the buoys; her own things on her decks, carried by her.
  const shipIdx = add({ kind: 'float', hull: 'vessel', pos: [SHIP.x, SHIP.y, SHIP.z], yaw: 0, half: [SHIP.w, 0, SHIP.l], heave: 0.3, roll: 0.14, lurch: 0.45, pitch: 0.003, period: 8, phase: 0, hatch: SHIP.hatch,
    parts: reeferShip({ w: SHIP.w, l: SHIP.l, hatch: SHIP.hatch, hatches: HATCHES, open: [[-12.4, -8.6], [4.2, 7.8]], fore: SHIP.fore,
      bins: [-26.1, -24.0], vents: [-25, -16, 0, 17], lamps: [-14.5, 2, 18.5], hoses: [-7, 9.4], buoys: [-27, -1, 15], loose: [-20, -4, 12] }),
    loose: [[-1, -20, 0.15], [-1, -4, 0.9], [-1, 12, 0.5]],
    lines: [
      { at: [-12, 1.1, -SHIP.l + 1.2], to: [PIER.x0 + 1.4, 0.6, PIER.z1 - 1.2] },
      { at: [12, 1.1, -SHIP.l + 1.2], to: [PIER.x1 - 1.4, 0.6, PIER.z1 - 1.2] },
      { at: [-9, 3.4, SHIP.l - 8], to: [SHIP.x - 26, SURF + 0.8, SHIP.z + 58] },
      { at: [9, 3.4, SHIP.l - 8], to: [SHIP.x + 26, SURF + 0.8, SHIP.z + 58] },
      { at: [-13.6, 1.1, 2], to: [SHIP.x - 30, SURF + 0.8, SHIP.z + 4] },
      { at: [13.6, 1.1, 2], to: [SHIP.x + 30, SURF + 0.8, SHIP.z + 4] },
    ] });
  const ramp = add({ kind: 'gangway', pos: [SHIP.x, SHIP.y, SHIP.z - SHIP.l - 0.05], yaw: Math.PI, half: [3.0, 0, 0], long: 10, on: shipIdx, foot: 0, period: 1, phase: 0 });
  rigOf(shipIdx).lines!.push({ at: [-3.9, 6.5, -SHIP.l + 0.6], to: [2.7, 0.15, 8.5], rig: ramp, color: DARK }, { at: [3.9, 6.5, -SHIP.l + 0.6], to: [-2.7, 0.15, 8.5], rig: ramp, color: DARK });
  for (const [x, z] of [[SHIP.x - 26, SHIP.z + 58], [SHIP.x + 26, SHIP.z + 58], [SHIP.x - 30, SHIP.z + 4], [SHIP.x + 30, SHIP.z + 4]]) {
    props.push({ shape: 'cylinder', size: [1.0, 0.7, 0], pos: [x, SURF + 0.3, z], color: 0xe8622a });
    props.push({ shape: 'cylinder', size: [0.3, 0.2, 0], pos: [x, SURF + 1.15, z], color: DARK, ghost: true });
  }
  // On the ship: by the mooring winch aft, her ropes coiled down ready; forward, the cartons that came aboard before ours,
  // on their pallets in the square and by it, waiting for the crane.
  const onShip = (kind: ObjectKindId, lx: number, lz: number, rotY = 0, up = 0) => object(kind, SHIP.x + lx, SHIP.z + lz, rotY, SHIP.y + up, { deck: shipIdx });
  for (const [lx, lz] of [[-11.4, -46.2], [-12.2, -43.4], [-6.6, -45.4]]) onShip('ropeCoil', lx, lz);
  // Not lashed, on her near side: the Yokohama fenders she lies against the fishing boats with when she takes their catch
  // at sea, on their sides along her length, rolling across with her roll; reels of cable; floats off the boats.
  const loose = (kind: ObjectKindId, lx: number, lz: number, rotY = 0) => object(kind, SHIP.x + lx, SHIP.z + lz, rotY, SHIP.y, { deck: shipIdx, free: true, rolls: kind !== 'buoy' });
  loose('yokohamaFender', -8.5, -16.3);
  loose('yokohamaFender', -9.0, 1.4);
  loose('cableReel', -11.0, -25.0, Math.PI / 2);
  loose('cableReel', -6.0, 15.6, Math.PI / 2);
  for (const [lx, lz] of [[-6, -10], [-10.5, -7.5], [-7, -1.4], [-12, 8.8], [-5, 8.4], [-9, 17.6], [-4.4, -13.2]]) loose('buoy', lx, lz, rand() * 3);
  for (const [lx, lz] of [[-8.8, 26.4], [1.2, 22.2], [3.4, 29.6]]) {
    onShip('pallet', lx, lz);
    for (let k = 0; k < 12; k++) onShip('frozenCarton', lx + (k % 2) * 0.62 - 0.31, lz + ((k % 6) >> 1) * 0.42 - 0.42, 0, 0.14 + Math.floor(k / 6) * 0.25);
  }

  // Out beyond: the breakwater the harbour lies behind, tetrapods heaped on its seaward side, its lighthouse at the mouth;
  // the other arm's, green, across the mouth from it.
  box(-500, BED, 612, 42, 2.2, 620, 0xa4a49c);
  box(-500, 2.2, 611.6, 42, 3.4, 612.2, 0xb8b8b0);
  for (let x = -120; x < 40; x += 2.6) {
    const r = rand() * 3;
    props.push({ shape: 'box', size: [1.3, 1.3, 1.3], pos: [x + rand(), 1.0 + rand() * 0.8, 622 + rand() * 3], rot: [r, r * 1.7, r * 0.6], color: 0x9a9c98, ghost: true });
    props.push({ shape: 'box', size: [0.5, 1.9, 0.5], pos: [x + rand(), 1.3, 623 + rand() * 2], rot: [r * 0.8, r, r * 1.3], color: 0x8e908c, ghost: true });
  }
  props.push({ shape: 'cylinder', size: [2.2, 7, 0], pos: [38, 9.2, 616], color: 0xd23c2c });
  props.push({ shape: 'cylinder', size: [1.6, 1.2, 0], pos: [38, 17.4, 616], color: 0xf2f0ea });
  props.push({ shape: 'cylinder', size: [2.6, 0.2, 0], pos: [38, 16.2, 616], color: DARK, ghost: true });
  box(78, BED, 598, 500, 2.2, 606, 0xa4a49c);
  props.push({ shape: 'cylinder', size: [2.0, 6, 0], pos: [80, 8.2, 602], color: 0x2e9a5a });
  props.push({ shape: 'cylinder', size: [1.5, 1.1, 0], pos: [80, 15.3, 602], color: 0xf2f0ea });
  void CONCRETE;

  // The lorry's men, in their oilskins, out of the rain under the tarpaulin.
  const crowds: CrowdDesc[] = [{ area: [-59.6, 445.2, -54.4, 448.8], count: 3, y: 0, clothes: [0xe8c020, 0xe0a020, 0xf2f0ea], hat: 0xe8c020 }];
  // And the ones who will not be told: anglers along the quay's edge below the ramp, out in it because the fish bite before
  // a storm, each at a rod in its holder, a cool box and a stool behind, the scooters they came on; past the notice
  // that says no fishing while the typhoon lasts.
  ([[-31.1, 411.4, 0xe8c020], [-31.1, 414.8, 0x2f62a8], [-31.1, 423.6, 0xd23c2c]] as [number, number, number][]).forEach(([x, z, coat], k) => {
    crowds.push({ area: [x - 0.05, z - 0.05, x + 0.05, z + 0.05], count: 1, y: 0, dance: Math.PI / 2, motion: 'carry', clothes: [coat], hat: coat });
    object('fishingRod', x + 0.45, z + 0.35, Math.PI / 2 + (k - 1) * 0.15);
    object('iceChest', x - 1.4, z + 0.3, 0.1 * k);
    object(k === 1 ? 'bucket' : 'stool', x - 0.9, z - 0.6);
  });
  object('fishingRod', -30.65, 420.6, Math.PI / 2 + 0.25);
  object('scooterRed', -33.6, 419.8, 0.2);
  object('scooterBlue', -33.6, 421, 0.1);
  box(-34.05, 0, 408.4, -33.95, 2.2, 408.5, STEEL);
  signs.push({ kind: 'name', text: '颱風期間　禁止垂釣', colors: ['#f2efe6', '#c8262a', '#c8262a'], wide: 2.4, pos: [-34.08, 1.75, 408.45], rotY: -Math.PI / 2 });
  return { props, objects, signs, rigs, pools, stillWater, crowds };
}
