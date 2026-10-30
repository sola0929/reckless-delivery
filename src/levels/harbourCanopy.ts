import type { Vec3 } from '../config';
import type { ObjectDesc, ObjectKindId } from './objects';
import { EAVE, HALL } from './harbourMarket';
import { JOINT } from './harbourMarketRoof';
import type { PropDesc, SignDesc } from './types';

// Level 4's way down off the market's roof: the ice plant's loading canopy, steel sheet on a light steel frame, from
// under the hall's west eaves across the lorries' lane between the two to the edge of the ice plant's dock, sixteen
// metres, on a row of posts along the dock's edge and another down the middle. Its
// south end bay was put up after the rest, on its own pair of posts and its own rafters, out to the end of the joint's
// flat roof; the storm, worst at a roof's corners, has had it. Its posts snapped, it has come down whole, hinged on the
// wall, its foot on the dock's edge: one flat pitch from the eaves to the dock, the way down. Beside it the rest still
// stands on its posts, its edge where the end bay tore away from it over the way, the bay under it open to be seen into:
// the ice lorries backed up to the dock, the lights. Off the end bay's open south side is down into the bay, no more.
//
//   the slope  straight down off the joint, nine metres wide: on the left nothing, on the right the edge of what still
//              stands, over the cab's height, stubs of the end bay's purlins still bolted to it; the lights it brought
//              down on it
//   the dock   at its foot sixteen metres of dock and then the ice plant's wall: round to the right, along the dock,
//              through what the end bay knocked over coming down, the polystyrene and the bagged ice

export interface CanopyParts {
  props: PropDesc[];
  objects: ObjectDesc[];
  signs: SignDesc[];
}

/** The canopy across the loading bay: from the dock's edge to the hall's wall, from the joint's south side to its north end. */
export const CANOPY = { x0: HALL.x0 - 16, x1: HALL.x0, z0: JOINT.z0 + 0.5, z1: JOINT.z0 + 0.5 + 9 + 24 };
/** The end bay that came down, from the canopy's south end to here, the width of the joint's flat roof. */
export const FALLEN_Z = CANOPY.z0 + 9;
/** The rest of it: its posts every so far, its middle row of them, its sheet at the wall and at its front. */
const BAY = 6, MID_X = HALL.x0 - 8, WALL_Y = EAVE - 0.1, FRONT_Y = 3.6;
const SHEET = 0x4b7aa8, SHEET_B = 0x45719c, RIB = 0x416b98, STEEL = 0x5f666c, DARK_STEEL = 0x4a5056, GUTTER = 0x8a949a;

