import type { ObjectDesc, ObjectKindId } from './objects';
import { BANK, COBBLE, CONCRETE, dike, GRAVEL, hash, HAUL, heapYard, loadOut, POND, RIVER, riverCrossing, SAND, type Site } from './quarryParts';
import { Relief, type Look } from './relief';
import { standardLoad } from './sandbox';
import { heightAt } from './terrain';
import type { CrowdDesc, DecalDesc, DropperDesc, FordDesc, LevelDef, MachineDesc, PropDesc, RigDesc, TrafficLane } from './types';

// A proving ground for level 3, the way from the quarry to the building site, laid out on 16 m squares as the levels are:
// solid ground everywhere, six metres up, and the roads cut down into it, so that each is as wide as it is drawn and not a
// metre wider, and nothing in it can be driven round. Five stations side by side, each running north:
//
//   A  stockpiles   (column 1)      a lane between heaps whose sides steepen, three steepnesses in turn; where it narrows, a
//                                   lorry, a slump of gravel and a parked digger make the truck put a side up on the heap
//   B  conveyors    (column 4)      a road under three conveyors dropping rocks through torn nets, through rows of columns
//   C  machines     (columns 6-8)   a dike across ponds, six machines at work beside it: rails, then sandbags, then nothing
//   D  river bed    (columns 10-12) a track between low banks, a ford, a melon field, a narrow bridge with lorries coming fast
//   E  building     (columns 17-19) a concrete frame, three storeys up by ramps: props, holes in the floor, an edge with a net

const CELL = 16;
const xOf = (c: number) => c * CELL;
const zOf = (r: number) => r * CELL;

const DECK: Look = { tag: 'deck', color: 0x5f666e, wall: 0x454b52 };

/** What each square is, by column and row: the stockpile yard ('H'), solid ground ('#'), a pond ('w'), a river ('~'), low banks ('b'), sand ('m'), a yard ('f'). */
function square(c: number, r: number): string {
  if (r < 0 || r > 19 || c < 0 || c > 20) return '#';
  if (c <= 2) return r <= 14 ? 'H' : '#';
  if (c <= 5) return '#';
  if (c <= 8) return 'w';
  if (c === 9) return '#';
  if (c <= 12) return r <= 7 ? 'b' : r <= 9 ? '~' : r <= 12 ? 'm' : r <= 17 ? '~' : 'b';
  if (c >= 17 && c <= 18 && r >= 8 && r <= 11) return 'f';
  return '#';
}

function base(x: number, z: number): { h: number; look: Look } {
  const c = Math.round(x / CELL), r = Math.round(z / CELL);
  switch (square(c, r)) {
    case 'H': return { h: 0, look: GRAVEL };
    case 'w': return { h: -0.6, look: POND };
    case '~': return { h: -1.3, look: RIVER };
    case 'b': return { h: 1.6, look: COBBLE };
    case 'm': return { h: 0, look: SAND };
    case 'f': return { h: 0, look: GRAVEL };
    default: return { h: 6, look: BANK };
  }
}

/** The stations' roads, along the middle of their columns. */
const A = xOf(1), B = xOf(4), C = xOf(7), D = xOf(11);
const TRACK_WIDE = 5.5;
const BRIDGE: [number, number] = [206, 286];
const BRIDGE_H = 2.6;
const BRIDGE_WIDE = 6.5;

/** The building, in columns 17-18, rows 8-11: its outline, floors, and the ramps up through it. */
const BX0 = xOf(17) - 8, BX1 = xOf(18) + 8, E = (BX0 + BX1) / 2;
const BZ0 = zOf(8), BZ1 = zOf(11) + 8;
const FLOORS = [0, 4.5, 9.0, 13.5];
const SLAB = 0.3;
const RAMP_Z0 = BZ0 + 15, RAMP_Z1 = BZ0 + 41;
const WEST_STRIP: [number, number] = [BX0, BX0 + 6.5];
const EAST_STRIP: [number, number] = [BX1 - 6.5, BX1];
/** The way in to it, up column 19. */
const ENTRY = xOf(19);

