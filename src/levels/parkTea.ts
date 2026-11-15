import { alongRot, bar, barRot, box, kiosk, planter, put, teaTable, type ParkSite } from './parkParts';
import { COASTER_AT, HUB, HUB_R, TABLES, TEA_EDGE, TEA_MOUTH, TEA_TURN, teaFence } from './parkPlan';
import type { Vec3 } from '../config';
import type { PropDesc, Vec2 } from './types';

// 2. The teacups: west out of the hub across three turntables rim to rim, small, larger, largest, each turning against the
// next as gears do, its cups going round on it; a sill between one and the next, no more: no stopping between them, so
// the time to set off is chosen once, in the way in, and the pace kept. Off the last, and straight away hard right, north up the narrow way between planters to
// the coaster's station. All of it one ride: one apron under the three, planters round the lot, striped poles at its
// corners with lamps strung between them over the tables, its booth and its queue, cups and cakes as big as carts.
// Round them the tea party: tables under parasols, cake carts, sugar cubes as big as a child for photographs; the dessert
// shop; the children's playground to the south, the food court to the west, the lake to the north.

const P = Math.PI;
const [hx, hz] = HUB;
const [sx, sz] = COASTER_AT;
/** The way off the last table: west for a few metres, round to the north, a radius the truck turns at a crawl. */
const OUT_TURN = 9.5;
const OUT_WIDE = 8;
const T3 = TABLES[TABLES.length - 1];
const LAST = TABLES.length - 1;
const TURN_FROM = T3[0] + teaFence(LAST) + 7.3;

export const TEA_ROUTE: Vec2[] = [
  [TABLES[0][0] - teaFence(0) - 4, TABLES[0][1]], ...TABLES.map(([x, z]) => [x, z] as Vec2), [T3[0] + teaFence(LAST) + 4, T3[1]],
  [TURN_FROM, T3[1]], [TURN_FROM + OUT_TURN * Math.sin(P / 6), T3[1] + OUT_TURN * (1 - Math.cos(P / 6))], [TURN_FROM + OUT_TURN * Math.sin(P / 3), T3[1] + OUT_TURN * (1 - Math.cos(P / 3))], [sx, T3[1] + OUT_TURN], [sx, sz - 4],
];

/** Whether a place is on a table or within so far of its planters. */
const near = (x: number, z: number, by: number) => TABLES.some(([cx, cz], k) => Math.hypot(x - cx, z - cz) < teaFence(k) + by);

