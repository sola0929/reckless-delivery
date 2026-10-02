import type { Vec3 } from '../config';
import type { ObjectDesc, ObjectKindId } from './objects';
import { TRUCK } from '../config';
import type { CargoPlacement } from '../sim/cargo';
import { buildingMarks } from '../render/buildings';
import { mulberry32 } from './sandbox';
import { tilesAround, type Tile } from './ground';
import type { BuildingLook, CrowdDesc, DecalDesc, LevelDef, PitDesc, PropDesc, RiderLane, SignDesc, SignalDesc, SlickDesc, TrackDesc, TrafficLane, Vec2 } from './types';

// Level 1: a delivery run across a city, drawn as a map of characters. Each one is a 16 m
// square; north is at the top. To add a road, change the map.
//
//   # downtown block      o old-town block     w warehouse block
//   . road                b boulevard          m market lane       c roadworks
//   d depot yard          O roundabout         p park              q plaza
//   ~ river               H lifting bridge     X road closed, dug up
//   r railway             R level crossing     S start             F delivery bay
//
// The way through: out of the depot, right along the boulevard, left across it into the
// market lane, left along the river over a road that is being dug up, right over the
// half-open lifting bridge at a run, round the roundabout into the roadworks, which is one
// fenced lane doubling back on itself, north over the speed humps, right along the busy
// street with its traffic, left across it and over six railway tracks, then west through
// the old gateway, up and down the steps of a terrace, round a corner slick with oil and
// between the stacked containers to the dock.
// (The railway's rows only mark out its land: the tracks are spaced evenly across it.)
//
// There is one way through and no other. Every road that would get round a stretch of it
// stops short, and the straight road up the middle has been dug up.
const MAP = [
  'oooooooooooooooooooooooooooooooooooo',
  'oooooooooooooooooooooooooooooooooooo',
  'ooooooooooooFooooooooooooooooooooooo',
  'oooooooooooo.ooooooooooooooooooooooo',
  'oooooooooooo.ooooooooooooooooooooooo',
  'oooooooooooo.ooooooooooooooooooooooo',
  'oooooooooooo..................oooooo',
  'ooooooooooooooooooooooooooooo.oooooo',
  'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrRrrrrrr',
  'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrRrrrrrr',
  'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrRrrrrrr',
  'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrRrrrrrr',
  'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrRrrrrrr',
  'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrRrrrrrr',
  'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrRrrrrrr',
  'ooooooooooooooooooooooooooooo.oooooo',
  '....................................',
  'oooooooooooooooooooooo.ooooooooooooo',
  'oooooooooooooooooooooo.ooooooooooooo',
  'ooooooooooooooooooooOOcccccccooooooo',
  'ooooooooooooooooo...OOcccccccooooooo',
  'pppppppppppppppppppp.ppppppppppppppp',
  '~~~~~~~~~~~~~~~~~~~~H~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~H~~~~~~~~~~~~~~~',
  'pppppppppppppppppppp.ppppppppppppppp',
  '##################.............#####',
  '########################.####m######',
  '###########ppppp########.####mqqqq##',
  '###########ppppp########.####mqqqq##',
  '###########ppppp########X####mqqqq##',
  '###########ppppp########X##mmmqqqq##',
  '###########ppppp########X##m########',
  '###########ppppp########X##m########',
  '########################.##m########',
  'bbbbbbbbb.bbbbbbbbbbbbbb.bbbbbbbbbbb',
  'bbbbbbbbb.bbbbbbbbbbbbbb.bbbbbbbbbbb',
  '#########.#######.######.###########',
  'wwwwwwwww.wwwwwww.wwwwww.wwwwwwwwwww',
  'wwwwwwwww.........wwwwww.wwwwwwwwwww',
  'wwwwwwwwwwwwwwwww.wwwwww.wwwwwwwwwww',
  'wwwwwwwwwwwwwwwww.wwwwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwwww.wwwwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwdddd.dddddwwwwwwwwwwwww',
  'wwwwwwwwwwwwwdddd..ddddwwwwwwwwwwwww',
  'wwwwwwwwwwwwwddddS.ddddwwwwwwwwwwwww',
  'wwwwwwwwwwwwwdddd..ddddwwwwwwwwwwwww',
  'wwwwwwwwwwwwwddddddddddwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
];

/**
 * The line to drive, as map squares [column, row from the south]; fractions are places
 * within a square. It keeps to the right of the road and threads every obstacle, so the
 * obstacles below are laid out to match it: move one and the other must follow.
 */
const ROUTE: Vec2[] = [
  // Out of the depot.
  [17, 3], [17.22, 5], [17.22, 11.3],
  // Right onto the boulevard, along its inner lane, and left across it.
  [17.45, 11.95], [18.2, 12.22], [26.2, 12.22], [26.8, 12.5], [27, 13.2], [27, 14],
  // The market lane.
  [27, 16.4], [27.7, 17], [28.3, 17], [29, 17.6], [29, 21],
  // Left along the river, over the broken ground.
  [28.75, 22], [28.2, 22.22], [20.9, 22.22],
  // Right, and over the lifting bridge at a run.
  [20.4, 22.5], [20.22, 23.1], [20.22, 26.2],
  // Round the roundabout into the roadworks: along the south lane and over its plate,
  // round the bend, back along the north lane and over the other plate.
  [20.55, 26.72], [21.2, 26.7375], [24.6875, 26.8125], [27.125, 26.7375],
  [27.664, 26.96], [27.8875, 27.5], [27.664, 28.04], [27.125, 28.2625],
  [24.6875, 28.1875], [22.75, 28.2625],
  // Out of the roadworks northward, over the humps.
  [22.25, 28.55], [22.1, 29.05], [22.22, 29.6], [22.22, 30.2],
  // Right along the busy street, moving over to turn left across it.
  [22.45, 30.6], [23.1, 30.67], [25, 30.67], [26.5, 30.89], [28.4, 30.89], [28.95, 31.15], [29.22, 31.8],
  // North over the railway.
  [29.22, 40.3],
  // Left into the back street and through the gate; over the terrace; right round the
  // oily corner, and between the containers into the delivery bay.
  [28.85, 41], [28.2, 41.05], [27, 41], [25.8, 41.22], [13.5, 41.22], [12.5, 41.5], [12.08, 42.1], [12, 42.7], [12, 45],
];

const CELL = 16;
const HALF = CELL / 2;
const COLS = MAP[0].length;
const ROWS = MAP.length;
const LANE = 3.5;
const KERB = 0.15;

// Squares are addressed as (column, row counted from the south). Looking north from the
// start, +X is to the left, so columns run the other way from X.
const at = (c: number, r: number): string => (c < 0 || c >= COLS || r < 0 || r >= ROWS ? ' ' : MAP[ROWS - 1 - r][c]);
const xOf = (c: number): number => (COLS / 2 - 0.5 - c) * CELL;
const zOf = (r: number): number => r * CELL;

const DRIVABLE = new Set(['.', 'b', 'm', 'c', 'd', 'O', 'S', 'F', 'R', 'H']);
const BLOCKS = new Set(['#', 'o', 'w', 'p', 'q']);
const drivable = (c: number, r: number) => DRIVABLE.has(at(c, r));

const MIN_X = xOf(COLS - 1) - HALF;
const MAX_X = xOf(0) + HALF;
const MIN_Z = -HALF;
const MAX_Z = zOf(ROWS - 1) + HALF;

const PAVEMENT = 0x9aa0a8;
const DOWNTOWN = [0xa8b5c2, 0x8f9aa6, 0x7f8c9a, 0xb9c2ca, 0x9aa7b5, 0xc5c9cc];
const OLD_TOWN = [0xc9a27e, 0xd4c4a8, 0xbf8f6f, 0xd9b99a, 0xb7a58c, 0xc7b29a];
const SHEDS = [0x7d8a94, 0x8a5a44, 0x5f7f8f, 0x9a9a8c, 0x6f7a6a];
const CONTAINERS = [0xb5482f, 0x2f6f9f, 0x3f8f5f, 0xd0a030, 0x8a8f96];
const WHITE = 0xe8e8e8;
const YELLOW = 0xe0b020;
const CONCRETE = 0x70757c;

// Minimap colours.
const MAP_BLOCK = 0x8b9199;
const MAP_BUILDING = 0x5f6670;
const MAP_WATER = 0x3f7fc0;
const MAP_PARK = 0x5e9a58;
const MAP_DIRT = 0x9a7a52;
const MAP_ROAD = 0x4a5059;
const MAP_PLAZA = 0xb8b0a0;
const MAP_RAIL = 0x6a5f55;
const MAP_BARRIER = 0xe6e2d8;

