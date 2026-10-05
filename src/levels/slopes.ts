import type { ObjectDesc, ObjectKindId } from './objects';
import { plots, seat } from './plots';
import { Relief, type Look, type RibbonPoint } from './relief';
import { standardLoad } from './sandbox';
import { heightAt } from './terrain';
import type { DecalDesc, LevelDef, PropDesc, TrafficLane, Vec2 } from './types';

// A proving ground for what a slope can be made into.
//
//   The avenue: two lanes each way, 200 m long and steep, with traffic on it both ways, and
//   drums and gas cylinders let go from the top of the hill above it, rolling down through
//   the traffic. At its head is a level landing, where a road leaves it to the east; above
//   that the hill goes on up to where the rolling things come from.
//
//   The tower: at the end of that road, a tower far taller than any such thing is, with a
//   narrow road winding five times round the outside of it to the roof, where the delivery is.

const ROAD: Look = { tag: 'road', color: 0x5b626b, wall: 0xa8a59c };
const PAVED: Look = { tag: 'paved', color: 0x9aa0a8, wall: 0xa8a59c };
const GROUND: Look = { tag: 'ground', color: 0x7f8a72, wall: 0x8b8880 };
const DECK: Look = { tag: 'deck', color: 0x666d76, wall: 0x4c5158 };
const ROOF: Look = { tag: 'deck', color: 0x8d949c, wall: 0x4c5158 };

/** How steep the avenue is, rise over run. */
const GRADE = 0.22;
/** From south to north: the foot of the hill, the landing at the head of the avenue, and the top of the hill above it. */
const FOOT = 60;
const LANDING: Vec2 = [260, 290];
const HEAD = 330;
const LANDING_H = (LANDING[0] - FOOT) * GRADE;
const HEAD_H = LANDING_H + (HEAD - LANDING[1]) * GRADE;
const hill = (z: number) => (z < FOOT ? 0 : z < LANDING[0] ? (z - FOOT) * GRADE : z < LANDING[1] ? LANDING_H : z < HEAD ? LANDING_H + (z - LANDING[1]) * GRADE : HEAD_H);
/** East of the avenue, beside its head: level ground at the height of the landing, for the tower to stand on. */
const PLATEAU: Vec2 = [-20, 230];
const land = (x: number, z: number) => (x < PLATEAU[0] && z > PLATEAU[1] ? LANDING_H : hill(z));

/** The avenue: its lanes, each 3.5 m, two each way; and a pavement each side. East is -X here: going north, that is the right, where the traffic going north keeps. */
const LANE = 3.5;
const HALF = LANE * 2 + 0.4;
const PAVEMENT = 3;

/** The tower: where it stands, how big round it and the road round it are, and how the road climbs. */
const RAMP_R = 20;
const RAMP_WIDE = 7.5;
const TOWER: Vec2 = [-70, LANDING[0] + 15 + RAMP_R];
const TOWER_R = RAMP_R - RAMP_WIDE / 2 - 0.4;
const TURNS = 5;
/** Steeper than the avenue, and narrow, and tight: not to be taken at a run. */
const RAMP_GRADE = 0.25;
const RISE = RAMP_GRADE * 2 * Math.PI * RAMP_R;
/** The road round it by how far round: it begins due south of the middle, heading east (-X), and winds to the left as it climbs. Its last stretch is level. */
/** At the top it runs level round two thirds of the roof, beside it all the way: room to turn on to it. */
const LEVEL_END = 4.2;
const ROUND = TURNS * 2 * Math.PI + LEVEL_END - 0.2;
const rampHeight = (angle: number) => LANDING_H + 0.06 + (RISE * Math.min(angle, ROUND - LEVEL_END)) / (2 * Math.PI);
const TOP = rampHeight(ROUND);
/** A place on the road round the tower: so far round, and so far out from the middle. */
const round = (angle: number, radius: number): Vec2 => [TOWER[0] - Math.sin(angle) * radius, TOWER[1] - Math.cos(angle) * radius];