export function teacups(s: ParkSite): void {
  const { props, signs, crowds } = s;
  const object = (kind: Parameters<typeof put>[1], x: number, z: number, rotY = 0, y = 0) => put(s, kind, x, z, rotY, y);

  // The tables.
  TABLES.forEach(([x, z, spin, cups, r], k) => s.rigs.push({ ...teaTable([x, z], spin, cups, k, [[0xf4e6d4, 0xf2a7bf], [0xe6f2ee, 0x8fd3c0], [0xfff2d8, 0xf6c66a]][k] as [number, number], r), yaw: TEA_TURN[k] }));
  // Under the three of them one apron, cream, a band of pink round each.
  TABLES.forEach(([x, z, , , r], k) => {
    props.push({ shape: 'cylinder', size: [r + TEA_EDGE + 2.6, 0.012 + k * 0.003, 0], pos: [x, 0.012 + k * 0.003, z], color: 0xfbf0e0, mapColor: 0xe8d8c0, ghost: true });
    props.push({ shape: 'cylinder', size: [r + 0.55, 0.02 + k * 0.003, 0], pos: [x, 0.02 + k * 0.003, z], color: 0xf28cb0, ghost: true });
  });
  // Round each, the ride's low wall, but at the gaps: on at the east end of the first, off at the west end of the last, and where one
  // table meets the next. There a sill between the two rims, gold-edged, a lamp on a post at each of its corners.
  const ends: number[][] = TABLES.map(() => []);
  ends[0].push(P);
  ends[LAST].push(0);
  const corners: { at: Vec2; out: Vec2 }[] = [];
  for (let k = 0; k < LAST; k++) {
    const [ax, az, , , ar] = TABLES[k], [bx, bz, , , br] = TABLES[k + 1];
    const a = Math.atan2(bz - az, bx - ax), d = Math.hypot(bx - ax, bz - az), gap = d - ar - br;
    ends[k].push(a);
    ends[k + 1].push(a + P);
    const mid: Vec2 = [ax + Math.cos(a) * (ar + gap / 2), az + Math.sin(a) * (ar + gap / 2)];
    props.push({ shape: 'box', size: [gap / 2 + 2.1, 0.034, TEA_MOUTH], pos: [mid[0], 0.034, mid[1]], rot: [0, -a, 0], color: 0xfbf0e0 });
    props.push({ shape: 'box', size: [0.12, 0.005, TEA_MOUTH], pos: [mid[0], 0.074, mid[1]], rot: [0, -a, 0], color: 0xd9a830, ghost: true });
    for (const side of [-1, 1]) {
      const out: Vec2 = [Math.cos(a + (side * P) / 2), Math.sin(a + (side * P) / 2)];
      const at: Vec2 = [mid[0] + out[0] * (TEA_MOUTH + 0.5), mid[1] + out[1] * (TEA_MOUTH + 0.5)];
      props.push({ shape: 'box', size: [1.5, 0.45, 0.5], pos: [at[0], 0.45, at[1]], rot: [0, -a, 0], color: 0xf6e8d4, mapColor: 0x6f9e52 });
      bar(props, [at[0], 0.9, at[1]], [at[0], 2.6, at[1]], 0.06, 0xd9a830, { ghost: true });
      props.push({ shape: 'sphere', size: [0.26, 0.26, 0.26], pos: [at[0], 2.8, at[1]], color: 0xfff2c0, ghost: true, glow: true });
      corners.push({ at: [mid[0] + out[0] * 10, mid[1] + out[1] * 10], out });
      // A sugar cube at each end of the sill, where a careless driver catches it.
      object('sugarCube', mid[0] + out[0] * (TEA_MOUTH - 0.9), mid[1] + out[1] * (TEA_MOUTH - 0.9), a + side);
    }
  }
  const mouth = (k: number) => Math.asin(TEA_MOUTH / teaFence(k)) + 0.06;
  for (const [k, [cx, cz]] of TABLES.entries()) {
    const fence = teaFence(k), n = Math.round((2 * P * fence) / 2.07);
    for (let j = 0; j < n; j++) {
      const a = (j / n) * P * 2 + P / n;
      const x = cx + Math.cos(a) * fence, z = cz + Math.sin(a) * fence;
      if (ends[k].some((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < mouth(k))) continue;
      const tx = -Math.sin(a) * 1.15, tz = Math.cos(a) * 1.15;
      rideWall(props, [x - tx, z - tz], [x + tx, z + tz], true);
    }
    // Those watching at the wall, on its north and south: two or three at a time, leaning on the rail, facing in.
    for (const b of [P / 2 - 0.3, P / 2 + 0.3, -P / 2 - 0.3, -P / 2 + 0.3]) {
      const x = cx + Math.cos(b) * (fence + 1.2), z = cz + Math.sin(b) * (fence + 1.2);
      if (TABLES.some(([ox, oz], o) => o !== k && Math.hypot(x - ox, z - oz) < teaFence(o) + 3)) continue;
      if (x > 249 && x < 260 && z > 248) continue;
      crowds.push({ area: [x - 0.9, z - 0.5, x + 0.9, z + 0.5], count: 2 + ((k + j0(b)) % 2), y: 0, fenced: true, dance: Math.atan2(-Math.cos(b), -Math.sin(b)), stand: true });
    }
  }
  // In the corners where two tables meet, outside their planters: what a tea party has, as big as carts. North of the
  // first meeting the ride's booth and its queue; south of it cups stacked; north of the second a cake in tiers; south of
  // it cups again. By each a striped pole, and from pole to pole over the tables, lamps on a string.
  {
    const [n0, s0, n1, s1] = [corners[1], corners[0], corners[3], corners[2]];
    const poles: Vec2[] = [];
    for (const c of [n0, s0, n1, s1]) {
      const at: Vec2 = [c.at[0] - c.out[0] * 3.6, c.at[1] - c.out[1] * 3.6];
      candyPole(props, at[0], at[1], 7.2);
      poles.push(at);
    }
    const [ax, az] = TABLES[0];
    const inPoles: Vec2[] = [-1, 1].map((side) => [ax - teaFence(0) - 1.5, az + side * 5.6] as Vec2);
    // At the mouth of the row of shops, against the corners of the first two.
    const outPoles: Vec2[] = [[314.2, 235.7], [314.2, 245.1]];
    for (const [x, z] of outPoles) candyPole(props, x, z, 7.2);
    const string = (a: Vec2, b: Vec2, from = 7.0) => festoon(props, [a[0], from, a[1]], [b[0], 7.0, b[1]]);
    string(poles[0], poles[1]);
    string(poles[2], poles[3]);
    string(poles[0], poles[2]);
    string(poles[1], poles[3]);
    string(inPoles[1], poles[0], 5.1);
    string(inPoles[0], poles[1], 5.1);
    string(poles[2], outPoles[1]);
    string(poles[3], outPoles[0]);
    cupStack(props, s0.at[0], s0.at[1], 0);
    tippedCup(props, s1.at[0] + 0.5, s1.at[1] - 1.5, 0.5);
    cake(props, n1.at[0], n1.at[1] + 1.2);
    // The booth, its back to the planters; the queue to it, in two lanes; those waiting.
    kiosk(props, signs, { at: [n0.at[0], n0.at[1] + 0.5], yaw: 0, half: [1.8, 1.5], high: 2.8, wall: 0xfbf0e0, trim: 0xd9a830, roof: 'dome', roofColor: 0xf28cb0, name: '咖啡杯', front: 'counter', awning: [0xf28cb0, 0xffffff] });
    const [qx, qz] = [n0.at[0] - 9.5, n0.at[1] + 3.4];
    for (let i = 0; i < 3; i++) {
      for (let x = qx; x <= qx + 6.01; x += 2) {
        props.push({ shape: 'cylinder', size: [0.045, 0.5, 0], pos: [x, 0.5, qz + i * 1.6], color: 0xd9a830, ghost: true });
        props.push({ shape: 'cylinder', size: [0.16, 0.03, 0], pos: [x, 0.03, qz + i * 1.6], color: 0x8a6a30, ghost: true });
        if (x + 2 <= qx + 6.01 && !(i === 1 && x < qx + 0.01)) box(props, x, 0.88, qz + i * 1.6 - 0.02, x + 2, 0.95, qz + i * 1.6 + 0.02, 0xf28cb0, { ghost: true });
      }
      if (i < 2) crowds.push({ area: [qx + 0.4, qz + i * 1.6 + 0.5, qx + 5.6, qz + i * 1.6 + 1.1], count: 5, y: 0, fenced: true, dance: i ? -P / 2 : P / 2, stand: true });
    }
  }
  // In from the hub: its way out on the west between planters to the first table's gap.
  const [ax, az] = TABLES[0];
  const gapAt = (x: number, z: number, a: number, k = 0): Vec2 => [x + Math.cos(a) * teaFence(k), z + Math.sin(a) * teaFence(k)];
  const hubEdge = (side: number): Vec2 => [hx + Math.cos(side * 0.27) * (HUB_R + 0.5), hz + Math.sin(side * 0.27) * (HUB_R + 0.5)];
  for (const side of [-1, 1]) rideWall(props, gapAt(ax, az, P - side * (mouth(0) - 0.05)), hubEdge(side));
  const signX = ax - teaFence(0) - 1.5;
  signs.push({ pos: [signX, 4.4, az], rotY: -P / 2, kind: 'name', text: '瘋狂咖啡杯', colors: ['#f28cb0', '#ffffff', '#d9a830'], wide: 8 });
  for (const side of [-1, 1]) candyPole(props, signX, az + side * 5.6, 5.1);
  {
    const arch = (t: number): Vec3 => [signX, 5.1 + Math.sin(t * P) * 1.6, az - 5.6 + t * 11.2];
    for (let k = 0; k < 12; k++) {
      bar(props, arch(k / 12), arch((k + 1) / 12), 0.2, 0xf28cb0, { ghost: true });
      if (k) props.push({ shape: 'sphere', size: [0.13, 0.13, 0.13], pos: [arch(k / 12)[0] - 0.24, arch(k / 12)[1], arch(k / 12)[2]], color: k % 2 ? 0xfff2b0 : 0xffffff, ghost: true, glow: true });
    }
    for (const side of [-1, 1]) bar(props, [signX, 5.0, az + side * 3.2], arch(0.5 + side * 0.286), 0.025, 0xd9a830, { ghost: true });
    const [tx, ty, tz] = arch(0.5);
    props.push({ shape: 'cylinder', size: [1.25, 0.06, 0], pos: [tx, ty + 0.25, tz], color: 0xf7f4ee, ghost: true });
    props.push({ shape: 'sphere', size: [0.8, 0.3, 0.8], pos: [tx, ty + 0.55, tz], color: 0x8fd3c0, ghost: true });
    props.push({ shape: 'cylinder', size: [0.9, 0.42, 0], pos: [tx, ty + 0.95, tz], color: 0x8fd3c0, ghost: true });
    props.push({ shape: 'cylinder', size: [0.95, 0.05, 0], pos: [tx, ty + 1.38, tz], color: 0xffffff, ghost: true });
    handle(props, [tx, ty + 0.95, tz], 0.9, -P / 2, 0.36, 0x8fd3c0);
    for (let k = 0; k < 3; k++) props.push({ shape: 'sphere', size: [0.32 + k * 0.08, 0.26 + k * 0.06, 0.32 + k * 0.08], pos: [tx + 0.1 * k, ty + 1.8 + k * 0.6, tz + Math.sin(k * 2) * 0.25], color: 0xffffff, ghost: true });
  }
  // Along the way in, outside its planters: lamps, and the tea party's cups stacked up, one each hand.
  for (const side of [-1, 1]) {
    for (let x = signX - 6; x > hx + HUB_R + 5; x -= 7) object('parkLamp', x, az + side * 8.2);
    cupStack(props, signX - 3, az + side * 10.5, side + 2);
  }
  // In the way in, against its planters: a cake cart, its cake under glass; a giant sugar cube for photographs either side.
  object('cakeCart', signX - 4.5, az - 1.6, 0.2);
  object('sugarCube', signX + 1.6, az + 2.0, 0.3);
  object('sugarCube', signX + 2.6, az + 1.2, 1.1);

  // Off the last table: west, round the corner to the north, up to the station's ramp: two short streets square to each
  // other, paved in brick, shops either hand in straight rows, their fronts to the way, set back a little more or less,
  // each its own: what it sells up on its roof or its name hung out over the pavement, and out in front of it, out into
  // the way, what it has to show. Outside the corner: the souvenir shop with its clock gable, the toy shop with a bear on
  // its roof, the capsule toys with a capsule, the ride's photographs with a camera, ice cream with a cone, the cups' own
  // shop with a cup; a fountain in the corner. On the inside corner the crêpe shop, a turret on its corner and a front to
  // each street, its tables out behind it among the tea garden's; then balloons and hats, a photo sticker booth. Between one
  // and the next, its yard wall. Those up the way north serve the food court from their backs as well; behind those along
  // the way west, their yards.
  {
    const c: Vec2 = [TURN_FROM, T3[1] + OUT_TURN];
    const show = { ghost: true };
    /** A point so far across a shop's front (to the right as faced), so far out from it, and up. */
    const frame = (front: Vec2, yaw: number) => (across: number, out: number, up: number): Vec3 => [front[0] + Math.cos(yaw) * across + Math.sin(yaw) * out, up, front[1] - Math.sin(yaw) * across + Math.cos(yaw) * out];
    /** A shop by the middle of its front, the way it faces, half its width and its depth; its name over its awning, or carried some other way. */
    const shop = (front: Vec2, yaw: number, w: number, d: number, name: string | undefined, wall: number, roofColor: number, roof: 'flat' | 'pitched' | 'dome', kind: 'counter' | 'shop', high: number, nameColors?: [string, string, string]) =>
      kiosk(props, signs, { at: [front[0] - Math.sin(yaw) * d, front[1] - Math.cos(yaw) * d], yaw, half: [w, d], high, wall, trim: 0xffffff, roof, roofColor, name, nameColors, front: kind, awning: [roofColor, 0xffffff] });
    /** A name board hung out from a shop's front on its brackets, over the awning, its words down it. */
    const blade = (front: Vec2, yaw: number, across: number, text: string, tall: number, colors: [string, string, string]) => {
      const at = frame(front, yaw), mid = 2.75 + tall / 2, out = 0.45 + tall * 0.125;
      signs.push({ pos: at(across, out, mid), rotY: yaw + P / 2, kind: 'name', text, colors, wide: tall, tall: true });
      for (const y of [mid - tall * 0.3, mid + tall * 0.3]) props.push({ shape: 'box', size: [0.035, 0.035, out / 2], pos: at(across, out / 2, y), rot: [0, yaw, 0], color: 0x3a3f46, ...show });
    };
    /** A counter window in a shop's back under an awning of its own: serving that way as well. */
    const backCounter = (front: Vec2, yaw: number, w: number, d: number, color: number) => {
      const at = frame(front, yaw), mid = -w * 0.3, half = w * 0.55 - 0.3, back = -2 * d, n = Math.max(3, Math.round(half * 2));
      props.push({ shape: 'box', size: [half, 0.55, 0.03], pos: at(mid, back - 0.01, 1.75), rot: [0, yaw, 0], color: 0x2a3a48, ...show });
      props.push({ shape: 'box', size: [half + 0.1, 0.06, 0.35], pos: at(mid, back - 0.3, 1.05), rot: [0, yaw, 0], color: 0xffffff, ...show });
      for (let k = 0; k < n; k++) props.push({ shape: 'box', size: [(half + 0.2) / n, 0.04, 0.5], pos: at(mid - half - 0.2 + (2 * (half + 0.2) * (k + 0.5)) / n, back - 0.45, 2.7), rot: alongRot(yaw + P, -0.4), color: k % 2 ? 0xffffff : color, ...show });
    };
    /** A yard wall from the corner of one to the next. */
    const yard = (p: Vec2, q: Vec2) => {
      const long = Math.hypot(q[0] - p[0], q[1] - p[1]), yaw = Math.atan2(q[0] - p[0], q[1] - p[1]), mid: Vec3 = [(p[0] + q[0]) / 2, 1.1, (p[1] + q[1]) / 2];
      props.push({ shape: 'box', size: [0.2, 1.1, long / 2 + 0.2], pos: mid, rot: [0, yaw, 0], color: 0xf2e6cc, mapColor: 0xb0a080 });
      props.push({ shape: 'box', size: [0.28, 0.06, long / 2 + 0.25], pos: [mid[0], 2.26, mid[2]], rot: [0, yaw, 0], color: 0xc87a5a, ghost: true });
    };
    const sphere = (pos: Vec3, size: Vec3, color: number) => props.push({ shape: 'sphere', size, pos, color, ...show });
    const disc = (pos: Vec3, r: number, half: number, color: number, rot?: Vec3) => props.push({ shape: 'cylinder', size: [r, half, 0], pos, rot, color, ...show });

    // The street: brick, and a lighter band across it every few metres.
    for (const [x0, z0, x1, z1] of [[316.2, 235.2, 327.2, 245.5], [327.2, 234.6, 337.2, 266]] as const) {
      props.push({ shape: 'box', size: [(x1 - x0) / 2, 0.012, (z1 - z0) / 2], pos: [(x0 + x1) / 2, 0.012, (z0 + z1) / 2], color: 0xdcae8a, mapColor: 0xdcae8a, ghost: true });
    }
    for (let x = 318; x < 327; x += 2.4) props.push({ shape: 'box', size: [0.1, 0.004, 5.1], pos: [x, 0.026, 240.35], color: 0xeed8c0, ghost: true });
    for (let z = 236.4; z < 266; z += 2.4) props.push({ shape: 'box', size: [5.0, 0.004, 0.1], pos: [332.2, 0.026, z], color: 0xeed8c0, ghost: true });

    // Outside the corner, along the way west. The souvenir shop: two floors, its name across it under the windows
    // upstairs; over its front a stepped gable with a clock in it, a flag on top.
    {
      const front: Vec2 = [320.3, 235.2], at = frame(front, 0), h = 6.0;
      shop(front, 0, 5.7, 2.2, undefined, 0xfff0dc, 0xd23a32, 'flat', 'shop', h);
      signs.push({ pos: at(0, 0.1, 3.15), rotY: 0, kind: 'name', text: '幸福島伴手禮', colors: ['#d23a32', '#ffffff', '#f2c12e'], wide: 5.2 });
      for (const x of [-3.6, -1.2, 1.2, 3.6]) {
        props.push({ shape: 'box', size: [0.45, 0.55, 0.03], pos: at(x, 0.01, 4.6), color: 0x2a3a48, ...show });
        props.push({ shape: 'box', size: [0.55, 0.05, 0.1], pos: at(x, 0.05, 4.02), color: 0xffffff, ...show });
        props.push({ shape: 'box', size: [0.52, 0.1, 0.04], pos: at(x, 0.04, 5.22), color: 0xd23a32, ...show });
      }
      for (const [w, y0, y1] of [[5.4, h + 0.01, h + 0.8], [3.2, h + 0.8, h + 1.6], [1.4, h + 1.6, h + 2.3]] as const) {
        props.push({ shape: 'box', size: [w, (y1 - y0) / 2, 0.1], pos: at(0, 0, (y0 + y1) / 2), color: 0xfff0dc, ...show });
        props.push({ shape: 'box', size: [w + 0.08, 0.06, 0.16], pos: at(0, 0, y1), color: 0xffffff, ...show });
      }
      disc(at(0, 0.12, h + 1.15), 0.62, 0.04, 0xd9a830, [P / 2, 0, 0]);
      disc(at(0, 0.15, h + 1.15), 0.55, 0.03, 0xffffff, [P / 2, 0, 0]);
      props.push({ shape: 'box', size: [0.03, 0.26, 0.02], pos: at(0, 0.19, h + 1.3), color: 0x2a2c30, ...show });
      props.push({ shape: 'box', size: [0.2, 0.03, 0.02], pos: at(0.12, 0.19, h + 1.15), color: 0x2a2c30, ...show });
      bar(props, at(0, 0, h + 2.36), at(0, 0, h + 3.6), 0.04, 0xd9a830, show);
      props.push({ shape: 'box', size: [0.45, 0.28, 0.02], pos: at(0.47, 0, h + 3.3), color: 0xd23a32, ...show });
    }
    // The toy shop, its dome; beside it on the roof a bear as tall as the door, sitting, holding out the shop's name.
    {
      const front: Vec2 = [331.6, 234.6], at = frame(front, 0), h = 4.0, x = 3.4, deck = h + 0.24, fur = 0xc8915a, pale = 0xf4dcc0, eye = 0x2a2420;
      shop(front, 0, 5.6, 2.2, undefined, 0xf8e0ec, 0xb79be8, 'dome', 'shop', h);
      sphere(at(x, -2.0, deck + 0.9), [1.0, 1.05, 0.85], fur);
      sphere(at(x, -1.3, deck + 0.85), [0.6, 0.65, 0.2], pale);
      sphere(at(x, -1.9, deck + 2.35), [0.72, 0.66, 0.66], fur);
      for (const s of [-1, 1]) {
        sphere(at(x + s * 0.52, -2.0, deck + 2.9), [0.26, 0.26, 0.16], fur);
        sphere(at(x + s * 0.25, -1.3, deck + 2.52), [0.07, 0.08, 0.05], eye);
        sphere(at(x + s * 0.6, -1.0, deck + 0.35), [0.38, 0.32, 0.55], fur);
        sphere(at(x + s * 0.95, -1.15, deck + 1.4), [0.28, 0.28, 0.5], fur);
      }
      sphere(at(x, -1.32, deck + 2.22), [0.3, 0.22, 0.2], pale);
      sphere(at(x, -1.13, deck + 2.3), [0.09, 0.07, 0.06], eye);
      signs.push({ pos: at(x, -0.55, deck + 1.35), rotY: 0, kind: 'name', text: '玩偶屋', colors: ['#f28cb0', '#ffffff', '#ffffff'], wide: 2.4 });
    }
    // Round the corner, along the way north. The capsule toys: claw machines out in front, and on the roof a capsule as
    // big as a car, its name across its middle.
    {
      const front: Vec2 = [337.2, 239.9], yaw = -P / 2, at = frame(front, yaw), h = 3.6, y = h + 1.8;
      shop(front, yaw, 4.3, 1.6, undefined, 0xf2f6ff, 0xf6c66a, 'flat', 'counter', h);
      disc(at(0, -1.6, h + 0.4), 0.55, 0.2, 0xffffff);
      sphere(at(0, -1.6, y), [1.35, 1.25, 1.35], 0x7fb8ef);
      sphere(at(0, -1.6, y + 0.55), [1.38, 0.75, 1.38], 0xf2f6ff);
      disc(at(0, -1.6, y), 1.39, 0.06, 0xffffff);
      signs.push({ pos: at(0, -0.12, y), rotY: yaw, kind: 'name', text: '扭蛋屋', colors: ['#ffffff', '#3f7fd0', '#f6c66a'], wide: 2.6 });
      backCounter(front, yaw, 4.3, 1.6, 0xf6c66a);
      (['clawPink', 'clawBlue', 'clawPink'] as const).forEach((kind, k) => { const [x, , z] = at(-1.6 + k * 1.1, 0.75, 0); object(kind, x, z, yaw); });
    }
    // The ride's photographs: on the roof a camera as big as a car, its lens to the street; the name hung out on a board.
    {
      const front: Vec2 = [336.45, 249.0], yaw = -P / 2, at = frame(front, yaw), h = 3.8, y = h + 1.1, rot: Vec3 = [0, yaw, 0], lens = barRot([Math.sin(yaw), 0, Math.cos(yaw)]);
      shop(front, yaw, 4.6, 1.8, undefined, 0xfbf0e0, 0x8fd3c0, 'flat', 'counter', h);
      props.push({ shape: 'box', size: [1.5, 0.8, 0.65], pos: at(0, -1.6, y), rot, color: 0x2a2c30, ...show });
      props.push({ shape: 'box', size: [1.52, 0.18, 0.67], pos: at(0, -1.6, y - 0.35), rot, color: 0x8fd3c0, ...show });
      disc(at(0, -0.75, y), 0.62, 0.3, 0xc8ccd0, lens);
      disc(at(0, -0.43, y), 0.45, 0.05, 0x1f3a5a, lens);
      props.push({ shape: 'box', size: [0.4, 0.22, 0.3], pos: at(-0.85, -1.6, y + 1.0), rot, color: 0x3a3f46, ...show });
      props.push({ shape: 'box', size: [0.32, 0.14, 0.02], pos: at(-0.85, -1.29, y + 1.0), rot, color: 0xfff8d0, ghost: true, glow: true });
      disc(at(0.95, -1.6, y + 0.88), 0.16, 0.08, 0xd23a32);
      blade(front, yaw, 3.9, '咖啡杯紀念照', 3.4, ['#8fd3c0', '#ffffff', '#ffffff']);
      backCounter(front, yaw, 4.6, 1.8, 0x8fd3c0);
    }
    // Ice cream: no board, a cone on the roof, two scoops and a cherry.
    {
      const front: Vec2 = [337.2, 258.0], yaw = -P / 2, at = frame(front, yaw), h = 3.6, base = h + 0.2;
      shop(front, yaw, 3.6, 1.6, undefined, 0xfff4f8, 0xf08ac0, 'flat', 'counter', h);
      props.push({ shape: 'cone', size: [0.95, 1.3, 0], pos: at(0, -1.6, base + 1.3), rot: [P, 0, 0], color: 0xd9a35a, ...show });
      for (const t of [0.4, 0.7]) disc(at(0, -1.6, base + 2.6 * t), 0.95 * t + 0.02, 0.03, 0xb8803a);
      sphere(at(0, -1.6, base + 3.05), [1.02, 0.9, 1.02], 0xf08ac0);
      sphere(at(0, -1.6, base + 3.95), [0.82, 0.74, 0.82], 0xfff4dc);
      sphere(at(0, -1.6, base + 4.78), [0.18, 0.18, 0.18], 0xd23a32);
      for (const a of [0.4, 2.2, 4.1]) sphere([at(0, -1.6, 0)[0] + Math.cos(a) * 0.9, base + 2.72, at(0, -1.6, 0)[2] + Math.sin(a) * 0.9], [0.2, 0.28, 0.2], 0xf08ac0);
      backCounter(front, yaw, 3.6, 1.6, 0xf08ac0);
    }
    // The cups' own shop: on its ridge a teacup on its saucer; its name hung out on a board.
    {
      const front: Vec2 = [335.8, 267.6], yaw = -P / 2, at = frame(front, yaw), h = 4.2, hd = 1.8, top = h + hd * 0.6 + 0.12, y = top + 0.18, rot: Vec3 = [0, yaw, 0];
      shop(front, yaw, 5.2, hd, undefined, 0xfbf0e0, 0xf28cb0, 'pitched', 'shop', h);
      props.push({ shape: 'box', size: [0.7, 0.18, 0.7], pos: at(0, -hd, top), rot, color: 0xffffff, ...show });
      disc(at(0, -hd, y + 0.06), 1.35, 0.06, 0xffffff);
      sphere(at(0, -hd, y + 0.6), [0.95, 0.45, 0.95], 0xf28cb0);
      disc(at(0, -hd, y + 1.0), 0.95, 0.4, 0xf28cb0);
      disc(at(0, -hd, y + 0.85), 0.97, 0.05, 0xd9a830);
      disc(at(0, -hd, y + 1.4), 1.0, 0.05, 0xffffff);
      disc(at(0, -hd, y + 1.46), 0.86, 0.02, 0xb86a3a);
      for (const [x, dy, w, t] of [[1.05, 1.22, 0.22, 0.06], [1.3, 0.98, 0.06, 0.26], [1.05, 0.74, 0.22, 0.06]] as const) props.push({ shape: 'box', size: [w, t, 0.08], pos: at(x, -hd, y + dy), rot, color: 0xf28cb0, ...show });
      blade(front, yaw, -4.6, '茶杯小舖', 2.6, ['#f28cb0', '#ffffff', '#ffffff']);
      backCounter(front, yaw, 5.2, hd, 0xf28cb0);
    }
    yard([337.2, 234.6], [337.2, 235.6]);
    yard([337.2, 244.2], [336.45, 244.4]);
    yard([336.45, 253.6], [337.2, 254.4]);
    yard([337.2, 261.6], [335.8, 262.4]);
    yard([335.8, 272.8], [335.8, 274.2]);
    // In the corner, where the ways meet, the park's signpost in a round bed of flowers: a board pointing each way; the
    // giant plush by it.
    {
      const [x, z] = [333.6, 237.9];
      props.push({ shape: 'cylinder', size: [1.5, 0.3, 0], pos: [x, 0.3, z], color: 0xe8e0d0, mapColor: 0xb0a080 });
      sphere([x, 0.6, z], [1.3, 0.35, 1.3], 0x5a9a42);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * P * 2; sphere([x + Math.cos(a) * 0.85, 0.82, z + Math.sin(a) * 0.85], [0.22, 0.16, 0.22], [0xf08ac0, 0xf2c12e, 0xffffff, 0xe8544a][k % 4]); }
      bar(props, [x, 0.6, z], [x, 4.1, z], 0.08, 0xd9a830, show);
      sphere([x, 4.2, z], [0.16, 0.16, 0.16], 0xd9a830);
      // To the teacups, up the way north; and back to the carousel, down the way the truck came.
      props.push({ shape: 'box', size: [0.04, 0.3, 0.95], pos: [x, 3.3, z + 1.05], color: 0xd23a32, ...show });
      signs.push({ pos: [x - 0.05, 3.3, z + 1.05], rotY: -P / 2, kind: 'name', text: '咖啡杯', colors: ['#d23a32', '#ffffff', '#f2c12e'], wide: 1.8 });
      props.push({ shape: 'box', size: [0.95, 0.3, 0.04], pos: [x - 1.05, 2.6, z], color: 0x3f7fd0, ...show });
      signs.push({ pos: [x - 1.05, 2.6, z + 0.05], rotY: 0, kind: 'name', text: '旋轉木馬', colors: ['#3f7fd0', '#ffffff', '#f2c12e'], wide: 1.8 });
    }

    // On the inside corner the crêpe shop: its front to the way west, a front for drinks to the way north under an awning of
    // its own, a turret on the corner between them.
    {
      const [x, z, hw, hd, h] = [322.3, 245.5, 4.2, 3.6, 3.6];
      shop([x, z], P, hw, hd, '可麗餅', 0xfff0dc, 0xf2a52e, 'flat', 'counter', h, ['#f2a52e', '#ffffff', '#ffffff']);
      const side = x + hw, mid = z + hd + 1.0, half = hd - 1.0, n = Math.round(half * 2);
      props.push({ shape: 'box', size: [half - 0.4, 0.65, 0.03], pos: [side + 0.09, 1.75, mid], rot: [0, P / 2, 0], color: 0x2a3a48, ghost: true });
      props.push({ shape: 'box', size: [half - 0.3, 0.06, 0.35], pos: [side + 0.3, 1.05, mid], rot: [0, P / 2, 0], color: 0xffffff, ghost: true });
      for (let k = 0; k < n; k++) props.push({ shape: 'box', size: [half / n, 0.04, 0.6], pos: [side + 0.55, 2.3, mid + half - (2 * half * (k + 0.5)) / n], rot: alongRot(P / 2, -0.4), color: k % 2 ? 0xffffff : 0x3fb0e0, ghost: true });
      signs.push({ pos: [side + 0.17, 3.09, mid], rotY: P / 2, kind: 'name', text: '飲料', colors: ['#3fb0e0', '#ffffff', '#ffffff'], wide: 2.6 });
      const [tx, tz, r, th] = [325.3, 246.7, 1.5, h + 2.2];
      props.push({ shape: 'cylinder', size: [r, th / 2, 0], pos: [tx, th / 2, tz], color: 0xfff0dc, mapColor: 0xb0a080 });
      disc([tx, 2.5, tz], r + 0.05, 0.07, 0xffffff);
      disc([tx, th, tz], r + 0.1, 0.1, 0xffffff);
      props.push({ shape: 'cone', size: [r + 0.35, 1.2, 0], pos: [tx, th + 1.3, tz], color: 0xf2a52e, ...show });
      sphere([tx, th + 2.55, tz], [0.16, 0.16, 0.16], 0xd9a830);
      bar(props, [tx, th + 2.6, tz], [tx, th + 3.4, tz], 0.03, 0xd9a830, show);
      props.push({ shape: 'box', size: [0.02, 0.2, 0.35], pos: [tx, th + 3.2, tz - 0.37], color: 0xf2a52e, ...show });
      for (const a of [(3 * P) / 4 - 0.6, (3 * P) / 4 + 0.6]) {
        const wx = tx + Math.sin(a) * (r + 0.01), wz = tz + Math.cos(a) * (r + 0.01);
        props.push({ shape: 'box', size: [0.3, 0.45, 0.03], pos: [wx, 4.4, wz], rot: [0, a, 0], color: 0x2a3a48, ...show });
        props.push({ shape: 'box', size: [0.36, 0.05, 0.06], pos: [wx, 3.92, wz], rot: [0, a, 0], color: 0xffffff, ...show });
      }
    }
    // Up the way north: balloons and hats, a straw hat as big as a table on its ridge and a bunch of balloons tied to it.
    {
      const front: Vec2 = [327.2, 258.0], yaw = P / 2, at = frame(front, yaw), h = 3.8, hd = 1.8, top = h + hd * 0.6 + 0.12;
      shop(front, yaw, 4.6, hd, '氣球・帽子', 0xf2f6ff, 0x3f7fd0, 'pitched', 'counter', h, ['#3f7fd0', '#ffffff', '#f2c12e']);
      props.push({ shape: 'box', size: [0.5, 0.15, 0.5], pos: at(2.0, -hd, top), rot: [0, yaw, 0], color: 0xffffff, ...show });
      disc(at(2.0, -hd, top + 0.21), 1.25, 0.06, 0xf2d27a);
      disc(at(2.0, -hd, top + 0.69), 0.72, 0.42, 0xf2d27a);
      disc(at(2.0, -hd, top + 0.42), 0.74, 0.1, 0xd23a32);
      const knot = at(-1.0, -hd, top);
      [0xe8544a, 0xf2c12e, 0x3fb0e0, 0xf08ac0, 0x4fa86a, 0xb79be8, 0xf6a05a].forEach((color, k) => {
        const a = k * 0.9, p: Vec3 = [knot[0] + Math.cos(a) * 0.6, top + 1.7 + (k % 3) * 0.45, knot[2] + Math.sin(a) * 0.6];
        sphere(p, [0.36, 0.44, 0.36], color);
        bar(props, knot, [p[0], p[1] - 0.44, p[2]], 0.012, 0xf2efe6, show);
      });
    }
    // The photo sticker booth, its name in lights.
    {
      const front: Vec2 = [327.6, 265.2], yaw = P / 2, at = frame(front, yaw), y = 2.99;
      shop(front, yaw, 1.6, 1.4, '拍貼機', 0xe8d8f8, 0xb79be8, 'flat', 'counter', 3.4, ['#2a1a3a', '#ff7ad0', '#7fe8ff']);
      for (const s of [-1, 1]) {
        props.push({ shape: 'box', size: [1.42, 0.03, 0.03], pos: at(0, 0.14, y + s * 0.34), rot: [0, yaw, 0], color: 0xff7ad0, ghost: true, glow: true });
        props.push({ shape: 'box', size: [0.03, 0.37, 0.03], pos: at(s * 1.42, 0.14, y), rot: [0, yaw, 0], color: 0x7fe8ff, ghost: true, glow: true });
      }
    }
    yard([326.5, 252.7], [327.2, 253.4]);
    yard([327.2, 262.6], [327.6, 263.6]);
    box(props, 316, 0, 268.2, 327.6, 0.9, 268.5, 0xf2ece0);
    box(props, 327.3, 0, 266.8, 327.6, 0.9, 274.2, 0xf2ece0);

    // Out in front of them, into the way: racks of shirts, the souvenir barrow, a wire shelf of mugs; a board to be
    // photographed in; those looking at the photographs; the ice cream cart; the shop's trolleys; the crêpe shop's tables;
    // balloons; and in the bend, a trolley of boxed cups on its way to the shop.
    object('clothesRack', 316.6, 236.7, 0.1);
    object('souvenirStall', 321.2, 237.3, 0);
    object('wireShelf', 324.6, 236.5, 0);
    object('plushGiant', 335.9, 236.3, -P / 4);
    object('cutout', 331.0, 236.4, 0);
    crowds.push({ area: [334.4, 245.5, 335.6, 252.5], count: 4, y: 0, fenced: true, dance: P / 2, stand: true });
    object('iceCreamCart', 335.6, 257.2, P / 2);
    for (const z of [264.6, 265.6, 266.6]) object('shoppingCart', 334.7, z, P / 2);
    object('wireShelf', 335.0, 270.4, P / 2);
    for (const x of [316.8, 320.2]) {
      object('table', x, 243.3);
      object('umbrella', x, 243.3);
      object('chair', x + 0.9, 243.1, 1.6);
      object('chair', x - 0.9, 243.4, -1.6);
    }
    object('balloonColumn', 328.4, 255.5);
    object('balloonCart', 329.2, 259.6, P / 2);
    object('crateTrolley', 327.8, 242.0, 0.6);
    crowds.push({ area: [316, 237.2, 326, 242.6], count: 6, y: 0 }, { area: [329.2, 250, 334.2, 262], count: 6, y: 0 });
    object('sugarCube', c[0] + OUT_TURN - OUT_WIDE / 2 + 0.9, sz - 3, 0.5);
    // Behind the crêpe shop, its tables out among the tea garden's.
    for (const [x, z] of [[314.6, 249.2], [314.6, 254.4], [319.6, 255.4], [314.8, 259.6], [320.0, 259.8]] as const) {
      if (near(x, z, 1.6)) continue;
      object('table', x, z);
      object('umbrella', x, z);
      object('chair', x + 0.9, z + 0.2, 1.6);
      object('chair', x - 0.9, z - 0.2, -1.6);
    }
    crowds.push({ area: [313.4, 247.5, 317.6, 262], count: 4, y: 0 }, { area: [313.4, 253.4, 322.6, 262], count: 4, y: 0 });
    // Behind those up the way north, the food court's side: tables by their back counters, people at them.
    for (const z of [239, 248, 257, 266]) {
      object('table', 343.4, z);
      object('umbrella', 343.4, z);
      object('chair', 343.4, z + 0.9, 0);
      object('chair', 343.4, z - 0.9, P);
    }
    crowds.push({ area: [341.2, 236, 346, 272], count: 10, y: 0 });
    // Behind those along the way west, their yards: air conditioners on the back walls, boxes, a pallet, bins, a trolley;
    // the drinks machines, a drinking fountain.
    object('acUnit', 317.6, 230.55, P);
    object('acUnit', 333.5, 229.95, P);
    object('pallet', 321.4, 228.4, 0.1);
    object('paperBox', 323.4, 228.6, 0);
    object('paperBox', 324.1, 228.9, 0.4);
    object('paperBox', 323.7, 228.7, 0.2, 0.36);
    for (const x of [316.6, 317.5]) object('bin', x, 229.4);
    object('crateTrolley', 329.6, 228.0, 0.4);
    for (const z of [226.5, 228, 229.5]) object('vending', 337.2, z, P / 2);
    props.push({ shape: 'cylinder', size: [0.3, 0.5, 0], pos: [326.6, 0.5, 229.3], color: 0xc8ccd0 });
    props.push({ shape: 'cylinder', size: [0.36, 0.05, 0], pos: [326.6, 1.03, 229.3], color: 0xe8ecf0, ghost: true });
  }

  // North of the tables, between them and the lake: the tea garden. Tables in rows under pink and white parasols, people
  // at them; the dessert shop and its stalls; a teapot as big as a house, the place's sign; a balustrade along the water.
  {
    for (let x = 230; x < 312; x += 7) for (const z of [256, 263]) {
      if ((x > 282 && x < 298) || near(x, z, 3)) continue;
      object('table', x, z);
      object('umbrella', x, z);
      object('chair', x + 0.9, z + 0.3, 0.8);
      object('chair', x - 0.9, z - 0.2, 3.9);
    }
    crowds.push({ area: [228, 257.5, 312, 266], count: 40, y: 0 });
    teapot(props, 290, 259.5, 0);
    kiosk(props, signs, { at: [223, 261], yaw: P / 2, half: [3.5, 2.6], high: 3.8, wall: 0xf8e8ec, trim: 0xffffff, roof: 'dome', roofColor: 0xf28cb0, name: '下午茶', front: 'counter', awning: [0xf28cb0, 0xffffff] });
    for (const x of [252, 266, 296]) object('dessertStall', x, 266.5, P);
    for (let x = 228; x < 316; x += 2) box(props, x, 0, 268.2, x + 2, 0.9, 268.5, 0xf2ece0);
    for (let x = 230; x < 316; x += 12) if (!near(x, 252.5, 4.5)) object('parkLamp', x, 252.5);
  }

  // South of them, the children's playground: soft floor, a climbing frame with its slide, swings, a sand pit, a little
  // train going round; fenced, its gate on the main street's side; the toilets.
  {
    const x0 = 242, x1 = 334, z0 = 178, z1 = 218;
    for (const [a, b] of [[[x0, z0], [x1, z0]], [[x1, z0], [x1, z1]], [[x0, z1], [x1, z1]], [[x0, z0], [x0, z1 - 6]]] as [Vec2, Vec2][]) {
      const long = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let d = 1; d < long; d += 2) {
        const x = a[0] + ((b[0] - a[0]) * d) / long, z = a[1] + ((b[1] - a[1]) * d) / long;
        props.push({ shape: 'box', size: [0.04, 0.5, 0.04], pos: [x, 0.5, z], color: 0xf2c12e, ghost: true });
      }
      props.push({ shape: 'box', size: [0.03, 0.03, long / 2], pos: [(a[0] + b[0]) / 2, 1.0, (a[1] + b[1]) / 2], rot: [0, Math.atan2(b[0] - a[0], b[1] - a[1]), 0], color: 0x3f7fd0, ghost: true });
    }
    for (const [x, z, c] of [[260, 196, 0xe8544a], [300, 192, 0x3f7fd0]] as const) climbingFrame(props, x, z, c);
    for (const x of [280, 288]) swings(props, x, 206);
    box(props, 312, 0, 184, 326, 0.25, 196, 0xe8d8a8, { ghost: true });
    props.push({ shape: 'cylinder', size: [12, 0.05, 0], pos: [276, 0.05, 210], color: 0x8a7a68, ghost: true });
    crowds.push({ area: [246, 182, 330, 214], count: 46, y: 0, size: 0.6 }, { area: [x0, z0 - 6, x1, z0 - 1], count: 12, y: 0 });
    kiosk(props, signs, { at: [230, 186], yaw: P / 2, half: [4, 3], high: 3.6, wall: 0xe8eef2, trim: 0xffffff, roof: 'flat', roofColor: 0x5a8ab0, name: '洗手間', front: 'toilets' });
    for (let x = 246; x < 334; x += 11) object(x % 2 ? 'tree' : 'treeTall', x, 220);
    playCastle(props, 318, 206);
    // The little train round its ring, stopped at its station: an engine and three carriages, a child at the wheel.
    for (let k = 0; k < 4; k++) {
      const a = 2.2 + k * 0.32, [x, z] = [276 + Math.cos(a) * 11, 210 + Math.sin(a) * 11];
      box(props, x - 0.9, 0.1, z - 1.2, x + 0.9, k ? 1.1 : 1.5, z + 1.2, [0xd23a32, 0x3f7fd0, 0xf2c12e, 0x4fa86a][k], { ghost: true, rot: [0, -a, 0] });
      if (!k) props.push({ shape: 'cylinder', size: [0.25, 0.4, 0], pos: [x, 1.9, z], color: 0x24262a, ghost: true });
    }
    for (const [x, z, c] of [[252, 186, 0xf2c12e], [256, 188, 0xf08ac0], [252, 191, 0x7fd3b8], [270, 184, 0xf6a05a]] as const) {
      bar(props, [x, 0, z], [x, 0.5, z], 0.08, 0x8a8f96, { ghost: true });
      props.push({ shape: 'sphere', size: [0.35, 0.3, 0.55], pos: [x, 0.8, z], color: c, ghost: true });
      props.push({ shape: 'sphere', size: [0.2, 0.2, 0.2], pos: [x, 1.15, z + 0.4], color: c, ghost: true });
    }
    object('balloonCart', 248, 214, 0.4);
    for (const x of [262, 296, 330]) object('bench', x, 179.5, 0);
    // A tower of slides at the far end; trampolines let into the floor; a little roundabout for the smallest; picnic tables
    // with the families at them, pushchairs parked by them.
    slideTower(props, 300, 186);
    for (const [x, z] of [[248, 198], [254, 202], [248, 206]] as const) {
      props.push({ shape: 'cylinder', size: [2.2, 0.06, 0], pos: [x, 0.06, z], color: 0x2a2c30, ghost: true });
      props.push({ shape: 'cylinder', size: [2.3, 0.05, 0], pos: [x, 0.03, z], color: 0x3fb0e0, ghost: true });
    }
    props.push({ shape: 'cylinder', size: [2.6, 0.12, 0], pos: [266, 0.15, 186], color: 0xf2c12e, ghost: true });
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; props.push({ shape: 'box', size: [0.05, 0.5, 1.1], pos: [266 + Math.cos(a) * 1.3, 0.8, 186 + Math.sin(a) * 1.3], rot: [0, -a, 0], color: 0xe8544a, ghost: true }); }
    for (const [x, z] of [[284, 184], [292, 214], [322, 186], [326, 214]] as const) {
      box(props, x - 1.0, 0.7, z - 0.6, x + 1.0, 0.78, z + 0.6, 0x9a6a3a, { ghost: true });
      for (const side of [-1, 1]) box(props, x - 1.0, 0.4, z + side * 1.0 - 0.15, x + 1.0, 0.46, z + side * 1.0 + 0.15, 0x9a6a3a, { ghost: true });
      object('stroller', x + 1.8, z + 0.8, 0.3);
    }
    crowds.push({ area: [282, 182, 294, 216], count: 14, y: 0 }, { area: [320, 182, 330, 216], count: 12, y: 0 });
    // A rope pyramid to climb, its net from a mast; a row of seesaws; the children on them.
    {
      const [x, z] = [304, 207];
      bar(props, [x, 0, z], [x, 6, z], 0.1, 0xd23a32, { ghost: true });
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * P * 2;
        bar(props, [x + Math.cos(a) * 5, 0.05, z + Math.sin(a) * 5], [x, 6, z], 0.035, 0x3a3f46, { ghost: true });
        bar(props, [x + Math.cos(a) * 5, 0.05, z + Math.sin(a) * 5], [x + Math.cos(a + P / 4) * 5, 0.05, z + Math.sin(a + P / 4) * 5], 0.035, 0x3a3f46, { ghost: true });
        for (const t of [0.33, 0.66]) bar(props, [x + Math.cos(a) * 5 * (1 - t), 6 * t, z + Math.sin(a) * 5 * (1 - t)], [x + Math.cos(a + P / 4) * 5 * (1 - t), 6 * t, z + Math.sin(a + P / 4) * 5 * (1 - t)], 0.03, 0x3a3f46, { ghost: true });
      }
      crowds.push({ area: [x - 2.5, z - 2.5, x + 2.5, z + 2.5], count: 6, y: 0, size: 0.6 });
    }
    for (let k = 0; k < 3; k++) {
      const x = 252 + k * 4, z = 212.5;
      props.push({ shape: 'box', size: [0.2, 0.25, 0.3], pos: [x, 0.25, z], color: 0x3f7fd0, ghost: true });
      props.push({ shape: 'box', size: [0.12, 0.04, 1.7], pos: [x, 0.5, z], rot: [0.25 * (k % 2 ? 1 : -1), 0, 0], color: [0xf2c12e, 0xe8544a, 0x4fa86a][k], ghost: true });
    }
  }

  // West of it all, the food court: stalls round three sides of a square of tables under parasols; the park's wall behind.
  {
    const x0 = 344, x1 = 410, z0 = 182, z1 = 260;
    const STALLS: [string, number][] = [['滷味', 0xd23a32], ['雞排', 0xf2a52e], ['珍珠奶茶', 0x8a5a3a], ['烤玉米', 0xf2c12e], ['章魚燒', 0xe8544a], ['刨冰', 0x3fb0e0], ['熱狗堡', 0xd23a32], ['咖哩飯', 0xd9a830]];
    STALLS.forEach(([name, color], k) => {
      const z = z0 + 6 + k * 9.4;
      kiosk(props, signs, { at: [x1 - 4, z], yaw: -P / 2, half: [4, 3], high: 3.6, wall: 0xfff4e4, trim: 0xffffff, roof: 'flat', roofColor: color, name, front: 'counter', awning: [color, 0xffffff] });
    });
    for (let x = x0 + 6; x < x1 - 12; x += 7) for (let z = z0 + 6; z < z1 - 4; z += 8) {
      object('table', x, z);
      object('umbrella', x, z);
      object('chair', x + 0.9, z, 1.6);
      object('chair', x - 0.9, z, -1.6);
    }
    crowds.push({ area: [x0 + 2, z0 + 2, x1 - 9, z1 - 2], count: 80, y: 0 });
    planter(props, x0 - 6, z0 - 4, x0 - 5, 235.4, 0.8);
    // Across its north end, more stalls, their counters to the south; queues at them.
    const NORTH: [string, number][] = [['牛肉麵', 0xb8402e], ['鹹酥雞', 0xd9a62e], ['車輪餅', 0x8a5a3a], ['烤香腸', 0xd23a32], ['豆花', 0x3fa88a]];
    NORTH.forEach(([name, color], k) => {
      const x = x0 + 8 + k * 11;
      kiosk(props, signs, { at: [x, 267.5], yaw: P, half: [4.4, 2.8], high: 3.6, wall: 0xfff4e4, trim: 0xffffff, roof: 'pitched', roofColor: color, name, front: 'counter', awning: [color, 0xffffff] });
      crowds.push({ area: [x - 2, 261, x + 2, 263.6], count: 6, y: 0 });
    });
    // Two pavilions over the tables in its middle, roofed against sun and rain: steel posts, a roof of slats.
    for (const [za, zb] of [[194, 214], [226, 246]]) {
      for (let x = x0 + 9.5; x <= x1 - 15; x += 10.5) for (const z of [za, zb]) props.push({ shape: 'cylinder', size: [0.14, 2.0, 0], pos: [x, 2.0, z], color: 0xf2efe6, ghost: true });
      box(props, x0 + 8.5, 4.0, za - 1, x1 - 14, 4.15, zb + 1, 0x3fa88a, { ghost: true, fade: true, overhead: true });
      for (let x = x0 + 9; x < x1 - 14; x += 3) box(props, x, 4.15, za - 1, x + 1.2, 4.3, zb + 1, 0xf2efe6, { ghost: true, fade: true, overhead: true });
    }
    // Along its east side, inside the planter as far as the shops: the bins for what is left, sorted; a fountain of drinking water; trees.
    for (let z = z0 + 10; z < 234; z += 16) {
      for (const [dz, c] of [[-0.7, 0x3f7fd0], [0, 0x4fa86a], [0.7, 0xf2c12e]] as const) box(props, x0 - 3.9, 0, z + dz - 0.3, x0 - 3.3, 1.0, z + dz + 0.3, c);
      object(z % 32 < 16 ? 'tree' : 'palm', x0 - 2.6, z + 8);
    }
    for (const z of [z0 + 34]) props.push({ shape: 'cylinder', size: [0.3, 0.5, 0], pos: [x0 - 3.6, 0.5, z], color: 0xc8ccd0 });
  }

  // In the strips between the tables and the playground's fence, where the parents leave them: the pushchairs, parked in rows.
  for (const [xa, xb] of [[226, 240], [318, 331]]) {
    for (let x = xa; x < xb; x += 1.1) for (const z of [222.5, 225.2]) if ((x * 7 + z) % 5 > 1) object('stroller', x, z, P);
    signs.push({ pos: [xa - 1, 1.6, 223.8], rotY: -P / 2, kind: 'name', text: '嬰兒車停放區', colors: ['#3f7fd0', '#ffffff', '#f2efe6'], wide: 2.8 });
    bar(props, [xa - 1, 0, 223.8], [xa - 1, 1.3, 223.8], 0.04, 0x8a8f96, { ghost: true });
  }
}

