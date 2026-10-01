import type { Vec3 } from '../config';
import { mulberry32, standardLoad } from './sandbox';
import type { DecalDesc, LevelDef, PropDesc, TrafficLane } from './types';

// Level 1: a city split by a river. Avenues run north-south (along Z), streets east-west
// (along X). Traffic drives on the right: heading +Z, the right-hand side is -X.
//
// South of the river is downtown: tall blocks, two busy streets, roadworks. The river can
// only be crossed by a long gentle bridge to the west or a short humpback bridge to the
// east. North of it is the old town: a school zone, a roundabout, a market squeezed into
// one avenue, another busy street, and a building site that works as a rough shortcut.

const AVENUES = [-148, -74, 0, 74, 148, 222];
const STREETS = [6, 80, 154, 302, 376, 450, 524];
const BUSY_STREETS = [80, 154, 450];
/** Half the width of a road: two 3.5 m lanes each way. */
const ROAD = 7;
const LANE = 3.5;
const BLOCK = 60;

const RIVER: [number, number] = [209, 247];
const RIVER_MID = (RIVER[0] + RIVER[1]) / 2;
const GENTLE_BRIDGE = AVENUES[1];
const HUMPBACK_BRIDGE = AVENUES[4];

/** Start and end of each block across the map, west to east. */
const COLUMNS: [number, number][] = [
  [AVENUES[0] - ROAD - BLOCK, AVENUES[0] - ROAD],
  ...AVENUES.map((x): [number, number] => [x + ROAD, x + ROAD + BLOCK]),
];
/** And south to north. The two rows on the river are shallower. */
const ROWS: [number, number][] = [
  [-61, -1], [13, 73], [87, 147], [161, RIVER[0]],
  [RIVER[1], 295], [309, 369], [383, 443], [457, 517], [531, 591],
];
const FIRST_NORTH_ROW = 4;
const MIN_X = COLUMNS[0][0];
const MAX_X = COLUMNS[COLUMNS.length - 1][1];
const MIN_Z = ROWS[0][0];
const MAX_Z = ROWS[ROWS.length - 1][1];

const START: Vec3 = [-LANE * 1.5, 0.9, 30];
const FINISH: [number, number] = [AVENUES[5] - LANE * 1.5, 560];

// Blocks that aren't buildings, as [column, row].
const PARKS: [number, number][] = [[2, 2], [4, 5], [0, 6]];
const BUILDING_SITE: [number, number] = [5, 7];
const ROUNDABOUT: [number, number] = [AVENUES[4], STREETS[4]];
const MARKET_AVENUE = AVENUES[4];
const MARKET_ROW = ROWS[6];

const KERB = 0.15;
const PAVEMENT = 0x9aa0a8;
const DOWNTOWN = [0xa8b5c2, 0x8f9aa6, 0x7f8c9a, 0xb9c2ca, 0x9aa7b5, 0xc5c9cc];
const OLD_TOWN = [0xc9a27e, 0xd4c4a8, 0xbf8f6f, 0xd9b99a, 0xb7a58c, 0xc7b29a];
const FOLIAGE = [0x4f8a4a, 0x5d9a52, 0x447d44];
const TRUNK = 0x6b4a2e;
const WHITE = 0xe8e8e8;
const YELLOW = 0xe0b020;
const CONCRETE = 0x70757c;

// Minimap colours.
const MAP_BLOCK = 0x8b9199;
const MAP_BUILDING = 0x5f6670;
const MAP_WATER = 0x3f7fc0;
const MAP_PARK = 0x5e9a58;
const MAP_DIRT = 0x9a7a52;
const MAP_ROAD = 0x4a5059;

// Reseeded each time the level is built, so every build is identical.
let rand = mulberry32(21);
const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)];
const isAt = (list: [number, number][], c: number, r: number) => list.some(([lc, lr]) => lc === c && lr === r);

function tree(props: PropDesc[], x: number, z: number, base: number): void {
  const height = 1.1 + rand() * 0.5;
  props.push({ shape: 'cylinder', size: [0.18, height, 0], pos: [x, base + height, z], color: TRUNK });
  const crown = 1.0 + rand() * 0.5;
  props.push({ shape: 'cone', size: [crown, crown * 1.2, 0], pos: [x, base + height * 2 + crown * 0.9, z], color: pick(FOLIAGE), ghost: true });
}

