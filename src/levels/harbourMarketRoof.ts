import type { Vec3 } from '../config';
import type { ObjectDesc, ObjectKindId } from './objects';
import { EAVE, HALL } from './harbourMarket';
import type { FordDesc, GustDesc, LevelDef, PropDesc, RoofSkylight, SignDesc, Slab, Vec2 } from './types';

// Level 4's third place, its end: over the market hall's roof, from where the billboard came down on its east eaves to
// the ice plant's canopy off its west ones. A big hall's roof of sheet: gables side by side, ridges the long way, the
// building's back end at the north a flat concrete roof over its offices and cold room, and halfway along the joint of
// its two halves, built at different times, the flat roof of the passage between them across it. Skylights of corrugated polycarbonate in the
// slopes, grey with years of dirt: they will not bear a man, and the truck goes straight through one into the market.
//
//   the ridges     west from the billboard over two ridges, their rooflights along them: over each only where the
//                  rooflight breaks off for a truss, the first's to the south, the second's to the north, each blind
//                  until its crest; between them in the valley what the storm has brought in
//   the plant deck the back end's flat roof, its water tanks and chillers: round to the south on it
//   the valley     south down the valley between two gables, the truck astride it, a wheel on either slope: it keeps
//                  itself in the middle, and either side, up the slope, the skylights. In it, one after another: a
//                  ventilator blown off a ridge; the repair men's two stacks of new sheet, one either side, to be
//                  swung round between; the wind over the west ridge bringing down the old tyres and sandbags that held the roof
//                  down; the tarpaulin they threw over the leak, its battens; and at the valley's foot its outlet blocked, the water standing
//   the joint      round to the west onto the flat roof across it and along it between the gables' ends to the
//                  canopy at the west eaves, down which the way goes on
//
// Off the roof's north edge is down behind the hall, and the end; through a skylight, the end.

/** The gables: each so wide, its ridge so high over its eaves; where the ridges run. */
export const GABLE = 12, RISE = 0.9;
const RIDGE_Y = EAVE + RISE;
const RIDGES = [HALL.x0 + 6, HALL.x0 + 18, HALL.x0 + 30, HALL.x0 + 42, HALL.x0 + 54];
/** The joint across the roof, the flat roof between the halves and its gutters either side: from and to on Z. */
export const JOINT = { z0: 284, z1: 294 };
/** The back end's flat concrete roof, over its offices and cold room. */
export const DECK = { x0: RIDGES[1] - 6, x1: RIDGES[2] + 6, z0: 350, z1: HALL.z1 };
/** The valley the way runs south down, between the gables of these two ridges. */
export const VALLEY = RIDGES[1] + 6;
/** Where down the valley the wind comes over its west ridge. */
const GUST_Z = 313;
/** The way over, as the truck goes. */
export const MARKET_ROOF_WAY: Vec2[] = [[38.5, 362.6], [36, 360.6], [33, 359.4], [30, 359.8], [27.5, 361.6], [25, 364], [22, 365], [18.5, 365], [14, 364.2], [9.7, 362.3], [6.3, 359.7], [VALLEY, 356], [VALLEY, 349], [VALLEY + 1.35, 342], [VALLEY + 1.35, 337.5], [VALLEY - 1.35, 327.5], [VALLEY - 1.35, 321.5], [VALLEY, 316], [VALLEY, JOINT.z1 - 0.5], [VALLEY - 2.5, JOINT.z1 - 3.8], [VALLEY - 8, JOINT.z1 - 6.5], [HALL.x0 - 2, JOINT.z1 - 6.5]];
/** Places to start from in testing: on the first crest, on the deck, at the valley's head, at the joint. */
export const MARKET_ROOF_SPOTS = {
  ridges: [39.5, 364.4, -Math.PI / 2 - 0.12, EAVE + 0.3] as [number, number, number, number],
  valley: [VALLEY, DECK.z0 + 2, Math.PI, EAVE] as [number, number, number, number],
  joint: [VALLEY - 6, JOINT.z1 - 5, -Math.PI / 2, EAVE] as [number, number, number, number],
};

/** A pane of a skylight: the ridge it is under, the side (-1 west of the ridge, 1 east), from and to on Z, and how far up the slope from its foot to how far, as shares of the slope. */
type Pane = [number, -1 | 1, number, number, number, number];
// The market under the roof is lit from above along its aisles. Where an aisle runs under a ridge, a rooflight over the
// ridge, a pane down either slope, in runs from truss to truss, broken off where the ventilators stand on the ridge over
// the fishmongers' and the butchers' benches. Where one runs under a slope, a skylight in it over the aisle in each bay
// between the trusses, those broken since sheeted over with new steel, some not yet. Over the cold room and offices at
// the back, the deck, none.
/** The aisles' middles across the hall, one to each row of stalls. */
const AISLES = Array.from({ length: 9 }, (_, k) => HALL.x0 + 3.6 + k * 6.4);
/** The trusses, along the hall from its south end. */
const TRUSS = 6;
/**
 * The ridges with an aisle under them, their rooflights' runs from and to on Z, and how far down either slope a pane goes,
 * metres. The first crest's, right ahead off the billboard, long enough down its west slope to take the truck; its east pane short of the eaves the billboard came down on; by the valley the way goes down, short
 * of it either side.
 */