/** Which of the watchers' places this is, for their number. */
const j0 = (b: number) => Math.round(Math.abs(b) * 10);

/**
 * The ride's own low wall from one place to another, where a planter was, as wide, as high and as solid: cream, a pink
 * panel let into each face, a white coping edged in gold; over it a white rail on gold posts, a post at each end (`first`: at its start only,
 * where the next piece puts one at its own).
 */
function rideWall(props: PropDesc[], a: Vec2, b: Vec2, first = false): void {
  const long = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, rot: Vec3 = [0, yaw, 0], ox = Math.cos(yaw), oz = -Math.sin(yaw);
  props.push({ shape: 'box', size: [0.45, 0.4, long / 2], pos: [mx, 0.4, mz], rot, color: 0xfbf0e0, mapColor: 0xe8d8c0 });
  props.push({ shape: 'box', size: [0.5, 0.04, long / 2 + 0.02], pos: [mx, 0.84, mz], rot, color: 0xfffaf2, ghost: true });
  for (const s of [-1, 1]) props.push({ shape: 'box', size: [0.02, 0.025, long / 2 + 0.02], pos: [mx + ox * s * 0.5, 0.82, mz + oz * s * 0.5], rot, color: 0xd9a830, ghost: true });
  if (long > 1.2) for (const s of [-1, 1]) props.push({ shape: 'box', size: [0.012, 0.2, long / 2 - 0.3], pos: [mx + ox * s * 0.456, 0.42, mz + oz * s * 0.456], rot, color: 0xf6b8cc, ghost: true });
  const n = first ? 1 : Math.max(1, Math.round(long / 2.1));
  for (let k = 0; k < (first ? 1 : n + 1); k++) {
    const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
    bar(props, [x, 0.88, z], [x, 1.46, z], 0.045, 0xd9a830, { ghost: true });
    props.push({ shape: 'sphere', size: [0.07, 0.07, 0.07], pos: [x, 1.5, z], color: 0xd9a830, ghost: true });
  }
  props.push({ shape: 'box', size: [0.05, 0.035, long / 2], pos: [mx, 1.42, mz], rot, color: 0xffffff, ghost: true });
  props.push({ shape: 'box', size: [0.025, 0.025, long / 2], pos: [mx, 1.15, mz], rot, color: 0xffffff, ghost: true });
}