/** What lines the kerb in each kind of district, picked from at random. */
const FURNITURE: Record<string, ObjectKindId[]> = {
  '#': ['tree', 'lamp', 'tree', 'bin', 'tree', 'signBlue', 'lamp', 'mailbox', 'hydrant', 'bench', 'tree'],
  o: ['treeSmall', 'lamp', 'bench', 'treeSmall', 'bin', 'mailbox', 'bollard', 'hydrant', 'treeSmall'],
  w: ['lamp', 'bollard', 'barrel', 'bollard', 'pallet', 'signWarn', 'box'],
  p: ['treeTall', 'tree', 'bench', 'lamp', 'treeTall'],
  q: ['bollard', 'lamp', 'bench', 'treeSmall', 'bollard'],
};

/** Whether a point is within `margin` metres of the driving line. */
function nearRoute(x: number, z: number, margin: number): boolean {
  for (let i = 0; i + 1 < ROUTE.length; i++) {
    const ax = xOf(ROUTE[i][0]);
    const az = zOf(ROUTE[i][1]);
    const bx = xOf(ROUTE[i + 1][0]) - ax;
    const bz = zOf(ROUTE[i + 1][1]) - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz)));
    if (Math.hypot(x - ax - bx * t, z - az - bz * t) < margin) return true;
  }
  return false;
}

class Builder {
  readonly props: PropDesc[] = [];
  readonly objects: ObjectDesc[] = [];
  readonly decals: DecalDesc[] = [];
  readonly crowds: CrowdDesc[] = [];
  readonly pits: PitDesc[] = [];
  readonly tracks: TrackDesc[] = [];
  readonly signals: SignalDesc[] = [];
  readonly slicks: SlickDesc[] = [];
  readonly signs: SignDesc[] = [];
  /** Rectangles to leave free of scattered clutter: [minX, minZ, maxX, maxZ]. */
  readonly keepClear: Tile[] = [];
  readonly rand = mulberry32(21);
  /** A second set of dice, for what was added once the first had laid everything else out: using these moves none of that. */
  readonly dice = mulberry32(57);
  /** Counts lengths of guard rail, to paint them alternately. */
  rails = 0;

  pick<T>(list: T[]): T {
    return list[Math.floor(this.rand() * list.length)];
  }

  /** A number between two bounds. */
  span(lo: number, hi: number): number {
    return lo + this.rand() * (hi - lo);
  }

  object(kind: ObjectKindId, x: number, z: number, y = 0, rotY = this.rand() * Math.PI * 2): void {
    this.objects.push({ kind, pos: [x, y, z], rotY });
  }

  /** Whether a spot is solid, open ground: not in or beside a pit, nor anywhere set aside. With `offLine`, not on the driving line either. */
  free(x: number, z: number, offLine = false): boolean {
    const margin = 1.6;
    if (offLine && nearRoute(x, z, 2.4)) return false;
    return (
      !this.pits.some((p) => Math.abs(x - p.pos[0]) < p.half[0] + margin && Math.abs(z - p.pos[1]) < p.half[1] + margin) &&
      !this.keepClear.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1)
    );
  }

  /** Bare earth over a rectangle, cut away where the pits are. */
  dirt(x0: number, z0: number, x1: number, z1: number): void {
    for (const [a, c, d, e] of tilesAround([x0, z0, x1, z1], this.pits)) {
      this.decals.push({ pos: [(a + d) / 2, (c + e) / 2], size: [d - a, e - c], color: 0x8a6f4c, mapColor: MAP_DIRT });
    }
  }
}

/** Join neighbouring block squares of the same kind into rectangles, at most four squares on a side. */
function blockRects(): { c0: number; r0: number; c1: number; r1: number; kind: string }[] {
  const used = new Set<string>();
  const rects = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const kind = at(c, r);
      if (!BLOCKS.has(kind) || used.has(`${c},${r}`)) continue;
      const free = (cc: number, rr: number) => at(cc, rr) === kind && !used.has(`${cc},${rr}`);
      let c1 = c;
      while (c1 - c < 3 && free(c1 + 1, r)) c1++;
      let r1 = r;
      const rowFree = (rr: number) => {
        for (let cc = c; cc <= c1; cc++) if (!free(cc, rr)) return false;
        return true;
      };
      while (r1 - r < 3 && rowFree(r1 + 1)) r1++;
      for (let rr = r; rr <= r1; rr++) for (let cc = c; cc <= c1; cc++) used.add(`${cc},${rr}`);
      rects.push({ c0: c, r0: r, c1, r1, kind });
    }
  }
  return rects;
}

function buildBlocks(b: Builder): void {
  for (const { c0, r0, c1, r1, kind } of blockRects()) {
    // Columns run against X, so the rectangle's low column is its high-X side.
    const x0 = xOf(c1) - HALF;
    const x1 = xOf(c0) + HALF;
    const z0 = zOf(r0) - HALF;
    const z1 = zOf(r1) + HALF;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const w = x1 - x0;
    const d = z1 - z0;
    b.props.push({
      shape: 'box', size: [w / 2, KERB / 2, d / 2], pos: [cx, KERB / 2, cz],
      color: kind === 'q' ? 0xb8b0a0 : PAVEMENT, mapColor: kind === 'q' ? MAP_PLAZA : MAP_BLOCK, mapUnder: true,
    });

    if (kind === 'p') {
      b.decals.push({ pos: [cx, cz], size: [w - 3, d - 3], color: 0x6fa862, y: KERB + 0.02, mapColor: MAP_PARK });
      const big = w > CELL * 2 && d > CELL * 2;
      if (big) b.decals.push({ pos: [cx + 6, cz - 4], size: [18, 12], color: 0x5a9bd4, y: KERB + 0.04, mapColor: MAP_WATER });
      const trees = Math.round((w * d) / 110);
      for (let i = 0; i < trees; i++) {
        const x = b.span(x0 + 3, x1 - 3);
        const z = b.span(z0 + 3, z1 - 3);
        if (big && Math.abs(x - cx - 6) < 11 && Math.abs(z - cz + 4) < 8) continue;
        b.object(b.pick<ObjectKindId>(['tree', 'treeTall', 'treeSmall']), x, z, KERB);
      }
      for (let i = 0; i < Math.round((w * d) / 500); i++) b.object('bench', b.span(x0 + 4, x1 - 4), b.span(z0 + 4, z1 - 4), KERB);
      b.crowds.push({ area: [x0 + 2, z0 + 2, x1 - 2, z1 - 2], count: Math.max(1, Math.round((w * d) / 420)), y: KERB });
      continue;
    }

    if (kind === 'q') {
      // A square: a fountain in the middle, café tables around it, and a crowd.
      b.props.push({ shape: 'cylinder', size: [3.2, 0.3, 0], pos: [cx, KERB + 0.3, cz], color: 0x8fb4c8, mapColor: MAP_WATER });
      b.props.push({ shape: 'cylinder', size: [0.5, 1.1, 0], pos: [cx, KERB + 1.1, cz], color: 0xb8a070 });
      for (let i = 0; i < Math.round((w * d) / 170); i++) {
        const x = b.span(x0 + 4, x1 - 4);
        const z = b.span(z0 + 4, z1 - 4);
        if (Math.hypot(x - cx, z - cz) < 6) continue;
        b.object('table', x, z, KERB);
        // Beside the table rather than through it: two things in one place fly apart when woken.
        b.object('umbrella', x + 0.62, z + 0.62, KERB);
        for (const a of [0, 2.1, 4.2]) b.object('chair', x + Math.cos(a) * 0.95, z + Math.sin(a) * 0.95, KERB, -a + Math.PI / 2);
      }
      b.crowds.push({ area: [x0 + 2, z0 + 2, x1 - 2, z1 - 2], count: Math.round((w * d) / 130), y: KERB });
      continue;
    }

    // Buildings, each over one or two squares. They stand back from the kerb wherever they
    // face a road or a park, and run right up to their neighbours everywhere else, so that
    // there is no way through between them.
    const built = (c: number, r: number) => '#ow '.includes(at(c, r));
    for (let c = c0; c <= c1; c += 2) {
      for (let r = r0; r <= r1; r += 2) {
        const cEnd = Math.min(c + 1, c1);
        const rEnd = Math.min(r + 1, r1);
        const columns = cEnd === c ? [c] : [c, cEnd];
        const rows = rEnd === r ? [r] : [r, rEnd];
        const back = (open: boolean) => (open ? b.span(3.5, 5) : 0);
        // Columns run against X: the next column up is the low-X side.
        const open: BuildingLook['open'] = [
          !rows.every((rr) => built(cEnd + 1, rr)),
          !rows.every((rr) => built(c - 1, rr)),
          !columns.every((cc) => built(cc, r - 1)),
          !columns.every((cc) => built(cc, rEnd + 1)),
        ];
        const lowX = xOf(cEnd) - HALF + back(open[0]);
        const highX = xOf(c) + HALF - back(open[1]);
        const lowZ = zOf(r) - HALF + back(open[2]);
        const highZ = zOf(rEnd) + HALF - back(open[3]);
        const height =
          kind === 'w' ? b.span(6, 10)
          : kind === 'o' ? b.span(6, 15)
          : b.span(12, 12 + b.rand() * 44);
        const color = b.pick(kind === 'w' ? SHEDS : kind === 'o' ? OLD_TOWN : DOWNTOWN);
        const hx = (highX - lowX) / 2;
        const hz = (highZ - lowZ) / 2;
        const lx = (lowX + highX) / 2;
        const lz = (lowZ + highZ) / 2;
        // The box is what is solid. How it looks is worked out from it when it is drawn.
        const look: BuildingLook = {
          style: kind === 'w' ? 'shed' : kind === 'o' ? 'old' : 'tower',
          open,
          crown: height > 14 ? b.span(1, 3) : 0,
          seed: c * 7919 + r * 104729,
        };
        b.props.push({ shape: 'box', size: [hx, height / 2, hz], pos: [lx, KERB + height / 2, lz], color, fade: true, mapColor: MAP_BUILDING, building: look });
      }
    }
  }
}

