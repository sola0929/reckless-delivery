import type { ObjectDesc, ObjectKindId } from './objects';
import { mulberry32, standardLoad } from './sandbox';
import { heightAt, makeTerrain } from './terrain';
import type { CrowdDesc, LevelDef, PropDesc, Vec2 } from './types';

// A proving ground for ground that rises and falls: one of each kind of thing a hill can
// do to a truck with a load on it, one after another, to try the feel of each before a
// level is built on it. Nothing is at stake here.
//
//   z   40 - 110   rollers: one crest after another
//   z  118 - 207   a sunken lane: the track cut down between walls of rock
//   z  215 - 330   hairpins: the track climbs a hillside in five traverses
//   z  340 - 478   a mountain road: rock rising on one hand, a drop on the other
//   z  483 - 509   a hanging bridge over a gorge
//   z  520 - 640   a rough way down: broken ground and boulders
//   z  655 - 725   a street down a slope: houses stepped down it, and things that roll
//
// Whatever is too steep to drive up is bare rock, and looks it. Grass and earth can be driven on.

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** One between `a` and `b`, nought outside, easing over `edge` metres at each end. */
const within = (a: number, b: number, v: number, edge = 12) => smooth(a, a + edge, v) * (1 - smooth(b - edge, b, v));

/** How high the hill is that the hairpins climb, the mountain road runs along and the rough way comes down. */
const TOP = 18;
/** The lane, and the height its floor is cut to; and the hairpins, climbing as they go. */
const LANE: [number, number, number][] = [[0, 118, 0], [0, 130, 0.3], [10, 147, 0.3], [-10, 172, 0.3], [0, 192, 0.3], [0, 207, 0]];
const HAIRPINS: [number, number, number][] = (() => {
  const turns: Vec2[] = [[0, 215], [26, 235], [-26, 258], [26, 281], [-26, 304], [0, 330]];
  let total = 0;
  const lengths = turns.slice(1).map(([x, z], n) => (total += Math.hypot(x - turns[n][0], z - turns[n][1])));
  return turns.map(([x, z], n) => [x, z, n ? (TOP * lengths[n - 1]) / total : 0]);
})();
/** Where the middle of the mountain road is, and of the rough way down, at each Z. */
const ledgeX = (z: number) => (z > 345 && z < 470 ? 6 * Math.sin(((z - 345) / 125) * Math.PI * 2) : 0);
const roughX = (z: number) => (z > 520 && z < 640 ? 8 * Math.sin(((z - 520) / 120) * Math.PI * 2) : 0);
/** The gorge, and the bridge over it: from where to where, and how far it hangs down in the middle. */
const GORGE = [484, 508];
const BRIDGE = [482.5, 509.5];
const SAG = 0.7;
/** Where the houses of the street stand: [x, z], each on its own level patch, half this wide and half this deep. */
const PADS: Vec2[] = [668, 682, 696, 710].flatMap((z): Vec2[] => [[-11.5, z], [11.5, z]]);
const PAD = [5, 5.5];

/** How far a place is from a line of points, and the height the line has where it comes nearest. */
function nearest(path: [number, number, number][], x: number, z: number): [number, number] {
  let best = Infinity;
  let high = 0;
  for (let n = 0; n < path.length - 1; n++) {
    const [ax, az, ah] = path[n];
    const [bx, bz, bh] = path[n + 1];
    const length = Math.hypot(bx - ax, bz - az);
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (length * length)));
    const away = Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t);
    if (away < best) {
      best = away;
      high = ah + (bh - ah) * t;
    }
  }
  return [best, high];
}

/** The lie of the land before anything is cut into it, and without the valley's sides. */
function land(x: number, z: number): number {
  // Small unevenness everywhere but at the start and in the street.
  const rough = (0.35 * Math.sin(x * 0.21 + 1.3) * Math.sin(z * 0.17) + 0.2 * Math.sin(x * 0.53) * Math.cos(z * 0.47)) * (1 - within(-40, 36, z)) * (1 - within(645, 760, z));
  const rollers = 1.5 * Math.sin(((z - 40) / 30) * Math.PI * 2) * within(40, 110, z, 8);
  const plateau = 3.5 * within(118, 207, z);
  const hill = TOP * smooth(220, 328, z) - (TOP - 2) * smooth(525, 635, z) - 6 * smooth(655, 715, z);
  // The rough way down: broken all over, in two sizes of lump.
  const broken = (0.5 * Math.sin(x * 0.6) * Math.sin(z * 0.55) + 0.3 * Math.sin(z * 0.35 + x * 0.3)) * within(522, 640, z, 10);
  return rough + rollers + plateau + hill + broken;
}

