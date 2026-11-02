import type { Vec3 } from '../config';
import type { ObjectDesc, ObjectKindId } from './objects';
import type { Look, Relief } from './relief';
import type { DecalDesc, PropDesc, SignDesc, Vec2 } from './types';

// Level 4's ice plant: a breather, short, between the market's roof and the sea wall. Down off the dock under the canopy
// into the plant's yard, the last hour before the storm: every boat in the harbour has been in for ice, the yard is
// still full of what was going out, the men have gone home. Round the ice lorry left loading in the middle of it, under
// the gallery that brings the crushed ice over from the plant, one side or the other; up the ramp onto the sea wall and
// through its flood gate.
//
//   the soft side   the boats' plastic baskets, stacked higher than a man in their colours, bank by bank in rows:
//                   through them, and they go everywhere
//   the hard side   the ice itself: blocks on their carts, the empty cans stacked, the blower the ice goes down into
//                   the boats by, the gallery's steel leg
//   the ramp        plain concrete up the sea wall's face, walled; the gate at its top straight ahead

export interface IceParts {
  props: PropDesc[];
  objects: ObjectDesc[];
  signs: SignDesc[];
  decals: DecalDesc[];
}

/** The yard, between the plant on its west and the bay behind the market on its east. */
export const ICE_YARD = { x0: -66, x1: -20, z0: 330, z1: 384 };
/** The ramp up the sea wall's face, straight north, the flood gate through the wall at its top. */
export const RAMP = { x0: -47.25, x1: -40.75, z0: 362, z1: 384, h: 4 };
export const GATE_X = -44, GATE_W = 5;
export const SEA_WALL = { z0: 384, z1: 400, h: 6 };
/** The ice lorry, left in the middle of the yard under the gallery's spout, nose to the ramp. */
const LORRY = { x: -44, z: 342.5 };
/** The gallery from the plant's top floor, across the yard over the lorry, its leg, and north up onto the sea wall. */
const GALLERY = { y: 8.6, z: 347, leg: -35.5 };
/** The plant: three floors of concrete along the yard's west side, its loading bay at the yard's level. */
const PLANT = { x0: -96, face: ICE_YARD.x0, z0: 330, z1: 384, h: 12.5, bay: [338, 356] as [number, number] };
/** The steel stair up its face north of the bay: the first floor's landing from z0, the second's from z1, each 1.6 long. */
const STAIR = { z0: 356.8, z1: 363.6 };
/**
 * In at the second floor's door off the stair, a little room before the cold store: so deep from the face, from z0 to z1,
 * floor to ceiling; the doorway the stair's landing comes to, from door0 to door1, the full height of the room.
 */
export const LOBBY = { deep: 4, z0: 361.8, z1: 366.4, y0: 8.4, y1: 11.2, door0: STAIR.z1 + 0.3, door1: STAIR.z1 + 1.3, wall: 0.25 };
/** The dock the way comes down off, its west edge along the cold store's wall, and its height. */
const DOCK_W = -52, DOCK_H = 1.2;

const STEEL = 0x5f666c, DARK_STEEL = 0x4a5056, STAINLESS = 0xb8c0c4, WALL = 0xc7cdc0, WALL_DARK = 0xaeb5a8;

/** The way through, for the level's route and the test drives: off the dock's ramp, round the lorry's west, the gate. */
export const ICE_WAY: Vec2[] = [[-44, 326], [-44, 333], [-48, 338], [-50.5, 343.5], [-48.5, 350.5], [-44.5, 357], [-44, 363], [-44, 398]];
/** Round its east instead. */
export const ICE_WAY_EAST: Vec2[] = [[-44, 326], [-44, 333], [-40.5, 338], [-39.6, 343.5], [-41, 350.5], [-43.5, 357], [-44, 363], [-44, 398]];

