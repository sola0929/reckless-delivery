import { buildTown, city } from './city';
import { CITY_LOOKS, cityHeights } from './hillcity';
import { lift } from './lift';
import type { CargoPlacement } from '../sim/cargo';
import { TRUCK } from '../config';
import type { ObjectDesc, ObjectKindId } from './objects';
import type { Look, Relief } from './relief';
import { heightAt } from './terrain';
import type { CrowdDesc, DecalDesc, LevelDef, MachineDesc, PropDesc, RiderLane, RollerDesc, SignDesc, TrafficLane, Vec2 } from './types';
import type { Vec3 } from '../config';

// Level 2: on north from the delivery bay where level 1 ends, out of the city on its hillside (hillcity.ts) and up.
// Drawn as level 1 is, a map of 16 m squares, every one of them something, and built by level 1's own builders; with the
// ground's height added, and the set pieces built by hand on the squares left for them.
//
//   The bus street (column 12) climbs north out of the bay through the old town: a bus stopping at its stops, a stream
//   coming down. Branches west to a park and to a temple square, a market lane east, on north past the crossroads to a park.
//   At the crossroads (row 59) east, down steps meant for people: a flight, a landing where the way turns right (straight on,
//   a guard rail and a drop to a temple courtyard below, with a path from it down beside the steps), a second flight south,
//   and the square at the foot.
//   South from there a narrow lane, bending, down to the road (row 51); east along it past a branch either side, to the
//   avenue (column 31): four lanes up a 22% hill, traffic, and coils of steel rolling down from the steel works at the top.
//   The delivery is at the landing two thirds of the way up.
//
// +Z is north. +X is west; columns run east, against X. Rows are level 1's, carried on: this map's last line is row 46.

const MAP2 = [
  'oooooooooooooooooooooooooowwwwwwwwww', // 73
  'oooooooooooooooooooooooooowwwwwwwwww', // 72
  'oooooooooooooooooooooooooowwwwwwwwww', // 71
  'oooooooooooooooooooooooooowwwwwwwwww', // 70
  'ooooooooooooooooooooooooooooooo.wwww', // 69
  'ooooooooooooooooooooooooooooooo.wwww', // 68
  'ooooooooooooooooooooooooooooooo.wwww', // 67
  'ooooooooooopppooooooooooooooooo.wwww', // 66
  'ooooooooooopppooooooooooooooooo.....', // 65
  'ooooooooooopppooooooooooooooooo.wwww', // 64
  'oooooooooooo,oooooooooooooooooo....w', // 63
  'oooooooooooo,ooooKKKooooooooooo.wwww', // 62
  'oooooooooooo,ooooKKKooooooooooo.wwww', // 61
  'oooqqqoooooo,ooooKKKooooooooooo.wwww', // 60
  'oooqqq,,,,,,,LTTLKKKoo#########.wwww', // 59
  'oooqqqoooooo,ooLTKoaoo#########.wwww', // 58
  'oooooooooooo,oooTKoaoo#########....w', // 57
  'oooooooooooo,,,,KKoaoo#########.wwww', // 56
  'oooooooooooo,ooooAaAoo####qqq##.wwww', // 55
  'oooooooooooo,######aoo####qqq##.wwww', // 54
  'ooopppoooooo,######aoo#####,###.wwww', // 53
  'oooppp,,,,,,,######AaA#####,###.wwww', // 52
  'ooopppoooooo,#######o,,,,,,,,,,.wwww', // 51
  'oooooooooooo,#########KKK,#wwwwowwww', // 50
  'oooooooooooo,mmmmm####KKK,#wwwwowwww', // 49
  'oooooo,,,,,,,############,#wwwwowwww', // 48
  'oooooooooooo,###########pppwwwwowwww', // 47
  'oooooooooooo,###########pppwwwwowwww', // 46
];
const ROW0 = 46;
const CELL = 16;
const xOf = (c: number) => (17.5 - c) * CELL;
const zOf = (r: number) => r * CELL;
/** Which square a place is on. */
const colOf = (x: number) => Math.round(17.5 - x / CELL);
const ramp = (v: number, from: number, to: number, a: number, b: number) => a + (b - a) * Math.max(0, Math.min(1, (v - from) / (to - from)));

// The heights, metres: the bay, the crossroads at the top of the bus street, the landing on the steps, their foot.
const BAY = 16;
const TOP = 34;
const MID = 28.4;
const FOOT = 22.8;
/** The bus street climbs from the bay (south edge of row 46) to the crossroads (north edge of row 58); north of that, the hill. */
const base = (z: number) => (z <= zOf(58) + 8 ? ramp(z, zOf(46) - 8, zOf(58) + 8, BAY, TOP) : z <= zOf(59) + 8 ? TOP : TOP + (z - (zOf(59) + 8)) * 0.2);
/**
 * East of the steps (column 16 on): the lower terrace the steps come down to. Level at the height of their foot from row 56 to
 * row 60, where the square, the path and the courtyard are, rising gently north of that; to the south it comes up gently, over
 * rows 52-55, to meet the road at row 51. The edge between it and the high ground of the bus street is a retaining wall.
 */
const ROAD_LEVEL = base(zOf(50) + 8);
const low = (z: number) =>
  z <= zOf(50) + 8 ? base(z) : z <= zOf(51) + 8 ? ROAD_LEVEL : z < zOf(55) + 8 ? ramp(z, zOf(51) + 8, zOf(55) + 8, ROAD_LEVEL, FOOT) : FOOT + Math.max(0, z - (zOf(62) + 8)) * 0.2;
/** The avenue: level at its foot, 22% up, level where the branch east meets it (row 57), up, level where the side street meets it (row 63), up again to the landing (rows 65-66), up to the steel works. */
const GRADE = 0.22;
const AV_FOOT = zOf(52) + 8;
const AV_SIDE: Vec2 = [zOf(63) - 8, zOf(63) + 8];
const AV_LANDING: Vec2 = [zOf(64) + 8, zOf(66) + 8];
const AV_MID: Vec2 = [zOf(57) - 8, zOf(57) + 8];
const AV_FOOT_H = ROAD_LEVEL;
const AV_HEAD = zOf(69) + 8;
/** The stretches of the avenue that are level, and how far up it one has climbed by a place: metres of slope below it. */
const AV_LEVELS: Vec2[] = [AV_MID, AV_SIDE, AV_LANDING];
const climb = (z: number) => {
  const top = Math.min(z, AV_HEAD);
  let run = Math.max(0, top - AV_FOOT);
  for (const [a, b] of AV_LEVELS) run -= Math.max(0, Math.min(top, b) - Math.max(AV_FOOT, a));
  return run;
};
const avenue = (z: number) => AV_FOOT_H + climb(z) * GRADE;
const AV_MID_H = avenue(AV_MID[0]);
const AV_SIDE_H = avenue(AV_SIDE[0]);
/** Squares and parks, level, each at the height of the ground at its middle: [first column, last, first row, last]. */
const LEVEL_PLACES: [number, number, number, number][] = [[3, 5, 58, 60], [3, 5, 51, 53], [11, 13, 64, 66], [24, 26, 46, 47]];
/** The branch north from the road and the square at its end: level with the road, its blocks rising round it behind walls. */
const AT_ROAD: [number, number, number, number][] = [[26, 28, 54, 55], [27, 27, 52, 53], [22, 24, 49, 50]];

/**
 * East of the map (beyond its edge at x = EAST_EDGE): the hill the avenue climbs, cut away for a road down it to a quarry at
 * its foot. The road leaves the landing eastward (row 65) and goes down three legs, each 18% and 60 m long, turning back on
 * itself through two level hairpins: south down the first, north down the second, south down the third, and round at its
 * foot east into the quarry. Each leg lies on a terrace of its own, level across, a cut wall up to the one above on its
 * uphill side and a drop to the one below on the other, behind a crash barrier.
 */
const EAST_EDGE = xOf(35) - 8;
const QUARRY_EDGE = EAST_EDGE - 64;
const LANDING_H = avenue(AV_LANDING[0]);
const DOWN = 0.18;
/** The road down: a narrow mountain road, two tight lanes. Each leg's terrace reaches just past its downhill edge, where the
 * barrier stands with the drop straight behind it; uphill it reaches back to the cut wall, room for houses up to the road. */
const HILL_ROAD = 6.5;
const DOWNHILL = HILL_ROAD / 2 + 1.0;
const UPHILL = 20 - DOWNHILL;
/** The three legs: where along X each runs, and the Z of their ends; the heights at the hairpins (A south, B north) and at the foot. */
const LEGS = [EAST_EDGE - 14, EAST_EDGE - 34, EAST_EDGE - 54];
const LEG_SOUTH = zOf(61) - 6;
const LEG_NORTH = zOf(64) + 6;
/** How far uphill of a leg its terrace reaches; and how far out past each hairpin, beyond the road, the level ground goes before the bank. */
const hillUp = (x: number) => Math.min(EAST_EDGE, x + UPHILL);
const OUT_A = LEG_SOUTH - 12 - HILL_ROAD / 2 - 3;
const OUT_B = LEG_NORTH + 12 + HILL_ROAD / 2 + 3;
const HAIRPIN_A = LANDING_H - (LEG_NORTH - LEG_SOUTH) * DOWN;
const HAIRPIN_B = HAIRPIN_A - (LEG_NORTH - LEG_SOUTH) * DOWN;
const QUARRY_H = HAIRPIN_B - (LEG_NORTH - LEG_SOUTH) * DOWN;
/** The quarry yard: [x0, z0, x1, z1]. */
const QUARRY: Rect = [EAST_EDGE - 196, zOf(55), QUARRY_EDGE, zOf(67) + 8];
const QUARRY_LOOK: Look = { tag: 'gravel', color: 0x9c9384, wall: 0x7d7466 };
const HEAP_LOOK: Look = { tag: 'gravel', color: 0xaea592, wall: 0x7d7466 };
const HILL_LOOK: Look = { tag: 'grass', color: 0x5f7f45, wall: 0x7a6e5e };
const SHOULDER_LOOK: Look = { tag: 'dirt', color: 0x8a7a62, wall: 0x6e6252 };
const DOWN_ROAD: Look = { tag: 'road', color: 0x4f555c, wall: 0x6e6a62 };
/** Heaps of gravel and sand about the yard: [x, z, radius, height]. */
/**
 * Where the load goes, now: the yard at the quarry's gate, at the foot of the hill, walled off from the quarry itself, which
 * is for another day. [x0, z0, x1, z1]. It reaches north under the last leg and the second hairpin, so that a truck gone
 * through a barrier there comes down in it, not in the quarry with no way out.
 */
const GATE_YARD: Rect = [QUARRY_EDGE - 28, LEG_SOUTH - 30, QUARRY_EDGE, LEG_NORTH + 22];
const ALL_HEAPS: [number, number, number, number][] = [
  [QUARRY_EDGE - 22, LEG_SOUTH + 6, 8, 3], [QUARRY_EDGE - 40, LEG_SOUTH - 22, 7, 2.5], [QUARRY_EDGE - 54, LEG_SOUTH + 22, 9, 3.5],
  [QUARRY_EDGE - 70, LEG_SOUTH - 8, 6, 2], [QUARRY_EDGE - 86, LEG_SOUTH + 16, 8, 3], [QUARRY_EDGE - 32, LEG_SOUTH + 44, 7, 2.5],
  [QUARRY_EDGE - 62, LEG_SOUTH + 62, 9, 4], [QUARRY_EDGE - 92, LEG_SOUTH - 26, 7, 2.5], [QUARRY_EDGE - 104, LEG_SOUTH + 76, 8, 3],
  [QUARRY_EDGE - 18, LEG_SOUTH - 44, 8, 3], [QUARRY_EDGE - 86, LEG_SOUTH - 52, 12, 6],
];
const HEAPS = ALL_HEAPS.filter(([x, z, r]) => !(x + r > GATE_YARD[0] - 2 && z + r > GATE_YARD[1] - 2 && z - r < GATE_YARD[3] + 2));

/** The height of the ground anywhere in the new part. */
function land(x: number, z: number): number {
  const c = colOf(x), r = Math.round(z / CELL);
  if (AT_ROAD.some(([c0, c1, r0, r1]) => c >= c0 && c <= c1 && r >= r0 && r <= r1)) return ROAD_LEVEL;
  const place = LEVEL_PLACES.find(([c0, c1, r0, r1]) => c >= c0 && c <= c1 && r >= r0 && r <= r1);
  if (place) {
    const [c0, c1, r0, r1] = place;
    return rawLand((xOf(c0) + xOf(c1)) / 2, (zOf(r0) + zOf(r1)) / 2);
  }
  return rawLand(x, z);
}
function rawLand(x: number, z: number): number {
  // East of the map: the hill, as high as the avenue beside it; beyond the quarry's edge, the quarry floor.
  if (x < EAST_EDGE) return x >= QUARRY_EDGE ? Math.min(avenue(z), QUARRY_H + ((x - QUARRY_EDGE) / (EAST_EDGE - QUARRY_EDGE)) * (LANDING_H - QUARRY_H)) : QUARRY_H;
  const c = colOf(x), r = Math.round(z / CELL);
  // The avenue, and the blocks between the road and the avenue: up with the avenue.
  if (c >= 32 && r === 63) return AV_SIDE_H;
  if (c >= 32 && r === 57) return AV_MID_H;
  if (c >= 31 || (c >= 22 && r >= 52)) return avenue(z);
  return c >= 16 ? low(z) : base(z);
}

// The steps, in the city's frame, round a corner: the first flight east down the middle of row 59 from the top landing; the
// landing (column 16), where the way turns right, with the square inside the corner open so that a truck can get round; the
// second flight south down the middle of column 16. Risers 35 cm on 2 m treads; each flight 7 m wide with a verge each side,
// 10 m between its houses as the map gives it.
const FLIGHTS = [
  { a: [xOf(13) - 8, zOf(59)] as Vec2, b: [xOf(15) - 8, zOf(59)] as Vec2, top: TOP, foot: MID },
  { a: [xOf(16), zOf(58) + 8] as Vec2, b: [xOf(16), zOf(57) - 8] as Vec2, top: MID, foot: FOOT },
];
const STAIR_WIDE = 5.5;
type Rect = [number, number, number, number];
/** Rectangles [x0, z0, x1, z1]: the top landing; the landing; its inside corner; the courtyard below it, off its far edge; the
 * path south from the courtyard beside the second flight; the square at the foot. */
