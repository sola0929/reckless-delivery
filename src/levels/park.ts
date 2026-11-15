import { parkSite } from './parkParts';
import { CELL, COASTER_AT, FINISH, GATE, HUB, HUB_R, LIFT_X, MAX, MIN, PIRATE_LANE, POOL, RIDE_END, SHIPS, SHORE_Z, TOP, TOWER } from './parkPlan';
import { front, QUEUE_ROUTE } from './parkFront';
import { lake } from './parkLake';
import { teacups, TEA_ROUTE } from './parkTea';
import { coasterGrounds } from './parkCoaster';
import { northShore, SHORE_ROUTE } from './parkShore';
import { waterRides, POOL_ROUTE } from './parkWater';
import { pirateBay, PIRATE_ROUTE } from './parkPirate';
import { walks } from './parkWalks';
import { Relief, type Look } from './relief';
import { standardLoad } from './sandbox';
import { type LevelDef, type Vec2, STARS } from './types';

// Level 5, 幸福島樂園: an amusement park on its opening day, round a lake. Drawn on 16 m squares as the other levels are,
// every square something; the rides round the lake's shore, each a place of its own, the way going round from one to the
// next (see parkPlan.ts for where each is, and the files named for each place for what is there):
//
//   1  in              from the coaches' bay through the queue for the gate, zigzagging across its yard in square bends;
//                      through the turnstiles, up the main street between the carts down its middle, round the carousel
//   2  the teacups     west across three turntables, each turning its own way, waiting on the landings between for the
//                      cups to come round; then hard right up a narrow way to the coaster's station
//   3  the coaster     on its own track: braked down the first drop into the mine, round its bend to the
//                      east inside the rock, out on to the brake run and down off it
//   4  the north shore the calm stretch: along the lake between the stage's chairs, the ferris wheel's queue, the food
//                      trucks and the people, the lake's railing on the other hand
//   5  the wave pool   across its shallows as the waves come in, every third a big one, throwing rings and boats
//   6  the slide       up the raft lift and down the slide, slippery, its tube round a hairpin; into the splash pool
//   7  the pirate bay  south under the swinging ships between the games stalls; past the restaurant to its back door

const PAVE: Look = { tag: 'paving', color: 0xd4c6ad, wall: 0x9a8e7a };
const TILE: Look = { tag: 'paving', color: 0xdcc6a4, wall: 0x9a8e7a };
const ASPHALT: Look = { tag: 'paved', color: 0x62666a, wall: 0x55585c };
const CONCRETE: Look = { tag: 'paved', color: 0x9c9e9a, wall: 0x868884 };
const GRASS: Look = { tag: 'grass', color: 0x6f9e52, wall: 0x5a7a44 };
const WOODS: Look = { tag: 'grass', color: 0x5a8a46, wall: 0x4a6a3a };
/** The coaster's grounds: the red earth of a western mine. */
const RED: Look = { tag: 'earth', color: 0xc8925e, wall: 0xa85a34 };
/** The children's playground: its soft floor. */
const SOFT: Look = { tag: 'paving', color: 0x7fb6a4, wall: 0x6a8a7a };

/**
 * The ground, square by square, from the south (row 0) north; columns from 0 (east, the least X) to 27 (west), as the
 * minimap shows it turned round: X grows to the west. Outside the park on the
 * south: the car park (P), the coaches' bay (B), the queue's yard (Q) in its planting (g); the back of house (O) and the
 * pirate restaurant's yard (D) behind the park on the south-east. The park's wall (U) along the south with the gate and its
 * ticket halls (G). Inside: the main street (M) up to the hub (H); the food court (F), the children's playground (k) and the
 * tea party's garden with its tables (t) west of them; the coaster's station (S), its grounds of red earth (C), the mine's
 * rock (N) in the north-west; the lake (~) with its island and castle (I), the canal (W) out of it south between the hub
 * and the pirate bay; the north shore (R), the stage and the ferris wheel (E) on it; the wave pool (V), its beach (b),
 * its machine house (v); the raft lift, the slide and its grounds (Y), the water park's changing rooms and lockers (w);
 * the splash pool (L); the pirate bay (X) and its arcade (A). Woods (j) round it all.
 */