/**
 * A teapot as big as a house: white, gold bands round its foot, its middle and its shoulder, painted with roses and their
 * leaves; its spout curving up out of one side, steam from it; its handle a loop on the other; its lid and knob. Solid.
 * `yaw`: the way its spout points.
 */
function teapot(props: PropDesc[], x: number, z: number, yaw: number): void {
  const fx = Math.cos(yaw), fz = -Math.sin(yaw);
  const at = (out: number, y: number): Vec3 => [x + fx * out, y, z + fz * out];
  props.push({ shape: 'cylinder', size: [2.9, 0.22, 0], pos: [x, 0.22, z], color: 0xd9a830 });
  props.push({ shape: 'sphere', size: [4.2, 3.4, 4.2], pos: [x, 3.0, z], color: 0xfbf7f2, mapColor: 0xf2e6e0 });
  props.push({ shape: 'cylinder', size: [4.24, 0.12, 0], pos: [x, 3.0, z], color: 0xd9a830, ghost: true });
  props.push({ shape: 'cylinder', size: [2.8, 0.1, 0], pos: [x, 5.6, z], color: 0xf28cb0, ghost: true });
  props.push({ shape: 'cylinder', size: [2.6, 0.3, 0], pos: [x, 6.3, z], color: 0xf28cb0, ghost: true });
  props.push({ shape: 'cylinder', size: [2.66, 0.05, 0], pos: [x, 6.62, z], color: 0xd9a830, ghost: true });
  props.push({ shape: 'sphere', size: [2.4, 1.0, 2.4], pos: [x, 6.6, z], color: 0xfbf7f2, ghost: true });
  props.push({ shape: 'cylinder', size: [0.3, 0.2, 0], pos: [x, 7.6, z], color: 0xd9a830, ghost: true });
  props.push({ shape: 'sphere', size: [0.5, 0.5, 0.5], pos: [x, 8.0, z], color: 0xd9a830, ghost: true });
  // The spout: from low on its side out and up, narrowing, a lip at its end; steam over it.
  const spout = (t: number): Vec3 => at(3.2 + 3.0 * t, 2.0 + 3.8 * Math.pow(t, 1.5));
  for (let k = 0; k < 8; k++) {
    const r = 0.8 - (k / 8) * 0.45;
    bar(props, spout(k / 8), spout((k + 1) / 8), r, 0xfbf7f2, { ghost: true });
    props.push({ shape: 'sphere', size: [r, r, r], pos: spout((k + 1) / 8), color: 0xfbf7f2, ghost: true });
  }
  props.push({ shape: 'cylinder', size: [0.42, 0.08, 0], pos: spout(1), rot: [0, 0, 0], color: 0xd9a830, ghost: true });
  for (let k = 0; k < 4; k++) {
    const [sx2, sy, sz2] = spout(1);
    props.push({ shape: 'sphere', size: [0.35 + k * 0.12, 0.3 + k * 0.1, 0.35 + k * 0.12], pos: [sx2 + fx * k * 0.25, sy + 0.8 + k * 0.75, sz2 + fz * k * 0.25 + Math.sin(k * 2.1) * 0.3], color: 0xffffff, ghost: true });
  }
  // The handle: a loop out from the other side, from its shoulder down to below its middle.
  for (let k = 0; k < 10; k++) {
    const f0 = -P / 2 + (k / 10) * P, f1 = -P / 2 + ((k + 1) / 10) * P;
    const p = (f: number): Vec3 => at(-(3.5 + 1.9 * Math.cos(f)), 3.4 + 2.0 * Math.sin(f));
    bar(props, p(f0), p(f1), 0.38, 0xfbf7f2, { ghost: true });
    props.push({ shape: 'sphere', size: [0.38, 0.38, 0.38], pos: p(f1), color: 0xfbf7f2, ghost: true });
  }
  // Roses round it, pink and red, each with two leaves.
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * P * 2 + 0.3, y = 3.4 + (k % 2 ? 1.0 : -0.6), r = 4.2 * Math.sqrt(1 - ((y - 3.0) / 3.4) ** 2) + 0.02;
    if (Math.abs(Math.atan2(Math.sin(a + yaw), Math.cos(a + yaw))) < 0.5 || Math.abs(Math.atan2(Math.sin(a + yaw - P), Math.cos(a + yaw - P))) < 0.5) continue;
    const [cx, cz] = [x + Math.cos(a) * r, z + Math.sin(a) * r];
    props.push({ shape: 'sphere', size: [0.55, 0.5, 0.14], pos: [cx, y, cz], rot: [0, -a + P / 2, 0], color: k % 2 ? 0xd8405a : 0xf28cb0, ghost: true });
    props.push({ shape: 'sphere', size: [0.28, 0.26, 0.16], pos: [cx + Math.cos(a) * 0.04, y + 0.04, cz + Math.sin(a) * 0.04], rot: [0, -a + P / 2, 0], color: k % 2 ? 0xa82a40 : 0xe8607a, ghost: true });
    for (const side of [-1, 1]) {
      const b = a + side * 0.17;
      props.push({ shape: 'sphere', size: [0.42, 0.18, 0.1], pos: [x + Math.cos(b) * (r - 0.05), y - 0.35, z + Math.sin(b) * (r - 0.05)], rot: [0, -b + P / 2, side * 0.5], color: 0x5a9a4a, ghost: true });
    }
  }
}

