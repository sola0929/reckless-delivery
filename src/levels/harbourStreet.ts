import { buildTown } from './city';
import type { ObjectDesc, ObjectKindId } from './objects';
import type { Look, Relief } from './relief';
import type { Vec3 } from '../config';
import type { CrowdDesc, DecalDesc, GustDesc, LevelDef, PropDesc, RigDesc, SignDesc, Vec2 } from './types';
import { Euler, Quaternion, Vector3 } from 'three';
import { capsizedBoat, fishingBoat } from './vessels';

// Level 4's first place: the waterfront street (z 0 to 232, the road's middle at x 0). The old town along the west is
// level 1's own: its shophouses, pavements, lamps, scooters and people, laid by its builder on a map of its squares. What
// is the harbour's is laid here by hand: the quay along the east with its low wall, bollards and moored boats rocking;
// the poles and their wires; and the three things in the way, one after another:
//
//   the storm's leavings   each sending the truck its own way: what the waves threw ashore on one side and a row of
//                          scooters blown over in their bays on the other, a gap to thread between; a street tree down off the town's pavement,
//                          its crown over the harbour lane, to be driven through; a pole leant over from the quay to a
//                          shophouse's third floor, got under at its high end on the town side; a sign hanging by a corner
//                          over the town lane that comes down as the truck nears, and another come down flat in the
//                          harbour lane, bumped over on the way back across to the boat row
//   the capsized boat      thrown over the wall and lying upside down across the whole street: the way past is along the
//                          arcade of the one row of shophouses beside it, in at a scooter ramp from a lot at its south
//                          end, out to a lot at its north, under the arcade scooters, sandbags and a seafood shop's tanks
//   the alleys             three lanes going up into the old town between the shophouses, steps at their far ends,
//                          things stood about at their mouths (the wind out of them comes later)

/** The town's map: columns from the harbour (east, x +48) west; its last line row 0 at z 0. ',' the street; 'o' the old
 * town; 'a' an alley; 'K' laid by hand: the harbour, the boat row and its lots, the steps up from the alleys. */
const TOWN = [
  'KKK,ooo', // 14
  'KKK,KKo', // 13 the alleys and the street's row between them, laid by hand
  'KKK,KKo', // 12
  'KKK,KKo', // 11
  'KKK,KKo', // 10
  'KKK,Koo', // 9  the lot north of the boat row
  'KKK,Koo', // 8  the boat row
  'KKK,Koo', // 7  the boat row
  'KKK,Koo', // 6  the lot south of it
  'KKK,ooo', // 5
  'KKK,ooo', // 4
  'KKK,ooo', // 3
  'KKK,ooo', // 2
  'KKK,ooo', // 1
  'KKK,ooo', // 0
];
/** The street: its road 9 m wide; the quay's walk east of it to the edge; the old town's pavement and fronts west. */
export const ROAD_W = 4.5, QUAY_EDGE = 8, STREET_END = 232;
/** The hand-laid squares of the boat row, x -24 to -8: its lots, the row itself; the arcade's floor, pillars, shops. */
const ROW_X0 = -24, ROW_X1 = -8;
export const LOT_SOUTH: [number, number] = [96, 113], BOAT_ROW: [number, number] = [113, 137], LOT_NORTH: [number, number] = [137, 152];
// The arcade 5 m clear from the shops back to the pillars: a truck through it with the scooters and the tanks either side.
export const ARCADE_SHOPS = -9.2, ARCADE_PILLARS = -3.9;
const ARCADE_FLOOR = 0.25, ARCADE_HIGH = 3.8;
/** Where the capsized boat lies across the street; where the tree came down, the pole leans, the signs are. */
export const BOAT_Z = 125;
export const TREE: { root: [number, number]; tip: [number, number] } = { root: [-6.1, 33], tip: [-0.6, 40] };
export const POLE_Z = 66;
/** The harbour's water: its bed, and its surface below the quay. */
const BED = -3.5, SURFACE = -2.4;

const PAVING = 0xb58d78;
const WALLS = [0xe3d9c3, 0xd8b9a6, 0xbccdb8, 0xdad9d2, 0xb47a5e, 0xd3ba7f, 0xb9c8d2];
const HULLS = [0x2f6fb0, 0xd23c2c, 0x2e9a6a, 0xe0a020, 0x3f9a94, 0xb3463a];

export interface StreetParts {
  props: PropDesc[];
  objects: ObjectDesc[];
  decals: DecalDesc[];
  crowds: CrowdDesc[];
  rigs: RigDesc[];
  pools: NonNullable<LevelDef['pools']>;
  gusts: GustDesc[];
  signs: SignDesc[];
  /** Loose ends of the live lines the leant pole brought down: they spark. */
  sparks: Vec3[];
}

