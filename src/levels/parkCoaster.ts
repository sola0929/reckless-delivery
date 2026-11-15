import { along, alongRot, bar, guard, loopPoints, loopTrack, beside, box, COASTER, coaster, coasterCar, coasterTrain, dropUnder, kiosk, put, wayPoints, type ParkSite, type WayPoint } from './parkParts';
import { BRAKES, BUTTE, COASTER_AT, COASTER_PLAN, COASTER_PROFILE, LIFT, LOOP, RIDE, RING_A, RING_AT, RING_B, RING_B_AT, RING_B_PLAN, RING_B_PROFILE, RING_JOIN, RING_PART, STATION, TUNNEL } from './parkPlan';
import type { Look } from './relief';
import type { Vec3 } from '../config';
import type { PropDesc, RigDesc, SignDesc } from './types';

// 3. The coaster, in the park's north-west corner, its grounds a western mine's red earth: up the ramp on to the track at
// its station, the train waiting on its siding; the lift north along the lake; the first drop down into the mine's tunnel
// through a hill of red sandstone, all on the ring's own track; out of the mine, where the ring turns away north, on down a
// service ramp to the shore. The ring is the train's: it comes round behind, through the station, every forty seconds or
// so, and stops for nothing. Wait for it to go by before driving on; be off the ring before it is round again.
// The grounds fenced all round: the way into them is up the station's ramp, and the way out down off the brake run.

const P = Math.PI;
/** The ground under the ride where it runs high, fenced off: come down on it, off the track, is a fall. */
/** How many seconds behind the first train the second runs: half a lap. */
const TRAIN_GAP = 16.75;
const DROP: Look = { tag: 'drop', color: 0xc8925e, wall: 0xa85a34 };
const SAND = [0xb5653d, 0xa85a34, 0xc47a4c, 0x9a4e2c];
const BAND = 0xd9a273;
const jig = (n: number) => { const r = Math.sin(n * 12.9898) * 43758.5453; return r - Math.floor(r) - 0.5; };