/** Trees, lamps and the rest along every kerb that faces a road. */
function buildStreetFurniture(b: Builder): void {
  const inset = 1.4;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const choices = FURNITURE[at(c, r)];
      if (!choices) continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const beside = at(c + dc, r + dr);
        // Leave the market, the roadworks and the yard to their own clutter.
        if (!DRIVABLE.has(beside) || beside === 'm' || beside === 'c' || beside === 'd') continue;
        // Toward the road, in world terms; and along the kerb.
        const dx = -dc;
        const dz = dr;
        for (const along of [-4, 4]) {
          if (b.rand() < 0.22) continue;
          const x = xOf(c) + dx * (HALF - inset) + dz * along;
          const z = zOf(r) + dz * (HALF - inset) + dx * along;
          if (!b.free(x, z)) continue;
          b.object(b.pick(choices), x, z, KERB, Math.atan2(dx, dz));
        }
      }
    }
  }
}

const SCOOTERS: ObjectKindId[] = ['scooterRed', 'scooterBlue', 'scooterWhite', 'scooterBlack', 'scooterYellow', 'scooterTeal', 'scooterWhite', 'scooterBlack'];

/**
 * Scooters parked in rows at the kerb, tail to the road, between the trees and the lamps:
 * in front of the shops, and only along the streets the route goes down or passes close to.
 */
function buildScooters(b: Builder): void {
  // Dice of their own, so that adding these moves nothing else.
  const rand = mulberry32(88);
  const inset = 1.15;
  const gap = 0.78;
  // Whatever stands up out of the pavement: a wall across it, a barrier, a railing.
  const standing = b.props.filter((p) => !p.ghost && p.mass === undefined && p.pos[1] + p.size[1] > KERB + 0.3);
  const clear = (x: number, z: number) => standing.every((p) => Math.abs(x - p.pos[0]) > p.size[0] + 1 || Math.abs(z - p.pos[2]) > (p.shape === 'box' ? p.size[2] : p.size[0]) + 1);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const kind = at(c, r);
      if (kind !== '#' && kind !== 'o') continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const beside = at(c + dc, r + dr);
        if (!DRIVABLE.has(beside) || beside === 'm' || beside === 'c' || beside === 'd') continue;
        if (rand() < 0.2) continue;
        const dx = -dc;
        const dz = dr;
        const count = 4 + Math.floor(rand() * 4);
        const middle = (rand() - 0.5) * 0.9;
        // All leaning the same way, as a row of them does.
        const slant = (rand() < 0.5 ? -1 : 1) * (0.15 + rand() * 0.2);
        for (let i = 0; i < count; i++) {
          const along = middle + (i - (count - 1) / 2) * gap;
          const x = xOf(c) + dx * (HALF - inset) + dz * along;
          const z = zOf(r) + dz * (HALF - inset) + dx * along;
          // A gap here and there, where someone has ridden off.
          if (rand() < 0.1 || !nearRoute(x, z, 60) || !b.free(x, z) || !clear(x, z)) continue;
          b.object(SCOOTERS[Math.floor(rand() * SCOOTERS.length)], x, z, KERB, Math.atan2(-dx, -dz) + slant);
        }
      }
    }
  }
}

/**
 * Things along the route that do more than fall over when hit: a cylinder of gas on the
 * pavement outside each eating house, where its stove is, and tins of paint left about the
 * roadworks. Gas stands nowhere else but by the stoves of the market and the feast.
 */
function buildHazards(b: Builder): void {
  const standing = b.props.filter((p) => !p.ghost && p.mass === undefined && !p.building && p.pos[1] + p.size[1] > KERB + 0.3);
  const clear = (x: number, z: number) => standing.every((p) => Math.abs(x - p.pos[0]) > p.size[0] + 0.8 || Math.abs(z - p.pos[2]) > (p.shape === 'box' ? p.size[2] : p.size[0]) + 0.8);
  for (const prop of b.props) {
    if (!prop.building || prop.building.style === 'shed' || !nearRoute(prop.pos[0], prop.pos[2], 50)) continue;
    for (const mark of buildingMarks(prop, prop.building)) {
      // Not every kitchen keeps its gas out front.
      if (b.dice() < 0.6 && nearRoute(mark.x, mark.z, 32) && b.free(mark.x, mark.z) && clear(mark.x, mark.z)) b.object('gasCylinder', mark.x, mark.z, KERB, 0);
    }
  }

  const paints: ObjectKindId[] = ['paintWhite', 'paintYellow', 'paintBlue'];
  const [sx, sz] = [xOf(22) + HALF, (zOf(27) + zOf(28)) / 2];
  for (let i = 0; i < 9; i++) {
    const x = sx - 3 - b.dice() * 26;
    const z = sz + (b.dice() < 0.5 ? -1 : 1) * (4.2 + b.dice() * 3.4);
    if (b.free(x, z, true) && clear(x, z)) b.object(paints[i % paints.length], x, z, 0, 0);
  }
}

/** The rows of the map that are road from one edge to the other. */
function throughRoads(): number[] {
  const rows: number[] = [];
  for (let r = 0; r < ROWS; r++) if ([...MAP[ROWS - 1 - r]].every((kind) => kind === '.')) rows.push(r);
  return rows;
}

/** The stretch of the back street that is plain road: between the foot of the terrace and the oil. */
const BACK_STREET: { row: number; from: number; to: number } = { row: 41, from: 20.4, to: 14.6 };

/**
 * People on the pavements along the route, and people crossing the two streets where the
 * traffic is: wherever they like, as people do.
 */
function buildPeople(b: Builder): void {
  // Dice of their own, so that adding these moves nothing else.
  const rand = mulberry32(131);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const kind = at(c, r);
      if (kind !== '#' && kind !== 'o') continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const beside = at(c + dc, r + dr);
        if (beside !== '.' && beside !== 'b') continue;
        if (rand() < 0.45) continue;
        const dx = -dc;
        const dz = dr;
        // The strip of pavement between the kerb and the shops, the length of the square.
        const near = HALF - 0.6;
        const far = HALF - 3.2;
        const x = [xOf(c) + dx * near - dz * HALF, xOf(c) + dx * far + dz * HALF];
        const z = [zOf(r) + dz * near - dx * HALF, zOf(r) + dz * far + dx * HALF];
        if (!nearRoute(xOf(c) + dx * HALF, zOf(r) + dz * HALF, 30)) continue;
        b.crowds.push({ area: [Math.min(...x), Math.min(...z), Math.max(...x), Math.max(...z)], count: rand() < 0.3 ? 2 : 1, y: KERB });
      }
    }
  }

  // Crossings: from the pavement on one side to the pavement on the other.
  const crossing = (column: number, row: number, count: number) => {
    const x = xOf(column);
    const z = zOf(row);
    b.crowds.push({ area: [x - 2.5, z - HALF - 3, x + 2.5, z + HALF + 3], count, y: KERB / 2, crossing: 'z' });
  };
  for (const row of throughRoads()) for (const column of [23.6, 25.2, 26.6, 27.9]) crossing(column, row, 3);
  for (const column of [25.4, 19.4, 17.8, 16.2, 15]) crossing(column, BACK_STREET.row, 2);
}

/** Where the scooters ride: both carriageways of the boulevard, both ways along the busy street, and up and down the back street. */
function buildRiders(): RiderLane[] {
  const lanes: RiderLane[] = [];
  // A one-way carriageway: from kerb to median.
  const oneWay: Vec2 = [-7.3, 6.3];
  // One side of a two-way street, and now and then a little over the middle of it.
  const twoWay: Vec2 = [-7.3, 0.8];

  const boulevard: number[] = [];
  for (let r = 0; r < ROWS; r++) if (at(0, r) === 'b') boulevard.push(r);
  if (boulevard.length === 2) {
    const [south, north] = boulevard;
    lanes.push({ from: [MAX_X, zOf(south)], to: [MIN_X, zOf(south)], band: oneWay, riders: 24 });
    lanes.push({ from: [MIN_X, zOf(north)], to: [MAX_X, zOf(north)], band: oneWay, riders: 24 });
  }
  for (const row of throughRoads()) {
    lanes.push({ from: [MAX_X, zOf(row)], to: [MIN_X, zOf(row)], band: twoWay, riders: 24 });
    lanes.push({ from: [MIN_X, zOf(row)], to: [MAX_X, zOf(row)], band: twoWay, riders: 24 });
  }
  // The back street leads nowhere they want to go: they ride up it, turn round, and ride back.
  const { row, from, to } = BACK_STREET;
  const narrow: Vec2 = [-5.8, 0.8];
  lanes.push({ from: [xOf(from), zOf(row)], to: [xOf(to), zOf(row)], band: narrow, riders: 8, turnInto: lanes.length + 1 });
  lanes.push({ from: [xOf(to), zOf(row)], to: [xOf(from), zOf(row)], band: narrow, riders: 8, turnInto: lanes.length - 1 });
  return lanes;
}

