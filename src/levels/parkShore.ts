import { alongRot, bar, box, kiosk, put, type ParkSite } from './parkParts';
import { LANE_N, POOL, RIDE_END, SHORE, SHORE_Z, WAVE_HOUSE } from './parkPlan';
import type { Look } from './relief';
import type { Vec3 } from '../config';
import type { PropDesc, SignDesc, Vec2 } from './types';

// 4. The north shore, east along the lake from the foot of the coaster's last ramp to the wave pool. First the midway,
// the calm part, its game booths either side and their games out in the way; then the bumper cars across the whole way,
// in at one gap in their rail and out at another, on their steel floor that will not hold a truck coming fast round to
// the way out, the cars going round among it; then something every fifteen metres or so has the way narrowed, from one
// side or the other: a bed of flowers, the ferris wheel's queue, a food truck, carts; the lake's railing all along the
// other hand, and the lake beyond it.

const P = Math.PI;
const PROMENADE: Look = { tag: 'paving', color: 0xd8c8a8, wall: 0x9a8e7a };
/** The way along, its lake side and its far side: the railing along the water, the edge of the paving to the north. */
const RAIL_Z = SHORE_Z - 9.6;
const FAR_Z = SHORE_Z + 8;
/** The bumper cars' floor, across the way, inside its rail; the gaps in its rail, in from the midway on the lake side and out
 * on the far side, out of line; the operator's island in the middle, in the line between them. */
export const ARENA = { x0: 211, x1: 242, z0: RAIL_Z + 1.4, z1: FAR_Z + 8 };
const IN: Vec2 = [SHORE_Z - 2.5, SHORE_Z + 3.5], OUT: Vec2 = [SHORE_Z + 8, SHORE_Z + 14];
// Toward the way in, square in the line from the one gap to the other: past it on the lake side, the way out comes up
// hard on the far side. Its booth, a flower box each end.
export const ISLAND = { x: ARENA.x1 - 11, z: (ARENA.z0 + ARENA.z1) / 2, hx: 4, hz: 2.6 };

export const SHORE_ROUTE: Vec2[] = [
  [RIDE_END.x - 4, SHORE_Z], [264, SHORE_Z + 2.8], [255.5, SHORE_Z - 0.4], [248, SHORE_Z + 1.5], [248, SHORE_Z + 1.5], [243, SHORE_Z], [235, SHORE_Z - 0.7], [227, SHORE_Z - 0.4], [220, SHORE_Z + 3], [214, SHORE_Z + 8.5], [209, SHORE_Z + 10.6], [204, SHORE_Z + 8], [201, SHORE_Z + 6.9], [195, SHORE_Z + 4], [189, SHORE_Z + 2.4], [180, SHORE_Z],
];

