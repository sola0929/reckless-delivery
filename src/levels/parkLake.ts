import { bar, box, type ParkSite } from './parkParts';
import { CANAL, ISLAND, ISLAND_R, LAKE, LAKE_BED, LAKE_WATER } from './parkPlan';
import type { Look, P2 } from './relief';
import type { Vec3 } from '../config';
import type { PropDesc } from './types';

// The lake in the middle of the park, its stone edge, the island with the castle on it, and the canal south out of it.
// Nothing here is driven on: the lake is what the way goes round, and falling in ends the run. Round its edge, on the
// land, the places along the shore put their own railings and walks.

/** The lake's bed, seen through its water, and its edge: dressed stone down to the bed. */
const BED: Look = { tag: 'water', color: 0x3f7a86, wall: 0x9a9284 };
/** Its rim: a band of stone coping along the edge, on the land. */
const RIM: Look = { tag: 'paving', color: 0xd8d0c0, wall: 0x9a9284 };
const ISLE: Look = { tag: 'grass', color: 0x76a656, wall: 0x9a9284 };
const WATER_TINT = 0x4a9ab0;

/** A polygon, its corners in order round anticlockwise, grown out by so much: each edge moved out, the corners where they meet. */
export function grown(poly: P2[], by: number): P2[] {
  const n = poly.length;
  const edges = poly.map((a, k) => {
    const b = poly[(k + 1) % n];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    const nx = dz / l, nz = -dx / l;
    return { a: [a[0] + nx * by, a[1] + nz * by] as P2, d: [dx / l, dz / l] as P2 };
  });
  return edges.map((e, k) => {
    const f = edges[(k + n - 1) % n];
    // Where the line before this corner meets the line after it.
    const det = f.d[0] * e.d[1] - f.d[1] * e.d[0];
    if (Math.abs(det) < 1e-9) return e.a;
    const t = ((e.a[0] - f.a[0]) * e.d[1] - (e.a[1] - f.a[1]) * e.d[0]) / det;
    return [f.a[0] + f.d[0] * t, f.a[1] + f.d[1] * t] as P2;
  });
}

const circle = (c: P2, r: number, n = 24): P2[] => Array.from({ length: n }, (_, k) => [c[0] + Math.cos((k / n) * Math.PI * 2) * r, c[1] + Math.sin((k / n) * Math.PI * 2) * r] as P2);