function buildRoads(b: Builder): void {
  const dash = 3;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const kind = at(c, r);
      const x = xOf(c);
      const z = zOf(r);
      const ns = drivable(c, r + 1) || drivable(c, r - 1);
      const ew = drivable(c + 1, r) || drivable(c - 1, r);

      if (kind === '.' || kind === 'S' || kind === 'F' || kind === 'R') {
        // A straight stretch gets a centre line and lane dashes; junctions and corners are left bare.
        if (ns !== ew) {
          const rotY = ns ? 0 : Math.PI / 2;
          const place = (offset: number, along: number): Vec2 => (ns ? [x + offset, z + along] : [x + along, z + offset]);
          b.decals.push({ pos: place(0, 0), size: [0.25, CELL], rotY, color: YELLOW });
          for (const offset of [-LANE, LANE]) for (const along of [-4, 4]) b.decals.push({ pos: place(offset, along), size: [0.15, dash], rotY, color: WHITE });
        }
      }

      if (kind === 'b') {
        // One carriageway of the boulevard: three lanes.
        for (const offset of [-LANE / 2, LANE / 2]) for (const along of [-4, 4]) {
          b.decals.push({ pos: [x + along, z + offset], size: [0.15, dash], rotY: Math.PI / 2, color: WHITE });
        }
        // The median runs between the two carriageways, planted with trees and lamps.
        // It is broken where the market lane leaves the far side, to turn across.
        if (at(c, r + 1) === 'b' && at(c, r + 2) !== 'm') {
          b.props.push({ shape: 'box', size: [HALF, 0.1, 1.1], pos: [x, 0.1, z + HALF], color: PAVEMENT, mapColor: MAP_BLOCK });
          b.object(c % 2 ? 'lamp' : 'tree', x - 4, z + HALF, 0.2);
          b.object(c % 3 ? 'treeSmall' : 'signBlue', x + 4, z + HALF, 0.2);
        }
      }

      if (kind === 'm') buildMarket(b, c, r);
      if (kind === 'd') buildYard(b, c, r);

    }
  }

  // The roundabout: an island with a monument where four squares meet.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (at(c, r) !== 'O' || at(c + 1, r) !== 'O' || at(c, r + 1) !== 'O') continue;
      const x = xOf(c) - HALF;
      const z = zOf(r) + HALF;
      b.props.push({ shape: 'cylinder', size: [5.5, 0.2, 0], pos: [x, 0.2, z], color: PAVEMENT, mapColor: MAP_BLOCK });
      b.props.push({ shape: 'box', size: [0.9, 2, 0.9], pos: [x, 2.4, z], color: 0xb8a070 });
      b.props.push({ shape: 'cone', size: [1.2, 0.9, 0], pos: [x, 5.3, z], color: 0x8f7a4a, ghost: true });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        b.object(i % 2 ? 'bollard' : 'treeSmall', x + Math.cos(a) * 4.3, z + Math.sin(a) * 4.3, 0.4);
      }
    }
  }
}

/** Stalls down both sides, goods spilling into the lane, and a crowd. */
function buildMarket(b: Builder, c: number, r: number): void {
  const x = xOf(c);
  const z = zOf(r);
  const stalls: ObjectKindId[] = ['stallRed', 'stallBlue', 'stallYellow', 'stallGreen'];
  const crates: ObjectKindId[] = ['crateOrange', 'crateRed', 'crateGreen', 'crateYellow'];
  const fruit: ObjectKindId[] = ['fruitOrange', 'fruitTomato', 'fruitMelon', 'fruitGrape', 'fruitMango'];
  // A stall goes against any side that isn't itself road. Where two such sides meet in a
  // corner, only one of them gets the pitch.
  const pitches: Vec2[] = [];
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (drivable(c + dc, r + dr)) continue;
    const dx = -dc;
    const dz = dr;
    for (const along of [-4, 4]) {
      const sx = x + dx * 4.6 + dz * along;
      const sz = z + dz * 4.6 + dx * along;
      if (pitches.some(([px, pz]) => Math.hypot(px - sx, pz - sz) < 3.2)) continue;
      pitches.push([sx, sz]);
      // The stall's long side lies along the lane.
      const rotY = dx !== 0 ? Math.PI / 2 : 0;
      // Turned to face the lane, for those with a front and a back.
      const facing = Math.atan2(-dx, -dz);
      const stall = b.pick(stalls);
      const goods = b.pick(crates);
      const stock = [b.pick(crates), b.pick(crates)];
      const heaped = b.rand() < 0.5;
      const fx = sx - dx * 1.5;
      const fz = sz - dz * 1.5;
      const front = () => {
        b.object(stock[0], fx, fz, 0, rotY);
        b.object(stock[1], fx + dz * 0.5, fz + dx * 0.5, 0, rotY);
        if (heaped) b.object(goods, fx + dz * 0.25, fz + dx * 0.25, 0.4, rotY);
      };
      // What is sold here. No two pitches side by side need be the same kind of thing.
      const trade = b.dice();
      if (trade < 0.24) {
        // General goods: a counter under an awning, stock on it and more stacked out front.
        b.object(stall, sx, sz, 0, rotY);
        for (const t of [-0.6, 0, 0.6]) b.object(goods, sx + dz * t, sz + dx * t, 0.84, rotY);
        front();
      } else if (trade < 0.54) {
        b.object(fruit[Math.floor(b.dice() * fruit.length)], sx, sz, 0, facing);
        front();
      } else if (trade < 0.68) {
        // Something frying, the gas for it standing beside the cart, and somewhere to sit and eat it.
        b.object(b.dice() < 0.5 ? 'snackCartRed' : 'snackCartYellow', sx, sz, 0, rotY);
        if (b.dice() < 0.75) b.object('gasCylinder', sx + dz * 1.35 + dx * 0.3, sz + dx * 1.35 + dz * 0.3, 0, 0);
        for (const t of [-0.5, 0.4]) b.object('stool', fx + dz * t, fz + dx * t, 0, 0);
      } else if (trade < 0.77) {
        b.object('fishStall', sx, sz, 0, facing);
        front();
      } else if (trade < 0.86) {
        for (const out of [0.3, 1.2]) b.object('clothesRack', sx - dx * out, sz - dz * out, 0, rotY);
        front();
      } else if (trade < 0.94) {
        b.object('flowerStall', sx, sz, 0, facing);
        b.object('flowerStall', fx, fz, 0, facing);
      } else {
        // Live poultry: cages on the ground and one on top.
        for (const t of [-0.55, 0.55]) b.object('chickenCage', sx + dz * t, sz + dx * t, 0, rotY);
        b.object('chickenCage', sx, sz, 0.58, rotY);
        front();
      }
      if (b.rand() < 0.35) b.object('barrel', sx - dx * 1.6 + dz * 1.6, sz - dz * 1.6 + dx * 1.6);
    }
  }
  b.crowds.push({ area: [x - HALF + 3, z - HALF + 1, x + HALF - 3, z + HALF - 1], count: 4, y: 0 });
}

// What stands in the way. None of it gives: these are what the route has to be driven round.

/** A concrete barrier with red stripes, lying along X or, turned, along Z. */
function barrier(b: Builder, x: number, z: number, length: number, turned = false): void {
  const long = length / 2;
  b.props.push({ shape: 'box', size: turned ? [0.35, 0.45, long] : [long, 0.45, 0.35], pos: [x, 0.45, z], color: 0xc9c5bc, mapColor: MAP_BARRIER });
  for (let d = -long + 0.5; d < long; d += 2) {
    b.props.push({
      shape: 'box', size: turned ? [0.37, 0.14, 0.5] : [0.5, 0.14, 0.37],
      pos: [x + (turned ? 0 : d), 0.62, z + (turned ? d : 0)], color: 0xd03a2a, ghost: true,
    });
  }
}

