import type { Vec3 } from '../config';
import type { ObjectDesc, ObjectKindId } from './objects';
import type { Look, Relief } from './relief';
import { buildingMarks } from '../render/buildings';
import { HALL } from './harbourMarket';
import type { FordDesc, LevelDef, PropDesc, SignDesc, StillWaterDesc } from './types';

// Level 4's third place, the way up: out of the market's back door into the lane behind the cold stores, east along it,
// and up the neighbours' carport onto the roofs of the old houses that face it. On a typhoon afternoon:
//
//   the lane          flooded: the drain down to the sea can take nothing, its flap gate held shut by the tide, so the
//                     rain stands in the lane a foot deep, brown, and whatever was out in it floats. The cold stores'
//                     loading dock along the south, stacked with what they got in before the storm; the old one-storey
//                     houses along the north, sandbags at their doors, scooters in the water. The water holds the truck
//                     back; under it, where the drains' covers have been lifted off, the holes are open, a chair or a cone
//                     stood in each by the neighbours to show where. Midway, the power company's bucket truck at the
//                     pole whose transformer put the market's lights out: parked at the houses, its legs out, coned off,
//                     the way past it between its legs and the dock's edge.
//   the carport       at the row's east end, a sheet-metal carport over the side yard between the last house and the
//                     fishermen's net store, its posts at the front snapped: its front has come down on the lane, and it
//                     lies from there up to the roof between the two walls, the sheet sagged between its purlins.
//                     Turned into at the lane's end, a right angle, and climbed; at its top, still up, round onto the
//                     roofs (harbourRoofs.ts).
//
// The drain is water, and ends the run.

/** The lane: from the market's back door east to the fence at the end of the yard; the cold stores' backs along its south
 * (their loading dock out from their wall), the houses along its north. */
export const LANE = { x0: HALL.x1, x1: 114, z0: 336, z1: 343.5, wall: 330 };
/** The row of old houses, one storey: wall to wall from the drain to the carport, their roofs flat. */
export const ROW = { x0: 54, x1: 100.5, z0: 344, z1: 384, h: 3.7 };
/** The drain between the hall and the houses, down to the sea through the sea wall: railed off from the lane. */
const DRAIN = { x0: HALL.x1, x1: ROW.x0, z0: 343.2, z1: 384, h: -3.5 };
/** The cold stores' loading dock, from their wall out to the lane, at a lorry's bed height. */
const DOCK = { x0: HALL.x1 + 0.4, x1: 99, h: 1.2 };
/** The carport over the side yard at the row's east end: come down at its front onto the lane, up to the roof at `top`,
 * still up from there on. */
export const SHED = { x0: ROW.x1 + 0.05, x1: 107, z0: LANE.z1, top: 366.6, z1: ROW.z1 };
/** The fishermen's net store beyond the carport, from the lane to the sea wall: higher than the carport, its wall the carport's east side. */
const STORE = { x0: SHED.x1 + 0.05, x1: LANE.x1, z0: ROW.z0 - 0.4, h: 6.5 };
/** How high the flood stands over the lane. */
const FLOOD = 0.3;
/** Where the lane dips, at the pole the bucket truck is at: the low spot the water stands deepest in, twice as deep, the
 * truck all but afloat in it. Down from x0 to the bottom's start, level along it, up to x1. */
const LOW = { x0: 60, bottom: [65, 92] as [number, number], x1: 97, deep: 0.3 };
/** How high the lane's ground is at a place: down in the low spot, nought elsewhere. */
function floorAt(x: number, z: number): number {
  if (z < LANE.z0 || z > ROW.z0 || x <= LOW.x0 || x >= LOW.x1) return 0;
  const [b0, b1] = LOW.bottom;
  return -LOW.deep * (x < b0 ? (x - LOW.x0) / (b0 - LOW.x0) : x > b1 ? (LOW.x1 - x) / (LOW.x1 - b1) : 1);
}
/** The drains' openings whose covers the water lifted off: [x, z] of the middle of each, and the neighbours' mark in it. */
const HOLES: [number, number, ObjectKindId][] = [[47.5, 340.6, 'chair'], [53.5, 337.9, 'cone'], [58, 340.9, 'chair']];
/** Each one a cover's width across, a wheel's drop deep. */
const HOLE = 0.8, HOLE_DEEP = 0.5;
/** The bucket truck: its length along the lane, its middle across it, its width; the pole it is at. */
const WORKS = { x0: 68, x1: 76, z: 341.9, half: 1.15, pole: [71.6, 343.6] as [number, number] };
/** Its legs out either side, so far out from its middle, and where along it. */
const LEGS = { out: 1.7, at: [68.8, 73.6] };
/** The reefer lorry at the dock's end, the last of the cold stores' fish being got off it: along the dock, its back to the
 * bucket truck, its doors open. The way past it is on the houses' side: from between the bucket truck and the dock, across
 * the lane in the deep water, and then round into the carport. */
const REEFER = { x0: 90, x1: 97.4, z: LANE.z0 + 0.2 + 1.15 };
/** The purlins under the sheet, standing proud of it where it sags between: how far apart along the slope. */
const PURLINS = 1.5;
const SHEET = 0x4b7aa8, RIB = 0x416b98;
/** The polycarbonate sheets every carport and canopy here has among its steel ones, to let the light through: pale green. */
const LIGHT = 0xb9ddd4;
/** A roof's width in sheets, as they are laid side by side: every third a polycarbonate one. [from, to, colour] across X. */
function sheets(x0: number, x1: number): [number, number, number][] {
  const n = Math.max(1, Math.round((x1 - x0) / 0.9)), w = (x1 - x0) / n;
  return Array.from({ length: n }, (_, k) => [x0 + k * w, x0 + (k + 1) * w, k % 3 === 1 ? LIGHT : SHEET]);
}
const STEEL = 0x5f666c, DARK = 0x2a2c30;

