import { containerModel } from './city';
import { bar, box, kiosk, pirateShips, put, type ParkSite } from './parkParts';
import { CANAL, FINISH, PIRATE_LANE, RESTAURANT, SHIPS, SLIDE_END, SPLASH } from './parkPlan';
import type { ObjectKindId } from './objects';
import type { Look, P2 } from './relief';
import type { PropDesc, Vec2 } from './types';

// 7. The pirate bay: up out of the splash pool and left, south down the bay. Two ships swinging over the way side by side
// on their frames, a quarter of a swing apart, the truck's lane under the western: wait for it to swing away, follow it
// under, be out before it comes back. The games stalls either side, their giant prizes out in front; the arcade and the
// ring toss; the canal on the west with its quay and a galleon moored for show. Then past the pirate restaurant, into the
// yard behind it, to its back door: the end, nothing more in the way than the kitchen's shelves and trolleys.
//
// Round it all, the back of house: the parade floats' garage, the workshops, the stores; walled off.

const P = Math.PI;
const PAVE: Look = { tag: 'paving', color: 0xd4c6ad, wall: 0x9a8e7a };
const DECK: Look = { tag: 'paving', color: 0xa88a62, wall: 0x7a5a3a };
const YARD: Look = { tag: 'paved', color: 0x9c9e9a, wall: 0x868884 };

/** The turn out of the splash pool, west, round to the south down the bay. */
const OUT_X = SLIDE_END.x + SPLASH.long + SPLASH.ramp;
const TURN: Vec2 = [PIRATE_LANE - 10, SLIDE_END.z - 10];

export const PIRATE_ROUTE: Vec2[] = [
  [OUT_X + 4, SLIDE_END.z], [TURN[0], SLIDE_END.z], [TURN[0] + 10 * Math.sin(P / 4), TURN[1] + 10 * Math.cos(P / 4)], [PIRATE_LANE, TURN[1]],
  [PIRATE_LANE - 2, 220], [PIRATE_LANE - 3.6, 214], [PIRATE_LANE - 3.6, 208], [PIRATE_LANE - 1.8, 203.5], [PIRATE_LANE, 199], [PIRATE_LANE, SHIPS[1] + 14], [PIRATE_LANE, SHIPS[1] - 30], [PIRATE_LANE, RESTAURANT.z0 + 4], [PIRATE_LANE - 6, FINISH[1] + 2], FINISH,
];