export function street(relief: Relief, looks: { road: Look; quay: Look; tile: Look; water: Look }): StreetParts {
  const route: Vec2[] = [[3, 0], [3, 6], [3.35, 7], [3.35, 8.6], [3, 9.4], [3, 14.4]];
  const town = buildTown(TOWN, route, 0);
  // Not where the boat lies across the street, nor in the boat row's squares, laid by hand below.
  const handLaid = (x: number, z: number) => (z > BOAT_Z - 4 && z < BOAT_Z + 4 && x > -6) || (x < ROW_X1 + 0.5 && x > ROW_X0 && z > 88 && z < 152);
  const props = town.props.filter((p) => !handLaid(p.pos[0], p.pos[2]) && !nearTree(p.pos[0], p.pos[2]));
  // The town's houses along the street face it, shops and all, even where a lane runs down their block's other end: left to
  // the builder, such a block turns its houses to the lane and shows the street only their bare flank.
  // The block the pole leans on is drawn from other dice than its own: its own put a temple where the pole's top comes.
  for (const p of props) if (p.building && p.pos[0] + p.size[0] > -7) p.building = { ...p.building, front: 1, seed: p.building.seed + (Math.abs(p.pos[2] - POLE_Z - 4) < 10 ? 1 : 0) };
  const objects = town.objects.filter((o) => !handLaid(o.pos[0], o.pos[2]) && !nearTree(o.pos[0], o.pos[2]) && !(o.pos[2] < 96 && o.pos[0] < -4.5 && o.pos[0] > -6.5 && kerbTaken(o.pos[2])));
  const decals = town.decals.filter((d) => !handLaid(d.pos[0], d.pos[1]));
  const crowds = town.crowds;
  const rigs: RigDesc[] = [];
  const signs: SignDesc[] = [];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, more: Partial<PropDesc> = {}) =>
    props.push({ shape: 'box', size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color, ...more });
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, y = 0, more: Partial<ObjectDesc> = {}) => objects.push({ kind, pos: [x, y, z], rotY, ...more });
  const rod = (a: [number, number, number], b: [number, number, number], r: number, color: number, more: Partial<PropDesc> = {}) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], long = Math.hypot(d[0], d[1], d[2]);
    props.push({ shape: 'cylinder', size: [r, long / 2, 0], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [0, Math.atan2(-d[2], d[0]), -Math.acos(d[1] / long)], color, ...more });
  };
  const rect = (x0: number, z0: number, x1: number, z1: number): [number, number][] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const line = (points: Vec3[], r: number, color: number) => { for (let k = 0; k + 1 < points.length; k++) rod(points[k], points[k + 1], r, color, { ghost: true }); };

  // The ground under the town: the street's road, paving under the blocks (their pavements and houses are the builder's).
  relief.area(rect(-ROAD_W, -8, ROAD_W, STREET_END), 0, looks.road);
  relief.area(rect(-64, -8, -ROAD_W, STREET_END), 0, looks.tile);

  // The quay: its walk, its edge with a low wall capped and painted, bollards, old tyres hung over the edge for fenders.
  relief.area(rect(ROAD_W, -8, QUAY_EDGE, STREET_END - 16), 0, looks.quay);
  box(ROAD_W, 0, -8, ROAD_W + 0.25, 0.15, STREET_END - 16, 0x9c9a90);
  for (let z = -8; z < STREET_END - 16; z += 8) {
    const z1 = Math.min(STREET_END - 16, z + 8);
    // Where the boat came over, the wall is pushed flat.
    if (z1 > BOAT_Z - 6 && z < BOAT_Z + 6) continue;
    box(QUAY_EDGE - 0.35, 0, z + 0.03, QUAY_EDGE - 0.05, 0.55, z1 - 0.03, 0xa8a69c);
    box(QUAY_EDGE - 0.4, 0.55, z + 0.03, QUAY_EDGE, 0.65, z1 - 0.03, 0xe0b020, { ghost: true });
  }
  // The crushed length: the wall's pieces knocked flat and askew, its cap broken off.
  box(QUAY_EDGE - 0.6, 0, BOAT_Z - 6, QUAY_EDGE - 0.1, 0.3, BOAT_Z - 2.5, 0xa8a69c, { rot: [0, 0.3, 0.25] });
  box(QUAY_EDGE - 0.9, 0, BOAT_Z + 2.8, QUAY_EDGE - 0.3, 0.3, BOAT_Z + 6, 0xa8a69c, { rot: [0, -0.25, -0.2] });
  const bollard = (z: number) => {
    props.push({ shape: 'cylinder', size: [0.2, 0.3, 0], pos: [QUAY_EDGE - 1.1, 0.3, z], color: 0x2a2c30 });
    props.push({ shape: 'cylinder', size: [0.3, 0.06, 0], pos: [QUAY_EDGE - 1.1, 0.62, z], color: 0x2a2c30, ghost: true });
  };
  for (let z = 4; z < STREET_END - 20; z += 12) if (Math.abs(z - BOAT_Z) > 9) bollard(z);
  for (let z = 9; z < STREET_END - 20; z += 12) props.push({ shape: 'cylinder', size: [0.42, 0.14, 0], pos: [QUAY_EDGE + 0.05, -0.6, z], rot: [0, 0, Math.PI / 2], color: 0x1f2124, ghost: true });

  // The harbour: the water's surface over its bed, boats moored along the quay in a row, rocking, each made fast to two
  // bollards; more along the far side, and the far quay's sheds.
  const pools: StreetParts['pools'] = [{ area: [QUAY_EDGE, -8, 120, STREET_END - 16], surface: SURFACE, tint: 0x2f5a5c, flow: [0.05, 0.12], rain: true, waves: 0.22 }];
  void BED;
  // Each a fishing boat as the outer harbour's are, its deck at its waterline's height over the water. Clear of the quay's
  // face and of the next boat by their tyres and a little more, so that as they roll and heave each its own way they never
  // meet: the tyres hang out TYRES past the hull.
  const BW = 3, BL = 8.4, TYRES = 0.46, deck = SURFACE + 1.25;
  const inner = QUAY_EDGE + BW + TYRES + 0.45, outer = inner + 2 * BW + 2 * TYRES + 0.7;
  const KINDS = ['longline', 'trawl', 'squid'] as const;
  // Their 大漁旗 up, three to a boat, in bands of their colours.
  const FLAG = [[0xd23c2c, 0xf2c12e, 0x2f62a8], [0xf2f0ea, 0xd23c2c], [0x2e9a5a, 0xf2c12e, 0xd23c2c], [0x2f62a8, 0xf2f0ea, 0xd23c2c]];
  const FLAGS = FLAG.map((_, k) => [FLAG[k], FLAG[(k + 1) % 4], FLAG[(k + 2) % 4]]);
  let n = 0;
  for (const z of [12, 32, 52, 72, 92, 152, 172, 194]) {
    // Bow north or south by turns; its quay side is its own -x with its bow north, +x with it south.
    const yaw = n % 2 ? Math.PI : 0, side = n % 2 ? 1 : -1;
    // Its lines fore and aft, doubled for the storm: from cleats on its rail to the bollards either end of it.
    const lines: NonNullable<RigDesc['lines']> = [];
    for (const end of [-1, 1]) {
      const bz = nearestBollard(z + end * 6);
      for (const k of [0, 1]) lines.push({ at: [side * (BW - 0.25), 0.78, (n % 2 ? -end : end) * (BL - 1.6 - k * 1.2)], to: [QUAY_EDGE - 1.1, 0.5 - k * 0.08, bz], color: ROPE[(n + k) % 2] });
    }
    const at = rigs.length;
    rigs.push({ kind: 'float', hull: 'vessel', pos: [inner, deck + (n % 3) * 0.08, z], yaw, half: [BW, 0, BL], heave: 0.22, roll: 0.06, pitch: 0.015, period: 4.2 + (n % 4) * 0.45, phase: (n * 0.37) % 1,
      parts: fishingBoat({ w: BW, l: BL, color: HULLS[n % HULLS.length], kind: KINDS[n % 3], gaps: [], gear: BL * 0.3, hold: -BL * 0.25, flags: n % 2 ? FLAGS[n % 4] : undefined }), lines });
    // Come in out of the storm with nowhere left along the quay: made fast alongside the one there, its lines to its rail.
    if (n % 3 !== 2) {
      const oyaw = n % 2 ? 0 : Math.PI, oside = n % 2 ? -1 : 1, dz = n % 2 ? 1.5 : -1.5;
      // Along a boat, in its own frame, from how far along the quay from its middle.
      const own = (turned: number, along: number) => (turned ? -along : along);
      const tie: NonNullable<RigDesc['lines']> = [-1, 1].map((end) => {
        const wz = dz + end * (BL - 2.6);
        return { at: [oside * (BW - 0.25), 0.78, own(oyaw, wz - dz)] as Vec3, to: [-side * (BW - 0.25), 0.78, own(yaw, wz)] as Vec3, rig: at, color: ROPE[(n + 1) % 2] };
      });
      rigs.push({ kind: 'float', hull: 'vessel', pos: [outer, deck, z + dz], yaw: oyaw, half: [BW, 0, BL], heave: 0.22, roll: 0.06, pitch: 0.015, period: 4.4 + (n % 3) * 0.5, phase: (n * 0.61) % 1,
        parts: fishingBoat({ w: BW, l: BL, color: HULLS[(n + 3) % HULLS.length], kind: KINDS[(n + 1) % 3], gaps: [], gear: BL * 0.3, hold: -BL * 0.25, flags: n % 2 ? undefined : FLAGS[(n + 1) % 4] }), lines: tie });
    }
    n++;
  }
  for (let z = 4; z < 208; z += 19) {
    const k = Math.round(z / 19);
    rigs.push({ kind: 'float', hull: 'vessel', pos: [80, deck, z + 8], yaw: Math.PI / 2 + 0.05, half: [2.8, 0, 8], heave: 0.22, roll: 0.06, pitch: 0.015, period: 4.8 + (k % 3) * 0.4, phase: (z * 0.13) % 1,
      parts: fishingBoat({ w: 2.8, l: 8, color: HULLS[(k + 2) % HULLS.length], kind: KINDS[k % 3], gaps: [], gear: 2.4, hold: -2, flags: k % 3 === 1 ? FLAGS[k % 4] : undefined }) });
  }

  // The poles along the quay, as along any street here: two crossarms, the power lines on the top one, the telephone
  // cables' black bundle lower, every line sagging between poles; lines across the road to the houses off each. One pole
  // is leant over: its lines snapped, hanging from the poles either side down onto the quay, their ends off its top.
  const poleTop = 8.5;
  const poles = [10, 38, POLE_Z, 94, 150, 178, 206];
  const px0 = QUAY_EDGE - 2;
  for (const z of poles) {
    if (z === POLE_Z) continue;
    props.push({ shape: 'cylinder', size: [0.17, poleTop / 2, 0], pos: [px0, poleTop / 2, z], color: 0x8a8a84 });
    box(px0 - 0.9, poleTop - 0.6, z - 0.06, px0 + 0.9, poleTop - 0.48, z + 0.06, 0x5a5f66, { ghost: true });
    box(px0 - 0.6, poleTop - 1.5, z - 0.05, px0 + 0.6, poleTop - 1.4, z + 0.05, 0x5a5f66, { ghost: true });
    for (const dx of [-0.75, -0.25, 0.25, 0.75]) props.push({ shape: 'cylinder', size: [0.05, 0.08, 0], pos: [px0 + dx, poleTop - 0.4, z], color: 0xe8e8e4, ghost: true });
    if (z === 94 || z === 178) props.push({ shape: 'cylinder', size: [0.4, 0.55, 0], pos: [px0 - 0.55, poleTop - 2.6, z + 0.4], color: 0x7a8088, ghost: true });
    // Across to the house fronts opposite.
    for (const dz of [-1.5, 2]) line(sag([px0, poleTop - 1.45, z], [-6.5, 6.8, z + dz], 0.6), 0.02, 0x1f2124);
  }
  const span = (a: number, b: number) => {
    for (const dx of [-0.75, -0.25, 0.25, 0.75]) line(sag([px0 + dx, poleTop - 0.3, a], [px0 + dx, poleTop - 0.3, b], 0.7), 0.018, 0x1f2124);
    line(sag([px0 - 0.4, poleTop - 1.55, a], [px0 - 0.4, poleTop - 1.55, b], 0.9), 0.05, 0x1f2124);
  };
  for (let i = 0; i + 1 < poles.length; i++) {
    const a = poles[i], b = poles[i + 1];
    if (b - a <= 40 && a !== POLE_Z && b !== POLE_Z) span(a, b);
  }
  // The leant one: from its foot on the quay up against a third floor's front, the paving broken round its foot. Its
  // cross-arms still on it, turned over with it, an insulator gone from each; the paving at the wall's foot chipped
  // where its top hit.
  const foot: Vec3 = [px0, 0, POLE_Z], lean: Vec3 = [-6.25, 7.6, POLE_Z + 7];
  rod(foot, lean, 0.17, 0x8a8a84);
  box(px0 - 0.3, 0, POLE_Z - 0.6, px0 + 0.8, 0.18, POLE_Z + 0.6, 0x6a6a64, { rot: [0.2, 0.3, 0.1], ghost: true });
  const up = [lean[0] - foot[0], lean[1] - foot[1], lean[2] - foot[2]], long = Math.hypot(up[0], up[1], up[2]);
  const along = (d: number): Vec3 => [foot[0] + (up[0] * d) / long, foot[1] + (up[1] * d) / long, foot[2] + (up[2] * d) / long];
  // Its cross-arms, along the quay.
  const arm = (d: number, half: number): [Vec3, Vec3] => {
    const c = along(d);
    return [[c[0], c[1], c[2] - half], [c[0], c[1], c[2] + half]];
  };
  const [topArm, lowArm] = [arm(long - 0.5, 0.9), arm(long - 1.4, 0.6)];
  rod(topArm[0], topArm[1], 0.06, 0x5a5f66, { ghost: true });
  rod(lowArm[0], lowArm[1], 0.05, 0x5a5f66, { ghost: true });
  // What is left on its top arm: the insulators, one knocked off; and where the lines tore away from them.
  const insulators: Vec3[] = [-0.75, -0.25, 0.75].map((dz) => [topArm[0][0] + 0.12, topArm[0][1] + 0.1, along(long - 0.5)[2] + dz]);
  for (const at of insulators) props.push({ shape: 'cylinder', size: [0.05, 0.08, 0], pos: at, color: 0xe8e8e4, ghost: true });
  // The lines that ran to it, snapped: from the poles either side, down in a long droop to lie along the quay, their
  // ends curled on the paving.
  const ends: Vec3[] = [];
  for (const [from, toward] of [[38, 1], [94, -1]]) for (const dx of [-0.75, 0.25, 0.75]) {
    const end = from + toward * (13 + dx * 3);
    const tip: Vec3 = [px0 + 0.6 + dx, 0.04, end];
    line(hang([[px0 + dx, poleTop - 0.3, from], [px0 + dx * 0.6, 4.6, from + toward * 4.5], [px0 + 0.3 + dx * 0.4, 1.4, from + toward * 8.5], [px0 + 0.5 + dx * 0.8, 0.05, end - toward * 1.5], tip, [tip[0] + 0.5, 0.04, end + toward * 0.4]]), 0.02, 0x1f2124);
    if (dx === 0.25) ends.push([tip[0] + 0.5, 0.12, end + toward * 0.4]);
  }
  // And off the leant pole's top arm, the ends that went with it: down the house front in a hang to the pavement at
  // its foot, lying along the wall there, live.
  for (const [k, at] of insulators.entries()) {
    const fall = 1.6 + k * 1.3;
    const ground: Vec3 = [-6.05 + k * 0.12, 0.06, at[2] + fall];
    line(hang([at, [at[0] + 0.25, at[1] - 1.6, at[2] + 0.5], [-6.15, 3.2, at[2] + fall * 0.6], [-6.1, 0.5, ground[2] - 0.6], ground, [ground[0] + 0.25, 0.05, ground[2] + 1.1]]), 0.022, 0x1f2124);
    if (k !== 1) ends.push([ground[0] + 0.25, 0.12, ground[2] + 1.1]);
  }
  // At the wall's foot, where the top came down on it first: chips of its cladding.
  for (let k = 0; k < 8; k++) decals.push({ pos: [-5.9 + (k % 3) * 0.35, lean[2] - 1 + ((k * 1.3) % 3)], size: [0.24, 0.18], rotY: k, color: 0xd8d4c8 });

  // The tree: down off its bed in the town's pavement, its roots up out of the paving, its trunk across the town lane to
  // the road's middle; its crown over the harbour lane and the quay, branches to be driven over, leaves everywhere.
  const [rx, rz] = TREE.root, [tx, tz] = TREE.tip;
  const fx = tx - rx, fz = tz - rz, fl = Math.hypot(fx, fz);
  rod([rx, 0.4, rz], [tx, 0.4, tz], 0.4, 0x5a4632);
  rod([rx - (fx / fl) * 0.6, 1.2, rz - (fz / fl) * 0.6], [rx, 1.2, rz], 1.4, 0x5d4a36, { ghost: true });
  box(rx - 0.8, 0, rz - 1.4, rx + 0.8, 0.14, rz + 1.4, 0x4a3a2a, { rot: [0, 0.5, 0], ghost: true });
  // Its bed: the paving round it pushed up and broken.
  for (const [dx, dz, a] of [[-0.9, -1.2, 0.4], [0.7, 0.9, -0.3], [-0.6, 1.3, 0.9]]) box(rx + dx - 0.35, 0, rz + dz - 0.2, rx + dx + 0.35, 0.18, rz + dz + 0.2, PAVING, { rot: [0.2, a, 0.15], ghost: true });
  const leaves = [0x4f8a4a, 0x5d9a52, 0x467f43];
  for (let k = 0; k < 9; k++) {
    // Beyond the trunk's tip, over the west lane: clumps of leaves, and boughs under them the wheels go over.
    const along = 0.2 + (k % 3) * 2.3, across = ((k / 3) | 0) * 1.8 - 1.8;
    const cx = tx + (fx / fl) * along - (fz / fl) * across, cz = tz + (fz / fl) * along + (fx / fl) * across;
    props.push({ shape: 'sphere', size: [1.6, 1.6, 1.6], pos: [cx, 1.1, cz], color: leaves[k % 3], ghost: true, fade: true });
    box(cx - 1.4, 0, cz - 0.11, cx + 1.4, 0.2, cz + 0.11, 0x5a4632, { rot: [0, k * 0.7, 0], wheelsOnly: true });
  }
  for (let k = 0; k < 14; k++) decals.push({ pos: [tx - 3 + ((k * 2.3) % 7), tz - 3 + ((k * 3.1) % 9)], size: [0.9, 0.6], rotY: k, color: leaves[k % 3] });

  // The signs: the eatery's big one across its second floor, its south end's brackets torn out so it hangs askew against
  // the front, to come off and over into the town lane as the truck gets near, its shadow there; the eatery's chairs blown
  // out under it; another come down already, flat across the harbour lane.
  // Hung from its north end's brackets, its south end dropped 1.2 m: turned about its face by that much.
  const droop = Math.asin(1.2 / 4.6);
  object('shopSign', -6.42, 81, Math.PI / 2, 4.6 - Math.sin(droop) * 2.3, { letGoWithin: 8, roll: -droop, lean: [1, 0] });
  decals.push({ pos: [-4.4, 81], size: [2.4, 4.6], color: 0x2a2c30 });
  // Its frame's brackets on the front: the north ones still holding, the south ones' stubs bent where they tore out.
  for (const y of [4.6, 5.7]) box(-6.5, y, 83.0, -6.25, y + 0.1, 83.2, 0x5a5f66, { ghost: true });
  for (const y of [4.6, 5.7]) box(-6.5, y, 78.8, -6.3, y + 0.08, 78.95, 0x5a5f66, { ghost: true, rot: [0.6, 0, 0.3] });
  for (const [x, z, a] of [[-3.8, 84.5, 0.3], [-2.6, 85.6, 1.9], [-4.1, 86.4, 2.6], [-1.9, 87.3, 0.8], [-3.3, 88.2, 4], [-0.9, 85.2, 5.1]]) object('chair', x, z, a);
  box(0.6, 0, 88.6, 4.2, 0.12, 90.1, 0x2f62a8, { rot: [0, -0.12, 0], wheelsOnly: true });
  box(0.8, 0.12, 88.8, 4.0, 0.14, 89.9, 0xf4f0e6, { rot: [0, -0.12, 0], ghost: true });
  // The awning's sheets torn off over the eatery's door, one hanging down into the road; tiles off the fronts everywhere.
  object('tinSheet', -4.6, 85.2, Math.PI / 2 + 0.1, 0.5, { tilt: -0.5 });
  object('tinSheet', -1.4, 90.6, 0.7);
  for (let k = 0; k < 22; k++) decals.push({ pos: [-4.4 + ((k * 1.7) % 4.2), 77 + ((k * 2.9) % 15)], size: [0.22, 0.22], rotY: k, color: k % 3 ? 0xd8d4c8 : 0x9fb8c4 });
  for (const [x, z] of [[2.4, 87.6], [3.4, 91], [1.4, 91.4]]) props.push({ shape: 'box', size: [0.4, 0.02, 0.3], pos: [x, 0.02, z], rot: [0, x * 2, 0], color: 0xf4f0e6, ghost: true });

  // At the street's start, the gap between what the waves threw over the quay into the harbour lane, a torn net, floats,
  // a log, polystyrene off the boats, the water still lying; and the scooters in their bays along the town's side, blown
  // over in a row.
  object('driftwood', 2.7, 19.4, 1.25);
  for (const [x, z, a] of [[2.6, 15.2, 0], [3.3, 24, 1.2]]) object('netHeap', x, z, a);
  for (const [x, z, a] of [[1.7, 21.8, 0.3], [3.9, 26.6, 1.4], [5.5, 16.2, 0]]) for (let k = 0; k < 5; k++) object('buoy', x + Math.cos(a) * k * 0.42, z + Math.sin(a) * k * 0.42 + (k % 2) * 0.2);
  for (const [x, z] of [[1.6, 23.2], [4.1, 14.2], [2.6, 28.4]]) object('foamBox', x, z, x * 2);
  for (const [x, z] of [[1.2, 12.5], [4.4, 26.4], [0.6, 18.9], [3.0, 13]]) decals.push({ pos: [x, z], size: [0.5, 1.6], rotY: x * 3, color: 0x3d5a3a });
  for (let k = 0; k < 12; k++) {
    const z = 14.5 + k * 1.05;
    object(['scooterDownRed', 'scooterDownWhite', 'scooterDownBlue', 'scooterDownBlack'][k % 4] as ObjectKindId, -3.6 + (k % 3) * 0.15, z, Math.PI / 2 + 0.25, 0);
  }
  for (let k = 0; k <= 12; k++) decals.push({ pos: [-3.5, 14 + k * 1.05], size: [2, 0.06], color: 0xe8e8e4 });
  decals.push({ pos: [-2.5, 20.3], size: [0.06, 12.7], color: 0xe8e8e4 });
  // The quay's gear that was got under cover in time: heaped, a tarpaulin roped down over it; spare fenders stacked.
  for (const z of [8, 30.5]) object('tarpHeap', 5.6, z);
  for (const z of [11.6, 12.5]) object('tyreStack', 5.3, z);

  // Along the town's pavement, shop by shop: its scooters pulled in under the front, its door sandbagged and boarded.
  for (const [z0, what] of KERB) {
    if (what === 'S') for (let k = 0; k < 4; k++) object(['scooterRed', 'scooterWhite', 'scooterBlue', 'scooterBlack', 'scooterTeal', 'scooterYellow'][(Math.round(z0) + k) % 6] as ObjectKindId, -5.6, z0 + 0.5 + k * 0.95, Math.PI / 2);
    if (what === 'B') {
      for (let k = 0; k < 4; k++) object('sandbag', -6.1, z0 + 0.6 + k * 0.85, Math.PI / 2);
      for (let k = 0; k < 2; k++) object('sandbag', -6.1, z0 + 1.0 + k * 0.85, Math.PI / 2, 0.28);
      object('plyBoard', -6.3, z0 + 3.4, Math.PI / 2);
    }
  }
  // Up the row by the alleys too, each shop's door sandbagged; not the eatery, open to the last.
  for (const [z0, z1] of ROW.slice(0, 5)) {
    const z = (z0 + z1) / 2 - 1.3;
    for (let k = 0; k < 3; k++) object('sandbag', -6.1, z + k * 0.85, Math.PI / 2);
    for (let k = 0; k < 2; k++) object('sandbag', -6.1, z + 0.42 + k * 0.85, Math.PI / 2, 0.28);
  }
  // The quay further on: rafts lifted out onto old tyres and roped down, one slid half off its tyres into the road;
  // the gear under its tarpaulins.
  const raft = (x: number, z: number, yaw: number, y: number) => {
    for (const dz of [-2.4, 0, 2.4]) object('tyre', x + Math.sin(yaw) * dz, z + Math.cos(yaw) * dz);
    object('raft', x, z, yaw, y);
  };
  object('raft', 3.8, 56.5, -0.22);
  for (const dz of [-2, 2]) object('tyre', 5.7, 56.5 + dz);
  raft(5.9, 80.5, 0, 0.24);
  for (const z of [72, 87]) object('tarpHeap', 5.6, z);
  // The pole: its transformer come down with it into the harbour lane, the cross-arm beside it.
  object('transformerBox', 3.4, POLE_Z + 2.2, 0.4, 0, { tilt: 1.4 });
  box(1.6, 0, POLE_Z - 1.4, 3.4, 0.12, POLE_Z - 1.2, 0x5a5f66, { rot: [0, 0.5, 0], ghost: true });

  // The boat row. The lots either side of it, where shops were pulled down: paved, scooters parked at their backs, a
  // seafood shop's tables out on the north one. The row: shops back under an arcade 4.25 m clear, its floor a scooter ramp
  // up at the south end and down at the north, pillars along the street, the floors above with their windows.
  for (const [z0, z1] of [LOT_SOUTH, LOT_NORTH]) relief.area(rect(ROW_X0, z0, -ROAD_W, z1), 0, looks.tile);
  // The south lot: scooters in two rows under a sheet-metal shelter on posts at its back, a delivery tricycle; the way
  // from the street to the arcade's ramp kept clear across its east half.
  {
    const [z0, z1] = LOT_SOUTH;
    for (const x of [ROW_X0 + 2.2, ROW_X0 + 5.6]) for (let z = z0 + 1.2; z < z1 - 1; z += 1.05) object(['scooterRed', 'scooterWhite', 'scooterBlue', 'scooterBlack', 'scooterTeal'][Math.round(z * 3 + x) % 5] as ObjectKindId, x, z, x < ROW_X0 + 3 ? Math.PI / 2 : -Math.PI / 2);
    for (const z of [z0 + 0.4, (z0 + z1) / 2, z1 - 0.4]) for (const x of [ROW_X0 + 0.4, ROW_X0 + 7.4]) box(x - 0.06, 0, z - 0.06, x + 0.06, 2.6, z + 0.06, 0x5a5f66);
    box(ROW_X0, 2.6, z0, ROW_X0 + 7.8, 2.7, z1, 0x4f8d68, { fade: true, overhead: true, rot: [0, 0, -0.06] });
    for (let k = 0; k < 4; k++) object('box', ROW_X0 + 9.2 + (k % 2) * 0.7, z1 - 2.5 + (k >> 1) * 0.7);
    object('waterDrum', ROW_X0 + 9.4, z0 + 1.5);
  }
  // The north lot: the seafood shop's tables out under a striped awning on poles, its tanks along the back wall, its
  // polystyrene boxes stacked, a gas burner; the way out of the arcade back to the street across its east half.
  {
    const [z0, z1] = LOT_NORTH;
    for (const z of [z0 + 0.5, z1 - 0.5]) for (const x of [ROW_X0 + 1, ROW_X0 + 11]) box(x - 0.05, 0, z - 0.05, x + 0.05, 2.8, z + 0.05, 0xd8d8d0);
    for (let k = 0; k < 6; k++) box(ROW_X0 + 1 + k * (10 / 6), 2.8, z0 + 0.5, ROW_X0 + 1 + (k + 1) * (10 / 6), 2.88, z1 - 0.5, k % 2 ? 0xe8e8e4 : 0xc8372d, { fade: true, overhead: true });
    for (let z = z0 + 1.5; z < z1 - 1; z += 2.2) object('fishTank', ROW_X0 + 0.9, z, Math.PI / 2);
    for (let k = 0; k < 6; k++) object('box', ROW_X0 + 3 + (k % 3) * 0.65, z1 - 1 - (k >> 1 & 1) * 0.65);
    object('gasCylinder', ROW_X0 + 4.2, z0 + 1);
  }
  box(ROW_X0, 0, 88, ROW_X1, 11, LOT_SOUTH[0], 0xd8cfbf, { fade: true, building: { style: 'old', open: [false, true, false, true], crown: 0, seed: 401, front: 1, taped: true } });
  box(ROW_X1, 0, 88, -ROAD_W, 0.15, LOT_SOUTH[0], PAVING, { paving: true });
  // The houses behind the lots, their backs to them.
  box(ROW_X0 - 16, 0, LOT_SOUTH[0], ROW_X0, 13, LOT_NORTH[1], 0xd8cfbf, { fade: true, building: { style: 'old', open: [false, true, false, false], crown: 0, seed: 402 } });
  // Tables out on the north lot.
  for (const [x, z] of [[-15, 141], [-18.5, 142.5], [-15.5, 146.5], [-19, 148]]) {
    object('table', x, z);
    for (let k = 0; k < 4; k++) object('stool', x + Math.cos(k * 1.57) * 0.9, z + Math.sin(k * 1.57) * 0.9);
  }
  // The row: five shophouses.
  const [r0, r1] = BOAT_ROW;
  box(ROW_X0, 0, r0, ARCADE_SHOPS, 11.5, r1, 0xd8cfbf, { fade: true, building: { style: 'old', open: [false, true, true, true], crown: 0, seed: 403, taped: true } });
  relief.area(rect(ARCADE_SHOPS, r0, ARCADE_PILLARS + 0.25, r0 + 3), (_x, z) => (ARCADE_FLOOR * (z - r0)) / 3, looks.tile);
  relief.area(rect(ARCADE_SHOPS, r0 + 3, ARCADE_PILLARS + 0.25, r1 - 3), ARCADE_FLOOR, looks.tile);
  relief.area(rect(ARCADE_SHOPS, r1 - 3, ARCADE_PILLARS + 0.25, r1), (_x, z) => (ARCADE_FLOOR * (r1 - z)) / 3, looks.tile);
  relief.area(rect(ARCADE_PILLARS + 0.25, r0, -ROAD_W, r1), 0, looks.tile);
  for (let z = r0 + 2.4; z < r1 - 1; z += 4.8) box(ARCADE_PILLARS - 0.25, ARCADE_FLOOR, z - 0.25, ARCADE_PILLARS + 0.25, ARCADE_HIGH - 0.15, z + 0.25, 0xcfc6b4);
  // The floors over the arcade, house by house: each its own colour, two windows a floor with grilles, an air conditioner,
  // a sign hung out from its front; faded whenever they stand between the camera and the truck.
  for (let h = 0; h < 5; h++) {
    const z0 = r0 + h * 4.8, z1 = z0 + 4.8, top = 10.5 + (h % 3) * 1.2, wall = WALLS[(h * 3 + 1) % WALLS.length];
    box(ARCADE_SHOPS, ARCADE_HIGH, z0, ARCADE_PILLARS + 0.25, top, z1, wall, { fade: true, overhead: true });
    for (const y of [5.2, 8.2]) for (const dz of [1.3, 3.5]) {
      box(ARCADE_PILLARS + 0.25, y, z0 + dz - 0.6, ARCADE_PILLARS + 0.3, y + 1.4, z0 + dz + 0.6, 0x2f3a46, { fade: true, overhead: true });
      box(ARCADE_PILLARS + 0.3, y - 0.05, z0 + dz - 0.68, ARCADE_PILLARS + 0.6, y + 1.48, z0 + dz + 0.68, h % 2 ? 0xe8e8e4 : 0x5f8f74, { fade: true, overhead: true });
    }
    box(ARCADE_PILLARS + 0.3, 6.9, z0 + 2.1, ARCADE_PILLARS + 0.85, 7.4, z0 + 2.8, 0xdedcd6, { fade: true, overhead: true });
    // Its shop's name across its front over the arcade, and again on end out over the road, as every shop here has; the
    // shop is what is under the arcade before it.
    const [name, ground, ink] = ARCADE_SHOPS_NAMES[h], face = ARCADE_PILLARS + 0.25;
    signs.push({ kind: 'name', text: name, colors: [ground, ink, '#f2efe6'], wide: 4.2, pos: [face + 0.08, 4.35, (z0 + z1) / 2], rotY: Math.PI / 2 });
    box(face, 5.0, z1 - 0.28, face + 1.3, 5.08, z1 - 0.2, 0x5a5f66, { ghost: true, fade: true, overhead: true });
    signs.push({ kind: 'name', text: name, colors: [ground, ink, '#f2efe6'], wide: 3.2, tall: true, pos: [face + 0.75, 6.75, z1 - 0.24], rotY: 0 });
    // Its upper floors as their owners have them: the even ones' windows caged in iron, the odd ones' second floor a
    // balcony with the washing out on it; on its roof a water tank on its stand, or a room of sheet built on.
    if (h % 2 === 0) {
      for (const y of [5.2, 8.2]) for (const dz of [1.3, 3.5]) {
        box(face + 0.35, y - 0.1, z0 + dz - 0.75, face + 0.4, y + 1.55, z0 + dz + 0.75, 0xe8e8e4, { ghost: true, fade: true, overhead: true });
        for (let k = -2; k <= 2; k++) box(face + 0.36, y - 0.1, z0 + dz + k * 0.34 - 0.02, face + 0.42, y + 1.55, z0 + dz + k * 0.34 + 0.02, 0xd8d8d4, { ghost: true, fade: true, overhead: true });
        box(face, y + 1.55, z0 + dz - 0.75, face + 0.42, y + 1.6, z0 + dz + 0.75, 0xd8d8d4, { ghost: true, fade: true, overhead: true });
      }
      props.push({ shape: 'cylinder', size: [0.7, 0.7, 0], pos: [ARCADE_SHOPS + 2.5, top + 1.9, z0 + 2.4], color: 0xd8dcde, fade: true, overhead: true });
      for (const [dx, dz] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) box(ARCADE_SHOPS + 2.5 + dx - 0.04, top, z0 + 2.4 + dz - 0.04, ARCADE_SHOPS + 2.5 + dx + 0.04, top + 1.2, z0 + 2.4 + dz + 0.04, 0x5a5f66, { ghost: true, fade: true, overhead: true });
    } else {
      box(face, 8.15, z0 + 0.3, face + 1.0, 8.25, z1 - 0.3, 0x9a9890, { fade: true, overhead: true });
      box(face + 0.95, 8.25, z0 + 0.3, face + 1.0, 9.15, z1 - 0.3, wall, { fade: true, overhead: true });
      box(face + 0.5, 10.1, z0 + 0.5, face + 0.55, 10.13, z1 - 0.5, 0xd8d0b8, { ghost: true, fade: true, overhead: true });
      [0xd23c2c, 0xf2f0ea, 0x2f62a8, 0xe8b82e, 0x5f8f74].forEach((c, k) => box(face + 0.45, 9.4, z0 + 0.8 + k * 0.75, face + 0.6, 10.1, z0 + 1.3 + k * 0.75, c, { ghost: true, fade: true, overhead: true }));
      box(ARCADE_SHOPS + 0.4, top, z0 + 0.4, face - 1.2, top + 2.3, z1 - 0.4, 0xb8bcc0, { fade: true, overhead: true });
      box(ARCADE_SHOPS + 0.2, top + 2.3, z0 + 0.2, face - 1.0, top + 2.42, z1 - 0.2, [0x4f8d68, 0x4b7aa8][h >> 1], { fade: true, overhead: true, rot: [0, 0, 0.05] });
    }
    // The ceiling under it.
    box(ARCADE_SHOPS, ARCADE_HIGH - 0.15, z0, ARCADE_PILLARS + 0.25, ARCADE_HIGH, z1, 0xe8e2d4, { fade: true, overhead: true });
  }
  // Under the arcade, shop by shop from the south: scooters parked against the pillars; sandbags across a door, a board
  // up; the seafood shop's tanks out front and its stools; a dried-squid shop's racks; chairs stacked outside an eatery.
  const ax = ARCADE_SHOPS + 0.6, px = ARCADE_PILLARS - 0.9, y = ARCADE_FLOOR;
  for (const z of [r0 + 3.6, r0 + 4.6, r0 + 13.2, r0 + 14.2, r0 + 21]) object(['scooterBlue', 'scooterRed', 'scooterWhite', 'scooterYellow', 'scooterBlack'][Math.round(z) % 5] as ObjectKindId, px, z, Math.PI / 2, y);
  for (let k = 0; k < 4; k++) object('sandbag', ax + 0.1, r0 + 1.6 + k * 0.85, Math.PI / 2, y);
  for (let k = 0; k < 3; k++) object('sandbag', ax + 0.1, r0 + 2 + k * 0.85, Math.PI / 2, y + 0.28);
  object('fishTank', ax + 0.35, r0 + 7.6, Math.PI / 2, y);
  object('fishTank', ax + 0.35, r0 + 9.4, Math.PI / 2, y);
  for (let k = 0; k < 3; k++) object('stool', ax + 1.4, r0 + 7 + k * 1.1, 0, y);
  for (let k = 0; k < 3; k++) object('dryingRack', ax + 0.5, r0 + 11.5 + k * 1.3, Math.PI / 2, y);
  for (let k = 0; k < 4; k++) object('chair', ax + 0.3 + (k % 2) * 0.5, r0 + 17 + (k >> 1) * 0.6, k, y);
  for (let k = 0; k < 3; k++) object('sandbag', ax + 0.1, r1 - 4.2 + k * 0.85, Math.PI / 2, y);
  object('flowerPotTall', ax + 0.2, r1 - 1.2, 0, y);
  object('flowerPot', ax + 0.2, r1 - 0.6, 0, y);

  // The capsized boat, thrown over the wall and lying upside down across the street from the arcade's pillars to out over
  // the water: its bottom up, red below the waterline, its blue sides, the white band; the keel along its top, the
  // propeller and rudder at its stern; what fell out of it strewn round: floats, crates, a flag, its mast snapped.
  const bx0 = ARCADE_PILLARS + 0.4, bx1 = 15.5, bz = BOAT_Z;
  const mid = (bx0 + bx1) / 2, half = (bx1 - bx0) / 2;
  // On its bulwarks, its bow at the pillars (toward -x), its stern out over the water, the propeller up in the air.
  rigs.push({ kind: 'float', hull: 'vessel', pos: [mid, 0.79, bz], yaw: -Math.PI / 2, half: [2.7, 0, half], period: 1, phase: 0,
    parts: capsizedBoat({ w: 2.7, l: half - 0.15, color: 0x2f62a8, kind: 'trawl', gaps: [], gear: half * 0.3, hold: -half * 0.25 }) });
  // What broke off its deck as it went over: its wheelhouse, torn off and left on the quay by its stern, its windows
  // smashed, its radar fallen beside it; its 大漁旗 off the line, spread over the road.
  {
    const [x0, x1, z0, z1] = [4.9, 7.5, bz + 3.4, bz + 5.8];
    box(x0, 0, z0, x1, 2.0, z1, 0xeceae2, { rot: [0, 0.18, 0] });
    box(x0 - 0.02, 1.2, z0 - 0.02, x1 + 0.02, 1.65, z1 + 0.02, 0x2a3440, { rot: [0, 0.18, 0], ghost: true });
    box(x0 - 0.1, 2.0, z0 - 0.1, x1 + 0.1, 2.08, z1 + 0.1, 0x2f62a8, { rot: [0, 0.18, 0], ghost: true });
    box(x0 + 0.4, 0, z1 + 0.5, x0 + 2.2, 0.12, z1 + 0.75, 0x2a2c30, { rot: [0, 0.9, 0], ghost: true });
  }
  for (const [x, z, a, colours] of [[-1.2, bz - 5.4, 0.3, [0xd23c2c, 0xf2c12e, 0x2f62a8]], [2.6, bz + 4.2, -0.5, [0x2e9a5a, 0xf2c12e, 0xd23c2c]]] as const) colours.forEach((c, j) =>
    props.push({ shape: 'box', size: [0.65, 0.008, 0.3], pos: [x + Math.sin(a) * (j - 1) * 0.6, 0.02 + j * 0.002, z + Math.cos(a) * (j - 1) * 0.6], rot: [0, a, 0], color: c, ghost: true }));
  // Its broken line still on the bollard it pulled at; wet where it came down, things strewn.
  bollard(BOAT_Z - 9);
  line([[QUAY_EDGE - 1.1, 0.5, BOAT_Z - 9], [QUAY_EDGE - 0.2, 0.66, BOAT_Z - 7.8], [QUAY_EDGE + 0.6, 0.05, BOAT_Z - 6.5]], 0.04, ROPE[1]);
  rod([-2.2, 0.1, bz - 6.2], [3.8, 0.1, bz - 4.4], 0.1, 0xd8d8d0);
  object('flagOrange', 0.4, bz - 4.8, 1.1, 0);
  for (const [x, z] of [[1.6, bz - 3.6], [2.4, bz - 4.1], [-1, bz + 3.6], [4.6, bz + 3.4]]) object('box', x, z, x);
  for (const [x, z] of [[-0.4, bz - 3.4], [5.4, bz - 3.6]]) object('waterDrum', x, z, 0);

  // The alleys: lanes in off the street between the houses, 9.6 m across, then steps up the hill, a rail either side,
  // houses up the slope, the lane ending at the old town's own block at the top.
  const W = ALLEY_HALF;
  for (const z of ALLEYS) {
    const x1 = -24;
    for (let k = 0; k < 8; k++) box(x1 - (k + 1) * 0.9, 0, z - W, x1 - k * 0.9, 0.3 * (k + 1), z + W, 0xb0a898);
    box(x1 - 7.2, 0, z - W, -44.8, 2.4, z + W, 0xb0a898);
    for (const side of [-1, 1]) rod([x1, 1.0, z + side * (W - 0.3)], [x1 - 7.2, 3.4, z + side * (W - 0.3)], 0.04, 0x5a5f66, { ghost: true });
  }
  // The houses up the steps either side, their roofs' parapets along the alleys: behind them the rooftop additions,
  // tanks and pots the storm is taking.
  for (const [z0, z1, high, open, seed] of HILL) {
    box(-44, 0, z0, -24, high, z1, 0xd8cfbf, { fade: true, building: { style: 'old', open, crown: 0, seed: 500 + seed, taped: seed % 3 !== 1 } });
    if (open[2]) box(-44, high, z0, -24, high + 1, z0 + 0.25, 0xcfc6b4, { fade: true, overhead: true });
    if (open[3]) box(-44, high, z1 - 0.25, -24, high + 1, z1, 0xcfc6b4, { fade: true, overhead: true });
  }
  // The street's row either side of each alley's mouth, up to the town's own blocks: each alley a slot between walls, the
  // wind squeezed down it. Their parapets, and the town's blocks' along the alleys too.
  for (const [z0, z1, high, open, seed] of ROW) {
    box(-24, 0, z0, -6.5, high, z1, WALLS[seed % WALLS.length], { fade: true, building: { style: 'old', open, crown: 0, seed: 700 + seed, front: 1, taped: seed % 3 !== 1 } });
    if (open[2]) box(-24, high, z0, -6.5, high + 1, z0 + 0.25, 0xcfc6b4, { fade: true, overhead: true });
    if (open[3]) box(-24, high, z1 - 0.25, -6.5, high + 1, z1, 0xcfc6b4, { fade: true, overhead: true });
  }
  for (const [z0, z1, high] of BLOCK_EDGES) box(-24, high, z0, -6.5, high + 1, z1, 0xcfc6b4, { fade: true, overhead: true });
  // The wind out of them, squeezed between the houses and spreading out of their mouths across the street: each its own
  // beat, what it brings out of its own alley and off its roofs. The shops' banners at its mouth stand out before a gust.
  const gusts: GustDesc[] = [];
  const gust = (z: number, roofHigh: [number, number], more: Pick<GustDesc, 'period' | 'beats' | 'take'>, kinds: ObjectKindId[], each: number) =>
    gusts.push({ feed: roofs(z, roofHigh[0], roofHigh[1], kinds, each), from: [-44, z], mouth: [-6.5, z], to: [QUAY_EDGE, z], half: W, spread: GUST_SPREAD, force: GUST_FORCE, flags: [[-6.7, 2.8, z - W - 0.5], [-6.7, 2.8, z + W + 0.5]], ...more });
  // The first: a sheet-metal lean-to over a back door, torn up, its sheets down in the alley; off the roofs, signs torn
  // from their frames, the sheets of the rooftop additions, air conditioners off their brackets. A steady beat: two and a
  // half seconds of it, four and a half of calm.
  {
    const z = ALLEYS[0];
    for (const x of [-21.5, -18.5]) box(x - 0.05, 0, z + W - 0.3, x + 0.05, 2.5, z + W - 0.2, 0x5a5f66);
    box(-22, 2.5, z + W - 1.4, -18, 2.56, z + W - 0.1, 0x8a9aa4, { rot: [0.25, 0, 0.05] });
    for (let k = 0; k < 6; k++) object('tinSheet', -11 - k * 1.6, z + (k % 2 ? 1.6 : -1.4), 0.2 + k * 0.4, 0.05 + (k % 3) * 0.06);
    for (const [x, dz] of [[-15.5, -3.8], [-19, -3.8]]) object('plyBoard', x, z + dz, 0);
    for (const x of [-12.5, -16]) object('acUnit', x, z - 4.1, 0);
    gust(z, [10.5, 9], { period: 7, beats: [[1, 2.5]], take: 2 }, ['shopSign', 'tinSheet', 'acUnit', 'shopSign', 'tinSheet', 'acUnit'], 7);
  }
  // The second: the seafood restaurant's back door, its polystyrene fish boxes stacked high beside it, its gas cylinders,
  // its ice chests; off the roofs, drums and bins. Long gusts, as long a calm between.
  {
    const z = ALLEYS[1];
    for (const [x, dz] of [[-12, -3.4], [-13.4, 3.2], [-16.5, -3.4], [-18, 3.2]]) for (let k = 0; k < 6; k++) object('foamBox', x + (k % 2) * 0.75, z + dz, 0, (k >> 1) * 0.33);
    for (const x of [-10.5, -11.2, -14.6]) object('gasCylinder', x, z + 3.9);
    for (const x of [-20, -21.4]) object('iceChest', x, z - 3.6, Math.PI / 2);
    gust(z, [11, 12], { period: 8, beats: [[1, 3]], take: 4 }, ['iceChest', 'foamBox', 'waterDrum', 'gasCylinder', 'bin', 'foamBox', 'iceChest', 'waterDrum'], 9);
  }
  // The third: the houses' pots and water drums stood out on the steps, the neighbours' scooters parked along the wall;
  // off the roofs, the water tanks off their stands and air conditioners. Gusts in pairs, hardly a calm between
  // them, a long one after.
  {
    const z = ALLEYS[2];
    for (const [kind, x, dz] of [['flowerPotBloom', -10.5, 3.9], ['flowerPotTall', -11.3, 3.9], ['waterDrum', -12.4, 3.8], ['waterDrum', -16.5, 3.8], ['flowerPotTall', -19.5, 3.9]] as const) object(kind, x, z + dz);
    for (let k = 0; k < 12; k++) object(['scooterRed', 'scooterWhite', 'scooterBlue', 'scooterBlack'][k % 4] as ObjectKindId, -10.5 - k * 1.05, z - 3.6, 0);
    gust(z, [10, 13], { period: 9, beats: [[0.8, 1.6], [3.2, 1.6]], take: 3 }, ['waterTank', 'acUnit', 'waterTank', 'flowerPotTall', 'waterTank', 'acUnit'], 5);
  }
  // What the storm has brought down across the street at each alley's mouth, heavy, not to be pushed aside: each leaves a
  // way past only through the gusts' path, so that each alley is passed slowly, on its beat.
  //
  // At the first, a removals van parked at the quay, blown over onto its side across the harbour lane from the wall:
  // the way past is the town lane, in front of the alley. Its doors burst, its load out on the road.
  {
    const yaw = Math.atan2(-6.2, 4);
    props.push({ shape: 'box', size: [1.15, 1.4, 3.7], pos: [3.7, 1.17, 156.5], rot: [0, yaw, -Math.PI / 2], color: 0xf2efe6, vehicle: 'van' });
    for (const [kind, x, z, a] of [['wardrobe', 7.0, 151.8, 0.4], ['sofa', 5.6, 150.6, 1.2], ['fridge', 7.1, 149.6, 0.2], ['mattress', -1.6, 155.2, 0.9], ['tvSet', 0.4, 152.8, 2]] as const) object(kind, x, z, a);
    for (const [x, z] of [[-0.8, 153.6], [-2.3, 157.8], [1.2, 151.2], [-3.4, 159.6]]) object('box', x, z, x);
  }
  // At the second, the scaffolding up the front of the shop south of it, being done up: torn from its ties above
  // the first floor and come down across the town lane, its green net over its tangle of tubes. The way past is the
  // harbour lane, across the alley's mouth.
  {
    const [z0, z1] = [174.6, 181.1];
    // What still stands against the front: its uprights and ledgers to the first floor's ties, bent there.
    for (let z = z0 + 0.3; z <= z1; z += 2.1) {
      rod([-6.3, 0, z], [-6.3, 3.1, z], 0.03, 0x8a8f96);
      rod([-6.3, 3.1, z], [-5.4, 5.6, z + 0.4], 0.03, 0x8a8f96, { ghost: true });
    }
    // The fallen part: from the first floor's ties down to the road, a slope of net on the tubes crumpled under it.
    const lo: [number, number] = [0.6, 0.35], hi: [number, number] = [-6.3, 3.1];
    const dx = lo[0] - hi[0], dy = lo[1] - hi[1], len = Math.hypot(dx, dy), tip = Math.atan2(dy, dx);
    props.push({ shape: 'box', size: [len / 2, 0.06, (z1 - z0) / 2], pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (z0 + z1) / 2], rot: [0, 0, tip], color: 0x2f7a4a });
    for (let z = z0 + 0.4; z < z1; z += 1.6) {
      rod([hi[0], hi[1] + 0.08, z], [lo[0], lo[1] + 0.08, z + 0.3], 0.035, 0x9aa0a6, { ghost: true });
      // Under it, the tubes come down with it, crumpled, holding it up.
      for (const t of [0.3, 0.6]) rod([hi[0] + dx * t, 0, z + 0.2], [hi[0] + dx * t + 0.2, hi[1] + dy * t - 0.05, z - 0.1], 0.035, 0x8a8f96);
    }
    for (let k = 0; k < 4; k++) rod([hi[0] + dx * (0.15 + k * 0.25), hi[1] + dy * (0.15 + k * 0.25) + 0.09, z0], [hi[0] + dx * (0.15 + k * 0.25), hi[1] + dy * (0.15 + k * 0.25) + 0.09, z1], 0.03, 0x9aa0a6, { ghost: true });
    // Its banner, the shop's own, torn half off it; tubes and boards that came loose, out on the road.
    box(-4.2, 1.35, z1 - 0.3, -1.2, 2.25, z1 - 0.26, 0xe0b020, { rot: [0, 0, tip * 0.9], ghost: true });
    for (const [x, z, a] of [[1.4, 176.2, 0.3], [1.0, 179.6, 1.1], [2.0, 174.1, 2.6]] as const) object('pipe', x, z, a);
    for (const [x, z] of [[1.6, 181.6], [0.9, 173.4]]) object('pallet', x, z, x);
  }
  // At the third, the billboard off the roof of the corner house north of it, the seafood restaurant's own: blown off
  // its stand and come down across the harbour lane and the road's middle askew, face up, propped on its fallen frame,
  // its face torn open at one end and a corner curled up, mud along its low edge where it hit; its floodlights' arms
  // bent along its top. The way past is the town lane, across the alley's mouth again.
  {
    const [cx, cz, wide, deep, up, yaw] = [2.75, 217.7, 8, 2.8, 1.9, 0.12];
    const tilt = -Math.atan2(up, deep), slant = Math.hypot(up, deep), half = wide / 2;
    const turn = new Quaternion().setFromEuler(new Euler(tilt, yaw, 0, 'YXZ'));
    const asProp = new Euler().setFromQuaternion(turn, 'XYZ');
    const centre = new Vector3(cx, up / 2 + 0.05, cz);
    // A point on the board in its own frame: across it (u), up its slope from its low edge (v), out from its face.
    const at = (u: number, v: number, out = 0): Vec3 => new Vector3(u, 0.1 + out, v - slant / 2).applyQuaternion(turn).add(centre).toArray() as Vec3;
    const onIt = (u0: number, v0: number, u1: number, v1: number, out: number, thick: number, color: number, more: Partial<PropDesc> = {}) =>
      props.push({ shape: 'box', size: [(u1 - u0) / 2, thick, (v1 - v0) / 2], pos: at((u0 + u1) / 2, (v0 + v1) / 2, out), rot: [asProp.x, asProp.y, asProp.z], color, ghost: true, ...more });
    // The board, white, its steel rim round it but where it is torn.
    props.push({ shape: 'box', size: [half - 0.55, 0.1, slant / 2], pos: at(-0.55, slant / 2, -0.1), rot: [asProp.x, asProp.y, asProp.z], color: 0xf2efe6 });
    for (const v of [0.04, slant - 0.04]) rod(at(-half, v, 0.04), at(half - (v > 1 ? 1.4 : 0), v, 0.04), 0.07, 0x4a4f57, { ghost: true });
    rod(at(-half + 0.04, 0, 0.04), at(-half + 0.04, slant, 0.04), 0.07, 0x4a4f57, { ghost: true });
    // Its east end torn open: the face gone, the frame behind it, a flap of the face hanging; the corner curled up.
    for (const u of [half - 1.05, half - 0.35]) rod(at(u, 0, -0.05), at(u, slant - 0.2, -0.05), 0.05, 0x4a4f57, { ghost: true });
    for (const v of [0.6, 1.5, 2.4]) rod(at(half - 1.1, v, -0.05), at(half - 0.05, v, -0.05), 0.035, 0x4a4f57, { ghost: true });
    onIt(half - 1.1, 0, half - 0.3, 0.55, 0.02, 0.03, 0xf2efe6, { rot: [asProp.x + 0.25, asProp.y + 0.3, asProp.z] });
    props.push({ shape: 'box', size: [0.55, 0.03, 0.4], pos: at(half - 0.6, slant - 0.15, 0.35), rot: [asProp.x - 0.9, asProp.y, asProp.z + 0.3], color: 0xf2efe6, ghost: true });
    // Its ad, read from the south as it lies: the restaurant's name and price big, what it sells under it, a little off
    // where the face has slipped on its frame.
    const lean = Math.PI / 2 + tilt;
    signs.push({ kind: 'name', text: '海產熱炒　百元起', colors: ['#c8262a', '#f2efe6', '#f2c12e'], wide: 6.4, pos: at(-0.8, slant * 0.62, 0.06), rotY: Math.PI + yaw, lean });
    signs.push({ kind: 'name', text: '生猛海鮮　現撈現煮', colors: ['#f2c12e', '#c8262a', '#c8262a'], wide: 4.2, pos: at(-1.1, slant * 0.2, 0.06), rotY: Math.PI + yaw, lean });
    // Mud and grit along its low edge, splashed up it.
    for (let k = 0; k < 7; k++) onIt(-half + 0.3 + k * 1.0, 0.05, -half + 0.9 + k * 1.0 + (k % 3) * 0.2, 0.25 + (k % 2) * 0.2, 0.12, 0.005, 0x6a5a48);
    // Its floodlights on their arms along its top, bent this way and that; two broken off on the road.
    for (const [u, bend] of [[-3, 0.5], [-0.6, -0.4], [1.6, 0.9]] as const) {
      const foot = at(u, slant, 0), tip = at(u + bend, slant - 0.9, 0.7);
      rod(foot, tip, 0.03, 0x4a4f57, { ghost: true });
      props.push({ shape: 'box', size: [0.16, 0.1, 0.12], pos: tip, rot: [0.6, bend, 0], color: 0x33363b, ghost: true });
    }
    for (const [x, z] of [[-0.4, 215.0], [4.4, 215.3]]) box(x - 0.15, 0, z - 0.1, x + 0.15, 0.1, z + 0.1, 0x33363b, { rot: [0, x, 0], ghost: true });
    // Its frame under the raised edge: the angle-iron legs it stood on, bent and fallen under it; the rail they held.
    for (let u = -half + 0.5; u <= half - 0.4; u += 1.9) {
      const top = at(u, slant - 0.05, -0.25);
      rod([top[0] - 0.3, 0, top[2] - 0.2], top, 0.05, 0x5a5f66);
      rod([top[0] - 0.1, 0, top[2] + 0.9], [top[0] + 0.1, top[1] - 0.1, top[2] - 0.1], 0.04, 0x5a5f66);
    }
    rod(at(-half, slant, -0.2), at(half, slant, -0.2), 0.05, 0x5a5f66);
    // Its face's pieces, and the glass of its lights, about the road.
    for (let k = 0; k < 10; k++) decals.push({ pos: [-0.8 + ((k * 2.3) % 7.5), 213.8 + ((k * 1.7) % 2.2)], size: [0.3 + (k % 3) * 0.2, 0.2], rotY: k * 0.9, color: k % 3 ? 0xf2efe6 : 0xc8372d });
  }
  // The restaurant it was put up for: the corner house north of the alley, its name across its front, its tanks out on
  // the pavement, its red stools stacked for the night; on its roof the stand the billboard stood on, bent over, empty,
  // a strip of the face still caught on it.
  {
    const z0 = 215.3, z1 = 220, roof = 13;
    // Over the house's own sign across its beam, where any shop's name goes.
    signs.push({ kind: 'name', text: '阿海海產熱炒', colors: ['#c8262a', '#f2efe6', '#f2c12e'], wide: 4.6, pos: [-6.15, 3.9, (z0 + z1) / 2], rotY: Math.PI / 2 });
    for (const z of [z0 + 0.8, z0 + 2.4]) object('fishTank', -5.8, z, Math.PI / 2);
    for (let k = 0; k < 4; k++) object('stool', -5.4, z0 + 3.4 + (k % 2) * 0.4, 0, Math.floor(k / 2) * 0.45);
    object('gasCylinder', -6.1, z1 - 0.4);
    for (const z of [z0 + 0.6, z1 - 0.6]) {
      rod([-23, roof, z], [-12, roof + 4.5, z + 0.3], 0.09, 0x5a5f66, { ghost: true });
      rod([-12, roof + 4.5, z + 0.3], [-8.5, roof + 3.2, z + 0.8], 0.09, 0x5a5f66, { ghost: true });
      rod([-14, roof, z], [-12, roof + 4.5, z + 0.3], 0.07, 0x5a5f66, { ghost: true });
    }
    rod([-12, roof + 4.5, z0 + 0.9], [-12, roof + 4.5, z1 - 0.3], 0.07, 0x5a5f66, { ghost: true });
    props.push({ shape: 'box', size: [1.1, 0.02, 0.6], pos: [-11.2, roof + 4.1, z1 - 1.2], rot: [0.4, 0.3, 1.1], color: 0xc8372d, ghost: true });
  }

  // Across the street's south end, the way shut for the storm.
  for (let x = -ROAD_W + 0.6; x < QUAY_EDGE - 0.5; x += 1.8) object('barrier', x, -6, 0);

  return { props, objects, decals, crowds, rigs, pools, gusts, signs, sparks: ends };
}