export interface LaneParts {
  props: PropDesc[];
  objects: ObjectDesc[];
  fords: FordDesc[];
  stillWater: StillWaterDesc[];
  pools: NonNullable<LevelDef['pools']>;
  signs: SignDesc[];
}

export function lane(relief: Relief, looks: { ground: Look; water: Look }): LaneParts {
  const props: PropDesc[] = [];
  const objects: ObjectDesc[] = [];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, more: Partial<PropDesc> = {}) =>
    props.push({ shape: 'box', size: [Math.abs(x1 - x0) / 2, (y1 - y0) / 2, Math.abs(z1 - z0) / 2], pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color, ...more });
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, y = 0, more: Partial<ObjectDesc> = {}) => objects.push({ kind, pos: [x, y + floorAt(x, z), z], rotY, ...more });
  const rect = (x0: number, z0: number, x1: number, z1: number): [number, number][] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const rod = (a: Vec3, b: Vec3, r: number, color: number, more: Partial<PropDesc> = {}) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], long = Math.hypot(d[0], d[1], d[2]);
    props.push({ shape: 'cylinder', size: [r, long / 2, 0], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [0, Math.atan2(-d[2], d[0]), -Math.acos(d[1] / long)], color, ...more });
  };
  const line = (points: Vec3[], r: number, color: number) => { for (let k = 0; k + 1 < points.length; k++) rod(points[k], points[k + 1], r, color, { ghost: true }); };
  const stack = (kind: ObjectKindId, x: number, z: number, high: number, up: number, yaw = 0, y = 0) => {
    for (let h = 0; h < high; h++) object(kind, x, z, yaw + h * 0.04, y + h * up);
  };

  // The drain, its railing along the lane; where it goes through the sea wall, its flap gate shut against the sea.
  relief.area(rect(DRAIN.x0, DRAIN.z0, DRAIN.x1, DRAIN.z1), DRAIN.h, looks.water);
  box(DRAIN.x0 + 0.3, 0, DRAIN.z0 - 0.3, DRAIN.x1, 0.06, DRAIN.z0, 0x8a8c88);
  for (let x = DRAIN.x0 + 0.5; x <= DRAIN.x1 - 0.2; x += 1.9) box(x - 0.04, 0.06, DRAIN.z0 - 0.19, x + 0.04, 1.1, DRAIN.z0 - 0.11, STEEL);
  box(DRAIN.x0 + 0.3, 1.04, DRAIN.z0 - 0.2, DRAIN.x1, 1.12, DRAIN.z0 - 0.1, STEEL);
  box(DRAIN.x0 + 0.3, 0.55, DRAIN.z0 - 0.18, DRAIN.x1, 0.6, DRAIN.z0 - 0.12, STEEL);
  box(DRAIN.x0 + 2, DRAIN.h, DRAIN.z1 - 0.25, DRAIN.x1 - 2, 1.2, DRAIN.z1, 0x4f5a5e);

  // The flood: a foot of brown water over the lane from the dock to the houses, held in by the market's floor at one end
  // and the yard's fence at the other. It drags at the truck; what is light floats on it, toward the drain, slowly.
  // In the low spot, twice as deep: it holds the truck back the harder, and the tyres, the truck half afloat, hold less
  // against sliding sideways; anywhere it turns there, its tail swings out.
  const [b0, b1] = LOW.bottom;
  relief.area(rect(LOW.x0, LANE.z0, b0, ROW.z0), (x) => floorAt(x, LANE.z0 + 1), looks.ground);
  relief.area(rect(b0, LANE.z0, b1, ROW.z0), -LOW.deep, looks.ground);
  relief.area(rect(b1, LANE.z0, LOW.x1, ROW.z0), (x) => floorAt(x, LANE.z0 + 1), looks.ground);
  const fords: FordDesc[] = [
    { pos: [(b0 + b1) / 2, (LANE.z0 + LANE.z1) / 2], half: [(b1 - b0) / 2 + 1, (LANE.z1 - LANE.z0) / 2], flow: [0, 0], drag: 0.45, grip: 0.8, sideGrip: 0.45 },
    { pos: [(LANE.x0 + LANE.x1) / 2, (LANE.z0 + LANE.z1) / 2], half: [(LANE.x1 - LANE.x0) / 2, (LANE.z1 - LANE.z0) / 2], flow: [0, 0], drag: 0.3 },
  ];
  const stillWater: StillWaterDesc[] = [{ area: [LANE.x0, LANE.z0, LANE.x1, ROW.z0], surface: FLOOD, outlet: [DRAIN.x0 + 7, DRAIN.z0], drift: 0.25, muddy: true, shallow: true }];
  const tint = 0x9c9170;
  const pools: NonNullable<LevelDef['pools']> = [
    { area: [LANE.x0 + 0.05, LANE.z0, ROW.x0, DRAIN.z0 - 0.32], surface: FLOOD, tint, flow: [-0.08, 0.02], rain: true },
    { area: [ROW.x0, LANE.z0, LANE.x1, ROW.z0], surface: FLOOD, tint, flow: [-0.08, 0.02], rain: true },
  ];
  // The holes under it: a cover's width, a wheel's drop, its cover washed off beside it; the neighbours' mark stood in it.
  for (const [n, [x, z, mark]] of HOLES.entries()) {
    relief.area(rect(x - HOLE / 2, z - HOLE / 2, x + HOLE / 2, z + HOLE / 2), -HOLE_DEEP, looks.ground);
    object('manholeCover', x + 0.9 - (n % 2) * 1.8, z + 0.3, n);
    object(mark, x, z, n * 1.3);
  }

  // The loading dock: a lorry's bed high, its edge striped, rubber buffers along its face; the stores' roller doors in the
  // wall behind it, shut; along it what they got in before the storm, stacked at the doors, and some of it gone over the
  // edge into the water.
  box(DOCK.x0, 0, LANE.wall, DOCK.x1, DOCK.h, LANE.z0, 0x9a9c98);
  box(DOCK.x0, DOCK.h, LANE.z0 - 0.25, DOCK.x1, DOCK.h + 0.01, LANE.z0, 0xe0b020, { ghost: true });
  box(DOCK.x1, 0, LANE.wall, DOCK.x1 + 0.01, DOCK.h, LANE.z0, 0x868884, { ghost: true });
  for (let x = DOCK.x0 + 2.5; x < DOCK.x1 - 1; x += 3.5) box(x - 0.25, 0.3, LANE.z0, x + 0.25, 0.95, LANE.z0 + 0.12, DARK);
  for (const x of [47, 61, 75, 89]) {
    box(x - 2, DOCK.h, LANE.wall - 0.05, x + 2, DOCK.h + 3.4, LANE.wall + 0.05, 0xb8bcbe, { ghost: true });
    for (let y = DOCK.h + 0.3; y < DOCK.h + 3.4; y += 0.3) box(x - 2, y, LANE.wall + 0.05, x + 2, y + 0.03, LANE.wall + 0.07, 0x9a9ea2, { ghost: true });
    box(x - 2.2, DOCK.h + 3.4, LANE.wall, x + 2.2, DOCK.h + 3.7, LANE.wall + 0.3, 0x8a8e92, { ghost: true });
    // Its plate to bridge onto a lorry's bed, folded up.
    box(x - 1, DOCK.h, LANE.z0 - 0.75, x + 1, DOCK.h + 0.05, LANE.z0 - 0.27, 0x6a7078, { ghost: true });
  }
  const up = DOCK.h;
  for (const x of [42.5, 44]) stack('pallet', x, LANE.wall + 0.9, 5, 0.14, 0.05, up);
  stack('fishBox', 50, LANE.wall + 1, 4, 0.3, 0, up);
  stack('fishBox', 51, LANE.wall + 1.1, 3, 0.3, 0.2, up);
  stack('foamBox', 54.5, LANE.wall + 1, 5, 0.32, 0, up);
  stack('foamBox', 55.4, LANE.wall + 1.2, 4, 0.32, 0.3, up);
  stack('foamBox', 56.3, LANE.wall + 0.9, 5, 0.32, 0.1, up);
  object('crateTrolley', 58.5, LANE.wall + 2.4, Math.PI / 2 + 0.2, up);
  stack('fishBox', 65.5, LANE.wall + 1, 4, 0.3, 0, up);
  object('iceChest', 67, LANE.wall + 1.2, 0.1, up);
  stack('pallet', 70, LANE.wall + 0.9, 4, 0.14, 0, up);
  stack('foamBox', 80, LANE.wall + 1, 4, 0.32, 0, up);
  stack('fishBox', 82, LANE.wall + 1, 4, 0.3, 0, up);
  object('bin', 84, LANE.wall + 0.6, 0, up);
  object('bin', 84.8, LANE.wall + 0.6, 0, up);
  stack('pallet', 93, LANE.wall + 0.9, 6, 0.14, 0.1, up);
  // Out on the dock, waiting to go in: pallets of boxes of fish, the forklift that was moving them parked, a pallet truck.
  for (const [x, z] of [[46.5, 333.6], [72.5, 333.8], [87.5, 333.4]]) {
    object('pallet', x, z, 0, up);
    for (let k = 0; k < 4; k++) stack('fishBox', x - 0.4 + (k % 2) * 0.8, z - 0.27 + (k >> 1) * 0.55, 4, 0.3, 0, up + 0.14);
  }
  object('forklift', 63, 333.2, Math.PI / 2 + 0.3, up);
  stack('foamBox', 77, 332.8, 6, 0.32, 0.2, up);
  stack('foamBox', 77.8, 333.4, 5, 0.32, 0.5, up);
  object('crateTrolley', 96, LANE.wall + 1.4, 0.1, up);
  // Gone over into the water: boxes of polystyrene off the stack above, a few fish boxes, afloat at the dock's foot.
  for (const [x, z, yaw] of [[59.6, 336.6, 0.4], [61, 337.1, 1.2], [62.4, 336.5, 2.6], [63.7, 337.6, 0.9], [62, 338.3, 2]]) object('foamBox', x, z, yaw);
  for (const [x, z, yaw] of [[83.5, 336.5, 0.3], [85.4, 336.7, 1.4]]) object('fishBox', x, z, yaw);

  // The row: five houses of one storey, each its own front onto the lane, wall to wall.
  const width = (ROW.x1 - ROW.x0) / 5;
  const houses: PropDesc[] = [];
  for (let k = 0; k < 5; k++) {
    const x0 = ROW.x0 + k * width, x1 = x0 + width;
    const house: PropDesc = {
      shape: 'box', size: [width / 2, ROW.h / 2, (ROW.z1 - ROW.z0) / 2], pos: [(x0 + x1) / 2, ROW.h / 2, (ROW.z0 + ROW.z1) / 2], color: 0xd8cfbf, fade: true,
      building: { style: 'old', open: [k === 0, false, true, false], crown: 0, low: true, seed: 401 + k },
    };
    // The last, beside the carport: see-through only where the line to the truck really goes through its wall, below its
    // roof, not over its roof's edge.
    if (k === 4) house.fadeZone = [[x1 - 1.2, 0, ROW.z0], [x1 + 0.05, ROW.h - 0.3, SHED.top]];
    props.push(house);
    houses.push(house);
  }
  // At their fronts, in the water: scooters pulled in; sandbags across the doors; drums filled against the supply going;
  // pots off the step; a basin and buckets afloat; the eatery's gas, where its building says. None where the bucket truck is.
  const scooters = ['scooterRed', 'scooterWhite', 'scooterBlue', 'scooterBlack', 'scooterTeal', 'scooterYellow'] as ObjectKindId[];
  const front = ROW.z0 - 1.1;
  for (const [x0, n] of [[54.8, 2], [59.5, 3], [84.8, 3]]) for (let k = 0; k < n; k++) object(scooters[Math.round(x0 + k) % 6], x0 + k * 1.05, front, Math.PI);
  for (const [x0, n] of [[57.5, 2], [66.2, 3], [82.6, 2], [90.5, 3], [95.5, 3]]) for (let k = 0; k < n; k++) for (let h = 0; h < 2; h++) object('sandbag', x0 + k * 0.92 + h * 0.4, ROW.z0 - 0.3, 0, h * 0.28);
  for (const x of [70.8, 71.6, 94.6]) object('waterDrum', x, ROW.z0 - 0.5);
  for (const [x, kind] of [[65.6, 'flowerPotTall'], [66.4, 'flowerPotLow'], [88.9, 'flowerPotJar'], [89.7, 'flowerPotBloom']] as [number, ObjectKindId][]) object(kind, x, ROW.z0 - 0.45);
  for (const [x, z, kind] of [[51.5, 341.6, 'basin'], [63.9, 342.4, 'bucket'], [64.6, 341.7, 'bucket'], [88.8, 341.2, 'basin']] as [number, number, ObjectKindId][]) object(kind, x, z, x);
  // Not the last house's: its door is where the way turns into the carport, and a cylinder there would be in it.
  for (const house of houses) for (const mark of buildingMarks(house, house.building!)) if (mark.x < LOW.x1) object('gasCylinder', mark.x, Math.min(mark.z, ROW.z0 - 0.4));

  // The poles along the houses' fronts, their lines along the lane and off to each house; the one at the bucket truck with
  // its transformers, one of them burnt out.
  const poleTop = 8.5;
  const poles = [57.5, WORKS.pole[0], 91.5];
  const pz = WORKS.pole[1];
  for (const x of poles) {
    const foot = floorAt(x, pz);
    props.push({ shape: 'cylinder', size: [0.17, (poleTop - foot) / 2, 0], pos: [x, (poleTop + foot) / 2, pz], color: 0x8a8a84 });
    box(x - 0.06, poleTop - 0.6, pz - 0.9, x + 0.06, poleTop - 0.48, pz + 0.9, 0x5a5f66, { ghost: true });
    for (const dz of [-0.75, -0.25, 0.25, 0.75]) props.push({ shape: 'cylinder', size: [0.05, 0.08, 0], pos: [x, poleTop - 0.4, pz + dz], color: 0xe8e8e4, ghost: true });
    for (const dx of [-3, 3]) line(sag([x, poleTop - 1.5, pz], [x + dx, 3.4, ROW.z0 + 0.1], 0.4), 0.02, 0x1f2124);
  }
  for (let i = 0; i + 1 < poles.length; i++) for (const dz of [-0.75, -0.25, 0.25, 0.75]) line(sag([poles[i], poleTop - 0.3, pz + dz], [poles[i + 1], poleTop - 0.3, pz + dz], 0.7), 0.018, 0x1f2124);
  for (const [dz, burnt] of [[0.45, false], [-0.45, true]] as const) {
    props.push({ shape: 'cylinder', size: [0.32, 0.5, 0], pos: [WORKS.pole[0] - 0.45, poleTop - 2.4, pz + dz], color: burnt ? 0x3a3c3e : 0x7a8088, ghost: true });
    if (burnt) box(WORKS.pole[0] - 0.8, poleTop - 1.9, pz + dz - 0.33, WORKS.pole[0] - 0.1, poleTop - 1.6, pz + dz + 0.33, 0x1a1a1a, { ghost: true });
  }

  // The bucket truck: a small lorry, white, its band in the company's colours, the cab facing east; behind the cab the
  // boom's turret, the boom up over the houses' fronts to the pole, the bucket at its top with a lineman in it; its legs
  // out, the pads on boards. Coned off from the lane, a taper in at each end; its reel of cable stood behind it.
  {
    const first = props.length;
    const { x0, x1, z, half } = WORKS;
    const white = 0xf0eee8, band = 0x2f7f9a;
    box(x0, 0.45, z - half * 0.8, x1 - 0.03, 0.83, z + half * 0.8, DARK);
    box(x0, 0.85, z - half, x1 - 2.1, 1.05, z + half, 0xc8ccd0);
    for (const s of [-1, 1]) box(x0, 1.05, z + s * half - 0.04, x1 - 2.1, 1.35, z + s * half + 0.04, white, { ghost: true });
    box(x1 - 2.1, 0.66, z - half, x1, 2.6, z + half, white);
    box(x1 - 0.02, 1.75, z - half + 0.15, x1 + 0.01, 2.4, z + half - 0.15, 0x1b2a3a, { ghost: true });
    for (const s of [-1, 1]) {
      box(x1 - 1.4, 1.8, z + s * (half + 0.01) - 0.01, x1 - 0.2, 2.35, z + s * (half + 0.01) + 0.01, 0x1b2a3a, { ghost: true });
      box(x0, 0.95, z + s * (half + 0.02) - 0.02, x1, 1.05, z + s * (half + 0.02) + 0.02, band, { ghost: true });
      for (const wx of [x0 + 1.3, x1 - 1.3]) props.push({ shape: 'cylinder', size: [0.45, 0.14, 0], pos: [wx, 0.45, z + s * (half - 0.2)], rot: [Math.PI / 2, 0, 0], color: 0x17181a });
    }
    box(x1 - 1.6, 2.6, z - 0.2, x1 - 0.6, 2.72, z + 0.2, 0xffb030, { ghost: true });
    // The cab's front: its grille and lamps, its bumper; its mirrors out on arms.
    box(x1 + 0.005, 0.75, z - half + 0.1, x1 + 0.05, 1.35, z + half - 0.1, 0x9aa0a6, { ghost: true });
    for (const s of [-1, 1]) {
      box(x1 + 0.05, 1.05, z + s * (half - 0.35) - 0.2, x1 + 0.08, 1.25, z + s * (half - 0.35) + 0.2, 0xfff2c0, { ghost: true });
      box(x1 - 0.5, 1.9, z + s * (half + 0.05), x1 - 0.42, 2.3, z + s * (half + 0.25), DARK, { ghost: true });
    }
    box(x1 + 0.01, 0.5, z - half - 0.01, x1 + 0.12, 0.72, z + half + 0.01, DARK, { ghost: true });
    // Along both sides of the deck, the crew's lockers, grey, their doors marked; the rest for the boom over the tail.
    for (const s of [-1, 1]) {
      box(x0 + 0.3, 1.05, z + s * half - (s > 0 ? 0.55 : 0), x1 - 2.4, 1.75, z + s * half + (s < 0 ? 0.55 : 0), 0xc4c8cc);
      for (let x = x0 + 1.4; x < x1 - 2.5; x += 1.1) box(x - 0.01, 1.1, z + s * (half + 0.005) - 0.005, x + 0.01, 1.7, z + s * (half + 0.005) + 0.005, 0x8a9096, { ghost: true });
      box(x0 + 0.3, 1.75, z + s * half - (s > 0 ? 0.55 : 0), x1 - 2.4, 1.8, z + s * half + (s < 0 ? 0.55 : 0), 0x9aa0a6, { ghost: true });
    }
    box(x0 + 0.3, 1.05, z - 0.12, x0 + 0.55, 2.3, z + 0.12, 0x9aa0a6);
    box(x0 - 0.05, 0.3, z - half + 0.1, x0 + 0.05, 1.05, z + half - 0.1, DARK, { ghost: true });
    for (const s of [-1, 1]) box(x0 - 0.06, 0.75, z + s * (half - 0.3) - 0.15, x0, 0.95, z + s * (half - 0.3) + 0.15, 0xd0302a, { ghost: true });
    // The turret, the boom in two lengths up to the bucket, the bucket.
    const turret: Vec3 = [x1 - 2.9, 1.9, z], elbow: Vec3 = [x1 - 5.5, 5.6, z + 0.7], bucket: Vec3 = [WORKS.pole[0] + 0.7, poleTop - 2.2, pz - 0.9];
    props.push({ shape: 'cylinder', size: [0.6, 0.35, 0], pos: [turret[0], 1.4, z], color: 0xd8d6d0 });
    box(turret[0] - 0.4, 1.75, z - 0.35, turret[0] + 0.4, 2.15, z + 0.35, 0xe0b020, { ghost: true });
    line([turret, elbow], 0.2, 0xf2efe6);
    line([elbow, bucket], 0.15, 0xf2efe6);
    box(bucket[0] - 0.45, bucket[1] - 0.9, bucket[2] - 0.45, bucket[0] + 0.45, bucket[1] + 0.15, bucket[2] + 0.45, 0xf2c230, { ghost: true });
    box(bucket[0] - 0.2, bucket[1] + 0.15, bucket[2] - 0.15, bucket[0] + 0.2, bucket[1] + 0.75, bucket[2] + 0.15, 0xff7a1a, { ghost: true });
    props.push({ shape: 'sphere', size: [0.16, 0.16, 0.16], pos: [bucket[0], bucket[1] + 0.95, bucket[2]], color: 0xf2f2ee, ghost: true });
    // The legs: out from under the deck to either side, down onto their pads; the pads on boards.
    for (const x of LEGS.at) for (const s of [-1, 1]) {
      box(x - 0.18, 0.55, z + s * half * 0.5 - 0.15, x + 0.18, 0.8, z + s * LEGS.out, 0xe0b020);
      box(x - 0.12, 0.1, z + s * LEGS.out - 0.24, x + 0.12, 0.78, z + s * LEGS.out, 0xe0b020);
      box(x - 0.4, 0, z + s * LEGS.out - 0.4, x + 0.4, 0.1, z + s * LEGS.out + 0.1, 0x7a5a3a);
    }
    // The cones: a taper in from the houses at each end, a line along the truck's legs between.
    const edge = z - LEGS.out - 0.35;
    for (let x = x0 - 4; x <= x1 + 5.5; x += 1.6) {
      const taper = Math.max(0, Math.min(1, (x - (x0 - 4)) / 3.2, (x1 + 5.5 - x) / 3.2));
      object('cone', x, ROW.z0 - 0.9 - (ROW.z0 - 0.9 - edge) * taper);
    }
    object('signWarn', x0 - 5.5, ROW.z0 - 1.2, -Math.PI / 2);
    object('cableReel', x1 + 2.6, z + 0.3, Math.PI / 2);
    line([[x1 + 2.6, 0.6, z + 0.3], [x1 + 2, 3, pz], [WORKS.pole[0] + 0.2, poleTop - 1.6, pz]], 0.03, 0x111214);
    object('bucket', x1 + 1.2, z - 0.8, 0.4);
    // All of it stood down in the low spot.
    for (const p of props.slice(first)) p.pos[1] -= LOW.deep;
  }

  // The reefer lorry: white, its fridge unit over the cab humming; its back doors swung open at the dock, the boxes off
  // it stacked on the dock's edge beside them.
  {
    const { x0, x1, z } = REEFER, y = floorAt((x0 + x1) / 2, z);
    props.push({ shape: 'box', size: [1.15, 1.4, (x1 - x0) / 2], pos: [(x0 + x1) / 2, 0.2 + 1.4 + y, z], rot: [0, Math.PI / 2, 0], color: 0xf2efe6, vehicle: 'van' });
    box(x1 - 2.7, 2.6 + y, z - 0.75, x1 - 2.05, 3.25 + y, z + 0.75, 0xd8dcde, { ghost: true });
    for (let k = 0; k < 4; k++) box(x1 - 2.05, 2.7 + y + k * 0.13, z - 0.65, x1 - 2.03, 2.76 + y + k * 0.13, z + 0.65, 0x5a6068, { ghost: true });
    for (let k = 0; k < 6; k++) object('fishBox', x0 + 1.2 + (k % 3) * 0.75, LANE.z0 - 0.5, 0, up + Math.floor(k / 3) * 0.3);
  }

  // The carport, over the side yard between the house and the net store.
  const rise = ROW.h, run = SHED.top - SHED.z0, tilt = Math.atan2(rise, run), long = Math.hypot(rise, run);
  // A piece of the sheet as it lies on the slope, from x0 to x1 across and s0 to s1 along (metres up the slope from its
  // foot), raised by `lift` off the sheet, so thick.
  const onSlope = (x0: number, x1: number, s0: number, s1: number, lift: number, thick: number, color: number, more: Partial<PropDesc> = {}) => {
    const s = (s0 + s1) / 2, y = (s / long) * rise, z = SHED.z0 + (s / long) * run;
    const off = lift - thick / 2;
    props.push({ shape: 'box', size: [(x1 - x0) / 2, thick / 2, (s1 - s0) / 2], pos: [(x0 + x1) / 2, y + off * Math.cos(tilt), z - off * Math.sin(tilt)], rot: [-tilt, 0, 0], color, ...more });
  };
  onSlope(SHED.x0, SHED.x1, 0, long, 0, 0.1, SHEET);
  // As it looks: the sheet sagged between its purlins, bay by bay, its ribs down the slope bending with it; the purlins
  // under it, felt, where it rides up over them.
  const panel = (x0: number, x1: number, s0: number, s1: number, l0: number, l1: number, thick: number, color: number, more: Partial<PropDesc> = {}) => {
    const sm = (s0 + s1) / 2, lm = (l0 + l1) / 2 - thick / 2, a = tilt + Math.atan2(l1 - l0, s1 - s0);
    props.push({ shape: 'box', size: [(x1 - x0) / 2, thick / 2, Math.hypot(s1 - s0, l1 - l0) / 2], pos: [(x0 + x1) / 2, (sm / long) * rise + lm * Math.cos(tilt), SHED.z0 + (sm / long) * run - lm * Math.sin(tilt)], rot: [-a, 0, 0], color, ...more });
  };
  for (let s = 0; s < long - 0.01; s += PURLINS) {
    const s1 = Math.min(long, s + PURLINS), mid = (s + s1) / 2;
    for (const [a, b, l0, l1] of [[s, mid, 0.09, 0.02], [mid, s1, 0.02, 0.09]]) {
      for (const [sx0, sx1, color] of sheets(SHED.x0, SHED.x1)) panel(sx0, sx1, a, b, l0, l1, 0.02, color, { ghost: true });
      for (let x = SHED.x0 + 0.25; x < SHED.x1 - 0.1; x += 0.38) panel(x, x + 0.06, a, b, l0 + 0.03, l1 + 0.03, 0.03, RIB, { ghost: true });
    }
  }
  for (let s = PURLINS; s < long - 0.5; s += PURLINS) onSlope(SHED.x0, SHED.x1, s - 0.05, s + 0.05, 0.05, 0.05, SHEET, { wheelsOnly: true });
  // At its foot, where it hit the lane: its front edge crumpled under, its rafters' ends bent up out of it, its gutter
  // torn and bent, the beam that ran along its front lying across the foot.
  box(SHED.x0, 0, SHED.z0 - 0.35, SHED.x1, 0.14, SHED.z0 - 0.05, 0x9aa4ab, { rot: [0, 0.02, 0.04], ghost: true });
  for (const [x, w, yaw, roll] of [[101.2, 0.9, 0.3, 0.5], [102.6, 1.2, -0.2, -0.4], [104.4, 1, 0.5, 0.7], [105.9, 1.1, -0.4, -0.3]]) box(x - w / 2, 0.02, SHED.z0 - 0.7, x + w / 2, 0.06, SHED.z0 - 0.1, SHEET, { rot: [roll, yaw, roll * 0.5], ghost: true });
  for (let x = SHED.x0 + 0.4; x < SHED.x1; x += 2) box(x - 0.04, 0.05, SHED.z0 - 0.75, x + 0.04, 0.17, SHED.z0, 0x6a7078, { rot: [0.55, (x % 3) * 0.12 - 0.12, 0], ghost: true });
  box(SHED.x0 + 0.1, 0, SHED.z0 - 0.45, SHED.x1 - 0.1, 0.12, SHED.z0 - 0.3, 0x6a7078, { rot: [0, -0.015, 0], wheelsOnly: true });
  // Its sheet torn up from its edges in places, flapping up against the walls; what slid down it when it fell, caught in
  // its sags; its downpipe torn off the store's wall.
  for (const [sAt, side] of [[4.5, 1], [9.5, -1], [14, 1], [19, -1]] as const) {
    const sx = side > 0 ? SHED.x1 - 0.45 : SHED.x0 + 0.45, roll = side * 0.75;
    const y = (sAt / long) * rise, z = SHED.z0 + (sAt / long) * run;
    props.push({ shape: 'box', size: [0.5, 0.012, 0.65], pos: [sx, y + 0.42, z], rot: [-tilt, 0, roll], color: SHEET, ghost: true });
  }
  for (const [sAt, dx, kind] of [[6, -1.6, 'tyre'], [11.2, 1.2, 'bucket'], [16.5, -0.6, 'flowerPotTall'], [20.5, 1.8, 'tyre']] as [number, number, ObjectKindId][]) object(kind, (SHED.x0 + SHED.x1) / 2 + dx, SHED.z0 + (sAt / long) * run, sAt, (sAt / long) * rise + 0.05);
  rod([SHED.x1 + 0.02, ROW.h + 1.4, SHED.z0 + 9], [SHED.x1 - 0.5, 0.4, SHED.z0 + 4.5], 0.05, 0xb8bcc0, { ghost: true });
  // The half still up: its channel-steel beams along both walls, and the beam across where it broke, the sheet bent
  // over it.
  for (const x of [SHED.x0 + 0.05, SHED.x1 - 0.17]) box(x, ROW.h - 0.25, SHED.top - 0.2, x + 0.12, ROW.h + 0.14, SHED.z1 - 0.3, 0x6a7078, { ghost: true });
  box(SHED.x0 + 0.1, ROW.h, SHED.top - 0.06, SHED.x1 - 0.1, ROW.h + 0.06, SHED.top + 0.06, 0x6a7078, { wheelsOnly: true });
  // Where it broke, at the top: its rafters along the walls snapped there and sticking up out of the sheet.
  for (const x of [SHED.x0 + 0.25, SHED.x1 - 0.35]) rod([x, ROW.h - 0.05, SHED.top - 0.1], [x + 0.1, ROW.h + 0.75, SHED.top - 0.75], 0.06, 0x6a7078, { ghost: true });
  // Under it, what it came down on: a scooter crushed flat at one corner, a washing machine knocked over at the other.
  object('scooterBlue', SHED.x1 - 0.9, SHED.z0 - 1.3, 1.4, 0.4, { roll: Math.PI / 2 });
  object('washingMachine', SHED.x0 + 0.9, SHED.z0 - 1.2, 0.4, 0.32, { tilt: 1.3 });
  // The part still up: the sheet from the slope's top to its back, flat at the roofs' height; its posts along the yard.
  box(SHED.x0, ROW.h - 0.1, SHED.top, SHED.x1, ROW.h, SHED.z1, SHEET);
  for (const [sx0, sx1, color] of sheets(SHED.x0, SHED.x1)) if (color === LIGHT) box(sx0, ROW.h, SHED.top, sx1, ROW.h + 0.008, SHED.z1, LIGHT, { ghost: true });
  for (let x = SHED.x0 + 0.25; x < SHED.x1 - 0.1; x += 0.38) box(x, ROW.h, SHED.top, x + 0.06, ROW.h + 0.03, SHED.z1, RIB, { ghost: true });
  for (let z = SHED.top + 0.5; z <= SHED.z1; z += 4.7) box(SHED.x1 - 0.2, 0, z - 0.06, SHED.x1 - 0.08, ROW.h - 0.1, z + 0.06, 0x6a7078);
  // The posts that held its front, channel steel, snapped off at the knee: their stubs at its front corners, bent, their
  // tops leant against the walls either side where they were thrown.
  for (const [x, lean] of [[SHED.x0 + 0.12, 0.25], [SHED.x1 - 0.14, -0.3]]) {
    box(x - 0.08, 0, SHED.z0 - 0.05, x + 0.08, 0.9, SHED.z0 + 0.06, 0x6a7078);
    box(x - 0.08, 0.85, SHED.z0 - 0.05, x + 0.08, 1.15, SHED.z0 + 0.06, 0x5a6068, { rot: [0.5, 0, lean], ghost: true });
  }
  rod([SHED.x1 + 0.5, 0.05, SHED.z0 - 2.6], [SHED.x1 + 0.2, 1.8, STORE.z0 - 0.1], 0.08, 0x6a7078, { ghost: true });
  rod([SHED.x0 - 1.4, 0.05, SHED.z0 - 2.2], [SHED.x0 - 0.9, 1.9, ROW.z0 - 0.1], 0.08, 0x6a7078, { ghost: true });
  // The net store: sheet metal, higher than the carport, its doors onto the lane; what would not go in stacked against
  // the yard's fence at the lane's end, under tarpaulins, the floats in heaps.
  props.push({ shape: 'box', size: [(STORE.x1 - STORE.x0) / 2, STORE.h / 2, (ROW.z1 - STORE.z0) / 2], pos: [(STORE.x0 + STORE.x1) / 2, STORE.h / 2, (STORE.z0 + ROW.z1) / 2], color: 0x7f8e98, fade: true, building: { style: 'shed', open: [false, false, true, false], crown: 0, seed: 409 } });
  // Its own name over its door, over the board the shed is drawn with.
  // Out on brackets in front of the eaves of the end over the doors, so as to stand clear of the roof's overhang.
  const signs: SignDesc[] = [{ kind: 'name', text: '協進漁網倉庫', colors: ['#1f4f9a', '#f2efe6', '#f2efe6'], wide: 6.3, pos: [(STORE.x0 + STORE.x1) / 2, 5.65, STORE.z0 - 0.6], rotY: Math.PI }];
  // The carport's own signs, as every garage here has: no parking, the way in for cars. Flat on the walls either side
  // of its mouth, the store's facing down the lane at whoever comes along it. Its folding gate, folded back against the store's wall when the
  // storm came, bent where the carport's front came down on it, its rail across the foot.
  signs.push({ kind: 'name', text: '車庫出入口　請勿停車', colors: ['#c8262a', '#f2efe6', '#f2efe6'], wide: 2.6, pos: [ROW.x1 + 0.08, 1.9, SHED.z0 + 2.4], rotY: Math.PI / 2 });
  signs.push({ kind: 'name', text: '車庫出入口　請勿停車', colors: ['#c8262a', '#f2efe6', '#f2efe6'], wide: 2.6, pos: [STORE.x0 - 0.06, 2.1, SHED.z0 + 3.4], rotY: -Math.PI / 2 });
  {
    const gx = SHED.x1 - 0.16, gz0 = SHED.z0 + 0.3, gz1 = gz0 + 1.6;
    box(gx - 0.1, 0, gz0, gx + 0.1, 1.65, gz1, 0x6a7078);
    for (let z = gz0 + 0.1; z < gz1; z += 0.16) box(gx - 0.13, 0.1, z, gx + 0.13, 1.6, z + 0.03, 0xb8bcc0, { ghost: true, rot: [0.12 * ((Math.round(z * 6) % 2) * 2 - 1), 0, 0] });
    box(gx - 0.15, 1.66, gz0 - 0.1, gx + 0.15, 1.8, gz0 + 0.25, 0xc8a02a, { ghost: true });
    box(SHED.x0 + 0.2, 0, SHED.z0 - 0.08, SHED.x1 - 0.2, 0.05, SHED.z0 + 0.02, 0x8a9096, { ghost: true });
  }
  for (const dx of [-2.2, 2.2]) for (const y of [5.25, 6.05]) box((STORE.x0 + STORE.x1) / 2 + dx - 0.03, y - 0.03, STORE.z0 - 0.58, (STORE.x0 + STORE.x1) / 2 + dx + 0.03, y + 0.03, STORE.z0, 0x4a4f57, { ghost: true });
  for (const z of [334, 338.5]) object('tarpHeap', LANE.x1 - 1.2, z, Math.PI / 2);
  object('netHeap', LANE.x1 - 1.3, 342, 0.4);
  for (let k = 0; k < 8; k++) object('buoy', LANE.x1 - 0.5 - (k % 2) * 0.45, 331.2 + Math.floor(k / 2) * 0.45);
  // Its sheets torn off and blown about the lane's end.
  for (const [x, z, yaw] of [[103, 337.2, 0.4], [101.8, 340.9, 1.9], [106.4, 338.6, 0.9], [108.2, 341.4, 2.6]]) object('tinSheet', x, z, yaw);

  // The store's own canopy over its doors, of the same blue sheet on the same steel posts as the carport next to it, and
  // still standing: what the carport was.
  {
    const z0 = STORE.z0 - 4.2, z1 = STORE.z0, x0 = STORE.x0 + 0.3, x1 = LANE.x1 - 0.3, low = 2.9, high = 3.3;
    const fall = Math.atan2(high - low, z1 - z0);
    for (const x of [x0 + 0.9, (x0 + x1) / 2, x1 - 0.2]) box(x - 0.08, 0, z0 + 0.2, x + 0.08, low - 0.02, z0 + 0.32, 0x6a7078);
    box(x0, low - 0.18, z0 + 0.18, x1, low - 0.02, z0 + 0.34, 0x6a7078, { ghost: true });
    for (const [sx0, sx1, color] of sheets(x0, x1)) props.push({ shape: 'box', size: [(sx1 - sx0) / 2, 0.04, Math.hypot(z1 - z0, high - low) / 2], pos: [(sx0 + sx1) / 2, (low + high) / 2, (z0 + z1) / 2], rot: [-fall, 0, 0], color, ghost: true });
    for (let x = x0 + 0.2; x < x1; x += 0.38) props.push({ shape: 'box', size: [0.03, 0.02, Math.hypot(z1 - z0, high - low) / 2], pos: [x, (low + high) / 2 + 0.05, (z0 + z1) / 2], rot: [-fall, 0, 0], color: RIB, ghost: true });
    box(x0, low - 0.25, z0 - 0.15, x1, low - 0.05, z0 + 0.05, 0x9aa4ab, { ghost: true });
  }

  // The lane's end: a reefer container along the cold stores' wall past the dock, plugged in to keep their overflow
  // frozen through the storm, its machinery end to the lane.
  {
    const cx0 = DOCK.x1 + 3.5, cx1 = cx0 + 6.06, cz0 = LANE.wall + 0.3, cz1 = cz0 + 2.44;
    box(cx0, 0.15, cz0, cx1, 2.75, cz1, 0xf2f0ea);
    for (let x = cx0 + 0.3; x < cx1 - 0.2; x += 0.3) box(x, 0.2, cz1, x + 0.06, 2.7, cz1 + 0.03, 0xdcdad4, { ghost: true });
    box(cx0 - 0.04, 0.4, cz0 + 0.2, cx0, 2.5, cz1 - 0.2, 0x8a9096, { ghost: true });
    for (const x of [cx0 + 0.6, cx1 - 0.6]) box(x - 0.2, 0, cz0 - 0.1, x + 0.2, 0.15, cz1 + 0.1, DARK);
    line([[cx0, 1.4, cz0 + 0.4], [cx0 - 0.6, 0.05, cz0 + 0.3], [cx0 - 1.4, 0.05, LANE.wall + 0.15], [cx0 - 1.4, 1.6, LANE.wall + 0.05]], 0.03, 0x111214);
  }

  return { props, objects, fords, stillWater, pools, signs };
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