/** Fill a block with buildings in one of a few arrangements. Taller and greyer downtown. */
function buildings(props: PropDesc[], x0: number, x1: number, z0: number, z1: number, north: boolean): void {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const deep = (z1 - z0) / BLOCK;
  const palette = north ? OLD_TOWN : DOWNTOWN;
  const tall = () => (north ? 6 + rand() * 10 : 12 + rand() * rand() * 44);

  const add = (ox: number, oz: number, halfX: number, halfZ: number, height: number) => {
    const color = pick(palette);
    props.push({
      shape: 'box', size: [halfX, height / 2, halfZ * deep], pos: [cx + ox, KERB + height / 2, cz + oz * deep],
      color, fade: true, mapColor: MAP_BUILDING,
    });
    // Something on the roof, so the skyline isn't all flat tops.
    if (height > 14) {
      const cap = 1 + rand() * 2;
      props.push({
        shape: 'box', size: [halfX * 0.5, cap / 2, halfZ * deep * 0.5], pos: [cx + ox, KERB + height + cap / 2, cz + oz * deep],
        color: 0x6a7078, ghost: true, fade: true,
      });
    }
  };

  const layout = rand();
  if (layout < 0.45) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(sx * 14, sz * 14, 10 + rand() * 2.5, 10 + rand() * 2.5, tall());
  } else if (layout < 0.7) {
    // One tower with open space around it.
    add(0, 0, 15 + rand() * 4, 15 + rand() * 4, north ? 14 + rand() * 8 : 34 + rand() * 30);
  } else {
    for (const sz of [-1, 1]) add(0, sz * 15, 23 + rand() * 2, 9 + rand() * 2, tall());
  }
}

function park(props: PropDesc[], decals: DecalDesc[], x0: number, x1: number, z0: number, z1: number): void {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  decals.push({ pos: [cx, cz], size: [x1 - x0 - 5, z1 - z0 - 5], color: 0x6fa862, y: KERB + 0.02, mapColor: MAP_PARK });
  decals.push({ pos: [cx + 8, cz - 6], size: [18, 12], color: 0x5a9bd4, y: KERB + 0.04, mapColor: MAP_WATER });
  for (let i = 0; i < 22; i++) {
    const x = x0 + 5 + rand() * (x1 - x0 - 10);
    const z = z0 + 5 + rand() * (z1 - z0 - 10);
    // Keep the pond clear.
    if (Math.abs(x - cx - 8) < 11 && Math.abs(z - cz + 6) < 8) continue;
    tree(props, x, z, KERB);
  }
}

/** A fenced lot of rough ground, open at two opposite corners so it can be cut across. */
function buildingSite(props: PropDesc[], decals: DecalDesc[], x0: number, x1: number, z0: number, z1: number): void {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  decals.push({ pos: [cx, cz], size: [x1 - x0, z1 - z0], color: 0x8a6f4c, mapColor: MAP_DIRT });

  const gate = 18;
  const fence = (ax: number, az: number, bx: number, bz: number) => {
    props.push({
      shape: 'box', size: [Math.abs(bx - ax) / 2 + 0.15, 0.6, Math.abs(bz - az) / 2 + 0.15],
      pos: [(ax + bx) / 2, 0.6, (az + bz) / 2], color: 0xd08a2e, mapColor: MAP_BUILDING,
    });
  };
  fence(x0 + gate, z0, x1, z0);
  fence(x0, z0 + gate, x0, z1);
  fence(x0, z1, x1 - gate, z1);
  fence(x1, z0, x1, z1 - gate);

  // Broken slabs strewn along the diagonal.
  for (let i = 0; i < 46; i++) {
    const t = rand();
    props.push({
      shape: 'box', size: [0.5 + rand() * 0.6, 0.14, 0.5 + rand() * 0.6],
      pos: [x0 + 6 + t * (x1 - x0 - 12) + (rand() - 0.5) * 18, 0.03, z0 + 6 + t * (z1 - z0 - 12) + (rand() - 0.5) * 18],
      rot: [(rand() - 0.5) * 0.32, rand() * Math.PI, (rand() - 0.5) * 0.32], color: 0x77705f,
    });
  }
  // Two half-buried pipes to climb over, and loose ones to knock about.
  for (const t of [0.35, 0.65]) {
    props.push({
      shape: 'cylinder', size: [0.45, 9, 0], pos: [x0 + t * (x1 - x0), -0.2, z0 + t * (z1 - z0)],
      rot: [0, Math.PI / 4, Math.PI / 2], color: 0x8e9499,
    });
  }
  for (let i = 0; i < 5; i++) {
    props.push({ shape: 'cylinder', size: [0.4, 0.55, 0], pos: [cx - 14 + i * 1.1, 0.55, cz + 12], color: 0x3b7dd8, mass: 15 });
  }
  // Spoil heaps in the corners off the route.
  props.push({ shape: 'cone', size: [6, 2.2, 0], pos: [x1 - 10, 2.2, z0 + 10], color: 0x7d6444 });
  props.push({ shape: 'cone', size: [5, 1.8, 0], pos: [x0 + 10, 1.8, z1 - 10], color: 0x7d6444 });
}