/** A tower of slides: a square deck up on posts under a pointed roof, a straight slide and a curling one down from it, a ladder. */
function slideTower(props: PropDesc[], x: number, z: number): void {
  for (const [dx, dz] of [[-1.45, -1.45], [1.45, -1.45], [-1.45, 1.45], [1.45, 1.45]]) props.push({ shape: 'box', size: [0.1, 2.4, 0.1], pos: [x + dx, 2.4, z + dz], color: 0x3fb0e0, ghost: true });
  box(props, x - 1.6, 3.0, z - 1.6, x + 1.6, 3.2, z + 1.6, 0xf2c12e, { ghost: true });
  props.push({ shape: 'cone', size: [2.4, 1.2, 0], pos: [x, 5.9, z], color: 0xe8544a, ghost: true });
  props.push({ shape: 'box', size: [0.55, 0.05, 3.3], pos: [x + 3.6, 1.6, z], rot: [0.5, Math.PI / 2, 0], color: 0xf2c12e, ghost: true });
  for (let k = 0; k < 8; k++) {
    const a = k * 0.6, r = 2.6;
    props.push({ shape: 'box', size: [0.5, 0.05, 0.6], pos: [x + Math.cos(a) * r, 3.0 - k * 0.36, z + Math.sin(a) * r - 4], rot: [0, -a, 0.2], color: 0xf08ac0, ghost: true });
  }
  props.push({ shape: 'box', size: [0.4, 0.04, 1.6], pos: [x - 2.4, 1.6, z], rot: [-1.05, Math.PI / 2, 0], color: 0xd9d9d9, ghost: true });
}