const TOP_LANDING: Rect = [xOf(13) - 8, zOf(59) - 8, xOf(13) + 8, zOf(59) + 8];
const LANDING: Rect = [xOf(16) - 8, zOf(59) - 8, xOf(16) + 8, zOf(59) + 8];
const CORNER: Rect = [xOf(15) - 8, zOf(58) - 8, xOf(15) + 8, zOf(58) + 8];
const COURTYARD: Rect = [xOf(19) - 8, zOf(59) - 8, xOf(17) + 8, zOf(62) + 8];
const PATH: Rect = [xOf(17) - 8, zOf(57) - 8, xOf(17) + 8, zOf(58) + 8];
const FOOT_SQUARE: Rect = [xOf(17) - 8, zOf(56) - 8, xOf(16) + 8, zOf(56) + 8];
/** The school's yard, south of the road (row 51), level with it. */
/** Where the removals van stands, at the south kerb of the road between the branch north (column 27) and the avenue. */
const VAN: Vec2 = [xOf(29), zOf(51) - 3.15];
/** Where the clock starts: a little way north of where the truck stands in the bay. */
const START_GATE = zOf(45) + 6;
const SCHOOL: Rect = [xOf(24) - 8, zOf(49) - 8, xOf(22) + 8, zOf(50) + 8];

const PAVED: Look = { tag: 'paved', color: 0x9a948a, wall: 0xa8a59c };
const STEPS: Look = { tag: 'steps', color: 0xb8b2a6, wall: 0x5f5a52 };
const COURT_LOOK: Look = PAVED;


/** The hill east of the landing, the road down it in hairpins, and the quarry at its foot. */
function layHillRoad(relief: Relief, rect: (r: Rect) => [number, number][]) {
  const [x1, x2, x3] = LEGS;
  const leg = (top: number, fall: 1 | -1) => (_x: number, z: number) => top - (fall > 0 ? LEG_NORTH - z : z - LEG_SOUTH) * DOWN;
  const down = (x: number) => x - DOWNHILL;
  const up = hillUp;
  // The terraces: each leg's, level across and falling along it; the hairpins' and the foot's, level.
  relief.area(rect([down(x1), LEG_SOUTH, up(x1), LEG_NORTH]), leg(LANDING_H, 1), SHOULDER_LOOK);
  relief.area(rect([down(x2), LEG_SOUTH, up(x2), LEG_NORTH]), leg(HAIRPIN_A, -1), SHOULDER_LOOK);
  // The last leg's terrace out to the quarry's edge, past its barrier: from there it drops to the quarry floor.
  relief.area(rect([QUARRY_EDGE, LEG_SOUTH, up(x3), LEG_NORTH]), leg(HAIRPIN_B, 1), SHOULDER_LOOK);
  // The hairpins, the foot, and the corner at the top where the road comes off the landing: level, reaching a little past the
  // road's outside, and from there a grassy bank down, or up, to the hillside, not a wall.
  relief.area(rect([down(x2), OUT_A, up(x1), LEG_SOUTH]), HAIRPIN_A, SHOULDER_LOOK);
  relief.area(rect([down(x3), LEG_NORTH, up(x2), OUT_B]), HAIRPIN_B, SHOULDER_LOOK);
  relief.area(rect([QUARRY_EDGE, OUT_A, up(x3), LEG_SOUTH]), QUARRY_H, SHOULDER_LOOK);
  relief.area(rect([down(x1), LEG_NORTH, EAST_EDGE, OUT_B]), LANDING_H, SHOULDER_LOOK);
  const bank = (from: number, to: number, z: number, h: number, side: 'left' | 'right') => relief.slope([[from, z, h], [(from + to) / 2, z, h], [to, z, h]], side, { grade: 1, reach: 40 }, HILL_LOOK);
  bank(up(x1), down(x2), OUT_A, HAIRPIN_A, 'right');
  bank(up(x3), QUARRY_EDGE, OUT_A, QUARRY_H, 'right');
  bank(up(x2), down(x3), OUT_B, HAIRPIN_B, 'left');
  bank(EAST_EDGE, down(x1), OUT_B, LANDING_H, 'left');
  // The road: off the landing, round to the south, down, and back and forth.
  // Each turn rounded a little short of the whole of the straight it comes off, so that no straight is used up entirely by
  // the bends at its ends: where one is, the edges meet in slivers, and the ground there breaks.
  const turn = 9.5;
  const out = 12;
  relief.ribbon(
    [
      { x: EAST_EDGE, z: zOf(65), h: LANDING_H },
      { x: x1, z: zOf(65), h: LANDING_H, round: turn },
      { x: x1, z: LEG_NORTH, h: LANDING_H },
      { x: x1, z: LEG_SOUTH, h: HAIRPIN_A },
      { x: x1, z: LEG_SOUTH - out, h: HAIRPIN_A, round: turn },
      { x: x2, z: LEG_SOUTH - out, h: HAIRPIN_A, round: turn },
      { x: x2, z: LEG_SOUTH, h: HAIRPIN_A },
      { x: x2, z: LEG_NORTH, h: HAIRPIN_B },
      { x: x2, z: LEG_NORTH + out, h: HAIRPIN_B, round: turn },
      { x: x3, z: LEG_NORTH + out, h: HAIRPIN_B, round: turn },
      { x: x3, z: LEG_NORTH, h: HAIRPIN_B },
      { x: x3, z: LEG_SOUTH, h: QUARRY_H },
      { x: x3, z: LEG_SOUTH - out, h: QUARRY_H, round: turn },
      { x: QUARRY_EDGE - 14, z: LEG_SOUTH - out, h: QUARRY_H },
    ],
    HILL_ROAD,
    DOWN_ROAD,
  );
  // The quarry floor, and its heaps: each a low cone in rings, so that it is lumpy and can be driven over.
  const [qx0, qz0, qx1, qz1] = QUARRY;
  relief.area(rect([qx0, qz0, qx1, qz1]), QUARRY_H, QUARRY_LOOK);
  for (const [cx, cz, r, h] of HEAPS) {
    const SIDES = 12;
    const ring = (k: number, f: number): [number, number] => [cx + Math.cos((k / SIDES) * Math.PI * 2) * r * f, cz + Math.sin((k / SIDES) * Math.PI * 2) * r * f];
    const height = (x: number, z: number) => {
      const d = Math.hypot(x - cx, z - cz) / r;
      return QUARRY_H + (d < 0.01 ? h : d < 0.51 ? h * 0.75 : 0);
    };
    for (let k = 0; k < SIDES; k++) {
      relief.area([[cx, cz], ring(k, 0.5), ring(k + 1, 0.5)], height, HEAP_LOOK);
      relief.area([ring(k, 0.5), ring(k, 1), ring(k + 1, 1), ring(k + 1, 0.5)], height, HEAP_LOOK);
    }
  }
}

/**
 * Level 2's load, easier to keep than level 1's: the road is the hard part. A washing machine standing against the cab with
 * two sacks of rice beside it; a row of crates; a row of soda crates, the only thing that minds a shaking, held between
 * crates fore and aft; another row of crates with two small ones on top; and sacks of rice, two deep, against the tailgate.
 */
function hillLoad(): CargoPlacement[] {
  const cargo: CargoPlacement[] = [];
  const floor = TRUCK.frame.pos[1] + TRUCK.frame.half[1];
  const gap = 0.01;
  const on = (half: number) => floor + half + gap;
  const columns = [-0.74, 0, 0.74];
  cargo.push({ type: 'washer', pos: [-0.62, on(0.66), 1.42], rotY: Math.PI });
  // Sacks turned along the truck, two high, beside it.
  for (let k = 0; k < 2; k++) cargo.push({ type: 'sack', pos: [0.55, on(0.14) + k * 0.29, 1.5], rotY: Math.PI / 2 });
  for (const x of columns) cargo.push({ type: 'crate', pos: [x, on(0.35), 0.58] });
  for (const x of [-0.66, -0.22, 0.22, 0.66]) cargo.push({ type: 'soda', pos: [x, on(0.19), -0.22] });
  for (const x of columns) cargo.push({ type: 'crate', pos: [x, on(0.35), -1.06] });
  for (const x of [-0.4, 0.4]) cargo.push({ type: 'smallCrate', pos: [x, floor + 0.7 + 0.25 + gap * 3, -1.06] });
  for (let k = 0; k < 2; k++) for (const x of [-0.4, 0.4]) cargo.push({ type: 'sack', pos: [x, on(0.14) + k * 0.29, -2.4] });
  return cargo;
}

function laySetPieces(relief: Relief) {
  const rect = ([x0, z0, x1, z1]: Rect): [number, number][] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  relief.area(rect(TOP_LANDING), TOP, PAVED);
  relief.area(rect(LANDING), MID, PAVED);
  relief.area(rect(CORNER), MID, PAVED);
  for (const r of [COURTYARD, PATH]) relief.area(rect(r), FOOT, COURT_LOOK);
  relief.area(rect(FOOT_SQUARE), FOOT, PAVED);
  relief.area(rect(SCHOOL), ROAD_LEVEL, PAVED);
  layHillRoad(relief, rect);
  const flights = FLIGHTS.map((f) => relief.ribbon([{ x: f.a[0], z: f.a[1], h: f.top }, { x: f.b[0], z: f.b[1], h: f.foot }], STAIR_WIDE, STEPS, { tread: 2, verge: { width: 1.25, look: PAVED } }));
  return { flights };
}

/** Pots set out in turn, each beside one unlike it. */
const POTS: ObjectKindId[] = ['flowerPotBloom', 'flowerPotTall', 'flowerPotYellow', 'flowerPot', 'flowerPotLow'];

