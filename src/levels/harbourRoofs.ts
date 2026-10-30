import type { Vec3 } from '../config';
import type { ObjectDesc, ObjectKindId } from './objects';
import { EAVE, HALL } from './harbourMarket';
import { GABLE, RISE } from './harbourMarketRoof';
import { ROW, SHED } from './harbourLane';
import type { GustDesc, PropDesc, SignDesc, Vec2 } from './types';

// Level 4's third place, its middle: over the open roofs of the row of old houses behind the cold stores, from the top of
// the fallen carport at the row's east end west to the market's eaves. Nobody's road: five households' roofs, each walled
// from the next by its low party wall, and on each what a household here keeps on its roof. The way over is wherever the
// storm has knocked the walls down, and between what stands on the roofs:
//
//   ①  over the top of the carport and round to the west: its water tower and solar heaters out on the turn's far side,
//      its aerial down across the way; the party wall to ② down in one place
//   ②  where the washing is done: a pole of sheets out across the way, the machine and the trough by the wall; then up
//      onto ③, whose roof was raised when it was rebuilt, 0.8 m higher, by the roof of ③'s rooftop room, blown off and
//      lying from ③ down onto ②
//   ③  the room's ruin, its furniture out in the rain; down the diagonal past its greens under their shade netting; the
//      party wall to ④ down for a length, ③'s water tower fallen across the gap, a way past it either side
//   ④  raised too: its stairhead, sandbagged; its altar to Heaven out on the far side of the turn back to the west; the
//      corner of its parapet come down onto ⑤ in a heap of brick, the way down
//   ⑤  between its rooftop room and its lean-to, the narrowest place, to the billboard
//   the billboard   that stood on ⑤'s roof, blown down across the drain onto the market's eaves face up: the way over, its
//                   two sides open to the drain, the wind out of the sea down the drain's slot across it
//
// The front parapet runs the length of the row; where it is broken, off is down into the lane: the load hurt, and round
// by the carport again. Off the billboard is into the drain, and the end.

/** The houses, east to west, ① to ⑤: from and to on X. */
const HOUSES: [number, number][] = [0, 1, 2, 3, 4].map((k) => [ROW.x1 - (k + 1) * ((ROW.x1 - ROW.x0) / 5), ROW.x1 - k * ((ROW.x1 - ROW.x0) / 5)]);
const TOP = ROW.h;
/** ③ and ④ rebuilt with their roofs so much higher than their neighbours'. */
const RAISED = 0.8;
const RAISED_X: [number, number] = [HOUSES[3][0], HOUSES[2][1]];
/** How high the roof is at a place. */
function roofAt(x: number): number {
  return TOP + (x >= RAISED_X[0] && x < RAISED_X[1] ? RAISED : 0);
}
const PARAPET = 0.9, PARAPET_THICK = 0.25, WALL = 0.9, WALL_THICK = 0.25;
const D = Math.PI / 180;

/**
 * The way over, as the truck goes, as a turtle walks it: up the carport and round to the west (as tight as the truck turns),
 * on west through the gap into ② and up the ruin's roof onto ③; round to the south-west and down the diagonal across ③
 * and ④ through the fallen tower's gap; round to the west again, down the heap of brick onto ⑤, and on to the billboard.
 * Each step: go so far, or turn so far (left negative) on so tight a radius.
 */
type Step = ['go', number] | ['turn', number, number];
const TURTLE: Step[] = [['go', 4], ['turn', 8, -90], ['go', 13.875], ['turn', 10, -40], ['go', 11.8], ['turn', 10, 40]];
const START: [number, number, number] = [(SHED.x0 + SHED.x1) / 2, SHED.top - 4, 0];
/** Every 0.2 m along it: where, and which way it heads (yaw: 0 north, -90° west). */
const PATH: { x: number; z: number; h: number }[] = (() => {
  const out = [{ x: START[0], z: START[1], h: START[2] }];
  let { x, z, h } = out[0];
  for (const step of TURTLE) {
    const long = step[0] === 'go' ? step[1] : step[1] * Math.abs(step[2]) * D;
    const n = Math.ceil(long / 0.2);
    for (let i = 0; i < n; i++) {
      if (step[0] === 'turn') h += (Math.sign(step[2]) * long) / n / step[1];
      x += Math.sin(h) * (long / n);
      z += Math.cos(h) * (long / n);
      out.push({ x, z, h });
    }
  }
  // On west to the billboard's foot.
  while (x > 57.6) out.push({ x: (x -= 0.2), z, h });
  return out;
})();
/** Where along the way it crosses x, going west: its point and heading. */
function crossing(x: number): { x: number; z: number; h: number; k: number } {
  const k = PATH.findIndex((p, i) => i > 0 && PATH[i - 1].x >= x && p.x < x);
  return { ...PATH[k], k };
}
/** So far to the right of the way (north, going west) from a point of it. */
function aside(k: number, right: number): Vec2 {
  const p = PATH[Math.max(0, Math.min(PATH.length - 1, k))];
  return [p.x + Math.cos(p.h) * right, p.z - Math.sin(p.h) * right];
}
/** Where the way crosses each wall: into ②, onto ③, past the fallen tower into ④, down onto ⑤. */
const INTO_2 = crossing(HOUSES[0][0]);
const ONTO_3 = crossing(HOUSES[1][0]);
const INTO_4 = crossing(HOUSES[2][0]);
const ONTO_5 = crossing(HOUSES[3][0]);
/** The ruin's roof, the way up: so long, so wide. */
const RAMP = { long: 5.9, wide: 6 };
/** The gap in the wall between ③ and ④, and the fallen tower in it: each passage either side of the tower, along the wall, and half the tower's. */
const TOWER_HALF = 1.4;
/** How far either side of the way the ways past the tower run, their middles. */
const FORK_OFF = 4.2;
/** How far a broken wall's stub stands out into its gap. */
const STUB = 0.5;
/** The heap of brick down onto ⑤: how far it runs out, how wide. */
const HEAP = { long: 4.6, wide: 6.4 };
/** ⑤'s narrow way: its room's front and its lean-to's posts, either side of the way. */
const NARROW = { north: PATH[PATH.length - 1].z + 2.45, south: PATH[PATH.length - 1].z - 2.45 };
/** The billboard: the middle of its foot on ⑤'s roof, and of its top on the market's roof; which way it lies, how wide it is. */
const BILLBOARD_BASE: Vec2 = [57.6, PATH[PATH.length - 1].z];
const BILLBOARD_YAW = 10 * D;
const BILLBOARD_TOP_X = HALL.x1 - 1.5;
const BILLBOARD_WIDE = 5.2;

