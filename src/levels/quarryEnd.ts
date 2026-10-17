import { containerModel } from './city';
import type { ObjectKindId } from './objects';
import { CONCRETE, hash, HAUL, type Site } from './quarryParts';
import type { Look } from './relief';
import type { FinishZone, LevelDef, PropDesc, SignDesc, Vec2 } from './types';

// Level 3, its second half: from the melon field on the sand bar, over the main channel by the haul road's steel bridge,
// and up through a building site to its delivery on a roof. The way, in order:
//
//   the sand bar       the melon field, the growers at work: a quiet stretch, melons to smash at the track's edges
//   E  the bridge      the haul road's steel bridge, 250 m, a low kerb and no rail: lorries come at the truck down
//                      either lane in turn, fast, and it must keep changing lanes to miss them; the plates' joints jolt
//   the site yard      in at the site's gate, through its yard of building stuff: a quiet stretch, things to knock over
//   F  the buildings   up a ramp round the first building's side and over its first floor; over the hanging bridge,
//                      rocking, to the second; up its side and round on to its second floor, with holes in it; along it
//                      to the unfinished walkway, and over its gap on to the third building's roof
//   the roof           the delivery bay, nothing in the way
//
// Heights: the sand bar at 0, the far bank and the site at 1.5; the bridge's deck at 1.5. The buildings' floors at 6 and
// 10.5; the third's roof, lower, at 9.

/** The squares this half adds to the map, and what they are. */
export const SAND_Y = 0, SITE_Y = 1.5;
/** The site's ground nobody drives on but by falling to it: the run is over there. */
export const DROP: Look = { tag: 'drop', color: 0x8a7f6a, wall: 0x6f6550 };
export const SITE_YARD: Look = { tag: 'gravel', color: 0x9c9384, wall: 0x7d7466 };
const DECK: Look = { tag: 'paved', color: 0x6a7076, wall: 0x4f555b };

const STEEL = 0x8c9096, DARK = 0x2a2e34, CONC = 0xb4b6b0, WHITE = 0xe8e8e2;

/** The haul road and its bridge: along x; the lanes either side of its middle; the deck from and to; the sheds the lorries come and go by. */
const ROAD_X = 128, LANE = 2.1;
const DECK_FROM = 1096, DECK_TO = 1352, DECK_Y = SITE_Y, DECK_WIDE = 8;
const SHED_S = { z0: 1034, z1: 1062 }, SHED_N = { z0: 1446, z1: 1478 };

/** The buildings. Their floors' heights. */
const F2 = SITE_Y + 4.5, F3 = SITE_Y + 9, ROOF3 = SITE_Y + 6;
/** The first, its ramp up its east side and the landing at its head. */
const B1 = { x0: 46, x1: 76, z0: 1448, z1: 1488 };
const R1 = { x0: 76, x1: 82.5, z0: 1436, z1: 1476 };
const L1 = { x0: 76, x1: 90, z0: 1476, z1: 1494 };
/** The plate from the first's floor to the platform by the second: from and to, its middle line; how wide (the truck's
 * wheels are 2.7 m apart). */
const SWAY = { x0: 28, x1: 46, z: 1468 };
const PLATE = 3.4;
/** Wide enough to turn on, off the bridge and round on to the ramp. */
const P2 = { x0: 14, x1: 28, z0: 1454, z1: 1480 };
/** The second, its ramp up from the platform, and the landing at its head round on to its upper floor. */
const B2 = { x0: -16, x1: 14, z0: 1440, z1: 1500 };
const R2 = { x0: 15.5, x1: 22, z0: 1480, z1: 1510 };
/** The upper floor's columns across, the lanes between them; its holes. */
const B2_COLS = [-15.7, -10.6, -1.4, 6.2, 13.7];
const B2_ROWS = [1440.3, 1453.5, 1466.7, 1480, 1499.7];
/** Bays of it poured this morning, still wet, each the width of a lane between the columns: x0, z0, x1, z1. */
const WET_BAYS: [number, number, number, number, boolean][] = [
  [-10.1, 1484, -1.9, 1494, false],
  [-1.0, 1468, 5.8, 1478, false],
  [6.6, 1455, 13.3, 1464, false],
  [-15.3, 1456, -11, 1464, false],
];
/** The unfinished walkway off the second's upper floor, the gap at its end, the third's roof beyond it. */
const STUB = { x0: -10, x1: -2, z0: 1432, z1: 1440 };
export const GAP = 17;
/** How far the stub's lip rises over its last 3.5 m. */
const KICK = 0.9;
const B3 = { x0: -16, x1: 14, z0: 1384, z1: STUB.z0 - GAP };
/** On its roof: the two rows of stuff across it, the first from the west side to here, the second from here to the east; and
 * the bay, a slot at the front, its middle and half its size. */
const ROW1_Z = 1403, ROW1_TO = -2, ROW2_Z = 1395.5, ROW2_FROM = 3;
const BAY: Vec2 = [-10, 1389], BAY_HALF: Vec2 = [1.7, 3.2];
/** The site's yard, and the gate into it off the haul road. */
const YARD = { x0: 72, x1: 120, z0: 1384, z1: 1440 };
const GATE = { z0: 1386, z1: 1402 };