export function northShore(s: ParkSite): void {
  const { props, signs, crowds, relief } = s;
  const object = (kind: Parameters<typeof put>[1], x: number, z: number, rotY = 0, y = 0) => put(s, kind, x, z, rotY, y);
  relief.area([[SHORE.x0 - 4, RAIL_Z - 1.2], [300, RAIL_Z - 1.2], [300, 463], [SHORE.x0 - 4, 463]], 0, PROMENADE);

  // The lake's railing: white, waist high, in lengths; lamps along it, a bench now and then looking out over the water.
  for (let x = SHORE.x0 + 1; x < 299; x += 2) object('handrail', x, RAIL_Z, P / 2);
  // None along the midway and the bumper cars: the booths are backed on to the railing there, and the cars' rail is by it.
  const midway = (x: number) => x > ARENA.x0 - 2 && x < 269;
  for (let x = SHORE.x0 + 6; x < 296; x += 15) if (!midway(x)) object('parkLamp', x, RAIL_Z + 1.2);
  for (const x of [204, 278]) object('bench', x, RAIL_Z + 1.4, P);
  crowds.push({ area: [SHORE.x0 + 4, RAIL_Z + 0.6, ARENA.x0 - 1.5, RAIL_Z + 2.2], count: 12, y: 0 }, { area: [269, RAIL_Z + 0.6, 296, RAIL_Z + 2.2], count: 8, y: 0 });

  // From the coaster's way down: its exit, lockers, trees; a sign to the ride.
  for (const [x, z] of [[292, FAR_Z + 26], [282, FAR_Z + 34], [290, 450], [280, 458]] as const) object(z % 2 ? 'treeTall' : 'tree', x, z);
  box(props, 292, 0, FAR_Z + 38, 299, 2.2, FAR_Z + 40, 0x5a8ab0, { mapColor: 0x5a6a7a });
  // Where the riders come off, as every big ride has it: its shop, its shirts and toys out in front on the way; the screen
  // with the photographs of the drop on it, people pointing at themselves; the lockers by the railing for what was left.
  kiosk(props, signs, { at: [283, FAR_Z + 10], yaw: P, half: [9, 4], high: 4.4, wall: 0xc8925e, trim: 0x6a4a30, roof: 'pitched', roofColor: 0x8a4a2a, name: '旋風飛車 紀念品', front: 'shop', nameColors: ['#5a3e28', '#f2c12e', '#2a2420'], awning: [0xd23a32, 0xf2e6cc] });
  {
    const front = FAR_Z + 6, ridge = 4.4 + 4 * 0.6 + 0.04, zc = FAR_Z + 10;
    // In its windows the ride's shirts, spread out, the coaster on each.
    for (const wx of [283 - 4.95, 283 + 4.95]) for (let k = 0; k < 4; k++) {
      const x = wx - 1.95 + k * 1.3, c = [0xd23a32, 0xf2c12e, 0x3f7fd0, 0x2a2c30][k], z = front - 0.065;
      box(props, x - 0.26, 0.98, z - 0.006, x + 0.26, 1.62, z + 0.006, c, { ghost: true });
      box(props, x - 0.44, 1.48, z - 0.006, x + 0.44, 1.68, z + 0.006, c, { ghost: true });
      box(props, x - 0.12, 1.24, z - 0.014, x + 0.12, 1.4, z - 0.007, k === 1 ? 0xd23a32 : 0xf2c12e, { ghost: true });
    }
    // Banners down from arms at its front corners, the ride's name on them, to be read coming down off the ramp.
    for (const x of [274.4, 291.6]) {
      bar(props, [x, 0, front - 0.3], [x, 6.4, front - 0.3], 0.06, 0x6a4a30, { ghost: true });
      bar(props, [x, 6.1, front - 0.3], [x, 6.1, front - 1.3], 0.03, 0x6a4a30, { ghost: true });
      signs.push({ pos: [x, 4.9, front - 0.85], rotY: P / 2, kind: 'name', text: '旋風飛車', colors: ['#d23a32', '#f2c12e', '#f2c12e'], wide: 2.2, tall: true });
      signs.push({ pos: [x - 0.02, 4.9, front - 0.85], rotY: -P / 2, kind: 'name', text: '旋風飛車', colors: ['#d23a32', '#f2c12e', '#f2c12e'], wide: 2.2, tall: true });
    }
    // Up on its roof, the ride itself: a hump of its track along the ridge on posts, a train of two cars just over the top
    // and starting down, its riders' arms up.
    const track = (t: number): Vec3 => [276.5 + t * 13, ridge + 0.9 + Math.sin(t * P) * 1.5, zc];
    const n = 22;
    for (let k = 0; k < n; k++) {
      const a = track(k / n), b = track((k + 1) / n);
      for (const dz of [-0.45, 0.45]) bar(props, [a[0], a[1], a[2] + dz], [b[0], b[1], b[2] + dz], 0.07, 0xd23a32, { ghost: true });
      box(props, a[0] - 0.06, a[1] - 0.1, zc - 0.55, a[0] + 0.06, a[1] - 0.04, zc + 0.55, 0x8a8f96, { ghost: true });
      if (k % 4 === 0 && k) bar(props, [a[0], ridge - 0.1, zc], [a[0], a[1] - 0.1, zc], 0.09, 0xf2efe6, { ghost: true });
    }
    for (const [t, c] of [[0.52, 0xf2c12e], [0.6, 0x3f7fd0]] as const) {
      const [x, y] = track(t), [x2, y2] = track(t + 0.01), slope = Math.atan2(y2 - y, x2 - x);
      const up = (along: number, rise: number): Vec3 => [x + Math.cos(slope) * along - Math.sin(slope) * rise, y + Math.sin(slope) * along + Math.cos(slope) * rise, zc];
      props.push({ shape: 'box', size: [0.48, 0.24, 0.55], pos: up(0, 0.32), rot: [0, 0, slope], color: c, ghost: true });
      props.push({ shape: 'box', size: [0.5, 0.05, 0.57], pos: up(0, 0.18), rot: [0, 0, slope], color: 0x2a2c30, ghost: true });
      for (const dz of [-0.25, 0.25]) {
        const [hx, hy] = up(-0.1, 0.78);
        props.push({ shape: 'sphere', size: [0.13, 0.14, 0.13], pos: [hx, hy, zc + dz], color: 0xe8c8a0, ghost: true });
        bar(props, [hx, hy - 0.1, zc + dz + (dz > 0 ? 0.12 : -0.12)], [hx - 0.1, hy + 0.45, zc + dz + (dz > 0 ? 0.25 : -0.25)], 0.035, 0xe8c8a0, { ghost: true });
      }
    }
  }
  // Out in front of it on the walk, what it sells: racks of shirts, tables of them folded, caps on stands, its giant
  // bear; a board with the ride painted on it and a hole to put your face through, a family at it, one taking the picture.
  for (const [x, kind] of [[276, 'clothesRack'], [280.5, 'souvenirStall'], [286, 'clothesRack'], [290.5, 'plushGiant']] as const) object(kind, x, FAR_Z + 3.4, P);
  for (const [kind, x, z, turn] of [['merchTable', 278.3, FAR_Z + 1.4, P], ['merchTable', 288.3, FAR_Z + 1.6, P - 0.1], ['capStand', 275.2, FAR_Z + 1.2, 0], ['capStand', 283.6, FAR_Z + 1.0, 0.7], ['cutout', 291.6, FAR_Z + 0.4, P - 0.3]] as const) object(kind, x, z, turn);
  crowds.push({ area: [291.2, FAR_Z + 0.9, 292.2, FAR_Z + 1.5], count: 1, y: 0, dance: P - 0.3, stand: true }, { area: [290.6, FAR_Z - 2.6, 291.6, FAR_Z - 2.0], count: 1, y: 0, dance: -0.3, motion: 'clap' });
  crowds.push({ area: [275, FAR_Z + 2, 291, FAR_Z + 5], count: 8, y: 0 });
  // Where the photographs are picked up, closing the walk off at the shop's end; the screen up on its roof.
  kiosk(props, signs, { at: [296.2, FAR_Z + 4], yaw: P, half: [4, 3], high: 3.4, wall: 0xe8f0f8, trim: 0x2a2c30, roof: 'flat', roofColor: 0x3f7fd0, name: '照片領取', front: 'counter', awning: [0x3f7fd0, 0xffffff] });
  {
    const [x, z, y] = [296.2, FAR_Z + 1.4, 3.6];
    for (const dx of [-2.2, 2.2]) bar(props, [x + dx, y, z], [x + dx, y + 2.6, z], 0.07, 0x2a2c30, { ghost: true });
    box(props, x - 2.3, y + 1.0, z - 0.1, x + 2.3, y + 2.5, z + 0.1, 0x2a2c30, { ghost: true });
    for (let k = 0; k < 6; k++) box(props, x - 2.1 + (k % 3) * 1.45, y + 1.1 + Math.floor(k / 3) * 0.72, z - 0.13, x - 0.85 + (k % 3) * 1.45, y + 1.7 + Math.floor(k / 3) * 0.72, z - 0.1, [0x7fb8ef, 0xf2c12e, 0xe8544a][k % 3], { ghost: true, glow: true });
    crowds.push({ area: [x - 2.4, FAR_Z - 1.4, x + 2.4, FAR_Z - 0.2], count: 6, y: 0, dance: 0, motion: 'clap' });
  }
  for (const xa of [284, 292.4]) {
    box(props, xa, 0, RAIL_Z + 1.6, xa + 6, 2.0, RAIL_Z + 2.2, 0xc8ccd0, { mapColor: 0x8a8f96 });
    for (let k = 0; k < 12; k++) box(props, xa + 0.05 + k * 0.5, 0.15, RAIL_Z + 2.2, xa + 0.48 + k * 0.5, 1.9, RAIL_Z + 2.22, [0xd23a32, 0xf2c12e][k % 2], { ghost: true });
  }
  crowds.push({ area: [284, RAIL_Z + 2.8, 297, RAIL_Z + 4], count: 6, y: 0 });

  // 1. The midway, from the foot of the coaster's ramp to the bumper cars: game booths in two rows facing each other across the
  // way, three backed on to the far side and two on to the lake's railing, each game set out in front of its booth
  // where its players stand: first the ring-toss's mat of prizes from the lake side, then the claw machines and the
  // children at them from the other, then the cans on their tables and the goldfish tub from both at once. The way goes
  // from one side to the other between them. The test of strength by the ramp's foot; candy floss by the railing.
  {
    const N = FAR_Z - 0.6, S = RAIL_Z + 1.2, D = 3;
    // Along the far side, facing the lake. The balloons and darts: the boards out either side of its counter.
    booth(s,[264, N], P, 3.5, D, '射氣球', [0xd23a32, 0xffffff], 'balloons');
    for (const x of [259.9, 268.1]) object('balloonBoard', x, N - 1.1, P + (x < 264 ? -0.3 : 0.3));
    crowds.push({ area: [261, N - 1.5, 267, N - 0.6], count: 5, y: 0, dance: 0, motion: 'throw' });
    // The claw machines, out under its awning in a row along its front, the children at them.
    booth(s,[255.5, N], P, 3.5, D, '夾娃娃', [0xf08ac0, 0xffffff], 'claws');
    for (let k = 0; k < 5; k++) object(k % 2 ? 'clawBlue' : 'clawPink', 252.7 + k * 1.4, N - 0.75, P);
    crowds.push({ area: [252.2, N - 3.4, 258.8, N - 1.6], count: 5, y: 0, dance: 0, motion: 'claw', size: 0.75, clothes: [0xf2c12e, 0x7fd3b8, 0xf08ac0, 0x3fb0e0] }, { area: [252.2, N - 3.8, 258.8, N - 2.6], count: 3, y: 0, dance: 0, motion: 'clap' });
    // The goldfish: the tub out in front, the children squatting round it with their scoops.
    booth(s,[247, N], P, 3.5, D, '撈金魚', [0x3fb0e0, 0xffffff], 'fish');
    object('goldfishTub', 247, N - 1.4, 0);
    for (const x of [245.4, 246.8, 248.2]) object('stool', x, N - 2.45);
    crowds.push({ area: [245, N - 2.9, 249, N - 2.1], count: 3, y: 0, dance: 0, motion: 'scoop', size: 0.75, clothes: [0xf2c12e, 0xe8544a, 0x7fd3b8] });
    // Along the railing, facing the far side. The ring-toss: its mat of prizes in rows out to the rope, the players
    // behind the rope with their rings.
    booth(s,[263, S + D], 0, 4, D, '套圈圈', [0x4fa86a, 0xffffff], 'rings');
    {
      const z0 = S + D + 0.5, z1 = SHORE_Z - 1.6;
      props.push({ shape: 'box', size: [3.6, 0.008, (z1 - z0) / 2 + 0.2], pos: [263, 0.01, (z0 + z1) / 2], color: 0xd23a32, ghost: true });
      for (let x = 259.6; x <= 266.41; x += 0.8) props.push({ shape: 'box', size: [0.02, 0.009, (z1 - z0) / 2 + 0.15], pos: [x, 0.012, (z0 + z1) / 2], color: 0xf2efe6, ghost: true });
      let n = 0;
      for (let z = z0 + 0.2; z < z1; z += 0.62) for (let x = 259.8 + ((z * 10) % 2) * 0.2; x < 266.4; x += 0.8, n++) object((['tossBottle', 'tossDuck', 'tossBottle', 'tossBear'] as const)[n % 4], x, z, n * 0.7);
      for (let x = 259.2; x <= 266.81; x += 1.6) bar(props, [x, 0, z1 + 0.35], [x, 0.7, z1 + 0.35], 0.03, 0xd9a830, { ghost: true });
      box(props, 259.2, 0.62, z1 + 0.33, 266.8, 0.65, z1 + 0.37, 0xd23a32, { ghost: true });
      crowds.push({ area: [259.4, z1 + 0.7, 266.6, z1 + 1.5], count: 6, y: 0, dance: P, motion: 'throw' });
    }
    // The cans: more tables of them set out in front of its counter than fit behind it, a pyramid on each, the players
    // at their line.
    booth(s,[248.5, S + D], 0, 3.5, D, '打罐子', [0xf2c12e, 0xd23a32], 'cans');
    for (const x of [246, 248.5, 251]) {
      const z = S + D + 1.1;
      object('canTable', x, z);
      for (const [row, n] of [[0, 4], [1, 3], [2, 2], [3, 1]] as const) for (let k = 0; k < n; k++) object('tinCan', x + (k - (n - 1) / 2) * 0.155, z, k, 0.855 + row * 0.2);
    }
    box(props, 244.8, 0, S + D + 2.85, 252.2, 0.012, S + D + 2.95, 0xffffff, { ghost: true });
    crowds.push({ area: [245, S + D + 3.1, 252, S + D + 3.9], count: 5, y: 0, dance: P, motion: 'throw' });
    // Between the two along the railing, candy floss; by the ramp's foot, the test of strength, people watching.
    object('cottonCandyCart', 255.5, S + 1.2, 0.1);
    crowds.push({ area: [254, S + 2.2, 257, S + 3.2], count: 3, y: 0 });
    // The families' pushchairs left by it while the children play; a bin full of sticks and paper cones.
    for (const [x, turn] of [[253.4, 0.3], [254.3, -0.2], [257.8, 0.5]] as const) object('stroller', x, S + 4.6, P / 2 + turn);
    object('bin', 258.6, S + 2.6);
    // At the east end, where its row meets the coaster's shop, where the tickets won are traded for prizes: shelves of them
    // behind its counter, the biggest up on its roof.
    kiosk(props, signs, { at: [270.85, N + 3.3], yaw: P, half: [2.75, 3.3], high: 3.4, wall: 0xfff0dc, trim: 0xd9a830, roof: 'flat', roofColor: 0xd23a32, name: '兌獎處', front: 'counter', nameColors: ['#d23a32', '#ffffff', '#f2c12e'], awning: [0xd23a32, 0xf2c12e] });
    for (let k = 0; k < 5; k++) props.push({ shape: 'sphere', size: [0.32, 0.36, 0.28], pos: [268.9 + k * 1.05, 3.95, N + 1.2], color: PRIZES[k * 2 % PRIZES.length], ghost: true }, { shape: 'sphere', size: [0.26, 0.24, 0.24], pos: [268.9 + k * 1.05, 4.5, N + 1.2], color: PRIZES[k * 2 % PRIZES.length], ghost: true });
    // Out in front of it, outside the arch, the test of strength: someone at it with the mallet, people round to see.
    object('highStriker', 272.2, N - 1.4, P + 0.2);
    crowds.push({ area: [271.8, N - 2.6, 272.6, N - 2.1], count: 1, y: 0, dance: 0.2, motion: 'throw' }, { area: [270.2, N - 4.4, 274.4, N - 3.4], count: 4, y: 0, dance: 0.2, motion: 'clap' });
    // Behind the row on the far side, the booths' stock: cartons of prizes stacked to their backs.
    for (let k = 0; k < 6; k++) box(props, 243.7 + k * 1.1, 0, N + D + 0.1, 244.7 + k * 1.1, 0.8 + (k % 3) * 0.35, N + D + 1.0, [0xc8a070, 0xd8b888][k % 2], { mapColor: 0xb0a080 });
    // Families going from one game to the next.
    crowds.push({ area: [246, SHORE_Z - 0.5, 266, SHORE_Z + 2.5], count: 6, y: 0 });

    // The arch over the way in from the ramp's foot: two striped posts, the arch of lights over them, the street's name
    // hung in it, a star on top, pennants from the posts.
    {
      const x = 269.4, za = S + 2.2, zb = N - 1.0, mid = (za + zb) / 2, top = 5.2;
      for (const z of [za, zb]) {
        props.push({ shape: 'cylinder', size: [0.32, top / 2, 0], pos: [x, top / 2, z], color: 0xf6efe2, mapColor: 0xd23a32 });
        for (let k = 0; k < 6; k++) props.push({ shape: 'cylinder', size: [0.335, 0.22, 0], pos: [x, 0.5 + k * 0.85, z], color: 0xd23a32, ghost: true });
        props.push({ shape: 'cylinder', size: [0.45, 0.12, 0], pos: [x, top + 0.1, z], color: 0xf2c12e, ghost: true });
        bar(props, [x, top, z], [x, top + 1.6, z], 0.03, 0xd9a830, { ghost: true });
        props.push({ shape: 'box', size: [0.02, 0.22, 0.38], pos: [x, top + 1.35, z + 0.38], color: z === za ? 0x3f7fd0 : 0xf2c12e, ghost: true });
      }
      const n = 18, rise = 2.4;
      const arc = (t: number): Vec3 => [x, top + Math.sin(t * P) * rise, za + t * (zb - za)];
      for (let k = 0; k < n; k++) {
        const a = arc(k / n), b = arc((k + 1) / n);
        bar(props, a, b, 0.14, k % 2 ? 0xf2c12e : 0xd23a32, { ghost: true });
        props.push({ shape: 'sphere', size: [0.09, 0.09, 0.09], pos: [a[0] - 0.16, a[1], a[2]], color: [0xffe9a8, 0xf08ac0, 0x7fd3b8][k % 3], ghost: true, glow: true });
      }
      bar(props, [x, top, za], [x, top, zb], 0.07, 0xd9a830, { ghost: true });
      signs.push({ pos: [x - 0.12, top + 0.95, mid], rotY: -P / 2, kind: 'name', text: '歡樂遊戲街', colors: ['#d23a32', '#ffffff', '#f2c12e'], wide: 6.5 });
      signs.push({ pos: [x + 0.12, top + 0.95, mid], rotY: P / 2, kind: 'name', text: '歡樂遊戲街', colors: ['#d23a32', '#ffffff', '#f2c12e'], wide: 6.5 });
      props.push({ shape: 'cone', size: [0.5, 0.35, 0], pos: [x, top + rise + 0.5, mid], color: 0xf2c12e, ghost: true, glow: true });
    }
    // The street's floor: tiles laid diamond-wise in two warm colours between the two rows.
    for (let x = 244.5; x < 268.6; x += 2) for (let z = S + D + 0.3; z < N - 0.2; z += 2) {
      for (const [dx, dz, c] of [[0, 0, 0xf0d2a0], [1, 1, 0xe6b07e]] as const) {
        if (x + dx > 268.6 || z + dz > N - 0.2) continue;
        props.push({ shape: 'box', size: [0.68, 0.003, 0.68], pos: [x + dx, 0.005, z + dz], rot: [0, P / 4, 0], color: c, ghost: true });
      }
    }
    // Over it, from one row's canopies to the other's, strings of lights, and paper lanterns hung along them.
    for (const x of [246.2, 250.8, 255.4, 260, 264.6]) {
      const z0 = S + D + 0.7, z1 = N - 0.7, y0 = 4.4, sag = 0.55, m = 16;
      const at = (t: number): Vec3 => [x + Math.sin(t * P * 2) * 0.4, y0 - Math.sin(t * P) * sag, z0 + t * (z1 - z0)];
      for (let k = 0; k < m; k++) {
        bar(props, at(k / m), at((k + 1) / m), 0.012, 0x2a2c30, { ghost: true });
        const [bx, by, bz] = at((k + 0.5) / m);
        if (k % 4 === 2) {
          props.push({ shape: 'sphere', size: [0.26, 0.3, 0.26], pos: [bx, by - 0.45, bz], color: [0xd23a32, 0xf2a52e][Math.round(x) % 2], ghost: true, glow: true });
          for (const dy of [-0.3, 0.3]) props.push({ shape: 'cylinder', size: [0.1, 0.03, 0], pos: [bx, by - 0.45 + dy, bz], color: 0x2a2420, ghost: true });
          bar(props, [bx, by, bz], [bx, by - 0.15, bz], 0.008, 0x2a2c30, { ghost: true });
        } else props.push({ shape: 'sphere', size: [0.06, 0.06, 0.06], pos: [bx, by - 0.06, bz], color: [0xffe9a8, 0xf08ac0, 0x7fd3b8, 0xf2c12e][k % 4], ghost: true, glow: true });
      }
    }
  }
  // 2. The bumper cars, across the whole way: in at the gap in its rail on the lake side, out at the one on the far side,
  // the operator's island between, and the cars going round it.
  bumperCars(s);

  // A raised bed of flowers round a tree, solid, in the middle of the way out of the bumper cars: one way past it by the
  // mascot's queue, the other by the ferris wheel's.
  treeBed(props, 201, SHORE_Z + 2, 2.8);
  object('bin', 207.5, RAIL_Z + 1.6);

  // 5. The ferris wheel, standing back from the way on the north; its queue between posts out to the way, a second food truck.
  ferrisWheel(props, 196, FAR_Z + 26);
  for (let x = 188; x <= 204; x += 2) for (const z of [FAR_Z + 1, FAR_Z + 4]) object('queuePost', x, z, P / 2);
  crowds.push({ area: [188, FAR_Z + 1.4, 204, FAR_Z + 3.6], count: 16, y: 0 });
  signs.push({ pos: [196, 3.2, FAR_Z + 6], rotY: P, kind: 'name', text: '星光摩天輪', colors: ['#2f6fb0', '#ffffff', '#f2c12e'], wide: 5.5 });
  for (const x of [192.6, 199.4]) bar(props, [x, 0, FAR_Z + 6], [x, 3.6, FAR_Z + 6], 0.08, 0xd9a830);
  // 6. The second food truck, driven on from the lake's side, nose to the far side, its hatch to the way.
  foodTruck(props, signs, 189, SHORE_Z - 4.8, '熱狗', 0xf2a52e, false);
  object('table', 184, SHORE_Z - 7);
  object('umbrella', 184, SHORE_Z - 7);
  object('chair', 184.9, SHORE_Z - 7, 1.6);
  crowds.push({ area: [190.8, SHORE_Z - 8, 192.6, SHORE_Z - 2], count: 5, y: 0 });

  // 6. On the lake side again: popcorn, a mascot posing for photographs with a queue for it.
  object('popcornCart', 198, RAIL_Z + 2.8, -0.2);
  object('mascotBear', 210, RAIL_Z + 3.4, P - 0.3);
  crowds.push({ area: [196, RAIL_Z + 1.5, 212, RAIL_Z + 4.5], count: 10, y: 0 });

  // At the east end, the wave pool's: its snack bar, the sign over the way down into it, the fence of the water park.
  kiosk(props, signs, { at: [184, FAR_Z + 16], yaw: P, half: [6, 3.4], high: 3.8, wall: 0xfff0d0, trim: 0xffffff, roof: 'pitched', roofColor: 0x3fb0e0, name: '海灘小吃', front: 'counter', awning: [0x3fb0e0, 0xffffff] });
  for (let z = LANE_N + 1; z < WAVE_HOUSE; z += 2) bar(props, [POOL.x1 + 1.8, 0, z], [POOL.x1 + 1.8, 1.1, z], 0.04, 0xd8dce0, { ghost: true });
  box(props, POOL.x1 + 1.75, 1.0, LANE_N + 0.4, POOL.x1 + 1.85, 1.1, WAVE_HOUSE, 0xd8dce0, { ghost: true });
  box(props, POOL.x1 + 1.6, 0, WAVE_HOUSE, POOL.x1 + 2, 2.4, 463, 0x5a8ab0, { mapColor: 0x5a6a7a });
  for (const x of [215, 252, 270]) for (const z of [FAR_Z + 34, FAR_Z + 44]) object(x % 2 ? 'tree' : 'palm', x, z);
  crowds.push({ area: [256, FAR_Z + 3.6, 272, FAR_Z + 11], count: 14, y: 0 });
  // Behind the way on the north: lawns between paths; a fountain in its basin with benches round it; a drinks stand and a
  // souvenir stand; behind the bumper cars the vans and cases of the park's men who look after them.
  const LAWN: Look = { tag: 'grass', color: 0x6f9e52, wall: 0x5a7a44 };
  relief.area([[250, FAR_Z + 24], [298, FAR_Z + 24], [298, 458], [250, 458]], 0, LAWN);
  relief.area([[176, FAR_Z + 40], [214, FAR_Z + 40], [214, 458], [176, 458]], 0, LAWN);
  relief.area([[220, FAR_Z + 24], [248, FAR_Z + 24], [248, 458], [220, 458]], 0, LAWN);
  for (const [x0, x1] of [[264, 268], [230, 234]]) relief.area([[x0, FAR_Z + 24], [x1, FAR_Z + 24], [x1, 458], [x0, 458]], 0, PROMENADE);
  {
    const [fx, fz] = [282, FAR_Z + 40];
    props.push({ shape: 'cylinder', size: [5, 0.35, 0], pos: [fx, 0.35, fz], color: 0xd8d0c0, mapColor: 0x4fa8c8 });
    props.push({ shape: 'cylinder', size: [4.5, 0.02, 0], pos: [fx, 0.62, fz], color: 0x4fa8c8, ghost: true });
    props.push({ shape: 'cylinder', size: [1.2, 0.8, 0], pos: [fx, 1.0, fz], color: 0xd8d0c0, ghost: true });
    props.push({ shape: 'cone', size: [1.8, 0.3, 0], pos: [fx, 2.0, fz], rot: [Math.PI, 0, 0], color: 0xd8d0c0, ghost: true });
    s.fountains.push([fx, 2.6, fz]);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * P * 2; object('bench', fx + Math.cos(a) * 7.5, fz + Math.sin(a) * 7.5, -a - P / 2); }
    for (const [a, b, c, d] of [[-9, -9, 9, -5.6], [-9, 5.6, 9, 9], [-9, -5.6, -5.6, 5.6], [5.6, -5.6, 9, 5.6]]) crowds.push({ area: [fx + a, fz + b, fx + c, fz + d], count: 5, y: 0 });
  }
  kiosk(props, signs, { at: [266, FAR_Z + 16], yaw: P, half: [4, 3], high: 3.6, wall: 0xe8f4f8, trim: 0xffffff, roof: 'dome', roofColor: 0x3fb0e0, name: '飲料站', front: 'counter', awning: [0x3fb0e0, 0xffffff] });
  kiosk(props, signs, { at: [216, FAR_Z + 16], yaw: P, half: [4, 3], high: 3.6, wall: 0xfff0dc, trim: 0xffffff, roof: 'pitched', roofColor: 0xd23a32, name: '紀念品', front: 'shop', awning: [0xd23a32, 0xffffff] });
  for (const [x, z] of [[226, 437], [240, 438]] as const) props.push({ shape: 'box', size: [1.15, 1.4, 3.7], pos: [x, 1.6, z], rot: [0, 0.05, 0], color: 0xf2efe6, vehicle: 'van' });
  for (const [x, z] of [[232.5, 436], [233.5, 438.5], [246, 436.5]] as const) box(props, x - 0.6, 0, z - 0.45, x + 0.6, 0.9, z + 0.45, 0x2a2c30, { ghost: true });
  for (const [x, z, c] of [[256, 440, 0xf08ac0], [292, 452, 0xf2c12e], [258, 456, 0xe8544a], [186, 452, 0xf08ac0], [206, 456, 0xf2c12e]] as const) {
    for (let k = 0; k < 7; k++) props.push({ shape: 'sphere', size: [0.6, 0.35, 0.6], pos: [x + (k % 4) * 1.3 - 2, 0.3, z + Math.floor(k / 4) * 1.3], color: k % 2 ? c : 0xffffff, ghost: true });
  }
  crowds.push({ area: [234, FAR_Z + 26, 262, FAR_Z + 44], count: 24, y: 0 }, { area: [178, FAR_Z + 34, 214, FAR_Z + 46], count: 16, y: 0 });
  // Along the north of it all, the park's edge: a fence behind a row of trees.
  box(props, POOL.x1 + 2, 0, 462.6, 300, 2.0, 463.2, 0x5a6a5a);
  for (let x = POOL.x1 + 8; x < 298; x += 8) object(x % 16 ? 'treeTall' : 'tree', x, 458);
}