/** A playhouse castle for small children: pink walls, a tower each corner with a pointed roof, a slide out of its side. */
function playCastle(props: PropDesc[], x: number, z: number): void {
  box(props, x - 3, 0, z - 3, x + 3, 2.6, z + 3, 0xf8d8e4, { ghost: true });
  for (let k = -2; k <= 2; k += 2) for (const side of [-1, 1]) box(props, x + k - 0.4, 2.6, z + side * 3 - 0.2, x + k + 0.4, 3.1, z + side * 3 + 0.2, 0xf8d8e4, { ghost: true });
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    props.push({ shape: 'cylinder', size: [0.9, 1.8, 0], pos: [x + dx, 1.8, z + dz], color: 0xf2c8d8, ghost: true });
    props.push({ shape: 'cone', size: [1.1, 1.0, 0], pos: [x + dx, 4.6, z + dz], color: 0x8a5ac8, ghost: true });
  }
  box(props, x - 0.7, 0, z - 3.04, x + 0.7, 1.6, z - 3.0, 0x5a3e28, { ghost: true });
  props.push({ shape: 'box', size: [0.5, 0.05, 1.8], pos: [x + 4.4, 1.0, z], rot: [0.55, Math.PI / 2, 0], color: 0x3fb0e0, ghost: true });
}