const rect = (x0: number, z0: number, x1: number, z1: number): Vec2[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

export interface EndBuilt {
  finish: FinishZone;
  wet: NonNullable<LevelDef['wet']>;
  route: Vec2[];
  checkpoints: NonNullable<LevelDef['checkpoints']>;
  pools: NonNullable<LevelDef['pools']>;
}

/** Lays the second half: its ground, its ways and everything on them. `from` is where the crossing comes out on the sand bar. */
export function secondHalf(s: Site, signs: SignDesc[], from: Vec2): EndBuilt {
  const { relief } = s;

  // ---- The sand bar ----
  // The track up from the crossing through the melon field, bending east on to the haul road at the bridge's foot.
  const merge: Vec2 = [ROAD_X - 3.6, 1080];
  relief.ribbon([{ x: from[0], z: from[1], h: SAND_Y }, { x: from[0], z: 1052, h: SAND_Y, round: 10 }, { x: merge[0], z: merge[1], h: SAND_Y }], 5.5, HAUL);
  melonField(s, from);
  for (const [a, c] of [[-56, -40], [168, 152]] as const) relief.area(rect(Math.min(a, c), 1016, Math.max(a, c), 1096), (x) => 3 * Math.max(0, Math.min(1, (x - c) / (a - c))), { tag: 'earth', color: 0x7c8f58, wall: 0x6a6450 });

  // ---- E: the haul road and its bridge ----
  // The road from the shed on the sand bar north to the bridge, up on to it; the bridge; on to the far bank and past the
  // site's gate to the shed at the other end, where the lorries come from.
  const south = relief.ribbon([{ x: ROAD_X, z: SHED_S.z0 + 2, h: SAND_Y }, { x: ROAD_X, z: DECK_FROM - 16, h: SAND_Y }, { x: ROAD_X, z: DECK_FROM, h: DECK_Y }], 8, HAUL);
  for (const side of ['left', 'right'] as const) relief.slope(south[side], side, { run: 2.5, to: 'land' }, HAUL);
  relief.deck([{ x: ROAD_X, z: DECK_FROM - 0.5, h: DECK_Y }, { x: ROAD_X, z: DECK_TO + 0.5, h: DECK_Y }], DECK_WIDE, 0.8, DECK);
  relief.ribbon([{ x: ROAD_X, z: DECK_TO, h: DECK_Y }, { x: ROAD_X, z: SHED_N.z1 - 2, h: SITE_Y }], 8, HAUL);
  bridge(s, signs);
  // The lorries: down either lane, both the same way, out of the far shed and into the near one; one lane's a little behind
  // the other's, so that they come at the truck in either lane in turn.
  // The second lane's keep well behind the first's, never level with them, so that there is always a way between.
  const first = s.traffic.length;
  for (const [n, x] of [ROAD_X - LANE, ROAD_X + LANE].entries()) s.traffic.push({ from: [x, SHED_N.z1 - 4], to: [x, SHED_S.z0 + 6], cars: 4, speed: 20, kinds: ['dumpTruck', 'dumpTruck', 'dumpTruck', 'dumpTruck'], respawn: first + n, ...(n ? { keepFrom: { lane: first, gap: 40 } } : {}) });
  for (const [z0, z1, open] of [[SHED_S.z0, SHED_S.z1, 1], [SHED_N.z0, SHED_N.z1, -1]] as const) shed(s, z0, z1, open, open > 0 ? SAND_Y : SITE_Y);

  // ---- The site ----
  relief.area(rect(YARD.x0, YARD.z0, YARD.x1, YARD.z1), SITE_Y, SITE_YARD);
  relief.area(rect(72, 1440, 88, 1456), SITE_Y, SITE_YARD);
  // Its way in, off the haul road.
  relief.ribbon([{ x: ROAD_X - 3, z: (GATE.z0 + GATE.z1) / 2, h: SITE_Y }, { x: YARD.x1 - 6, z: (GATE.z0 + GATE.z1) / 2, h: SITE_Y }], 9, CONCRETE);
  // Under the third building's front, outside the hoarding: what falls off the roof there has fallen as far.
  relief.area(rect(-20, 1372, 18, 1384), SITE_Y, { tag: 'drop', color: 0x6a8048, wall: 0x6a6450 });
  siteYard(s);
  buildings(s, signs);
  siteGrounds(s);

  // The main channel's water, running west.
  const pools: EndBuilt['pools'] = [{ area: [-60, DECK_FROM - 2, 172, DECK_TO + 2], surface: -0.15, tint: 0x4f8fa8, flow: [-1.1, 0] }];
  return {
    finish: { pos: BAY, half: BAY_HALF, above: ROOF3 - 1 },
    route: [from, [from[0], 1052], merge, [ROAD_X - LANE, DECK_FROM], [ROAD_X - LANE, DECK_TO], [ROAD_X, (GATE.z0 + GATE.z1) / 2], [(R1.x0 + R1.x1) / 2, YARD.z0 + 12], [(R1.x0 + R1.x1) / 2, R1.z1], [B1.x0, SWAY.z], [P2.x0, SWAY.z], [(R2.x0 + R2.x1) / 2, R2.z1], [-6, 1514], [-6, STUB.z0], [-6, B3.z0 + 12]],
    checkpoints: [
      { name: 'E 便橋', pos: [ROAD_X - LANE, 1060], yaw: 0 },
      { name: 'F 工地', pos: [ROAD_X - LANE, (GATE.z0 + GATE.z1) / 2 - 12], yaw: 0 },
      { name: 'F 鋼板', pos: [B1.x0 + 8, SWAY.z], yaw: -Math.PI / 2, y: F2 },
      { name: 'F 二號樓', pos: [4, 1516], yaw: -Math.PI / 2, y: F3 },
    ],
    pools,
    wet: WET_BAYS.map(([x0, z0, x1, z1]) => ({ area: [x0, z0, x1, z1] as [number, number, number, number], y: F3 + 0.74, drag: 0.9, grip: 0.45 })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------

/** The melon field: ridges of sand under straw, the vines along them, the melons; the growers' stall, their cart, their pump and shed. */
function melonField(s: Site, from: Vec2): void {
  const { props, decals } = s;
  const Y = SAND_Y;
  const LEAVES = [0x4f7a38, 0x5f8a3f, 0x6f9a48];
  /** A block of ridges running north, from x0 to x1, between z0 and z1, melons along them: in the field itself, every one of them
   *  can be run into and burst; in the plots beyond, out at the bar's edge, they are only to be looked at. */
  const block = (x0: number, x1: number, z0: number, z1: number, k: number, real = true) => {
    for (let x = x0 + 0.8, i = 0; x < x1 - 0.5; x += 1.8, i++) {
      const long = z1 - z0;
      props.push({ shape: 'box', size: [0.55, 0.12, long / 2], pos: [x, Y + 0.1, (z0 + z1) / 2], color: 0xc9b07a, ghost: true });
      decals.push({ pos: [x, (z0 + z1) / 2], size: [0.5, long], color: 0x8a7a58, base: Y, y: 0.02 });
      for (let z = z0 + 0.8, j = 0; z < z1 - 0.6; z += 1.1, j++) {
        const h = hash(i + k, j);
        decals.push({ pos: [x + (hash(j, i + k) - 0.5) * 0.8, z], size: [0.9 + h * 0.6, 0.7 + hash(i, j + k) * 0.5], rotY: h * 3, color: LEAVES[(i + j) % 3], base: Y, y: 0.03 + (j % 3) * 0.01 });
        if (h < 0.32) {
          const mx = x + (hash(j + 3, i) - 0.5) * 0.5;
          if (real) s.object('melon', mx, z, h * 6, Y + 0.12);
          else props.push({ shape: 'sphere', size: [0.25, 0.22, 0.25], pos: [mx, Y + 0.34, z], rot: [Math.PI / 2, h * 6, 0], color: 0xffffff, texture: 'melon', ghost: true });
        }
      }
    }
  };
  const tx = from[0];
  // West of the track, two blocks; east of it, between it and the haul road, one; and round the bend, north of it.
  block(42, tx - 12, 1034, 1050, 1);
  block(42, tx - 3.6, 1054, 1090, 2);
  block(tx + 3.6, 112, 1034, 1048, 3);
  block(98, 114, 1072, 1092, 4);
  // West of the growers' shed, and east past the lorries' shed: the rest of the bar farmed in plots of all sizes, each its
  // own crop or its own stage, as a river bar's growers have it. Melons, peanuts, sweet potatoes heaped in ridges, rows under
  // black plastic with the seedlings through it, low white tunnels over the young plants; a plot left fallow with the
  // tractor's marks on it, one new ploughed. Tracks between them; bamboo windbreaks across the bar against the river's wind.
  {
    const GREEN = [0x4f7a38, 0x5f8a3f, 0x6f9a48, 0x587f3c];
    const plot = (x0: number, x1: number, z0: number, z1: number, kind: string, k: number, alongX = false) => {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, l = z1 - z0;
      /** A row across the plot, n of them, as the plot runs. */
      const rows = (step: number, each: (at: number, i: number) => void) => {
        const from = alongX ? z0 : x0, to = alongX ? z1 : x1;
        for (let a = from + step / 2, i = 0; a < to - step / 3; a += step, i++) each(a, i);
      };
      const strip = (at: number, wide: number, color: number, y: number) => decals.push({ pos: alongX ? [cx, at] : [at, cz], size: alongX ? [w - 0.6, wide] : [wide, l - 0.6], color, base: Y, y });
      const ridge = (at: number, wide: number, high: number, color: number) => props.push({ shape: 'box', size: alongX ? [w / 2 - 0.3, high, wide / 2] : [wide / 2, high, l / 2 - 0.3], pos: alongX ? [cx, Y + high * 0.6, at] : [at, Y + high * 0.6, cz], color, ghost: true });
      switch (kind) {
        case 'melon':
          block(x0, x1, z0, z1, k, false);
          break;
        case 'peanut':
          decals.push({ pos: [cx, cz], size: [w, l], color: 0x9a8058, base: Y, y: 0.015 });
          rows(0.9, (at, i) => strip(at, 0.55, GREEN[(i + k) % 4], 0.025 + (i % 2) * 0.003));
          break;
        case 'potato':
          rows(1.6, (at, i) => {
            ridge(at, 1.0, 0.22, 0x8f7a56);
            for (let n = 0; n < (alongX ? w : l) / 1.1; n++) {
              const t = (alongX ? x0 : z0) + 0.6 + n * 1.1 + hash(i, n + k) * 0.4;
              decals.push({ pos: alongX ? [t, at] : [at, t], size: [0.9 + hash(n, i) * 0.4, 0.8 + hash(i + k, n) * 0.4], rotY: hash(n, k) * 3, color: GREEN[(n + i) % 4], base: Y + 0.3, y: 0.01 + (n % 3) * 0.004 });
            }
          });
          break;
        case 'mulch':
          decals.push({ pos: [cx, cz], size: [w, l], color: 0x8a7556, base: Y, y: 0.015 });
          rows(1.5, (at, i) => {
            ridge(at, 0.9, 0.1, 0x24262a);
            for (let n = 0; n < (alongX ? w : l) / 0.8 - 1; n++) {
              const t = (alongX ? x0 : z0) + 0.8 + n * 0.8;
              props.push({ shape: 'cone', size: [0.13, 0.12, 0], pos: alongX ? [t, Y + 0.28, at] : [at, Y + 0.28, t], color: GREEN[(n + i + k) % 4], ghost: true });
            }
          });
          break;
        case 'tunnel':
          decals.push({ pos: [cx, cz], size: [w, l], color: 0x8a7556, base: Y, y: 0.015 });
          rows(2.2, (at) => props.push({ shape: 'cylinder', size: [0.55, (alongX ? w : l) / 2 - 0.6, 0], pos: alongX ? [cx, Y - 0.05, at] : [at, Y - 0.05, cz], rot: alongX ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0], color: 0xe4e8e2, ghost: true }));
          break;
        case 'plough':
          decals.push({ pos: [cx, cz], size: [w, l], color: 0x7a6448, base: Y, y: 0.015 });
          rows(0.7, (at, i) => strip(at, 0.18, i % 2 ? 0x5f4e38 : 0x8a7454, 0.025));
          break;
        default:
          // Left fallow: the tractor's wheel marks across it, a few weeds come up.
          for (let n = 0; n < 3; n++) for (const off of [-0.9, 0.9]) decals.push({ pos: [cx + off + (n - 1) * 3.4, cz], size: [0.35, l - 1], color: 0xb8a67c, base: Y, y: 0.02 });
          for (let n = 0; n < 10; n++) props.push({ shape: 'cone', size: [0.2, 0.2, 0], pos: [x0 + 1 + hash(n, k) * (w - 2), Y + 0.2, z0 + 1 + hash(k, n) * (l - 2)], color: GREEN[n % 4], ghost: true });
      }
    };
    // The plots: x0, x1, z0, z1, crop, along x.
    const PLOTS: [number, number, number, number, string, boolean][] = [
      [-48, -26, 1034, 1048, 'peanut', false], [-24, -6, 1034, 1046, 'mulch', true], [-4, 20, 1034, 1048, 'melon', false],
      [22, 39, 1034, 1046, 'tunnel', true], [-48, -32, 1050, 1060, 'fallow', false], [-30, -6, 1050, 1060, 'potato', true],
      [-4, 18, 1050, 1058, 'plough', true], [-48, -34, 1066, 1090, 'melon', false], [-32, -12, 1066, 1078, 'tunnel', false],
      [-32, -12, 1080, 1090, 'peanut', true], [-10, 12, 1066, 1090, 'potato', false], [14, 26, 1072, 1090, 'mulch', false],
      [138, 152, 1066, 1078, 'peanut', true], [138, 152, 1080, 1090, 'melon', false],
    ];
    PLOTS.forEach(([x0, x1, z0, z1, kind, alongX], k) => plot(x0, x1, z0, z1, kind, k + 11, alongX));
    // The tracks between: worn into the sand, a little darker.
    for (const [x, z, sx, sz] of [[-4, 1063, 88, 3.4], [-5, 1049, 4, 30], [-34, 1062, 3, 56], [13, 1078, 3, 24]] as const) decals.push({ pos: [x, z], size: [sx, sz], color: 0xb39e74, base: Y, y: 0.012 });
    // Bamboo windbreaks across the bar, posts and slats with the dry leaves woven in.
    const windbreak = (a: Vec2, b: Vec2) => {
      const long = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
      for (let d = 1; d < long; d += 2.05) s.object('windbreak', a[0] + ((b[0] - a[0]) * d) / long, a[1] + ((b[1] - a[1]) * d) / long, yaw - Math.PI / 2);
    };
    windbreak([-50, 1064.6], [-20, 1064.6]);
    windbreak([-12, 1064.6], [24, 1064.6]);
    windbreak([-50, 1049], [-36, 1049]);
    windbreak([136, 1064], [154, 1064]);
    // The growers about it: someone in each of a few plots, the scooter they came on, water drums and the hose.
    for (const [x0, z0] of [[-37.5, 1038.5], [-20, 1070], [0, 1080], [-26, 1054]] as const) s.crowds.push({ area: [x0, z0, x0 + 6, z0 + 4], count: 1, y: Y, fenced: true });
    for (const [x, z] of [[-35, 1063.6], [12, 1062]] as const) s.object('scooterRed', x, z, Math.PI / 2);
    for (const [x, z] of [[-6, 1050], [-6, 1051], [24, 1060]] as const) s.object('waterDrum', x, z);
  }
  // The growers' stall by the track: a sunshade over a table, melons heaped on it and under it, the scale, baskets; their
  // cart loaded beside it; growers bringing them in from the rows.
  const [sx, sz] = [tx - 7.5, 1040];
  box(props, [2.4, 0.05, 1.9], [sx, Y + 2.7, sz], 0x2f7a5a, { ghost: true, overhead: true, fade: true });
  for (const [dx, dz] of [[-2.2, -1.7], [2.2, -1.7], [-2.2, 1.7], [2.2, 1.7]]) box(props, [0.05, 1.35, 0.05], [sx + dx, Y + 1.35, sz + dz], STEEL);
  box(props, [1.7, 0.4, 0.6], [sx, Y + 0.4, sz - 0.9], 0x9a7448);
  box(props, [0.25, 0.15, 0.25], [sx + 1.2, Y + 0.95, sz - 0.9], 0xd8d8d8, { ghost: true });
  for (let n = 0; n < 7; n++) s.object('melon', sx - 1.3 + (n % 4) * 0.55, sz - 0.9 + (n < 4 ? -0.15 : 0.2), 0, Y + 0.8 + (n < 4 ? 0 : 0.3));
  for (let n = 0; n < 12; n++) s.object('melon', sx - 1.8 + (n % 4) * 0.55, sz + 0.5 + Math.floor(n / 4) * 0.55);
  for (const [dx, dz] of [[-2.6, -0.6], [-2.6, 0.3], [-3.3, -0.2]]) s.object('box', sx + dx, sz + dz);
  s.crowds.push({ area: [sx - 1.5, sz + 2, sx + 1.5, sz + 3], count: 2, y: Y, fenced: true });
  // The cart: a two-wheeled tractor and its trailer, loaded.
  {
    const cx = tx - 7, cz = 1049;
    s.object('cart', cx, cz, 0);
    for (let n = 0; n < 8; n++) s.object('melon', cx - 0.9 + (n % 4) * 0.6, cz + 1.4 + Math.floor(n / 4) * 0.6);
  }
  // Straw bales, the scarecrows and the streamers that keep the birds off.
  for (const [x, z] of [[60, 1046], [74, 1068], [104, 1086]] as const) s.object('scarecrow', x, z, hash(x, z) * 3);
  for (const [x, z] of [[50, 1036], [66, 1078], [84, 1046], [108, 1040]] as const) s.object('flagOrange', x, z, hash(x, z) * 3);
  for (const [x, z] of [[tx - 5.2, 1034], [tx + 5.4, 1050], [tx - 5.2, 1064]] as const) s.object('haystack', x, z);
  // The pump drawing from the channel and its hose out along the ridges; the growers' shed with its washing out.
  s.object('pumpSet', 40, 1092, 0);
  props.push({ shape: 'cylinder', size: [0.06, 6, 0], pos: [40, Y + 0.08, 1086], rot: [Math.PI / 2, 0, 0], color: 0x2c4f8a, ghost: true });
  props.push({ shape: 'cylinder', size: [0.06, 12, 0], pos: [52, Y + 0.08, 1080], rot: [0, 0, Math.PI / 2], color: 0x2c4f8a, ghost: true });
  {
    const hx = 30, hz = 1062;
    box(props, [2.2, 1.3, 1.6], [hx, Y + 1.3, hz], 0x8a9aa4);
    box(props, [2.5, 0.08, 1.9], [hx, Y + 2.7, hz], 0x2f5f8a, { rot: [0.12, 0, 0] });
    box(props, [0.02, 0.9, 0.6], [hx + 2.21, Y + 0.9, hz], 0x5f6a72, { ghost: true });
    for (const dz of [-2.4, 2.4]) box(props, [0.04, 1, 0.04], [hx + 3.5, Y + 1, hz + dz], STEEL);
    box(props, [0.01, 0.01, 2.4], [hx + 3.5, Y + 1.9, hz], DARK, { ghost: true });
    for (let n = 0; n < 5; n++) box(props, [0.02, 0.32, 0.18], [hx + 3.5, Y + 1.55, hz - 1.8 + n * 0.85], [0xe8e8e2, 0x2f62a8, 0xc8372d, 0xe0b020, 0xe8e8e2][n], { ghost: true });
    for (const dz of [-2.6, -1.8]) s.object('waterDrum', hx - 2.6, hz + dz);
    s.object('farmTruck', hx + 1, hz + 5, Math.PI / 2);
  }
  // Driftwood and reeds along the bar's edge over the channel.
  for (let x = -50, n = 0; x < 120; x += 4.3, n++) {
    if (Math.abs(x - 40) < 3) continue;
    const z = 1093.5 + hash(n, 7) * 1.5;
    if (n % 3 === 0) props.push({ shape: 'cylinder', size: [0.2, 1.4 + hash(n, 3), 0], pos: [x, Y + 0.18, z], rot: [0, hash(n, 4) * 3, Math.PI / 2], color: 0x9a8a72 });
    else for (let i = 0; i < 5; i++) props.push({ shape: 'cone', size: [0.08, 0.6 + hash(n, i) * 0.4, 0], pos: [x + (hash(i, n) - 0.5) * 1.6, Y + 0.6, z + (hash(n + i, 2) - 0.5) * 1.2], color: i % 2 ? 0x8a9a4a : 0x6f8a3f, ghost: true });
  }
}

/** A box prop, put in the given list. */
function box(props: PropDesc[], size: [number, number, number], pos: [number, number, number], color: number, extra: Partial<PropDesc> = {}): void {
  props.push({ shape: 'box', size, pos, color, ...extra });
}

/** The steel bridge: its plates' joints, its kerbs and their posts, the bent bit; its piers and girders; its signs. */
function bridge(s: Site, signs: SignDesc[]): void {
  const { props, decals } = s;
  const top = DECK_Y, half = DECK_WIDE / 2;
  // Joints between the plates, standing a little proud: a jolt each at speed. Only under the truck's wheels: a lorry knocked
  // loose and sliding would catch its edge on one and be thrown over.
  for (let z = DECK_FROM + 6; z < DECK_TO - 2; z += 12) box(props, [half - 0.25, 0.05, 0.14], [ROAD_X, top + 0.05, z], 0x4a4f55, { wheelsOnly: true });
  for (let z = DECK_FROM + 3; z < DECK_TO; z += 6) decals.push({ pos: [ROAD_X, z], size: [DECK_WIDE - 0.6, 0.05], color: 0x555b61, base: top, y: 0.02 });
  decals.push({ pos: [ROAD_X, (DECK_FROM + DECK_TO) / 2], size: [0.14, DECK_TO - DECK_FROM - 2], color: 0xe8b81e, base: top, y: 0.025 });
  // The kerbs: low, steel, yellow; one bent and torn away on the west a little past the middle, its piece lying askew.
  const BENT: [number, number] = [1228, 1240];
  for (const side of [-1, 1]) {
    const x = ROAD_X + side * (half - 0.12);
    const runs: [number, number][] = side < 0 ? [[DECK_FROM, BENT[0]], [BENT[1], DECK_TO]] : [[DECK_FROM, DECK_TO]];
    for (const [a, b] of runs) {
      box(props, [0.12, 0.14, (b - a) / 2], [x, top + 0.14, (a + b) / 2], 0xe0b020);
      for (let z = a + 3; z < b - 1; z += 6) s.object('delineator', x, z, 0, top + 0.28);
    }
  }
  box(props, [0.12, 0.14, 2.6], [ROAD_X - half + 0.5, top + 0.12, BENT[0] + 4], 0xe0b020, { rot: [0, 0.35, 1.2], ghost: true });
  for (const z of [BENT[0] - 3, BENT[1] + 3]) s.object('cone', ROAD_X - half + 0.5, z, 0, top);
  // Under it: two girders along it, a pier every 24 m standing in the water.
  for (const side of [-1, 1]) box(props, [0.25, 0.45, (DECK_TO - DECK_FROM) / 2], [ROAD_X + side * (half - 0.7), top - 1.25, (DECK_FROM + DECK_TO) / 2], 0x4f555b, { ghost: true });
  for (let z = DECK_FROM + 12; z < DECK_TO - 6; z += 24) {
    box(props, [half - 0.4, 0.25, 0.4], [ROAD_X, top - 1.95, z], 0x5f656b);
    for (const side of [-1, 1]) props.push({ shape: 'cylinder', size: [0.45, 3.5, 0], pos: [ROAD_X + side * (half - 1), top - 5.5, z], color: 0x8c9096 });
  }
  // At either end: the signs, limits, and the barrels of sand that take a blow at the end of the kerb.
  for (const [z, face] of [[DECK_FROM - 8, 1], [DECK_TO + 8, -1]] as const) {
    for (const side of [-1, 1]) {
      s.object('signWarn', ROAD_X + side * 4.6, z, face > 0 ? 0 : Math.PI);
      s.object('signBlue', ROAD_X + side * 4.6, z + face * 3, face > 0 ? 0 : Math.PI);
      for (let n = 0; n < 2; n++) s.object('barrel', ROAD_X + side * (half + 0.6), z + face * (6.5 + n * 0.9));
    }
  }
  signs.push({ kind: 'works', pos: [ROAD_X + 6, SAND_Y, DECK_FROM - 18], rotY: Math.PI });
}

/** A shed the lorries drive into or out of at the haul road's end: walls three sides, its roof; open at `open`'s end. */
function shed(s: Site, z0: number, z1: number, open: 1 | -1, y: number): void {
  const { props } = s;
  const x0 = ROAD_X - 8, x1 = ROAD_X + 8, h = 7;
  for (const x of [x0, x1]) box(props, [0.15, h / 2, (z1 - z0) / 2], [x, y + h / 2, (z0 + z1) / 2], 0x8a949a);
  const back = open > 0 ? z0 : z1;
  box(props, [8, h / 2, 0.15], [ROAD_X, y + h / 2, back], 0x8a949a);
  box(props, [8.6, 0.15, (z1 - z0) / 2 + 0.4], [ROAD_X, y + h + 0.15, (z0 + z1) / 2], 0x2f5f8a, { ghost: true });
  // Over the open end, the sheeting down to the doorway; a lamp.
  const front = open > 0 ? z1 : z0;
  box(props, [8, 0.8, 0.12], [ROAD_X, y + h - 0.8, front], 0x8a949a, { ghost: true });
  box(props, [0.5, 0.15, 0.3], [ROAD_X, y + h - 1.8, front + open * 0.3], 0x3a3f45, { ghost: true });
  // Ribs on its walls.
  for (let z = z0 + 1; z < z1; z += 1.2) for (const x of [x0 - 0.17, x1 + 0.17]) box(props, [0.03, h / 2 - 0.1, 0.06], [x, y + h / 2, z], 0x6f7a80, { ghost: true });
}

/** The site's yard: the gate and its hut, the wheel wash; building stuff stacked along the way in to the ramp; the mixer lorry, the cabins, the men. */
function siteYard(s: Site): void {
  const { props, decals } = s;
  const Y = SITE_Y;
  const gz = (GATE.z0 + GATE.z1) / 2;
  // Hoarding round the site, blue sheets on posts, its gate the one way in; inside, round the yard, to keep the yard's
  // traffic off the ground under the buildings.
  const hoard = (a: Vec2, b: Vec2) => {
    const long = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    props.push({ shape: 'box', size: [0.05, 1.2, long / 2], pos: [(a[0] + b[0]) / 2, Y + 1.2, (a[1] + b[1]) / 2], rot: [0, yaw, 0], color: 0x2f62a8 });
    props.push({ shape: 'box', size: [0.06, 0.1, long / 2], pos: [(a[0] + b[0]) / 2, Y + 2.3, (a[1] + b[1]) / 2], rot: [0, yaw, 0], color: WHITE, ghost: true });
    for (let d = 0; d < long + 0.01; d += 3) box(props, [0.06, 1.3, 0.06], [a[0] + ((b[0] - a[0]) * d) / long, Y + 1.3, a[1] + ((b[1] - a[1]) * d) / long], 0x5f646a, { ghost: true });
  };
  hoard([-56, 1384.3], [119.7, 1384.3]);
  hoard([119.7, 1384.3], [119.7, GATE.z0]);
  hoard([119.7, GATE.z1], [119.7, SHED_N.z0]);
  hoard([119.7, SHED_N.z1], [119.7, 1543.7]);
  hoard([-55.7, 1384.3], [-55.7, 1543.7]);
  hoard([-55.7, 1543.7], [119.7, 1543.7]);
  hoard([YARD.x0 + 0.3, YARD.z0], [YARD.x0 + 0.3, 1455.7]);
  hoard([88, YARD.z1], [119.7, YARD.z1]);
  hoard([88, YARD.z1], [88, 1455.7]);
  hoard([YARD.x0 + 0.3, 1455.7], [R1.x0 - 0.3, 1455.7]);
  hoard([R1.x1 + 0.3, 1455.7], [88, 1455.7]);
  // The gate: posts, the barrier arm, the guard's hut; the wheel wash in the way out; a notice.
  for (const z of [GATE.z0, GATE.z1]) box(props, [0.25, 1.8, 0.25], [119.7, Y + 1.8, z], 0xe0b020);
  s.object('gateArm', 119.7, gz, 0, Y);
  box(props, [1.4, 1.3, 1.2], [116, Y + 1.3, GATE.z1 + 2.5], 0xd8d2c4);
  box(props, [1.6, 0.1, 1.4], [116, Y + 2.65, GATE.z1 + 2.5], 0x2f5f8a, { ghost: true });
  box(props, [0.02, 0.5, 0.9], [114.58, Y + 1.7, GATE.z1 + 2.5], 0x3a4a5a, { ghost: true });
  for (let x = 108; x < 116; x += 0.8) box(props, [0.12, 0.06, 3.2], [x, Y + 0.06, gz], 0x5f646a);
  decals.push({ pos: [112, gz], size: [10, 7.5], color: 0x6f7378, base: Y, y: 0.015 });
  s.crowds.push({ area: [115, GATE.z1 + 4, 117, GATE.z1 + 5], count: 1, y: Y, workers: true, fenced: true });
  // Along the way in, what is being built with, each kind in its place: rebar in bundles on bearers, formwork boards in
  // stacks, bricks on pallets, cement in bags, tiles in boxes; the cones that line the way.
  const RX = (R1.x0 + R1.x1) / 2;
  for (let n = 0; n < 6; n++) s.object('rebar', 98 + n * 2.2, gz + 6.5, Math.PI / 2);
  for (let n = 0; n < 4; n++) {
    const x = 100 + n * 3.4, z = gz - 6;
    s.object('formwork', x, z, 0);
  }
  for (const [x, z] of [[86, gz - 6], [88, gz - 6], [86, gz - 4], [RX - 5, 1410], [RX - 5, 1412.4]] as const) s.object('bricks', x, z);
  for (let n = 0; n < 6; n++) s.object('cementBag', RX + 4.6 + (n % 2) * 0.9, 1412 + Math.floor(n / 2) * 0.6, 0.1);
  for (let n = 0; n < 6; n++) s.object('box', RX - 4.8 + (n % 2) * 0.7, 1420 + Math.floor(n / 2) * 0.7);
  for (let z = 1404; z < 1434; z += 4.5) for (const side of [-1, 1]) s.object('cone', RX + side * 4.2, z);
  for (const [x, z, rot] of [[RX + 5.5, 1426, 0.3], [94, gz + 5, 1.2]] as const) s.object('wheelbarrow', x, z, rot);
  s.object('mixer', RX - 6, 1428, 0.6);
  {
    s.object('forklift', 96, 1412, Math.PI);
  }
  box(props, [1.6, 0.7, 0.9], [92, Y + 0.7, 1436], 0xd0a020);
  for (const [x, z] of [[100, 1406], [101.4, 1406], [100.7, 1407.4], [108, 1408], [109.4, 1408]] as const) s.object('bricks', x, z);
  for (const [x, z] of [[112, 1432], [114, 1432], [116, 1432]] as const) for (let i = 0; i < 3; i++) s.object('pallet', x, z, 0, Y + i * 0.15);
  props.push({ shape: 'cylinder', size: [0.14, 6, 0], pos: [118, Y + 6, 1436], color: STEEL }, { shape: 'box', size: [1.4, 0.5, 0.3], pos: [117.6, Y + 12.2, 1436], rot: [0, -0.5, 0.5], color: 0x3a3f45 });
  // The mixer lorry waiting with its drum turning, the pump beside it with its boom folded.
  {
    for (const [x, kind] of [[104, 'dumpTruck'], [112, 'van']] as const) s.traffic.push({ from: [x, 1424 - 0.25], to: [x, 1424 + 0.25], cars: 1, speed: 0, kinds: [kind] });
  }
  // The men's cabins by the hoarding, the toilets, a water cooler.
  for (const [dz, up] of [[0, 0], [2.6, 0], [1.3, 1]] as const) containerModel(props, YARD.x0 + 4, Y + up * 2.6, 1394 + dz, true, up ? 0x3f6f8a : 0xe4e0d4);
  for (const z of [1402.5, 1404]) s.object('toilet', YARD.x0 + 2.2, z);
  s.crowds.push({ area: [YARD.x0 + 8.5, 1396, YARD.x0 + 11, 1404], count: 3, y: Y, workers: true, fenced: true });
  s.crowds.push({ area: [RX - 3.5, 1416, RX - 2.5, 1432], count: 2, y: Y, workers: true });
  s.crowds.push({ area: [96, gz + 3, 112, gz + 5], count: 2, y: Y, workers: true });
}

/** The three buildings: their frames, their floors, the ramps up their sides, the hanging bridge, the gap, the roof. */
function buildings(s: Site, signs: SignDesc[]): void {
  const { props, decals, rigs } = s;
  const Y = SITE_Y;
  const box2 = (size: [number, number, number], pos: [number, number, number], color: number, extra: Partial<PropDesc> = {}) => box(props, size, pos, color, extra);
  const slab = (x0: number, z0: number, x1: number, z1: number, top: number, extra: Partial<PropDesc> = {}) => box2([(x1 - x0) / 2, 0.15, (z1 - z0) / 2], [(x0 + x1) / 2, top - 0.15, (z0 + z1) / 2], CONC, extra);
  const column = (x: number, z: number, y0: number, y1: number, extra: Partial<PropDesc> = {}) => box2([0.25, (y1 - y0) / 2, 0.25], [x, (y0 + y1) / 2, z], 0xa9aba6, extra);
  /** A ramp along z from h0 to h1: its slab, its supports; and the height of its top at a place along it. */
  const ramp = (x0: number, x1: number, z0: number, z1: number, h0: number, h1: number) => {
    const run = z1 - z0, rise = h1 - h0, long = Math.hypot(run, rise), a = Math.atan2(rise, run), t = 0.4;
    box2([(x1 - x0) / 2, t / 2, long / 2], [(x0 + x1) / 2, (h0 + h1) / 2 - t / 2 / Math.cos(a), (z0 + z1) / 2], CONC, { rot: [-a, 0, 0] });
    // A kerb along either edge, the slab's own, too high to drive over.
    for (const x of [x0 + 0.15, x1 - 0.15]) box2([0.15, 0.2, long / 2], [x, (h0 + h1) / 2 + 0.2, (z0 + z1) / 2], 0xa9aba6, { rot: [-a, 0, 0] });
    const at = (z: number) => h0 + (rise * (z - z0)) / run;
    for (let z = z0 + 6; z < z1 - 1; z += 8) for (const x of [x0 + 0.4, x1 - 0.4]) if (at(z) - 0.5 > Y + 0.5) column(x, z, Y, at(z) - 0.45);
    return at;
  };
  /** Edge guards along a line: lengths of handrail, knockable, one every 2 m, at a height. */
  const rails = (a: Vec2, b: Vec2, y: number | ((z: number) => number)) => {
    const long = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    for (let d = 1; d < long; d += 2) {
      const x = a[0] + ((b[0] - a[0]) * d) / long, z = a[1] + ((b[1] - a[1]) * d) / long;
      s.object('handrail', x, z, yaw, typeof y === 'number' ? y : y(z));
    }
  };
  /** A low concrete upstand along an edge: solid. */
  const upstand = (x0: number, z0: number, x1: number, z1: number, top: number) => box2([Math.max(0.15, (x1 - x0) / 2), 0.45, Math.max(0.15, (z1 - z0) / 2)], [(x0 + x1) / 2, top + 0.45, (z0 + z1) / 2], 0xa9aba6);
  /** Rebar standing out of a column's top, and a green safety net hung down a face. */
  const starters = (x: number, z: number, y: number) => {
    for (const [dx, dz] of [[-0.15, -0.15], [0.15, 0.15]]) box2([0.015, 0.55, 0.015], [x + dx, y + 0.55, z + dz], 0x6a4a32, { ghost: true });
  };

  // ---- The first building: two floors, its frame standing up past the second for the next ----
  const b1cols = [46.3, 56, 66, 75.7], b1rows = [1448.3, 1461.4, 1474.6, 1487.7];
  slab(B1.x0, B1.z0, B1.x1, B1.z1, F2);
  for (const x of b1cols) for (const z of b1rows) {
    column(x, z, Y, F2 - 0.3);
    // On the floor the truck goes over, the columns standing up for the floor above, the starters out of their heads.
    const edge = x === b1cols[0] || x === b1cols[3] || z === b1rows[0] || z === b1rows[3];
    if (edge) column(x, z, F2, F2 + 3.2);
    starters(x, z, edge ? F2 + 3.2 : F2);
  }
  // Its ramp up its east side to the landing at its north-east corner, the landing; rails along the ramp's open side, and
  // where the floor stands over the ramp.
  const r1 = ramp(R1.x0, R1.x1, R1.z0, R1.z1, Y, F2);
  slab(L1.x0, L1.z0, L1.x1, L1.z1, F2);
  for (const [x, z] of [[L1.x1 - 0.4, L1.z0 + 0.4], [L1.x1 - 0.4, L1.z1 - 0.4], [L1.x0 + 6, L1.z1 - 0.4]] as const) column(x, z, Y, F2 - 0.3);
  for (let z = R1.z0 + 10; z < R1.z1; z += 4) s.object('guardrail', R1.x1 - 0.6, z, 0, r1(z));
  upstand(L1.x1 - 0.15, L1.z0, L1.x1, L1.z1, F2);
  upstand(L1.x0, L1.z1 - 0.15, L1.x1, L1.z1, F2);
  upstand(R1.x1, L1.z0, L1.x1, L1.z0 + 0.15, F2);
  // Just inside the edge columns, clear of them.
  rails([B1.x1 - 0.8, B1.z0 + 1], [B1.x1 - 0.8, L1.z0], F2);
  rails([B1.x0 + 1, B1.z0 + 0.8], [B1.x1 - 1, B1.z0 + 0.8], F2);
  rails([B1.x0 + 1, B1.z1 - 0.8], [L1.x0 - 1, B1.z1 - 0.8], F2);
  rails([B1.x0 + 0.8, B1.z0 + 1], [B1.x0 + 0.8, SWAY.z - 2.6], F2);
  rails([B1.x0 + 0.8, SWAY.z + 2.6], [B1.x0 + 0.8, B1.z1 - 1], F2);
  // What is on its floor: the fitting-out going in. Tiles in boxes on pallets, glass in its racks, bathroom fittings in
  // their crates, paint, bricks, the men at work.
  const things: [ObjectKindId, number, number, number][] = [
    ['bricks', 67, 1476, 0], ['bricks', 67, 1478.2, 0], ['bricks', 61, 1467.5, 0.1],
    ['paintWhite', 55, 1461, 0], ['paintYellow', 55.5, 1461.6, 0], ['paintBlue', 54.6, 1461.8, 0], ['paintWhite', 66.5, 1470.5, 0],
    ['cementBag', 49, 1476, 0], ['cementBag', 49, 1476.6, 0], ['cementBag', 49.9, 1476.3, 0.2],
    ['wheelbarrow', 61, 1484, 2.4], ['mixer', 50, 1459, 0.5], ['rebar', 58, 1452, Math.PI / 2], ['rebar', 58, 1452.8, Math.PI / 2],
  ];
  for (const [kind, x, z, r] of things) s.object(kind, x, z, r, F2);
  for (let n = 0; n < 8; n++) s.object('box', 72 + (n % 2) * 0.7, 1458 + Math.floor(n / 2) * 0.7, 0, F2);
  // A glass rack: an A-frame, the sheets leaning on it, blue.
  for (const [gx, gz] of [[49.5, 1452.5], [73, 1452.5]] as const) {
    s.object('glassRack', gx, gz, 0, F2);
  }
  s.crowds.push({ area: [53, 1450, 70, 1454], count: 3, y: Y, raised: F2 - Y, workers: true, fenced: true });
  s.crowds.push({ area: [47, 1480, 56, 1486], count: 2, y: Y, raised: F2 - Y, workers: true, fenced: true });
  // Its north face hung with green netting to the ground; the scaffold up its south face.
  box2([(B1.x1 - B1.x0) / 2, 2.2, 0.03], [(B1.x0 + B1.x1) / 2, Y + 2.2, B1.z1 + 0.6], 0x3f8f5a, { ghost: true });
  box2([(B1.x1 - B1.x0) / 2 - 3, 2.2, 0.03], [(B1.x0 + B1.x1) / 2 - 3, Y + 2.2, B1.z0 - 0.6], 0x3f8f5a, { ghost: true });

  // ---- Across to the second: one steel plate ----
  // A plate of steel laid from the first building's floor to the platform by the second, the width of the truck and a hand
  // either side: off its line, a wheel goes over the edge, the truck tips about it and goes down. Slippery steel.
  const sLong = SWAY.x1 - SWAY.x0, sMid = (SWAY.x0 + SWAY.x1) / 2;
  // End to end with the floors it meets, not over them: two tops in one plane flicker.
  box2([sLong / 2, 0.08, PLATE / 2], [sMid, F2 - 0.08, SWAY.z], 0x6f747a, { friction: 0.05 });
  for (const edge of [-1, 1]) box2([sLong / 2 - 0.05, 0.012, 0.06], [sMid, F2 + 0.012, SWAY.z + edge * (PLATE / 2 - 0.12)], 0xe0b020, { ghost: true });
  for (let x = SWAY.x0 + 1; x < SWAY.x1; x += 1.2) box2([0.03, 0.006, PLATE / 2 - 0.3], [x, F2 + 0.006, SWAY.z], 0x55595f, { ghost: true });
  for (const side of [-1, 1]) box2([sLong / 2, 0.2, 0.06], [sMid, F2 - 0.36, SWAY.z + side * (PLATE / 2 - 0.3)], 0x4f555b, { ghost: true });
  // Under it at either end, props up to it from the ground, so that it looks laid on something.
  for (const x of [SWAY.x0 + 1.5, SWAY.x1 - 1.5]) for (const side of [-1, 1]) box2([0.08, (F2 - 0.4 - Y) / 2, 0.08], [x, (F2 - 0.4 + Y) / 2, SWAY.z + side * (PLATE / 2 - 0.3)], 0x8f979d);
  // A warning at either end, cones by the planks' ends.
  for (const x of [SWAY.x1 + 1.2, SWAY.x0 - 1.2]) for (const side of [-1, 1]) s.object('cone', x, SWAY.z + side * (PLATE / 2 + 0.6), 0, F2);

  // The platform it comes to, by the second building, and the ramp up from it.
  slab(P2.x0, P2.z0, P2.x1, P2.z1, F2);
  for (const [x, z] of [[P2.x1 - 0.4, P2.z0 + 0.4], [P2.x1 - 0.4, P2.z1 - 0.4]] as const) column(x, z, Y, F2 - 0.3);
  rails([P2.x0 + 0.5, P2.z0 + 0.3], [P2.x1 - 0.5, P2.z0 + 0.3], F2);
  rails([P2.x1 - 0.3, P2.z0 + 0.5], [P2.x1 - 0.3, SWAY.z - 2.6], F2);
  rails([P2.x1 - 0.3, SWAY.z + 2.6], [P2.x1 - 0.3, P2.z1], F2);

  // ---- The second building: three floors; its ramp; the landing round on to its upper floor ----
  const r2 = ramp(R2.x0, R2.x1, R2.z0, R2.z1, F2, F3);
  for (let z = R2.z0 + 4; z < R2.z1; z += 4) s.object('guardrail', R2.x1 - 0.6, z, 0, r2(z));
  rails([R2.x0 - 0.3, B2.z1 + 0.5], [R2.x0 - 0.3, R2.z1], F3);
  // The landing: across the building's north end and past it over the ramp's head, walled low round its outer edges.
  slab(B2.x0, R2.z1, R2.x1, R2.z1 + 16, F3);
  slab(B2.x0, B2.z1, R2.x0 - 0.1, R2.z1, F3);
  upstand(B2.x0, R2.z1 + 15.85, R2.x1, R2.z1 + 16, F3);
  upstand(R2.x1 - 0.15, R2.z1, R2.x1, R2.z1 + 16, F3);
  upstand(B2.x0, B2.z1, B2.x0 + 0.15, R2.z1 + 16, F3);
  for (const [x, z] of [[B2.x0 + 0.4, R2.z1 + 15.6], [R2.x1 - 0.4, R2.z1 + 15.6], [4, R2.z1 + 15.6]] as const) column(x, z, Y, F3 - 0.3);
  // What is brought up there, waiting at its edges.
  for (const [kind, x, z] of [['bricks', -13, R2.z1 + 13], ['bricks', -13, R2.z1 + 10.8], ['cementBag', -11, R2.z1 + 13.4], ['cementBag', -11, R2.z1 + 12.8], ['mixer', -13.5, R2.z1 + 4], ['paintYellow', 20, R2.z1 + 14], ['paintWhite', 19.4, R2.z1 + 14.3]] as const) s.object(kind, x, z, 0, F3);
  s.object('formwork', -6, R2.z1 + 14.6, 0, F3);
  for (let n = 0; n < 5; n++) s.object('bricks', -1 + n * 1.6, R2.z1 + 14.6, 0, F3);
  box2([1.6, 0.6, 0.9], [11, F3 + 0.6, R2.z1 + 14.4], 0xd0a020);
  // The hoist up its north face: its mast from the ground, its cage at the landing.
  box2([0.35, (F3 + 4 - Y) / 2, 0.35], [-10, (F3 + 4 + Y) / 2, R2.z1 + 16.6], 0xe0a020);
  for (let y = Y + 1.5; y < F3 + 4; y += 1.5) box2([0.37, 0.03, 0.37], [-10, y, R2.z1 + 16.6], DARK, { ghost: true });
  box2([0.9, 1.1, 0.8], [-10, F3 - 0.2, R2.z1 + 17.5], 0x8f979d, { ghost: true });
  s.crowds.push({ area: [-4, R2.z1 + 12, 6, R2.z1 + 13], count: 2, y: Y, raised: F3 - Y, workers: true, fenced: true });
  for (const [kind, x, z] of [['bricks', -13, R2.z1 + 13], ['bricks', -13, R2.z1 + 10.8], ['cementBag', -11, R2.z1 + 13.4], ['cementBag', -11, R2.z1 + 12.8], ['mixer', -13.5, R2.z1 + 4], ['paintYellow', 20, R2.z1 + 14], ['paintWhite', 19.4, R2.z1 + 14.3]] as const) s.object(kind, x, z, 0, F3);
  // The floors. The lower one whole; the upper one with its holes, some only coned off, one plated over.
  slab(B2.x0, B2.z0, B2.x1, B2.z1, F2);
  slab(B2.x0, B2.z0, B2.x1, B2.z1, F3);
  const underF3: NonNullable<PropDesc['fadeZone']> = [[B2.x0 - 1, F2, B2.z0 - 1], [B2.x1 + 1, F3 - 0.5, B2.z1 + 1]];
  for (const [x0, z0, x1, z1] of WET_BAYS) {
    // Poured this morning: dark and wet, a sheen on it, the screeding rails along its edges, the men's boards across it;
    // coned along its near end only, as they left it.
    const up = { ghost: true, fade: true, fadeZone: underF3 } as const;
    box2([(x1 - x0) / 2, 0.01, (z1 - z0) / 2], [(x0 + x1) / 2, F3 + 0.015, (z0 + z1) / 2], 0x5c6062, up);
    for (let k = 0; k < 5; k++) box2([0.6 + hash(k, 3) * 0.7, 0.01, 0.3 + hash(k, 4) * 0.5], [x0 + 1 + hash(k, x0) * (x1 - x0 - 2), F3 + 0.03 + k * 0.004, z0 + 1 + hash(z0, k) * (z1 - z0 - 2)], 0x7a7f82, { ...up, rot: [0, hash(k, 5) * 3, 0] });
    for (const x of [x0 + 0.1, x1 - 0.1]) box2([0.05, 0.05, (z1 - z0) / 2], [x, F3 + 0.05, (z0 + z1) / 2], 0x9aa0a6, up);
    box2([(x1 - x0) / 2 + 0.3, 0.02, 0.15], [(x0 + x1) / 2, F3 + 0.12, z0 + (z1 - z0) * 0.4], 0xc9a26b, up);
    for (let x = x0 + 0.6; x < x1; x += 1.4) s.object('cone', x, z1 + 0.6, 0, F3);
  }
  // Columns: the lower storeys' whole; the upper floor's standing up for the next; overhead, seen through while the truck is
  // under the upper floor.
  const under: NonNullable<PropDesc['fadeZone']> = [[B2.x0 - 1, F2, B2.z0 - 1], [B2.x1 + 1, F3 - 0.5, B2.z1 + 1]];
  for (const x of B2_COLS) for (const z of B2_ROWS) {
    column(x, z, Y, F2 - 0.3);
    column(x, z, F2, F3 - 0.3);
    const edge = x === B2_COLS[0] || x === B2_COLS[B2_COLS.length - 1] || z === B2_ROWS[0] || z === B2_ROWS[B2_ROWS.length - 1];
    if (edge) column(x, z, F3, F3 + 2.8, { fade: true, fadeZone: under });
    starters(x, z, edge ? F3 + 2.8 : F3);
  }
  // The upper floor seen through while the truck is on the lower one, by its own slabs being marked to fade in that box.
  for (const p of props) if (p.shape === 'box' && Math.abs(p.pos[1] - (F3 - 0.15)) < 0.01 && p.pos[0] >= B2.x0 && p.pos[0] <= B2.x1 && p.pos[2] >= B2.z0 && p.pos[2] <= B2.z1) {
    p.fade = true;
    p.fadeZone = under;
  }
  rails([B2.x0 + 0.8, B2.z0 + 1], [B2.x0 + 0.8, B2.z1 - 1], F3);
  rails([B2.x1 - 0.8, B2.z0 + 1], [B2.x1 - 0.8, B2.z1 - 1], F3);
  rails([B2.x0 + 1, B2.z0 + 0.8], [STUB.x0 - 0.3, B2.z0 + 0.8], F3);
  rails([STUB.x1 + 0.3, B2.z0 + 0.8], [B2.x1 - 1, B2.z0 + 0.8], F3);
  // Work on the upper floor: formwork boards, bundles of bars, a welding set, the men.
  for (const [kind, x, z, r] of [['rebar', 7, 1494, 0], ['rebar', 7.8, 1494, 0], ['wheelbarrow', -13, 1474, 1], ['paintBlue', 11.5, 1446, 0], ['box', -13.6, 1446, 0], ['box', -13, 1446.6, 0]] as const) s.object(kind, x, z, r, F3);
  s.object('formwork', 11, 1470, 0, F3);
  // Forklifts at work on the floor: one across it and back, over the truck's way; one round and round on the landing.
  rigs.push({ kind: 'forklift', pos: [5, F3, 1460], yaw: 0, period: 7, phase: 0, path: [[5, 1460], [-9.5, 1460]], back: true });
  rigs.push({ kind: 'forklift', pos: [12, F3, 1447], yaw: 0, period: 8, phase: 0.45, path: [[12, 1447], [-13, 1447]], back: true });
  rigs.push({ kind: 'forklift', pos: [-13, F3, 1473.5], yaw: 0, period: 6.5, phase: 0.2, path: [[-13, 1473.5], [-2.6, 1473.5]], back: true });
  rigs.push({ kind: 'forklift', pos: [6, F3, R2.z1 + 2], yaw: 0, period: 6, phase: 0.6, path: [[6, R2.z1 + 2], [6, R2.z1 + 13]], back: true });
  rigs.push({ kind: 'forklift', pos: [-14, F3, R2.z1 + 3], yaw: 0, period: 14, phase: 0.3, path: [[-14, R2.z1 + 3], [-2, R2.z1 + 3], [-2, R2.z1 + 11], [-14, R2.z1 + 11]] });
  s.crowds.push({ area: [6, 1488, 12, 1496], count: 2, y: Y, raised: F3 - Y, workers: true, fenced: true });
  s.crowds.push({ area: [-14, 1478, -11, 1482], count: 1, y: Y, raised: F3 - Y, workers: true, fenced: true });

  // ---- The walkway's stub, its gap, the third building ----
  box2([(STUB.x1 - STUB.x0) / 2, 0.2, (STUB.z1 - STUB.z0) / 2 + 0.3], [(STUB.x0 + STUB.x1) / 2, F3 - 0.2, (STUB.z0 + STUB.z1) / 2 - 0.3], 0x6a7076);
  // At its end the last girder's cut end bent up, steel plate laid over it: a lip that throws whatever comes off fast up.
  {
    const run = 3.5, rise = KICK, long = Math.hypot(run, rise), a = Math.atan2(rise, run);
    box2([(STUB.x1 - STUB.x0) / 2 - 0.6, 0.12, long / 2], [(STUB.x0 + STUB.x1) / 2, F3 + rise / 2 - 0.1, STUB.z0 + run / 2], 0x5a6066, { rot: [a, 0, 0] });
    for (let x = STUB.x0 + 0.9; x < STUB.x1 - 0.6; x += 0.9) box2([0.02, 0.02, long / 2], [x, F3 + rise / 2 + 0.03, STUB.z0 + run / 2], 0x454b50, { rot: [a, 0, 0], ghost: true });
  }
  for (const side of [-1, 1]) box2([0.2, 0.35, (STUB.z1 - STUB.z0) / 2], [(STUB.x0 + STUB.x1) / 2 + side * ((STUB.x1 - STUB.x0) / 2 - 0.6), F3 - 0.75, (STUB.z0 + STUB.z1) / 2], 0x4f555b, { ghost: true });
  // The girders standing out from the far side to meet it, not yet joined: across the gap, nothing.
  for (const side of [-1, 1]) box2([0.2, 0.35, 1.2], [(STUB.x0 + STUB.x1) / 2 + side * ((STUB.x1 - STUB.x0) / 2 - 0.6), ROOF3 - 0.6, B3.z1 + 1.2], 0x4f555b, { ghost: true });
  decals.push({ pos: [(STUB.x0 + STUB.x1) / 2, STUB.z0 + 1], size: [STUB.x1 - STUB.x0 - 0.4, 1.2], color: 0xe8b81e, base: F3, y: 0.02 });
  for (let x = STUB.x0 + 0.5; x < STUB.x1; x += 1.4) decals.push({ pos: [x, STUB.z0 + 1], size: [0.3, 1.2], rotY: 0.7, color: 0x24262a, base: F3, y: 0.03 });
  // The third: finished outside, two storeys, its roof the delivery.
  box2([(B3.x1 - B3.x0) / 2, (ROOF3 - Y) / 2, (B3.z1 - B3.z0) / 2], [(B3.x0 + B3.x1) / 2, (Y + ROOF3) / 2, (B3.z0 + B3.z1) / 2], 0xd8d4c8);
  for (const y of [Y + 1.8, Y + 5.6]) for (const side of [-1, 1]) {
    for (let z = B3.z0 + 2.5; z < B3.z1 - 1.5; z += 3.2) box2([0.03, 0.7, 1.1], [side > 0 ? B3.x1 + 0.03 : B3.x0 - 0.03, y, z], 0x3a4a5a, { ghost: true });
  }
  box2([(B3.x1 - B3.x0) / 2 + 0.1, 0.15, 0.05], [(B3.x0 + B3.x1) / 2, Y + 3.75, B3.z0 - 0.05], 0xa9aba6, { ghost: true });
  // The roof: no parapet yet, only its edge painted yellow; what goes over it falls to the ground. Come down off the jump,
  // the truck has to be brought up short: the stuff waiting to be lifted down lies across it in two rows, the first from the
  // west side, the second from the east, and the bay is a narrow slot between pallets at the very front.
  for (const [x, z, sx, sz] of [[(B3.x0 + B3.x1) / 2, B3.z0 + 0.2, B3.x1 - B3.x0, 0.3], [B3.x0 + 0.2, (B3.z0 + B3.z1) / 2, 0.3, B3.z1 - B3.z0], [B3.x1 - 0.2, (B3.z0 + B3.z1) / 2, 0.3, B3.z1 - B3.z0], [(B3.x0 + B3.x1) / 2, B3.z1 - 0.2, B3.x1 - B3.x0, 0.3]] as const) decals.push({ pos: [x, z], size: [sx, sz], color: 0xe8b81e, base: ROOF3, y: 0.02 });
  for (const [x, z] of [[B3.x0 + 0.5, B3.z0 + 0.5], [B3.x1 - 0.5, B3.z0 + 0.5], [B3.x0 + 0.5, B3.z1 - 0.5], [B3.x1 - 0.5, B3.z1 - 0.5]] as const) s.object('cone', x, z, 0, ROOF3);
  const fx = BAY[0], fz = BAY[1];
  // The rows: pallets of tiles in their boxes and of bricks, the bathroom fittings in their cartons, glass on its racks.
  const row = (x0: number, x1: number, z: number, k: number) => {
    for (let x = x0, n = 0; x <= x1; x += 1.5, n++) {
      if ((n + k) % 3 === 0) s.object('bricks', x, z, 0, ROOF3);
      else {
        s.object('pallet', x, z, 0, ROOF3);
        for (let h = 0; h < 2 + ((n + k) % 2); h++) s.object('box', x + (h % 2) * 0.1, z, hash(n, h + k) * 0.3, ROOF3 + 0.15 + h * 0.6);
      }
    }
  };
  row(B3.x0 + 1.5, ROW1_TO, ROW1_Z, 0);
  row(ROW2_FROM, B3.x1 - 1.5, ROW2_Z, 1);
  for (const [gx, gz] of [[B3.x1 - 1.4, ROW2_Z - 2.2], [B3.x0 + 1.4, ROW1_Z + 2.2]] as const) {
    s.object('glassRack', gx, gz, Math.PI / 2, ROOF3);
  }
  // The bay: pallets of bricks down either side of it, its lines painted, the men waiting at its head.
  for (let z = fz - BAY_HALF[1] + 0.6; z < fz + BAY_HALF[1]; z += 1.4) for (const side of [-1, 1]) s.object('bricks', fx + side * (BAY_HALF[0] + 0.7), z, 0, ROOF3);
  for (const [x, z, sx, sz] of [[fx - BAY_HALF[0], fz, 0.12, BAY_HALF[1] * 2], [fx + BAY_HALF[0], fz, 0.12, BAY_HALF[1] * 2], [fx, fz - BAY_HALF[1], BAY_HALF[0] * 2, 0.12]] as const) decals.push({ pos: [x, z], size: [sx, sz], color: 0xf2f2ee, base: ROOF3, y: 0.025 });
  s.crowds.push({ area: [fx + 3.5, fz - 2, fx + 5.5, fz + 1], count: 2, y: Y, raised: ROOF3 - Y, workers: true, fenced: true });
  // The water tanks, the crane's base and mast; the stair housing with the bay's name.
  for (let n = 0; n < 3; n++) props.push({ shape: 'cylinder', size: [1, 1.1, 0], pos: [8 + n * 2.3, ROOF3 + 1.1, B3.z0 + 4], color: 0xd8dcd8 });
  box2([1.2, 0.6, 1.2], [9, ROOF3 + 0.6, B3.z1 - 6], 0xa9aba6);
  box2([0.6, 14, 0.6], [9, ROOF3 + 14, B3.z1 - 6], 0xe0a020);
  for (let y = ROOF3 + 2; y < ROOF3 + 27; y += 2) box2([0.65, 0.04, 0.65], [9, y, B3.z1 - 6], DARK, { ghost: true });
  box2([0.35, 0.3, 13], [9, ROOF3 + 28.2, B3.z1 + 1], 0xe0a020, { ghost: true, fade: true });
  box2([0.35, 0.3, 4], [9, ROOF3 + 28.2, B3.z1 - 16], 0xe0a020, { ghost: true, fade: true });
  box2([0.8, 0.6, 1], [9, ROOF3 + 27.4, B3.z1 - 19], 0x4a4f57, { ghost: true, fade: true });
  // Where the truck comes down: the fitters' empties stacked waiting to go, cartons three and four high; light, and
  // everywhere when landed in.
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 2 + ((i + j) % 3); k++) s.object('box', -8.4 + i * 1.6, B3.z1 - 5 - j * 1.6, hash(i, j) * 0.4, ROOF3 + k * 0.6);
  box2([3, 1.6, 2.6], [9, ROOF3 + 1.6, B3.z0 + 17], 0xc8c4b8);
  box2([3.2, 0.12, 2.8], [9, ROOF3 + 3.3, B3.z0 + 17], 0x8a8e90);
  box2([0.7, 1.05, 0.03], [7.4, ROOF3 + 1.05, B3.z0 + 19.63], 0x4f6f8a, { ghost: true });
  signs.push({ kind: 'unload', pos: [9.8, ROOF3 + 2.3, B3.z0 + 19.66], rotY: 0 });

  // The ground round the buildings: dug and dumped, nobody's way: what falls off ends on it.
  for (let k = 0; k < 40; k++) {
    const x = -50 + hash(k, 900) * 120, z = 1390 + hash(900, k) * 150;
    if (x > YARD.x0 - 2 && z < 1458) continue;
    props.push({ shape: 'cone', size: [1 + hash(k, 901) * 1.5, 0.4 + hash(k, 902) * 0.4, 0], pos: [x, Y + 0.3, z], color: 0x8a7f6a, ghost: true });
  }
  // A tower crane over the first building, its jib across it.
  {
    const cx = 36, cz = 1500;
    box2([0.7, 15, 0.7], [cx, Y + 15, cz], 0xe0a020);
    for (let y = Y + 2; y < Y + 30; y += 2) box2([0.75, 0.04, 0.75], [cx, y, cz], DARK, { ghost: true });
    box2([14, 0.3, 0.35], [cx + 10, Y + 31, cz], 0xe0a020, { ghost: true, fade: true });
    box2([4, 0.3, 0.35], [cx - 6, Y + 31, cz], 0xe0a020, { ghost: true, fade: true });
    // The counterweight, standing a little past the jib's end so that the two end faces don't meet in one plane.
    box2([1, 0.7, 0.9], [cx - 9.05, Y + 30.4, cz], 0x4a4f57, { ghost: true, fade: true });
    box2([0.02, 6, 0.02], [cx + 18, Y + 25, cz], DARK, { ghost: true, fade: true });
    box2([1.2, 0.3, 0.6], [cx + 18, Y + 18.8, cz], 0x6a4a32, { ghost: true, fade: true });
  }
}

/** The rest of the site round the buildings, none of it driven over: what a site of three buildings has about it. */
function siteGrounds(s: Site): void {
  const { props, decals } = s;
  const Y = SITE_Y;
  const b = (size: [number, number, number], pos: [number, number, number], color: number, extra: Partial<PropDesc> = {}) => box(props, size, pos, color, extra);
  /** Formwork boards in a stack; scaffold tubes in a rack; a pile of sand; precast slabs on bearers. */
  const boards = (x: number, z: number, n: number, yaw = 0) => { for (let i = 0; i < Math.ceil(n / 6); i++) s.object('formwork', x, z, yaw, Y + i * 0.54); };
  const tubes = (x: number, z: number) => {
    for (const dz of [-1.6, 1.6]) b([0.06, 0.6, 0.06], [x, Y + 0.6, z + dz], 0x2f62a8);
    for (let i = 0; i < 12; i++) props.push({ shape: 'cylinder', size: [0.05, 2, 0], pos: [x - 0.4 + (i % 6) * 0.15, Y + 0.25 + Math.floor(i / 6) * 0.5, z], rot: [Math.PI / 2, 0, 0], color: 0x9aa0a6, ghost: true });
  };
  const sand = (x: number, z: number, r: number, color = 0xcdbb8e) => props.push({ shape: 'cone', size: [r, r * 0.42, 0], pos: [x, Y + r * 0.42, z], color });
  const precast = (x: number, z: number, n: number) => {
    for (const dx of [-1.6, 1.6]) b([0.15, 0.1, 1.4], [x + dx, Y + 0.1, z], 0x6b5a46);
    for (let i = 0; i < n; i++) b([2.4, 0.12, 1.2], [x, Y + 0.32 + i * 0.25, z], 0xb4b6b0);
  };
  /** A machine standing: an excavator, its arm folded down. */
  const excavator = (x: number, z: number, yaw: number) => {
    const c = Math.cos(yaw), sn = Math.sin(yaw), at = (f: number, up: number, side = 0): [number, number, number] => [x + sn * f + c * side, Y + up, z + c * f - sn * side];
    for (const side of [-1, 1]) b([0.5, 0.45, 2.3], at(0, 0.45, side * 1.3), DARK, { rot: [0, yaw, 0] });
    b([1.6, 0.7, 2], at(-0.4, 1.6), 0xe0a81e, { rot: [0, yaw, 0] });
    b([0.6, 0.75, 0.6], at(0.8, 3, -0.7), 0x3a4a52, { rot: [0, yaw, 0] });
    b([0.3, 0.3, 2.4], at(2.6, 3.4), 0xe0a81e, { rot: [-0.5, yaw, 0], ghost: true });
    b([0.25, 1.4, 0.25], at(4.8, 2.6), 0xe0a81e, { rot: [0.3, yaw, 0], ghost: true });
    b([0.7, 0.45, 0.5], at(5, 0.6), 0x4a4c50, { rot: [0, yaw, 0] });
  };

  // West of the buildings: the fourth's foundations being dug, a pit walled with sheet piles, an excavator at its edge
  // loading a lorry, the dug earth heaped; rebar cages waiting to go down.
  const pit = { x0: -50, x1: -24, z0: 1430, z1: 1500 };
  s.relief.area(rect(pit.x0, pit.z0, pit.x1, pit.z1), Y - 3.5, DROP);
  for (const [a, c] of [[[pit.x0, pit.z0], [pit.x1, pit.z0]], [[pit.x0, pit.z1], [pit.x1, pit.z1]], [[pit.x0, pit.z0], [pit.x0, pit.z1]], [[pit.x1, pit.z0], [pit.x1, pit.z1]]] as [Vec2, Vec2][]) {
    const long = Math.hypot(c[0] - a[0], c[1] - a[1]), yaw = Math.atan2(c[0] - a[0], c[1] - a[1]);
    b([0.06, 1.85, long / 2], [(a[0] + c[0]) / 2, Y - 1.75, (a[1] + c[1]) / 2], 0x4f565e, { rot: [0, yaw, 0], ghost: true });
    b([0.15, 0.15, long / 2], [(a[0] + c[0]) / 2, Y + 0.1, (a[1] + c[1]) / 2], 0x3a3f45, { rot: [0, yaw, 0], ghost: true });
  }
  for (let z = pit.z0 + 6; z < pit.z1; z += 8) b([(pit.x1 - pit.x0) / 2, 0.15, 0.15], [(pit.x0 + pit.x1) / 2, Y - 0.8, z], 0xe0a020, { ghost: true });
  excavator(pit.x1 + 4, 1466, -Math.PI / 2);
  s.traffic.push({ from: [pit.x1 + 6, 1478.25], to: [pit.x1 + 6, 1477.75], cars: 3, speed: 20, kinds: ['dumpTruck', 'dumpTruck', 'dumpTruck'] });
  sand(pit.x1 + 8, 1450, 4, 0x8a7a5e);
  sand(pit.x1 + 6, 1440, 3, 0x8a7a5e);
  for (let n = 0; n < 4; n++) {
    const z = 1508 + n * 3.2;
    for (const dx of [-1, 1]) b([0.04, 0.7, 1.3], [-40 + dx * 0.7, Y + 0.7, z], 0x6a4a32, { ghost: true });
    for (let i = 0; i < 5; i++) b([0.75, 0.02, 0.02], [-40, Y + 0.15 + i * 0.3, z - 1.2 + i * 0.6], 0x6a4a32, { ghost: true });
  }
  decals.push({ pos: [(pit.x0 + pit.x1) / 2, (pit.z0 + pit.z1) / 2], size: [pit.x1 - pit.x0 - 2, pit.z1 - pit.z0 - 2], color: 0x6f6550, base: Y - 3.5, y: 0.02 });
  // North: the site's offices, cabins two high in a row, their stair, the flag; the men's scooters; a car or two.
  for (let n = 0; n < 4; n++) for (const up of [0, 1]) containerModel(props, -36 + n * 6.4, Y + up * 2.6, 1534, true, up ? 0xe4e0d4 : 0xd8d2c4);
  b([0.5, 1.3, 0.5], [-41, Y + 1.3, 1531.5], STEEL, { rot: [0, 0, 0.5], ghost: true });
  props.push({ shape: 'cylinder', size: [0.06, 4.5, 0], pos: [-12, Y + 4.5, 1530], color: WHITE }, { shape: 'box', size: [0.02, 0.5, 0.75], pos: [-12, Y + 8.4, 1530.8], color: 0xc8372d, ghost: true });
  const RIDES: ObjectKindId[] = ['scooterWhite', 'scooterRed', 'scooterBlack', 'scooterBlue', 'scooterTeal', 'scooterYellow'];
  for (let i = 0; i < 10; i++) s.object(RIDES[i % 6], -8 + i * 0.85, 1530, Math.PI);
  for (const x of [8, 13]) s.traffic.push({ from: [x, 1530.25], to: [x, 1529.75], cars: 3, speed: 20, kinds: ['dumpTruck', 'dumpTruck', 'dumpTruck'] });
  // Between the third building and the yard: scaffold in racks, formwork, precast slabs, the mortar silo, a generator,
  // the water tank; the second crane's base.
  for (const z of [1392, 1398, 1404]) tubes(24, z);
  for (const [x, z] of [[34, 1392], [34, 1396], [38, 1392], [38, 1396]] as const) boards(x, z, 6);
  for (const [x, z] of [[48, 1392], [48, 1400]] as const) precast(x, z, 4);
  props.push({ shape: 'cylinder', size: [1.3, 3.5, 0], pos: [60, Y + 5, 1394], color: 0xd8dcd8 }, { shape: 'cone', size: [1.3, 1, 0], pos: [60, Y + 0.8, 1394], rot: [Math.PI, 0, 0], color: 0xb4b6b0 });
  for (const [dx, dz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) b([0.1, 1, 0.1], [60 + dx, Y + 1, 1394 + dz], STEEL);
  b([1.4, 0.8, 0.8], [62, Y + 0.8, 1404], 0x2f7a3a);
  props.push({ shape: 'cylinder', size: [1.2, 1, 0], pos: [54, Y + 1, 1410], color: 0x2f62a8 });
  sand(30, 1420, 3);
  sand(44, 1424, 2.4, 0x9c9384);
  // Under the hanging bridge and round the first building's foot: bricks and blocks on pallets, a skip, puddles.
  for (let n = 0; n < 6; n++) b([0.6, 0.45, 0.5], [32 + (n % 3) * 1.6, Y + 0.52, 1460 + Math.floor(n / 3) * 1.4], 0xb5533c);
  b([1.8, 0.7, 1], [38, Y + 0.7, 1478], 0xd0a020);
  for (let k = 0; k < 10; k++) decals.push({ pos: [24 + hash(k, 950) * 60, 1440 + hash(950, k) * 80], size: [1.5 + hash(k, 951) * 2.5, 1 + hash(k, 952) * 2], rotY: hash(k, 953) * 3, color: 0x6f6858, base: Y, y: 0.02 });
  // The site's own ways between its stacks, worn into the dirt; machines and lorries standing on them, the stuff they bring.
  for (const [x, z, sx, sz] of [[50, 1512, 140, 6], [30, 1450, 6, 120], [102, 1452, 30, 6]] as const) decals.push({ pos: [x, z], size: [sx, sz], color: 0x9a9080, base: Y, y: 0.015 });
  {
    // A road roller and a second lorry waiting; rebar cages; formwork in stacks; a generator; a store of cabins.
    const rx = 22, rz = 1436;
    props.push({ shape: 'cylinder', size: [0.75, 1.0, 0], pos: [rx, Y + 0.75, rz + 1.6], rot: [0, 0, Math.PI / 2], color: 0x8a9096 });
    b([1.0, 0.7, 1.4], [rx, Y + 1.3, rz - 0.4], 0xe0a81e);
    b([0.6, 0.5, 0.5], [rx, Y + 2.4, rz - 0.6], 0x3a4a52, { ghost: true });
    for (const side of [-1, 1]) props.push({ shape: 'cylinder', size: [0.6, 0.25, 0], pos: [rx + side * 0.95, Y + 0.6, rz - 1.4], rot: [0, 0, Math.PI / 2], color: DARK });
    s.traffic.push({ from: [48, 1506.25], to: [48, 1505.75], cars: 3, speed: 20, kinds: ['dumpTruck', 'dumpTruck', 'dumpTruck'] });
    for (let n = 0; n < 3; n++) {
      const z = 1430 + n * 3.4;
      for (const dx of [-0.7, 0.7]) b([0.04, 0.6, 1.4], [40 + dx, Y + 0.6, z], 0x6a4a32, { ghost: true });
      for (let i = 0; i < 4; i++) b([0.75, 0.02, 0.02], [40, Y + 0.2 + i * 0.3, z - 1.2 + i * 0.8], 0x6a4a32, { ghost: true });
    }
    for (const [x, z] of [[92, 1446], [96, 1446], [100, 1446], [92, 1452], [96, 1452]] as const) boards(x, z, 5 + (x % 3));
    b([1.4, 0.8, 0.8], [110, Y + 0.8, 1448], 0x2f7a3a);
    for (const x of [60, 66.4]) containerModel(props, x, Y, 1500, true, 0x8a4a3a);
    for (const z of [1496, 1502]) tubes(80, z);
    precast(98, 1500, 5);
    sand(110, 1500, 3.2, 0x9c9384);
  }
  // North of the yard, by the far shed: the bar-bending shop under its roof, bars laid out, the bender, the cut ends.
  {
    const x0 = 92, x1 = 116, z0 = 1462, z1 = 1478;
    props.push({ shape: 'box', size: [(x1 - x0) / 2, 0.15, (z1 - z0) / 2], pos: [(x0 + x1) / 2, Y + 5, (z0 + z1) / 2], color: 0x7e848a, ghost: true, overhead: true, fade: true });
    for (const x of [x0 + 0.3, (x0 + x1) / 2, x1 - 0.3]) for (const z of [z0 + 0.3, z1 - 0.3]) b([0.15, 2.5, 0.15], [x, Y + 2.5, z], STEEL);
    for (let i = 0; i < 18; i++) b([5, 0.03, 0.03], [x0 + 8, Y + 0.6 + (i % 3) * 0.05, z0 + 3 + (i / 3) * 0.3], 0x6a4a32, { ghost: true });
    for (const dz of [z0 + 2, z0 + 6]) for (const dx of [-1, 1]) b([0.12, 0.3, 0.12], [x0 + 8 + dx * 4, Y + 0.3, dz], 0x6b5a46);
    b([0.6, 0.45, 0.6], [x1 - 6, Y + 0.45, z0 + 8], 0x2f6fb0);
    b([0.7, 0.04, 0.7], [x1 - 6, Y + 0.93, z0 + 8], 0x3a3f45, { ghost: true });
    for (let n = 0; n < 4; n++) s.object('rebar', x1 - 3, z0 + 3 + n * 1.2, 0);
    s.crowds.push({ area: [x0 + 4, z0 + 9, x1 - 4, z1 - 2], count: 3, y: Y, workers: true, fenced: true });
  }
}