function height(x: number, z: number): number {
  let h = land(x, z);
  // The lane: cut straight down between walls. The hairpins: cut into the hill on one side and built out on the other.
  for (const [path, half, blend] of [[LANE, 4.5, 2], [HAIRPINS, 5, 6]] as const) {
    const [away, high] = nearest(path, x, z);
    h += (high - h) * (1 - smooth(half, half + blend, away));
  }
  // The mountain road: a shelf, with the mountain going up from one edge of it and nothing at all beyond the other.
  const shelf = within(340, 478, z, 8);
  if (shelf > 0) {
    const off = x - ledgeX(z);
    h += (TOP + 14 * smooth(4.5, 9, -off) - TOP * smooth(4.5, 7.5, off) - h) * shelf;
  }
  // The gorge: straight down, right across.
  h -= h * within(GORGE[0], GORGE[1], z, 2.5);
  // Each house stands on a level patch, a step below the one above it.
  for (const [px, pz] of PADS) {
    const out = Math.max(Math.abs(x - px) - PAD[0], Math.abs(z - pz) - PAD[1]);
    h += (land(px, pz) - h) * (1 - smooth(0, 1.6, out));
  }
  // The valley's sides: what keeps anything from wandering off.
  return h + 14 * smooth(37, 49, Math.abs(x));
}

/** The way through, down the middle of the track. */
const steps = (from: number, to: number, x: (z: number) => number): Vec2[] => {
  const out: Vec2[] = [];
  for (let z = from; z <= to; z += 12.5) out.push([x(z), z]);
  return out;
};
const ROUTE: Vec2[] = [
  [0, -10], ...LANE.map(([x, z]): Vec2 => [x, z]), ...HAIRPINS.map(([x, z]): Vec2 => [x, z]),
  ...steps(345, 470, ledgeX), [0, BRIDGE[0]], [0, BRIDGE[1]], ...steps(520, 645, roughX), [0, 655], [0, 740],
];
const TRACK: [number, number, number][] = ROUTE.map(([x, z]) => [x, z, 0]);

function colour(x: number, z: number, _h: number, slope: number): number {
  const speck = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  const light = speck - Math.floor(speck) < 0.5;
  const street = z > 655 && z < 725;
  if (PADS.some(([px, pz]) => Math.abs(x - px) < PAD[0] + 0.8 && Math.abs(z - pz) < PAD[1] + 0.8)) return 0x9a958b;
  // Too steep to drive up: rock, and it should look like it.
  if (slope > 0.85) return light ? 0x8b8880 : 0x7c7a74;
  if (nearest(TRACK, x, z)[0] < (street ? 5.5 : 3.6)) return street ? 0x8f8a82 : light ? 0x8a7a5e : 0x837358;
  // Too steep to hold grass: bare earth.
  if (slope > 0.45) return light ? 0x7d6c50 : 0x746247;
  return light ? 0x7f9450 : 0x778b4a;
}

