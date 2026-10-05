import { cityLoad } from './city';
import { MAP } from './hilltown-map';
import type { ObjectDesc, ObjectKindId } from './objects';
import { mulberry32 } from './sandbox';
import { heightAt, makeStepped, type Patch } from './terrain';
import type { BuildingLook, CrowdDesc, DecalDesc, LevelDef, PropDesc, Vec2 } from './types';

// The second delivery: from a town at the foot of the mountain, out through the country.
// Like the city, it is drawn as a map of characters (in hilltown-map.ts); here each is a
// 12 m square, so that the roads are narrower than the city's, and the land rises to the
// north in terraces, each a step above the last.
//
//   . road              , farm road, lane       m road with a market or a fair in it
//   ^ a road climbing to the north               W the road's bridge, down
//   o shophouses        k sheet-metal shed       h brick house        e open lot
//   q square            r drying ground          d yard
//   p paddy             f dry field              a betel palms        g greenhouses
//   w water             b bamboo                 # hill
//   t temple court      T temple    B banyan     G stage
//   s the big house's ground        S its buildings
//
// It is a country of roads that go somewhere: a town of three streets each way, a county
// road north out of it, farm roads crossing that between the fields, houses in ribbons
// along the roads and in knots where they cross, and an old brick village at the top.
// The way through uses them: round the town rather than through its market, off the county
// road and round by the farm roads where its bridge is down, back to it and through the
// temple's fair, into the old village by its lanes, through the big house, and out along
// the dike between the fish ponds.

const CELL = 12;
const HALF = CELL / 2;
const ROWS = MAP.length;
const COLS = MAP[0].length;
const KERB = 0.15;

const ASPHALT = 0x5b626b;
const FARM_ROAD = 0x7f807c;
const EARTH = 0x8a7a5e;
const PAVEMENT = 0x9aa0a8;
const GRASS = 0x7f9450;
const WATER = 0x4f8fa8;
const BUND = 0x7d6c50;
const STONE = 0xa8a59c;
const ROCK = 0x8b8880;
const SHOPFRONTS = [0xc9a27e, 0xd4c4a8, 0xbf8f6f, 0xd9b99a, 0xb7a58c, 0xc7b29a];
const SHEDS = [0x7d8a94, 0x8a5a44, 0x5f7f8f, 0x9a9a8c, 0x6f7a6a];
const BRICK = [0xa8503a, 0x9c4a36, 0xb05a40];
const TILE = 0x55504e;
const ON_MAP = { building: 0x5f6670, house: 0x7a4638, wall: 0x6a4034 };

// Squares are addressed as (column, row counted from the south). Looking north, +X is to
// the left, so columns run the other way from X, as in the city.
const at = (c: number, r: number): string => (c < 0 || c >= COLS || r < 0 || r >= ROWS ? '#' : MAP[ROWS - 1 - r][c]);
const xOf = (c: number) => (COLS / 2 - 0.5 - c) * CELL;
const zOf = (r: number) => r * CELL;
/** How high the land stands at each row: a plain, and then four terraces, each a step above the last. */
const band = (r: number) => (r < 21 ? 0 : r < 28 ? 1.5 : r < 36 ? 3 : r < 42 ? 4.5 : 6);
/** How high a square stands. A road that climbs is as high as the terrace below it at its south edge. */
const highAt = (c: number, r: number) => (at(c, r) === '^' ? band(r - 1) : band(r));
const isRoad = (kind: string) => '.,m^'.includes(kind);
/** What a road joins on to: other road, and the open ground that roads lead into. */
const joins = (kind: string) => isRoad(kind) || 'dtsq'.includes(kind);
/** Whether the road in a square is a farm road or a lane, and not the wider kind. A climbing square is whatever it climbs from. */
const narrow = (c: number, r: number) => at(c, r) === ',' || (at(c, r) === '^' && at(c, r - 1) === ',');
const roadHalf = (c: number, r: number) => (narrow(c, r) ? 2.75 : 4);
/** In the town: among the shophouses, south of the gate. */
const inTown = (r: number) => r <= 12;
const FIELDS = 'pfagwW';

/** The squares the way goes through, in order, for the map and for whoever drives it blind. */
const WAY: Vec2[] = [
  [19, 2], [19, 8], [10, 8], [10, 12], [19, 12], [19, 18], [12, 18], [12, 24], [19, 24], [19, 36], [15, 36], [15, 38], [22, 38], [22, 40], [19, 40],
  [19, 42], [19, 44], [17, 45], [17, 47], [20, 47], [20, 52], [23, 52], [23, 56],
];