export function icePlant(relief: Relief, looks: { ground: Look }): IceParts {
  const props: PropDesc[] = [];
  const objects: ObjectDesc[] = [];
  const decals: DecalDesc[] = [];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, more: Partial<PropDesc> = {}) =>
    props.push({ shape: 'box', size: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2], pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color, ...more });
  const shed = (x0: number, z0: number, x1: number, z1: number, h: number, seed: number) =>
    box(x0, 0, z0, x1, h, z1, 0xd8cfbf, { fade: true, building: { style: 'shed', open: [false, false, false, false], crown: 0, seed } });
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, y = 0, more: Partial<ObjectDesc> = {}) => objects.push({ kind, pos: [x, y, z], rotY, ...more });
  const rod = (a: Vec3, b: Vec3, r: number, color: number, more: Partial<PropDesc> = {}) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], long = Math.hypot(d[0], d[1], d[2]);
    props.push({ shape: 'cylinder', size: [r, long / 2, 0], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [0, Math.atan2(-d[2], d[0]), -Math.acos(d[1] / long)], color, ...more });
  };
  const rect = (x0: number, z0: number, x1: number, z1: number): [number, number][] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const UP: Partial<PropDesc> = { ghost: true, fade: true, overhead: true };

  // The ground: the yard; the ramp up the sea wall's face; the gate through it.
  relief.area(rect(ICE_YARD.x0, ICE_YARD.z0, ICE_YARD.x1, ICE_YARD.z1), 0, looks.ground);
  relief.area(rect(RAMP.x0, RAMP.z0, RAMP.x1, RAMP.z1), (_x, z) => (RAMP.h * (z - RAMP.z0)) / (RAMP.z1 - RAMP.z0), looks.ground);
  relief.area(rect(GATE_X - GATE_W / 2, SEA_WALL.z0, GATE_X + GATE_W / 2, SEA_WALL.z1), RAMP.h, looks.ground);

  // The plant behind the dock, south of the yard, and west of the plant: shut sheds, the firm's other halls.
  shed(-120, 300, -52, ICE_YARD.z0, 9, 171);
  box(-100, 0, 240, -52, 10, 300, 0xd8cfbf, { fade: true, building: { style: 'shed', open: [false, true, false, false], crown: 0, seed: 172 } });
  shed(-120, 240, -100, 300, 10, 173);
  shed(-120, ICE_YARD.z0, PLANT.x0, SEA_WALL.z0, 9, 174);

  // The plant itself. Painted concrete, three floors, a band at each floor, windows in rows; its name along the top. On
  // the ground floor its loading bay open to the yard, under the floors above on a row of columns: in it the edge of the
  // brine tanks the cans freeze in, the crane over them, a rack of cans on its hook, the cans stacked, a cart of blocks.
  const F = PLANT.face, [b0, b1] = PLANT.bay, BAY_DEEP = 5;
  box(PLANT.x0, 0, PLANT.z0, F, PLANT.h, b0, WALL, { fade: true });
  // North of the bay, round the little room in off the stair's top landing: below it, above it, behind it, either side,
  // and the face either side of its doorway.
  // The top floor round it is in pieces, so that while someone is in the room whatever of it is in the way of seeing them
  // there is not drawn at all (see the end): its ceiling, its walls, the floor beyond them, what is on the roof over.
  const L = LOBBY, NEAR = { x0: F - 12, z0: L.z0 - 4.5, z1: L.z1 + 5.6 };
  const INSIDE: Partial<PropDesc> = { fade: true, openFrom: [[F - L.deep, L.y0 - 0.5, L.z0], [F + 0.1, L.y1, L.z1]] };
  box(PLANT.x0, 0, b1, F, L.y0, PLANT.z1, WALL, { fade: true });
  box(PLANT.x0, L.y0, b1, F, PLANT.h, NEAR.z0, WALL, { fade: true });
  box(PLANT.x0, L.y0, NEAR.z1, F, PLANT.h, PLANT.z1, WALL, { fade: true });
  box(PLANT.x0, L.y0, NEAR.z0, NEAR.x0, PLANT.h, NEAR.z1, WALL, { fade: true });
  box(NEAR.x0, L.y0, NEAR.z0, F, PLANT.h, L.z0, WALL, INSIDE);
  box(NEAR.x0, L.y0, L.z1, F, PLANT.h, NEAR.z1, WALL, INSIDE);
  box(NEAR.x0, L.y0, L.z0, F - L.deep, PLANT.h, L.z1, WALL, INSIDE);
  box(F - L.deep, L.y1, L.z0, F, PLANT.h, L.z1, WALL, INSIDE);
  box(F - L.wall, L.y0, L.z0, F, L.y1, L.door0, WALL, INSIDE);
  box(F - L.wall, L.y0, L.door1, F, L.y1, L.z1, WALL, INSIDE);
  box(PLANT.x0, 0, b0, F - BAY_DEEP, PLANT.h, b1, WALL, { fade: true });
  box(F - BAY_DEEP, 4.6, b0, F, PLANT.h, b1, WALL, { fade: true });
  for (let z = b0 + 4; z < b1 - 1; z += 4.5) box(F - 0.5, 0, z - 0.25, F, 4.6, z + 0.25, WALL_DARK);
  for (const y of [4.6, 8.4]) box(F - 0.05, y - 0.2, PLANT.z0, F + 0.12, y + 0.2, PLANT.z1, 0x41709e, { ghost: true });
  box(F - 0.05, PLANT.h - 0.1, PLANT.z0, F + 0.15, PLANT.h + 0.9, PLANT.z1, WALL_DARK, { fade: true });
  for (const [y0, y1] of [[5.4, 7.6], [9.2, 11.3]])
    for (let z = PLANT.z0 + 2.2; z < PLANT.z1 - 2; z += 3.2) {
      if (y0 > 9 && Math.abs(z - GALLERY.z) < 2.2) continue;
      // Not where the stair's landings come to the wall: doors there instead.
      if (y0 < 9 && z < STAIR.z0 + 1.6 && z + 2.2 > STAIR.z0) continue;
      if (y0 > 9 && z < STAIR.z1 + 1.6 && z + 2.2 > STAIR.z1) continue;
      box(F, y0, z, F + 0.06, y1, z + 2.2, 0x50606a, { ghost: true });
      box(F, y1 - 0.08, z, F + 0.1, y1, z + 2.2, 0xdadfd6, { ghost: true });
      box(F, y0 + (y1 - y0) / 2 - 0.03, z, F + 0.08, y0 + (y1 - y0) / 2 + 0.03, z + 2.2, 0xdadfd6, { ghost: true });
      // Rust and rain down the wall under some of them.
      if (rand() < 0.4) box(F, y0 - 1.2, z + 0.4 + rand() * 1.2, F + 0.02, y0, z + 0.7 + rand() * 1.2, 0x9aa094, { ghost: true });
    }
  // Its other doors on the ground floor, shut; the ice store's insulated doors at the north end.
  for (const z of [333.5, 366.5]) {
    box(F, 0, z - 1.8, F + 0.1, 3.8, z + 1.8, 0x8a949a, { ghost: true });
    for (let y = 0.3; y < 3.8; y += 0.3) box(F + 0.1, y - 0.02, z - 1.8, F + 0.13, y, z + 1.8, 0x7a848a, { ghost: true });
  }
  for (const z of [373, 378.5]) box(F, 0, z - 1.6, F + 0.15, 3, z + 1.6, 0xe8ecee, { ghost: true });
  // In the bay: the tank's edge, the can lids in rows on it; the crane's rails and its bridge, a rack of cans hanging.
  box(F - BAY_DEEP, 0, b0, F - 2.2, 0.6, b1, 0x8a8c88);
  for (let z = b0 + 0.4; z < b1 - 0.3; z += 0.62) for (let x = F - BAY_DEEP + 0.3; x < F - 2.4; x += 0.62) box(x, 0.6, z, x + 0.5, 0.63, z + 0.26, 0x9aa4aa, { ghost: true });
  for (const z of [b0 + 0.3, b1 - 0.3]) box(F - BAY_DEEP, 4.1, z - 0.15, F, 4.4, z + 0.15, 0xd0a030, { ghost: true });
  box(F - 3.4, 3.9, b0 + 0.3, F - 3.0, 4.15, b1 - 0.3, 0xd0a030, { ghost: true });
  rod([F - 3.2, 3.9, 347], [F - 3.2, 2.2, 347], 0.02, 0x2a2c30, { ghost: true });
  box(F - 3.8, 1.2, 345.6, F - 2.6, 2.2, 348.4, 0x9aa4aa, { ghost: true });
  for (let k = 0; k < 6; k++) object('iceCan', F - 1.4, b0 + 1.2 + (k % 3) * 1.3, 0, Math.floor(k / 3) * 0.3);
  object('blockCart', F - 1.3, b1 - 2.2, 0.1);
  for (let k = 0; k < 4; k++) object('iceBlock', F - 1.3 + ((k % 2) - 0.5) * 0.58, b1 - 2.2, 0.1, 0.33 + Math.floor(k / 2) * 0.29);
  object('hookRack', F - BAY_DEEP + 0.4, b0 + 8, Math.PI / 2);
  // Its roof: the cooling towers, the water tank, the parapet.
  for (const z of [338, 346]) {
    props.push({ shape: 'cylinder', size: [2, 1.2, 0], pos: [-88, PLANT.h + 1.2, z], color: 0x8fa6ae, fade: true });
    props.push({ shape: 'cylinder', size: [1.5, 0.25, 0], pos: [-88, PLANT.h + 2.6, z], color: 0x5a6a72, ghost: true, fade: true });
  }
  props.push({ shape: 'cylinder', size: [1.1, 1.3, 0], pos: [-90, PLANT.h + 1.3, 372], color: 0xc9ced2, fade: true });
  const signs: SignDesc[] = [
    { kind: 'name', text: '順發製冰廠', colors: ['#1f4f9a', '#f2efe6', '#f2efe6'], wide: 14, pos: [F + 0.2, PLANT.h + 0.4, 375.5], rotY: Math.PI / 2 },
    { kind: 'name', text: '塊冰　碎冰　冷藏', colors: ['#c8372d', '#f2efe6', '#f2efe6'], wide: 6, pos: [F + 0.1, 3.3, 333.5], rotY: Math.PI / 2 },
  ];

  // The bay behind the market along the yard's east side: its wall; along it the plant's empty pallets, a forklift.
  for (const [z, n] of [[364, 8], [366, 6], [368, 7]] as const) for (let k = 0; k < n; k++) object('pallet', ICE_YARD.x1 - 1.6, z, k * 0.03, k * 0.15);
  object('forklift', -29, 356, Math.PI + 0.3);

  // The gallery: a box of sheet with a strip of windows, on a truss, from the plant's top floor across the yard to its
  // leg, then north up onto the sea wall to the house where the ice is crushed; a spout off it down into the lorry.
  const gallery = (a: Vec3, b: Vec3) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], long = Math.hypot(d[0], d[2]), yaw = Math.atan2(-d[2], d[0]), rise = Math.atan2(d[1], long);
    const at = (up: number): Vec3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + up, (a[2] + b[2]) / 2];
    const piece = (up: number, h: number, w: number, color: number) => props.push({ shape: 'box', size: [long / 2, h / 2, w / 2], pos: at(up), rot: [0, yaw, rise], color, ...UP });
    piece(0.15, 0.3, 2.4, DARK_STEEL);
    piece(0.95, 1.3, 2.3, 0x8fa3ae);
    piece(1.95, 0.7, 2.32, 0x3f4f5a);
    piece(2.45, 0.3, 2.5, 0x7a8c96);
    // Its truss, below: a chord each side, posts and diagonals every three metres.
    for (const side of [-1, 1]) {
      const off = [Math.sin(yaw) * side * 1.1, 0, Math.cos(yaw) * side * 1.1];
      for (let s = 0; s < long - 0.1; s += 3) {
        const p = (t: number, y: number): Vec3 => [a[0] + (d[0] * t) / long + off[0], a[1] + (d[1] * t) / long + y, a[2] + (d[2] * t) / long + off[2]];
        rod(p(s, -0.9), p(Math.min(long, s + 3), 0), 0.05, STEEL, UP);
        rod(p(s, -0.9), p(s, 0), 0.05, STEEL, UP);
      }
    }
  };
  const corner: Vec3 = [GALLERY.leg, GALLERY.y, GALLERY.z], top: Vec3 = [GALLERY.leg, GALLERY.y + 1, SEA_WALL.z0 + 4];
  gallery([F, GALLERY.y, GALLERY.z], corner);
  gallery(corner, top);
  // Its leg: a steel tower in the yard, braced, on a footing. Solid: what holds the gallery up is not knocked over.
  for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) box(GALLERY.leg + dx - 0.13, 0, GALLERY.z + dz - 0.13, GALLERY.leg + dx + 0.13, GALLERY.y, GALLERY.z + dz + 0.13, STEEL);
  box(GALLERY.leg - 1.3, 0, GALLERY.z - 1.3, GALLERY.leg + 1.3, 0.35, GALLERY.z + 1.3, 0x9a9c98);
  for (let y = 0.5; y < GALLERY.y - 1; y += 2.4)
    for (const [a, b] of [[[-0.9, -0.9], [0.9, -0.9]], [[-0.9, 0.9], [0.9, 0.9]], [[-0.9, -0.9], [-0.9, 0.9]], [[0.9, -0.9], [0.9, 0.9]]])
      rod([GALLERY.leg + a[0], y, GALLERY.z + a[1]], [GALLERY.leg + b[0], y + 2.4, GALLERY.z + b[1]], 0.04, STEEL, { ghost: true });
  box(GALLERY.leg - 1.3, GALLERY.y - 0.1, GALLERY.z - 1.3, GALLERY.leg + 1.3, GALLERY.y + 2.7, GALLERY.z + 1.3, 0x7a8c96, UP);
  // The spout over the lorry's box, its canvas sock hanging into it.
  rod([LORRY.x, GALLERY.y, GALLERY.z], [LORRY.x, 4.3, LORRY.z + 0.8], 0.3, STAINLESS, UP);
  rod([LORRY.x, 4.3, LORRY.z + 0.8], [LORRY.x, 3.3, LORRY.z + 0.6], 0.24, 0x3a5f8a, UP);
  // Up on the sea wall, the house the ice is crushed in, and the chute out of it over the wall to where the boats lie.
  box(GALLERY.leg - 3.5, SEA_WALL.h, SEA_WALL.z0 + 2, GALLERY.leg + 3.5, SEA_WALL.h + 4.6, SEA_WALL.z0 + 10, 0xd8cfbf, { fade: true, building: { style: 'shed', open: [false, false, false, false], crown: 0, seed: 187 } });
  rod([GALLERY.leg, SEA_WALL.h + 3.4, SEA_WALL.z0 + 10], [GALLERY.leg, SEA_WALL.h - 1.5, SEA_WALL.z1 + 3], 0.35, STAINLESS, UP);

  // The lorry under the spout, its box's back doors open, bags of ice half in; the bags going into it on a pallet at its
  // tail, the blower beside it the boats' holds are filled by, its hose off across the yard toward the wall.
  props.push({ shape: 'box', size: [1.15, 1.4, 3.7], pos: [LORRY.x, 1.6, LORRY.z], color: 0xf2efe6, vehicle: 'van' });
  box(LORRY.x - 0.75, 2.6, LORRY.z + 2.9, LORRY.x + 0.75, 3.15, LORRY.z + 3.55, 0xd8dcde, { ghost: true });
  object('pallet', LORRY.x, LORRY.z - 4.9, Math.PI / 2);
  for (let k = 0; k < 8; k++) object('iceBag', LORRY.x + ((k % 4) >> 1) * 0.48 - 0.24, LORRY.z - 4.9 + (k % 2) * 0.72 - 0.36, Math.PI / 2, 0.12 + Math.floor(k / 4) * 0.25);
  object('iceBlower', LORRY.x + 2.1, LORRY.z - 2.2, 0.4);
  for (let k = 0; k < 6; k++) rod([LORRY.x + 2.3 + k * 1.6, 0.06, LORRY.z - 2.2 + Math.sin(k) * 0.4], [LORRY.x + 3.9 + k * 1.6, 0.06, LORRY.z - 2.2 + Math.sin(k + 1) * 0.4], 0.07, 0x2a2c30, { ghost: true });

  // The soft side: the boats' plastic baskets, back for ice, stacked one in another higher than a man in their boats'
  // colours, two stacks to a bank, the banks in rows out from the plant as the boats left them; a bank knocked over.
  const BASKETS = ['basketBlue', 'basketYellow', 'basketRed', 'basketGreen'] as const;
  let bank = 0;
  const baskets = (x: number, z: number, n: number, stacks = 2) => {
    const kind = BASKETS[bank++ % 4];
    for (let j = 0; j < stacks; j++) for (let k = 0; k < n - ((j * 3 + bank) % 2); k++) object(kind, x + (rand() - 0.5) * 0.04, z + (j - (stacks - 1) / 2) * 0.46, (rand() - 0.5) * 0.06, k * 0.27);
  };
  for (const [x, zs] of [[-49.4, [336.6, 340.4, 344.6, 349, 352.8]], [-53.4, [338.4, 342.4, 346.6, 350.8, 354.6]], [-57.4, [337.2, 341.2, 345.4, 349.6, 353.6]]] as const)
    for (const z of zs) baskets(x, z, 6 + Math.floor(rand() * 3));
  for (const z of [337, 341.4, 348.8, 353.2]) baskets(-61.8, z, 4 + Math.floor(rand() * 2), 3);
  for (let k = 0; k < 8; k++) object(BASKETS[k % 4], -53.5 + rand() * 4, 344 + rand() * 3, rand() * 3);

  // The hard side: blocks on their carts, waiting to be crushed, and some off them; the empty cans stacked by the wall;
  // the bags of ice on their pallets.
  for (const [x, z, a] of [[-38.6, 337.6, 0.2], [-32.2, 341.8, -0.3], [-39.2, 352.4, 0.5], [-32.6, 349.8, 0.1]] as const) {
    object('blockCart', x, z, a);
    for (let k = 0; k < 4; k++) object('iceBlock', x + ((k % 2) - 0.5) * 0.58 * Math.cos(a), z - ((k % 2) - 0.5) * 0.58 * Math.sin(a), a, 0.33 + Math.floor(k / 2) * 0.29);
  }
  for (const [x, z, a] of [[-37.4, 339.8, 1.2], [-35.6, 338.4, 2.6], [-33.8, 352.6, 0.7]] as const) object('iceBlock', x, z, a);
  for (const [cx, cz] of [[-28.6, 336.8], [-28.6, 340.2]]) for (let k = 0; k < 12; k++) {
    const layer = Math.floor(k / 4), i = k % 4;
    object('iceCan', cx + (i % 2) * 1.25 - 0.62, cz + Math.floor(i / 2) * 0.64 - 0.32, Math.PI / 2, layer * 0.3);
  }
  for (const [x, z, a] of [[-31.4, 338.6, 0.9], [-33.2, 344.6, 2.3], [-30.8, 345.6, 0.2]] as const) object('iceCan', x, z, a);
  for (const [cx, cz] of [[-24.4, 344], [-24.4, 348]]) {
    object('pallet', cx, cz, Math.PI / 2);
    for (let k = 0; k < 12; k++) object('iceBag', cx + ((k % 4) >> 1) * 0.48 - 0.24, cz + (k % 2) * 0.72 - 0.36, Math.PI / 2, 0.12 + Math.floor(k / 4) * 0.25);
  }

  // The last of the boats' men: a pickup backed up by the gallery's leg, its bed full of baskets, the tailgate down;
  // another along the sea wall, waiting; the plant's insulated carts in a row along the bay's wall.
  props.push({ shape: 'box', size: [0.9, 0.7, 2.2], pos: [-29.5, 0.9, 351.5], rot: [0, 0.12, 0], color: 0x2f62a8, vehicle: 'pickup' });
  for (let k = 0; k < 8; k++) object(BASKETS[2 + (k % 2)], -29.5 + ((k % 2) - 0.5) * 0.7, 350.1, 0.12, 1.15 + Math.floor(k / 2) * 0.27);
  props.push({ shape: 'box', size: [0.9, 0.7, 2.2], pos: [-28, 0.9, 378.6], rot: [0, Math.PI / 2 + 0.05, 0], color: 0xe8e6e0, vehicle: 'pickup' });
  for (const z of [355, 356.2, 357.4, 358.6, 359.8]) object('iceChest', ICE_YARD.x1 - 1.2, z, Math.PI / 2);
  // At the ice store's doors in the plant's north end: bags of ice on pallets, the boats' baskets, a cart of blocks.
  for (const [cx, cz] of [[F + 2.2, 371], [F + 2.2, 376.4]]) {
    object('pallet', cx, cz, 0);
    for (let k = 0; k < 12; k++) object('iceBag', cx + (k % 2) * 0.72 - 0.36, cz + ((k % 4) >> 1) * 0.48 - 0.24, 0, 0.12 + Math.floor(k / 4) * 0.25);
  }
  object('blockCart', F + 2.4, 381.2, 0.2);
  for (let k = 0; k < 4; k++) object('iceBlock', F + 2.4 + ((k % 2) - 0.5) * 0.58 * Math.cos(0.2), 381.2 - ((k % 2) - 0.5) * 0.58 * Math.sin(0.2), 0.2, 0.33 + Math.floor(k / 2) * 0.29);
  for (const [x, z, n] of [[F + 5.4, 365.6, 6], [F + 6.2, 367.2, 4], [F + 7.6, 365.9, 5]] as const) baskets(x, z, n);

  // Where the two ways meet again, before the ramp: the bags the last boat did not take, a cone or two, wet.
  for (const [x, z, a] of [[-49.8, 358.6, 0.4], [-50.6, 359.4, 2.1], [-38.2, 359.2, 1.3]] as const) object('iceBag', x, z, a);
  for (const [x, z] of [[-48.6, 361.2], [-39.6, 361.2]]) object('cone', x, z);
  for (const [x, z, r] of [[-45, 355, 2.4], [-41, 360, 1.4], [-52, 352, 1.8], [-36, 343, 1.6]] as const)
    props.push({ shape: 'cylinder', size: [r, 0.005, 0], pos: [x, 0.012, z], color: 0x5f6a6a, ghost: true });

  // The ramp: a wall each side of it, a steel rail along the top of each; at its foot the wall ends square, striped.
  const tilt = Math.atan2(RAMP.h, RAMP.z1 - RAMP.z0), long = Math.hypot(RAMP.h, RAMP.z1 - RAMP.z0), mid = (RAMP.z0 + RAMP.z1) / 2;
  for (const x of [RAMP.x0 - 0.2, RAMP.x1 + 0.2]) {
    props.push({ shape: 'box', size: [0.2, 0.45, long / 2], pos: [x, RAMP.h / 2 + 0.45, mid], rot: [-tilt, 0, 0], color: 0xa4a49c });
    props.push({ shape: 'box', size: [0.05, 0.05, long / 2], pos: [x, RAMP.h / 2 + 1.2, mid], rot: [-tilt, 0, 0], color: 0xd0a030, ghost: true });
    for (let z = RAMP.z0 + 2; z < RAMP.z1; z += 3) box(x - 0.03, (RAMP.h * (z - RAMP.z0)) / (RAMP.z1 - RAMP.z0) + 0.9, z - 0.03, x + 0.03, (RAMP.h * (z - RAMP.z0)) / (RAMP.z1 - RAMP.z0) + 1.2, z + 0.03, 0xd0a030, { ghost: true });
    box(x - 0.25, 0, RAMP.z0 - 0.3, x + 0.25, 1.1, RAMP.z0, 0xe0b020);
  }
  // The gate: its leaf run back into its pocket in the wall, its rail across the way; its name on the wall beside it;
  // sandbags along the wall's foot either side of the ramp.
  box(GATE_X + GATE_W / 2, RAMP.h, SEA_WALL.z0 + 5.6, GATE_X + GATE_W / 2 + 5.4, SEA_WALL.h + 0.05, SEA_WALL.z0 + 6.2, 0x3f5866);
  box(GATE_X + GATE_W / 2 - 0.05, RAMP.h, SEA_WALL.z0 + 5.6, GATE_X + GATE_W / 2 + 0.25, SEA_WALL.h + 0.1, SEA_WALL.z0 + 6.2, 0xe0b020, { ghost: true });
  box(GATE_X - GATE_W / 2, RAMP.h, SEA_WALL.z0 + 5.75, GATE_X + GATE_W / 2, RAMP.h + 0.04, SEA_WALL.z0 + 6.05, DARK_STEEL, { wheelsOnly: true });
  signs.push({ kind: 'name', text: '三號防潮閘門', colors: ['#2a4a6a', '#f2efe6', '#f2c12e'], wide: 4.4, pos: [RAMP.x0 - 4, 4.2, SEA_WALL.z0 - 0.06], rotY: Math.PI });
  for (const [x0, x1] of [[RAMP.x0 - 9, RAMP.x0 - 0.6], [RAMP.x1 + 0.6, RAMP.x1 + 7]])
    for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.52) for (let layer = 0; layer < 3; layer++) if (x + layer * 0.26 < x1 - 0.3) object('sandbag', x + layer * 0.26, SEA_WALL.z0 - 0.5, Math.PI / 2, layer * 0.29);
  // Up the ramp, what has been got ready to shut the gate with, set down a side at a time as it was brought up: the way
  // up goes from one side to the other between them. A pallet of sandbags on the east, another on the west further up;
  // a barrow-load tipped on the east by the top.
  {
    const rampY = (z: number) => (RAMP.h * (z - RAMP.z0)) / (RAMP.z1 - RAMP.z0), slope = Math.atan2(RAMP.h, RAMP.z1 - RAMP.z0);
    object('pallet', RAMP.x1 - 1.1, 367.5, 0, rampY(367.5), { tilt: -slope });
    for (let k = 0; k < 8; k++) object('sandbag', RAMP.x1 - 1.45 + (k % 2) * 0.7, 366.9 + (Math.floor(k / 2) % 2) * 1.2, 0, rampY(367.5) + 0.14 + Math.floor(k / 4) * 0.29, { tilt: -slope });
    object('pallet', RAMP.x0 + 1.1, 374, 0, rampY(374), { tilt: -slope });
    for (let k = 0; k < 10; k++) object('sandbag', RAMP.x0 + 0.75 + (k % 2) * 0.7, 373.4 + (Math.floor(k / 2) % 2) * 1.2, 0, rampY(374) + 0.14 + Math.floor(k / 4) * 0.29, { tilt: -slope });
    for (const [dx, dz] of [[2.1, -1.2], [2.3, 0.6]]) object('sandbag', RAMP.x0 + dx, 374 + dz, 0.4, rampY(374 + dz), { tilt: -slope });
    object('wheelbarrow', RAMP.x1 - 1.3, 380.4, -0.6, rampY(380.4), { tilt: -slope });
    for (const [dx, dz, a] of [[-2.4, -0.9, 1.2], [-1.9, 0.6, 2.6], [-0.7, -1.4, 0.3]] as const) object('sandbag', RAMP.x1 - 1.3 + dx, 380.4 + dz, a, rampY(380.4 + dz), { tilt: -slope });
  }
  // On the wall's top by the gate, west of it, the man on the gate's booth: its window lit, its light over the door.
  box(RAMP.x0 - 6.2, SEA_WALL.h, SEA_WALL.z0 + 1.2, RAMP.x0 - 3.6, SEA_WALL.h + 2.5, SEA_WALL.z0 + 3.6, 0xe8e6de);
  box(RAMP.x0 - 6.3, SEA_WALL.h + 2.5, SEA_WALL.z0 + 1.1, RAMP.x0 - 3.5, SEA_WALL.h + 2.65, SEA_WALL.z0 + 3.7, 0x2f62a8);
  box(RAMP.x0 - 3.58, SEA_WALL.h + 1.1, SEA_WALL.z0 + 1.6, RAMP.x0 - 3.54, SEA_WALL.h + 1.9, SEA_WALL.z0 + 3.2, 0xf2e8b0, { ghost: true });
  box(RAMP.x0 - 3.56, SEA_WALL.h + 2.2, SEA_WALL.z0 + 2.2, RAMP.x0 - 3.4, SEA_WALL.h + 2.35, SEA_WALL.z0 + 2.6, 0xfff2c0, { ghost: true });

  // The yard's floor: its slabs' joints, the walkway painted along the plant, the ramp's foot hatched, the drains.
  const flat = (x0: number, z0: number, x1: number, z1: number, color: number, y = 0.014) => box(x0, y - 0.004, z0, x1, y, z1, color, { ghost: true });
  const JOINT = 0x6c7372, PAINT = 0xd8b02a;
  const onRamp = (x: number) => x > RAMP.x0 - 0.5 && x < RAMP.x1 + 0.5;
  for (let x = ICE_YARD.x0 + 6; x < ICE_YARD.x1; x += 6) flat(x - 0.03, ICE_YARD.z0, x + 0.03, onRamp(x) ? RAMP.z0 : ICE_YARD.z1, JOINT);
  for (let z = ICE_YARD.z0 + 6; z < ICE_YARD.z1; z += 6) {
    if (z < RAMP.z0) flat(ICE_YARD.x0, z - 0.03, ICE_YARD.x1, z + 0.03, JOINT);
    else for (const [x0, x1] of [[ICE_YARD.x0, RAMP.x0 - 0.5], [RAMP.x1 + 0.5, ICE_YARD.x1]]) flat(x0, z - 0.03, x1, z + 0.03, JOINT);
  }
  for (const [z0, z1] of [[PLANT.z0, b0], [b1, PLANT.z1]]) flat(F + 2.6, z0, F + 2.7, z1, PAINT);
  for (const z of [RAMP.z0 - 2.8, RAMP.z0 - 0.3]) flat(RAMP.x0, z, RAMP.x1, z + 0.12, PAINT);
  for (let x = RAMP.x0 + 0.6; x < RAMP.x1; x += 1) props.push({ shape: 'box', size: [0.12, 0.004, 1.2], pos: [x, 0.015, RAMP.z0 - 1.5], rot: [0, Math.PI / 4, 0], color: PAINT, ghost: true });
  // The drain across the foot of the dock's ramp and the one along the plant's face, steel grating over them.
  flat(DOCK_W, ICE_YARD.z0 + 0.4, DOCK_W + 16, ICE_YARD.z0 + 0.9, 0x34383a, 0.016);
  for (let x = DOCK_W + 0.2; x < DOCK_W + 16; x += 0.3) flat(x, ICE_YARD.z0 + 0.4, x + 0.06, ICE_YARD.z0 + 0.9, 0x6a7072, 0.02);
  flat(F + 0.3, PLANT.z0, F + 0.7, PLANT.z1, 0x34383a, 0.016);

  // Down off the dock, on the right, the end of the plant's cold store along it: its doors shut, its name up, its pipes; the
  // boats' men's scooters in a row under its wall, out of the wind. At the ramp's foot round the corner, the hut the loads
  // going out are signed for, the plant's own scooters by it.
  for (const z of [303, 310]) {
    box(DOCK_W, DOCK_H, z - 1.8, DOCK_W + 0.1, DOCK_H + 3.4, z + 1.8, 0x8a949a, { ghost: true });
    for (let y = DOCK_H + 0.3; y < DOCK_H + 3.4; y += 0.3) box(DOCK_W + 0.1, y - 0.02, z - 1.8, DOCK_W + 0.13, y, z + 1.8, 0x7a848a, { ghost: true });
  }
  for (const z of [301.5, 307.5, 316.5, 324]) rod([DOCK_W + 0.12, 9, z], [DOCK_W + 0.12, 0, z], 0.07, 0x9aa0a0, { ghost: true });
  signs.push({ kind: 'name', text: '順發冷凍　二號倉', colors: ['#1f4f9a', '#f2efe6', '#f2efe6'], wide: 7, pos: [DOCK_W + 0.2, 6.6, 316], rotY: Math.PI / 2 });
  const SCOOTERS = ['scooterRed', 'scooterBlue', 'scooterWhite', 'scooterBlack', 'scooterYellow', 'scooterTeal'] as const;
  for (let k = 0; k < 7; k++) object(SCOOTERS[(k * 5) % 6], DOCK_W + 0.8, 312.6 + k * 0.8, Math.PI / 2 + (rand() - 0.5) * 0.15, DOCK_H);
  box(-61, 0, ICE_YARD.z0 + 0.2, -57.2, 2.7, ICE_YARD.z0 + 3.6, 0xe6e1d4);
  box(-61.3, 2.7, ICE_YARD.z0 - 0.1, -56.9, 2.9, ICE_YARD.z0 + 4.1, 0x5a6a72);
  box(-57.2, 1, ICE_YARD.z0 + 0.8, -57.14, 2.2, ICE_YARD.z0 + 3, 0x50606a, { ghost: true });
  box(-60.6, 1, ICE_YARD.z0 + 3.6, -59.2, 2.2, ICE_YARD.z0 + 3.66, 0x50606a, { ghost: true });
  box(-58.8, 0, ICE_YARD.z0 + 3.6, -57.9, 2.1, ICE_YARD.z0 + 3.66, 0x8a949a, { ghost: true });
  signs.push({ kind: 'name', text: '出貨登記', colors: ['#c8372d', '#f2efe6', '#f2efe6'], wide: 2.6, pos: [-59.1, 2.45, ICE_YARD.z0 + 3.68], rotY: 0 });
  for (let k = 0; k < 5; k++) object(SCOOTERS[(k * 2 + 1) % 6], -56.2 + k * 0.8, ICE_YARD.z0 + 0.9, (rand() - 0.5) * 0.15);
  object('bicycle', -61.8, ICE_YARD.z0 + 1.6, Math.PI / 2 + 0.2);
  for (const [x, z, k] of [[-56.6, 334.4, 'bucket'], [-56, 334.6, 'basin'], [-61.6, 334.2, 'waterDrum']] as const) object(k, x, z, rand() * 3);

  // On the left, in the bay under the canopy past its end: the boats' nets and floats, brought ashore for the storm and
  // heaped against the dock's face; their tarpaulins.
  object('raft', -31.6, 323.4, 0.05, 0);
  for (const [x, z, a] of [[-34.6, 327.8, 0.2], [-34.8, 320.2, 2.6], [-28.6, 328.3, 0.7]] as const) object('netHeap', x, z, a, 0);
  for (let k = 0; k < 16; k++) object('buoy', -28.6 + (rand() - 0.5) * 2, 319.6 + (rand() - 0.5) * 2.4, rand() * 3, 0);
  for (const [x, z, a] of [[-28.6, 323.6, 0.2], [-34.7, 323.9, 1.5]] as const) object('tarpHeap', x, z, a, 0);
  for (const [x, z] of [[-35.2, 318.2], [-28.3, 326.3]]) object('tyreStack', x, z, 0, 0);
  // Round past the bay's wall into the yard: the men's corner, a tin roof off the wall, a table, chairs, the kettle's gas;
  // on the wall, the notice.
  props.push({ shape: 'box', size: [2.1, 0.03, 1.7], pos: [-29.8, 2.45, ICE_YARD.z0 + 1.6], rot: [0.12, 0, 0], color: 0x8a9a9a, ...UP });
  for (const x of [-31.7, -27.9]) box(x - 0.05, 0, ICE_YARD.z0 + 3.05, x + 0.05, 2.25, ICE_YARD.z0 + 3.15, STEEL);
  object('table', -29.8, ICE_YARD.z0 + 1.7);
  for (const [x, z, a] of [[-30.7, 1.7, Math.PI / 2], [-28.9, 1.7, -Math.PI / 2], [-29.8, 2.6, Math.PI]] as const) object('chair', x, ICE_YARD.z0 + z, a);
  object('stool', -28.4, ICE_YARD.z0 + 0.7);
  object('gasCylinder', -31.2, ICE_YARD.z0 + 0.6);
  signs.push({ kind: 'name', text: '颱風警報　停止作業', colors: ['#c8372d', '#f2efe6', '#f2efe6'], wide: 3.6, pos: [-34, 1.6, ICE_YARD.z0 + 0.04], rotY: 0 });

  // The plant's face: brown tile up the ground floor, the bay's columns striped at their feet, the insulated pipes along to
  // the ice store, the cold stores' names over their doors.
  for (const [z0, z1] of [[PLANT.z0, b0], [b1, PLANT.z1]]) {
    box(F, 0, z0, F + 0.04, 4.4, z1, 0x9c8270, { ghost: true });
    for (let y = 0.6; y < 4.4; y += 0.6) box(F + 0.04, y - 0.02, z0, F + 0.05, y, z1, 0x86705f, { ghost: true });
  }
  for (let z = b0 + 4; z < b1 - 1; z += 4.5) for (let k = 0; k < 4; k++) box(F - 0.53, k * 0.25, z - 0.28, F + 0.03, (k + 1) * 0.25, z + 0.28, k % 2 ? 0x2a2c30 : 0xe0b020, { ghost: true });
  for (const y of [3.95, 4.3]) rod([F + 0.25, y, b1 + 0.5], [F + 0.25, y, PLANT.z1 - 1.8], 0.11, 0xe8ecee, { ghost: true });
  for (const z of [PLANT.z1 - 1.8, PLANT.z1 - 1.5]) rod([F + 0.25, 3.95, z], [F + 0.25, PLANT.h + 0.6, z], 0.11, 0xe8ecee, { ghost: true });
  for (let z = b1 + 2; z < PLANT.z1 - 2; z += 3) box(F, 3.8, z - 0.04, F + 0.4, 3.85, z + 0.04, STEEL, { ghost: true });
  for (const [z, text] of [[373, '冷凍庫　一'], [378.5, '冷凍庫　二']] as const) signs.push({ kind: 'name', text, colors: ['#2a4a6a', '#f2efe6', '#f2efe6'], wide: 2.6, pos: [F + 0.2, 3.4, z], rotY: Math.PI / 2 });
  // The stair up it: a flight up to the first floor's landing, back up to the second's, side by side; on posts braced
  // across. Solid, to be climbed on foot: the flights walked up as slopes under their treads, the top rails and the
  // landings stood on. Each tread's edge painted yellow, so the way up is seen from the yard.
  const STEPPED: Partial<PropDesc> = { fade: true };
  const SEEN: Partial<PropDesc> = { ghost: true, fade: true };
  const RAIL = 0xd0a030, NOSING = 0xe8b820, TREAD = 0x8a9298;
  /** How wide each flight, and so the landings, twice that, metres. */
  const WIDE = 1.5, OUT = F + WIDE * 2;
  /** Rails from a to b, a post's height over them, and the posts under them so far apart: the top rail solid, the middle one only drawn. */
  const railing = (a: Vec3, b: Vec3) => {
    rod([a[0], a[1] + 1, a[2]], [b[0], b[1] + 1, b[2]], 0.025, RAIL, STEPPED);
    rod([a[0], a[1] + 0.5, a[2]], [b[0], b[1] + 0.5, b[2]], 0.018, RAIL, { ghost: true });
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.3));
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
      rod([x, y, z], [x, y + 1, z], 0.022, RAIL, { ghost: true });
    }
  };
  const flight = (cx: number, za: number, ya: number, zb: number, yb: number, sides: number[]) => {
    const long = Math.hypot(zb - za, yb - ya), n = Math.round((yb - ya) / 0.3), tilt = Math.atan2(-(yb - ya), zb - za), down = Math.sign(za - zb), half = WIDE / 2;
    props.push({ shape: 'box', size: [half, 0.05, long / 2], pos: [cx, (ya + yb) / 2 - 0.1, (za + zb) / 2], rot: [tilt, 0, 0], color: STEEL, ...STEPPED });
    // Its stringers either side, deep channels.
    for (const side of [-1, 1]) props.push({ shape: 'box', size: [0.04, 0.16, long / 2], pos: [cx + side * half, (ya + yb) / 2 - 0.02, (za + zb) / 2], rot: [tilt, 0, 0], color: DARK_STEEL, ...SEEN });
    for (let i = 1; i < n; i++) {
      const y = ya + ((yb - ya) * i) / n, z = za + ((zb - za) * i) / n;
      box(cx - half + 0.04, y - 0.04, z - 0.13, cx + half - 0.04, y, z + 0.13, TREAD, SEEN);
      box(cx - half + 0.04, y - 0.045, z + down * 0.13 - 0.03, cx + half - 0.04, y + 0.005, z + down * 0.13 + 0.03, NOSING, { ghost: true });
    }
    for (const side of sides) railing([cx + side * (half - 0.02), ya, za], [cx + side * (half - 0.02), yb, zb]);
  };
  flight(F + WIDE / 2, STAIR.z1, 0, STAIR.z0 + 1.6, 4.6, [1]);
  flight(F + WIDE * 1.5, STAIR.z0 + 1.6, 4.6, STAIR.z1, 8.4, [-1, 1]);
  for (const [z, y] of [[STAIR.z0, 4.6], [STAIR.z1, 8.4]]) {
    box(F, y - 0.12, z, OUT, y, z + 1.6, STEEL, STEPPED);
    // Its deck a grating; a toe board along its open sides.
    for (let x = F + 0.2; x < OUT - 0.1; x += 0.2) box(x - 0.015, y, z + 0.05, x + 0.015, y + 0.006, z + 1.55, DARK_STEEL, { ghost: true });
    box(OUT - 0.04, y, z, OUT, y + 0.1, z + 1.6, NOSING, { ghost: true });
    railing([OUT - 0.02, y, z], [OUT - 0.02, y, z + 1.6]);
    // Its open end: the first's south end; the second's north end, and its south side where it is over the first flight.
    if (y < LOBBY.y0) {
      box(F, y, z, OUT, y + 0.1, z + 0.04, NOSING, { ghost: true });
      railing([F + 0.05, y, z + 0.02], [OUT - 0.02, y, z + 0.02]);
    } else {
      box(F, y, z + 1.56, OUT, y + 0.1, z + 1.6, NOSING, { ghost: true });
      railing([F + 0.05, y, z + 1.58], [OUT - 0.02, y, z + 1.58]);
      railing([F + 0.05, y, z + 0.02], [F + WIDE - 0.02, y, z + 0.02]);
    }
    for (const dz of [0.05, 1.55]) box(OUT - 0.11, 0, z + dz - 0.06, OUT + 0.01, y, z + dz + 0.06, STEEL);
    // Braced across between its posts.
    rod([OUT - 0.05, 0.4, z + 0.05], [OUT - 0.05, y - 0.4, z + 1.55], 0.03, DARK_STEEL, { ghost: true });
    rod([OUT - 0.05, 0.4, z + 1.55], [OUT - 0.05, y - 0.4, z + 0.05], 0.03, DARK_STEEL, { ghost: true });
    if (y < LOBBY.y0) box(F, y, z + 0.3, F + 0.1, y + 2.1, z + 1.3, 0x8a949a, { ghost: true });
  }
  box(F, 0, STAIR.z1 - 0.1, F + WIDE, 0.2, STAIR.z1 + 0.5, 0x9a9c98);
  signs.push({ kind: 'name', text: '二樓　冷凍庫三', colors: ['#2a4a6a', '#f2efe6', '#f2efe6'], wide: 1.3, pos: [OUT + 0.04, 2.1, STAIR.z1 + 1.55], rotY: Math.PI / 2 });

  // The second floor's door, at the stair's top: its steel frame, a window over it; the door itself swung wide out onto
  // the landing and left so, "close the door behind you" on it; a lamp over it, lit; the room in lit. What is in the
  // wall goes with the wall, while someone is in the room.
  const DOOR = 0x2f6a9a, FRAME = 0x3a4248, GLASS = 0x2c3a44, IN_WALL = { ...INSIDE, ghost: true };
  box(F - 0.02, L.y0, L.door0 - 0.1, F + 0.07, L.y0 + 2.3, L.door0, FRAME, IN_WALL);
  box(F - 0.02, L.y0, L.door1, F + 0.07, L.y0 + 2.3, L.door1 + 0.1, FRAME, IN_WALL);
  box(F - 0.02, L.y0 + 2.2, L.door0 - 0.1, F + 0.07, L.y0 + 2.32, L.door1 + 0.1, FRAME, IN_WALL);
  box(F - 0.15, L.y0 + 2.32, L.door0, F - 0.08, L.y1, L.door1, GLASS, IN_WALL);
  box(F + 0.04, L.y0 + 0.02, L.door1 + 0.02, F + 0.98, L.y0 + 2.18, L.door1 + 0.07, DOOR, SEEN);
  box(F + 0.1, L.y0 + 0.05, L.door1 + 0.015, F + 0.92, L.y0 + 0.3, L.door1 + 0.02, STAINLESS, SEEN);
  box(F + 0.3, L.y0 + 1.5, L.door1 + 0.015, F + 0.72, L.y0 + 1.95, L.door1 + 0.02, GLASS, SEEN);
  box(F + 0.84, L.y0 + 0.98, L.door1 - 0.09, F + 0.9, L.y0 + 1.04, L.door1 + 0.02, STAINLESS, SEEN);
  signs.push({ kind: 'name', text: '隨手關門', colors: ['#f2efe6', '#c8372d', '#c8372d'], wide: 0.6, pos: [F + 0.51, L.y0 + 1.2, L.door1 + 0.01], rotY: Math.PI });
  box(F, L.y1 + 0.1, 364.22, F + 0.2, L.y1 + 0.32, 364.58, 0x2a2c30, SEEN);
  box(F + 0.2, L.y1 + 0.12, 364.25, F + 0.24, L.y1 + 0.3, 364.55, 0xfff0c0, { ghost: true, glow: true });

  // The little room in, before the cold store: tiled white to above the waist, painted green over; strip lights; the cold
  // store's insulated door across the back on its track, its name over it, its thermometer; the men's yellow aprons on
  // their hooks, their white boots under them, a bench.
  const back = F - L.deep, inner = F - L.wall, TILE = 0xe4eae6, GREEN = 0xa9bfae;
  for (const [x0, z0, x1, z1] of [[back, L.z0, inner, L.z0 + 0.02], [back, L.z1 - 0.02, inner, L.z1], [back, L.z0, back + 0.02, L.z1]] as const) {
    box(x0, L.y0, z0, x1, L.y0 + 1.3, z1, TILE, { ghost: true });
    box(x0, L.y0 + 1.3, z0, x1, L.y1, z1, GREEN, { ghost: true });
  }
  box(back + 0.02, L.y0, L.z0 + 0.02, inner, L.y0 + 0.01, L.z1 - 0.02, 0x8e9692, { ghost: true });
  box(back + 0.3, L.y0, L.z0 + 0.4, back + 0.5, L.y0 + 0.015, L.z1 - 0.4, 0x3a3e42, { ghost: true });
  for (const z of [363, 365.4]) {
    box(F - 2.9, L.y1 - 0.08, z - 0.09, F - 1.1, L.y1, z + 0.09, 0xe8ecee, { ghost: true });
    box(F - 2.85, L.y1 - 0.11, z - 0.04, F - 1.15, L.y1 - 0.08, z + 0.04, 0xf4fbff, { ghost: true });
  }
  box(back + 0.02, L.y0, 363.2, back + 0.16, L.y0 + 2.3, 365.4, 0xe8ecee, { ghost: true });
  for (const z of [363.2, 365.36]) box(back + 0.02, L.y0, z, back + 0.18, L.y0 + 2.3, z + 0.04, STAINLESS, { ghost: true });
  box(back + 0.02, L.y0 + 2.35, 362.2, back + 0.1, L.y0 + 2.45, 366.2, STAINLESS, { ghost: true });
  box(back + 0.16, L.y0 + 1.0, 364.95, back + 0.24, L.y0 + 1.5, 365.05, 0xc8372d, { ghost: true });
  props.push({ shape: 'cylinder', size: [0.11, 0.02, 0], pos: [back + 0.04, L.y0 + 1.6, 365.9], rot: [0, 0, Math.PI / 2], color: 0xf2efe6, ghost: true });
  signs.push({ kind: 'name', text: '冷凍庫　三', colors: ['#2a4a6a', '#f2efe6', '#f2efe6'], wide: 1.6, pos: [back + 0.14, L.y0 + 2.62, 364.3], rotY: Math.PI / 2 });
  box(F - 2.9, L.y0 + 2.0, L.z1 - 0.08, F - 1.2, L.y0 + 2.05, L.z1 - 0.02, STAINLESS, { ghost: true });
  for (const x of [F - 1.7, F - 2.4]) box(x - 0.25, L.y0 + 0.9, L.z1 - 0.06, x + 0.25, L.y0 + 2.0, L.z1 - 0.03, 0xe0b020, { ghost: true });
  for (const x of [F - 1.55, F - 1.75, F - 2.25, F - 2.45]) box(x - 0.07, L.y0, L.z1 - 0.75, x + 0.07, L.y0 + 0.32, L.z1 - 0.48, 0xeeeeea, { ghost: true });
  box(back + 0.3, L.y0, L.z1 - 0.45, back + 1.5, L.y0 + 0.42, L.z1 - 0.04, 0x9a7a50);
  // On its roof, by the face: the condensers the ammonia is cooled in, fans on top, the pipes to them.
  for (const z0 of [356.5, 362]) {
    box(-74, PLANT.h, z0, -70.5, PLANT.h + 2.2, z0 + 4.5, 0x9fb2b8, { fade: true });
    for (let z = z0 + 0.4; z < z0 + 4.2; z += 0.4) box(-70.5, PLANT.h + 0.3, z, -70.44, PLANT.h + 1.6, z + 0.2, 0x7d9096, { ghost: true, fade: true });
    for (const dz of [1.15, 3.35]) props.push({ shape: 'cylinder', size: [0.9, 0.12, 0], pos: [-72.25, PLANT.h + 2.3, z0 + dz], color: 0x3a4a52, ghost: true, fade: true });
  }
  rod([F + 0.25, PLANT.h + 0.6, PLANT.z1 - 1.65], [-70.2, PLANT.h + 0.6, PLANT.z1 - 1.65], 0.12, 0xe8ecee, { ghost: true, fade: true });
  rod([-70.2, PLANT.h + 0.6, PLANT.z1 - 1.65], [-70.2, PLANT.h + 0.6, 361], 0.12, 0xe8ecee, { ghost: true, fade: true });
  // The rest of the roof, as seen coming down the canopy off the market: its parapet the whole way round; the stair's
  // housing with its door, the water tank on it; the ammonia's receiver, a long tank on saddles, and the pipe rack from
  // the condensers to it and on down into the plant, lagged white; the cold rooms' exhaust fans in a row; what the storm has knocked about up
  // here.
  {
    const h = PLANT.h, UP_ROOF = { fade: true } as const;
    for (const [x0, z0, x1, z1] of [[PLANT.x0, PLANT.z0, PLANT.x0 + 0.25, PLANT.z1], [PLANT.x0, PLANT.z0, F, PLANT.z0 + 0.25], [PLANT.x0, PLANT.z1 - 0.25, F, PLANT.z1]]) box(x0, h, z0, x1, h + 0.9, z1, WALL_DARK, UP_ROOF);
    box(-94, h, 348, -88.5, h + 3.1, 353.5, 0xc9ced2, UP_ROOF);
    box(-88.45, h, 349.6, -88.4, h + 2.1, 350.7, 0x5a6670, { ghost: true, fade: true });
    box(-94.2, h + 3.1, 347.8, -88.3, h + 3.3, 353.7, WALL_DARK, UP_ROOF);
    props.push({ shape: 'cylinder', size: [1.3, 1.1, 0], pos: [-91.2, h + 4.4, 350.8], color: 0x3f6f9a, fade: true });
    for (const x of [-92.8, -89.6]) box(x - 0.08, h + 3.3, 349.2, x + 0.08, h + 3.6, 352.4, 0x5a5f66, { ghost: true, fade: true });
    // The receiver, along the roof, on its two saddles; its gauge and valve.
    props.push({ shape: 'cylinder', size: [0.85, 3.2, 0], pos: [-82, h + 1.15, 376], rot: [0, 0, Math.PI / 2], color: 0xd6dadc, fade: true });
    for (const x of [-84.4, -79.6]) box(x - 0.3, h, 375.2, x + 0.3, h + 0.6, 376.8, 0x6a7078, UP_ROOF);
    props.push({ shape: 'cylinder', size: [0.14, 0.04, 0], pos: [-82, h + 2.05, 376], color: 0xe8e0c8, ghost: true, fade: true });
    // The pipe rack: posts every few metres, two lagged pipes on it, from the condensers west to the receiver.
    for (let x = -71; x > -83; x -= 3) {
      box(x - 0.06, h, 367.9, x + 0.06, h + 1.2, 368.1, STEEL, { ghost: true, fade: true });
      box(x - 0.06, h + 1.15, 367.4, x + 0.06, h + 1.25, 368.6, STEEL, { ghost: true, fade: true });
    }
    for (const dz of [-0.3, 0.3]) rod([-70.2, h + 1.35, 368 + dz], [-82, h + 1.35, 368 + dz], 0.1, 0xe8ecee, { ghost: true, fade: true });
    for (const dz of [-0.3, 0.3]) rod([-82, h + 1.35, 368 + dz], [-82, h + 1.35, 374.6], 0.1, 0xe8ecee, { ghost: true, fade: true });
    rod([-70.2, h + 0.6, 361], [-70.2, h + 1.35, 367.7], 0.1, 0xe8ecee, { ghost: true, fade: true });
    // The cold rooms' exhaust fans, in a row over them, their hoods.
    for (let z = 334; z < 346; z += 3) {
      props.push({ shape: 'cylinder', size: [0.6, 0.5, 0], pos: [-78, h + 0.5, z], color: 0x9aa4aa, fade: true });
      props.push({ shape: 'cylinder', size: [0.75, 0.08, 0], pos: [-78, h + 1.05, z], color: 0x6a7078, ghost: true, fade: true });
    }
    // Knocked about by the wind: a bin of ice gone over by the stair, a sheet off something, blown to the parapet.
    object('iceChest', -86.6, 354.6, 0.6, h, { tilt: 1.4 });
    object('tinSheet', -94.6, 341, 1.4, h);
    object('bucket', -87.9, 347.1, 0, h);
  }

  // Near the little room, all that is in or on the top floor, the face's windows with it, and in the room itself: while
  // someone is in the room, not drawn when in the way of seeing them. Not what stands out from the face: the stair, the
  // door swung out, the lamp.
  for (const p of props) {
    const [x, y, z] = p.pos;
    if (p.glow || p.openFrom || x > F + 0.1 || x < NEAR.x0 || z < NEAR.z0 || z > NEAR.z1 || y < L.y0 + 0.2) continue;
    p.fade = true;
    p.openFrom = INSIDE.openFrom;
    // What is up on the roof goes all together, the fans with their condenser.
    if (y > PLANT.h - 0.2) p.fadeZone = [[NEAR.x0, PLANT.h - 0.2, NEAR.z0], [F + 0.1, PLANT.h + 3, NEAR.z1]];
  }
  return { props, objects, signs, decals };
}
