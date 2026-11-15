import { bar, box, dropUnder, hedge, kiosk, put, raftLift, waterSlide, wayPoints, type ParkSite, type WayPoint } from './parkParts';
import { BEACH, BEACH_END, CANAL, LANE_N, LANE_S, LIFT_FOOT, LIFT_X, POOL, POOL_WATER, SHELF, SHORE_Z, SLIDE_PLAN, SLIDE_PROFILE, SLIDE_TUBE, SPLASH, TOP, TOWER, WAVE_HOUSE } from './parkPlan';
import type { Look, P2 } from './relief';
import type { ObjectKindId } from './objects';
import type { Vec2 } from './types';

// 5 and 6. The wave pool and the big slide, the water park in the park's north-east corner.
//
// The wave pool: east across its shallows from the north shore. Its machine house along its north side, the deep water in
// front of it shelving up to the shallows the truck wades along, the beach to the south above the lake. A wave every few
// seconds, every third a big one: seen rising out over the deep water, breaking as it comes on to the shallows and running
// in across them and up the beach, taking what floats there with it, rings and mattresses and banana boats, into the
// truck, and the truck toward the beach's loungers. In the shallows, fountains and a lifeguard's float to be wound round.
//
// Out of its east end and hard right, between walls, on to the raft lift: up it south along the lake's east shore to the
// slide's tower; off its deck down the big slide, slippery, round to the east, back west through the tube round its
// hairpin, down into the splash pool; up out of it, west, and left for the pirate bay.

const P = Math.PI;
const POOL_LOOK: Look = { tag: 'pool', color: 0x4fa8c8, wall: 0xe8f0f2 };
const SAND: Look = { tag: 'sand', color: 0xf0dcae, wall: 0xd8c08a };
const PAVE: Look = { tag: 'paving', color: 0xd4c6ad, wall: 0x9a8e7a };
const DROP: Look = { tag: 'drop', color: 0x6a9a4e, wall: 0x5a7a44 };
const LAWN: Look = { tag: 'grass', color: 0x6f9e52, wall: 0x5a7a44 };

/** The wave pool's floor across it, from the machine house to the beach: deep, shelving up, the shallows, the beach. */
function poolFloor(z: number): number {
  if (z > SHELF) return -1.6;
  if (z > LANE_N) return -1.6 + (1.1 * (SHELF - z)) / (SHELF - LANE_N);
  if (z > LANE_S) return -0.5 + (0.1 * (LANE_N - z)) / (LANE_N - LANE_S);
  if (z > BEACH) return -0.4 + (0.55 * (LANE_S - z)) / (LANE_S - BEACH);
  return 0.15;
}

/** The turn out of the pool on to the lift: its middle, how far round; and the lift. */
const TURN: Vec2 = [LIFT_X + 10, SHORE_Z - 10];
const LIFT = wayPoints([LIFT_X, LIFT_FOOT], P, [{ long: 72 }], [[0, 0], [5, 0, 4], [70, TOP, 6], [72, TOP]], 1);

/** Along the pool, metres from where the way comes in at its west end, and across it, toward the beach: where that is. */
const at = (along: number, across = 0): Vec2 => [POOL.x1 - along, SHORE_Z - across];
const LONG = POOL.x1 - POOL.x0;

export const POOL_ROUTE: Vec2[] = [
  [POOL.x1 + 14, SHORE_Z], at(-6), at(10, -2.6), at(20, -2.6), at(29, 3.4), at(35, 3.4), at(44, -2.6), at(52, -2.6), at(LONG + 4), [TURN[0] + 1, SHORE_Z],
  [TURN[0] - 10 * Math.sin(P / 4), TURN[1] + 10 * Math.cos(P / 4)], [LIFT_X, TURN[1]], ...LIFT.filter((_, k) => k % 6 === 0).map((p) => [p.x, p.z] as Vec2), [LIFT_X, TOWER.z0 + 2],
];