export function pirateBay(s: ParkSite): void {
  const { props, signs, crowds, relief } = s;
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, y = 0) => put(s, kind, x, z, rotY, y);
  const rect = (x0: number, z0: number, x1: number, z1: number): P2[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const [cx, cz] = SHIPS;
  const lane = PIRATE_LANE;

  // The ground: the bay paved from the splash pool's apron down to the restaurant; the yard behind it in concrete.
  relief.area(rect(112, 128, CANAL.x0 - 1.2, 218), 0, PAVE);
  relief.area(rect(TURN[0] - 6, 210, CANAL.x0 - 1.2, 258), 0, PAVE);
  relief.area(rect(60, 52, 159.6, 96), 0, YARD);
  relief.area(rect(130, 96, 159.6, 128), 0, PAVE);

  // ------------------------------------------------------------------------------------------------------------------
  // The ships, their boarding platforms either side, the queue's posts; the games stalls down both sides with their giant
  // prizes, the arcade and the ring toss facing each other across the way; lamps; people along both sides.
  s.rigs.push(...pirateShips(props, SHIPS, [0, 0.25]));
  for (const side of [-1, 1]) {
    box(props, cx + side * 8.4 - 1.2, 0, cz - 9, cx + side * 8.4 + 1.2, 0.6, cz + 9, 0x8a6a40);
    for (let z = cz - 8; z <= cz + 8; z += 2) object('queuePost', cx + side * 9.9, z);
    for (let z = cz - 26; z <= cz + 26; z += 8) {
      if (Math.abs(z - cz) < 12) continue;
      object('gameStall', cx + side * 10.5, z, side < 0 ? P / 2 : -P / 2);
      object('plushGiant', cx + side * 8.6, z + 1.4, side * 0.5);
    }
  }
  // The ride's fence round it, steel, waist high: across the walks either side at each end, from the stalls' wall and the
  // quay to the boarding platforms, so that the ways past are the two lanes under the ships; a gate in each for people.
  for (const end of [-1, 1]) for (const [a, b] of [[112, cx - 8.4], [cx + 8.4, CANAL.x0 - 1.6]]) {
    const z = cz + end * 11;
    for (const [p, q] of [[a, (a + b) / 2 - 1], [(a + b) / 2 + 1, b]]) {
      box(props, p, 0, z - 0.06, q, 1.1, z + 0.06, 0xc8ccd0, { mapColor: 0x9aa0a6 });
      for (let x = p; x <= q; x += 1.5) bar(props, [x, 0, z], [x, 1.15, z], 0.04, 0x9aa0a6, { ghost: true });
    }
    box(props, (a + b) / 2 - 1, 0, z - 0.05, (a + b) / 2 + 1, 0.9, z + 0.05, 0xf2c12e, { ghost: true });
  }
  for (const end of [-1, 1]) for (const side of [-1, 1]) box(props, cx + side * 8.4 - 0.06, 0, cz + end * 9, cx + side * 8.4 + 0.06, 1.1, cz + end * 11, 0xc8ccd0);
  // Its name on a board hung on the middle frame's front, over the heads of those under it.
  signs.push({ pos: [cx, 9.6, cz + 6.8], rotY: 0, kind: 'name', text: '海盜船', colors: ['#2a6f9e', '#f2c12e', '#9e3a2a'], wide: 5 });
  for (const side of [-1, 1]) kiosk(props, signs, { at: [cx + side * 19, cz + side * 20], yaw: side > 0 ? -P / 2 : P / 2, half: [6, 3.6], high: 4.4, wall: side > 0 ? 0x2a3a5a : 0x5a2a3a, trim: 0xf2c12e, roof: 'flat', roofColor: 0x1c2230, name: side > 0 ? '電子遊樂場' : '套圈圈', nameColors: ['#1c2230', '#f2c12e', '#f08ac0'], front: 'shop' });
  for (const [x, z] of [[-13, -32], [13, -32], [-13, 32], [13, 32]]) object('parkLamp', cx + x, cz + z);
  crowds.push({ area: [cx - 14, cz - 30, cx - 11, cz + 30], count: 20, y: 0 }, { area: [cx + 11, cz - 30, cx + 14, cz + 30], count: 20, y: 0 });
  // At the bay's head, over the way down into it, an arch of rock with a skull at its top: its feet either side, solid.
  {
    const z = 214;
    for (const x of [118, 158]) {
      props.push({ shape: 'box', size: [2.4, 4, 2.2], pos: [x, 4, z], rot: [0, 0.2, 0], color: 0x8a7a68, mapColor: 0x7a6a58 });
      props.push({ shape: 'box', size: [2.0, 1.6, 1.9], pos: [x + 0.3, 8.8, z], rot: [0.1, -0.3, 0.12], color: 0x7a6a58, ghost: true });
    }
    for (let k = 0; k < 9; k++) {
      const t = k / 8, x = 118 + t * 40, y = 9 + Math.sin(t * Math.PI) * 4;
      props.push({ shape: 'box', size: [2.8, 1.3, 2.0], pos: [x, y, z], rot: [0, 0, (t - 0.5) * 0.9], color: [0x8a7a68, 0x7a6a58, 0x9a8a78][k % 3], ghost: true, fade: true, overhead: true });
    }
    props.push({ shape: 'sphere', size: [2.0, 2.2, 1.6], pos: [138, 15.6, z - 0.6], color: 0xf2ead8, ghost: true, fade: true, overhead: true });
    for (const dx of [-0.8, 0.8]) props.push({ shape: 'sphere', size: [0.5, 0.6, 0.3], pos: [138 + dx, 15.9, z + 0.9], color: 0x1c1c1c, ghost: true, fade: true, overhead: true });
    signs.push({ pos: [138, 11.4, z - 1.2], rotY: 0, kind: 'name', text: '海盜灣', colors: ['#1c1c1c', '#f2c12e', '#9e3a2a'], wide: 7 });
  }
  // Down both its walls, more stalls: games, souvenirs, squid on sticks; their prizes and goods out in front.
  const clear = (z: number, kiosk: number) => Math.abs(z - (cz - 11)) > 3.5 && Math.abs(z - (cz + 11)) > 3.5 && Math.abs(z - cz) > 11 && Math.abs(z - kiosk) > 8.5;
  for (let z = 140; z < 210; z += 7) {
    if (clear(z, cz - 20)) object(z % 14 < 7 ? 'gameStall' : 'souvenirStall', 114.5, z, P / 2);
    if (clear(z + 3, cz + 20)) object(z % 14 < 7 ? 'souvenirStall' : 'gameStall', 157, z + 3, -P / 2);
    if (z % 21 < 7 && clear(z + 1.6, cz - 20)) object('plushGiant', 116.6, z + 1.6, 0.4);
  }
  crowds.push({ area: [121.5, 138, 124.5, 210], count: 22, y: 0 }, { area: [148, 138, 150.5, 210], count: 22, y: 0 });
  // Along the quay: palms, cannon pointing over the canal, the black flag on its poles.
  for (let z = 182; z < 256; z += 12) if (Math.abs(z - (cz + 20)) > 8) object('palm', CANAL.x0 - 3.2, z);
  for (const z of [188, 212, 236]) {
    props.push({ shape: 'cylinder', size: [0.32, 1.1, 0.22], pos: [CANAL.x0 - 2.4, 0.7, z], rot: [0, 0, -Math.PI / 2 + 0.15], color: 0x2a2c30, ghost: true });
    for (const dz of [-0.5, 0.5]) props.push({ shape: 'cylinder', size: [0.4, 0.06, 0], pos: [CANAL.x0 - 3.2, 0.4, z + dz], rot: [Math.PI / 2, 0, 0], color: 0x5a3e28, ghost: true });
  }
  for (const [x, z] of [[160, 176], [160, 200], [114, 222], [160, 224]] as const) {
    bar(props, [x, 0, z], [x, 7, z], 0.06, 0x5a3e28, { ghost: true });
    box(props, x - 0.02, 5.4, z, x + 0.02, 6.8, z + 2.0, 0x1c1c1c, { ghost: true });
  }
  // Coming down to it from the splash pool: a treasure chest and barrels, a cutout of a pirate to be photographed with.
  object('cutout', lane - 5, cz + 40, 0.3);
  for (const [x, z] of [[lane + 5.4, cz + 44], [lane + 5.8, cz + 42.8], [lane - 7, cz + 46]] as const) object('woodBarrel', x, z);
  object('balloonCart', lane + 5.6, cz + 36, -0.4);
  pirateTown(s);

  {
    // A great anchor laid on its side by the way west of it, its chain in loops: where the ships' two lanes have come out.
    const [ax, az] = [lane + 14, 137];
    box(props, ax - 0.3, 0, az - 4, ax + 0.3, 0.6, az + 4, 0x3a3f46, { mapColor: 0x3a3f46 });
    box(props, ax - 1.9, 0, az + 3.6, ax + 1.9, 0.5, az + 4.4, 0x3a3f46);
    for (let k = 0; k < 8; k++) props.push({ shape: 'cylinder', size: [0.25, 0.08, 0], pos: [ax + 1.6 + Math.cos(k) * 1.2, 0.1, az - 5 - k * 0.6], rot: [Math.PI / 2, k, 0], color: 0x5a6068, ghost: true });
    // East of it, a treasure chest, open, gold heaped in it and spilled; a cutout of a pirate captain beside it; barrels.
    const [tx, tz] = [lane - 16, 140];
    box(props, tx - 1, 0, tz - 0.8, tx + 1, 1.0, tz + 0.8, 0x6a4426);
    props.push({ shape: 'box', size: [1.0, 0.05, 0.8], pos: [tx, 1.3, tz + 0.7], rot: [-1.2, 0, 0], color: 0x6a4426, ghost: true });
    props.push({ shape: 'sphere', size: [0.95, 0.4, 0.75], pos: [tx, 1.05, tz], color: 0xe8c040, ghost: true, glow: true });
    for (const [dx, dz] of [[0.9, -1.3], [-0.6, -1.5], [1.4, -0.4]]) props.push({ shape: 'cylinder', size: [0.12, 0.02, 0], pos: [tx + dx, 0.03, tz + dz], color: 0xe8c040, ghost: true });
    object('cutout', tx - 2.2, tz + 2.2, 0.4);
    for (let zz = 130; zz < 144; zz += 3) object('woodBarrel', tx - 4, zz);
    crowds.push({ area: [tx + 1.6, tz - 5, tx + 4, tz + 5], count: 10, y: 0 });
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Along the canal on the west: the quay, planked, a wall along its edge; bollards; a galleon moored in the canal for show.
  relief.area(rect(CANAL.x0 - 4.2, 176, CANAL.x0 - 1.2, 258), 0, DECK);
  box(props, CANAL.x0 - 1.6, 0, 176, CANAL.x0 - 1.2, 0.9, 258, 0x7a5a3a, { mapColor: 0x6a4a30 });
  for (let z = 180; z < 256; z += 8) props.push({ shape: 'cylinder', size: [0.22, 0.4, 0], pos: [CANAL.x0 - 2.4, 0.4, z], color: 0x2a2c30 });
  galleon(props, (CANAL.x0 + CANAL.x1) / 2, 214);
  crowds.push({ area: [CANAL.x0 - 4, 182, CANAL.x0 - 2, 254], count: 18, y: 0 });

  // ------------------------------------------------------------------------------------------------------------------
  // The pirate restaurant: a timber hall, its front on to the bay at the north with a ship's figurehead over the door and
  // its name, lanterns; tables of barrels out in front; its kitchen's back door on the south, on to the yard.
  {
    const { x0, x1, z0, z1 } = RESTAURANT;
    box(props, x0, 0, z0, x1, 7, z1, 0x7a5a3a, { fade: true, mapColor: 0x6a4a30 });
    box(props, x0 - 0.6, 7, z0 - 0.6, x1 + 0.6, 7.6, z1 + 0.6, 0x3a2a20, { ghost: true, fade: true });
    for (let x = x0 + 2; x < x1; x += 4) if (Math.abs(x - (x0 + x1) / 2) > 2) box(props, x - 0.15, 0, z1, x + 0.15, 7, z1 + 0.06, 0x5a3e28, { ghost: true });
    box(props, (x0 + x1) / 2 - 1.6, 0, z1, (x0 + x1) / 2 + 1.6, 3.2, z1 + 0.1, 0x3a2a20, { ghost: true });
    signs.push({ pos: [(x0 + x1) / 2, 5.4, z1 + 0.2], rotY: 0, kind: 'name', text: '海盜餐廳', colors: ['#2a2420', '#f2c12e', '#9e3a2a'], wide: 9 });
    // Its front a galleon's stern run aground: the gilt gallery over the door, rows of lit windows, a lantern each side,
    // the mizzen with its tattered black flag over the roof.
    box(props, x0 + 6, 7, z1 - 4, x1 - 6, 11, z1 + 0.4, 0x5a3e28, { ghost: true, fade: true });
    box(props, x0 + 6.2, 7.6, z1 + 0.4, x1 - 6.2, 7.9, z1 + 1.4, 0xd9a830, { ghost: true });
    for (let x = x0 + 8; x < x1 - 7; x += 3) box(props, x - 0.8, 8.4, z1 + 0.42, x + 0.8, 9.8, z1 + 0.46, 0xffd88a, { ghost: true, glow: true });
    box(props, x0 + 5.6, 10.8, z1 - 4.2, x1 - 5.6, 11.4, z1 + 0.8, 0xd9a830, { ghost: true });
    bar(props, [(x0 + x1) / 2, 11, z1 - 2], [(x0 + x1) / 2, 22, z1 - 2], 0.22, 0x5a3e28, { ghost: true });
    box(props, (x0 + x1) / 2 - 0.02, 18, z1 - 2, (x0 + x1) / 2 + 0.02, 21, z1 + 1.6, 0x1c1c1c, { ghost: true });
    for (let y = 2; y < 6.5; y += 1.4) box(props, x0 - 0.06, y, z0 + 2, x0, y + 0.3, z1 - 2, 0x5a3e28, { ghost: true });
    props.push({ shape: 'sphere', size: [0.9, 1.4, 0.6], pos: [(x0 + x1) / 2, 7.4, z1 + 0.9], color: 0xd9a830, ghost: true });
    for (const x of [x0 + 4, x1 - 4]) props.push({ shape: 'sphere', size: [0.3, 0.4, 0.3], pos: [x, 3.4, z1 + 0.6], color: 0xffc860, ghost: true, glow: true });
    for (let x = x0 + 4; x < x1 - 2; x += 6) box(props, x - 1.2, 2, z1 + 0.02, x + 1.2, 3.6, z1 + 0.08, 0x2a3a48, { ghost: true });
    for (let z = z0 + 4; z < z1 - 2; z += 6) box(props, x1, 2, z - 1.4, x1 + 0.06, 3.6, z + 1.4, 0x2a3a48, { ghost: true });
    for (const [x, z] of [[x0 + 6, z1 + 6], [x0 + 13, z1 + 8], [x0 + 20, z1 + 5.5], [x0 + 27, z1 + 9]] as const) {
      object('woodBarrel', x, z);
      object('stool', x + 0.9, z);
      object('stool', x - 0.9, z + 0.2);
    }
    crowds.push({ area: [x0 + 2, z1 + 2, x1 - 2, z1 + 12], count: 20, y: 0 });
    // The back: its door and the kitchen's exhaust fans, the bins; the shelves of stores and the trolleys brought out to it.
    box(props, FINISH[0] - 1.4, 0, z0 - 0.08, FINISH[0] + 1.4, 2.6, z0, 0x8a9098, { ghost: true });
    signs.push({ pos: [FINISH[0], 3.0, z0 - 0.1], rotY: P, kind: 'name', text: '廚房 卸貨口', colors: ['#f2efe6', '#2a3a48', '#d23a32'], wide: 3.6 });
    for (const x of [x0 + 4, x1 - 6]) box(props, x - 1, 4.4, z0 - 0.5, x + 1, 5.6, z0, 0x8a9098, { ghost: true });
    for (const [x, kind, r] of [[FINISH[0] - 6, 'wireShelf', 0], [FINISH[0] - 8, 'wireShelf', 0], [FINISH[0] + 5, 'wireShelf', 0], [FINISH[0] + 8.5, 'crateTrolley', 0.4], [FINISH[0] - 11, 'shoppingCart', -0.3]] as const) object(kind, x, z0 - 1.2, r);
    for (const [x, z] of [[x0 + 2, z0 - 2], [x0 + 3.4, z0 - 2]] as const) box(props, x - 0.6, 0, z - 0.6, x + 0.6, 1.3, z + 0.6, 0x3f6a4a, { ghost: true });
    for (const [x, z, kind] of [[x1 - 2, z0 - 6, 'vegCrate'], [x1 - 2.8, z0 - 6.4, 'fruitCrate'], [x1 - 1.6, z0 - 7.4, 'paperBox'], [x0 + 3, z0 - 14, 'pallet']] as const) object(kind, x, z);
  }

  // ------------------------------------------------------------------------------------------------------------------
  // The walls: down the east side of the bay behind its stalls; across south of the splash pool's apron; round the yard.
  box(props, 111.6, 0, 145, 112, 2.6, 218, 0xb8b4a8, { mapColor: 0x8a8680 });
  box(props, 16, 0, 217.6, 112, 2.6, 218, 0xb8b4a8, { mapColor: 0x8a8680 });
  box(props, 90, 0, 144.6, 112, 2.6, 145, 0xb8b4a8, { mapColor: 0x8a8680 });
  box(props, 89.6, 0, 96, 90, 2.6, 145, 0xb8b4a8, { mapColor: 0x8a8680 });
  box(props, 59.6, 0, 52, 60, 2.6, 96, 0xb8b4a8, { mapColor: 0x8a8680 });
  box(props, 60, 0, 51.6, 159.6, 2.6, 52, 0xb8b4a8, { mapColor: 0x8a8680 });
  box(props, 60, 0, 95.6, RESTAURANT.x0, 2.6, 96, 0xb8b4a8, { mapColor: 0x8a8680 });
  // In the yard: a delivery van backed up to the wall, a skip, stacked pallets; the gate out in the wall to the south.
  box(props, 62, 0, 82, 66, 1.6, 90, 0x3f6a4a, { mapColor: 0x3f6a4a });
  for (const [x, z] of [[150, 58], [151.4, 58.2], [150.6, 56.6]] as const) object('pallet', x, z, x);
  for (let k = 0; k < 6; k++) box(props, 140 + (k % 3) * 1.3, Math.floor(k / 3) * 0.9, 62, 141.1 + (k % 3) * 1.3, 0.85 + Math.floor(k / 3) * 0.9, 63.1, [0xa07a4a, 0x8a6a40][k % 2], { ghost: k > 2 });
  kitchenYard(s);
  box(props, 100, 0, 51.4, 112, 3.4, 51.6, 0x5a6068, { ghost: true });

  // ------------------------------------------------------------------------------------------------------------------
  // The back of house, behind its walls: the parade floats' garage, the workshops, the stores; staff's cars.
  const shed = (x0: number, z0: number, x1: number, z1: number, h: number, seed: number) =>
    box(props, x0, 0, z0, x1, h, z1, 0xd8d4c8, { fade: true, building: { style: 'shed', open: [true, true, true, true], crown: 0, seed } });
  shed(20, 150, 84, 210, 9, 501);
  shed(20, 96, 56, 140, 7, 502);
  shed(20, 20, 70, 80, 8, 503);
  shed(84, 10, 150, 44, 7, 504);
  signs.push({ pos: [52, 6.4, 210.2], rotY: 0, kind: 'name', text: '遊行花車庫', colors: ['#2a3a48', '#f2efe6', '#f2c12e'], wide: 8 });
  for (const [x, z] of [[64, 120], [68, 120], [72, 120], [76, 120], [80, 120]] as const) props.push({ shape: 'box', size: [0.9, 0.65, 2.1], pos: [x, 0.83, z], color: [0x2a2c30, 0xe8e6de, 0xc8372d, 0x2f62a8, 0xb8bcc0][x % 5], vehicle: 'car' });
}

/** A galleon moored for show: a dark hull, gilt at her stern, two masts with their sails furled, the black flag at her top. */
function galleon(props: PropDesc[], x: number, z: number): void {
  const water = -0.35;
  box(props, x - 2.6, water - 0.6, z - 11, x + 2.6, water + 2.0, z + 11, 0x4a3020, { ghost: true });
  box(props, x - 2.2, water + 2.0, z - 11.5, x + 2.2, water + 3.6, z - 6, 0x5a3e28, { ghost: true });
  box(props, x - 2.65, water + 1.4, z - 11.05, x + 2.65, water + 1.6, z + 11.05, 0xd9a830, { ghost: true });
  props.push({ shape: 'cone', size: [1.6, 3, 0], pos: [x, water + 1.2, z + 13], rot: [P / 2, 0, 0], color: 0x4a3020, ghost: true });
  for (const [dz, h] of [[-3, 14], [5, 12]]) {
    bar(props, [x, water + 2, z + dz], [x, water + 2 + h, z + dz], 0.18, 0x5a3e28, { ghost: true });
    for (const y of [h * 0.45, h * 0.8]) box(props, x - 3.4, water + 2 + y, z + dz - 0.2, x + 3.4, water + 2.6 + y, z + dz + 0.2, 0xf2ead8, { ghost: true });
  }
  box(props, x - 0.02, water + 14.6, z - 3.9, x + 0.02, water + 15.6, z - 3.1, 0x1c1c1c, { ghost: true });
}

/**
 * The bay's head and the way down past the ships to the restaurant, built up as the pirates' harbour town. Out of the
 * splash pool and round to the south, between the tavern on the inside of the turn, its barrel tables out on the way, and
 * the treasure shop on the outside; the hat shop over the way on the north. South of the ships, opposite the restaurant,
 * a ship run aground for children to climb, its nets and its slide, a rope along the way in front of it; the restaurant's
 * take-away window on its side, barrels for tables along it.
 */
function pirateTown(s: ParkSite): void {
  const { props, signs, crowds } = s;
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, y = 0) => put(s, kind, x, z, rotY, y);
  const lane = PIRATE_LANE;
  const WOOD = 0x6a4a30;
  // The tavern, on the inside of the turn.
  kiosk(props, signs, { at: [122, 224], yaw: P / 2, half: [7, 5], high: 5.2, wall: 0x7a5a3a, trim: 0x3a2a20, roof: 'pitched', roofColor: 0x3a2a20, name: '骷髏酒館', nameColors: ['#1c1c1c', '#f2c12e', '#9e3a2a'], front: 'shop', awning: [0x9e3a2a, 0xf2ead8] });
  for (const z of [219, 226]) {
    object('woodBarrel', 130.4, z);
    object('stool', 131.4, z + 0.6);
    object('stool', 129.4, z - 0.5);
  }
  crowds.push({ area: [128, 217, 130, 231], count: 8, y: 0 });
  // The treasure shop, on the outside of the turn: chests of gold coins out in front of it.
  kiosk(props, signs, { at: [151.6, 228], yaw: -P / 2, half: [11, 4.6], high: 4.8, wall: 0x5a3e28, trim: 0xd9a830, roof: 'flat', roofColor: 0x2a2420, name: '藏寶屋', nameColors: ['#2a2420', '#f2c12e', '#9e3a2a'], front: 'shop', awning: [0x2a2420, 0xd9a830] });
  for (const z of [222, 232]) {
    box(props, 143.7, 0, z - 0.6, 145.1, 0.8, z + 0.6, 0x6a4426);
    props.push({ shape: 'sphere', size: [0.65, 0.3, 0.55], pos: [144.4, 0.85, z], color: 0xe8c040, ghost: true, glow: true });
  }
  crowds.push({ area: [144.2, 224, 146.2, 230], count: 5, y: 0 });
  // The hat shop over the way on the north: tricorns and eye patches; the flags on poles.
  kiosk(props, signs, { at: [150, 252.5], yaw: P, half: [6.6, 3.4], high: 4.2, wall: 0xf2ead8, trim: WOOD, roof: 'pitched', roofColor: 0x9e3a2a, name: '海盜帽', front: 'counter', awning: [0x1c1c1c, 0xf2ead8] });
  for (const x of [144, 158]) {
    bar(props, [x, 0, 247], [x, 7, 247], 0.06, 0x5a3e28, { ghost: true });
    box(props, x - 0.02, 5.4, 247, x + 0.02, 6.8, 249, 0x1c1c1c, { ghost: true });
  }
  object('plushGiant', 141, 247.4, P);
  object('bin', 133, 246.4);
  // Along the north of the way out of the pool: a bed of palms kerbed in stone, the rings' return racks against it, a
  // pirate to be photographed with; on its south, the tavern's sandwich boards.
  box(props, 114, 0, 245.4, 130, 0.6, 247.4, 0xd8d0c0, { mapColor: 0x6f9e52 });
  box(props, 114.1, 0.6, 245.5, 129.9, 0.65, 247.3, 0x5a3e28, { ghost: true });
  for (const x of [116, 122, 128]) object('palm', x, 246.4, 0, 0.6);
  for (const [x, kind] of [[118.5, 'ringRack'], [125, 'ringRack'], [131, 'cutout']] as const) object(kind, x, 244.2, P);
  for (const x of [117, 123]) object('signWalk', x, 232.6, 0);
  for (const [x, z] of [[133.6, 231.2], [134.4, 232.3]] as const) object('woodBarrel', x, z);
  crowds.push({ area: [143, 246, 158, 248.4], count: 8, y: 0 });

  // The ship run aground, opposite the restaurant: her hull heeled a little in the sand, solid; her deck with its rail, two
  // masts with nets from them down to the ground, a slide off her side; children all over her; her name on her stern.
  {
    const [x0, x1, z0, z1] = [148, 158, 102, 124];
    relief(s, x0 - 3, z0 - 4, x1 + 2, z1 + 4);
    box(props, x0, 0, z0, x1, 3.6, z1, 0x4a3020, { mapColor: 0x4a3020 });
    box(props, x0 + 0.5, 3.6, z0 + 1, x1 - 0.5, 3.63, z1 - 1, 0xa88a62, { ghost: true });
    props.push({ shape: 'cone', size: [5, 4, 0], pos: [(x0 + x1) / 2, 1.7, z1 + 3.5], rot: [P / 2, 0, 0], color: 0x4a3020, ghost: true });
    box(props, x0 - 0.02, 2.6, z0 - 0.02, x1 + 0.02, 2.8, z1 + 0.02, 0xd9a830, { ghost: true });
    for (const side of [x0 + 0.3, x1 - 0.3]) box(props, side - 0.06, 3.6, z0 + 1, side + 0.06, 4.6, z1 - 1, 0x5a3e28, { ghost: true });
    for (const z of [108, 118]) {
      bar(props, [(x0 + x1) / 2, 3.6, z], [(x0 + x1) / 2, 14, z], 0.2, 0x5a3e28, { ghost: true });
      box(props, x0 - 1, 9, z - 0.2, x1 + 1, 9.6, z + 0.2, 0xf2ead8, { ghost: true });
      for (const side of [-1, 1]) for (let k = 0; k < 5; k++) bar(props, [(x0 + x1) / 2, 12, z], [side < 0 ? x0 - 2.5 : x1 + 2.5, 0, z - 2 + k], 0.03, 0x3a3020, { ghost: true });
    }
    box(props, (x0 + x1) / 2 - 0.02, 12.4, 117.8, (x0 + x1) / 2 + 0.02, 13.6, 119.6, 0x1c1c1c, { ghost: true });
    props.push({ shape: 'box', size: [0.6, 0.06, 3.4], pos: [x0 - 2.6, 1.8, z0 + 4], rot: [0.62, P / 2, 0], color: 0xf2c12e, ghost: true });
    signs.push({ pos: [(x0 + x1) / 2, 2.2, z0 - 0.06], rotY: P, kind: 'name', text: '尋寶海盜船', colors: ['#2a2420', '#f2c12e', '#9e3a2a'], wide: 5 });
    crowds.push({ area: [x0 + 1, z0 + 2, x1 - 1, z1 - 2], count: 14, y: 0, raised: 3.6, size: 0.6 }, { area: [x0 - 1.3, z0, x0 - 0.4, z1], count: 8, y: 0, size: 0.6 });
    // A rope along the way in front of her, on posts.
    for (let z = z0 - 2; z <= z1 + 4; z += 2.5) props.push({ shape: 'cylinder', size: [0.12, 0.5, 0], pos: [lane + 6.5, 0.5, z], color: 0x5a3e28, ghost: true });
    box(props, lane + 6.48, 0.82, z0 - 2, lane + 6.52, 0.88, z1 + 4, 0xd8c8a0, { ghost: true });
  }
  // The restaurant's side on the way: its take-away window, the queue at it, barrels to eat at.
  {
    const x = RESTAURANT.x1;
    box(props, x, 1.0, 108, x + 0.08, 2.4, 114, 0x2a3a48, { ghost: true });
    box(props, x, 0.95, 108, x + 0.6, 1.05, 114, 0xd9a830, { ghost: true });
    signs.push({ pos: [x + 0.1, 3.2, 111], rotY: P / 2, kind: 'name', text: '外帶', colors: ['#2a2420', '#f2c12e', '#9e3a2a'], wide: 2.2 });
    crowds.push({ area: [x + 0.8, 106, x + 2.6, 116], count: 8, y: 0 });
    for (const z of [100, 120]) {
      object('woodBarrel', x + 2.6, z);
      object('stool', x + 3.4, z + 0.7);
      object('stool', x + 1.8, z - 0.6);
    }
  }
  // The restaurant's terrace on to the bay: more of its barrel tables, out to the way, behind its planters along the way
  // with a gap for people; across the way, the rope on from the ship's, barrels against it, the cannon for photographs.
  for (const [x, z] of [[124, 131], [128.5, 137]] as const) {
    object('woodBarrel', x, z);
    object('stool', x + 0.9, z);
    object('stool', x - 0.9, z + 0.2);
  }
  for (const [za, zb] of [[127, 134.5], [137.5, 145]]) {
    box(props, 132.4, 0, za, 133.4, 0.7, zb, 0x6a4a30, { mapColor: 0x6f9e52 });
    box(props, 132.5, 0.7, za + 0.1, 133.3, 1.1, zb - 0.1, 0x4f8a3a, { ghost: true });
  }
  for (let z = 128; z <= 146; z += 2.5) props.push({ shape: 'cylinder', size: [0.12, 0.5, 0], pos: [lane + 6.5, 0.5, z], color: 0x5a3e28, ghost: true });
  box(props, lane + 6.48, 0.82, 128, lane + 6.52, 0.88, 146, 0xd8c8a0, { ghost: true });
  for (const z of [106, 118, 131, 143]) object('woodBarrel', lane + 5.4, z);
  object('cutout', lane + 5.2, 137.5, -P / 2);
  // In through the yard's gate past the restaurant's corner: its empties stacked, a bucket, a mop.
  for (const [x, z, kind] of [[144.5, 92, 'vegCrate'], [145.2, 93.1, 'vegCrate'], [144.8, 94.4, 'fruitCrate'], [143.6, 97.5, 'mopBucket'], [146, 88, 'bucket']] as const) object(kind, x, z);
}

