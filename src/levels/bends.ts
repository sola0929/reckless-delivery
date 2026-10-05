import type { ObjectDesc, ObjectKindId } from './objects';
import { standardLoad } from './sandbox';
import { heightAt, makePieces, type Piece } from './terrain';
import type { LevelDef, PropDesc, Vec2 } from './types';

// A sample of a mountain road on ground made of clean pieces: slopes of three different
// steepnesses one after another, a crest and a dip, and then a road that winds, by bends of
// forty-five degrees and not by square corners, along a shelf with the mountain going up on
// one hand and a drop on the other. Every edge is sharp and every face below an edge is
// upright; nothing is a staircase.
//
// The road is a line of points with a height at each. The ground is cut into small squares,
// each into four triangles, and each triangle is road, mountain or valley by where it lies:
// so the edge of the road can run square to the squares or across them.

/** The middle of the road: [x, z, height]. It is level for a little way either side of every point, and climbs steadily between. */
const ROAD: [number, number, number][] = [
  [0, -12, 0], [0, 36, 0],
  // Three climbs: a gentle one, a middling one, a steep one.
  [0, 78, 2], [0, 90, 2], [0, 120, 5.5], [0, 132, 5.5], [0, 150, 9],
  // Over a crest and down into a dip.
  [0, 162, 9], [0, 180, 7], [0, 192, 7],
  // The shelf: off to one side on a slant, straight, back on the other slant, straight.
  [36, 228, 10], [36, 252, 10], [0, 288, 13], [0, 312, 13],
];
const LEVEL = 5;
const SUB = 6;
const MOUNTAIN = 20;

/** Where a place is by the road: the leg nearest it, how far along that leg, and how far off to the side (to the left of the way the road goes is positive). */
function byRoad(x: number, z: number): { leg: number; along: number; off: number; length: number } {
  let best = { leg: 0, along: 0, off: Infinity, length: 1 };
  for (let n = 0; n < ROAD.length - 1; n++) {
    const [ax, az] = ROAD[n];
    const [bx, bz] = ROAD[n + 1];
    const length = Math.hypot(bx - ax, bz - az);
    const dx = (bx - ax) / length;
    const dz = (bz - az) / length;
    const along = (x - ax) * dx + (z - az) * dz;
    const t = Math.max(0, Math.min(length, along));
    const away = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (away < Math.abs(best.off) - 1e-6) best = { leg: n, along, off: ((x - ax) * dz - (z - az) * dx > 0 ? 1 : -1) * away, length };
  }
  return best;
}
/** How high the road is on a leg, so far along it: level near each end, a steady slope between. */
function roadHeight(leg: number, along: number, length: number): number {
  const from = ROAD[leg][2];
  const to = ROAD[leg + 1][2];
  const run = Math.max(1, length - LEVEL * 2);
  return from + (to - from) * Math.max(0, Math.min(1, (along - LEVEL) / run));
}
/** Half the road's width: narrower where it runs on the slant. */
const halfWidth = (leg: number) => (ROAD[leg][0] === ROAD[leg + 1][0] ? 6 : 4.3);

type Kind = { what: 'road' | 'hill' | 'vale' | 'grass'; leg: number };
function kindAt(x: number, z: number): Kind {
  const { leg, off } = byRoad(x, z);
  if (Math.abs(off) < halfWidth(leg)) return { what: 'road', leg };
  // Before the shelf, open ground either side. On the shelf: the mountain to the east, the drop to the west.
  if (z < 186) return { what: 'grass', leg: -1 };
  return { what: x > byRoadX(z) ? 'hill' : 'vale', leg: -1 };
}
/** Where the road is, east to west, at a given Z. */
function byRoadX(z: number): number {
  for (let n = 0; n < ROAD.length - 1; n++) {
    const [ax, az] = ROAD[n];
    const [bx, bz] = ROAD[n + 1];
    if (z >= az && z <= bz && bz > az) return ax + ((bx - ax) * (z - az)) / (bz - az);
  }
  return ROAD[ROAD.length - 1][0];
}
function heightOf(kind: Kind, x: number, z: number): number {
  if (kind.what === 'hill') return MOUNTAIN;
  if (kind.what !== 'road') return 0;
  const [ax, az] = ROAD[kind.leg];
  const [bx, bz] = ROAD[kind.leg + 1];
  const length = Math.hypot(bx - ax, bz - az);
  return roadHeight(kind.leg, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / length, length);
}
const COLOR = { road: 0x5b626b, hill: 0x7f9450, vale: 0x778b4a, grass: 0x7f9450 };
const WALL = { road: 0xa8a59c, hill: 0x8b8880, vale: 0x7d6c50, grass: 0x7d6c50 };

function pieces(): Piece[] {
  const out: Piece[] = [];
  for (let x0 = -42; x0 < 78; x0 += SUB) {
    for (let z0 = -18; z0 < 318; z0 += SUB) {
      const x1 = x0 + SUB;
      const z1 = z0 + SUB;
      const mid: Vec2 = [x0 + SUB / 2, z0 + SUB / 2];
      const corners: Vec2[] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
      // The four triangles of the square, each by what lies at its middle.
      const parts = corners.map((a, n) => {
        const b = corners[(n + 1) % 4];
        const kind = kindAt((a[0] + b[0] + mid[0]) / 3, (a[1] + b[1] + mid[1]) / 3);
        return { tri: [a, b, mid], kind };
      });
      const same = parts.every((part) => part.kind.what === parts[0].kind.what && part.kind.leg === parts[0].kind.leg);
      for (const part of same ? [{ tri: corners, kind: parts[0].kind }] : parts) {
        out.push({ pts: part.tri.map(([x, z]): [number, number, number] => [x, z, heightOf(part.kind, x, z)]), color: COLOR[part.kind.what], wall: WALL[part.kind.what] });
      }
    }
  }
  return out;
}

export function bends(): LevelDef {
  const terrain = makePieces(pieces(), -2);
  const ground = (x: number, z: number) => heightAt(terrain, x, z);
  const props: PropDesc[] = [];
  const objects: ObjectDesc[] = [];
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0) => objects.push({ kind, pos: [x, ground(x, z), z], rotY });
  // Posts along the edge of the drop, which hold nothing back; and something to hit on each landing.
  for (let z = 196; z < 310; z += 6) object('post', byRoadX(z) - (z > 198 && z < 222 || z > 258 && z < 282 ? 3.6 : 5.3), z);
  for (const [x, z] of [[2, 84], [-2, 126], [1.5, 186]]) object('crateOrange', x, z);
  for (const [x, z] of [[38, 240], [1, 300]]) object('barrel', x, z);

  return {
    id: 'bends',
    name: '山路樣品',
    brief: '三種坡度、坡頂和凹處，接一段靠山臨崖的彎路：看樣子用',
    ground: { center: [18, 150], half: [60, 168], style: 'asphalt' },
    terrain,
    bounds: [[-42, -18], [78, 318]],
    spawn: [0, 0.9, -6],
    heading: 0,
    props,
    objects,
    route: ROAD.map(([x, z]): Vec2 => [x, z]),
    decals: [],
    cargo: standardLoad(),
    traffic: [],
    stars: [0.6, 0.8],
    par: 120,
  };
}