/** A climbing frame: a deck on four posts, a roof over it, a ladder up and a slide down. */
function climbingFrame(props: PropDesc[], x: number, z: number, color: number): void {
  for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) props.push({ shape: 'box', size: [0.08, 1.6, 0.08], pos: [x + dx, 1.6, z + dz], color: 0xf2c12e, ghost: true });
  box(props, x - 1.6, 1.4, z - 1.6, x + 1.6, 1.55, z + 1.6, color, { ghost: true });
  props.push({ shape: 'cone', size: [2.4, 0.8, 0], pos: [x, 3.8, z], color, ghost: true });
  props.push({ shape: 'box', size: [0.5, 0.05, 1.8], pos: [x + 2.6, 0.75, z], rot: [0.5, Math.PI / 2, 0], color: 0x3fb0e0, ghost: true });
  props.push({ shape: 'box', size: [0.4, 0.04, 1.0], pos: [x - 2.1, 0.75, z], rot: [-1.0, Math.PI / 2, 0], color: 0xd9d9d9, ghost: true });
}

/** A set of swings: an A-frame each end, a bar across, two seats hanging. */
function swings(props: PropDesc[], x: number, z: number): void {
  for (const dx of [-2, 2]) for (const dz of [-0.8, 0.8]) props.push({ shape: 'box', size: [0.05, 1.3, 0.05], pos: [x + dx, 1.25, z + dz * 0.6], rot: [dz * 0.35, 0, 0], color: 0xe8544a, ghost: true });
  props.push({ shape: 'cylinder', size: [0.06, 2.1, 0], pos: [x, 2.5, z], rot: [0, 0, Math.PI / 2], color: 0xe8544a, ghost: true });
  for (const dx of [-0.9, 0.9]) {
    props.push({ shape: 'box', size: [0.01, 0.9, 0.01], pos: [x + dx, 1.6, z], color: 0x8a8f96, ghost: true });
    box(props, x + dx - 0.25, 0.6, z - 0.12, x + dx + 0.25, 0.66, z + 0.12, 0xf2c12e, { ghost: true });
  }
}

/** A pole striped pink and white as a stick of rock, a gold ball on it. */
function candyPole(props: PropDesc[], x: number, z: number, high: number): void {
  props.push({ shape: 'cylinder', size: [0.34, 0.2, 0], pos: [x, 0.2, z], color: 0xd9a830 });
  bar(props, [x, 0.4, z], [x, high, z], 0.13, 0xfbf7f2);
  for (let y = 0.7; y < high - 0.2; y += 0.8) props.push({ shape: 'cylinder', size: [0.14, 0.2, 0], pos: [x, y, z], color: 0xf28cb0, ghost: true });
  props.push({ shape: 'sphere', size: [0.26, 0.26, 0.26], pos: [x, high + 0.2, z], color: 0xd9a830, ghost: true });
}

