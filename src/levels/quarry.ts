import type { ObjectDesc, ObjectKindId } from './objects';
import {
  BANK, COBBLE, CONCRETE, DIKE, DIKE_END_OFF, DIKE_FROM, DIKE_H, DIKE_TO, DIKE_WIDE, dike, GRAVEL, hash, HAUL, HEAP_ROW, heapYard, LOADOUT_FROM, LOADOUT_ROWS, LOADOUT_WIDE, LOADOUT_TO, loadOut,
  POND, POND_DOWN, RIVER, RIVER_EAST, RIVER_FLOW, RIVER_IN, RIVER_LIP, RIVER_OUT, RIVER_SURFACE, FALL_SURFACE, FALL_WIDE, riverCrossing, SAND, type Site, YARD_FROM, YARD_HALF, YARD_TO,
} from './quarryParts';
import { Relief, type Look, type RibbonPoint } from './relief';
import { containerModel } from './city';
import { DROP, secondHalf, SITE_Y, SITE_YARD } from './quarryEnd';
import { TRUCK } from '../config';
import type { CargoPlacement } from '../sim/cargo';
import { heightAt } from './terrain';
import type { BirdDesc, CrowdDesc, DecalDesc, DropperDesc, FordDesc, LevelDef, MachineDesc, PropDesc, RigDesc, SignDesc, SlickDesc, StillWaterDesc, TrafficLane, Vec2 } from './types';

// Level 3, its first half: from the quarry gate down through the quarry to the river. Drawn on 16 m squares as the other
// levels are, every square something: the quarry's benches stepping up the hill to the west, the plant on its terrace to
// the east, the settling ponds below, the river at the foot. The way runs north and down, one place after another, each
// with its own difficulty, and the short ways between them with theirs:
//
//   the gate yard        where the run starts: the office, the guard's hut, lorries waiting
//   A  the stockpiles    heaps from either side in turn: the way snakes between them, a side of the truck up each
//   the lorry park       a cutting east to the plant, lorries parked down it on either side in turn, tyres everywhere
//   B  the load-out      under the plant's bins: rock pours down on a beat, the gaps to be picked
//   the descent          down to the ponds round two bends, a loader working across the way, pipes and culverts
//   C  the dike          across the ponds past the machines at work: excavators, pile drivers, a boom, a grab, the balls
//   the pump station     off the dike and down to the river, hoses across the way, pumps and sandbags
//   D  the crossing      the river running across, boulders in it, the weir below: then the melon field on the sand bar
//
// The bridge over the main channel and what comes after are the second half, still to come.

const CELL = 16;
const STEEL_GREY = 0x8c9096;
const xOf = (c: number) => c * CELL;
const zOf = (r: number) => r * CELL;

const ROCK: Look = { tag: 'gravel', color: 0x8a8378, wall: 0x6f685e };
const GRASS: Look = { tag: 'earth', color: 0x7c8f58, wall: 0x6a6450 };
const WOOD: Look = { tag: 'earth', color: 0x667a48, wall: 0x6a6450 };
const LAWN: Look = { tag: 'earth', color: 0x80935a, wall: 0x6e6a58 };
const BLOCKS: Look = { tag: 'paved', color: 0xb4b6b2, wall: 0xa6a8a4 };
const STREET: Look = { tag: 'paved', color: 0x6a6d70, wall: 0x55585c };
/** The loading shed's walkways, steel grating; its sides, corrugated sheeting. */
const WALKWAY: Look = { tag: 'paved', color: 0x6f747a, wall: 0x8a8e90 };
const CLAD: Look = { tag: 'paved', color: 0x5f666c, wall: 0xa4adb2 };
/** The settling ponds' water, from the slurry let in, brown, to the clear water drawn off, green; a pond let dry, its mud cracked. */
const SLURRY: Look = { tag: 'water', color: 0x7a6446, wall: 0x5f4f3a };
const CLEAR: Look = { tag: 'water', color: 0x4f7f72, wall: 0x3f6a5e };
const DRIED: Look = { tag: 'earth', color: 0x9a8f7c, wall: 0x7a6f5c };
/** Rock laid on a river's bank against the water. */
const RIPRAP: Look = { tag: 'gravel', color: 0x8a857a, wall: 0x6f6a60 };

/** The ground, square by square, from the south (row 0) north; columns from -3 (west) to 10 (east). */
const COL0 = -3;
const MAP: string[] = [
  //        -3 -2 -1  0  1  2  3  4  5  6  7  8  9 10
  /*  0 */ 'QQqr...TTTTTTT',
  /*  1 */ 'QQqrYYYFFFPSST',
  /*  2 */ 'QQqrYYYFFFPSST',
  /*  3 */ 'QQqrYYYGGGPSST',
  /*  4 */ 'QQqrYYYPPPPPPT',
  /*  5 */ 'QQqrYYYZSSPKKT',
  /*  6 */ 'QQqrYYYZSSPKKT',
  /*  7 */ 'QQqrYYYZCCPXXT',
  /*  8 */ 'QQqrYYYZCCPXXT',
  /*  9 */ 'QQqrYYYPPPPPPT',
  /* 10 */ 'QQqrYYYZXXPOOT',
  /* 11 */ 'QQqrYYYZXXPOOT',
  /* 12 */ 'QQqrYYYZKKPCCT',
  /* 13 */ 'QQqrYYYZKKPCCT',
  /* 14 */ 'QQqrYYYPPPPPPT',
  /* 15 */ 'QQqrYYYZWWPSST',
  /* 16 */ 'QQqrYYYZWWPSST',
  /* 17 */ 'QQqrYYYZVVPGGT',
  /* 18 */ 'QQqrYYYZVVPGGT',
  /* 19 */ 'QQqrrPPPPPPVVT',
  /* 20 */ 'QQqrrUUHHPPVVT',
  /* 21 */ 'QQqrrUUHHPPVVT',
  /* 22 */ 'QQqrrKKKKJJJOT',
  /* 23 */ 'QQqrrKKKKJJJOT',
  /* 24 */ 'QQqrrKKKKJJJOT',
  /* 25 */ 'QQqrrOOSSJJJCT',
  /* 26 */ 'QQqrrOOSSJJJCT',
  /* 27 */ 'QQqrrOOSSJJJCT',
  /* 28 */ 'QQqrrOOSSJJJCT',
  /* 29 */ 'QqTTLLLLLLLLTT',
  /* 30 */ 'QqTLLLLLLLLLLT',
  /* 31 */ 'qTLlfflllllLTT',
  /* 32 */ 'qTLlfflllllLLT',
  /* 33 */ 'TLlEEEEEEEEElL',
  /* 34 */ 'TwwwwwwssscccT',
  /* 35 */ 'TwwwwwwssscccT',
  /* 36 */ 'TwwwwwwssscccT',
  /* 37 */ 'TwwwwwwssscccT',
  /* 38 */ 'TwwwwwwssscccT',
  /* 39 */ 'TddddddssscccT',
  /* 40 */ 'TddddddssscccT',
  /* 41 */ 'TddddddssscccT',
  /* 42 */ 'TddddddssshhhT',
  /* 43 */ 'TddddddssshhhT',
  /* 44 */ 'TddddddssshhhT',
  /* 45 */ 'TkkkkkkssshhhT',
  /* 46 */ 'TkkkkkkssshhhT',
  /* 47 */ 'TkkkkkkssshhhT',
  /* 48 */ 'TkkkkkkssshhhT',
  /* 49 */ 'TkkkkkkssshhhT',
  /* 50 */ 'TTEEEEEEEEEETT',
  /* 51 */ 'TTEEEEEEEEEETT',
  /* 52 */ 'Tbbbbbbbbbbbbb',
  /* 53 */ 'lbbbbbbbbb~~~b',
  /* 54 */ 'lbbbbbbbbb~~~b',
  /* 55 */ 'lbbbbbbbbb~~~b',
  /* 56 */ 'lbbbbbbbbb~~~b',
  /* 57 */ 'lbbbbbbbbb~~~b',
  /* 58 */ 'lbbbbbbbbb~~~b',
  /* 59 */ 'lbbbbbbbbb~~~b',
  /* 60 */ 'lbbbbbbbbb~~~b',
  /* 61 */ 'lbbbbbbbbb~~~b',
  /* 62 */ 'lbbbbbbbbb~~~b',
  /* 63 */ 'lbbbbbbbbb~~~b',
  /* 64 */ 'gmmmmmmmmmmmmg',
  /* 65 */ 'gmmmmmmmmmmmmg',
  /* 66 */ 'gmmmmmmmmmmmmg',
  /* 67 */ 'gmmmmmmmmmmmmg',
  /* 68 */ 'gmmmmmmmmmmmmg',
  /* 69 */ '~~~~~~~~~~~~~~',
  /* 70 */ '~~~~~~~~~~~~~~',
  /* 71 */ '~~~~~~~~~~~~~~',
  /* 72 */ '~~~~~~~~~~~~~~',
  /* 73 */ '~~~~~~~~~~~~~~',
  /* 74 */ '~~~~~~~~~~~~~~',
  /* 75 */ '~~~~~~~~~~~~~~',
  /* 76 */ '~~~~~~~~~~~~~~',
  /* 77 */ '~~~~~~~~~~~~~~',
  /* 78 */ '~~~~~~~~~~~~~~',
  /* 79 */ '~~~~~~~~~~~~~~',
  /* 80 */ '~~~~~~~~~~~~~~',
  /* 81 */ '~~~~~~~~~~~~~~',
  /* 82 */ '~~~~~~~~~~~~~~',
  /* 83 */ '~~~~~~~~~~~~~~',
  /* 84 */ '~~~~~~~~~~~~~~',
  /* 85 */ 'jjjjjjjjjjjRjj',
  /* 86 */ 'jjjjjjjjjjjRjj',
  /* 87 */ 'ooooooooyyyRjj',
  /* 88 */ 'ooooooooyyyRjj',
  /* 89 */ 'ooooooooyyyRjj',
  /* 90 */ 'ooooooooyooRjj',
  /* 91 */ 'oooooooooooRjj',
  /* 92 */ 'oooooooooooRjj',
  /* 93 */ 'oooooooooooojj',
  /* 94 */ 'oooooooooooojj',
  /* 95 */ 'oooooooooooojj',
  /* 96 */ 'oooooooooooojj',
  /* 97 */ 'jjjjjjjjjjjjjj',
];
/**
 * Each kind of square: how high, what it is, what is on it. The quarry's benches (Q, q) step up the hill west of the yard.
 * The plant at 12, level with the ways, laid out as a town is: its streets (P) and between them lots, each lot of two
 * squares or more one thing: a shed (S), silos (O), a cone heap under a belt (K), stacked containers (C), lorries parked in
 * bays (V), the office (F), the crusher (X), the workshop where lorries are mended (W), the filling station (U), the canteen
 * (H), building stuff stored against the stockpile yard's wall (Z), the yards either side of the loading shed (J); lawn (G). The yard's wall is of concrete blocks, too
 * high for any heap to be driven over, so the plant is come into only off its street at the yard's north end. Woodland (T)
 * on the solid ground round about at 18, and on the land falling away to the ponds (L, l), where the equipment yard is (f). The yards (Y) at 12, cut down into the woodland; '.' the gate's way in
 * from the south. The ponds' grassy banks (E) and the ponds, the water going from one to the next: the slurry let into
 * the first (w), settling either side of the dike (s), drawn off clear on the east (c); a pond let dry and being dug out
 * (d), the filter press's yard beyond it (k), the pump house's yard that sends the water back (h). The river's banks (b) and the deep river upstream of the
 * crossing (~), and the main channel beyond the sand bar (m), the woods along its edges (g). Over the channel, the far bank's
 * woods (j), the haul road (R) north past the building site; the site's yard (y), and the ground round the buildings (o),
 * driven on only by what falls on it.
 */
const SQUARES: Record<string, { h: number; look: Look }> = {
  Q: { h: 30, look: ROCK },
  q: { h: 24, look: ROCK },
  T: { h: 18, look: WOOD },
  r: { h: 18, look: ROCK },
  '#': { h: 18, look: BANK },
  G: { h: 12, look: LAWN },
  S: { h: 12, look: CONCRETE },
  O: { h: 12, look: CONCRETE },
  K: { h: 12, look: GRAVEL },
  C: { h: 12, look: CONCRETE },
  V: { h: 12, look: CONCRETE },
  F: { h: 12, look: CONCRETE },
  X: { h: 12, look: CONCRETE },
  W: { h: 12, look: CONCRETE },
  U: { h: 12, look: CONCRETE },
  H: { h: 12, look: CONCRETE },
  Z: { h: 12, look: CONCRETE },
  J: { h: 12, look: CONCRETE },
  P: { h: 12, look: CONCRETE },
  Y: { h: 12, look: GRAVEL },
  '.': { h: 12, look: GRAVEL },
  L: { h: 14, look: WOOD },
  l: { h: 14, look: WOOD },
  f: { h: 14, look: CONCRETE },
  E: { h: 10, look: GRASS },
  w: { h: 0, look: SLURRY },
  s: { h: 0, look: POND },
  c: { h: 0, look: CLEAR },
  d: { h: 3.9, look: DRIED },
  k: { h: 5.6, look: CONCRETE },
  h: { h: 5.6, look: CONCRETE },
  b: { h: 5, look: COBBLE },
  '~': { h: -5, look: RIVER },
  m: { h: 0, look: SAND },
  g: { h: 3, look: WOOD },
  j: { h: SITE_Y, look: WOOD },
  R: { h: SITE_Y, look: HAUL },
  y: { h: SITE_Y, look: SITE_YARD },
  o: { h: SITE_Y, look: DROP },
};

/** The yard at the gate and the stockpiles, at 12; the load-out at 12. */
const TOP = 12;
/** The loading shed over the load-out, across from its middle: the walkways' inner edge, the walls' inner and outer faces; how high its sides, eaves, ridge and doors. */
const SHED_IN = LOADOUT_WIDE / 2, SHED_WALK = 8.6, SHED_WALL = 9.2, SHED_SIDE = 5.6, SHED_EAVE = 14, SHED_RIDGE = 16, SHED_DOOR = 7.5;
/** The ponds' floor, the dike DIKE_H above it. */
const PONDS = 3.4 + POND_DOWN;
/** The river's banks' foot. */
const RIVER_Y = 0;
/** The pump station's yard, behind the river's levee at the dike's height; the levee's top and the river's bank beyond it; the
 * way through the levee, its middle across and where it comes out on the bank; where it comes down to the river. */
const PUMP_YARD = { x0: 60, x1: 104, z0: zOf(50) - 14, z1: zOf(50) + 6 };
const LEVEE_TOP = 10, RIVER_BANK = 5;
/** Where the levee's top begins, on its side away from the river. */
const LEVEE_FROM = zOf(50) - 8;
const GATE_X = 86, GATE_TO = zOf(51) + 8;
const RAMP_FOOT: Vec2 = [xOf(6) - 3, zOf(54) + 4 - 20];

/** Where each place is: its middle line across, and where its own measures along start from. */
const A: Vec2 = [xOf(2), zOf(4)];
const B: Vec2 = [xOf(7), zOf(22) + 8];
const C: Vec2 = [xOf(5), zOf(34)];
const D: Vec2 = [xOf(6), zOf(54) + 4];

function base(x: number, z: number): { h: number; look: Look } {
  const c = Math.round(x / CELL) - COL0, r = Math.round(z / CELL);
  const row = MAP[Math.max(0, Math.min(MAP.length - 1, r))];
  const square = SQUARES[row[Math.max(0, Math.min(row.length - 1, c))]] ?? SQUARES['#'];
  // The ponds stand at their own height.
  if (square.look.tag === 'water' && square.h === 0) return { h: PONDS - POND_DOWN, look: square.look };
  return square;
}