export function coasterGrounds(s: ParkSite): WayPoint[] {
  const { props, signs, crowds } = s;
  const object = (kind: Parameters<typeof put>[1], x: number, z: number, rotY = 0, y = 0) => put(s, kind, x, z, rotY, y);
  const [sx, sz] = COASTER_AT;
  const overTunnel = (x: number, z: number) => RIDE.some((p) => p.s >= TUNNEL[0] - 2 && p.s <= TUNNEL[1] + 2 && Math.hypot(p.x - x, p.z - z) < 6.5);
  // All the grounds inside their fence are a fall to come down on: knocked off the track by the train, there is no way
  // back up on to it. But along the track where it is low, through the station: on it there the truck is hardly above them.
  s.relief.area([[sx - 11.3, sz + 8.2], [446, sz + 8.2], [446, 462], [300.3, 462], [300.3, 392.7], [sx - 11.3, 392.7]], 0, DROP);
  s.relief.area([[sx - 4.4, sz + 8.2], [sx + 2.6, sz + 8.2], [sx + 2.6, sz + 56], [sx - 4.4, sz + 56]], 0, { tag: 'earth', color: DROP.color, wall: DROP.wall });
  const widen = (r: number) => Math.min(1, 9 / r);
  // The truck's way: up a service ramp from the south on to the track short of the station; through the station, over the
  // lift and the drop and through the mine on the ring's own track; out of the mine, where the ring turns away north, straight
  // on down a service ramp to the shore. Its rails left out on the west where the ring comes in to it, and where it goes.
  const [ON, OFF] = [16, RING_JOIN + RING_PART];
  const ride = coaster(props, { start: COASTER_AT, yaw: 0, plan: COASTER_PLAN, profile: COASTER_PROFILE, station: STATION, lift: LIFT, brakes: [-9, -8], carried: (x, z) => overTunnel(x, z), widen, from: ON, to: OFF + 1, gaps: [[RING_JOIN - 13, RING_JOIN + 1, 1]], open: [[0, STATION[1], 1], [0, STATION[1], -1]] });
  dropUnder(s.relief, ride, 2.4, 7, DROP);
  // Where its track is low, inside the mine and out of it: on it there the truck is hardly above the ground, which is not
  // a fall under it.
  for (let k = 150; k < ride.length - 2; k += 2) {
    const a = ride[k], b = ride[k + 2];
    if (Math.max(a.y, b.y) > 2.6 || a.x < 300.5) continue;
    const side = (p: WayPoint, d: number): [number, number] => [p.x + Math.cos(p.yaw) * d, p.z - Math.sin(p.yaw) * d];
    s.relief.area([side(a, -2.9), side(b, -2.9), side(b, 2.9), side(a, 2.9)], 0, { tag: 'earth', color: DROP.color, wall: DROP.wall });
  }
  // The service ways, as the maintenance crew's: concrete, not track; a yellow lip up each edge, black bands across it,
  // piers under it. Up on to the track from the south; off it inside the mine, out by its old level to the shore.
  for (const ramp of [ride.filter((p) => p.s <= ON + 1 && p.y > 0.02), ride.filter((p) => p.s >= OFF && p.y > 0.02)]) {
    along(props, ramp, COASTER.wide, 0.14, 0xa4a8ae, { mapColor: 0x8a8f96 }, 0, -0.012);
    for (const side of [-1, 1]) {
      // Off the ring, its right lip begins where the train has gone clear of it; its left a little way back along the
      // track's, so that the two make one face.
      const run = ramp[0].s < ON ? ramp : ride.filter((p) => p.y > 0.02 && (side > 0 ? p.s >= OFF - 6 : p.s > OFF + 11));
      guard(props, run, side * (COASTER.wide / 2 - 0.02), 0xf2c12e);
    }
    for (let k = 1; k < ramp.length; k += 3) props.push({ shape: 'box', size: [COASTER.wide / 2 - 0.2, 0.006, 0.12], pos: beside(ramp[k], 0, 0.008), rot: alongRot(ramp[k].yaw, ramp[k].grade), color: 0x3a3f44, ghost: true });
    for (let k = 2; k < ramp.length; k += 5) {
      const p = ramp[k];
      if (p.y > 0.6 && !overTunnel(p.x, p.z)) props.push({ shape: 'box', size: [COASTER.wide / 2 - 0.3, (p.y - 0.14) / 2, 0.22], pos: [p.x, (p.y - 0.14) / 2, p.z], rot: [0, p.yaw, 0], color: 0xb8b6ae, ghost: true });
    }
  }
  // The rest of the ring, the trains' only: on south out of the mine; over in its loop; over a last hill and round on its
  // brakes to the station.
  const loopAt = RING_A[RING_A.length - 1], loop = loopPoints(loopAt, LOOP.radius, -LOOP.shift);
  coaster(props, { start: RING_AT, yaw: 0, plan: [{ long: 127 }, { radius: 11, turn: P }, { long: 50 }], profile: RING_A.map((p) => [p.s, p.y] as [number, number]), station: [-9, -8], lift: [-9, -8], brakes: [-9, -8], carried: (_x, z) => z > 402, widen, from: RING_PART, sink: 0.012, gaps: [[RING_PART - 1, RING_PART + 10, 1]] });
  loopTrack(props, loopAt, loop, LOOP.radius);
  const ringEnd = RING_B[RING_B.length - 1].s;
  coaster(props, { start: RING_B_AT, yaw: P, plan: RING_B_PLAN, profile: RING_B_PROFILE, station: [-9, -8], lift: [-9, -8], brakes: [82, 112], widen, sink: 0.012, gaps: [[ringEnd - 13, ringEnd + 1, -1]] });
  dropUnder(s.relief, RING_B, 2.4, 5, DROP);
  // Their way round, a point a metre: up to the loop, round it, on from it; and which way is up from the track at each.
  const flat = (p: WayPoint): Vec3 => { const n = Math.hypot(p.grade, 1); return [(-Math.sin(p.yaw) * p.grade) / n, 1 / n, (-Math.cos(p.yaw) * p.grade) / n]; };
  const first = RING_A.slice(0, Math.floor(loopAt.s) + 1), last = RING_B.slice(1, Math.floor(ringEnd));
  const track = {
    way: [...first.map((p): Vec3 => [p.x, p.y, p.z]), ...loop.map((p) => p.pos), ...last.map((p): Vec3 => [p.x, p.y, p.z])],
    ups: [...first.map(flat), ...loop.map((p) => p.up), ...last.map(flat)],
  };
  const [L0, L1, N] = [first.length, first.length + loop.length, first.length + loop.length + last.length];
  // Two trains, four cars each, the second (blue) half a lap behind the first: the gap between them is what the truck has.
  // Slow through the station and standing there a moment, up the lift on the chain, away down the drop; slower over the
  // camelback, fast again down into the mine; over the top of the loop slowly; on the brakes round the last bend.
  const TRAIN: [[number, number][], [number, number], NonNullable<NonNullable<RigDesc['track']>['says']>] = [[[0, 7], [20, 7], [26, 7], [62, 7], [70, 9], [97, 24], [112, 15], [127, 21], [161, 19], [190, 21], [L0, 23], [(L0 + L1) / 2, 12], [L1, 21], [L1 + 10, 20], [L1 + 35, 12], [L1 + 55, 15], [L1 + 77, 13], [L1 + 96, 8], [N, 7]], [16, 3], {
    up: ['好高喔……', '不要往下看', '我想下去', '媽——', '喀、喀、喀、喀'],
    down: ['啊啊啊啊啊——', '哇啊啊啊啊！', '救命啊——', '我的帽子！', '呀呼——', '再也不坐了！'],
    level: ['再一次！', '好好玩！', '軌道上有貨車！', '司機快閃開！', '手舉起來！', '那台貨車在幹嘛？'],
  }];
  s.rigs.push(...coasterTrain(track, 4, ...TRAIN), ...coasterTrain(track, 4, ...TRAIN, 0x2f6fb0, TRAIN_GAP));
  // Along the track's east side from the fence to the station's end, the staff's walk at its height, between it and the
  // siding: what the train shoves aside there is shoved along it, not off the edge.
  box(props, sx - 4.0, 0, sz + 8.2, sx - COASTER.wide / 2, 1.19, sz + STATION[1], 0xd8d4c8);
  box(props, sx - 4.0, 1.19, sz + 8.2, sx - 3.8, 1.2, sz + STATION[1], 0xf2c12e, { ghost: true });
  // The operator's cabin at the platform's north end: glass on three sides, its desk of buttons, a lamp on its roof; the
  // board of the ride's rules beside it. Along the platform's edge the gates, one to each row of seats.
  {
    const cz = sz + STATION[1] - 2.2, cx = sx + 5.2;
    box(props, cx - 1.1, 1.2, cz - 1.3, cx + 1.1, 2.1, cz + 1.3, 0xd23a32);
    box(props, cx - 1.05, 2.1, cz - 1.25, cx + 1.05, 3.2, cz + 1.25, 0x9fd0e6, { ghost: true });
    for (const [dx, dz] of [[-1.05, -1.25], [1.05, -1.25], [-1.05, 1.25], [1.05, 1.25]]) box(props, cx + dx - 0.06, 2.1, cz + dz - 0.06, cx + dx + 0.06, 3.2, cz + dz + 0.06, 0xf2efe6, { ghost: true });
    box(props, cx - 1.25, 3.2, cz - 1.45, cx + 1.25, 3.36, cz + 1.45, 0xf2efe6, { ghost: true });
    box(props, cx - 1.0, 2.11, cz - 0.9, cx - 0.5, 2.25, cz + 0.9, 0x3a3f44, { ghost: true });
    for (let k = 0; k < 5; k++) props.push({ shape: 'sphere', size: [0.06, 0.04, 0.06], pos: [cx - 0.75, 2.28, cz - 0.6 + k * 0.3], color: [0x4fa86a, 0xe8544a, 0xf2c12e, 0x4fa86a, 0x3f7fd0][k], ghost: true, glow: true });
    props.push({ shape: 'cylinder', size: [0.12, 0.12, 0], pos: [cx, 3.48, cz], color: 0xf2a02e, ghost: true, glow: true });
    signs.push({ pos: [cx + 1.12, 2.7, cz], rotY: P / 2, kind: 'name', text: '操作室', colors: ['#f2efe6', '#d23a32', '#2a2420'], wide: 1.6 });
    for (let z = sz + STATION[0] + 2; z < sz + STATION[1] - 4; z += 3) {
      box(props, sx + 2.3, 1.2, z + 0.25, sx + 2.4, 2.15, z + 2.75, 0xf2efe6, { ghost: true });
      box(props, sx + 2.28, 1.6, z + 0.25, sx + 2.42, 1.75, z + 2.75, 0xd23a32, { ghost: true });
    }
  }
  // Signals, as a railway's block: at the join, at the station's end, where the ways part. A post, its head with a red lamp
  // over a green.
  for (const [x, z] of [[sx - 3.0, sz + 22], [sx - 3.0, sz + STATION[1] + 1.5]] as const) {
    const y = ride.find((p) => p.z >= z)!.y;
    bar(props, [x, 0, z], [x, y + 2.9, z], 0.07, 0x3a3f44, { ghost: true });
    box(props, x - 0.22, y + 2.0, z - 0.14, x + 0.22, y + 2.95, z + 0.14, 0x24262a, { ghost: true });
    props.push({ shape: 'sphere', size: [0.13, 0.13, 0.06], pos: [x, y + 2.68, z - 0.15], color: 0xe8544a, ghost: true, glow: true });
    props.push({ shape: 'sphere', size: [0.13, 0.13, 0.06], pos: [x, y + 2.28, z - 0.15], color: 0x3a6a48, ghost: true });
  }
  // At the top of the lift an arch over the track, its height on it; at the foot of the drop the ride's photographer on
  // his stand, his camera on its legs and its flash, counting them in.
  {
    const top = ride[LIFT[1] + 2];
    for (const side of [-1, 1]) bar(props, beside(top, side * 2.9, -0.2), beside(top, side * 2.9, 4.6), 0.12, 0xf2efe6, { ghost: true });
    props.push({ shape: 'box', size: [3.1, 0.5, 0.06], pos: beside(top, 0, 4.4), color: 0xd23a32, ghost: true, fade: true, overhead: true });
    signs.push({ pos: beside({ ...top, z: top.z - 0.08 }, 0, 4.4), rotY: P, kind: 'name', text: '最高點　抓緊了', colors: ['#d23a32', '#ffffff', '#f2c12e'], wide: 5 });
    for (let k = 0; k < 7; k++) props.push({ shape: 'cone', size: [0.22, 0.3, 0], pos: beside(top, -2.4 + k * 0.8, 3.75), rot: [P, 0, 0], color: [0xf2c12e, 0x3f7fd0, 0xf2efe6, 0x4fa86a][k % 4], ghost: true });
    const [px, pz] = [sx + 6.4, sz + 124];
    box(props, px - 1.3, 0, pz - 1.3, px + 1.3, 2.6, pz + 1.3, 0x8a6a40, { ghost: true });
    box(props, px - 1.5, 2.6, pz - 1.5, px + 1.5, 2.75, pz + 1.5, 0x6a4a30, { ghost: true });
    for (const leg of [-0.3, 0, 0.3]) bar(props, [px - 0.9 + leg, 2.75, pz + leg * 0.8], [px - 0.9, 4.0, pz], 0.03, 0x2a2c30, { ghost: true });
    box(props, px - 1.12, 3.95, pz - 0.2, px - 0.72, 4.3, pz + 0.2, 0x24262a, { ghost: true });
    props.push({ shape: 'sphere', size: [0.14, 0.14, 0.14], pos: [px - 1.2, 4.45, pz], color: 0xffffff, ghost: true, glow: true });
    signs.push({ pos: [px - 1.52, 1.6, pz], rotY: -P / 2, kind: 'name', text: '拍照點', colors: ['#2a2420', '#f2c12e', '#ffffff'], wide: 2 });
    crowds.push({ area: [px - 0.2, pz - 0.6, px + 0.8, pz + 0.6], count: 1, y: 0, raised: 2.75, fenced: true, says: ['看這邊——', '三、二、一', '喀嚓！', '照片在出口領'] });
  }
  // What tells the truck's driver, at the top of the ramp: as at a railway's crossing.
  for (const [x, z, text, wide] of [[sx - 3.3, sz + 14, '停看聽　讓列車先行', 4.4]] as const) {
    const y = ride.find((p) => p.z >= z)!.y;
    bar(props, [x, 0, z], [x, y + 3.4, z], 0.09, 0x3a3f44, { ghost: true });
    box(props, x - wide / 2 - 0.1, y + 2.5, z - 0.06, x + wide / 2 + 0.1, y + 3.5, z, 0xf2c12e, { ghost: true });
    signs.push({ pos: [x, y + 3.0, z - 0.08], rotY: P, kind: 'name', text, colors: ['#f2c12e', '#2a2420', '#2a2420'], wide });
  }

  // The station: a platform along the track at its height, the train waiting on its siding the other side, a roof over all
  // of it, the ride's name; people waiting on the platform.
  box(props, sx + 2.2, 0, sz + STATION[0], sx + 6.5, 1.2, sz + STATION[1], 0xd8d4c8);
  box(props, sx + 2.2, 1.2, sz + STATION[0], sx + 2.5, 1.22, sz + STATION[1], 0xf2c12e, { ghost: true });
  for (let z = sz + STATION[0] + 2; z < sz + STATION[1]; z += 3) box(props, sx + 2.6, 1.2, z - 0.05, sx + 2.7, 2.2, z + 0.05, 0xf2c12e, { ghost: true });
  const siding = wayPoints([sx - 6.2, sz + STATION[0]], 0, [{ long: 20 }], [[0, 1.2], [20, 1.2]], 1);
  box(props, sx - 8.2, 0, sz + STATION[0], sx - 4.2, 1.2, sz + STATION[1], 0x4a5056);
  for (let n = 0; n < 4; n++) coasterCar(props, siding[3 + Math.round(n * 3.4)], n === 3);
  for (const x of [sx - 9, sx + 7]) for (let z = sz + STATION[0] + 1; z <= sz + STATION[1]; z += 6.4) {
    bar(props, [x, 0, z], [x, 6.5, z], 0.22, 0xf2efe6);
    box(props, x - 0.34, 0, z - 0.34, x + 0.34, 0.5, z + 0.34, 0xd23a32, { ghost: true });
    box(props, x - 0.3, 6.2, z - 0.3, x + 0.3, 6.5, z + 0.3, 0xf2c12e, { ghost: true });
  }
  // Its roof: two pitches of red sheet striped white, a white ridge and flags on it; a fascia along each eave, pennants
  // under it; a truss from post to post at each pair, a lamp hung from each over the platform and over the siding.
  {
    const [xa, xb, za, zb] = [sx - 9.6, sx + 7.6, sz + STATION[0] - 0.5, sz + STATION[1] + 0.5];
    const xm = (xa + xb) / 2, half = (xb - xa) / 2, rise = 2.2, tilt = Math.atan2(rise, half), slab = Math.hypot(half, rise) / 2;
    const over = { ghost: true, fade: true, overhead: true };
    for (const side of [-1, 1]) {
      props.push({ shape: 'box', size: [slab, 0.1, (zb - za) / 2], pos: [xm + (side * half) / 2, 6.6 + rise / 2, (za + zb) / 2], rot: [0, 0, -side * tilt], color: 0xd23a32, ...over });
      for (let z = za + 1.6; z < zb - 1; z += 3) props.push({ shape: 'box', size: [slab - 0.05, 0.02, 0.6], pos: [xm + (side * half) / 2, 6.6 + rise / 2 + 0.125, z], rot: [0, 0, -side * tilt], color: 0xf2efe6, ...over });
      const xe = xm + side * half;
      box(props, xe - 0.1, 6.1, za, xe + 0.1, 6.55, zb, 0xf2efe6, over);
      for (let z = za + 0.6, k = 0; z < zb; z += 1.2, k++) props.push({ shape: 'cone', size: [0.2, 0.26, 0], pos: [xe, 5.84, z], rot: [P, 0, 0], color: [0xf2c12e, 0x3f7fd0, 0xf2efe6, 0x4fa86a][k % 4], ...over });
    }
    box(props, xm - 0.16, 6.6 + rise - 0.02, za, xm + 0.16, 6.6 + rise + 0.2, zb, 0xf2efe6, over);
    for (const [k, z] of [za + 0.4, (za + zb) / 2, zb - 0.4].entries()) {
      bar(props, [xm, 6.6 + rise, z], [xm, 6.6 + rise + 2.2, z], 0.04, 0xf2efe6, over);
      box(props, xm - 0.02, 6.6 + rise + 1.5, z, xm + 0.02, 6.6 + rise + 2.15, z + 1.0, [0xf2c12e, 0xd23a32, 0x3f7fd0][k], over);
    }
    for (let z = sz + STATION[0] + 1; z <= sz + STATION[1]; z += 6.4) {
      bar(props, [sx - 9, 6.45, z], [sx + 7, 6.45, z], 0.08, 0xf2efe6, over);
      bar(props, [xm, 6.45, z], [xm, 6.5 + rise, z], 0.06, 0xf2efe6, over);
      for (const side of [-1, 1]) {
        bar(props, [xm + side * half * 0.55, 6.45, z], [xm, 6.4 + rise, z], 0.05, 0xf2efe6, over);
        const lx = side > 0 ? sx + 4.3 : sx - 6.2;
        bar(props, [lx, 6.45, z], [lx, 5.5, z], 0.02, 0x3a3f44, over);
        props.push({ shape: 'cone', size: [0.32, 0.14, 0], pos: [lx, 5.5, z], color: 0x2e7d6b, ...over });
        props.push({ shape: 'sphere', size: [0.14, 0.12, 0.14], pos: [lx, 5.3, z], color: 0xfff0c0, glow: true, ...over });
      }
    }
    // The ride's name across its south end: a board, bulbs round it.
    box(props, sx - 4.6, 6.75, za - 0.06, sx + 4.6, 8.45, za + 0.04, 0xfff0dc, over);
    for (let x = sx - 4.4; x <= sx + 4.41; x += 0.8) for (const y of [6.9, 8.3]) props.push({ shape: 'sphere', size: [0.08, 0.08, 0.08], pos: [x, y, za - 0.1], color: 0xffd060, glow: true, ...over });
  }
  // Along the back of the platform a white rail, but where the steps come up from the queue and where the way out goes
  // down; the steps, their handrails, the board that says how tall; shelves for what may not be taken on; lines on the
  // floor to each gate; the next train's board; the attendant in red at the gates.
  {
    const [pz0, pz1, railX] = [sz + STATION[0], sz + STATION[1], sx + 6.35];
    const [ua, ub] = [306.3, 307.9];
    for (const [a, b] of [[pz0 + 4.4, ua - 0.2], [ub + 0.2, pz1 - 4.2]]) {
      for (const h of [1.75, 2.2]) bar(props, [railX, h, a], [railX, h, b], 0.035, 0xf2efe6, { ghost: true });
      const n = Math.round((b - a) / 1.6);
      for (let k = 0; k <= n; k++) bar(props, [railX, 1.2, a + ((b - a) * k) / n], [railX, 2.2, a + ((b - a) * k) / n], 0.035, 0xf2efe6, { ghost: true });
    }
    for (let k = 0; k < 4; k++) box(props, sx + 6.5 + k * 0.5, 0, ua, sx + 7.0 + k * 0.5, 1.2 - (k + 1) * 0.24, ub, 0xc8c4b8);
    for (const z of [ua, ub]) {
      bar(props, [sx + 6.5, 2.15, z], [sx + 8.6, 1.1, z], 0.03, 0xd23a32, { ghost: true });
      for (const [x, y] of [[sx + 6.5, 2.15], [sx + 8.6, 1.1]]) bar(props, [x, y - 1.0, z], [x, y, z], 0.03, 0xd23a32, { ghost: true });
    }
    for (const z of [ua - 0.15, ub + 0.15]) bar(props, [sx + 6.5, 1.2, z], [sx + 6.5, 3.4, z], 0.05, 0xd23a32, { ghost: true });
    box(props, sx + 6.44, 3.0, ua - 0.2, sx + 6.56, 3.5, ub + 0.2, 0xd23a32, { ghost: true });
    signs.push({ pos: [sx + 6.58, 3.25, (ua + ub) / 2], rotY: P / 2, kind: 'name', text: '入口', colors: ['#d23a32', '#ffffff', '#f2c12e'], wide: 1.2 });
    // How tall: a post banded to its mark, the mark's arm out over the queue's last step.
    bar(props, [sx + 9.0, 0, ua - 0.5], [sx + 9.0, 1.7, ua - 0.5], 0.05, 0xf2efe6, { ghost: true });
    for (let k = 0; k < 6; k++) box(props, sx + 8.94, k * 0.2, ua - 0.56, sx + 9.06, k * 0.2 + 0.1, ua - 0.44, 0xd23a32, { ghost: true });
    box(props, sx + 8.5, 1.2, ua - 0.53, sx + 9.0, 1.26, ua - 0.47, 0xf2c12e, { ghost: true });
    signs.push({ pos: [sx + 9.08, 2.0, ua - 0.5], rotY: P / 2, kind: 'name', text: '身高 120 以上', colors: ['#f2efe6', '#d23a32', '#2a2420'], wide: 1.8 });
    // The shelves, bags on them.
    box(props, sx + 5.75, 1.2, pz0 + 0.3, sx + 6.4, 2.6, pz0 + 4.2, 0x8a6a40);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      box(props, sx + 5.7, 1.3 + r * 0.42, pz0 + 0.42 + c * 0.75, sx + 5.75, 1.62 + r * 0.42, pz0 + 1.02 + c * 0.75, 0x3a2c20, { ghost: true });
      if ((r * 5 + c) % 3) box(props, sx + 5.6, 1.32 + r * 0.42, pz0 + 0.5 + c * 0.75, sx + 5.7, 1.54 + r * 0.42, pz0 + 0.94 + c * 0.75, [0x3f7fd0, 0xe8544a, 0x4fa86a, 0xf2c12e, 0x8a5ac8][(r * 2 + c) % 5], { ghost: true });
    }
    signs.push({ pos: [sx + 5.58, 2.85, pz0 + 2.25], rotY: -P / 2, kind: 'name', text: '隨身物品置物架', colors: ['#5a3e28', '#f2efe6', '#f2c12e'], wide: 2.6 });
    for (let z = pz0 + 2; z < pz1 - 4; z += 3) for (const dz of [0.25, 2.75]) box(props, sx + 2.75, 1.2, z + dz - 0.03, sx + 4.5, 1.212, z + dz + 0.03, 0xf2efe6, { ghost: true });
    box(props, sx + 3.0, 4.5, pz0 + 9.95, sx + 5.6, 5.3, pz0 + 10.05, 0x1c1e22, { ghost: true, fade: true, overhead: true });
    for (const x of [sx + 3.3, sx + 5.3]) bar(props, [x, 5.3, pz0 + 10], [x, 6.45, pz0 + 10], 0.02, 0x3a3f44, { ghost: true, fade: true, overhead: true });
    signs.push({ pos: [sx + 4.3, 4.9, pz0 + 9.93], rotY: P, kind: 'name', text: '下一班　即將進站', colors: ['#1c1e22', '#ffb030', '#ffb030'], wide: 2.4 });
    crowds.push({ area: [sx + 2.8, pz1 - 5.8, sx + 3.6, pz1 - 4.8], count: 1, y: 0, raised: 1.2, fenced: true, clothes: [0xd23a32], hat: 0xf2efe6, dance: -P / 2, stand: true });
    // The way out, north of the cabin: its sign over it, steps down at its end.
    for (const z of [pz1 - 3.9, pz1 - 0.1]) bar(props, [sx + 9, 1.2, z], [sx + 9, 3.6, z], 0.05, 0x2e7d6b, { ghost: true });
    box(props, sx + 8.94, 3.1, pz1 - 3.9, sx + 9.06, 3.6, pz1 - 0.1, 0x2e7d6b, { ghost: true });
    signs.push({ pos: [sx + 8.92, 3.35, pz1 - 2], rotY: -P / 2, kind: 'name', text: '出口　照片販售', colors: ['#2e7d6b', '#ffffff', '#f2c12e'], wide: 3.2 });
    for (let k = 0; k < 4; k++) box(props, sx + 14 + k * 0.5, 0, pz1 - 3.6, sx + 14.5 + k * 0.5, 1.2 - (k + 1) * 0.24, pz1 - 0.4, 0xc8c4b8);
    for (const z of [pz1 - 3.95, pz1 - 0.05]) for (const h of [1.75, 2.2]) bar(props, [sx + 6.6, h, z], [sx + 14, h, z], 0.035, 0xf2efe6, { ghost: true });
  }
  signs.push({ pos: [sx, 7.6, sz + STATION[0] - 0.6], rotY: P, kind: 'name', text: '旋風飛車', colors: ['#d23a32', '#ffffff', '#f2c12e'], wide: 8 });
  for (const [x, count] of [[sx + 2.9, 6], [sx + 3.8, 5]] as const) crowds.push({ area: [x, sz + STATION[0] + 2, x + 0.7, sz + STATION[1] - 6], count, y: 0, raised: 1.2, fenced: true, dance: -P / 2, stand: true });

  // On the track itself, the ride not yet open to anyone: the board across it at the top of the ramp; in the station the
  // water dummies the test train carries, stood along the platform side waiting to be strapped in, cones round them; at
  // the mouth of the mine a barrier of planks to go through, barrels and crates along the tunnel walls where it runs
  // straight; on the brake run the painters, not finished, their pails and ladder and tools.
  {
    const on = (kind: Parameters<typeof put>[1], at: number, across: number, turn = 0) => {
      const p = ride[Math.round(at)];
      const [x, y, z] = beside(p, across);
      object(kind, x, z, p.yaw + turn, y);
    };
    on('mineBarrier', 12, 0);
    for (const [at, across, kind, turn] of [[BRAKES[0] + 3, 1.2, 'paintYellow', 0], [BRAKES[0] + 4.2, 1.35, 'paintWhite', 0], [BRAKES[0] + 9.5, 1.3, 'paintYellow', 0], [BRAKES[0] + 11, -1.2, 'paintWhite', 0], [BRAKES[0] + 13.5, 1.25, 'cone', 0], [BRAKES[0] + 14.5, -1.3, 'cone', 0]] as const) on(kind, at, across, turn);
  }
  // Its queue's way up to the platform from the west, and the photo shop where the riders come off.
  box(props, sx + 6.5, 0, sz + STATION[1] - 4, sx + 14, 1.2, sz + STATION[1], 0xd8d4c8);
  kiosk(props, signs, { at: [sx + 38, sz + 14], yaw: -P / 2, half: [4.0, 3.0], high: 3.8, wall: 0xf2e6cc, trim: 0xffffff, roof: 'flat', roofColor: 0xd23a32, name: '照片販售', front: 'counter', awning: [0xd23a32, 0xffffff] });
  kiosk(props, signs, { at: [sx + 42, sz + 36], yaw: -P / 2, half: [6, 4], high: 4.6, wall: 0xc8925e, trim: 0x6a4a30, roof: 'pitched', roofColor: 0x8a4a2a, name: '礦山雜貨', front: 'shop', nameColors: ['#5a3e28', '#f2c12e', '#2a2420'] });
  crowds.push({ area: [sx + 9, sz + 51, sx + 22, sz + 70], count: 24, y: 0 });

  // The ground between the town and the workings: wagon trails worn pale across the red earth, scrub and loose rock
  // between them.
  {
    const TRAIL: Look = { tag: 'earth', color: 0xdcae80, wall: 0xa85a34 };
    const trail = (pts: [number, number][], wide: number) => {
      for (let k = 0; k < pts.length - 1; k++) {
        const [ax, az] = pts[k], [bx, bz] = pts[k + 1], d = Math.hypot(bx - ax, bz - az), nx = ((bz - az) / d) * wide / 2, nz = (-(bx - ax) / d) * wide / 2;
        s.relief.area([[ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz], [ax - nx, az - nz]], 0, TRAIL);
        s.relief.area(Array.from({ length: 8 }, (_, j) => [bx + Math.cos((j / 8) * P * 2) * wide / 2, bz + Math.sin((j / 8) * P * 2) * wide / 2] as [number, number]), 0, TRAIL);
      }
    };
    trail([[381, 338], [370, 341], [360, 349], [357, 362], [362, 376], [372, 388]], 3.2);
    trail([[360, 349], [349, 345]], 2.6);
    trail([[362, 376], [350, 384], [346, 396]], 2.6);
    for (let n = 0; n < 46; n++) {
      const x = 344 + ((n * 47) % 360) / 10, z = 338 + ((n * 83) % 560) / 10;
      if (overTunnel(x, z) || (x < 360 && z > 398) || [...RIDE, ...RING_A, ...RING_B].some((p) => Math.hypot(p.x - x, p.z - z) < 9)) continue;
      if (n % 3 === 0) props.push({ shape: 'box', size: [0.5 + (n % 4) * 0.12, 0.3 + (n % 3) * 0.1, 0.45], pos: [x, 0.25, z], rot: [0.1, n, 0.08], color: SAND[n % 4], ghost: true });
      else props.push({ shape: 'sphere', size: [0.7 + (n % 3) * 0.2, 0.35, 0.6], pos: [x, 0.2, z], color: n % 2 ? 0x8a9a52 : 0x7a8a46, ghost: true });
    }
  }

  mine(s, ride, overTunnel);
  // West of the mine, a butte of the same sandstone, in layers set back one above another, a fall of water down its side
  // into a pool at its foot.
  const [mx, mz] = BUTTE;
  props.push({ shape: 'cylinder', size: [5.6, 7, 0], pos: [mx, 7, mz], color: SAND[0] });
  for (const [r, y0, y1, c] of [[6.8, 0, 4.4, 0], [6.0, 4.4, 8.6, 2], [5.0, 8.6, 12.4, 1], [3.8, 12.4, 15.6, 3]] as const) {
    for (let j = 0; j < 7; j++) {
      const a = (j / 7) * P * 2 + r;
      const w = r * 0.5 + jig(j + r) * 0.6;
      props.push({ shape: 'box', size: [w, (y1 - y0) / 2, r * 0.45], pos: [mx + Math.cos(a) * r * 0.55, (y0 + y1) / 2, mz + Math.sin(a) * r * 0.55], rot: [jig(j * 3 + r) * 0.08, -a + jig(j) * 0.3, jig(j * 5) * 0.08], color: SAND[(j + c) % 4], ghost: true });
    }
    props.push({ shape: 'cylinder', size: [r * 0.98, 0.16, 0], pos: [mx, y1 - 0.2, mz], color: BAND, ghost: true });
  }
  props.push({ shape: 'sphere', size: [2.6, 0.8, 2.6], pos: [mx, 15.9, mz], color: 0x6a8a3a, ghost: true });
  for (const [dx, dz] of [[1.2, 0.6], [-1.0, -0.8]]) {
    props.push({ shape: 'cylinder', size: [0.14, 0.6, 0], pos: [mx + dx, 16.4, mz + dz], color: 0x5a3e28, ghost: true });
    props.push({ shape: 'cone', size: [1.0, 1.6, 0], pos: [mx + dx, 18.4, mz + dz], color: 0x3f6a34, ghost: true });
  }
  box(props, mx + 6.0, 0.2, mz - 1.0, mx + 6.1, 12.2, mz + 1.0, 0xcfeef8, { ghost: true });
  props.push({ shape: 'cylinder', size: [2.0, 0.06, 0], pos: [mx + 7.4, 0.06, mz], color: 0x4fa8c8, ghost: true });

  // Round the grounds, a western town's: a water tower on its legs, mine carts on a length of rail with their ore, crates and
  // boxes of dynamite stacked at the mine's mouth (for show), cactus, pines; benches and lamps along the riders' way out.
  waterTower(props, sx + 42, sz + 70);
  {
    const rail0 = sx + 22, z0 = sz + 92;
    for (let k = 0; k < 14; k++) box(props, rail0 + k * 1.2 - 0.12, 0, z0 - 0.9, rail0 + k * 1.2 + 0.12, 0.08, z0 + 0.9, 0x6a4a30, { ghost: true });
    for (const side of [-0.6, 0.6]) box(props, rail0 - 0.5, 0.08, z0 + side - 0.04, rail0 + 16.5, 0.16, z0 + side + 0.04, 0x5a6068, { ghost: true });
    for (let k = 0; k < 3; k++) mineCart(props, rail0 + 2.5 + k * 4.4, z0);
  }
  for (const [x, z, r] of [[sx + 14, sz + 104, 0.2], [sx + 16, sz + 101, -0.4], [sx + 13, sz + 99, 0.7]] as const) dynamite(props, x, z, r);
  for (const [x, z] of [[sx + 18, sz + 102], [sx + 20.5, sz + 102.5], [sx + 19, sz + 104.5]] as const) box(props, x - 0.6, 0, z - 0.6, x + 0.6, 1.2, z + 0.6, 0x9a6a3a, { ghost: true });
  for (const [x, z, h] of [[sx + 36, sz + 20, 4], [sx + 42, sz + 128, 4], [sx + 9, sz + 98, 3.8], [sx + 24, sz + 76, 4.4]] as const) cactus(props, x, z, h);
  // Pines along the fence on the south and round the park's edge on the west and the north.
  for (let x = sx + 50; x < 444; x += 9) object(x % 2 ? 'treeTall' : 'tree', x, sz + 12);
  for (let z = sz + 22; z < 456; z += 9) object(z % 2 ? 'treeTall' : 'tree', 441, z);
  for (let x = 304; x < 436; x += 9) if (x < 352 || x > 398) object(x % 2 ? 'tree' : 'treeTall', x, 454);
  westernTown(s);
  mineWorks(s);

  // The fence round the grounds, solid: posts and rails of timber, as a ranch's. South along the food court, west to the
  // park's edge; along the lake on the east from the station's siding to its north-west corner, west a little, then north
  // under the track to the park's edge, where the shore begins.
  const ranch = (a: [number, number], b: [number, number]) => {
    const long = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    props.push({ shape: 'box', size: [0.1, 0.6, long / 2], pos: [(a[0] + b[0]) / 2, 0.6, (a[1] + b[1]) / 2], rot: [0, yaw, 0], color: 0x8a6a40, mapColor: 0x6a4a30 });
    for (let d = 0; d <= long; d += 2.4) props.push({ shape: 'box', size: [0.12, 0.7, 0.12], pos: [a[0] + ((b[0] - a[0]) * d) / long, 0.7, a[1] + ((b[1] - a[1]) * d) / long], color: 0x6a4a30, ghost: true });
  };
  ranch([sx + 4.2, sz + 8], [sx + 4.2, sz + 16]);
  ranch([sx + 4, sz + 8], [447, sz + 8]);
  ranch([sx - 4, sz + 8], [sx - 4.2, sz + STATION[0]]);
  ranch([sx - 8.2, sz + STATION[1]], [sx - 11.5, sz + STATION[1]]);
  ranch([sx - 11.5, sz + 6], [sx - 11.5, 392.5]);
  ranch([sx - 11.5, 392.5], [300, 392.5]);
  ranch([300, 392.5], [300, 400.7]);
  ranch([300, 407.3], [300, 463]);
  // Along the lake, outside the fence, the water's edge: lamps on the rim.
  for (let z = sz + 14; z < 388; z += 12) object('parkLamp', sx - 12.6, z);
  return ride;
}