export function hills(): LevelDef {
  const rand = mulberry32(11);
  const span = (a: number, b: number) => a + rand() * (b - a);
  const terrain = makeTerrain([-70, -30], [70, 752], 1.5, height, colour);
  const ground = (x: number, z: number) => heightAt(terrain, x, z);
  const props: PropDesc[] = [];
  const objects: ObjectDesc[] = [];
  const crowds: CrowdDesc[] = [];
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0) => objects.push({ kind, pos: [x, ground(x, z), z], rotY });
  /** A lump of rock, set a little into the ground: it does not move. */
  const rock = (x: number, z: number, size: number) =>
    props.push({ shape: 'box', size: [size, size * 0.7, size * span(0.8, 1.2)], pos: [x, ground(x, z) + size * 0.3, z], rot: [span(-0.25, 0.25), rand() * 3, span(-0.25, 0.25)], color: rand() < 0.5 ? 0x8b8880 : 0x77756f });

  // On the rollers: boxes on the crests, to be met in the air.
  for (const z of [47.5, 77.5]) for (const x of [-2.5, 0, 2.5]) object('box', x, z);
  // Along the tops of the lane's walls: trees. In the lane: what has fallen in.
  const laneX = (z: number) => {
    const n = Math.max(0, LANE.findIndex(([, pz]) => pz > z) - 1);
    const [ax, az] = LANE[n];
    const [bx, bz] = LANE[n + 1];
    return ax + ((bx - ax) * (z - az)) / (bz - az);
  };
  for (let z = 132; z < 198; z += 7) for (const side of [-1, 1]) object('treeSmall', laneX(z) + side * 11.5, z);
  object('barrel', 2, 140);
  object('cart', -4, 168, 0.8);
  // At each hairpin: a marker on the outside of the bend. On the hillside, a few trees.
  for (const [x, z] of HAIRPINS.slice(1, -1)) object('haystack', x + Math.sign(x) * 3, z);
  for (let i = 0; i < 20; i++) {
    const x = span(-34, 34);
    const z = span(222, 326);
    if (nearest(HAIRPINS, x, z)[0] > 10) object('treeSmall', x, z);
  }

  // The mountain road: posts along the edge, which hold nothing back, and rock that has come down off the mountain.
  for (let z = 350; z <= 468; z += 8) object('post', ledgeX(z) + 4.1, z);
  for (const [z, off, size] of [[378, -3.3, 0.9], [412, -3.1, 1.1], [414.5, -3.6, 0.8], [446, 3.2, 0.8], [447, -3.3, 1]]) rock(ledgeX(z) + off, z, size);

  // The bridge: planks hung from two ropes, sagging in the middle, and nothing at the sides but the ropes.
  const mid = (BRIDGE[0] + BRIDGE[1]) / 2;
  const half = (BRIDGE[1] - BRIDGE[0]) / 2;
  const hang = (z: number) => -SAG * (1 - ((z - mid) / half) ** 2);
  const planks = 13;
  const length = (BRIDGE[1] - BRIDGE[0]) / planks;
  for (let n = 0; n < planks; n++) {
    const z = BRIDGE[0] + (n + 0.5) * length;
    const pitch = -Math.atan((2 * SAG * (z - mid)) / (half * half));
    props.push({ shape: 'box', size: [2.2, 0.12, length / 2 + 0.03], pos: [0, TOP + hang(z) - 0.12, z], rot: [pitch, 0, 0], color: n % 2 ? 0x9a7448 : 0x8a6840, mapColor: 0x6a5a48 });
    for (const side of [-1, 1]) {
      props.push({ shape: 'box', size: [0.035, 0.035, length / 2 + 0.03], pos: [side * 2.3, TOP + hang(z) + 1.1, z], rot: [pitch, 0, 0], color: 0x5a4630, ghost: true });
      props.push({ shape: 'box', size: [0.02, 0.55, 0.02], pos: [side * 2.3, TOP + hang(z) + 0.55, z], color: 0x5a4630, ghost: true });
    }
  }
  for (const z of BRIDGE) for (const side of [-1, 1]) props.push({ shape: 'cylinder', size: [0.16, 1.1, 0], pos: [side * 2.5, TOP + 1.1, z], color: 0x5a4630 });

  // The rough way down: boulders all over it, and the way between them never straight.
  for (let i = 0; i < 34; i++) {
    const z = span(528, 634);
    const x = span(-30, 30);
    if (Math.abs(x - roughX(z)) > 3.4) rock(x, z, span(0.7, 1.6));
  }

  // The street: a house on every patch, and outside each of them something that will roll.
  PADS.forEach(([x, z], n) => {
    const base = ground(x, z);
    const high = span(4.5, 6.5);
    props.push({ shape: 'box', size: [PAD[0] - 0.6, high / 2, PAD[1] - 0.8], pos: [x, base + high / 2, z], color: [0xd8c9a8, 0xc9b28a, 0xb9a48c, 0xd2b8a0][n % 4], mapColor: 0x4a4038 });
    const side = Math.sign(x);
    for (const up of [1.7, 4.2]) for (const along of [-2.6, 0, 2.6]) props.push({ shape: 'box', size: [0.03, 0.6, 0.45], pos: [x - side * (PAD[0] - 0.58), base + up, z + along], color: 0x2e2a28, ghost: true });
    for (const tilt of [-1, 1]) props.push({ shape: 'box', size: [(PAD[0] - 0.3) / Math.cos(0.5) / 2 + 0.2, 0.12, PAD[1] - 0.5], pos: [x + (tilt * (PAD[0] - 0.6)) / 2, base + high + ((PAD[0] - 0.6) * Math.tan(0.5)) / 2, z], rot: [0, 0, -tilt * 0.5], color: n % 2 ? 0xa8553a : 0x5f646b, ghost: true });
    object(n % 3 ? 'barrel' : 'cart', x - side * 6.6, z + 2, 0.4);
    object('box', x - side * 6.4, z - 2.5);
  });
  for (const [x, z] of [[-2, 674], [2.5, 688], [-1.5, 702], [1, 716]]) object('barrel', x, z);
  crowds.push({ area: [-4.5, 663, 4.5, 717], count: 6, y: 0 });
  for (const side of [-1, 1]) object('flagTeal', side * 5, 734);

  return {
    id: 'hills',
    name: '地形試驗場',
    brief: '起伏、凹路、髮夾彎、懸崖山路、吊橋、亂石下坡、坡上的街：一樣一樣試',
    ground: { center: [0, 360], half: [70, 392], style: 'earth' },
    terrain,
    bounds: [[-62, -30], [62, 752]],
    spawn: [0, ground(0, 0) + 0.9, 0],
    heading: 0,
    props,
    objects,
    crowds,
    route: ROUTE,
    decals: [],
    cargo: standardLoad(),
    traffic: [],
    stars: [0.6, 0.8],
    par: 300,
  };
}