export function quarry(): LevelDef {
  const min: Vec2 = [xOf(COL0) - 8, -8], max: Vec2 = [xOf(COL0 + MAP[0].length - 1) + 8, zOf(MAP.length - 1) + 8];
  const relief = new Relief(min, max, 8, base);
  const props: PropDesc[] = [];
  const decals: DecalDesc[] = [];
  const traffic: TrafficLane[] = [];
  const machines: MachineDesc[] = [];
  const rigs: RigDesc[] = [];
  const crowds: CrowdDesc[] = [];
  const droppers: DropperDesc[] = [];
  const fords: FordDesc[] = [];
  const later: (() => void)[] = [];
  const objects: ObjectDesc[] = [];
  const signs: SignDesc[] = [];
  let ground: (x: number, z: number) => number = () => 0;
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, y?: number) => later.push(() => objects.push({ kind, pos: [x, y ?? ground(x, z), z], rotY }));
  const site: Site = { relief, props, decals, traffic, rigs, droppers, fords, crowds, object };
  /** A road between the places, with its banks run out to the land either side, cut or filled. */
  const road = (points: RibbonPoint[], width: number, look: Look = HAUL, banked = true) => {
    const made = relief.ribbon(points, width, look);
    if (banked) for (const side of ['left', 'right'] as const) relief.slope(made[side], side, { run: 2.5, to: 'land' }, BANK);
    return made;
  };
  /** A lorry standing, facing the way given (radians about Y, 0 = north). */
  const lorry = (x: number, z: number, yaw: number) => traffic.push({ from: [x - Math.sin(yaw) * 0.25, z - Math.cos(yaw) * 0.25], to: [x + Math.sin(yaw) * 0.25, z + Math.cos(yaw) * 0.25], cars: 1, speed: 0, kinds: ['dumpTruck'] });

  // The gate yard: the office of three containers, the guard's hut by the way out, a lorry or two waiting, pallets. The way
  // north out of it through the gate in its wall into the stockpile yard, a barrier arm across it, the start line under it.
  const yard = { x0: xOf(1) - 8, x1: xOf(3) + 8, z0: zOf(1) - 8, z1: zOf(2) + 8 };
  road([{ x: A[0], z: yard.z1 - 1, h: TOP }, { x: A[0], z: A[1] + YARD_FROM + 1, h: TOP }], 6.5, GRAVEL, false);
  for (const [n, color] of [0x3f6f8a, 0x8a4a3a, 0x3f6f8a].entries()) containerModel(props, yard.x0 + 4, TOP + (n === 2 ? 2.6 : 0), yard.z0 + 6 + (n === 2 ? 1.2 : n * 2.6), true, color);
  props.push({ shape: 'box', size: [1.2, 1.3, 1.2], pos: [A[0] + 5.2, TOP + 1.3, yard.z1 - 3], color: 0xd8d2c4 }, { shape: 'box', size: [1.5, 0.1, 1.5], pos: [A[0] + 5.2, TOP + 2.65, yard.z1 - 3], color: 0x2f5f8a, ghost: true });
  // The barrier across the way out, as at level 2's start: a post either side, the arm between them at 1 m.
  for (const dx of [-3.6, 3.6]) object('post', A[0] + dx, yard.z1 - 1, 0, TOP);
  later.push(() => objects.push({ kind: 'gateArm', pos: [A[0], TOP + 1.0, yard.z1 - 1], rotY: 0 }));
  lorry(yard.x1 - 5, yard.z0 + 10, 0);
  lorry(yard.x1 - 10, yard.z0 + 14, Math.PI);
  for (const [x, z] of [[yard.x0 + 3, yard.z1 - 4], [yard.x0 + 5, yard.z1 - 4], [yard.x0 + 3, yard.z1 - 6]] as const) object('pallet', x, z);
  for (const z of [yard.z0 + 20, yard.z0 + 23]) object('tyreStack', yard.x1 - 2, z);

  // A: the stockpiles.
  heapYard(site, A[0], A[1], TOP);
  // Walls of interlocking concrete blocks three high, 4.8 m, as the bins of a stockpile yard are walled: along the yard's
  // east side, between it and the plant, the heaps pushed up against it standing lower than it; and across the gate yard's
  // north side, the gate in it, the barrier arm just inside.
  const WALL_X = A[0] + YARD_HALF, WALL_UP = 4.8;
  /** A wall over the rectangle given, its joints drawn on its two long faces: a course every 1.6 m up, the blocks 3.2 m long and each course set over by half. */
  const blockWall = (x0: number, z0: number, x1: number, z1: number) => {
    relief.area([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], TOP + WALL_UP, BLOCKS);
    const alongZ = z1 - z0 > x1 - x0, from = alongZ ? z0 : x0, to = alongZ ? z1 : x1, mid = (from + to) / 2;
    for (const face of alongZ ? [x0 - 0.01, x1 + 0.01] : [z0 - 0.01, z1 + 0.01]) {
      const at = (d: number, y: number): [number, number, number] => (alongZ ? [face, y, d] : [d, y, face]);
      for (const up of [1.6, 3.2]) props.push({ shape: 'box', size: alongZ ? [0.01, 0.03, (to - from) / 2] : [(to - from) / 2, 0.03, 0.01], pos: at(mid, TOP + up), color: 0x8a8e90, ghost: true });
      for (let course = 0; course < 3; course++) for (let d = from + (course % 2 ? 1.6 : 3.2); d < to - 0.5; d += 3.2) props.push({ shape: 'box', size: alongZ ? [0.01, 0.8, 0.03] : [0.03, 0.8, 0.01], pos: at(d, TOP + 0.8 + course * 1.6), color: 0x8a8e90, ghost: true });
    }
  };
  blockWall(WALL_X, yard.z0, WALL_X + 1.6, A[1] + YARD_TO);
  blockWall(yard.x0, yard.z1, A[0] - 4, yard.z1 + 1.6);
  blockWall(A[0] + 4, yard.z1, WALL_X, yard.z1 + 1.6);
  // Where the lane swings over to the wall round the tip of each heap, the floor between the wall and the tip is wider
  // than the lane needs: the yard's work goes on in it, against the wall, leaving the lane 7.5 m. Lorries parked to be
  // loaded, loaders working back and forth, fresh piles tipped, rock broken off, tyres and culverts stored, a site office.
  HEAP_ROW.forEach(([reach, dz], n) => {
    const o = n % 2 ? -1 : 1, z = A[1] + dz;
    const wall = A[0] + o * YARD_HALF, inner = A[0] + o * (reach + 7.5);
    const mid = (wall + inner) / 2, deep = Math.abs(wall - inner);
    const toWall = (d: number) => wall - o * d;
    switch (n % 6) {
      case 0:
        for (const [d, dz2] of [[2.5, -3], [3, 2.5], [6, 0]] as const) object('gravelPile', toWall(d), z + dz2);
        for (let k = 0; k < 5; k++) object('rockSmall', toWall(4 + hash(n, k) * (deep - 5)), z + (hash(k, n) - 0.5) * 9, hash(k, 3) * 3);
        break;
      case 1:
        lorry(toWall(2.6), z, n % 4 ? 0 : Math.PI);
        object('gravelPile', toWall(6.5), z - 2);
        object('cone', inner - o * 0.5, z - 4);
        object('cone', inner - o * 0.5, z + 4);
        break;
      case 2:
        machines.push({ kind: 'loader', pos: [mid, z], yaw: o > 0 ? Math.PI / 2 : -Math.PI / 2, area: [Math.min(wall, inner) + 1.5, z - 5, Math.max(wall, inner) - 1.5, z + 5] });
        object('gravelPile', toWall(2), z + 4.5);
        break;
      case 3:
        object('culvertStack', toWall(2.2), z - 2.5, Math.PI / 2);
        object('tyreStack', toWall(1.2), z + 3);
        object('tyreStack', toWall(2.6), z + 4.4);
        for (let k = 0; k < 4; k++) object('tyre', toWall(4 + hash(k, n) * (deep - 5)), z + (hash(n, k) - 0.5) * 8, hash(k, 7) * 3);
        break;
      case 4:
        for (const [d, high] of [[1.4, 0], [1.4, 1]] as const) props.push({ shape: 'box', size: [1.2, 1.3, 3.05], pos: [toWall(d), TOP + 1.3 + high * 2.6, z + (high ? 0.4 : 0)], color: high ? 0x3f6f8a : 0xb5862e });
        for (const d of [4, 5.2]) object('pallet', toWall(d), z + 3);
        object('boulder', toWall(5), z - 3.5, 0.7);
        break;
      default:
        for (let k = 0; k < 4; k++) object('boulder', toWall(2 + hash(k, n) * (deep - 3)), z + (hash(n, k + 9) - 0.5) * 9, hash(k, 5) * 3);
        object('gravelPile', toWall(2.4), z);
    }
  });
  // The lane itself is narrow enough already: nothing in it that stands in the way, only what has fallen off lorries and
  // been dropped about, light and sent flying: tyres, pallets, cones knocked over, a warning sign, drums, a jerrycan.
  // A little at each heap's tip and where the lane swings over between one heap and the next, never at its very middle.
  const LITTER: ObjectKindId[] = ['tyre', 'pallet', 'cone', 'barrel', 'tyre', 'signWarn', 'jerrycan', 'pallet', 'cone', 'barrier'];
  const laneMid = (n: number) => {
    const [reach, dz] = HEAP_ROW[n], o = n % 2 ? -1 : 1;
    return [A[0] + o * (reach + 3.75), A[1] + dz] as const;
  };
  later.push(() => {
    const spots: [number, number][] = [];
    HEAP_ROW.forEach((_, n) => {
      const [x, z] = laneMid(n);
      spots.push([x, z]);
      if (n + 1 < HEAP_ROW.length) {
        const [x2, z2] = laneMid(n + 1);
        spots.push([(x + x2) / 2, (z + z2) / 2]);
      }
    });
    let k = 0;
    spots.forEach(([x, z], s) => {
      for (let j = 0; j < 2 + (s % 2); j++, k++) {
        const across = (j % 2 ? 1 : -1) * (1.6 + hash(s, j) * 1.6), along = (hash(j, s + 40) - 0.5) * 6;
        const px = x + across, pz = z + along;
        if (Math.abs(ground(px, pz) - TOP) > 0.05) continue;
        objects.push({ kind: LITTER[k % LITTER.length], pos: [px, TOP, pz], rotY: hash(k, 71) * 6.28 });
      }
    });
  });

  // The plant's high street: out of the stockpiles' north end, east past the plant's lots, and at the crossing north into
  // the load-out. The plant's own streets run off it: its main street south from the crossing, and three cross streets off
  // that, each to its end at the woods; nowhere else out of the plant but back the way in. What is hard on the high
  // street itself is still to come.
  const parkZ = zOf(19) + 2;
  road([{ x: A[0], z: A[1] + YARD_TO - 6, h: TOP }, { x: A[0], z: parkZ, h: TOP, round: 10 }, { x: B[0], z: parkZ, h: TOP }, { x: B[0], z: B[1] + LOADOUT_FROM + 1, h: TOP }], 8, STREET, false);
  road([{ x: B[0], z: parkZ, h: TOP }, { x: B[0], z: zOf(1) - 6, h: TOP }], 8, STREET, false);
  for (const r of [4, 9, 14]) road([{ x: A[0] + YARD_HALF + 3, z: zOf(r), h: TOP }, { x: xOf(9) + 6, z: zOf(r), h: TOP }], 8, STREET, false);
  for (const [x, z] of [[A[0] - 3.3, parkZ + 3.5]] as const) object('chevron', x, z, Math.PI / 4);
  // Gravel spilt where the lorries swing out of the stockpiles on to the high street: loose on the concrete it takes the
  // tyres' hold, and a truck that comes round too fast runs on wide into the filling station's corner.
  const slicks: SlickDesc[] = [{ pos: [A[0] + 4, parkZ - 4], half: [9, 9], y: TOP, grip: 0.45, look: 'gravel' }];

  // B: the load-out, in its shed: a long steel shed over the whole of it, as a gravel plant's loading shed is. Corrugated
  // sides 5.6 m up, the band above them open to the light up to the eaves, the belts that feed its bins coming in through
  // it; a pitched roof on portal frames, seen through from above. Inside, the road down the middle, and either side of it a
  // walkway 1.2 m up behind a handrail, the bins' frames standing on it: no way along but the road under the bins. A door
  // at either end, the shed's name over each; at the south one, off the high street, a height bar, the light that lets
  // lorries in and the loader's cabin, lorries waiting their turn on the forecourt.
  loadOut(site, B[0], B[1], TOP, false);
  const shedZ0 = B[1] + LOADOUT_FROM, shedZ1 = B[1] + LOADOUT_TO, shedMid = (shedZ0 + shedZ1) / 2, shedHalf = (shedZ1 - shedZ0) / 2;
  const SHED_GREY = 0xa4adb2, SHED_DARK = 0x7e878c, STEEL = 0x8c9096;
  /** Where the camera's line to the truck runs while the truck is in the shed or at a door: its roof seen through then. */
  const shedZone: NonNullable<PropDesc['fadeZone']> = [[B[0] - SHED_WALL - 1, TOP, shedZ0 - 10], [B[0] + SHED_WALL + 1, TOP + SHED_RIDGE + 2, shedZ1 + 10]];
  const rect = (x0: number, z0: number, x1: number, z1: number): Vec2[] => [[Math.min(x0, x1), z0], [Math.max(x0, x1), z0], [Math.max(x0, x1), z1], [Math.min(x0, x1), z1]];
  /** Across the shed, so far out from its middle on one side. */
  const outX = (side: number, d: number) => B[0] + side * d;
  for (const side of [-1, 1]) {
    relief.area(rect(outX(side, SHED_IN), shedZ0, outX(side, SHED_WALK), shedZ1), TOP + 1.2, WALKWAY);
    relief.area(rect(outX(side, SHED_WALK), shedZ0, outX(side, SHED_WALL), shedZ1), TOP + SHED_SIDE, CLAD);
    // The walkway's handrail, yellow, along its edge over the road.
    for (const up of [0.6, 1.1]) props.push({ shape: 'box', size: [0.03, 0.03, shedHalf], pos: [outX(side, SHED_IN + 0.15), TOP + 1.2 + up, shedMid], color: 0xe0b020, ghost: true });
    for (let z = shedZ0 + 1; z < shedZ1; z += 2.5) props.push({ shape: 'box', size: [0.03, 0.55, 0.03], pos: [outX(side, SHED_IN + 0.15), TOP + 1.75, z], color: 0xe0b020, ghost: true });
    // The sheeting over the ground's faces, outside and in, and the walkway's edge plated; the sheeting's ribs; the
    // flashing along its top.
    props.push({ shape: 'box', size: [0.02, SHED_SIDE / 2, shedHalf], pos: [outX(side, SHED_WALL + 0.02), TOP + SHED_SIDE / 2, shedMid], color: SHED_GREY, ghost: true });
    props.push({ shape: 'box', size: [0.02, (SHED_SIDE - 1.2) / 2, shedHalf], pos: [outX(side, SHED_WALK - 0.02), TOP + (SHED_SIDE + 1.2) / 2, shedMid], color: SHED_GREY, ghost: true });
    props.push({ shape: 'box', size: [0.02, 0.6, shedHalf], pos: [outX(side, SHED_IN - 0.02), TOP + 0.6, shedMid], color: 0x6f747a, ghost: true });
    for (let z = shedZ0 + 0.6; z < shedZ1; z += 1.2) {
      props.push({ shape: 'box', size: [0.05, SHED_SIDE / 2, 0.09], pos: [outX(side, SHED_WALL + 0.06), TOP + SHED_SIDE / 2, z], color: SHED_DARK, ghost: true });
      props.push({ shape: 'box', size: [0.05, (SHED_SIDE - 1.2) / 2, 0.09], pos: [outX(side, SHED_WALK - 0.06), TOP + (SHED_SIDE + 1.2) / 2, z], color: SHED_DARK, ghost: true });
    }
    props.push({ shape: 'box', size: [0.45, 0.08, shedHalf], pos: [outX(side, (SHED_WALK + SHED_WALL) / 2), TOP + SHED_SIDE + 0.08, shedMid], color: 0x5f666c, ghost: true });
    // Over the open band: a rail at mid-height, and the eaves beam.
    props.push({ shape: 'box', size: [0.1, 0.12, shedHalf], pos: [outX(side, SHED_WALL - 0.2), TOP + 10, shedMid], color: STEEL, ghost: true, fade: true });
    props.push({ shape: 'box', size: [0.25, 0.35, shedHalf + 0.3], pos: [outX(side, SHED_WALL - 0.2), TOP + SHED_EAVE, shedMid], color: STEEL, ghost: true, fade: true, fadeZone: shedZone });
    // The roof, a slope each side of the ridge, a little over the eaves.
    const pitch = Math.atan2(SHED_RIDGE - SHED_EAVE, SHED_WALL), over = SHED_WALL + 0.8;
    props.push({ shape: 'box', size: [over / Math.cos(pitch) / 2, 0.1, shedHalf + 0.8], pos: [outX(side, over / 2), TOP + SHED_RIDGE - Math.tan(pitch) * (over / 2) + 0.45, shedMid], rot: [0, 0, -side * pitch], color: SHED_GREY, ghost: true, fade: true, fadeZone: shedZone });
    // The portal frames: a column in the wall every 12.4 m, a rafter from its head up to the ridge.
    for (let z = shedZ0; z <= shedZ1 + 0.1; z += (shedZ1 - shedZ0) / 10) {
      const zz = Math.min(shedZ1 - 0.3, Math.max(shedZ0 + 0.3, z));
      props.push({ shape: 'box', size: [0.25, SHED_EAVE / 2, 0.25], pos: [outX(side, (SHED_WALK + SHED_WALL) / 2), TOP + SHED_EAVE / 2, zz], color: STEEL, ghost: true, fade: true });
      props.push({ shape: 'box', size: [SHED_WALL / Math.cos(pitch) / 2, 0.3, 0.12], pos: [outX(side, SHED_WALL / 2), TOP + (SHED_EAVE + SHED_RIDGE) / 2, zz], rot: [0, 0, -side * pitch], color: STEEL, ghost: true, fade: true, fadeZone: shedZone });
    }
  }
  props.push({ shape: 'box', size: [0.5, 0.25, shedHalf + 0.8], pos: [B[0], TOP + SHED_RIDGE + 0.6, shedMid], color: SHED_DARK, ghost: true, fade: true, fadeZone: shedZone });
  // Each end: sheeting over the door up to the eaves, and over the walkways either side of it; the name over the door.
  // All of it seen through together while the truck is at that door, from 10 m outside it to 10 m in.
  for (const [z, face] of [[shedZ0, -1], [shedZ1, 1]] as const) {
    const zone: NonNullable<PropDesc['fadeZone']> = [[B[0] - SHED_WALL - 1, TOP, z - 10], [B[0] + SHED_WALL + 1, TOP + SHED_RIDGE + 1, z + 10]];
    props.push({ shape: 'box', size: [SHED_WALL, (SHED_EAVE - SHED_DOOR) / 2, 0.12], pos: [B[0], TOP + (SHED_EAVE + SHED_DOOR) / 2, z], color: SHED_GREY, ghost: true, fade: true, fadeZone: zone });
    for (const side of [-1, 1]) props.push({ shape: 'box', size: [(SHED_WALL - SHED_IN) / 2, SHED_DOOR / 2, 0.12], pos: [outX(side, (SHED_WALL + SHED_IN) / 2), TOP + SHED_DOOR / 2, z + face * 0.02], color: SHED_GREY, ghost: true, fade: true, fadeZone: zone });
    for (const side of [-1, 1]) props.push({ shape: 'box', size: [0.2, SHED_DOOR / 2, 0.2], pos: [outX(side, SHED_IN + 0.2), TOP + SHED_DOOR / 2, z + face * 0.2], color: 0xe0b020, ghost: true, fade: true, fadeZone: zone });
    props.push({ shape: 'box', size: [SHED_IN + 0.4, 0.2, 0.2], pos: [B[0], TOP + SHED_DOOR - 0.2, z + face * 0.2], color: 0xe0b020, ghost: true, fade: true, fadeZone: zone });
    signs.push({ kind: 'loadOut', pos: [B[0], TOP + 9.6, z + face * 0.25], rotY: face > 0 ? 0 : Math.PI, fadeZone: zone });
  }
  // On the walkways either side, what the men who work the bins keep there and leave about: spill swept up against the
  // rail, the bins' control boxes, drums of oil for the gates, toolboxes and buckets, extinguishers, shovels and brooms
  // against the rail, hoses coiled, gas bottles chained to the wall; posters and the dust-spray pipe along the sheeting;
  // a man or two at work on each side. Kept clear of the frames' legs.
  {
    const WY = TOP + 1.2;
    const legs: Vec2[] = [];
    for (const [dz, angle] of LOADOUT_ROWS) for (const side of [-1, 1]) {
      const t = side * (7.5 / Math.cos(angle) - 0.4);
      legs.push([B[0] + t * Math.cos(angle), B[1] + dz + t * Math.sin(angle)]);
    }
    const clear = (x: number, z: number, r: number) => legs.every(([lx, lz]) => Math.hypot(x - lx, z - lz) > r + 0.6);
    for (const side of [-1, 1]) {
      const rail = outX(side, SHED_IN + 0.7), wall = outX(side, SHED_WALK - 0.45), mid = outX(side, (SHED_IN + SHED_WALK) / 2);
      for (let z = shedZ0 + 3, k = 0; z < shedZ1 - 3; z += 4, k++) {
        const n = k + (side > 0 ? 3 : 0), zz = z + (hash(k, side) - 0.5) * 1.5;
        switch (n % 8) {
          case 0:
            if (clear(rail, zz, 0.8)) props.push({ shape: 'cone', size: [0.7, 0.25, 0], pos: [rail, WY + 0.25, zz], color: 0x9c9384 }, { shape: 'cone', size: [0.4, 0.15, 0], pos: [rail + side * 0.4, WY + 0.15, zz + 0.7], color: 0x857f75, ghost: true });
            break;
          case 1:
            if (clear(wall, zz, 0.6)) {
              props.push({ shape: 'box', size: [0.05, 0.6, 0.05], pos: [wall, WY + 0.6, zz], color: STEEL });
              props.push({ shape: 'box', size: [0.18, 0.28, 0.24], pos: [wall - side * 0.1, WY + 1.3, zz], color: 0x9aa0a6 });
              for (const [dz, c] of [[-0.09, 0x2fa04a], [0.09, 0xc8372d]] as const) props.push({ shape: 'cylinder', size: [0.04, 0.02, 0], pos: [wall - side * 0.29, WY + 1.35, zz + dz], rot: [0, 0, Math.PI / 2], color: c, ghost: true });
            }
            break;
          case 2:
            if (clear(wall, zz, 0.9)) for (const dz of [-0.35, 0.35]) props.push({ shape: 'cylinder', size: [0.3, 0.45, 0], pos: [wall - side * 0.1, WY + 0.45, zz + dz], color: dz < 0 ? 0x2f5f9a : 0xb5362a });
            break;
          case 3:
            if (clear(mid, zz, 0.7)) {
              props.push({ shape: 'box', size: [0.3, 0.16, 0.18], pos: [mid, WY + 0.16, zz], color: 0xc8372d });
              props.push({ shape: 'cylinder', size: [0.16, 0.18, 0], pos: [mid + side * 0.6, WY + 0.18, zz + 0.4], color: 0xe0a81e });
            }
            break;
          case 4:
            if (clear(wall, zz, 0.5)) props.push({ shape: 'cylinder', size: [0.1, 0.3, 0], pos: [wall, WY + 0.9, zz], color: 0xc8372d }, { shape: 'box', size: [0.02, 0.25, 0.25], pos: [outX(side, SHED_WALK - 0.14), WY + 1.6, zz], color: 0xc8372d, ghost: true });
            break;
          case 5:
            if (clear(rail, zz, 0.6)) for (const [dz, c] of [[0, 0x6b5a46], [0.35, 0xb08850]] as const) props.push({ shape: 'box', size: [0.025, 0.65, 0.025], pos: [rail - side * 0.45, WY + 0.62, zz + dz], rot: [0, 0, side * 0.25], color: c, ghost: true });
            break;
          case 6:
            if (clear(mid, zz, 0.7)) {
              props.push({ shape: 'cylinder', size: [0.45, 0.08, 0], pos: [mid, WY + 0.08, zz], color: 0x24262a }, { shape: 'cylinder', size: [0.22, 0.09, 0], pos: [mid, WY + 0.09, zz], color: 0x55595f, ghost: true });
              props.push({ shape: 'box', size: [0.17, 0.24, 0.09], pos: [mid + side * 0.7, WY + 0.24, zz - 0.3], color: 0x4f5b36 });
            }
            break;
          default:
            if (clear(wall, zz, 0.6)) for (const [dz, c] of [[-0.2, 0x2f7a3a], [0.2, 0x24262a]] as const) props.push({ shape: 'cylinder', size: [0.13, 0.7, 0], pos: [wall, WY + 0.7, zz + dz], color: c });
        }
      }
      // And between them, against the wall, the bigger things: a water tote in its cage, a rack of spares, the fitters'
      // bench with its vice, rollers for the belts stacked, a pallet of bagged grease, a wheelbarrow.
      const back = outX(side, SHED_WALK - 1.1);
      for (let z = shedZ0 + 6.5, k = 0; z < shedZ1 - 4; z += 8.5, k++) {
        if (!clear(back, z, 1.3)) continue;
        const n = k + (side > 0 ? 2 : 0);
        switch (n % 6) {
          case 0:
            props.push({ shape: 'box', size: [0.55, 0.07, 0.55], pos: [back, WY + 0.07, z], color: 0x9a7448 }, { shape: 'box', size: [0.5, 0.5, 0.5], pos: [back, WY + 0.65, z], color: 0xeceae2 });
            for (const up of [0.4, 0.9]) props.push({ shape: 'box', size: [0.52, 0.02, 0.52], pos: [back, WY + up, z], color: STEEL, ghost: true });
            break;
          case 1:
            for (const dz of [-0.9, 0.9]) props.push({ shape: 'box', size: [0.04, 0.9, 0.04], pos: [back + side * 0.3, WY + 0.9, z + dz], color: 0x2f5f9a });
            for (const up of [0.3, 0.9, 1.5]) {
              props.push({ shape: 'box', size: [0.3, 0.02, 0.92], pos: [back + side * 0.3, WY + up, z], color: 0x3f6f8a, ghost: true });
              for (const dz of [-0.55, 0, 0.5]) if (hash(up * 10, dz + k) < 0.75) props.push({ shape: 'box', size: [0.2, 0.12, 0.18], pos: [back + side * 0.3, WY + up + 0.14, z + dz], color: [0xc9a26b, 0x9aa0a6, 0xc8372d][Math.floor(hash(dz, up + k) * 3)], ghost: true });
            }
            break;
          case 2:
            props.push({ shape: 'box', size: [0.4, 0.04, 1], pos: [back, WY + 0.9, z], color: 0x6b5a46 });
            for (const dz of [-0.9, 0.9]) props.push({ shape: 'box', size: [0.35, 0.43, 0.04], pos: [back, WY + 0.45, z + dz], color: STEEL });
            props.push({ shape: 'box', size: [0.1, 0.1, 0.16], pos: [back - side * 0.25, WY + 1.04, z - 0.6], color: 0x2f5f9a }, { shape: 'box', size: [0.22, 0.08, 0.15], pos: [back, WY + 1.02, z + 0.4], color: 0xc8372d });
            break;
          case 3:
            for (let i = 0; i < 3; i++) for (let j = 0; j < 4 - i; j++) props.push({ shape: 'cylinder', size: [0.12, 0.5, 0], pos: [back, WY + 0.12 + i * 0.21, z - 0.4 + j * 0.25 + i * 0.12], rot: [0, 0, Math.PI / 2], color: i % 2 ? 0x5f646a : 0x7a7f86 });
            break;
          case 4:
            props.push({ shape: 'box', size: [0.55, 0.07, 0.5], pos: [back, WY + 0.07, z], color: 0x9a7448 });
            for (let i = 0; i < 3; i++) props.push({ shape: 'box', size: [0.5, 0.1, 0.42], pos: [back, WY + 0.24 + i * 0.2, z], color: i % 2 ? 0xd8d4c8 : 0xc9b98f });
            break;
          default:
            props.push({ shape: 'box', size: [0.3, 0.16, 0.45], pos: [back, WY + 0.5, z], rot: [0.15, 0, 0], color: 0x2f7a3a }, { shape: 'cylinder', size: [0.17, 0.04, 0], pos: [back, WY + 0.17, z + 0.6], rot: [0, 0, Math.PI / 2], color: 0x24262a });
        }
      }
      // Posters on the sheeting and the spray pipe along it, its nozzles every few metres.
      const face = outX(side, SHED_WALK - 0.14);
      for (let z = shedZ0 + 8, k = 0; z < shedZ1 - 4; z += 17, k++) if (clear(face, z, 1)) props.push({ shape: 'box', size: [0.015, 0.4, 0.55], pos: [face, WY + 2.1, z], color: [0xe0b020, 0x2f7a3a, 0x2f62a8, 0xe8e8e2][(k + (side > 0 ? 1 : 0)) % 4], ghost: true });
      props.push({ shape: 'cylinder', size: [0.05, shedHalf - 1, 0], pos: [outX(side, SHED_WALK - 0.12), WY + 3.4, shedMid], rot: [Math.PI / 2, 0, 0], color: 0x9aa0a6, ghost: true });
      for (let z = shedZ0 + 2; z < shedZ1 - 1; z += 3.2) props.push({ shape: 'box', size: [0.06, 0.06, 0.06], pos: [outX(side, SHED_WALK - 0.2), WY + 3.3, z], color: 0x3a3f45, ghost: true });
      for (const [a, b] of [[shedZ0 + 10, shedZ0 + 34], [shedZ0 + 66, shedZ0 + 92]]) crowds.push({ area: [Math.min(outX(side, SHED_IN + 0.8), outX(side, SHED_WALK - 0.8)), side > 0 ? a : a + 12, Math.max(outX(side, SHED_IN + 0.8), outX(side, SHED_WALK - 0.8)), side > 0 ? b : b + 12], count: 1, y: WY, workers: true, fenced: true });
    }
  }
  // The forecourt between the high street and the door. A height bar over the way, striped; the cabin of the man who
  // works the bins beside the door, its window to the road; the light. Lorries in a row of bays to the west, waiting.
  const bar = shedZ0 - 16;
  for (const side of [-1, 1]) props.push({ shape: 'box', size: [0.2, 2.8, 0.2], pos: [outX(side, SHED_IN + 1.2), TOP + 2.8, bar], color: 0xe0b020 });
  props.push({ shape: 'box', size: [SHED_IN + 1.4, 0.25, 0.2], pos: [B[0], TOP + 5.3, bar], color: 0xe0b020, ghost: true, overhead: true });
  for (let x = -SHED_IN - 0.6; x < SHED_IN + 1; x += 1.2) props.push({ shape: 'box', size: [0.3, 0.26, 0.21], pos: [B[0] + x, TOP + 5.3, bar], rot: [0, 0, 0.6], color: 0x24262a, ghost: true, overhead: true });
  const cabin: Vec2 = [outX(1, SHED_IN + 3.2), shedZ0 - 5];
  props.push({ shape: 'box', size: [1.4, 1.4, 1.6], pos: [cabin[0], TOP + 1.4, cabin[1]], color: 0xd8d2c4 }, { shape: 'box', size: [1.6, 0.1, 1.8], pos: [cabin[0], TOP + 2.85, cabin[1]], color: 0x2f5f8a, ghost: true });
  props.push({ shape: 'box', size: [0.02, 0.5, 1.1], pos: [cabin[0] - 1.42, TOP + 1.8, cabin[1]], color: 0x3a4a5a, ghost: true });
  object('signalMast', outX(-1, SHED_IN + 1.2), shedZ0 - 3, Math.PI / 2, TOP);
  // A white line across the way where lorries stop for the light; a yellow box hatched under the height bar.
  decals.push({ pos: [B[0], shedZ0 - 6], size: [LOADOUT_WIDE - 0.6, 0.45], color: 0xe8e4d8, base: TOP, y: 0.03 });
  for (let t = -3; t <= 3; t += 1.5) decals.push({ pos: [B[0] + t, bar], size: [0.3, 3.6], rotY: 0.7, color: 0xe8b81e, base: TOP, y: 0.03 });
  for (let n = 0; n < 4; n++) {
    const x = B[0] - SHED_IN - 3.5 - n * 4.5;
    decals.push({ pos: [x - 2.25, bar + 4], size: [0.16, 11], color: 0xe8e4d8, base: TOP, y: 0.02 });
    if (n !== 2) lorry(x, bar + 4, 0);
    if (n === 0) decals.push({ pos: [x + 2.25, bar + 4], size: [0.16, 11], color: 0xe8e4d8, base: TOP, y: 0.02 });
  }
  // Its yards either side, at the shed's flanks: a loader on the west one working its spill back up to the heaps.
  machines.push({ kind: 'loader', pos: [outX(-1, SHED_WALL + 6), shedMid + 12], yaw: 0, area: [xOf(6) - 7, shedMid - 5, outX(-1, SHED_WALL + 1.5), shedMid + 30] });

  // The descent: from the load-out's north end down to the dike, two bends, cut into the land falling to the ponds. In its
  // middle, where it runs level a little way, a loader works a heap on either side and crosses the way between them;
  // culverts stacked at the outside of the first bend and pipes left lying in the way after it.
  // North 18 m, a bend west, 32 m level across the slope (where the loader works), a bend north, and down 56 m at 8.5% to
  // the dike.
  const bend1: Vec2 = [B[0], zOf(30) + 2], bend2: Vec2 = [C[0], bend1[1]];
  const SHELF = 11;
  road([
    { x: B[0], z: B[1] + LOADOUT_TO - 1, h: TOP },
    { x: bend1[0], z: bend1[1], h: SHELF, round: 10 },
    { x: bend2[0], z: bend2[1], h: SHELF, round: 10 },
    { x: C[0], z: C[1] + DIKE_FROM, h: PONDS + DIKE_H },
  ], 7);
  // The loader's floor, the level stretch's height, either side of it; its two heaps, one either side, which it goes
  // between across the way.
  const work: Vec2 = [(bend1[0] + bend2[0]) / 2, bend1[1]];
  relief.area([[work[0] - 7, work[1] - 13], [work[0] + 7, work[1] - 13], [work[0] + 7, work[1] + 13], [work[0] - 7, work[1] + 13]], SHELF, GRAVEL);
  for (const side of [-1, 1]) object('gravelPile', work[0] + side * 2, work[1] + side * 10);
  machines.push({ kind: 'loader', pos: [work[0], work[1] + 8], yaw: Math.PI, area: [work[0] - 5, work[1] - 11, work[0] + 5, work[1] + 11] });
  // Culverts stacked at the outside of the first bend, one rolled off; pipes left lying in the way past the loader.
  object('culvertStack', bend1[0] + 6, bend1[1] + 2, 0);
  object('culvert', bend1[0] + 3.5, bend1[1] + 5.5, 0.6);
  for (const [dx, dz, yaw] of [[-9, 1.2, 0.2], [-13, -1.6, -0.3]] as const) object('pipe', work[0] + dx, work[1] + dz, yaw);
  object('chevron', bend1[0] + 4.4, bend1[1] + 4.4, -Math.PI / 4);
  object('chevron', bend2[0] - 4.4, bend2[1] - 4.4, Math.PI * 0.75);

  // C: the dike.
  const along = dike(site, C[0], C[1], PONDS);
  // Left lying along it past where its edges are walled: cones, a barrow, cans, pallets, a barrel, a box. Light: knocked
  // flying, and into the water as often as not, where they float off on the slow current to where it goes out.
  const DIKE_LITTER: [number, number, ObjectKindId, number][] = [
    [114, 1, 'cone', 0.5], [117, 1, 'cone', 0.5], [133, -1, 'pallet', 0.8], [140, 1, 'wheelbarrow', 0.9], [152, -1, 'jerrycan', 0.4],
    [153.2, -1, 'jerrycan', 0.4], [176, 1, 'cone', 0.5], [181, -1, 'cone', 0.5], [200, 1, 'barrel', 0.7], [206, -1, 'box', 0.6],
    [236, 1, 'cone', 0.5], [240, -1, 'pallet', 0.8],
  ];
  for (const [dz, side, kind, inset] of DIKE_LITTER) {
    const [x, z, yaw] = along(dz, side, inset);
    object(kind, x, z, yaw + hash(dz, 5) * 0.6, PONDS + DIKE_H);
    if (kind === 'pallet') object(kind, x, z, yaw + hash(dz, 6) * 0.3, PONDS + DIKE_H + 0.15);
  }
  // The machines' pads: sandbags along their outer edges, a can and a cone by them; knocked, into the water and down.
  /** Put down on a pad at the dike's height: where the dike bends, a place reckoned along it can fall off the pad's end. */
  const onPad = (kind: ObjectKindId, x: number, z: number, yaw: number) => later.push(() => {
    if (Math.abs(ground(x, z) - PONDS - DIKE_H) < 0.2) objects.push({ kind, pos: [x, PONDS + DIKE_H, z], rotY: yaw });
  });
  const PADS: [number, number, number, number][] = [[16, -1, 7.5, 7], [35, 1, 9, 5], [49, -1, 9.5, 4.5], [66, 1, 6, 6], [123, 1, 9, 4.5], [217, -1, 7.5, 7], [229, 1, 7.5, 7]];
  for (const [dz, side, out, half] of PADS) {
    for (let d = -half + 0.6; d < half - 0.4; d += 0.95) {
      const [x, z, yaw] = along(dz + d, side, -out + 0.35);
      onPad('sandbag', x, z, yaw);
    }
    const [cx, cz] = along(dz - half + 1, side, -1.2);
    onPad(dz % 2 ? 'jerrycan' : 'cone', cx, cz, hash(dz, 7) * 3);
  }
  // The machines' pads held up out of the water by sheet piling: dark steel, ribbed, a waling along its top.
  {
    const foot = PONDS - POND_DOWN - 0.25, top = PONDS + DIKE_H + 0.05;
    const pile = (a: Vec2, b: Vec2, low: Vec2) => {
      const long = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      const ux = (b[0] - a[0]) / long, uz = (b[1] - a[1]) / long, mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      props.push({ shape: 'box', size: [0.03, (top - foot) / 2, long / 2], pos: [mid[0] + low[0] * 0.04, (top + foot) / 2, mid[1] + low[1] * 0.04], rot: [0, yaw, 0], color: 0x4f565e, ghost: true });
      for (let d = 0.3, n = 0; d < long - 0.2; d += 0.6, n++) {
        props.push({ shape: 'box', size: [0.08, (top - foot) / 2, 0.15], pos: [a[0] + ux * d + low[0] * 0.1, (top + foot) / 2, a[1] + uz * d + low[1] * 0.1], rot: [0, yaw, 0], color: n % 2 ? 0x5a626b : 0x454c54, ghost: true });
      }
      props.push({ shape: 'box', size: [0.14, 0.14, long / 2 + 0.1], pos: [mid[0] + low[0] * 0.2, top - 0.3, mid[1] + low[1] * 0.2], rot: [0, yaw, 0], color: 0x3a3f45, ghost: true });
    };
    for (const [dz, side, out, half] of PADS) {
      const [ex] = along(dz, side, 0), ox = ex + side * out, z0 = C[1] + dz - half, z1 = C[1] + dz + half;
      pile([ox, z0], [ox, z1], [side, 0]);
      pile([ex, z0], [ox, z0], [0, -1]);
      pile([ex, z1], [ox, z1], [0, 1]);
    }
    // Ruts worn along the dike's top by the machines' lorries.
    for (let dz = 1; dz < DIKE_TO - 1; dz += 1.3) for (const inset of [2.1, 4.4]) {
      const [x, z, yaw] = along(dz, -1, inset);
      decals.push({ pos: [x, z], size: [0.5, 1.45], rotY: yaw, color: 0x766852, base: PONDS + DIKE_H, y: 0.02 });
    }
  }
  // Under the dike, a culvert the west side's water goes out through, its headwall at the dike's foot.
  const WATER_Y = PONDS - POND_DOWN, CULVERT: Vec2 = [C[0] - 2.5 - DIKE_WIDE / 2 - 2.9, C[1] + 150];
  props.push({ shape: 'box', size: [0.4, 1.3, 2.4], pos: [CULVERT[0] + 0.4, WATER_Y + 0.6, CULVERT[1]], color: 0xb4b6b2 });
  props.push({ shape: 'cylinder', size: [0.65, 0.3, 0], pos: [CULVERT[0], WATER_Y + 0.25, CULVERT[1]], rot: [0, 0, Math.PI / 2], color: 0x2a2c30, ghost: true });
  for (const dz of [-0.45, 0, 0.45]) props.push({ shape: 'box', size: [0.05, 0.6, 0.04], pos: [CULVERT[0] - 0.05, WATER_Y + 0.3, CULVERT[1] + dz], color: STEEL_GREY, ghost: true });
  // What goes in either side of the dike: west, to the culvert; east, to the weir out into the clear pond.
  const stillWater: StillWaterDesc[] = [
    { area: [xOf(3) + 8.8, zOf(34) - 8, C[0], zOf(49) + 8], surface: WATER_Y, outlet: [CULVERT[0] - 1.5, CULVERT[1]], drift: 0.6, muddy: true },
    { area: [C[0], zOf(34) - 8, xOf(6) + 7.2, zOf(49) + 8], surface: WATER_Y, outlet: [xOf(6) + 6, zOf(37)], drift: 0.6, muddy: true },
  ];
  // The ponds drawn as still water: the dike's either side settling, the slurry pond brown, the clear one green.
  const pools: NonNullable<LevelDef['pools']> = [
    // Their ripples going the way the water goes, as fast as what floats on it: toward where it goes out.
    ...stillWater.map((w) => {
      const dx = w.outlet[0] - (w.area[0] + w.area[2]) / 2, dz = w.outlet[1] - (w.area[1] + w.area[3]) / 2, d = Math.hypot(dx, dz) || 1;
      return { area: w.area, surface: WATER_Y + 0.015, tint: 0x948e68, flow: [(dx / d) * w.drift * 0.6, (dz / d) * w.drift * 0.6] as Vec2 };
    }),
    ...lots('w').map((w) => ({ area: [w.x0, w.z0, w.x1, w.z1] as [number, number, number, number], surface: WATER_Y + 0.015, tint: 0x8f7652 })),
    ...lots('c').map((c) => ({ area: [c.x0, c.z0, c.x1, c.z1] as [number, number, number, number], surface: WATER_Y + 0.015, tint: 0x4f7f72 })),
    // The pool below the weir's lip carried on round the bank's corner at its upstream end, up to the way down.
    { area: [D[0] + RIVER_LIP - FALL_WIDE, D[1] - 22, D[0] + RIVER_LIP, D[1] - 16], surface: RIVER_Y + FALL_SURFACE, tint: 0x3f6f88 },
  ];
  // Its mouth, where the descent comes down onto it: the works' board over the bank on one side, a notice on the other.
  for (const dx of [-1.9, 1.9]) props.push({ shape: 'box', size: [0.08, 1.6, 0.08], pos: [C[0] - 13 + dx, 11.8, zOf(33) + 5], color: STEEL_GREY });
  signs.push({ kind: 'pondWorks', pos: [C[0] - 13, 13.2, zOf(33) + 5], rotY: Math.PI });
  signs.push({ kind: 'works', pos: [C[0] + 10, 10, zOf(33) + 4], rotY: Math.PI });
  // The pond gang's safety board, by their break, facing the way down.
  signs.push({ kind: 'safety', pos: [C[0] + 18, 13.4, zOf(33) + 5], rotY: Math.PI });
  // The ponds parted from each other by bunds of earth too narrow to drive on, a little above the water, the pipe that
  // carries the water from one to the next laid along each. Nothing either side of the dike goes anywhere but into a pond.
  // The water goes from the slurry pond on the west over a weir into the ponds either side of the dike, and out of them
  // over another into the clear pond on the east; the dried pond west of the dike walled off from them by a bund too.
  const BUNDS: [number, number, number, number][] = [
    [xOf(3) + 8, zOf(34) - 8, xOf(3) + 8, zOf(44) + 8],
    [xOf(6) + 8, zOf(34) - 8, xOf(6) + 8, zOf(41) + 8],
    [xOf(-2) - 8, zOf(38) + 8, xOf(3) + 8, zOf(38) + 8],
  ];
  const BUND_TOP = PONDS - POND_DOWN + 1;
  for (const [x0, z0, x1, z1] of BUNDS) {
    const alongZ = x0 === x1, long = alongZ ? z1 - z0 : x1 - x0;
    relief.area(alongZ ? rect(x0 - 0.8, z0, x0 + 0.8, z1) : rect(x0, z0 - 0.8, x1, z0 + 0.8), BUND_TOP, DIKE);
    props.push({ shape: 'cylinder', size: [0.22, long / 2, 0], pos: [(x0 + x1) / 2, BUND_TOP + 0.22, (z0 + z1) / 2], rot: alongZ ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2], color: 0x2c4f8a, ghost: true });
    for (let d = 20; d < long - 10; d += 40) props.push({ shape: 'box', size: [0.5, 0.45, 0.5], pos: alongZ ? [x0, BUND_TOP + 0.45, z0 + d] : [x0 + d, BUND_TOP + 0.45, z0], color: 0x5f646a, ghost: true });
  }
  /** A weir in a bund running along z: a concrete sill let into it, the water pouring over it white into the pond downstream, east. */
  const weir = (x: number, z: number) => {
    props.push({ shape: 'box', size: [1, 0.4, 2.2], pos: [x, BUND_TOP - 0.2, z], color: 0xb4b6b2 });
    props.push({ shape: 'box', size: [0.9, 0.04, 2], pos: [x, BUND_TOP + 0.05, z], color: 0x8a9a8a, ghost: true });
    for (let k = 0; k < 14; k++) decals.push({ pos: [x + 1.2 + hash(k, 81) * 3.5, z + (hash(k, 82) - 0.5) * 4.5], size: [0.5 + hash(k, 83), 0.4 + hash(k, 84) * 0.8], rotY: hash(k, 85) * 3, color: 0xe8ece6, base: PONDS - POND_DOWN, y: 0.03 });
  };
  weir(xOf(3) + 8, zOf(36));
  weir(xOf(6) + 8, zOf(37));
  // The way down off the press's yard into the dried pond, for the excavator and the lorries that carry its mud away.
  relief.ribbon([{ x: xOf(-1), z: zOf(44) - 10, h: 3.9 }, { x: xOf(-1), z: zOf(45) + 2, h: 5.6 }], 5, HAUL);

  // The pump station. Off the dike's north end on to the pump station's yard, which lies behind the river's levee at the
  // dike's height; out through the levee at its flood gate, a cut walled in concrete with the gate hung up over it; and
  // down the river's bank, walled the same, to the water. What is on the way is for the look of it and for knocking about:
  // the flood gang's sandbags and pumps, the bank's anglers; nothing to be got past.
  const off: Vec2 = [C[0] + DIKE_END_OFF, C[1] + DIKE_TO];
  const PUMP_Y = PONDS + DIKE_H;
  relief.area(rect(PUMP_YARD.x0, PUMP_YARD.z0, PUMP_YARD.x1, PUMP_YARD.z1), PUMP_Y, CONCRETE);
  road([
    { x: off[0], z: off[1], h: PUMP_Y },
    { x: GATE_X, z: PUMP_YARD.z1 - 2, h: PUMP_Y, round: 6 },
    { x: GATE_X, z: GATE_TO, h: 3.4 },
    { x: RAMP_FOOT[0], z: RAMP_FOOT[1], h: RIVER_Y },
    // On a little way into the river, so that its end meets the river's bed all across.
    { x: RAMP_FOOT[0] + 0.7, z: RAMP_FOOT[1] + 2.5, h: RIVER_Y - 0.3 },
  ], 6.5, CONCRETE, false);
  // The pump house against the levee east of the gate, its doors to the way, its name over them.
  {
    const x0 = 93, x1 = PUMP_YARD.x1, z0 = PUMP_YARD.z0 + 1, z1 = PUMP_YARD.z1, y = PUMP_Y, tall = 6.6;
    const x = (x0 + x1) / 2, z = (z0 + z1) / 2;
    props.push({ shape: 'box', size: [(x1 - x0) / 2, tall / 2, (z1 - z0) / 2], pos: [x, y + tall / 2, z], color: 0xd8d4c8 });
    props.push({ shape: 'box', size: [(x1 - x0) / 2 + 0.05, 0.4, (z1 - z0) / 2 + 0.05], pos: [x, y + 0.4, z], color: 0x9aa0a6 });
    props.push({ shape: 'box', size: [(x1 - x0) / 2 + 0.4, 0.2, (z1 - z0) / 2 + 0.4], pos: [x, y + tall + 0.2, z], color: 0x6f747a });
    for (const dz of [-3, 3]) {
      props.push({ shape: 'box', size: [0.03, 1.8, 1.6], pos: [x0 - 0.03, y + 1.8, z + dz], color: 0x4f6f8a, ghost: true });
      for (let up = 0.3; up < 3.5; up += 0.3) props.push({ shape: 'box', size: [0.035, 0.015, 1.6], pos: [x0 - 0.04, y + up, z + dz], color: 0x3f5f7a, ghost: true });
    }
    for (const dz of [-4.5, -1.5, 1.5, 4.5]) props.push({ shape: 'box', size: [0.03, 0.35, 0.6], pos: [x0 - 0.03, y + 5, z + dz], color: 0x3a4a5a, ghost: true });
    signs.push({ kind: 'pumpStation', pos: [x0 - 0.1, y + 4.3, z], rotY: -Math.PI / 2 });
  }
  // The flood gate: a steel frame on the levee either side of the cut, the gate hung up in it, striped along its foot,
  // the name across the beam; the slots it comes down in, in the walls; the levee's footway across the cut on a bridge.
  {
    const z = GATE_TO - 9, top = LEVEE_TOP, wall = 3.25;
    const zone: NonNullable<PropDesc['fadeZone']> = [[GATE_X - 6, 2, z - 9], [GATE_X + 6, top + 9, GATE_TO + 3]];
    for (const side of [-1, 1]) {
      props.push({ shape: 'box', size: [0.45, 3.4, 0.6], pos: [GATE_X + side * (wall + 0.9), top + 3.4, z], color: 0x5f7f9a });
      props.push({ shape: 'box', size: [0.08, 3.2, 0.25], pos: [GATE_X + side * (wall - 0.04), top - 3.2, z], color: 0x2e3034, ghost: true });
    }
    props.push({ shape: 'box', size: [wall + 1.5, 0.45, 0.55], pos: [GATE_X, top + 7, z], color: 0x5f7f9a, ghost: true, overhead: true, fade: true, fadeZone: zone });
    props.push({ shape: 'box', size: [wall + 0.2, 1.9, 0.22], pos: [GATE_X, top + 4.4, z], color: 0x7e8a94, ghost: true, overhead: true, fade: true, fadeZone: zone });
    for (let i = 0; i < 8; i++) props.push({ shape: 'box', size: [(wall + 0.2) / 8 - 0.01, 0.18, 0.24], pos: [GATE_X - wall - 0.2 + (i + 0.5) * ((wall + 0.2) / 4), top + 2.7, z], color: i % 2 ? 0x24262a : 0xf2c12e, ghost: true, overhead: true, fade: true, fadeZone: zone });
    signs.push({ kind: 'floodGate', pos: [GATE_X, top + 7.95, z - 0.35], rotY: Math.PI, fadeZone: zone });
    const bz = GATE_TO - 3.5;
    props.push({ shape: 'box', size: [wall + 0.4, 0.18, 1.1], pos: [GATE_X, top - 0.18, bz], color: 0xa4a8aa, ghost: true, overhead: true, fade: true, fadeZone: zone });
    for (const dz of [-1.05, 1.05]) {
      props.push({ shape: 'box', size: [wall + 0.4, 0.03, 0.03], pos: [GATE_X, top + 1, bz + dz], color: STEEL_GREY, ghost: true, overhead: true, fade: true, fadeZone: zone });
      for (let dx = -wall; dx <= wall + 0.1; dx += 1.3) props.push({ shape: 'box', size: [0.025, 0.5, 0.025], pos: [GATE_X + dx, top + 0.5, bz + dz], color: STEEL_GREY, ghost: true, overhead: true, fade: true, fadeZone: zone });
    }
  }

  // The flats' edge on the west rising as a wooded bank to the woods above, not a wall.
  relief.area(rect(xOf(-3) - 8, zOf(53) - 8, xOf(-3) + 8, zOf(63) + 8), (x) => RIVER_BANK + ((xOf(-3) + 8 - x) * 9) / 16, WOOD);
  // The river's west bank along the crossing laid back as a slope of rock down to the channel under the weir, as a river's
  // bank is armoured, not stood up as a wall; at its north end the bank going down to the sand bar the same way, in sand;
  // and the woods beyond the sand bar rising from it on a bank of their own.
  const CHANNEL_X = D[0] + RIVER_LIP - FALL_WIDE, BANK_FROM = CHANNEL_X - 10;
  relief.area(rect(BANK_FROM, D[1] - 16, CHANNEL_X, D[1] + 150), (x) => RIVER_BANK - ((x - BANK_FROM) / 10) * (RIVER_BANK + 4.2), RIPRAP);
  // And round the corner at its upstream end, down to the water in front of the way down, so that no shelf of the bank
  // stands out past it.
  // Laid in small pieces, each sampling the corner's shape at its own corners, since across a whole square it is no plane.
  {
    const corner = (x: number, z: number) => Math.max(-4.2, Math.max(RIVER_BANK - ((x - BANK_FROM) / 10) * (RIVER_BANK + 4.2), RIVER_BANK - ((z - (D[1] - 24)) / 8) * (RIVER_BANK + 4.2)));
    for (let x = BANK_FROM; x < RAMP_FOOT[0] - 3 - 0.01; x += 1.5) for (let z = D[1] - 24; z < D[1] - 16 - 0.01; z += 1) relief.area(rect(x, z, Math.min(x + 1.5, RAMP_FOOT[0] - 3), z + 1), corner, RIPRAP);
  }
  relief.area(rect(xOf(-2) - 8, zOf(63) + 8 - 8, BANK_FROM, zOf(63) + 8 + 4), (_x, z) => RIVER_BANK * Math.max(0, Math.min(1, (zOf(63) + 12 - z) / 12)), SAND);
  // The sign at the stockpiles' mouth, for the gravel on the corner.
  signs.push({ kind: 'slippery', pos: [A[0] + 5.5, TOP, A[1] + YARD_TO - 14], rotY: Math.PI });

  // D: the crossing. The deep river upstream of it, east, drawn running too, and its edge marked with poles: off them the
  // water is over a truck.
  riverCrossing(site, D[0], D[1], RIVER_Y);
  fords.push({ pos: [D[0] + RIVER_EAST + 22, D[1] + 70], half: [22, 89], flow: [-RIVER_FLOW, 0], drag: 0.1, grip: 0.65, sideGrip: 0.13, surface: RIVER_Y + RIVER_SURFACE, deep: true });
  for (let dz = -8; dz < 152; dz += 6) object('rallyPole', D[0] + RIVER_EAST - 0.6, D[1] + dz, 0, RIVER_Y - 1.05);
  // Where the deep water comes up over the drop on to the shallows it breaks white all along: a line of standing waves.
  // Orange floats on a line beyond it, a little out over the deep.
  for (let dz = -10; dz < 152; dz += 1.1) {
    decals.push({ pos: [D[0] + RIVER_EAST + 0.3 + hash(dz, 41) * 0.8, D[1] + dz], size: [0.5 + hash(dz, 42) * 0.9, 0.6 + hash(dz, 43) * 0.9], rotY: hash(dz, 44), color: 0xf2f7f8, base: RIVER_Y + RIVER_SURFACE, y: 0.03 });
  }
  for (let dz = -7; dz < 152; dz += 4) {
    props.push({ shape: 'cylinder', size: [0.32, 0.16, 0], pos: [D[0] + RIVER_EAST + 3, RIVER_Y + RIVER_SURFACE + 0.08, D[1] + dz], color: 0xf07a1e, ghost: true });
    if (dz % 8 === 1) props.push({ shape: 'cylinder', size: [0.33, 0.04, 0], pos: [D[0] + RIVER_EAST + 3, RIVER_Y + RIVER_SURFACE + 0.2, D[1] + dz], color: 0xf2f2ec, ghost: true });
  }
  for (let dz = -7; dz < 152; dz += 2) props.push({ shape: 'cylinder', size: [0.02, 1, 0], pos: [D[0] + RIVER_EAST + 3, RIVER_Y + RIVER_SURFACE + 0.12, D[1] + dz + 1], rot: [Math.PI / 2, 0, 0], color: 0xd8d8d0, ghost: true });

  // The second half, from the sand bar on: the bridge, the site, the buildings.
  const field = D[1] + RIVER_OUT;
  const end = secondHalf(site, signs, [D[0], field]);
  const birds: BirdDesc[] = [];
  scenery(site, { yard, parkZ, bend1, bend2, off, field }, () => ground, later, lorry, birds);

  const { terrain } = relief.build();
  ground = (x, z) => heightAt(terrain, x, z);
  for (const add of later) add();

  const spawn: [number, number, number] = [A[0], TOP + 0.9, yard.z0 + 12];
  return {
    id: 'quarry',
    name: '第 3 關　砂石場',
    brief: '從砂石場大門出發：鑽料堆、閃落石、過堤道機具、渡河、過便橋，衝上工地頂樓卸貨',
    ground: { center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2], half: [(max[0] - min[0]) / 2 + 200, (max[1] - min[1]) / 2 + 200], style: 'earth' },
    terrain,
    sinks: ['water', 'drop'],
    slicks,
    stillWater,
    pools: [...pools, ...end.pools],
    wet: end.wet,
    birds,
    bounds: [min, max],
    spawn,
    heading: 0,
    startLine: { pos: [A[0], yard.z1 - 1], dir: [0, 1] },
    props,
    objects,
    decals,
    signs,
    cargo: quarryLoad(),
    traffic,
    machines,
    rigs,
    droppers,
    fords,
    crowds,
    route: [
      [A[0], yard.z0 + 12], [A[0], A[1]], [A[0], parkZ], [B[0], parkZ], [B[0], B[1] + LOADOUT_TO], bend1, bend2,
      [C[0], C[1] + DIKE_FROM], off, [D[0], D[1] + RIVER_IN], ...end.route,
    ],
    checkpoints: [
      { name: 'A 料堆', pos: [A[0], A[1] - 6], yaw: 0 },
      { name: '廠區大街', pos: [A[0], A[1] + YARD_TO - 10], yaw: 0 },
      { name: 'B 裝料區', pos: [B[0], B[1] + LOADOUT_FROM + 2], yaw: 0 },
      { name: '下坡', pos: [B[0], B[1] + LOADOUT_TO - 4], yaw: 0 },
      { name: 'C 堤道', pos: [C[0], C[1] + DIKE_FROM - 4], yaw: 0 },
      { name: '抽水站', pos: [off[0], off[1] - 4], yaw: 0 },
      { name: 'D 渡河', pos: [D[0], D[1] + RIVER_IN - 4], yaw: 0 },
      ...end.checkpoints,
    ],
    finish: end.finish,
    stars: [0, 0.6],
    par: 180,
  };
}

