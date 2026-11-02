import { Relief, type Look } from './relief';
import type { CargoPlacement } from '../sim/cargo';
import { TRUCK } from '../config';
import { ARCADE_PILLARS, BOAT_ROW, ROAD_W, STREET_END, street } from './harbourStreet';
import { EAVE, HALL, MARKET_ROUTE, OUT, deadEnds, market } from './harbourMarket';
import { LANE, ROW, SHED, lane } from './harbourLane';
import { ROOF_FORKS, ROOF_SPOTS, roofs } from './harbourRoofs';
import { CANOPY, canopy } from './harbourCanopy';
import { ICE_WAY, ICE_YARD, GATE_X, LOBBY, RAMP, SEA_WALL, icePlant } from './harbourIce';
import { JOINT, MARKET_ROOF_SPOTS, MARKET_ROOF_WAY, marketRoof } from './harbourMarketRoof';
import { newsCrews } from './harbourNews';
import { FINISH, OUTER_SPOTS, OUTER_WAY, PIER, QUAY as OUTER_QUAY, SHIP, SURF, outerHarbour } from './harbourOuter';
import { heightAt } from './terrain';
import type { ObjectDesc } from './objects';
import { type DecalDesc, type LevelDef, type PropDesc, type Vec2, STARS } from './types';

// Level 4, 風雨漁港: a fishing harbour in a typhoon, from the waterfront street to a reefer ship in the outer harbour. Drawn on
// 16 m squares as the other levels are, every square something. The way runs north, then east through the market, back
// west over its roof and down into the ice plant, one place after another:
//
//   1  the waterfront street   shophouses with arcades on the west, the harbour on the east behind a low wall: a fallen
//                              tree, a pole leant across, a sign down; then a capsized boat across the whole street, the
//                              way round it along one row's arcade; then three alleys the wind comes out of
//   2  the market              indoors, the aisles between the stalls: north, east, north again and out at the back
//   3  the way up and the roof out of the back door along the lane behind the cold stores, up the neighbours' fallen
//                              carport onto the roofs of a row of old houses, west over them to the market's eaves; then
//                              over the market's roof and down the ice plant's canopy (the roof still to be designed)
//   4  the ice plant           along its loading dock and down into the yard, round, and up the ramp along the sea wall
//                              to the flood gate at the top, turned through
//   5  the outer harbour       down onto the outer quay, out over the fishing boats rafted across the basin to the pier
//   6  the reefer ship         up her stern ramp, along her open side, to her fore deck: the end (in their own file)
//
// What is here is the ground, the heights and what stands fixed. What is knocked about, the wind, the falling sign, the
// skylights and the ice on the ramp come after, a place at a time.

const CELL = 16;
const xOf = (c: number) => c * CELL;

const ROAD: Look = { tag: 'paved', color: 0x5a5e62, wall: 0x6a6e72 };
const QUAY: Look = { tag: 'paved', color: 0x8e9088, wall: 0x7a7c74 };
const TILE: Look = { tag: 'paved', color: 0xa89a86, wall: 0x8a7e6e };
const CONCRETE: Look = { tag: 'paved', color: 0x9a9c98, wall: 0x868884 };
const HOUSES: Look = { tag: 'paved', color: 0x7e7a72, wall: 0x6e6a62 };
/** The harbour's water, and the sea's: a dark green; falling in ends the run. */
const WATER: Look = { tag: 'water', color: 0x2c4a4c, wall: 0x6f7268 };
/** Ground only ever come to by falling on it: from the roof, from the ramp. */
const DROP: Look = { tag: 'drop', color: 0x5f625e, wall: 0x868884 };
const SEAWALL: Look = { tag: 'paved', color: 0xa4a49c, wall: 0x8c8c84 };

