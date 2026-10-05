import type { ObjectDesc, ObjectKindId } from './objects';
import { mulberry32, standardLoad } from './sandbox';
import { heightAt, makeStepped, type Patch } from './terrain';
import type { BuildingLook, DecalDesc, LevelDef, PropDesc, Vec2 } from './types';

// A sample of what a level drawn on squares looks like when the squares are at different
// heights: a street that climbs from one terrace of houses to the next up smooth ramps, with
// a retaining wall where one terrace ends and the next begins; then a road along the hill,
// with rock going up on one hand and a drop on the other. Nothing here is a staircase: the
// only upright faces are walls and cliffs.

const KERB = 0.15;
const ASPHALT = 0x5b626b;
const PAVED = 0x9aa0a8;
const GRASS = 0x7f9450;
const STONE = 0xa8a59c;
const ROCK = 0x8b8880;

const flat = (x0: number, z0: number, x1: number, z1: number, h: number, color: number, wall = STONE): Patch => ({ x0, z0, x1, z1, h: [h, h, h, h], color, wall });
/** A ramp that climbs as it goes north. */
const ramp = (x0: number, z0: number, x1: number, z1: number, from: number, to: number, color: number, wall = STONE): Patch => ({ x0, z0, x1, z1, h: [from, from, to, to], color, wall });

/** The ground, piece by piece. */
const PATCHES: Patch[] = [
  // The street: level, up a ramp, level, up another.
  flat(-8, -24, 8, 32, 0, ASPHALT),
  ramp(-8, 32, 8, 48, 0, 4, ASPHALT),
  flat(-8, 48, 8, 80, 4, ASPHALT),
  ramp(-8, 80, 8, 96, 4, 8, ASPHALT),
  // The terraces the houses stand on, either side of it: each a storey above the last.
  ...[-1, 1].flatMap((side) => {
    const [x0, x1] = side < 0 ? [-56, -8] : [8, 26];
    return [flat(x0, -24, x1, 40, 0, PAVED), flat(x0, 40, x1, 88, 4, PAVED), flat(x0, 88, x1, 96, 8, PAVED)];
  }),
  // East of the houses, under the hill road: a long way down.
  flat(26, -24, 96, 96, 0, GRASS),
  // The hill road, level, along the foot of the mountain.
  flat(-56, 96, 96, 112, 8, ASPHALT, ROCK),
  // The mountain; and the last ramp, cut through it.
  flat(-56, 112, 56, 160, 20, GRASS, ROCK),
  flat(72, 112, 96, 160, 20, GRASS, ROCK),
  ramp(56, 112, 72, 144, 8, 12, ASPHALT, ROCK),
  flat(56, 144, 72, 160, 12, ASPHALT, ROCK),
];

export function steps(): LevelDef {
  const rand = mulberry32(5);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
  const terrain = makeStepped(PATCHES, -1);
  const ground = (x: number, z: number) => heightAt(terrain, x, z);
  const props: PropDesc[] = [];
  const objects: ObjectDesc[] = [];
  const decals: DecalDesc[] = [];
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0) => objects.push({ kind, pos: [x, ground(x, z), z], rotY });
  let seed = 1;

  /** A row of shophouses along the street, on the terrace at this height, their fronts toward the street. */
  const row = (x0: number, x1: number, z0: number, z1: number, base: number, front: 0 | 1) => {
    for (let z = z0; z < z1 - 0.1; ) {
      const left = z1 - z;
      const width = left < 11 ? left : 5.5 + rand() * 2;
      const tall = pick([7.2, 7.2, 10.4]);
      const open: BuildingLook['open'] = [false, false, false, false];
      open[front] = true;
      props.push({ shape: 'box', size: [(x1 - x0) / 2, tall / 2, width / 2], pos: [(x0 + x1) / 2, base + tall / 2, z + width / 2], color: pick([0xc9a27e, 0xd4c4a8, 0xbf8f6f, 0xd9b99a]), fade: true, mapColor: 0x5f6670, building: { style: 'old', open, crown: 0, seed: seed++ * 7919 } });
      z += width;
    }
  };
  // Three terraces of houses, each a storey above the last; and a pavement before each.
  for (const [z0, z1, base] of [[-16, 32, 0], [48, 80, 4]]) {
    row(-20, -8, z0, z1, base, 1);
    row(8, 20, z0, z1, base, 0);
    for (const side of [-1, 1]) props.push({ shape: 'box', size: [1.25, KERB / 2, (z1 - z0) / 2], pos: [side * 6.75, base + KERB / 2, (z0 + z1) / 2], color: 0x9aa0a8, paving: true });
    for (let z = z0 + 6; z < z1; z += 12) objects.push({ kind: 'lamp', pos: [-6.6, base + KERB, z] }, { kind: 'lamp', pos: [6.6, base + KERB, z + 6] });
  }
  // Along the top of each retaining wall, and up each side of the ramps where the street stands above the terrace: a low parapet.
  for (const [z, base] of [[40, 4], [88, 8]]) {
    for (const side of [-1, 1]) props.push({ shape: 'box', size: [side < 0 ? 23.6 : 8.6, 0.45, 0.2], pos: [side < 0 ? -32 : 17, base + 0.45, z + 0.25], color: 0xc9c2ae });
  }
  for (const [z, base] of [[32, 0], [80, 4]]) {
    const pitch = Math.atan(4 / 16);
    for (const side of [-1, 1]) props.push({ shape: 'box', size: [0.2, 0.45, 4.2], pos: [side * 7.75, base + 1 + 0.45, z + 4], rot: [-pitch, 0, 0], color: 0xc9c2ae });
  }
  // Along the hill road: a rail on the side of the drop, which holds nothing back, and lamps.
  for (let x = 12; x < 54; x += 2.1) object('fence', x, 97);
  for (let x = 14; x < 54; x += 14) object('lamp', x, 110.6);
  for (let z = 6; z < 96; z += 6) if (!(z > 30 && z < 50) && !(z > 78 && z < 98)) decals.push({ pos: [0, z], size: [0.18, 3], color: 0xe0c341, y: ground(0, z) + 0.03 });
  object('barrel', 3, 20);
  object('barrel', -3, 60);
  for (const [x, z] of [[2.5, 44], [-2, 90]]) object('crateOrange', x, z);

  const route: Vec2[] = [[0, -8], [0, 104], [64, 104], [64, 150]];
  return {
    id: 'steps',
    name: '階梯地形樣品',
    brief: '用格子畫出來的坡街、駁坎和懸崖路：看樣子用',
    ground: { center: [20, 68], half: [76, 92], style: 'asphalt' },
    terrain,
    bounds: [[-40, -24], [96, 160]],
    spawn: [0, 0.9, -6],
    heading: 0,
    props,
    objects,
    route,
    decals,
    cargo: standardLoad(),
    traffic: [],
    stars: [0.6, 0.8],
    par: 120,
  };
}