/**
 * Level 3's load, for the building on the roof: a fridge and the big toilet standing side by side against the cab, a row of
 * crates behind them, and the tins of paint, three rows of them, behind. The map is the hard part: the fridge is the
 * big thing that tips and goes over the side, the toilet what minds a landing, the paint what makes a mess of the truck.
 */
function quarryLoad(): CargoPlacement[] {
  const cargo: CargoPlacement[] = [];
  const floor = TRUCK.frame.pos[1] + TRUCK.frame.half[1];
  const gap = 0.01;
  const on = (half: number) => floor + half + gap;
  cargo.push({ type: 'fridge', pos: [-0.62, on(0.85), 1.5], rotY: Math.PI });
  cargo.push({ type: 'toilet', pos: [0.58, on(0.38 * 1.6), 1.3] });
  for (const x of [-0.74, 0, 0.74]) cargo.push({ type: 'crate', pos: [x, on(0.35), 0.35] });
  const TINS = ['paintRed', 'paintBlue', 'paintYellow'] as const;
  for (const [row, z] of [-0.5, -1.15, -1.8].entries()) for (const [n, x] of [-0.78, -0.26, 0.26, 0.78].entries()) cargo.push({ type: TINS[(n + row * 2) % 3], pos: [x, on(0.19 * 1.4), z] });
  return cargo;
}

/** Where the ways run, for the scenery to keep off them. */
interface Ways {
  yard: { x0: number; x1: number; z0: number; z1: number };
  parkZ: number;
  bend1: Vec2;
  bend2: Vec2;
  off: Vec2;
  field: number;
}

type Spot = [number, number, number];

/** A lot: a rectangle of squares of one kind, edges in metres. */
interface Lot {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** The lots of one kind of square: each run of them that makes a rectangle, taken from the south-west corner. */
function lots(kind: string): Lot[] {
  const out: Lot[] = [];
  const seen = new Set<number>();
  MAP.forEach((row, r) => [...row].forEach((ch, i) => {
    if (ch !== kind || seen.has(r * 100 + i)) return;
    let wide = 1;
    while (row[i + wide] === kind && !seen.has(r * 100 + i + wide)) wide++;
    let long = 1;
    while (r + long < MAP.length && [...Array(wide).keys()].every((k) => MAP[r + long][i + k] === kind)) long++;
    for (let dr = 0; dr < long; dr++) for (let k = 0; k < wide; k++) seen.add((r + dr) * 100 + i + k);
    out.push({ x0: xOf(i + COL0) - CELL / 2, x1: xOf(i + wide - 1 + COL0) + CELL / 2, z0: zOf(r) - CELL / 2, z1: zOf(r + long - 1) + CELL / 2 });
  }));
  return out;
}

/** The middle of every square of the kinds given, with a number of its own. */
function squares(kinds: string): { x: number; z: number; k: number; ch: string }[] {
  const out: { x: number; z: number; k: number; ch: string }[] = [];
  MAP.forEach((row, r) => [...row].forEach((ch, i) => {
    if (kinds.includes(ch)) out.push({ x: xOf(i + COL0), z: zOf(r), k: r * 131 + i * 17, ch });
  }));
  return out;
}

/**
 * Everything round about the ways, laid out square by square as levels 1 and 2 are, each square or lot of squares one thing
 * and its things arranged as that thing has them. The plant's terrace: its road down the middle with lamps, and either side
 * of it lots, each a shed with its apron, silos in a row, a cone heap fed by a belt from the crusher, containers stacked in
 * rows, lorries parked in bays, the office behind its fence, the crusher itself; lawn between. Woodland on the ground round
 * about. The quarry's benches: a berm of boulders along each edge, rubble at the foot of each face, a drilling pattern
 * with its rig, an excavator loading a lorry. The ponds' banks grassed, reeds along the water. Thickets and rocks on the
 * river's banks. The equipment yard above the ponds. Fences along the cuttings' tops. Hills all round beyond.
 */
function scenery(s: Site, w: Ways, groundOf: () => (x: number, z: number) => number, later: (() => void)[], lorry: (x: number, z: number, yaw: number) => void, birds: BirdDesc[]): void {
  const { props, decals } = s;
  later.push(() => {
    const ground = groundOf();
    /** Ground taken by something already: where and how far round. */
    const taken: Spot[] = [];
    const ways: [Vec2, Vec2, number][] = [
      [[A[0], w.yard.z0 - 10], [A[0], w.yard.z1], 30],
      [[A[0], A[1] + YARD_TO - 10], [A[0], w.parkZ], 10],
      [[A[0], w.parkZ], [B[0], w.parkZ], 6],
      // The plant's streets.
      [[B[0], zOf(1) - 8], [B[0], w.parkZ], 6],
      ...[4, 9, 14].map((r): [Vec2, Vec2, number] => [[A[0] + YARD_HALF + 2, zOf(r)], [xOf(9) + 8, zOf(r)], 6]),
      [[B[0], w.parkZ + 30], [B[0], B[1] + LOADOUT_TO], 17],
      [[B[0], B[1] + LOADOUT_TO], w.bend1, 10],
      [w.bend1, w.bend2, 10],
      [w.bend2, [C[0], C[1] + DIKE_FROM], 10],
      [[C[0], C[1] + DIKE_FROM], [C[0], C[1] + DIKE_TO], 14],
      [w.off, [GATE_X, PUMP_YARD.z1 - 2], 7],
      [[GATE_X, PUMP_YARD.z1 - 2], [GATE_X, GATE_TO], 7],
      [[GATE_X, GATE_TO], RAMP_FOOT, 7],
      [[D[0] - 6, D[1] + RIVER_IN], [D[0] - 6, w.field + 30], 28],
      // The loader's shelf.
      [[(w.bend1[0] + w.bend2[0]) / 2, w.bend1[1] - 13], [(w.bend1[0] + w.bend2[0]) / 2, w.bend1[1] + 13], 8],
      // The power line's way through the trees.
      [[1, 0], [1, 470], 3],
    ];
    const free = (x: number, z: number, r: number) =>
      ways.every(([a, b, room]) => {
        const dx = b[0] - a[0], dz = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
        return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) > room + r;
      }) && taken.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) > r + tr);
    const level = (x: number, z: number, r: number) => {
      const h = ground(x, z);
      return [[r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, -r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, r * 0.7]].every(([dx, dz]) => Math.abs(ground(x + dx, z + dz) - h) < 0.25);
    };
    const shade = (color: number, f: number) => {
      const ch = (k: number) => Math.max(0, Math.min(255, Math.round(((color >> k) & 255) * f)));
      return (ch(16) << 16) | (ch(8) << 8) | ch(0);
    };
    /** Something standing that takes up ground: put down at the ground's height there, and kept clear of. */
    const at = (x: number, z: number, r: number) => {
      taken.push([x, z, r]);
      return ground(x, z);
    };