export function quarryLab(): LevelDef {
  const relief = new Relief([-24, -24], [344, 328], 8, base);
  const props: PropDesc[] = [];
  const decals: DecalDesc[] = [];
  const traffic: TrafficLane[] = [];
  const machines: MachineDesc[] = [];
  const rigs: RigDesc[] = [];
  const crowds: CrowdDesc[] = [];
  const droppers: DropperDesc[] = [];
  const fords: FordDesc[] = [];
  const later: (() => void)[] = [];
  const objects: ObjectDesc[] = [];
  let ground: (x: number, z: number) => number = () => 0;
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0, y?: number) => later.push(() => objects.push({ kind, pos: [x, y ?? ground(x, z), z], rotY }));
  const site: Site = { relief, props, decals, traffic, rigs, droppers, fords, crowds, object };

  // A: the stockpile yard, and the way into it.
  relief.ribbon([{ x: A, z: -20, h: 0 }, { x: A, z: -6, h: 0 }], 6.5, GRAVEL);
  heapYard(site, A, 0, 0);
  // B: the load-out.
  loadOut(site, B, 0, 0);
  // C: the dike.
  dike(site, C, 0, 0);

  // D: the river crossing; then the melon field; the bridge.
  riverCrossing(site, D, 0, 0);
  {
    // The melon field on the sand bar: melons on straw both sides of the track, some rolled into it; a shed; the growers.
    relief.ribbon([{ x: D, z: 160, h: 0 }, { x: D, z: 186, h: 0 }], TRACK_WIDE, HAUL);
    for (let z = 158; z < 184; z += 1.3) {
      for (const side of [-1, 1]) for (const off of [3.4, 4.8, 6.2]) if (hash(z, off * side) < 0.75) object('melon', D + side * (off + hash(z, off) * 0.4), z);
      if (hash(z, 9) < 0.12) object('melon', D + (hash(z, 10) - 0.5) * 3, z);
      for (const side of [-1, 1]) decals.push({ pos: [D + side * 5, z], size: [4.2, 1.2], color: 0xd2b455, y: 0.02 });
    }
    props.push({ shape: 'box', size: [2.5, 1.2, 2], pos: [D - 15, 1.2, 170], color: 0x8a7a5e }, { shape: 'box', size: [2.9, 0.08, 2.4], pos: [D - 15, 2.5, 170], color: 0x3f6f8a, ghost: true });
    object('haystack', D - 10, 162);
    object('haystack', D + 12, 180);
    crowds.push({ area: [D - 12, 158, D - 8, 182], count: 3, y: 0 });
    // The bridge: up to it, across, down again; the river under it; a kerb along each edge and nothing more.
    relief.ribbon([{ x: D, z: 186, h: 0 }, { x: D, z: BRIDGE[0], h: BRIDGE_H }], BRIDGE_WIDE, HAUL);
    relief.deck([{ x: D, z: BRIDGE[0], h: BRIDGE_H }, { x: D, z: BRIDGE[1], h: BRIDGE_H }], BRIDGE_WIDE, 0.7, DECK);
    relief.ribbon([{ x: D, z: BRIDGE[1], h: BRIDGE_H }, { x: D, z: 304, h: 0 }, { x: D, z: 318, h: 0 }], BRIDGE_WIDE, HAUL);
    for (const side of [-1, 1]) props.push({ shape: 'box', size: [0.09, 0.1, (BRIDGE[1] - BRIDGE[0]) / 2], pos: [D + side * (BRIDGE_WIDE / 2 - 0.09), BRIDGE_H + 0.1, (BRIDGE[0] + BRIDGE[1]) / 2], color: 0xd8b02a });
    for (let z = BRIDGE[0]; z <= BRIDGE[1]; z += 8) for (const side of [-1, 1]) props.push({ shape: 'box', size: [0.15, 0.6, 0.15], pos: [D + side * (BRIDGE_WIDE / 2 - 0.4), BRIDGE_H - 1.0, z], color: 0x454b52 });
    // Lorries coming the other way, fast, near the middle: off the field into a cutting of their own, round, and back.
    const RETURN = xOf(14);
    relief.ribbon([{ x: D, z: 168, h: 0 }, { x: RETURN, z: 168, h: 0, round: 7 }, { x: RETURN, z: 312, h: 0, round: 7 }, { x: D, z: 312, h: 0 }], 4.6, HAUL);
    const lane = D + 1.15;
    const loop = traffic.length;
    traffic.push(
      { from: [lane, 312], to: [lane, 168], cars: 3, speed: 15, kinds: ['dumpTruck', 'dumpTruck', 'dumpTruck'], next: loop + 1 },
      { from: [lane, 168], to: [RETURN, 168], cars: 0, speed: 10, next: loop + 2 },
      { from: [RETURN, 168], to: [RETURN, 312], cars: 0, speed: 15, next: loop + 3 },
      { from: [RETURN, 312], to: [lane, 312], cars: 0, speed: 10, next: loop },
    );
    for (const z of [BRIDGE[0] - 6, BRIDGE[1] + 6]) object('signWarn', D - 3.0, z, z > 250 ? Math.PI : 0);
  }

  // E: the building, and the cutting up to it.
  {
    relief.ribbon([{ x: ENTRY, z: -20, h: 0 }, { x: ENTRY, z: BZ0 + 6, h: 0, round: 9 }, { x: BX1 - 14, z: BZ0 + 6, h: 0 }], 7, CONCRETE);
    const CONC = 0xb5b2aa;
    const add = (p: PropDesc) => props.push({ ...p, cutaway: true });
    /** A slab over a rectangle, leaving out the holes in it, as boxes. */
    const slab = (y: number, [x0, z0, x1, z1]: [number, number, number, number], holes: [number, number, number, number][]) => {
      const xs = [...new Set([x0, x1, ...holes.flatMap(([a, , c]) => [a, c])])].filter((x) => x >= x0 && x <= x1).sort((a, b) => a - b);
      for (let n = 0; n < xs.length - 1; n++) {
        const [a, b] = [xs[n], xs[n + 1]];
        const cuts = holes.filter(([hx0, , hx1]) => hx0 <= a + 1e-6 && hx1 >= b - 1e-6).map(([, hz0, , hz1]) => [hz0, hz1]).sort((p, q) => p[0] - q[0]);
        let from = z0;
        for (const [c0, c1] of [...cuts, [z1, z1]]) {
          if (c0 - from > 0.05) add({ shape: 'box', size: [(b - a) / 2, SLAB / 2, (c0 - from) / 2], pos: [(a + b) / 2, y - SLAB / 2, (from + c0) / 2], color: CONC });
          from = Math.max(from, c1);
        }
      }
    };
    const whole: [number, number, number, number] = [BX0, BZ0, BX1, BZ1];
    const westRamp: [number, number, number, number] = [WEST_STRIP[0], RAMP_Z0, WEST_STRIP[1], RAMP_Z1];
    const eastRamp: [number, number, number, number] = [EAST_STRIP[0], RAMP_Z0, EAST_STRIP[1], RAMP_Z1];
    // Floor 1: the ramp up from the ground comes through it on the west; in its north end, where it is crossed, a shaft left open
    // by the far wall, a hole inside the corner, a hole with a steel plate over it.
    slab(FLOORS[1], whole, [westRamp, [E - 2, BZ1 - 3.5, E + 2, BZ1 - 0.5], [E - 8, RAMP_Z1 + 1.2, E - 5.5, RAMP_Z1 + 3.7]]);
    add({ shape: 'box', size: [1.5, 0.02, 1.5], pos: [E + 6, FLOORS[1] + 0.02, RAMP_Z1 + 5], color: 0x5a6068 });
    slab(FLOORS[2], whole, [eastRamp]);
    slab(FLOORS[3], whole, [westRamp]);
    const rise = FLOORS[1] - FLOORS[0];
    const angle = Math.atan2(rise, RAMP_Z1 - RAMP_Z0);
    const long = Math.hypot(rise, RAMP_Z1 - RAMP_Z0) / 2 + 0.3;
    const ramp = (x: number, floor: number, north: boolean) => {
      const y = FLOORS[floor] + rise / 2 - SLAB / 2 / Math.cos(angle);
      add({ shape: 'box', size: [3.25, SLAB / 2, long], pos: [x, y, (RAMP_Z0 + RAMP_Z1) / 2], rot: [north ? -angle : angle, 0, 0], color: 0xa8a59c });
      for (const side of [-1, 1]) add({ shape: 'box', size: [0.12, 0.35, long], pos: [x + side * 3.13, y + 0.4, (RAMP_Z0 + RAMP_Z1) / 2], rot: [north ? -angle : angle, 0, 0], color: 0xd8b02a });
    };
    ramp((WEST_STRIP[0] + WEST_STRIP[1]) / 2, 0, true);
    ramp((EAST_STRIP[0] + EAST_STRIP[1]) / 2, 1, false);
    ramp((WEST_STRIP[0] + WEST_STRIP[1]) / 2, 2, true);
    // Columns up each storey, round the edge and down the middle, clear of the ramps and the ways round.
    const columns: [number, number][] = [];
    for (let x = BX0; x <= BX1; x += 8) for (const z of [BZ0, BZ1]) columns.push([x, z]);
    for (const dz of [9, 17, 25]) columns.push([E, RAMP_Z0 + dz]);
    for (let k = 0; k < 3; k++) {
      const tall = FLOORS[k + 1] - FLOORS[k] - SLAB;
      for (const [x, z] of columns) add({ shape: 'box', size: [0.3, tall / 2, 0.3], pos: [x, FLOORS[k] + tall / 2, z], color: 0x9e9b93 });
    }
    // Walls at the ground where it is not to be driven into; low walls round the floors' edges, but along the south edge of
    // floor 2, where the way turns, only a net.
    const wall = (x0: number, z0: number, x1: number, z1: number, y: number, h: number) =>
      add({ shape: 'box', size: [Math.max(0.12, (x1 - x0) / 2), h / 2, Math.max(0.12, (z1 - z0) / 2)], pos: [(x0 + x1) / 2, y + h / 2, (z0 + z1) / 2], color: 0xa8a59c });
    const tallest = FLOORS[1] - SLAB;
    wall(BX1 - 0.1, RAMP_Z0, BX1 + 0.15, BZ1, 0, tallest);
    wall(WEST_STRIP[1], RAMP_Z0 + 0.3, BX1 - 9, RAMP_Z0 + 0.5, 0, tallest);
    wall(BX0, BZ0 - 0.25, BX1, BZ0, 0, 1.2);
    for (const f of [1, 2, 3]) {
      const y = FLOORS[f];
      wall(BX0, BZ1 - 0.2, BX1, BZ1, y, 0.9);
      wall(BX0, BZ0, BX0 + 0.2, BZ1, y, 0.9);
      wall(BX1 - 0.2, BZ0, BX1, BZ1, y, 0.9);
      if (f !== 2) wall(BX0, BZ0, BX1, BZ0 + 0.2, y, 0.9);
    }
    for (let x = BX0 + 1; x < BX1; x += 2) object('netPanel', x, BZ0 + 0.3, 0, FLOORS[2]);
    // The forest of props under floor 1's south end, where the way in runs: thick, but not so thick as to stop the truck.
    for (let x = WEST_STRIP[1] + 0.8; x < BX1 - 0.5; x += 1.6) {
      for (let z = BZ0 + 1; z < RAMP_Z0 - 0.5; z += 1.6) if (hash(x, z) < 0.55) object('shoringProp', x + (hash(z, x) - 0.5) * 0.4, z + (hash(x + 1, z) - 0.5) * 0.4, 0, 0);
    }
    for (const [x, z] of [[E - 2.4, BZ1 - 3.8], [E + 2.4, BZ1 - 3.8], [E, BZ1 - 3.9], [E - 8.3, RAMP_Z1 + 1], [E - 5.2, RAMP_Z1 + 4]] as const) object('cone', x, z, 0, FLOORS[1]);
    for (const [x, z] of [[E + 9, BZ1 - 8], [E + 3, BZ1 - 2]] as const) object('pallet', x, z, 0, FLOORS[3]);
  }

  const { terrain } = relief.build();
  ground = (x, z) => heightAt(terrain, x, z);
  for (const add of later) add();

  return {
    id: 'quarrylab',
    name: '第三關試驗場',
    brief: '料堆、輸送帶落石、堤道機具、河床便橋、施工中大樓：按數字鍵跳到各站',
    ground: { center: [160, 152], half: [184, 176], style: 'earth' },
    terrain,
    sinks: ['water'],
    // Off the open edge of floor 2: down into the yard south of the building, from which there is no way out.
    bogs: [[BX0, BZ0 - 8, BX1, BZ0 - 0.6]],
    bounds: [[-24, -24], [344, 328]],
    spawn: [A, 0.9, -12],
    heading: 0,
    props,
    objects,
    decals,
    cargo: standardLoad(),
    traffic,
    machines,
    rigs,
    droppers,
    fords,
    crowds,
    checkpoints: [
      { name: 'A 料堆', pos: [A, -12], yaw: 0 },
      { name: 'B 輸送帶落石', pos: [B, -12], yaw: 0 },
      { name: 'C 堤道機具', pos: [C, -2], yaw: 0 },
      { name: 'D 河床', pos: [D, -12], yaw: 0 },
      { name: 'D 便橋', pos: [D - 1.4, 176], yaw: 0 },
      { name: 'E 大樓', pos: [ENTRY, 96], yaw: 0 },
    ],
    finish: { pos: [E + 6, BZ1 - 8], half: [7, 6], above: FLOORS[3] - 1 },
    stars: [0, 0.6],
    par: 600,
  };
}