const ROOFLIGHTS: { ridge: number; runs: [number, number][]; down: [number, number] }[] = [
  { ridge: RIDGES[2], down: [2.25, 2.25], runs: [[242, 254.5], [260.5, 270], [276, 283.6], [296, 304], [309.5, 319], [325, 331], [335.5, 347.5]] },
  { ridge: RIDGES[3], down: [4, 4], runs: [[238.5, 249], [255, 266], [272, 283.6], [295.5, 306], [312, 324.5], [330.5, 343], [349, 361.5], [368.5, 371.4]] },
  { ridge: RIDGES[4], down: [5.6, 2.4], runs: [[240.5, 252], [258, 271.5], [277.5, 283.6], [296.5, 309], [315, 331.5], [337.5, 354], [362.5, 371.4]] },
];
/**
 * Down the valley the way goes down, up its west slope: skylights over the fishmongers' sinks along that side of their row,
 * put in after. Where the repair men's stacks push the truck toward that side, and just off the deck where a turn taken too
 * wide comes down. Up the slope as far as the rooflight over the ridge on its east side is: 7.5 m of steel between.
 */
const UP_SLOPE = [3.75 / 6, 5.7 / 6] as const;
const VALLEY_SKYLIGHTS: Pane[] = [
  [RIDGES[1], 1, 341, 349.6, ...UP_SLOPE],
  [RIDGES[1], 1, 318, 327.5, ...UP_SLOPE],
  [RIDGES[1], 1, 296.5, 302, ...UP_SLOPE],
  // Just off the joint in the south half, over the aisle by the valley there, where a turn into the joint taken too wide runs on.
  [RIDGES[1], 1, 277.5, 283, 0.05, 0.45],
];
/**
 * The north half's two westmost gables are the hall's oldest, and keep the skylights it was built with: not one over each
 * aisle in each bay but bands of sheet run on along the slope over the trusses, bay after bay. Down the last slope to the
 * west eaves, from the gutter; and either side of the valley between the two, down into it, where its gutter was sheeted
 * over with them, one band from slope to slope.
 */
const OLD_BANDS: Pane[][] = [
  [[RIDGES[0], -1, 320.75, 355.25, 0.04, 0.8]],
  [[RIDGES[0], 1, 302.75, 319.25, 0, 0.7], [RIDGES[1], -1, 302.75, 319.25, 0, 0.93]],
];
/** Those slopes, which have none over the aisles. */
const OLD_SLOPE = (ridge: number, side: -1 | 1, z0: number) => z0 >= JOINT.z1 && (ridge === RIDGES[0] || (ridge === RIDGES[1] && side < 0));
/** The roof's sections, as a box each [x0, z0, x1, z1]: the south half; the north half to either side of the deck and in front of it. */
const SECTIONS: [number, number, number, number][] = [
  [HALL.x0, HALL.z0, HALL.x1, JOINT.z0],
  [HALL.x0, JOINT.z1, DECK.x0, HALL.z1],
  [DECK.x0, JOINT.z1, DECK.x1, DECK.z0],
  [DECK.x1, JOINT.z1, HALL.x1, HALL.z1],
];

export interface MarketRoofParts {
  props: PropDesc[];
  objects: ObjectDesc[];
  gusts: GustDesc[];
  skylights: RoofSkylight[];
  pools: NonNullable<LevelDef['pools']>;
  fords: FordDesc[];
  signs: SignDesc[];
}

const tone = (c: number) => (((c >> 16) * 0.82) << 16) | ((((c >> 8) & 255) * 0.82) << 8) | ((c & 255) * 0.82);