/**
 * The coaster's grounds, away from its track: a western mining town for it to have come out of. Its street north and south,
 * false-fronted timber buildings along both sides under their porches, their names on their fronts; a covered wagon, barrels,
 * a trough; the coaster's queue winding to its station; mesas of the same red rock in the far corner, a wind pump, cactus.
 */
function westernTown(s: ParkSite): void {
  const { props, signs, crowds } = s;
  const object = (kind: Parameters<typeof put>[1], x: number, z: number, rotY = 0, y = 0) => put(s, kind, x, z, rotY, y);
  const street = 404;
  const BUILDINGS: [string, number, number, number][] = [
    ['酒館', 0xb5653d, 10, 7.5], ['雜貨店', 0xd9a273, 9, 6.5], ['銀行', 0xc8c0b0, 8, 7], ['警長', 0x9a6a3a, 7, 6],
    ['旅館', 0xc47a4c, 11, 8.5], ['鐵匠舖', 0x7a5a3a, 8, 5.5], ['郵局', 0xd8c8a8, 7, 6], ['理髮店', 0xe8d8c0, 7, 5.5],
    ['餐館', 0xd9a273, 9, 6.5], ['馬具店', 0x9a4e2c, 10, 6], ['木材行', 0x8a6a40, 8, 6], ['戲院', 0xc8372d, 10, 8], ['藥房', 0xe8e0c8, 7, 6], ['報社', 0xc8c0b0, 8, 6.5],
  ];
  let zW = 292, zE = 296;
  BUILDINGS.forEach(([name, color, w, h], k) => {
    const west = k % 2 === 0;
    const z = west ? zW : zE;
    westernFront(props, signs, west ? street + 9 : street - 9, z + w / 2, west ? -P / 2 : P / 2, w, 8, h, color, name);
    if (west) zW += w + 3; else zE += w + 3;
  });
  // The street: hitching rails along its sides, barrels and a water trough, a covered wagon drawn up; people about it.
  for (const side of [-1, 1]) for (let z = 296; z < 386; z += 11) box(props, street + side * 4.3 - 0.06, 0.9, z, street + side * 4.3 + 0.06, 1.0, z + 3, 0x6a4a30, { ghost: true });
  for (const [x, z] of [[street + 3.5, 300], [street + 3.8, 301.2], [street - 3.6, 318], [street + 3.4, 334], [street - 3.5, 340]] as const) object('barrel', x, z);
  box(props, street - 4.2, 0, 324, street - 3.2, 0.7, 327, 0x6a4a30, { ghost: true });
  coveredWagon(props, street + 1.5, 380, 0.15);
  coveredWagon(props, street - 2, 352, -0.1);
  church(props, street, 398);
  crowds.push({ area: [street - 3.5, 292, street + 3.5, 390], count: 52, y: 0, clothes: [0x8a5a32, 0xd9a273, 0x3f5a7a, 0xf2efe6, 0x9a3a2a], hat: 0x6a4a30 });
  // The queue for the coaster, inside its ring: in under the track on the west, winding between posts to the steps up on
  // to its platform.
  {
    // Five lanes between six lines of posts and belts, each line open at one end, turn about: in at the east end of the
    // first, back and forth, out at the west end of the last toward the platform. Those waiting, each in their lane.
    const [xa, xb, z0, LANE, LANES] = [341, 353, 299, 1.8, 5];
    const post = (x: number, z: number) => {
      props.push({ shape: 'cylinder', size: [0.045, 0.5, 0], pos: [x, 0.5, z], color: 0xd8dce0, ghost: true });
      props.push({ shape: 'cylinder', size: [0.17, 0.03, 0], pos: [x, 0.03, z], color: 0x8a8f96, ghost: true });
    };
    for (let i = 0; i <= LANES; i++) {
      const z = z0 + i * LANE;
      for (let x = xa; x <= xb + 0.01; x += 2) {
        post(x, z);
        const open = i > 0 && i < LANES && (i % 2 ? x < xa + 0.01 : x >= xb - 2.01);
        if (x + 2 <= xb + 0.01 && !open) box(props, x, 0.88, z - 0.02, x + 2, 0.95, z + 0.02, 0xc8372d, { ghost: true });
      }
    }
    for (let i = 0; i < LANES; i++) {
      const z = z0 + i * LANE;
      if (i < LANES - 1) box(props, xa - 0.02, 0.88, z, xa + 0.02, 0.95, z + LANE, 0xc8372d, { ghost: true });
      if (i > 0) box(props, xb - 0.02, 0.88, z, xb + 0.02, 0.95, z + LANE, 0xc8372d, { ghost: true });
      crowds.push({ area: [xa + 0.5, z + 0.6, xb - 0.5, z + LANE - 0.6], count: i % 2 ? 10 : 11, y: 0, fenced: true, dance: i % 2 ? P / 2 : -P / 2, stand: true });
    }
    // Where it begins, its sign on a post: and those still coming to it.
    bar(props, [xb + 0.6, 0, z0 + 0.9], [xb + 0.6, 2.4, z0 + 0.9], 0.05, 0xd8dce0, { ghost: true });
    signs.push({ pos: [xb + 0.62, 2.1, z0 + 0.9], rotY: -P / 2, kind: 'name', text: '排隊入口', colors: ['#2a3a48', '#f2c12e', '#f2efe6'], wide: 1.8 });
    crowds.push({ area: [xb + 0.8, z0 - 0.4, xb + 3.4, z0 + 2.2], count: 4, y: 0 });
  }
  signs.push({ pos: [358, 2.6, 283.5], rotY: P, kind: 'name', text: '等候 45 分', colors: ['#2a3a48', '#f2c12e', '#f2efe6'], wide: 2.8 });
  // The far corner: mesas, layer on layer, flat on top; a wind pump by its tank; cactus and scrub.
  for (const [x, z, r, h] of [[428, 392, 11, 14], [424, 432, 9, 11], [432, 350, 7, 8]] as const) mesa(props, x, z, r, h);
  windPump(props, 420, 408);
  for (const [x, z, hgt] of [[418, 312, 4.6], [422, 372, 3.4], [430, 456, 4.0], [392, 456, 3.6]] as const) cactus(props, x, z, hgt);
  for (const [x, z] of [[420, 286], [430, 300], [424, 452]] as const) props.push({ shape: 'sphere', size: [1.2, 0.6, 1.0], pos: [x, 0.4, z], color: 0x8a8a4a, ghost: true });
}