export function buildSlopes() {
  const relief = new Relief([-130, -40], [80, 360], 10, (x, z) => ({ h: land(x, z), look: GROUND }));
  const avenue: RibbonPoint[] = [{ x: 0, z: -34, h: 0 }, { x: 0, z: FOOT, h: 0 }, { x: 0, z: LANDING[0], h: LANDING_H }, { x: 0, z: LANDING[1], h: LANDING_H }, { x: 0, z: HEAD, h: HEAD_H }, { x: 0, z: 352, h: HEAD_H }];
  const made = relief.ribbon(avenue, HALF * 2, ROAD, { verge: { width: PAVEMENT, look: PAVED } });
  // The road east from the landing to the foot of the tower's ramp.
  const [sx, sz] = round(0, RAMP_R);
  relief.ribbon([{ x: 0, z: sz, h: LANDING_H }, { x: sx, z: sz, h: LANDING_H }], RAMP_WIDE, ROAD);
  // The ramp: one slab winding up round the tower; and the roof.
  const ramp: RibbonPoint[] = [];
  const steps = Math.ceil((ROUND / (2 * Math.PI)) * 48);
  for (let n = 0; n <= steps; n++) {
    const angle = (n / steps) * ROUND;
    const [x, z] = round(angle, RAMP_R);
    ramp.push({ x, z, h: rampHeight(angle) });
  }
  relief.deck(ramp, RAMP_WIDE, 0.8, DECK);
  // Round, like the tower: a square one would stick out over the last turn of the ramp, in the way of whatever came up it.
  const ROOF_R = RAMP_R - RAMP_WIDE / 2 + 0.3;
  relief.deck([-0.98, -0.9, -0.74, -0.5, -0.22, 0.22, 0.5, 0.74, 0.9, 0.98].map((t) => ({ x: TOWER[0] + t * ROOF_R, z: TOWER[1], h: TOP, width: 2 * ROOF_R * Math.sqrt(1 - t * t) })), 2 * ROOF_R, 1.2, ROOF);
  return { ...relief.build(), made };
}

