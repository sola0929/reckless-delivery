import { alongRot, bar, beside, box, carousel, hedge, kiosk, planter, put, rail, along, wayPoints, type ParkSite } from './parkParts';
import type { Look } from './relief';
import { GATE, HUB, HUB_R, STREET } from './parkPlan';
import type { Vec3 } from '../config';
import type { PropDesc, SignDesc, Vec2 } from './types';

// 1. In: from the coaches' bay outside the park through the queue for the gate, zigzagging north across its walled yard in
// square bends; through the gate's turnstiles; up the main street between its shops, the carts down its middle splitting it
// in two and people crossing it; round the carousel in the hub, and out of it to the west, to the teacups.

const P = Math.PI;
const [gx, gz] = GATE;

/**
 * The queue's yard, walled, and the way across it: the queue's lane between planters, as tight in its bends as the truck
 * turns, swinging out to the east and back; the causeway over the garden's pond, winding; straight up the court to the gate.
 */
const QUEUE_WIDE = 7.5;
const YARD = { x0: gx - 17, x1: gx + 15, z0: gz - 121, z1: gz - 3 };
/** The causeway: how wide, the radius of its bends and how far each swings (radians), how far out its banks run to the bed. */
const DIKE_WIDE = 4.2, DIKE_R = 11, DIKE_SWING = 0.7, DIKE_BANK = 2.0;
/** The pond, the width of the yard: its bed, its water. */
export const POND = { x0: YARD.x0 + 0.9, x1: YARD.x1 - 0.9, z0: 80, z1: 134.5, bed: -1.3, water: -0.35, ramp: 9 };
/** Where the way comes into the yard: east of the gate's line by as far as the causeway carries it west. */
const MOUTH_X = gx - 2 * DIKE_R * (1 - Math.cos(DIKE_SWING));
export const QUEUE = wayPoints([MOUTH_X, YARD.z0], 0, [
  { long: 2 }, { radius: 9.5, turn: -P / 4 }, { radius: 9.5, turn: P / 2 }, { radius: 9.5, turn: -P / 4 }, { long: 8 },
  { radius: DIKE_R, turn: DIKE_SWING }, { radius: DIKE_R, turn: -2 * DIKE_SWING }, { radius: DIKE_R, turn: 2 * DIKE_SWING }, { radius: DIKE_R, turn: -DIKE_SWING },
  { long: YARD.z1 - 0.7 - YARD.z0 - 10 - 9.5 * 2 * Math.SQRT2 - 6 * DIKE_R * Math.sin(DIKE_SWING) },
], [[0, 0], [1, 0]], 1);

type Block = [number, number, number, number];
/**
 * A point on the hub's round: so far out from its middle at that angle (degrees: 0 is west, -90 south), and so far on
 * round it from there, south toward west; or, `bare`, that alone, not from the hub's middle.
 */
const round = (r: number, deg: number, on = 0, bare = false): Vec2 => {
  const a = (deg * P) / 180, [cx, cz] = bare ? [0, 0] : HUB;
  return [cx + Math.cos(a) * r - Math.sin(a) * on, cz + Math.sin(a) * r + Math.cos(a) * on];
};
/** Which way is on round the hub at that angle, south toward west. */
const across = (deg: number): Vec2 => round(0, deg, 1, true);
/** The clowns' show at the hub: its bleachers, stage and cannon as [inner radius, outer, angle, half across], and its clowns. */
const SHOW: { bleachers: Block; stage: Block; cannon: Block; clowns: { at: Vec2; eight?: Vec2; ring?: number; speed: number; start: number }[] } = {
  bleachers: [18.5, 23.5, -45, 2.6],
  stage: [11.2, 15.6, -84, 2.4],
  cannon: [11.4, 14.6, -12, 1.8],
  clowns: [
    { at: [19.8, -86], eight: [2.8, 3], speed: 1.9, start: 0 },
    { at: [14.4, -45], eight: [2.5, 3], speed: 2.3, start: 5 },
    { at: [16.5, -28], ring: 1.6, speed: 2.0, start: 3 },
    { at: [19.6, -10], eight: [2.8, 3], speed: 2.5, start: 8 },
  ],
};

/** The way through it, for the map and the drivers that test it. */
export const QUEUE_ROUTE: Vec2[] = [
  [gx, 22], [gx - 1.5, 32], [QUEUE[0].x, QUEUE[0].z - 5], ...QUEUE.filter((_, k) => k % 3 === 0).map((p) => [p.x, p.z] as Vec2), [gx, gz + 3], [gx - 2.6, gz + 7.5], [gx - 3.9, gz + 11], [gx - 3.9, gz + 16.5], [gx - 2, gz + 21], [gx + 1.6, gz + 25.5], [gx + 3.4, gz + 30], [gx + 3.8, gz + 38], [gx + 3, STREET.z1 - 4],
  // Out by the edge past the stage, in along the beds past the bleachers, out past the cannon to the teacups.
  [gx + 5, STREET.z1 + 3], round(18.8, -74), round(15.2, -56), round(14.6, -42), round(15.6, -26), round(18.6, -10), [HUB[0] + HUB_R, HUB[1] + 1],
];