export const ROOF_WAY: Vec2[] = PATH.filter((_, i) => i % 5 === 0).map((p) => [p.x, p.z]);
/** The two ways past the fallen tower: the way, bent out so far to its right, or its left, round the tower. */
export const ROOF_FORKS: Vec2[][] = [1, -1].map((side) => PATH.filter((_, i) => i % 5 === 0).map((_, i) => {
  const k = i * 5, d = Math.abs(k - INTO_4.k) * 0.2;
  // Full out for 3 m either side of the tower, easing back over 7 m more.
  const bend = side * FORK_OFF * (d < 3 ? 1 : d > 10 ? 0 : (1 + Math.cos(((d - 3) / 7) * Math.PI)) / 2);
  return aside(k, bend);
}));
/** How far out from the way's middle the way reaches either side, at a place: in ⑤'s narrow way, less. */
export const ROOF_HALF = (x: number) => (x < HOUSES[3][0] && x > HOUSES[4][0] ? 2.35 : 2.6);
/** Places along it to start from in testing: the carport's top; the way into ②; before the fallen tower; ⑤; the billboard's top. */
export const ROOF_SPOTS = {
  top: [START[0], SHED.top + 2, 0] as [number, number, number],
  ramp: [INTO_2.x - 1, INTO_2.z, INTO_2.h] as [number, number, number],
  diagonal: [PATH[INTO_4.k - 40].x, PATH[INTO_4.k - 40].z, PATH[INTO_4.k - 40].h] as [number, number, number],
  front: [ONTO_5.x - 1, PATH[PATH.length - 1].z, -Math.PI / 2] as [number, number, number],
  over: [BILLBOARD_TOP_X, BILLBOARD_BASE[1] + Math.tan(BILLBOARD_YAW) * (BILLBOARD_BASE[0] - BILLBOARD_TOP_X)] as Vec2,
};
/** How high the roof is at each of those, for setting the truck down there. */
export const ROOF_AT = roofAt;

/** What stands solid on the roofs, for testing: [x0, z0, x1, z1, whether it stands out into the way on purpose]. */
export const ROOF_ROOMS: [number, number, number, number, boolean][] = [];

export interface RoofParts {
  props: PropDesc[];
  objects: ObjectDesc[];
  gusts: GustDesc[];
  signs: SignDesc[];
}