export function hilltown(): LevelDef {
  const rand = mulberry32(53);
  const span = (a: number, b: number) => a + rand() * (b - a);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  /** The same for a square every time, whatever else has been asked for: 0 to 1. */
  const chance = (c: number, r: number, salt = 0) => {
    const t = Math.sin(c * 12.9898 + r * 78.233 + salt * 37.719) * 43758.5453;
    return t - Math.floor(t);
  };
  const patches: Patch[] = [];
  const props: PropDesc[] = [];
  const objects: ObjectDesc[] = [];
  const decals: DecalDesc[] = [];
  const crowds: CrowdDesc[] = [];
  const bogs: [number, number, number, number][] = [];
  let seed = 1;

  // ---------------------------------------------------------------- the ground, square by square
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const kind = at(c, r);
      const x0 = xOf(c) - HALF;
      const x1 = xOf(c) + HALF;
      const z0 = zOf(r) - HALF;
      const z1 = zOf(r) + HALF;
      const h = highAt(c, r);
      const level = (drop: number, color: number, wall: number) => patches.push({ x0, z0, x1, z1, h: [h - drop, h - drop, h - drop, h - drop], color, wall });
      // One field is one colour, whatever squares it is made of: fields run about six squares by five.
      const shade = chance(Math.floor(c / 6), Math.floor(r / 5)) < 0.5;
      if (FIELDS.includes(kind)) {
        if (kind === 'p') level(0.9, shade ? 0x6f9f78 : 0x67987a, BUND);
        else if (kind === 'f') level(0.6, shade ? 0x8a7350 : 0x94805a, BUND);
        else if (kind === 'a') level(0.6, 0x74824a, BUND);
        else if (kind === 'g') level(0.4, 0x8f8566, BUND);
        else level(1.7, WATER, STONE);
        bogs.push([x0, z0, x1, z1]);
      } else if (kind === '#') level(-12, GRASS, ROCK);
      else if (kind === 'b') level(0, 0x5a7a45, BUND);
      else if (kind === 'e') level(0, GRASS, STONE);
      else if (kind === 'o' || kind === 'k') level(0, inTown(r) ? PAVEMENT : 0x9a958b, STONE);
      else if (kind === 'h') level(0, 0x8f8064, BUND);
      else if (kind === 'd') level(0, 0x666c74, STONE);
      else if (kind === 'q' || kind === 'r') level(0, 0xc2bba8, STONE);
      else if ('tTBG'.includes(kind)) level(0, 0xb8b0a0, STONE);
      else if ('sS'.includes(kind)) level(0, r <= 45 ? 0xc9c2ae : EARTH, STONE);
      else {
        // A road. Level, or climbing; and with a verge down each side of it unless it is a corner or a crossing.
        const surface = narrow(c, r) ? (r >= 36 ? EARTH : FARM_ROAD) : ASPHALT;
        const top = kind === '^' ? band(r + 1) : h;
        // Heights at (x0, z0), (x1, z0), (x0, z1), (x1, z1).
        const corners: Patch['h'] = [h, h, top, top];
        const alongZ = joins(at(c, r - 1)) || joins(at(c, r + 1));
        const alongX = joins(at(c - 1, r)) || joins(at(c + 1, r));
        const verge = inTown(r) || kind === 'm' ? PAVEMENT : GRASS;
        if (alongZ === alongX) patches.push({ x0, z0, x1, z1, h: corners, color: surface, wall: STONE });
        else {
          const edge = (HALF - roadHalf(c, r)) / CELL;
          for (const [a0, a1, color] of [[0, edge, verge], [edge, 1 - edge, surface], [1 - edge, 1, verge]]) {
            if (alongZ) patches.push({ x0: x0 + CELL * a0, z0, x1: x0 + CELL * a1, z1, h: corners, color, wall: STONE });
            else patches.push({ x0, z0: z0 + CELL * a0, x1, z1: z0 + CELL * a1, h: corners, color, wall: STONE });
          }
        }
      }
    }
  }
  const terrain = makeStepped(patches, -3);
  const ground = (x: number, z: number) => heightAt(terrain, x, z);
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, lift = 0) => objects.push({ kind, pos: [x, ground(x, z) + lift, z], rotY });

  // ---------------------------------------------------------------- buildings
  /** The sides of a square that a road runs along: 0 to 3 for the side toward -X, +X, -Z, +Z. */
  const fronts = (c: number, r: number) => [at(c + 1, r), at(c - 1, r), at(c, r - 1), at(c, r + 1)].map((kind, side) => (isRoad(kind) ? side : -1)).filter((side) => side >= 0);
  const OUT: Vec2[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const building = (style: BuildingLook['style'], cx: number, cz: number, hx: number, hz: number, base: number, tall: number, open: BuildingLook['open'], color: number) =>
    props.push({ shape: 'box', size: [hx, tall / 2, hz], pos: [cx, base + tall / 2, cz], color, fade: true, mapColor: ON_MAP.building, building: { style, open, crown: 0, seed: seed++ * 7919 } });
  /** A brick house under a tiled roof, the ridge along its longer side; its door on the side given. */
  const brickHouse = (x0: number, z0: number, x1: number, z1: number, base: number, tall: number, door: number, roof = TILE) => {
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const hx = (x1 - x0) / 2;
    const hz = (z1 - z0) / 2;
    props.push({ shape: 'box', size: [hx, tall / 2, hz], pos: [cx, base + tall / 2, cz], color: pick(BRICK), fade: true, mapColor: ON_MAP.house });
    const pitch = 0.42;
    if (hx >= hz) {
      const slope = hz / Math.cos(pitch) / 2 + 0.3;
      for (const side of [-1, 1]) props.push({ shape: 'box', size: [hx + 0.4, 0.14, slope], pos: [cx, base + tall + (hz * Math.tan(pitch)) / 2, cz + (side * hz) / 2], rot: [side * pitch, 0, 0], color: roof, ghost: true });
    } else {
      const slope = hx / Math.cos(pitch) / 2 + 0.3;
      for (const side of [-1, 1]) props.push({ shape: 'box', size: [slope, 0.14, hz + 0.4], pos: [cx + (side * hx) / 2, base + tall + (hx * Math.tan(pitch)) / 2, cz], rot: [0, 0, -side * pitch], color: roof, ghost: true });
    }
    const along = door < 2 ? hz : hx;
    for (const [off, half, up, mid] of [[0, 0.6, 1.1, 1.1], [-along * 0.55, 0.5, 0.5, 1.6], [along * 0.55, 0.5, 0.5, 1.6]]) {
      const out = (door % 2 ? 1 : -1) * ((door < 2 ? hx : hz) + 0.03);
      props.push({ shape: 'box', size: door < 2 ? [0.03, up, half] : [half, up, 0.03], pos: door < 2 ? [cx + out, base + mid, cz + off] : [cx + off, base + mid, cz + out], color: off === 0 ? 0x5a3a2a : 0x2e2a28, ghost: true });
    }
  };
  /** A length of brick wall, along X or along Z. */
  const brickWall = (x0: number, z0: number, x1: number, z1: number, base: number, tall = 2.4) => {
    const alongX = z0 === z1;
    const length = Math.abs(alongX ? x1 - x0 : z1 - z0);
    props.push({ shape: 'box', size: alongX ? [length / 2, tall / 2, 0.25] : [0.25, tall / 2, length / 2], pos: [(x0 + x1) / 2, base + tall / 2, (z0 + z1) / 2], color: 0x9c4a36, mapColor: ON_MAP.wall });
    props.push({ shape: 'box', size: alongX ? [length / 2 + 0.05, 0.08, 0.34] : [0.34, 0.08, length / 2 + 0.05], pos: [(x0 + x1) / 2, base + tall + 0.08, (z0 + z1) / 2], color: 0xc9c2ae, ghost: true });
  };
  const SCOOTERS: ObjectKindId[] = ['scooterRed', 'scooterBlue', 'scooterWhite', 'scooterBlack', 'scooterYellow', 'scooterTeal'];
  const STALLS: ObjectKindId[] = ['stallRed', 'stallBlue', 'stallYellow', 'stallGreen', 'fishStall', 'flowerStall', 'fruitOrange', 'fruitMelon', 'fruitMango', 'snackCartRed', 'snackCartYellow'];
  /** What a country household keeps by its door. */
  const DOORSTEP: ObjectKindId[] = ['vat', 'pot', 'pot', 'chickenCage', 'clothesRack', 'bench', 'scooterBlue', 'scooterRed', 'stool'];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const kind = at(c, r);
      const cx = xOf(c);
      const cz = zOf(r);
      const h = highAt(c, r);
      const sides = fronts(c, r);
      const open: BuildingLook['open'] = [false, false, false, false];
      for (const side of sides) open[side] = true;
      if (kind === 'o') {
        if (sides.length !== 1) building('old', cx, cz, HALF, HALF, h, pick([7.2, 10.4]), open, pick(SHOPFRONTS));
        else {
          // Two to a square, side by side, their fronts on the road. In the town, shops, three and four floors; out of it, houses of two and three.
          const alongZ = sides[0] < 2;
          for (const off of [-3, 3]) building('old', alongZ ? cx : cx + off, alongZ ? cz + off : cz, alongZ ? HALF : 3, alongZ ? 3 : HALF, h, pick(inTown(r) ? [7.2, 10.4, 10.4, 13.6] : [7.2, 7.2, 10.4]), open, pick(SHOPFRONTS));
        }
      } else if (kind === 'k') {
        // A shed of sheet metal: a workshop, a store, a sty.
        building('shed', cx, cz, HALF - 0.6, HALF - 0.6, h, span(4.6, 6.4), open, pick(SHEDS));
      } else if (kind === 'h') {
        // A brick house, turned to face the road if there is one beside it, standing back from it behind a wall with a gap for a gate.
        const door = sides.length ? sides[0] : pick([0, 1, 2, 3]);
        const [nx, nz] = OUT[door];
        brickHouse(cx - (nx ? 4 : 4.6) - nx * 1.2, cz - (nz ? 4 : 4.6) - nz * 1.2, cx + (nx ? 4 : 4.6) - nx * 1.2, cz + (nz ? 4 : 4.6) - nz * 1.2, h, span(3.4, 4.6), door);
        for (const side of sides) {
          const [sx, sz] = OUT[side];
          for (const part of [-1, 1]) {
            const from = part * 1.8;
            const to = part * HALF;
            if (sx) brickWall(cx + sx * (HALF - 0.25), cz + Math.min(from, to), cx + sx * (HALF - 0.25), cz + Math.max(from, to), h, 1.3);
            else brickWall(cx + Math.min(from, to), cz + sz * (HALF - 0.25), cx + Math.max(from, to), cz + sz * (HALF - 0.25), h, 1.3);
          }
          // And by the gate, inside the wall, whatever this household keeps there.
          object(pick(DOORSTEP), cx + sx * 3.4 + (sx ? 0 : 3.2), cz + sz * 3.4 + (sz ? 0 : 3.2), span(0, 6));
        }
      } else if (kind === 'b') {
        // Bamboo, in clumps too close together to pass between.
        for (const ox of [-4, 0, 4]) {
          for (const oz of [-4, 0, 4]) {
            const x = cx + ox + span(-0.5, 0.5);
            const z = cz + oz + span(-0.5, 0.5);
            const tall = span(2.6, 3.6);
            props.push({ shape: 'cylinder', size: [0.9, tall, 0], pos: [x, h + tall, z], color: rand() < 0.5 ? 0x6f9a4a : 0x618a42, mapColor: 0x4a6e3a });
            props.push({ shape: 'cone', size: [1.9, 1.3, 0], pos: [x, h + tall * 2 + 0.9, z], color: 0x7fa850, ghost: true });
          }
        }
      } else if (kind === 'a') {
        // Betel palms in rows, down in their field.
        for (const ox of [-3, 3]) {
          for (const oz of [-3, 3]) {
            props.push({ shape: 'cylinder', size: [0.13, 2.9, 0], pos: [cx + ox, h - 0.6 + 2.9, cz + oz], color: 0x9a8a6a });
            props.push({ shape: 'cone', size: [1.2, 0.55, 0], pos: [cx + ox, h - 0.6 + 6, cz + oz], color: 0x4f8a4a, ghost: true });
          }
        }
      } else if (kind === 'g') {
        // Greenhouses: two tunnels of white sheeting to a square.
        for (const ox of [-3, 3]) props.push({ shape: 'cylinder', size: [2.4, 5.6, 0], pos: [cx + ox, h - 0.4, cz], rot: [Math.PI / 2, 0, 0], color: 0xe6eaea, mapColor: 0xc8cccc });
      } else if (kind === 'e') {
        // An open lot: grass, a tree or two, and whatever has been left on it.
        object(chance(c, r) < 0.5 ? 'tree' : 'treeSmall', cx + span(-3, 3), cz + span(-3, 3));
        if (chance(c, r, 1) < 0.5) object('treeSmall', cx + span(-4, 4), cz + span(-4, 4));
        if (chance(c, r, 2) < 0.35) object(pick<ObjectKindId>(['bench', 'pallet', 'barrel', 'farmTruck']), cx + span(-3, 3), cz + span(-3, 3), span(0, 6));
      } else if (kind === 'q') {
        // A square where there is a market: stalls in a row across it, and people.
        for (const ox of [-3.2, 3.2]) object(pick(STALLS), cx + ox, cz + (chance(c, r) < 0.5 ? -2 : 2), chance(c, r, 1) < 0.5 ? 0 : Math.PI / 2);
        if (chance(c, r, 3) < 0.6) object(pick<ObjectKindId>(['crateOrange', 'crateGreen', 'crateRed', 'barrel', 'umbrella']), cx + span(-4, 4), cz + span(-4, 4));
      } else if (kind === 'r') {
        // A drying ground: grain spread out on the concrete, sacks of it at the edge, racks of greens.
        decals.push({ pos: [cx, cz], size: [8.4, 8.4], color: 0xd9bf78, y: h + 0.03 });
        for (const [ox, oz] of [[-4.6, -4.4], [-3.7, -4.7], [4.5, 4.2]]) object('riceSack', cx + ox, cz + oz, span(0, 3));
        object('dryingRack', cx + 4.8, cz - 2, Math.PI / 2);
      } else if (isRoad(kind) && kind !== '^') {
        const alongZ = joins(at(c, r - 1)) || joins(at(c, r + 1));
        const alongX = joins(at(c - 1, r)) || joins(at(c + 1, r));
        const edge = roadHalf(c, r);
        /** A place on this square's verge: on the side given, and so far along the road from its middle. */
        const verge = (side: number, along: number, out = 1.1): [number, number] => (alongZ ? [cx + side * (edge + out), cz + along] : [cx + along, cz + side * (edge + out)]);
        if (alongZ === alongX) {
          // A corner or a crossing: out of town, a mirror on a post to see round it by.
          if (!inTown(r) && r < 42) object('mirror', cx + 5, cz + 5, Math.atan2(-1, -1));
          continue;
        }
        const built = (side: number) => 'okh'.includes(alongZ ? at(c - side, r) : at(c, r + side));
        if (inTown(r) || kind === 'm') {
          // In the town, and wherever there is a market: a pavement down each side.
          for (const side of [-1, 1]) {
            const off = side * (edge + (HALF - edge) / 2);
            props.push({ shape: 'box', size: alongZ ? [(HALF - edge) / 2, KERB / 2, HALF] : [HALF, KERB / 2, (HALF - edge) / 2], pos: [alongZ ? cx + off : cx, h + KERB / 2, alongZ ? cz : cz + off], color: PAVEMENT, mapColor: 0x8b9199, mapUnder: true, paving: true });
          }
        }
        if (kind === 'm') {
          // A market, or a fair: a stall on each pavement, turned to the road, and the road full of people.
          for (const side of [-1, 1]) object(pick(STALLS), ...verge(side, side * 2, 0.2), alongZ ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : side > 0 ? Math.PI : 0, KERB);
          crowds.push({ area: [cx - HALF, cz - HALF, cx + HALF, cz + HALF], count: 3, y: h });
        } else if (inTown(r)) {
          const side = (c + r) % 2 ? 1 : -1;
          object('lamp', ...verge(side, 0, 0.7), 0, KERB);
          // Outside a shop: scooters in a row at the kerb, or what the shop has put out.
          for (const s of [-1, 1]) {
            if (!built(s)) continue;
            const what = chance(c, r, s);
            if (what < 0.4) for (let i = 0; i < 4; i++) objects.push({ kind: pick(SCOOTERS), pos: alongZ ? [cx + s * (edge - 0.55), h, cz - 3.5 + i * 0.85] : [cx - 3.5 + i * 0.85, h, cz + s * (edge - 0.55)], rotY: alongZ ? (s > 0 ? -Math.PI / 2 : Math.PI / 2) : s > 0 ? Math.PI : 0 });
            else if (what < 0.7) object(pick<ObjectKindId>(['bin', 'mailbox', 'clawPink', 'clawBlue', 'betelBooth', 'transformerBox', 'bench', 'clothesRack']), ...verge(s, span(-3, 3), 1), alongZ ? (s > 0 ? -Math.PI / 2 : Math.PI / 2) : 0, KERB);
          }
          if (chance(c, r, 5) < 0.5) crowds.push({ area: alongZ ? [cx + edge + 0.2, cz - HALF, cx + HALF - 0.2, cz + HALF] : [cx - HALF, cz + edge + 0.2, cx + HALF, cz + HALF - 0.2], count: 1, y: h + KERB });
        } else if (!narrow(c, r)) {
          // The county road: poles down one side carrying the wire, betel palms down the other, and outside each house whatever it runs to.
          if (r % 2 === 0) object('utilityPoleBare', ...verge(1, 0, 1.2));
          for (const along of [-3, 3]) if (!built(-1)) object('betelPalm', ...verge(-1, along, 1.3));
          for (const s of [-1, 1]) {
            if (!built(s)) continue;
            const what = chance(c, r, s);
            if (what < 0.3) object('farmTruck', ...verge(s, 0, 0.3), alongZ ? 0 : Math.PI / 2);
            else if (what < 0.75) for (const along of [-1, 0, 1]) object(pick(SCOOTERS), ...verge(s, along * 0.85, 0.2), alongZ ? (s > 0 ? -Math.PI / 2 : Math.PI / 2) : s > 0 ? Math.PI : 0);
            else object(pick<ObjectKindId>(['betelBooth', 'bench', 'mailbox', 'clothesRack', 'vat']), ...verge(s, 2.5, 0.8));
          }
        } else if (r >= 36 && r <= 41) {
          // A lane in the old village: something by every wall.
          for (const s of [-1, 1]) if (chance(c, r, s) < 0.7) object(pick(DOORSTEP), ...verge(s, span(-4, 4), 1.4), span(0, 6));
        } else if (r < 36) {
          // A farm road: a pole now and then, and at the edge of the field whatever belongs to the field.
          if ((c + r) % 3 === 0) object('utilityPoleBare', ...verge(1, 0, 1.6));
          const what = Math.floor(chance(c, r) * 9);
          const s = chance(c, r, 1) < 0.5 ? -1 : 1;
          if (built(s)) continue;
          if (what === 0) object('standpipe', ...verge(s, 0, 2.2));
          else if (what === 1) object('haystack', ...verge(s, 1, 1.6));
          else if (what === 2) for (const along of [-0.6, 0.5]) object('riceSack', ...verge(s, along, 1.6), span(0, 3));
          else if (what === 3) object('pigeons', ...verge(s, 0, 1.8));
          else if (what === 4) object('scarecrow', ...verge(s, 2, 2.4), span(0, 6));
          else if (what === 5) object('cart', ...verge(s, -1, 1.6), span(0, 6));
        }
        // A line down the middle of the wider roads.
        if (!narrow(c, r)) for (const off of [-3, 3]) decals.push({ pos: alongZ ? [cx, cz + off] : [cx + off, cz], size: alongZ ? [0.16, 2.6] : [2.6, 0.16], color: inTown(r) ? 0xe0c341 : 0xe8e8e8, y: h + 0.03 });
      }
    }
  }

  // ---------------------------------------------------------------- the places on the way
  // ---- the yard, and the gate out of it
  const [sx, sz] = [xOf(19), zOf(3) + HALF];
  for (const x of [-5.6, 0, 5.6]) objects.push({ kind: 'post', pos: [sx + x, 0, sz] });
  objects.push({ kind: 'gateArm', pos: [sx + 2.8, 1, sz] }, { kind: 'gateArm', pos: [sx - 2.8, 1, sz] });
  decals.push({ pos: [sx, sz], size: [11.5, 0.6], color: 0xe8e8e8, y: 0.04 });
  // ---- the gate of the town, where the shops stop
  const [gx, gz] = [xOf(19), zOf(12) + HALF];
  for (const side of [-1, 1]) props.push({ shape: 'box', size: [0.45, 3, 0.45], pos: [gx + side * 4.7, 3, gz], color: 0xb8433a, mapColor: ON_MAP.wall });
  props.push({ shape: 'box', size: [5.8, 0.35, 0.5], pos: [gx, 6.2, gz], color: 0xb8433a, ghost: true });
  props.push({ shape: 'box', size: [6.4, 0.14, 0.9], pos: [gx, 6.75, gz], color: 0x3f6f5a, ghost: true });

  // ---- the county road's bridge over the canal, down: what is left of it in the water, and the road shut either side
  props.push({ shape: 'box', size: [3.6, 0.2, 2.2], pos: [xOf(19) + 0.5, -1.2, zOf(20) - 1.5], rot: [0.5, 0.1, 0.08], color: 0x8f8f88 });
  props.push({ shape: 'box', size: [3.6, 0.2, 1.8], pos: [xOf(19) - 0.4, -1.3, zOf(20) + 2], rot: [-0.45, -0.1, -0.06], color: 0x8f8f88 });
  for (const z of [zOf(19) + 1, zOf(21) - 1]) {
    for (const x of [-2.8, 0, 2.8]) object('barrier', xOf(19) + x, z);
    object('signWarn', xOf(19) + 4.6, z);
    for (const x of [-1.4, 1.4]) object('cone', xOf(19) + x, z + (z < zOf(20) ? -1.6 : 1.6));
  }

  // ---- the temple: the hall on the far side of its court, the banyan in the court, the stage across the road
  const court = band(30);
  brickHouse(xOf(14) - 4.5, zOf(29) - 2, xOf(14) + 4.5, zOf(31) + 2, court, 5, 0, 0xb8433a);
  for (const z of [zOf(29) + 2, zOf(31) - 2]) props.push({ shape: 'cylinder', size: [0.22, 1.9, 0], pos: [xOf(14) - 6.4, court + 1.9, z], color: 0xb8433a });
  props.push({ shape: 'box', size: [1.4, 0.1, 9.5], pos: [xOf(14) - 5.6, court + 3.9, zOf(30)], color: 0x3f6f5a, ghost: true });
  props.push({ shape: 'cylinder', size: [1.7, 2.8, 0], pos: [xOf(17), court + 2.8, zOf(30)], color: 0x5a4630, mapColor: 0x3f5a38 });
  for (const [dx, dz, half, up] of [[0, 0, 8, 9], [-3.5, 2.5, 5, 10.8], [4, -3, 4.5, 10.6]]) props.push({ shape: 'box', size: [half, 1.2, half], pos: [xOf(17) + dx, court + up, zOf(30) + dz], color: 0x3f7a45, ghost: true, fade: true });
  props.push({ shape: 'box', size: [4.5, 0.6, 9], pos: [xOf(20) - 1, court + 0.6, zOf(30) + HALF], color: 0x8a6a44, mapColor: ON_MAP.wall });
  props.push({ shape: 'box', size: [4.9, 0.12, 9.4], pos: [xOf(20) - 1, court + 4.8, zOf(30) + HALF], color: 0xb8433a, ghost: true });
  for (const [dx, dz] of [[-4.2, -8.4], [-4.2, 8.4], [4.2, -8.4], [4.2, 8.4]]) props.push({ shape: 'cylinder', size: [0.16, 1.8, 0], pos: [xOf(20) - 1 + dx, court + 3, zOf(30) + HALF + dz], color: 0xb8433a, ghost: true });
  // The fair: tables laid in the court, a string of firecrackers either end, the offerings before the hall.
  for (const [c, r] of [[15.6, 29.2], [16.2, 31], [18, 29.4], [18, 30.8]]) {
    object('banquetTable', xOf(c), zOf(r));
    for (const [dx, dz] of [[1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3]]) object('stool', xOf(c) + dx, zOf(r) + dz);
  }
  object('offerings', xOf(14) - 7.4, zOf(30), Math.PI / 2);
  for (const r of [28.6, 31.4]) object('firecrackers', xOf(18) - 4.5, zOf(r));
  crowds.push({ area: [xOf(18) - HALF, zOf(29) - HALF, xOf(15) + HALF, zOf(31) + HALF], count: 10, y: court });

  // ---- the gate in the old village: two piers and a beam, and room between them for a lorry and little more
  const lane = band(39);
  for (const side of [-1, 1]) props.push({ shape: 'box', size: [0.9, 2, 0.6], pos: [xOf(22) + side * 3.35, lane + 2, zOf(39)], color: 0x9c4a36, mapColor: ON_MAP.wall });
  props.push({ shape: 'box', size: [4.4, 0.3, 0.7], pos: [xOf(22), lane + 4.3, zOf(39)], color: 0x9c4a36, ghost: true });
  props.push({ shape: 'box', size: [4.4, 0.12, 1.1], pos: [xOf(22), lane + 4.75, zOf(39)], color: TILE, ghost: true });

  // ---- the big house: a wall right round, a gate at the front standing open and one at the back shut; two wings, the hall, and what is built on at its ends
  const yard = band(44);
  const [bx0, bx1] = [xOf(22) - HALF, xOf(16) + HALF];
  const [bz0, bz1] = [zOf(42) - HALF, zOf(48) + HALF];
  const frontGate = xOf(19);
  const backGate = xOf(20);
  brickWall(bx0, bz0, frontGate - 4, bz0, yard, 2.8);
  brickWall(frontGate + 4, bz0, bx1, bz0, yard, 2.8);
  brickWall(bx0, bz0, bx0, bz1, yard, 2.8);
  brickWall(bx1, bz0, bx1, bz1, yard, 2.8);
  brickWall(bx0, bz1, backGate - 3.2, bz1, yard, 2.8);
  brickWall(backGate + 3.2, bz1, bx1, bz1, yard, 2.8);
  for (const [x, z] of [[frontGate - 4.4, bz0], [frontGate + 4.4, bz0], [backGate - 3.6, bz1], [backGate + 3.6, bz1]]) props.push({ shape: 'box', size: [0.5, 1.9, 0.5], pos: [x, yard + 1.9, z], color: 0x9c4a36, mapColor: ON_MAP.wall });
  props.push({ shape: 'box', size: [5.4, 0.14, 1.1], pos: [frontGate, yard + 4.1, bz0], color: TILE, ghost: true });
  props.push({ shape: 'box', size: [4.6, 0.14, 1.1], pos: [backGate, yard + 4.1, bz1], color: TILE, ghost: true });
  objects.push({ kind: 'woodGate', pos: [backGate - 1.5, yard, bz1] }, { kind: 'woodGate', pos: [backGate + 1.5, yard, bz1] });
  brickHouse(xOf(16) - 4, zOf(43) - 5, xOf(16) + 5, zOf(45) + 5, yard, 4, 0);
  brickHouse(xOf(22) - 5, zOf(43) - 5, xOf(22) + 4, zOf(45) + 5, yard, 4, 1);
  brickHouse(xOf(21) - HALF, zOf(46) - 5, xOf(18) + HALF, zOf(46) + 5, yard, 5.2, 2, 0xa8553a);
  brickHouse(xOf(22) - 5, zOf(46) - 4.5, xOf(22) + HALF, zOf(46) + 4.5, yard, 3.6, 2);
  brickHouse(xOf(16) - 4.5, zOf(46) - 4, xOf(16) + 5, zOf(46) + 4, yard, 3.4, 2);
  brickHouse(xOf(22) - 5, zOf(48) - 4, xOf(22) + 4, zOf(48) + 4.5, yard, 2.6, 1);
  props.push({ shape: 'cylinder', size: [1.1, 0.5, 0], pos: [xOf(18.6), yard + 0.5, zOf(47.4)], color: 0xa8a294, mapColor: ON_MAP.wall });
  // On the threshing floor: grain spread to dry, racks along one wing, sacks along the other, the tractor in the corner.
  decals.push({ pos: [xOf(19), zOf(44)], size: [22, 16], color: 0xd9bf78, y: yard + 0.03 });
  for (const r of [43, 44, 45]) object('dryingRack', xOf(17) + 3, zOf(r), Math.PI / 2);
  for (const [c, r] of [[21.2, 43], [21.3, 43.6], [21.2, 44.6], [21.3, 45.3]]) object('riceSack', xOf(c), zOf(r), span(0, 3));
  object('tractor', xOf(20.6), zOf(42.6), 0.4);
  object('gasCylinder', xOf(21.6), zOf(47));
  for (const [c, r] of [[17.4, 48], [18.2, 48.1], [19, 47.9]]) object('chickenCage', xOf(c), zOf(r), span(0, 3));
  object('vat', xOf(18), zOf(47));

  // ---- for now, the end: a yard beyond the dike
  const finish: Vec2 = [xOf(23), zOf(56.5)];
  decals.push({ pos: finish, size: [7, 13], color: 0x3fbf6a, y: band(56) + 0.05 });
  for (const side of [-1, 1]) object('flagTeal', finish[0] + side * 5, finish[1]);

  return {
    id: 'hilltown',
    name: '第 2 關　山城快遞',
    brief: '從山腳的小鎮出發，穿過鄉間，把貨物送上山',
    ground: { center: [0, zOf(ROWS / 2)], half: [(COLS * CELL) / 2, (ROWS * CELL) / 2], style: 'earth' },
    terrain,
    bogs,
    bounds: [[xOf(COLS - 2) - HALF, -HALF], [xOf(1) + HALF, zOf(ROWS - 1) + HALF]],
    spawn: [xOf(19), 0.9, zOf(2)],
    startLine: { pos: [sx, sz], dir: [0, 1] },
    heading: 0,
    props,
    objects,
    crowds,
    route: WAY.map(([c, r]): Vec2 => [xOf(c), zOf(r)]),
    decals,
    cargo: cityLoad(),
    traffic: [],
    finish: { pos: finish, half: [3.4, 6.4] },
    stars: [0, 0.6],
    par: 270,
  };
}