/** A false-fronted timber building of a western town: its front taller than its roof, a porch on posts, its name across the front. */
function westernFront(props: PropDesc[], signs: SignDesc[], x: number, z: number, yaw: number, w: number, d: number, h: number, color: number, name: string): void {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const at = (across: number, out: number, up: number): [number, number, number] => [x + rx * across + fx * out, up, z + rz * across + fz * out];
  const rot: [number, number, number] = [0, yaw, 0];
  props.push({ shape: 'box', size: [w / 2, h / 2, d / 2], pos: at(0, 0, h / 2), rot, color, ghost: true });
  props.push({ shape: 'box', size: [w / 2 + 0.2, 0.9, 0.12], pos: at(0, d / 2 + 0.1, h + 0.7), rot, color, ghost: true });
  props.push({ shape: 'box', size: [w / 2 + 0.35, 0.12, 0.2], pos: at(0, d / 2 + 0.12, h + 1.62), rot, color: 0xf2efe6, ghost: true });
  props.push({ shape: 'box', size: [w / 2, 0.08, 1.4], pos: at(0, d / 2 + 1.4, 3.1), rot, color: 0x6a4a30, ghost: true });
  for (const a of [-w / 2 + 0.3, 0, w / 2 - 0.3]) props.push({ shape: 'box', size: [0.1, 1.55, 0.1], pos: at(a, d / 2 + 2.6, 1.55), rot, color: 0x5a3e28, ghost: true });
  props.push({ shape: 'box', size: [w / 2, 0.08, 1.4], pos: at(0, d / 2 + 1.4, 0.08), rot, color: 0x8a6a40, ghost: true });
  for (const a of [-w / 3, w / 3]) props.push({ shape: 'box', size: [w * 0.12, 0.6, 0.03], pos: at(a, d / 2 + 0.02, 1.8), rot, color: 0x2a3a48, ghost: true });
  props.push({ shape: 'box', size: [0.6, 1.1, 0.03], pos: at(0, d / 2 + 0.02, 1.1), rot, color: 0x3a2a20, ghost: true });
  for (const a of [-w / 3, 0, w / 3]) props.push({ shape: 'box', size: [w * 0.1, 0.5, 0.03], pos: at(a, d / 2 + 0.02, h - 1.2), rot, color: 0x2a3a48, ghost: true });
  signs.push({ pos: at(0, d / 2 + 0.2, h + 0.7), rotY: yaw, kind: 'name', text: name, colors: ['#f2e6cc', '#5a3e28', '#2a2420'], wide: Math.min(w - 1, name.length * 1.3 + 0.8) });
}