export function marketRoof(): MarketRoofParts {
  const props: PropDesc[] = [];
  const objects: ObjectDesc[] = [];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, more: Partial<PropDesc> = {}) =>
    props.push({ shape: 'box', size: [Math.abs(x1 - x0) / 2, (y1 - y0) / 2, Math.abs(z1 - z0) / 2], pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color, ...more });
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, y = EAVE, more: Partial<ObjectDesc> = {}) => objects.push({ kind, pos: [x, y, z], rotY, ...more });
  const rod = (a: Vec3, b: Vec3, r: number, color: number, more: Partial<PropDesc> = {}) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], long = Math.hypot(d[0], d[1], d[2]);
    props.push({ shape: 'cylinder', size: [r, long / 2, 0], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [0, Math.atan2(-d[2], d[0]), -Math.acos(d[1] / long)], color, ...more });
  };
  /** How high the roof is at a place on a gable's slope. */
  const roofY = (x: number) => {
    const r = RIDGES.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
    return EAVE + RISE * Math.max(0, 1 - Math.abs(x - r) / (GABLE / 2));
  };
  const tilt = Math.atan2(RISE, GABLE / 2), run = Math.hypot(RISE, GABLE / 2);
  /**
   * A piece of a slope, from so far up it to so far (shares of it, from its foot), from z0 to z1: the slope of the gable of
   * ridge `ridge` on its `side`. `lift` above the slope's face, so thick; solid, or as `more` says.
   */
  const slab = (ridge: number, side: -1 | 1, f0: number, f1: number, z0: number, z1: number, lift: number, thick: number): Slab => {
    const foot = ridge + side * (GABLE / 2), f = (f0 + f1) / 2;
    const x = foot + (ridge - foot) * f, off = lift - thick / 2;
    // Rising toward the ridge: toward -X on the gable's east side, toward +X on its west.
    const a = side < 0 ? tilt : -tilt;
    return { size: [((f1 - f0) * run) / 2, thick / 2, (z1 - z0) / 2], pos: [x - Math.sin(a) * off, EAVE + RISE * f + Math.cos(a) * off, (z0 + z1) / 2], rot: [0, 0, a] };
  };
  const onSlope = (ridge: number, side: -1 | 1, f0: number, f1: number, z0: number, z1: number, lift: number, thick: number, color: number, more: Partial<PropDesc> = {}) =>
    props.push({ shape: 'box', ...slab(ridge, side, f0, f1, z0, z1, lift, thick), color, ...more });

  // The skylights: the rooflights over the ridges, and those over the aisles under the slopes, bay by bay; which bays have
  // theirs, which have had them sheeted over, as it has gone over the years.
  const hash = (a: number, b: number, c: number) => {
    const v = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
    return v - Math.floor(v);
  };
  const lights: { panes: Pane[]; broken: boolean }[] = [];
  const patches: Pane[] = [];
  for (const { ridge, runs, down } of ROOFLIGHTS) for (const [z0, z1] of runs)
    lights.push({ panes: [[ridge, -1, z0, z1, 1 - down[0] / (GABLE / 2), 1], [ridge, 1, z0, z1, 1 - down[1] / (GABLE / 2), 1]], broken: false });
  // The first crest's, right ahead off the billboard: its east pane broken already, by what the wind threw onto it.
  lights.find(({ panes: [[r, , z0]] }) => r === RIDGES[4] && z0 === 362.5)!.broken = true;
  for (const pane of VALLEY_SKYLIGHTS) lights.push({ panes: [pane], broken: pane[2] === 318 });
  for (const panes of OLD_BANDS) lights.push({ panes, broken: false });
  for (const [x0, z0, x1, z1] of SECTIONS) for (const ridge of RIDGES) for (const side of [-1, 1] as const) {
    if (ridge < x0 || ridge > x1) continue;
    if (OLD_SLOPE(ridge, side, z0)) continue;
    const foot = ridge + side * (GABLE / 2);
    for (const aisle of AISLES) {
      // 2.4 m across, the width of the walkway between the stalls' fronts.
      const f = (aisle - foot) / (ridge - foot), half = 1.2 / (GABLE / 2);
      if (f < 0.25 || f > 0.8) continue;
      for (let b = HALL.z0; b + TRUSS <= HALL.z1; b += TRUSS) {
        if (b < z0 || b + TRUSS > z1) continue;
        const pane: Pane = [ridge, side, b + 0.75, b + TRUSS - 0.75, f - half, f + half], h = hash(ridge, side, b);
        if (h < 0.5) lights.push({ panes: [pane], broken: h < 0.1 });
        else if (h < 0.75) patches.push(pane);
      }
    }
  }
  const skylights: RoofSkylight[] = lights.map(({ panes, broken }) => ({
    panes: panes.map(([ridge, side, z0, z1, f0, f1]) => ({ slab: slab(ridge, side, f0, f1, z0, z1, -0.03, 0.12), ridge: f1 >= 1 })),
    edge: 0.5,
    broken,
  }));
  const panes = lights.flatMap((l) => l.panes);
  SECTIONS.forEach(([x0, z0, x1, z1], n) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const here = panes.filter(([r, , a, b]) => r > x0 && r < x1 && a < z1 && b > z0);
    const cuts = here.map(([ridge, side, a, b, f0, f1]): [number, number, number, number] => {
      const foot = ridge + side * (GABLE / 2), xa = foot + (ridge - foot) * f0, xb = foot + (ridge - foot) * f1;
      return [Math.min(xa, xb) - cx, a - cz, Math.max(xa, xb) - cx, b - cz];
    });
    props.push({ shape: 'box', size: [(x1 - x0) / 2, RISE / 2, (z1 - z0) / 2], pos: [cx, EAVE + RISE / 2, cz], color: 0x9aa4a8, ghost: true, fade: true, fadeZone: [[0, -200, 0], [0, -200, 0]], building: { style: 'gables', open: [false, false, true, true], crown: 0, seed: 481 + n, cuts } });
    // The solid slopes under the sheet's faces, a little below them, whole but for the skylights' panes, which are solid apart.
    for (const ridge of RIDGES) for (const side of [-1, 1] as const) {
      if (ridge < x0 || ridge > x1) continue;
      let z = z0;
      for (const [, , a, b, f0, f1] of here.filter(([r, s]) => r === ridge && s === side).sort((p, q) => p[2] - q[2])) {
        if (a > z) onSlope(ridge, side, 0, 1, z, a, -0.03, 0.12, 0x8e989c);
        if (f0 > 0) onSlope(ridge, side, 0, f0, a, b, -0.03, 0.12, 0x8e989c);
        if (f1 < 1) onSlope(ridge, side, f1, 1, a, b, -0.03, 0.12, 0x8e989c);
        z = b;
      }
      if (z < z1) onSlope(ridge, side, 0, 1, z, z1, -0.03, 0.12, 0x8e989c);
    }
  });
  // The new sheet over those sheeted over, brighter than the old; the old tyres and sandbags laid on it to hold it down in
  // the wind, its screws not all in yet.
  for (const [k, [ridge, side, a, b, f0, f1]] of patches.entries()) {
    onSlope(ridge, side, f0 - 0.03, f1 + 0.03, a - 0.2, b + 0.2, 0.014, 0.01, k % 2 ? 0xb4bec4 : 0xa9b4ba, { ghost: true });
    if (k % 3) continue;
    const foot = ridge + side * (GABLE / 2), x = foot + (ridge - foot) * (f0 + f1) / 2;
    object('tyre', x, a + 1, k, roofY(x) + 0.03);
    object('sandbag', x + side * 0.4, b - 1.2, k + 1, roofY(x + side * 0.4) + 0.03);
  }

  // The joint: the flat concrete roof of the passage built between the two halves, level with their eaves, scored in bays;
  // along either side of it at the foot of the gables' ends a box gutter of steel half a metre wide, the valleys emptying
  // into it, its water running west and out over the eaves onto the canopy. Its east end an upstand. Where the old
  // concrete has settled the rain stands in puddles. And the back end's flat roof, concrete, its parapet along the north.
  {
    const lip = 0.5, sole = EAVE - 0.18, z0 = JOINT.z0 + lip, z1 = JOINT.z1 - lip;
    box(HALL.x0, EAVE - 0.3, z0, HALL.x1, EAVE, z1, 0xa2a49e);
    for (let x = HALL.x0 + 3; x < HALL.x1; x += 3) box(x - 0.01, EAVE, z0 + 0.1, x + 0.01, EAVE + 0.005, z1 - 0.1, 0x8f918a, { ghost: true });
    box(HALL.x1 - 0.25, EAVE, z0, HALL.x1, EAVE + 0.3, z1, 0xb0b0a8);
    for (const [a, b] of [[JOINT.z0, z0], [z1, JOINT.z1]]) {
      box(HALL.x0, sole - 0.12, a, HALL.x1, sole, b, 0x5f686c);
      const outer = a === JOINT.z0 ? a : b;
      box(HALL.x0, sole - 0.12, outer - 0.02, HALL.x1, EAVE + 0.04, outer + 0.02, 0x6a7276, { ghost: true });
    }
    // The puddles: a wet stain, the water in it. Clear of the gutters; one where the way turns out of the valley.
    for (const [x, z, r] of [[VALLEY - 3.5, 290.6, 1.6], [VALLEY - 16, 288.6, 2.1], [VALLEY + 9, 289.4, 1.3], [VALLEY + 21, 288.2, 1.8]]) {
      for (const [dx, dz, k] of [[0, 0, 1], [r * 0.7, r * 0.35, 0.65], [-r * 0.6, -r * 0.3, 0.55]]) {
        props.push({ shape: 'cylinder', size: [r * k + 0.35, 0.002, 0], pos: [x + dx, EAVE + 0.003, z + dz], color: 0x8a8d88, ghost: true });
        props.push({ shape: 'cylinder', size: [r * k, 0.002, 0], pos: [x + dx, EAVE + 0.008, z + dz], color: 0x687478, ghost: true });
      }
    }
  }
  box(DECK.x0, EAVE - 0.2, DECK.z0, DECK.x1, EAVE, DECK.z1, 0xa8aaa4);
  box(DECK.x0, EAVE, DECK.z1 - 0.25, DECK.x1, EAVE + 0.9, DECK.z1, 0xb8b6ae);
  box(DECK.x0 - 0.02, EAVE + 0.9, DECK.z1 - 0.28, DECK.x1 + 0.02, EAVE + 0.96, DECK.z1 + 0.03, 0x9a9c98, { ghost: true });
  for (let x = DECK.x0 + 1.5; x < DECK.x1; x += 3) box(x - 0.01, EAVE, DECK.z0 + 0.2, x + 0.01, EAVE + 0.005, DECK.z1 - 0.3, 0x96988f, { ghost: true });

  // On the deck: the water tanks on their stand; the chillers in a row against the parapet, humming; the switch boxes;
  // the stairhead from the offices; the market's loudspeaker on its pole; dishes. Out of the way of the turn round onto
  // the valley's head, but closing it in.
  {
    // The tanks out on the turn's far side, the stairhead inside it: the turn round onto the valley no wider than the truck turns.
    const sx0 = VALLEY - 3.6, sx1 = sx0 + 4.4, sz0 = 362.6, sz1 = sz0 + 2.4, stand = 1.7;
    for (const [lx, lz] of [[sx0, sz0], [sx1 - 0.12, sz0], [sx0, sz1 - 0.12], [sx1 - 0.12, sz1 - 0.12]]) box(lx, EAVE, lz, lx + 0.12, EAVE + stand, lz + 0.12, 0x6a7078);
    box(sx0, EAVE + stand - 0.12, sz0, sx1, EAVE + stand, sz1, 0x5a6068);
    for (const cx of [sx0 + 1.1, sx1 - 1.1]) {
      props.push({ shape: 'cylinder', size: [1, 1.1, 0], pos: [cx, EAVE + stand + 1.1, (sz0 + sz1) / 2], color: 0xc3cace });
      for (const h of [0.5, 1.6]) props.push({ shape: 'cylinder', size: [1.02, 0.025, 0], pos: [cx, EAVE + stand + h, (sz0 + sz1) / 2], color: 0xaab2b8, ghost: true });
    }
    for (let k = 0; k < 4; k++) {
      const x0 = DECK.x1 - 2 - k * 2.6;
      box(x0 - 2.2, EAVE, DECK.z1 - 3.4, x0, EAVE + 1.5, DECK.z1 - 0.6, 0xd8dcde);
      for (const dx of [0.55, 1.65]) props.push({ shape: 'cylinder', size: [0.42, 0.04, 0], pos: [x0 - dx, EAVE + 1.52, DECK.z1 - 2], color: 0x3a3f46, ghost: true });
      box(x0 - 2.2, EAVE + 0.3, DECK.z1 - 3.42, x0, EAVE + 1.1, DECK.z1 - 3.4, 0x9aa0a6, { ghost: true });
    }
    for (let k = 0; k < 3; k++) box(DECK.x0 + 0.4, EAVE, DECK.z0 + 1 + k * 1.1, DECK.x0 + 1, EAVE + 1.6, DECK.z0 + 1.9 + k * 1.1, 0x8a9096);
    props.push({ shape: 'box', size: [1.2, 1.3, 1.4], pos: [VALLEY + 5.4, EAVE + 1.3, 358.6], color: 0xd8d2c0, fade: true, building: { style: 'addition', open: [true, false, true, false], crown: 0, seed: 491 } });
    rod([DECK.x0 + 9, EAVE, DECK.z1 - 1.2], [DECK.x0 + 9, EAVE + 4.2, DECK.z1 - 1.2], 0.06, 0x8a9096);
    for (const dx of [-0.35, 0.35]) props.push({ shape: 'cone', size: [0.22, 0.25, 0], pos: [DECK.x0 + 9 + dx, EAVE + 3.9, DECK.z1 - 1.2], rot: [Math.PI / 2, 0, dx * 2], color: 0xd8dcde, ghost: true });
    object('satelliteDish', DECK.x0 + 6.5, DECK.z1 - 1.4, 2.8);
    object('acUnit', DECK.x0 + 12.5, DECK.z1 - 1, Math.PI);
    object('tyreStack', DECK.x0 + 1.6, DECK.z0 + 5.6);
    // The cold room's condensing units, along the deck's south edge at its east end, on a steel stand out to the foot of
    // the next gable: their fans up, their coils facing the weather, their pipes along the deck to where they go down
    // into the cold room. The valley past the deck's corner is behind them.
    const cx0 = DECK.x1 - 6.4, cx1 = DECK.x1 + 1.9, cz0 = DECK.z0 + 0.25, cz1 = cz0 + 1.6, legs = 0.5;
    for (const x of [cx0, (cx0 + cx1) / 2, cx1 - 0.12]) for (const z of [cz0, cz1 - 0.12]) box(x, roofY(x + 0.06), z, x + 0.12, EAVE + legs, z + 0.12, 0x6a7078);
    box(cx0, EAVE + legs - 0.1, cz0, cx1, EAVE + legs, cz1, 0x5a6068);
    for (let k = 0; k < 3; k++) {
      const x0 = cx0 + 0.15 + k * 2.75, x1 = x0 + 2.5;
      box(x0, EAVE + legs, cz0 + 0.1, x1, EAVE + legs + 1.3, cz1 - 0.1, 0xe2e4de);
      for (const dx of [0.65, 1.85]) props.push({ shape: 'cylinder', size: [0.5, 0.04, 0], pos: [x0 + dx, EAVE + legs + 1.32, (cz0 + cz1) / 2], color: 0x3a3f46, ghost: true });
      for (let y = 0.2; y < 1.2; y += 0.12) box(x0 + 0.1, EAVE + legs + y, cz0 + 0.08, x1 - 0.1, EAVE + legs + y + 0.03, cz0 + 0.1, 0x9aa0a6, { ghost: true });
      rod([x0 + 0.4, EAVE + legs + 0.3, cz1 - 0.1], [x0 + 0.4, EAVE + 0.15, cz1 + 0.6], 0.05, 0x2a2c30, { ghost: true });
    }
    // Their pipes, lagged black, along the deck to the riser down into the cold room.
    rod([cx0 + 0.55, EAVE + 0.15, cz1 + 0.6], [cx1 - 1.6, EAVE + 0.15, cz1 + 0.6], 0.07, 0x2a2c30, { ghost: true });
    box(cx0 - 0.6, EAVE, cz1 + 0.3, cx0 + 0.2, EAVE + 0.7, cz1 + 1.1, 0xb8b6ae);
  }

  // The market's name over its west eaves, to be read from the harbour road past the ice plant: a board on a steel frame,
  // its posts along the gutter, raking struts back up the slope to the ridge and a leg down the far side, an A over the
  // ridge either end of each strut, bolted down through the sheet to the purlins along a sill on either; a rail behind
  // for the men who see to its lights, the lights on arms out over the eaves.
  const signs: SignDesc[] = [];
  {
    const SIGN = { z0: 299, z1: 317, x: HALL.x0 + 0.45, y0: EAVE + 1.2 }, wide = SIGN.z1 - SIGN.z0 - 1, tall = wide * 0.218;
    const ridge = RIDGES[0], far = ridge + 1.8, knee = RIDGE_Y + 0.9, top = SIGN.y0 + tall;
    signs.push({ kind: 'name', text: '南安公有零售市場', pos: [HALL.x0 + 0.3, SIGN.y0 + tall / 2, (SIGN.z0 + SIGN.z1) / 2], rotY: -Math.PI / 2, wide, colors: ['#1f4f9a', '#f2efe6', '#f2c12e'] });
    for (let z = SIGN.z0 + 1; z <= SIGN.z1 - 1 + 0.01; z += (SIGN.z1 - SIGN.z0 - 2) / 4) {
      box(SIGN.x - 0.1, roofY(SIGN.x), z - 0.1, SIGN.x + 0.1, top, z + 0.1, 0x4a4f57);
      rod([SIGN.x + 0.1, top - 0.4, z], [ridge, knee, z], 0.08, 0x4a4f57);
      rod([SIGN.x + 0.1, SIGN.y0, z], [ridge - 2.4, roofY(ridge - 2.4), z], 0.06, 0x4a4f57);
      box(ridge - 0.08, RIDGE_Y, z - 0.08, ridge + 0.08, knee, z + 0.08, 0x4a4f57);
      rod([ridge, knee, z], [far, roofY(far), z], 0.07, 0x4a4f57);
      rod([SIGN.x - 0.05, top + 0.05, z], [SIGN.x - 1, top + 0.45, z], 0.035, 0x3a3f46, { ghost: true });
      props.push({ shape: 'box', size: [0.12, 0.1, 0.25], pos: [SIGN.x - 1.05, top + 0.38, z], color: 0x2a2c30, ghost: true });
    }
    // The bottom rail tying the posts at the gutter, the walkway's rail behind at the top.
    for (const x of [SIGN.x, ridge, far]) box(x - 0.1, roofY(x) - 0.05, SIGN.z0 + 0.8, x + 0.1, roofY(x) + 0.3, SIGN.z1 - 0.8, 0x4a4f57);
    for (const y of [SIGN.y0 - 0.1, top - 0.1]) box(SIGN.x + 0.1, y, SIGN.z0 + 0.9, SIGN.x + 0.2, y + 0.1, SIGN.z1 - 0.9, 0x4a4f57, { ghost: true });
    box(SIGN.x + 0.75, top + 0.9, SIGN.z0 + 0.9, SIGN.x + 0.8, top + 0.95, SIGN.z1 - 0.9, 0x4a4f57, { ghost: true });
  }

  // The ridges' ventilators: on the steel where a rooflight breaks off, at the gap's south end; along the ridges with
  // no aisle under them, in twos and threes over the benches. Over the valley's west ridge two either side of where the wind
  // comes over.
  for (const { ridge, runs } of ROOFLIGHTS) for (let k = 1; k < runs.length; k++) {
    const [a, b] = [runs[k - 1][1], runs[k][0]];
    if (b - a < 4 || (a < JOINT.z1 && b > JOINT.z0)) continue;
    object('turbineVent', ridge, a + 0.5, a, RIDGE_Y - 0.05);
  }
  for (const [ridge, zs] of [[RIDGES[0], [242, 243.6, 262, 263.6, 265.2, 300, 301.6, 333, 334.6, 336.2, 358, 359.6]], [RIDGES[1], [248, 249.6, 270, 271.6, GUST_Z - 5.2, GUST_Z + 5.2]]] as [number, number[]][])
    for (const z of zs) object('turbineVent', ridge, z, z, RIDGE_Y - 0.05);

  // Between the two crests, down in their valley, what the storm has brought: a neighbour's water tank off a house's roof,
  // rolled into it on its side; a tarpaulin off a stall's awning in a heap; a sheet of plywood and a sheet of tin from the
  // harbour. The tank and the tarpaulin either side of the way from the one crest's gap to the other's, the boards on it.
  object('waterTank', 28.3, 366.4, Math.PI / 2 + 0.3, EAVE, { tilt: Math.PI / 2 });
  object('tarpHeap', 28.4, 356.6, 0.4, EAVE);
  object('plyBoard', 28.4, 360.4, 1.2, EAVE + 0.05, { tilt: Math.PI / 2 });
  object('tinSheet', 25.6, 363.4, 2.1, roofY(25.6) + 0.1);
  // Pigeons sheltering from the wind on the lee of each crest: off as the truck comes over.
  object('pigeons', 32.5, 359.4, 0.3, roofY(32.5));
  object('pigeons', 20.8, 364.6, 1.7, roofY(20.8));

  // Down the valley, one after another.  // Down the valley, one after another. A ventilator off the ridge, down in it.
  object('turbineVent', VALLEY + 0.3, 345.5, 0.6, EAVE + 0.3, { tilt: Math.PI / 2 });
  object('turbineVent', VALLEY - 0.6, 332.6, 1.4, roofY(VALLEY - 0.6) + 0.3, { tilt: Math.PI / 2 });
  // The repair men's pile on its east side: new sheet stacked on the slope, their ladder down the valley, their paint, a
  // roll of membrane, their toolbox: what they had up here to see to the leaks before the storm.
  // Bundles of it on their timber bearers, out from the valley's foot, as the crane set them down in two lifts, one on
  // either side: no way over, round each by the other slope, a skylight up it. 10 m between them to swing across.
  // Set level on their bearers, shimmed up on the slope's side, a metre up it from the valley's foot.
  const stack = (side: -1 | 1, z0: number, z1: number, color: number) => {
    const near = VALLEY + side * 0.7, far = VALLEY + side * 3.4, x0 = Math.min(near, far), x1 = Math.max(near, far);
    box(x0, EAVE - 0.1, z0, x1, EAVE + 0.85, z1, color);
    for (let k = 0; k < 8; k++) box(x0 - 0.01, EAVE + 0.2 + k * 0.08, z0 - 0.01, x1 + 0.01, EAVE + 0.205 + k * 0.08, z1 + 0.01, tone(color), { ghost: true });
    for (const z of [z0 + 0.5, (z0 + z1) / 2, z1 - 0.5]) box(x0 - 0.05, EAVE - 0.1, z - 0.07, x1 + 0.05, EAVE + 0.14, z + 0.07, 0x7a5a3c, { ghost: true });
  };
  stack(-1, 337, 341, 0xb4bcc0);
  stack(1, 321.5, 327, 0x9aa4ab);
  // Their ladder down the valley between the stacks; their paint and membrane up on the stacks, the toolbox at a stack's foot.
  object('ladder', VALLEY + 0.2, 330.4, 0.25, EAVE + 0.02);
  for (const [x, z, kind] of [[VALLEY - 2.2, 338, 'membraneRoll'], [VALLEY - 1.2, 339.6, 'membraneRoll'], [VALLEY + 1, 326.2, 'paintPail'], [VALLEY + 1.5, 325.6, 'paintPail'], [VALLEY + 2.2, 323, 'paintPail']] as [number, number, ObjectKindId][]) object(kind, x, z, 0.2, EAVE + 0.86);
  object('toolbox', VALLEY - 0.8, 328.4, 0.3, EAVE + 0.02);
  // Where the wind comes over the west ridge: its tyres and sandbags laid down its east slope, to be brought down.
  for (const [dz, kind] of [[-3.6, 'tyre'], [-1.2, 'sandbag'], [1.2, 'tyre'], [3.6, 'sandbag'], [0, 'tyre']] as [number, ObjectKindId][]) object(kind, RIDGES[1] + 1.6 + (dz === 0 ? 1.4 : 0), GUST_Z + dz, dz, roofY(RIDGES[1] + 1.6 + (dz === 0 ? 1.4 : 0)) + 0.02);
  // Where it leaked worst, before the storm: the rusted sheet off that slope, and over the hole a blue-and-white striped
  // tarpaulin, the kind every hardware shop sells, from near the ridge down into the valley and a little up the far side
  // for the water. Battens across the valley screwed down through it; its top edge tied by its eyelets to sandbags up by
  // the ridge, not well: one corner loose, lifting, and the wind got in under it between the battens. A tyre or two on it.
  {
    const R = RIDGES[1], STRIPE = 0.45, Z0 = 302.7, Z1 = 310.3, UP = 0.86, OVER = 0.22, n = Math.round((Z1 - Z0) / STRIPE);
    const foot = VALLEY, at = (f: number, lift: number): [number, number] => [foot + (R - foot) * f, EAVE + RISE * f + lift];
    const color = (k: number) => (k % 2 ? 0xe4e8ea : 0x2f6fb0);
    // Its stripes, their ends ragged where it was cut and pulled: the top edge in and out, the ends turned under shorter.
    const tops: number[] = [];
    for (let k = 0; k < n; k++) {
      const z0 = Z0 + k * STRIPE, z1 = z0 + STRIPE, lift = 0.02 + (k % 2) * 0.003;
      const top = UP - 0.04 + hash(k, 1, 7) * 0.06 - (k === 0 ? 0.05 : 0);
      tops.push(top);
      onSlope(R, 1, 0, k === n - 1 ? 0.78 : top, z0, z1, lift, 0.01, color(k), { ghost: true });
      onSlope(RIDGES[2], -1, 0, OVER - 0.04 + hash(k, 2, 7) * 0.05, z0, z1, lift, 0.01, color(k), { ghost: true });
    }
    // The loose corner, the last stripe's top lifted off the slope.
    {
      const [hx, hy] = at(0.78, 0.02), t = tilt + 0.5, len = 0.7, z0 = Z1 - STRIPE;
      props.push({ shape: 'box', size: [len / 2, 0.005, STRIPE / 2], pos: [hx - Math.cos(t) * len / 2, hy + Math.sin(t) * len / 2, z0 + STRIPE / 2], rot: [0, 0, -t], color: color(n - 1), ghost: true });
    }
    // Where the wind has got under it: puffed up between the battens, high on the slope above their ends, each stripe lifted
    // in a low ridge across the slope, highest in the middle of the puff.
    for (const zc of [304.8, 307.6]) for (let k = 0; k < n; k++) {
      const zm = Z0 + (k + 0.5) * STRIPE, d = (zm - zc) / 1.15;
      if (Math.abs(d) >= 1) continue;
      const h = 0.18 * Math.cos((d * Math.PI) / 2), half = 0.5, [px, py] = at(0.74, 0.025 + h);
      for (const dir of [-1, 1]) {
        // From the crest down to the tarpaulin either side, along the slope: dir -1 toward the valley, 1 toward the ridge.
        const t = tilt - dir * Math.atan2(h, half), long = Math.hypot(half, h);
        props.push({ shape: 'box', size: [long / 2, 0.005, STRIPE / 2], pos: [px + Math.cos(tilt) * dir * -half / 2, py - h / 2 + Math.sin(tilt) * dir * half / 2, zm], rot: [0, 0, -t], color: color(k), ghost: true });
      }
    }
    // The eyelets along its top edge, and the ropes from two of them, yellow nylon, up to the sandbags.
    for (let k = 0; k < n - 1; k += 2) {
      const [x, y] = at(tops[k] - 0.015, 0.03);
      props.push({ shape: 'cylinder', size: [0.035, 0.008, 0], pos: [x, y, Z0 + (k + 0.5) * STRIPE], rot: [0, 0, -tilt], color: 0x9aa0a6, ghost: true });
    }
    for (const [k, z] of [[0, 302.6], [n - 3, 309.6]]) {
      const [x, y] = at(tops[k] - 0.015, 0.04), [sx, sy] = at(0.95, 0.12);
      rod([x, y, Z0 + (k + 0.5) * STRIPE], [sx, sy, z], 0.012, 0xd8b84a, { ghost: true });
      object('sandbag', sx, z, 0.2 * k, roofY(sx) + 0.05);
    }
    // The battens: lengths of timber, not cut to match, over the tarpaulin's edge rolled round them on the near slope and
    // across the valley onto the far one, screwed down.
    for (const [z, len, wood] of [[303.4, 0.6, 0x8a6a48], [306.2, 0.66, 0x7d6040], [309, 0.55, 0x8f7050]] as [number, number, number][]) {
      onSlope(R, 1, 0, len, z - 0.07, z + 0.07, 0.17, 0.12, wood, { wheelsOnly: true });
      onSlope(RIDGES[2], -1, 0, OVER - 0.02, z - 0.07, z + 0.07, 0.17, 0.12, wood, { wheelsOnly: true });
      onSlope(R, 1, 0, len, z - 0.11, z + 0.11, 0.06, 0.06, 0x2a5f9e, { ghost: true });
      for (let f = 0.06; f < len; f += 0.12) onSlope(R, 1, f, f + 0.006, z - 0.015, z + 0.015, 0.176, 0.01, 0x3a3f46, { ghost: true });
    }
    // A tyre on it either side, below the puffs, out of the way of the valley.
    for (const [f, z] of [[0.45, 304.9], [0.5, 307.7]]) {
      const [x] = at(f, 0);
      object('tyre', x, z, z, roofY(x) + 0.05);
    }
  }
  // At its foot, its outlet stopped up with leaves and a plastic bag: the water standing over it, ankle deep.
  const pools: NonNullable<LevelDef['pools']> = [
    { area: [VALLEY - 1.8, JOINT.z1 + 2, VALLEY + 1.8, JOINT.z1 + 8], surface: EAVE + 0.12, tint: 0x8a8670, flow: [0, -0.05], rain: true },
    // The joint's gutters, running west.
    { area: [HALL.x0, JOINT.z0 + 0.02, HALL.x1, JOINT.z0 + 0.48], surface: EAVE - 0.1, tint: 0x8f8b76, flow: [-0.6, 0], rain: true },
    { area: [HALL.x0, JOINT.z1 - 0.48, HALL.x1, JOINT.z1 - 0.02], surface: EAVE - 0.1, tint: 0x8f8b76, flow: [-0.6, 0], rain: true },
  ];
  const fords: FordDesc[] = [{ pos: [VALLEY, JOINT.z1 + 5], half: [2.2, 3], flow: [0, 0], drag: 0.3, grip: 0.6, sideGrip: 0.6, y: EAVE + 0.7 }];
  object('basin', VALLEY + 0.6, JOINT.z1 + 5, 0.4, EAVE + 0.05);
  // The joint, west to the canopy: a ventilator and a tyre stack blown into it, a drum.
  object('turbineVent', VALLEY - 11, JOINT.z0 + 3, 2, EAVE, { tilt: Math.PI / 2 });
  object('tyreStack', VALLEY - 15.5, JOINT.z1 - 2.2, 0.3);
  object('waterDrum', VALLEY - 18.6, JOINT.z0 + 1.6);

  // The wind out of the west, over the west ridge into the valley and across it: off the far side of the ridge more of
  // the roof's weights, and sheets. Nothing shows it coming: it is not strong here.
  const gz = GUST_Z;
  const gusts: GustDesc[] = [{
    from: [HALL.x0 - 4, gz],
    mouth: [RIDGES[1], gz],
    to: [RIDGES[2], gz],
    half: 4.5,
    spread: 5.5,
    period: 6.5,
    beats: [[1, 2.2]],
    take: 3,
    force: 1100,
    wakes: 45,
    floor: EAVE,
    flags: [],
    feed: {
      at: [[RIDGES[1] - 3.5, RIDGE_Y + 0.4, gz - 2.5], [RIDGES[1] - 3.5, RIDGE_Y + 0.4, gz + 0.5], [RIDGES[1] - 3.5, RIDGE_Y + 0.4, gz + 3]],
      kinds: ['tyre', 'sandbag', 'tyre', 'tinSheet', 'tyre', 'sandbag'],
      each: 2,
      push: [[5, 1.4, 0], [4.5, 1.6, 0.4], [5.5, 1.2, -0.4]],
    },
  }];
  return { props, objects, gusts, pools, fords, skylights, signs };
}