    const ROCKS = [0x8a8378, 0x7d7a72, 0x9a948a, 0x8f8a80];
    const LEAVES = [0x5f7a3f, 0x6f8a4a, 0x7f9658, 0x4f6a38, 0x6a8048];
    const STEEL = 0x8c9096, YELLOW = 0xe0a81e, WHITE = 0xe8e8e2;
    const rock = (x: number, z: number, y: number, k: number, size: number) => {
      const color = ROCKS[Math.floor(hash(k, 2) * 4)];
      props.push({ shape: 'box', size: [size, size * 0.65, size * 0.8], pos: [x, y + size * 0.45, z], rot: [hash(k, 3) * 0.3, hash(k, 4) * 3, hash(k, 5) * 0.25], color });
    };
    const bush = (x: number, z: number, y: number, k: number) => {
      for (let i = 0; i < 3; i++) {
        const r = 0.7 + hash(k, 8 + i) * 0.6;
        props.push({ shape: 'cone', size: [r, r * 0.7, 0], pos: [x + (i - 1) * 0.9, y + r * 0.6, z + (hash(k, 12 + i) - 0.5) * 1.2], color: LEAVES[(k + i) % 5], ghost: true });
      }
    };
    const tree = (x: number, z: number, y: number, k: number) => {
      const tall = 2.4 + hash(k, 15) * 2.2, r = 1.8 + hash(k, 16) * 1.2, color = LEAVES[k % 5];
      props.push({ shape: 'cylinder', size: [0.18, tall / 2, 0], pos: [x, y + tall / 2, z], color: 0x6b4a2e });
      if (hash(k, 17) < 0.3) {
        props.push({ shape: 'cone', size: [r, r, 0], pos: [x, y + tall + r * 0.7, z], color, ghost: true });
        props.push({ shape: 'cone', size: [r * 0.7, r * 0.75, 0], pos: [x, y + tall + r * 1.7, z], color: shade(color, 1.1), ghost: true });
      } else {
        props.push({ shape: 'cylinder', size: [r, r * 0.55, 0], pos: [x, y + tall + r * 0.5, z], color, ghost: true });
        props.push({ shape: 'cone', size: [r * 1.05, r * 0.6, 0], pos: [x, y + tall + r * 1.6, z], color: shade(color, 1.1), ghost: true });
      }
    };
    const reeds = (x: number, z: number, y: number, k: number) => {
      for (let i = 0; i < 6; i++) props.push({ shape: 'cone', size: [0.08, 0.55 + hash(k, 20 + i) * 0.5, 0], pos: [x + (hash(k, 30 + i) - 0.5) * 1.2, y + 0.6, z + (hash(k, 40 + i) - 0.5) * 1.2], color: i % 2 ? 0x8a9a4a : 0x6f8a3f, ghost: true });
    };
    /** A shipping container, level 1's: lying along X at yaw 0, along Z at a quarter turn. */
    const container = (x: number, z: number, y: number, yaw: number, color: number) => containerModel(props, x, y, z, Math.abs(Math.sin(yaw)) < 0.5, color);
    /** A belt in its gallery from one place up or down to another, on legs. */
    const conveyor = (a: Spot, b: Spot) => {
      const dx = b[0] - a[0], dz = b[2] - a[2], dy = b[1] - a[1], run = Math.hypot(dx, dz), long = Math.hypot(run, dy);
      const rot: [number, number, number] = [0, Math.atan2(-dz, dx), Math.atan2(dy, run)];
      const mid: [number, number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      props.push({ shape: 'box', size: [long / 2, 0.3, 0.7], pos: mid, rot, color: STEEL, ghost: true });
      props.push({ shape: 'box', size: [long / 2, 0.35, 0.8], pos: [mid[0], mid[1] + 0.6, mid[2]], rot, color: 0xb8bcc0, ghost: true });
      for (let t = 0.15; t < 0.9; t += 9 / long) {
        const x = a[0] + dx * t, z = a[2] + dz * t, top = a[1] + dy * t, y = ground(x, z);
        if (top - y > 1.5) props.push({ shape: 'box', size: [0.2, (top - y) / 2, 0.5], pos: [x, (top + y) / 2, z], color: STEEL });
      }
    };
    const mast = (x: number, z: number) => {
      const y = at(x, z, 1);
      props.push({ shape: 'cylinder', size: [0.16, 7, 0], pos: [x, y + 7, z], color: STEEL });
      props.push({ shape: 'box', size: [1.2, 0.25, 0.4], pos: [x, y + 14.2, z], color: 0x3a3f45 });
      props.push({ shape: 'box', size: [1.1, 0.1, 0.35], pos: [x, y + 13.9, z], color: 0xf2e6b0, ghost: true });
    };
    /** A fence of posts and two rails from one place to another, along the ground. */
    const fence = (a: Vec2, b: Vec2) => {
      const long = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      // Posts every 2.5 m and one at the end; the rails from each to the next, the last cut short there.
      for (let d = 0; d < long + 0.01; d += 2.5) {
        const x = a[0] + ((b[0] - a[0]) * d) / long, z = a[1] + ((b[1] - a[1]) * d) / long, y = ground(x, z);
        props.push({ shape: 'box', size: [0.06, 0.7, 0.06], pos: [x, y + 0.7, z], color: 0x5f646a });
        const span = Math.min(2.5, long - d);
        if (span > 0.05) for (const up of [0.6, 1.25]) props.push({ shape: 'box', size: [0.03, 0.03, span / 2], pos: [x + (Math.sin(yaw) * span) / 2, y + up, z + (Math.cos(yaw) * span) / 2], rot: [0, yaw, 0], color: STEEL, ghost: true });
        if (d + 2.5 > long && long - d > 0.3) {
          const ex = b[0], ez = b[1];
          props.push({ shape: 'box', size: [0.06, 0.7, 0.06], pos: [ex, ground(ex, ez) + 0.7, ez], color: 0x5f646a });
        }
      }
    };
    const excavator = (x: number, z: number, yaw: number) => {
      const y = at(x, z, 4.5), c = Math.cos(yaw), sn = Math.sin(yaw);
      const p = (f: number, up: number): [number, number, number] => [x + sn * f, y + up, z + c * f];
      for (const side of [-1, 1]) props.push({ shape: 'box', size: [0.5, 0.45, 2.3], pos: [x + c * side * 1.3, y + 0.45, z - sn * side * 1.3], rot: [0, yaw, 0], color: 0x2e3034 });
      props.push({ shape: 'box', size: [1.6, 0.7, 2], pos: p(-0.4, 1.6), rot: [0, yaw, 0], color: YELLOW });
      props.push({ shape: 'box', size: [0.6, 0.75, 0.6], pos: [x + c * 0.8 + sn * 0.7, y + 3, z - sn * 0.8 + c * 0.7], rot: [0, yaw, 0], color: 0x3a4a52 });
      props.push({ shape: 'box', size: [0.3, 0.3, 2.4], pos: p(2.6, 3.4), rot: [-0.5, yaw, 0], color: YELLOW, ghost: true });
      props.push({ shape: 'box', size: [0.25, 1.4, 0.25], pos: p(4.8, 2.6), rot: [0.3, yaw, 0], color: YELLOW, ghost: true });
      props.push({ shape: 'box', size: [0.7, 0.45, 0.5], pos: p(5, 0.6), rot: [0, yaw, 0], color: 0x4a4c50 });
    };
    const drill = (x: number, z: number) => {
      const y = at(x, z, 3);
      props.push({ shape: 'box', size: [1.1, 0.8, 2], pos: [x, y + 0.8, z], color: YELLOW });
      props.push({ shape: 'box', size: [0.25, 4.5, 0.25], pos: [x, y + 5.2, z + 2], rot: [0.12, 0, 0], color: 0xc8372d });
      props.push({ shape: 'box', size: [0.55, 0.6, 0.5], pos: [x, y + 2, z - 1], color: 0x3a4a52 });
    };
    /** Pallets stacked, drums stood in a block, a skip: what stands on a shed's apron, in a row along it. */
    const apronRow = (x: number, z: number, y: number, alongZ: boolean, k: number) => {
      const step = (n: number): [number, number] => (alongZ ? [x, z + n] : [x + n, z]);
      for (const n of [-6, -4.6]) {
        const [px, pz] = step(n);
        for (let i = 0; i < 3 + Math.floor(hash(k, n) * 4); i++) props.push({ shape: 'box', size: [0.6, 0.07, 0.5], pos: [px, y + 0.07 + i * 0.15, pz], color: 0x9a7448 });
      }
      for (let i = 0; i < 6; i++) {
        const [px, pz] = step(-1 + (i % 3) * 0.7);
        props.push({ shape: 'cylinder', size: [0.3, 0.45, 0], pos: [px + (alongZ ? Math.floor(i / 3) * 0.7 : 0), y + 0.45, pz + (alongZ ? 0 : Math.floor(i / 3) * 0.7)], color: [0x2f5f9a, 0x2f5f9a, 0xb5362a][(k + i) % 3] });
      }
      const [sx, sz] = step(4.5);
      props.push({ shape: 'box', size: alongZ ? [1, 0.6, 1.7] : [1.7, 0.6, 1], pos: [sx, y + 0.6, sz], color: hash(k, 9) < 0.5 ? 0xd0a020 : 0x3f6f8a });
    };

    // ---- The plant ----
    /** Which way the plant's own road is from a place: its aprons, bays and doors face it. */
    const roadX = (_z: number) => B[0];
    // Its streets: a dashed line down the middle, lamps along them on either side in turn.
    for (let z = zOf(1) - 2; z < w.parkZ - 6; z += 7) if ([4, 9, 14].every((r) => Math.abs(z - zOf(r)) > 6)) decals.push({ pos: [B[0], z], size: [0.18, 3.2], color: 0xe8e4d8, base: TOP, y: 0.02 });
    for (let z = zOf(1) + 6, n = 0; z < w.parkZ - 8; z += 36, n++) mast(B[0] + (n % 2 ? 5.6 : -5.6), z);
    for (const r of [4, 9, 14]) for (let x = A[0] + YARD_HALF + 5; x < xOf(9) + 6; x += 7) if (Math.abs(x - B[0]) > 6) decals.push({ pos: [x, zOf(r)], size: [3.2, 0.18], color: 0xe8e4d8, base: TOP, y: 0.02 });
    for (let x = A[0] + 14; x < B[0] - 6; x += 7) decals.push({ pos: [x, w.parkZ], size: [3.2, 0.18], color: 0xe8e4d8, base: TOP, y: 0.02 });
    for (let x = A[0] + 20, n = 0; x < B[0] - 8; x += 30, n++) mast(x, w.parkZ + (n % 2 ? 5.6 : -5.6));
    const crushers = lots('X').map((c) => {
      const x = (c.x0 + c.x1) / 2, z = (c.z0 + c.z1) / 2, y = at(x, z, (c.x1 - c.x0) / 2);
      const hx = (c.x1 - c.x0) / 2 - 4, hz = (c.z1 - c.z0) / 2 - 4;
      props.push({ shape: 'box', size: [hx, 5, hz], pos: [x, y + 5, z], color: 0x9aa3a8, fade: true, building: { style: 'shed', open: [true, true, true, true], crown: 0, seed: 31 } });
      props.push({ shape: 'box', size: [5, 4, 5], pos: [x, y + 14, z], color: 0x7e848a, fade: true });
      props.push({ shape: 'box', size: [5.3, 0.3, 5.3], pos: [x, y + 18.3, z], color: 0x5f6a72, fade: true });
      props.push({ shape: 'cone', size: [4, 2.5, 0], pos: [x - 7, y + 15, z], rot: [Math.PI, 0, 0], color: 0x8a7a5e });
      for (const [dx, dz] of [[-9.5, -2.5], [-9.5, 2.5], [-4.5, -2.5], [-4.5, 2.5]]) props.push({ shape: 'box', size: [0.2, 6.5, 0.2], pos: [x + dx, y + 6.5, z + dz], color: STEEL });
      return [x, y + 17, z] as Spot;
    });
    for (const k of lots('K')) {
      const x = (k.x0 + k.x1) / 2, z = (k.z0 + k.z1) / 2, r = Math.min(k.x1 - k.x0, k.z1 - k.z0) / 2 - 1.5, h = r * 0.75, y = at(x, z, r);
      const color = [0xc9b98f, 0x9a948a, 0x857f75][Math.floor(hash(x, z) * 3)];
      props.push({ shape: 'cone', size: [r, h / 2, 0], pos: [x, y + h / 2, z], color });
      props.push({ shape: 'cone', size: [r * 0.55, h * 0.3, 0], pos: [x + r * 0.4, y + h * 0.25, z - r * 0.25], color: shade(color, 0.92), ghost: true });
      const from = crushers.find((c) => Math.hypot(c[0] - x, c[2] - z) < 110);
      if (from) conveyor(from, [x, y + h + 1.5, z]);
      else conveyor([x - r - 4, y + 1, z], [x, y + h + 1.5, z]);
    }
    for (const o of lots('O')) {
      const alongX = o.x1 - o.x0 >= o.z1 - o.z0, long = alongX ? o.x1 - o.x0 : o.z1 - o.z0;
      const n = Math.max(1, Math.floor((long - 3) / 6.4)), x = (o.x0 + o.x1) / 2, z = (o.z0 + o.z1) / 2, y = at(x, z, long / 2);
      for (let i = 0; i < n; i++) {
        const d = (i - (n - 1) / 2) * 6.4, sx = alongX ? x + d : x, sz = alongX ? z : z + d;
        props.push({ shape: 'cylinder', size: [2.8, 6, 0], pos: [sx, y + 10, sz], color: 0xc7c9c4 });
        props.push({ shape: 'cone', size: [2.8, 1.2, 0], pos: [sx, y + 17.2, sz], color: 0xb0b2ad });
        props.push({ shape: 'cone', size: [2.8, 1.5, 0], pos: [sx, y + 2.5, sz], rot: [Math.PI, 0, 0], color: 0xb0b2ad });
        for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) props.push({ shape: 'box', size: [0.15, 2.2, 0.15], pos: [sx + dx, y + 2.2, sz + dz], color: STEEL });
      }
      props.push({ shape: 'box', size: alongX ? [n * 3.2, 0.15, 0.7] : [0.7, 0.15, n * 3.2], pos: [x, y + 18.6, z], color: STEEL, ghost: true });
      // The hut that works them, at the end toward the road.
      const hx = alongX ? x : x + Math.sign(roadX(z) - x) * 5.5, hz = alongX ? (o.z0 + 2.5) : z + (n * 3.2 + 2);
      props.push({ shape: 'box', size: [1.5, 1.3, 1.2], pos: [hx, y + 1.3, hz], color: 0xd8d2c4 }, { shape: 'box', size: [1.7, 0.1, 1.4], pos: [hx, y + 2.65, hz], color: 0x2f5f8a, ghost: true });
    }
    for (const sh of lots('S')) {
      const z = (sh.z0 + sh.z1) / 2, toward = Math.sign(roadX(z) - (sh.x0 + sh.x1) / 2) || 1;
      // The apron, 6 m deep, on the side toward the road; the shed on the rest.
      const x0 = sh.x0 + (toward < 0 ? 7 : 1.5), x1 = sh.x1 - (toward > 0 ? 7 : 1.5);
      const x = (x0 + x1) / 2, y = at(x, z, Math.hypot((x1 - x0) / 2, (sh.z1 - sh.z0) / 2));
      props.push({ shape: 'box', size: [(x1 - x0) / 2, 4 + hash(x, z) * 2.5, (sh.z1 - sh.z0) / 2 - 1.5], pos: [x, y + 4 + hash(x, z) * 2.5, z], color: 0x9aa3a8, fade: true, building: { style: 'shed', open: [true, true, true, true], crown: 0, seed: Math.round(x * 7 + z) } });
      apronRow(toward > 0 ? x1 + 3 : x0 - 3, z, y, true, Math.round(x + z));
    }
    const BOXES = [0x3f6f8a, 0x8a4a3a, 0x4f7a4a, 0xb5862e, 0x7a3f3a];
    for (const c of lots('C')) {
      const y = at((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2, 0);
      const cols = Math.floor((c.x1 - c.x0 - 2) / 6.6);
      for (let i = 0; i < cols; i++) {
        const x = c.x0 + 1 + 3.3 + i * 6.6;
        for (let z = c.z0 + 2.5, row = 0; z < c.z1 - 1.5; z += row % 2 ? 4.4 : 2.6, row++) {
          const k = Math.round(x * 3 + z * 7);
          if (hash(k, 1) < 0.12) continue;
          const high = hash(k, 2) < 0.45 ? 2 : 1;
          for (let n = 0; n < high; n++) container(x, z, y + n * 2.6, n * 0.03, BOXES[Math.floor(hash(k, 3 + n) * 5)]);
        }
      }
      taken.push([(c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2, Math.hypot(c.x1 - c.x0, c.z1 - c.z0) / 2]);
    }
    for (const v of lots('V')) {
      // Bays across the lot, 4.5 m apart, their mouths toward the road; a lorry in most.
      const z0 = v.z0 + 2, toward = Math.sign(roadX(z0) - (v.x0 + v.x1) / 2) || 1;
      const mouth = toward > 0 ? v.x1 - 1 : v.x0 + 1, back = mouth - toward * 11;
      const y = at((v.x0 + v.x1) / 2, (v.z0 + v.z1) / 2, 0);
      for (let z = z0; z <= v.z1 - 2; z += 4.5) {
        decals.push({ pos: [(mouth + back) / 2, z], size: [11, 0.16], color: 0xe8e4d8, base: y, y: 0.02 });
        if (z + 4.5 <= v.z1 - 2 && hash(z, v.x0) < 0.7) lorry((mouth + back) / 2, z + 2.25, toward > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
      // Behind the bays, the wash pad: a lorry being hosed down on it, the water running off it dark, the washer and its
      // tank, the hose reel; tyres waiting to go on beside it.
      const far = toward > 0 ? v.x0 : v.x1, depth = Math.abs(back - far);
      if (depth > 12) {
        const wx = (back + far) / 2, wz = (v.z0 + v.z1) / 2;
        decals.push({ pos: [wx, wz], size: [7, 13], color: 0x7f868c, base: y, y: 0.02 });
        for (let k = 0; k < 9; k++) decals.push({ pos: [wx + (hash(k, wx) - 0.5) * 7, wz + (hash(wx, k) - 0.5) * 13], size: [1 + hash(k, 3) * 1.6, 0.8 + hash(k, 4) * 1.4], rotY: hash(k, 5) * 3, color: 0x5f666c, base: y, y: 0.03 });
        lorry(wx, wz, 0);
        const tx = wx - toward * 6, tz = wz - 4;
        props.push({ shape: 'cylinder', size: [1, 1.2, 0], pos: [tx, y + 1.2, tz], color: 0x2f62a8 }, { shape: 'box', size: [0.5, 0.45, 0.4], pos: [tx, y + 0.45, tz + 2], color: YELLOW });
        props.push({ shape: 'cylinder', size: [0.45, 0.25, 0], pos: [tx, y + 0.6, tz + 3.4], rot: [0, 0, Math.PI / 2], color: 0x3a3f45 });
        for (let i = 0; i < 3; i++) s.object('tyreStack', tx, wz + 3 + i * 1.6);
        s.crowds.push({ area: [wx - 3.5, wz - 6, wx + 3.5, wz + 6], count: 1, y, workers: true });
        taken.push([wx, wz, 8]);
      }
      taken.push([(v.x0 + v.x1) / 2, (v.z0 + v.z1) / 2, Math.hypot(v.x1 - v.x0, v.z1 - v.z0) / 2]);
    }
    for (const f of lots('F')) {
      // The office: two portacabins side by side and one on top, windows, a stair; its fence round the lot with the gate to the
      // road; a flagpole, pots by the door, scooters in a row.
      const x = (f.x0 + f.x1) / 2, z = (f.z0 + f.z1) / 2, y = at(x, z, Math.hypot(f.x1 - f.x0, f.z1 - f.z0) / 2);
      const toward = Math.sign(roadX(z) - x) || 1;
      for (const [dz, up] of [[-1.3, 0], [1.3, 0], [0, 1]] as const) {
        props.push({ shape: 'box', size: [3.05, 1.3, 1.2], pos: [x - toward * 3, y + 1.3 + up * 2.6, z + dz], color: up ? 0xd8d2c4 : 0xe4e0d4 });
        for (const wx of [-1.8, 0, 1.8]) props.push({ shape: 'box', size: [0.5, 0.4, 0.02], pos: [x - toward * 3 + wx, y + 1.6 + up * 2.6, z + dz + (dz < 0 ? -1.22 : 1.22)], color: 0x3a4a5a, ghost: true });
      }
      props.push({ shape: 'box', size: [0.5, 1.3, 0.5], pos: [x - toward * 3 + 3.6, y + 1.3, z + 2.2], rot: [0, 0, 0.5], color: STEEL, ghost: true });
      props.push({ shape: 'cylinder', size: [0.06, 4, 0], pos: [x + toward * 3, y + 4, z - 4], color: 0xd8d8d8 }, { shape: 'box', size: [0.02, 0.5, 0.75], pos: [x + toward * 3, y + 7.4, z - 3.2], color: 0x2f62a8, ghost: true });
      for (const dz of [-3, -2.2, 3, 3.8]) props.push({ shape: 'cylinder', size: [0.3, 0.3, 0], pos: [x + toward * 0.6, y + 0.3, z + dz], color: 0xb5533c }, { shape: 'cone', size: [0.4, 0.4, 0], pos: [x + toward * 0.6, y + 1, z + dz], color: 0x4f8a4a, ghost: true });
      for (let i = 0; i < 4; i++) props.push({ shape: 'box', size: [0.8, 0.45, 0.2], pos: [x + toward * 3.5, y + 0.45, z + 5 + i * 0.7], color: [0xc8372d, 0x2f5f9a, WHITE, 0x3a3f45][i] });
      const gx = toward > 0 ? f.x1 - 0.5 : f.x0 + 0.5, bx = toward > 0 ? f.x0 + 0.5 : f.x1 - 0.5;
      fence([bx, f.z0 + 0.5], [gx, f.z0 + 0.5]);
      fence([bx, f.z1 - 0.5], [gx, f.z1 - 0.5]);
      fence([bx, f.z0 + 0.5], [bx, f.z1 - 0.5]);
      fence([gx, f.z0 + 0.5], [gx, z - 3]);
      fence([gx, z + 3], [gx, f.z1 - 0.5]);
    }
    /** A roof on posts over a rectangle, high above the ground at y: seen through when it is between the camera and the truck. */
    const canopy = (x0: number, x1: number, z0: number, z1: number, y: number, high: number, color: number) => {
      props.push({ shape: 'box', size: [(x1 - x0) / 2, 0.2, (z1 - z0) / 2], pos: [(x0 + x1) / 2, y + high, (z0 + z1) / 2], color, overhead: true, fade: true, ghost: true });
      for (const x of [x0 + 0.3, (x0 + x1) / 2, x1 - 0.3]) for (const z of [z0 + 0.3, z1 - 0.3]) props.push({ shape: 'box', size: [0.15, high / 2, 0.15], pos: [x, y + high / 2, z], color: STEEL });
    };
    for (const m of lots('W')) {
      // The workshop: an open shed over two bays, a lorry in each with its mouth to the street; worn tyres stacked against
      // the back and lying about, drums, the compressor and its hose, a toolbox, a jack.
      const toward = Math.sign(roadX(m.z0) - (m.x0 + m.x1) / 2) || 1;
      const mouth = toward > 0 ? m.x1 - 1 : m.x0 + 1, back = mouth - toward * 22;
      const y = at((m.x0 + m.x1) / 2, (m.z0 + m.z1) / 2, 0);
      canopy(Math.min(mouth, back), Math.max(mouth, back), m.z0 + 2, m.z1 - 8, y, 6.5, 0x7e848a);
      for (const [n, dz] of [6.5, 15].entries()) {
        lorry((mouth + back) / 2 + toward * 1.5, m.z0 + dz, toward > 0 ? Math.PI / 2 : -Math.PI / 2);
        decals.push({ pos: [(mouth + back) / 2, m.z0 + dz + 4.2], size: [11, 0.16], color: 0xe8e4d8, base: y, y: 0.02 });
        if (n === 0) props.push({ shape: 'box', size: [0.5, 0.25, 0.5], pos: [(mouth + back) / 2 - toward * 2, y + 0.25, m.z0 + dz + 2.2], color: YELLOW });
      }
      for (let i = 0; i < 6; i++) s.object('tyreStack', back + toward * 1.2, m.z0 + 3 + i * 1.5);
      for (let i = 0; i < 8; i++) s.object('tyre', back + toward * (4 + hash(i, 61) * 16), m.z1 - 6 + hash(i, 62) * 4, hash(i, 63) * 3);
      for (let i = 0; i < 4; i++) s.object('barrel', back + toward * 1.2, m.z1 - 7 + i * 0.85);
      props.push({ shape: 'box', size: [0.6, 0.55, 0.9], pos: [back + toward * 2.5, y + 0.55, m.z0 + 23], color: 0xc8372d });
      props.push({ shape: 'cylinder', size: [0.35, 0.8, 0], pos: [back + toward * 2.5, y + 1.45, m.z0 + 23], rot: [Math.PI / 2, 0, 0], color: 0xc8372d });
      props.push({ shape: 'box', size: [0.4, 0.5, 0.8], pos: [back + toward * 3.4, y + 0.5, m.z0 + 26], color: 0xb5362a });
      taken.push([(m.x0 + m.x1) / 2, (m.z0 + m.z1) / 2, Math.hypot(m.x1 - m.x0, m.z1 - m.z0) / 2]);
    }
    for (const u of lots('U')) {
      // The filling station off the high street: a roof over two islands of pumps, a lorry at one, the tank lying behind,
      // the price board on its pole at the street.
      const y = at((u.x0 + u.x1) / 2, (u.z0 + u.z1) / 2, 0);
      const x = (u.x0 + u.x1) / 2, z = u.z0 + 13;
      canopy(u.x0 + 4, u.x1 - 4, z - 6, z + 6, y, 5.5, 0xe8e8e2);
      props.push({ shape: 'box', size: [(u.x1 - u.x0) / 2 - 4, 0.35, 0.05], pos: [x, y + 5.2, z - 6.05], color: 0xc8372d, ghost: true });
      for (const dx of [-6, 6]) {
        props.push({ shape: 'box', size: [0.7, 0.15, 3], pos: [x + dx, y + 0.15, z], color: 0xd8d2c4 });
        for (const dz of [-1.5, 1.5]) {
          props.push({ shape: 'box', size: [0.35, 0.8, 0.25], pos: [x + dx, y + 1.1, z + dz], color: 0xe8e8e2 });
          props.push({ shape: 'box', size: [0.36, 0.2, 0.26], pos: [x + dx, y + 1.6, z + dz], color: 0xc8372d, ghost: true });
        }
      }
      lorry(x + 2.6, z, Math.PI / 2);
      props.push({ shape: 'cylinder', size: [1.4, 4.5, 0], pos: [x, y + 1.6, u.z1 - 4], rot: [0, 0, Math.PI / 2], color: WHITE });
      for (const dx of [-3, 3]) props.push({ shape: 'box', size: [0.3, 0.4, 1.2], pos: [x + dx, y + 0.4, u.z1 - 4], color: STEEL });
      const px = u.x1 - 2, pz = u.z0 + 2;
      props.push({ shape: 'cylinder', size: [0.12, 2.5, 0], pos: [px, y + 2.5, pz], color: STEEL }, { shape: 'box', size: [0.9, 1.2, 0.1], pos: [px, y + 5.6, pz], color: 0xc8372d });
      for (const [k, up] of [0, 1, 2].entries()) props.push({ shape: 'box', size: [0.7, 0.2, 0.02], pos: [px, y + 5.1 + up * 0.45, pz - 0.11], color: k ? 0xf2e6b0 : WHITE, ghost: true });
      taken.push([x, (u.z0 + u.z1) / 2, Math.hypot(u.x1 - u.x0, u.z1 - u.z0) / 2]);
    }
    for (const h of lots('H')) {
      // The canteen: a row of portacabins at the back with windows, an awning along its front, tables under sunshades, the
      // drinks machine, bins; the crews' scooters parked in a row at the street.
      const y = at((h.x0 + h.x1) / 2, (h.z0 + h.z1) / 2, 0);
      const back = h.z1 - 4;
      for (let x = h.x0 + 5; x < h.x1 - 3; x += 6.3) {
        props.push({ shape: 'box', size: [3.05, 1.4, 1.5], pos: [x, y + 1.4, back], color: 0xe4e0d4 });
        for (const wx of [-1.6, 1.4]) props.push({ shape: 'box', size: [0.6, 0.45, 0.02], pos: [x + wx, y + 1.7, back - 1.52], color: 0x3a4a5a, ghost: true });
      }
      props.push({ shape: 'box', size: [(h.x1 - h.x0) / 2 - 2, 0.06, 1.4], pos: [(h.x0 + h.x1) / 2, y + 2.7, back - 2.6], rot: [-0.15, 0, 0], color: 0x2f7a5a, overhead: true, fade: true, ghost: true });
      for (const [n, x] of [h.x0 + 6, h.x0 + 13, h.x0 + 20].entries()) {
        const z = back - 9 + (n % 2) * 1.5;
        s.object('umbrella', x, z);
        s.object('table', x, z);
        for (const [dx, dz] of [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]]) s.object('chair', x + dx, z + dz, Math.atan2(-dx, -dz));
      }
      props.push({ shape: 'box', size: [0.5, 0.95, 0.4], pos: [h.x1 - 4, y + 0.95, back - 2], color: 0xc8372d }, { shape: 'box', size: [0.4, 0.6, 0.02], pos: [h.x1 - 4, y + 1.15, back - 2.42], color: 0xe8e8e2, ghost: true });
      for (const dx of [-1.3, -2.2]) s.object('bin', h.x1 + dx - 4, back - 2.2);
      const SCOOTERS: ObjectKindId[] = ['scooterRed', 'scooterBlue', 'scooterWhite', 'scooterBlack', 'scooterYellow', 'scooterTeal'];
      for (let i = 0; i < 9; i++) s.object(SCOOTERS[i % 6], h.x0 + 4 + i * 0.85, h.z0 + 2.5, Math.PI);
      taken.push([(h.x0 + h.x1) / 2, (h.z0 + h.z1) / 2, Math.hypot(h.x1 - h.x0, h.z1 - h.z0) / 2]);
    }
    for (const z of lots('Z')) {
      // Building stuff stored along the yard's wall, in bays a few metres long one after another: concrete pipes in a
      // pyramid, steel beams on bearers, bricks on pallets, culverts stood on end, a pile of sand. The wall's side kept
      // tidy, the street's side open for the forklift.
      const y = at((z.x0 + z.x1) / 2, (z.z0 + z.z1) / 2, 0), x = z.x0 + 6.5;
      for (let bz = z.z0 + 4, n = 0; bz < z.z1 - 3; bz += 7.5, n++) {
        switch (n % 5) {
          case 0:
            for (let i = 0; i < 3; i++) for (let j = 0; j <= 2 - i; j++) props.push({ shape: 'cylinder', size: [0.5, 2.4, 0], pos: [x, y + 0.5 + i * 0.85, bz - 1 + j + i * 0.5], rot: [0, 0, Math.PI / 2], color: 0xa9a59b });
            break;
          case 1:
            for (const dz of [-1.6, 1.6]) props.push({ shape: 'box', size: [3, 0.15, 0.2], pos: [x, y + 0.15, bz + dz], color: 0x6b5a46 });
            for (let i = 0; i < 3; i++) for (let j = 0; j < 4 - i; j++) props.push({ shape: 'box', size: [0.2, 0.2, 2.6], pos: [x - 1.1 + j * 0.6 + i * 0.3, y + 0.5 + i * 0.4, bz], color: 0x7a5a48 });
            break;
          case 2:
            for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.object('bricks', x + dx, bz + dz);
            break;
          case 3:
            for (const dz of [-1.4, 1.4]) props.push({ shape: 'cylinder', size: [0.6, 0.6, 0], pos: [x - 1, y + 0.6, bz + dz], color: 0xa9a59b }, { shape: 'cylinder', size: [0.47, 0.01, 0], pos: [x - 1, y + 1.21, bz + dz], color: 0x55595f, ghost: true });
            s.object('culvert', x + 2.2, bz, 0.3);
            break;
          default:
            props.push({ shape: 'cone', size: [3, 1.3, 0], pos: [x - 0.5, y + 1.3, bz], color: 0xcdbb8e });
        }
      }
      // A forklift waiting by the bays.
      s.object('forklift', z.x1 - 3, (z.z0 + z.z1) / 2, Math.PI);
      taken.push([(z.x0 + z.x1) / 2, (z.z0 + z.z1) / 2, Math.hypot(z.x1 - z.x0, z.z1 - z.z0) / 2]);
    }
    for (const j of lots('J')) {
      // The loading shed's yards, either side of it. Its bins fed by belts in through the open band under its eaves: one
      // out of the cone heap to the west, one off the top of the silos to the east. On the west yard spares for the bins
      // and belts: a hopper on a stand, idler rollers stacked, the fitters' container, a ladder against the sheeting. On
      // the east yard rolls of new belting stood on edge, drums, pallets and a skip.
      const y = TOP, west = B[0] - SHED_WALL, east = B[0] + SHED_WALL;
      const heap = lots('K').find((k) => k.x1 <= west && k.z0 < j.z0 + 1);
      if (heap) {
        const z = (heap.z0 + heap.z1) / 2;
        conveyor([(heap.x0 + heap.x1) / 2 + 14, y + 1, z], [west - 0.2, y + 11, z]);
      }
      const silos = lots('O').find((o) => o.x0 >= east && o.z0 < j.z0 + 1);
      if (silos) conveyor([(silos.x0 + silos.x1) / 2, y + 18.6, silos.z0 + 32], [east + 0.2, y + 11.5, silos.z0 + 32]);
      // The hopper on its stand.
      const hx = west - 5, hz = j.z0 + 8;
      for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) props.push({ shape: 'box', size: [0.1, 0.8, 0.1], pos: [hx + dx, y + 0.8, hz + dz], color: STEEL });
      props.push({ shape: 'box', size: [1.1, 0.6, 1.1], pos: [hx, y + 2.6, hz], color: 0xa08a52 }, { shape: 'cone', size: [1.1, 0.5, 0], pos: [hx, y + 1.6, hz], rot: [Math.PI, 0, 0], color: 0xa08a52 });
      // Idler rollers in a pyramid on bearers.
      const ix = west - 9, iz = j.z0 + 18;
      for (let i = 0; i < 3; i++) for (let k = 0; k < 4 - i; k++) props.push({ shape: 'cylinder', size: [0.16, 0.8, 0], pos: [ix, y + 0.3 + i * 0.28, iz - 1.3 + k * 0.34 + i * 0.17 + 0.5], rot: [0, 0, Math.PI / 2], color: i % 2 ? 0x5f646a : 0x7a7f86 });
      for (const dz of [-1, 1.4]) props.push({ shape: 'box', size: [1, 0.07, 0.1], pos: [ix, y + 0.07, iz + dz], color: 0x6b5a46 });
      // The fitters' container, its doors open toward the shed; a ladder against the sheeting by it.
      container(west - 11, j.z1 - 14, y, Math.PI / 2, 0x3f6f8a);
      props.push({ shape: 'box', size: [0.03, 1.2, 0.5], pos: [west - 9.4, y + 1.3, j.z1 - 14 + 3.4], rot: [0, 1.1, 0], color: 0x35617c, ghost: true });
      const lz = j.z1 - 6, lean = Math.atan2(1.2, 5.4);
      for (const dz of [-0.25, 0.25]) props.push({ shape: 'box', size: [0.04, 2.8, 0.04], pos: [west - 0.7, y + 2.75, lz + dz], rot: [0, 0, -lean], color: 0xb8bcc0, ghost: true });
      for (let up = 0.4; up < 5.4; up += 0.35) props.push({ shape: 'box', size: [0.02, 0.02, 0.25], pos: [west - 1.3 + (up / 5.4) * 1.2, y + up, lz], color: 0xb8bcc0, ghost: true });
      // East: belting on edge, drums, pallets, a skip.
      for (let i = 0; i < 3; i++) props.push({ shape: 'cylinder', size: [0.95, 0.35, 0], pos: [east + 5, y + 0.95, j.z0 + 30 + i * 0.9], rot: [Math.PI / 2, 0, 0], color: 0x2a2c30 });
      apronRow(east + 4, j.z1 - 20, y, true, Math.round(j.x1 + j.z1));
      taken.push([(j.x0 + j.x1) / 2, (j.z0 + j.z1) / 2, Math.hypot(j.x1 - j.x0, j.z1 - j.z0) / 2]);
    }
    // Lawn: a row of shrubs along an edge of some squares.
    for (const { x, z, k } of squares('G')) {
      if (hash(k, 70) > 0.5) continue;
      const alongX = hash(k, 71) < 0.5, side = hash(k, 72) < 0.5 ? -6 : 6;
      for (let d = -6; d <= 6; d += 3) {
        const bx = alongX ? x + d : x + side, bz = alongX ? z + side : z + d;
        if (free(bx, bz, 1) && level(bx, bz, 1)) bush(bx, bz, ground(bx, bz), k + d);
      }
    }

    // ---- The quarry's benches ----
    // A berm of boulders along the edge of each bench, where it drops to the one below.
    for (const [x, z1] of [[-25.6, 452], [-9.6, 452]] as const) {
      for (let z = -6, n = 0; z < z1; z += 2.4, n++) if (level(x, z, 0.6)) rock(x + (hash(n, x) - 0.5) * 0.6, z, ground(x, z), n + Math.round(x), 0.75 + hash(n, 7) * 0.35);
    }
    // Rubble fallen to the foot of each face.
    for (let z = 10; z < 450; z += 34) {
      const x = -22.5, y = ground(x, z);
      props.push({ shape: 'cone', size: [3.2 + hash(z, 1) * 1.5, 0.9, 0], pos: [x, y + 0.8, z], color: ROCKS[z % 4] });
    }
    // A drilling pattern on the top bench: holes in rows, the rig at work at the end of the last.
    for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) decals.push({ pos: [-46 + i * 3, 116 + j * 3], size: [0.45, 0.45], color: 0x2e2c28, base: 30, y: 0.02 });
    drill(-37, 137);
    drill(-44, 330);
    // An excavator loading a lorry from a muck pile at the foot of the top face.
    props.push({ shape: 'cone', size: [5.5, 1.8, 0], pos: [-50, ground(-50, 214) + 1.6, 214], color: ROCKS[1] });
    taken.push([-50, 214, 6]);
    excavator(-42, 214, -Math.PI / 2);
    lorry(-37, 222, 0);

    // The power line down the hill between the quarry and the yard, poles and wires.
    let last: Spot | null = null;
    for (let z = 6; z < 470; z += 32) {
      const x = 1, y = at(x, z, 0.6);
      props.push({ shape: 'cylinder', size: [0.16, 5.5, 0], pos: [x, y + 5.5, z], color: 0x6b5a46 });
      props.push({ shape: 'box', size: [1.3, 0.08, 0.08], pos: [x, y + 10.4, z], color: 0x3a3f45 });
      if (last) for (const dx of [-1.1, 0, 1.1]) {
        const top: Spot = [x + dx, y + 10.55, z];
        const run = Math.hypot(top[1] - last[1], top[2] - last[2]);
        props.push({ shape: 'box', size: [0.02, 0.02, run / 2], pos: [top[0], (top[1] + last[1]) / 2 - 0.4, (top[2] + last[2]) / 2], rot: [-Math.atan2(top[1] - last[1], top[2] - last[2]), 0, 0], color: 0x2a2c30, ghost: true });
      }
      last = [x, y + 10.55, z];
    }

    // A berm of boulders along the top of the rock between the high street, the filling station and the plant's heaps.
    for (let z = zOf(19) - 6, n = 0; z < zOf(28) + 7; z += 2.4, n++) rock(xOf(1) + 6.6 + (hash(n, 9) - 0.5) * 0.6, z, ground(xOf(1) + 6.6, z), n + 900, 0.75 + hash(n, 8) * 0.35);
    // The haul road along the rock above the stockpile yard's west wall, at the bench's height: a track worn in it, ruts,
    // a lorry coming down it and one going up, the water lorry laying the dust, the grader; the face below it drilled.
    {
      const hx = -4, top = 18, z0 = -4, z1 = zOf(28) + 4;
      decals.push({ pos: [hx, (z0 + z1) / 2], size: [7, z1 - z0], color: 0x8f8470, base: top, y: 0.02 });
      for (const dx of [-1.6, 1.6]) decals.push({ pos: [hx + dx, (z0 + z1) / 2], size: [0.5, z1 - z0], color: 0x766a58, base: top, y: 0.03 });
      for (let z = 30, n = 0; z < z1 - 4; z += 4 + hash(n, 3) * 6, n++) decals.push({ pos: [hx + (hash(n, 4) - 0.5) * 4, z], size: [1.2 + hash(n, 5), 0.8 + hash(n, 6)], rotY: hash(n, 7) * 3, color: 0x7a6e5c, base: top, y: 0.04 });
      lorry(hx - 1.6, 96, 0);
      lorry(hx + 1.6, 318, Math.PI);
      {
        const wz = 196;
        props.push({ shape: 'cylinder', size: [1, 2.6, 0], pos: [hx, top + 2, wz - 0.8], rot: [Math.PI / 2, 0, 0], color: 0xe8e8e2 });
        props.push({ shape: 'box', size: [1.15, 0.9, 1], pos: [hx, top + 1.6, wz + 2.6], color: 0x2f62a8 });
        props.push({ shape: 'box', size: [1.2, 0.3, 4.2], pos: [hx, top + 0.7, wz], color: 0x3a3f45 });
        for (const dz of [-2.6, -1.2, 2.4]) for (const dx of [-1, 1]) props.push({ shape: 'cylinder', size: [0.45, 0.2, 0], pos: [hx + dx, top + 0.45, wz + dz], rot: [0, 0, Math.PI / 2], color: 0x2a2c30 });
        for (let k = 0; k < 6; k++) decals.push({ pos: [hx + (hash(k, 11) - 0.5) * 5, wz - 6 - k * 3.4], size: [3 + hash(k, 12) * 2, 2.6], rotY: hash(k, 13), color: 0x6e6352, base: top, y: 0.05 });
      }
      {
        const gz = 410;
        props.push({ shape: 'box', size: [1.1, 0.7, 3.4], pos: [hx, top + 1.2, gz], color: YELLOW });
        props.push({ shape: 'box', size: [0.9, 0.7, 0.8], pos: [hx, top + 2.4, gz + 2.2], color: 0x3a4a52 });
        props.push({ shape: 'box', size: [1.6, 0.3, 0.12], pos: [hx, top + 0.35, gz - 0.4], rot: [0, 0.4, 0], color: 0x5a5d62 });
        for (const dz of [-2.4, 2.6]) for (const dx of [-1.1, 1.1]) props.push({ shape: 'cylinder', size: [0.5, 0.25, 0], pos: [hx + dx, top + 0.5, gz + dz], rot: [0, 0, Math.PI / 2], color: 0x2a2c30 });
      }
      for (let z = 6; z < 290; z += 1.7) props.push({ shape: 'box', size: [0.03, 2.6 + hash(z, 1) * 0.3, 0.05], pos: [8.03, 15, z], color: 0x6f685e, ghost: true });
      for (const z of [40, 170, 300]) props.push({ shape: 'box', size: [0.05, 1.6, 0.05], pos: [hx + 3.4, top + 1.6, z], color: STEEL }, { shape: 'box', size: [0.03, 0.35, 0.5], pos: [hx + 3.4, top + 3, z], color: 0xe0b020 });
    }
    // A fence along the top of the stockpile yard's west side.
    for (const x of [A[0] - YARD_HALF - 1.2]) fence([x, A[1] + YARD_FROM + 2], [x, A[1] + YARD_TO - 12]);

    // The equipment yard above the ponds: the site office, an excavator waiting, sand, pipes stacked, a fuel tank; fenced.
    for (const e of lots('f')) {
      const y = at((e.x0 + e.x1) / 2, (e.z0 + e.z1) / 2, 0);
      for (const [dz, up] of [[3, 0], [5.6, 0], [4.3, 1]] as const) container(e.x0 + 4.5, e.z0 + dz, y + up * 2.6, 0, up ? 0xd8d2c4 : 0xe4e0d4);
      excavator(e.x0 + 16, e.z0 + 9, 1.8);
      props.push({ shape: 'cone', size: [4.5, 1.8, 0], pos: [e.x1 - 6, y + 1.8, e.z1 - 7], color: 0xc9b98f });
      for (let i = 0; i < 4; i++) for (let j = 0; j <= 3 - i; j++) props.push({ shape: 'cylinder', size: [0.34, 2.4, 0], pos: [e.x0 + 6 + j * 0.7 + i * 0.35, y + 0.34 + i * 0.6, e.z1 - 4], rot: [0, 0, Math.PI / 2], color: 0xa9a59b });
      props.push({ shape: 'cylinder', size: [1.1, 2.4, 0], pos: [e.x1 - 5, y + 1.3, e.z0 + 4], rot: [0, 0, Math.PI / 2], color: WHITE });
      fence([e.x0 + 0.5, e.z0 + 0.5], [e.x1 - 0.5, e.z0 + 0.5]);
      fence([e.x0 + 0.5, e.z1 - 0.5], [e.x1 - 0.5, e.z1 - 0.5]);
      fence([e.x0 + 0.5, e.z0 + 0.5], [e.x0 + 0.5, e.z1 - 0.5]);
      taken.push([(e.x0 + e.x1) / 2, (e.z0 + e.z1) / 2, Math.hypot(e.x1 - e.x0, e.z1 - e.z0) / 2]);
    }
    // A rest for the loader's crew at the corner of its shelf: a table, stools, a sunshade.
    {
      const x = (w.bend1[0] + w.bend2[0]) / 2 - 5.5, z = w.bend1[1] - 11.5;
      s.object('umbrella', x, z);
      s.object('table', x, z);
      for (const [dx, dz] of [[0.9, 0], [-0.9, 0], [0, 0.9]]) s.object('chair', x + dx, z + dz, Math.atan2(-dx, -dz));
    }
    excavator(-24, 930, 2.4);

    // ---- The settling ponds ----
    /**
     * Either side of the dike, the ponds the plant's washing water settles in, one after another. On the west the slurry
     * let in, poured from a pipe on a trestle; beyond it a pond let dry, its mud cracked, an excavator digging it out into a
     * lorry; beyond that the filter press in its shed on its yard, its belt dropping the pressed cake on a heap. On the
     * east the clear water at the end, reeds, egrets, the pump on its barge and its floating pipe to the yard where the
     * pump house sends the water back to the plant in pipes along the bank; the sampling hut on its jetty. Fenced and
     * signed along the water.
     */
    const ponds = () => {
      const WATER = PONDS - POND_DOWN, YARD = 5.6, DRY = 3.9;
      const warn = (x: number, z: number, yaw: number) => s.object('signWarn', x, z, yaw);
      /** A pipe from one place to another, straight. */
      const pipe = (a: Spot, b: Spot, r: number, color: number) => {
        const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], run = Math.hypot(dx, dz);
        props.push({ shape: 'cylinder', size: [r, Math.hypot(run, dy) / 2, 0], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [0, Math.atan2(-dz, dx), Math.PI / 2 + Math.atan2(dy, run)], color, ghost: true });
      };
      /** A line of floats on the water from one place to another; with a skirt, a curtain hung from them, showing at the waterline. */
      const floats = (a: Vec2, b: Vec2, color: number, skirt?: number) => {
        const long = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
        for (let d = 0; d <= long; d += 2.2) props.push({ shape: 'box', size: [0.35, 0.2, 0.5], pos: [a[0] + ((b[0] - a[0]) * d) / long, WATER + 0.15, a[1] + ((b[1] - a[1]) * d) / long], rot: [0, yaw, 0], color, ghost: true });
        if (skirt !== undefined) props.push({ shape: 'box', size: [0.06, 0.1, long / 2], pos: [(a[0] + b[0]) / 2, WATER + 0.05, (a[1] + b[1]) / 2], rot: [0, yaw, 0], color: skirt, ghost: true });
      };
      /** A round tank standing on the ground, its roof, rim and a ladder up its side. */
      const tank = (x: number, z: number, y: number, r: number, tall: number, color: number) => {
        taken.push([x, z, r + 1]);
        props.push({ shape: 'cylinder', size: [r, tall / 2, 0], pos: [x, y + tall / 2, z], color });
        props.push({ shape: 'cylinder', size: [r + 0.1, 0.12, 0], pos: [x, y + tall, z], color: STEEL, ghost: true });
        props.push({ shape: 'cone', size: [r, r * 0.16, 0], pos: [x, y + tall + 0.12 + r * 0.16, z], color: shade(color, 0.85), ghost: true });
        props.push({ shape: 'box', size: [0.28, tall / 2 + 0.6, 0.05], pos: [x + r + 0.12, y + tall / 2 + 0.6, z], color: YELLOW, ghost: true });
      };
      /** A flat of something on the water or the ground, round. */
      const disc = (x: number, z: number, y: number, r: number, color: number) => props.push({ shape: 'cylinder', size: [r, 0.08, 0], pos: [x, y, z], color, ghost: true });
      /** An egret standing there; or, empty, only a place for one put up elsewhere to come down. */
      const egret = (x: number, z: number, y: number, yaw: number, empty = false) => birds.push({ pos: [x, y, z], yaw, empty });
      const cracks = (x0: number, z0: number, x1: number, z1: number, n: number, long: number, wide: number, color: number, seed: number) => {
        for (let k = 0; k < n; k++) {
          const x = x0 + 1 + hash(k, seed) * (x1 - x0 - 2), z = z0 + 1 + hash(k, seed + 1) * (z1 - z0 - 2);
          decals.push({ pos: [x, z], size: [wide, long * (0.4 + hash(k, seed + 2))], rotY: hash(k, seed + 3) * 3.14, color, base: DRY, y: 0.02 });
        }
      };
      // The slurry pond: the pipe from the plant along the bank, out over the water on its trestle, pouring; the mud it has
      // dropped spread out in a fan round where it falls, drier nearest; a dredger at the fan's edge pumping the mud out along
      // a floating pipe into the drying beds; a silt curtain across the pond, the water past it a little clearer.
      let dredged: Vec2 = [0, 0];
      for (const w of lots('w')) {
        const px = w.x0 + 24, bank = w.z0 - 8, out = w.z0 + 24, py = 10.6;
        props.push({ shape: 'cylinder', size: [0.4, (w.x1 - px) / 2, 0], pos: [(px + w.x1) / 2, py, bank], rot: [0, 0, Math.PI / 2], color: 0x5f646a });
        props.push({ shape: 'cylinder', size: [0.4, (out - bank) / 2, 0], pos: [px, py, (bank + out) / 2], rot: [Math.PI / 2, 0, 0], color: 0x5f646a });
        for (let z = w.z0 + 2; z < out; z += 7) props.push({ shape: 'box', size: [0.15, (py - WATER) / 2, 0.15], pos: [px, (py + WATER) / 2, z], color: STEEL });
        props.push({ shape: 'cylinder', size: [0.4, 0.9, 0], pos: [px, py - 0.5, out], color: 0x5f646a });
        props.push({ shape: 'box', size: [0.32, (py - 1.4 - WATER) / 2, 0.32], pos: [px, (py - 1.4 + WATER) / 2, out], color: 0x8a7050, ghost: true });
        for (let k = 0; k < 18; k++) {
          const a = hash(k, 91) * 6.28, r = 0.8 + hash(k, 92) * 3;
          decals.push({ pos: [px + Math.cos(a) * r, out + Math.sin(a) * r], size: [0.6 + hash(k, 93), 0.5 + hash(k, 94)], rotY: a, color: k % 3 ? 0xb8a684 : 0xe2dccc, base: WATER, y: 0.03 });
        }
        warn(w.x0 + 6, bank + 6.5, Math.PI);
        // The fan: wet mud furthest out, drier and paler in, a few flats standing clear and cracked.
        const FAN = [0x84704f, 0x8f7c5a, 0x9a8866, 0xa69676];
        for (let k = 0; k < 40; k++) {
          const t = 1 - k / 40, a = 0.7 + (hash(k, 141) - 0.5) * 2.6, r = t * 30 + 2;
          const fx = Math.max(w.x0 + 3, px + Math.cos(a) * r), fz = Math.max(w.z0 + 3, out + Math.sin(a) * r * 0.8);
          disc(fx, fz, WATER + 0.02 + (1 - t) * 0.12, 4 + (1 - t) * 5 + hash(k, 142) * 3, FAN[Math.min(3, Math.floor((1 - t) * 4))]);
        }
        for (let k = 0; k < 40; k++) {
          const a = hash(k, 143) * 6.28, r = 3 + hash(k, 144) * 9;
          decals.push({ pos: [px + 4 + Math.cos(a) * r, out + 4 + Math.sin(a) * r * 0.7], size: [0.08, 0.7 + hash(k, 145) * 1.6], rotY: hash(k, 146) * 3.14, color: 0x7a6a50, base: WATER, y: 0.24 });
        }
        // The dredger: its pontoon, cabin and spuds, the cutter's ladder let down into the fan.
        const dx = px + 30, dz = out + 30;
        props.push({ shape: 'box', size: [5, 0.5, 2.4], pos: [dx, WATER + 0.3, dz], color: 0xd8a020 });
        props.push({ shape: 'box', size: [1.4, 1.1, 1.3], pos: [dx + 2.6, WATER + 1.9, dz], color: 0xe8e8e2 });
        props.push({ shape: 'box', size: [0.02, 0.4, 0.9], pos: [dx + 1.18, WATER + 2.2, dz], color: 0x3a4a5a, ghost: true });
        props.push({ shape: 'box', size: [1.5, 0.5, 1], pos: [dx + 2.6, WATER + 3.5, dz], color: 0x5f646a });
        for (const side of [-1, 1]) props.push({ shape: 'cylinder', size: [0.22, 3.5, 0], pos: [dx + 5.4, WATER + 2.5, dz + side * 1.8], color: 0x3a3f45, ghost: true });
        props.push({ shape: 'box', size: [5, 0.3, 0.45], pos: [dx - 7, WATER + 0.2, dz], rot: [0, 0, -0.22], color: STEEL, ghost: true });
        for (const side of [-1, 1]) props.push({ shape: 'box', size: [0.15, 2, 0.15], pos: [dx - 3.8, WATER + 2.4, dz + side * 1.4], rot: [side * 0.25, 0, 0.35], color: 0xc8372d, ghost: true });
        for (let k = 0; k < 10; k++) decals.push({ pos: [dx - 12 + (hash(k, 147) - 0.5) * 3, dz + (hash(k, 148) - 0.5) * 3], size: [0.5 + hash(k, 149), 0.4 + hash(k, 150)], rotY: hash(k, 151) * 3, color: 0x9a8868, base: WATER, y: 0.03 });
        // Its pipe floating off to the beds over the bund.
        dredged = [dx + 4, w.z1];
        floats([dx + 5, dz + 1], [dredged[0], w.z1 - 1.5], 0xf07a1e);
        pipe([dx + 5, WATER + 0.12, dz + 1], [dredged[0], WATER + 0.12, w.z1 - 1.5], 0.25, 0x2a2c30);
        // The curtain, across from bank to bank.
        const cx = w.x1 - 30;
        floats([cx, w.z0 + 1], [cx, w.z1 - 1], 0xf2c230, 0xe0702a);
        decals.push({ pos: [(cx + w.x1) / 2, (w.z0 + w.z1) / 2], size: [w.x1 - cx, w.z1 - w.z0], color: 0x8a7a5e, base: WATER, y: 0.015 });
      }
      // The dried pond, made drying beds: low bunds parting it into six, a lane down the middle for the lorries to the way
      // up to the press's yard; each bed at a stage of its own: slurry just let in, cracking, dry right through, its mud
      // pushed into rows by a dozer, being dug out into a lorry, dug down to the clay.
      for (const d of lots('d')) {
        const lane = xOf(-1), mid = (lane + 3 + d.x1) / 2, zm = (d.z0 + d.z1) / 2;
        const BUND = 0x8a7f6a;
        /** Mud dried into plates, curling a little, the cracks between them showing the darker mud under. */
        const crust = (x0: number, z0: number, x1: number, z1: number, colors: number[], seed: number, holes: [number, number, number][] = []) => {
          for (let x = x0 + 0.8, i = 0; x < x1 - 0.6; x += 1.5, i++) for (let z = z0 + 0.8, j = 0; z < z1 - 0.6; z += 1.5, j++) {
            const px = x + (hash(i + seed, j) - 0.5) * 0.4, pz = z + (hash(j, i + seed) - 0.5) * 0.4;
            if (holes.some(([hx, hz, r]) => Math.hypot(px - hx, pz - hz) < r)) continue;
            props.push({ shape: 'box', size: [0.55 + hash(i, j + seed) * 0.15, 0.04, 0.5 + hash(j + seed, i) * 0.18], pos: [px, DRY + 0.04, pz], rot: [(hash(i, j) - 0.5) * 0.06, hash(i + j, seed) * 1.5, (hash(j, i) - 0.5) * 0.06], color: colors[(i * 7 + j * 3) % colors.length], ghost: true });
          }
        };
        const bund = (x0: number, z0: number, x1: number, z1: number) =>
          props.push({ shape: 'box', size: [Math.max(0.8, (x1 - x0) / 2), 0.4, Math.max(0.8, (z1 - z0) / 2)], pos: [(x0 + x1) / 2, DRY + 0.3, (z0 + z1) / 2], color: BUND, ghost: true });
        // The lane's bunds with a way into each bed; the bed rows' bund across; the bund between the beds east.
        for (const x of [lane - 3.8, lane + 3.8]) {
          bund(x, d.z0, x, (d.z0 + zm) / 2 - 4);
          bund(x, (d.z0 + zm) / 2 + 4, x, (zm + d.z1) / 2 - 4);
          bund(x, (zm + d.z1) / 2 + 4, x, d.z1);
        }
        bund(d.x0, zm, lane - 3.8, zm);
        bund(lane + 3.8, zm, d.x1, zm);
        bund(mid, d.z0, mid, d.z1);
        for (const off of [-1, 1]) decals.push({ pos: [lane + off, (d.z0 + d.z1) / 2], size: [0.7, d.z1 - d.z0], color: 0x7a705e, base: DRY, y: 0.025 });
        // Just let in: the slurry from the dredger's pipe pouring over the bund, wet mud and standing water.
        const [fx0, fx1, fz0, fz1] = [lane + 4.6, mid - 0.8, d.z0 + 0.8, zm - 0.8];
        decals.push({ pos: [(fx0 + fx1) / 2, (fz0 + fz1) / 2], size: [fx1 - fx0, fz1 - fz0], color: 0x6f5f48, base: DRY, y: 0.01 });
        for (const [wx, wz, r] of [[fx0 + 10, fz0 + 26, 9], [fx0 + 24, fz0 + 14, 7], [fx0 + 20, fz0 + 34, 6]] as const) {
          for (let k = 0; k < 5; k++) decals.push({ pos: [wx + (hash(k, wx) - 0.5) * r, wz + (hash(k, wz) - 0.5) * r], size: [r * (0.7 + hash(k, 3) * 0.4), r * (0.6 + hash(k, 4) * 0.4)], rotY: hash(k, 5) * 3, color: 0x66705f, base: DRY, y: 0.03 });
        }
        pipe([dredged[0], WATER + 0.12, d.z0 - 1.5], [dredged[0], DRY + 1.4, d.z0 + 0.5], 0.25, 0x2a2c30);
        pipe([dredged[0], DRY + 1.4, d.z0 + 0.5], [dredged[0], DRY + 1.4, d.z0 + 4], 0.25, 0x2a2c30);
        props.push({ shape: 'box', size: [0.2, 0.7, 0.2], pos: [dredged[0], DRY + 0.7, d.z0 + 4.2], color: 0x7a6446, ghost: true });
        for (let k = 0; k < 12; k++) decals.push({ pos: [dredged[0] + (hash(k, 161) - 0.5) * 4, d.z0 + 5.5 + hash(k, 162) * 3], size: [0.6 + hash(k, 163), 0.5 + hash(k, 164)], rotY: hash(k, 165) * 3, color: 0x8a7656, base: DRY, y: 0.04 });
        // Cracking: east of it, darker, thin cracks, a puddle or two left.
        decals.push({ pos: [(mid + d.x1) / 2, (d.z0 + zm) / 2], size: [d.x1 - mid - 1.6, zm - d.z0 - 1.6], color: 0x625846, base: DRY, y: 0.01 });
        crust(mid + 0.8, d.z0 + 0.8, d.x1 - 0.8, zm - 0.8, [0x8f846f, 0x897e69, 0x958a75], 7, [[mid + 10, d.z0 + 14, 3], [mid + 24, d.z0 + 32, 3]]);
        cracks(mid + 1, d.z0 + 1, d.x1 - 1, zm - 1, 160, 1.4, 0.07, 0x6a604f, 171);
        for (const [wx, wz] of [[mid + 10, d.z0 + 14], [mid + 24, d.z0 + 32]] as const) decals.push({ pos: [wx, wz], size: [5, 3.5], rotY: 0.4, color: 0x66705f, base: DRY, y: 0.03 });
        // Dry right through: pale, cracked deep all over.
        decals.push({ pos: [(d.x0 + lane - 3.8) / 2, (d.z0 + zm) / 2], size: [lane - 4.6 - d.x0, zm - d.z0 - 1.6], color: 0x6f6555, base: DRY, y: 0.01 });
        crust(d.x0 + 0.8, d.z0 + 0.8, lane - 4.6, zm - 0.8, [0xb2a790, 0xaca18a, 0xb8ad96], 13);
        cracks(d.x0 + 1, d.z0 + 1, lane - 4.6, zm - 1, 240, 2.6, 0.14, 0x5f5545, 181);
        // Pushed into rows: the dozer at the end of the row it is pushing, the bed scraped behind it.
        cracks(d.x0 + 1, zm + 1, lane - 4.6, d.z1 - 1, 80, 2, 0.12, 0x6a604f, 191);
        for (const [rx, last] of [[d.x0 + 5, 1], [d.x0 + 12, 0.55]] as const) {
          for (let z = zm + 5; z < zm + 5 + (d.z1 - zm - 10) * last; z += 2.4) props.push({ shape: 'cone', size: [2.3 + hash(z, rx) * 0.5, 1.1, 0], pos: [rx, DRY + 1.1, z], color: 0x7a6e5a });
        }
        {
          const bx = d.x0 + 12, bz = zm + 5 + (d.z1 - zm - 10) * 0.55 + 4.5;
          taken.push([bx, bz, 3]);
          for (const side of [-1, 1]) props.push({ shape: 'box', size: [0.4, 0.45, 1.6], pos: [bx + side * 1.05, DRY + 0.45, bz], color: 0x2e3034 });
          props.push({ shape: 'box', size: [0.95, 0.55, 1.4], pos: [bx, DRY + 1.3, bz + 0.2], color: YELLOW });
          props.push({ shape: 'box', size: [0.7, 0.6, 0.6], pos: [bx, DRY + 2.4, bz + 0.6], color: 0x3a4a52 });
          props.push({ shape: 'box', size: [1.7, 0.55, 0.15], pos: [bx, DRY + 0.55, bz - 2.1], rot: [0.15, 0, 0], color: 0x4a4c50 });
          for (const side of [-1, 1]) props.push({ shape: 'box', size: [0.1, 0.1, 0.9], pos: [bx + side * 1.2, DRY + 0.7, bz - 1.2], color: YELLOW, ghost: true });
          for (let z = bz + 2.5; z < d.z1 - 2; z += 2) for (const side of [-1, 1]) decals.push({ pos: [bx + side * 1.05, z], size: [0.75, 1.4], color: 0x857a66, base: DRY, y: 0.025 });
        }
        // Being dug: the face across it, the dug half paler and lower looking; heaps along the face, the excavator at one
        // loading the lorry stood in the bed's way in.
        const [mx0, mx1] = [lane + 4.6, mid - 0.8];
        decals.push({ pos: [(mx0 + mx1) / 2, zm + (d.z1 - zm) * 0.3], size: [mx1 - mx0, (d.z1 - zm) * 0.6 - 1.6], color: 0x7d7262, base: DRY, y: 0.01 });
        decals.push({ pos: [(mx0 + mx1) / 2, zm + (d.z1 - zm) * 0.8], size: [mx1 - mx0, (d.z1 - zm) * 0.4 - 1.6], color: 0xa29684, base: DRY, y: 0.01 });
        cracks(mx0, zm + 1, mx1, zm + (d.z1 - zm) * 0.6, 90, 1.8, 0.1, 0x6a604f, 201);
        for (let n = 0; n < 5; n++) {
          const hx = mx0 + 14 + n * 4.8, hz = zm + (d.z1 - zm) * 0.6 - 2 + hash(n, 121) * 2, r = 2.2 + hash(n, 122) * 1.2;
          props.push({ shape: 'cone', size: [r, 1 + hash(n, 123) * 0.6, 0], pos: [hx, DRY + 1, hz], color: 0x6a6050 });
        }
        excavator(lane + 9.5, zm + 24, -Math.PI / 2);
        lorry(lane, zm + 24, Math.PI);
        // Dug down to the clay: its floor bare and pale, the tracks of the lorries round it, a lorry leaving it, stakes
        // marking how far down it has been dug.
        decals.push({ pos: [(mid + d.x1) / 2, (zm + d.z1) / 2], size: [d.x1 - mid - 1.6, d.z1 - zm - 1.6], color: 0xa79a84, base: DRY, y: 0.01 });
        for (let k = 0; k < 64; k++) {
          const a = (k / 64) * 6.28, ex = (mid + d.x1) / 2 + Math.cos(a) * 11, ez = (zm + d.z1) / 2 + Math.sin(a) * 15;
          for (const off of [-0.9, 0.9]) decals.push({ pos: [ex + Math.cos(a) * off, ez + Math.sin(a) * off], size: [0.6, 1.6], rotY: -a, color: 0x8f846f, base: DRY, y: 0.025 });
        }
        lorry((mid + d.x1) / 2 + 11, (zm + d.z1) / 2 - 2, Math.PI);
        for (let k = 0; k < 96; k++) {
          const a = (k / 96) * 6.28, ex = (mid + d.x1) / 2 + Math.cos(a) * 11, ez = (zm + d.z1) / 2 + Math.sin(a) * 15;
          for (const off of [-1.45, 0, 1.45]) props.push({ shape: 'box', size: [0.12, 0.07, 0.6], pos: [ex + Math.cos(a) * off, DRY + 0.05, ez + Math.sin(a) * off], rot: [0, -a, 0], color: 0x9a8e78, ghost: true });
        }
        for (const [cx, cz, r] of [[mid + 6, zm + 6, 2.6], [mid + 9.5, zm + 5, 2], [d.x1 - 5, zm + 8, 2.4]] as const) props.push({ shape: 'cone', size: [r, r * 0.45, 0], pos: [cx, DRY + r * 0.45, cz], color: 0x9c8f78 });
        {
          const px = d.x1 - 6, pz = d.z1 - 9;
          decals.push({ pos: [px - 3, pz], size: [7, 4.5], rotY: 0.3, color: 0x66705f, base: DRY, y: 0.03 });
          props.push({ shape: 'box', size: [0.5, 0.3, 0.35], pos: [px, DRY + 0.3, pz], color: 0x2f6fb0 });
          pipe([px - 0.4, DRY + 0.2, pz], [px - 3, DRY + 0.06, pz + 0.4], 0.07, 0x2c4f8a);
          pipe([px + 0.4, DRY + 0.2, pz], [d.x1 + 1, DRY + 1, pz - 2], 0.07, 0x2c4f8a);
        }
        for (let n = 0; n < 5; n++) {
          const sx = mid + 5 + n * 6.5, sz = d.z1 - 4;
          props.push({ shape: 'box', size: [0.05, 0.6, 0.05], pos: [sx, DRY + 0.6, sz], color: 0xd8c8a0 }, { shape: 'box', size: [0.06, 0.12, 0.06], pos: [sx, DRY + 1.2, sz], color: 0xf07a1e, ghost: true });
        }
      }
      // The filter press's yard: the press in its shed with its dosing tanks and bags of flocculant beside it; its belt out
      // to the bays the cake is kept in, walled with blocks, a loader loading a lorry from them, more lorries waiting; the
      // wheel wash at the top of the way up from the beds, the weighbridge out; fenced along the water.
      for (const k of lots('k')) {
        const bx = k.x0 + 26, bz = (k.z0 + k.z1) / 2 + 8;
        props.push({ shape: 'box', size: [12, 6, 9], pos: [bx, YARD + 6, bz], color: 0xa4adb2, fade: true, building: { style: 'shed', open: [true, true, true, true], crown: 0, seed: 77 } });
        taken.push([bx, bz, 15]);
        apronRow(bx - 2, bz - 13, YARD, false, 5);
        // The bays: three, side by side east of the shed, open to the north.
        const b0 = bx + 24, BAY = 9;
        conveyor([bx + 12, YARD + 5, bz], [b0 + BAY / 2, YARD + 4, bz + 1]);
        for (let n = 0; n <= 3; n++) props.push({ shape: 'box', size: [0.4, 1, 8.5], pos: [b0 + n * BAY, YARD + 1, bz + 1], color: 0xb4b6b2 });
        props.push({ shape: 'box', size: [(BAY * 3) / 2 + 0.4, 1, 0.4], pos: [b0 + (BAY * 3) / 2, YARD + 1, bz + 9.5], color: 0xb4b6b2 });
        for (const [n, r, up] of [[0, 4, 1.8], [1, 4.2, 2.1], [2, 3, 1.1]] as const) props.push({ shape: 'cone', size: [r, up, 0], pos: [b0 + (n + 0.5) * BAY, YARD + up, bz + 2], color: 0x55504a });
        lorry(b0 + BAY * 3 + 5, bz - 6, 0);
        // The loader at the last bay, its bucket raised full. Parked, not one of the machines: those draw on one chance
        // between them, and another would change how the ones on the way go.
        {
          const lx = b0 + BAY * 2.5, lz = bz - 6;
          taken.push([lx, lz, 4]);
          for (const dz of [-1.5, 1.5]) for (const side of [-1, 1]) props.push({ shape: 'cylinder', size: [0.75, 0.35, 0], pos: [lx + side * 1.2, YARD + 0.75, lz + dz], rot: [0, 0, Math.PI / 2], color: 0x2a2c30 });
          props.push({ shape: 'box', size: [1, 0.6, 2.4], pos: [lx, YARD + 1.5, lz - 0.3], color: YELLOW });
          props.push({ shape: 'box', size: [0.8, 0.7, 0.7], pos: [lx, YARD + 2.8, lz - 0.6], color: 0x3a4a52 });
          for (const side of [-1, 1]) props.push({ shape: 'box', size: [0.12, 0.15, 1.4], pos: [lx + side * 0.8, YARD + 2.6, lz + 2.4], rot: [-0.5, 0, 0], color: YELLOW, ghost: true });
          props.push({ shape: 'box', size: [1.3, 0.5, 0.5], pos: [lx, YARD + 3.4, lz + 3.6], color: 0x4a4c50 });
          props.push({ shape: 'cone', size: [0.9, 0.3, 0], pos: [lx, YARD + 3.9, lz + 3.6], color: 0x55504a, ghost: true });
        }
        for (const z of [k.z0 + 12, k.z0 + 24]) lorry(k.x1 - 5, z, Math.PI);
        // The dosing tanks and the flocculant, on pallets, west of the shed.
        for (const z of [k.z0 + 12, k.z0 + 20, k.z0 + 28]) tank(k.x0 + 7, z, YARD, 2.6, 5.5, 0xd8dcd8);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
          const fx = k.x0 + 5 + j * 1.4, fz = k.z1 - 18 + i * 1.4;
          props.push({ shape: 'box', size: [0.6, 0.07, 0.6], pos: [fx, YARD + 0.07, fz], color: 0x9a7448 });
          for (let up = 0; up < 1 + ((i + j) % 2); up++) props.push({ shape: 'box', size: [0.5, 0.45, 0.5], pos: [fx, YARD + 0.6 + up * 0.92, fz], color: 0xece8de });
        }
        // The wheel wash: its grating, the spray bar arched over.
        const wz = k.z0 + 16, lane = xOf(-1);
        decals.push({ pos: [lane, wz], size: [5, 9], color: 0x4a4e52, base: YARD, y: 0.02 });
        for (let z = wz - 4; z <= wz + 4; z += 0.8) decals.push({ pos: [lane, z], size: [4.6, 0.1], color: 0x2e3236, base: YARD, y: 0.03 });
        for (const side of [-1, 1]) props.push({ shape: 'box', size: [0.15, 2.3, 0.15], pos: [lane + side * 3, YARD + 2.3, wz], color: 0x2c4f8a });
        pipe([lane - 3, YARD + 4.6, wz], [lane + 3, YARD + 4.6, wz], 0.12, 0x2c4f8a);
        for (const side of [-1, 1]) pipe([lane + side * 2.8, YARD + 0.3, wz - 3], [lane + side * 2.8, YARD + 0.3, wz + 3], 0.08, 0x2c4f8a);
        // The mud the lorries carry off the beds, tracked from the wash to the bays and from the bays out over the scale;
        // puddles past the wash.
        const track = (a: Vec2, b: Vec2) => {
          const long = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
          for (let d = 0; d < long; d += 2.4) for (const off of [-0.95, 0.95]) {
            decals.push({ pos: [a[0] + ((b[0] - a[0]) * d) / long + Math.cos(yaw) * off, a[1] + ((b[1] - a[1]) * d) / long - Math.sin(yaw) * off], size: [0.6, 1.5], rotY: yaw, color: 0x7a7266, base: YARD, y: 0.025 });
          }
        };
        track([lane, wz + 5], [b0 + BAY * 1.5, bz - 9]);
        track([b0 + BAY * 1.5, bz - 9], [b0 + BAY * 3 + 5, bz - 12]);
        track([b0 + BAY * 3 + 5, bz - 1], [bx + 30, k.z1 - 6]);
        for (let n = 0; n < 5; n++) decals.push({ pos: [lane + (hash(n, 211) - 0.5) * 4, wz + 6 + n * 2.2], size: [1.6 + hash(n, 212) * 1.6, 1 + hash(n, 213)], rotY: hash(n, 214) * 3, color: 0x6f6a5e, base: YARD, y: 0.03 });
        // The site office: two containers stacked, stairs up to the top one, scooters by it.
        const ox = b0 + 8, oz = k.z0 + 10;
        container(ox, oz, YARD, 0, 0xe4e0d4);
        container(ox, oz, YARD + 2.6, 0, 0xe4e0d4);
        for (const up of [YARD, YARD + 2.6]) for (const dx of [-1.6, 1.6]) props.push({ shape: 'box', size: [0.5, 0.4, 0.02], pos: [ox + dx, up + 1.5, oz - 1.22], color: 0x3a4a5a, ghost: true });
        props.push({ shape: 'box', size: [0.5, 0.06, 2], pos: [ox + 3.8, YARD + 1.3, oz - 0.4], rot: [-0.68, 0, 0], color: STEEL, ghost: true });
        taken.push([ox, oz, 4]);
        for (let n = 0; n < 3; n++) s.object((['scooterRed', 'scooterWhite', 'scooterBlack'] as const)[n], ox - 2 + n * 1.1, oz - 3, 0);
        // Spare filter plates, stood in a rack by the shed's door.
        const fx = bx + 15, fz = bz - 14;
        props.push({ shape: 'box', size: [1.6, 0.07, 1], pos: [fx, YARD + 0.07, fz], color: 0x9a7448 });
        for (let n = 0; n < 9; n++) props.push({ shape: 'box', size: [0.06, 0.9, 0.9], pos: [fx - 1.3 + n * 0.32, YARD + 1.05, fz], rot: [0, 0, 0.12], color: n % 3 ? 0x3a3f45 : 0x2c4f8a });
        taken.push([fx, fz, 2]);
        // The weighbridge out, at the yard's far side, its booth.
        const sx = bx + 16, sz = k.z1 - 6;
        decals.push({ pos: [sx, sz], size: [18, 3.8], color: 0x6a6e72, base: YARD, y: 0.02 });
        for (const side of [-1, 1]) decals.push({ pos: [sx, sz + side * 1.9], size: [18, 0.25], color: YELLOW, base: YARD, y: 0.03 });
        props.push({ shape: 'box', size: [1.5, 1.3, 1.3], pos: [sx + 11.5, YARD + 1.3, sz], color: 0xe4e0d4 }, { shape: 'box', size: [1.7, 0.08, 1.5], pos: [sx + 11.5, YARD + 2.65, sz], color: 0x2f62a8, ghost: true });
        props.push({ shape: 'box', size: [0.02, 0.45, 0.8], pos: [sx + 9.98, YARD + 1.6, sz], color: 0x3a4a5a, ghost: true });
        taken.push([sx + 11.5, sz, 2]);
        fence([k.x1 - 0.6, k.z0 + 0.6], [k.x1 - 0.6, k.z1 - 0.6]);
        fence([k.x0 + 0.6, k.z0 + 0.6], [lane - 3.5, k.z0 + 0.6]);
        fence([lane + 3.5, k.z0 + 0.6], [k.x1 - 0.6, k.z0 + 0.6]);
        warn(k.x1 - 2, k.z0 + 6, -Math.PI / 2);
        warn(k.x1 - 2, k.z1 - 14, -Math.PI / 2);
        mast(k.x1 - 6, k.z1 - 6);
      }
      // The clear pond: the pump on its barge, its pipe floating to the pump house's yard, buoyed; a curtain round the weir
      // the water comes in over; two reedy islands, egrets on them and in the shallows; staff gauges along the far bank; a
      // work boat tied up at the jetty.
      for (const c of lots('c')) {
        const bx = (c.x0 + c.x1) / 2, bz = c.z0 + 54;
        props.push({ shape: 'box', size: [3, 0.35, 2], pos: [bx, WATER + 0.15, bz], color: 0xd8d2c4, ghost: true });
        props.push({ shape: 'box', size: [1.2, 0.7, 0.9], pos: [bx - 0.6, WATER + 1.2, bz], color: 0x3f6f8a, ghost: true });
        props.push({ shape: 'box', size: [0.6, 0.06, 0.6], pos: [bx + 1.6, WATER + 0.56, bz], color: 0xc8372d, ghost: true });
        props.push({ shape: 'cylinder', size: [0.25, (c.z1 - bz - 2) / 2, 0], pos: [bx, WATER + 0.12, (bz + c.z1) / 2 + 1], rot: [Math.PI / 2, 0, 0], color: 0x2a2c30, ghost: true });
        for (let z = bz + 4; z < c.z1 - 2; z += 4) props.push({ shape: 'box', size: [0.4, 0.22, 0.4], pos: [bx, WATER + 0.18, z], color: 0xf07a1e, ghost: true });
        for (let n = 0; n < 4; n++) {
          const ex = n % 2 ? c.x0 + 2.5 + hash(n, 111) * 4 : c.x1 - 2.5 - hash(n, 111) * 4, ez = c.z0 + 8 + hash(n, 112) * (c.z1 - c.z0 - 30);
          egret(ex, ez, WATER, hash(n, 113) * 6.28);
        }
        // The curtain round the weir.
        const weirZ = zOf(37);
        for (let a = -Math.PI / 2; a < Math.PI / 2 - 0.01; a += Math.PI / 8) {
          floats([c.x0 + Math.cos(a) * 13, weirZ + Math.sin(a) * 13], [c.x0 + Math.cos(a + Math.PI / 8) * 13, weirZ + Math.sin(a + Math.PI / 8) * 13], 0xf2c230, 0xe0702a);
        }
        // The water inside it, stiller and paler: the half round it closes off, laid in narrow strips.
        for (let dx = 0.3; dx < 12.4; dx += 0.6) decals.push({ pos: [c.x0 + dx, weirZ], size: [0.62, 2 * Math.sqrt(12.4 * 12.4 - dx * dx)], color: 0x6f9a86, base: WATER, y: 0.03 });
        // The islands.
        for (const [ix, iz, r, birds] of [[c.x0 + 16, c.z0 + 22, 6, 3], [c.x1 - 12, c.z0 + 96, 4, 2]] as const) {
          disc(ix, iz, WATER + 0.06, r + 0.8, 0x7a6a50);
          disc(ix, iz, WATER + 0.14, r, 0x6f8a4a);
          for (let n = 0; n < 9; n++) {
            const a = (n / 9) * 6.28, rr = r * (0.55 + hash(n, ix) * 0.35);
            reeds(ix + Math.cos(a) * rr, iz + Math.sin(a) * rr, WATER - 0.1, n + ix);
          }
          bush(ix - 1, iz, WATER + 0.2, ix);
          for (let n = 0; n < birds; n++) egret(ix + 1.5 + n * 1.2, iz + r * 0.7 + n * 0.5, WATER + 0.2, 1 + n);
        }
        // The staff gauges.
        for (let z = c.z0 + 14; z < c.z1 - 10; z += 28) {
          props.push({ shape: 'box', size: [0.12, 1, 0.04], pos: [c.x1 - 7, WATER + 0.9, z], color: 0xf4f4f0, ghost: true });
          for (let up = 0.3; up < 1.8; up += 0.4) props.push({ shape: 'box', size: [0.13, 0.06, 0.05], pos: [c.x1 - 7, WATER + up, z], color: 0xc8372d, ghost: true });
        }
        // The work boat at the jetty.
        const jx = c.x0 + 8;
        props.push({ shape: 'box', size: [0.9, 0.3, 2.2], pos: [jx + 2.2, WATER + 0.2, c.z1 - 4], color: 0x9aa0a6, ghost: true });
        props.push({ shape: 'box', size: [0.25, 0.3, 0.2], pos: [jx + 2.2, WATER + 0.6, c.z1 - 6.3], color: 0x2a2c30, ghost: true });
      }
      // The pump house's yard: the house, the two pipes back to the plant out of it along the pond's far bank on trestles;
      // the clear water's tanks and the water tower, piped from the house on a rack; the dosing hut and the transformer in
      // its fence; the sampling hut, and its jetty out over the clear water; fenced along the water.
      for (const h of lots('h')) {
        const hx = (h.x0 + h.x1) / 2 + 2, hz = h.z0 + 36;
        props.push({ shape: 'box', size: [7, 3.5, 6], pos: [hx, YARD + 3.5, hz], color: 0xb8b0a0, fade: true, building: { style: 'shed', open: [true, true, true, true], crown: 0, seed: 91 } });
        taken.push([hx, hz, 9]);
        const py = YARD + 0.6, south = zOf(33) + 2;
        for (const px of [h.x1 - 3.4, h.x1 - 2.4]) {
          props.push({ shape: 'cylinder', size: [0.3, (hz - 6 - south) / 2, 0], pos: [px, py, (hz - 6 + south) / 2], rot: [Math.PI / 2, 0, 0], color: 0x2c4f8a });
        }
        for (let z = south + 6; z < hz - 6; z += 8) {
          const y = ground(h.x1 - 2.9, z);
          props.push({ shape: 'box', size: [0.9, (py - y) / 2, 0.15], pos: [h.x1 - 2.9, (py + y) / 2, z], color: STEEL });
        }
        // The tanks, the tower, the rack.
        const tx = h.x0 + 18, rx = h.x1 - 12, top = YARD + 4.3;
        const tanks = [hz + 36, hz + 66];
        for (const z of tanks) tank(tx, z, YARD, 7.5, 6, 0xc8ccc8);
        const wx = h.x1 - 10, wz = h.z1 - 14;
        taken.push([wx, wz, 4]);
        for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) props.push({ shape: 'box', size: [0.15, 6, 0.15], pos: [wx + dx, YARD + 6, wz + dz], color: STEEL });
        props.push({ shape: 'cylinder', size: [3, 1.6, 0], pos: [wx, YARD + 13.6, wz], color: 0x6a9ab8 });
        props.push({ shape: 'cone', size: [3.1, 0.7, 0], pos: [wx, YARD + 15.9, wz], color: 0x4f7a96, ghost: true });
        for (let z = hz + 8; z <= wz - 4; z += 6) {
          for (const side of [-1, 1]) props.push({ shape: 'box', size: [0.1, top / 2 - YARD / 2, 0.1], pos: [rx + side * 0.8, (top + YARD) / 2 - 0.3, z], color: STEEL });
          props.push({ shape: 'box', size: [1, 0.08, 0.1], pos: [rx, top - 0.3, z], color: STEEL, ghost: true });
        }
        for (const side of [-0.4, 0.4]) pipe([rx + side, top, hz + 6], [rx + side, top, wz - 4], 0.2, 0x2c4f8a);
        pipe([hx + 5, top, hz + 5], [rx - 0.4, top, hz + 6], 0.2, 0x2c4f8a);
        for (const z of tanks) pipe([rx - 0.4, top, z], [tx + 7.5, top, z], 0.2, 0x2c4f8a);
        pipe([rx + 0.4, top, wz - 4], [wx, top, wz - 4], 0.2, 0x2c4f8a);
        pipe([wx, top, wz - 4], [wx, YARD + 12, wz - 2.6], 0.2, 0x2c4f8a);
        // The dosing hut with its drums, the transformer fenced.
        props.push({ shape: 'box', size: [2, 1.4, 1.6], pos: [h.x0 + 5, YARD + 1.4, hz + 18], color: 0xe4e0d4 }, { shape: 'box', size: [2.2, 0.08, 1.8], pos: [h.x0 + 5, YARD + 2.85, hz + 18], color: 0x2c4f8a, ghost: true });
        for (let i = 0; i < 4; i++) props.push({ shape: 'cylinder', size: [0.3, 0.45, 0], pos: [h.x0 + 4 + (i % 2) * 0.7, YARD + 0.45, hz + 21 + Math.floor(i / 2) * 0.7], color: 0x2f5f9a });
        taken.push([h.x0 + 5, hz + 19, 3]);
        const fx = h.x0 + 6, fz = tanks[1] + 2;
        props.push({ shape: 'box', size: [1.2, 1, 0.9], pos: [fx, YARD + 1, fz], color: 0x4f6a52 });
        props.push({ shape: 'box', size: [0.3, 0.3, 0.02], pos: [fx, YARD + 1.4, fz - 0.92], color: YELLOW, ghost: true });
        fence([fx - 2.5, fz - 2.5], [fx + 2.5, fz - 2.5]);
        fence([fx + 2.5, fz - 2.5], [fx + 2.5, fz + 2.5]);
        fence([fx + 2.5, fz + 2.5], [fx - 2.5, fz + 2.5]);
        const jx = h.x0 + 8;
        props.push({ shape: 'box', size: [1.3, 1.2, 1.1], pos: [jx, YARD + 1.2, h.z0 + 6], color: 0xe4e0d4 }, { shape: 'box', size: [1.5, 0.08, 1.3], pos: [jx, YARD + 2.45, h.z0 + 6], color: 0x2f7a5a, ghost: true });
        props.push({ shape: 'box', size: [0.5, 0.4, 0.02], pos: [jx, YARD + 1.5, h.z0 + 4.88], color: 0x3a4a5a, ghost: true });
        props.push({ shape: 'box', size: [0.9, 0.08, 4], pos: [jx, YARD - 0.4, h.z0 - 4], color: 0x8a7458 });
        for (const dz of [-7, -3.5]) for (const dx of [-0.8, 0.8]) props.push({ shape: 'box', size: [0.08, (YARD - WATER) / 2, 0.08], pos: [jx + dx, (YARD + WATER) / 2 - 0.4, h.z0 + dz], color: 0x6b5a46 });
        props.push({ shape: 'cylinder', size: [0.05, 0.7, 0], pos: [jx + 0.6, YARD + 0.3, h.z0 - 7.6], color: 0xe8e8e2 });
        fence([h.x0 + 0.6, h.z0 + 0.6], [jx - 1.5, h.z0 + 0.6]);
        fence([jx + 1.5, h.z0 + 0.6], [h.x1 - 4.5, h.z0 + 0.6]);
        fence([h.x0 + 0.6, h.z0 + 0.6], [h.x0 + 0.6, h.z1 - 0.6]);
        warn(h.x0 + 3, h.z0 + 14, Math.PI / 2);
        mast(h.x0 + 6, h.z1 - 4);
      }
    };

    // ---- What grows ----
    // Woodland: trees close together, a bush here and there between, on every square of it, kept off the ways.
    for (const { x, z, k } of squares('TLlgj')) {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const n = k * 9 + i * 3 + j;
        if (hash(n, 74) < 0.15) continue;
        const tx = x - 5 + i * 5 + (hash(n, 75) - 0.5) * 2.4, tz = z - 5 + j * 5 + (hash(n, 76) - 0.5) * 2.4;
        if (!free(tx, tz, 1.2) || !level(tx, tz, 0.8)) continue;
        taken.push([tx, tz, 1.2]);
        if (hash(n, 77) < 0.75) tree(tx, tz, ground(tx, tz), n);
        else bush(tx, tz, ground(tx, tz), n);
      }
    }
    // Reeds along the ponds' edges, a clump every few metres a metre out into the water.
    for (const { x, z, k } of squares('wsc')) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = Math.round((x + dx * CELL) / CELL) - COL0, r = Math.round((z + dz * CELL) / CELL);
        if ('wsc'.includes(MAP[r]?.[c] ?? 'w')) continue;
        for (let d = -6.5; d <= 6.5; d += 2.6) {
          const rx = x + dx * 7 + (dx ? 0 : d), rz = z + dz * 7 + (dz ? 0 : d);
          if (free(rx, rz, 0.6)) reeds(rx, rz, ground(rx, rz), k + Math.round(d * 10) + dx * 3 + dz * 7);
        }
      }
    }
    ponds();
    // ---- The water either side of the dike, and the bank above the ponds ----
    {
      const WATER = PONDS - POND_DOWN, BANK_Y = 10;
      const egret = (x: number, z: number, y: number, empty = false) => birds.push({ pos: [x, y, z], yaw: hash(x, z) * 6.28, empty });
      /** A rope or a pipe, straight from one place to another. */
      const line = (a: Spot, b: Spot, r: number, color: number) => {
        const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], run = Math.hypot(dx, dz);
        props.push({ shape: 'cylinder', size: [r, Math.hypot(run, dy) / 2, 0], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [0, Math.atan2(-dz, dx), Math.PI / 2 + Math.atan2(dy, run)], color, ghost: true });
      };
      const [west0, east1] = [xOf(3) + 8.8, xOf(6) + 7.2];
      // Mud dropped below the weir the slurry comes in over, standing clear of the water.
      for (let k = 0; k < 9; k++) {
        const r = 1.4 + hash(k, 221) * 2, fx = west0 + 2 + hash(k, 222) * 6, fz = zOf(36) - 6 + hash(k, 223) * 14;
        props.push({ shape: 'cylinder', size: [r, 0.06, 0], pos: [fx, WATER + 0.01 + (k % 3) * 0.02, fz], color: [0x7a6a4e, 0x83725a, 0x8c7b5e][k % 3], ghost: true });
        if (k % 3 === 0) reeds(fx, fz, WATER - 0.1, k + 250);
      }
      // Sounding poles along the bunds.
      for (let z = zOf(34); z < zOf(49) + 4; z += 30) {
        for (const x of z < zOf(41) + 8 ? [west0 + 1.5, east1 - 1.5] : [west0 + 1.5]) {
          props.push({ shape: 'box', size: [0.06, 1, 0.06], pos: [x, WATER + 1, z], color: 0xf4f4f0, ghost: true });
          for (let up = 0.4; up < 2; up += 0.5) props.push({ shape: 'box', size: [0.07, 0.08, 0.07], pos: [x, WATER + up, z], color: 0xc8372d, ghost: true });
        }
      }
      // A work pontoon moored off the dike, sandbags and drums on it.
      {
        const px = west0 + 6, pz = zOf(44);
        props.push({ shape: 'box', size: [3, 0.3, 2], pos: [px, WATER + 0.2, pz], color: 0x9aa0a6, ghost: true });
        for (const dx of [-2.6, 2.6]) props.push({ shape: 'box', size: [0.1, 0.25, 2], pos: [px + dx, WATER + 0.6, pz], color: YELLOW, ghost: true });
        for (let i = 0; i < 6; i++) props.push({ shape: 'box', size: [0.45, 0.14, 0.24], pos: [px - 1.4 + (i % 3) * 0.95, WATER + 0.64 + Math.floor(i / 3) * 0.28, pz - 0.6], color: 0xb9a57a, ghost: true });
        for (const dz of [0.4, 1.1]) props.push({ shape: 'cylinder', size: [0.3, 0.45, 0], pos: [px + 1.6, WATER + 0.95, pz + dz], color: 0x2f5f9a, ghost: true });
        line([px + 3, WATER + 0.5, pz], [C[0] - 7, WATER + 2.4, pz + 1], 0.04, 0xd8c8a0);
      }
      // Egrets in the shallows either side of the dike, and more places for them to come down at; on the clear pond, the
      // slurry pond's mud and the fresh bed's puddles too.
      for (let z = zOf(34) + 6, n = 0; z < zOf(49) + 4; z += 22, n++) {
        egret(n % 2 ? west0 + 3 + hash(n, 241) * 4 : east1 - 3 - hash(n, 241) * 4, z, WATER, n % 3 === 2);
        egret(n % 2 ? east1 - 4 : west0 + 5, z + 11, WATER, n % 2 === 0);
      }
      for (const [x, z] of [[118, 548], [146, 572], [110, 620], [146, 650], [126, 640]] as const) egret(x, z, WATER, true);
      for (const [x, z] of [[-10, 570], [-2, 584], [-20, 590]] as const) egret(x, z, WATER + 0.2, z !== 584);
      for (const [x, z] of [[-1, 642], [12, 631], [9, 650]] as const) egret(x, z, 3.9, x !== 12);

      // The bank above the ponds, west of the way down: the slurry main on sleepers, a track along it, valve pits, spare
      // lengths of pipe, the water lab's van; a railing along the top of the drop.
      const bank = zOf(33), bw0 = xOf(0) - 7, bw1 = C[0] - 12;
      for (let x = bw0 + 1; x < bw1 - 1; x += 2.4) decals.push({ pos: [x, bank - 5], size: [2.6, 3.4], rotY: hash(x, 3) * 0.2, color: 0x9a9284, base: BANK_Y, y: 0.02 });
      for (let x = bw0 + 1; x < xOf(3) + 8; x += 3) props.push({ shape: 'box', size: [0.15, 0.1, 0.6], pos: [x, BANK_Y + 0.1, bank], color: 0x6b5a46 });
      for (const x of [bw0 + 12, bw0 + 38, bw0 + 58]) {
        props.push({ shape: 'box', size: [0.8, 0.12, 0.8], pos: [x, BANK_Y + 0.12, bank + 2.2], color: 0xb4b6b2 }, { shape: 'box', size: [0.6, 0.03, 0.6], pos: [x, BANK_Y + 0.26, bank + 2.2], color: 0x3a3f45, ghost: true });
        props.push({ shape: 'box', size: [0.06, 0.45, 0.06], pos: [x, BANK_Y + 1.1, bank], color: STEEL }, { shape: 'cylinder', size: [0.35, 0.03, 0], pos: [x, BANK_Y + 1.55, bank], color: 0xc8372d, ghost: true });
        taken.push([x, bank + 1, 1.5]);
      }
      {
        const px = bw0 + 46, pz = bank + 4.5;
        for (const [dz, up] of [[-0.85, 0], [0, 0], [0.85, 0], [-0.42, 0.74], [0.42, 0.74], [0, 1.48]] as const) props.push({ shape: 'cylinder', size: [0.42, 3, 0], pos: [px, BANK_Y + 0.42 + up, pz + dz], rot: [0, 0, Math.PI / 2], color: 0x5f646a });
        for (const dx of [-2.2, 2.2]) props.push({ shape: 'box', size: [0.12, 0.08, 1.4], pos: [px + dx, BANK_Y + 0.08, pz], color: 0x6b5a46 });
        for (const [dx, yaw] of [[5, 0.4], [6.6, -0.8]] as const) props.push({ shape: 'cylinder', size: [0.42, 0.7, 0], pos: [px + dx, BANK_Y + 0.42, pz], rot: [0, yaw, Math.PI / 2], color: 0x5f646a });
        taken.push([px, pz, 4]);
      }
      {
        const vx = bw0 + 22, vz = bank - 5;
        props.push({ shape: 'box', size: [1.7, 0.95, 0.95], pos: [vx - 0.6, BANK_Y + 1.35, vz], color: 0xf2f2ee });
        props.push({ shape: 'box', size: [0.75, 0.7, 0.95], pos: [vx + 1.85, BANK_Y + 1.1, vz], color: 0xf2f2ee });
        props.push({ shape: 'box', size: [0.02, 0.32, 0.8], pos: [vx + 2.61, BANK_Y + 1.45, vz], color: 0x3a4a5a, ghost: true });
        props.push({ shape: 'box', size: [1.2, 0.18, 0.96], pos: [vx - 0.6, BANK_Y + 1.5, vz], color: 0x2f7a5a, ghost: true });
        for (const dx of [-1.5, 1.7]) for (const dz of [-0.85, 0.85]) props.push({ shape: 'cylinder', size: [0.34, 0.15, 0], pos: [vx + dx, BANK_Y + 0.34, vz + dz], rot: [Math.PI / 2, 0, 0], color: 0x2a2c30 });
        taken.push([vx, vz, 3.5]);
      }
      fence([bw0, bank + 7.2], [bw1, bank + 7.2]);
      // East of it: where the pond gang take their break: the container they sit in under its awning, chairs and a table
      // out in front, the toilets in a row, a pickup and scooters, the flag, the safety board, a floodlight.
      const be0 = C[0] + 12;
      {
        const cx = be0 + 12, cz = bank - 3;
        container(cx, cz, BANK_Y, 0, 0x3f6f8a);
        props.push({ shape: 'box', size: [0.5, 0.45, 0.02], pos: [cx - 1.6, BANK_Y + 1.5, cz + 1.22], color: 0x3a4a5a, ghost: true }, { shape: 'box', size: [0.45, 0.95, 0.02], pos: [cx + 1.2, BANK_Y + 0.95, cz + 1.22], color: 0x2a2e33, ghost: true });
        props.push({ shape: 'box', size: [3.2, 0.05, 1.4], pos: [cx, BANK_Y + 2.7, cz + 2.6], rot: [0.12, 0, 0], color: 0x2f7a5a, ghost: true });
        for (const dx of [-3, 3]) props.push({ shape: 'box', size: [0.05, 1.3, 0.05], pos: [cx + dx, BANK_Y + 1.3, cz + 3.9], color: STEEL });
        props.push({ shape: 'box', size: [0.7, 0.04, 0.5], pos: [cx, BANK_Y + 0.72, cz + 3], color: 0xe8e8e2 }, { shape: 'box', size: [0.05, 0.35, 0.05], pos: [cx, BANK_Y + 0.35, cz + 3], color: STEEL });
        for (const [dx, dz] of [[-1.1, 0], [1.1, 0], [0, 0.9], [-0.4, -0.9]] as const) props.push({ shape: 'box', size: [0.22, 0.22, 0.22], pos: [cx + dx, BANK_Y + 0.22, cz + 3 + dz], color: dx > 0 ? 0xe8e8e2 : 0x2f62a8 });
        taken.push([cx, cz + 1, 5]);
        for (let n = 0; n < 3; n++) {
          const tx = cx + 10 + n * 1.35;
          props.push({ shape: 'box', size: [0.6, 1.15, 0.6], pos: [tx, BANK_Y + 1.15, bank - 4], color: 0x2f62a8 }, { shape: 'box', size: [0.64, 0.06, 0.64], pos: [tx, BANK_Y + 2.36, bank - 4], color: 0xe8e8e2, ghost: true });
        }
        taken.push([cx + 11.4, bank - 4, 2.5]);
        for (let n = 0; n < 3; n++) s.object((['scooterBlue', 'scooterWhite', 'scooterRed'] as const)[n], cx - 5 + n * 1.1, bank + 1.5, 0, BANK_Y);
        const kx = cx + 18, kz = bank + 2;
        props.push({ shape: 'box', size: [1.2, 0.45, 0.95], pos: [kx - 1, BANK_Y + 0.95, kz], color: 0xd8dcd8 }, { shape: 'box', size: [0.8, 0.45, 0.9], pos: [kx + 0.6, BANK_Y + 1.35, kz], color: 0xd8dcd8 });
        props.push({ shape: 'box', size: [0.02, 0.28, 0.75], pos: [kx + 1.41, BANK_Y + 1.45, kz], color: 0x3a4a5a, ghost: true });
        props.push({ shape: 'box', size: [2.3, 0.3, 0.9], pos: [kx, BANK_Y + 0.6, kz], color: 0x3a3f45 });
        for (const dx of [-1.4, 1.2]) for (const dz of [-0.85, 0.85]) props.push({ shape: 'cylinder', size: [0.34, 0.14, 0], pos: [kx + dx, BANK_Y + 0.34, kz + dz], rot: [Math.PI / 2, 0, 0], color: 0x2a2c30 });
        taken.push([kx, kz, 3]);
        const fx = be0 + 2.5, fz = bank - 5;
        props.push({ shape: 'cylinder', size: [0.06, 4, 0], pos: [fx, BANK_Y + 4, fz], color: 0xe8e8e2 }, { shape: 'box', size: [0.02, 0.45, 0.7], pos: [fx, BANK_Y + 7.4, fz + 0.72], color: 0xc8372d, ghost: true });
        for (const dx of [-1.7, 1.7]) props.push({ shape: 'box', size: [0.07, 1.7, 0.07], pos: [be0 + 6 + dx, BANK_Y + 1.7, bank + 5], color: STEEL });
        const lx = be0 + 40, lz = bank - 5;
        props.push({ shape: 'cylinder', size: [0.14, 6, 0], pos: [lx, BANK_Y + 6, lz], color: STEEL }, { shape: 'box', size: [1.4, 0.5, 0.3], pos: [lx, BANK_Y + 12.2, lz + 0.2], rot: [0.5, 0, 0], color: 0x3a3f45 });
        for (const dx of [-0.75, -0.25, 0.25, 0.75]) props.push({ shape: 'box', size: [0.2, 0.18, 0.03], pos: [lx + dx, BANK_Y + 12.1, lz + 0.52], rot: [0.5, 0, 0], color: 0xf2e6b0, ghost: true });
        taken.push([fx, fz, 1], [lx, lz, 1]);
      }
      fence([be0, bank + 7.2], [xOf(8) + 8, bank + 7.2]);
    }
    // ---- The high street ----
    {
      const y = TOP, z = w.parkZ, x0 = A[0];
      // The gravel at the corner out of the stockpiles: stones strewn over the concrete, thickest on the outside of the turn
      // where the lorries swing wide; black marks where tyres have slid on it; a heap swept up on the inside.
      const turn: Vec2 = [x0 + 10, z - 10];
      const BITS = [0x9c9384, 0xaea592, 0x857f75, 0xb8ae98];
      // Dust of it spread in patches, and the stones themselves, small and lying low, most on the outside of the turn.
      for (let k = 0; k < 26; k++) {
        const a = Math.PI / 2 - 0.1 + hash(k, 311) * (Math.PI / 2 + 0.3), r = 7 + hash(k, 312) * 7;
        decals.push({ pos: [turn[0] + Math.cos(a) * r, turn[1] + Math.sin(a) * r], size: [1.6 + hash(k, 313) * 2.2, 1 + hash(k, 314) * 1.6], rotY: hash(k, 315) * 3, color: 0x7f7a70, base: y, y: 0.02 });
      }
      for (let k = 0; k < 520; k++) {
        const a = Math.PI / 2 - 0.15 + hash(k, 301) * (Math.PI / 2 + 0.45), r = 5 + Math.pow(hash(k, 302), 0.6) * 10, big = 0.025 + hash(k, 303) * 0.05;
        props.push({ shape: 'box', size: [big * 1.3, big * 0.7, big], pos: [turn[0] + Math.cos(a) * r, y + big * 0.5, turn[1] + Math.sin(a) * r], rot: [hash(k, 306) * 0.5, hash(k, 305) * 3, hash(k, 307) * 0.5], color: BITS[k % 4], ghost: true });
      }
      for (const r of [11.4, 13.2]) {
        for (let a = Math.PI / 2 + 0.12; a < Math.PI - 0.1; a += 0.1) decals.push({ pos: [turn[0] + Math.cos(a) * r, turn[1] + Math.sin(a) * r], size: [0.18, r * 0.105], rotY: Math.atan2(-Math.sin(a), Math.cos(a)), color: 0x3a3732, base: y, y: 0.03 });
      }
      const hx = turn[0] - 2.4, hz = turn[1] + 2.4;
      props.push({ shape: 'cone', size: [1.1, 0.28, 0], pos: [hx, y + 0.28, hz], color: 0x8f887a }, { shape: 'cone', size: [0.6, 0.18, 0], pos: [hx + 0.8, y + 0.18, hz - 0.5], color: 0x9c9384, ghost: true });
      // What a truck sliding wide meets: the filling station's corner marked off with water barriers, its tyres and drums.
      for (const bx of [x0 - 6.5, x0 - 3.7, x0 - 0.9]) s.object('barrier', bx, z + 6.3);
      s.object('tyreStack', x0 - 6.2, z + 9);
      s.object('tyreStack', x0 - 4.8, z + 10.2);
      for (const [dx, dz] of [[1.2, 9], [1.9, 9.8], [2.6, 9]] as const) s.object('barrel', x0 + dx, z + dz);
      // A lorry waiting its turn at the pumps.
      lorry(x0 + 15, z + 10.3, -Math.PI / 2);
      // The lunch van at the canteen's kerb, its side let down for a counter, the flap up over it; the lunch boxes on it;
      // a table out in front, drinks in crates, the queue.
      const vx = 76, vz = z + 10.4;
      s.traffic.push({ from: [vx + 0.25, vz], to: [vx - 0.25, vz], cars: 1, speed: 0, kinds: ['van'] });
      s.object('table', vx - 1, z + 7.6);
      for (const dx of [1.6, 2.4]) s.object('box', vx + dx, z + 7.3);
      s.object('chair', vx - 2.2, z + 7.4, Math.PI / 2);
      s.crowds.push({ area: [vx - 3, z + 6.4, vx + 3, z + 8.4], count: 4, y, workers: true });
      s.object('betelBooth', 85.5, z + 8.2, Math.PI);
      for (const px of [57.6, 69.2]) s.object('flowerPotTall', px, z + 7.2);
      // The south side: the yard's green walkway, edged yellow, the crews' scooters in a row past it; the crossing over to the
      // canteen, drivers going over and back.
      decals.push({ pos: [71, z - 7], size: [26, 1.8], color: 0x4f8a5a, base: y, y: 0.02 });
      for (const dz of [-0.95, 0.95]) decals.push({ pos: [71, z - 7 + dz], size: [26, 0.12], color: 0xe8b81e, base: y, y: 0.03 });
      for (let dz = -3.5; dz <= 3.5; dz += 1) decals.push({ pos: [70, z + dz], size: [3, 0.45], color: 0xe8e4d8, base: y, y: 0.03 });
      const RIDES: ObjectKindId[] = ['scooterWhite', 'scooterRed', 'scooterBlack', 'scooterBlue', 'scooterTeal', 'scooterYellow'];
      for (let i = 0; i < 11; i++) s.object(RIDES[i % 6], 86 + i * 0.85, z - 8.2, 0);
      s.crowds.push({ area: [68.8, z - 9, 71.2, z + 9.5], count: 5, y, workers: true, crossing: 'z' });
      s.crowds.push({ area: [58, z - 7.7, 84, z - 6.3], count: 3, y, workers: true });
    }

    // ---- The pump station, the levee and the river's flats below it ----
    {
      const PY = PONDS + DIKE_H, LY = LEVEE_TOP, FY = RIVER_BANK;
      /** Concrete facing over a face of the ground from a to b, the low side toward `low` (a unit vector across), up to top. */
      const clad = (a: Vec2, b: Vec2, low: Vec2, top: number) => {
        const long = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
        const ux = (b[0] - a[0]) / long, uz = (b[1] - a[1]) / long;
        for (let d = 0, n = 0; d < long - 0.05; d += 2, n++) {
          const len = Math.min(2, long - d), x = a[0] + ux * (d + len / 2), z = a[1] + uz * (d + len / 2);
          const foot = Math.min(ground(a[0] + ux * d + low[0] * 0.6, a[1] + uz * d + low[1] * 0.6), ground(a[0] + ux * (d + len) + low[0] * 0.6, a[1] + uz * (d + len) + low[1] * 0.6)) - 0.25;
          // No higher than the ground behind it, where that falls away.
          const hi = Math.min(top, ground(x - low[0] * 0.6, z - low[1] * 0.6));
          if (hi - foot < 0.3) continue;
          props.push({ shape: 'box', size: [0.04, (hi - foot) / 2, len / 2], pos: [x + low[0] * 0.06, (hi + foot) / 2, z + low[1] * 0.06], rot: [0, yaw, 0], color: 0xb4b6b0, ghost: true });
          if (n % 2 === 0) props.push({ shape: 'box', size: [0.05, (hi - foot) / 2, 0.035], pos: [a[0] + ux * d + low[0] * 0.08, (hi + foot) / 2, a[1] + uz * d + low[1] * 0.08], rot: [0, yaw, 0], color: 0x8e908a, ghost: true });
          props.push({ shape: 'box', size: [0.22, 0.12, len / 2], pos: [x + low[0] * 0.1, hi + 0.06, z + low[1] * 0.1], rot: [0, yaw, 0], color: 0xc8cac4, ghost: true });
        }
      };
      const W0 = GATE_X - 3.25, W1 = GATE_X + 3.25;
      clad([PUMP_YARD.x0, PUMP_YARD.z1], [W0, PUMP_YARD.z1], [0, -1], LY);
      clad([W1, PUMP_YARD.z1], [93, PUMP_YARD.z1], [0, -1], LY);
      clad([PUMP_YARD.x0, PUMP_YARD.z0], [PUMP_YARD.x0, PUMP_YARD.z1], [1, 0], LY);
      clad([W0, PUMP_YARD.z1], [W0, GATE_TO], [1, 0], LY);
      clad([W1, PUMP_YARD.z1], [W1, GATE_TO], [-1, 0], LY);
      {
        const dx = RAMP_FOOT[0] - GATE_X, dz = RAMP_FOOT[1] - GATE_TO, long = Math.hypot(dx, dz), nx = dz / long, nz = -dx / long;
        clad([GATE_X - nx * 3.25, GATE_TO - nz * 3.25], [RAMP_FOOT[0] - nx * 3.25, RAMP_FOOT[1] - nz * 3.25 - 0.5], [nx, nz], FY);
        clad([GATE_X + nx * 3.25, GATE_TO + nz * 3.25], [RAMP_FOOT[0] + nx * 3.25, RAMP_FOOT[1] + nz * 3.25 - 0.5], [-nx, -nz], FY);
      }
      /** A pipe or a rope, straight from one place to another. */
      const run = (a: Spot, b: Spot, r: number, color: number) => {
        const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], flat = Math.hypot(dx, dz);
        props.push({ shape: 'cylinder', size: [r, Math.hypot(flat, dy) / 2, 0], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [0, Math.atan2(-dz, dx), Math.PI / 2 + Math.atan2(dy, flat)], color, ghost: true });
      };

      // The flood gang's store, west of the way: its shed against the levee, sandbags on pallets, pumps on their trailers
      // ready to go out, their hoses run to the pond to try them, a light tower, the pickup; sandbags stacked by the way,
      // cones; along the pond's edge a crash barrier.
      const sx = PUMP_YARD.x0 + 4.5, sz = PUMP_YARD.z1 - 3;
      props.push({ shape: 'box', size: [4, 2.2, 3], pos: [sx, PY + 2.2, sz], color: 0x8a9aa4 });
      props.push({ shape: 'box', size: [4.3, 0.12, 3.3], pos: [sx, PY + 4.5, sz], color: 0x2f5f8a });
      props.push({ shape: 'box', size: [0.03, 1.5, 1.8], pos: [sx + 4.03, PY + 1.5, sz], color: 0x5f6a72, ghost: true });
      taken.push([sx, sz, 5]);
      for (let i = 0; i < 4; i++) {
        const px = PUMP_YARD.x0 + 10.5 + i * 1.7, pz = PUMP_YARD.z1 - 1.6;
        s.object('pallet', px, pz, 0, PY);
        for (let h = 0; h < 3 + (i % 2); h++) s.object('sandbag', px + (h % 2) * 0.1, pz, (h % 2) * 0.4, PY + 0.15 + h * 0.28);
      }
      for (let i = 0; i < 8; i++) s.object('sandbag', 79.2 - (i % 2) * 0.55, 795.8 + Math.floor(i / 2) * 1.1, Math.PI / 2, i < 6 ? PY : PY + 0.28);
      for (const [px, pz] of [[65, 795.6], [69.5, 795.6]] as const) {
        s.object('pumpSet', px, pz, Math.PI / 2, PY);
        run([px, PY + 0.12, pz - 0.6], [px + 0.4, PY + 0.12, PUMP_YARD.z0 + 0.4], 0.07, 0x2c4f8a);
        run([px + 0.4, PY + 0.12, PUMP_YARD.z0 + 0.4], [px + 0.5, PY - 3.2, PUMP_YARD.z0 - 1.2], 0.07, 0x2c4f8a);
      }
      {
        const lx = PUMP_YARD.x0 + 2, lz = PUMP_YARD.z0 + 2.5;
        props.push({ shape: 'box', size: [0.6, 0.45, 1.1], pos: [lx, PY + 0.65, lz], color: YELLOW });
        props.push({ shape: 'cylinder', size: [0.08, 3.5, 0], pos: [lx, PY + 4.4, lz], color: STEEL });
        props.push({ shape: 'box', size: [1, 0.35, 0.2], pos: [lx, PY + 8, lz + 0.1], color: 0x3a3f45 }, { shape: 'box', size: [0.9, 0.28, 0.02], pos: [lx, PY + 8, lz + 0.31], color: 0xf2e6b0, ghost: true });
        taken.push([lx, lz, 1.5]);
      }
      {
        const kx = 74.5, kz = PUMP_YARD.z0 + 3.8;
        s.traffic.push({ from: [kx + 0.25, kz], to: [kx - 0.25, kz], cars: 1, speed: 0, kinds: ['pickup'] });
      }
      for (const [cx, cz] of [[79.6, 794.4], [79.9, 801.8], [90.6, 796], [90.8, 802.2]] as const) s.object('cone', cx, cz, 0, PY);
      for (const gx of [62, 66, 70, 74, 89.6]) s.object('guardrail', gx, PUMP_YARD.z0 + 0.7, Math.PI / 2, PY);
      for (const [jx, jz] of [[92, 796.6], [92.2, 797.4], [91.9, 798.2]] as const) s.object('jerrycan', jx, jz, 0.3, PY);
      s.crowds.push({ area: [62, PUMP_YARD.z0 + 2, 76, PUMP_YARD.z0 + 7], count: 3, y: PY, workers: true });

      // The pump house's mains out over the levee: out of its roof, across the levee's top, down the river's face, along
      // the bank on saddles to the outfall at its edge, pouring white into the river.
      const WATER_Y = RIVER_Y + RIVER_SURFACE, MAIN = 0x2c5f9a;
      for (let i = 0; i < 3; i++) {
        const x = 107 + i * 2.4, z0 = 796 + i * 4;
        const pts: Spot[] = [[100.5, PY + 6.4, z0], [x, LY + 0.6, z0], [x, LY + 0.6, GATE_TO - 0.4], [x, FY + 0.55, GATE_TO + 4], [x, FY + 0.55, 838.4], [x, FY - 0.2, 839.5]];
        for (let n = 0; n < pts.length - 1; n++) run(pts[n], pts[n + 1], 0.42, MAIN);
        for (let sz2 = z0 + 4; sz2 < GATE_TO - 2; sz2 += 6) props.push({ shape: 'box', size: [0.55, 0.12, 0.3], pos: [x, LY + 0.12, sz2], color: 0xa9a59b });
        for (const sz2 of [829, 834]) props.push({ shape: 'box', size: [0.55, 0.12, 0.3], pos: [x, FY + 0.12, sz2], color: 0xa9a59b });
        props.push({ shape: 'box', size: [0.3, (FY - 0.6 - WATER_Y) / 2, 0.25], pos: [x, (FY - 0.6 + WATER_Y) / 2, 840.1], color: 0xdcecf2, ghost: true });
        for (let k = 0; k < 6; k++) decals.push({ pos: [x + (hash(k, 500 + i) - 0.5) * 2.4, 841 + hash(k, 510 + i) * 3.5], size: [0.5 + hash(k, 520) * 0.8, 0.4 + hash(k, 530) * 0.7], rotY: hash(k, 540) * 3, color: 0xf2f7f8, base: WATER_Y, y: 0.03 });
      }
      props.push({ shape: 'box', size: [4.4, 1, 0.4], pos: [109.4, FY - 0.6, 839.6], color: 0xb4b6b0 });
      // Between the way down and the mains: the valve pit on the mains, a lifebuoy on its post, the no-swimming board, scrub.
      props.push({ shape: 'box', size: [1.4, 0.15, 1], pos: [104.5, FY + 0.15, 832], color: 0xb4b6b0 }, { shape: 'box', size: [1.1, 0.03, 0.7], pos: [104.5, FY + 0.31, 832], color: 0x3a3f45, ghost: true });
      props.push({ shape: 'box', size: [0.06, 0.8, 0.06], pos: [100.5, FY + 0.8, 838], color: STEEL }, { shape: 'cylinder', size: [0.4, 0.07, 0], pos: [100.5, FY + 1.4, 838.1], rot: [Math.PI / 2, 0, 0], color: 0xe0601e, ghost: true });
      props.push({ shape: 'box', size: [0.05, 0.75, 0.05], pos: [99, FY + 0.75, 829], color: STEEL }, { shape: 'box', size: [0.55, 0.4, 0.03], pos: [99, FY + 1.7, 829], rot: [0, -0.3, 0], color: 0xc8372d });
      for (const [bx, bz] of [[101.5, 845], [99.5, 842.5], [103, 828]] as const) bush(bx, bz, FY, Math.round(bx * bz));

      // The levee's top: the riverside path, red, its rail along the river's side and a fence along the other; lamps and
      // benches looking over the water; a row of trees, a pavilion, a half court and keep-fit bars on the grass on the
      // west, the river patrol's hut, its siren and the gauge on the east; people walking.
      const L0 = xOf(-1) - 8, L1 = xOf(8) + 8, PATH = GATE_TO - 3.5, EDGE = GATE_TO - 0.6;
      const spans: [number, number][] = [[L0, W0 - 0.4], [W1 + 0.4, L1]];
      for (const [a0, a1] of spans) {
        decals.push({ pos: [(a0 + a1) / 2, PATH], size: [a1 - a0 - 1, 2.6], color: 0xa0584a, base: LY, y: 0.02 });
        for (let x = a0 + 3; x < a1 - 2; x += 6) decals.push({ pos: [x, PATH], size: [2.4, 0.12], color: 0xe8e4d8, base: LY, y: 0.03 });
        fence([a0 + 0.5, EDGE], [a1 - 0.5, EDGE]);
      }
      fence([L0 + 0.5, LEVEE_FROM + 0.8], [PUMP_YARD.x0 - 0.4, LEVEE_FROM + 0.8]);
      fence([PUMP_YARD.x0 - 0.4, LEVEE_FROM + 0.8], [PUMP_YARD.x0 - 0.4, PUMP_YARD.z1 + 0.4]);
      fence([PUMP_YARD.x0 - 0.4, PUMP_YARD.z1 + 0.4], [W0 - 0.4, PUMP_YARD.z1 + 0.4]);
      fence([W0 - 0.4, PUMP_YARD.z1 + 0.4], [W0 - 0.4, EDGE]);
      fence([W1 + 0.4, PUMP_YARD.z1 + 0.4], [W1 + 0.4, EDGE]);
      fence([W1 + 0.4, PUMP_YARD.z1 + 0.4], [PUMP_YARD.x1, PUMP_YARD.z1 + 0.4]);
      fence([PUMP_YARD.x1 + 0.4, LEVEE_FROM + 0.8], [L1 - 0.5, LEVEE_FROM + 0.8]);
      for (let x = L0 + 6, n = 0; x < L1 - 2; x += 12, n++) {
        if (Math.abs(x - GATE_X) < 6 || (x > 104 && x < 114)) continue;
        if (n % 2 === 0) {
          props.push({ shape: 'cylinder', size: [0.07, 1.9, 0], pos: [x, LY + 1.9, EDGE - 0.5], color: 0x3f4a52 });
          props.push({ shape: 'box', size: [0.3, 0.1, 0.45], pos: [x, LY + 3.85, EDGE - 0.75], color: 0x3f4a52 }, { shape: 'box', size: [0.25, 0.03, 0.35], pos: [x, LY + 3.74, EDGE - 0.75], color: 0xf2e6b0, ghost: true });
        } else {
          s.object('bench', x, EDGE - 1.1, Math.PI, LY);
        }
        if (x < W0 - 4 || x > 114) tree(x + 3, PATH - 3.2, LY, n + 600);
      }
      {
        const px = 20, pz = LEVEE_FROM + 9;
        for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) props.push({ shape: 'box', size: [0.15, 1.3, 0.15], pos: [px + dx, LY + 1.3, pz + dz], color: 0xb5362a });
        props.push({ shape: 'cone', size: [3.4, 0.9, 0], pos: [px, LY + 3.3, pz], rot: [0, Math.PI / 4, 0], color: 0x2f7a5a });
        props.push({ shape: 'cylinder', size: [0.6, 0.38, 0], pos: [px, LY + 0.38, pz], color: 0xa9a59b });
        for (const [dx, dz] of [[1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3]]) props.push({ shape: 'cylinder', size: [0.22, 0.22, 0], pos: [px + dx, LY + 0.22, pz + dz], color: 0xa9a59b });
        taken.push([px, pz, 4]);
        const cx = 42, cz = LEVEE_FROM + 9;
        decals.push({ pos: [cx, cz], size: [14, 13], color: 0x5f8a7a, base: LY, y: 0.02 });
        for (const [dx, dz, sx2, sz2] of [[0, -6.3, 14, 0.12], [0, 6.3, 14, 0.12], [-6.9, 0, 0.12, 12.6], [6.9, 0, 0.12, 12.6], [0, 4, 4.8, 0.12], [-2.4, 2.3, 0.12, 3.4], [2.4, 2.3, 0.12, 3.4]] as const) decals.push({ pos: [cx + dx, cz + dz], size: [sx2, sz2], color: 0xe8e8e2, base: LY, y: 0.03 });
        props.push({ shape: 'box', size: [0.1, 1.6, 0.1], pos: [cx, LY + 1.6, cz + 7], color: 0x3f4a52 }, { shape: 'box', size: [0.9, 0.6, 0.05], pos: [cx, LY + 3.3, cz + 6.6], color: 0xe8e8e2 }, { shape: 'cylinder', size: [0.25, 0.02, 0], pos: [cx, LY + 3, cz + 6.3], color: 0xe0601e, ghost: true });
        taken.push([cx, cz, 8]);
        for (let i = 0; i < 4; i++) {
          const bx = i * 3.2, bz = LEVEE_FROM + 8;
          for (const dx of [-0.6, 0.6]) props.push({ shape: 'box', size: [0.05, 0.75, 0.05], pos: [bx + dx, LY + 0.75, bz], color: [0x2f62a8, 0xe0a81e, 0x3f8a4a, 0xc8372d][i] });
          props.push({ shape: 'box', size: [0.65, 0.04, 0.04], pos: [bx, LY + 1.5 - (i % 2) * 0.4, bz], color: STEEL, ghost: true });
        }
        taken.push([5, LEVEE_FROM + 8, 7]);
        for (let x = L0 + 4, n = 0; x < PUMP_YARD.x0 - 3; x += 9, n++) if (free(x, LEVEE_FROM + 3.5, 2)) tree(x, LEVEE_FROM + 3.5, LY, n + 640);
        const hx = 124, hz = LEVEE_FROM + 6;
        props.push({ shape: 'box', size: [3.05, 1.3, 1.2], pos: [hx, LY + 1.3, hz], color: 0xe4e0d4 }, { shape: 'box', size: [3.1, 0.06, 0.04], pos: [hx, LY + 2, hz + 1.22], color: 0x2f62a8, ghost: true });
        for (const wx of [-1.6, 1.2]) props.push({ shape: 'box', size: [0.5, 0.4, 0.02], pos: [hx + wx, LY + 1.6, hz + 1.22], color: 0x3a4a5a, ghost: true });
        props.push({ shape: 'cylinder', size: [0.1, 4.5, 0], pos: [118, LY + 4.5, PATH - 3], color: STEEL });
        for (const dx of [-0.3, 0.3]) props.push({ shape: 'cylinder', size: [0.22, 0.25, 0], pos: [118 + dx, LY + 8.6, PATH - 3], rot: [0, 0, Math.PI / 2], color: 0xe8e8e2 });
        taken.push([hx, hz, 4], [118, PATH - 3, 1]);
        for (let up = 0; up < 4.6; up += 0.5) props.push({ shape: 'box', size: [0.25, 0.25, 0.02], pos: [130, FY + 0.25 + up, GATE_TO + 0.03], color: Math.round(up * 2) % 2 ? 0xe8e8e2 : 0xc8372d, ghost: true });
        s.crowds.push({ area: [L0 + 4, PATH - 1, W0 - 6, PATH + 1], count: 6, y: LY });
        s.crowds.push({ area: [W1 + 20, PATH - 1, L1 - 4, PATH + 1], count: 2, y: LY });
        s.crowds.push({ area: [cx - 5, cz - 5, cx + 5, cz + 5], count: 3, y: LY });
      }
      // The flats below the levee, farmed in plots: greens in rows, cabbages, beans on canes, ground turned over, melons on
      // straw, rows under white mulch; a tin shed here and there with its water drums, a scarecrow, someone at work.
      const SOIL = 0x7a6448, GREENS = [0x5f8a3f, 0x6f9a48, 0x4f7a38];
      let sheds = 0, people = 0;
      for (let i = 0; i < 7; i++) for (let j = 0; j < 9; j++) {
        const x0 = -36 + i * 14, z0 = GATE_TO + 4 + j * 20, x1 = x0 + 12, z1 = z0 + 18, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        const k = i * 31 + j * 17 + 3, pick = hash(k, 401);
        const straw = pick > 0.8 && pick < 0.9;
        decals.push({ pos: [cx, cz], size: [12, 18], color: straw ? 0xd2b455 : pick > 0.62 && pick <= 0.8 ? 0x6a5440 : SOIL, base: FY, y: 0.02 });
        if (pick < 0.5) {
          const wide = pick < 0.35 ? 0.45 : 0.75, step = pick < 0.35 ? 1.2 : 1.3;
          for (let r = x0 + 0.8; r < x1 - 0.4; r += step) decals.push({ pos: [r, cz], size: [wide, 16.8], color: pick < 0.35 ? GREENS[Math.floor(hash(k, r) * 3)] : 0x8fb05a, base: FY, y: 0.03 });
        } else if (pick < 0.62) {
          for (let r = x0 + 1.2; r < x1 - 0.8; r += 2.4) {
            decals.push({ pos: [r, cz], size: [0.6, 16.8], color: GREENS[1], base: FY, y: 0.03 });
            // Canes leaning together over the row, grown over with leaves, in lengths with gaps between.
            for (const dz of [-5.6, 0, 5.6]) s.object('beanTrellis', r, cz + dz, 0, FY);
          }
        } else if (pick < 0.8) {
          for (let r = x0 + 0.6; r < x1 - 0.3; r += 0.8) decals.push({ pos: [r, cz], size: [0.14, 17], color: 0x5a4636, base: FY, y: 0.03 });
        } else if (straw) {
          for (let n = 0; n < 26; n++) decals.push({ pos: [x0 + 1 + hash(k, n) * 10, z0 + 1 + hash(n, k) * 16], size: [0.7 + hash(k + n, 2) * 0.8, 0.6 + hash(k + n, 3) * 0.7], rotY: hash(k, n + 50), color: GREENS[n % 3], base: FY, y: 0.03 });
          for (let n = 0; n < 7; n++) props.push({ shape: 'sphere', size: [0.24, 0.21, 0.24], pos: [x0 + 1.5 + hash(k, n + 80) * 9, FY + 0.2, z0 + 1.5 + hash(n + 80, k) * 15], rot: [Math.PI / 2, hash(k, n) * 3, 0], color: 0xffffff, texture: 'melon', ghost: true });
        } else {
          for (let r = x0 + 0.9; r < x1 - 0.5; r += 1.5) decals.push({ pos: [r, cz], size: [0.8, 16.8], color: 0xd8dcd8, base: FY, y: 0.03 });
        }
        taken.push([cx, cz, 9]);
        if (hash(k, 410) < 0.2 && sheds < 6) {
          sheds++;
          const hx = x1 + 1, hz = z0 + 2.5;
          s.object('farmShed', hx, hz, 0, FY);
          for (const dz of [1.9, 2.6]) s.object('waterDrum', hx, hz + dz, 0, FY);
        }
        if (hash(k, 411) < 0.12) s.object('scarecrow', cx + 2, cz - 3, hash(k, 412) * 3, FY);
        if (hash(k, 413) < 0.16 && people < 7) {
          people++;
          s.crowds.push({ area: [x0 + 1, z0 + 1, x1 - 1, z1 - 1], count: 1, y: FY, fenced: true });
        }
      }
      // Between the flats and the crossing, and along the bank's edge east of the outfall, the river's own growth: tall
      // silvergrass in clumps, willows; reeds at the water. A boat pulled up by the outfall.
      for (let z = GATE_TO + 4, n = 0; z < zOf(63) + 6; z += 3.4, n++) {
        for (const x of [56.5 + hash(n, 1) * 2.5, 60 + hash(n, 2) * 2.5]) {
          // Off the bank's edge over the crossing, and level.
          if (x > 80.5 || !level(x, z, 0.8) || Math.abs(ground(x, z) - FY) > 0.1) continue;
          taken.push([x, z, 1.2]);
          if (hash(n, x) < 0.18) tree(x, z, FY, n + 760);
          else for (let i = 0; i < 4; i++) props.push({ shape: 'cone', size: [0.12, 0.7 + hash(n, i) * 0.5, 0], pos: [x + (hash(i, n) - 0.5) * 1.4, FY + 0.75, z + (hash(n + i, 3) - 0.5) * 1.4], rot: [(hash(i, n + 1) - 0.5) * 0.4, 0, (hash(n, i + 1) - 0.5) * 0.4], color: i % 2 ? 0xc8c09a : 0x9aa070, ghost: true });
        }
      }
      // The bank between the flats and the way down, by the crossing: silvergrass grown over it, a willow or two, stones.
      for (let x = 63, i = 0; x < 82; x += 2.6, i++) for (let z = GATE_TO + 3, j = 0; z < D[1] - 25; z += 2.6, j++) {
        const gx = x + (hash(i, j + 900) - 0.5) * 1.6, gz = z + (hash(j, i + 900) - 0.5) * 1.6, h = hash(i + 7, j + 3);
        if (Math.abs(ground(gx, gz) - FY) > 0.05 || !level(gx, gz, 0.8)) continue;
        if (h < 0.06) tree(gx, gz, FY, i * 17 + j + 950);
        else if (h < 0.14) rock(gx, gz, FY, i * 13 + j, 0.5 + hash(i, j) * 0.5);
        else if (h < 0.75) for (let k = 0; k < 4; k++) props.push({ shape: 'cone', size: [0.12, 0.7 + hash(i + k, j) * 0.5, 0], pos: [gx + (hash(k, i + j) - 0.5) * 1.4, FY + 0.75, gz + (hash(i + j, k) - 0.5) * 1.4], rot: [(hash(k, j) - 0.5) * 0.4, 0, (hash(j, k) - 0.5) * 0.4], color: k % 2 ? 0xc8c09a : 0x9aa070, ghost: true });
      }
      for (let x = 115, n = 0; x < xOf(10) + 6; x += 3, n++) {
        reeds(x, GATE_TO + 14.5, FY, n + 800);
        if (n % 3 === 0 && free(x, GATE_TO + 8, 1.2)) bush(x, GATE_TO + 8, FY, n + 820);
        if (n % 5 === 2) tree(x + 1, GATE_TO + 5, FY, n + 840);
      }
      props.push({ shape: 'box', size: [0.9, 0.3, 2.6], pos: [120, FY + 0.3, GATE_TO + 11], rot: [0, 0.4, 0.15], color: 0x2f7a8a }, { shape: 'box', size: [0.75, 0.06, 2.4], pos: [120, FY + 0.58, GATE_TO + 11], rot: [0, 0.4, 0.15], color: 0xd8d2c4, ghost: true });
      // The rock laid on the bank's slope down to the channel, big stones set in it; concrete steps down to the water half
      // way along with a rail, anglers on them.
      {
        const cx = D[0] + RIVER_LIP - FALL_WIDE, bx = cx - 10;
        for (let z = D[1] - 22, n = 0; z < D[1] + 148; z += 2.6, n++) {
          if (Math.abs(z - (D[1] + 62)) < 4) continue;
          for (const t of [0.2, 0.5, 0.8]) {
            const x = bx + t * 10 + (hash(n, t * 10) - 0.5) * 1.6, zz = z + (hash(t * 10, n) - 0.5) * 1.6;
            rock(x, zz, ground(x, zz) - 0.2, n * 3 + Math.round(t * 10), 0.6 + hash(n, t) * 0.5);
          }
        }
        const sz = D[1] + 62;
        for (let i = 0; i < 8; i++) {
          const x = bx + 0.6 + i * 1.2, top = RIVER_BANK - ((x - bx) / 10) * (RIVER_BANK + 4.2) + 0.25;
          props.push({ shape: 'box', size: [0.6, (top + 4.4) / 2, 2.2], pos: [x, (top - 4.4) / 2, sz], color: 0xb4b6b0 });
        }
        for (const dz of [-2.25, 2.25]) run([bx + 0.4, RIVER_BANK + 1, sz + dz], [bx + 9.2, RIVER_BANK - 7.8, sz + dz], 0.04, STEEL);
        s.crowds.push({ area: [bx + 4.5, sz - 1.5, bx + 6, sz + 1.5], count: 2, y: ground(bx + 5.2, sz), fenced: true });
      }
      // The bank rising from the flats to the woods on the west, trees on it.
      for (let z = GATE_TO + 22, n = 0; z < zOf(63) + 6; z += 7, n++) for (const x of [-44, -50]) {
        const tx = x + (hash(n, x) - 0.5) * 2, tz = z + (hash(x, n) - 0.5) * 3;
        if (hash(n, x + 1) < 0.75) tree(tx, tz, ground(tx, tz), n * 3 + x);
        else bush(tx, tz, ground(tx, tz), n + 700);
      }
    }
    // The river's banks: thickets of scrub with a willow or two, and big stones lying in groups.
    for (const { x, z, k } of squares('b')) {
      // Not where the flats are farmed.
      if (x <= 56 && z > GATE_TO && z < zOf(64)) continue;
      const h = hash(k, 80);
      if (h < 0.45) {
        const cx = x + (hash(k, 81) - 0.5) * 6, cz = z + (hash(k, 82) - 0.5) * 6;
        for (let n = 0; n < 6; n++) {
          const bx = cx + (hash(k, 83 + n) - 0.5) * 6, bz = cz + (hash(k, 90 + n) - 0.5) * 6;
          if (!free(bx, bz, 1) || !level(bx, bz, 0.8)) continue;
          taken.push([bx, bz, 1]);
          if (n === 0) tree(bx, bz, ground(bx, bz), k);
          else bush(bx, bz, ground(bx, bz), k + n);
        }
      } else if (h < 0.75) {
        const cx = x + (hash(k, 84) - 0.5) * 8, cz = z + (hash(k, 85) - 0.5) * 8;
        for (let n = 0; n < 4; n++) {
          const bx = cx + (hash(k, 100 + n) - 0.5) * 4, bz = cz + (hash(k, 110 + n) - 0.5) * 4;
          if (free(bx, bz, 1) && level(bx, bz, 0.8)) rock(bx, bz, ground(bx, bz), k + n, 0.6 + hash(k, 120 + n) * 0.9);
        }
      }
    }
    // Hills all round beyond, the quarry's hill rising highest behind it to the west.
    const hill = (x: number, z: number, r: number, h: number, k: number) => props.push({ shape: 'cone', size: [r, h / 2, 0], pos: [x, h / 2 - 4, z], color: [0x6f8a52, 0x7a9060, 0x5f7a48, 0x8a8378][k % 4], ghost: true });
    for (let z = -80, k = 0; z < 1640; z += 60, k++) {
      // Beyond the building site the hills stand back past its hoarding.
      const r = 60 + hash(k, 91) * 25;
      hill(z > 1340 ? -66 - r - hash(k, 90) * 20 : -110 - hash(k, 90) * 30, z, r, 70 + hash(k, 92) * 45, k);
      hill(240 + hash(k, 93) * 30, z + 30, 60 + hash(k, 94) * 25, 45 + hash(k, 95) * 40, k + 1);
    }
    for (let x = -160, k = 0; x < 300; x += 70, k++) {
      if (x < -20 || x > 80) hill(x, -80 - hash(k, 96) * 30, 55 + hash(k, 97) * 20, 40 + hash(k, 98) * 30, k + 2);
      const rn = 70 + hash(k, 100) * 30;
      hill(x, 1556 + rn + hash(k, 99) * 30, rn, 50 + hash(k, 101) * 50, k + 3);
    }
  });
}