export function waterRides(s: ParkSite): { slide: WayPoint[] } {
  const { props, signs, crowds, relief } = s;
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, y = 0) => put(s, kind, x, z, rotY, y);
  const rect = (x0: number, z0: number, x1: number, z1: number): P2[] => [[Math.min(x0, x1), Math.min(z0, z1)], [Math.max(x0, x1), Math.min(z0, z1)], [Math.max(x0, x1), Math.max(z0, z1)], [Math.min(x0, x1), Math.max(z0, z1)]];

  // ------------------------------------------------------------------------------------------------------------------
  // The wave pool.
  relief.area(rect(POOL.x0, BEACH_END, POOL.x1, WAVE_HOUSE), (_x, z) => poolFloor(z), POOL_LOOK);
  relief.area(rect(POOL.x0, BEACH_END, POOL.x1, BEACH), 0.15, SAND);
  // In at its west end down a ramp off the shore, out at its east end up another.
  relief.area(rect(POOL.x1, LANE_S, POOL.x1 + 10, LANE_N), (x) => (-0.45 * (POOL.x1 + 10 - x)) / 10, POOL_LOOK);
  relief.area(rect(POOL.x0 - 10, LANE_S, POOL.x0, LANE_N), (x) => (-0.45 * (x - (POOL.x0 - 10))) / 10, POOL_LOOK);
  s.fords.push({ pos: [(POOL.x0 + POOL.x1) / 2, (WAVE_HOUSE + BEACH) / 2], half: [LONG / 2, (WAVE_HOUSE - BEACH) / 2], flow: [0, -0.15], surface: POOL_WATER, drag: 0.3, sideGrip: 0.7 });
  s.fords.push({ pos: [POOL.x1 + 3, SHORE_Z], half: [3, 6], flow: [0, 0], surface: POOL_WATER, drag: 0.3 });
  s.fords.push({ pos: [POOL.x0 - 3, SHORE_Z], half: [3, 6], flow: [0, 0], surface: POOL_WATER, drag: 0.3 });
  // Its coping round both ends but where the ramps come in, and a wall along the beach's foot above the lake.
  for (const x of [POOL.x0, POOL.x1]) for (const [a, b] of [[LANE_N + 0.4, WAVE_HOUSE], [BEACH_END - 0.4, LANE_S - 0.4]]) box(props, x - 0.35, 0, a, x + 0.35, 0.35, b, 0xf2f2ee, { mapColor: 0xe8f0f2 });
  box(props, POOL.x0 - 0.35, 0, BEACH_END - 0.8, POOL.x1 + 0.35, 0.9, BEACH_END, 0xf2f2ee, { mapColor: 0xe8f0f2 });
  for (let x = POOL.x0 + 1; x < POOL.x1; x += 2) bar(props, [x, 0.9, BEACH_END - 0.4], [x, 1.6, BEACH_END - 0.4], 0.03, 0xd8dce0, { ghost: true });
  bar(props, [POOL.x0, 1.6, BEACH_END - 0.4], [POOL.x1, 1.6, BEACH_END - 0.4], 0.04, 0xd8dce0, { ghost: true });
  s.waves.push({ from: [POOL.x1 - 1, LANE_N], to: [POOL.x0 + 1, LANE_N], inland: [0, -1], reach: LANE_N - BEACH_END - 4, period: 6.5, phase: 0.3, big: 3, force: 1.5, y: POOL_WATER, sea: -1.3, out: WAVE_HOUSE - LANE_N - 4, tint: 0x3f9cc4, takes: true });
  // The machine house: a long block along the north side, the grilles of its chambers in a row at the water, the pool's
  // name and the board saying when the big one comes; the lifeguards' high chairs.
  box(props, POOL.x0 - 3, -1.6, WAVE_HOUSE, POOL.x1 + 3, 6.5, WAVE_HOUSE + 7, 0xe8eef2, { mapColor: 0xb0b8c0 });
  box(props, POOL.x0 - 3.3, 6.5, WAVE_HOUSE - 0.3, POOL.x1 + 3.3, 7.0, WAVE_HOUSE + 7.3, 0x2f6fb0, { ghost: true });
  for (let x = POOL.x0 + 2; x < POOL.x1 - 1; x += 5) box(props, x - 1.8, -1.2, WAVE_HOUSE - 0.04, x + 1.8, 0.5, WAVE_HOUSE + 0.02, 0x2a3a48, { ghost: true });
  for (let x = POOL.x0 + 4.5; x < POOL.x1 - 1; x += 5) box(props, x - 0.4, -1.6, WAVE_HOUSE - 0.4, x + 0.4, 1.0, WAVE_HOUSE, 0xf2f2ee, { ghost: true });
  signs.push({ pos: [(POOL.x0 + POOL.x1) / 2, 4.8, WAVE_HOUSE - 0.06], rotY: P, kind: 'name', text: '衝浪造浪池', colors: ['#2f6fb0', '#ffffff', '#f2a52e'], wide: 12 });
  signs.push({ pos: [POOL.x1 - 12, 2.6, WAVE_HOUSE - 0.06], rotY: P, kind: 'name', text: '大浪 每 3 波', colors: ['#2a3a48', '#f2c12e', '#f2efe6'], wide: 4.5 });
  const chair = (x: number, z: number, y0: number) => {
    for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) bar(props, [x + dx, y0, z + dz], [x + dx * 0.6, 2.6, z + dz * 0.6], 0.07, 0xf2efe6);
    box(props, x - 0.7, 2.6, z - 0.7, x + 0.7, 2.75, z + 0.7, 0xf2efe6);
    box(props, x - 0.1, 2.75, z - 0.5, x + 0.1, 3.5, z + 0.5, 0xd23a32, { ghost: true });
    props.push({ shape: 'cone', size: [1.1, 0.35, 0], pos: [x, 4.5, z], color: 0xd23a32, ghost: true });
    bar(props, [x, 2.75, z], [x, 4.2, z], 0.04, 0xf2efe6, { ghost: true });
  };
  chair(...at(18, 17), 0.15);
  chair(...at(LONG - 16, 17), 0.15);
  chair(...at(32, -(WAVE_HOUSE - SHORE_Z) + 2.2), -1.6);
  // In the shallows, mushroom fountains and a lifeguard's float, fixed, to be wound round; a line of buoys where the deep begins.
  for (const along of [16, 48]) {
    const [x, z] = at(along, 2.6);
    bar(props, [x, -0.5, z], [x, 2.6, z], 0.35, 0x3fb0e0);
    props.push({ shape: 'sphere', size: [2.4, 0.9, 2.4], pos: [x, 2.7, z], color: along === 16 ? 0xf0609a : 0xf6d55c, ghost: true });
    props.push({ shape: 'cylinder', size: [2.3, 0.05, 0], pos: [x, 2.5, z], color: 0xffffff, ghost: true });
    props.push({ shape: 'cylinder', size: [0.9, 0.1, 0], pos: [x, poolFloor(z) - 0.06, z], color: 0x3fb0e0 });
  }
  {
    const [fx, fz] = at(32);
    box(props, fx - 1.6, -0.5, fz + 0.4, fx + 1.6, 0.25, fz + 3.6, 0xf2c12e);
    box(props, fx - 1.5, 0.25, fz + 0.5, fx + 1.5, 0.3, fz + 3.5, 0xd23a32, { ghost: true });
  }
  for (let along = 3; along < LONG - 2; along += 3) object('buoy', at(along)[0], SHELF - 2, 0, POOL_WATER - 0.2);
  // What floats in the shallows and at the deep edge of them, for the waves to throw.
  const FLOATS: [ObjectKindId, number, number][] = [
    ['swimRing', -4, 4], ['floatMat', -1, 7], ['swimRingBlue', 2, 9], ['bananaBoat', -5, 13], ['swimRing', 3, 15], ['rideRaft', -2, 18],
    ['floatMat', 4, 21], ['swimRingBlue', -5, 25], ['swimRing', 0, 27], ['bananaBoat', 3, 30], ['floatMat', -4, 36], ['rideRaft', 1, 39],
    ['swimRingBlue', 4, 41], ['swimRing', -1, 47], ['floatMat', 3, 50], ['bananaBoat', -4, 53], ['swimRing', 1, 57], ['swimRingBlue', -2, 60],
    ['floatMat', -9, 10], ['swimRing', -10, 20], ['bananaBoat', -9, 34], ['swimRingBlue', -10, 46], ['floatMat', -9, 56],
  ];
  for (const [kind, across, along] of FLOATS) {
    const [x, z] = at(along, across);
    object(kind, x, z, along * 0.7 + P / 2, Math.max(poolFloor(z), POOL_WATER - 0.3));
  }
  // The beach: rows of loungers under parasols, the rings for hire, palms, showers; people on it, and in the shallows.
  for (let along = 4; along < LONG - 3; along += 4.5) for (const across of [19, 23.5]) {
    const [x, z] = at(along, across);
    object('lounger', x, z, 0, 0.15);
    if (along % 9 < 4.5) object('umbrella', x + 1.2, z - 1.6, 0, 0.15);
  }
  for (const along of [10, 40]) object('ringRack', ...at(along, 16.5), 0, 0.15);
  for (let along = 2; along < LONG; along += 10) object('palm', ...at(along, 27.5), 0, 0.15);
  for (const along of [26, LONG - 6]) {
    const [x, z] = at(along, 16);
    bar(props, [x, 0.15, z], [x, 2.6, z], 0.05, 0xc8ccd0);
    bar(props, [x, 2.6, z], [x, 2.6, z + 0.6], 0.04, 0xc8ccd0, { ghost: true });
  }
  crowds.push({ area: [POOL.x0 + 2, BEACH_END + 2, POOL.x1 - 2, BEACH - 2], count: 34, y: 0.15 }, { area: [POOL.x0 + 4, LANE_S - 3, POOL.x1 - 4, LANE_S], count: 10, y: -0.4 });
  // Over the way in, the lamps either side of the ramp. Before it, what a pool has at its gate: the showers to rinse
  // under, in a row on a drained floor, the board telling everyone to; the rings for hire on their racks either side.
  for (const z of [LANE_S - 2, LANE_N + 2]) object('parkLamp', POOL.x1 + 12, z);
  {
    const z = LANE_N + 4.5;
    box(props, POOL.x1 + 1, 0.005, z - 1.6, POOL.x1 + 15, 0.03, z + 1.6, 0x9ac8d8, { ghost: true });
    for (let x = POOL.x1 + 2.5; x < POOL.x1 + 14; x += 2.8) {
      bar(props, [x, 0, z + 1], [x, 2.5, z + 1], 0.05, 0xc8ccd0);
      bar(props, [x, 2.5, z + 1], [x, 2.5, z + 0.3], 0.035, 0xc8ccd0, { ghost: true });
      props.push({ shape: 'cylinder', size: [0.14, 0.04, 0], pos: [x, 2.45, z + 0.3], color: 0x8a8f96, ghost: true });
    }
    crowds.push({ area: [POOL.x1 + 2, z - 1, POOL.x1 + 14, z + 0.6], count: 7, y: 0 });
    signs.push({ pos: [POOL.x1 + 8, 3.2, z + 1.4], rotY: P, kind: 'name', text: '入池前請沖洗', colors: ['#2f6fb0', '#ffffff', '#f2efe6'], wide: 4.2 });
    for (const [x, zz] of [[POOL.x1 + 13, LANE_N - 0.6], [POOL.x1 + 11, LANE_S + 0.8]] as const) object('ringRack', x, zz, P / 2);
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Out of its east end: between walls, hard right on to the raft lift. Behind the walls, the lake on one hand and the
  // water park on the other.
  {
    const R = SHORE_Z - TURN[1], half = 4.5;
    const arc = (r: number): P2[] => Array.from({ length: 7 }, (_, k) => [TURN[0] - Math.sin((k / 6) * P / 2) * r, TURN[1] + Math.cos((k / 6) * P / 2) * r] as P2);
    // On beside the lift as far as where it is up off the ground, so that nothing gets out past its foot.
    const beside = LIFT.find((p) => p.y > 2.4)!.z;
    const inner = [[POOL.x0 + 0.35, LANE_S - 0.4] as P2, ...arc(R - half), [LIFT_X + half, beside] as P2];
    const outer = [[POOL.x0 + 0.35, LANE_N + 0.4] as P2, ...arc(R + half), [LIFT_X - half, beside] as P2];
    for (const line of [inner, outer]) for (let k = 0; k < line.length - 1; k++) hedge(props, line[k], line[k + 1], 0.9, 0.9, line === inner ? 0x3fb0e0 : 0xf6d55c);
    relief.area(rect(LIFT_X - 16, LIFT_FOOT - 2, POOL.x0 - 10, LANE_N + 2), 0, PAVE);
    signs.push({ pos: [LIFT_X, 3.2, LIFT_FOOT + 0.5], rotY: Math.PI * 0, kind: 'name', text: '大滑水道 入口', colors: ['#2f6fb0', '#ffffff', '#f2a52e'], wide: 5 });
    for (const x of [LIFT_X - 3.2, LIFT_X + 3.2]) bar(props, [x, 0, LIFT_FOOT + 0.5], [x, 3.8, LIFT_FOOT + 0.5], 0.08, 0x2f6fb0);
    // Outside the walls on the east, the people's queue for the slide, beside the lift up to the tower's stairs, each with
    // a ring; the height board at its head. On the lake side, the rafts stacked for hire, the lifeguards' hut.
    {
      const xa = LIFT_X - 17, xb = LIFT_X - 13, zTop = LIFT_FOOT - 8;
      for (const x of [xa, xb]) for (let z = zTop; z > TOWER.z0 + 2; z -= 2.5) {
        props.push({ shape: 'cylinder', size: [0.05, 0.5, 0], pos: [x, 0.5, z], color: 0x8a8f96, ghost: true });
        if (z - 2.5 > TOWER.z0 + 2) box(props, x - 0.02, 0.86, z - 2.5, x + 0.02, 0.94, z, 0x2f6fb0, { ghost: true });
      }
      crowds.push({ area: [xa + 0.5, TOWER.z0 + 4, xb - 0.5, zTop - 1], count: 28, y: 0 });
      for (let z = zTop - 4; z > TOWER.z0 + 8; z -= 7) props.push({ shape: 'cylinder', size: [0.55, 0.12, 0], pos: [xa + 2 + (z % 2) * 0.6, 1.1, z], rot: [P / 2, 0, 0.3], color: z % 14 < 7 ? 0xf0609a : 0x3fb0e0, ghost: true });
      bar(props, [xb + 1.4, 0, zTop + 1], [xb + 1.4, 3, zTop + 1], 0.08, 0xf2c12e, { ghost: true });
      box(props, xb + 1.0, 1.2, zTop + 0.98, xb + 1.8, 3, zTop + 1.02, 0x3fb0e0, { ghost: true });
      signs.push({ pos: [xa - 0.4, 2.4, zTop + 1.2], rotY: 0, kind: 'name', text: '身高 120 公分以上', colors: ['#d23a32', '#ffffff', '#f2efe6'], wide: 3.6 });
      for (let k = 0; k < 3; k++) {
        const z = LIFT_FOOT + 2 - k * 2.5;
        for (let h = 0; h < 4; h++) box(props, LIFT_X + 9, h * 0.3, z - 1.1, LIFT_X + 11.2, h * 0.3 + 0.28, z + 1.1, [0xf2c12e, 0x3fb0e0, 0xf0609a, 0x4fa86a][(h + k) % 4], { ghost: h > 0 });
      }
      kiosk(props, signs, { at: [LIFT_X + 10, LIFT_FOOT - 10.5], yaw: -P / 2, half: [3, 2.4], high: 3.2, wall: 0xf2efe6, trim: 0xd23a32, roof: 'flat', roofColor: 0xd23a32, name: '救生員', front: 'counter' });
    }
  }

  // The lift up south along the lake's east shore to the tower, and the tower's deck.
  raftLift(props, LIFT);
  const T0 = TOWER.z1, T1 = TOWER.z0;
  for (let z = LIFT_FOOT - 6; z > T0; z -= 9) for (const side of [-1, 1]) {
    object(z % 18 < 9 ? 'palm' : 'tree', LIFT_X + side * 11, z);
    props.push({ shape: 'sphere', size: [1.4, 0.8, 1.4], pos: [LIFT_X + side * 7.5, 0.4, z - 4], color: [0x4f8a3a, 0x5a9a42][Math.abs(z / 9) % 2 | 0], ghost: true });
    props.push({ shape: 'sphere', size: [0.5, 0.35, 0.5], pos: [LIFT_X + side * 7.2, 0.95, z - 3.6], color: [0xf08ac0, 0xf2c12e, 0xe8544a][Math.abs(z / 9) % 3 | 0], ghost: true });
  }
  {
    const rx = LIFT_X;
    box(props, rx - 8, TOP - 0.4, T1, rx + 8, TOP, T0 + 0.5, 0xd8dcd6, { mapColor: 0x9aa0a6 });
    for (const x of [rx - 7.4, rx + 7.4]) for (const z of [T0 - 0.5, T1 + 0.6]) bar(props, [x, 0, z], [x, TOP - 0.4, z], 0.4, 0xf2efe6);
    for (const x of [rx - 8, rx + 8]) box(props, x - 0.05, TOP, T1, x + 0.05, TOP + 1.1, T0, 0xf2c12e, { ghost: true });
    for (const x of [rx - 7.6, rx + 7.6]) bar(props, [x, TOP, T0 - 2], [x, TOP + 4.6, T0 - 2], 0.14, 0x2f6fb0);
    box(props, rx - 8.4, TOP + 4.6, T1 + 1, rx + 8.4, TOP + 4.8, T0 - 1, 0x2f6fb0, { ghost: true, fade: true, overhead: true });
    signs.push({ pos: [rx, TOP + 6.2, T1 + 1.2], rotY: 0, kind: 'name', text: '激流大滑水道', colors: ['#2f6fb0', '#ffffff', '#f2a52e'], wide: 9 });
    for (const x of [rx - 4.4, rx + 4.4]) bar(props, [x, TOP + 4.8, T1 + 1.2], [x, TOP + 6.2, T1 + 1.2], 0.08, 0x2f6fb0, { ghost: true });
    crowds.push({ area: [rx + 4, T1 + 2, rx + 7, T0 - 2], count: 8, y: 0, raised: TOP });
    for (const z of [T0 - 4, T0 - 9]) s.objects.push({ kind: 'rideRaft', pos: [rx - 5, TOP, z], rotY: z });
    // Rafts on their way up the lift ahead of the truck, one after another, and two on the deck waiting their turn at the
    // slide's mouth: shoved, they go down it first.
    for (const [at, across] of [[16, 0.5], [30, -0.6], [44, 0.4], [58, -0.5]] as const) { const p = LIFT.find((q) => q.s >= at)!; s.objects.push({ kind: 'rideRaft', pos: [p.x + across, p.y, p.z], rotY: at, tilt: -Math.atan(p.grade) }); }
    for (const [x, z] of [[rx + 1.3, T0 - 6.5], [rx - 1.2, T1 + 3.2]] as const) s.objects.push({ kind: 'rideRaft', pos: [x, TOP, z], rotY: x });
  }
  const slide = waterSlide(props, { start: [LIFT_X, TOWER.z0], yaw: P, plan: SLIDE_PLAN, profile: SLIDE_PROFILE, tube: SLIDE_TUBE });
  dropUnder(relief, [...LIFT.filter((p) => p.y > 2.4), ...slide.filter((p) => p.y > 1.6)], 1.6, 6.5, DROP);
  relief.area(rect(LIFT_X - 8.5, T1 - 1, LIFT_X + 8.5, T0 + 1), 0, DROP);

  // The splash pool at its foot, on the way the slide comes down, and the way up out of it at its far end.
  const end = slide[slide.length - 1];
  const dx = Math.sin(end.yaw), dz = Math.cos(end.yaw);
  /** A point so far on from the slide's foot and so far across, to the left. */
  const on = (ahead: number, across = 0): Vec2 => [end.x + dx * ahead + dz * across, end.z + dz * ahead - dx * across];
  const { long: POOL_LONG, ramp: RAMP, half: POOL_HALF } = SPLASH;
  const span = (a0: number, a1: number, half: number): P2[] => [on(a0, -half), on(a1, -half), on(a1, half), on(a0, half)];
  relief.area(span(-4, POOL_LONG + RAMP + 30, POOL_HALF + 9), 0, PAVE);
  relief.area(span(-1, POOL_LONG, POOL_HALF), -1.2, POOL_LOOK);
  relief.area(span(POOL_LONG, POOL_LONG + RAMP, 6), (x, z) => -1.2 + (1.2 * ((x - end.x) * dx + (z - end.z) * dz - POOL_LONG)) / RAMP, POOL_LOOK);
  {
    const [mx, mz] = on((POOL_LONG + RAMP) / 2 - 1);
    s.fords.push({ pos: [mx, mz], half: [(POOL_LONG + RAMP) / 2 + 1, POOL_HALF], flow: [dx * 0.4, dz * 0.4], surface: -0.25, drag: 0.35 });
    // Its rim: a coping round the pool, but at the slide's foot and the ramp out.
    for (const side of [-1, 1]) {
      const [ax, az] = on(-1, side * (POOL_HALF + 0.35)), [bx, bz] = on(POOL_LONG + RAMP, side * (POOL_HALF + 0.35));
      box(props, Math.min(ax, bx), 0, Math.min(az, bz) - 0.35, Math.max(ax, bx), 0.35, Math.max(az, bz) + 0.35, 0xf2f2ee, { mapColor: 0xe8f0f2 });
    }
    for (const side of [-1, 1]) {
      const [ax, az] = on(POOL_LONG, side * 6.35), [bx, bz] = on(POOL_LONG, side * (POOL_HALF + 0.35));
      box(props, ax - 0.35, 0, Math.min(az, bz), ax + 0.35, 0.35, Math.max(az, bz), 0xf2f2ee);
      void bx;
    }
    const [lx, lz] = on(8, POOL_HALF + 2.5);
    for (const [ox, oz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) bar(props, [lx + ox, 0, lz + oz], [lx + ox * 0.6, 2.4, lz + oz * 0.6], 0.07, 0xf2efe6);
    box(props, lx - 0.7, 2.4, lz - 0.7, lx + 0.7, 2.55, lz + 0.7, 0xf2efe6);
    box(props, lx - 0.5, 2.55, lz - 0.1, lx + 0.5, 3.3, lz + 0.1, 0xd23a32, { ghost: true });
    props.push({ shape: 'cone', size: [1.1, 0.35, 0], pos: [lx, 4.3, lz], color: 0xd23a32, ghost: true });
    for (let k = 0; k < 6; k++) {
      const [ux, uz] = on(3 + k * 3.2, -(POOL_HALF + 3));
      object('umbrella', ux, uz);
      object('lounger', ux + 1, uz, end.yaw);
    }
    const [kx, kz] = on(12, POOL_HALF + 5.5);
    kiosk(props, signs, { at: [kx, kz], yaw: end.yaw - P / 2, half: [5, 2.6], high: 3.8, wall: 0xd8f0f6, trim: 0xffffff, roof: 'pitched', roofColor: 0x2f6fb0, name: '更衣室', front: 'toilets' });
    for (const side of [-1, 1]) for (let k = 2; k < POOL_LONG; k += 4) {
      const [x, z] = on(k, side * (POOL_HALF - 0.5));
      object('buoy', x, z, 0, -0.25);
    }
    for (const side of [-1, 1]) {
      const [ax, az] = on(side > 0 ? 18 : 0, side * (POOL_HALF + 2)), [bx, bz] = on(POOL_LONG + RAMP, side * (POOL_HALF + 6));
      crowds.push({ area: [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)], count: 16, y: 0 });
    }
  }
  {
    const [ox, oz] = on(POOL_LONG + RAMP + 10, -(POOL_HALF + 4));
    kiosk(props, signs, { at: [ox, oz], yaw: P, half: [4.5, 3], high: 3.6, wall: 0xe8f4f8, trim: 0xffffff, roof: 'flat', roofColor: 0x2f6fb0, name: '滑水照片', front: 'counter', awning: [0x2f6fb0, 0xffffff] });
    const [tx, tz] = on(POOL_LONG + RAMP + 22, -(POOL_HALF + 4));
    kiosk(props, signs, { at: [tx, tz], yaw: P, half: [3.5, 2.6], high: 3.4, wall: 0xfff4e4, trim: 0xffffff, roof: 'pitched', roofColor: 0xf2a52e, name: '毛巾租借', front: 'counter', awning: [0xf2a52e, 0xffffff] });
    for (let k = 0; k < 2; k++) {
      const [px, pz] = on(POOL_LONG + 4 + k * 7, POOL_HALF + 7);
      object('palm', px, pz);
    }
    // At the top of the way up out of the pool, either side of it: rings back on their racks, mats in a heap, a lounger or two.
    for (const [ahead, across, kind, turn] of [[2.5, 4.6, 'ringRack', P / 2], [2.5, -4.6, 'ringRack', P / 2], [5.5, 4.2, 'floatMat', 0.3], [6.2, 4.6, 'floatMat', 1.1], [5.2, -4.3, 'swimRing', 0], [6.4, -4.0, 'swimRingBlue', 0], [8.5, 4.4, 'lounger', 0.2], [9.5, -4.4, 'lounger', -0.2]] as const) { const [x, z] = on(POOL_LONG + RAMP + ahead, across); object(kind, x, z, end.yaw + turn); }
    const [hx, hz] = on(POOL_LONG + RAMP + 4, -(POOL_HALF + 4));
    crowds.push({ area: [Math.min(hx, ox) - 2, hz - 5.2, Math.max(hx, tx) + 2, hz - 3.6], count: 22, y: 0 });
  }
  // North of it all, between the splash pool and the lake and the lift: lawn, fenced off; the water park's buildings.
  relief.area(rect(16, end.z + POOL_HALF + 9, LIFT_X + 9, 262), 0, LAWN);
  // Inside the slide's loop, the sunbathing lawn: paths across it, loungers in rows under parasols, palms at its corners,
  // a pad of jets for the small children where the paths meet.
  {
    relief.area(rect(36, 252.2, 70, 253.8), 0, PAVE);
    relief.area(rect(53.2, 247, 54.8, 259), 0, PAVE);
    for (const z of [248.6, 257.4]) for (let x = 38.5; x < 69; x += 4.2) {
      if (Math.abs(x - 54) < 2.2) continue;
      object('lounger', x, z, z < 253 ? 0 : P);
      if (Math.round(x / 4.2) % 2) object('umbrella', x + 1.2, z);
    }
    for (const [x, z] of [[36, 247.5], [36, 258.5], [71, 247.5], [71, 258.5]] as const) object('palm', x, z);
    props.push({ shape: 'cylinder', size: [3.4, 0.03, 0], pos: [54, 0.03, 253], color: 0x7fc8e0, ghost: true });
    props.push({ shape: 'cylinder', size: [3.6, 0.02, 0], pos: [54, 0.02, 253], color: 0xf2f2ee, ghost: true });
    for (let k = 0; k < 5; k++) { const a = (k / 5) * P * 2; s.fountains.push([54 + Math.cos(a) * 2, 0.05, 253 + Math.sin(a) * 2]); }
    crowds.push({ area: [38, 247.5, 69, 258.5], count: 14, y: 0 }, { area: [52, 251, 56, 255], count: 5, y: 0, size: 0.6 });
    for (let x = 40; x < 69; x += 7) for (const z of [250.6, 255.4]) if (Math.abs(x - 54) > 4) {
      props.push({ shape: 'sphere', size: [1.1, 0.45, 0.8], pos: [x, 0.3, z], color: 0x4f8a3a, ghost: true });
      props.push({ shape: 'sphere', size: [0.4, 0.25, 0.4], pos: [x, 0.7, z], color: [0xf08ac0, 0xf2c12e, 0xe8544a, 0xffffff][Math.round(x / 7) % 4], ghost: true });
    }
  }
  box(props, 16, 0, 261, CANAL.x0 - 1.2, 2.0, 261.6, 0x5a8ab0, { mapColor: 0x5a6a7a });
  for (const [x, z, name, c] of [[22, 318, '置物櫃', 0x5a8ab0], [22, 336, '救護站', 0xd23a32], [22, 354, '更衣室', 0x2f6fb0]] as const) {
    kiosk(props, signs, { at: [x, z], yaw: P / 2, half: [7, 4], high: 4, wall: 0xe8f4f8, trim: 0xffffff, roof: 'flat', roofColor: c, name, front: name === '置物櫃' ? 'shop' : 'toilets' });
  }
  relief.area(rect(16, 306, 72, 460), 0, LAWN);
  // The lazy river: a ring of water round an island, rings floating in it, people in them; a deck round it.
  {
    const [cx, cz] = [42, 414], ring = (rx: number, rz: number, a: number): P2 => [cx + Math.cos(a) * rx, cz + Math.sin(a) * rz];
    relief.area(Array.from({ length: 28 }, (_, k) => ring(25, 37, (k / 28) * P * 2)), 0, PAVE);
    const n = 28;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * P * 2, b = ((k + 1) / n) * P * 2;
      relief.area([ring(21, 33, a), ring(21, 33, b), ring(15, 27, b), ring(15, 27, a)], -0.7, POOL_LOOK);
    }
    relief.area(Array.from({ length: 24 }, (_, k) => ring(15, 27, (k / 24) * P * 2)), 0.2, LAWN);
    s.pools.push({ area: [cx - 21, cz - 33, cx + 21, cz + 33], surface: -0.2, tint: 0x4fb0dc, flow: [0.2, 0.2] });
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * P * 2 + 0.2;
      const [x, z] = ring(18, 30, a);
      object(k % 3 ? 'swimRing' : 'swimRingBlue', x, z, a, -0.45);
    }
    for (const [dx, dz] of [[-6, -14], [5, -6], [-4, 4], [6, 14], [-3, 18]]) object('palm', cx + dx, cz + dz, 0, 0.2);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * P * 2;
      const [x, z] = ring(23.2, 35.2, a);
      object('lounger', x, z, -a + P / 2);
    }
    crowds.push({ area: [cx - 20, cz - 32, cx - 15, cz + 32], count: 10, y: -0.4 }, { area: [cx + 15, cz - 32, cx + 20, cz + 32], count: 10, y: -0.4 });
  }
  // The splash pad for small children: a round of soft floor, mushrooms and buckets that pour, jets from the floor.
  {
    const [px, pz] = [50, 336];
    relief.area(Array.from({ length: 20 }, (_, k) => [px + Math.cos((k / 20) * P * 2) * 10, pz + Math.sin((k / 20) * P * 2) * 10] as P2), 0, { tag: 'paving', color: 0x7fc8e0, wall: 0x6a9aaa });
    for (const [dx, dz, c] of [[-4, -3, 0xf0609a], [4, 2, 0xf6d55c], [0, 5, 0x7fd3b8]] as const) {
      bar(props, [px + dx, 0, pz + dz], [px + dx, 2.0, pz + dz], 0.18, 0x3fb0e0, { ghost: true });
      props.push({ shape: 'sphere', size: [1.4, 0.55, 1.4], pos: [px + dx, 2.1, pz + dz], color: c, ghost: true });
    }
    for (const [dx, dz] of [[-6, 4], [6, -5], [1, -6], [-2, 1]]) s.fountains.push([px + dx, 0.6, pz + dz]);
    bar(props, [px - 7, 0, pz - 7], [px - 7, 4, pz - 7], 0.12, 0xf2c12e, { ghost: true });
    props.push({ shape: 'cylinder', size: [0.9, 0.6, 0.6], pos: [px - 6.2, 4.2, pz - 7], rot: [0, 0, 0.5], color: 0xd23a32, ghost: true });
    crowds.push({ area: [px - 8, pz - 8, px + 8, pz + 8], count: 24, y: 0, size: 0.6 }, { area: [px + 10, pz - 8, px + 14, pz + 8], count: 10, y: 0 });
    for (let k = 0; k < 6; k++) object('umbrella', px + 12, pz - 7 + k * 3);
  }
  // The water playground, the middle of every water park: a frame of decks two high in a shallow pool, nets and little
  // slides off it, sprays all over it, and up on top the great bucket that fills and tips over everyone under it.
  {
    const [cx, cz] = [46, 284];
    relief.area(rect(cx - 16, cz - 11, cx + 16, cz + 11), 0, { tag: 'paving', color: 0x7fc8e0, wall: 0x6a9aaa });
    for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) bar(props, [cx + i * 4, 0, cz + j * 4], [cx + i * 4, 6, cz + j * 4], 0.16, [0xf2c12e, 0x3fb0e0, 0xf0609a][(i + j + 3) % 3], { ghost: true });
    for (const [y, c] of [[2, 0x4fa86a], [4, 0xf2a52e]] as const) {
      box(props, cx - 8.2, y - 0.1, cz - 4.2, cx + 8.2, y, cz + 4.2, c, { ghost: true });
      for (const side of [-1, 1]) box(props, cx - 8.2, y, cz + side * 4.2 - 0.04, cx + 8.2, y + 0.9, cz + side * 4.2 + 0.04, 0x3fb0e0, { ghost: true });
    }
    for (const [x0, a] of [[cx - 8, -1], [cx + 8, 1]] as const) {
      props.push({ shape: 'box', size: [3, 0.06, 0.6], pos: [x0 + a * 2.6, 1.2, cz - 2], rot: [0, 0, a * 0.6], color: 0xf0609a, ghost: true });
      props.push({ shape: 'box', size: [3.2, 0.06, 0.6], pos: [x0 + a * 2.8, 2.2, cz + 2], rot: [0, 0, a * 0.62], color: 0xf6d55c, ghost: true });
    }
    bar(props, [cx, 6, cz], [cx, 8.4, cz], 0.2, 0xd23a32, { ghost: true });
    props.push({ shape: 'cylinder', size: [1.7, 1.2, 0], pos: [cx, 9.4, cz], rot: [0, 0, 0.35], color: 0xf2c12e, ghost: true });
    props.push({ shape: 'cylinder', size: [1.5, 0.05, 0], pos: [cx - 0.42, 10.55, cz], rot: [0, 0, 0.35], color: 0x7fd3f0, ghost: true });
    for (let k = 0; k < 6; k++) s.fountains.push([cx - 10 + k * 4, 0.4, cz + (k % 2 ? 7 : -7)]);
    crowds.push({ area: [cx - 15, cz - 10, cx + 15, cz - 5], count: 20, y: 0, size: 0.6 }, { area: [cx - 15, cz + 5, cx + 15, cz + 10], count: 20, y: 0, size: 0.6 }, { area: [cx - 7, cz - 3.5, cx + 7, cz + 3.5], count: 10, y: 0, raised: 2, size: 0.6 });
    for (let k = 0; k < 8; k++) object('lounger', cx - 14 + k * 4, cz + 14, 0);
    for (let k = 0; k < 4; k++) object('umbrella', cx - 12 + k * 8, cz + 15.5);
  }
  // Cabanas for hire along the park's edge.
  for (let z = 372; z < 452; z += 7) {
    box(props, 18, 0, z - 2.6, 22, 0.2, z + 2.6, 0xd8c8a8, { ghost: true });
    for (const [dx, dz] of [[-2, -2.4], [2, -2.4], [-2, 2.4], [2, 2.4]]) bar(props, [20 + dx, 0, z + dz], [20 + dx, 2.6, z + dz], 0.05, 0xf2efe6, { ghost: true });
    props.push({ shape: 'cone', size: [3.2, 0.9, 0], pos: [20, 3.1, z], color: z % 14 < 7 ? 0xffffff : 0x3fb0e0, ghost: true });
    object('lounger', 20, z, P / 2);
  }

  void TOWER;
  return { slide };
}