export function front(s: ParkSite): void {
  const { props, signs, crowds, relief } = s;
  const object = (kind: Parameters<typeof put>[1], x: number, z: number, rotY = 0, y = 0) => put(s, kind, x, z, rotY, y);

  // ------------------------------------------------------------------------------------------------------------------
  // The coaches' bay: the coaches nose in to the kerb in a row either side of the way in, painted bays between them; out
  // of two bays the coach has gone to park, and its party stands there round the guide's flag. The kerb's bollards; flags
  // on poles; the ticket booths either side of the queue's mouth with their prices up and a queue at each window; the
  // hawkers' carts; the family from the coach. The car park beyond it to the west, full.
  const LIVERIES = [0xf2efe6, 0x2f6fb0, 0xd23a32, 0x4fa86a, 0x8a5ac8, 0xf2a52e, 0x2a6a8a];
  for (const side of [-1, 1]) for (let k = 0; k < 6; k++) {
    const x = gx + side * (12.5 + k * 4.2), z = 25.6;
    for (const dx of [-2.1, 2.1]) s.decals.push({ pos: [x + dx, z], size: [0.14, 11], color: 0xf2f2ee });
    if ((side < 0 && k === 2) || (side > 0 && k === 4)) {
      // The bay its coach has left: the party off it, the guide's flag held up over them.
      crowds.push({ area: [x - 1.8, z - 4, x + 1.8, z + 4], count: 12, y: 0 });
      bar(props, [x + 0.6, 0, z + 2], [x + 0.6, 3.2, z + 2], 0.025, 0x8a8f96, { ghost: true });
      box(props, x + 0.62, 2.5, z + 1.98, x + 1.5, 3.1, z + 2.02, side < 0 ? 0xf2a52e : 0x3fb0e0, { ghost: true });
      continue;
    }
    props.push({ shape: 'box', size: [1.25, 1.45, 5.2], pos: [x, 1.65, z], rot: [0, 0, 0], color: LIVERIES[(k * 3 + (side > 0 ? 2 : 0)) % LIVERIES.length], vehicle: 'bus', mapColor: 0x6a7480 });
    if (k % 2 === 0) crowds.push({ area: [x + 1.4, z + 1.5, x + 2.2, z + 4.5], count: 3, y: 0 });
  }
  for (let x = -36; x <= 36; x += 3) if (Math.abs(x) > 8) object('bollard', gx + x, gz - 136);
  for (const x of [-34, -26, 26, 34]) for (const z of [-132, -124]) {
    bar(props, [gx + x, 0, gz + z], [gx + x, 7, gz + z], 0.07, 0xd8dce0);
    box(props, gx + x + 0.08, 4.8, gz + z - 0.02, gx + x + 1.9, 6.8, gz + z + 0.02, [0xe8544a, 0xf2c12e, 0x3f7fd0, 0x4fa86a][((x + z) / 2 + 100) % 4 | 0], { ghost: true });
  }
  // The ticket booths: one either side of the mouth of the queue, windows to the bay, a queue for each window.
  for (const side of [-1, 1]) {
    const x = MOUTH_X + side * 10.5, z = gz - 125.4;
    kiosk(props, signs, { at: [x, z], yaw: P, half: [4.2, 2.4], high: 3.4, wall: 0xf2e6cc, trim: 0xffffff, roof: 'flat', roofColor: 0x3f7fd0, name: '售票處', front: 'counter', awning: [0x3f7fd0, 0xffffff] });
    bar(props, [x + side * 5.6 - 1.4, 0, z - 1], [x + side * 5.6 - 1.4, 2.6, z - 1], 0.06, 0x5a6068);
    bar(props, [x + side * 5.6 + 1.4, 0, z - 1], [x + side * 5.6 + 1.4, 2.6, z - 1], 0.06, 0x5a6068);
    signs.push({ pos: [x + side * 5.6, 2.0, z - 1.06], rotY: P, kind: 'name', text: '全票 899 元', colors: ['#ffffff', '#2a3a48', '#d23a32'], wide: 2.7 });
    for (const dx of [-2.4, 0, 2.4]) crowds.push({ area: [x + dx - 0.4, z - 6.5, x + dx + 0.4, z - 3.2], count: 4, y: 0 });
  }
  object('balloonCart', gx + 6, gz - 134, -0.4);
  object('popcornCart', MOUTH_X - 6.5, gz - 131, 0.3);
  object('mascotBear', MOUTH_X + 5.2, gz - 126.5, -0.2);
  for (let k = 0; k < 4; k++) object('stroller', gx - 17.5 - k * 0.85, gz - 133, -0.1);
  crowds.push({ area: [gx - 20, gz - 135, gx + 20, gz - 130], count: 24, y: 0 });
  // The bay's edges: the park's fence along the road on the south, the car park's hedge on the west, the wall of the back
  // of house on the east.
  box(props, 0, 0, 0, 448, 2.0, 0.6, 0x5a6a5a, { mapColor: 0x4a5a4a });
  planter(props, gx + 39.6, 0.6, gx + 40.4, gz - 124, 1.0);
  box(props, 159.6, 0, 0.6, 160, 2.6, 176, 0xb8b4a8, { mapColor: 0x8a8680 });
  // The car park: its aisles north and south, a row of bays either side of each, the cars in them nose to the islands of
  // trees between; a lamp at the end of each aisle. Past it on the west, the coaches' park, and grass with trees.
  {
    const COLORS = [0xe8e6de, 0x2a2c30, 0xb8bcc0, 0xc8372d, 0x2f62a8, 0x6a6e72, 0xf2efe6, 0x3f6a4a];
    let n = 0;
    const AISLES = [gx + 52, gx + 76, gx + 100, gx + 124];
    for (const x of AISLES) for (const side of [-1, 1]) for (let z = 16; z < 150; z += 3.2) {
      const cx = x + side * 5.7;
      s.decals.push({ pos: [cx, z - 1.6], size: [5.4, 0.12], color: 0xf2f2ee });
      if ((n++ * 7) % 20 < 9 && z > 30 && z < 140) props.push({ shape: 'box', size: [0.9, 0.65, 2.1], pos: [cx, 0.83, z], rot: [0, side > 0 ? -P / 2 : P / 2, 0], color: COLORS[n % COLORS.length], vehicle: 'car' });
    }
    for (const x of AISLES) for (const z of [12, 154]) object('lamp', x, z);
    for (let k = 0; k < AISLES.length - 1; k++) {
      const x = (AISLES[k] + AISLES[k + 1]) / 2;
      box(props, x - 1.4, 0, 16, x + 1.4, 0.2, 150, 0x6f9e52, { ghost: true, mapColor: 0x6f9e52 });
      for (let z = 20; z < 148; z += 8) {
        props.push({ shape: 'cylinder', size: [0.18, 1.2, 0], pos: [x, 1.2, z], color: 0x6b5238, ghost: true });
        props.push({ shape: 'sphere', size: [2.0, 1.8, 2.0], pos: [x, 3.6, z], color: [0x4f8a4a, 0x5d9a52, 0x447d44][Math.round(z / 8) % 3], ghost: true });
      }
    }
    relief.area([[gx + 136, 0.6], [416, 0.6], [416, gz - 6], [gx + 136, gz - 6]], 0, { tag: 'grass', color: 0x6f9e52, wall: 0x5a7a44 });
    relief.area([[gx + 142, 10], [410, 10], [410, 64], [gx + 142, 64]], 0, { tag: 'paved', color: 0x62666a, wall: 0x55585c });
    for (let k = 0; k < 6; k++) {
      const x = gx + 150 + k * 10, z = 36;
      box(props, x - 1.3, 0.35, z - 6, x + 1.3, 3.4, z + 6, [0x3f7fd0, 0xf2a52e, 0x4fa86a, 0xd23a32, 0xf2efe6, 0x8a5ac8][k], { ghost: true });
      box(props, x - 1.32, 1.6, z - 5.6, x + 1.32, 2.8, z + 4.6, 0x2a3a48, { ghost: true });
      box(props, x - 1.32, 3.4, z - 6.02, x + 1.32, 3.5, z + 6.02, 0xf2efe6, { ghost: true });
    }
    for (let x = gx + 140; x < 414; x += 9) for (const z of [74, 90, 106, 122, 138]) {
      if ((x * 3 + z) % 4 === 0) continue;
      props.push({ shape: 'cylinder', size: [0.2, 1.3, 0], pos: [x + (z % 3), 1.3, z], color: 0x6b5238, ghost: true });
      props.push({ shape: 'sphere', size: [2.4, 2.2, 2.4], pos: [x + (z % 3), 4.0, z], color: [0x4f8a4a, 0x5d9a52, 0x447d44][(x + z) % 3], ghost: true });
    }
  }

  // ------------------------------------------------------------------------------------------------------------------
  // The yard the queue winds across, walled along its sides and across its south end but for the queue's mouth. Three
  // places in it, south to north: the queue under its shade, between planters, people the length of it and what they
  // have with them; the garden, a pond the width of the yard with one way over it, a stone causeway no wider than it has
  // to be, winding, banks down into the water either side and rocks in it (people go over by the footbridge along the
  // wall); and the court before the gate, got up for the opening: a red carpet between stands of flowers, the stage and
  // its chairs, the table of offerings, the ribbon across the way.
  {
    const { x0, x1, z0, z1 } = YARD;
    const half = QUEUE_WIDE / 2;
    const LANE = QUEUE.filter((p) => p.z <= POND.z0 - 3.5);
    for (const x of [x0, x1]) planter(props, x - 0.4, z0, x + 0.4, z1, 1.0);
    planter(props, x0 - 0.4, z0 - 0.8, MOUTH_X - half - 0.4, z0, 1.0);
    planter(props, MOUTH_X + half + 0.4, z0 - 0.8, x1 + 0.4, z0, 1.0);
    // Out from its south corners to the car park's hedge and to the back of house's wall: the planting either side of it shut off.
    planter(props, x1 + 0.4, z0 - 0.8, gx + 40.4, z0, 1.0);
    planter(props, 160, z0 - 0.8, x0 - 0.4, z0, 1.0);
    for (const x of [x0, x1]) for (let z = z0 + 4; z < z1 - 4; z += 8) bar(props, [x, 1.0, z], [x, 2.2, z], 0.04, 0xb8bec4, { ghost: true });
    for (const x of [x0, x1]) rail(props, [{ s: 0, x, y: 0, z: z0, yaw: 0, grade: 0 }, { s: 1, x, y: 0, z: z1, yaw: 0, grade: 0 }], 0, 2.2, 0.04, 0xb8bec4);

    // ---- The queue: its lane between planters, railings on them; then the planters drawn in to the causeway's mouth.
    for (const side of [-1, 1]) {
      along(props, LANE, 0.6, 0.75, 0xe8dcc6, { mapColor: 0x6f9e52 }, side * (half + 0.3), 0.75);
      along(props, LANE, 0.5, 0.5, 0x4f8a3a, { ghost: true }, side * (half + 0.3), 1.3);
      for (let k = 0; k < LANE.length; k += 3) bar(props, beside(LANE[k], side * (half + 0.05), 0.75), beside(LANE[k], side * (half + 0.05), 1.85), 0.035, 0xb8bec4, { ghost: true });
      rail(props, LANE, side * (half + 0.05), 1.85, 0.03, 0xb8bec4);
      rail(props, LANE, side * (half + 0.05), 1.35, 0.025, 0xb8bec4);
      const end = LANE[LANE.length - 1];
      hedge(props, [end.x + side * (half + 0.3), end.z], [MOUTH_X + side * (DIKE_WIDE / 2 + 0.75), POND.z0 - 0.3], 0.6, 0.75);
      // From the mouth along the pond's south bank to the wall: the lawn behind the planters shut off from the water.
      hedge(props, [MOUTH_X + side * (DIKE_WIDE / 2 + 0.75), POND.z0 - 0.3], [side > 0 ? x1 - 0.4 : x0 + 0.4, POND.z0 - 0.3], 0.6, 0.75, 0xf08ac0);
    }
    // The shade over it: a tent canopy at a time, each its own frame, a gap between; two panels pitched up to a ridge
    // along the lane, a valance round the eaves in the other colour, a post at each corner up to the eaves.
    {
      const EAVE = 4.5, RIDGE = 5.3, SPAN = half + 0.6, LONG = 2.9, PITCH = Math.atan((RIDGE - EAVE) / SPAN);
      for (let k = 4, n = 0; k < LANE.length - 4; k += 7, n++) {
        const p = LANE[k];
        const [cloth, trim] = n % 2 ? [0xf2efe6, 0xe8544a] : [0xe8544a, 0xf2efe6];
        for (const side of [-1, 1]) {
          props.push({ shape: 'box', size: [SPAN / 2 / Math.cos(PITCH) + 0.04, 0.05, LONG], pos: beside(p, side * SPAN / 2, (EAVE + RIDGE) / 2), rot: alongRot(p.yaw, 0, -side * PITCH), color: cloth, ghost: true, fade: true, overhead: true });
          props.push({ shape: 'box', size: [0.03, 0.22, LONG], pos: beside(p, side * SPAN, EAVE - 0.2), rot: alongRot(p.yaw, 0), color: trim, ghost: true, fade: true, overhead: true });
          for (const dk of [-3, 3]) {
            const q = LANE[k + dk];
            bar(props, beside(q, side * (half + 0.3), 1.25), beside(q, side * (half + 0.3), EAVE), 0.07, 0xd8dce0, { ghost: true, fade: true });
          }
        }
        props.push({ shape: 'box', size: [0.08, 0.08, LONG], pos: beside(p, 0, RIDGE + 0.02), rot: alongRot(p.yaw, 0), color: trim, ghost: true, fade: true, overhead: true });
      }
    }
    // The people waiting in it, two and three abreast: the queue is theirs, the truck in it with them. What they have
    // with them stands where they stood: pushchairs, a cool box, the cut-out they were being photographed with.
    for (let k = 4; k < LANE.length - 1; k += 3) {
      const p = LANE[k];
      crowds.push({ area: [p.x - 1.3, p.z - 1.3, p.x + 1.3, p.z + 1.3], count: 3, y: 0 });
    }
    for (const [k, across, kind] of [[7, -1.6, 'stroller'], [12, 1.8, 'iceChest'], [17, -0.6, 'stroller'], [22, 1.5, 'cutout'], [26, -1.7, 'iceChest'], [29, 0.8, 'stroller']] as const) {
      const [x, , z] = beside(LANE[k], across);
      object(kind, x, z, LANE[k].yaw + across);
    }
    // On the outside of each bend, a misting fan; a drinks machine and its bin where the lane straightens.
    LANE.forEach((p, k) => {
      if (k < 2 || k > LANE.length - 3) return;
      const turn = Math.atan2(Math.sin(LANE[k + 1].yaw - LANE[k - 1].yaw), Math.cos(LANE[k + 1].yaw - LANE[k - 1].yaw));
      if (Math.abs(turn) < 0.15 || k % 5 !== 0) return;
      const out = turn > 0 ? -1 : 1;
      const [x, , z] = beside(p, out * (half - 0.7));
      object('mistFan', x, z, p.yaw + (out > 0 ? -P / 2 : P / 2));
    });
    {
      const [x, , z] = beside(LANE[16], half - 0.6);
      object('vending', x, z, LANE[16].yaw - P / 2);
      const [bx, , bz] = beside(LANE[18], half - 0.5);
      object('bin', bx, bz);
    }
    {
      const p = QUEUE[0];
      const [x, , z] = beside(p, half + 1.6, 0);
      signs.push({ pos: [x, 2.2, z], rotY: p.yaw + P, kind: 'name', text: '入園 等候 60 分', colors: ['#2a3a48', '#f2c12e', '#f2efe6'], wide: 3.8 });
    }
    // Either side of the lane, lawn to the walls; west of it the flower clock, tilted up to the queue.
    for (const side of [-1, 1]) {
      const edge = LANE.map((p) => { const [x, , z] = beside(p, side * (half + 0.7)); return [x, z] as [number, number]; });
      const wall = side > 0 ? x1 - 0.4 : x0 + 0.4;
      relief.area([...edge, [wall, POND.z0 - 0.6], [wall, edge[0][1]]], 0, { tag: 'grass', color: 0x6f9e52, wall: 0x5a7a44 });
    }
    {
      const [cx, cz, lean] = [209.5, 62, 0.5];
      const n: [number, number, number] = [-Math.sin(lean), Math.cos(lean), 0];
      const at = (up: number): [number, number, number] => [cx + n[0] * up, 0.3 + 3.6 * Math.sin(lean) + n[1] * up, cz];
      for (const [r, up, color] of [[3.6, 0, 0xb8b0a0], [3.3, 0.06, 0xe8544a], [2.5, 0.12, 0xf2c12e], [1.7, 0.18, 0xf2efe6], [0.9, 0.24, 0x8a5ac8]] as const) {
        props.push({ shape: 'cylinder', size: [r, 0.04, 0], pos: at(up), rot: [0, 0, lean], color, ghost: up > 0, mapColor: up > 0 ? undefined : 0x6f9e52 });
      }
      // The bank it lies on: a slab of lawn tilted the same, its top under the clock, the rest of it in the ground.
      props.push({ shape: 'box', size: [3.9, 1.2, 3.9], pos: at(-1.22), rot: [0, 0, lean], color: 0x6f9e52, ghost: true, mapColor: 0x6f9e52 });
      const [px, py, pz] = at(0.32);
      props.push({ shape: 'box', size: [0.08, 0.03, 1.3], pos: [px, py, pz + 1.3], rot: [0, 0, lean], color: 0x2a2c30, ghost: true });
      props.push({ shape: 'box', size: [0.9, 0.03, 0.08], pos: [px + Math.cos(lean) * 0.9, py + Math.sin(lean) * 0.9, pz], rot: [0, 0, lean], color: 0x2a2c30, ghost: true });
      signs.push({ pos: [cx - 3.9, 0.7, cz], rotY: -P / 2, kind: 'name', text: '幸福島樂園', colors: ['#4f8a3a', '#ffffff', '#f2c12e'], wide: 3.6 });
      for (const dz of [-6, 6]) for (let k = 0; k < 4; k++) object(k % 2 ? 'flowerPotYellow' : 'flowerPotBloom', cx - 2 + k * 1.4, cz + dz);
    }
    for (const [x, z, kind] of [[212.4, 52, 'palm'], [212.4, 73, 'tree'], [185.6, 51, 'palm'], [185.6, 69, 'palm'], [205.5, 76, 'tree']] as const) object(kind, x, z);

    // ---- The garden: the pond, wall to wall; the causeway over it; the banks; the ways up out of the water at its north end.
    {
      const STONE: Look = { tag: 'paving', color: 0xcfc6b4, wall: 0x8a8478 };
      const BED: Look = { tag: 'pond', color: 0x5f7f6c, wall: 0x8a8478 };
      const BANK: Look = { tag: 'pond', color: 0x8f9a80, wall: 0x8a8478 };
      relief.area([[POND.x0, POND.z0], [POND.x1, POND.z0], [POND.x1, POND.z1], [POND.x0, POND.z1]], POND.bed, BED);
      const at0 = { ...QUEUE[0], x: gx, yaw: 0 };
      const way = [{ ...at0, x: MOUTH_X, z: POND.z0 }, ...QUEUE.filter((p) => p.z > POND.z0 + 0.3 && p.z < POND.z1 - 0.3), { ...at0, z: POND.z1 }];
      const low = new Set<string>();
      const key = (x: number, z: number) => `${x.toFixed(3)},${z.toFixed(3)}`;
      const height = (x: number, z: number) => (low.has(key(x, z)) ? POND.bed : 0);
      const edge = (p: (typeof way)[number], side: number, out: number): [number, number] => { const [x, , z] = beside(p, side * (DIKE_WIDE / 2 + out)); return [x, z]; };
      for (let k = 0; k < way.length - 1; k++) {
        const a = way[k], b = way[k + 1];
        relief.area([edge(a, 1, 0), edge(a, -1, 0), edge(b, -1, 0), edge(b, 1, 0)], 0, STONE);
        for (const side of [-1, 1]) {
          const toe = [edge(a, side, DIKE_BANK), edge(b, side, DIKE_BANK)];
          for (const t of toe) low.add(key(t[0], t[1]));
          relief.area([edge(a, side, 0), edge(b, side, 0), toe[1], toe[0]], height, BANK);
        }
      }
      // The ways out, either side of the causeway's north end: stone ramps up from the bed to the court.
      for (const side of [-1, 1]) {
        const xa = gx + side * 4.4, xb = gx + side * 9.8;
        relief.area([[Math.min(xa, xb), POND.z1 - POND.ramp], [Math.max(xa, xb), POND.z1 - POND.ramp], [Math.max(xa, xb), POND.z1], [Math.min(xa, xb), POND.z1]], (_x, z) => POND.bed * Math.min(1, Math.max(0, (POND.z1 - z) / POND.ramp)), STONE);
      }
      s.pools.push({ area: [POND.x0, POND.z0, POND.x1, POND.z1], surface: POND.water, tint: 0x4f9c8c, flow: [0.02, 0.01] });
      // Deep enough that a truck in it has its load in the water: what floats goes off across the pond, what does not goes down.
      s.stillWater.push({ area: [POND.x0, POND.z0, POND.x1, POND.z1], surface: POND.water, outlet: [POND.x1 - 3, 97], drift: 0.25 });
      s.fords.push({ pos: [(POND.x0 + POND.x1) / 2, (POND.z0 + POND.z1) / 2], half: [(POND.x1 - POND.x0) / 2, (POND.z1 - POND.z0) / 2], flow: [0, 0], surface: POND.water, drag: 0.4, y: POND.bed });
      // Its edge stones, drawn: a darker course along each side of the causeway, a post and a rope at the bends' outsides
      // (low, and nothing to a truck).
      for (const side of [-1, 1]) {
        along(props, way, 0.3, 0.05, 0x9a9284, { ghost: true }, side * (DIKE_WIDE / 2 - 0.15), 0.03);
        for (let k = 3; k < way.length - 2; k += 4) {
          const [x, , z] = beside(way[k], side * (DIKE_WIDE / 2 - 0.12));
          props.push({ shape: 'cylinder', size: [0.07, 0.2, 0], pos: [x, 0.2, z], color: 0x6a4a30, ghost: true });
        }
        rail(props, way.slice(3, -2), side * (DIKE_WIDE / 2 - 0.12), 0.34, 0.02, 0xd8c8a0);
      }
      /** Something standing on the bed, in the water: as solid and as heavy as on land. */
      const wade = (kind: Parameters<typeof put>[1], x: number, z: number, rotY = 0) => s.objects.push({ kind, pos: [x, POND.bed, z], rotY, wading: true });
      // Rocks in the water where the causeway bends, off the outside of each bend and the inside: what is slid into.
      const DIKE = QUEUE.filter((p) => p.z > POND.z0 + 4 && p.z < POND.z1 - POND.ramp - 2);
      for (let k = 5; k < DIKE.length; k += 6) for (const side of [-1, 1]) {
        if ((k / 6 + (side > 0 ? 1 : 0)) % 2 < 1) continue;
        const [x, , z] = beside(DIKE[k], side * (DIKE_WIDE / 2 + DIKE_BANK + 1.5 + (k % 5) * 0.3));
        wade('boulder', x, z, k * 1.3);
        const [x2, , z2] = beside(DIKE[k], side * (DIKE_WIDE / 2 + DIKE_BANK + 3.2));
        wade('rockSmall', x2, z2 + 0.9, k * 0.7);
      }
      const clear = (x: number, z: number, by: number) => x > POND.x0 + 3 && x < POND.x1 - 1 && way.every((p) => Math.hypot(p.x - x, p.z - z) > DIKE_WIDE / 2 + DIKE_BANK + by) && !(z > POND.z1 - POND.ramp - 1 && Math.abs(x - gx) < 10.5);
      /** Clear of the causeway, and of what already stands in the water. */
      const room = (x: number, z: number, by: number) => clear(x, z, by) && s.objects.every((o) => !o.wading || Math.hypot(o.pos[0] - x, o.pos[2] - z) > 2.8);
      // The garden's rocks, set in threes as a garden's are, a big one and two at its foot, all across the bed: driven
      // into the water, the truck is among them all the way to the ways out.
      for (let row = 0, z = POND.z0 + 4; z < POND.z1 - POND.ramp - 3; row++, z += 6.5) {
        for (let x = POND.x0 + 4 + (row % 2) * 3.3; x < POND.x1 - 1.5; x += 6.6) {
          const jx = x + Math.sin(row * 2.7 + x) * 0.9, jz = z + Math.cos(row * 1.9 + x * 0.7) * 0.9;
          if (!room(jx, jz, 1.4)) continue;
          wade('boulder', jx, jz, row + x);
          wade('rockSmall', jx + 1.3, jz + 0.8, x);
          wade('rockSmall', jx - 0.9, jz - 1.2, row);
        }
      }
      // Before each way up out of the water, a rock in the way and a lantern either side of its foot: come at it round them.
      for (const side of [-1, 1]) {
        const mid = gx + side * 7.1, foot = POND.z1 - POND.ramp;
        wade('boulder', mid - side * 0.6, foot - 4, side);
        wade('stoneLantern', gx + side * 10.7, foot - 0.5, side);
        wade('stoneLantern', gx + side * 5.1, foot - 2.6, -side);
      }
      // Lily pads in drifts, a lotus among them here and there; carp under the surface, gold and white and red.
      for (let n = 0; n < 150; n++) {
        const x = POND.x0 + 1.5 + ((n * 37) % 270) / 10, z = POND.z0 + 1.5 + ((n * 61) % 510) / 10;
        if (!clear(x, z, 0.4) || (Math.sin(x * 0.45) + Math.cos(z * 0.38) < 0.35)) continue;
        props.push({ shape: 'cylinder', size: [0.3 + (n % 3) * 0.09, 0.008, 0], pos: [x, POND.water + 0.012, z], color: n % 4 ? 0x4f9a4a : 0x6fae52, ghost: true });
        if (n % 5 === 0) props.push({ shape: 'cone', size: [0.14, 0.12, 0], pos: [x + 0.1, POND.water + 0.14, z], color: n % 10 ? 0xf6a8c8 : 0xffffff, ghost: true });
      }
      for (let n = 0; n < 60; n++) {
        const x = POND.x0 + 2 + ((n * 53) % 260) / 10, z = POND.z0 + 2 + ((n * 29) % 500) / 10;
        if (!clear(x, z, 0.2)) continue;
        props.push({ shape: 'sphere', size: [0.1, 0.05, 0.3], pos: [x, POND.water - 0.06, z], rot: [0, n * 1.7, 0], color: [0xf28a2e, 0xf7f4ee, 0xd23a32, 0xf2c12e][n % 4], ghost: true });
      }
      // Stone lanterns standing in the water on their legs; the rockery against the west wall, water down its face.
      for (const [x, z] of [[190.5, 90], [209, 122], [188.5, 118], [207, 96], [192, 104]] as const) {
        if (room(x, z, 1.2)) wade('stoneLantern', x, z, x);
      }
      {
        const [rx, rz] = [POND.x1 - 2.2, 97];
        for (const [dx, dz, w, h, d, r, c] of [[0, 0, 2.2, 1.6, 4.5, 0.1, 0x8a8478], [0.4, -1.2, 1.6, 2.6, 2.4, 0.3, 0x9a9488], [0.5, 1.6, 1.4, 2.1, 2.0, -0.2, 0x7d7a72], [-1.4, 0.4, 1.0, 0.9, 2.6, 0.5, 0x9a9488], [0.7, 0.2, 1.0, 3.3, 1.4, 0.15, 0x8a8478]] as const) {
          props.push({ shape: 'box', size: [w, h, d], pos: [rx + dx, POND.bed + h * 0.8, rz + dz], rot: [0.06, r, 0.05], color: c, mapColor: 0x8a8478 });
        }
        props.push({ shape: 'box', size: [0.05, 1.3, 0.7], pos: [rx - 1.15, POND.bed + 1.9, rz + 0.2], rot: [0, 0, -0.12], color: 0xbfe6ee, ghost: true });
        s.fountains.push([rx - 2.2, POND.water, rz + 0.2]);
      }
      s.fountains.push([189, POND.water, 106]);
      // The people's way over: a footbridge of timber on piles along the east wall, steps at its ends; they stand on it
      // looking down at the carp.
      {
        const xa = POND.x0, xb = POND.x0 + 2.2, top = 1.1;
        box(props, xa, top - 0.25, POND.z0 + 1.5, xb, top, POND.z1 - 1.5, 0xa8804e, { mapColor: 0xa8804e });
        for (let z = POND.z0 + 3; z < POND.z1 - 2; z += 5.5) for (const x of [xa + 0.25, xb - 0.25]) props.push({ shape: 'cylinder', size: [0.14, (top - 0.25 - POND.bed) / 2, 0], pos: [x, (top - 0.25 + POND.bed) / 2, z], color: 0x6a4a30 });
        for (let z = POND.z0 + 1.5; z <= POND.z1 - 1.4; z += 2.2) props.push({ shape: 'box', size: [0.06, 0.5, 0.06], pos: [xb - 0.06, top + 0.5, z], color: 0xc8372d, ghost: true });
        box(props, xb - 0.1, top + 0.95, POND.z0 + 1.5, xb - 0.02, top + 1.05, POND.z1 - 1.5, 0xc8372d, { ghost: true });
        box(props, xb - 0.09, top + 0.5, POND.z0 + 1.5, xb - 0.03, top + 0.56, POND.z1 - 1.5, 0xc8372d, { ghost: true });
        for (const [za, zb] of [[POND.z0 - 1.4, POND.z0 + 1.5], [POND.z1 - 1.5, POND.z1 + 1.4]]) for (let k = 0; k < 4; k++) {
          const t0 = k / 4, t1 = (k + 1) / 4, out = za < POND.z0 ? 1 : -1;
          const zs = out > 0 ? [za + (zb - za) * t0, za + (zb - za) * t1] : [zb - (zb - za) * t1, zb - (zb - za) * t0];
          box(props, xa, 0, zs[0], xb, top * (k + 1) / 4, zs[1], 0x9a7448, { mapColor: 0xa8804e });
        }
        crowds.push({ area: [xa + 0.4, POND.z0 + 4, xb - 0.5, POND.z1 - 4], count: 14, y: 0, raised: top - POND.bed, fenced: true });
      }
      // At the causeway's mouth, who it is for.
      for (const dx of [-1, 1]) bar(props, [MOUTH_X - DIKE_WIDE / 2 - 1.5 + dx * 1.3, 0.75, POND.z0 - 0.3], [MOUTH_X - DIKE_WIDE / 2 - 1.5 + dx * 1.3, 3.0, POND.z0 - 0.3], 0.04, 0x5a6068, { ghost: true });
      signs.push({ pos: [MOUTH_X - DIKE_WIDE / 2 - 1.5, 2.5, POND.z0 - 0.36], rotY: P, kind: 'name', text: '賞鯉堤 車輛慢行', colors: ['#2f6a4a', '#ffffff', '#f2c12e'], wide: 3.0 });
    }

    // ---- The court before the gate, on the park's opening day.
    {
      const zc = POND.z1;
      // Along the pond's north bank, a stone kerb, but at the causeway and the ways up out of the water.
      for (const [xa, xb] of [[POND.x0 + 2.3, gx - 9.8], [gx - 4.4, gx - DIKE_WIDE / 2 - 0.2], [gx + DIKE_WIDE / 2 + 0.2, gx + 4.4], [gx + 9.8, x1 - 0.4]]) {
        box(props, xa, 0, zc + 0.1, xb, 0.55, zc + 0.5, 0xd8d0c0, { mapColor: 0x8a8478 });
        box(props, xa - 0.04, 0.55, zc + 0.06, xb + 0.04, 0.63, zc + 0.54, 0xb8b0a0, { ghost: true });
      }
      // The red carpet to the gate; stands of flowers down both sides of it, sent for the day; balloons at its head.
      box(props, gx - 2.6, 0.0, zc + 2.5, gx + 2.6, 0.025, gz - 2, 0xb8302a, { ghost: true });
      for (const side of [-1, 1]) {
        box(props, gx + side * 2.6 - 0.08, 0.0, zc + 2.5, gx + side * 2.6 + 0.08, 0.03, gz - 2, 0xd4a83a, { ghost: true });
        for (let z = zc + 3.4; z < 156; z += 2.1) object('flowerStand', gx + side * 3.5, z, side > 0 ? -P / 2 : P / 2);
        object('balloonColumn', gx + side * 3.6, zc + 1.6);
        object('balloonColumn', gx + side * 3.4, 157.2);
        for (const z of [153.6, 155.4]) object('firecrackers', gx + side * 4.5, z, side > 0 ? P : 0);
      }
      // The ribbon across it, waiting for the scissors.
      object('ribbonPost', gx - 2.5, 157, 0);
      object('ribbonPost', gx + 2.5, 157, P);
      // West of the carpet, the stage: its board up behind it, those who are to speak on it; chairs before it in rows,
      // the guests in them; loudspeakers at its corners.
      {
        const sx0 = gx + 7.2, sx1 = x1 - 0.5, sz0 = zc + 4, sz1 = zc + 15;
        box(props, sx0, 0, sz0, sx1, 0.8, sz1, 0x6a4a30, { mapColor: 0x8a6a40 });
        box(props, sx0 - 0.03, 0.05, sz0 - 0.03, sx0, 0.76, sz1 + 0.03, 0xb8302a, { ghost: true });
        box(props, sx1 - 0.35, 0.8, sz0, sx1, 5.2, sz1, 0x2a3a48, { mapColor: 0x2a3a48 });
        signs.push({ pos: [sx1 - 0.4, 3.6, (sz0 + sz1) / 2], rotY: -P / 2, kind: 'name', text: '盛大開幕', colors: ['#b8302a', '#f2c12e', '#f7f4ee'], wide: 7 });
        signs.push({ pos: [sx1 - 0.4, 1.9, (sz0 + sz1) / 2], rotY: -P / 2, kind: 'name', text: '幸福島樂園 開幕典禮', colors: ['#2a3a48', '#ffffff', '#f2c12e'], wide: 6 });
        for (const z of [sz0 + 0.7, sz1 - 0.7]) box(props, sx0 + 0.2, 0.8, z - 0.45, sx0 + 1.0, 2.3, z + 0.45, 0x1c1c1c, { ghost: true });
        box(props, sx0 + 1.4, 0.8, (sz0 + sz1) / 2 - 0.35, sx0 + 1.9, 1.9, (sz0 + sz1) / 2 + 0.35, 0x8a6a40, { ghost: true });
        crowds.push({ area: [sx0 + 2.4, sz0 + 1.5, sx1 - 1, sz1 - 1.5], count: 6, y: 0, raised: 0.8, fenced: true, clothes: [0x2a3a48, 0x1c1c1c, 0x5a6068, 0xb8302a] });
        for (let r = 0; r < 2; r++) for (let z = sz0 + 0.8; z < sz1 - 0.3; z += 1.15) object('chair', sx0 - 1.3 - r * 1.2, z, P / 2);
        crowds.push({ area: [sx0 - 3.1, sz0, sx0 - 0.6, sz1], count: 9, y: 0 });
        for (const z of [sz0 - 1.2, sz1 + 1.2]) object('balloonColumn', sx0 + 0.6, z);
      }
      // East of it: the table of offerings for the opening, the furnace for the paper, those at it; the tower of glasses
      // for the toast; the television people.
      {
        const tx = gx - 9.5;
        for (const z of [zc + 5, zc + 6.2, zc + 7.4]) object('offerings', tx, z, P / 2);
        object('paperFurnace', tx - 3.4, zc + 6.2);
        crowds.push({ area: [tx - 2.6, zc + 4.6, tx - 1.2, zc + 7.8], count: 4, y: 0, motion: 'toss', dance: -P / 2 });
        object('champagneTower', gx - 6.4, zc + 12.5);
        for (const [dx, dz] of [[-1.6, 0.8], [-1.8, -1.2]] as const) object('table', gx - 6.4 + dx, zc + 12.5 + dz);
        crowds.push({ area: [gx - 9.6, zc + 10.5, gx - 7.4, zc + 14.5], count: 6, y: 0 });
        object('tvCamera', gx - 5.4, zc + 17.6, P / 2 + 0.5);
        object('lightStand', gx - 6.6, zc + 19.2, P / 2);
        crowds.push({ area: [gx - 7.6, zc + 16.6, gx - 5.8, zc + 18.6], count: 2, y: 0 });
        for (const z of [zc + 3, zc + 16]) object('palm', x0 + 2, z);
      }
      // The park's map on its board, at the east wall.
      {
        const [mx, mz] = [x0 + 0.9, zc + 12];
        for (const dz of [-2.4, 2.4]) bar(props, [mx, 0, mz + dz], [mx, 3.6, mz + dz], 0.08, 0x5a6068);
        box(props, mx - 0.2, 1.0, mz - 2.6, mx, 3.4, mz + 2.6, 0x2a3a48);
        box(props, mx, 1.1, mz - 2.5, mx + 0.02, 3.3, mz + 2.5, 0x8fc46a, { ghost: true });
        for (const [y, z, h, w, color] of [[2.0, 0.6, 0.4, 0.9, 0x4fa8c8], [2.7, -1.4, 0.25, 0.5, 0xe8544a], [1.5, -1.6, 0.25, 0.4, 0xf2a52e], [2.8, 1.6, 0.3, 0.5, 0x8a5ac8], [1.5, 1.8, 0.2, 0.4, 0x3fb0e0]] as const) {
          box(props, mx + 0.02, y - h, mz + z - w, mx + 0.04, y + h, mz + z + w, color, { ghost: true });
        }
        signs.push({ pos: [mx + 0.06, 3.9, mz], rotY: P / 2, kind: 'name', text: '園區導覽', colors: ['#2a3a48', '#ffffff', '#f2c12e'], wide: 3.0 });
      }
    }
    // Outside the yard's walls, the planting: trees in rows to the car park and to the back of house's wall.
    for (let z = z0 + 8; z < z1; z += 10) {
      for (const x of [x0 - 8, x0 - 16]) object(z % 20 < 10 ? 'treeTall' : 'tree', x, z);
      for (const x of [x1 + 8, x1 + 16]) object(z % 20 < 10 ? 'tree' : 'treeTall', x, z);
    }
    // Along the walk outside the yard's east wall, the lockers, bank after bank, for what may not go in; people at them.
    for (let z = z0 + 12; z < z1 - 12; z += 20) {
      const xa = x0 - 5.2, xb = xa + 0.6, za = z - 4, zb = z + 4;
      box(props, xa, 0, za, xb, 2.1, zb, 0xc8ccd0, { mapColor: 0x8a8f96 });
      for (let k = 0; k < 16; k++) box(props, xb, 0.15, za + 0.05 + k * 0.5, xb + 0.02, 2.0, za + 0.48 + k * 0.5, [0x3f7fd0, 0xf2c12e, 0xe8544a, 0x4fa86a][k % 4], { ghost: true });
      for (const y of [0.62, 1.08, 1.54]) box(props, xb, y, za, xb + 0.03, y + 0.04, zb, 0x5a6068, { ghost: true });
      signs.push({ pos: [xb + 0.05, 2.5, z], rotY: P / 2, kind: 'name', text: '寄物櫃', colors: ['#5a6068', '#ffffff', '#f2c12e'], wide: 2.4 });
      bar(props, [xb, 2.1, z - 1.3], [xb, 2.9, z - 1.3], 0.03, 0x5a6068, { ghost: true });
      bar(props, [xb, 2.1, z + 1.3], [xb, 2.9, z + 1.3], 0.03, 0x5a6068, { ghost: true });
      crowds.push({ area: [xb + 0.6, za + 0.5, xb + 2.2, zb - 0.5], count: 5, y: 0 });
    }
    // Along the walk outside its west wall, the groups' queue: two belts the length of it, the parties in it.
    for (const x of [x1 + 1.6, x1 + 5]) for (let z = z0 + 2; z < z1 - 2; z += 2.5) {
      props.push({ shape: 'cylinder', size: [0.05, 0.5, 0], pos: [x, 0.5, z], color: 0x8a8f96, ghost: true });
      props.push({ shape: 'cylinder', size: [0.16, 0.03, 0], pos: [x, 0.03, z], color: 0x5a6068, ghost: true });
      if (z + 2.5 < z1 - 2) box(props, x - 0.02, 0.86, z, x + 0.02, 0.94, z + 2.5, 0x2f6fb0, { ghost: true });
    }
    crowds.push({ area: [x1 + 2, z0 + 3, x1 + 4.6, z1 - 3], count: 40, y: 0 });
    signs.push({ pos: [x1 + 3.3, 2.2, z0 + 1], rotY: P, kind: 'name', text: '團體入園', colors: ['#2f6fb0', '#ffffff', '#f2c12e'], wide: 3.0 });
    for (const x of [x1 + 1.8, x1 + 4.8]) bar(props, [x, 0, z0 + 1.05], [x, 2.6, z0 + 1.05], 0.04, 0x5a6068, { ghost: true });
    // Across its north end before the gate, the bag check: tables set at a slant either side of the way to the wide gate,
    // trays on them, the guards behind; people with their bags open at them. The way to the wide gate left clear between.
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) for (const z of [159.5, 163]) {
      const x = gx + side * (4.6 + k * 3.6);
      object('table', x, z, side * 0.5);
      props.push({ shape: 'box', size: [0.3, 0.04, 0.22], pos: [x, 0.8, z], rot: [0, side * 0.5, 0], color: 0x5a6068, ghost: true });
      crowds.push({ area: [x - 0.6, z + 0.9, x + 0.6, z + 1.6], count: 2, y: 0 });
    }
    for (const side of [-1, 1]) {
      signs.push({ pos: [gx + side * 9, 2.4, 158.2], rotY: P, kind: 'name', text: '安全檢查', colors: ['#2a3a48', '#ffffff', '#f2c12e'], wide: 2.6 });
      for (const dx of [-1.2, 1.2]) bar(props, [gx + side * 9 + dx, 0, 158.3], [gx + side * 9 + dx, 2.9, 158.3], 0.04, 0x5a6068, { ghost: true });
    }
  }

  // ------------------------------------------------------------------------------------------------------------------
  // The gate: the ticket hall each side, its booths' windows to the queue, a canopy; the arch over the gate with the park's
  // name; across it the turnstiles, two lanes of them either side and the wide gate for pushchairs and wheelchairs in the
  // middle, steel rails between. The park's wall on west from the hall to the edge of the map.
  for (const side of [-1, 1]) {
    const xa = gx + side * 8, xb = gx + side * 40;
    box(props, Math.min(xa, xb), 0, gz - 3, Math.max(xa, xb), 4.2, gz + 3, 0xf2e6cc, { fade: true, mapColor: 0xb0a080 });
    box(props, Math.min(xa, xb) - 0.3, 4.2, gz - 4.5, Math.max(xa, xb) + 0.3, 4.6, gz + 3.5, 0x3f7fd0, { ghost: true, fade: true });
    for (let k = 0; k < 5; k++) {
      const x = gx + side * (11 + k * 5.5);
      box(props, x - 1.6, 1.0, gz - 3.06, x + 1.6, 2.6, gz - 3.0, 0x2a3a48, { ghost: true });
      box(props, x - 1.7, 2.7, gz - 3.1, x + 1.7, 3.3, gz - 3.02, [0xe8544a, 0xf2c12e, 0x4fa86a, 0xf08ac0, 0x7fb8ef][k], { ghost: true });
      box(props, x - 1.7, 0.95, gz - 3.4, x + 1.7, 1.0, gz - 3.0, 0xf2efe6, { ghost: true });
    }
  }
  box(props, gx + 40, 0, gz - 0.4, 416, 3.2, gz + 0.4, 0xf2e6cc, { mapColor: 0xb0a080 });
  box(props, gx + 40, 3.2, gz - 0.55, 416, 3.5, gz + 0.55, 0x3f7fd0, { ghost: true });
  for (let x = gx + 52; x < 412; x += 12) box(props, x - 0.5, 0, gz - 0.6, x + 0.5, 3.8, gz + 0.6, 0xe8d8bc, { ghost: true });
  for (const side of [-1, 1]) {
    box(props, gx + side * 8 - 0.9, 0, gz - 1.2, gx + side * 8 + 0.9, 8.5, gz + 1.2, 0xf08ac0, { mapColor: 0xc06090 });
    props.push({ shape: 'sphere', size: [1.0, 1.0, 1.0], pos: [gx + side * 8, 9.3, gz], color: 0xf2c12e, ghost: true });
  }
  box(props, gx - 8, 7.0, gz - 0.6, gx + 8, 8.4, gz + 0.6, 0x3f7fd0, { ghost: true, fade: true, overhead: true });
  signs.push({ pos: [gx, 7.7, gz - 0.65], rotY: P, kind: 'name', text: '幸福島樂園', colors: ['#3f7fd0', '#ffffff', '#f2c12e'], wide: 12 });
  signs.push({ pos: [gx, 7.7, gz + 0.65], rotY: 0, kind: 'name', text: '歡迎再來', colors: ['#3f7fd0', '#ffffff', '#f2c12e'], wide: 8 });
  // The rails: solid steel, waist high. The wide gate between the middle two, a turnstile in each lane either side of it.
  for (const x of [-5.6, -1.85, 1.85, 5.6]) {
    box(props, gx + x - 0.06, 0, gz - 1.6, gx + x + 0.06, 1.0, gz + 1.6, 0xb8bec4, { mapColor: 0x9aa0a6 });
    box(props, gx + x - 0.1, 1.0, gz - 1.65, gx + x + 0.1, 1.08, gz + 1.65, 0xd8dce0, { ghost: true });
  }
  for (const x of [-6.8, -3.7, 3.7, 6.8]) object('turnstile', gx + x, gz + 0.5);
  signs.push({ pos: [gx, 2.0, gz - 1.7], rotY: P, kind: 'name', text: '無障礙通道', colors: ['#2f6fb0', '#ffffff', '#f2efe6'], wide: 3.0 });
  for (const x of [-1.6, 1.6]) bar(props, [gx + x, 1.0, gz - 1.7], [gx + x, 2.4, gz - 1.7], 0.04, 0xd8dce0, { ghost: true });

  // ------------------------------------------------------------------------------------------------------------------
  // The main street: its shops along both sides, their fronts on to it; the carts down its middle; lamps, benches, bins;
  // people crossing from one side to the other, and more about it.
  {
    const SHOPS: [number, number, string, number, number, 'flat' | 'pitched' | 'dome', number, 'counter' | 'shop' | 'toilets'][] = [
      [-1, 177.5, '紀念品店', 0xf6e2c0, 0xd23a32, 'pitched', 4.6, 'shop'], [-1, 188.5, '玩具城', 0xd8ecf2, 0x3f7fd0, 'dome', 4.4, 'shop'], [-1, 199.5, '照相館', 0xf8d8e4, 0xf08ac0, 'flat', 4.4, 'counter'], [-1, 210.5, '糖果屋', 0xfff0dc, 0xf2a52e, 'pitched', 4.4, 'shop'],
      [1, 177.5, '冰淇淋', 0xfff0dc, 0xf08ac0, 'dome', 4.4, 'counter'], [1, 188.5, '爆米花屋', 0xfff4c8, 0xd23a32, 'pitched', 4.6, 'counter'], [1, 199.5, '寄物櫃', 0xe8eef2, 0x5a6068, 'flat', 4.4, 'counter'], [1, 210.5, '服務中心', 0xdce8f6, 0x2f6fb0, 'flat', 4.4, 'shop'],
    ];
    for (const [side, z, name, wall, roofColor, roof, hw, front] of SHOPS) {
      const x = side < 0 ? STREET.x0 - 3.4 : STREET.x1 + 3.4;
      kiosk(props, signs, { at: [x, z], yaw: side < 0 ? P / 2 : -P / 2, half: [hw, 3.2], high: 4.6, wall, trim: 0xffffff, roof, roofColor, name, front, awning: [roofColor, 0xffffff] });
    }
    // Behind the shops, their yards: walled off from the street, and from the canal and the playground.
    box(props, STREET.x0 - 14, 0, STREET.z0 + 1, STREET.x0 - 13.6, 2.4, STREET.z1 - 2, 0xe8dcc6);
    box(props, STREET.x1 + 13.6, 0, STREET.z0 + 1, STREET.x1 + 14, 2.4, STREET.z1 - 2, 0xe8dcc6);
    for (const side of [-1, 1]) for (const z of [183, 194, 205]) {
      const x = side < 0 ? STREET.x0 - 3.4 : STREET.x1 + 3.4;
      box(props, x - 3.2, 0, z - 0.6, x + 3.2, 2.4, z + 0.6, 0xe8dcc6, { ghost: true });
    }
    // The opening parade, drawn up in the street and waiting to set off: two floats abreast on the west side, two more
    // further up on the east, so that the way through goes round the first pair on the east and over to the west past the
    // second; the band between them in its rows, its drums set down at its feet; where the way swings over, on the inside
    // of the swing, the popcorn cart and the gas it pops with.
    for (const [x, z, kind] of FLOATS) float(props, signs, x, z, kind);
    crowds.push({ area: [STREET.x0 + 2.4, BAND[0], STREET.x1 - 2.4, BAND[1]], count: 24, y: 0, dance: 0, clothes: [0xc8372d, 0xc8372d, 0xf7f4ee], hat: 0x2a2c30 });
    for (const [x, z] of [[195.2, BAND[1] + 1.4], [198.2, BAND[1] + 1.6], [201.4, BAND[1] + 1.3], [204.6, BAND[1] + 1.7]] as const) object('bassDrum', x, z, P / 2);
    // The band leader out in front of it on a box.
    box(props, gx - 0.5, 0, BAND[1] + 3.2, gx + 0.5, 0.5, BAND[1] + 4.2, 0xc8372d, { ghost: true });
    crowds.push({ area: [gx - 0.3, BAND[1] + 3.4, gx + 0.3, BAND[1] + 4], count: 1, y: 0, raised: 0.5, dance: P, clothes: [0xf7f4ee], hat: 0xc8372d, fenced: true });
    object('popcornCart', FLOATS[0][0] - 0.2, FLOATS[0][1] + 6.4, -0.5);
    object('gasCylinder', FLOATS[0][0] - 1.5, FLOATS[0][1] + 6.0);
    object('iceCreamCart', FLOATS[2][0] + 3.6, FLOATS[2][1] - 6.4, 0.4);
    object('balloonCart', FLOATS[3][0] + 0.2, FLOATS[3][1] + 6.4, P / 2);
    for (const [x, z] of [[FLOATS[0][0] - 2.3, FLOATS[0][1] - 5.2], [FLOATS[2][0] + 2.3, FLOATS[2][1] + 5.4], [FLOATS[1][0] + 0.2, FLOATS[1][1] + 5.6]] as const) object('balloonColumn', x, z);
    object('mascotBear', 195.4, 178.5, 0.5);
    object('cutout', 194.6, 181, 0.9);
    for (let k = 0; k < 3; k++) object('stroller', 205.6 - k * 0.9, 211.5, 0.2);
    const floated = (x: number, z: number) => FLOATS.some(([fx, fz]) => Math.abs(x - fx) < 2.6 && Math.abs(z - fz) < 5.2);
    for (let z = STREET.z0 + 4; z < STREET.z1 - 2; z += 9) {
      if (!floated(STREET.x0 + 0.8, z)) object('parkLamp', STREET.x0 + 0.8, z);
      if (!floated(STREET.x1 - 0.8, z + 4.5)) object('parkLamp', STREET.x1 - 0.8, z + 4.5);
    }
    crowds.push({ area: [STREET.x0 + 0.5, STREET.z0 + 2, STREET.x0 + 2, FLOATS[2][1] - 6], count: 10, y: 0 }, { area: [STREET.x1 - 2, FLOATS[0][1] + 6, STREET.x1 - 0.5, STREET.z1], count: 10, y: 0 });
    for (const x of [STREET.x0 + 1.2, STREET.x1 - 1.2]) for (let z = STREET.z0 + 2; z < STREET.z1; z += 6) if (!floated(x, z + 2)) object('flowerPotBloom', x, z + 2);
    // Bunting across the street from eave to eave, over everything.
    for (let z = STREET.z0 + 5; z < STREET.z1; z += 7.5) {
      bar(props, [STREET.x0 - 0.2, 5.2, z], [STREET.x1 + 0.2, 5.2, z], 0.015, 0xf2efe6, { ghost: true });
      for (let x = STREET.x0 + 0.6; x < STREET.x1; x += 1.2) props.push({ shape: 'cone', size: [0.22, 0.22, 0], pos: [x, 4.96, z], rot: [P, 0, 0], color: [0xe8544a, 0xf2c12e, 0x3f7fd0, 0x4fa86a, 0xf08ac0][Math.round(x / 1.2 + z) % 5], ghost: true });
    }
  }

  // ------------------------------------------------------------------------------------------------------------------
  // The hub: round, the carousel turning in its middle in a ring of flower beds, the way in from the main street on the
  // south and out to the teacups on the west; planters round its edge but for the people's ways off it, too narrow for the
  // truck, to the lakeside walk on the north and the bridge over the canal on the east. Shops round its southern half.
  {
    const [hx, hz] = HUB;
    relief.area(Array.from({ length: 32 }, (_, k) => [hx + Math.cos((k / 32) * P * 2) * (HUB_R + 1), hz + Math.sin((k / 32) * P * 2) * (HUB_R + 1)] as [number, number]), 0, { tag: 'paving', color: 0xe2cfae, wall: 0x9a8e7a });
    // Its paving laid in rings, a lighter ring and a darker.
    for (const [r, c, y] of [[HUB_R - 2, 0xd4bf9c, 0.02], [HUB_R - 2.6, 0xe2cfae, 0.025], [13, 0xc8b08a, 0.03], [12.4, 0xe2cfae, 0.035]] as const) props.push({ shape: 'cylinder', size: [r, 0.01, 0], pos: [hx, y, hz], color: c, ghost: true });
    s.rigs.push(carousel([hx, hz]));
    // The ring of flower beds round it: low, solid, kerbed; a gap for the riders to walk in on the north, from their queue.
    const ring = 10;
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * P * 2;
      if (Math.abs(Math.atan2(Math.sin(a - P / 2), Math.cos(a - P / 2))) < 0.12) continue;
      const x = hx + Math.cos(a) * ring, z = hz + Math.sin(a) * ring;
      props.push({ shape: 'box', size: [0.7, 0.3, 1.2], pos: [x, 0.3, z], rot: [0, -a, 0], color: 0xf2e6cc, mapColor: 0x6f9e52 });
      props.push({ shape: 'sphere', size: [0.65, 0.3, 1.1], pos: [x, 0.65, z], rot: [0, -a, 0], color: [0xf08ac0, 0xf2c12e, 0xe8544a, 0xffffff][k % 4], ghost: true });
    }
    // Its edge: planters round it, but at the main street, the way to the teacups, and the people's ways.
    const openings: [number, number][] = [[-P / 2, 0.36], [0, 0.22], [P, 0.045], [P / 2 - 0.6, 0.045], [P / 2 + 0.6, 0.045]];
    const n = 64;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * P * 2;
      if (openings.some(([b, w]) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < w + P / n)) continue;
      const x = hx + Math.cos(a) * (HUB_R + 0.5), z = hz + Math.sin(a) * (HUB_R + 0.5);
      props.push({ shape: 'box', size: [0.45, 0.4, 1.3], pos: [x, 0.4, z], rot: [0, -a, 0], color: 0xf6e8d4, mapColor: 0x6f9e52 });
      props.push({ shape: 'sphere', size: [0.6, 0.45, 1.25], pos: [x, 1.0, z], rot: [0, -a, 0], color: k % 2 ? 0x4f8a3a : 0x5a9a42, ghost: true });
    }
    // Round its edge, inside: lamps, benches, the photographers' bear and its board, the carts.
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * P * 2 + P / 12;
      if (openings.slice(0, 2).some(([b, w]) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < w + 0.2)) continue;
      // None in the clowns' show: it has its own lights.
      if (a > 1.5 * P) continue;
      // Nor in the carousel's queue.
      if (Math.abs(a - P / 2) < P / 6) continue;
      object('parkLamp', hx + Math.cos(a) * (HUB_R - 1.2), hz + Math.sin(a) * (HUB_R - 1.2));
      if (k % 2) object('bench', hx + Math.cos(a + 0.12) * (HUB_R - 1.3), hz + Math.sin(a + 0.12) * (HUB_R - 1.3), -a - P / 2);
    }
    object('mascotBear', hx - 9, hz - 17, 0.4);
    object('cutout', hx - 11, hz - 15.5, 0.7);
    // South-west of the carousel, from the way in off the main street round to the way out to the teacups, the clowns'
    // show, laid out so that the way bends in and out between its parts: the stage in by the flower beds facing the way in,
    // so that the way keeps out by the edge; then the bleachers out by the edge, so that it comes in along the beds; then
    // the cannon for the human cannonball in by the beds, so that it goes out again to the teacups. Across each lane a
    // clown riding a figure of eight, and one round and round between the bleachers and the cannon, juggling balls of
    // fireworks with their fuses lit; the show's props about where they are used.
    {
      const { bleachers, stage, cannon } = SHOW;
      /** A block laid square to the round: from radius r0 to r1, half so long across it, at that angle; y0 to y1. */
      const laid = (r0: number, r1: number, deg: number, half: number, y0: number, y1: number, color: number, extra: Partial<PropDesc> = {}) => {
        const [x, z] = round((r0 + r1) / 2, deg);
        props.push({ shape: 'box', size: [(r1 - r0) / 2, (y1 - y0) / 2, half], pos: [x, (y0 + y1) / 2, z], rot: [0, -(deg * P) / 180, 0], color, ...extra });
      };
      /** Which way is in, toward the carousel, at that angle: as a heading. */
      const inward = (deg: number) => Math.atan2(-Math.cos((deg * P) / 180), -Math.sin((deg * P) / 180));

      // The bleachers: three steps of benches facing in, full, flags at their ends.
      {
        const [r0, r1, deg, half] = bleachers;
        const steps: [number, number, number][] = [[r0, 0.45, 0xd8302a], [r0 + 1.85, 0.9, 0x3f7fd0], [r0 + 3.7, 1.35, 0xf2c12e]];
        steps.forEach(([from, h, color]) => {
          laid(from, r1, deg, half, 0, h, 0xf2efe6, { mapColor: 0xb0a080 });
          laid(from + 0.15, from + 0.85, deg, half - 0.1, h, h + 0.08, color, { ghost: true });
          for (const at of [-2.4, -0.8, 0.8, 2.4]) {
            const [x, z] = round(from + 0.9, deg, at);
            crowds.push({ area: [x - 0.55, z - 0.55, x + 0.55, z + 0.55], count: 2, y: 0, raised: h, fenced: true, dance: inward(deg), stand: true });
          }
        });
        for (const s2 of [-1, 1]) {
          const [x, z] = round(r1 - 0.3, deg, s2 * (half - 0.2));
          bar(props, [x, 1.35, z], [x, 4.6, z], 0.05, 0xd9a830, { ghost: true });
          props.push({ shape: 'cone', size: [0.45, 0.3, 0], pos: [x, 4.3, z], rot: [0, 0, -P / 2], color: s2 < 0 ? 0xd8302a : 0x3f7fd0, ghost: true });
        }
      }
      // The stage: boards on a striped skirt, the curtains behind, the show's name over them; the ringmaster up on it.
      {
        const [r0, r1, deg, half] = stage;
        laid(r0, r1, deg, half, 0, 0.8, 0xd8302a, { mapColor: 0xb05040 });
        laid(r0, r1 + 0.05, deg, half + 0.05, 0.8, 0.9, 0xc89a5a, { ghost: true });
        for (const at of [-2.25, -0.75, 0.75, 2.25]) {
          const [x, z] = round(r1 + 0.02, deg, at);
          props.push({ shape: 'box', size: [0.02, 0.38, 0.36], pos: [x, 0.4, z], rot: [0, -(deg * P) / 180, 0], color: 0xffffff, ghost: true });
        }
        laid(r0, r0 + 0.3, deg, half, 0.9, 4.2, 0xa8202a, { ghost: true });
        for (const s2 of [-1, 1]) {
          const [x, z] = round(r0 + 0.15, deg, s2 * half);
          bar(props, [x, 0.9, z], [x, 4.6, z], 0.12, 0xf2c12e, { ghost: true });
        }
        laid(r0, r0 + 0.35, deg, half + 0.2, 4.2, 4.6, 0xf2c12e, { ghost: true });
        const [sx, sz] = round(r0 + 0.4, deg);
        signs.push({ pos: [sx, 3.7, sz], rotY: inward(deg) + P, kind: 'name', text: '小丑特技秀', colors: ['#d8302a', '#ffffff', '#f2c12e'], wide: 4.2 });
        const [mx, mz] = round((r0 + r1) / 2 + 0.6, deg);
        crowds.push({ area: [mx - 0.3, mz - 0.3, mx + 0.3, mz + 0.3], count: 1, y: 0, raised: 0.9, dance: inward(deg) + P, motion: 'perform', fenced: true, clothes: [0xd8302a], hat: 0x2a2c30 });
      }
      // The cannon: a red carriage on two great wheels, its barrel up over the way and out over the hedge, its name on its side.
      {
        const [r0, r1, deg, half] = cannon;
        laid(r0, r1, deg, half, 0, 1.1, 0xd8302a, { mapColor: 0xb05040 });
        laid(r0 - 0.03, r1 + 0.03, deg, half + 0.03, 0.85, 0.95, 0xf2c12e, { ghost: true });
        const [ax, az] = across(deg);
        for (const s2 of [-1, 1]) {
          const [x, z] = round((r0 + r1) / 2, deg, s2 * (half + 0.15));
          bar(props, [x - ax * 0.12, 1.05, z - az * 0.12], [x + ax * 0.12, 1.05, z + az * 0.12], 1.05, 0xf2c12e, { ghost: true });
          bar(props, [x - ax * 0.14, 1.05, z - az * 0.14], [x + ax * 0.14, 1.05, z + az * 0.14], 0.25, 0x2a2c30, { ghost: true });
        }
        const [bx, bz] = round(r0 + 0.8, deg), [tx, tz] = round(r1 + 0.4, deg);
        bar(props, [bx, 1.2, bz], [tx, 4.0, tz], 0.62, 0x3f7fd0, { ghost: true });
        bar(props, [tx + (tx - bx) * 0.04, 4.0 + 2.8 * 0.04, tz + (tz - bz) * 0.04], [tx, 4.0, tz], 0.7, 0xf2c12e, { ghost: true });
        for (const k of [0.25, 0.5, 0.75]) props.push({ shape: 'sphere', size: [0.14, 0.14, 0.14], pos: [bx + (tx - bx) * k, 1.2 + 2.8 * k + 0.6, bz + (tz - bz) * k], color: 0xffffff, ghost: true });
        const [nx, nz] = round(r1 + 0.03, deg);
        signs.push({ pos: [nx, 0.55, nz], rotY: inward(deg) + P, kind: 'name', text: '人間大砲', colors: ['#f2c12e', '#d8302a', '#ffffff'], wide: 2.6 });
        const [dx, dz] = round(r1 + 0.6, deg, half + 0.7);
        object('testDummy', dx, dz, inward(deg));
      }
      // The clowns, each with their figure, or their ring, chalked on the paving.
      for (const { at, eight, ring, speed, start } of SHOW.clowns) {
        const [cx, cz] = round(at[0], at[1]), [ux, uz] = round(1, at[1], 0, true), [vx, vz] = across(at[1]);
        const loop: Vec2[] = Array.from({ length: 24 }, (_, j) => {
          const t = (j / 24) * P * 2;
          // A figure of eight across the lane, out and back either side of where it crosses; or a ring.
          const [a, b] = eight ? [Math.sin(t) * eight[0], Math.sin(t) * Math.cos(t) * eight[1]] : [Math.cos(t) * ring!, Math.sin(t) * ring!];
          return [cx + ux * a + vx * b, cz + uz * a + vz * b];
        });
        s.clowns.push({ loop, speed, start });
        loop.forEach(([ax, az], j) => {
          const [bx, bz] = loop[(j + 1) % loop.length];
          props.push({ shape: 'box', size: [0.05, 0.004, Math.hypot(bx - ax, bz - az) * 0.3], pos: [(ax + bx) / 2, 0.045, (az + bz) / 2], rot: [0, Math.atan2(bx - ax, bz - az), 0], color: 0xffffff, ghost: true });
        });
      }
      // Their props, where each is wanted, at the edges of the lanes: spotlights at the bleachers' ends, on the show; the
      // skittles by the stage, the hoop by the first clown, the trunk by the beds, the drums at the stage's foot; balloons
      // tied at its corners; a crowd standing by the way out.
      for (const deg of [bleachers[2] - 11, bleachers[2] + 11]) {
        const [x, z] = round(bleachers[0] - 1.2, deg);
        object('lightStand', x, z, inward(deg) + P);
      }
      for (const [kind, r, deg, turn] of [['pinRack', 16.4, -97, 0.4], ['hoopStand', 22.6, -70, 1.2], ['propTrunk', 11.6, -63, 0.3], ['bassDrum', 16.5, stage[2] - 4, 0.9], ['bassDrum', 16.6, stage[2] + 4, 2.1]] as const) {
        const [x, z] = round(r, deg);
        object(kind, x, z, turn);
      }
      for (const s2 of [-1, 1]) {
        const [x, z] = round(stage[1] + 0.5, stage[2], s2 * (stage[3] + 0.4));
        object('balloonColumn', x, z);
      }
      for (const deg of [-24, -19]) {
        const [x, z] = round(23, deg);
        crowds.push({ area: [x - 0.7, z - 0.7, x + 0.7, z + 0.7], count: 3, y: 0, fenced: true, dance: inward(deg), stand: true });
      }
    }
    object('balloonCart', hx + 17, hz + 6, -P / 2 - 0.4);
    object('popcornCart', hx - 15, hz - 9, 0.6);
    object('iceCreamCart', hx - 16, hz + 8, 0.3);
    // The souvenirs either end of the carousel's queue, by the people's ways off the hub.
    object('souvenirStall', hx - 11, hz + 18.5, Math.atan2(11, -18.5));
    object('souvenirStall', hx + 11, hz + 18.5, Math.atan2(-11, -18.5));
    for (let k = 0; k < 5; k++) object('stroller', hx - 18 - (k % 2) * 0.8, hz - 2 + k * 0.9, P / 2);
    crowds.push({ area: [hx - 20, hz - 12, hx - 11, hz + 12], count: 16, y: 0 }, { area: [hx + 12, hz + 3, hx + 18, hz + 11], count: 10, y: 0 });
    // The carousel's queue north of it, from the flower beds out to the planters at its edge, as a ride's queue is when
    // the ride is busy: lanes of brass railings across, bolted down, open at alternate ends, full; the last lane, along
    // the planters, open at both ends to the people's ways off the hub. The attendant's booth at its end, the ride's
    // name up over it on posts.
    {
      const lines = [251.5, 253.5, 255.5, 257.5, 259.5, 261.5, 263.4], xa = hx - 7, xb = hx + 7;
      lines.forEach((z, i) => {
        // Each line as long as the round lets it be, inside the planters.
        const half = Math.min(7, Math.sqrt(23.8 ** 2 - (z - hz) ** 2)), n = Math.max(1, Math.round(half)), step = (half * 2) / n;
        for (let j = 0; j <= n; j++) {
          const x = hx - half + j * step;
          props.push({ shape: 'cylinder', size: [0.05, 0.5, 0], pos: [x, 0.5, z], color: 0xd4a83a });
          props.push({ shape: 'cylinder', size: [0.16, 0.03, 0], pos: [x, 0.03, z], color: 0x8a6a30, ghost: true });
          const open = i === lines.length - 1 ? false : i === 0 ? Math.abs(x + step / 2 - hx) < 1 : i % 2 ? j === n - 1 : j === 0;
          if (j < n && !open) for (const y of [0.45, 0.95]) bar(props, [x, y, z], [x + step, y, z], 0.035, 0xd4a83a);
        }
        if (i + 1 < lines.length) crowds.push({ area: [xa + 0.4, z + 0.35, xb - 0.4, lines[i + 1] - 0.35], count: 6, y: 0 });
      });
      kiosk(props, signs, { at: [xb + 3, 254.5], yaw: -P / 2, half: [1.4, 1.2], high: 2.6, wall: 0xfff0dc, trim: 0xd4a83a, roof: 'dome', roofColor: 0xd23a32, front: 'counter' });
      for (const x of [xa - 0.4, xb + 0.4]) bar(props, [x, 0, 258.4], [x, 3.6, 258.4], 0.06, 0xd4a83a, { ghost: true });
      signs.push({ pos: [hx, 3.0, 258.3], rotY: P, kind: 'name', text: '夢幻旋轉木馬', colors: ['#d23a32', '#fff0dc', '#d4a83a'], wide: 6 });
    }
    // Round its southern half, outside its edge: shops, their fronts to it.
    for (const [a, name, wall, roofColor, roof] of [[-2.3, '歡樂餐廳', 0xe0f0d8, 0x4fa86a, 'pitched'], [-0.85, '公主商店', 0xf8e0ec, 0xf08ac0, 'dome']] as const) {
      const r = HUB_R + 6.5;
      kiosk(props, signs, { at: [hx + Math.cos(a) * r, hz + Math.sin(a) * r], yaw: Math.atan2(-Math.cos(a), -Math.sin(a)), half: [6, 4], high: 5, wall, trim: 0xffffff, roof, roofColor, name, front: 'shop', awning: [roofColor, 0xffffff] });
    }
    // The lakeside walk north of it: a stone balustrade along the water; the swan boats' landing, steps down to it.
    const shore = 270;
    for (let x = hx - 26; x < hx + 30; x += 2) {
      box(props, x, 0, shore - 1.0, x + 2, 0.9, shore - 0.7, 0xf2ece0);
    }
    for (let x = hx - 26; x <= hx + 30; x += 2) props.push({ shape: 'box', size: [0.2, 0.5, 0.2], pos: [x, 0.5, shore - 0.85], color: 0xe8e0d0, ghost: true });
    for (let k = 0; k < 3; k++) box(props, hx - 10 - k * 0.5, -0.3 - k * 0.3, shore - 0.7 + k * 0.6, hx - 6 + k * 0.5, -k * 0.3, shore - 0.1 + k * 0.6, 0xd8d0c0, { ghost: true });
    for (let x = hx - 22; x < hx + 28; x += 9) object(x % 2 ? 'palm' : 'parkLamp', x, shore - 3.5);
    crowds.push({ area: [hx - 24, shore - 4, hx + 26, shore - 1.5], count: 24, y: 0 });
    // Its east side: the footbridge over the canal to the pirate bay, people only: bollards at its foot.
    box(props, 161, 0.6, hz - 1.0, hx - HUB_R - 1.5, 0.8, hz + 1.0, 0xb08a5a, { ghost: true });
    for (const side of [-1, 1]) rail(props, [{ s: 0, x: 161, y: 0.8, z: hz + side * 1.0, yaw: P / 2, grade: 0 }, { s: 1, x: hx - HUB_R - 1.5, y: 0.8, z: hz + side * 1.0, yaw: P / 2, grade: 0 }], 0, 1.0, 0.04, 0x8a6a40);
    for (const z of [-0.6, 0.6]) props.push({ shape: 'cylinder', size: [0.14, 0.45, 0], pos: [hx - HUB_R - 1.1, 0.45, hz + z], color: 0xd9d9d9 });
  }
}

