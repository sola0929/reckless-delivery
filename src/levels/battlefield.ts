import { cityLoad } from './city';
import type { ObjectDesc, ObjectKindId } from './objects';
import { mulberry32 } from './sandbox';
import type { BattleDesc, CrowdDesc, DecalDesc, LevelDef, PitDesc, PropDesc, Vec2 } from './types';

// The second delivery: out of a camp and through the middle of a battle between two armies.
// Not one road but a string of places, each its own, with its own edges, its own things
// to knock flying and its own way of being got through:
//
//   the camp       a stockade full of tents, stores, a kitchen, parked jeeps
//   the village    streets of houses and a church square, being shelled
//   the trenches   the two armies' machine guns firing across from behind concrete
//   the farm       a track between the two armies, who charge each other across it
//   the burnt wood a long way round between trunks, in smoke, under shellfire
//
// and, for now, the place to deliver to straight after. More is to come beyond it.

const PLASTER = [0xd8c9a8, 0xc9b28a, 0xb9a48c, 0xd2b8a0, 0xa9a294, 0xc4a57a];
const ROOFS = [0xa8553a, 0x9a4a34, 0x5f646b];
const STONE = 0xb4ac9c;
const WOOD = 0x8a6a44;
const HEDGE = 0x4f7a3e;
const HOUSE_ON_MAP = 0x4a4038;
const EDGE_ON_MAP = 0x39342c;