/** A covered wagon: its bed on four spoked wheels, the canvas over hoops. */
function coveredWagon(props: PropDesc[], x: number, z: number, yaw: number): void {
  props.push({ shape: 'box', size: [1.0, 0.35, 2.2], pos: [x, 1.1, z], rot: [0, yaw, 0], color: 0x8a5a32, ghost: true });
  for (let k = 0; k < 4; k++) props.push({ shape: 'cylinder', size: [1.05, 0.95, 0], pos: [x + Math.sin(yaw) * (-1.6 + k * 1.05), 1.45, z + Math.cos(yaw) * (-1.6 + k * 1.05)], rot: [0, yaw, P / 2], color: 0xf2ead8, ghost: true });
  for (const [dx, dz] of [[-1.1, -1.4], [1.1, -1.4], [-1.1, 1.4], [1.1, 1.4]]) props.push({ shape: 'cylinder', size: [0.62, 0.06, 0], pos: [x + dx * Math.cos(yaw) + dz * Math.sin(yaw), 0.62, z - dx * Math.sin(yaw) + dz * Math.cos(yaw)], rot: [0, yaw, P / 2], color: 0x5a3e28, ghost: true });
}

/** A mesa of red sandstone: rings of rock in layers, each set back, flat on top. */
function mesa(props: PropDesc[], x: number, z: number, r: number, h: number): void {
  const layers = 4;
  for (let n = 0; n < layers; n++) {
    const rr = r * (1 - n * 0.16), y0 = (h * n) / layers, y1 = (h * (n + 1)) / layers;
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * P * 2 + n;
      props.push({ shape: 'box', size: [rr * 0.5 + jig(j + n) * 0.8, (y1 - y0) / 2, rr * 0.42], pos: [x + Math.cos(a) * rr * 0.5, (y0 + y1) / 2, z + Math.sin(a) * rr * 0.5], rot: [jig(j * 3 + n) * 0.06, -a + jig(j) * 0.3, 0], color: SAND[(j + n) % 4], ghost: true });
    }
    props.push({ shape: 'cylinder', size: [rr * 0.92, 0.18, 0], pos: [x, y1 - 0.2, z], color: BAND, ghost: true });
  }
  props.push({ shape: 'cylinder', size: [r * 0.5, 0.2, 0], pos: [x, h + 0.05, z], color: 0x8a8a4a, ghost: true });
}

/** A wind pump on its tower over a round tank: the vanes of its wheel, its tail. */
function windPump(props: PropDesc[], x: number, z: number): void {
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bar(props, [x + dx * 1.2, 0, z + dz * 1.2], [x + dx * 0.25, 9, z + dz * 0.25], 0.06, 0x8a8f96, { ghost: true });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * P * 2;
    props.push({ shape: 'box', size: [0.18, 1.0, 0.02], pos: [x + Math.cos(a) * 1.2, 9.6 + Math.sin(a) * 1.2, z + 0.4], rot: [0, 0, a + P / 2], color: 0xd8dce0, ghost: true });
  }
  props.push({ shape: 'box', size: [0.04, 0.5, 1.0], pos: [x, 9.6, z - 1.3], color: 0xd23a32, ghost: true });
  props.push({ shape: 'cylinder', size: [2.2, 0.6, 0], pos: [x + 3.4, 0.6, z], color: 0x8a8f96, ghost: true });
}

/** A water tower: a wooden tank on four legs, braced, its spout swung out. */
function waterTower(props: PropDesc[], x: number, z: number): void {
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) bar(props, [x + dx * 1.2, 0, z + dz * 1.2], [x + dx, 6, z + dz], 0.16, 0x6a4a30, { ghost: true });
  for (const h of [2, 4]) for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) bar(props, [x + a[0] * 1.7, h, z + a[1] * 1.7], [x + b[0] * 1.7, h, z + b[1] * 1.7], 0.06, 0x6a4a30, { ghost: true });
  props.push({ shape: 'cylinder', size: [2.4, 1.6, 0], pos: [x, 7.6, z], color: 0x9a6a3a, ghost: true });
  for (const h of [6.6, 8.6]) props.push({ shape: 'cylinder', size: [2.45, 0.06, 0], pos: [x, h, z], color: 0x3a3f46, ghost: true });
  props.push({ shape: 'cone', size: [2.7, 1.0, 0], pos: [x, 9.9, z], color: 0x6a4a30, ghost: true });
  bar(props, [x - 2.2, 6.6, z], [x - 3.4, 5.2, z], 0.12, 0x5a6068, { ghost: true });
}

/** A mine cart on its rails: an iron tub on four wheels, heaped with ore that glints. */
function mineCart(props: PropDesc[], x: number, z: number): void {
  box(props, x - 1.2, 0.35, z - 0.7, x + 1.2, 1.25, z + 0.7, 0x5a4a3a, { ghost: true });
  box(props, x - 1.25, 1.15, z - 0.75, x + 1.25, 1.27, z + 0.75, 0x3a3f46, { ghost: true });
  props.push({ shape: 'sphere', size: [1.0, 0.35, 0.6], pos: [x, 1.3, z], color: 0x8a7a68, ghost: true });
  for (const [dx, dz] of [[-0.9, -0.6], [0.9, -0.6], [-0.9, 0.6], [0.9, 0.6]]) props.push({ shape: 'cylinder', size: [0.25, 0.06, 0], pos: [x + dx, 0.3, z + dz], rot: [P / 2, 0, 0], color: 0x24262a, ghost: true });
  for (const [dx, dz] of [[-0.4, 0.1], [0.3, -0.2], [0.1, 0.3]]) props.push({ shape: 'sphere', size: [0.12, 0.1, 0.12], pos: [x + dx, 1.58, z + dz], color: 0xf2c12e, ghost: true, glow: true });
}

/** A crate of dynamite, for show: red sticks bundled, a fuse, the crate stencilled. */
function dynamite(props: PropDesc[], x: number, z: number, yaw: number): void {
  props.push({ shape: 'box', size: [0.55, 0.35, 0.4], pos: [x, 0.35, z], rot: [0, yaw, 0], color: 0xa07a4a, ghost: true });
  for (let k = 0; k < 5; k++) props.push({ shape: 'cylinder', size: [0.06, 0.3, 0], pos: [x - 0.25 + k * 0.12, 0.85, z], rot: [0, yaw, 0], color: 0xc8372d, ghost: true });
  bar(props, [x, 1.15, z], [x + 0.2, 1.35, z + 0.1], 0.015, 0x2a2420, { ghost: true });
}

/** A saguaro: a ribbed green column, an arm or two turned up. */
function cactus(props: PropDesc[], x: number, z: number, h: number): void {
  props.push({ shape: 'cylinder', size: [0.35, h / 2, 0], pos: [x, h / 2, z], color: 0x5a8a4a, ghost: true });
  props.push({ shape: 'sphere', size: [0.35, 0.3, 0.35], pos: [x, h, z], color: 0x5a8a4a, ghost: true });
  for (const [side, at] of [[1, 0.45], [-1, 0.6]] as const) {
    const y = h * at;
    bar(props, [x, y, z], [x + side * 0.9, y, z], 0.22, 0x5a8a4a, { ghost: true });
    bar(props, [x + side * 0.9, y, z], [x + side * 0.9, y + h * 0.3, z], 0.22, 0x5a8a4a, { ghost: true });
  }
}

/**
 * The rest of the grounds, what a mine and its town had round them. Beside the lift, the mine works: the headframe over its
 * shaft with its wheel up top and the hoist house, the ore carried on rails to the mill, heaps of ore and of tailings. North
 * of the helix the gold diggings, done for the visitors: a sluice the length of a stream on trestles, tents, a fire, children
 * panning. West of the helix the ranch: its corral with the horses in it, the barn. North of the ride's end, the coaster's own
 * shed, where its spare train is kept.
 */
