import { city, cityCell } from './city';
import { Heights, heightOf, lift, type Profile } from './lift';
import type { Vec3 } from '../config';
import { approach, type LevelDef } from './types';

// The city of the first level, as it is, on a hillside: the same streets, blocks and obstacles,
// with the ground climbing and falling between them. A trial of putting height into a map drawn
// on squares, not a level in its own right yet.
//
// Where it slopes (rows of the city's map, counted from the south; each is 16 m):
//   rows  6 -  8   the road out of the depot climbs to the boulevard: 8 m, 17%
//   rows 14 - 17   the market lane climbs: 9 m, 14%
//   rows 20 - 21   and comes down again to the river: 6 m, 19%
//   rows 29 - 30   the street with the humps climbs to the busy street: 5 m, 16%
// Everything else is level: the depot, the boulevard, the river and its bridge, the roadworks,
// the busy street, the railway and the old town.
//
// And one place where the ground differs from east to west: beside the road out of the depot
// the blocks do not slope with it. Those on its east are a terrace at the height of the top, held
// by a wall the road climbs beside; those on its west stay down at the height of the depot, so
// that the road rises above them with a drop at its edge.

const CELL = 16;
/** The north edge of a row. */
const edge = (row: number) => (row + 0.5) * CELL;
/** The two edges of a run of columns, in X: the lesser first. Columns run the other way from X. */
const columns = (from: number, to: number): [number, number] => [cityCell(to, 0)[0] - CELL / 2, cityCell(from, 0)[0] + CELL / 2];

const PROFILE: Profile = [
  [edge(5), 0], [edge(8), 8],
  [edge(13), 8], [edge(17), 17],
  [edge(19), 17], [edge(21), 11],
  [edge(28), 11], [edge(30), 16],
];

/** The ground of the city on its hillside, on squares of `cell` (16, or a whole fraction of it); and, where `beyond` gives a height, that instead. */
export function cityHeights(cell = CELL, beyond?: (x: number, z: number) => number | null): Heights {
  const heights = new Heights(cell, [0, edge(5)], (x, z) => beyond?.(x, z) ?? heightOf(PROFILE, z));
  // +X is west here: the higher columns are to the east.
  const [upperFrom, upperTo] = columns(18, 23);
  const [lowerFrom, lowerTo] = columns(10, 16);
  heights.level([upperFrom, edge(5), upperTo, edge(8)], 8);
  heights.level([lowerFrom, edge(5), lowerTo, edge(8)], 0);
  return heights;
}

export const CITY_LOOKS = {
  ground: { tag: 'road', color: 0x5b626b, wall: 0x70757c },
  pit: { tag: 'pit', color: 0x4a3a2a, wall: 0x4a3a2a },
  footing: 0x8d8a84,
};

export function hillcity(): LevelDef {
  const heights = cityHeights();
  const flat = city();
  concertSquare(flat, heights);
  riverPlatform(flat, heights);
  siteScaffold(flat, heights);
  return {
    ...lift(flat, heights, CITY_LOOKS),
    id: 'hillcity',
    // Saved at the crossing before the lifting bridge, past the dug-up road; put back in the dead end beside it, where no
    // traffic comes, facing the crossing.
    save: { zone: [cityCell(20, 23)[0] - 8, cityCell(20, 23)[1] - 6, cityCell(20, 23)[0] + 8, cityCell(20, 23)[1] + 6], pos: [cityCell(18, 23)[0] - 6, cityCell(18, 23)[1]], yaw: -Math.PI / 2 },
    // Level 1 now: the same city as ever, on its hillside. Named as level 1 always was.
    // The customer is a student moving house; the boss has a word at the railway.
    chat: {
      customer: 'student',
      places: [
        { zone: approach(cityCell(27, 15), 0), talk: [['them', '你要經過市場了吧'], ['them', '那邊有間小吃攤還不錯，我挺喜歡的'], ['me', '等我開過去後以後可能就沒有了']] },
        // Along the busy street coming up to the corner, and round it to the crossing.
        { zone: [cityCell(29, 31)[0] - 10, cityCell(29, 31)[1] - 8, cityCell(29, 31)[0] + 60, cityCell(29, 33)[1] + 6], from: 'boss', talk: [['them', '前面平交道'], ['them', '柵欄放下來就停，不要跟火車比誰硬'], ['me', '我試過了 火車比較硬']] },
      ],
    },
    name: '第 1 關　城市配送',
    brief: '穿過市區，把貨物送到綠色卸貨區',
    // The scaffolding in the roadworks is somewhere to fall from with something in one's arms.
    carryFalls: true,
  };
}