/**
 * A food truck stopped across the walk, its length along Z, its nose toward the lake (south, less Z) or away from it:
 * a van's body in its colour, its serving hatch open on its west side with a flap propped over it, a counter, its menu
 * board, its cab dark-windowed at the nose; solid.
 */
function foodTruck(props: PropDesc[], signs: SignDesc[], x: number, z: number, name: string, color: number, noseSouth: boolean): void {
  const n = noseSouth ? -1 : 1;
  box(props, x - 1.2, 0.5, z - 3.2, x + 1.2, 3.1, z + 3.2, color, { mapColor: 0x8a7a6a });
  box(props, x - 1.25, 0.52, z - 3.25, x + 1.25, 1.0, z + 3.25, 0xf2efe6, { ghost: true });
  // The hatch on its west side (more X), toward the way it is come at from.
  box(props, x + 1.22, 1.5, z - 1.8 * n - 1.8, x + 1.26, 2.6, z - 1.8 * n + 1.8, 0x2a3a48, { ghost: true });
  props.push({ shape: 'box', size: [0.6, 0.04, 1.9], pos: [x + 1.65, 2.85, z - 1.8 * n], rot: [0, 0, -0.5], color: 0xffffff, ghost: true });
  box(props, x + 1.2, 1.45, z - 1.8 * n - 1.8, x + 1.6, 1.52, z - 1.8 * n + 1.8, 0xd8dce0, { ghost: true });
  // Its cab at the nose: windows all round.
  box(props, x - 1.26, 1.2, z + n * 1.6 - 0.02 + (n > 0 ? 0 : -1.4), x + 1.26, 2.9, z + n * 3.0 + (n > 0 ? 0.24 : 0.24), 0x2a3a48, { ghost: true });
  for (const dz of [-2.2, 2.2]) for (const side of [-1, 1]) props.push({ shape: 'cylinder', size: [0.4, 0.15, 0], pos: [x + side * 1.05, 0.4, z + dz], rot: [0, 0, P / 2], color: 0x24262a, ghost: true });
  signs.push({ pos: [x + 1.27, 3.45, z - 1.8 * n], rotY: P / 2, kind: 'name', text: name, colors: ['#ffffff', '#2a3a48', '#f2c12e'], wide: 2.6 });
}