/** The straight road up the middle: closed, and dug out from kerb to kerb. */
function buildClosedRoad(b: Builder): void {
  const rows: number[] = [];
  let column = -1;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (at(c, r) === 'X') {
    rows.push(r);
    column = c;
  }
  if (!rows.length) return;
  const x = xOf(column);
  const z0 = zOf(rows[0]) - HALF;
  const z1 = zOf(rows[rows.length - 1]) + HALF;
  const pit: PitDesc = { pos: [x, (z0 + z1) / 2], half: [HALF, (z1 - z0) / 2 - 12], depth: 1.5 };
  b.pits.push(pit);
  b.dirt(x - HALF, z0, x + HALF, z1);

  for (const [z, toward] of [[z0 + 8, -1], [z1 - 8, 1]]) {
    // The pavements either side are walled off, so there is no squeezing round the hole.
    for (const side of [-1, 1]) barrier(b, x + side * (HALF + 3.5), z, 7);
    // Across the road itself, only warnings: drive through them and the hole is next.
    for (const offset of [-6, -3, 0, 3, 6]) b.object('barrier', x + offset, z + toward * 4.5, 0, 0);
    for (const offset of [-7, 7]) b.object('signWarn', x + offset, z + toward * 6, 0, 0);
    for (const offset of [-4.5, -1.5, 1.5, 4.5]) b.object('cone', x + offset, z + toward * 7, 0, 0);
  }

  // A digger left down the hole, and heaps of spoil.
  const floor = -pit.depth;
  const dx = x + 2.5;
  const dz = pit.pos[1] - 4;
  b.props.push({ shape: 'box', size: [1.5, 0.4, 2.3], pos: [dx, floor + 0.4, dz], color: 0x2a2e34 });
  b.props.push({ shape: 'box', size: [1.3, 0.7, 1.9], pos: [dx, floor + 1.5, dz], color: 0xe0a020 });
  b.props.push({ shape: 'box', size: [0.7, 0.6, 0.8], pos: [dx + 0.5, floor + 2.8, dz - 0.8], color: 0x30363d, ghost: true });
  b.props.push({ shape: 'box', size: [0.22, 0.22, 2.4], pos: [dx - 0.6, floor + 3.1, dz + 2.6], rot: [-0.55, 0, 0], color: 0xe0a020, ghost: true });
  b.props.push({ shape: 'box', size: [0.2, 0.2, 1.5], pos: [dx - 0.6, floor + 3.2, dz + 5.6], rot: [0.75, 0, 0], color: 0xe0a020, ghost: true });
  for (const [ox, oz, size] of [[-4.5, 8, 2.4], [-3, -12, 2], [4.5, 12, 1.8], [-5, -2, 1.6]]) {
    b.props.push({ shape: 'cone', size: [size, size * 0.45, 0], pos: [x + ox, floor + size * 0.45, pit.pos[1] + oz], color: 0x6a5238 });
  }
}

/** A fixed guard rail from one point to another, in red and white lengths. */
function rail(b: Builder, ax: number, az: number, bx: number, bz: number): void {
  const length = Math.hypot(bx - ax, bz - az);
  const pieces = Math.max(1, Math.round(length / 4));
  const rotY = Math.atan2(az - bz, bx - ax);
  for (let i = 0; i < pieces; i++) {
    const t = (i + 0.5) / pieces;
    b.props.push({
      shape: 'box', size: [length / pieces / 2 + 0.05, 0.45, 0.15], pos: [ax + (bx - ax) * t, 0.45, az + (bz - az) * t],
      rot: [0, rotY, 0], color: b.rails++ % 2 ? 0xe8e8e8 : 0xd03a2a,
    });
  }
}

/** Guard rail round half a circle that bulges toward -X, from its south end to its north. */
function railBend(b: Builder, cx: number, cz: number, radius: number): void {
  const steps = Math.max(6, Math.round((Math.PI * radius) / 3.5));
  const point = (i: number): Vec2 => {
    const t = (i / steps) * Math.PI;
    return [cx - radius * Math.sin(t), cz - radius * Math.cos(t)];
  };
  for (let i = 0; i < steps; i++) rail(b, ...point(i), ...point(i + 1));
}

/**
 * The roadworks: one narrow lane between a hoarding and a guard rail, out along the south
 * side, round a tight bend and back along the north. A trench cuts across both lengths,
 * with a steel plate over it in each.
 */
function buildSite(b: Builder): void {
  const x0 = xOf(28) - HALF;
  const x1 = xOf(22) + HALF;
  const z0 = zOf(27) - HALF;
  const z1 = zOf(28) + HALF;
  const mid = (z0 + z1) / 2;
  // From the face of the hoarding to the rail on the other side of the lane.
  const lane = 7.2;
  const south = z0 + lane;
  const north = z1 - lane;
  const bend = xOf(27.125);
  // Where the north lane's rail stops, and the way out to the north opens up.
  const mouth = x1 - 20;
  const depth = 1.4;

  const trench: PitDesc = { pos: [xOf(24.6875), mid], half: [2.5, (z1 - z0) / 2], depth };
  // What is being dug, in the middle of it all.
  const dig: PitDesc = { pos: [bend + 14, mid], half: [9, mid - south - 2.5], depth };
  b.pits.push(trench, dig);
  b.dirt(x0, z0, x1, z1);

  // Hoardings down both sides. The north one stops short, where the lane leaves.
  b.props.push({ shape: 'box', size: [(x1 - x0) / 2, 0.9, 0.15], pos: [(x0 + x1) / 2, 0.9, z0 + 0.3], color: 0x3f6fa8 });
  b.props.push({ shape: 'box', size: [(mouth - x0) / 2, 0.9, 0.15], pos: [(x0 + mouth) / 2, 0.9, z1 - 0.3], color: 0x3f6fa8 });

  // The inside of the lane: a rail along each length and round the inside of the bend.
  rail(b, x1, south, bend, south);
  railBend(b, bend, mid, mid - south);
  rail(b, bend, north, mouth, north);
  // The outside of the bend, and a rail to keep the way out apart from the roundabout.
  railBend(b, bend, mid, mid - z0 - 0.45);
  rail(b, x1, south, x1, z1);

  // The plates, hard against the inner rail: not much wider than the truck.
  const plateHalf = 2.1;
  for (const z of [south - plateHalf - 0.1, north + plateHalf + 0.1]) {
    b.props.push({ shape: 'box', size: [trench.half[0] + 1.1, 0.05, plateHalf], pos: [trench.pos[0], 0.01, z], color: 0xd9a520, mapColor: MAP_BARRIER });
  }
  b.keepClear.push([trench.pos[0] - 10, z0, trench.pos[0] + 10, z1]);

  // Broken slabs in the lanes, to jolt over.
  for (let i = 0; i < 12; i++) {
    const x = b.span(bend + 3, x1 - 6);
    const z = i % 2 ? b.span(z0 + 1.6, south - 1.4) : b.span(north + 1.4, z1 - 1.6);
    if (z > north && x > mouth - 6) continue;
    if (!b.free(x, z)) continue;
    b.props.push({
      shape: 'box', size: [b.span(0.5, 1), 0.12, b.span(0.5, 1)], pos: [x, 0.02, z],
      rot: [b.span(-0.14, 0.14), b.rand() * Math.PI, b.span(-0.14, 0.14)], color: 0x77705f,
    });
  }
  // Cones at the way in, and boards round the dig.
  for (const d of [1, 3, 5]) b.object('cone', x1 - d * 2, south - 0.9, 0, 0);
  for (const side of [-1, 1]) for (let d = -6; d <= 6; d += 3) b.object('barrier', dig.pos[0] + d, mid + side * (dig.half[1] + 1), 0, 0);
  for (const [ox, oz] of [[-6, -4], [-10, 5], [-15, -2], [-4, 6]]) b.object(b.pick<ObjectKindId>(['barrel', 'pallet', 'box', 'toilet']), x1 + ox, mid + oz);
}

/**
 * The riverside road, torn up for resurfacing: potholes, heaps, broken slabs and whatever
 * the gang left lying about. There is no clean line through it, only slower and faster ways.
 */