const MAP: string[] = [
  /*  0 */ 'jOOOOOOOOOBBBBBPPPPPPPPPPPjj',
  /*  1 */ 'jOOOOOOOOOBBBBBPPPPPPPPPPPjj',
  /*  2 */ 'jOOOOOOOOOBBBBBPPPPPPPPPPPjj',
  /*  3 */ 'jOOOOOOOOOgQQQgPPPPPPPPPPPjj',
  /*  4 */ 'jOOOOODDDDgQQQgPPPPPPPPPPPjj',
  /*  5 */ 'jOOOOODDDDgQQQgPPPPPPPPPPPjj',
  /*  6 */ 'jOOOOODDDDgQQQgPPPPPPPPPPPjj',
  /*  7 */ 'jOOOOODDDDgQQQgPPPPPPPPPPPjj',
  /*  8 */ 'jOOOOOOAXXgQQQgPPPPPPPPPPPjj',
  /*  9 */ 'jOOOOOOAXXgQQQgPPPPPPPPPPPjj',
  /* 10 */ 'jOOOOOOAXXGGGGGUUUUUUUUUUUjj',
  /* 11 */ 'jOOOOOOAXXWMMMUkkkkkkFFFFFjj',
  /* 12 */ 'jOOOOOOAXXWMMMUkkkkkkFFFFFjj',
  /* 13 */ 'jOOOOOOAXXWHHHHkkkkkkFFFFFjj',
  /* 14 */ 'jYYYYYLLLLWHHHHttttttFFFFFjj',
  /* 15 */ 'jYYYYYLLLLWHHHHttttttFFFFFjj',
  /* 16 */ 'jYYYYYggggWHHHHtttttSFFFFFjj',
  /* 17 */ 'jYYYYY~~~~~~~~~~~~~~SCCCCCjj',
  /* 18 */ 'jYYYYY~~~~~~~~~~~~~~SCCCCCjj',
  /* 19 */ 'jYYYYY~~~~~~II~~~~~~CCCCCCjj',
  /* 20 */ 'jwwwYY~~~~~~III~~~~~CCCCCCjj',
  /* 21 */ 'jwwwYY~~~~~~II~~~~~~CCCCCCjj',
  /* 22 */ 'jwwwYY~~~~~~~~~~~~~~CCCCCCjj',
  /* 23 */ 'jwwwYYbbbbb~~~~~~~~~CNNNCCjj',
  /* 24 */ 'jwwwYYVVVVggggggggggCNNNCCjj',
  /* 25 */ 'jwwwYYVVVVVRRRRRRCCCCNNNCCjj',
  /* 26 */ 'jwwwwwVVVVVEEEEEECCCCNNNCCjj',
  /* 27 */ 'jwwwwwvvvvvEEEEEECCCCCCCCCjj',
  /* 28 */ 'jjjjjjjjjjjjjjjjjjjjjjjjjjjj',
];
/** What the ground is in each, before the places on it are laid: the lake, the pools and the rides' grounds are laid over it. */
const SQUARES: Record<string, Look> = {
  P: ASPHALT, B: ASPHALT, Q: PAVE, g: GRASS, O: CONCRETE, D: CONCRETE, G: PAVE, U: GRASS,
  F: TILE, k: SOFT, t: PAVE, M: TILE, H: TILE, W: GRASS, X: PAVE, A: PAVE, L: PAVE, Y: GRASS, w: PAVE,
  C: RED, S: PAVE, N: RED, '~': GRASS, I: GRASS, R: PAVE, E: PAVE, V: PAVE, b: PAVE, v: PAVE, j: WOODS,
};

function base(x: number, z: number): { h: number; look: Look } {
  const r = Math.max(0, Math.min(MAP.length - 1, Math.floor(z / CELL)));
  const row = MAP[r];
  const ch = row[Math.max(0, Math.min(row.length - 1, Math.floor(x / CELL)))];
  return { h: 0, look: SQUARES[ch] ?? WOODS };
}

/** The woods round the park, outside its fences: trees along the map's edges, in two uneven rows. */
function woods(props: import('./types').PropDesc[]): void {
  const tree = (x: number, z: number, k: number) => {
    const h = 1.2 + (k % 3) * 0.3;
    props.push({ shape: 'cylinder', size: [0.22, h, 0], pos: [x, h, z], color: 0x6b5238, ghost: true });
    if (k % 2) props.push({ shape: 'cone', size: [2.2, 3.2, 0], pos: [x, h * 2 + 2.6, z], color: [0x3f6a34, 0x4a7a3c][k % 2], ghost: true });
    else props.push({ shape: 'sphere', size: [2.5, 2.3, 2.5], pos: [x, h * 2 + 1.6, z], color: [0x4f8a4a, 0x447d44][(k / 2) % 2 | 0], ghost: true });
  };
  let k = 0;
  for (let z = 6; z < 458; z += 7) for (const x of [4.5, 11]) tree(x + ((k * 7) % 3), z + (x > 8 ? 3.5 : 0), k++);
  for (let z = 168; z < 458; z += 7) for (const x of [436, 443]) tree(x - ((k * 5) % 3), z + (x > 440 ? 3.5 : 0), k++);
  for (let x = 16; x < 432; x += 7) tree(x + ((k * 3) % 3), 460.5, k++);
}