/** What a game booth has on show at its back: balloons for the darts, or shelves of prizes, or goldfish in their bags. */
type Game = 'balloons' | 'claws' | 'fish' | 'rings' | 'cans';
const PRIZES = [0xf08ac0, 0xf2c12e, 0x7fb8ef, 0xffffff, 0xe8544a, 0x7fd3b8, 0xb79be8, 0xc8915a];

/**
 * A game booth of the midway, open at its front over its counter: its back wall hung with what is to be won, a striped
 * canopy on four posts, its scalloped edge along the front with lights strung under it, the game's name up on a board
 * over it; a prize as big as a child hung at each front corner; its attendant behind the counter. Solid as a booth is:
 * its back, its sides and its counter. `front` is the middle of its front, `w` half its width, `d` its depth.
 */
function booth(s: ParkSite, front: Vec2, yaw: number, w: number, d: number, name: string, stripes: [number, number], game: Game): void {
  const { props, signs, crowds } = s;
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  /** A point so far across its front (to the right as faced), so far out in front of it, and up. */
  const at = (across: number, out: number, up: number): Vec3 => [front[0] + rx * across + fx * out, up, front[1] + rz * across + fz * out];
  const rot: Vec3 = [0, yaw, 0];
  const piece = (size: Vec3, pos: Vec3, color: number, extra: Partial<PropDesc> = {}) => props.push({ shape: 'box', size, pos, rot, color, ...extra });
  const ball = (size: Vec3, pos: Vec3, color: number, extra: Partial<PropDesc> = {}) => props.push({ shape: 'sphere', size, pos, color, ghost: true, ...extra });
  /** A plush toy sitting: its body, its head, two ears. */
  const plush = (across: number, out: number, up: number, scale: number, color: number) => {
    ball([0.16 * scale, 0.17 * scale, 0.13 * scale], at(across, out, up + 0.17 * scale), color);
    ball([0.13 * scale, 0.12 * scale, 0.12 * scale], at(across, out, up + 0.44 * scale), color);
    for (const e of [-1, 1]) ball([0.045 * scale, 0.045 * scale, 0.03 * scale], at(across + e * 0.1 * scale, out, up + 0.55 * scale), color);
  };
  const H = 3.1, hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

  // Its floor, its back and its sides: boards in its colours.
  piece([w, 0.03, d / 2], at(0, -d / 2, 0.03), 0xb89a6a, { ghost: true });
  piece([w, H / 2 - 0.15, 0.06], at(0, -d + 0.06, H / 2 - 0.15), stripes[1] === 0xffffff ? 0xfff6e8 : stripes[1], { mapColor: 0xb0a080 });
  for (const sx of [-1, 1]) piece([0.05, 1.15, d / 2 - 0.07], at(sx * (w - 0.05), -d / 2 + 0.07, 1.15), stripes[0], { mapColor: 0xb0a080 });
  // The counter across its front, striped down its face; the claw machines' booth has none, its machines out in front.
  if (game !== 'claws') {
    piece([w - 0.1, 0.5, 0.22], at(0, -0.25, 0.5), 0xf6efe2, { mapColor: 0xb0a080 });
    piece([w - 0.06, 0.04, 0.28], at(0, -0.25, 1.02), stripes[0], { ghost: true });
    const n = Math.round(w * 2.5);
    for (let k = 0; k < n; k += 2) piece([w / n, 0.44, 0.01], at(-w + 0.1 + ((2 * w - 0.2) * (k + 0.5)) / n, -0.012, 0.5), stripes[0], { ghost: true });
  }
  // The posts at its corners; the canopy over it, striped from back to front and sloping down to the front; the scallops
  // along its front edge, lights strung under them.
  for (const sx of [-1, 1]) for (const out of [-d + 0.08, 0]) bar(props, at(sx * (w - 0.05), out, 0), at(sx * (w - 0.05), out, H + 0.1), 0.05, 0xf6efe2, { ghost: true });
  const n = Math.max(4, Math.round(w * 2));
  for (let k = 0; k < n; k++) {
    const x = -w + (2 * w * (k + 0.5)) / n;
    props.push({ shape: 'box', size: [w / n, 0.04, d / 2 + 0.45], pos: at(x, -d / 2 + 0.3, H + 0.3), rot: alongRot(yaw, -0.18), color: stripes[k % 2], ghost: true, fade: true });
    props.push({ shape: 'box', size: [w / n - 0.01, 0.17, 0.015], pos: at(x, 0.76, H - 0.12), rot, color: stripes[(k + 1) % 2], ghost: true });
    props.push({ shape: 'sphere', size: [w / n - 0.02, 0.09, 0.01], pos: at(x, 0.76, H - 0.29), rot, color: stripes[(k + 1) % 2], ghost: true });
  }
  for (let k = 0; k <= n * 2; k++) ball([0.055, 0.055, 0.055], at(-w + (w * k) / n, 0.66, H - 0.42), [0xffe9a8, 0xf08ac0, 0x7fd3b8, 0xf2c12e][k % 4], { glow: true });
  // Its name on a board up over the canopy's front, on two posts.
  const wide = Math.min(2 * w - 0.8, name.length * 0.62 + 0.6);
  for (const sx of [-1, 1]) bar(props, at(sx * wide * 0.35, 0.45, H), at(sx * wide * 0.35, 0.45, H + 0.6), 0.03, 0xd9a830, { ghost: true });
  signs.push({ pos: at(0, 0.5, H + 0.85), rotY: yaw, kind: 'name', text: name, colors: [hex(stripes[0]), stripes[0] === 0xf2c12e ? '#d23a32' : '#ffffff', '#f2c12e'], wide });
  // A prize as big as a child hung at each front corner, from the canopy.
  for (const sx of [-1, 1]) {
    bar(props, at(sx * (w - 0.45), 0.25, H - 0.05), at(sx * (w - 0.45), 0.25, H - 0.35), 0.01, 0xffffff, { ghost: true });
    plush(sx * (w - 0.45), 0.25, H - 1.35, 1.6, PRIZES[(name.length + (sx > 0 ? 1 : 4)) % PRIZES.length]);
  }

  // At its back: what it is all for.
  const back = -d + 0.2;
  if (game === 'balloons') {
    // Balloons pinned in rows all over the back board, a few already burst.
    const cols = Math.round((2 * w - 0.4) / 0.34);
    for (let r = 0; r < 5; r++) for (let c = 0; c < cols; c++) {
      if ((r * 7 + c * 3) % 11 === 0) continue;
      ball([0.13, 0.15, 0.1], at(-w + 0.37 + c * 0.34, back, 1.25 + r * 0.33), [0xe8544a, 0xf2c12e, 0x3f7fd0, 0x4fa86a, 0xf08ac0][(r + c) % 5]);
    }
    for (const x of [-0.6, 0.6]) piece([0.12, 0.08, 0.1], at(x, -0.25, 1.12), 0x6a4a30, { ghost: true });
  } else if (game === 'claws') {
    // More machines along its back wall, lit, full of toys.
    const cols = Math.floor((2 * w - 0.4) / 0.95);
    for (let c = 0; c < cols; c++) {
      const x = -w + 0.2 + 0.475 + c * 0.95, color = c % 2 ? 0x3f7fc8 : 0xe86a9a;
      piece([0.42, 0.45, 0.4], at(x, -d + 0.55, 0.45), color, { ghost: true });
      piece([0.4, 0.42, 0.38], at(x, -d + 0.55, 1.32), 0xcfe6ee, { ghost: true });
      piece([0.44, 0.1, 0.42], at(x, -d + 0.55, 1.84), color, { ghost: true, glow: true });
      for (let k = 0; k < 4; k++) ball([0.09, 0.09, 0.09], at(x - 0.22 + k * 0.15, -d + 0.4, 1.0), PRIZES[(c * 3 + k) % PRIZES.length]);
    }
  } else if (game === 'fish') {
    // Goldfish in their bags of water hung in rows along the back, a tank under them.
    const cols = Math.round((2 * w - 0.6) / 0.4);
    for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) {
      const x = -w + 0.5 + c * 0.4, y = 1.5 + r * 0.45;
      ball([0.13, 0.15, 0.13], at(x, back + 0.08, y), 0xd8eef4);
      ball([0.05, 0.03, 0.025], at(x, back + 0.22, y - 0.02), r % 2 ? 0xf28a2e : 0xe8544a);
      piece([0.015, 0.06, 0.015], at(x, back + 0.08, y + 0.19), 0xd23a32, { ghost: true });
    }
    piece([w - 0.4, 0.35, 0.35], at(0, -d + 0.5, 0.35), 0x3f8ac8, { ghost: true });
    piece([w - 0.45, 0.01, 0.3], at(0, -d + 0.5, 0.66), 0x7fd0e8, { ghost: true });
  } else {
    // Shelves of prizes, the biggest at the top.
    for (let r = 0; r < 3; r++) {
      const y = 1.15 + r * 0.55, scale = 0.6 + r * 0.25, step = 0.26 + scale * 0.22;
      piece([w - 0.15, 0.025, 0.2], at(0, back + 0.05, y), 0xf6efe2, { ghost: true });
      for (let k = 0, x = -w + 0.3; x < w - 0.3; x += step, k++) plush(x, back + 0.08, y + 0.03, scale, PRIZES[(k * 3 + r) % PRIZES.length]);
    }
  }
  // Its attendant, behind the counter, facing out.
  const [ax, , az] = at(0, -d * 0.55, 0);
  crowds.push({ area: [ax - 0.35, az - 0.35, ax + 0.35, az + 0.35], count: 1, y: 0, fenced: true, dance: yaw, motion: 'beckon', clothes: [stripes[0]] });
}