/** A bridge along Z carrying an avenue over the river: ramp up, level deck, ramp down. */
function bridge(props: PropDesc[], x: number, deck: number, ramp: number, height: number): void {
  const angle = Math.atan2(height, ramp);
  const slope = Math.hypot(ramp, height) / 2;
  const thick = 0.25;
  const color = 0x8d949c;
  const rampY = height / 2 - thick * Math.cos(angle);
  const rampZ = deck / 2 + ramp / 2;

  props.push({ shape: 'box', size: [ROAD, thick, slope], pos: [x, rampY, RIVER_MID - rampZ], rot: [-angle, 0, 0], color, mapColor: MAP_ROAD });
  props.push({ shape: 'box', size: [ROAD, thick, deck / 2], pos: [x, height - thick, RIVER_MID], color, mapColor: MAP_ROAD });
  props.push({ shape: 'box', size: [ROAD, thick, slope], pos: [x, rampY, RIVER_MID + rampZ], rot: [angle, 0, 0], color, mapColor: MAP_ROAD });

  // Parapets, solid down to the ground so nothing can get underneath from the side.
  const wall = (height + 1.1) / 2;
  for (const side of [-1, 1]) {
    props.push({ shape: 'box', size: [0.3, wall, deck / 2 + ramp], pos: [x + side * (ROAD + 0.3), wall, RIVER_MID], color: CONCRETE });
  }
}