/** The ground, square by square, from the south (row 0) north; columns from -7 (west) to 7 (east). */
const COL0 = -7;
const MAP: string[] = [
  //        -7 -6 -5 -4 -3 -2 -1  0  1  2  3  4  5  6  7
  /*  0 */ 'HHHHHBSRWWWWWFF',
  /*  1 */ 'HHHHHBSRWWWWWFF',
  /*  2 */ 'HHHHHBSRWWWWWFF',
  /*  3 */ 'HHHHHBSRWWWWWFF',
  /*  4 */ 'HHHHHBSRWWWWWFF',
  /*  5 */ 'HHHHHBSRWWWWWFF',
  /*  6 */ 'HHHHHBSRWWWWWFF',
  /*  7 */ 'HHHHHBSRWWWWWFF',
  /*  8 */ 'HHHHHBSRWWWWWFF',
  /*  9 */ 'HHHHHBSRWWWWWFF',
  /* 10 */ 'HHHHHBSRWWWWWFF',
  /* 11 */ 'HHHHHBSRWWWWWFF',
  /* 12 */ 'HHHHHBSRWWWWWFF',
  /* 13 */ 'HHHHHBSRWWWWWFF',
  /* 14 */ 'HHHHHBSPPPKKKKK',
  /* 15 */ 'IIIIIddMMMKKKKK',
  /* 16 */ 'IIIIIddMMMKKKKK',
  /* 17 */ 'IIIIIddMMMKKKKK',
  /* 18 */ 'IIIIIddMMMKKKKK',
  /* 19 */ 'IIIIIddMMMKKKKK',
  /* 20 */ 'IIIIIddMMMKKKKK',
  /* 21 */ 'iiiiiiiMMMYYYYY',
  /* 22 */ 'iiiiiiiMMMYYYYY',
  /* 23 */ 'iiiiiiinnnYYYYY',
  /* 24 */ 'EEEEEEEEEEEEEEE',
  /* 25 */ 'SSSSSSSSSSSSSSS',
];
/**
 * What each square is. The street (R) and its quay, at nought; the harbour (W), its water three and a half metres down;
 * across it the far quay (F), boats moored along it. West of the street the shophouses (S) with their arcades, the
 * houses behind them (B) and the old town up the hill behind (H). The square (P) where the street ends at the market's
 * door; the market hall (M); the cold stores (K) on the quay east of it; the loading yard (Y) behind them, at its back
 * door. West of the market the ice plant (I), its loading bay under the canopy (d), fallen into off its end and driven
 * out of into the ice plant's yard (i);
 * behind the market (n) a strip only fallen into from its roof. The sea wall (E) along the north, and the sea (S) beyond.
 */
const SQUARES: Record<string, { h: number; look: Look }> = {
  R: { h: 0, look: ROAD },
  W: { h: -3.5, look: WATER },
  F: { h: 0, look: QUAY },
  S: { h: 0, look: HOUSES },
  B: { h: 0, look: HOUSES },
  H: { h: 0, look: HOUSES },
  P: { h: 0, look: TILE },
  M: { h: 0, look: CONCRETE },
  K: { h: 0, look: CONCRETE },
  Y: { h: 0, look: CONCRETE },
  I: { h: 0, look: CONCRETE },
  d: { h: 0, look: CONCRETE },
  i: { h: 0, look: CONCRETE },
  n: { h: 0, look: DROP },
  E: { h: 6, look: SEAWALL },
};

function base(x: number, z: number): { h: number; look: Look } {
  const c = Math.round(x / CELL) - COL0, r = Math.round(z / CELL);
  const row = MAP[Math.max(0, Math.min(MAP.length - 1, r))];
  const ch = row[Math.max(0, Math.min(row.length - 1, c))];
  // The last row, beyond the sea wall: the sea.
  if (r >= MAP.length - 1) return { h: -3.5, look: WATER };
  return SQUARES[ch] ?? SQUARES.H;
}

/** The square at the street's end, the market hall, its doors. */
const SQUARE_Z = STREET_END - 8;
/** Inside the hall, under its eaves: the camera's line to a truck in there passes through it, and the roof is faded all over. */
/** Behind the cold stores: the lane, the houses, the carport up, in their own file; the way over the houses' roofs in another. */
const YARD = { x0: 40, x1: LANE.x1, z0: LANE.wall, z1: 384 };
/** On the roof: the valley gutter run south along, and where it is left to go on west. */
const ROOF_WEST_Z = JOINT.z1 - 6.5;
/** The ice plant's dock, along the far side of the bay under its canopy; the ramp down off it. */
const DOCK = { x0: -52, x1: -36, z0: 250, z1: 318, h: 1.2 };

const rect = (x0: number, z0: number, x1: number, z1: number): [number, number][] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