export function battlefield(): LevelDef {
  const rand = mulberry32(31);
  const span = (a: number, b: number) => a + rand() * (b - a);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  const props: PropDesc[] = [];
  const objects: ObjectDesc[] = [];
  const decals: DecalDesc[] = [];
  const crowds: CrowdDesc[] = [];
  const pits: PitDesc[] = [];
  const battle: Required<BattleDesc> = { shelling: [], gunners: [], launchers: [], tanks: [], patches: [], smoke: [], banks: [], mounds: [], craters: [], wrecks: [] };

  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0) => objects.push({ kind, pos: [x, 0, z], rotY });
  const crater = (x: number, z: number, radius: number) => {
    pits.push({ pos: [x, z], half: [radius, radius], depth: 0.32 });
    battle.craters.push({ pos: [x, z], radius });
  };
  const mound = (x: number, z: number, radius: number, height: number) => battle.mounds.push({ pos: [x, z], radius, height });
  const wreck = (kind: 'tank' | 'truck', x: number, z: number, rotY: number) => battle.wrecks.push({ kind, pos: [x, z], rotY });
  const ground = (x0: number, z0: number, x1: number, z1: number, color: number, mapColor?: number, y?: number) =>
    decals.push({ pos: [(x0 + x1) / 2, (z0 + z1) / 2], size: [x1 - x0, z1 - z0], color, mapColor, y });
  const ghost = (size: PropDesc['size'], pos: PropDesc['pos'], color: number, rot?: PropDesc['rot']) => props.push({ shape: 'box', size, pos, rot, color, ghost: true });

  /** A straight length of something that cannot be driven through, along X or along Z. */
  const edge = (kind: 'palisade' | 'hedge' | 'stone' | 'trunks', x0: number, z0: number, x1: number, z1: number) => {
    const alongX = z0 === z1;
    const length = Math.abs(alongX ? x1 - x0 : z1 - z0);
    const mid: Vec2 = [(x0 + x1) / 2, (z0 + z1) / 2];
    const slab = (thick: number, height: number, color: number, lift = 0, solid = true) =>
      props.push({ shape: 'box', size: alongX ? [length / 2, height / 2, thick] : [thick, height / 2, length / 2], pos: [mid[0], lift + height / 2, mid[1]], color, ghost: !solid, mapColor: solid ? EDGE_ON_MAP : undefined });
    const every = (step: number, put: (x: number, z: number) => void) => {
      for (let d = step / 2; d < length; d += step) put(alongX ? Math.min(x0, x1) + d : x0, alongX ? z0 : Math.min(z0, z1) + d);
    };
    if (kind === 'palisade') {
      // Planks, with a post every few of them standing a little higher.
      slab(0.16, 2, WOOD);
      every(2.6, (x, z) => ghost([0.22, 1.15, 0.22], [x, 1.15, z], 0x6e5236));
    } else if (kind === 'hedge') {
      slab(0.75, 1.8, HEDGE);
      every(2.2, (x, z) => ghost([0.95, 0.35, 0.95], [x + span(-0.15, 0.15), 1.75 + span(0, 0.25), z + span(-0.15, 0.15)], rand() < 0.5 ? 0x5b8a48 : 0x466e38, [0, rand() * 3, 0]));
    } else if (kind === 'stone') {
      slab(0.35, 1.05, 0x9b968a);
      slab(0.42, 0.12, 0x857f74, 1.05, false);
    } else {
      // Trunks, shoulder to shoulder: what is left of the trees at the edge of the wood.
      every(1.5, (x, z) => {
        const tall = span(2.2, 3.4);
        props.push({ shape: 'cylinder', size: [span(0.42, 0.6), tall, 0], pos: [x + span(-0.2, 0.2), tall, z + span(-0.2, 0.2)], color: rand() < 0.5 ? 0x3a2f28 : 0x2e2622 });
      });
      slab(0.3, 1.2, 0x2e2622, 0, true);
    }
  };

  /** A house: plaster walls with windows in them, and a tiled roof if it still has one. */
  const house = (cx: number, cz: number, hx: number, hz: number, height: number, color: number, roof: number | null) => {
    props.push({ shape: 'box', size: [hx, height / 2, hz], pos: [cx, height / 2, cz], color, mapColor: HOUSE_ON_MAP });
    const dark = 0x2e2a28;
    for (const level of height > 5.6 ? [1.7, 4.4] : [1.7]) {
      for (let n = Math.floor((hx * 2) / 3.4), i = 0; i < n; i++) {
        const x = cx - hx + ((i + 0.5) * hx * 2) / n;
        for (const side of [-1, 1]) ghost([0.45, 0.6, 0.03], [x, level, cz + side * (hz + 0.02)], dark);
      }
      for (let n = Math.floor((hz * 2) / 3.4), i = 0; i < n; i++) {
        const z = cz - hz + ((i + 0.5) * hz * 2) / n;
        for (const side of [-1, 1]) ghost([0.03, 0.6, 0.45], [cx + side * (hx + 0.02), level, z], dark);
      }
    }
    if (roof === null) {
      // Roofless: a corner of the upper wall still standing above the rest.
      ghost([hx * 0.4, 0.7, 0.25], [cx - hx * 0.6, height + 0.7, cz + hz - 0.25], color);
      ghost([0.25, 0.45, hz * 0.5], [cx + hx - 0.25, height + 0.45, cz - hz * 0.5], color);
      return;
    }
    const pitch = 0.5;
    if (hx >= hz) {
      const slope = hz / Math.cos(pitch) / 2 + 0.25;
      for (const side of [-1, 1]) ghost([hx + 0.3, 0.12, slope], [cx, height + (hz * Math.tan(pitch)) / 2, cz + (side * hz) / 2], roof, [side * pitch, 0, 0]);
    } else {
      const slope = hx / Math.cos(pitch) / 2 + 0.25;
      for (const side of [-1, 1]) ghost([slope, 0.12, hz + 0.3], [cx + (side * hx) / 2, height + (hx * Math.tan(pitch)) / 2, cz], roof, [0, 0, -side * pitch]);
    }
  };

  /** A block of houses, wall to wall, filling a rectangle: some whole, some shelled out. */
  const block = (x0: number, z0: number, x1: number, z1: number) => {
    const rows = Math.max(1, Math.round((z1 - z0) / 13));
    for (let r = 0; r < rows; r++) {
      const za = z0 + ((z1 - z0) * r) / rows;
      const zb = z0 + ((z1 - z0) * (r + 1)) / rows;
      for (let x = x0; x < x1 - 0.1; ) {
        const left = x1 - x;
        const width = left < 17 ? left : span(8, 12.5);
        const ruined = rand() < 0.3;
        house(x + width / 2, (za + zb) / 2, width / 2, (zb - za) / 2, ruined ? span(2.6, 4) : span(4.8, 8), ruined ? 0x8f887c : pick(PLASTER), ruined ? null : pick(ROOFS));
        x += width;
      }
    }
  };

  // ================================================================ the camp
  // A stockade, x -22 to 22, z -34 to 48, with the gate in the middle of its north side.
  ground(-22, -34, 22, 48, 0x7c6c52, 0x5a5142);
  edge('palisade', -22, -34, 22, -34);
  edge('palisade', -22, -34, -22, 48);
  edge('palisade', 22, -34, 22, 48);
  edge('palisade', -22, 48, -7, 48);
  edge('palisade', 7, 48, 22, 48);
  // The headquarters hut stands square in the way out: round it, one side or the other.
  house(0, 10, 4.5, 3.5, 3.2, 0x6f7a4e, 0x4f5838);
  object('flagTeal', -5.6, 6);
  object('flagTeal', 5.6, 6);
  // Tents in two rows down the west side, stores by each.
  for (const z of [-26, -16, -6, 4, 14, 24, 34]) {
    object('armyTent', -17.5, z, 0.05);
    if (z < 30) object('armyTent', -11, z + 5, -0.04);
    object('ammoCrate', -14.2, z + 2.6, span(-0.4, 0.4));
    object(rand() < 0.5 ? 'jerrycan' : 'ammoCrate', -14.4, z + 3.6, span(-0.4, 0.4));
  }
  // The kitchen and its tables, and the washing, on the east side.
  object('fieldKitchen', 15, -22, 0.2);
  object('barrel', 17.5, -24);
  for (const [x, z] of [[9, -24], [9.5, -17], [15, -15]]) {
    object('table', x, z);
    for (const [dx, dz] of [[1, 0], [-1, 0.2], [0, 1], [0.2, -1]]) object('stool', x + dx, z + dz);
  }
  for (const z of [-6, -2]) object('clothesRack', 15, z, Math.PI / 2);
  // Stores stacked in the middle of the yard, and fuel well away from the tents.
  for (const [x, z] of [[4, -8], [5.2, -8.4], [4.6, -7.2], [-3, -4], [-4, -3.2]]) object('ammoCrate', x, z, span(0, 1.5));
  objects.push({ kind: 'ammoCrate', pos: [4.6, 0.44, -8], rotY: 0.6 });
  for (const [x, z] of [[18.5, 8], [19.4, 9.2], [18.3, 10.4]]) object('oilDrum', x, z);
  // The motor pool by the gate: jeeps, drawn up in a row, and a pile of sandbags.
  for (const x of [10, 13.6, 17.2]) object('jeep', x, 36, Math.PI + span(-0.08, 0.08));
  object('jeep', -6, 30, 1.2);
  for (let i = 0; i < 5; i++) object('sandbag', 8.4 + (i % 2) * 0.2, 42 + i * 0.9, Math.PI / 2);
  for (let i = 0; i < 5; i++) object('sandbag', -8.4 - (i % 2) * 0.2, 42 + i * 0.9, Math.PI / 2);
  // In the open yard only: not through the tents, nor through the hut.
  crowds.push({ area: [-7, -30, 20, 4], count: 8, y: 0, army: 0 }, { area: [-7, 16, 20, 44], count: 6, y: 0, army: 0 });
  // The way out is barred. It is only a pole. Under it, the line the clock starts at.
  const gate = 48;
  for (const x of [-7.2, 0, 7.2]) object('post', x, gate);
  objects.push({ kind: 'gateArm', pos: [3.6, 1, gate] }, { kind: 'gateArm', pos: [-3.6, 1, gate] });
  decals.push({ pos: [0, gate], size: [14, 0.6], color: 0xe8e2d0, y: 0.04 });

  // A lane between field walls, from the gate to the first houses.
  ground(-7, 48, 7, 66, 0x6f6350, 0x5a5142);
  edge('stone', -7, 48, -7, 66);
  edge('stone', 7, 48, 7, 66);
  for (const z of [54, 60]) object('treeSmall', 5.6, z);
  object('cart', -4.5, 58, 0.5);

  // ================================================================ the village
  // Houses wall to wall. One street in from the south, a square with the church in the middle
  // of it, and one street out to the north, further east: across the square, round the church.
  const COBBLE = 0x8f8a82;
  ground(-5.5, 66, 5.5, 104, COBBLE, 0x6a665f);
  ground(-40, 104, 36, 150, 0x99948a, 0x6a665f);
  ground(14, 150, 25, 176, COBBLE, 0x6a665f);
  block(-58, 66, -5.5, 104);
  block(5.5, 66, 54, 104);
  block(-58, 104, -40, 150);
  block(36, 104, 54, 150);
  block(-58, 150, 14, 176);
  block(25, 150, 54, 176);
  battle.shelling.push({ area: [-42, 68, 38, 176], every: 0.9 });
  // The street in: what people left behind when they went, and a barricade half across it.
  object('cart', -3.6, 74, 0.3);
  object('barrel', 3.8, 78);
  object('barrel', 4.3, 79.1);
  object('bench', -4.4, 84, Math.PI / 2);
  object('mailbox', 4.4, 88);
  for (let i = 0; i < 6; i++) object('sandbag', -5 + i * 0.95, 95);
  for (let i = 0; i < 5; i++) objects.push({ kind: 'sandbag', pos: [-4.5 + i * 0.95, 0.28, 95] });
  object('hedgehog', 3.4, 97.5, 0.6);
  crater(2.4, 86, 1.4);
  // The church: nave and tower, in the middle of the square.
  house(-3, 128, 11, 7, 9, STONE, 0x5f646b);
  props.push({ shape: 'box', size: [3, 8, 3], pos: [-17, 8, 128], color: STONE, mapColor: HOUSE_ON_MAP });
  props.push({ shape: 'cone', size: [3.6, 2.6, 0], pos: [-17, 18.6, 128], color: 0x5f646b, ghost: true });
  for (const side of [-1, 1]) ghost([0.03, 1, 0.5], [-17 + side * 3.02, 12.5, 128], 0x2e2a28);
  // The well, and the trees and benches round the square.
  props.push({ shape: 'cylinder', size: [1.5, 0.45, 0], pos: [22, 0.45, 126], color: 0xa8a294, mapColor: EDGE_ON_MAP });
  props.push({ shape: 'cylinder', size: [1.15, 0.02, 0], pos: [22, 0.9, 126], color: 0x3f6f9a, ghost: true });
  for (const [x, z] of [[-34, 110], [-34, 144], [-22, 109], [10, 109], [30, 144], [-10, 145], [30, 112]]) object(rand() < 0.5 ? 'treeSmall' : 'tree', x, z);
  for (const [x, z, turn] of [[-30, 118, 1.57], [-30, 136, 1.57], [-8, 112, 0], [4, 112, 0], [18, 121, 0], [26, 121, 0]]) object('bench', x, z, turn);
  for (const [x, z] of [[-37, 124], [-37, 131], [33, 120], [33, 138], [0, 147], [-20, 147]]) object('lamp', x, z);
  // A market that never got packed up: carts and what was on them. And a café, its tables still out.
  for (const [x, z, turn] of [[-28, 126, 0.2], [-25, 131, 1.4], [-30, 142, -0.4], [14, 141, 0.8], [8, 145, 2]]) {
    object('cart', x, z, turn);
    for (let i = 0; i < 3; i++) object(pick<ObjectKindId>(['box', 'box', 'barrel', 'pallet']), x + span(-2, 2), z + span(-2, 2), span(0, 3));
  }
  for (const [x, z] of [[24, 108.5], [28, 109], [31.5, 108.5], [27, 113]]) {
    object('table', x, z);
    object('chair', x + 0.9, z + 0.2, 1.5);
    object('chair', x - 0.9, z - 0.1, -1.5);
  }
  object('umbrella', 26, 110.8);
  object('umbrella', 30, 111);
  // What the shelling has done to it already.
  wreck('tank', -24, 114, 1.1);
  wreck('truck', 16, 133, -0.5);
  crater(-12, 112, 1.7);
  crater(12, 120, 1.5);
  crater(-27, 138, 1.6);
  crater(4, 141, 1.4);
  crater(29, 132, 1.5);
  mound(-18, 142, 2.6, 0.6);
  mound(24, 146, 2.2, 0.5);
  mound(-35, 116, 2, 0.5);
  // Those who have not got out yet.
  crowds.push({ area: [-36, 106, 32, 119], count: 4, y: 0 }, { area: [-36, 138, 32, 148], count: 3, y: 0 }, { area: [10, 106, 32, 148], count: 3, y: 0 });
  // The street out: a lorry across most of it, and a hole beside that.
  wreck('truck', 17.5, 160, 1.3);
  crater(22.2, 167, 1.3);
  object('barrel', 23.5, 155);
  object('cart', 15.5, 170, -0.3);

  // ================================================================ the trenches
  // The two armies, dug in either side behind banks of earth, each gunner behind his concrete,
  // firing across. In between: wrecks, each of which is shelter from one side, and wire.
  const cx = 19.5;
  ground(cx - 12, 176, cx + 12, 268, 0x5d4f3c, 0x4d4436);
  for (const side of [-1, 1]) {
    const line: Vec2[] = [[cx + side * 7, 176], [cx + side * 13.1, 186], [cx + side * 13.1, 258], [cx + side * 7, 268]];
    for (let i = 0; i < line.length - 1; i++) battle.banks.push({ from: line[i], to: line[i + 1], height: 1.8 });
  }
  for (let z = 190; z <= 246; z += 14) {
    battle.gunners.push({ pos: [cx - 10.4, z], aim: Math.PI / 2, side: 0 }, { pos: [cx + 10.4, z + 7], aim: -Math.PI / 2, side: 1 });
  }
  wreck('tank', cx - 3.5, 194, 0.2);
  battle.patches.push({ pos: [cx + 4.6, 195], half: [2.6, 1.8], kind: 'wire' });
  crater(cx + 0.5, 204, 1.5);
  mound(cx - 5.6, 205, 2.2, 0.5);
  wreck('truck', cx + 3.8, 212, -0.4);
  battle.patches.push({ pos: [cx - 4.6, 214], half: [2.6, 1.8], kind: 'wire' });
  crater(cx - 0.6, 224, 1.4);
  mound(cx + 5.6, 225, 2.4, 0.5);
  wreck('tank', cx + 3.2, 234, 1.4);
  battle.patches.push({ pos: [cx - 5.4, 235], half: [2.2, 1.8], kind: 'wire' });
  crater(cx + 5.4, 244, 1.3);
  wreck('truck', cx - 4, 250, 0.3);
  battle.patches.push({ pos: [cx + 4.4, 252], half: [2.6, 1.8], kind: 'wire' });
  mound(cx + 0.4, 259, 2.6, 0.55);
  for (const [x, z] of [[cx - 7, 184], [cx + 7.5, 200], [cx - 7.5, 240], [cx + 7, 262]]) object('ammoCrate', x, z, span(0, 2));

  // ================================================================ the farm
  // Fields between hedges, x -6.5 to 45.5, z 268 to 372, with the track straight up the middle.
  // One army holds the west hedge and the other the east: machine guns behind concrete, two
  // tanks a side shelling each other across the track, and four strips of field where, every
  // so often, both get up at once and run at each other, across the track, and are cut down
  // in the middle. The track is the only way: stop, wait for the charge to be over, and go.
  const west = cx - 26;
  const east = cx + 26;
  ground(west, 268, east, 372, 0x9a9a52, 0x7c7d46);
  ground(cx - 4.5, 268, cx + 4.5, 372, 0x6f6350, 0x5a5142, 0.03);
  edge('hedge', west, 268, cx - 7, 268);
  edge('hedge', cx + 7, 268, east, 268);
  edge('hedge', west, 268, west, 372);
  edge('hedge', east, 268, east, 372);
  edge('hedge', west, 372, cx - 7, 372);
  edge('hedge', cx + 7, 372, east, 372);
  for (const z of [276, 318, 362]) battle.gunners.push({ pos: [west + 2.4, z], aim: Math.PI / 2, side: 0, reach: 48 });
  for (const z of [279, 293, 340]) battle.gunners.push({ pos: [east - 2.4, z], aim: -Math.PI / 2, side: 1, reach: 48 });
  battle.tanks.push(
    { pos: [west + 7.5, 300], rotY: Math.PI / 2, gun: Math.PI / 2, side: 0 },
    { pos: [west + 7.5, 344], rotY: Math.PI / 2, gun: Math.PI / 2, side: 0 },
    { pos: [east - 7.5, 322], rotY: -Math.PI / 2, gun: -Math.PI / 2, side: 1 },
    { pos: [east - 7.5, 366], rotY: -Math.PI / 2, gun: -Math.PI / 2, side: 1 },
  );
  // The charges: four strips, and in each the two armies come at each other from either side at the same moment.
  [282, 304, 326, 348].forEach((z, n) => {
    ground(west + 1, z, east - 1, z + 8, 0x86803f, undefined, 0.02);
    for (const army of [0, 1] as const) {
      crowds.push({ area: [west + 3, z + 0.5, east - 3, z + 7.5], count: 9, y: 0, army, charge: { every: 13, from: army ? 'high' : 'low', phase: n * 3.5, falls: [0.3, 0.6] } });
    }
  });
  // What was a farm, in what is left between the strips.
  house(cx + 16.5, 299, 5, 3.4, 5, 0xd8c9a8, 0xa8553a);
  object('cart', cx + 10, 272, 0.9);
  for (const x of [5, 9, 13]) object('tree', x, 294);
  wreck('truck', 9, 319.5, 0.5);
  for (const [x, z] of [[4, 274], [7, 277], [31, 318], [34, 316], [3, 337], [6, 339], [33, 343], [30, 360], [7, 364]]) object('haystack', x, z);
  for (const [z0, z1] of [[291.5, 303], [313.5, 325], [335.5, 347], [357.5, 370]]) {
    for (let z = z0; z < z1; z += 2.1) for (const side of [-1, 1]) object('fence', cx + side * 6, z, Math.PI / 2);
  }
  for (const [x, z] of [[28, 296], [11, 342], [29, 341]]) object('scarecrow', x, z, span(0, 6));
  crater(cx + 1.6, 296, 1.4);
  mound(cx - 2, 318, 2.2, 0.5);
  crater(cx - 1.8, 340, 1.5);
  wreck('truck', cx - 2.6, 362.5, 0.4);

  // ================================================================ the burnt wood
  // A long way round through what is left of a wood: thick black trunks, shoulder to shoulder,
  // that nothing drives through, and a way between them that doubles back on itself three
  // times. It is still burning: smoke lies across two stretches of it, and it is being shelled.
  // Trees have come down across the way: some to go round, some to go over.
  const WAY: Vec2[] = [[cx, 372], [cx, 386], [46, 402], [46, 422], [0, 440], [0, 460], [40, 476], [40, 492], [cx, 506], [cx, 518]];
  const HALF_WAY = 5.6;
  ground(-22, 372, 68, 518, 0x4c4842, 0x3d3a35);
  const legOf = (n: number) => {
    const [ax, az] = WAY[n];
    const [bx, bz] = WAY[n + 1];
    const length = Math.hypot(bx - ax, bz - az);
    return { ax, az, dx: (bx - ax) / length, dz: (bz - az) / length, length };
  };
  /** A place on a leg of the way: `t` of the way along it, `d` metres to its side. */
  const along = (n: number, t: number, d = 0): Vec2 => {
    const { ax, az, dx, dz, length } = legOf(n);
    return [ax + dx * length * t + dz * d, az + dz * length * t - dx * d];
  };
  const yawOf = (n: number) => Math.atan2(legOf(n).dx, legOf(n).dz);
  const fromWay = (x: number, z: number) => {
    let nearest = Infinity;
    for (let n = 0; n < WAY.length - 1; n++) {
      const { ax, az, dx, dz, length } = legOf(n);
      const t = Math.max(0, Math.min(length, (x - ax) * dx + (z - az) * dz));
      nearest = Math.min(nearest, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
    return nearest;
  };
  for (let n = 0; n < WAY.length - 1; n++) {
    const { length } = legOf(n);
    decals.push({ pos: along(n, 0.5), size: [HALF_WAY * 2 - 2, length + 6], rotY: yawOf(n), color: 0x5a544b, y: 0.03 });
  }
  const trunks: Vec2[] = [];
  const trunk = (x: number, z: number, onMap: boolean) => {
    if (trunks.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 1.3)) return;
    trunks.push([x, z]);
    const tall = span(1.3, 2);
    props.push({ shape: 'cylinder', size: [span(0.45, 0.62), tall, 0], pos: [x, tall, z], color: rand() < 0.5 ? 0x33291f : 0x2a2420, mapColor: onMap ? EDGE_ON_MAP : undefined });
    if (rand() < 0.6) ghost([0.07, 0.8, 0.07], [x + 0.5, tall * 1.5, z], 0x2a2420, [0, rand() * 6, 0.9]);
  };
  // Down both sides of the way, too close together for anything to go between; and round the outside of each bend.
  const OUT = HALF_WAY + 0.6;
  for (let n = 0; n < WAY.length - 1; n++) {
    const { length } = legOf(n);
    for (let d = 0; d <= length; d += 2) {
      for (const side of [-1, 1]) {
        const [x, z] = along(n, d / length, side * OUT);
        if (fromWay(x, z) >= HALF_WAY) trunk(x + span(-0.2, 0.2), z + span(-0.2, 0.2), true);
      }
    }
  }
  for (const [vx, vz] of WAY.slice(1, -1)) {
    for (let a = 0; a < Math.PI * 2; a += 2 / OUT) {
      const x = vx + Math.cos(a) * OUT;
      const z = vz + Math.sin(a) * OUT;
      if (fromWay(x, z) >= HALF_WAY) trunk(x, z, true);
    }
  }
  // And the rest of the wood behind them, thinning out.
  for (let i = 0; i < 420; i++) {
    const x = span(-22, 68);
    const z = span(374, 516);
    if (fromWay(x, z) > OUT + 2 && trunks.every(([tx, tz]) => Math.hypot(x - tx, z - tz) > 3)) trunk(x, z, false);
  }
  /** A tree down across the way: thick, lying out from one side, to go round; or sunk in the ash right across, to go over. */
  const log = (n: number, t: number, d: number | null) => {
    const [x, z] = along(n, t, d ?? 0);
    props.push(d === null
      ? { shape: 'cylinder', size: [0.3, HALF_WAY, 0], pos: [x, -0.1, z], rot: [0, yawOf(n), Math.PI / 2], color: 0x33291f }
      : { shape: 'cylinder', size: [0.4, 2.7, 0], pos: [x, 0.4, z], rot: [0, yawOf(n) + span(-0.2, 0.2), Math.PI / 2], color: 0x2e2622 });
  };
  battle.smoke.push({ pos: [42, 414], radius: 24 }, { pos: [14, 466], radius: 25 });
  battle.shelling.push({ area: [-22, 388, 68, 506], every: 1.7 });
  // In: a quiet stretch, with only saplings to go through.
  for (const d of [-2.5, 0.5, 3]) object('deadTree', ...along(0, 0.6 + d * 0.05, d), rand() * 6);
  log(1, 0.4, null);
  log(1, 0.78, 2.9);
  // North, into the first of the smoke: mud underfoot, and fuel left lying.
  battle.patches.push({ pos: along(2, 0.5), half: [3.6, 3], kind: 'mud' });
  object('oilDrum', ...along(2, 0.22, -3.4));
  object('oilDrum', ...along(2, 0.85, 3.2));
  // Back west, the long leg: round a tree, round a lorry, round another tree.
  log(3, 0.2, -2.9);
  wreck('truck', ...along(3, 0.45, 2.7), yawOf(3) + 0.5);
  log(3, 0.62, null);
  log(3, 0.8, -2.9);
  for (const [t, d] of [[0.32, 2.5], [0.56, -3], [0.9, 1.5]]) object('deadTree', ...along(3, t, d), rand() * 6);
  battle.patches.push({ pos: along(4, 0.5), half: [3.6, 3.2], kind: 'mud' });
  object('oilDrum', ...along(4, 0.15, 3.5));
  // East again, through the second of the smoke: trees down from one side and then the other.
  log(5, 0.25, 2.9);
  log(5, 0.5, -2.9);
  crater(...along(5, 0.72, 2), 1.4);
  log(5, 0.88, null);
  object('oilDrum', ...along(6, 0.3, -3.4));
  log(6, 0.55, null);
  log(6, 0.8, null);
  // And out: a tank that got this far.
  wreck('tank', ...along(7, 0.5, 2.3), yawOf(7) + 0.4);
  for (const [t, d] of [[0.2, -3], [0.82, -2]]) object('deadTree', ...along(7, t, d), rand() * 6);

  // ================================================================ for now, the end
  // A clearing beyond the wood, stockaded: the forward post that the load is for.
  ground(cx - 13, 518, cx + 13, 552, 0x7c6c52, 0x5a5142);
  edge('palisade', cx - 13, 518, cx - 13, 552);
  edge('palisade', cx + 13, 518, cx + 13, 552);
  edge('palisade', cx - 13, 552, cx + 13, 552);
  edge('palisade', cx - 13, 518, cx - OUT, 518);
  edge('palisade', cx + OUT, 518, cx + 13, 518);
  const finish: Vec2 = [cx, 536];
  decals.push({ pos: finish, size: [7, 13], color: 0x3fbf6a, y: 0.04 });
  for (const side of [-1, 1]) {
    object('armyTent', cx + side * 9, 545, 0);
    object('ammoCrate', cx + side * 8, 530, 0.3);
    object('flagTeal', cx + side * 6, 524);
  }

  return {
    id: 'battlefield',
    name: '第 2 關　戰地快遞',
    brief: '穿過兩軍交戰的戰場，把貨物送到綠色卸貨區',
    ground: { center: [10, 260], half: [190, 330], style: 'earth' },
    light: 'dusk',
    bounds: [[-64, -40], [74, 558]],
    spawn: [0, 0.9, -24],
    startLine: { pos: [0, gate], dir: [0, 1] },
    heading: 0,
    props,
    objects,
    crowds,
    pits,
    route: [[0, -24], [-7, 10], [0, 48], [0, 104], [19.5, 150], ...WAY, finish],
    decals,
    battle,
    cargo: cityLoad(),
    traffic: [],
    finish: { pos: finish, half: [3.4, 6.4] },
    stars: [0, 0.6],
    par: 180,
  };
}