/**
 * The bumper cars: a steel floor across the whole way, a rail round it padded with rubber, a gap in it on the lake side
 * where the midway's lane comes to it and one at the far corner where the way goes on, out of line with each other; the
 * operator's booth on an island in the middle, square in the line between the two; a canopy over it all on posts, the
 * grid under it the cars' poles run on. The cars go round the island, each its own way round, near it or out by the
 * rail, at its own pace, the way the rides have them go: on the lake side the same way as the truck. People watch along
 * the lake's railing; the queue and the ticket booth are on the far side.
 */
function bumperCars(s: ParkSite): void {
  const { props, signs, crowds, rigs, relief } = s;
  const object = (kind: Parameters<typeof put>[1], x: number, z: number, rotY = 0, y = 0) => put(s, kind, x, z, rotY, y);
  const { x0, x1, z0, z1 } = ARENA, T = 0.3, RAIL = 1.0, ROOF = 5.6, GRID = 4.3;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;

  relief.area([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], 0, { tag: 'paving', color: 0x8c939b, wall: 0x6a7078 });
  s.slicks.push({ pos: [cx, cz], half: [(x1 - x0) / 2, (z1 - z0) / 2], grip: 0.3, look: 'metal' });
  // The floor's plates, their seams one way a hair under those the other.
  for (let x = x0 + 2; x < x1 - 0.5; x += 2) box(props, x - 0.02, 0, z0, x + 0.02, 0.004, z1, 0x6a7078, { ghost: true });
  for (let z = z0 + 3; z < z1 - 0.5; z += 3) box(props, x0, 0, z - 0.02, x1, 0.006, z + 0.02, 0x6a7078, { ghost: true });

  /** A length of the rail round it, from one point to another along X or along Z, on the floor's edge outside it. */
  const rail = (ax: number, az: number, bx: number, bz: number) => {
    const alongX = az === bz, out = alongX ? (az === z0 ? -1 : 1) : (ax === x0 ? -1 : 1);
    const [lx, hx] = [Math.min(ax, bx), Math.max(ax, bx)], [lz, hz] = [Math.min(az, bz), Math.max(az, bz)];
    const [rx0, rx1, rz0, rz1] = alongX ? [lx, hx, az + (out < 0 ? -T : 0), az + (out > 0 ? T : 0)] : [ax + (out < 0 ? -T : 0), ax + (out > 0 ? T : 0), lz, hz];
    box(props, rx0, 0, rz0, rx1, RAIL, rz1, 0xe8e2d6, { mapColor: 0x3a3f48 });
    // Its rubber, thick and black, the cars bounce off; its cap rail, yellow.
    const e = 0.03;
    box(props, rx0 + (alongX ? e : -0.06), 0.18, rz0 + (alongX ? -0.06 : e), rx1 - (alongX ? e : -0.06), 0.62, rz1 - (alongX ? -0.06 : e), 0x1c1c1c, { ghost: true });
    box(props, rx0 + (alongX ? 0 : -0.03), RAIL, rz0 + (alongX ? -0.03 : 0), rx1 + (alongX ? 0 : 0.03), RAIL + 0.07, rz1 + (alongX ? 0.03 : 0), 0xf2c12e, { ghost: true });
  };
  rail(x0 - T, z0, x1 + T, z0);
  rail(x0 - T, z1, x1 + T, z1);
  rail(x1, z0, x1, IN[0]);
  rail(x1, IN[1], x1, z1);
  rail(x0, z0, x0, OUT[0]);
  rail(x0, OUT[1], x0, z1);

  // The gaps in it: an arch of lights over each, its name up in it, on both faces.
  for (const [x, [za, zb], text, wide] of [[x1 + T / 2, IN, '碰碰車', 3.6], [x0 - T / 2, OUT, '出口', 2.2]] as const) {
    const top = 4.2, mid = (za + zb) / 2;
    for (const z of [za - 0.2, zb + 0.2]) {
      props.push({ shape: 'cylinder', size: [0.16, top / 2, 0], pos: [x, top / 2, z], color: 0x3f7fd0, mapColor: 0x3a3f48 });
      for (let k = 0; k < 5; k++) props.push({ shape: 'cylinder', size: [0.17, 0.18, 0], pos: [x, 0.6 + k * 0.8, z], color: 0xf2efe6, ghost: true });
    }
    const n = 12, rise = 1.1;
    for (let k = 0; k < n; k++) {
      const a: Vec3 = [x, top + Math.sin((k / n) * P) * rise, za - 0.2 + (k / n) * (zb - za + 0.4)];
      const b: Vec3 = [x, top + Math.sin(((k + 1) / n) * P) * rise, za - 0.2 + ((k + 1) / n) * (zb - za + 0.4)];
      bar(props, a, b, 0.1, k % 2 ? 0x3f7fd0 : 0xf2c12e, { ghost: true });
      props.push({ shape: 'sphere', size: [0.08, 0.08, 0.08], pos: [x, a[1] - 0.14, a[2]], color: [0xffe9a8, 0xf08ac0, 0x7fd3b8][k % 3], ghost: true, glow: true });
    }
    for (const side of [-1, 1]) signs.push({ pos: [x + side * 0.1, top + 0.55, mid], rotY: side * P / 2, kind: 'name', text, colors: ['#3f7fd0', '#ffffff', '#f2c12e'], wide });
  }

  // The operator's booth on its island in the middle, its window to the lake side, the operator at the controls; a kerb
  // of rubber round its foot; a flower box at each end.
  kiosk(props, signs, { at: [ISLAND.x, ISLAND.z], yaw: P, half: [ISLAND.hx - 1.4, ISLAND.hz - 0.4], high: 2.8, wall: 0xf2efe6, trim: 0x3f7fd0, roof: 'dome', roofColor: 0xf2c12e, name: '碰碰車', front: 'counter', nameColors: ['#3f7fd0', '#ffffff', '#f2c12e'], awning: [0x3f7fd0, 0xffffff] });
  box(props, ISLAND.x - ISLAND.hx, 0, ISLAND.z - ISLAND.hz, ISLAND.x + ISLAND.hx, 0.42, ISLAND.z + ISLAND.hz, 0x1c1c1c, { mapColor: 0x3a3f48 });
  box(props, ISLAND.x - ISLAND.hx - 0.02, 0.42, ISLAND.z - ISLAND.hz - 0.02, ISLAND.x + ISLAND.hx + 0.02, 0.47, ISLAND.z + ISLAND.hz + 0.02, 0xf2c12e, { ghost: true });
  crowds.push({ area: [ISLAND.x - 0.6, ISLAND.z - 1.2, ISLAND.x + 0.6, ISLAND.z - 0.6], count: 1, y: 0, fenced: true, dance: P, motion: 'beckon', clothes: [0x3f7fd0] });
  for (const side of [-1, 1]) {
    const x = ISLAND.x + side * (ISLAND.hx - 0.65);
    box(props, x - 0.6, 0, ISLAND.z - 1.6, x + 0.6, 0.6, ISLAND.z + 1.6, 0xd8d0c0, { mapColor: 0x3a3f48 });
    for (let k = 0; k < 5; k++) props.push({ shape: 'sphere', size: [0.32, 0.26, 0.32], pos: [x, 0.78, ISLAND.z - 1.25 + k * 0.62], color: [0xf08ac0, 0xf2c12e, 0xe8544a, 0xffffff][k % 4], ghost: true });
  }

  // The canopy: posts on the rail, a flat roof in stripes over it all with lights along its edge, its name up on its front;
  // the grid under it, dark.
  for (const x of [x0 - T / 2, x0 + 8, cx, x1 - 8, x1 + T / 2]) for (const z of [z0 - T / 2, z1 + T / 2]) bar(props, [x, 0, z], [x, ROOF, z], 0.16, 0x3f7fd0, { mapColor: 0x3a3f48 });
  for (const [x, z] of [[x1 + T / 2, z1 - 6], [x0 - T / 2, z0 + 5]] as const) bar(props, [x, 0, z], [x, ROOF, z], 0.16, 0x3f7fd0, { mapColor: 0x3a3f48 });
  const stripes = 16;
  for (let k = 0; k < stripes; k++) {
    const a = x0 - 0.6 + ((x1 - x0 + 1.2) * k) / stripes, b = x0 - 0.6 + ((x1 - x0 + 1.2) * (k + 1)) / stripes;
    box(props, a, ROOF, z0 - 0.6, b, ROOF + 0.14, z1 + 0.6, k % 2 ? 0xffffff : 0x3f7fd0, { ghost: true, fade: true });
  }
  for (const z of [z0 - 0.64, z1 + 0.6]) box(props, x0 - 0.6, ROOF - 0.35, z, x1 + 0.6, ROOF, z + 0.04, 0xf2c12e, { ghost: true, fade: true });
  for (const x of [x0 - 0.64, x1 + 0.6]) box(props, x, ROOF - 0.35, z0 - 0.6, x + 0.04, ROOF, z1 + 0.6, 0xf2c12e, { ghost: true, fade: true });
  for (let x = x0; x <= x1; x += 1.2) for (const z of [z0 - 0.7, z1 + 0.7]) props.push({ shape: 'sphere', size: [0.07, 0.07, 0.07], pos: [x, ROOF - 0.2, z], color: [0xffe9a8, 0xf08ac0, 0x7fd3b8, 0xf2c12e][Math.round(x) % 4], ghost: true, glow: true });
  for (let x = x0 + 1.5; x < x1; x += 1.5) box(props, x - 0.02, GRID, z0, x + 0.02, GRID + 0.03, z1, 0x2a2c30, { ghost: true, fade: true });
  for (let z = z0 + 1.5; z < z1; z += 1.5) box(props, x0, GRID + 0.04, z - 0.02, x1, GRID + 0.07, z + 0.02, 0x2a2c30, { ghost: true, fade: true });
  for (const z of [z0 - 0.7, z1 + 0.7]) for (const side of [-1, 1]) signs.push({ pos: [cx, ROOF + 0.9, z + side * 0.05], rotY: side > 0 ? 0 : P, kind: 'name', text: '碰碰車', colors: ['#3f7fd0', '#ffffff', '#f2c12e'], wide: 7 });

  // The cars: ten of them, each round the island on a loop of its own, from close in to out by the rail, at its own pace.
  const COLORS = [0xd23a32, 0x3f7fd0, 0xf2c12e, 0x4fa86a, 0xf08ac0, 0x8a5ac8, 0xf28a2e, 0x2fb0a8, 0xe8544a, 0x3fb0e0];
  const ORDER = [0, 6, 3, 9, 1, 7, 4, 8, 2, 5];
  const n = ORDER.length;
  ORDER.forEach((o, k) => {
    const f = o / (n - 1), mx = ISLAND.x + (cx - ISLAND.x) * f, hx = 6.4 + f * 6.9, hz = 5.4 + f * 5, speed = 2.9 - f * 0.9 + ((k * 7) % 5) * 0.08;
    // Round it the way that has them on the lake side going the way the truck goes, and up toward the way out at the
    // far end as it does: corners rounded off.
    const path: Vec2[] = [];
    for (let j = 0; j < 24; j++) {
      const a = -(j / 24) * P * 2, c = Math.cos(a), sn = Math.sin(a);
      path.push([mx + hx * Math.sign(c) * Math.abs(c) ** 0.5, cz + hz * Math.sign(sn) * Math.abs(sn) ** 0.5]);
    }
    const long = path.reduce((sum, p, j) => sum + Math.hypot(path[(j + 1) % 24][0] - p[0], path[(j + 1) % 24][1] - p[1]), 0);
    const phase = (k / n + 0.37 * o) % 1;
    const at = path[Math.floor(phase * 24) % 24];
    rigs.push({ kind: 'bumper', pos: [at[0], 0, at[1]], yaw: 0, period: long / speed, phase, path, color: COLORS[k] });
  });

  // Along the lake's railing, people watching, some cheering them on.
  crowds.push({ area: [x0 + 1, RAIL_Z + 0.4, x1 - 1, RAIL_Z + 0.9], count: 10, y: 0, dance: 0, stand: true });
  crowds.push({ area: [x0 + 3, RAIL_Z + 0.4, x1 - 3, RAIL_Z + 0.9], count: 5, y: 0, dance: 0, motion: 'clap' });

  // Out on the far side: the ticket booth, the queue between rails along the back of the floor, the next riders in it,
  // the gate into the floor from it; the balloon seller and an ice cream cart for those waiting.
  kiosk(props, signs, { at: [x1 - 3, z1 + 6], yaw: P, half: [2.6, 2], high: 3.2, wall: 0xfff0dc, trim: 0x3f7fd0, roof: 'flat', roofColor: 0x3f7fd0, name: '售票處', front: 'counter', awning: [0x3f7fd0, 0xffffff] });
  for (let x = x0 + 2; x <= x1 - 7; x += 2) for (const z of [z1 + 1.2, z1 + 3.6]) object('queuePost', x, z, P / 2);
  crowds.push({ area: [x0 + 2.4, z1 + 1.6, x1 - 7.4, z1 + 3.2], count: 14, y: 0 });
  object('balloonCart', x0 + 6, z1 + 7.5, 0.3);
  object('iceCreamCart', cx - 1, z1 + 7.2, -0.4);
  crowds.push({ area: [x0 + 4, z1 + 6, cx + 2, z1 + 9.5], count: 9, y: 0 });
  s.keepOut.push([x0 - T, z0 - T, x1 + T, z1 + T]);
}