export function lake(s: ParkSite): void {
  const { relief, props } = s;
  // The rim, then the water inside it; the canal the same, through the rim on the lake's south side.
  relief.area(grown(LAKE, 1.4), 0, RIM);
  relief.area([[CANAL.x0 - 1.2, CANAL.z0 - 1.2], [CANAL.x1 + 1.2, CANAL.z0 - 1.2], [CANAL.x1 + 1.2, CANAL.z1], [CANAL.x0 - 1.2, CANAL.z1]], 0, RIM);
  relief.area(LAKE, LAKE_BED, BED);
  relief.area([[CANAL.x0, CANAL.z0], [CANAL.x1, CANAL.z0], [CANAL.x1, CANAL.z1 + 2], [CANAL.x0, CANAL.z1 + 2]], LAKE_BED, BED);
  const xs = LAKE.map((p) => p[0]), zs = LAKE.map((p) => p[1]);
  s.pools.push(
    { area: [Math.min(...xs), Math.min(...zs), Math.max(...xs), 372], surface: LAKE_WATER, tint: WATER_TINT, flow: [0.03, 0.02] },
    { area: [178, 372, Math.max(...xs), Math.max(...zs)], surface: LAKE_WATER, tint: WATER_TINT, flow: [0.03, 0.02] },
    { area: [CANAL.x0, CANAL.z0, CANAL.x1, CANAL.z1], surface: LAKE_WATER, tint: WATER_TINT, flow: [0, 0.05] },
  );
  // The canal's south end at the park's wall: a culvert's arch in the stone.
  box(props, CANAL.x0, LAKE_BED, CANAL.z0 - 1.2, CANAL.x1, 0, CANAL.z0, 0x9a9284);
  box(props, CANAL.x0 + 2.5, LAKE_BED + 0.3, CANAL.z0 - 0.02, CANAL.x1 - 2.5, LAKE_WATER + 0.9, CANAL.z0 + 0.02, 0x24282a, { ghost: true });

  // The island: a lawn on a stone edge a little above the water, its path round to the castle's door, trees round it.
  const [ix, iz] = ISLAND;
  relief.area(circle(ISLAND, ISLAND_R + 1), 0.3, RIM);
  relief.area(circle(ISLAND, ISLAND_R), 0.3, ISLE);
  castle(props, ix, iz + 4, 0.3);
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + 0.2;
    if (Math.sin(a) < -0.55) continue;
    const x = ix + Math.cos(a) * (ISLAND_R - 3), z = iz + Math.sin(a) * (ISLAND_R - 3);
    props.push({ shape: 'cylinder', size: [0.2, 1.1, 0], pos: [x, 1.4, z], color: 0x6b5238, ghost: true });
    props.push({ shape: 'sphere', size: [1.9, 2.0, 1.9], pos: [x, 3.8, z], color: k % 3 ? 0x4f8a4a : 0x5d9a52, ghost: true });
  }
  // The landing on the island's south side, where the boats tie up; a lamp each side.
  box(props, ix - 4, 0, iz - ISLAND_R - 5, ix + 4, 0.35, iz - ISLAND_R + 1, 0x8a6a48, { ghost: true });
  for (const x of [ix - 3.6, ix + 3.6]) {
    props.push({ shape: 'cylinder', size: [0.08, 1.6, 0], pos: [x, 1.95, iz - ISLAND_R - 4.6], color: 0x2f4a3a, ghost: true });
    props.push({ shape: 'sphere', size: [0.25, 0.28, 0.25], pos: [x, 3.7, iz - ISLAND_R - 4.6], color: 0xfff6dc, ghost: true, glow: true });
  }

  // Out on the water: the swan boats, two by two, and the fountains playing.
  const SWANS: [number, number, number][] = [[180, 300, 0.4], [186, 296, 0.9], [300, 318, 2.6], [292, 326, -2.2], [214, 368, 1.5], [262, 290, 3.0], [146, 326, -0.8], [240, 362, 2.0], [128, 340, 0.3]];
  for (const [x, z, yaw] of SWANS) swanBoat(props, x, z, yaw);
  // The swan boats' own pier off the north shore: a deck on piles out over the water, the boats tied up along it.
  box(props, 252, LAKE_WATER + 0.3, 377, 256, LAKE_WATER + 0.55, 392, 0x8a6a48, { ghost: true });
  for (let z = 378; z < 392; z += 3) for (const x of [252.2, 255.8]) props.push({ shape: 'cylinder', size: [0.15, 0.9, 0], pos: [x, LAKE_WATER - 0.2, z], color: 0x5a3e28, ghost: true });
  for (let k = 0; k < 4; k++) for (const side of [-1, 1]) swanBoat(props, 254 + side * 3.6, 380 + k * 3.2, side < 0 ? -0.1 : 0.1);
  // A little island near the east shore with a lighthouse, red and white, a keeper's hut.
  {
    const c: P2 = [122, 300];
    relief.area(circle(c, 9), 0.3, RIM);
    relief.area(circle(c, 8), 0.3, ISLE);
    for (let k = 0; k < 6; k++) props.push({ shape: 'cylinder', size: [1.8 - k * 0.12, 1.0, 0], pos: [c[0], 0.3 + 1 + k * 2, c[1]], color: k % 2 ? 0xffffff : 0xd23a32, ghost: true });
    props.push({ shape: 'cylinder', size: [1.3, 0.8, 0], pos: [c[0], 13.1, c[1]], color: 0xfff2c0, ghost: true, glow: true });
    props.push({ shape: 'cone', size: [1.6, 1.4, 0], pos: [c[0], 15.3, c[1]], color: 0x2a2c30, ghost: true });
    box(props, c[0] + 2.5, 0.3, c[1] - 2, c[0] + 6, 3, c[1] + 2, 0xf2ead8, { ghost: true });
    props.push({ shape: 'box', size: [2.0, 0.1, 2.3], pos: [c[0] + 4.25, 3.4, c[1]], rot: [0, 0, 0.3], color: 0xd23a32, ghost: true });
    for (const [dx, dz] of [[-5, 3], [-4, -4], [3, 5]]) {
      props.push({ shape: 'cylinder', size: [0.15, 0.8, 0], pos: [c[0] + dx, 1.1, c[1] + dz], color: 0x6b5238, ghost: true });
      props.push({ shape: 'sphere', size: [1.3, 1.4, 1.3], pos: [c[0] + dx, 2.8, c[1] + dz], color: 0x4f8a4a, ghost: true });
    }
  }
  // The lake show's floating stage, toward the north shore: a deck on floats, the screen of water behind it the pictures are
  // thrown on at night, a row of jets along its front playing now.
  {
    const [x, z] = [285, 340];
    box(props, x - 9, LAKE_WATER, z - 4, x + 9, LAKE_WATER + 0.6, z + 4, 0x5a6068, { ghost: true });
    box(props, x - 8.8, LAKE_WATER + 0.6, z - 3.8, x + 8.8, LAKE_WATER + 0.65, z + 3.8, 0x2a3a5a, { ghost: true });
    for (const dx of [-9, 9]) bar(props, [x + dx, LAKE_WATER + 0.6, z - 3.5], [x + dx, 8, z - 3.5], 0.2, 0x8a8f96, { ghost: true });
    box(props, x - 9, 7.8, z - 3.7, x + 9, 8.2, z - 3.3, 0x8a8f96, { ghost: true });
    box(props, x - 8.6, LAKE_WATER + 0.8, z - 3.55, x + 8.6, 7.6, z - 3.45, 0xd8eef6, { ghost: true });
    for (let k = 0; k < 7; k++) s.fountains.push([x - 7.5 + k * 2.5, LAKE_WATER + 0.7, z + 3.4]);
    for (let k = 0; k < 6; k++) box(props, x - 7 + k * 2.8 - 0.4, LAKE_WATER + 0.65, z - 1, x - 7 + k * 2.8 + 0.4, LAKE_WATER + 1.8, z - 0.6, 0x1c1c1c, { ghost: true });
  }
  // The lake's paddle steamer, at anchor off the hub: her hull, two decks, the wheel at her stern, her funnel.
  {
    const [x, z] = [160, 344];
    box(props, x - 9, LAKE_WATER - 0.4, z - 2.6, x + 9, LAKE_WATER + 1.2, z + 2.6, 0xf2efe6, { ghost: true });
    box(props, x - 9.02, LAKE_WATER + 0.4, z - 2.62, x + 9.02, LAKE_WATER + 0.6, z + 2.62, 0xd23a32, { ghost: true });
    box(props, x - 6, LAKE_WATER + 1.2, z - 2.3, x + 5, LAKE_WATER + 3.4, z + 2.3, 0xfff6e8, { ghost: true });
    for (let k = 0; k < 5; k++) box(props, x - 5 + k * 2.2, LAKE_WATER + 2.0, z - 2.32, x - 4 + k * 2.2, LAKE_WATER + 2.9, z - 2.3, 0x2a3a48, { ghost: true });
    box(props, x - 6.3, LAKE_WATER + 3.4, z - 2.6, x + 5.3, LAKE_WATER + 3.6, z + 2.6, 0xd23a32, { ghost: true });
    box(props, x - 4, LAKE_WATER + 3.6, z - 1.8, x + 2, LAKE_WATER + 5.2, z + 1.8, 0xfff6e8, { ghost: true });
    props.push({ shape: 'cylinder', size: [0.6, 2, 0], pos: [x + 0.5, LAKE_WATER + 7, z], color: 0x2a2c30, ghost: true });
    props.push({ shape: 'cylinder', size: [2.4, 1.2, 0], pos: [x - 10.4, LAKE_WATER + 1.4, z], rot: [Math.PI / 2, 0, 0], color: 0xd23a32, ghost: true });
  }
  for (const [x, z] of [[176, 330], [300, 296], [208, 280], [270, 360]] as const) {
    props.push({ shape: 'cylinder', size: [0.7, 0.15, 0], pos: [x, LAKE_WATER + 0.05, z], color: 0xe8f4f8, ghost: true });
    s.fountains.push([x, LAKE_WATER + 0.4, z]);
  }
}

