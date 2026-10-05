import type { ObjectDesc, ObjectKindId } from './objects';
import { plots, seat } from './plots';
import { Relief, type Look, type RibbonPoint } from './relief';
import { standardLoad } from './sandbox';
import { heightAt } from './terrain';
import type { LevelDef, PropDesc, Vec2 } from './types';

// One of each kind of ground with height in it, in a row, built with Relief: to see what it
// can do, and to try each under the truck.
//
//   z  -20 -  95   an embankment: the road raised on sloping grass banks, over a crest
//   z   95 - 165   a cutting: the road sunk through a plateau between faces of rock
//   z  165 - 330   a hillside: three hairpins up a slope, the road wider at each, cut into
//                  the hill above it and built out below
//   z  330 - 385   a gorge with sloping rock sides, and a bridge over it
//   z  385 - 430   a stepped street going down between terraces held by upright walls
//   z  430 - 520   a quay: the road beside water, with an upright wall down to it
//   z  520 - 680   a street up a hillside and round a bend, with pavements, built up on both
//                  sides as closely as a street in the city, and as much standing along it

const GRASS: Look = { tag: 'grass', color: 0x7f9450, wall: 0x8b8880 };
const ROAD: Look = { tag: 'road', color: 0x5b626b, wall: 0xa8a59c };
const BANK: Look = { tag: 'bank', color: 0x74884a, wall: 0x7d6c50 };
const ROCK: Look = { tag: 'rock', color: 0x8b8880, wall: 0x7c7a74 };
const PAVED: Look = { tag: 'paved', color: 0x9aa0a8, wall: 0xa8a59c };
const STEPS: Look = { tag: 'road', color: 0x8f8a82, wall: 0x77736c };
const WATER: Look = { tag: 'water', color: 0x4f8fa8, wall: 0x3f7f98 };
const DECK: Look = { tag: 'deck', color: 0x9a7448, wall: 0x6e5236 };

const TOP = 27;

/** The land as it was before anyone built on it. */
function land(x: number, z: number): { h: number; look: Look } {
  // A plateau across the way, for the cutting: its ends are cliffs.
  if (z > 105 && z < 160 && Math.abs(x) < 44) return { h: 7, look: GRASS };
  // The hillside: level, then rising steadily to the north, then level again at the top.
  let h = Math.max(0, Math.min(TOP, 0.3 * (z - 215)));
  // The gorge: its sides slope, steeply.
  if (z > 338 && z < 382) h -= 14 * Math.min(1, Math.min(z - 338, 382 - z) / 5);
  // The terraces beside the stepped street: each a storey below the last, with an upright wall between.
  if (z >= 385 && z < 430) h = Math.abs(x) > 5 ? TOP - 2 * Math.floor((z - 385) / 15) : TOP - ((z - 385) / 45) * 6;
  // Past the quay the land rises again, for the street that climbs it.
  if (z >= 430) h = TOP - 6 + Math.max(0, Math.min(9, 0.085 * (z - 540)));
  return { h, look: z >= 385 ? PAVED : h < TOP - 0.5 && z > 338 && z < 382 ? ROCK : GRASS };
}

const WAY: RibbonPoint[] = [
  // The embankment: up on to it, along, over a crest, and down to a lower level.
  { x: 0, z: -20, h: 0 }, { x: 0, z: 10, h: 0 }, { x: 0, z: 40, h: 2.5 }, { x: 0, z: 58, h: 3.4 }, { x: 0, z: 76, h: 1.2 },
  // The cutting.
  { x: 0, z: 165, h: 1.2 }, { x: 0, z: 208, h: 0.4, round: 10 },
  // The hairpins: each wider than the road, and rounded.
  { x: 34, z: 236, h: 6.3, round: 12, width: 14 }, { x: -34, z: 270, h: 16.5, round: 12, width: 14 }, { x: 30, z: 298, h: 24.9, round: 12, width: 14 },
  { x: 0, z: 318, h: TOP, round: 14 }, { x: 0, z: 341, h: TOP },
];
const AFTER: RibbonPoint[] = [{ x: 0, z: 379, h: TOP }, { x: 0, z: 385, h: TOP }];
const DOWN: RibbonPoint[] = [{ x: 0, z: 385, h: TOP }, { x: 0, z: 430, h: TOP - 6 }];
const QUAY: RibbonPoint[] = [{ x: 0, z: 430, h: TOP - 6 }, { x: 0, z: 520, h: TOP - 6 }];
const STREET: RibbonPoint[] = [{ x: 0, z: 520, h: TOP - 6 }, { x: 0, z: 540, h: TOP - 6 }, { x: 26, z: 590, h: TOP - 1.75, round: 30 }, { x: 26, z: 646, h: TOP + 3, round: 30 }, { x: 26, z: 676, h: TOP + 3 }];