function mineWorks(s: ParkSite): void {
  const { props, signs, crowds } = s;
  // The headframe: four legs of timber leaning in, braced, the sheave wheel up top; the shaft's collar; the hoist house
  // with its cable up to the wheel.
  const [hx, hz] = [350, 330];
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bar(props, [hx + dx * 3, 0, hz + dz * 2.4], [hx + dx * 1.2, 13, hz + dz * 1.2], 0.22, 0x6a4a30, { ghost: true });
  for (const h of [4, 8, 11]) {
    const k = 3 - (h / 13) * 1.8, kz = 2.4 - (h / 13) * 1.2;
    for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) bar(props, [hx + a[0] * k, h, hz + a[1] * kz], [hx + b[0] * k, h, hz + b[1] * kz], 0.1, 0x5a3e28, { ghost: true });
  }
  box(props, hx - 1.6, 12.9, hz - 1.6, hx + 1.6, 13.2, hz + 1.6, 0x5a3e28, { ghost: true });
  props.push({ shape: 'cylinder', size: [1.8, 0.12, 0], pos: [hx, 14.6, hz], rot: [0, 0, P / 2], color: 0x3a3f46, ghost: true });
  props.push({ shape: 'cylinder', size: [0.25, 0.3, 0], pos: [hx, 14.6, hz], rot: [0, 0, P / 2], color: 0x8a8f96, ghost: true });
  box(props, hx - 2.2, 0, hz - 1.8, hx + 2.2, 0.6, hz + 1.8, 0x7a5a3a);
  box(props, hx - 13, 0, hz - 3, hx - 6, 4.4, hz + 3, 0x9a6a3a);
  box(props, hx - 13.2, 4.4, hz - 3.2, hx - 5.8, 4.7, hz + 3.2, 0x5a3e28, { ghost: true });
  props.push({ shape: 'cylinder', size: [0.3, 1.5, 0], pos: [hx - 11.5, 6.2, hz + 1.5], color: 0x3a3f46, ghost: true });
  bar(props, [hx - 6, 3.6, hz], [hx - 1.6, 14.6, hz], 0.03, 0x24262a, { ghost: true });
  signs.push({ pos: [hx, 10, hz - 2.5], rotY: P, kind: 'name', text: '一號礦井', colors: ['#5a3e28', '#f2c12e', '#2a2420'], wide: 3.6 });
  // Rails from the shaft to the mill; carts on them, full.
  const [rz, ra, rb] = [323, 346, 372];
  for (let x = ra; x < rb; x += 1.2) box(props, x - 0.12, 0, rz - 0.9, x + 0.12, 0.08, rz + 0.9, 0x6a4a30, { ghost: true });
  for (const side of [-0.6, 0.6]) box(props, ra - 0.5, 0.08, rz + side - 0.04, rb, 0.16, rz + side + 0.04, 0x5a6068, { ghost: true });
  for (const x of [354, 358.6, 366]) mineCart(props, x, rz);
  // The mill: built down the slope of a bank in three steps, roofed each, a chute out of the top into the bins; its stack.
  for (const [k, h] of [[0, 3.2], [1, 6.2], [2, 9.2]] as const) {
    const za = 296 + k * 7, zb = za + 7;
    box(props, 374, 0, za, 386, h, zb, [0x8a6a40, 0x9a7a4a, 0x7a5a3a][k], { mapColor: 0x6a4a30 });
    props.push({ shape: 'box', size: [6.3, 0.15, 3.8], pos: [380, h + 0.4, za + 3.5], rot: [-0.2, 0, 0], color: 0x6a5848, ghost: true });
    for (const x of [376.5, 380, 383.5]) box(props, x - 0.7, h - 2.2, za - 0.03, x + 0.7, h - 1.2, za, 0x2a2420, { ghost: true });
  }
  bar(props, [372, 1.0, rz], [376, 7, 312], 0.4, 0x6a4a30, { ghost: true });
  props.push({ shape: 'cylinder', size: [0.5, 5, 0], pos: [384.5, 14, 314], color: 0x5a3e28, ghost: true });
  signs.push({ pos: [380, 7.4, 295.9], rotY: P, kind: 'name', text: '選礦場', colors: ['#5a3e28', '#f2c12e', '#2a2420'], wide: 3.2 });
  // Heaps of ore by the shaft, of tailings out past the mill.
  for (const [x, z, r, h, c] of [[358, 342, 3.2, 2.4, 0x8a7a68], [364, 346, 2.6, 1.8, 0x7a6a5a], [346, 344, 2.2, 1.6, 0x8a7a68], [376, 374, 6, 2.2, 0xc8a878], [385, 382, 4.5, 1.6, 0xb89868]] as const) props.push({ shape: 'cone', size: [r, h, 0], pos: [x, h, z], color: c, ghost: true });
  crowds.push({ area: [364, 334, 372, 338], count: 8, y: 0, clothes: [0x8a5a32, 0x3f5a7a, 0xf2efe6], hat: 0x6a4a30 });

  // The diggings: a stream in its bed, a sluice of boards along it on trestles; tents, a fire ring, the panning troughs
  // with the children at them, the sign.
  const [da, db, dz] = [338, 374, 444];
  box(props, da, 0.01, dz - 1.4, db, 0.04, dz + 1.4, 0x4fa8c8, { ghost: true, mapColor: 0x4fa8c8 });
  for (let x = da; x < db; x += 3) for (const side of [-1, 1]) bar(props, [x, 0, dz + side * 0.5], [x, 1.1, dz + side * 0.3], 0.07, 0x6a4a30, { ghost: true });
  box(props, da, 1.1, dz - 0.45, db, 1.18, dz + 0.45, 0x9a6a3a, { ghost: true });
  for (const side of [-1, 1]) box(props, da, 1.18, dz + side * 0.45 - 0.04, db, 1.5, dz + side * 0.45 + 0.04, 0x8a5a32, { ghost: true });
  box(props, da + 0.5, 1.19, dz - 0.38, db - 0.5, 1.22, dz + 0.38, 0x7ab8d0, { ghost: true });
  for (const x of [342, 352, 362]) {
    box(props, x - 2, 0, dz - 4.4, x + 2, 0.7, dz - 3.2, 0x8a6a40);
    box(props, x - 1.8, 0.7, dz - 4.2, x + 1.8, 0.72, dz - 3.4, 0x6aa8c0, { ghost: true });
    crowds.push({ area: [x - 1.8, dz - 6.2, x + 1.8, dz - 5], count: 4, y: 0, size: 0.6 });
  }
  for (let k = 0; k < 4; k++) tent(props, 356 + k * 5, 453, k % 2 ? 0xf2ead8 : 0xe8dcc0);
  props.push({ shape: 'cylinder', size: [0.9, 0.12, 0], pos: [370, 0.12, 437], color: 0x6a6a6a, ghost: true });
  props.push({ shape: 'cone', size: [0.5, 0.7, 0], pos: [370, 0.6, 437], color: 0xf2a52e, ghost: true, glow: true });
  for (let k = 0; k < 4; k++) props.push({ shape: 'cylinder', size: [0.18, 0.9, 0], pos: [370 + Math.cos(k * 1.6) * 2, 0.2, 437 + Math.sin(k * 1.6) * 2], rot: [0, k, P / 2], color: 0x6a4a30, ghost: true });
  signs.push({ pos: [db + 1.5, 2.2, dz], rotY: -P / 2, kind: 'name', text: '淘金體驗', colors: ['#5a3e28', '#f2c12e', '#2a2420'], wide: 3.2 });
  bar(props, [db + 1.5, 0, dz - 1.4], [db + 1.5, 2.8, dz - 1.4], 0.06, 0x6a4a30, { ghost: true });
  bar(props, [db + 1.5, 0, dz + 1.4], [db + 1.5, 2.8, dz + 1.4], 0.06, 0x6a4a30, { ghost: true });
  crowds.push({ area: [da + 1, dz + 2, db - 4, dz + 4.5], count: 10, y: 0 });

  // The ranch: a corral of rails, the horses in it; the barn, red, its hay stacked by it.
  const [ca, cb, cza, czb] = [396, 412, 413, 430];
  for (const [a, b] of [[[ca, cza], [cb, cza]], [[cb, cza], [cb, czb]], [[cb, czb], [ca, czb]], [[ca, czb], [ca, cza]]] as [number, number][][]) {
    const long = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    for (const y of [0.6, 1.2]) props.push({ shape: 'box', size: [0.05, 0.06, long / 2], pos: [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2], rot: [0, yaw, 0], color: 0x8a6a40, ghost: true });
    for (let d = 0; d <= long; d += 3) props.push({ shape: 'box', size: [0.08, 0.7, 0.08], pos: [a[0] + ((b[0] - a[0]) * d) / long, 0.7, a[1] + ((b[1] - a[1]) * d) / long], color: 0x6a4a30, ghost: true });
  }
  for (const [x, z, yaw, c] of [[400, 417, 0.4, 0x8a5a32], [405, 422, 2.2, 0xf2ead8], [408.5, 416, -0.6, 0x3a2a20], [401, 426, 1.4, 0xa86a3a]] as const) horse(props, x, z, yaw, c);
  box(props, 398, 0, 434, 412, 5, 446, 0xb33a2a, { mapColor: 0x8a3a2a });
  for (const side of [-1, 1]) props.push({ shape: 'box', size: [7.6, 0.15, 3.6], pos: [405, 6.0, 440 + side * 3.0], rot: [side * 0.55, 0, 0], color: 0x5a4a3a, ghost: true });
  box(props, 403, 0, 433.94, 407, 3.6, 434, 0x5a3a20, { ghost: true });
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, 1]]) box(props, 394 + dx * 1.3, 0, 438 + dz * 1.3, 395.2 + dx * 1.3, 1.0, 439.2 + dz * 1.3, 0xd9b45a, { ghost: true });

  // The coaster's shed, north of where the ride comes down: steel, its doors open on the spare train inside; its tools.
  const [ta, tb, tza, tzb] = [302, 318, 432, 452];
  box(props, ta, 0, tza, tb, 6, tzb, 0x8a9098, { mapColor: 0x6a7078 });
  box(props, ta - 0.2, 6, tza - 0.2, tb + 0.2, 6.4, tzb + 0.2, 0x6a7078, { ghost: true });
  box(props, ta + 2, 0, tza - 0.03, tb - 2, 4.8, tza, 0x2a2c30, { ghost: true });
  for (let n = 0; n < 3; n++) box(props, ta + 3 + n * 3.6, 0.5, tza - 0.6, ta + 6.2 + n * 3.6, 1.6, tza - 0.04, 0xd23a32, { ghost: true });
  signs.push({ pos: [(ta + tb) / 2, 5.4, tza - 0.05], rotY: P, kind: 'name', text: '維修廠', colors: ['#2a3a48', '#ffffff', '#f2c12e'], wide: 3.2 });
  for (const x of [ta + 1, tb - 1]) box(props, x - 0.5, 0, tza - 2.4, x + 0.5, 1.8, tza - 1.2, 0xd23a32);
}