export function harbour(): LevelDef {
  // North past the sea wall, the outer harbour, as far as its breakwater.
  const min: Vec2 = [xOf(COL0) - 8, -8], max: Vec2 = [xOf(COL0 + MAP[0].length - 1) + 8, 640];
  const relief = new Relief(min, max, 8, base);
  const props: PropDesc[] = [];
  const decals: DecalDesc[] = [];
  const objects: ObjectDesc[] = [];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, more: Partial<PropDesc> = {}) =>
    props.push({ shape: 'box', size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color, ...more });
  const building = (x0: number, z0: number, x1: number, z1: number, h: number, open: [boolean, boolean, boolean, boolean], seed: number, style: 'old' | 'shed' = 'old', y = 0) =>
    box(x0, y, z0, x1, y + h, z1, 0xd8cfbf, { fade: true, building: { style, open, crown: 0, seed, taped: seed % 3 !== 1 } });

  // 1. The waterfront street, in its own file.
  const st = street(relief, { road: ROAD, quay: QUAY, tile: TILE, water: WATER });
  props.push(...st.props);
  objects.push(...st.objects);
  decals.push(...st.decals);
  // The old town up the hill behind the street's, and its end at the ice plant's fence.
  for (let z = -8; z < 240; z += 24) building(xOf(COL0) - 8, z, -58, Math.min(240, z + 22), 16 + ((z / 24) % 3) * 4, [false, true, true, true], 100 + z);
  // Boats along the far side of the harbour; the far quay's sheds.
  for (let z = -8; z < 216; z += 28) building(xOf(6) - 6, z, xOf(7) + 8, z + 24, 7, [true, false, false, false], 140 + z, 'shed');

  // 2. The square at the street's end, before the market's south door.
  relief.area(rect(-ROAD_W, SQUARE_Z, YARD.x0, HALL.z0), 0, TILE);

  // The market hall and everything in it, in its own file.
  const mk = market(relief, CONCRETE);
  props.push(...mk.props);
  objects.push(...mk.objects);
  decals.push(...mk.decals);

  // The cold stores on the quay east of the hall, wall to wall from the harbour to the loading yard: a little off the
  // hall's wall, so that the two do not draw over each other.
  building(YARD.x0 + 0.4, 216, 74, 272, 8, [false, false, true, true], 151, 'shed');
  building(74, 216, max[0], 272, 9, [false, false, true, true], 152, 'shed');
  building(YARD.x0 + 0.4, 272, max[0], YARD.z0, 8, [false, false, false, true], 153, 'shed');
  // 3. Behind them, the ground, and the fence across its east end; the lane, the houses and the carport up.
  relief.area(rect(YARD.x0, YARD.z0, YARD.x1, YARD.z1), 0, CONCRETE);
  box(YARD.x1, 0, YARD.z0, YARD.x1 + 0.3, 2.4, YARD.z1, 0x7a7e80);
  const ln = lane(relief, { ground: CONCRETE, water: WATER });
  props.push(...ln.props);
  objects.push(...ln.objects);
  const rf = roofs();
  props.push(...rf.props);
  objects.push(...rf.objects);

  // The roof: gables side by side, their ridges along the hall, valleys between at the eaves' height. Hidden while the truck
  // is in the hall under them.
  const mr = marketRoof();
  props.push(...mr.props);
  objects.push(...mr.objects);
  // 4. The ice plant's canopy, its end bay come down off the roof to the dock, the way down; in its own file.
  const cn = canopy(DOCK);
  props.push(...cn.props);
  objects.push(...cn.objects);
  // The bay under it, the lorries' way in from the ice yard through a gap in its wall: fallen into off the end bay's side,
  // driven out of.
  relief.area(rect(CANOPY.x0, 240, HALL.x0, ICE_YARD.z0), 0, CONCRETE);
  box(CANOPY.x0, 0, ICE_YARD.z0 - 0.3, -27, 2.4, ICE_YARD.z0, 0x8a8c88);
  box(-21, 0, ICE_YARD.z0 - 0.3, HALL.x0, 2.4, ICE_YARD.z0, 0x8a8c88);
  // The forklifts' ramp up the dock's face from the bay, just south of the canopy: back up from where the end bay is
  // fallen off, rather than caught half on the dock's edge.
  relief.area(rect(DOCK.x1, 271, DOCK.x1 + 7, CANOPY.z0 - 0.2), (x) => (DOCK.h * (DOCK.x1 + 7 - x)) / 7, CONCRETE);
  box(CANOPY.x0, 0, 236, HALL.x0, 2.4, 240, 0x8a8c88);
  // The dock, the ramp down off its north end, the plant behind it.
  relief.area(rect(DOCK.x0, DOCK.z0, DOCK.x1, DOCK.z1), DOCK.h, CONCRETE);
  relief.area(rect(DOCK.x0, DOCK.z1, DOCK.x1, ICE_YARD.z0), (_x, z) => DOCK.h * (ICE_YARD.z0 - z) / (ICE_YARD.z0 - DOCK.z1), CONCRETE);
  box(DOCK.x0, 0, 240, DOCK.x1, 3, DOCK.z0, 0x8a8c88);
  // The sea wall all along the north, the sea beyond it.
  relief.area(rect(min[0], SEA_WALL.z0, max[0], SEA_WALL.z1), SEA_WALL.h, SEAWALL);
  relief.area(rect(min[0], SEA_WALL.z1, max[0], max[1]), -3.5, WATER);
  // Round the map, past where it ends, the sea: the town is on the shore, and the sea is not to stop at a line with
  // nothing behind it. The town's edges where they meet it, a face of concrete down into it: its own height along the
  // land, the sea wall's at the sea wall's end, the outer quay's past it; the inner harbour open to it on the south.
  const COAST = 0x8c8c84, WALL_FROM = 376;
  for (const x of [min[0] - 0.4, max[0]]) {
    box(x, -4, min[1], x + 0.4, 0, WALL_FROM, COAST);
    box(x, -4, WALL_FROM, x + 0.4, SEA_WALL.h, SEA_WALL.z1, COAST);
  }
  box(min[0] - 0.4, -4, SEA_WALL.z1, min[0], 0, OUTER_QUAY.z1, COAST);
  for (const [x0, x1] of [[min[0], 8], [88, max[0]]]) box(x0, -4, min[1] - 0.4, x1, 0, min[1], COAST);
  const offshore = [
    { area: [min[0] - 300, min[1], min[0], SEA_WALL.z1] as [number, number, number, number], surface: SURF },
    { area: [max[0], min[1], max[0] + 300, SEA_WALL.z1] as [number, number, number, number], surface: SURF },
    { area: [min[0] - 300, min[1] - 300, max[0] + 300, min[1]] as [number, number, number, number], surface: -2.4 },
  ].map((sea) => ({ ...sea, tint: 0x2c4a4c, flow: [0.06, 0.1] as [number, number], rain: true, waves: 0.32 }));
  // The ice plant's yard, the ramp up the sea wall, the gate; in its own file.
  const ic = icePlant(relief, { ground: CONCRETE });
  props.push(...ic.props);
  objects.push(...ic.objects);
  decals.push(...ic.decals);
  // The news out in it, each crew turned to the lorry coming, so that what they are is plain from behind the wheel: the
  // reporter facing it in the light, the camera's back to it. One channel's on the street's quay side between the alleys'
  // gusts, its van parked across behind them into the road;
  // another's up on the ice plant's dock, the plant behind, its van parked in the bay below.
  const news = newsCrews([
    { channel: ['港都新聞台　SNG', '#1f4f9a', '#f2efe6'], van: [2.8, 204.6, 0.3], reporter: [5.2, 199.3], camera: [5.0, 195.8], light: [3.3, 197.3], cones: [[0.6, 199.8], [0.1, 203.2], [0.5, 207.4]], coat: 0xe8c020,
      says: ['各位觀眾，記者現在在南安漁港', '現場風雨非常大，浪已經打上岸了', '呼籲民眾，千萬不要靠近海邊——', '等一下……後面有一台貨車開過來了！', '這種天氣還在送貨？好，畫面交還給棚內'] },
    { channel: ['民聲電視　新聞', '#c8262a', '#f2efe6'], van: [-32, 317.5, 0], vanY: 0, y: DOCK.h, reporter: [-44.8, 312.2], camera: [-44.8, 308.6], light: [-46.6, 310.3], coat: 0x2f62a8,
      says: ['這裡是順發製冰廠，業者正在搶運最後一批漁獲', '冰塊一車一車往船上送', '颱風天，討海人還是要討生活', '欸欸欸，那台貨車開慢一點——'] },
  ]);
  props.push(...news.props);
  objects.push(...news.objects);
  // 5 and 6. Out through the gate: the outer harbour, its boats, the ship; in their own file.
  const oh = outerHarbour(relief, { quay: QUAY, water: WATER, ramp: CONCRETE }, min, max, st.rigs.length);
  props.push(...oh.props);
  objects.push(...oh.objects);
  // The strip behind the hall, only fallen into from the roof: shut off from both yards.
  relief.area(rect(HALL.x0, HALL.z1, HALL.x1, SEA_WALL.z0), 0, DROP);
  box(HALL.x0 - 0.3, 0, HALL.z1, HALL.x0, 2.4, SEA_WALL.z0, 0x8a8c88);
  box(HALL.x1, 0, HALL.z1, HALL.x1 + 0.3, 2.4, SEA_WALL.z0, 0x8a8c88);
  // Behind the barriers across the street's south end, the edge of the map.
  box(-ROAD_W - 4, 0, -8.4, 8, 1.2, -7.9, 0x8a8c88);

  const { terrain } = relief.build();
  const ground = (x: number, z: number) => heightAt(terrain, x, z);
  void ground;

  return {
    id: 'harbour',
    name: '第 4 關　風雨漁港',
    brief: '颱風天的漁港：從老街出發，繞過翻覆的漁船、穿過停電的市場、翻上屋頂，從製冰廠出港，跳過並排的漁船，送上冷凍運搬船的前甲板',
    ground: { center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2], half: [(max[0] - min[0]) / 2 + 200, (max[1] - min[1]) / 2 + 200], style: 'asphalt' },
    terrain,
    sinks: ['water', 'drop'],
    footFloor: -10,
    light: 'storm',
    // A squall every minute or so: the fog closing in for a few seconds, heard coming first.
    squalls: { every: [40, 75], last: 6, grow: 2.5 },
    bounds: [min, max],
    spawn: [0, 0.9, 4],
    heading: 0,
    startLine: { pos: [0, 12], dir: [0, 1] },
    props,
    objects,
    decals,
    cargo: [...harbourLoad(), ...hiddenCargo()],
    traffic: [],
    rigs: [...st.rigs, ...oh.rigs],
    pools: [...(st.pools ?? []), ...ln.pools, ...mr.pools, ...oh.pools, ...offshore],
    fords: [...ln.fords, ...mr.fords],
    lids: [{ area: [HALL.x0, HALL.z0, HALL.x1, HALL.z1], below: EAVE - 0.25 }],
    roofFalls: [{ area: [HALL.x0, HALL.z0, HALL.x1, HALL.z1], below: EAVE - 0.3, skylights: mr.skylights }],
    stillWater: [...ln.stillWater, ...oh.stillWater],
    gusts: [...st.gusts, ...rf.gusts, ...mr.gusts],
    crowds: [...st.crowds, ...mk.crowds, ...oh.crowds, ...news.crowds],
    signs: [...st.signs, ...(mk.signs ?? []), ...ln.signs, ...rf.signs, ...mr.signs, ...cn.signs, ...ic.signs, ...oh.signs, ...news.signs],
    lamps: mk.lamps,
    outage: mk.outage,
    sparks: st.sparks,
    // The walls the sea breaks against: the street's quay; out in the outer harbour the quay's two faces, the sea wall's
    // and the pier's three.
    surf: [
      { from: [8, -8], to: [8, STREET_END - 16], y: -2.4, land: [-1, 0] },
      { from: [OUTER_QUAY.x0, OUTER_QUAY.z1], to: [OUTER_QUAY.x1, OUTER_QUAY.z1], y: SURF, land: [0, -1] },
      { from: [OUTER_QUAY.x1, OUTER_QUAY.z0], to: [OUTER_QUAY.x1, OUTER_QUAY.z1], y: SURF, land: [-1, 0] },
      { from: [OUTER_QUAY.x1, SEA_WALL.z1], to: [PIER.x0, SEA_WALL.z1], y: SURF, land: [0, -1] },
      { from: [PIER.x0, PIER.z0], to: [PIER.x0, PIER.z1], y: SURF, land: [1, 0] },
      { from: [PIER.x1, PIER.z0], to: [PIER.x1, PIER.z1], y: SURF, land: [-1, 0] },
      { from: [PIER.x0, PIER.z1], to: [PIER.x1, PIER.z1], y: SURF, land: [0, -1] },
    ],
    route: [
      [0, 4], [0, 98], [ARCADE_PILLARS - 2.8, BOAT_ROW[0] - 2], [ARCADE_PILLARS - 2.8, BOAT_ROW[1] + 1], [0, 150], [0, SQUARE_Z], ...MARKET_ROUTE,
      [(SHED.x0 + SHED.x1) / 2, OUT], ...ROOF_FORKS[0].filter((_, k) => k % 3 === 0), ROOF_FORKS[0].at(-1)!, ROOF_SPOTS.over, ...MARKET_ROOF_WAY, [-44, ROOF_WEST_Z], ...ICE_WAY, ...OUTER_WAY.slice(1),
    ],
    checkpoints: [
      { name: '1 老街', pos: [0, 4], yaw: 0 },
      { name: '1 翻船', pos: [0, 92], yaw: 0 },
      { name: '2 市場', pos: [MARKET_ROUTE[0][0], 228], yaw: 0 },
      { name: '3 後巷', pos: [HALL.x1 + 6, OUT], yaw: Math.PI / 2 },
      { name: '3 車棚頂', pos: [ROOF_SPOTS.top[0], ROOF_SPOTS.top[1]], yaw: ROOF_SPOTS.top[2], y: ROW.h },
      { name: '3 市場屋脊', pos: [MARKET_ROOF_SPOTS.ridges[0], MARKET_ROOF_SPOTS.ridges[1]], yaw: MARKET_ROOF_SPOTS.ridges[2], y: MARKET_ROOF_SPOTS.ridges[3] },
      { name: '4 製冰廠', pos: [-44, 300], yaw: 0, y: DOCK.h },
      { name: '5 外港', pos: [GATE_X, SEA_WALL.z1 + 1], yaw: 0, y: RAMP.h },
      { name: '5 浮動碼頭', pos: [OUTER_SPOTS.pontoon[0], OUTER_SPOTS.pontoon[1]], yaw: OUTER_SPOTS.pontoon[2], y: OUTER_SPOTS.pontoon[3] },
      { name: '6 運搬船', pos: [OUTER_SPOTS.ship[0], OUTER_SPOTS.ship[1]], yaw: OUTER_SPOTS.ship[2], y: OUTER_SPOTS.ship[3] },
    ],
    // Halfway, as the way goes: off the end of the fallen billboard onto the market roof, before its skylights. The zone is
    // on the roof's first slope in from its east eaves, where the truck comes down off the billboard and turns west, in the
    // bay between the first crest's rooflights; up there only, not in the market under it; back to the roof's first crest.
    save: { zone: [34.2, 355.2, 39.8, 362.3], pos: [MARKET_ROOF_SPOTS.ridges[0], MARKET_ROOF_SPOTS.ridges[1]], yaw: MARKET_ROOF_SPOTS.ridges[2], y: MARKET_ROOF_SPOTS.ridges[3] },
    // On the ship's fore deck, in the square under her crane.
    finish: { pos: FINISH.pos, half: FINISH.half, above: SHIP.y - 1 },
    stars: STARS,
    par: 420,
    // The reefer's old captain. Each place's word while the truck is in it, a zone the whole place rather than the way in, so
    // that it can wait out a conversation already going and still come while it is there: round the capsized boat; along the
    // street's windy alleys, where the news crew is (the boss, about the storm); in the market once the lights are out; up on
    // the market's roof (above its eaves, not in the hall under it); the dock, the ice yard and its ramp; the outer
    // quay and the boats; the ship's side with its loose containers.
    chat: {
      customer: 'captain',
      places: [
        { zone: [-14, 40, 10, 150], wait: 30, talk: [['them', '前面那艘船'], ['them', '那艘肚子朝上在曬太陽的'], ['them', '不要一直看它'], ['me', '就是翻了'], ['them', '噓！！！']] },
        { zone: [-14, 150, 14, HALL.z0 - 12], wait: 30, from: 'boss', talk: [['them', '新聞說颱風今晚登陸'], ['me', '那還要送嗎'], ['them', '客人說他看過黃曆，今天宜出貨'], ['me', '黃曆有寫宜被浪打嗎']] },
        { zone: [HALL.x0, mk.outage.from + 2, HALL.x1, HALL.z1], wait: 30, talk: [['them', '市場停電了，裡面很暗'], ['them', '你看得到路嗎'], ['me', '看不到'], ['me', '但撞得到']] },
        { zone: [HALL.x0, HALL.z0, HALL.x1, HALL.z1], above: EAVE, wait: 30, talk: [['them', '市場的人打給我，說有一台到處亂開的貨車'], ['me', '真的嗎？我在市場屋頂上沒看到欸'], ['them', '會不會他說的就是你']] },
        { zone: [-60, 290, -28, SEA_WALL.z1 - 2], wait: 30, talk: [['them', '製冰廠的坡結冰了，很滑'], ['me', '放心，我有經驗'], ['them', '你在冰上開過？'], ['me', '在冰上滑過直排輪'], ['me', '都是四個輪子 應該差不多']] },
        { zone: [-58, 424, PIER.x0, 460], wait: 30, talk: [['them', '你要從漁船上開過來？'], ['them', '那些船不是我的，撞到要賠'], ['me', '那撞到你的呢'], ['them', '……也要賠']] },
        { zone: [44, 490, 70, 550], wait: 30, talk: [['them', '甲板上的貨櫃會滑，小心點'], ['me', '放心，我會看準時機'], ['them', '你剛剛已經撞到一個了'], ['me', '那是它看錯時機']] },
      ],
    },
  };
}

