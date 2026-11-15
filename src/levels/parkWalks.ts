import { bar, beside, put, type ParkSite } from './parkParts';
import { GATE, RIDE, SHORE_Z, SLIDE, SLIDE_END, SPLASH, TABLES, teaFence } from './parkPlan';
import { POND, QUEUE } from './parkFront';
import type { ObjectKindId } from './objects';

// The walks between the rides: what stands out on the way itself along each of them, to be driven through or round. Each
// lot is of the place it is in, and put where the truck goes, not along the walls: the coaches' barriers at the start,
// the ducks on the pond's causeway, the firecrackers down the red carpet, the tea party out over the way to the cups,
// what the food trucks have put out on the shore, the rafts at the foot of the lift and in the slide, the pirates' powder
// store across the head of their bay, the prizes, the tavern's barrels, the kitchen's delivery spilled across its yard.

const P = Math.PI;
const [gx] = GATE;

export function walks(s: ParkSite): void {
  const { props, signs } = s;
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, y = 0) => put(s, kind, x, z, rotY, y);
  const stack = (kind: ObjectKindId, x: number, z: number, high: number, up: number, yaw = 0) => {
    for (let h = 0; h < high; h++) object(kind, x, z, yaw + h * 0.04, h * up);
  };
  /** A table out on the way: its parasol, two chairs at it. */
  const tableSet = (x: number, z: number, turn = 0) => {
    object('table', x, z);
    object('umbrella', x, z);
    object('chair', x + Math.cos(turn) * 0.9, z + Math.sin(turn) * 0.9, turn + 1.6);
    object('chair', x - Math.cos(turn) * 0.9, z - Math.sin(turn) * 0.9, turn - 1.6);
  };
  /** A barrel for a table, two stools at it. */
  const barrelTable = (x: number, z: number, turn = 0) => {
    object('woodBarrel', x, z);
    object('stool', x + Math.cos(turn) * 0.9, z + Math.sin(turn) * 0.9);
    object('stool', x - Math.cos(turn) * 0.85, z - Math.sin(turn) * 0.85 + 0.2);
  };

  // ------------------------------------------------------------------------------------------------------------------
  // 1. In from the coaches' bay: just past the line, the plastic barriers that were to keep vehicles out, cones before
  // them; the balloon seller where the people cross; pigeons on the paving before the booths.
  for (const dx of [-2.9, 0, 2.9]) object('barrier', gx + dx - 0.4, 33.2);
  for (const dx of [-1.45, 1.45]) object('cone', gx + dx - 0.4, 32.3);
  object('balloonCart', gx - 2.2, 37.4, 0.5);
  for (const [x, z] of [[gx - 1.2, 41.6], [gx - 3.4, 44.2]] as const) object('pigeons', x, z, x);

  // The pond's causeway: the ducks, out of the water and across it in a line behind their mother, at three places; a pail
  // of feed for the carp left by each.
  {
    const dike = QUEUE.filter((p) => p.z > POND.z0 + 3 && p.z < POND.z1 - 5);
    [0.14, 0.42, 0.68, 0.9].forEach((t, n) => {
      const k = Math.floor(t * (dike.length - 6));
      const side = n % 2 ? 1 : -1;
      for (let j = 0; j < 4; j++) { const [x, y, z] = beside(dike[k + j], side * (0.9 - j * 0.45)); object('duck', x, z, dike[k].yaw + side * 1.2, y); }
      const [x, y, z] = beside(dike[k + 5], -side * 1.35);
      object('bucket', x, z, 0, y);
    });
  }

  // The court's red carpet: the strings of firecrackers laid down its middle for the moment the ribbon is cut, one after
  // another to the ribbon; the tower of glasses for the toast set out on it before the ribbon.
  for (let z = POND.z1 + 5.5; z < 151; z += 3.2) object('firecrackerMat', gx + ((z * 7) % 3) * 0.2 - 0.2, z, P / 2);
  object('champagneTower', gx + 0.3, 153.2);

  // Into the hub: the balloon seller at the way in. Round it to the cups is the clowns' show (parkFront).
  object('balloonCart', 193.4, 222.6, -0.9);

  // 2. The tea party, out over the way in to the cups and up the narrow way from them to the coaster.
  {
    const [ax, az] = TABLES[0];
    const inX = ax - teaFence(0) - 1.5;
    tableSet(inX - 8.6, az + 1.5, 0.4);
    tableSet(inX - 11.4, az - 1.9, 2.2);
    const up = TABLES[TABLES.length - 1][0] + teaFence(TABLES.length - 1) + 7.3 + 9.5;
    object('cakeCart', up - 1.2, 254.2, 0.3);
    tableSet(up + 1.5, 258.4, 1.1);
    object('sugarCube', up + 0.4, 250.6, 0.7);
  }

  // 3. On the coaster's last straight, up where nobody comes: pigeons, sitting on the track.
  for (const [at, across] of [[246, 0.5], [254, -0.4], [270, 0.3]] as const) { const [x, y, z] = beside(RIDE[at], across); object('pigeons', x, z, at, y); }

  // 4. The north shore. By the hot dog van, its drinks: cases of water stacked head high, a table over the way from them,
  // so that the way between them is no wider than the truck and a little. Pigeons past the midway.
  stack('waterPack', 190.4, SHORE_Z - 1.0, 4, 0.31, 0.1);
  stack('waterPack', 189.2, SHORE_Z - 0.9, 5, 0.31, -0.2);
  tableSet(189.6, SHORE_Z + 4.6, 2.0);
  for (const [x, z] of [[212.6, SHORE_Z - 1.2], [199.6, SHORE_Z - 2.6]] as const) object('pigeons', x, z, x);

  // 5, 6. Up out of the wave pool and round to the lift: the wet floor's boards, the rafts waiting their turn to go up, rings
  // dropped. In the slide itself, what has come down it and stuck: rings, a raft, a mat.
  for (const [kind, x, z, turn] of [['slipBoard', 97.6, SHORE_Z + 0.5, 0.2], ['rideRaft', 94.4, SHORE_Z - 0.7, 0.4], ['swimRing', 92.2, SHORE_Z + 1.3, 0], ['rideRaft', 90.4, SHORE_Z + 0.1, 1.3], ['slipBoard', 88.4, SHORE_Z - 1.6, 1.0], ['rideRaft', 86.6, SHORE_Z - 3.0, 2.2], ['swimRingBlue', 84.4, SHORE_Z - 6.0, 0], ['swimRing', 83.4, SHORE_Z - 9.5, 0]] as const) object(kind, x, z, turn);
  for (const [kind, at, across] of [['swimRing', 12, -0.8], ['rideRaft', 30, 0.6], ['swimRingBlue', 46, -0.5], ['floatMat', 60, 0.7], ['swimRing', 118, 0.6], ['swimRingBlue', 130, -0.7], ['rideRaft', 142, 0.3]] as const) {
    const [x, y, z] = beside(SLIDE[at], across, 0.05);
    object(kind, x, z, at, y);
  }

  // ------------------------------------------------------------------------------------------------------------------
  // 7. The pirate bay. Up out of the splash pool: the wet floor's boards, rings and mats left where they were got out of, a
  // raft, loungers pulled out on to the way.
  {
    const ox = SLIDE_END.x + SPLASH.long + SPLASH.ramp, z = SLIDE_END.z;
    for (const [kind, dx, dz, turn] of [['slipBoard', 3.5, 0.5, 0.3], ['rideRaft', 7, -0.8, 0.5], ['swimRing', 10.2, 1.0, 0], ['swimRingBlue', 12, -0.5, 0], ['floatMat', 14.6, 0.7, 0.8], ['slipBoard', 18, -0.8, 1.2], ['lounger', 21, 1.6, 0.5], ['swimRing', 23.4, -0.3, 0]] as const) object(kind, ox + dx, z + dz, turn);
  }
  // Round the turn past the tavern: its barrels for tables, out as far as the middle of the way; a pirate of board.
  barrelTable(136.4, 231.2, 0.4);
  barrelTable(137.6, 224.6, 1.2);
  barrelTable(141.4, 219.8, 2.0);
  object('cutout', 139.6, 234.4, 0.3);

  // The powder store, across the head of the bay from one row of stalls to the other: what the pirates have landed, stood
  // in two rows across the way, barrels in front, crates and coils of rope behind them; a way through each row in two
  // places, not in line with the row before but a truck's width and a half to the side of it, and room between the rows
  // to get across. At a way through, on the side a truck cutting across from the last would
  // clip, a keg of powder: black, a red band round it, its fuse out of its lid.
  {
    const ROWS: [number, [number, number][]][] = [[211, [[136.4, 1], [129.0, 1]]], [197, [[140.0, -1], [132.6, -1]]]];
    const BEHIND: ObjectKindId[] = ['fruitCrate', 'woodBarrel', 'ropeCoil', 'woodBarrel'];
    for (const [z, ways] of ROWS) {
      const kegs = new Set<number>();
      let n = 0;
      for (let x = 126.4; x < 147; x += 1.05, n++) {
        const way = ways.find(([wx]) => Math.abs(x - wx) < 2.4);
        if (way) continue;
        // The first barrel past a way through, on its marked side, is the keg.
        const edge = ways.find(([wx, side]) => (x - wx) * side > 0 && Math.abs(x - wx) < 3.45 && !kegs.has(wx));
        if (edge) kegs.add(edge[0]);
        object(edge ? 'powderKeg' : 'woodBarrel', x, z + 0.55, n);
        object(BEHIND[n % BEHIND.length], x + 0.1, z - 0.6, n * 0.7);
      }
    }
    for (const x of [146.6, 148.6]) bar(props, [x, 0, 213.4], [x, 2.9, 213.4], 0.05, 0x5a3e28, { ghost: true });
    signs.push({ pos: [147.6, 2.4, 213.4], rotY: 0, kind: 'name', text: '火藥庫 嚴禁煙火', colors: ['#2a2420', '#f2c12e', '#c8372d'], wide: 2.6 });
  }

  // Out from under the ships: the stalls' biggest prizes stood out in the way in two bunches, one before each lane; the
  // balloon seller between them.
  for (const [x, z] of [[140.0, 160.4], [139.1, 158.8], [140.9, 157.6], [140.2, 155.6], [132.6, 159.6], [133.5, 157.8], [131.8, 156.4]] as const) object('plushGiant', x, z, P + (x - 136) * 0.1);
  object('balloonCart', 136.4, 153.6, 0.4);
  object('pigeons', 138.2, 149.4, 1);
  // Past the restaurant's terrace: its grill out on the way with the squid on it, its barrels for tables.
  object('grill', 138.2, 141.4, P / 2);
  barrelTable(141.8, 142.6, 0.3);
  barrelTable(139.4, 136.4, 1.5);
  barrelTable(142.2, 132.2, 2.4);
  barrelTable(137.4, 130.8, 0.8);
  // Down its side to the yard's gate, the kitchen's delivery, left where the trolley tipped: eggs in their cases, boxes of
  // noodles, a cart; cabbages and melons rolled out across the way.
  stack('eggCase', 139.2, 121.4, 3, 0.33);
  stack('eggCase', 140.8, 113.6, 3, 0.33, 0.4);
  stack('noodleBox', 141.0, 107.2, 3, 0.35, 0.2);
  stack('noodleBox', 139.9, 106.6, 2, 0.35, 0.9);
  object('shoppingCart', 138.6, 117.2, 0.5);
  for (const [x, z] of [[139.6, 110.4], [140.9, 109.6], [138.4, 108.8]] as const) object('melon', x, z);
  for (const [x, z] of [[139.4, 103.6], [140.8, 102.8], [141.4, 104.4], [138.6, 102.2], [140.0, 101.4], [139.0, 100.2]] as const) object('cabbage', x, z);
  // In the yard, to the kitchen's door: a trolley of crates, crates stacked, more cabbages, boxes, a cart.
  object('crateTrolley', 138.4, 96.4, 0.9);
  stack('vegCrate', 136.2, 91.6, 3, 0.33, 0.3);
  for (const [x, z] of [[135.2, 89.2], [134.0, 88.4], [133.2, 87.2], [134.6, 87.0], [132.0, 86.4], [130.6, 85.8]] as const) object('cabbage', x, z);
  for (const [x, z] of [[128.6, 85.6], [127.8, 84.8]] as const) object('melon', x, z);
  object('fruitCrate', 125.6, 85.4, 0.3);
  for (const [x, z, r] of [[123.2, 84.2, 0], [122.4, 85.2, 0.4], [121.6, 84.0, 1.0]] as const) object('paperBox', x, z, r);
  object('shoppingCart', 119.4, 83.4, -0.4);
}