/** A church of the western town: white boards, a pitched roof, a steeple over its door, its bell. */
function church(props: PropDesc[], x: number, z: number): void {
  box(props, x - 4.5, 0, z - 1, x + 4.5, 6, z + 13, 0xf2ead8, { mapColor: 0xd8d0c0 });
  for (const side of [-1, 1]) props.push({ shape: 'box', size: [3.0, 0.15, 7.2], pos: [x + side * 2.45, 7.2, z + 6], rot: [0, 0, side * -0.6], color: 0x6a4a30, ghost: true });
  box(props, x - 1.6, 0, z - 2.8, x + 1.6, 10, z - 1.05, 0xf2ead8, { ghost: true });
  props.push({ shape: 'cone', size: [2.0, 3.2, 0], pos: [x, 13.2, z - 1.9], color: 0x6a4a30, ghost: true });
  props.push({ shape: 'cylinder', size: [0.45, 0.4, 0], pos: [x, 8.6, z - 2.85], rot: [P / 2, 0, 0], color: 0xd9a830, ghost: true });
  box(props, x - 0.8, 0, z - 2.84, x + 0.8, 2.6, z - 2.81, 0x5a3e28, { ghost: true });
  for (const dx of [-3.2, 3.2]) box(props, x + dx - 0.5, 2, z - 1.04, x + dx + 0.5, 4, z - 1.01, 0x7ab8d0, { ghost: true });
}

/** A canvas tent on its ridge pole, the flaps tied back. */
function tent(props: PropDesc[], x: number, z: number, color: number): void {
  for (const side of [-1, 1]) props.push({ shape: 'box', size: [1.4, 0.04, 1.6], pos: [x + side * 0.95, 1.0, z], rot: [0, 0, side * -0.8], color, ghost: true });
  bar(props, [x, 0, z - 1.6], [x, 2.0, z - 1.6], 0.04, 0x6a4a30, { ghost: true });
  box(props, x - 0.5, 0, z - 1.62, x + 0.5, 1.2, z - 1.6, 0x3a3020, { ghost: true });
}

/** A horse standing: its body, its neck up and its head, four legs, a tail. */
function horse(props: PropDesc[], x: number, z: number, yaw: number, color: number): void {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const at = (across: number, out: number, up: number): [number, number, number] => [x + rx * across + fx * out, up, z + rz * across + fz * out];
  props.push({ shape: 'box', size: [0.28, 0.3, 0.8], pos: at(0, 0, 1.25), rot: [0, yaw, 0], color, ghost: true });
  props.push({ shape: 'box', size: [0.16, 0.42, 0.18], pos: at(0, 0.85, 1.7), rot: [0.5, yaw, 0], color, ghost: true });
  props.push({ shape: 'box', size: [0.13, 0.14, 0.32], pos: at(0, 1.15, 2.05), rot: [0.3, yaw, 0], color, ghost: true });
  for (const [a, o] of [[-0.18, 0.6], [0.18, 0.6], [-0.18, -0.6], [0.18, -0.6]]) props.push({ shape: 'box', size: [0.06, 0.48, 0.06], pos: at(a, o, 0.48), rot: [0, yaw, 0], color, ghost: true });
  props.push({ shape: 'box', size: [0.06, 0.35, 0.06], pos: at(0, -0.85, 1.1), rot: [-0.3, yaw, 0], color: 0x2a2420, ghost: true });
}

/**
 * The mine: a hill of red rock the track goes into off the camelback, round inside it to the west and south, coming down,
 * round a cavern: its floor below the track on its trestle, a pillar of rock in its middle with water down it into a pool,
 * crystals, a seam of gold in its wall, the old workings' carts and timbers, bats. The trains go on south out of it; the
 * truck's way turns east inside it, along the old level under the camelback (open to the sky there) and out to the shore.
 */