/** The middle of the road all the way, as it was built: for the map, and for whoever drives it blind. */
let middle: Vec2[] = [];
/** The outer edges of the street's pavements: where its houses front. */
let fronts: { left: number[][]; right: number[][] } = { left: [], right: [] };

export function buildReliefShow() {
  const relief = new Relief([-96, -30], [108, 690], 6, land);
  // The road, and a bank from each edge of it out to the land: grass where the road is raised, rock where it is cut in.
  const road = relief.ribbon(WAY, 9, ROAD);
  const gentle = (edge: typeof road.left, side: 'left' | 'right', from: number, to: number) => relief.slope(edge.filter((p) => p[1] >= from && p[1] <= to), side, { grade: 0.55 }, BANK);
  const steep = (edge: typeof road.left, side: 'left' | 'right', from: number, to: number) => relief.slope(edge.filter((p) => p[1] >= from && p[1] <= to), side, { grade: 1.7 }, ROCK);
  gentle(road.left, 'left', -20, 100);
  gentle(road.right, 'right', -20, 100);
  steep(road.left, 'left', 100, 166);
  steep(road.right, 'right', 100, 166);
  relief.slope(road.left.filter((p) => p[1] >= 200 && p[1] <= 320), 'left', { grade: 1.3 }, ROCK);
  relief.slope(road.right.filter((p) => p[1] >= 200 && p[1] <= 320), 'right', { grade: 1.3 }, ROCK);
  // Past the bridge: the road on, the stepped street down, and the road along the quay.
  const after = relief.ribbon(AFTER, 9, ROAD);
  const down = relief.ribbon(DOWN, 9, STEPS, { tread: 1.5 });
  const quay = relief.ribbon(QUAY, 9, ROAD);
  const street = relief.ribbon(STREET, 8, ROAD, { verge: { width: 3.5, look: PAVED } });
  fronts = { left: street.left.filter((p) => p[1] > 530), right: street.right.filter((p) => p[1] > 530) };
  // The terraces beside the stepped street, each exactly where its wall is.
  for (let n = 0; n < 3; n++) {
    relief.area([[4.5, 385 + n * 15], [108, 385 + n * 15], [108, 400 + n * 15], [4.5, 400 + n * 15]], TOP - 2 * n, PAVED);
    relief.area([[-96, 385 + n * 15], [-4.5, 385 + n * 15], [-4.5, 400 + n * 15], [-96, 400 + n * 15]], TOP - 2 * n, PAVED);
  }
  middle = [road, after, down, quay, street].flatMap((r) => r.middle.filter((_, n) => n % 2 === 0 || n === r.middle.length - 1).map(([x, z]): Vec2 => [x, z]))
    // One ends where the next begins: once is enough.
    .filter((p, n, all) => !n || Math.hypot(p[0] - all[n - 1][0], p[1] - all[n - 1][1]) > 0.5);
  relief.area([[-34, 446], [-8, 446], [-8, 516], [-34, 516]], TOP - 9, WATER);
  relief.deck([{ x: 0, z: 340, h: TOP }, { x: 0, z: 380, h: TOP }], 7, 0.6, DECK);
  return relief.build();
}