function buildWorld(): { props: PropDesc[]; decals: DecalDesc[] } {
  rand = mulberry32(21);
  const props: PropDesc[] = [];
  const decals: DecalDesc[] = [];

  // The river, drawn first so everything else sits over it.
  decals.push({
    pos: [(MIN_X + MAX_X) / 2, RIVER_MID], size: [MAX_X - MIN_X, RIVER[1] - RIVER[0]], color: 0x3f7fc0, mapColor: MAP_WATER,
  });

  COLUMNS.forEach(([x0, x1], c) => {
    ROWS.forEach(([z0, z1], r) => {
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (c === BUILDING_SITE[0] && r === BUILDING_SITE[1]) {
        buildingSite(props, decals, x0, x1, z0, z1);
        return;
      }
      // A raised pavement over the whole block, low enough to mount with a jolt.
      props.push({
        shape: 'box', size: [(x1 - x0) / 2, KERB / 2, (z1 - z0) / 2], pos: [cx, KERB / 2, cz],
        color: PAVEMENT, mapColor: MAP_BLOCK, mapUnder: true,
      });
      if (isAt(PARKS, c, r)) park(props, decals, x0, x1, z0, z1);
      else buildings(props, x0, x1, z0, z1, r >= FIRST_NORTH_ROW);

      // Street trees along the kerb.
      const inset = 1.6;
      for (const t of [0.2, 0.5, 0.8]) {
        tree(props, x0 + t * (x1 - x0), z0 + inset, KERB);
        tree(props, x0 + t * (x1 - x0), z1 - inset, KERB);
        tree(props, x0 + inset, z0 + t * (z1 - z0), KERB);
        tree(props, x1 - inset, z0 + t * (z1 - z0), KERB);
      }
    });
  });

  // Walls around the edge of the map.
  const midX = (MIN_X + MAX_X) / 2;
  const midZ = (MIN_Z + MAX_Z) / 2;
  const spanX = (MAX_X - MIN_X) / 2 + 2;
  const spanZ = (MAX_Z - MIN_Z) / 2 + 2;
  props.push({ shape: 'box', size: [spanX, 1, 1], pos: [midX, 1, MIN_Z - 1], color: CONCRETE });
  props.push({ shape: 'box', size: [spanX, 1, 1], pos: [midX, 1, MAX_Z + 1], color: CONCRETE });
  props.push({ shape: 'box', size: [1, 1, spanZ], pos: [MIN_X - 1, 1, midZ], color: CONCRETE });
  props.push({ shape: 'box', size: [1, 1, spanZ], pos: [MAX_X + 1, 1, midZ], color: CONCRETE });

  // Railings along both banks, broken only where the two bridges cross.
  const gaps = [GENTLE_BRIDGE, HUMPBACK_BRIDGE];
  let from = MIN_X;
  for (const to of [...gaps.map((x) => x - ROAD - 0.6), MAX_X]) {
    for (const z of [RIVER[0] + 0.3, RIVER[1] - 0.3]) {
      props.push({ shape: 'box', size: [(to - from) / 2, 0.55, 0.3], pos: [(from + to) / 2, 0.55, z], color: CONCRETE });
    }
    from = to + (ROAD + 0.6) * 2;
  }
  // The gentle bridge is long and low; the humpback is short, steep and nearer the delivery bay.
  bridge(props, GENTLE_BRIDGE, 20, 28, 1.6);
  bridge(props, HUMPBACK_BRIDGE, 14, 12, 2.2);

  // Roadworks on the first avenue: the right-hand lanes are closed off, forcing a swerve.
  for (let i = 0; i < 6; i++) {
    props.push({ shape: 'cone', size: [0.3, 0.45, 0], pos: [-ROAD + 0.8 + i * 1.1, 0.45, 104 + i * 2.2], color: 0xff6a1a, mass: 3 });
  }
  props.push({ shape: 'box', size: [1.6, 0.5, 0.25], pos: [-5.2, 0.5, 120], color: 0xf2c230, mass: 40 });
  props.push({ shape: 'box', size: [1.6, 0.5, 0.25], pos: [-2.0, 0.5, 122], color: 0xf2c230, mass: 40 });
  for (let i = 0; i < 4; i++) {
    props.push({ shape: 'cylinder', size: [0.4, 0.55, 0], pos: [-5.6 + i * 1.3, 0.55, 126], color: 0x3b7dd8, mass: 15 });
  }

  // School zone after the humpback bridge: three speed bumps, each with a painted warning.
  for (const z of [322, 336, 350]) {
    props.push({ shape: 'cylinder', size: [0.5, ROAD, 0], pos: [HUMPBACK_BRIDGE, -0.3, z], rot: [0, 0, Math.PI / 2], color: YELLOW });
    for (let i = -3; i <= 3; i++) decals.push({ pos: [HUMPBACK_BRIDGE + i * 2, z - 3], size: [1, 2.4], color: YELLOW });
  }

  // A roundabout: an island with a monument in the middle of the junction.
  props.push({ shape: 'cylinder', size: [2.5, 0.3, 0], pos: [ROUNDABOUT[0], 0.3, ROUNDABOUT[1]], color: PAVEMENT, mapColor: MAP_BLOCK });
  props.push({ shape: 'box', size: [0.7, 1.6, 0.7], pos: [ROUNDABOUT[0], 2.2, ROUNDABOUT[1]], color: 0xb8a070 });
  props.push({ shape: 'cone', size: [0.9, 0.7, 0], pos: [ROUNDABOUT[0], 4.5, ROUNDABOUT[1]], color: 0x8f7a4a, ghost: true });

  // The market: stalls down both sides of one avenue, with goods spilling into the gap.
  const awnings = [0xc8443a, 0x3a7fc8, 0xe0b020, 0x4a9a5a];
  let stall = 0;
  // It starts a little way in, leaving room to line up after the roundabout.
  for (let z = MARKET_ROW[0] + 14; z < MARKET_ROW[1] - 4; z += 7) {
    for (const side of [-1, 1]) {
      const x = MARKET_AVENUE + side * 4.7;
      const sz = z + (side > 0 ? 3.5 : 0);
      props.push({ shape: 'box', size: [1.2, 0.45, 2.2], pos: [x, 0.45, sz], color: 0x9a7448, mapColor: MAP_BUILDING });
      props.push({ shape: 'box', size: [1.5, 0.06, 2.5], pos: [x, 2.6, sz], color: awnings[stall % awnings.length], ghost: true });
      for (const end of [-2.3, 2.3]) {
        props.push({ shape: 'cylinder', size: [0.06, 1.1, 0], pos: [x - side * 1.35, 1.5, sz + end], color: 0x5a5a5a, ghost: true });
      }
      // Every other stall has stock stacked out front.
      if (stall % 2 === 0) {
        const fx = MARKET_AVENUE + side * 2.9;
        props.push({ shape: 'box', size: [0.3, 0.3, 0.3], pos: [fx, 0.3, sz - 0.6], color: 0xd9b36c, mass: 6 });
        props.push({ shape: 'box', size: [0.3, 0.3, 0.3], pos: [fx, 0.3, sz + 0.2], color: 0xb98a55, mass: 6 });
        props.push({ shape: 'box', size: [0.25, 0.25, 0.25], pos: [fx, 0.86, sz - 0.2], color: 0xc8443a, mass: 4 });
      } else {
        props.push({ shape: 'cylinder', size: [0.3, 0.4, 0], pos: [MARKET_AVENUE + side * 3.0, 0.4, sz], color: 0x6a8f3a, mass: 12 });
      }
      stall++;
    }
  }

  // Lane markings: a solid centre line and dashed dividers on every stretch of road.
  const dash = 3;
  const gap = 6;
  const stretch = (center: number, a: number, b: number, alongZ: boolean) => {
    const rotY = alongZ ? 0 : Math.PI / 2;
    const at = (offset: number, along: number): [number, number] => (alongZ ? [center + offset, along] : [along, center + offset]);
    decals.push({ pos: at(0, (a + b) / 2), size: [0.25, b - a], rotY, color: YELLOW });
    for (const offset of [-LANE, LANE]) {
      for (let d = a + gap / 2; d + dash <= b; d += dash + gap) {
        decals.push({ pos: at(offset, d + dash / 2), size: [0.15, dash], rotY, color: WHITE });
      }
    }
  };
  for (const x of AVENUES) for (const [z0, z1] of ROWS) stretch(x, z0, z1, true);
  for (const z of STREETS) for (const [x0, x1] of COLUMNS) stretch(z, x0, x1, false);

  // The delivery bay.
  decals.push({ pos: FINISH, size: [6.4, 17], color: 0x3fbf6a });

  return { props, decals };
}