export function canopy(dock: { x0: number; x1: number; z0: number; z1: number; h: number }): CanopyParts {
  const props: PropDesc[] = [];
  const objects: ObjectDesc[] = [];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, more: Partial<PropDesc> = {}) =>
    props.push({ shape: 'box', size: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2], pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color, ...more });
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, y = dock.h, more: Partial<ObjectDesc> = {}) => objects.push({ kind, pos: [x, y, z], rotY, ...more });
  const rod = (a: Vec3, b: Vec3, r: number, color: number, more: Partial<PropDesc> = {}) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], long = Math.hypot(d[0], d[1], d[2]);
    props.push({ shape: 'cylinder', size: [r, long / 2, 0], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [0, Math.atan2(-d[2], d[0]), -Math.acos(d[1] / long)], color, ...more });
  };

  /**
   * A pitch of sheet from the wall at one height to the front at another: where on it a place so far down it from the wall
   * is, and a piece of it, from z0 to z1, from s0 to s1 down it, `lift` off its face and so thick.
   */
  const pitch = (top: number, foot: number) => {
    const run = CANOPY.x1 - CANOPY.x0, tilt = Math.atan2(top - foot, run), long = Math.hypot(run, top - foot);
    const at = (s: number): [number, number] => [CANOPY.x1 - s * Math.cos(tilt), top - s * Math.sin(tilt)];
    const piece = (z0: number, z1: number, s0: number, s1: number, lift: number, thick: number, color: number, more: Partial<PropDesc> = {}) => {
      const [x, y] = at((s0 + s1) / 2), off = lift - thick / 2;
      props.push({ shape: 'box', size: [(s1 - s0) / 2, thick / 2, Math.abs(z1 - z0) / 2], pos: [x - Math.sin(tilt) * off, y + Math.cos(tilt) * off, (z0 + z1) / 2], rot: [0, 0, tilt], color, ...more });
    };
    return { tilt, long, at, piece };
  };
  /** Its width in sheets, laid side by side, alternately a shade apart as sheet bought at different times is. */
  const sheets = (z0: number, z1: number): [number, number, number][] => {
    const n = Math.max(1, Math.round((z1 - z0) / 0.9)), w = (z1 - z0) / n;
    return Array.from({ length: n }, (_, k) => [z0 + k * w, z0 + (k + 1) * w, k % 2 ? SHEET_B : SHEET]);
  };

  // The end bay, down. Its sheet solid, flat from the wall to the dock; as it looks, sagged between its purlins since it
  // came down, its ribs bending with it. Its rafters along both its edges and the purlins across under it, seen from the
  // open side.
  const fallen = pitch(EAVE - 0.05, dock.h + 0.05), PURLIN = 1.5;
  fallen.piece(CANOPY.z0, FALLEN_Z, 0, fallen.long, 0, 0.12, SHEET);
  for (let s = 0; s < fallen.long - 0.01; s += PURLIN) {
    const s1 = Math.min(fallen.long, s + PURLIN), mid = (s + s1) / 2;
    for (const [a, b, l0, l1] of [[s, mid, 0.08, 0.02], [mid, s1, 0.02, 0.08]]) {
      // Each half a plane from one lift to the other: lean it by as much.
      const lean = Math.atan2(l1 - l0, b - a), lift = (l0 + l1) / 2;
      const piece = (z0: number, z1: number, up: number, thick: number, color: number) => {
        const [x, y] = fallen.at((a + b) / 2), off = lift + up - thick / 2, t = fallen.tilt - lean;
        props.push({ shape: 'box', size: [Math.hypot(b - a, l1 - l0) / 2, thick / 2, (z1 - z0) / 2], pos: [x - Math.sin(fallen.tilt) * off, y + Math.cos(fallen.tilt) * off, (z0 + z1) / 2], rot: [0, 0, t], color, ghost: true, fade: true });
      };
      for (const [z0, z1, color] of sheets(CANOPY.z0, FALLEN_Z)) piece(z0, z1, 0, 0.02, color);
      for (let z = CANOPY.z0 + 0.25; z < FALLEN_Z - 0.1; z += 0.45) piece(z, z + 0.06, 0.03, 0.03, RIB);
    }
  }
  for (const z of [CANOPY.z0 + 0.12, FALLEN_Z - 0.12]) fallen.piece(z - 0.08, z + 0.08, 0.2, fallen.long - 0.1, -0.12, 0.3, DARK_STEEL, { ghost: true, fade: true });
  for (let s = PURLIN; s < fallen.long - 0.5; s += PURLIN) fallen.piece(CANOPY.z0 + 0.2, FALLEN_Z - 0.2, s - 0.04, s + 0.04, -0.12, 0.14, STEEL, { ghost: true, fade: true });
  // Torn from what still stands along its north edge, the sheet there bent up off it near the top, where the two were
  // still level: it stands in the way of riding up onto what still stands.
  fallen.piece(FALLEN_Z - 0.35, FALLEN_Z - 0.2, 0, fallen.long * 0.32, 0.45, 0.45, SHEET);
  for (const [s0, s1, h] of [[0.3, 2.6, 0.5], [2.6, 5.4, 0.38], [5.4, 8.9, 0.3]]) fallen.piece(FALLEN_Z - 0.32, FALLEN_Z - 0.18, s0, s1, h + 0.02, 0.03, RIB, { ghost: true, fade: true });
  // At its foot, on the dock's edge: its front beam crumpled under it, its gutter torn and bent, felt going over.
  box(dock.x1 - 0.5, dock.h, CANOPY.z0, dock.x1 + 0.1, dock.h + 0.1, FALLEN_Z, DARK_STEEL, { wheelsOnly: true });
  box(dock.x1 - 0.75, dock.h, CANOPY.z0 + 0.3, dock.x1 - 0.45, dock.h + 0.16, FALLEN_Z - 1.2, GUTTER, { rot: [0.25, 0.04, 0], ghost: true });
  // Its four posts, at the dock's edge and down the middle, snapped low down: their stubs in the bay, below a lorry's
  // frame, their tops thrown down in it.
  for (const [x, z, lean] of [[CANOPY.x0 + 0.25, CANOPY.z0 + 0.15, 0.4], [CANOPY.x0 + 0.25, FALLEN_Z - 0.15, -0.5], [MID_X, CANOPY.z0 + 0.15, -0.3], [MID_X, FALLEN_Z - 0.15, 0.6]]) {
    box(x - 0.1, 0, z - 0.1, x + 0.1, 0.4, z + 0.1, STEEL);
    rod([x + 0.1, 0.4, z], [x + 3.2, 0.1, z + lean * 3], 0.1, STEEL, { ghost: true });
  }
  // The lights it had under it, come down with it onto it and onto the dock.
  for (const [s, dz, a] of [[0.3, 2.2, 0.4], [0.55, 6.3, 2.1], [0.78, 3.8, 1.2]]) {
    const [x, y] = fallen.at(s * fallen.long);
    object('tubeLight', x, CANOPY.z0 + dz, a, y + 0.05);
  }

  // The rest, still up: the sheet, its ribs; its rafters under it, a heavy one along the edge the end bay tore off,
  // the purlins across them; along its front the beam, the gutter, the downpipes, on a post every bay. From under it,
  // the lights.
  const up = pitch(WALL_Y, FRONT_Y);
  const shade = { fade: true };
  up.piece(FALLEN_Z, CANOPY.z1, 0, up.long, 0, 0.1, SHEET, shade);
  for (const [z0, z1, color] of sheets(FALLEN_Z, CANOPY.z1)) up.piece(z0, z1, 0, up.long, 0.02, 0.02, color, { ghost: true, fade: true });
  for (let z = FALLEN_Z + 0.25; z < CANOPY.z1 - 0.1; z += 0.45) up.piece(z, z + 0.06, 0, up.long, 0.05, 0.03, RIB, { ghost: true, fade: true });
  up.piece(FALLEN_Z, FALLEN_Z + 0.2, 0, up.long, -0.1, 0.32, DARK_STEEL, shade);
  for (let z = FALLEN_Z + BAY; z <= CANOPY.z1 + 0.01; z += BAY) up.piece(z - 0.09, z + 0.09, 0, up.long, -0.1, 0.3, DARK_STEEL, { ghost: true, fade: true });
  for (let s = PURLIN; s < up.long - 0.5; s += PURLIN) up.piece(FALLEN_Z + 0.2, CANOPY.z1, s - 0.04, s + 0.04, -0.1, 0.14, STEEL, { ghost: true, fade: true });
  const frontY = FRONT_Y - 0.1;
  box(CANOPY.x0, frontY - 0.3, FALLEN_Z, CANOPY.x0 + 0.25, frontY, CANOPY.z1, DARK_STEEL, shade);
  box(CANOPY.x0 - 0.25, frontY - 0.15, FALLEN_Z, CANOPY.x0, frontY + 0.1, CANOPY.z1, GUTTER, { ghost: true, fade: true });
  for (let z = FALLEN_Z; z <= CANOPY.z1 + 0.01; z += BAY) {
    const pz = Math.min(CANOPY.z1 - 0.12, Math.max(FALLEN_Z + 0.12, z));
    box(CANOPY.x0 + 0.05, 0, pz - 0.1, CANOPY.x0 + 0.25, frontY - 0.3, pz + 0.1, STEEL);
    rod([CANOPY.x0 + 0.4, frontY - 0.2, pz + 0.2], [CANOPY.x0 + 0.4, 0.05, pz + 0.2], 0.05, GUTTER, { ghost: true });
    box(CANOPY.x0 - 0.12, frontY - 0.2, pz + 0.14, CANOPY.x0 + 0.4, frontY - 0.12, pz + 0.26, GUTTER, { ghost: true });
  }
  // Its middle row of posts under the beam the rafters cross on.
  {
    const [, y] = up.at(up.long / 2);
    box(MID_X - 0.12, y - 0.55, FALLEN_Z, MID_X + 0.12, y - 0.4, CANOPY.z1, DARK_STEEL, { fade: true });
    for (let z = FALLEN_Z; z <= CANOPY.z1 + 0.01; z += BAY) {
      const pz = Math.min(CANOPY.z1 - 0.12, Math.max(FALLEN_Z + 0.12, z));
      box(MID_X - 0.1, 0, pz - 0.1, MID_X + 0.1, y - 0.55, pz + 0.1, STEEL);
    }
  }
  for (let z = FALLEN_Z + BAY / 2; z < CANOPY.z1; z += BAY)
    for (const s of [up.long * 0.3, up.long * 0.7]) {
      const [x, y] = up.at(s);
      box(x - 0.62, y - 0.47, z - 0.06, x + 0.62, y - 0.42, z + 0.06, 0xd8dcde, { ghost: true, fade: true });
      box(x - 0.6, y - 0.5, z - 0.02, x + 0.6, y - 0.47, z + 0.02, 0xf4f6f0, { ghost: true, fade: true });
    }
  // Where the end bay tore off it: stubs of its purlins still bolted to the edge rafter, sticking out over the way at the
  // height of the cab and the bed's walls.
  for (const [s, out, droop] of [[0.38, 1.0, 0.1], [0.56, 1.4, 0.25], [0.74, 0.9, 0.05]] as const) {
    const [x, y] = up.at(up.long * s);
    rod([x, y - 0.2, FALLEN_Z + 0.05], [x + 0.15, y - 0.2 - droop, FALLEN_Z - out], 0.06, STEEL);
  }
  // Up the wall, the steel channel along the eaves the whole canopy hangs from.
  box(CANOPY.x1 - 0.2, WALL_Y - 0.4, CANOPY.z0, CANOPY.x1, WALL_Y, CANOPY.z1, DARK_STEEL, { ghost: true });

  // In the bay under it: two of the ice plant's lorries backed up to the dock, their fridge units on the front; ice
  // chests on their wheels lined up along the dock's face between them, a pallet. Seen into from the open side of the end bay.
  for (const z of [FALLEN_Z + 3, FALLEN_Z + 15]) {
    props.push({ shape: 'box', size: [1.15, 1.4, 3.7], pos: [CANOPY.x0 + 0.4 + 3.7, 1.6, z], rot: [0, Math.PI / 2, 0], color: 0xf2efe6, vehicle: 'van' });
    box(CANOPY.x0 + 6.2, 2.6, z - 0.75, CANOPY.x0 + 6.85, 3.15, z + 0.75, 0xd8dcde, { ghost: true });
  }
  for (const z of [FALLEN_Z + 9.4, FALLEN_Z + 10.5, FALLEN_Z + 11.6, FALLEN_Z + 21.2, FALLEN_Z + 22.3]) object('iceChest', CANOPY.x0 + 1, z, Math.PI / 2 + (z % 1) * 0.2, 0);
  object('pallet', CANOPY.x0 + 2.4, FALLEN_Z + 13, 0.1, 0);
  object('crateTrolley', CANOPY.x0 + 2.2, FALLEN_Z + 7.6, 0.6, 0);

  // South of the canopy, the open end of the bay, where the lorries wait their turn at the dock and turn round: one
  // parked along the hall's wall, nose to the yard; the plant's forklift left by the dock's face; empty pallets stacked,
  // ice chests in a row.
  props.push({ shape: 'box', size: [1.15, 1.4, 3.7], pos: [CANOPY.x1 - 2.2, 1.6, 266], color: 0xf2efe6, vehicle: 'van' });
  box(CANOPY.x1 - 2.95, 2.6, 268.9, CANOPY.x1 - 1.45, 3.15, 269.55, 0xd8dcde, { ghost: true });
  object('forklift', CANOPY.x0 + 2.6, 265.5, Math.PI / 2 + 0.2, 0);
  for (let k = 0; k < 5; k++) object('pallet', CANOPY.x0 + 1.4, 252.5, k * 0.05, k * 0.15);
  for (let k = 0; k < 4; k++) object('pallet', CANOPY.x0 + 1.4, 254.2, 0.1 + k * 0.04, k * 0.15);
  for (const z of [259, 260.1, 261.2, 262.3]) object('iceChest', CANOPY.x0 + 1, z, Math.PI / 2, 0);
  for (const [x, z, a] of [[-25.5, 276.6, 0.6], [-23, 279.8, 2.2], [-27.2, 270.6, 1.4]]) object('foamBox', x, z, a, 0);

  // The market's back wall over the bay and the yard, its loading side: roller doors under little awnings, one up on a
  // loading step; downpipes off the eaves' gutter and the rain's streaks under them; air conditioners, the meters, small
  // barred windows; the bins; its notices painted on. Under its eaves, what lands there: the steel skips, the loading
  // step's edge, another skip under the end bay's open side, drums, crates.
  const W = CANOPY.x1 - 0.3, STREAK = 0xb2ab9b, FACE: Partial<PropDesc> = { ghost: true, fade: true };
  const back: SignDesc[] = [];
  box(W - 0.1, 0, 240, W, 0.5, 372, 0x8d9086, FACE);
  box(W - 0.6, 0, 240, W - 0.1, 0.02, 372, 0x3a3e40, { ghost: true });
  for (const z of [246, 258, 270, 282, 306, 318, 342, 354, 366]) {
    box(W - 0.02, 0.5, z - 0.32, W, EAVE - 0.2, z + 0.32, STREAK, FACE);
    rod([W - 0.14, EAVE - 0.1, z], [W - 0.14, 0.35, z], 0.07, 0x7d8a8e, FACE);
    box(W - 0.4, 0.05, z - 0.1, W - 0.05, 0.3, z + 0.1, 0x7d8a8e, FACE);
  }
  box(W - 0.25, EAVE - 0.25, 240, W, EAVE - 0.05, 372, 0x7d8a8e, FACE);
  // Roller doors, each with its guides, its drum's box over it, an awning on two brackets.
  for (const z of [247.3, 274, 300.5, 312, 340, 352]) {
    box(W - 0.1, 0, z - 1.5, W, 3, z + 1.5, 0x9ea4a6, FACE);
    for (let y = 0.25; y < 3; y += 0.25) box(W - 0.12, y - 0.015, z - 1.45, W - 0.1, y + 0.015, z + 1.45, 0x858b8e, { ghost: true });
    for (const s of [-1, 1]) box(W - 0.15, 0, z + s * 1.55 - 0.06, W, 3, z + s * 1.55 + 0.06, 0x6e7478, FACE);
    box(W - 0.35, 3, z - 1.7, W, 3.4, z + 1.7, 0x7c8286, FACE);
    box(W - 1, 3.55, z - 2, W, 3.62, z + 2, 0x3f6f8f, FACE);
    for (const s of [-1, 1]) rod([W, 3.2, z + s * 1.8], [W - 0.95, 3.55, z + s * 1.8], 0.03, 0x5f666c, { ghost: true });
  }
  // The air conditioners, on brackets: over the parked lorry, by the yard's doors.
  for (const [z, y] of [[264.6, 3.3], [265.7, 3.3], [322.5, 2.4], [336.3, 2.4], [337.4, 2.4], [358.5, 2.4]] as const) {
    box(W - 0.62, y, z - 0.42, W - 0.02, y + 0.6, z + 0.42, 0xd8dad4, FACE);
    props.push({ shape: 'cylinder', size: [0.22, 0.01, 0], pos: [W - 0.63, y + 0.3, z - 0.1], rot: [0, 0, Math.PI / 2], color: 0x4a5056, ghost: true, fade: true });
    box(W - 0.66, y - 0.06, z - 0.4, W, y, z - 0.34, 0x5f666c, { ghost: true });
    box(W - 0.66, y - 0.06, z + 0.34, W, y, z + 0.4, 0x5f666c, { ghost: true });
    rod([W - 0.1, y + 0.4, z + 0.3], [W - 0.1, EAVE - 0.4, z + 0.3], 0.025, 0xe8e6e0, { ghost: true });
  }
  // The meters, and the hose on its reel.
  for (const z of [290, 334]) {
    box(W - 0.25, 1.2, z - 0.4, W, 2.1, z + 0.4, 0x9aa0a4, FACE);
    for (const dz of [-0.22, 0, 0.22]) box(W - 0.27, 1.6, z + dz - 0.07, W - 0.25, 1.75, z + dz + 0.07, 0x2a3036, { ghost: true });
    rod([W - 0.12, 2.1, z], [W - 0.12, EAVE - 0.3, z], 0.04, 0x3a3e40, { ghost: true });
  }
  props.push({ shape: 'cylinder', size: [0.35, 0.12, 0], pos: [W - 0.2, 1.2, 283.4], rot: [0, 0, Math.PI / 2], color: 0x2f7a4a, ghost: true, fade: true });
  // Small windows high up, barred.
  for (const z of [241.6, 286.6, 324.8, 346.2, 361.2]) {
    box(W - 0.04, 3.05, z - 0.6, W, 3.75, z + 0.6, 0x4c5a62, FACE);
    box(W - 0.08, 2.98, z - 0.68, W - 0.04, 3.05, z + 0.68, 0xdad6cc, FACE);
    for (const dz of [-0.36, -0.12, 0.12, 0.36]) box(W - 0.1, 3.05, z + dz - 0.015, W - 0.07, 3.75, z + dz + 0.015, 0x3a3e40, { ghost: true });
  }
  back.push({ kind: 'name', text: '南安市場　後門卸貨區　禁止停車', colors: ['#d6d1c4', '#b0302a', '#d6d1c4'], wide: 6, pos: [W - 0.03, 3.95, 252.6], rotY: -Math.PI / 2 },
    { kind: 'name', text: '魚貨卸貨　請勿久停', colors: ['#d6d1c4', '#b0302a', '#d6d1c4'], wide: 4.2, pos: [W - 0.03, 2.2, 306], rotY: -Math.PI / 2 },
    { kind: 'name', text: '市場後門　請勿堵塞', colors: ['#d6d1c4', '#1f4f9a', '#d6d1c4'], wide: 4.2, pos: [W - 0.03, 3.95, 346], rotY: -Math.PI / 2 });

  // The skips: steel, a lip round the top, lugs to lift them by, a lid thrown back, the bags heaped in them. Two by the
  // wall, one out under the end bay's open side.
  const skip = (x0: number, z0: number, x1: number, z1: number) => {
    box(x0, 0, z0, x1, 1.45, z1, 0x2f5a3a);
    box(x0 - 0.06, 1.35, z0 - 0.06, x1 + 0.06, 1.5, z1 + 0.06, 0x264a30, { ghost: true });
    for (const z of [z0 + 0.5, z1 - 0.5]) for (const [a, b] of [[x0 - 0.12, x0], [x1, x1 + 0.12]]) box(a, 0.7, z - 0.15, b, 1.1, z + 0.15, 0x3a3e40, { ghost: true });
    props.push({ shape: 'box', size: [(x1 - x0) / 2, 0.03, (z1 - z0) / 4], pos: [(x0 + x1) / 2, 1.85, z1 + 0.25], rot: [-1.1, 0, 0], color: 0x1e2a22, ghost: true });
    for (let k = 0; k < 5; k++) props.push({ shape: 'sphere', size: [0.38, 0.3, 0.38], pos: [x0 + 0.4 + (k % 2) * (x1 - x0 - 0.8), 1.55, z0 + 0.5 + (k * (z1 - z0 - 1)) / 4], color: k % 2 ? 0x2a2c30 : 0x3e4a58, ghost: true });
  };
  skip(W - 1.9, 255.4, W - 0.1, 258.3);
  skip(W - 1.9, 258.8, W - 0.1, 261.7);
  skip(-28.2, 279.6, -25.4, 283.2);
  for (const [x, z] of [[-24.6, 254.8], [-24, 262.6], [-23.8, 271.2]]) object('bin', x, z, 0, 0);
  // The loading step at the door up it: concrete, its edge striped, a rail along it, steps at its north end.
  box(W - 1.6, 0, 270.5, W, 0.9, 277.4, 0x9a9c96);
  box(W - 1.62, 0.55, 270.5, W - 1.6, 0.9, 277.4, 0xd0a030, { ghost: true });
  box(W - 1.6, 0, 277.4, W, 0.6, 278.1, 0x9a9c96);
  box(W - 1.6, 0, 278.1, W, 0.3, 278.8, 0x9a9c96);
  for (let z = 270.7; z < 277.4; z += 1.65) rod([W - 1.45, 0.9, z], [W - 1.45, 1.9, z], 0.03, 0xd0a030, { ghost: true });
  rod([W - 1.45, 1.9, 270.7], [W - 1.45, 1.9, 277.3], 0.03, 0xd0a030, { ghost: true });
  // Out from it, what the lorries take and bring: drums, crates of empties on their pallets, a trolley.
  for (const [x, z] of [[-25.2, 272.4], [-25.9, 273.1], [-25.1, 273.6], [-26.6, 272.3]]) object('oilDrum', x, z, 0, 0);
  for (const [cx, cz] of [[-24.6, 248], [-25.8, 285.6]]) {
    object('pallet', cx, cz, 0, 0);
    for (let k = 0; k < 12; k++) object('vegCrate', cx + (k % 2) * 0.6 - 0.3, cz + ((k % 4) >> 1) * 0.42 - 0.21, 0, 0.15 + Math.floor(k / 4) * 0.3);
  }
  object('crateTrolley', -22.6, 281.4, 2.6, 0);

  // On the dock where the end bay came down: what was stacked along its edge there, knocked over and thrown about, the
  // polystyrene, the fish boxes, a trolley; along the plant's wall the sacks of crushed ice waiting for the boats, two
  // pallets of them stacked two high, the nearer knocked over, its sacks out toward the way; the sheet torn off the
  // bay's front.
  for (const [x, z, a] of [[-37.6, 286.2, 0.3], [-38.8, 284.9, 1.4], [-39.5, 291.6, 2.2], [-38.2, 293.1, 0.8], [-40.9, 288.4, 2.9], [-41.8, 294.6, 0.5], [-37.4, 296.4, 1.1], [-43.2, 286.6, 1.9]]) object('foamBox', x, z, a);
  for (const [x, z, a] of [[-40.2, 296.8, 0.2], [-41, 297.4, 0.4], [-38.6, 283.6, 1.6]]) object('fishBox', x, z, a);
  object('crateTrolley', -42.6, 291.2, 1.2);
  for (const [cx, cz, fell] of [[-49.6, 303.5, false], [-49.2, 298.4, true]] as const) {
    for (let k = 0; k < 8; k++) {
      const layer = Math.floor(k / 4), i = k % 4;
      if (fell && layer) object('iceBag', cx + 1.4 + i * 0.75, cz - 0.6 + (i % 2) * 0.7, 0.4 + i, dock.h);
      else object('iceBag', cx + (i % 2) * 0.72 - 0.36, cz + Math.floor(i / 2) * 0.48 - 0.24, 0, dock.h + 0.12 + layer * 0.25);
    }
    object('pallet', cx, cz, 0);
  }
  for (const [x, z, a] of [[-44.4, 289.6, 0.7], [-39.2, 299.6, 2.4]]) object('tinSheet', x, z, a);

  // Left at the foot of the end bay, south along the dock: the plant's loading floor in front of its store. The bags of
  // ice on their pallets by its doors; the crusher at the dock's edge, its chute out over the bay where the lorries back
  // up, a cart of blocks waiting by it; the scale; the empty cans stacked; the boats' baskets in stacks along the end
  // wall, the notice on it.
  const bags = (cx: number, cz: number, n: number) => {
    object('pallet', cx, cz, 0);
    for (let k = 0; k < n; k++) object('iceBag', cx + (k % 2) * 0.72 - 0.36, cz + ((k % 4) >> 1) * 0.48 - 0.24, 0, dock.h + 0.12 + Math.floor(k / 4) * 0.25);
  };
  for (const [z, n] of [[281.4, 12], [277.6, 8], [273.8, 12], [262.6, 12]] as const) bags(dock.x0 + 1.6, z, n);
  for (const [x, z, a] of [[-48.2, 276.4, 0.6], [-47.6, 277.3, 2.2]] as const) object('iceBag', x, z, a);
  const CRUSH = { x: dock.x1 - 1.4, z: 268 };
  box(CRUSH.x - 0.8, dock.h, CRUSH.z - 0.8, CRUSH.x + 0.8, dock.h + 1.4, CRUSH.z + 0.8, 0xb8c0c4);
  box(CRUSH.x - 1.1, dock.h + 1.4, CRUSH.z - 1.1, CRUSH.x + 1.1, dock.h + 2.2, CRUSH.z + 1.1, 0xa8b0b4);
  box(CRUSH.x - 0.4, dock.h + 0.3, CRUSH.z + 0.8, CRUSH.x + 0.4, dock.h + 0.9, CRUSH.z + 1.3, 0x2f62a8);
  rod([CRUSH.x + 0.8, dock.h + 1.1, CRUSH.z], [dock.x1 + 2.4, dock.h + 0.2, CRUSH.z], 0.26, 0xb8c0c4, { ghost: true });
  object('blockCart', CRUSH.x - 2.4, CRUSH.z + 2.2, 0.1);
  for (let k = 0; k < 4; k++) object('iceBlock', CRUSH.x - 2.4 + ((k % 2) - 0.5) * 0.58, CRUSH.z + 2.2, 0.1, dock.h + 0.33 + Math.floor(k / 2) * 0.29);
  object('iceBlock', CRUSH.x - 2.2, CRUSH.z - 1.4, 1.2);
  box(-45.6, dock.h, 258.4, -44.4, dock.h + 0.08, 259.6, DARK_STEEL, { ghost: true });
  box(-45.56, dock.h, 259.62, -45.44, dock.h + 1.1, 259.74, STEEL);
  box(-45.75, dock.h + 1.1, 259.6, -45.25, dock.h + 1.6, 259.76, 0xf2efe6);
  for (let k = 0; k < 12; k++) {
    const layer = Math.floor(k / 4), i = k % 4;
    object('iceCan', -47.6 + (i % 2) * 1.25 - 0.62, 255.2 + Math.floor(i / 2) * 0.64 - 0.32, Math.PI / 2, dock.h + layer * 0.3);
  }
  const BASKETS = ['basketBlue', 'basketYellow', 'basketRed', 'basketGreen'] as const;
  let c = 0;
  for (const x of [-45.2, -44.5, -43.8, -43.1, -42.4]) {
    const n = 5 + ((c * 7) % 4), kind = BASKETS[Math.floor(c++ / 2) % 4];
    for (let k = 0; k < n; k++) object(kind, x, dock.z0 + 1.2, 0, dock.h + k * 0.27);
  }
  for (const [x, z, a, k] of [[-42.6, 256.4, 0.7, 0], [-43, 255, 2.1, 1], [-45.6, 256.8, 1.2, 2]] as const) object(BASKETS[k], x, z, a);
  // Down the middle of the floor, what was being got ready for the last lorries: pallets of bags, carts of blocks,
  // pallets of the boats' baskets stacked four high.
  const basketPallet = (cx: number, cz: number) => {
    object('pallet', cx, cz, 0);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4 - (i % 2); k++) object(BASKETS[(i + Math.round(cz)) % 4], cx + (i % 2) * 0.62 - 0.31, cz + (i >> 1) * 0.46 - 0.23, 0, dock.h + 0.15 + k * 0.27);
  };
  basketPallet(-44, 279.4);
  basketPallet(-44, 260.6);
  bags(-44, 270, 12);
  for (const z of [274.6, 265.2]) {
    object('blockCart', -44, z, 0.05);
    for (let k = 0; k < 4; k++) object('iceBlock', -44 + ((k % 2) - 0.5) * 0.58, z, 0.05, dock.h + 0.33 + Math.floor(k / 2) * 0.29);
  }
  for (const [x, z, a] of [[-42.4, 266.6, 1.1], [-45.3, 272.4, 2.6]] as const) object('iceBag', x, z, a);
  object('bicycle', dock.x0 + 0.7, 284.2, Math.PI / 2 + 0.15);
  object('mopBucket', -44.2, 255.8, 0.3);

  // Seen from the end bay, down the dock: the big things of the place, each its own landmark.
  const UP: Partial<PropDesc> = { ghost: true, fade: true, overhead: true };
  const more: SignDesc[] = [];
  // At the dock's end, the plant's office: two containers one on the other, blue under white, windows and an air
  // conditioner each, a steel stair up the front to the upper one's door, the water tank on top, the name along it.
  const OFF = { x0: dock.x0 + 0.2, x1: dock.x0 + 6.2, z0: dock.z0 + 0.3, z1: dock.z0 + 2.8 };
  for (const [y0, color, rib] of [[dock.h, 0x2f62a8, 0x28568f], [dock.h + 2.6, 0xe8e6e0, 0xcfccc4]] as const) {
    box(OFF.x0, y0, OFF.z0, OFF.x1, y0 + 2.6, OFF.z1, color, { fade: true });
    for (let x = OFF.x0 + 0.15; x < OFF.x1; x += 0.3) box(x, y0 + 0.1, OFF.z1, x + 0.12, y0 + 2.5, OFF.z1 + 0.03, rib, { ghost: true });
    for (const x of [OFF.x0 + 1.2, OFF.x0 + 3.4]) {
      box(x, y0 + 1, OFF.z1 + 0.03, x + 1.4, y0 + 2, OFF.z1 + 0.06, 0x50606a, { ghost: true });
      box(x - 0.05, y0 + 0.95, OFF.z1 + 0.06, x + 1.45, y0 + 1, OFF.z1 + 0.09, 0xdadfd6, { ghost: true });
    }
    box(OFF.x1 - 1.3, y0, OFF.z1 + 0.03, OFF.x1 - 0.4, y0 + 2.1, OFF.z1 + 0.07, 0x8a949a, { ghost: true });
    box(OFF.x0 + 0.2, y0 + 1.9, OFF.z1 + 0.06, OFF.x0 + 0.9, y0 + 2.4, OFF.z1 + 0.4, 0xd8dcde, { ghost: true });
  }
  // Its stair, along the front from the floor up to the upper door: on posts, a rail.
  const SX = OFF.x1 + 1.6, SZ = OFF.z1 + 0.6, top = dock.h + 2.6, SX1 = OFF.x1 - 0.85;
  props.push({ shape: 'box', size: [Math.hypot(SX - SX1, top - dock.h) / 2, 0.05, 0.5], pos: [(SX + SX1) / 2, (dock.h + top) / 2 - 0.1, SZ], rot: [0, 0, -Math.atan2(top - dock.h, SX - SX1)], color: STEEL, ...UP });
  for (let i = 1; i < 9; i++) {
    const x = SX - ((SX - SX1) * i) / 9, y = dock.h + ((top - dock.h) * i) / 9;
    box(x - 0.12, y - 0.02, SZ - 0.45, x + 0.12, y, SZ + 0.45, 0x7a8288, UP);
  }
  box(OFF.x1 - 1.5, top - 0.1, OFF.z1, OFF.x1 - 0.2, top, OFF.z1 + 1.1, STEEL, UP);
  rod([SX, dock.h + 1, SZ + 0.5], [SX1, top + 1, SZ + 0.5], 0.025, 0xd0a030, UP);
  for (const x of [OFF.x1 - 1.45, OFF.x1 - 0.25]) box(x - 0.05, dock.h, OFF.z1 + 1.0, x + 0.05, top, OFF.z1 + 1.1, STEEL);
  // On its roof: the water tank on its stand, and the name.
  for (const x of [OFF.x0 + 0.9, OFF.x0 + 2.1]) box(x - 0.05, dock.h + 5.2, OFF.z0 + 0.8, x + 0.05, dock.h + 5.8, OFF.z0 + 1.8, STEEL, { fade: true });
  props.push({ shape: 'cylinder', size: [0.6, 0.9, 0], pos: [OFF.x0 + 1.5, dock.h + 6.4, OFF.z0 + 1.3], rot: [0, 0, Math.PI / 2], color: 0xc9ced2, fade: true });
  more.push({ kind: 'name', text: '順發製冰　辦公室', colors: ['#1f4f9a', '#f2efe6', '#f2efe6'], wide: 3.4, pos: [OFF.x0 + 4.4, dock.h + 5.7, OFF.z1 - 0.3], rotY: 0 });

  // Along the dock's edge, a refrigerated container on the lorries' side, plugged in, waiting to go: white, ribbed, its
  // cooling unit at the north end, the firm's name down its side.
  const REEF = { x0: dock.x1 - 2.6, x1: dock.x1 - 0.2, z0: 251.4, z1: 263.4 };
  box(REEF.x0, dock.h, REEF.z0, REEF.x1, dock.h + 2.6, REEF.z1, 0xeef0ee);
  for (let z = REEF.z0 + 0.2; z < REEF.z1; z += 0.35) box(REEF.x0 - 0.03, dock.h + 0.1, z, REEF.x0, dock.h + 2.5, z + 0.12, 0xd6dad8, { ghost: true });
  box(REEF.x0 + 0.1, dock.h + 0.2, REEF.z1, REEF.x1 - 0.1, dock.h + 2.4, REEF.z1 + 0.35, 0x8a949a, { ghost: true });
  for (const y of [0.9, 1.7]) props.push({ shape: 'cylinder', size: [0.42, 0.03, 0], pos: [(REEF.x0 + REEF.x1) / 2, dock.h + y, REEF.z1 + 0.37], rot: [Math.PI / 2, 0, 0], color: 0x3a4248, ghost: true });
  box(REEF.x0 - 0.04, dock.h + 2.2, REEF.z0 + 0.4, REEF.x0, dock.h + 2.35, REEF.z1 - 0.4, 0x2f62a8, { ghost: true });
  rod([REEF.x0 + 0.4, dock.h + 0.4, REEF.z1 + 0.3], [REEF.x0 - 1.6, dock.h + 0.02, REEF.z1 + 1.8], 0.04, 0x1e1f22, { ghost: true });
  box(REEF.x0 - 1.8, dock.h, REEF.z1 + 1.7, REEF.x0 - 1.4, dock.h + 1.3, REEF.z1 + 2.1, 0x8a949a);
  more.push({ kind: 'name', text: '順發冷鏈', colors: ['#1f4f9a', '#f2efe6', '#f2efe6'], wide: 4, pos: [REEF.x0 - 0.06, dock.h + 1.4, (REEF.z0 + REEF.z1) / 2], rotY: -Math.PI / 2 });

  // The belt the blocks come out of the store on, high across the dock to the crusher's hopper: a steel truss, a block
  // or two on it, on a pair of legs.
  const BELT_A: Vec3 = [dock.x0, dock.h + 6.2, CRUSH.z], BELT_B: Vec3 = [CRUSH.x - 0.6, dock.h + 2.5, CRUSH.z];
  const beltLong = Math.hypot(BELT_B[0] - BELT_A[0], BELT_B[1] - BELT_A[1]), beltTilt = Math.atan2(BELT_B[1] - BELT_A[1], BELT_B[0] - BELT_A[0]);
  const along = (t: number, up = 0): Vec3 => [BELT_A[0] + (BELT_B[0] - BELT_A[0]) * t, BELT_A[1] + (BELT_B[1] - BELT_A[1]) * t + up, CRUSH.z];
  const beltPiece = (up: number, h: number, w: number, color: number, dz = 0) => props.push({ shape: 'box', size: [beltLong / 2, h / 2, w / 2], pos: [along(0.5, up)[0], along(0.5, up)[1], CRUSH.z + dz], rot: [0, 0, beltTilt], color, ...UP });
  beltPiece(0, 0.08, 0.9, 0x2a2c30);
  for (const dz of [-0.5, 0.5]) beltPiece(0.05, 0.3, 0.06, 0xd0a030, dz);
  beltPiece(-0.45, 0.06, 0.8, STEEL);
  for (const t of [0.25, 0.5, 0.75]) {
    const [x, y] = along(t, 0.2);
    props.push({ shape: 'box', size: [0.28, 0.12, 0.22], pos: [x, y, CRUSH.z], rot: [0, 0, beltTilt], color: 0xcfe6ee, ...UP });
  }
  box(dock.x0, dock.h + 5.4, CRUSH.z - 0.9, dock.x0 + 0.6, dock.h + 7.4, CRUSH.z + 0.9, 0x8a949a, { fade: true });
  for (const t of [0.35, 0.72]) {
    const [x, y] = along(t, -0.5);
    for (const dz of [-0.55, 0.55]) box(x - 0.08, dock.h, CRUSH.z + dz - 0.08, x + 0.08, y, CRUSH.z + dz + 0.08, STEEL);
    rod([x, dock.h + 0.3, CRUSH.z - 0.55], [x, y - 0.2, CRUSH.z + 0.55], 0.03, STEEL, { ghost: true });
  }

  // By the store's wall at the north end, where the end bay's foot is: the plant's shrine to the earth god, red, its green
  // roof, its offerings, the can for burning paper; a red lantern. A banner along the wall.
  const SH = { x: dock.x0 + 0.75, z: 287.6 };
  box(SH.x - 0.7, dock.h, SH.z - 0.9, SH.x + 0.7, dock.h + 1.5, SH.z + 0.9, 0xc8372d);
  box(SH.x - 0.85, dock.h + 1.5, SH.z - 1.15, SH.x + 0.95, dock.h + 1.72, SH.z + 1.15, 0x2f6b4a, { ghost: true });
  box(SH.x - 0.6, dock.h + 1.72, SH.z - 0.95, SH.x + 0.75, dock.h + 1.86, SH.z + 0.95, 0xd9a62e, { ghost: true });
  box(SH.x + 0.7, dock.h + 0.4, SH.z - 0.4, SH.x + 0.72, dock.h + 1.2, SH.z + 0.4, 0x2a1a12, { ghost: true });
  for (const dz of [-0.6, 0.6]) box(SH.x + 0.7, dock.h + 0.2, SH.z + dz - 0.1, SH.x + 0.73, dock.h + 1.3, SH.z + dz + 0.1, 0xd9a62e, { ghost: true });
  props.push({ shape: 'sphere', size: [0.22, 0.28, 0.22], pos: [SH.x + 0.95, dock.h + 1.25, SH.z], color: 0xd8342c, ghost: true });
  object('offerings', SH.x + 1.8, SH.z, Math.PI / 2);
  object('burnerCan', SH.x + 1.6, SH.z + 1.6, 0);
  more.push({ kind: 'name', text: '安全第一　品質第一', colors: ['#c8372d', '#f2efe6', '#f2efe6'], wide: 5, pos: [dock.x0 + 0.1, dock.h + 3.4, 279.5], rotY: Math.PI / 2 });

  // The plant's name along its wall over the dock, where a lorry backing in sees it.
  const signs: SignDesc[] = [{ kind: 'name', text: '順發製冰廠', colors: ['#1f4f9a', '#f2efe6', '#f2efe6'], wide: 7.5, pos: [dock.x0 + 0.12, 6.4, 296], rotY: Math.PI / 2 },
    { kind: 'name', text: '地面濕滑　小心慢行', colors: ['#c8372d', '#f2efe6', '#f2efe6'], wide: 3.6, pos: [-40.2, dock.h + 1.1, dock.z0 + 0.06], rotY: 0 },
    ...more, ...back,
  ];
  return { props, objects, signs };
}