export function park(): LevelDef {
  const relief = new Relief(MIN, MAX, 8, base);
  const s = parkSite(relief);
  lake(s);
  front(s);
  teacups(s);
  const ride = coasterGrounds(s);
  northShore(s);
  const water = waterRides(s);
  pirateBay(s);
  walks(s);
  woods(s.props);
  const built = relief.build();
  const fine = (way: { x: number; z: number }[], every: number) => way.filter((_, k) => k % every === 0).map((p) => [p.x, p.z] as Vec2);
  return {
    id: 'park',
    name: '第 5 關　幸福島樂園',
    brief: '開幕日的遊樂園：從排隊入園開始，過咖啡杯轉盤、開上雲霄飛車軌道、沿湖到造浪池、坐大滑水道下來，穿過海盜船，送到海盜餐廳後門',
    ground: { center: [(MIN[0] + MAX[0]) / 2, (MIN[1] + MAX[1]) / 2], half: [(MAX[0] - MIN[0]) / 2 + 200, (MAX[1] - MIN[1]) / 2 + 200], style: 'asphalt' },
    terrain: built.terrain,
    sinks: ['drop', 'water'],
    bounds: [MIN, MAX],
    spawn: [GATE[0], 0.9, 22],
    heading: 0,
    startLine: { pos: [GATE[0], 30], dir: [0, 1] },
    props: s.props,
    decals: s.decals,
    objects: s.objects,
    crowds: s.crowds,
    fords: s.fords,
    signs: s.signs,
    waves: s.waves,
    pools: s.pools,
    fountains: s.fountains,
    flocks: s.flocks,
    stillWater: s.stillWater,
    keepOut: s.keepOut,
    clowns: s.clowns,
    slicks: s.slicks,
    cargo: standardLoad(),
    traffic: [],
    rigs: s.rigs,
    quietBeyond: 160,
    route: [
      ...QUEUE_ROUTE, ...TEA_ROUTE, ...fine(ride, 3), ...SHORE_ROUTE, ...POOL_ROUTE, ...fine(water.slide, 10), ...PIRATE_ROUTE,
    ],
    checkpoints: [
      { name: '1 入園排隊', pos: [GATE[0], 22], yaw: 0 },
      // In the open lane beside the parade floats, clear of the gate's posts behind.
      { name: '1 大街', pos: [GATE[0] - 3.4, GATE[1] + 5.5], yaw: 0 },
      { name: '2 咖啡杯', pos: [HUB[0] + HUB_R + 3, HUB[1] + 1], yaw: Math.PI / 2 },
      { name: '3 雲霄飛車', pos: [COASTER_AT[0], COASTER_AT[1] - 8], yaw: 0 },
      { name: '3 第一個下坡', pos: [COASTER_AT[0], COASTER_AT[1] + 96], yaw: 0, y: 11.3 },
      { name: '4 北岸', pos: [RIDE_END.x - 6, SHORE_Z], yaw: -Math.PI / 2 },
      { name: '5 造浪池', pos: [POOL.x1 + 18, SHORE_Z], yaw: -Math.PI / 2 },
      { name: '6 滑水道', pos: [LIFT_X, TOWER.z1 - 4], yaw: Math.PI, y: TOP },
      { name: '7 海盜灣', pos: [PIRATE_LANE - 2.6, SHIPS[1] + 28], yaw: Math.PI },
      { name: '7 終點前', pos: [PIRATE_LANE, SHIPS[1] - 40], yaw: Math.PI },
    ],
    // Halfway, as the way goes: off the coaster on to the north shore, the calm stretch, before the wave pool.
    save: { zone: [RIDE_END.x - 12, SHORE_Z - 6, RIDE_END.x - 2, SHORE_Z + 6], pos: [RIDE_END.x - 8, SHORE_Z], yaw: -Math.PI / 2 },
    finish: { pos: FINISH, half: [5, 5] },
    stars: STARS,
    par: 330,
  };
}