function buildTraffic(): TrafficLane[] {
  const lanes: TrafficLane[] = [];
  const speeds = mulberry32(5);
  for (const z of BUSY_STREETS) {
    for (const offset of [LANE / 2, LANE * 1.5]) {
      // Heading +X keeps to the +Z side; heading -X to the -Z side.
      lanes.push({ from: [MIN_X, z + offset], to: [MAX_X, z + offset], cars: 4, speed: 10 + speeds() * 3 });
      lanes.push({ from: [MAX_X, z - offset], to: [MIN_X, z - offset], cars: 4, speed: 10 + speeds() * 3 });
    }
  }

  // Cars parked along the kerb, narrowing the road.
  const kerb = ROAD - 1.2;
  const parked = (from: [number, number], to: [number, number], cars: number) => lanes.push({ from, to, cars, speed: 0 });
  parked([AVENUES[2] + kerb, 72], [AVENUES[2] + kerb, 16], 4);
  parked([HUMPBACK_BRIDGE - kerb, 163], [HUMPBACK_BRIDGE - kerb, 204], 3);
  parked([8, STREETS[3] + kerb], [66, STREETS[3] + kerb], 4);
  parked([66, STREETS[3] - kerb], [8, STREETS[3] - kerb], 3);
  parked([AVENUES[5] + kerb, 516], [AVENUES[5] + kerb, 460], 4);
  parked([AVENUES[3] - kerb, 310], [AVENUES[3] - kerb, 368], 4);
  return lanes;
}

export function city(): LevelDef {
  const { props, decals } = buildWorld();
  return {
    id: 'city',
    name: '第 1 關　城市配送',
    brief: '過河、穿過車流，把貨物送到綠色卸貨區',
    ground: {
      center: [(MIN_X + MAX_X) / 2, (MIN_Z + MAX_Z) / 2],
      half: [(MAX_X - MIN_X) / 2 + 20, (MAX_Z - MIN_Z) / 2 + 20],
      style: 'asphalt',
    },
    bounds: [[MIN_X, MIN_Z], [MAX_X, MAX_Z]],
    spawn: START,
    heading: 0,
    props,
    decals,
    cargo: standardLoad(),
    traffic: buildTraffic(),
    finish: { pos: FINISH, half: [3.2, 8.5] },
    // The first level: mistakes cost less here than they will later.
    damageScale: 0.8,
    stars: [0.6, 0.8, 0.95],
  };
}