/** The ship's ground: sand round her. */
function relief(s: ParkSite, x0: number, z0: number, x1: number, z1: number): void {
  s.relief.area([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], 0, { tag: 'sand', color: 0xe8d4a8, wall: 0xd8c08a });
}

/**
 * The restaurant's yard, as a kitchen's is: on the east the store with its loading dock and the delivery lorries backed
 * up to it; along the south wall the cold stores, reefer boxes in a row, humming; on the west the gas in its cage, the
 * generator, the kitchen's bins; out on the yard the day's delivery being wheeled in, crates and trolleys, to its door.
 */
function kitchenYard(s: ParkSite): void {
  const { props, signs, crowds } = s;
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, y = 0) => put(s, kind, x, z, rotY, y);
  // The store and its dock.
  box(props, 60, 0, 54, 88, 7, 80, 0xd8d4c8, { fade: true, building: { style: 'shed', open: [true, true, true, true], crown: 0, seed: 505 } });
  box(props, 88, 0, 56, 90.5, 1.2, 78, 0x8a8f96, { mapColor: 0x8a8f96 });
  for (const z of [61, 69, 77]) box(props, 88, 1.2, z - 2.4, 88.06, 4.8, z + 2.4 - (z === 77 ? 1.4 : 0), 0x5a6068, { ghost: true });
  signs.push({ pos: [88.1, 5.6, 67], rotY: P / 2, kind: 'name', text: '中央倉庫', colors: ['#2a3a48', '#ffffff', '#f2c12e'], wide: 4.4 });
  for (const z of [61, 69]) props.push({ shape: 'box', size: [1.15, 1.4, 3.7], pos: [94.4, 1.6, z], rot: [0, P / 2, 0], color: 0xf2efe6, vehicle: 'van' });
  // The cold stores along the south wall.
  for (let k = 0; k < 5; k++) {
    const x = 117 + k * 6.6;
    containerModel(props, x, 0, 55.5, true, 0xe8eef2, 0xc8ccd0);
    box(props, x - 3.25, 0.4, 56.7, x - 2.25, 2.2, 57.1, 0x5a6068, { ghost: true });
  }
  signs.push({ pos: [130, 3.2, 56.8], rotY: 0, kind: 'name', text: '冷凍庫', colors: ['#2f6fb0', '#ffffff', '#f2efe6'], wide: 3.2 });
  // The gas in its cage, the generator, the bins: on the west, by the wall.
  box(props, 152, 0, 66, 158, 2.2, 72, 0x8a8f96, { ghost: true });
  for (let x = 152.2; x < 158; x += 0.6) box(props, x, 0, 65.98, x + 0.04, 2.2, 66.02, 0x5a6068, { ghost: true });
  for (let k = 0; k < 8; k++) props.push({ shape: 'cylinder', size: [0.21, 0.6, 0], pos: [153 + (k % 4) * 1.3, 0.6, 68 + Math.floor(k / 4) * 2], color: 0xd8302a });
  signs.push({ pos: [155, 2.8, 65.9], rotY: P, kind: 'name', text: '嚴禁煙火', colors: ['#d23a32', '#ffffff', '#f2efe6'], wide: 2.8 });
  box(props, 151, 0, 76, 158, 2.4, 82, 0x3f6a4a, { mapColor: 0x3f6a4a });
  for (let z = 86; z < 95; z += 1.5) object('bin', 156.5, z);
  // In front of the cold stores, the kitchen staff's cars nose in to their painted bays; a van of the laundry's at the
  // kitchen door, unloading; pallets stacked along the west wall; the smokers' shelter.
  const CARS = [0xe8e6de, 0x2a2c30, 0xb8bcc0, 0xc8372d, 0x2f62a8, 0x6a6e72, 0xf2efe6];
  for (let k = 0; k < 8; k++) {
    const x = 112 + k * 3.6;
    s.decals.push({ pos: [x - 1.8, 64.5], size: [0.12, 5.4], color: 0xf2f2ee });
    if (k % 4 !== 2) props.push({ shape: 'box', size: [0.9, 0.65, 2.1], pos: [x, 0.83, 64.6], rot: [0, P, 0], color: CARS[k % CARS.length], vehicle: 'car' });
  }
  props.push({ shape: 'box', size: [1.15, 1.4, 3.7], pos: [98.6, 1.6, 88.5], rot: [0, -P / 2, 0], color: 0xf2efe6, vehicle: 'van' });
  for (let k = 0; k < 5; k++) for (let h = 0; h < 3; h++) box(props, 148.5, h * 0.16, 72 + k * 1.4, 149.7, h * 0.16 + 0.14, 73.2 + k * 1.4, 0xa07a4a, { ghost: h > 0 });
  box(props, 140, 2.4, 74, 146, 2.5, 80, 0x8a9098, { ghost: true, fade: true, overhead: true });
  for (const [x, z] of [[140, 74], [146, 74], [140, 80], [146, 80]] as const) bar(props, [x, 0, z], [x, 2.4, z], 0.05, 0x8a9098, { ghost: true });
  crowds.push({ area: [141, 75, 145, 79], count: 4, y: 0, clothes: [0xf2efe6], hat: 0xf2efe6 });
  for (const [x, z, r] of [[118, 91.5, 0], [120.4, 91.7, 0.1]] as const) object('crateTrolley', x, z, r);
  // Out on the yard: the morning's delivery between the dock and the kitchen door, stacked crates, trolleys of them.
  for (const [x, z, kind, r] of [[127, 80, 'vegCrate', 0], [128.2, 80.2, 'vegCrate', 0.1], [127.6, 81.4, 'fruitCrate', 0], [121, 77.5, 'fruitCrate', 0.3], [131, 90, 'crateTrolley', 1.2], [124, 92.5, 'vegCrate', 0.4], [104, 91, 'paperBox', 0], [105, 91.4, 'paperBox', 0.3], [104.4, 92.4, 'paperBox', 0.1], [104, 76, 'pallet', 0.2]] as const) object(kind, x, z, r);
  crowds.push({ area: [101.5, 89.8, 103.5, 92], count: 3, y: 0 });
}