/** A raised bed of flowers round a tree in the middle of a walk: a round kerb of stone, solid, the tree up out of it. */
function treeBed(props: PropDesc[], x: number, z: number, r: number): void {
  props.push({ shape: 'cylinder', size: [r, 0.3, 0], pos: [x, 0.3, z], color: 0xd8d0c0, mapColor: 0x6f9e52 });
  props.push({ shape: 'cylinder', size: [r - 0.2, 0.05, 0], pos: [x, 0.62, z], color: 0x5a3e28, ghost: true });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    props.push({ shape: 'sphere', size: [0.42, 0.3, 0.42], pos: [x + Math.cos(a) * (r - 0.6), 0.85, z + Math.sin(a) * (r - 0.6)], color: [0xf08ac0, 0xf2c12e, 0xe8544a, 0xffffff][k % 4], ghost: true });
  }
  props.push({ shape: 'cylinder', size: [0.22, 1.6, 0], pos: [x, 2.2, z], color: 0x6b5238 });
  props.push({ shape: 'sphere', size: [2.4, 2.0, 2.4], pos: [x, 5.0, z], color: 0x4f8a4a, ghost: true, fade: true, overhead: true });
}

/** The ferris wheel: two legs each side up to its axle, its rim and spokes, gondolas round it; only to look at, from the way. */
function ferrisWheel(props: PropDesc[], x: number, z: number): void {
  const R = 18, H = R + 3;
  for (const dz of [-2.4, 2.4]) for (const dx of [-9, 9]) bar(props, [x + dx, 0, z + dz], [x, H, z + dz * 0.4], 0.32, 0xe8e2d0, { ghost: true });
  bar(props, [x, H, z - 1.4], [x, H, z + 1.4], 0.6, 0x5a6068, { ghost: true });
  const n = 32;
  for (const dz of [-0.9, 0.9]) for (let k = 0; k < n; k++) {
    const a = (k / n) * P * 2, b = ((k + 1) / n) * P * 2;
    bar(props, [x + Math.cos(a) * R, H + Math.sin(a) * R, z + dz], [x + Math.cos(b) * R, H + Math.sin(b) * R, z + dz], 0.16, 0xf2efe6, { ghost: true });
  }
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * P * 2;
    bar(props, [x, H, z], [x + Math.cos(a) * R, H + Math.sin(a) * R, z], 0.06, 0xd8dce0, { ghost: true });
    const gx = x + Math.cos(a) * R, gy = H + Math.sin(a) * R;
    props.push({ shape: 'box', size: [0.9, 0.75, 0.9], pos: [gx, gy - 1.4, z], color: [0xe8544a, 0xf2c12e, 0x3f7fd0, 0x4fa86a, 0xf08ac0, 0x8a5ac8][k % 6], ghost: true });
    props.push({ shape: 'box', size: [0.92, 0.3, 0.92], pos: [gx, gy - 1.1, z], color: 0x2a3a48, ghost: true });
    bar(props, [gx, gy, z], [gx, gy - 0.65, z], 0.04, 0x8a8f96, { ghost: true });
  }
  box(props, x - 6, 0, z - 4, x + 6, 2.6, z + 4, 0xf2e6cc, { mapColor: 0xb0a080 });
}