export function roofs(): RoofParts {
  const props: PropDesc[] = [];
  const objects: ObjectDesc[] = [];
  ROOF_ROOMS.length = 0;
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, more: Partial<PropDesc> = {}) =>
    props.push({ shape: 'box', size: [Math.abs(x1 - x0) / 2, (y1 - y0) / 2, Math.abs(z1 - z0) / 2], pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color, ...more });
  /** Something solid on a roof, noted for testing. */
  const solid = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, more: Partial<PropDesc> = {}, into = false) => {
    box(x0, y0, z0, x1, y1, z1, color, more);
    ROOF_ROOMS.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), into]);
  };
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, y = 0, more: Partial<ObjectDesc> = {}) => objects.push({ kind, pos: [x, roofAt(x) + y, z], rotY, ...more });
  const near = (kind: ObjectKindId, k: number, right: number, rotY = 0, y = 0) => object(kind, ...aside(k, right), rotY, y);
  const rod = (a: Vec3, b: Vec3, r: number, color: number, more: Partial<PropDesc> = {}) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], long = Math.hypot(d[0], d[1], d[2]);
    props.push({ shape: 'cylinder', size: [r, long / 2, 0], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [0, Math.atan2(-d[2], d[0]), -Math.acos(d[1] / long)], color, ...more });
  };
  /** A brick wall along Z at x, from z0 to z1, on the roof there; where it is broken off, a stub lower and its bricks about. */
  const BRICK = 0xc9b8a0, CAP = 0xb4a690;
  const wallZ = (x: number, z0: number, z1: number, high = WALL, ragged: [boolean, boolean] = [false, false]) => {
    if (z1 - z0 < 0.2) return;
    const y = roofAt(x);
    solid(x - WALL_THICK / 2, y, z0, x + WALL_THICK / 2, y + high, z1, BRICK);
    box(x - WALL_THICK / 2 - 0.03, y + high, z0, x + WALL_THICK / 2 + 0.03, y + high + 0.06, z1, CAP, { ghost: true });
    ragged.forEach((on, end) => {
      if (!on) return;
      const zs = end ? z1 : z0, dir = end ? 1 : -1;
      box(x - WALL_THICK / 2, y, Math.min(zs, zs + dir * STUB), x + WALL_THICK / 2, y + high * 0.45, Math.max(zs, zs + dir * STUB), BRICK);
      for (let k = 0; k < 3; k++) object('brickRubble', x + (k % 2 ? 0.7 : -0.7), zs + dir * (0.9 + k * 0.5), k * 0.9);
    });
  };
  const wallX = (z: number, x0: number, x1: number, y: number, high = PARAPET) => {
    solid(x0, y, z - PARAPET_THICK / 2, x1, y + high, z + PARAPET_THICK / 2, 0xcfc6b4);
    box(x0, y + high, z - PARAPET_THICK / 2 - 0.03, x1, y + high + 0.06, z + PARAPET_THICK / 2 + 0.03, CAP, { ghost: true });
  };

  // ③ and ④'s raised roofs: a slab over both, its front over the lane a band above the neighbours' fronts.
  box(RAISED_X[0], TOP, ROW.z0, RAISED_X[1], TOP + RAISED, ROW.z1, 0xb9b3a6);
  for (const x of RAISED_X) box(x - 0.04, TOP + RAISED - 0.12, ROW.z0 - 0.04, x + 0.04, TOP + RAISED, ROW.z1, 0xa8a294, { ghost: true });

  // The front parapet, the row's length, each house's on its roof; broken in front of ③'s greens and in front of ⑤.
  const front = ROW.z0 + PARAPET_THICK / 2;
  const brokenFront: [number, number][] = [[55.2, 57.4], [75, 78.2]];
  let fx = ROW.x0;
  const frontRun = (x0: number, x1: number) => {
    // Split where the roof steps up or down.
    const cuts = [x0, ...RAISED_X.filter((c) => c > x0 && c < x1), x1];
    for (let i = 0; i + 1 < cuts.length; i++) wallX(front, cuts[i], cuts[i + 1], roofAt((cuts[i] + cuts[i + 1]) / 2));
  };
  for (const [b0, b1] of brokenFront) {
    frontRun(fx, b0);
    box(b0, roofAt(b0), ROW.z0, b0 + 0.4, roofAt(b0) + 0.35, ROW.z0 + PARAPET_THICK, 0xcfc6b4);
    box(b1 - 0.3, roofAt(b1 - 0.3), ROW.z0, b1, roofAt(b1 - 0.3) + 0.5, ROW.z0 + PARAPET_THICK, 0xcfc6b4);
    for (let k = 0; k < 3; k++) object('brickRubble', b0 + 0.5 + k * 0.8, ROW.z0 + 0.9 + (k % 2) * 0.5, k);
    fx = b1;
  }
  frontRun(fx, ROW.x1);
  // Along the east over the carport's slope; along the west over the drain, but where the billboard lies across it.
  box(ROW.x1 - PARAPET_THICK, TOP, ROW.z0 + PARAPET_THICK, ROW.x1, TOP + PARAPET, SHED.top, 0xcfc6b4);
  const crushed = [BILLBOARD_BASE[1] - BILLBOARD_WIDE / 2 - 0.4, BILLBOARD_BASE[1] + BILLBOARD_WIDE / 2 + Math.tan(BILLBOARD_YAW) * (BILLBOARD_BASE[0] - ROW.x0) + 0.4];
  solid(ROW.x0, TOP, ROW.z0 + PARAPET_THICK, ROW.x0 + PARAPET_THICK, TOP + PARAPET, crushed[0], 0xcfc6b4);
  solid(ROW.x0, TOP, crushed[1], ROW.x0 + PARAPET_THICK, TOP + PARAPET, ROW.z1, 0xcfc6b4);

  // ①|② party wall, down where the way goes through.
  const into2 = 2.4 + STUB;
  wallZ(HOUSES[0][0], ROW.z0 + PARAPET_THICK, INTO_2.z - into2, WALL, [false, true]);
  wallZ(HOUSES[0][0], INTO_2.z + into2, ROW.z1, WALL, [true, false]);
  // ③'s parapet along its edge over ②, but where the ruin's roof came down over it.
  wallZ(HOUSES[1][0] - 0.15, ROW.z0 + PARAPET_THICK, ONTO_3.z - RAMP.wide / 2 - 0.2, PARAPET, [false, true]);
  wallZ(HOUSES[1][0] - 0.15, ONTO_3.z + RAMP.wide / 2 + 0.2, ROW.z1, PARAPET, [true, false]);
  // ③|④ party wall, down for a length; ③'s tower fallen across the gap.
  const across = Math.abs(Math.sin(INTO_4.h)) || 1;
  const gap = (FORK_OFF + 1.3 + 0.45) / across + STUB;
  wallZ(HOUSES[2][0], ROW.z0 + PARAPET_THICK, INTO_4.z - gap, WALL, [false, true]);
  wallZ(HOUSES[2][0], INTO_4.z + gap, ROW.z1, WALL, [true, false]);
  // ④'s parapet along its edge over ⑤, but where its corner came down in a heap.
  wallZ(HOUSES[3][0] + 0.15, ROW.z0 + PARAPET_THICK, ONTO_5.z - HEAP.wide / 2, PARAPET, [false, true]);
  wallZ(HOUSES[3][0] + 0.15, ONTO_5.z + HEAP.wide / 2, ROW.z1, PARAPET, [true, false]);

  // ①. Its water tower on the turn's far side, the solar heaters in front of it facing south: a turn taken too wide goes
  // into them, and too wide again, into the tower. Its aerial blown down across the way to the gap. Its bicycle over on
  // its side, its pots, out of the way inside the turn.
  const tower = (x0: number, z0: number, x1: number, z1: number, stand: number, tanks: number) => {
    const y = roofAt((x0 + x1) / 2);
    for (const [lx, lz] of [[x0, z0], [x1 - 0.12, z0], [x0, z1 - 0.12], [x1 - 0.12, z1 - 0.12]]) solid(lx, y, lz, lx + 0.12, y + stand, lz + 0.12, 0x6a7078);
    box(x0, y + stand - 0.12, z0, x1, y + stand, z1, 0x5a6068);
    for (const [a, b] of [[[x0, z0], [x1, z0]], [[x0, z1], [x1, z1]]] as const) {
      rod([a[0], y + 0.2, a[1] + 0.06], [b[0], y + stand - 0.2, b[1] + 0.06], 0.03, 0x6a7078, { ghost: true });
      rod([b[0], y + 0.2, b[1] + 0.06], [a[0], y + stand - 0.2, a[1] + 0.06], 0.03, 0x6a7078, { ghost: true });
    }
    const radius = tanks === 2 ? 0.85 : 0.95, cz = (z0 + z1) / 2;
    for (const cx of tanks === 2 ? [x0 + 0.95, x1 - 0.95] : [(x0 + x1) / 2]) {
      props.push({ shape: 'cylinder', size: [radius, 0.95, 0], pos: [cx, y + stand + 0.95, cz], color: 0xc3cace });
      props.push({ shape: 'cylinder', size: [0.3, 0.06, 0], pos: [cx, y + stand + 1.96, cz], color: 0x9aa2a8, ghost: true });
      for (const hy of [0.45, 1.45]) props.push({ shape: 'cylinder', size: [radius + 0.02, 0.025, 0], pos: [cx, y + stand + hy, cz], color: 0xaab2b8, ghost: true });
      // Lashed down against the wind.
      for (const side of [-1, 1]) rod([cx + side * radius, y + stand + 1.8, cz], [cx + side * (radius + 0.6), y + stand, cz + 0.3], 0.012, 0xd8c070, { ghost: true });
    }
  };
  tower(92, 380, 95.8, 383.5, 1.8, 2);
  for (const [hx, hz] of [[98.9, 377.6], [96.6, 378.7]]) object('solarHeater', hx, hz, Math.PI + (hx - 98) * 0.08);
  object('tvAntenna', 93, INTO_2.z - 0.4, 0.35);
  props.push({ shape: 'cylinder', size: [0.04, 0.6, 0], pos: [91.75, TOP + 0.6, INTO_2.z - 3.3], color: 0x8e9499 });
  for (const [px, pz, kind] of [[99.6, 367.4, 'flowerPotTall'], [99.8, 368.3, 'flowerPotJar'], [99.5, 369.3, 'flowerPotLow'], [96, 366.4, 'waterDrum']] as [number, number, ObjectKindId][]) object(kind, px, pz);
  // Its front half, open to the lane: its stands of plants against the parapet, the pots too big to take in, its dish.
  object('plantStand', 96.5, ROW.z0 + 0.6);
  object('plantStand', 93.4, ROW.z0 + 0.6);
  for (const [px, kind] of [[98.4, 'flowerPotTall'], [91.9, 'flowerPotJar'], [95, 'flowerPotBloom']] as [number, ObjectKindId][]) object(kind, px, ROW.z0 + 0.7);
  object('satelliteDish', 99.2, 357.5, Math.PI * 0.8);

  // ②. Where the washing is done: its washing pole blown over across the way, the sheets that were left on it under it,
  // a rack of clothes over beside it; the machines, the trough and the mop in their corner by the wall to the north under
  // their bit of sheet roof.
  {
    const k = INTO_2.k + 13;
    object('laundryPole', ...aside(k, 0.3), Math.PI / 2 + 0.12, 0.46, { tilt: Math.PI / 2 });
    object('clothesRack', ...aside(k + 12, -3.4), 0.2, 0.26, { tilt: -Math.PI / 2 });
    const cx0 = INTO_2.x - 5.8, cx1 = INTO_2.x - 0.5, cz = INTO_2.z + 3.6;
    for (const px of [cx0, cx1]) solid(px - 0.05, TOP, cz - 0.05, px + 0.05, TOP + 2.2, cz + 0.05, 0x6a7078);
    box(cx0 - 0.2, TOP + 2.2, cz - 0.3, cx1 + 0.2, TOP + 2.26, ROW.z1 - 0.3, 0x9aa4ab, { rot: [-0.06, 0, 0], ghost: true, fade: true, overhead: true });
    for (let x = cx0; x < cx1; x += 0.35) box(x, TOP + 2.27, cz - 0.3, x + 0.05, TOP + 2.3, ROW.z1 - 0.3, 0x8a949b, { rot: [-0.06, 0, 0], ghost: true, fade: true, overhead: true });
    for (const [kind, dx, dz, yaw] of [['washingMachine', -1.4, 4.6, Math.PI], ['washingMachine', -2.3, 4.6, Math.PI], ['laundryTub', -3.8, 4.7, Math.PI], ['mopBucket', -5, 4.4, 0], ['basin', -1.2, 3.7, 0], ['basin', -4.6, 3.8, 1]] as [ObjectKindId, number, number, number][]) object(kind, INTO_2.x + dx, INTO_2.z + dz, yaw);
    for (const [bx, bz] of [[89.4, 360.2], [84, 357.4]]) object('waterDrum', bx, bz);
    object('plantStand', 86.6, ROW.z0 + 0.6);
  }
  // The roof of ③'s rooftop room, blown off its walls and come down over ③'s parapet onto ②: lying from ②'s roof up onto
  // ③'s, its ribs down the slope, its gutter crumpled at its foot. The way up.
  {
    const x1 = HOUSES[1][0] - 0.4, x0 = x1 + RAMP.long, z = ONTO_3.z, rise = RAISED + 0.06;
    const tilt = Math.atan2(rise, RAMP.long), long = Math.hypot(rise, RAMP.long);
    const midY = TOP + rise / 2 - 0.05 / Math.cos(tilt);
    props.push({ shape: 'box', size: [long / 2, 0.05, RAMP.wide / 2], pos: [(x0 + x1) / 2, midY, z], rot: [0, 0, -tilt], color: 0x4f8d68 });
    for (let dz = -RAMP.wide / 2 + 0.2; dz < RAMP.wide / 2; dz += 0.36) props.push({ shape: 'box', size: [long / 2, 0.02, 0.03], pos: [(x0 + x1) / 2, midY + 0.06, z + dz], rot: [0, 0, -tilt], color: 0x3f7a58, ghost: true });
    for (const t of [0.35, 0.7]) props.push({ shape: 'box', size: [0.05, 0.04, RAMP.wide / 2], pos: [x0 - t * RAMP.long, TOP + t * rise + 0.04, z], rot: [0, 0, -tilt], color: 0x3f7a58, wheelsOnly: true });
    box(x0 + 0.05, TOP, z - RAMP.wide / 2, x0 + 0.35, TOP + 0.12, z + RAMP.wide / 2, 0x9aa4ab, { rot: [0, 0.05, 0.3], ghost: true });
    for (const [dz, yaw] of [[-3.3, 0.4], [3.4, -0.2]]) box(x0 - 2, TOP + 0.02, z + dz - 0.4, x0, TOP + 0.05, z + dz + 0.4, 0x4f8d68, { rot: [0, yaw, 0.1], ghost: true });
  }

  // ③. Its rooftop room's ruin: the posts of its door either side of where its roof came down, its back wall standing
  // along the sea wall, what was in it out in the rain. Its tower's feet, the tower gone.
  {
    const y = roofAt(80);
    for (const side of [-1, 1]) solid(HOUSES[1][0] - 0.75, y, ONTO_3.z + side * (RAMP.wide / 2 + 0.35) - 0.06, HOUSES[1][0] - 0.63, y + 2.3, ONTO_3.z + side * (RAMP.wide / 2 + 0.35) + 0.06, 0x8a9096);
    solid(73.2, y, 379.5, 81.4, y + 1.6, 379.75, 0x9fb3c0);
    for (let x = 73.4; x < 81.3; x += 0.3) box(x, y + 0.2, 379.45, x + 0.06, y + 1.55, 379.5, 0x8fa3b0, { ghost: true });
    for (const [kind, x, z, yaw] of [['sofa', 78.4, 381.4, 0.2], ['mattress', 75.6, 381.6, 1.4], ['tvSet', 80.4, 382.4, 0.5], ['wardrobe', 74.4, 377.4, 1.7], ['windowGrille', 77, 377.9, 0.6]] as [ObjectKindId, number, number, number][]) object(kind, x, z, yaw);
    for (const [tx, tz, yaw] of [[79.4, 377.8, 0.3], [76.4, 376.6, 2.4]]) object('tinSheet', tx, tz, yaw);
    for (const fx2 of [73.6, 75.6]) box(fx2 - 0.15, y, 378.45, fx2 + 0.15, y + 0.25, 378.75, 0x9a9c98);
  }
  // Its greens under shade netting on a frame of pipe, inside the turn down the diagonal: the frame's posts along the
  // way's side, the boxes of greens under it and out beside it.
  {
    const y = roofAt(78), x0 = 75.2, x1 = 81.4, z0 = ROW.z0 + 3, z1 = 363.2;
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 3) for (const z of [z0, (z0 + z1) / 2, z1]) solid(x - 0.05, y, z - 0.05, x + 0.05, y + 2.4, z + 0.05, 0x6a7078);
    box(x0, y + 2.4, z0, x1, y + 2.44, z1, 0x1f2a22, { ghost: true, fade: true, overhead: true });
    for (const z of [z0, z1]) box(x0, y + 2.35, z - 0.03, x1, y + 2.4, z + 0.03, 0x6a7078, { ghost: true });
    for (let x = x0 + 0.6; x < x1 - 0.4; x += 0.8) for (let z = z0 + 1; z < z1 - 0.6; z += 2.2) object('vegBox', x, z, 0);
    for (let k = INTO_4.k - 70; k < INTO_4.k - 18; k += 4) near('vegBox', k, -2.3, PATH[k].h);
    object('plantStand', 79.6, z1 + 0.5, Math.PI);
    object('waterDrum', x0 - 0.6, z0 + 2);
  }

  // ③'s water tower, fallen west off its stand across the gap in the wall to ④: its stand on its side, its tank against
  // it, the way past either side.
  {
    const y = roofAt(HOUSES[2][0] + 0.5), cx = HOUSES[2][0], cz = INTO_4.z;
    solid(cx - 1.2, y, cz - TOWER_HALF, cx + 1.4, y + 1.2, cz + TOWER_HALF, 0x5a6068, {}, true);
    for (const dz of [-TOWER_HALF + 0.1, TOWER_HALF - 0.1]) rod([cx - 1.2, y + 1.25, cz + dz], [cx + 1.4, y + 1.25, cz + dz], 0.04, 0x6a7078, { ghost: true });
    // The tank rolled off it on the way it fell, lying along it, in its shadow.
    const ux = Math.sin(INTO_4.h), uz = Math.cos(INTO_4.h), tx = cx + ux * 2.3, tz = cz + uz * 2.3;
    rod([tx - ux * 1, y + 0.9, tz - uz * 1], [tx + ux * 1, y + 0.9, tz + uz * 1], 0.9, 0xc3cace);
    for (const t of [-0.6, 0.6]) rod([tx + ux * (t - 0.03), y + 0.9, tz + uz * (t - 0.03)], [tx + ux * (t + 0.03), y + 0.9, tz + uz * (t + 0.03)], 0.92, 0xaab2b8, { ghost: true });
    ROOF_ROOMS.push([tx - 1.2, tz - 1.2, tx + 1.2, tz + 1.2, true]);
  }

  // ④. Its stairhead, sandbagged at its door; beside it the grill and a chair of evenings up here, the chair blown over.
  // At the front, against the parapet in the middle and facing out over the lane, as every house has it, its burner to
  // Heaven on its tiled stand under its little roof; the bucket for paper money beside it.
  {
    const [sx, sz] = [67.6, 377.6];
    props.push({ shape: 'box', size: [1.5, 1.35, 1.8], pos: [sx, roofAt(sx) + 1.35, sz + 0.8], color: 0xd8d2c0, fade: true, building: { style: 'addition', open: [false, false, true, false], crown: 0, seed: 461 } });
    ROOF_ROOMS.push([sx - 1.5, sz - 1, sx + 1.5, sz + 2.6, false]);
    for (let i = 0; i < 4; i++) object('sandbag', sx - 0.6 + (i % 2) * 0.9, sz - 1.4, 0, Math.floor(i / 2) * 0.28);
    object('rattanChair', sx - 2.6, sz + 0.6, 1.2, 0.3, { tilt: Math.PI / 2 });
    object('grill', sx + 2.3, sz + 1.6, 0.3);
    const ax = (HOUSES[3][0] + HOUSES[3][1]) / 2, ay = roofAt(ax), az = ROW.z0 + PARAPET_THICK;
    solid(ax - 0.5, ay, az, ax + 0.5, ay + 1.0, az + 0.8, 0xd8d2c0);
    box(ax - 0.52, ay + 0.15, az + 0.8, ax + 0.52, ay + 0.85, az + 0.82, 0xb8433a, { ghost: true });
    box(ax - 0.55, ay + 1.0, az - 0.02, ax + 0.55, ay + 1.06, az + 0.85, 0x9a9c98, { ghost: true });
    props.push({ shape: 'cylinder', size: [0.3, 0.14, 0], pos: [ax, ay + 1.2, az + 0.42], color: 0x6a5a3a, ghost: true });
    props.push({ shape: 'cylinder', size: [0.32, 0.025, 0], pos: [ax, ay + 1.34, az + 0.42], color: 0x7d6a44, ghost: true });
    for (const dx of [-0.06, 0, 0.06]) box(ax + dx - 0.008, ay + 1.34, az + 0.41, ax + dx + 0.008, ay + 1.62, az + 0.43, 0xb8433a, { ghost: true });
    for (const dx of [-0.55, 0.55]) box(ax + dx - 0.04, ay + 1.0, az + 0.04, ax + dx + 0.04, ay + 2.0, az + 0.12, 0x8a2620, { ghost: true });
    box(ax - 0.75, ay + 2.0, az - 0.15, ax + 0.75, ay + 2.08, az + 1.0, 0x3f8a5a, { rot: [0.22, 0, 0], ghost: true });
    object('burnerCan', ax + 1.2, az + 0.7);
    object('plantStand', 69.8, ROW.z0 + 0.6);
    object('plantStand', 66.2, ROW.z0 + 0.6);
    object('satelliteDish', 64.6, 349.8, 2);
    object('waterDrum', 71.4, 352.8);
  }
  // Its corner come down onto ⑤: the heap of brick and broken concrete, from its roof down to ⑤'s, rough.
  {
    const x0 = HOUSES[3][0] + 0.4, x1 = x0 - HEAP.long, z = ONTO_5.z, rise = RAISED + 0.05;
    const tilt = Math.atan2(rise, HEAP.long), long = Math.hypot(rise, HEAP.long);
    props.push({ shape: 'box', size: [long / 2, 0.06, HEAP.wide / 2], pos: [(x0 + x1) / 2, TOP + rise / 2 - 0.06, z], rot: [0, 0, tilt], color: 0xa89a86 });
    for (let i = 0; i < 9; i++) {
      const t = 0.12 + ((i * 0.37) % 0.8), dz = ((i * 1.7) % (HEAP.wide - 0.8)) - HEAP.wide / 2 + 0.4;
      props.push({ shape: 'box', size: [0.3, 0.07, 0.22], pos: [x0 - t * HEAP.long, TOP + (1 - t) * rise + 0.02, z + dz], rot: [0, i, tilt], color: [0xb5603c, 0x9a9c98, 0xc9b8a0][i % 3], wheelsOnly: true });
    }
    for (let i = 0; i < 4; i++) object('brickRubble', x1 - 0.7 - (i % 3) * 0.5, z - 3.4 + i * 1.2, i);
  }

  // ⑤. Its rooftop room over its back, its lean-to over its front half, on posts, under it what would not go in: the old
  // fridge, a washing machine, a bicycle. Between the two, the narrowest place.
  // Its room in two: its kitchen out to the narrow way, its back room set back behind the heap of brick.
  const kitchenX1 = HOUSES[3][0] - HEAP.long - 0.3, roomX1 = HOUSES[3][0] - 0.5, backZ = ONTO_5.z + HEAP.wide / 2 + 0.4;
  for (const [x0, x1, z0, open, seed] of [[54.25, kitchenX1, NARROW.north, [false, true, true, false], 471], [kitchenX1, roomX1, backZ, [false, true, true, false], 472]] as [number, number, number, [boolean, boolean, boolean, boolean], number][]) {
    props.push({ shape: 'box', size: [(x1 - x0) / 2, 1.45, (ROW.z1 - 0.25 - z0) / 2], pos: [(x0 + x1) / 2, TOP + 1.45, (ROW.z1 - 0.25 + z0) / 2], color: 0xb7bcc0, fade: true, building: { style: 'addition', open, crown: 0, seed } });
    ROOF_ROOMS.push([x0, z0, x1, ROW.z1 - 0.25, false]);
  }
  {
    const y = TOP, z1 = NARROW.south, z0 = ROW.z0 + 3, x0 = 54.6, x1 = HOUSES[3][0] - HEAP.long - 0.4;
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 3) {
      solid(x - 0.06, y, z1 - 0.06, x + 0.06, y + 2.3, z1 + 0.06, 0x6a7078);
      box(x - 0.05, y, z0 - 0.05, x + 0.05, y + 2.1, z0 + 0.05, 0x6a7078);
    }
    box(x0 - 0.3, y + 2.1, z0 - 0.3, x1 + 0.3, y + 2.16, z1 + 0.3, 0x6fa0a0, { ghost: true, fade: true, overhead: true });
    for (const [kind, x, z, yaw] of [['fridge', 56, z1 - 1.2, 0.1], ['washingMachine', 57.4, z1 - 1, 0], ['rattanChair', 57.6, z0 + 2, 2.8], ['waterDrum', x1 - 0.6, z0 + 1]] as [ObjectKindId, number, number, number][]) object(kind, x, z, yaw);
  }
  // What the storm has had off the room: the window grille, a sheet of its roofing, in the narrow way.
  object('windowGrille', ONTO_5.x - 6.4, BILLBOARD_BASE[1] + 0.8, 0.3);
  object('tinSheet', ONTO_5.x - 7.8, BILLBOARD_BASE[1] - 1, 0.5);

  // The billboard: a builder's board for flats by the sea that stood on ⑤'s roof, blown off its stand and come down face
  // up across the drain, its top on the market's roof. Its frame under the face, angle iron; its stand's legs still
  // bolted down on ⑤, bent over.
  const signs: SignDesc[] = [];
  {
    const [bx, bz] = BILLBOARD_BASE, long = (bx - BILLBOARD_TOP_X) / Math.cos(BILLBOARD_YAW);
    const topY = EAVE + (HALL.x1 - BILLBOARD_TOP_X) * (RISE / (GABLE / 2));
    const tilt = Math.atan2(topY - TOP, long);
    const mx = (bx + BILLBOARD_TOP_X) / 2, mz = bz + Math.tan(BILLBOARD_YAW) * (bx - BILLBOARD_TOP_X) / 2, my = (TOP + topY) / 2 + 0.08;
    const yaw = Math.PI + BILLBOARD_YAW;
    props.push({ shape: 'box', size: [long / 2, 0.08, BILLBOARD_WIDE / 2], pos: [mx, my, mz], rot: [0, yaw, tilt], color: 0x5a5f66 });
    signs.push({ kind: 'name', text: '海景第一排　預售中', colors: ['#1f4f9a', '#f2efe6', '#f2c12e'], wide: long - 0.6, pos: [mx, my + 0.09, mz], rotY: yaw, lie: tilt });
    const ux = -Math.cos(BILLBOARD_YAW), uz = Math.sin(BILLBOARD_YAW), nx = uz, nz = -ux;
    const pt = (s: number, side: number, drop: number): Vec3 => [bx + ux * s + nx * side, TOP + (s / long) * (topY - TOP) - drop, bz + uz * s + nz * side];
    for (const side of [-BILLBOARD_WIDE / 2 + 0.1, BILLBOARD_WIDE / 2 - 0.1]) {
      rod(pt(0, side, 0.25), pt(long, side, 0.25), 0.07, 0x4a4f57, { ghost: true });
      for (let s = 1.2; s < long; s += 2.4) rod(pt(s, side, 0.05), pt(s + 1.2, side, 0.45), 0.035, 0x4a4f57, { ghost: true });
    }
    for (let s = 0.5; s < long; s += 2.4) rod(pt(s, -BILLBOARD_WIDE / 2 + 0.1, 0.3), pt(s, BILLBOARD_WIDE / 2 - 0.1, 0.3), 0.04, 0x4a4f57, { ghost: true });
    for (const side of [-1.8, 1.8]) rod([bx + 0.8, TOP, bz + side], [bx - 0.6, TOP + 0.6, bz + side * 1.05], 0.08, 0x6a7078, { ghost: true });
  }

  // The wind: out of the sea over the sea wall, squeezed down the slot of the drain between the houses and the market's
  // end, across the billboard. Off ⑤'s room and the roofs north of the billboard it takes what is loose. Two banners at
  // the drain's head stand out before it comes.
  const slot = [(HALL.x1 + ROW.x0) / 2, ROW.z1 + 10] as Vec2;
  const roomTop = TOP + 2.9;
  const gusts: GustDesc[] = [{
    from: slot,
    mouth: [slot[0], ROW.z1],
    to: [slot[0], ROW.z0 - 2],
    half: (ROW.x0 - HALL.x1) / 2,
    spread: (ROW.x0 - HALL.x1) / 2 + 1,
    period: 7,
    beats: [[1, 2.2]],
    take: 3,
    force: 1100,
    wakes: 60,
    floor: TOP,
    flags: [[ROW.x0 + 0.5, roomTop, NARROW.north + 1], [HALL.x1 - 0.5, EAVE + 0.15, NARROW.north + 2]],
    feed: {
      at: [[ROW.x0 + 1.2, roomTop + 0.5, NARROW.north + 4], [ROW.x0 + 1.5, roomTop + 0.5, NARROW.north + 8], [ROW.x0 + 1.2, roomTop + 0.5, NARROW.north + 2], [HALL.x1 - 1, EAVE + 1.2, NARROW.north + 6]],
      kinds: ['chair', 'vegBox', 'tinSheet', 'clothesRack', 'bucket', 'mopBucket', 'foamBox', 'rattanChair'],
      each: 3,
      push: [[-5, 1.5, -3], [-4.5, 2, -4], [-5, 1.2, -2.5], [4, 1.5, -3]],
    },
  }];
  // The roofs' front halves, over the lane, off the way: what each household keeps out there. ①'s room of sheet built on,
  // its air conditioner, its pots along the parapet; ②'s fish drying on their racks, the family's water in drums; ④'s
  // pigeons' loft, the birds about it; ⑤'s tank up on its stand, its dish, its pots. (③'s greens are under their netting.)
  {
    const front = ROW.z0 + PARAPET_THICK;
    const pots: ObjectKindId[] = ['flowerPotTall', 'flowerPotJar', 'flowerPotLow', 'flowerPotBloom', 'flowerPot'];
    const potRow = (x0: number, x1: number) => { for (let x = x0, k = 0; x < x1; x += 0.75, k++) object(pots[k % pots.length], x, front + 0.45); };
    const [h1, h2, , h4, h5] = HOUSES;
    // ①
    solid(h1[0] + 2.2, TOP, front + 2.2, h1[1] - 1.6, TOP + 2.4, front + 6.6, 0xb8bcc0, { fade: true });
    box(h1[0] + 2, TOP + 2.4, front + 2, h1[1] - 1.4, TOP + 2.52, front + 6.8, 0x4b7aa8, { fade: true, rot: [0.04, 0, 0] });
    box(h1[0] + 3.6, TOP, front + 2.15, h1[0] + 4.6, TOP + 2, front + 2.2, 0x5a6670, { ghost: true, fade: true });
    box(h1[0] + 5.4, TOP + 1, front + 2.15, h1[0] + 6.6, TOP + 1.8, front + 2.2, 0x2f3a46, { ghost: true, fade: true });
    object('acUnit', h1[1] - 1.1, front + 4, -Math.PI / 2);
    potRow(h1[0] + 1, h1[1] - 1);
    // ②: three racks of fish split and laid out to dry, the drums by the stair.
    for (let k = 0; k < 3; k++) object('dryingRack', h2[0] + 2.4 + k * 2.2, front + 3.4, 0);
    for (let k = 0; k < 4; k++) object('waterDrum', h2[1] - 1.2 - (k % 2) * 0.7, front + 1 + Math.floor(k / 2) * 0.7);
    object('basin', h2[0] + 1.4, front + 1.2);
    // ④: the loft, its wire front and its roof, the birds out on the roof and on the parapet.
    const lx0 = h4[0] + 2.5, lx1 = h4[0] + 6.5, lz0 = front + 1.4, lz1 = front + 4.2, ly = roofAt(lx0);
    solid(lx0, ly, lz0 + 1.4, lx1, ly + 2, lz1, 0x8a6a4a, { fade: true });
    box(lx0, ly, lz0, lx1, ly + 2, lz0 + 0.05, 0xb8bcc0, { ghost: true, fade: true });
    for (let x = lx0 + 0.3; x < lx1; x += 0.35) box(x - 0.015, ly, lz0, x + 0.015, ly + 2, lz0 + 0.06, 0x8a8f96, { ghost: true, fade: true });
    box(lx0 - 0.2, ly + 2, lz0 - 0.3, lx1 + 0.2, ly + 2.1, lz1 + 0.2, 0x7a3a2a, { fade: true, rot: [-0.12, 0, 0] });
    for (const [dx, dz] of [[-1.2, -0.4], [1.8, -0.9], [5.6, 0.2]]) object('pigeons', lx0 + dx, front + dz + 0.6, dx);
    // ⑤: the stand east of its lean-to, clear of it.
    const tx = h5[0] + 7, tz = front + 5;
    for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) box(tx + dx - 0.05, TOP, tz + dz - 0.05, tx + dx + 0.05, TOP + 1.6, tz + dz + 0.05, 0x5a5f66);
    box(tx - 1, TOP + 1.6, tz - 1, tx + 1, TOP + 1.7, tz + 1, 0x5a5f66);
    for (const dx of [-0.5, 0.5]) props.push({ shape: 'cylinder', size: [0.55, 0.7, 0], pos: [tx + dx, TOP + 2.4, tz], color: 0xd8dcde, fade: true });
    object('satelliteDish', h5[1] - 1.6, front + 1.5, 2.4);
    potRow(h5[0] + 0.8, h5[0] + 3.2);
  }

  return { props, objects, gusts, signs };
}