export function slopes(): LevelDef {
  const { terrain, made } = buildSlopes();
  const props: PropDesc[] = [];
  const objects: ObjectDesc[] = [];
  const decals: DecalDesc[] = [];

  // The avenue's markings: a double line down the middle, a broken one between each pair of lanes, an edge line each side.
  const stretches: [number, number][] = [[-34, FOOT], [FOOT, LANDING[0]], [LANDING[0], LANDING[1]], [LANDING[1], HEAD]];
  const line = (x: number, from: number, to: number, wide: number, color: number) => {
    for (const [a, b] of stretches) {
      const z0 = Math.max(a, from), z1 = Math.min(b, to);
      if (z1 - z0 < 0.2) continue;
      const slope = (hill(b - 0.01) - hill(a + 0.01)) / (b - a - 0.02);
      decals.push({ pos: [x, (z0 + z1) / 2], size: [wide, z1 - z0], color, base: hill((z0 + z1) / 2), tilt: Math.abs(slope) > 1e-4 ? [0, slope] : undefined });
    }
  };
  for (const x of [-0.2, 0.2]) line(x, -30, HEAD, 0.14, 0xe0b020);
  for (const x of [-HALF + 0.3, HALF - 0.3]) line(x, -30, HEAD, 0.14, 0xe8e8e8);
  for (let z = -28; z < HEAD - 4; z += 9) for (const x of [-LANE - 0.2, LANE + 0.2]) line(x, z, z + 3.5, 0.14, 0xe8e8e8);

  // Houses along both pavements, each on its own footing, stepping up the hill; none where the road east leaves, nor against the tower's ground.
  const WALLS = [0xd8c9a8, 0xc9b28a, 0xb9a48c, 0xd4c4a8, 0xbf8f6f, 0xcfd3d6, 0xd9b99a];
  for (const side of ['left', 'right'] as const) {
    for (const plot of plots(made[side], side, { width: (n) => 6 + ((n * 7) % 3), depth: 9, skip: (n) => n % 9 === 6 })) {
      if (plot.z < -28 || plot.z > HEAD + 12) continue;
      if (plot.x < 0 && plot.z > PLATEAU[1] - 12 && plot.z < LANDING[1] + 8) continue;
      const tall = 3.6 + ((plot.n * 5 + (side === 'left' ? 0 : 2)) % 3) * 1.7;
      props.push(...seat(terrain, { shape: 'box', size: [plot.width / 2, tall, plot.depth / 2], pos: [plot.x, 0, plot.z], rot: [0, plot.yaw, 0], color: WALLS[(plot.n * 3 + (side === 'left' ? 0 : 4)) % WALLS.length], fade: true, building: { style: plot.n % 4 === 1 ? 'tower' : 'old', open: plot.open, crown: 0, seed: 1300 + plot.n * 31 + (side === 'left' ? 0 : 17) } }));
    }
    // Lamps along the kerb.
    for (const spot of plots(made.inner[side], side, { width: 26, depth: 0, setback: 0.7 })) if (spot.z > -28 && spot.z < HEAD) objects.push({ kind: 'lamp', pos: [spot.x, heightAt(terrain, spot.x, spot.z), spot.z], rotY: spot.yaw });
  }
  // At the top of the hill, what is left of whatever was carrying it all: and a fence across the road.
  for (const x of [-6, -3, 0, 3, 6]) objects.push({ kind: 'barrier', pos: [x, HEAD_H, HEAD + 14], rotY: 0 });

  // The tower, and along the outer edge of its ramp a post every few metres; here and there on the ramp, something in the way.
  const tall = TOP - LANDING_H;
  props.push({ shape: 'cylinder', size: [TOWER_R, tall / 2, TOWER_R], pos: [TOWER[0], LANDING_H + tall / 2, TOWER[1]], color: 0x5f8f8a });
  for (let n = 1; n <= TURNS * 2; n++) props.push({ shape: 'cylinder', size: [TOWER_R + 0.5, 0.5, TOWER_R + 0.5], pos: [TOWER[0], LANDING_H + (tall * n) / (TURNS * 2 + 1), TOWER[1]], color: 0x3f6f6a });
  const IN_THE_WAY: ObjectKindId[] = ['barrel', 'cone', 'box', 'pallet', 'cone', 'barrel', 'bin'];
  const posts = Math.ceil((ROUND / (2 * Math.PI)) * 56);
  for (let n = 4; n < posts; n++) {
    const angle = (n / posts) * ROUND;
    const [x, z] = round(angle, RAMP_R + RAMP_WIDE / 2 - 0.5);
    // Cones, which stand on a slope: posts fall over on one as soon as they are free to.
    objects.push({ kind: 'cone', pos: [x, rampHeight(angle), z] });
    if (n % 7 === 5) {
      const [ox, oz] = round(angle, RAMP_R + (((n * 7) % 5) - 2) * 1.1);
      objects.push({ kind: IN_THE_WAY[(n / 7) % IN_THE_WAY.length | 0], pos: [ox, rampHeight(angle), oz], rotY: n });
    }
  }
  // The ramp ends beside the roof, at a wall: the way on is to the left, on to the roof.
  const [ex, ez] = round(ROUND, RAMP_R);
  props.push({ shape: 'box', size: [0.5, 0.9, RAMP_WIDE / 2], pos: [ex - 0.6, TOP + 0.9, ez], color: 0xd0a030 });
  for (const [dx, dz] of [[-10, -10], [10, -10], [10, 10], [-10, 10]]) objects.push({ kind: 'flagTeal', pos: [TOWER[0] + dx, TOP, TOWER[1] + dz] });

  // Traffic on the avenue: two lanes up, on the east; two down, on the west.
  const traffic: TrafficLane[] = [];
  for (const [x, up] of [[-LANE * 1.5 - 0.2, true], [-LANE * 0.5 - 0.2, true], [LANE * 0.5 + 0.2, false], [LANE * 1.5 + 0.2, false]] as const) {
    traffic.push({ from: [x, up ? -30 : LANDING[0] - 4], to: [x, up ? LANDING[0] - 4 : -30], cars: 4, speed: up ? 8 : 11 });
  }

  const [sx, sz] = round(0, RAMP_R);
  const way: Vec2[] = [[-LANE - 0.2, -22], [-LANE - 0.2, LANDING[0] + 4], [-10, sz], [sx + 6, sz]];
  // Up the ramp, and off it on to the roof a little before its end.
  for (let angle = Math.PI / 12; angle < ROUND - LEVEL_END + 0.9; angle += Math.PI / 12) way.push(round(angle, RAMP_R));
  way.push(round(ROUND - LEVEL_END + 1.5, RAMP_R - 6));
  way.push([TOWER[0], TOWER[1]]);

  return {
    id: 'slopes',
    name: '坡道試驗場',
    brief: '大斜坡上閃車流和滾下來的東西，再繞著高塔一路開上塔頂',
    ground: { center: [-25, 160], half: [105, 200], style: 'asphalt' },
    terrain,
    bounds: [[-130, -40], [80, 360]],
    spawn: [-LANE - 0.2, 0.9, -22],
    heading: 0,
    props,
    objects,
    route: way,
    decals,
    cargo: standardLoad(),
    traffic,
    rollers: [{ from: [-HALF + 1, HEAD - 3], to: [HALF - 1, HEAD - 3], down: [0, -1], kinds: ['steelCoil'], every: 1.8, speed: 4, run: HEAD - FOOT }],
    rollback: true,
    finish: { pos: [TOWER[0], TOWER[1]], half: [7, 7] },
    stars: [0, 0.6],
    par: 240,
  };
}