/** The alleys, where across the street their middles are; how far either side of that they are open, metres. */
const ALLEYS = [160, 186, 210.5];
const ALLEY_HALF = 4.8;
/** The street's row either side of the alleys' mouths, x -24 to -6.5, between them and the town's own blocks: from,
 * to, how high, which sides open, its own seed. */
const ROW: [number, number, number, [boolean, boolean, boolean, boolean], number][] = [
  [152, 155.2, 10.5, [false, true, true, true], 1],
  [164.8, 173, 9, [false, true, true, false], 2],
  [173, 181.2, 11, [false, true, false, true], 3],
  [190.8, 198, 12, [false, true, true, false], 4],
  [198, 205.7, 10, [false, true, false, true], 5],
  [215.3, 220, 13, [false, true, true, false], 6],
];
/** The town's own blocks' edges along the alleys, x -24 to -6.5: their parapets, from, to, at what height. */
const BLOCK_EDGES: [number, number, number][] = [];
/** The houses up the steps either side of the alleys, x -44 to -24: from, to, how high, which sides open, a seed. */
const HILL: [number, number, number, [boolean, boolean, boolean, boolean], number][] = [
  [149.8, 155.2, 15, [false, true, false, true], 1],
  [164.8, 181.2, 15, [false, true, true, true], 2],
  [190.8, 205.7, 15, [false, true, true, true], 3],
  [215.3, 220.5, 15, [false, true, true, false], 4],
];
/** How wide the gust is across the street's far side, where it reaches the quay, either side of its middle, metres:
 * spread out from the alley's mouth as wind out of a slot does. */