/** A swan boat on the water: white, its neck curving up from its bow, a seat for two under a little canopy. */
function swanBoat(props: PropDesc[], x: number, z: number, yaw: number): void {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const at = (ahead: number, up: number): Vec3 => [x + fx * ahead, LAKE_WATER + up, z + fz * ahead];
  props.push({ shape: 'sphere', size: [1.0, 0.45, 1.6], pos: at(0, 0.15), rot: [0, yaw, 0], color: 0xf8f8f4, ghost: true });
  props.push({ shape: 'cylinder', size: [0.16, 0.7, 0], pos: at(1.25, 0.95), rot: [0.35, yaw, 0], color: 0xf8f8f4, ghost: true });
  props.push({ shape: 'sphere', size: [0.26, 0.24, 0.34], pos: at(1.5, 1.7), rot: [0, yaw, 0], color: 0xf8f8f4, ghost: true });
  props.push({ shape: 'cone', size: [0.1, 0.25, 0], pos: at(1.85, 1.65), rot: [Math.PI / 2, yaw, 0], color: 0xf2a52e, ghost: true });
  props.push({ shape: 'box', size: [0.7, 0.05, 0.5], pos: at(-0.3, 1.5), rot: [0, yaw, 0], color: 0xf08ac0, ghost: true });
}