export function uptown(): LevelDef {
  // Level 1's city, less its last two rows, which this map draws again with the way out of the bay through them.
  const old = city();
  const kept = (z: number) => z < zOf(ROW0) - 8;
  const cityPart: LevelDef = {
    ...old,
    props: old.props.filter((p) => kept(p.pos[2] + (p.shape === 'box' ? p.size[2] : p.size[0]) - 0.01)),
    objects: old.objects?.filter((o) => kept(o.pos[2])),
    decals: old.decals.filter((d) => kept(d.pos[1]) && d.color !== 0x3fbf6a),
  };
  // The new map, built as level 1 is.
  const route: Vec2[] = [[12, 45], [12, 59], [16, 58.9], [17, 58], [17, 56], [19, 55], [20, 53.5], [21, 52], [21, 51], [31, 51], [31, 66]];
  const town = buildTown(MAP2, route.map(([c, r]): Vec2 => [c, r - ROW0]), ROW0);
  // The edges of the new part: a wall along each side and across the top.
  const north = zOf(73) + 8;
  const south = zOf(ROW0) - 8;
  const edges: PropDesc[] = [
    { shape: 'box', size: [1, 1, (north - south) / 2], pos: [xOf(0) + 9, 1, (north + south) / 2], color: 0x70757c },
    { shape: 'box', size: [1, 1, (zOf(65) - 8 - south) / 2], pos: [xOf(35) - 9, 1, (zOf(65) - 8 + south) / 2], color: 0x70757c },
    { shape: 'box', size: [1, 1, (north - zOf(65) - 8) / 2], pos: [xOf(35) - 9, 1, (north + zOf(65) + 8) / 2], color: 0x70757c },
    { shape: 'box', size: [xOf(0) + 10, 1, 1], pos: [0, 1, north + 1], color: 0x70757c },
  ];
  const flat: LevelDef = {
    ...cityPart,
    props: [...cityPart.props, ...town.props, ...edges],
    // No street trees up the coil avenue: the coils would only fell them.
    objects: [...(cityPart.objects ?? []), ...town.objects.filter((o) => !(o.kind.startsWith('tree') && Math.abs(o.pos[0] - xOf(31)) < 14 && o.pos[2] > zOf(51) + 8))],
    decals: [...cityPart.decals, ...town.decals],
    crowds: [...(cityPart.crowds ?? []), ...town.crowds],
    // The squares' fountains, lifted with the rest; level 1's own are kept where they were.
    fountains: [...(cityPart.fountains ?? []).filter(([, , z]) => z < zOf(ROW0) - 8), ...town.fountains],
    bounds: [[QUARRY[0] - 8, -8], [xOf(0) + 8, north]],
  };

  const heights = cityHeights(CELL, (x, z) => (z > south ? land(x, z) : null));
  const lifted = lift(flat, heights, CITY_LOOKS, { add: (relief) => void laySetPieces(relief) });
  const { terrain } = lifted;
  const ground = (x: number, z: number) => heightAt(terrain, x, z);
  const props: PropDesc[] = [];
  const objects: ObjectDesc[] = [];
  const decals: DecalDesc[] = [];
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0) => objects.push({ kind, pos: [x, ground(x, z), z], rotY });

  const SCOOTERS: ObjectKindId[] = ['scooterRed', 'scooterWhite', 'scooterBlue', 'scooterBlack', 'scooterYellow', 'scooterTeal'];
  // The steps: iron handrail down each side of each flight and down its middle, in lengths that a truck can knock flat; a yellow strip on every step's edge; pots on the verges; things left
  // on the treads; the signs at the top and the foot.
  const [one, two] = FLIGHTS;
  for (const f of FLIGHTS) {
    const length = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    const ux = (f.b[0] - f.a[0]) / length, uz = (f.b[1] - f.a[1]) / length;
    const along = (d: number, across: number): Vec2 => [f.a[0] + ux * d - uz * across, f.a[1] + uz * d + ux * across];
    const yaw = Math.atan2(ux, uz);
    for (let d = 3; d < length - 1.5; d += 2) for (const across of [-STAIR_WIDE / 2 + 0.25, STAIR_WIDE / 2 - 0.25]) object('handrail', ...along(d, across), yaw);
    for (let d = 1; d < length - 0.5; d += 2) object('handrail', ...along(d, 0), yaw);
    for (let d = 2; d <= length + 0.01; d += 2) decals.push({ pos: along(d - 0.12, 0), size: [STAIR_WIDE, 0.2], rotY: yaw, color: 0xe0b020, base: ground(...along(d - 0.3, 0)) });
    let pot = FLIGHTS.indexOf(f) * 3;
    for (let d = 1; d < length; d += 4) for (const across of [-STAIR_WIDE / 2 - 0.9, STAIR_WIDE / 2 + 0.9]) object(POTS[pot++ % POTS.length], ...along(d, across));
    // Something left on a tread, one side of the handrail or the other.
    object(f === one ? 'box' : 'flowerPotBloom', ...along(7, 1.8), yaw);
    object(f === one ? 'chair' : 'box', ...along(19, -1.7), yaw);
    for (const across of [-1, 1]) {
      object('signWalk', ...along(-3, across * (STAIR_WIDE / 2 + 0.9)), yaw + Math.PI);
      object('signWalk', ...along(length + 3, across * (STAIR_WIDE / 2 + 0.9)), yaw);
    }
  }

  // The landing: the way on is to the right, down the second flight; straight on, only a guard rail, which gives, and the drop
  // to the courtyard. Round its edges, out of the way of the turn: a fish stall and pots along the far side, scooters by the
  // houses on the near side, a table and stools in the corner by the guard rail.
  const [lx0, lz0, lx1, lz1] = LANDING;
  for (let z = lz0 + 1; z < lz1; z += 2) object('handrail', lx0 + 0.4, z, 0);
  object(POTS[2], lx1 - 1.5, lz1 - 0.8);
  object(POTS[3], lx0 + 1.5, lz1 - 0.8);
  // In the inside corner, against the houses: scooters in a row, a kiosk.
  const [kx0, kz0, kx1] = CORNER;
  [kx1 - 2, kx1 - 3.4, kx1 - 4.8].forEach((x, k) => object(SCOOTERS[k], x, kz0 + 1.2, 0));
  object('betelBooth', kx1 - 3, kz0 + 2.5, 0);
  for (let z = kz0 + 1; z < CORNER[3]; z += 2) object('handrail', kx0 + 0.4, z, 0);

  // Paving over the set pieces' ground, as level 1's squares are paved: grey stone on the landings, brick in the courtyard,
  // on the path and in the square at the foot.
  for (const [[x0, z0, x1, z1], h, color] of [[[xOf(16) - 8, zOf(57) - 8, xOf(16) + 8, zOf(58) + 8], FOOT, 0xb58d78], [TOP_LANDING, TOP, 0xa8a59c], [LANDING, MID, 0xa8a59c], [CORNER, MID, 0xa8a59c], [COURTYARD, FOOT, 0xb58d78], [PATH, FOOT, 0xb58d78], [FOOT_SQUARE, FOOT, 0xb58d78]] as const) {
    props.push({ shape: 'box', size: [(x1 - x0) / 2, 0.02, (z1 - z0) / 2], pos: [(x0 + x1) / 2, h + 0.02, (z0 + z1) / 2], color, paving: true, ghost: true });
  }

  // 3. The courtyard below the landing, a temple square. On its north side the temple of the earth god, facing south: its
  // ridge with swept-up ends, its incense urn and two tables of offerings before it, banners either side, the furnace for
  // paper money beside it, a string of firecrackers. In the middle of the square's south half, straight on from the landing's
  // edge, a great banyan: a stone ring round its foot to sit on, old men at chess under it. On the east side a feast laid
  // out, round tables and stools; along the south edge a flower stall and a fish stall. Where a truck coming over the
  // landing's edge lands, nothing: the next thing is the banyan.
  const [cx0, cz0, cx1, cz1] = COURTYARD;
  const mid = (cx0 + cx1) / 2;
  const [tx, tz] = [mid, cz1 - 6];
  const RED = 0xb8352b, TILE = 0xd8742a, RIDGE = 0x2f7a4f, GOLD = 0xd9a62e, STONE = 0xa8a59c, WOOD = 0x6e2a22;
  const T = (x: number, y: number, z: number): [number, number, number] => [tx + x, FOOT + y, tz + z];
  const box = (size: [number, number, number], pos: [number, number, number], color: number, rot?: [number, number, number], ghost = false) => props.push({ shape: 'box', size, pos, color, rot, ghost });
  const post = (r: number, h: number, pos: [number, number, number], color: number) => props.push({ shape: 'cylinder', size: [r, h, r], pos, color });
  // A plinth of stone, two steps up, the full width of the temple and out in front of it.
  box([15, 0.2, 5.5], T(0, 0.2, 0), STONE);
  box([15, 0.2, 0.6], T(0, 0.1, -6), STONE);
  // The main hall in the middle and a lower wing either side: red walls behind a porch of red columns, doors of dark wood and gold.
  box([7, 2.6, 3.4], T(0, 3.0, 1), RED);
  for (const side of [-1, 1]) box([4.2, 2.0, 3.0], T(side * 10.6, 2.4, 1.4), RED);
  for (const x of [-13, -9.5, -6.2, -2.2, 2.2, 6.2, 9.5, 13]) post(0.28, 2.3, T(x, 2.7, -3.2), RED);
  for (const [x, w] of [[0, 1.3], [-3.6, 0.9], [3.6, 0.9], [-10.6, 0.8], [10.6, 0.8]] as const) {
    box([w, 1.6, 0.06], T(x, 2.0, -2.42), WOOD);
    // A pair of leaves, the seam between them, and a ring of gold studs on each.
    box([0.03, 1.5, 0.07], T(x, 2.0, -2.43), 0x2a1a12);
    for (const side of [-1, 1]) for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) box([0.05, 0.05, 0.07], T(x + side * (0.25 + c * 0.3) * (w / 1.1), 1.2 + r * 0.6, -2.44), GOLD);
  }
  // Its name board over the middle door.
  box([2.2, 0.45, 0.08], T(0, 4.6, -2.45), GOLD);
  box([2.0, 0.33, 0.09], T(0, 4.6, -2.46), 0x1f3f6a);
  // Roofs: two tiers over the main hall, one over each wing; deep eaves, green ridges whose ends sweep up like swallows' tails;
  // a pearl and two dragons on the top.
  const roof = (cx: number, y: number, w: number, d: number, lift: number) => {
    box([w, lift, d], T(cx, y, 0.2), TILE);
    box([w - 0.4, 0.18, 0.18], T(cx, y + lift + 0.15, 0.2), RIDGE);
    for (const side of [-1, 1]) {
      box([0.9, 0.12, 0.14], T(cx + side * (w - 0.1), y + lift + 0.55, 0.2), RIDGE, [0, 0, -side * 0.65]);
      box([0.5, 0.08, 0.1], T(cx + side * (w + 0.55), y + lift + 1.05, 0.2), RIDGE, [0, 0, -side * 1.1]);
    }
  };
  roof(0, 5.7, 8.8, 5.2, 0.4);
  roof(0, 7.2, 6.4, 3.8, 0.35);
  for (const side of [-1, 1]) roof(side * 10.6, 4.5, 5.0, 4.6, 0.3);
  post(0.4, 0.35, T(0, 8.35, 0.2), GOLD);
  for (const side of [-1, 1]) box([1.8, 0.24, 0.2], T(side * 2.2, 8.1, 0.2), 0x3f9a6a, [0, 0, side * 0.25]);
  // Red lanterns along the porch eaves.
  for (const x of [-12, -9, -5.5, -2.5, 0, 2.5, 5.5, 9, 12]) props.push({ shape: 'cylinder', size: [0.32, 0.38, 0.32], pos: T(x, 4.4, -3.6), color: 0xe0322a, ghost: true });
  // Stone lions either side of the steps up, on pedestals.
  for (const side of [-1, 1]) {
    box([0.55, 0.45, 0.55], T(side * 4.2, 0.85, -5.3), STONE);
    box([0.4, 0.5, 0.5], T(side * 4.2, 1.8, -5.3), 0x8f8b82);
    box([0.3, 0.3, 0.32], T(side * 4.2, 2.45, -5.55), 0x8f8b82);
  }
  // The great incense urn before the temple, on three legs, in bronze.
  post(1.0, 0.55, T(0, 1.5, -8.2), 0x6b5a32);
  for (let k = 0; k < 3; k++) post(0.12, 0.45, T(Math.cos((k * 2 * Math.PI) / 3) * 0.7, 0.45, -8.2 + Math.sin((k * 2 * Math.PI) / 3) * 0.7), 0x6b5a32);
  post(0.85, 0.06, T(0, 2.1, -8.2), 0x8a7a48);
  // Tables of offerings, set out before the urn; banners either side; firecrackers ready.
  object('offerings', tx - 1.6, tz - 10.6, 0);
  object('offerings', tx + 1.6, tz - 10.6, 0);
  for (const side of [-1, 1]) {
    object('flagOrange', tx + side * 7, tz - 7);
    object('flagPurple', tx + side * 9, tz - 7);
  }
  object('firecrackers', tx + 11, tz - 8);
  const squareCrowds: CrowdDesc[] = [];
  // The great banyan in the middle of the square, the way round going round it: a stone ring round its foot to sit on, benches
  // round that, two tables of chess, and a ring of potted plants marking the way round.
  const banyan: Vec2 = [mid, cz0 + 24];
  props.push({ shape: 'cylinder', size: [3.4, 0.25, 3.4], pos: [banyan[0], FOOT + 0.25, banyan[1]], color: 0xa8a59c });
  props.push({ shape: 'cylinder', size: [1.1, 2.6, 1.1], pos: [banyan[0], FOOT + 2.6, banyan[1]], color: 0x6b5238 });
  for (const [dx, dz, r, y] of [[0, 0, 6.5, 6.8], [2.5, 2, 4.2, 7.8], [-2.8, 1.5, 4, 7.6], [0.5, -2.6, 4.4, 7.4]] as const) {
    props.push({ shape: 'cylinder', size: [r, 1.2, r], pos: [banyan[0] + dx, FOOT + y, banyan[1] + dz], color: 0x3f7a3f, ghost: true });
  }
  for (let k = 0; k < 8; k++) object('bench', banyan[0] + Math.cos((k / 8) * Math.PI * 2) * 4.6, banyan[1] + Math.sin((k / 8) * Math.PI * 2) * 4.6, -(k / 8) * Math.PI * 2 + Math.PI / 2);
  for (let k = 0; k < 14; k++) object(POTS[k % POTS.length], banyan[0] + Math.cos((k / 14) * Math.PI * 2) * 7.2, banyan[1] + Math.sin((k / 14) * Math.PI * 2) * 7.2);
  for (const a of [Math.PI / 4, (5 * Math.PI) / 4]) {
    const [x, z] = [banyan[0] + Math.cos(a) * 6, banyan[1] + Math.sin(a) * 6];
    object('table', x, z);
    object('stool', x - 0.8, z);
    object('stool', x + 0.8, z);
  }

  // The stage, opposite the temple in the middle of the square's south side, facing north for the gods to watch: a raised floor,
  // a back wall painted red, a gold curtain, a roof on four posts, a fringe of lanterns; plastic chairs before it, an audience.
  const [sx, sz] = [mid, cz0 + 4.5];
  const STAGE = 0x8a2e26;
  props.push({ shape: 'box', size: [5.5, 0.6, 3.2], pos: [sx, FOOT + 0.6, sz], color: 0x6e5236 });
  props.push({ shape: 'box', size: [5.5, 2.2, 0.15], pos: [sx, FOOT + 3.4, sz - 3.1], color: STAGE });
  props.push({ shape: 'box', size: [4.6, 1.2, 0.05], pos: [sx, FOOT + 3.2, sz - 2.92], color: 0xd9a62e });
  for (const dx of [-5.2, 5.2]) for (const dz of [-2.9, 2.9]) props.push({ shape: 'cylinder', size: [0.15, 2.4, 0.15], pos: [sx + dx, FOOT + 3.6, sz + dz], color: STAGE });
  props.push({ shape: 'box', size: [6.2, 0.3, 3.8], pos: [sx, FOOT + 6.15, sz], color: 0xd8742a });
  props.push({ shape: 'box', size: [5.6, 0.15, 0.15], pos: [sx, FOOT + 6.6, sz], color: 0x2f7a4f });
  for (let dx = -4.5; dx <= 4.5; dx += 1.5) props.push({ shape: 'cylinder', size: [0.22, 0.28, 0.22], pos: [sx + dx, FOOT + 5.5, sz + 3.2], color: 0xe0322a, ghost: true });
  for (let row = 0; row < 2; row++) for (let k = 0; k < 6; k++) object('chair', sx - 3.75 + k * 1.5, sz + 5.5 + row * 1.6, Math.PI);
  squareCrowds.push({ area: [sx - 4, sz + 5, sx + 4, sz + 8.5], count: 6, y: 0 });
  // The show: two performers in costume, in the light, singing to a speaker at the stage's edge.
  squareCrowds.push({ area: [sx - 2.5, sz - 0.5, sx + 2.5, sz + 0.5], count: 2, y: 0, raised: 1.2, dance: 0, motion: 'perform', clothes: [0xe0322a, 0x5ad2ff], hat: 0xd9a62e });
  const stageMusic = (lifted.objects?.length ?? 0) + objects.length;
  objects.push({ kind: 'radio', pos: [sx + 4.6, FOOT + 1.2, sz + 2.2], rotY: 0 });
  for (const dx of [-4.8, 4.8]) props.push({ shape: 'box', size: [0.25, 0.2, 0.2], pos: [sx + dx, FOOT + 5.6, sz + 2.6], color: 0xfff2a0, ghost: true });
  const keepOut: [number, number, number, number][] = [[sx - 5.8, sz - 3.4, sx + 5.8, sz + 3.4]];

  // Night-market stalls down the square's east side, facing in, along the way out: snacks, fruit, clothes, vegetables, incense.
  const MARKET: ObjectKindId[] = ['stallSnack', 'stallFruit', 'stallClothes', 'stallIncense', 'stallVeg', 'stallSnack'];
  MARKET.forEach((kind, k) => object(kind, cx0 + 2.2, cz0 + 16 + k * 5.5, -Math.PI / 2));
  squareCrowds.push({ area: [cx0 + 4.5, cz0 + 15, cx0 + 7, cz1 - 18], count: 7, y: 0 });

  // Dancing at the north-west corner, where the way round turns: four rows of women in step, facing a radio on a stool. They do not
  // get out of the way.
  const music = (lifted.objects?.length ?? 0) + objects.length;
  object('radio', cx1 - 19, cz1 - 28.5, Math.PI / 2);
  squareCrowds.push({ area: [cx1 - 16, cz1 - 33, cx1 - 7, cz1 - 24], count: 16, y: 0, dance: Math.atan2(-1, 0) });

  // Burning paper in the middle of the way down the east side to the exit: the furnace, big and plainly alight, cartons of gold
  // paper stacked round it, and five people at it, some carrying cartons, some feeding the fire. A carton knocked flies apart in
  // a shower of gold; the furnace knocked over goes up in ash and smoke.
  const [fx, fz] = [xOf(19), cz0 + 11];
  const fire = (lifted.objects?.length ?? 0) + objects.length;
  const smokes: Vec3[] = [];
  object('paperFurnace', fx, fz, 0);
  for (const [dx, dz] of [[2.4, 1.2], [2.9, 0.2], [2.4, -0.8], [-2.4, 1.2], [-2.9, 0.2], [-2.4, -0.8], [3.4, 1.6], [-3.4, 1.6], [0.8, 2.6], [-0.8, 2.6]] as const) object('paperBox', fx + dx, fz + dz, dx * 3);
  squareCrowds.push({ area: [fx - 2, fz + 2.2, fx + 2, fz + 2.8], count: 3, y: 0, dance: Math.PI, motion: 'toss' });
  squareCrowds.push({ area: [fx - 3.5, fz + 4.5, fx + 3.5, fz + 6.5], count: 2, y: 0, dance: Math.PI, motion: 'carry' });

  // A caterer's kitchen set up in the way up the square's west side, under a striped awning: steel stands in a row, each with a
  // great wok on it over a ring of flame, a steamer on one, gas beside each, and a cook in white at each, stirring. The stands do
  // not move. Tables laid for the feast round about.
  const stations: Vec2[] = [0, 5.5, 11].map((dz): Vec2 => [cx1 - 8, cz0 + 13 + dz]);
  for (const [kx, kz] of stations) {
    object('wokStand', kx, kz);
    object('gasCylinder', kx + 1.4, kz);
  }
  squareCrowds.push(...stations.map(([kx, kz]): CrowdDesc => ({ area: [kx - 1.7, kz - 0.2, kx - 1.3, kz + 0.2], count: 1, y: 0, dance: Math.PI / 2, motion: 'cook', clothes: [0xf2efe6], hat: 0xf8f8f8 })));
  for (const [x, z] of [[cx1 - 3.5, cz0 + 15], [cx1 - 3.5, cz0 + 24], [cx1 - 3.5, cz0 + 33]] as const) {
    object('banquetTable', x, z);
    for (let k = 0; k < 6; k++) object('stool', x + Math.cos((k / 6) * Math.PI * 2) * 1.5, z + Math.sin((k / 6) * Math.PI * 2) * 1.5);
  }
  // Awnings: striped canvas on poles, over the kitchen and the tables, and over the night market. The poles can be knocked down.
  for (const dz of [0, 5.5, 11]) object('awningRed', cx1 - 8, cz0 + 13 + dz, Math.PI / 2);
  for (let k = 0; k < 6; k++) object('awningBlue', cx0 + 2.6, cz0 + 16 + k * 5.5, Math.PI / 2);

  // A carpet of firecrackers laid in the way in front of the temple, on red paper: it goes off under the wheels, all along.
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) object('firecrackerMat', mid - 10 + i * 2.5 + (j % 2) * 0.8, cz1 - 20.5 - j * 1.2, Math.PI / 2);
  decals.push({ pos: [mid - 3.3, cz1 - 22.3], size: [16, 5.6], color: 0xd9d4c8, base: FOOT });

  // The god's sedan chair, carried round and round the banyan by its bearers: up one side and down the other, turning round the
  // ends, as scooters do at the end of a street. Knocked, chair and bearers go flying; they get up, lift it, and go on.
  const procession: RiderLane[] = [
    { from: [banyan[0], banyan[1] - 5], to: [banyan[0], banyan[1] + 5], band: [-10.2, -9.8], riders: 1, kind: 'palanquin' },
    { from: [banyan[0], banyan[1] + 5], to: [banyan[0], banyan[1] - 5], band: [-10.2, -9.8], riders: 0, kind: 'palanquin' },
  ];

  // At the top of the avenue a flatbed lorry lies on its side across the road, its load of steel coils spilling out and away
  // down the hill: that is where they come from.
  {
    // Lying on its left side, across the road, its underside to the north (up the hill), its load spilled to the south.
    const [lx, lz] = [xOf(31) - 1, AV_HEAD - 6];
    const y = avenue(lz);
    const box = (size: [number, number, number], pos: [number, number, number], color: number, rot?: [number, number, number]) => props.push({ shape: 'box', size, pos: [lx + pos[0], y + pos[1], lz + pos[2]], color, rot });
    const wheel = (x: number, yy: number, z: number) => {
      props.push({ shape: 'cylinder', size: [0.52, 0.17, 0.52], pos: [lx + x, y + yy, lz + z], rot: [Math.PI / 2, 0, 0], color: 0x1c1d20 });
      props.push({ shape: 'cylinder', size: [0.26, 0.18, 0.26], pos: [lx + x, y + yy, lz + z], rot: [Math.PI / 2, 0, 0], color: 0x9aa0a8 });
    };
    // The cab, on its side: white, its roof to the south, a dark windscreen at its front end, a bumper, a lamp.
    box([1.15, 1.25, 1.35], [-5.0, 1.25, 0.2], 0xe8e2d0);
    box([0.04, 0.85, 0.95], [-6.19, 1.3, -0.05], 0x1b2a3a);
    box([0.12, 1.2, 0.2], [-6.25, 1.25, 1.35], 0x3a3f45);
    box([0.06, 0.18, 0.12], [-6.3, 0.35, 1.0], 0xfff2c0);
    box([0.06, 0.18, 0.12], [-6.3, 2.15, 1.0], 0xfff2c0);
    // The chassis, its two rails along the underside, the fuel tank, the axles.
    box([4.4, 0.12, 0.12], [0.6, 0.55, 1.62], 0x2a2e34);
    box([4.4, 0.12, 0.12], [0.6, 1.95, 1.62], 0x2a2e34);
    box([0.55, 0.3, 0.3], [-3.2, 1.25, 1.45], 0x8c9096);
    for (const x of [-4.8, 1.6, 3.4]) {
      box([0.07, 0.95, 0.07], [x, 1.25, 1.72], 0x2a2e34);
      wheel(x, 2.25, 1.8);
      wheel(x, 0.35, 1.8);
    }
    // The flatbed: its deck standing on edge, blue, with its headboard; the side boards hanging open.
    box([4.6, 1.25, 0.09], [0.7, 1.25, 1.35], 0x2f6fb0);
    box([0.09, 1.25, 0.75], [-3.85, 1.25, 0.65], 0x2f6fb0);
    box([4.4, 0.06, 0.45], [0.8, 0.06, 0.95], 0x23497a, [0.25, 0, 0]);
    // Tracks of its skid down the road, glass, a cone and a warning sign put out.
    for (const dz of [-3, 3]) decals.push({ pos: [lx + 6, lz + 8 + dz * 0.4], size: [0.5, 14], rotY: 0.1, color: 0x2a2a2a, base: avenue(lz + 8) });
    for (const [dx, dz] of [[-1.5, -2.6], [1.2, -3.2], [3.6, -2.3]] as const) objects.push({ kind: 'steelCoil', pos: [lx + dx, y, lz + dz], rotY: dx });
    objects.push({ kind: 'cone', pos: [lx - 7.5, y, lz - 3], rotY: 0 });
    objects.push({ kind: 'cone', pos: [lx + 7.5, y, lz - 3], rotY: 0 });
    objects.push({ kind: 'signWarn', pos: [lx + 8, y, lz - 5], rotY: Math.PI });
    // The engine caught: black smoke pouring up out of the cab, seen from the foot of the avenue.
    smokes.push([lx - 5, y + 2.4, lz + 0.2]);
  }

  // Strings of lanterns from the temple's eaves out to the corners of the square, sagging.
  const LANTERNS = [0xe0322a, 0xf2c12e, 0xe0322a, 0x5ad2ff];
  for (const [ax, az, bx, bz] of [[tx + 8, tz - 4, cx1 - 1, cz0 + 1], [tx - 8, tz - 4, cx0 + 1, cz0 + 1], [tx + 14, tz - 4, cx1 - 1, cz1 - 18], [tx - 14, tz - 4, cx0 + 1, cz1 - 18]] as const) {
    const n = Math.round(Math.hypot(bx - ax, bz - az) / 2.2);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      props.push({ shape: 'cylinder', size: [0.13, 0.16, 0.13], pos: [ax + (bx - ax) * t, FOOT + 6 - Math.sin(Math.PI * t) * 0.9, az + (bz - az) * t], color: LANTERNS[k % LANTERNS.length], ghost: true });
    }
  }

  const [px0, pz0, px1, pz1] = PATH;
  // A scaffold right across the path, put up for work on the gate at its head: six storeys of frames over eight bays, from one
  // side of the path to the other, so that there is no way by but through it. Braces on the lowest two storeys, green net above on the face to the street,
  // a rail round the top, a ladder up inside, the builder's banner; barriers and lamps in front of it, the mixer, bricks and
  // rods behind. Knock any of it with the truck and the lot comes down, forward across the path.
  {
    const BAY = 1.8;
    const STOREY = 1.7;
    const BAYS = 8;
    const STOREYS = 6;
    const x0 = (px0 + px1) / 2 - (BAYS * BAY) / 2;
    const zc = pz0 + 11;
    const piece = (kind: ObjectKindId, x: number, z: number, k: number) => objects.push({ kind, pos: [x, ground(x, zc) + k * STOREY, z], rotY: Math.PI / 2, lean: [0, 1] });
    // A bay a piece, each with the frame at its east end; the frames closing the west end on their own.
    for (let k = 0; k < STOREYS; k++) {
      const ladderAt = k % 2 ? 2 : 5;
      for (let i = 0; i < BAYS; i++) {
        const ladder = i === ladderAt;
        const kind: ObjectKindId = k < 2 ? (ladder ? 'scaffoldBayBraceLadder' : 'scaffoldBayBrace') : k === STOREYS - 1 ? (ladder ? 'scaffoldBayTopLadder' : 'scaffoldBayTop') : ladder ? 'scaffoldBayNetLadder' : 'scaffoldBayNet';
        piece(kind, x0 + (i + 0.5) * BAY, zc, k);
      }
      piece('scaffoldFrame', x0 + BAYS * BAY, zc, k);
    }
    piece('scaffoldBanner', x0 + (BAYS / 2) * BAY, zc - 0.7, 2);
    for (const dx of [-4.5, -1.5, 1.5, 4.5]) object('barrier', (px0 + px1) / 2 + dx, zc - 3.2);
    for (const dx of [-6.5, 6.5]) object('cone', (px0 + px1) / 2 + dx, zc - 3);
    object('signWarn', (px0 + px1) / 2, zc - 6, Math.PI);
    object('mixer', x0 + 2, zc + 3.5, 0);
    object('wheelbarrow', x0 + 5, zc + 3, 0.4);
    object('bricks', x0 + 9, zc + 3.2);
    object('bricks', x0 + 10.3, zc + 3.2);
    object('rebar', x0 + 13, zc + 3.6, Math.PI / 2);
  }
  object('stallIncense', px0 + 2, pz0 + 20, Math.PI / 2);
  for (let z = pz0 + 4; z < pz1 - 2; z += 6) object(POTS[Math.floor(z / 6) % POTS.length], px1 + 3.4, z);

  // The lane is a market, as level 1's market lane is: stalls out from the pavements into the lane, one side and then the
  // other, with crates of goods beside them, and a little room between for a truck to wind through.
  const STALLS: ObjectKindId[] = ['fruitMelon', 'stallSnack', 'fruitOrange', 'snackCartRed', 'fruitTomato', 'stallVeg', 'fruitMango', 'snackCartYellow', 'fruitGrape', 'stallClothes'];
  const CRATES: ObjectKindId[] = ['crateOrange', 'crateRed', 'crateGreen', 'crateYellow'];
  const marketSquares: [number, number, boolean][] = [[19, 57, true], [19, 56, true], [19, 54, true], [19, 53, true], [20, 52, false]];
  let flip = 1;
  for (const [c, r, alongZ] of marketSquares) {
    for (const along of [-4.5, 3.5]) {
      flip = -flip;
      const out = flip * 2.3;
      const [x, z] = alongZ ? [xOf(c) + out, zOf(r) + along] : [xOf(c) + along, zOf(r) + out];
      object(STALLS[(c * 3 + r + (along > 0 ? 1 : 0)) % STALLS.length], x, z, alongZ ? (flip > 0 ? -Math.PI / 2 : Math.PI / 2) : flip > 0 ? Math.PI : 0);
      const [cx, cz] = alongZ ? [x - flip * 0.2, z + 1.9] : [x + 1.9, z - flip * 0.2];
      object(CRATES[(c * 3 + r) % CRATES.length], cx, cz, along);
    }
  }
  const marketCrowd: CrowdDesc = { area: [xOf(19) - 2.5, zOf(53) - 8, xOf(19) + 2.5, zOf(57) + 8], count: 9, y: 0 };

  // The square at the foot of the steps: the lane's mouth on its south side is shut by a festival float standing across it.
  // Signs say turn round, and that the way is diverted, and point up the path to the temple square.
  const [fx0, fz0, fx1, fz1] = FOOT_SQUARE;
  const signs: SignDesc[] = [
    { kind: 'uturn', pos: [xOf(16), FOOT, fz0 + 1.5], rotY: 0 },
    { kind: 'detour', pos: [xOf(17) + 6, FOOT, fz0 + 1.5], rotY: 0 },
    { kind: 'ahead', pos: [px1 - 1.5, FOOT, pz0 + 2], rotY: Math.PI },
  ];
  for (let x = fx0 + 1; x < fx1 - 18; x += 1.6) object('cone', x, fz0 + 0.6);
  object('lamp', fx0 + 2, fz1 - 2);

  // Traffic. On the bus street, going up, a bus that stops hard at every stop and waits at the first until the truck comes
  // up behind it, and one car; coming down, a steady stream. On the road and the avenue, both ways.
  const busX = xOf(12);
  const STOPS = [zOf(47) + 4, zOf(52), zOf(57) - 2];
  const stopCrowd = lifted.crowds?.length ?? 0;
  // Every lane that begins or ends does so behind a wall at the far end of a dead-end side street: nothing appears or vanishes on
  // a road the truck is on. The bus street: coming down, cars come out of the branch west at row 59, go down to row 52 and off
  // into the branch west there; going up, the bus (from its first stop, at first) to row 52, then on up to row 59 and off into
  // that branch, round behind and back out of the row 52 branch, and up again.
  const GATE = xOf(6) + 8;
  const BEHIND = GATE + 5;
  // The wall across the branch south at column 25, at its far end (a z, not an x).
  const ROAD_GATE = zOf(48) - 8;
  // The float, parked: a vehicle that stands until it is hit, and then is as heavy to shift as any.
  // Across the lane, not along it: nothing gets past at either end.
  const vanLane: TrafficLane = { from: [VAN[0] + 0.25, VAN[1]], to: [VAN[0] - 0.25, VAN[1]], cars: 1, speed: 0, kinds: ['van'] };
  const floatLane: TrafficLane = { from: [xOf(18) + 4, zOf(55) + 0.25], to: [xOf(18) + 4, zOf(55) - 0.25], cars: 1, speed: 0, kinds: ['float'] };
  const traffic: TrafficLane[] = [
    // 0, 1: the road along row 51, east and west (west into its gate, east out of it).
    // Each meets the avenue's lane it turns into, or out of, where the two cross: a car turns there and does not jump.
    // 0: out of the branch south at column 25, from behind the wall at its end, to the road; 1: the road west, to the branch.
    { from: [xOf(25) - 2.25, ROAD_GATE - 5], to: [xOf(25) - 2.25, zOf(51) - 2.25], cars: 1, scatter: true, speed: 7 },
    { from: [xOf(31) + 1.75, zOf(51) + 2.25], to: [xOf(25) + 2.25, zOf(51) + 2.25], cars: 2, scatter: true, speed: 9 },
    // 2: the bus at its first stop, up to row 52; 3: on up to row 59; 4: off west into the branch; 5: out of the row 52 branch.
    { from: [busX - 2.25, STOPS[0]], to: [busX - 2.25, zOf(52) - 2.25], cars: 2, speed: 8, kinds: ['bus', 'car'], waitFor: 28, stops: [{ at: 0, seconds: 4.5, crowd: stopCrowd }], next: 3 },
    { from: [busX - 2.25, zOf(52) - 2.25], to: [busX - 2.25, zOf(59) + 2.25], cars: 2, scatter: true, speed: 8, stops: [{ at: STOPS[1] - zOf(52) + 2.25, seconds: 4.5, crowd: stopCrowd + 1 }, { at: STOPS[2] - zOf(52) + 2.25, seconds: 4.5, crowd: stopCrowd + 2 }], next: 4 },
    { from: [busX - 2.25, zOf(59) + 2.25], to: [BEHIND, zOf(59) + 2.25], cars: 0, speed: 8, next: 5 },
    { from: [BEHIND, zOf(52) - 2.25], to: [busX - 2.25, zOf(52) - 2.25], cars: 0, speed: 8, next: 3 },
    // 6: coming down: out of the row 59 branch; 7: down the bus street; 8: off into the row 52 branch, round to 6.
    { from: [BEHIND, zOf(59) - 2.25], to: [busX + 2.25, zOf(59) - 2.25], cars: 2, scatter: true, speed: 8, next: 7 },
    { from: [busX + 2.25, zOf(59) - 2.25], to: [busX + 2.25, zOf(48) + 2.25], cars: 7, scatter: true, speed: 9, next: 8 },
    { from: [busX + 2.25, zOf(48) + 2.25], to: [BEHIND, zOf(48) + 2.25], cars: 1, speed: 8, next: 6 },
  ];
  // 9: out of the side street east at row 56, west to the bus street, and up it in the bus's own lane, ahead of where the bus
  // will be: overtaking the bus is not the end of it.
  const EAST_GATE = xOf(15) - 8;
  // 10: out of the row 48 branch, turning up the bus street behind the bus.
  traffic.push({ from: [BEHIND, zOf(48) - 2.25], to: [busX - 2.25, zOf(48) - 2.25], cars: 1, scatter: true, speed: 7, next: 2, nextAt: zOf(48) - 2.25 - STOPS[0] });
  traffic.push({ from: [EAST_GATE - 5, zOf(56) + 2.25], to: [busX - 2.25, zOf(56) + 2.25], cars: 2, scatter: true, speed: 6, next: 3, nextAt: zOf(56) + 2.25 - (zOf(52) - 2.25) });
  // The gates: a wall across each dead end, with a dark way through it that only the traffic uses.
  const AV_GATE = xOf(35) + 8;
  {
    const h = ground(xOf(25), ROAD_GATE + 1);
    props.push({ shape: 'box', size: [6, 3, 0.5], pos: [xOf(25), h + 3, ROAD_GATE - 0.5], color: 0x8c867b });
    props.push({ shape: 'box', size: [4.4, 1.4, 0.52], pos: [xOf(25), h + 1.4, ROAD_GATE - 0.5], color: 0x23272d, ghost: true });
  }
  for (const [x, z, side] of [[GATE, zOf(59), 1], [GATE, zOf(52), 1], [GATE, zOf(48), 1], [EAST_GATE, zOf(56), -1], [AV_GATE, zOf(63), -1], [AV_GATE, zOf(57), -1]] as const) {
    const h = ground(x - side, z);
    props.push({ shape: 'box', size: [0.5, 3, 6], pos: [x + side * 0.5, h + 3, z], color: 0x8c867b });
    props.push({ shape: 'box', size: [0.52, 1.4, 4.4], pos: [x + side * 0.5, h + 1.4, z], color: 0x23272d, ghost: true });
  }
  // The avenue's traffic turns in from the side street to the east half way up, and out into it: none of it comes or goes
  // anywhere near the landing. Coming down, from the side street, down the avenue, and (one lane) along the road; going up,
  // from the road, up the avenue, and off into the side street. Each runs on into the next; links are by place in this list,
  // and are made the level's at the end.
  const SIDE = zOf(63);
  const EAST = xOf(35) + 3;
  const [ROAD_EAST, ROAD_WEST] = [0, 1];
  const firstDown: number[] = [];
  [1.75, 5.25].forEach((dx, k) => {
    const z = SIDE + 1.75 + k * 3.5;
    const street = traffic.length;
    firstDown.push(street);
    traffic.push({ from: [EAST, z], to: [xOf(31) + dx, z], cars: 1, scatter: true, speed: 8, next: street + 1 });
    traffic.push({ from: [xOf(31) + dx, z], to: [xOf(31) + dx, zOf(51) + 2.25], cars: 3, scatter: true, speed: 10, next: ROAD_WEST });
  });
  const firstUp: number[] = [];
  [-1.75, -5.25].forEach((dx, k) => {
    const z = SIDE - 1.75 - k * 3.5;
    const avenueLane = traffic.length;
    firstUp.push(avenueLane);
    traffic.push({ from: [xOf(31) + dx, zOf(51) - 2.25], to: [xOf(31) + dx, z], cars: 2, scatter: true, speed: 8, next: avenueLane + 1 });
    traffic.push({ from: [xOf(31) + dx, z], to: [EAST, z], cars: 1, speed: 8, next: ROAD_EAST });
  });
  // The outer lane coming down turns across the inner one into the road, by a short stretch of its own.
  traffic[firstDown[1] + 1].next = traffic.length;
  traffic.push({ from: [xOf(31) + 5.25, zOf(51) + 2.25], to: [xOf(31) + 1.75, zOf(51) + 2.25], cars: 0, speed: 6, next: ROAD_WEST });
  // The road east, from the branch to the avenue; and from the road into the branch, to the wall.
  const roadEast = traffic.length;
  // Out toward the centre line round the removals van at the kerb (VAN), and back in.
  const IN = zOf(51) - 2.25;
  const OUT = zOf(51) - 0.85;
  const easts: [Vec2, Vec2][] = [
    [[xOf(25) - 2.25, IN], [VAN[0] + 14, IN]],
    [[VAN[0] + 14, IN], [VAN[0] + 7, OUT]],
    [[VAN[0] + 7, OUT], [VAN[0] - 7, OUT]],
    [[VAN[0] - 7, OUT], [VAN[0] - 13, IN]],
    [[VAN[0] - 13, IN], [xOf(31) - 1.75, IN]],
  ];
  easts.forEach(([from, to], k) => traffic.push({ from, to, cars: k === 0 ? 2 : 0, scatter: k === 0, speed: k === 0 || k === 4 ? 9 : 6, next: k < 4 ? traffic.length + 1 : firstUp[0] }));
  const roadEastEnd = traffic.length - 1;
  const intoBranch = traffic.length;
  traffic.push({ from: [xOf(25) + 2.25, zOf(51) + 2.25], to: [xOf(25) + 2.25, ROAD_GATE - 5], cars: 0, speed: 7, next: firstDown[0], also: firstDown[1] });
  // Every other car from the road keeps on across the inner lane going up, into the outer one: both lanes stay full.
  traffic[roadEastEnd].also = traffic.length;
  traffic.push({ from: [xOf(31) - 1.75, zOf(51) - 2.25], to: [xOf(31) - 5.25, zOf(51) - 2.25], cars: 0, speed: 6, next: firstUp[1] });
  // Out of the branch east at row 57, from behind the wall at its end, turning up the avenue: every other car into the outer
  // lane, the rest across it into the inner. The outer lane's cars come back round to it through the side street at row 63.
  const MID_IN = zOf(57) + 1.75;
  const midBranch = traffic.length;
  traffic.push({ from: [EAST, MID_IN], to: [xOf(31) - 5.25, MID_IN], cars: 1, scatter: true, speed: 7, next: firstUp[1], nextAt: MID_IN - (zOf(51) - 2.25), also: midBranch + 1 });
  traffic.push({ from: [xOf(31) - 5.25, MID_IN], to: [xOf(31) - 1.75, MID_IN], cars: 0, speed: 6, next: firstUp[0], nextAt: MID_IN - (zOf(51) - 2.25) });
  traffic[firstUp[1] + 1].next = midBranch;
  traffic[ROAD_EAST].next = roadEast;
  traffic[ROAD_WEST].next = intoBranch;
  const at = lifted.traffic.length;
  // A car knocked out of the traffic comes back from behind the wall its stream comes from: those going up the bus street from
  // the row 52 branch, those coming down it from the row 59 one; the avenue's going up from the road's gate, coming down from the
  // side street's.
  traffic.forEach((lane, k) => {
    if (k <= 1 || k >= 11) lane.respawn = k === 0 || (k >= 11 && (lane.to[1] > lane.from[1] + 1 || lane.to[0] < lane.from[0] - 1)) ? 0 : firstDown[0];
    else if (k >= 2 && k <= 5) lane.respawn = 5;
    else if (k >= 6 && k <= 8) lane.respawn = 6;
    else lane.respawn = k;
  });
  // Those going up the avenue come back out of the branch half way up, not at its foot where the coils end up.
  for (const k of [firstUp[0], firstUp[0] + 1, firstUp[1], firstUp[1] + 1, midBranch, midBranch + 1]) traffic[k].respawn = midBranch;
  for (const lane of traffic) if (lane.respawn !== undefined) lane.respawn += at;
  for (const lane of traffic) if (lane.next !== undefined) lane.next += at;
  for (const lane of traffic) if (lane.also !== undefined) lane.also += at;
  for (const z of STOPS) object('busStop', busX - 6.2, z + 4, Math.PI / 2);

  // People: waiting at each bus stop (the first of the new crowds, in the order of the stops), on the steps and the landings,
  // in the courtyard, at the foot.
  const patch = (x0: number, z0: number, x1: number, z1: number, count: number): CrowdDesc => ({ area: [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)], count, y: 0 });
  const crowds: CrowdDesc[] = [
    ...STOPS.map((z) => patch(busX - 7.6, z + 1, busX - 5.6, z + 8, 4)),
    patch(one.a[0], one.a[1] - 3, one.b[0], one.b[1] + 3, 5),
    patch(two.a[0] - 3, two.a[1], two.b[0] + 3, two.b[1], 4),
    patch(lx0 + 2, lz0 + 2, lx1 - 2, lz1 - 2, 3),
    patch(cx0 + 2, cz0 + 2, cx1 - 2, cz1 - 2, 6),
    patch(fx0 + 2, fz0 + 2, fx1 - 2, fz1 - 2, 4),
  ];

  // Scooters, ridden: up and down the bus street, along the road, up the lower avenue; each turning round at the end of its run
  // rather than vanishing.
  const riders: RiderLane[] = [];
  const pair = (a: Vec2, b: Vec2, count: number) => {
    const first = (lifted.riders?.length ?? 0) + riders.length;
    // Kept to their own side, but over the centre line, or along the kerb, to get by a bus at a stop or a queue of cars.
    riders.push({ from: a, to: b, band: [-3.6, -0.6], reach: [-4.1, 1.4], riders: count, turnInto: first + 1 });
    riders.push({ from: b, to: a, band: [-3.6, -0.6], reach: [-4.1, 1.4], riders: count, turnInto: first });
  };
  pair([busX, zOf(46)], [busX, zOf(59) - 6], 7);

  // The start, as on level 1: a barrier with its arms raised across the way out of the bay, and the line the clock starts at.
  {
    const y = ground(xOf(12), START_GATE);
    for (const dx of [-7.2, 0, 7.2]) object('post', xOf(12) + dx, START_GATE);
    for (const dx of [-3.6, 3.6]) objects.push({ kind: 'gateArm', pos: [xOf(12) + dx, y + 1.0, START_GATE], rotY: 0 });
    decals.push({ pos: [xOf(12), START_GATE], size: [CELL - 1, 0.6], color: 0xf4f4f0, base: y });
  }

  // The road from the lane to the avenue (row 51), in three: the school, the burst main, the removals.
  const ROAD = zOf(51);
  const SOUTH_KERB = ROAD - 4.5;
  const NORTH_KERB = ROAD + 4.5;
  const level = ground(xOf(23), ROAD);

  // The school: its yard south of the road, the classrooms along its back, a wall and a gate on the road. It is going home time:
  // the road in front is a slalom, parents' cars stopped in one lane and then the other with their doors open and parents by
  // them, children going over the crossing in a crowd every so often and darting out between the cars on their own; scooters
  // parked all along both kerbs; a cart or two selling to them. Nothing else uses this stretch: no traffic comes along it.
  const standing: TrafficLane[] = [];
  {
    const [sx0, sz0, sx1, sz1] = SCHOOL;
    const gate = xOf(23);
    const mid = (sx0 + sx1) / 2;
    const CREAM = 0xece3cf;
    const BRICK = 0xb5533c;
    const WHITE = 0xf4f2ec;
    const GLASS = 0x2a3a4a;
    const front = sz0 + 10;
    const box = (half: Vec3, pos: Vec3, color: number, ghost = true) => props.push({ shape: 'box', size: half, pos, color, ghost });
    // Classrooms, three storeys, along the back of the yard: the block, and along its front the open corridor of every Taiwanese
    // school, its floor slabs and white balustrades on red-tiled columns; in the wall behind, each room's door and two windows.
    props.push({ shape: 'box', size: [22, 6, 4], pos: [mid, level + 6, sz0 + 6], color: CREAM, mapColor: 0xd9cdb5 });
    const ROOMS = 7;
    for (let f = 0; f < 3; f++) {
      const y = level + f * 4;
      if (f > 0) {
        box([22, 0.12, 1.1], [mid, y, front + 1.1], 0xd8d2c4);
        box([22, 0.5, 0.06], [mid, y + 0.62, front + 2.15], WHITE);
        box([22, 0.06, 0.1], [mid, y + 1.14, front + 2.15], BRICK);
      }
      for (let r = 0; r < ROOMS; r++) {
        const cx = sx0 + 5 + (r + 0.5) * ((sx1 - sx0 - 10) / ROOMS);
        box([0.45, 1.05, 0.04], [cx - 2.1, y + 1.1, front + 0.04], 0x3f6b5a);
        for (const dx of [-0.6, 1.5]) box([0.85, 0.75, 0.04], [cx + dx, y + 2, front + 0.04], GLASS);
        box([0.6, 0.12, 0.05], [cx - 2.1, y + 2.5, front + 0.05], WHITE);
      }
    }
    for (let k = 0; k <= ROOMS; k++) box([0.28, 6, 0.28], [sx0 + 5 + k * ((sx1 - sx0 - 10) / ROOMS), level + 6, front + 2.0], BRICK, false);
    box([22.4, 0.35, 5.2], [mid, level + 12.2, sz0 + 7.1], BRICK);
    // The tower in the middle, over the stairs: taller, with the clock and the name.
    box([3.2, 8, 4.2], [mid, level + 8, sz0 + 6.5], CREAM, false);
    box([3.4, 0.3, 4.4], [mid, level + 16.1, sz0 + 6.5], BRICK);
    for (let f = 0; f < 4; f++) box([0.5, 1.2, 0.05], [mid, level + 2.5 + f * 3.6, front + 0.75], GLASS);
    props.push({ shape: 'cylinder', size: [1.1, 0.05, 0], pos: [mid, level + 14.2, front + 0.78], rot: [Math.PI / 2, 0, 0], color: WHITE, ghost: true });
    box([0.05, 0.7, 0.03], [mid, level + 14.45, front + 0.85], 0x1c1d20);
    box([0.5, 0.05, 0.03], [mid + 0.25, level + 14.2, front + 0.85], 0x1c1d20);
    signs.push({ pos: [mid, level + 12.9, front + 0.9], rotY: 0, kind: 'schoolName' });
    // The yard: the running track and the grass inside it, each a little above the last so that they do not flicker; the
    // flag; the platform the head speaks from; basketball hoops; a slide; trees along the wall.
    const yard = (sz1 + front + 2.4) / 2;
    box([15, 0.02, 6.4], [mid - 4, level + 0.03, yard], 0xb5533c);
    box([11, 0.02, 3.6], [mid - 4, level + 0.06, yard], 0x4f8a4a);
    for (const dz of [-5.2, -4.2, 4.2, 5.2]) box([15, 0.005, 0.04], [mid - 4, level + 0.055, yard + dz], WHITE);
    props.push({ shape: 'cylinder', size: [0.08, 5, 0], pos: [mid + 7, level + 5, front + 4.2], color: 0xd9d9d9 });
    box([0.7, 0.45, 0.02], [mid + 7.72, level + 9.4, front + 4.2], 0xd0302a);
    box([2.4, 0.6, 1.3], [mid - 4, level + 0.6, front + 4.2], 0xd8d2c4, false);
    box([2.6, 0.08, 1.5], [mid - 4, level + 3.6, front + 4.2], BRICK);
    for (const dx of [-2.2, 2.2]) box([0.1, 1.5, 0.1], [mid - 4 + dx, level + 2.1, front + 3.1], WHITE);
    for (const z of [front + 4, sz1 - 2.5]) {
      const x = sx1 - 4;
      props.push({ shape: 'cylinder', size: [0.07, 1.6, 0], pos: [x, level + 1.6, z], color: 0x3a3f45 });
      box([0.6, 0.45, 0.04], [x, level + 3.2, z + (z < yard ? 0.4 : -0.4)], WHITE);
    }
    box([0.3, 0.8, 0.3], [sx0 + 2.5, level + 0.8, front + 5], 0xf2c12e, false);
    box([0.3, 0.05, 1.6], [sx0 + 2.5, level + 0.9, front + 6.4], 0xe0322a, false);
    for (let x = sx0 + 3; x < sx1 - 2; x += 7) {
      props.push({ shape: 'cylinder', size: [0.15, 1.4, 0], pos: [x, level + 1.4, sz1 - 1.3], color: 0x6b4a32 });
      props.push({ shape: 'cylinder', size: [1.6, 1.1, 0], pos: [x, level + 3.6, sz1 - 1.3], color: 0x3f7a3f, ghost: true });
    }
    // The wall along the road, broken for the gate, railings on top; the gate's pillars, its arch and its name.
    for (const [a, b] of [[sx0 + 0.5, gate - 3.2], [gate + 3.2, sx1 - 0.5]] as const) {
      props.push({ shape: 'box', size: [(b - a) / 2, 0.6, 0.2], pos: [(a + b) / 2, level + 0.6, sz1 - 0.3], color: 0xd9cdb5 });
      box([(b - a) / 2, 0.05, 0.24], [(a + b) / 2, level + 1.22, sz1 - 0.3], BRICK);
      for (let x = a + 0.4; x < b; x += 0.5) box([0.02, 0.45, 0.02], [x, level + 1.7, sz1 - 0.3], 0x2f6b4a);
      box([(b - a) / 2, 0.03, 0.03], [(a + b) / 2, level + 2.15, sz1 - 0.3], 0x2f6b4a);
    }
    for (const x of [gate - 3.4, gate + 3.4]) props.push({ shape: 'box', size: [0.5, 1.9, 0.5], pos: [x, level + 1.9, sz1 - 0.3], color: BRICK });
    box([3.9, 0.3, 0.45], [gate, level + 3.95, sz1 - 0.3], BRICK);
    signs.push({ pos: [gate, level + 4.9, sz1 - 0.3], rotY: 0, kind: 'schoolName' });
    // The pavement in front.
    props.push({ shape: 'box', size: [(sx1 - sx0) / 2, 0.08, (SOUTH_KERB - sz1) / 2], pos: [mid, level + 0.08, (SOUTH_KERB + sz1) / 2], color: 0xb8b2a6, paving: true });
    // The crossing out of the gate, painted on, over the road's own lines.
    for (let d = -4; d <= 4; d++) box([1.7, 0.01, 0.25], [gate, level + 0.025, ROAD + d], WHITE);
    crowds.push({ area: [gate - 2.2, SOUTH_KERB - 2.8, gate + 2.2, NORTH_KERB + 2.5], count: 18, y: 0, crossing: 'z', waves: 12, size: 0.66, clothes: [0xf4f4f0, 0xf4f4f0, 0x2a4a8a], hat: 0xf2c12e });
    // The crossing warden, by the kerb with her flag; parents waiting across the road.
    crowds.push({ area: [gate + 2.8, SOUTH_KERB - 1.2, gate + 3.2, SOUTH_KERB - 0.8], count: 1, y: 0, clothes: [0xd8f03a], hat: 0xf4f4f0 });
    box([0.25, 0.18, 0.01], [gate + 3.2, level + 1.9, SOUTH_KERB - 0.6], 0xe0322a);
    crowds.push({ area: [gate - 9, NORTH_KERB + 0.6, gate + 9, NORTH_KERB + 2.6], count: 6, y: 0 });
    // Parents' cars stopped in the road, one lane and then the other, a parent beside each; between them, children running over.
    const CARS: [number, 1 | -1, 'car' | 'taxi'][] = [[sx1 - 6, -1, 'car'], [gate + 9, 1, 'taxi'], [gate - 7, -1, 'car'], [gate - 17, 1, 'car'], [sx0 + 4, -1, 'taxi']];
    for (const [x, side, kind] of CARS) {
      const z = ROAD + side * 2.25;
      const way = side < 0 ? -1 : 1;
      standing.push({ from: [x - way * 0.25, z], to: [x + way * 0.25, z], cars: 1, speed: 0, kinds: [kind] });
      crowds.push({ area: [x - 1, z - side * 1.5, x + 1, z - side * 1.2], count: 1, y: 0 });
    }
    for (const x of [gate + 14, gate - 12]) crowds.push({ area: [x - 0.8, SOUTH_KERB - 2, x + 0.8, NORTH_KERB + 2], count: 3, y: 0, crossing: 'z', size: 0.66, clothes: [0xf4f4f0, 0x2a4a8a], hat: 0xf2c12e });
    // Scooters parked along both kerbs, nose to tail, either side of the crossing.
    let n = 0;
    for (let x = sx0 + 4; x < sx1 - 4; x += 2) {
      if (Math.abs(x - gate) < 4) continue;
      for (const z of [SOUTH_KERB + 0.65, NORTH_KERB - 0.65]) if ((n++ * 7) % 5 !== 0) object(SCOOTERS[n % SCOOTERS.length], x, z, Math.PI / 2);
    }
    object('snackCartRed', gate - 8, SOUTH_KERB - 1.6, Math.PI);
    object('snackCartYellow', gate + 9, NORTH_KERB + 1.6, 0);
    signs.push({ pos: [sx1 + 2, ground(sx1 + 2, SOUTH_KERB - 1.6), SOUTH_KERB - 1.6], rotY: Math.PI / 2, kind: 'school' });
    signs.push({ pos: [sx0 - 2, ground(sx0 - 2, NORTH_KERB + 1.6), NORTH_KERB + 1.6], rotY: -Math.PI / 2, kind: 'school' });
  }

  // The burst main, from the school to the removals: manholes spread along both lanes, each in turn throwing up a column of
  // water once the truck is near, and its iron cover with it, straight up and down onto the hole again; puddles round them;
  // the water board's lorry on the pavement, men in vests, barriers.
  const manholes: { cover: number; every: number; phase: number }[] = [];
  {
    // On the crown of the road and either side of it, in turn, closer than a truck is wide: whatever line is taken, one is under it.
    const HOLES: Vec2[] = Array.from({ length: 11 }, (_, k): Vec2 => [xOf(24) - 9 - k * 5.4, ROAD + [0, -2.4, 2.4][k % 3] * (k % 2 ? 1 : -1)]);
    const disc = (x: number, z: number, r: number, color: number, y: number) => props.push({ shape: 'cylinder', size: [r, 0.005, 0], pos: [x, ground(x, z) + y, z], color, ghost: true });
    HOLES.forEach(([x, z], k) => {
      // The dark ring of the hole, and a puddle round it in overlapping rounds.
      disc(x, z, 0.47, 0x1c1d20, 0.012);
      for (const [dx, dz, r] of [[0.9, 0.5, 1.3], [-0.6, -0.7, 1.0], [1.8, -0.4, 0.9]] as const) disc(x + dx * (k % 2 ? -1 : 1), z + dz, r, 0x56626c, 0.008);
      manholes.push({ cover: (lifted.objects?.length ?? 0) + objects.length, every: 7, phase: (k * 2.7) % 7 });
      object('manholeCover', x, z);
    });
    object('farmTruck', xOf(26) - 2, NORTH_KERB + 1.8, Math.PI / 2);
    for (const x of [xOf(26) + 3, xOf(26) + 6]) object('barrier', x, NORTH_KERB + 1.2);
    crowds.push({ area: [xOf(26) - 6, NORTH_KERB + 0.8, xOf(26) + 7, NORTH_KERB + 3], count: 3, y: 0, workers: true });
    signs.push({ pos: [xOf(24) - 4, ground(xOf(24) - 4, SOUTH_KERB - 1.6), SOUTH_KERB - 1.6], rotY: Math.PI / 2, kind: 'works' });
  }

  // The way down the hill: crash barriers along every drop; a convex mirror at each hairpin; a betel-nut stall on the first,
  // its owner's lorry by it; stones come down onto the second, and cones round them.
  const machines: MachineDesc[] = [];
  const spreads: { pos: Vec2; half: Vec2 }[] = [];
  {
    const [x1, x2, x3] = LEGS;
    const rail = (x: number, z: number, yaw: number) => objects.push({ kind: 'guardrail', pos: [x, ground(x, z), z], rotY: yaw });
    for (const x of LEGS) for (let z = LEG_SOUTH + 2; z < LEG_NORTH; z += 4) rail(x - HILL_ROAD / 2 - 0.45, z, 0);
    // Round the outside of each hairpin, on the side where it drops away.
    const bend = (cx: number, cz: number, south: boolean) => {
      for (let k = 0; k < 11; k++) {
        const a = ((k + 0.5) / 11) * Math.PI;
        const x = cx + Math.cos(a) * 13.4;
        const z = cz + (south ? -1 : 1) * Math.sin(a) * 13.4;
        rail(x, z, south ? Math.atan2(-Math.sin(a), -Math.cos(a)) : Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI);
      }
    };
    bend((x1 + x2) / 2, LEG_SOUTH - 2.5, true);
    bend((x2 + x3) / 2, LEG_NORTH + 2.5, false);
    object('mirror', (x1 + x2) / 2 - 5, LEG_SOUTH - 16.2, 0);
    object('mirror', (x2 + x3) / 2 + 5, LEG_NORTH + 16.2, Math.PI);
    object('stallSnack', x1 + 7, LEG_SOUTH - 4, -Math.PI / 2);
    object('fridge', x1 + 8, LEG_SOUTH - 7.5, -Math.PI / 2);
    object('farmTruck', x1 + 7.5, LEG_SOUTH - 13, 0.3);
    object('betelPalm', x1 + 9, LEG_SOUTH - 1);
    object('betelPalm', x1 + 9, LEG_SOUTH + 3);
    // Boulders down off the hillside, big enough to stop a truck dead, and the smaller stuff with them.
    for (const [dx, dz] of [[-3, 2], [2, 3.5], [4.5, 0.5]] as const) object('boulder', (x2 + x3) / 2 + dx, LEG_NORTH + 9 + dz, dx);
    for (const [dx, dz] of [[-1, -1.5], [0.5, 5], [6, 3], [-4.5, 4]] as const) object('rockSmall', (x2 + x3) / 2 + dx, LEG_NORTH + 9 + dz, dx);
    for (const dx of [-6, 6]) object('cone', (x2 + x3) / 2 + dx, LEG_NORTH + 8);

    // A village on the hillside. Old terraced houses, two and three storeys, along the uphill side of each leg, each a few
    // metres long and standing on the highest ground under it, a footing below at its lower end, stepping down the hill
    // with the road; their fronts to it. More along the top of the hill, over each hairpin, looking down on it. On the downhill
    // side, between the road and the barrier, what people leave out: scooters, a lorry or two, water drums, pots, a table and
    // stools, so that the road is narrower than it looks at the places where the edge is nearest.
    const HOUSES = [0xc9a27e, 0xd4c4a8, 0xbf8f6f, 0xd9b99a, 0xb7a58c, 0xc7b29a, 0xe0d2bc, 0xa9b4a0];
    let seed = 0;
    const house = (x0: number, z0: number, x1: number, z1: number, open: [boolean, boolean, boolean, boolean]) => {
      seed++;
      // Just inside its own corners: exactly on one, the ground asked for may be the terrace above.
      const e = 0.2;
      const corners = [ground(x0 + e, z0 + e), ground(x1 - e, z0 + e), ground(x0 + e, z1 - e), ground(x1 - e, z1 - e)];
      const base = Math.max(...corners);
      const foot = Math.min(...corners);
      const height = 6.5 + ((seed * 7) % 4) * 1.4;
      const color = HOUSES[(seed * 5) % HOUSES.length];
      props.push({ shape: 'box', size: [(x1 - x0) / 2, height / 2, (z1 - z0) / 2], pos: [(x0 + x1) / 2, base + height / 2, (z0 + z1) / 2], color, fade: true, mapColor: 0x5f6670, building: { style: 'old', open, crown: 0, seed: 9001 + seed * 131 } });
      if (base - foot > 0.05) {
        const shade = ((((color >> 16) & 255) * 0.78) << 16) | ((((color >> 8) & 255) * 0.78) << 8) | ((color & 255) * 0.78);
        props.push({ shape: 'box', size: [(x1 - x0) / 2, (base - foot) / 2 + 0.05, (z1 - z0) / 2], pos: [(x0 + x1) / 2, (base + foot) / 2, (z0 + z1) / 2], color: shade });
      }
    };
    // Along each leg, uphill side: a row, broken here and there by a gap of a stair or a yard.
    for (const x of LEGS) {
      let z = LEG_SOUTH + 1;
      let k = 0;
      while (z < LEG_NORTH - 4) {
        const long = 5 + ((k * 3 + Math.round(x)) % 3);
        if ((k + Math.round(x / 20)) % 4 !== 3) house(x + HILL_ROAD / 2 + 1.1, z, Math.min(EAST_EDGE, x + UPHILL) - 0.1, Math.min(LEG_NORTH - 1, z + long), [true, false, false, false]);
        z += long + 0.2;
        k++;
      }
    }
    // Along the top of the hill: south of the first hairpin, looking north down on it; north of the second, looking south.
    house(x2 + HILL_ROAD / 2 + 1.1, LEG_NORTH + 0.5, hillUp(x2) - 0.1, LEG_NORTH + 8, [true, false, false, false]);
    house(x2 + HILL_ROAD / 2 + 1.1, LEG_NORTH + 8.2, hillUp(x2) - 0.1, LEG_NORTH + 15, [true, false, false, false]);
    // Trees on the hillside about the road, and down the banks.
    for (let k = 0; k < 40; k++) {
      const x = QUARRY_EDGE + 4 + ((k * 37) % 56);
      const z = (k % 2 ? OUT_B + 4 : OUT_A - 4) + (k % 2 ? 1 : -1) * ((k * 13) % 34);
      const y = ground(x, z);
      props.push({ shape: 'cylinder', size: [0.18, 1.6, 0], pos: [x, y + 1.6, z], color: 0x6b4a32 });
      props.push({ shape: 'cone', size: [1.6 + (k % 3) * 0.4, 1.8, 0], pos: [x, y + 4.2, z], color: k % 3 ? 0x3f7a3f : 0x4f8a4a, ghost: true });
    }
    // In each hairpin, on its inside: a wayside shrine, red, with its roof, an incense pot and offerings.
    for (const [cx, cz, way] of [[(x1 + x2) / 2, LEG_SOUTH - 1, Math.PI], [(x2 + x3) / 2, LEG_NORTH + 1, 0]] as const) {
      const y = ground(cx, cz);
      props.push({ shape: 'box', size: [1.1, 0.9, 0.9], pos: [cx, y + 0.9, cz], color: 0xc8372d });
      props.push({ shape: 'box', size: [1.4, 0.12, 1.2], pos: [cx, y + 1.9, cz], color: 0x2f6b4a, ghost: true });
      props.push({ shape: 'box', size: [1.0, 0.1, 0.9], pos: [cx, y + 2.1, cz], color: 0xd9a62e, ghost: true });
      props.push({ shape: 'box', size: [0.6, 0.5, 0.02], pos: [cx, y + 0.9, cz + (way ? -0.92 : 0.92)], color: 0x2a1a12, ghost: true });
      object('offerings', cx + 1.8, cz + (way ? -1.2 : 1.2), way);
    }
    // The downhill shoulders.
    const LEFT_OUT: ObjectKindId[][] = [
      ['scooterRed', 'scooterWhite', 'scooterBlue'],
      ['barrel', 'barrel', 'gasCylinder'],
      ['flowerPotBloom', 'flowerPot', 'flowerPotTall', 'flowerPotYellow'],
      ['table', 'chair', 'chair'],
    ];
    LEGS.forEach((x, n) => {
      // A lorry pulled half onto the verge, a third of the way down each leg, and things in clusters along the rest.
      object('farmTruck', x - HILL_ROAD / 2 + 0.6, LEG_SOUTH + 20 + n * 9, 0);
      for (let k = 0; k < 5; k++) {
        const z = LEG_SOUTH + 6 + k * 11 + (n % 2) * 4;
        if (Math.abs(z - (LEG_SOUTH + 20 + n * 9)) < 5) continue;
        const group = LEFT_OUT[(k + n) % LEFT_OUT.length];
        // In front of the houses, half in the road.
        group.forEach((kind, j) => object(kind, x + HILL_ROAD / 2 + 0.2 - (j % 2) * 0.7, z + j * 1.2, kind.startsWith('scooter') ? 0 : j));
      }
      crowds.push({ area: [x + HILL_ROAD / 2 + 0.2, LEG_SOUTH + 8, x + HILL_ROAD / 2 + 0.9, LEG_NORTH - 8], count: 3, y: 0 });
    });

    // What makes it a lived-in mountain road rather than a hard one: rice and radish set out to dry in trays on tarps at the
    // road's edge before a few doors; hens scratching about that go up in a flurry as the truck comes; chevron boards round
    // the outside of each hairpin; street lamps behind the barriers; a sign at the top for the bends.
    // Hens about a doorstep: a few, a little apart, each facing her own way.
    const hens = (x: number, z: number, n: number) => {
      const KINDS: ObjectKindId[] = ['chickenWhite', 'chickenBrown', 'chickenWhite', 'chickenBlack', 'chickenBrown'];
      for (let k = 0; k < n; k++) object(KINDS[k % KINDS.length], x + Math.sin(k * 2.4) * (0.5 + (k % 3) * 0.6), z + Math.cos(k * 2.4) * (0.6 + (k % 2) * 0.9), k * 1.7);
    };
    LEGS.forEach((x, n) => {
      const slope = n === 1 ? -DOWN : DOWN;
      // A tarp of rice at the road's edge, spread and raked, a little into the lane; its sacks and the rake by it.
      const z0 = LEG_SOUTH + 12 + n * 4;
      const [rx, rz] = [x + 2.1, z0 + 4];
      // Each layer well above the one under it, or they flicker through each other.
      decals.push({ pos: [rx, rz], size: [2.6, 8.4], color: 0x2f62a8, base: ground(rx, rz), tilt: [0, slope], y: 0.03 });
      decals.push({ pos: [rx, rz], size: [2.3, 8], color: 0xf2c94c, base: ground(rx, rz), tilt: [0, slope], y: 0.06 });
      for (let k = -3; k <= 3; k++) decals.push({ pos: [rx + k * 0.3, rz], size: [0.05, 7.6], color: 0xd9a92e, base: ground(rx, rz), tilt: [0, slope], y: 0.08 });
      spreads.push({ pos: [rx, rz], half: [1.15, 4] });
      object('riceSack', x + 3.6, z0 - 0.8);
      object('riceSack', x + 3.6, z0 - 1.5, 0.4);
      object('rake', x + 3.4, z0 + 8.6, 0.2);
      // And further down, radish strips in trays on a tarp of their own.
      const z1 = LEG_SOUTH + 42 - n * 3;
      decals.push({ pos: [x + 2.3, z1 + 2.4], size: [2.2, 5.6], color: 0x3f8f5f, base: ground(x + 2.3, z1 + 2.4), tilt: [0, slope], y: 0.03 });
      for (let k = 0; k < 4; k++) object(k % 2 ? 'trayVeg' : 'trayGrain', x + 2.3, z1 + 0.4 + k * 1.3);
      hens(x + 3.7, LEG_SOUTH + 30 - n * 4, 5);
      hens(x + 3.7, LEG_NORTH - 6, 4);
      for (let z = LEG_SOUTH + 8; z < LEG_NORTH; z += 18) object('lamp', x - HILL_ROAD / 2 - 0.9, z, Math.PI / 2);
    });
    hens(x1 + 9, LEG_SOUTH - 9, 5);
    hens(x2 + 9.5, LEG_NORTH + 16.5, 4);
    for (const [cx, cz, south] of [[(x1 + x2) / 2, LEG_SOUTH - 2.5, true], [(x2 + x3) / 2, LEG_NORTH + 2.5, false]] as const) {
      for (let k = 0; k < 5; k++) {
        const a = ((k + 0.5) / 5) * Math.PI;
        const x = cx + Math.cos(a) * 14.4;
        const z = cz + (south ? -1 : 1) * Math.sin(a) * 14.4;
        // Facing in, toward the middle of the bend.
        object('chevron', x, z, Math.atan2(cx - x, cz - z));
      }
    }
    signs.push({ pos: [EAST_EDGE - 3, ground(EAST_EDGE - 3, zOf(65) + 6), zOf(65) + 6], rotY: Math.PI / 2, kind: 'bends' });

    // The top of the hill where the road comes off the landing and turns down: a lookout. Barriers along its edges, the drop
    // to the second hairpin straight ahead; a pavilion of red posts and a green tiled roof out by the edge, benches and pots
    // by it, a coin telescope looking out over the quarry; a big old tree in the inside of the turn with a seat round it;
    // two scooters stood by.
    {
      const top = LANDING_H;
      for (let z = LEG_NORTH + 2; z < OUT_B; z += 4) rail((x1 - DOWNHILL) + 0.35, z, 0);
      for (let x = EAST_EDGE - 2; x > (x1 - DOWNHILL) + 1; x -= 4) rail(x, OUT_B - 0.35, Math.PI / 2);
      const [px, pz] = [x1 + 3, OUT_B - 3];
      for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]] as const) props.push({ shape: 'box', size: [0.12, 1.2, 0.12], pos: [px + dx, top + 1.2, pz + dz], color: 0xc8372d });
      props.push({ shape: 'box', size: [2.0, 0.12, 2.0], pos: [px, top + 2.5, pz], color: 0x2f6b4a, ghost: true });
      props.push({ shape: 'box', size: [1.5, 0.16, 1.5], pos: [px, top + 2.75, pz], color: 0x3f8f5f, ghost: true });
      props.push({ shape: 'box', size: [0.8, 0.14, 0.8], pos: [px, top + 3.0, pz], color: 0x2f6b4a, ghost: true });
      props.push({ shape: 'cylinder', size: [0.12, 0.2, 0], pos: [px, top + 3.3, pz], color: 0xd9a62e, ghost: true });
      props.push({ shape: 'box', size: [1.6, 0.04, 1.6], pos: [px, top + 0.05, pz], color: 0xb8b2a6 });
      object('table', px, pz);
      object('bench', px - 2.6, pz, Math.PI / 2);
      object('bench', px + 2.6, pz - 0.5, -Math.PI / 2);
      for (const [dx, kind] of [[-4.5, 'flowerPotBloom'], [4.2, 'flowerPotYellow'], [5.4, 'flowerPotTall']] as const) object(kind, px + dx, pz + 1.6);
      // The telescope on its post, out at the corner, looking east.
      const [tx, tz] = [(x1 - DOWNHILL) + 1.6, OUT_B - 6];
      props.push({ shape: 'cylinder', size: [0.06, 0.55, 0], pos: [tx, top + 0.55, tz], color: 0x5a6068 });
      props.push({ shape: 'box', size: [0.14, 0.12, 0.28], pos: [tx, top + 1.2, tz], color: 0x2f6fb0 });
      props.push({ shape: 'cylinder', size: [0.06, 0.12, 0], pos: [tx - 0.08, top + 1.24, tz - 0.3], rot: [Math.PI / 2, 0, 0], color: 0x1c1d20, ghost: true });
      props.push({ shape: 'cylinder', size: [0.06, 0.12, 0], pos: [tx + 0.08, top + 1.24, tz - 0.3], rot: [Math.PI / 2, 0, 0], color: 0x1c1d20, ghost: true });
      // The tree in the inside of the turn, and the seat round its trunk.
      const [bx, bz] = [EAST_EDGE - 2.6, LEG_NORTH + 2.6];
      props.push({ shape: 'cylinder', size: [0.45, 2.2, 0], pos: [bx, top + 2.2, bz], color: 0x6b4a32 });
      for (const [dx, dz, r, y] of [[0, 0, 4.2, 5.2], [1.6, 1.2, 3, 6.2], [-1.4, 0.8, 2.8, 6]] as const) props.push({ shape: 'cylinder', size: [r, 0.9, 0], pos: [bx + dx, top + y, bz + dz], color: 0x3f7a3f, ghost: true });
      props.push({ shape: 'cylinder', size: [0.95, 0.22, 0], pos: [bx, top + 0.22, bz], color: 0x9a7448 });
      // Inside the turn, off the road, by the tree.
      object('scooterRed', EAST_EDGE - 7.5, LEG_NORTH + 1.5, 0.3);
      object('scooterWhite', EAST_EDGE - 8.5, LEG_NORTH + 3, 0.5);
    }

    // The yard at the quarry's gate, where the load goes: a wall of concrete round it, and on its quarry side a gate of steel bars
    // with the quarry seen through it, its machines at work; a guard's hut, the weighbridge, pallets of goods to be taken, a
    // forklift, cones.
    {
      const [gx0, gz0, gx1, gz1] = GATE_YARD;
      const y = QUARRY_H;
      const wall = (x: number, z: number, hx: number, hz: number) => {
        props.push({ shape: 'box', size: [hx, 1.3, hz], pos: [x, y + 1.3, z], color: 0x9a948a });
        props.push({ shape: 'box', size: [hx + 0.05, 0.08, hz + 0.05], pos: [x, y + 2.65, z], color: 0x6e6a62, ghost: true });
      };
      wall((gx0 + gx1) / 2, gz0, (gx1 - gx0) / 2, 0.2);
      wall((gx0 + gx1) / 2, gz1, (gx1 - gx0) / 2, 0.2);
      const gate = (gz0 + gz1) / 2;
      wall(gx0, (gz0 + gate - 6) / 2, 0.2, (gate - 6 - gz0) / 2);
      wall(gx0, (gate + 6 + gz1) / 2, 0.2, (gz1 - gate - 6) / 2);
      // The gate: two leaves of upright bars, shut; and its posts.
      props.push({ shape: 'box', size: [0.12, 0.06, 6], pos: [gx0, y + 2.3, gate], color: 0x3a3f45 });
      props.push({ shape: 'box', size: [0.12, 0.06, 6], pos: [gx0, y + 0.3, gate], color: 0x3a3f45 });
      for (let dz = -5.7; dz <= 5.7; dz += 0.4) props.push({ shape: 'box', size: [0.04, 1.0, 0.04], pos: [gx0, y + 1.3, gate + dz], color: 0x3a3f45 });
      for (const dz of [-6.2, 6.2]) props.push({ shape: 'box', size: [0.35, 1.6, 0.35], pos: [gx0, y + 1.6, gate + dz], color: 0x7a756c });
      props.push({ shape: 'box', size: [0.03, 0.35, 1.6], pos: [gx0 + 0.15, y + 1.7, gate], color: 0xd0302a, ghost: true });
      // The guard's hut by the way in, and its barrier arm, raised.
      const [hx, hz] = [gx1 - 4, gz0 + 4];
      props.push({ shape: 'box', size: [1.3, 1.25, 1.3], pos: [hx, y + 1.25, hz], color: 0xe8e2d0 });
      props.push({ shape: 'box', size: [1.32, 0.35, 0.02], pos: [hx, y + 1.6, hz + 1.31], color: 0x1b2a3a, ghost: true });
      props.push({ shape: 'box', size: [1.5, 0.1, 1.5], pos: [hx, y + 2.6, hz], color: 0x2f62a8, ghost: true });
      // The weighbridge: a steel plate let into the ground, and its yellow edges.
      decals.push({ pos: [gx1 - 13, gz0 + 14], size: [3.6, 10], color: 0x5a6068, base: y, y: 0.03 });
      for (const dx of [-1.8, 1.8]) decals.push({ pos: [gx1 - 13 + dx, gz0 + 14], size: [0.2, 10], color: 0xf2c12e, base: y, y: 0.05 });
      // Pallets of goods along the wall, waiting; a forklift; the place to stop marked out.
      for (let k = 0; k < 4; k++) {
        object('pallet', gx0 + 2, gate - 14 - k * 2.4);
        object(k % 2 ? 'riceSack' : 'box', gx0 + 2, gate - 14 - k * 2.4);
      }
      object('farmTruck', gx0 + 3, gate + 16, Math.PI / 2);
      for (const dz of [-8, 8]) object('cone', gx0 + 10, gate + dz);
      decals.push({ pos: [gx0 + 10, gate - 4], size: [9, 12], color: 0xf2c12e, base: y, y: 0.03 });
      decals.push({ pos: [gx0 + 10, gate - 4], size: [8.4, 11.4], color: 0x8a8378, base: y, y: 0.05 });
    }

    // The quarry: a fence round it, the office in two containers at its far end, where the load goes; the machines.
    const [qx0, qz0, qx1, qz1] = QUARRY;
    const level = QUARRY_H;
    const fence = (x: number, z: number, hx: number, hz: number) => props.push({ shape: 'box', size: [hx, 1.25, hz], pos: [x, level + 1.25, z], color: 0x8c9aa6 });
    fence(qx0, (qz0 + qz1) / 2, 0.1, (qz1 - qz0) / 2);
    fence((qx0 + qx1) / 2, qz0, (qx1 - qx0) / 2, 0.1);
    fence((qx0 + qx1) / 2, qz1, (qx1 - qx0) / 2, 0.1);
    const office: Vec2 = [qx0 + 10, (qz0 + qz1) / 2 + 10];
    for (const [dy, color] of [[1.3, 0x2f6fb0], [3.9, 0xf2efe6]] as const) {
      props.push({ shape: 'box', size: [1.25, 1.3, 3.05], pos: [office[0] - 1.5, level + dy, office[1]], color });
      for (const dz of [-1.6, 0, 1.6]) props.push({ shape: 'box', size: [0.03, 0.4, 0.5], pos: [office[0] - 0.22, level + dy + 0.2, office[1] + dz], color: 0x1b2a3a, ghost: true });
    }
    for (let k = 0; k < 6; k++) props.push({ shape: 'box', size: [0.5, 0.06, 0.3], pos: [office[0] + 0.1, level + 0.4 + k * 0.43, office[1] - 3.2 + k * 0.35], color: 0x5a6068 });
    for (const [dx, dz] of [[4, -6], [5, -4.5], [4.2, 5], [6, 6]] as const) object('box', office[0] + dx, office[1] + dz);
    object('barrel', office[0] + 3, office[1] - 8);
    object('barrel', office[0] + 3.8, office[1] - 8.6);
    const yard: [number, number, number, number] = [qx0 + 14, qz0 + 10, GATE_YARD[0] - 12, qz1 - 10];
    machines.push(
      { kind: 'excavator', pos: [QUARRY_EDGE - 54, LEG_SOUTH + 6], yaw: 1, area: [QUARRY_EDGE - 70, LEG_SOUTH - 6, QUARRY_EDGE - 40, LEG_SOUTH + 20] },
      { kind: 'excavator', pos: [QUARRY_EDGE - 96, LEG_SOUTH + 40], yaw: -2, area: [QUARRY_EDGE - 112, LEG_SOUTH + 28, QUARRY_EDGE - 82, LEG_SOUTH + 54] },
      { kind: 'loader', pos: [QUARRY_EDGE - 30, LEG_SOUTH - 30], yaw: 0, area: yard },
      { kind: 'dumper', pos: [QUARRY_EDGE - 110, LEG_SOUTH + 70], yaw: Math.PI, area: yard },
      { kind: 'dumper', pos: [QUARRY_EDGE - 60, LEG_SOUTH - 40], yaw: 2, area: yard },
    );
  }

  // The removals: the van parked at the kerb on the way east, its back open; two men at a time carrying a sofa, a fridge, a
  // wardrobe across the road to the flats, and back for more, the traffic stopping for them; what is still to go stood about
  // in the road behind the van and on the pavement.
  {
    const [vx, vz] = VAN;
    // Clear of the van's back: walking out past its end, they would be in line with it and wait for it for ever.
    for (const [x, load, back] of [[vx + 5.6, 'sofa', 'wardrobe'], [vx + 8.6, 'fridge', null]] as const) {
      const first = (lifted.riders?.length ?? 0) + riders.length;
      riders.push({ from: [x, vz], to: [x, NORTH_KERB + 2.2], band: [-0.5, -0.3], riders: 1, kind: 'movers', load, turnInto: first + 1 });
      riders.push({ from: [x, NORTH_KERB + 2.2], to: [x, vz], band: [-0.5, -0.3], riders: back ? 1 : 0, kind: 'movers', load: back ?? load, turnInto: first });
    }
    for (const [dx, dz] of [[4.0, -0.9], [4.0, -0.3], [4.6, -0.6], [4.3, 0.3]] as const) object('box', vx + dx, vz + dz);
    object('tvSet', vx + 4.4, vz + 0.9, 0.3);
    object('mattress', vx - 2, SOUTH_KERB - 1.6, 0.1);
    object('sofa', vx + 2, SOUTH_KERB - 1.6, Math.PI / 2);
    object('chair', vx + 4, SOUTH_KERB - 1.4);
    object('chair', vx + 4.6, SOUTH_KERB - 1.8, 1);
    object('table', vx + 10.5, SOUTH_KERB - 1.6);
    object('wardrobe', vx + 3, NORTH_KERB + 2.6, Math.PI / 2);
    for (const dx of [-1, -0.4, 0.2]) object('box', vx + 11 + dx, NORTH_KERB + 1.5);
    crowds.push({ area: [vx + 10, NORTH_KERB + 1.2, vx + 13, NORTH_KERB + 3], count: 2, y: 0, clothes: [0x2f9a5a] });
  }
  // People walking the pavements of the bus street and the road, and shopping in the lane.
  crowds.push(marketCrowd, ...squareCrowds);
  for (const side of [-1, 1]) crowds.push({ area: [busX + side * 5.6 - 0.8, zOf(46), busX + side * 5.6 + 0.8, zOf(59) - 8], count: 12, y: 0 });
  crowds.push({ area: [xOf(30), zOf(51) + 5, xOf(22), zOf(51) + 6.5], count: 6, y: 0 });
  crowds.push({ area: [xOf(30), zOf(51) - 6.5, xOf(22), zOf(51) - 5], count: 6, y: 0 });

  // The way through, in the city's frame: up the bus street, on to the steps by their right-hand half (the middle has a
  // handrail down it), round on the landing to the second flight, through the square at the foot and down the lane, east
  // along the road, and up the avenue to the landing.
  const right = STAIR_WIDE / 4;
  const way: Vec2[] = [
    [busX, zOf(45) - 6], [busX - 2, zOf(59) - 10], [busX - 5, one.a[1] - right], [one.b[0], one.a[1] - right],
    // Round the corner on the landing, as tight as the truck turns: a quarter circle of about 8.5 m.
    ...[0, 0.25, 0.5, 0.75, 1].map((t): Vec2 => [two.a[0] - right + 8.5 - 8.5 * Math.sin((t * Math.PI) / 2), one.a[1] - right - 8.5 + 8.5 * Math.cos((t * Math.PI) / 2)]),
    [two.b[0] - right, two.b[1]],
    // Round at the foot of the steps, and up the path into the square.
    [xOf(16) - 2, fz0 + 6], [xOf(17) + 4, fz0 + 4], [xOf(17), fz0 + 9], [xOf(17), pz1 + 4],
    // North up the square's west side, east in front of the temple, south down its east side.
    [cx1 - 4, cz0 + 14], [cx1 - 4, cz1 - 20], [mid, cz1 - 19.5], [cx0 + 10, cz1 - 22], [cx0 + 10, cz0 + 10],
    // Out down the alley, along the lane, and out on to the road.
    [xOf(19), zOf(58)], [xOf(19), zOf(55)], [xOf(19), zOf(52)], [xOf(21), zOf(52)], [xOf(21), zOf(51) + 5],
    [xOf(22), zOf(51) - 2.2], [xOf(30), zOf(51) - 2.2], [xOf(31) - 3.5, zOf(52)], [xOf(31) - 3.5, zOf(65)],
    // Off the landing, east, and down the hill.
    [EAST_EDGE, zOf(65)], [LEGS[0], zOf(65) - 10], [LEGS[0], LEG_SOUTH], [(LEGS[0] + LEGS[1]) / 2, LEG_SOUTH - 12], [LEGS[1], LEG_SOUTH],
    [LEGS[1], LEG_NORTH], [(LEGS[1] + LEGS[2]) / 2, LEG_NORTH + 12], [LEGS[2], LEG_NORTH], [LEGS[2], LEG_SOUTH], [LEGS[2] - 10, LEG_SOUTH - 12],
    // Into the yard at the quarry's gate, to the bay marked out before it.
    [GATE_YARD[0] + 10, (GATE_YARD[1] + GATE_YARD[3]) / 2 - 4],
  ];

  return {
    ...lifted,
    id: 'uptown',
    name: '第 2 關　山城快遞',
    brief: '從卸貨區出發穿過山城：跟公車搶道、走樓梯、繞廟埕、鑽小巷，衝上鋼捲大坡，再沿髮夾彎下山，送到山腳的砂石場',
    ground: { center: [-100, north / 2], half: [400, north / 2 + 20], style: 'asphalt' },
    spawn: [xOf(12), BAY + 0.9, zOf(45) - 6],
    heading: 0,
    startLine: { pos: [xOf(12), START_GATE], dir: [0, 1] },
    props: [...lifted.props, ...props],
    objects: [...(lifted.objects ?? []), ...objects],
    crowds: [...(lifted.crowds ?? []), ...crowds],
    riders: [...(lifted.riders ?? []), ...riders, ...procession.map((lane, k): RiderLane => ({ ...lane, turnInto: (lifted.riders?.length ?? 0) + riders.length + (1 - k) }))],
    music: [music, stageMusic],
    keepOut: [...keepOut, [tx - 15.5, tz - 6.6, tx + 15.5, tz + 6]],
    fires: [fire],
    machines,
    spreads,
    // For testing: just before each part, on the way.
    checkpoints: [
      { name: '起點・公車街', pos: [busX - 2.2, zOf(46)], yaw: 0 },
      { name: '樓梯頂', pos: [xOf(13) + 2, zOf(59) - 2], yaw: -Math.PI / 2 },
      { name: '廟埕前', pos: [xOf(17), zOf(56) + 4], yaw: 0 },
      { name: '小巷市場', pos: [xOf(19), zOf(58) - 4], yaw: Math.PI },
      { name: '國小', pos: [xOf(21) - 4, zOf(51) - 2.25], yaw: -Math.PI / 2 },
      { name: '人孔噴水', pos: [xOf(24) - 8, zOf(51) + 2.25], yaw: -Math.PI / 2 },
      { name: '搬家', pos: [xOf(27) + 6, zOf(51) - 2.25], yaw: -Math.PI / 2 },
      { name: '鋼捲大坡', pos: [xOf(31) - 3.5, zOf(52) + 4], yaw: 0 },
      { name: '下山髮夾彎', pos: [EAST_EDGE + 10, zOf(65)], yaw: -Math.PI / 2 },
      { name: '山腳卸貨場', pos: [QUARRY_EDGE - 6, LEG_SOUTH - 12], yaw: -Math.PI / 2 },
    ],
    manholes,
    smokes,
    route: way,
    decals: [...lifted.decals, ...decals],
    cargo: hillLoad(),
    traffic: [...lifted.traffic, ...traffic, floatLane, vanLane, ...standing],
    signs: [...(lifted.signs ?? []), ...signs],
    // Across the road, and down the pavements too: the pavement is no way round them.
    rollers: [
      { from: [xOf(31) - 7.5, AV_HEAD - 11], to: [xOf(31) + 7.5, AV_HEAD - 11], down: [0, -1], kinds: ['steelCoil'], every: 2.3, speed: 4, run: AV_HEAD - zOf(51) + 4, within: 70 },
      // And down each pavement, in the middle of it, clear of the house walls.
      ...[-1, 1].map((side): RollerDesc => ({ from: [xOf(31) + side * 9.4, AV_HEAD - 11], to: [xOf(31) + side * 10.4, AV_HEAD - 11], down: [0, -1], kinds: ['steelCoil'], every: 6, speed: 4, run: AV_HEAD - zOf(51) + 4, within: 70 })),
    ],
    finish: { pos: [GATE_YARD[0] + 10, (GATE_YARD[1] + GATE_YARD[3]) / 2 - 4], half: [4.5, 6] },
    damageScale: undefined,
    stars: [0, 0.6],
    par: 180,
  };
}