const GUST_SPREAD = 7;
/** How hard the alleys' gusts blow: a polystyrene box flies, a sheet of iron slides and lifts, a pot goes over and rolls. */
const GUST_FORCE = 1200;
/** Off the roofs either side of an alley: from just behind their parapets, over them and down into it, along toward its mouth. */
function roofs(z: number, south: number, north: number, kinds: ObjectKindId[], each: number): GustDesc['feed'] {
  const W1 = ALLEY_HALF + 0.5;
  return {
    at: [[-11, south + 1.15, z - W1], [-15, north + 1.15, z + W1], [-19, south + 1.15, z - W1], [-38, 16.15, z - W1], [-13, north + 1.15, z + W1], [-17, south + 1.15, z - W1], [-41, 16.15, z + W1], [-21, north + 1.15, z + W1]],
    push: [[2, 2, 2.1], [2, 2, -2.1], [2.5, 2, 2.3], [1.5, 2, 2.1], [2, 2, -2.3], [2, 2, 2.2], [1.5, 2, -2.1], [2.5, 2, -2.2]],
    kinds,
    each,
  };
}
/** Lines and ropes: white and blue, as the harbour's are. */
const ROPE = [0xe8e4d8, 0x2f6fb0];
/** The bollard nearest a point along the quay. */
function nearestBollard(z: number): number {
  return 4 + Math.round((z - 4) / 12) * 12;
}
/** A wire hanging slack through these points, smoothed between them: as points close along it. */
function hang(points: Vec3[]): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    for (let k = 0; k < 4; k++) {
      const t = k / 4, t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map((j) => 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3)) as Vec3);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