/**
 * The last load before the port shuts, for the reefer: the season's bluefin, frozen, lying across the bed against the cab;
 * behind it, kept low so that it is seen, a big octopus with its arms spread out between two mahi-mahi; a ship's anchor laid
 * flat across the bed; a king crab sprawled behind it; and at the back four cabbages and four cartons of cup noodles stacked
 * two high. Five thousand in all.
 */
function harbourLoad(): CargoPlacement[] {
  const cargo: CargoPlacement[] = [];
  const floor = TRUCK.frame.pos[1] + TRUCK.frame.half[1];
  const gap = 0.01;
  const on = (half: number) => floor + half + gap;
  // The tuna with its dark back and fins to the rear, where they are seen.
  cargo.push({ type: 'tuna', pos: [0, on(0.252), 1.6], rotY: -Math.PI / 2 });
  cargo.push({ type: 'octopus', pos: [0, on(0.17), 0.45] });
  for (const x of [-0.92, 0.92]) cargo.push({ type: 'mahi', pos: [x, on(0.09), 0.45] });
  cargo.push({ type: 'anchor', pos: [-0.1, on(0.07), -1.0], rotY: Math.PI / 2 });
  cargo.push({ type: 'kingCrab', pos: [0, on(0.17), -2.41] });
  for (const z of [-3.0, -3.35]) for (const x of [-0.92, -0.58]) cargo.push({ type: 'cabbage', pos: [x, on(0.15), z] });
  for (const x of [0.02, 0.72]) for (const y of [on(0.22), floor + 0.44 + 0.22 + gap * 3]) cargo.push({ type: 'noodles', pos: [x, y, -3.15] });
  return cargo;
}

/**
 * The captain's things, left about the harbour this morning, to be found: his new cap, made big at the market, put down in
 * the people's walkway off the dark aisle that goes nowhere, a way down it between the stalls; his telescope, on its tripod in the ice
 * plant, up its steel stair and in at the second floor's door, beside the doorway and turned to the wall; the ship's bell, back from
 * being polished, on the hard by the boat up on its blocks in the yard on the outer quay.
 */
function hiddenCargo(): CargoPlacement[] {
  const [, fish] = deadEnds();
  return [
    { type: 'captainCap', pos: [fish.end[0] + 2.6, 0.19, fish.end[1] - 8.5], rotY: 0.4, found: true },
    { type: 'telescope', pos: [ICE_YARD.x0 - LOBBY.wall - 0.75, LOBBY.y0 + 0.72, LOBBY.z0 + 0.95], rotY: Math.PI, found: true },
    { type: 'shipBell', pos: [-101.3, 3.1 + 3.85 + 0.31 * 1.5 + 0.02, 431.25], rotY: 0.6, found: true },
  ];
}