function mine(s: ParkSite, ride: WayPoint[], overTunnel: (x: number, z: number) => boolean): void {
  const { props, signs } = s;
  const tunnel = ride.filter((p) => p.s >= TUNNEL[0] && p.s <= TUNNEL[1]);
  const W = COASTER.wide / 2 + 0.35, IN = W + 0.9;
  const OFF = RING_JOIN + RING_PART;
  /** Under the camelback, where the old level is open to the sky. */
  const open = (p: WayPoint) => p.s > OFF && Math.abs(p.x - COASTER_AT[0]) < 7;
  /** Lengths of a way unbroken: for what is built along it between its points. */
  const runs = (pts: WayPoint[]) => pts.reduce<WayPoint[][]>((out, p) => { if (!out.length || p.s - out[out.length - 1][out[out.length - 1].length - 1].s > 1.5) out.push([]); out[out.length - 1].push(p); return out; }, []).filter((r) => r.length > 1);
  // Its floor under the track, the boards across it.
  along(props, tunnel, 2 * IN, 0.12, 0x7a5a3a, { mapColor: 0x8a745c }, 0, -0.02);
  // Its walls: the outer one all the way but where the trains go on out of it; the inner one only along the old level,
  // the cavern open beside the track before that. None under the camelback.
  const outer = tunnel.filter((p) => !open(p) && (p.s < OFF - 3 || p.s > OFF + 12));
  const inner = tunnel.filter((p) => !open(p) && p.s > OFF + 34);
  for (const run of runs(outer)) along(props, run, 0.7, 4.6, 0x9a4e2c, { mapColor: 0xa85a34 }, -(IN + 0.35), 3.8);
  for (const run of runs(inner)) along(props, run, 0.7, 4.6, 0x9a4e2c, { mapColor: 0xa85a34 }, IN + 0.35, 3.8);
  // The trains' way out to the south: its wall on the west, its mouth.
  const out = RING_A.filter((p) => p.s >= RING_PART - 1 && p.s <= RING_PART + 12);
  along(props, out, 0.7, 4.6, 0x9a4e2c, { mapColor: 0xa85a34 }, -(IN + 0.35), 3.8);
  along(props, out.slice(4), 2 * IN + 1.4, 0.5, 0x6a5848, { ghost: true, fade: true, overhead: true }, 0, 4.3);
  // The roof over the track, and over the cavern.
  for (const run of runs(tunnel.filter((p) => !open(p)))) along(props, run, 2 * IN + 1.4, 0.5, 0x6a5848, { ghost: true, fade: true, overhead: true }, 0, 4.3);
  const [cx, cz] = [COASTER_AT[0] + 11, 418.5];
  box(props, cx - 6.5, 7.4, cz - 13, cx + 11.5, 8.0, cz + 15.5, 0x6a5848, { ghost: true, fade: true, overhead: true });
  // Timber sets every few metres: a post each side, a cap across, a lantern on each post.
  for (let k = 0; k < tunnel.length; k += 6) {
    const p = tunnel[k];
    if (open(p)) continue;
    for (const side of [-1, 1]) {
      props.push({ shape: 'sphere', size: [0.16, 0.2, 0.16], pos: beside(p, side * (IN - 0.1), 2.6), color: 0xffc860, ghost: true, glow: true });
      bar(props, beside(p, side * (IN - 0.1), -p.y), beside(p, side * (IN - 0.1), 3.9), 0.12, 0x6a4a30, { ghost: true });
    }
    props.push({ shape: 'box', size: [IN, 0.12, 0.14], pos: beside(p, 0, 3.95), rot: alongRot(p.yaw, p.grade), color: 0x6a4a30, ghost: true, fade: true, overhead: true });
  }
  // The trestle under the track where it is up over the cavern's floor: bents of timber, braced.
  for (let k = 3; k < tunnel.length; k += 4) {
    const p = tunnel[k];
    if (p.y < 1.2 || p.s > OFF + 20) continue;
    for (const side of [-1, 1]) bar(props, beside(p, side * (IN - 0.4), -p.y), beside(p, side * (W - 0.3), -0.14), 0.1, 0x5a3e28, { ghost: true });
    bar(props, beside(p, -(IN - 0.6), -p.y * 0.6), beside(p, IN - 0.6, -p.y * 0.4), 0.06, 0x5a3e28, { ghost: true });
  }
  // Its mouths, framed in timber: the way in, the trains' way out, the truck's.
  const mouths: WayPoint[] = [tunnel[0], out[out.length - 1], tunnel[tunnel.length - 1]];
  for (const p of mouths) {
    for (const side of [-1, 1]) bar(props, beside(p, side * (IN + 0.2), -p.y), beside(p, side * (IN + 0.2), 4.4), 0.24, 0x5a3e28);
    props.push({ shape: 'box', size: [IN + 0.5, 0.3, 0.3], pos: beside(p, 0, 4.4), rot: alongRot(p.yaw, 0), color: 0x5a3e28, ghost: true, fade: true, overhead: true });
  }
  signs.push({ pos: beside(tunnel[0], 0, 5.3), rotY: tunnel[0].yaw + P, kind: 'name', text: '黃金礦坑', colors: ['#5a3e28', '#f2c12e', '#2a2420'], wide: 4 });
  // The rock round it: red sandstone in layers, cut square and leaning a little, each layer set back from the one under
  // it; flat on top, where scrub and a few pines grow. Outside the track all the way round; both sides of the old level.
  const rock = (p: WayPoint, side: number, n: number) => {
    const wide = 2.4 + jig(n) * 0.8, high = 2.6 + jig(n + 7) * 0.5, base = -0.4;
    const [x0, , z0] = beside(p, side * (IN + 0.7 + wide));
    // Not in the trains' way out.
    if (p.s > OFF && RING_A.some((q) => q.s > RING_PART + 1 && Math.hypot(q.x - x0, q.z - z0) < 2.6 + wide)) return;
    props.push({ shape: 'box', size: [wide, high, 3.4], pos: [x0, base + high, z0], rot: [jig(n + 1) * 0.12, p.yaw + jig(n + 2) * 0.3, side * 0.06], color: SAND[n % 4], ghost: true, fade: true });
    props.push({ shape: 'box', size: [wide + 0.05, 0.18, 3.42], pos: [x0, base + high * 2 - 0.4, z0], rot: [jig(n + 1) * 0.12, p.yaw + jig(n + 2) * 0.3, side * 0.06], color: BAND, ghost: true, fade: true });
    const [x1, , z1] = beside(p, side * (IN + 0.5 + wide * 0.6));
    const up = 1.6 + jig(n + 3) * 0.4;
    props.push({ shape: 'box', size: [wide * 0.8, up, 2.8], pos: [x1, base + high * 2 + up - 0.1, z1], rot: [jig(n + 4) * 0.1, p.yaw + jig(n + 5) * 0.35, side * 0.05], color: SAND[(n + 1) % 4], ghost: true, fade: true });
    if (n % 3 === 0) props.push({ shape: 'sphere', size: [1.1, 0.5, 1.3], pos: [x1, base + high * 2 + up * 2, z1], color: 0x6a8a3a, ghost: true, fade: true });
    if (n % 5 === 2) {
      const top = base + high * 2 + up * 2 - 0.1;
      props.push({ shape: 'cylinder', size: [0.12, 0.5, 0], pos: [x1, top + 0.5, z1], color: 0x5a3e28, ghost: true, fade: true });
      props.push({ shape: 'cone', size: [0.9, 1.3, 0], pos: [x1, top + 2.1, z1], color: 0x3f6a34, ghost: true, fade: true });
    }
  };
  for (let k = 0; k < tunnel.length; k += 5) {
    const p = tunnel[k];
    if (open(p) || (p.s > OFF - 3 && p.s < OFF + 12)) continue;
    rock(p, -1, k * 2);
    if (p.s > OFF + 34) rock(p, 1, k * 2 + 1);
  }
  for (let k = 5; k < out.length; k += 5) rock(out[k], -1, 700 + k);
  // Between the cavern and the camelback beside it, a wall of the same rock, lower, to see over from the track above.
  for (let z = cz - 9; z < cz + 3; z += 3.2) props.push({ shape: 'box', size: [1.0, 2.2 + jig(z) * 0.5, 1.8], pos: [cx - 6.2, 2.0, z], rot: [0, jig(z + 1) * 0.3, 0], color: SAND[Math.round(z) % 4], ghost: true, fade: true });

  // The cavern, inside the track's turn. The pillar in its middle, water down its face into a pool lit from below.
  const [px, pz] = [cx + 0.5, cz + 2.5];
  for (const [r, y0, y1, c] of [[3.4, 0, 2.6, 0], [2.7, 2.6, 5.2, 2], [3.3, 5.2, 7.6, 1]] as const) {
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * P * 2 + r;
      props.push({ shape: 'box', size: [r * 0.62, (y1 - y0) / 2, r * 0.5], pos: [px + Math.cos(a) * r * 0.5, (y0 + y1) / 2, pz + Math.sin(a) * r * 0.5], rot: [jig(j * 3 + r) * 0.08, -a + jig(j) * 0.3, jig(j * 5) * 0.08], color: SAND[(j + c) % 4], ghost: true });
    }
    props.push({ shape: 'cylinder', size: [r, 0.14, 0], pos: [px, y1 - 0.2, pz], color: BAND, ghost: true });
  }
  box(props, px - 0.8, 0.2, pz - 3.5, px + 0.8, 7.2, pz - 3.42, 0xcfeef8, { ghost: true, glow: true });
  props.push({ shape: 'cylinder', size: [2.6, 0.05, 0], pos: [px, 0.05, pz - 5.2], color: 0x3fb8d8, ghost: true, glow: true });
  props.push({ shape: 'cylinder', size: [2.9, 0.03, 0], pos: [px, 0.03, pz - 5.2], color: 0x7a5a3a, ghost: true });
  for (let k = 0; k < 4; k++) s.fountains.push([px - 0.6 + k * 0.4, 0.1, pz - 3.9]);
  // Crystals in clumps on its floor and up its walls, lit; a seam of gold along the outer wall, glinting.
  const CRYSTAL = [0x6fe0e8, 0xb48cf0, 0xf08ad0, 0x8af0b0];
  for (let n = 0; n < 16; n++) {
    const a = n * 2.4, r = 2.2 + ((n * 37) % 50) / 10;
    const [x, z] = [cx + 1 + Math.cos(a) * r * 1.1, cz + 1 + Math.sin(a) * r * 1.5];
    if (Math.hypot(x - px, z - pz) < 3.6) continue;
    for (let j = 0; j < 4; j++) props.push({ shape: 'cone', size: [0.16 + j * 0.05, 0.5 + ((n + j) % 3) * 0.3, 0], pos: [x + jig(n * 7 + j) * 0.7, 0.5 + ((n + j) % 3) * 0.3, z + jig(n * 11 + j) * 0.7], rot: [jig(n + j) * 0.5, 0, jig(n * 3 + j) * 0.5], color: CRYSTAL[(n + j) % 4], ghost: true, glow: true });
  }
  for (let k = 2; k < tunnel.length; k += 2) {
    const p = tunnel[k];
    if (open(p) || p.s > OFF - 4) continue;
    props.push({ shape: 'box', size: [0.05, 0.1 + (k % 3) * 0.06, 0.5], pos: beside(p, -(IN - 0.02), 1.5 + Math.sin(k * 0.7) * 0.5), rot: alongRot(p.yaw, 0.25 * Math.cos(k * 0.7)), color: 0xf2c12e, ghost: true, glow: true });
    if (k % 6 === 0) props.push({ shape: 'sphere', size: [0.09, 0.09, 0.09], pos: beside(p, -(IN - 0.05), 2.3 + jig(k) * 0.6), color: 0xfff2a0, ghost: true, glow: true });
  }
  // The old workings on its floor: a length of rail with its carts of ore, a heap of it, a windlass over a shaft, barrels,
  // a ladder up to the track; picks left against the wall.
  for (let k = 0; k < 9; k++) box(props, cx + 3.2 + k * 0.0, 0, cz - 9 + k * 1.2 - 0.12, cx + 5.0, 0.08, cz - 9 + k * 1.2 + 0.12, 0x6a4a30, { ghost: true });
  for (const dx of [3.5, 4.7]) box(props, cx + dx - 0.04, 0.08, cz - 9.5, cx + dx + 0.04, 0.16, cz + 1.4, 0x5a6068, { ghost: true });
  mineCart(props, cx + 4.1, cz - 7);
  mineCart(props, cx + 4.1, cz - 3.2);
  props.push({ shape: 'cone', size: [1.5, 1.0, 0], pos: [cx - 3.2, 1.0, cz + 8.5], color: 0x8a745c, ghost: true });
  for (let j = 0; j < 6; j++) props.push({ shape: 'sphere', size: [0.1, 0.08, 0.1], pos: [cx - 3.2 + jig(j) * 1.6, 0.9 + jig(j + 3) * 0.6, cz + 8.5 + jig(j + 5) * 1.6], color: 0xf2c12e, ghost: true, glow: true });
  props.push({ shape: 'cylinder', size: [0.9, 0.3, 0], pos: [cx - 3.4, 0.3, cz - 5], color: 0x5a3e28, ghost: true });
  props.push({ shape: 'cylinder', size: [0.7, 0.02, 0], pos: [cx - 3.4, 0.61, cz - 5], color: 0x1a1612, ghost: true });
  for (const side of [-1, 1]) bar(props, [cx - 3.4 + side * 1.0, 0, cz - 5], [cx - 3.4 + side * 1.0, 1.6, cz - 5], 0.07, 0x6a4a30, { ghost: true });
  bar(props, [cx - 4.6, 1.5, cz - 5], [cx - 2.2, 1.5, cz - 5], 0.1, 0x8a6a40, { ghost: true });
  for (const [dx, dz] of [[6.2, 6], [6.8, 6.9], [-4.6, 2.2]]) {
    props.push({ shape: 'cylinder', size: [0.36, 0.48, 0], pos: [cx + dx, 0.48, cz + dz], color: 0x8a5a32, ghost: true });
    props.push({ shape: 'cylinder', size: [0.375, 0.04, 0], pos: [cx + dx, 0.5, cz + dz], color: 0x3a3f44, ghost: true });
  }
  // From its roof, stone hanging down in points; and bats, hung up in rows between them.
  for (let n = 0; n < 26; n++) {
    const [x, z] = [cx - 5 + ((n * 53) % 150) / 10, cz - 11 + ((n * 89) % 250) / 10];
    const long = 0.5 + (n % 4) * 0.3;
    props.push({ shape: 'cone', size: [0.2 + (n % 3) * 0.08, long, 0], pos: [x, 7.4 - long, z], rot: [P, 0, 0], color: SAND[n % 4], ghost: true, fade: true, overhead: true });
    if (n % 2) for (let j = 0; j < 3; j++) props.push({ shape: 'box', size: [0.07, 0.13, 0.05], pos: [x + 0.5 + j * 0.28, 7.2, z + 0.3], color: 0x1c1a20, ghost: true, fade: true, overhead: true });
  }
  // And bats on the wing: out of the dark at the truck as it comes in at the mouth, and gone.
  {
    const mouth = ride[TUNNEL[0] + 4], roost = ride[TUNNEL[0] + 26];
    s.flocks.push({ at: [mouth.x, mouth.y, mouth.z], reach: 4, from: [roost.x, roost.y + 2.4, roost.z] });
  }
  // Where the ways part, what says which is whose without a word: over the track short of it a signal bridge, a green
  // arrow to the left and a red cross beside it; a red cross again over the trains' mouth, and its lamps red; round the
  // outside of the truck's turn the black and yellow boards of a bend.
  {
    const lit = (pos: Vec3, half: [number, number, number], rot: Vec3, color: number) => props.push({ shape: 'box', size: half, pos, rot, color, ghost: true, glow: true });
    const cross = (p: WayPoint, across: number, up: number, r: number) => {
      const at = beside(p, across, up);
      for (const lean of [-1, 1]) lit(at, [r, r * 0.16, 0.03], [0, p.yaw, (lean * P) / 4], 0xff3a2a);
    };
    const bridge = ride[Math.round(OFF) - 4];
    for (const side of [-1, 1]) bar(props, beside(bridge, side * (IN - 0.3), -bridge.y), beside(bridge, side * (IN - 0.3), 4.4), 0.1, 0x3a3f44, { ghost: true });
    props.push({ shape: 'box', size: [IN - 0.3, 0.7, 0.06], pos: beside(bridge, 0, 3.75), rot: [0, bridge.yaw, 0], color: 0x1c1e22, ghost: true });
    // The arrow: its shaft, and its head at the left.
    const [ax, ay, az] = beside(bridge, 1.5, 3.75);
    const back = (x: number, y: number): Vec3 => [ax - Math.cos(bridge.yaw) * x - Math.sin(bridge.yaw) * 0.08, ay + y, az + Math.sin(bridge.yaw) * x - Math.cos(bridge.yaw) * 0.08];
    lit(back(0, 0), [0.85, 0.12, 0.03], [0, bridge.yaw, 0], 0x3aff6a);
    for (const lean of [-1, 1]) lit(back(-0.6, lean * 0.26), [0.4, 0.12, 0.03], [0, bridge.yaw, (-lean * P) / 4], 0x3aff6a);
    {
      const [x, y, z] = beside(bridge, -1.5, 3.75);
      cross({ ...bridge, x: x - Math.sin(bridge.yaw) * 0.08, y: 0, z: z - Math.cos(bridge.yaw) * 0.08 }, 0, y, 0.5);
    }
    // The trains' mouth: a board over it with its cross, red lamps down each side of it.
    const gate = out[out.length - 4];
    props.push({ shape: 'box', size: [1.3, 1.1, 0.06], pos: beside(gate, 0, 3.6), rot: [0, gate.yaw, 0], color: 0x1c1e22, ghost: true });
    cross({ ...gate, x: gate.x - Math.sin(gate.yaw) * 0.08, z: gate.z - Math.cos(gate.yaw) * 0.08 }, 0, 3.6, 0.9);
    for (const p of out.filter((_, k) => k % 3 === 1)) for (const side of [-1, 1]) props.push({ shape: 'sphere', size: [0.14, 0.14, 0.14], pos: beside(p, side * (IN - 0.15), 1.6), color: 0xff3a2a, ghost: true, glow: true });
    // On the deck, seen from above: green chevrons along the truck's way up to the parting and round its turn.
    for (let k = Math.round(OFF) - 12; k <= Math.round(OFF) + 18; k += 3) {
      const p = ride[k];
      for (const side of [-1, 1]) lit(beside(p, side * 0.27, 0.04), [0.09, 0.006, 0.4], alongRot(p.yaw - side * 0.75, 0), 0x3aff6a);
    }
    // The bend's boards, on the outside of the truck's turn where its own wall begins.
    for (let k = Math.round(OFF) + 13; k < Math.round(OFF) + 22; k += 2) {
      const p = ride[k], at = beside(p, -(IN - 0.05), 1.9);
      props.push({ shape: 'box', size: [0.04, 0.5, 0.7], pos: at, rot: [0, p.yaw, 0], color: 0x1c1e22, ghost: true });
      for (const lean of [-1, 1]) props.push({ shape: 'box', size: [0.05, 0.09, 0.34], pos: [at[0], at[1] + lean * 0.19, at[2]], rot: [lean * 0.6, p.yaw, 0], color: 0xf2c12e, ghost: true, glow: true });
    }
  }
  void overTunnel;
}