/** Lamps on a string from one high place to another, sagging between: every other one pink. */
function festoon(props: PropDesc[], a: Vec3, b: Vec3): void {
  const long = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(4, Math.round(long / 1.5)), sag = Math.min(1.5, long * 0.06);
  const at = (t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
  const over = { ghost: true, fade: true, overhead: true };
  for (let k = 0; k < n; k++) {
    bar(props, at(k / n), at((k + 1) / n), 0.015, 0x3a3f44, over);
    if (k) props.push({ shape: 'sphere', size: [0.13, 0.15, 0.13], pos: [at(k / n)[0], at(k / n)[1] - 0.16, at(k / n)[2]], color: k % 2 ? 0xfff2b0 : 0xf9a8c8, glow: true, ...over });
  }
}

/** Teacups as big as carts, three stacked on their saucers, none quite straight on the one under it. */
function cupStack(props: PropDesc[], x: number, z: number, seed: number): void {
  let y = 0;
  for (let k = 0; k < 3; k++) {
    const r = 1.9 - k * 0.35, h = 0.55 - k * 0.07, dx = Math.sin(seed * 2.3 + k * 1.9) * 0.3 * k, dz = Math.cos(seed * 1.7 + k * 2.3) * 0.3 * k;
    const color = CUP_TONES[(seed + k * 2) % CUP_TONES.length], [cx, cz] = [x + dx, z + dz];
    // Its saucer, gold-rimmed; the cup's rounded foot; its sides; its lip; its handle; dots round it.
    props.push({ shape: 'cylinder', size: [r + 0.55, 0.07, 0], pos: [cx, y + 0.07, cz], color: 0xf7f4ee, ghost: k > 0 });
    props.push({ shape: 'cylinder', size: [r + 0.6, 0.02, 0], pos: [cx, y + 0.13, cz], color: 0xd9a830, ghost: true });
    props.push({ shape: 'sphere', size: [r * 0.92, 0.34, r * 0.92], pos: [cx, y + 0.42, cz], color, ghost: true });
    props.push({ shape: 'cylinder', size: [r, h, 0], pos: [cx, y + 0.42 + h, cz], color, ghost: k > 0 });
    props.push({ shape: 'cylinder', size: [r + 0.07, 0.05, 0], pos: [cx, y + 0.42 + 2 * h, cz], color: 0xffffff, ghost: true });
    handle(props, [cx, y + 0.42 + h, cz], r, seed + k * 1.3, 0.3 + h * 0.4, color);
    for (let d = 0; d < 6; d++) {
      const b = (d / 6) * P * 2 + k;
      props.push({ shape: 'sphere', size: [0.18, 0.18, 0.05], pos: [cx + Math.cos(b) * (r + 0.01), y + 0.42 + h, cz + Math.sin(b) * (r + 0.01)], rot: [0, -b + P / 2, 0], color: 0xffffff, ghost: true });
    }
    y += 0.42 + 2 * h + 0.05;
    if (k === 2) props.push({ shape: 'cylinder', size: [r - 0.08, 0.02, 0], pos: [cx, y - 0.14, cz], color: 0x8a5a3a, ghost: true });
  }
  // A spoon stood in the top one.
  bar(props, [x + 0.2, y - 0.6, z + 0.1], [x + 1.0, y + 1.5, z + 0.5], 0.06, 0xd8dce0, { ghost: true });
  props.push({ shape: 'sphere', size: [0.3, 0.1, 0.4], pos: [x + 1.05, y + 1.65, z + 0.52], color: 0xd8dce0, ghost: true });
}

const CUP_TONES = [0xf2a7bf, 0x8fd3c0, 0xf6c66a, 0xb9a4e0, 0xf28c7a];

/** A cup's handle: a loop out from its side at `at` (its middle), facing `a` radians round, so high, in pieces. */
function handle(props: PropDesc[], at: Vec3, r: number, a: number, high: number, color: number): void {
  const hx = Math.cos(a), hz = Math.sin(a), n = 7;
  for (let j = 0; j <= n; j++) {
    const f = -P / 2 + (j / n) * P, out = r + 0.05 + high * 0.9 * Math.cos(f);
    props.push({ shape: 'box', size: [0.09 + high * 0.1, high * 0.3, 0.1 + high * 0.08], pos: [at[0] + hx * out, at[1] + high * Math.sin(f), at[2] + hz * out], rot: [0, -a, f], color, ghost: true });
  }
}

/** A cup as big as a cart, knocked over on its side on its saucer, its tea run out across the ground. */
function tippedCup(props: PropDesc[], x: number, z: number, yaw: number): void {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), r = 1.7, half = 1.15, color = 0xb9a4e0;
  props.push({ shape: 'cylinder', size: [r + 0.7, 0.08, 0], pos: [x - fx * 0.6, 0.08, z - fz * 0.6], color: 0xf7f4ee });
  props.push({ shape: 'cylinder', size: [r + 0.75, 0.03, 0], pos: [x - fx * 0.6, 0.17, z - fz * 0.6], color: 0xd9a830, ghost: true });
  // On its side: its axis along the way it faces, its mouth that way, its foot the other.
  props.push({ shape: 'cylinder', size: [r, half, 0], pos: [x, r + 0.1, z], rot: [P / 2, yaw, 0], color });
  props.push({ shape: 'sphere', size: [r * 0.92, r * 0.92, 0.4], pos: [x - fx * half, r + 0.1, z - fz * half], rot: [0, yaw, 0], color, ghost: true });
  props.push({ shape: 'cylinder', size: [r + 0.07, 0.06, 0], pos: [x + fx * half, r + 0.1, z + fz * half], rot: [P / 2, yaw, 0], color: 0xffffff, ghost: true });
  props.push({ shape: 'cylinder', size: [r - 0.12, 0.02, 0], pos: [x + fx * (half + 0.03), r + 0.1, z + fz * (half + 0.03)], rot: [P / 2, yaw, 0], color: 0x5a3a24, ghost: true });
  for (let d = 0; d < 6; d++) {
    const b = (d / 6) * P * 2;
    const [ux, uy] = [Math.cos(b), Math.sin(b)];
    props.push({ shape: 'sphere', size: [0.18, 0.18, 0.18], pos: [x + Math.cos(yaw) * ux * (r + 0.01), r + 0.1 + uy * (r + 0.01), z - Math.sin(yaw) * ux * (r + 0.01)], color: 0xffffff, ghost: true });
  }
  // Its handle up in the air; the tea out of it in a pool, a sugar lump in it.
  handle(props, [x, 2 * r + 0.1, z], 0.02, P / 2 + 0.0001, 0.55, color);
  props.push({ shape: 'cylinder', size: [2.4, 0.012, 0], pos: [x + fx * (half + 2.0), 0.014, z + fz * (half + 2.0)], color: 0x8a5a3a, ghost: true });
  props.push({ shape: 'cylinder', size: [1.3, 0.012, 0], pos: [x + fx * (half + 3.6) + fz * 1.2, 0.016, z + fz * (half + 3.6) - fx * 1.2], color: 0x8a5a3a, ghost: true });
  props.push({ shape: 'box', size: [0.4, 0.4, 0.4], pos: [x + fx * (half + 2.6) - fz * 0.8, 0.4, z + fz * (half + 2.6) + fx * 0.8], rot: [0, 0.6, 0], color: 0xfbfaf4, ghost: true });
}

/** A cake in three tiers on its stand: icing run down each, cherries round them, candles on top, lit. */
function cake(props: PropDesc[], x: number, z: number): void {
  props.push({ shape: 'cylinder', size: [0.5, 0.35, 0], pos: [x, 0.35, z], color: 0xd9a830 });
  props.push({ shape: 'cylinder', size: [3.0, 0.08, 0], pos: [x, 0.78, z], color: 0xf7f4ee });
  let y = 0.86;
  for (const [k, [r, h, color]] of ([[2.5, 0.7, 0xf6d2a0], [1.8, 0.6, 0xf2a7bf], [1.1, 0.55, 0xfbf7f2]] as const).entries()) {
    props.push({ shape: 'cylinder', size: [r, h, 0], pos: [x, y + h, z], color, ghost: k > 0 });
    props.push({ shape: 'cylinder', size: [r + 0.05, 0.1, 0], pos: [x, y + 2 * h - 0.06, z], color: 0xffffff, ghost: true });
    const n = Math.round(r * 5);
    for (let j = 0; j < n; j++) {
      const a = (j / n) * P * 2 + k;
      props.push({ shape: 'sphere', size: [0.2, 0.3 + (j % 3) * 0.12, 0.08], pos: [x + Math.cos(a) * (r + 0.03), y + 2 * h - 0.3, z + Math.sin(a) * (r + 0.03)], rot: [0, -a + P / 2, 0], color: 0xffffff, ghost: true });
      if (j % 2) props.push({ shape: 'sphere', size: [0.16, 0.16, 0.16], pos: [x + Math.cos(a) * (r - 0.3), y + 2 * h + 0.14, z + Math.sin(a) * (r - 0.3)], color: 0xd23a32, ghost: true });
    }
    y += 2 * h;
  }
  for (let j = 0; j < 5; j++) {
    const a = (j / 5) * P * 2;
    bar(props, [x + Math.cos(a) * 0.6, y, z + Math.sin(a) * 0.6], [x + Math.cos(a) * 0.6, y + 0.7, z + Math.sin(a) * 0.6], 0.05, [0x3f7fd0, 0xf2c12e, 0x4fa86a][j % 3], { ghost: true });
    props.push({ shape: 'sphere', size: [0.08, 0.14, 0.08], pos: [x + Math.cos(a) * 0.6, y + 0.84, z + Math.sin(a) * 0.6], color: 0xffc040, ghost: true, glow: true });
  }
}