function buildRoughRoad(b: Builder): void {
  const x0 = xOf(27) - HALF;
  const x1 = xOf(22) + HALF;
  const z0 = zOf(22) - HALF;
  const z1 = zOf(22) + HALF;
  const spot = (margin: number): Vec2 => [b.span(x0 + margin, x1 - margin), b.span(z0 + 1.5, z1 - 1.5)];

  const holes: Vec2[] = [];
  // With a wheel down a hole the nose is down too, and a slab just beyond would catch it
  // like a wall: so nothing solid goes within a truck's length of one.
  const clearOfHoles = (x: number, z: number) => holes.every(([hx, hz]) => Math.hypot(x - hx, z - hz) > 5.5);
  // Potholes: not deep enough to swallow the truck, deep enough to drop a wheel into.
  for (let i = 0; i < 9; i++) {
    const [x, z] = spot(5);
    if (b.free(x, z)) {
      b.pits.push({ pos: [x, z], half: [b.span(0.8, 1.4), b.span(0.8, 1.4)], depth: 0.22 });
      holes.push([x, z]);
    }
  }
  b.dirt(x0, z0, x1, z1);

  // Hoardings along both kerbs: the only way past is through.
  for (const z of [z0 - 0.3, z1 + 0.3]) {
    b.props.push({ shape: 'box', size: [(x1 - x0) / 2, 0.9, 0.15], pos: [(x0 + x1) / 2, 0.9, z], color: 0x3f6fa8 });
  }

  const lumps: [number, number, number][] = [];
  // Heaps of fill, low enough to drive over and high enough to lift a wheel.
  for (let i = 0; i < 16; i++) {
    const [x, z] = spot(3);
    const height = b.span(0.1, 0.17);
    const radius = b.span(1.3, 2.2);
    if (!b.free(x, z) || !clearOfHoles(x, z)) continue;
    b.props.push({ shape: 'cone', size: [radius, height, 0], pos: [x, height, z], color: 0x7a6344 });
    lumps.push([x, z, radius]);
  }
  // Broken slabs, lying at all angles.
  for (let i = 0; i < 60; i++) {
    const [x, z] = spot(2);
    const slab: PropDesc = {
      shape: 'box', size: [b.span(0.5, 1.1), 0.13, b.span(0.5, 1.1)], pos: [x, 0.03, z],
      rot: [b.span(-0.16, 0.16), b.rand() * Math.PI, b.span(-0.16, 0.16)], color: 0x77705f,
    };
    if (!b.free(x, z) || !clearOfHoles(x, z)) continue;
    b.props.push(slab);
    lumps.push([x, z, 1.2]);
  }
  // Loose things stand on the flat between all that, not on top of it.
  const clutter: ObjectKindId[] = ['cone', 'cone', 'cone', 'barrier', 'barrel', 'pallet', 'box', 'box'];
  for (let i = 0; i < 40; i++) {
    const [x, z] = spot(2);
    const kind = b.pick(clutter);
    if (b.free(x, z) && !lumps.some(([lx, lz, radius]) => Math.hypot(x - lx, z - lz) < radius + 1.5)) b.object(kind, x, z);
  }
  for (const z of [z0 + 1, z1 - 1]) b.object('signWarn', x0 - 3, z, 0, 0);
  b.keepClear.push([x0 - 1, z0 - 3, x1 + 1, z1 + 3]);
}

/** The back street climbs a terrace by a flight of shallow steps, and comes down the other side. */
function buildSteps(b: Builder): void {
  const z = zOf(41);
  const from = xOf(23.75);
  const to = xOf(21);
  const steps = 6;
  const rise = 0.1;
  const tread = 1.6;
  // Wide enough to run under the buildings on both sides: no way round.
  const reach = 14;
  for (let k = 0; k < steps; k++) {
    const a = from + k * tread;
    const c = to - k * tread;
    b.props.push({
      shape: 'box', size: [(c - a) / 2, rise / 2, reach], pos: [(a + c) / 2, (k + 0.5) * rise, z],
      color: k % 2 ? 0xa89c86 : 0xb8ad98, mapColor: k === steps - 1 ? MAP_PLAZA : MAP_BARRIER,
    });
  }
  // On top: a temple feast, laid out in the street. Striped tents down both sides with round
  // tables under them, more tables where the tents ran out, the caterer's stoves, firecrackers
  // ready at either end, and the whole neighbourhood. The way through is what was left clear.
  const top = steps * rise;
  const a = from + steps * tread;
  const c = to - steps * tread;
  const seat = (x: number, tz: number, stools: number) => {
    b.object('banquetTable', x, tz, top, 0);
    for (let i = 0; i < stools; i++) {
      const angle = (i / stools) * Math.PI * 2 + x;
      b.object('stool', x + Math.cos(angle) * 1.22, tz + Math.sin(angle) * 1.22, top, 0);
    }
  };
  for (const tz of [z - 4.9, z + 9]) {
    for (const t of [0.17, 0.5, 0.83]) {
      const x = a + (c - a) * t;
      b.object('tent', x, tz, top, 0);
      for (const along of [-1.25, 1.25]) seat(x + along, tz, 5);
    }
  }
  // The kitchen is at the side, against the houses, out of the way of anyone driving
  // through: two stoves, and the gas they run on behind them.
  const kitchen = a + 3;
  b.object('snackCartRed', kitchen, z - 9.5, top, 0);
  b.object('snackCartYellow', kitchen + 2.4, z - 9.6, top, 0);
  for (const dx of [-0.9, 1.2, 3.4]) b.object('gasCylinder', kitchen + dx, z - 10.75, top, 0);
  b.object('firecrackers', a + 0.9, z + 0.4, top, 0);
  b.object('firecrackers', c - 0.9, z + 6.9, top, Math.PI);
  // There is no way left clear, between the tents or behind them: tables from one side to
  // the other, row behind row, each row set off from the last. Whoever drives through
  // drives through them.
  const crackers: Vec2[] = [[a + 0.9, z + 0.4], [c - 0.9, z + 6.9]];
  [-8.9, -1.3, 1.8, 4.9].forEach((off, row) => {
    for (let x = a + 1.9 + (row % 2) * 1.6; x < c - 1.4; x += 3.2) {
      // Not on top of the kitchen, nor of the firecrackers.
      if (row === 0 && x < kitchen + 5.6) continue;
      if (crackers.some(([tx, tz]) => Math.hypot(x - tx, z + off - tz) < 1.7)) continue;
      seat(x, z + off, 5);
    }
  });
  b.crowds.push({ area: [a, z - 11, c, z + 10.5], count: 60, y: top });
  b.keepClear.push([from - 1, z - reach - 1, to + 1, z + reach + 1]);
}

/** Oil across the last corner: the tyres hold a third as well as they should. */
function buildSlick(b: Builder): void {
  const corner = xOf(12);
  const z = zOf(41);
  const patches: SlickDesc[] = [
    { pos: [corner - 12, z], half: [20, HALF], grip: 0.3 },
    { pos: [corner, z + CELL - 2], half: [HALF, 6], grip: 0.3 },
  ];
  b.slicks.push(...patches);

  // Where it came from: a tanker on its side against the kerb, where the oil begins.
  const spill = corner - 31;
  b.props.push({ shape: 'cylinder', size: [1.1, 2.6, 0], pos: [spill, 1.1, z - 6.2], rot: [0, 0, Math.PI / 2], color: 0xb9c0c8, mapColor: MAP_BARRIER });
  b.props.push({ shape: 'box', size: [1, 1, 1.1], pos: [spill - 3.8, 1, z - 6.2], rot: [0.5, 0, 0], color: 0xc8443a });
  for (const end of [-1, 1]) b.props.push({ shape: 'cylinder', size: [1.14, 0.12, 0], pos: [spill + end * 2.3, 1.1, z - 6.2], rot: [0, 0, Math.PI / 2], color: 0x30363d, ghost: true });

  // Signs facing whoever is coming, well before the oil and again at its edge.
  for (const back of [26, 8]) for (const side of [-1, 1]) {
    b.signs.push({ pos: [corner - 32 - back, 0, z + side * 6.4], rotY: -Math.PI / 2, kind: 'slippery' });
  }
  // Something soft to slide into on the outside of the bend.
  for (const d of [-5, -2.5, 0, 2.5, 5]) b.object('barrel', corner + 6.6, z + d);
  for (const d of [-4, 0, 4]) b.object('barrel', corner + d, z - 6.6);
}

/** The way into the dock, between two walls of stacked containers. */
function buildCanyon(b: Builder): void {
  const x = xOf(12);
  const half: Vec3 = [1.2, 1.3, 3];
  const gap = 2.9;
  for (const side of [-1, 1]) {
    [43.3, 43.72, 44.14].forEach((r, i) => {
      const stack = (i + (side > 0 ? 1 : 0)) % 2 ? 2 : 1;
      for (let level = 0; level < stack; level++) {
        b.props.push({
          shape: 'box', size: half, pos: [x + side * (gap + half[0]), half[1] + level * half[1] * 2, zOf(r)],
          color: b.pick(CONTAINERS), mapColor: MAP_BUILDING,
        });
      }
    });
  }
}

/** Speed humps on the street out of the roadworks: taken slowly they are nothing, taken fast the load leaves the bed. */
function buildHumps(b: Builder): void {
  const radius = 2;
  const height = 0.16;
  for (const r of [29.4, 29.95]) {
    b.props.push({
      shape: 'cylinder', size: [radius, HALF - 0.2, 0], pos: [xOf(22), height - radius, zOf(r)],
      rot: [0, 0, Math.PI / 2], color: YELLOW, mapColor: YELLOW,
    });
  }
}

/** The back street: an old wall across it, with a gateway only just wide enough. */
function buildGateway(b: Builder): void {
  const x = xOf(27);
  const z = zOf(41);
  const gapHalf = 2.4;
  const reach = 14;
  for (const side of [-1, 1]) {
    const inner = gapHalf + 1;
    b.props.push({ shape: 'box', size: [0.4, 0.9, (reach - inner) / 2], pos: [x, 0.9, z + (side * (inner + reach)) / 2], color: 0xa0523a, mapColor: MAP_BARRIER });
    b.props.push({ shape: 'box', size: [0.55, 1.3, 0.55], pos: [x, 1.3, z + side * (gapHalf + 0.55)], color: 0xd4c4a8, mapColor: MAP_BARRIER });
    b.props.push({ shape: 'cone', size: [0.7, 0.35, 0], pos: [x, 2.95, z + side * (gapHalf + 0.55)], color: 0x8a5a44, ghost: true });
  }
}