/**
 * The square beside the market lane, made over for a concert tonight: steel bollards across its middle, past which no truck
 * goes; behind them, west of the fountain, rows of chairs facing a stage, its backdrop and its rig; and behind the backdrop,
 * among the band's cases, the student's club's amplifier, left from last night, its front to whoever comes round the back: hidden there to be found. It is fetched on
 * foot from the bollards, carried round the stage and back through the chairs: about 32 m, inside the driver's leash.
 * On the flat city, before it is lifted on to its hillside.
 */
function concertSquare(flat: LevelDef, heights: Heights): void {
  // The square: from the market lane at x -192 west to -256, its fountain in the middle; all of it level where this goes.
  const [west, fz] = [-256, 296];
  const KERB = 0.15;
  const line = -216;
  const [stageEast, stageWest] = [-236, -241.2];
  const [stageSouth, stageNorth] = [fz - 6.5, fz + 6.5];
  // Clear the ground where the bollards, the chairs, the stage and the back of it go, of the café tables and benches.
  const clear = (x: number, z: number) =>
    Math.abs(x - line) < 1.2 || (x < -229 && x > west + 2 && z > fz - 12 && z < fz + 12);
  flat.objects = flat.objects?.filter((o) => !clear(o.pos[0], o.pos[2]));
  const props = flat.props;
  const objects = flat.objects!;
  const solid = (size: Vec3, pos: Vec3, color: number) => props.push({ shape: 'box', size, pos, color });
  const show = (size: Vec3, pos: Vec3, color: number) => props.push({ shape: 'box', size, pos, color, ghost: true });

  // The bollards: steel posts set in the paving with a yellow band, too close for a truck to pass between.
  for (let z = 265.5; z < 327; z += 1.6) {
    props.push({ shape: 'cylinder', size: [0.11, 0.45, 0], pos: [line, KERB + 0.45, z], color: 0x4a4f57 });
    props.push({ shape: 'cylinder', size: [0.115, 0.04, 0], pos: [line, KERB + 0.72, z], color: 0xf2c12e, ghost: true });
  }
  // The stage: a deck on legs with a dark skirt, steps up at its ends, speakers stacked at its corners.
  solid([(stageWest - stageEast) / -2, 0.5, 6.5], [(stageEast + stageWest) / 2, KERB + 0.5, fz], 0x3a3f46);
  show([0.02, 0.45, 6.4], [stageEast + 0.01, KERB + 0.5, fz], 0x1b1d22);
  show([(stageWest - stageEast) / -2 - 0.05, 0.02, 6.45], [(stageEast + stageWest) / 2, KERB + 1.01, fz], 0x5a4632);
  for (const z of [stageSouth - 0.6, stageNorth + 0.6]) {
    solid([0.7, 0.25, 0.5], [stageEast - 0.9, KERB + 0.25, z], 0x4a4f57);
    solid([0.7, 0.5, 0.4], [stageEast - 2.2, KERB + 0.5, z], 0x4a4f57);
  }
  for (const z of [stageSouth + 0.6, stageNorth - 0.6]) {
    solid([0.42, 0.62, 0.45], [stageEast - 0.8, KERB + 1.62, z], 0x1e1f23);
    show([0.02, 0.5, 0.35], [stageEast - 0.37, KERB + 1.62, z], 0x3a3c42);
    solid([0.36, 0.34, 0.4], [stageEast - 0.8, KERB + 2.58, z], 0x1e1f23);
  }
  // A drum riser and the mic stand at the front.
  solid([1.2, 0.2, 1.4], [stageWest + 1.6, KERB + 1.2, fz], 0x2a2c31);
  show([0.02, 0.75, 0.02], [stageEast - 0.9, KERB + 1.75, fz], 0x9aa0a6);
  // The backdrop: a wall of banner on a frame, the night's name on it; the rig over the front on two towers.
  solid([0.12, 2.5, 7], [stageWest - 0.15, KERB + 2.5, fz], 0x2a3a6a);
  for (let k = 0; k < 9; k++) show([0.01, 2.3, 0.1], [stageWest - 0.02, KERB + 2.6, fz - 6 + k * 1.5], 0x34477e);
  flat.signs = [...(flat.signs ?? []), { pos: [stageWest + 0.02, KERB + 3.9, fz], rotY: Math.PI / 2, kind: 'concert' }];
  for (const z of [stageSouth - 0.2, stageNorth + 0.2]) props.push({ shape: 'cylinder', size: [0.12, 2.9, 0], pos: [stageEast - 0.3, KERB + 2.9, z], color: 0x9aa0a6 });
  show([0.15, 0.15, 6.9], [stageEast - 0.3, KERB + 5.7, fz], 0x8a929a);
  for (let k = 0; k < 6; k++) show([0.16, 0.18, 0.16], [stageEast - 0.3, KERB + 5.42, fz - 5 + k * 2], k % 2 ? 0xffe08a : 0xff8a5a);

  // Nobody walks through the stage, its backdrop or the speakers at its corners.
  flat.keepOut = [...(flat.keepOut ?? []), [stageWest - 0.5, stageSouth - 1.2, stageEast + 0.2, stageNorth + 1.2]];

  // The seats: rows of red plastic chairs facing the stage, an aisle down the middle; the audience about them.
  for (const x of [-231, -232.6, -234.2]) {
    for (let z = fz - 7.4; z <= fz + 7.4; z += 0.8) {
      if (Math.abs(z - fz) < 0.9) continue;
      objects.push({ kind: 'chair', pos: [x, KERB, z], rotY: -Math.PI / 2 });
    }
  }
  flat.crowds = [...(flat.crowds ?? []), { area: [-235.4, fz - 9, -229.5, fz + 9], count: 10, y: KERB }];

  // Behind the backdrop: the band's road cases, a cable drum, a rail of stage clothes, a table of drinks; and the amplifier.
  const behind = stageWest - 2.2;
  for (const [dz, up] of [[-5.2, 0], [-5.2, 1], [-4.1, 0], [4.6, 0], [5.6, 0], [5.6, 1]] as const) {
    props.push({ shape: 'box', size: [0.45, 0.33, 0.42], pos: [behind - 0.6, KERB + 0.33 + up * 0.67, fz + dz], color: 0x1e1f23, mass: 35 });
  }
  props.push({ shape: 'cylinder', size: [0.45, 0.3, 0], pos: [behind - 0.4, KERB + 0.45, fz - 2.4], rot: [Math.PI / 2, 0, 0], color: 0x6a4a2a, mass: 25 });
  objects.push({ kind: 'clothesRack', pos: [behind - 2.4, KERB, fz + 2.2], rotY: Math.PI / 2 });
  objects.push({ kind: 'table', pos: [behind - 1.8, KERB, fz - 4.6] });
  flat.cargo = [...flat.cargo, { type: 'amp', pos: [behind + 0.4, heights.at(behind + 0.4, fz + 0.4) + KERB + 0.3, fz + 0.4], rotY: -Math.PI / 2, found: true }];
}