/** The parade's floats, where each stands in the street: west pair first, then the east pair. */
const FLOATS: [number, number, 'cake' | 'castle' | 'swan' | 'bear'][] = [[201.6, 180, 'cake'], [205.4, 180.4, 'castle'], [194.6, 201, 'swan'], [198.4, 201.4, 'bear']];
/** The band's rows, between the two pairs: from where to where up the street. */
const BAND: [number, number] = [187.5, 192.5];

/**
 * A parade float, standing: a low wagon in a skirt of scalloped cloth, what it carries built up on it, the day's name
 * along its sides; its drawbar out in front. Solid, all of it: a wagon of steel under the cloth.
 */
function float(props: PropDesc[], signs: SignDesc[], x: number, z: number, kind: 'cake' | 'castle' | 'swan' | 'bear'): void {
  const W = 1.7, L = 4.2, TOP = 1.15;
  const [skirt, trim] = { cake: [0xf8c8dc, 0xffffff], castle: [0x9fc4ee, 0xf2c12e], swan: [0x8fd3c0, 0xffffff], bear: [0xf2c12e, 0xe8544a] }[kind];
  const solid = { fade: true, mapColor: skirt };
  // Only the big pieces fade when the float is in the way: each that does is drawn on its own.
  const show = { ghost: true };
  const big = { ghost: true, fade: true };
  box(props, x - W, 0.12, z - L, x + W, TOP, z + L, skirt, solid);
  box(props, x - W - 0.03, TOP - 0.16, z - L - 0.03, x + W + 0.03, TOP + 0.04, z + L + 0.03, trim, show);
  for (let d = -L + 0.35; d < L; d += 0.7) for (const side of [-1, 1]) props.push({ shape: 'sphere', size: [0.04, 0.2, 0.34], pos: [x + side * (W + 0.02), TOP - 0.26, z + d], color: trim, ...show });
  for (const side of [-1, 1]) signs.push({ pos: [x + side * (W + 0.05), 0.55, z], rotY: side * P / 2, kind: 'name', text: '幸福島 開幕遊行', colors: ['#ffffff', '#c8372d', '#f2c12e'], wide: 4.6 });
  bar(props, [x, 0.4, z + L], [x, 0.4, z + L + 1.3], 0.05, 0x5a6068, show);
  for (const dz of [-L + 0.9, L - 0.9]) for (const side of [-1, 1]) props.push({ shape: 'cylinder', size: [0.3, 0.1, 0], pos: [x + side * (W - 0.15), 0.3, z + dz], rot: [0, 0, P / 2], color: 0x24262a, ...show });
  if (kind === 'cake') {
    // Three tiers, cream piped round each, strawberries, candles lit on the top.
    for (const [r, y, c] of [[1.5, 0, 0xfff4ea], [1.1, 0.95, 0xf8c8dc], [0.7, 1.9, 0xfff4ea]] as const) {
      props.push({ shape: 'cylinder', size: [r, 0.475, 0], pos: [x, TOP + y + 0.475, z], color: c, fade: true });
      props.push({ shape: 'cylinder', size: [r + 0.05, 0.07, 0], pos: [x, TOP + y + 0.92, z], color: 0xffffff, ...show });
      for (let k = 0; k < 10; k++) { const a = (k / 10) * P * 2; props.push({ shape: 'sphere', size: [0.13, 0.13, 0.13], pos: [x + Math.cos(a) * (r - 0.12), TOP + y + 1.03, z + Math.sin(a) * (r - 0.12)], color: k % 2 ? 0xe8544a : 0xffffff, ...show }); }
    }
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * P * 2;
      props.push({ shape: 'cylinder', size: [0.05, 0.3, 0], pos: [x + Math.cos(a) * 0.4, TOP + 3.25, z + Math.sin(a) * 0.4], color: [0x3f7fd0, 0xf2c12e, 0x4fa86a, 0xf08ac0, 0xe8544a][k], ...show });
      props.push({ shape: 'cone', size: [0.07, 0.11, 0], pos: [x + Math.cos(a) * 0.4, TOP + 3.66, z + Math.sin(a) * 0.4], color: 0xffc23a, ...show, glow: true });
    }
    for (const dz of [-2.9, 2.9]) for (const dx of [-0.8, 0.8]) props.push({ shape: 'sphere', size: [0.3, 0.34, 0.3], pos: [x + dx, TOP + 0.34, z + dz], color: dx * dz > 0 ? 0xe8544a : 0xf2c12e, ...show });
  } else if (kind === 'castle') {
    // A keep with a gate in it, a tower at each corner under a blue cone, pennants.
    box(props, x - 1.1, TOP, z - 2.2, x + 1.1, TOP + 2.2, z + 2.2, 0xf2e6f0, { fade: true });
    for (let d = -2.0; d <= 2.01; d += 0.8) for (const side of [-1, 1]) box(props, x + side * 1.1 - 0.12, TOP + 2.2, z + d - 0.2, x + side * 1.1 + 0.12, TOP + 2.5, z + d + 0.2, 0xf2e6f0, show);
    box(props, x - 0.5, TOP, z - 2.23, x + 0.5, TOP + 1.3, z - 2.2, 0x6a4a30, show);
    for (const dx of [-1.15, 1.15]) for (const dz of [-2.3, 2.3]) {
      props.push({ shape: 'cylinder', size: [0.42, 1.6, 0], pos: [x + dx, TOP + 1.6, z + dz], color: 0xf8eef6, fade: true });
      props.push({ shape: 'cone', size: [0.56, 0.6, 0], pos: [x + dx, TOP + 3.8, z + dz], color: 0x3f7fd0, ...big });
      bar(props, [x + dx, TOP + 4.4, z + dz], [x + dx, TOP + 5.1, z + dz], 0.02, 0xd8dce0, show);
      box(props, x + dx, TOP + 4.8, z + dz - 0.01, x + dx + 0.45, TOP + 5.08, z + dz + 0.01, dx * dz > 0 ? 0xe8544a : 0xf2c12e, show);
    }
    props.push({ shape: 'cylinder', size: [0.6, 1.9, 0], pos: [x, TOP + 1.9, z + 0.4], color: 0xf8eef6, fade: true });
    props.push({ shape: 'cone', size: [0.8, 0.9, 0], pos: [x, TOP + 4.7, z + 0.4], color: 0xf08ac0, ...big });
  } else if (kind === 'swan') {
    // A swan: its body, wings folded up along it, its neck curving up and over to its head, a crown on it.
    props.push({ shape: 'sphere', size: [1.35, 1.0, 3.0], pos: [x, TOP + 0.9, z - 0.3], color: 0xfdfdfb, fade: true });
    for (const side of [-1, 1]) props.push({ shape: 'sphere', size: [0.25, 0.85, 2.1], pos: [x + side * 1.2, TOP + 1.35, z - 0.9], rot: [0.25, 0, side * 0.2], color: 0xf2f2ee, ...show });
    const neck: Vec3[] = [[0, 1.3, 2.0], [0, 2.4, 2.7], [0, 3.5, 2.8], [0, 4.2, 2.3], [0, 4.3, 1.7]];
    for (let k = 0; k < neck.length - 1; k++) bar(props, [x, TOP + neck[k][1], z + neck[k][2]], [x, TOP + neck[k + 1][1], z + neck[k + 1][2]], 0.3 - k * 0.02, 0xfdfdfb, big);
    for (const p of neck.slice(1, -1)) props.push({ shape: 'sphere', size: [0.31, 0.31, 0.31], pos: [x, TOP + p[1], z + p[2]], color: 0xfdfdfb, ...show });
    props.push({ shape: 'sphere', size: [0.36, 0.34, 0.46], pos: [x, TOP + 4.25, z + 1.75], color: 0xfdfdfb, ...big });
    props.push({ shape: 'cone', size: [0.14, 0.3, 0], pos: [x, TOP + 4.15, z + 2.3], rot: [P / 2, 0, 0], color: 0xf28a2e, ...show });
    props.push({ shape: 'cylinder', size: [0.2, 0.1, 0], pos: [x, TOP + 4.66, z + 1.65], color: 0xf2c12e, ...show });
    for (const side of [-1, 1]) props.push({ shape: 'sphere', size: [0.05, 0.06, 0.05], pos: [x + side * 0.3, TOP + 4.33, z + 1.95], color: 0x1c1c1c, ...show });
  } else {
    // The bear of the park, as big as a house, sitting; a bunch of balloons in its paw.
    props.push({ shape: 'sphere', size: [1.4, 1.5, 1.5], pos: [x, TOP + 1.4, z - 0.2], color: 0x9a6a3a, fade: true });
    props.push({ shape: 'sphere', size: [0.9, 1.0, 0.5], pos: [x, TOP + 1.3, z + 1.05], color: 0xd8b88a, ...show });
    props.push({ shape: 'sphere', size: [1.05, 1.0, 1.0], pos: [x, TOP + 3.5, z + 0.1], color: 0x9a6a3a, ...big });
    for (const side of [-1, 1]) {
      props.push({ shape: 'sphere', size: [0.36, 0.36, 0.2], pos: [x + side * 0.8, TOP + 4.4, z + 0.1], color: 0x9a6a3a, ...show });
      props.push({ shape: 'sphere', size: [0.2, 0.2, 0.12], pos: [x + side * 0.8, TOP + 4.4, z + 0.22], color: 0xd8b88a, ...show });
      props.push({ shape: 'sphere', size: [0.12, 0.14, 0.08], pos: [x + side * 0.38, TOP + 3.75, z + 1.0], color: 0x1c1c1c, ...show });
      props.push({ shape: 'sphere', size: [0.45, 0.45, 0.8], pos: [x + side * 1.0, TOP + 0.45, z + 1.6], color: 0x8a5a30, ...show });
      props.push({ shape: 'sphere', size: [0.4, 0.9, 0.4], pos: [x + side * 1.35, TOP + 2.0, z + 0.5], rot: [0.5, 0, side * 0.4], color: 0x8a5a30, ...show });
    }
    props.push({ shape: 'sphere', size: [0.45, 0.36, 0.4], pos: [x, TOP + 3.3, z + 0.95], color: 0xd8b88a, ...show });
    props.push({ shape: 'sphere', size: [0.15, 0.11, 0.1], pos: [x, TOP + 3.45, z + 1.33], color: 0x1c1c1c, ...show });
    props.push({ shape: 'sphere', size: [0.3, 0.2, 0.06], pos: [x, TOP + 2.55, z + 1.0], color: 0xe8544a, ...show });
    bar(props, [x + 1.5, TOP + 2.3, z + 0.9], [x + 1.7, TOP + 4.6, z + 0.9], 0.012, 0xf2f2ee, show);
    for (const [dx, dy, dz, c] of [[0, 0, 0, 0xe8544a], [0.35, 0.3, 0.2, 0xf2c12e], [-0.3, 0.35, -0.1, 0x3f7fd0], [0.1, 0.7, -0.2, 0x4fa86a], [-0.15, 0.75, 0.25, 0xf08ac0]] as const) {
      props.push({ shape: 'sphere', size: [0.3, 0.36, 0.3], pos: [x + 1.7 + dx, TOP + 4.9 + dy, z + 0.9 + dz], color: c, ...show });
    }
  }
}