export function reliefShow(): LevelDef {
  const { terrain } = buildReliefShow();
  const ground = (x: number, z: number) => heightAt(terrain, x, z);
  const props: PropDesc[] = [];
  const objects: ObjectDesc[] = [];
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0) => objects.push({ kind, pos: [x, ground(x, z), z], rotY });
  // Something to hit at each place, and posts along the bridge and the quay.
  for (const [x, z] of [[2, 50], [-2, 130], [0, 322], [2, 500]]) object('crateOrange', x, z);
  for (const z of [342, 352, 362, 372, 378]) for (const side of [-1, 1]) object('post', side * 3.1, z);
  for (let z = 450; z < 516; z += 6) object('post', -5.2, z);
  // Houses on the terraces beside the stepped street.
  for (let n = 0; n < 3; n++) {
    for (const side of [-1, 1]) {
      const base = TOP - 2 * n;
      props.push(...seat(terrain, { shape: 'box', size: [5, 3.6, 5.5], pos: [side * 11.5, base + 3.6, 392.5 + n * 15], color: [0xd8c9a8, 0xc9b28a, 0xb9a48c][n], fade: true, building: { style: 'old', open: [side > 0, side < 0, false, false], crown: 0, seed: 77 + n * 13 + side } }));
    }
  }
  // The street on the hill: shophouses wall to wall along both pavements, an alley now and then,
  // each on its own footing; and along the pavements what stands on a street in the city.
  const WALLS = [0xd8c9a8, 0xc9b28a, 0xb9a48c, 0xd4c4a8, 0xbf8f6f, 0xcfd3d6, 0xd9b99a];
  const STANDING: ObjectKindId[] = ['lamp', 'table', 'chair', 'hydrant', 'flowerStall', 'bin', 'stool', 'fishStall', 'gasCylinder', 'bench', 'clothesRack', 'mailbox', 'chickenCage', 'box', 'betelBooth', 'signBlue'];
  for (const side of ['left', 'right'] as const) {
    const edge = fronts[side];
    for (const plot of plots(edge, side, { width: (n) => 5.5 + ((n * 7) % 3), depth: 9, skip: (n) => n % 6 === (side === 'left' ? 4 : 1) })) {
      const tall = 3.4 + ((plot.n * 5 + (side === 'left' ? 0 : 2)) % 3) * 1.6;
      props.push(...seat(terrain, { shape: 'box', size: [plot.width / 2, tall, plot.depth / 2], pos: [plot.x, 0, plot.z], rot: [0, plot.yaw, 0], color: WALLS[(plot.n * 3 + (side === 'left' ? 0 : 4)) % WALLS.length], fade: true, building: { style: 'old', open: plot.open, crown: 0, seed: 400 + plot.n * 31 + (side === 'left' ? 0 : 17) } }));
    }
    // Along the pavement, between the kerb and the doors.
    for (const [n, spot] of plots(edge, side, { width: 3.2, depth: 0 }).entries()) {
      const inward = side === 'left' ? 1 : -1;
      const off = 1.1 + (n % 3) * 0.7;
      // Toward the road from the building line: square to the frontage.
      const x = spot.x + Math.sin(spot.yaw) * inward * off;
      const z = spot.z + Math.cos(spot.yaw) * inward * off;
      object(STANDING[(n * 5 + (side === 'left' ? 0 : 7)) % STANDING.length], x, z, spot.yaw);
    }
  }

  return {
    id: 'relief',
    name: '地形樣品集',
    brief: '路堤、路塹、髮夾彎、峽谷和橋、階梯街、碼頭、坡上的街：一樣一樣試',
    ground: { center: [6, 330], half: [102, 360], style: 'earth' },
    terrain,
    sinks: ['water'],
    bounds: [[-96, -30], [108, 690]],
    spawn: [0, 0.9, -14],
    heading: 0,
    props,
    objects,
    route: middle,
    decals: [],
    cargo: standardLoad(),
    traffic: [],
    stars: [0.6, 0.8],
    par: 240,
  };
}