/**
 * Down the north bank, some way west of the lifting bridge: a waterside platform let into the river wall just above the
 * water, 0.6 m below the bank, reached through a gap in the railing by dropping down on to it; and on it the student's
 * bicycle, left there a week ago. Getting back up empty-handed is a jump; with the bicycle (15 kg) there is no jumping,
 * and it is too high to step, so the bicycle goes up into the truck parked on the bank above by being thrown.
 * On the flat city, before it is lifted on to its hillside, where the bank is at 0, the water 0.7 below it, and the
 * river's edge at z 408.
 */
function riverPlatform(flat: LevelDef, heights: Heights): void {
  const edge = 408;
  const [west, east] = [49.5, 41];
  const top = -0.6;
  const out = 2.5;
  const [gap0, gap1] = [44.3, 46.7];
  const props = flat.props;
  // The bank's railing in that stretch, with a gap over the platform.
  const railing = props.findIndex((p) => p.shape === 'box' && Math.abs(p.pos[0] - 40) < 0.01 && Math.abs(p.pos[2] - (edge + 0.3)) < 0.01);
  if (railing >= 0) {
    const [r] = props.splice(railing, 1);
    for (const [a, b] of [[r.pos[0] - r.size[0], gap0], [gap1, r.pos[0] + r.size[0]]]) props.push({ ...r, size: [(b - a) / 2, r.size[1], r.size[2]], pos: [(a + b) / 2, r.pos[1], r.pos[2]] });
  }
  // Room on the bank beside it to stop the truck: no trees or benches in the way.
  flat.objects = flat.objects?.filter((o) => !(o.pos[0] > east - 6 && o.pos[0] < west + 6 && o.pos[2] > edge && o.pos[2] < edge + 8));
  // The platform, its boards, and a railing round its river side and ends.
  props.push({ shape: 'box', size: [(west - east) / 2, 0.3, out / 2], pos: [(west + east) / 2, top - 0.3, edge - out / 2], color: 0xa9a59b });
  for (let x = east + 0.25; x < west; x += 0.5) props.push({ shape: 'box', size: [0.22, 0.02, out / 2 - 0.08], pos: [x, top + 0.01, edge - out / 2], color: 0x9a7a52, ghost: true });
  // The railing is open, posts and a rail, so that what is on the platform is seen from the bank.
  const rail = 0x5a6068;
  props.push({ shape: 'box', size: [(west - east) / 2, 0.03, 0.03], pos: [(west + east) / 2, top + 1, edge - out], color: rail });
  props.push({ shape: 'box', size: [(west - east) / 2, 0.015, 0.015], pos: [(west + east) / 2, top + 0.5, edge - out], color: rail, ghost: true });
  for (const x of [east, west]) props.push({ shape: 'box', size: [0.03, 0.03, out / 2], pos: [x, top + 1, edge - out / 2], color: rail });
  for (let x = east; x <= west + 0.01; x += (west - east) / 6) props.push({ shape: 'cylinder', size: [0.04, 0.5, 0], pos: [x, top + 0.5, edge - out], color: rail });
  for (const x of [east, west]) props.push({ shape: 'cylinder', size: [0.04, 0.5, 0], pos: [x, top + 0.5, edge - out / 2], color: rail });
  // A post with a sign at the gap; a lifebuoy hung on the platform's railing.
  props.push({ shape: 'box', size: [0.04, 0.6, 0.04], pos: [gap1 + 0.4, 0.6, edge + 0.6], color: 0x5a6068 });
  props.push({ shape: 'box', size: [0.3, 0.2, 0.02], pos: [gap1 + 0.4, 1.3, edge + 0.6], color: 0x2f6fb0 });
  props.push({ shape: 'cylinder', size: [0.3, 0.05, 0], pos: [east + 2, top + 0.8, edge - out - 0.08], rot: [Math.PI / 2, 0, 0], color: 0xe8662a, ghost: true });
  // The bicycle, standing along the wall toward the platform's west end.
  const [bx, bz] = [west - 2, edge - out / 2 - 0.2];
  flat.cargo = [...flat.cargo, { type: 'bicycle', pos: [bx, heights.at(bx, edge + 2) + top + 0.52, bz], rotY: Math.PI / 2, found: true }];
}