/** A line from a to b sagging under its own weight by so much at its middle, as points along it. */
function sag(a: Vec3, b: Vec3, drop: number): Vec3[] {
  const out: Vec3[] = [];
  for (let k = 0; k <= 6; k++) {
    const t = k / 6;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - drop * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  return out;
}

/** Where the tree lies, from its roots to its crown: nothing of the town's furniture stood there. */
function nearTree(x: number, z: number): boolean {
  const [rx, rz] = TREE.root, [tx, tz] = TREE.tip, fx = tx - rx, fz = tz - rz, l2 = fx * fx + fz * fz;
  const t = Math.max(-0.3, Math.min(1.6, ((x - rx) * fx + (z - rz) * fz) / l2));
  return Math.hypot(x - rx - fx * t, z - rz - fz * t) < 3.2;
}
/** The town's pavement up to the boat row, in 4 m lengths from where each begins: scooters parked ('S'), a door
 * sandbagged and boarded ('B'); not by the scooters' bays at the start, the tree's bed, nor the eatery. */
const KERB: [number, string][] = [[0, 'B'], [5, 'S'], [9.5, 'B'], [28, 'S'], [37, 'B'], [41.5, 'S'], [46, 'S'], [50.5, 'B'], [55, 'S'], [59.5, 'B'], [63.5, 'S'], [72, 'B'], [90.5, 'S']];
function kerbTaken(z: number): boolean {
  return KERB.some(([z0]) => z > z0 - 0.5 && z < z0 + 4.5);
}
/** The boat row's shops under their arcade, from the south: a tackle shop, the seafood shop with its tanks out, the
 * dried-squid shop with its racks, the noodle shop with its chairs stacked, an ironmonger's. Name, ground, ink. */
const ARCADE_SHOPS_NAMES: [string, string, string][] = [
  ['永昌漁具', '#2f62a8', '#f2efe6'],
  ['海港活海鮮', '#c8262a', '#f2efe6'],
  ['阿珠魷魚絲', '#e0b020', '#c8262a'],
  ['老王麵館', '#2e8a6a', '#f2efe6'],
  ['金順五金', '#b3463a', '#f2c12e'],
];