/**
 * The castle on the island, the park's own, seen from all round the lake: a keep of pale pink stone, four round towers with
 * blue roofs at its corners, a tall middle tower with a gold spire, battlements, windows, its gate on the south, flags.
 */
function castle(props: PropDesc[], x: number, z: number, y: number): void {
  const WALL = 0xf6e2e0, TRIM = 0xffffff, ROOF = 0x3f6fc0, GOLD = 0xe8c040, DARK = 0x3a4a6a;
  box(props, x - 9, y, z - 6, x + 9, y + 11, z + 6, WALL, { ghost: true, mapColor: 0xf0c8d0 });
  for (let k = -8; k <= 8; k += 2) box(props, x + k - 0.5, y + 11, z - 6.2, x + k + 0.5, y + 12, z - 5.6, WALL, { ghost: true });
  for (let k = -8; k <= 8; k += 2) box(props, x + k - 0.5, y + 11, z + 5.6, x + k + 0.5, y + 12, z + 6.2, WALL, { ghost: true });
  // The gate on the south, an arch of dark under a gold band; windows in two rows.
  box(props, x - 2, y, z - 6.08, x + 2, y + 4.4, z - 6.02, DARK, { ghost: true });
  props.push({ shape: 'cylinder', size: [2, 0.04, 0], pos: [x, y + 4.4, z - 6.05], rot: [Math.PI / 2, 0, 0], color: DARK, ghost: true });
  box(props, x - 9.02, y + 7.4, z - 6.1, x + 9.02, y + 7.8, z - 6.04, GOLD, { ghost: true });
  for (const k of [-6, -3.5, 3.5, 6]) for (const h of [3.5, 8.5]) box(props, x + k - 0.5, y + h, z - 6.06, x + k + 0.5, y + h + 1.6, z - 6.02, DARK, { ghost: true });
  // The corner towers, and the middle one, taller, set back.
  const tower = (tx: number, tz: number, r: number, h: number) => {
    props.push({ shape: 'cylinder', size: [r, h / 2, 0], pos: [tx, y + h / 2, tz], color: WALL, ghost: true });
    props.push({ shape: 'cylinder', size: [r + 0.3, 0.3, 0], pos: [tx, y + h + 0.3, tz], color: TRIM, ghost: true });
    props.push({ shape: 'cone', size: [r + 0.6, r * 2.6, 0], pos: [tx, y + h + 0.6 + r * 2.6, tz], color: ROOF, ghost: true });
    props.push({ shape: 'sphere', size: [0.3, 0.3, 0.3], pos: [tx, y + h + 0.8 + r * 5.2, tz], color: GOLD, ghost: true });
    props.push({ shape: 'box', size: [0.03, 0.4, 0.6], pos: [tx, y + h + 1.6 + r * 5.2, tz + 0.6], color: 0xd23a32, ghost: true });
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + (k - 1) * 0.7;
      props.push({ shape: 'box', size: [0.4, 0.8, 0.05], pos: [tx + Math.cos(a) * (r + 0.01), y + h * 0.65, tz + Math.sin(a) * (r + 0.01)], rot: [0, -a + Math.PI / 2, 0], color: DARK, ghost: true });
    }
  };
  for (const [dx, dz] of [[-9, -6], [9, -6], [-9, 6], [9, 6]]) tower(x + dx, z + dz, 2.2, 15);
  tower(x - 3.5, z + 1, 2.0, 19);
  tower(x + 3.5, z + 1, 2.0, 19);
  tower(x, z + 2, 2.8, 23);
}