/**
 * The building going up in the roadworks: its scaffold boards made to stand on, a stair tower beside its north-east corner
 * up to the 4 m lift, the top lift not boarded yet, and on the tower's top landing a stack of formwork, from which a jump reaches the 6 m lift. There,
 * at the far end, a brand-new window air conditioner, which the driver takes for the student in place of the old one off
 * the site they had been promised and missed.
 * At 27 kg it is not thrown far enough to reach a truck outside the fence, so it is carried down; and a drop with it in
 * one's arms costs it (LevelDef.carryFalls). The netting over the upper lifts goes see-through when it is in the way.
 * On the flat city, before it is lifted on to its hillside: the side scaffold's boards run along x -94.7 to -93.7, z 434.5
 * to 445.5, at 2, 4, 6 and 8 m.
 */
function siteScaffold(flat: LevelDef, heights: Heights): void {
  const onSite = (p: { pos: Vec3 }) => p.pos[0] > -109 && p.pos[0] < -93 && p.pos[2] > 432 && p.pos[2] < 447;
  const inTower = (p: { pos: Vec3 }) => p.pos[0] > -94 && p.pos[0] < -90.5 && p.pos[2] > 433.5 && p.pos[2] < 441;
  // The top lift, at 8 m, is not boarded yet: with boards there, a jump on to the 6 m lift would put a head into them.
  const board = (p: { ghost?: boolean; color: number; shape: string; size: Vec3 }) => p.ghost && p.color === 0xb98a55 && p.shape === 'box' && Math.abs(p.size[1] - 0.03) < 0.001;
  flat.props = flat.props.filter((p) => !(onSite(p) && board(p) && Math.abs(p.pos[1] - 8) < 0.01));
  const props = flat.props;
  // The boards, to walk on. And everything of the scaffold and the building in it, tubes, boards, netting, columns and
  // floors, goes see-through wherever it comes between the camera and whoever is climbing it.
  for (const p of props) {
    if (!onSite(p)) continue;
    if (board(p)) p.ghost = false;
    if (p.pos[1] > 0.6) p.fade = true;
  }
  // The corner where the two runs of scaffold meet is boarded too, at every lift: as it stood, a gap to fall through.
  for (const y of [2, 4, 6]) props.push({ shape: 'box', size: [0.55, 0.03, 0.55], pos: [-94.25, y, 433.95], color: 0xb98a55 });
  const [x0, x1, z0] = [-93.6, -91.2, 435];
  const strip = (x1 - x0) / 2;
  flat.objects = flat.objects?.filter((o) => !(o.pos[0] > x0 - 0.6 && o.pos[0] < x1 + 1 && o.pos[2] > 433 && o.pos[2] < 441.5));
  const steel = 0x8f979d, tread = 0x7a8086;
  const slab = (xa: number, xb: number, za: number, zb: number, y: number, color = tread) =>
    props.push({ shape: 'box', size: [(xb - xa) / 2, 0.04, (zb - za) / 2], pos: [(xa + xb) / 2, y - 0.04, (za + zb) / 2], color });
  // Up the outer side going north, round on a landing at 2 m, back up the inner side going south to the top at 4 m.
  for (let k = 1; k <= 8; k++) {
    slab(x1 - strip, x1, z0 + 0.5 * (k - 1), z0 + 0.5 * k, 0.25 * k);
    slab(x0, x0 + strip, z0 + 4 - 0.5 * k, z0 + 4.5 - 0.5 * k, 2 + 0.25 * k);
  }
  slab(x0, x1, z0 + 4, z0 + 5.2, 2);
  slab(x0 - 0.2, x1, z0 - 1, z0, 4);
  // The tower's frame: standards at its corners, rails up its outside and round its landings.
  for (const x of [x0, x1]) for (const z of [z0 - 1, z0 + 5.2]) props.push({ shape: 'cylinder', size: [0.04, 2.6, 0], pos: [x, 2.6, z], color: steel, ghost: true });
  for (const y of [1, 3, 5]) {
    props.push({ shape: 'box', size: [0.02, 0.02, 3.1], pos: [x1 + 0.02, y, z0 + 2.1], color: steel, ghost: true });
    props.push({ shape: 'box', size: [strip * 1.0, 0.02, 0.02], pos: [(x0 + x1) / 2, y, z0 + 5.2], color: steel, ghost: true });
  }
  props.push({ shape: 'box', size: [0.03, 0.5, 0.5], pos: [x1 + 0.02, 4.5, z0 - 0.5], color: steel });
  // On the top landing: the formwork, plywood sheets stacked on battens, to climb on.
  props.push({ shape: 'box', size: [0.5, 0.7, 0.45], pos: [x1 - 0.65, 4.7, z0 - 0.5], color: 0xc9a46a });
  for (let k = 0; k < 6; k++) props.push({ shape: 'box', size: [0.51, 0.008, 0.46], pos: [x1 - 0.65, 4.12 + k * 0.23, z0 - 0.5], color: 0x9a7a4a, ghost: true });
  // The tower too: its upper flights and landings are over whoever is on the lower ones.
  for (const p of props) if (inTower(p) && p.pos[1] > 0.6) p.fade = true;
  // The air conditioner, at the far end of the 6 m lift, its front to the street.
  const [ax, az] = [-94.2, 444.4];
  flat.cargo = [...flat.cargo, { type: 'aircon', pos: [ax, heights.at(ax, az) + 6.03 + 0.24, az], rotY: Math.PI / 2, found: true }];
}