const TRACKS = 6;

/** Six tracks side by side, a train along each every few seconds, and a signal for every one. */
function buildRailway(b: Builder): void {
  const rows: number[] = [];
  for (let r = 0; r < ROWS; r++) if (at(0, r) === 'r') rows.push(r);
  if (!rows.length) return;
  const crossing = xOf(find('R')[0]);
  const midX = (MIN_X + MAX_X) / 2;
  const width = MAX_X - MIN_X;
  const z0 = zOf(rows[0]) - HALF;
  const z1 = zOf(rows[rows.length - 1]) + HALF;
  // Far enough apart that the truck can wait between one track and the next with room to spare.
  const edge = 6;
  const spacing = (z1 - z0 - edge * 2) / (TRACKS - 1);
  const south = z0 + edge;
  const north = z1 - edge;

  // Ballast either side of the road, and later the darker bed of each track on top of it.
  // Each layer has a height of its own: two at the same height would shimmer.
  const sides: Vec2[] = [[MIN_X, crossing - HALF], [crossing + HALF, MAX_X]];
  for (const [a, c] of sides) b.decals.push({ pos: [(a + c) / 2, (z0 + z1) / 2], size: [c - a, z1 - z0], color: 0x7a746c, y: 0.02, mapColor: MAP_RAIL });

  // No two tracks keep the same time, so there is never a moment when all six are clear for long.
  const speeds = [48, 56, 45, 52, 56, 49];
  const periods = [8, 9.5, 8.5, 10, 7.5, 9];
  const phases = [0, 0.35, 0.7, 0.15, 0.55, 0.85];
  for (let i = 0; i < TRACKS; i++) {
    const z = south + spacing * i;
    const track = b.tracks.length;
    b.tracks.push({
      z, direction: i % 2 ? -1 : 1, speed: speeds[i % speeds.length], period: periods[i % periods.length],
      phase: phases[i % phases.length], watchX: crossing,
    });
    for (const [a, c] of sides) b.decals.push({ pos: [(a + c) / 2, z], size: [c - a, 3.4], color: 0x4f4840, y: 0.04, mapColor: 0x3a3430 });
    // Two rails, low enough to drive over with a jolt.
    for (const offset of [-0.75, 0.75]) b.props.push({ shape: 'box', size: [width / 2, 0.06, 0.09], pos: [midX, 0.06, z + offset], color: 0x5a5f66 });

    // The stretch of road the train sweeps lights up, and there is a lamp at each corner of it.
    b.signals.push({ pos: [crossing, 0.2, z], track, panel: [CELL - 1.4, 3.6] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const px = crossing + sx * (HALF + 0.5);
      const pz = z + sz * 2.5;
      b.props.push({ shape: 'cylinder', size: [0.1, 1.3, 0], pos: [px, 1.3, pz], color: 0x30363d });
      b.signals.push({ pos: [px, 2.9, pz], track });
    }
    // A stop line on each side.
    for (const side of [-1, 1]) b.decals.push({ pos: [crossing, z + side * 2.7], size: [CELL - 1.4, 0.4], color: WHITE, y: 0.06 });
  }

  // A barrier across each approach, on the side traffic arrives from.
  for (const side of [-1, 1]) {
    const gz = (side < 0 ? south : north) + side * 5.5;
    b.object('post', crossing + side * 7.4, gz, 0, 0);
    b.object('post', crossing + side * 0.9, gz, 0, 0);
    b.object('gateArm', crossing + side * 4.15, gz, 1.0, 0);
    b.object('signWarn', crossing - side * 7.2, gz, 0, 0);
    // And a fence along the outside of the outermost tracks.
    const fz = (side < 0 ? south : north) + side * 3.6;
    for (let c = 0; c < COLS; c++) {
      if (at(c, rows[0]) !== 'r') continue;
      for (const along of [-6, -3.8, -1.6, 0.6, 2.8, 5]) b.object('fence', xOf(c) + along + 1, fz, 0, 0);
    }
  }
}

/** The depot: stacked containers round the edge, and pallets and boxes lying about. */
function buildYard(b: Builder, c: number, r: number): void {
  const x = xOf(c);
  const z = zOf(r);
  b.decals.push({ pos: [x, z], size: [CELL, CELL], color: 0x6b7178 });
  // Containers stand away from the lane that runs up the middle of the yard.
  const laneSide = ['.', 'S'].includes(at(c + 1, r)) ? 1 : ['.', 'S'].includes(at(c - 1, r)) ? -1 : 0;
  if (laneSide === 0 && b.rand() < 0.75) {
    const turned = b.rand() < 0.5;
    const half: Vec3 = turned ? [3, 1.3, 1.2] : [1.2, 1.3, 3];
    const ox = b.span(-3, 3);
    const oz = b.span(-3, 3);
    const stack = b.rand() < 0.4 ? 2 : 1;
    for (let i = 0; i < stack; i++) {
      b.props.push({ shape: 'box', size: half, pos: [x + ox, 1.3 + i * 2.6, z + oz], color: b.pick(CONTAINERS), mapColor: MAP_BUILDING });
    }
    return;
  }
  // Loose stock, kept to the far side of the square from the lane. The lane is at a higher
  // column, which is the lower-X side.
  const px = x + laneSide * 3.5;
  const stock: ObjectKindId[] = ['pallet', 'box', 'box', 'barrel', 'cone'];
  for (let i = 0; i < 3; i++) b.object(b.pick(stock), px + b.span(-3, 3), z + b.span(-6, 6));
}

/**
 * A lifting bridge along Z, stuck part of the way up: two leaves, each hinged at its bank
 * and tilted up toward the middle, with open water between their tips. Taken at a run the
 * truck clears the gap; taken slowly it goes in.
 */
function liftingBridge(b: Builder, x: number, z0: number, z1: number): void {
  const length = 12;
  const angle = 0.18;
  // The road starts to climb before the hinge, at half the slope, so the leaf isn't hit as a kerb.
  const apron = 6;
  const lift = apron * Math.tan(angle / 2);
  const thick = 0.25;
  const half = HALF - 1;
  const color = 0x8d949c;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  for (const side of [-1, 1]) {
    const hinge = side < 0 ? z0 : z1;
    // The leaf reaches from its bank toward the middle of the river.
    const out = -side;
    /** A box lying along the leaf: `along` metres out from the hinge, `up` metres above the deck. */
    const place = (along: number, up: number): Vec3 => [0, lift + along * sin + up * cos, hinge + out * (along * cos - up * sin)];
    const half2 = angle / 2;
    const slope = apron / Math.cos(half2) / 2;
    b.props.push({
      shape: 'box', size: [half, thick, slope],
      pos: [x, lift / 2 - thick * Math.cos(half2), hinge + side * (apron / 2 - thick * Math.sin(half2))],
      rot: [side * half2, 0, 0], color, mapColor: MAP_ROAD,
    });
    // The abutment under the hinge, down to the water.
    b.props.push({ shape: 'box', size: [half, lift / 2 + 0.5, 0.4], pos: [x, lift / 2 - 0.5, hinge + out * 0.4], color: CONCRETE });
    const leaf = place(length / 2, -thick);
    b.props.push({ shape: 'box', size: [half, thick, length / 2], pos: [x, leaf[1], leaf[2]], rot: [side * angle, 0, 0], color, mapColor: MAP_ROAD });
    // The end of the road is painted, so that it can be seen for what it is.
    const tip = place(length - 0.8, 0.02);
    b.props.push({ shape: 'box', size: [half, 0.02, 0.8], pos: [x, tip[1], tip[2]], rot: [side * angle, 0, 0], color: YELLOW, ghost: true });
    const parapet = place(length / 2, 0.5);
    for (const edge of [-1, 1]) {
      b.props.push({ shape: 'box', size: [0.2, 0.5, length / 2], pos: [x + edge * (half + 0.2), parapet[1], parapet[2]], rot: [side * angle, 0, 0], color: CONCRETE });
      // The bank's railing, closed up to the side of the bridge.
      b.props.push({ shape: 'box', size: [0.5, 0.55, 0.3], pos: [x + edge * (HALF - 0.5), 0.55, hinge + side * 0.3], color: CONCRETE });
    }
    // Warnings on the way up to it.
    for (const edge of [-1, 1]) b.object('signWarn', x + edge * (half + 0.4), hinge + side * 6, 0, 0);
  }
}

/** The river: a channel of water right across the map, railed along both banks. */
function buildRiver(b: Builder): void {
  const rows: number[] = [];
  for (let r = 0; r < ROWS; r++) if (at(0, r) === '~') rows.push(r);
  if (!rows.length) return;
  const z0 = zOf(rows[0]) - HALF;
  const z1 = zOf(rows[rows.length - 1]) + HALF;
  b.pits.push({ pos: [(MIN_X + MAX_X) / 2, (z0 + z1) / 2], half: [(MAX_X - MIN_X) / 2, (z1 - z0) / 2], depth: 3.6, water: 0.7 });

  for (let c = 0; c < COLS; c++) {
    const x = xOf(c);
    if (at(c, rows[0]) === 'H') liftingBridge(b, x, z0, z1);
    // A railing along each bank, wherever there is no bridge.
    else for (const z of [z0 - 0.3, z1 + 0.3]) b.props.push({ shape: 'box', size: [HALF, 0.55, 0.3], pos: [x, 0.55, z], color: CONCRETE });
  }
}

function buildEdges(b: Builder): void {
  const midX = (MIN_X + MAX_X) / 2;
  const midZ = (MIN_Z + MAX_Z) / 2;
  const spanX = (MAX_X - MIN_X) / 2 + 2;
  const spanZ = (MAX_Z - MIN_Z) / 2 + 2;
  b.props.push({ shape: 'box', size: [spanX, 1, 1], pos: [midX, 1, MIN_Z - 1], color: CONCRETE });
  b.props.push({ shape: 'box', size: [spanX, 1, 1], pos: [midX, 1, MAX_Z + 1], color: CONCRETE });
  b.props.push({ shape: 'box', size: [1, 1, spanZ], pos: [MIN_X - 1, 1, midZ], color: CONCRETE });
  b.props.push({ shape: 'box', size: [1, 1, spanZ], pos: [MAX_X + 1, 1, midZ], color: CONCRETE });
}

function find(kind: string): Vec2 {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (at(c, r) === kind) return [c, r];
  throw new Error(`no ${kind} on the map`);
}

function buildTraffic(): TrafficLane[] {
  const lanes: TrafficLane[] = [];
  const speeds = mulberry32(5);
  const speed = () => 10 + speeds() * 3;
  const parked = (from: Vec2, to: Vec2, cars: number) => lanes.push({ from, to, cars, speed: 0 });

  // The boulevard: the southern carriageway runs east (-X), the northern one west.
  const boulevard: number[] = [];
  for (let r = 0; r < ROWS; r++) if (at(0, r) === 'b') boulevard.push(r);
  if (boulevard.length === 2) {
    const [south, north] = boulevard;
    for (const offset of [-LANE, 0]) lanes.push({ from: [MAX_X, zOf(south) + offset], to: [MIN_X, zOf(south) + offset], cars: 11, speed: speed() });
    for (const offset of [LANE, 0]) lanes.push({ from: [MIN_X, zOf(north) + offset], to: [MAX_X, zOf(north) + offset], cars: 11, speed: speed() });
  }

  // Any road that runs the full width of the map carries through traffic, two lanes each way.
  for (let r = 0; r < ROWS; r++) {
    let through = true;
    for (let c = 0; c < COLS; c++) if (at(c, r) !== '.') through = false;
    if (!through) continue;
    for (const offset of [LANE / 2, LANE * 1.5]) {
      lanes.push({ from: [MAX_X, zOf(r) - offset], to: [MIN_X, zOf(r) - offset], cars: 9, speed: speed() });
      lanes.push({ from: [MIN_X, zOf(r) + offset], to: [MAX_X, zOf(r) + offset], cars: 9, speed: speed() });
    }
  }

  // Cars parked along the kerb, narrowing the road.
  const kerb = HALF - 1.2;
  parked([xOf(17) + kerb, zOf(10) + 6], [xOf(17) + kerb, zOf(6) - 4], 5);
  parked([xOf(17) - kerb, zOf(6)], [xOf(17) - kerb, zOf(8)], 3);
  parked([xOf(24) - kerb, zOf(19)], [xOf(24) - kerb, zOf(21) + 4], 3);
  parked([xOf(24) + kerb, zOf(11) + 4], [xOf(24) + kerb, zOf(8) - 4], 4);
  parked([xOf(17) + 4, zOf(27) - kerb], [xOf(19), zOf(27) - kerb], 3);
  parked([xOf(26) + 6, zOf(41) - kerb], [xOf(26) - 6, zOf(41) - kerb], 2);
  return lanes;
}

/**
 * A house move and a market run on one truck: a fridge and a wardrobe standing against the
 * cab, a safe, a few crates, water jars, a row of watermelons and a skeleton.
 *
 * Front to back it goes tall, then heavy, then fragile, then round: the tall things have
 * the cab to lean on under braking, and the melons have the whole bed to roll down.
 */
function cityLoad(): CargoPlacement[] {
  const cargo: CargoPlacement[] = [];
  const floor = TRUCK.frame.pos[1] + TRUCK.frame.half[1];
  const gap = 0.01;
  const columns = [-0.74, 0, 0.74];
  const on = (half: number) => floor + half + gap;

  // Against the cab, standing: both taller than the sides of the bed.
  // Doors to the rear, where they can be seen, and seen to come off.
  cargo.push({ type: 'fridge', pos: [-0.74, on(0.85), 1.5], rotY: Math.PI });
  cargo.push({ type: 'wardrobe', pos: [0.58, on(0.8), 1.56], rotY: Math.PI });

  // The safe, and crates beside it; another row of crates with small ones on top.
  cargo.push({ type: 'safe', pos: [-0.76, on(0.36), 0.66] });
  for (const x of [0.02, 0.76]) cargo.push({ type: 'crate', pos: [x, on(0.35), 0.62] });
  for (const x of columns) cargo.push({ type: 'crate', pos: [x, on(0.35), -0.2] });
  for (const x of [-0.4, 0.4]) cargo.push({ type: 'smallCrate', pos: [x, floor + 0.7 + 0.25 + gap * 3, -0.2] });

  // Water jars, upright.
  for (const x of columns) cargo.push({ type: 'jar', pos: [x, on(0.33), -1.04] });

  // Watermelons, loose.
  for (const x of [-0.78, -0.26, 0.26, 0.78]) cargo.push({ type: 'watermelon', pos: [x, on(0.24), -1.76] });

  // And the skeleton lying across the back, against the tailgate.
  cargo.push({ type: 'skeleton', pos: [0.08, floor + 0.12 + gap, -2.8], rotY: Math.PI / 2 });
  return cargo;
}

/** A place on the map as a point in the world, for tests finding their way about: [x, z]. */
export const cityCell = (c: number, r: number): Vec2 => [xOf(c), zOf(r)];

export function city(): LevelDef {
  const b = new Builder();
  // The railway and the obstacles first: they dig the pits that everything else must keep out of.
  buildRiver(b);
  buildRailway(b);
  buildClosedRoad(b);
  buildRoughRoad(b);
  buildSite(b);
  buildHumps(b);
  buildGateway(b);
  buildSteps(b);
  buildSlick(b);
  buildCanyon(b);
  buildBlocks(b);
  buildRoads(b);
  buildStreetFurniture(b);
  buildScooters(b);
  buildPeople(b);
  buildHazards(b);
  buildEdges(b);

  const [sc, sr] = find('S');
  const [fc, fr] = find('F');
  const finish: Vec2 = [xOf(fc), zOf(fr)];
  b.decals.push({ pos: finish, size: [7, 13], color: 0x3fbf6a });
  // The way out of the depot is barred. It is only a pole.
  const gate = zOf(5) + 7;
  b.object('post', xOf(sc) + 7.2, gate, 0, 0);
  b.object('post', xOf(sc) - 7.2, gate, 0, 0);
  b.object('post', xOf(sc), gate, 0, 0);
  b.object('gateArm', xOf(sc) + 3.6, gate, 1.0, 0);
  b.object('gateArm', xOf(sc) - 3.6, gate, 1.0, 0);
  // Under it, the line the clock starts at.
  b.decals.push({ pos: [xOf(sc), gate], size: [CELL - 1, 0.6], color: WHITE });

  return {
    id: 'city',
    name: '第 1 關　城市配送',
    brief: '穿過市區，把貨物送到綠色卸貨區',
    ground: {
      center: [(MIN_X + MAX_X) / 2, (MIN_Z + MAX_Z) / 2],
      half: [(MAX_X - MIN_X) / 2 + 20, (MAX_Z - MIN_Z) / 2 + 20],
      style: 'asphalt',
    },
    bounds: [[MIN_X, MIN_Z], [MAX_X, MAX_Z]],
    spawn: [xOf(sc), 0.9, zOf(sr)],
    startLine: { pos: [xOf(sc), gate], dir: [0, 1] },
    heading: 0,
    props: b.props,
    objects: b.objects,
    crowds: b.crowds,
    pits: b.pits,
    slicks: b.slicks,
    signs: b.signs,
    tracks: b.tracks,
    signals: b.signals,
    route: ROUTE.map(([c, r]): Vec2 => [xOf(c), zOf(r)]),
    decals: b.decals,
    cargo: cityLoad(),
    traffic: buildTraffic(),
    riders: buildRiders(),
    finish: { pos: finish, half: [3.4, 6.4] },
    // The first level: mistakes cost less here than they will later.
    damageScale: 0.8,
    stars: [0, 0.6],
    par: 270,
  };
}
