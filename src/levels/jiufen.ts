import { JIUFEN } from './jiufen-data';
import type { ObjectDesc, ObjectKindId } from './objects';
import { plots, seat } from './plots';
import { Relief, type Look, type RibbonPoint } from './relief';
import { standardLoad } from './sandbox';
import { heightAt } from './terrain';
import type { LevelDef, PropDesc, Vec2 } from './types';

// A trial: a real hill town's roads and the lie of its land (Jiufen; see jiufen-data.ts for where
// they come from), built as they are with Relief. The main road is the county road winding up
// the hillside; the lanes are those of the town that join it at both ends. Where the real town
// is built up the road has a pavement and a bench of level ground each side, with houses wall
// to wall on it; elsewhere it is an open mountain road. Nothing here is designed yet: it is to
// see what a real network gives to start from.

const GRASS: Look = { tag: 'grass', color: 0x7f9450, wall: 0x8b8880 };
const ROAD: Look = { tag: 'road', color: 0x5b626b, wall: 0xa8a59c };
const LANE: Look = { tag: 'road', color: 0x6a7077, wall: 0xa8a59c };
const PAVED: Look = { tag: 'paved', color: 0x9aa0a8, wall: 0xa8a59c };
const BANK: Look = { tag: 'bank', color: 0x74884a, wall: 0x8b8880 };

const [WIDE, DEEP] = JIUFEN.size;
/** Beside a built-up road: a pavement, then the houses, then a little behind them. */
const PAVEMENT = 2.6;
const DEPTH = 8;
const BENCH = PAVEMENT + DEPTH + 1.2;

/** The land as it lies: between the heights it was measured at. */
function land(x: number, z: number): number {
  const rows = JIUFEN.heights;
  const fx = Math.max(0, Math.min(rows[0].length - 1.001, x / JIUFEN.step));
  const fz = Math.max(0, Math.min(rows.length - 1.001, z / JIUFEN.step));
  const i = Math.floor(fx), j = Math.floor(fz);
  const tx = fx - i, tz = fz - j;
  return (rows[j][i] * (1 - tx) + rows[j][i + 1] * tx) * (1 - tz) + (rows[j + 1][i] * (1 - tx) + rows[j + 1][i + 1] * tx) * tz;
}

/** How far a place is from a line of points. */
function off(pts: readonly (readonly number[])[], x: number, z: number): number {
  let least = Infinity;
  for (let n = 0; n < pts.length - 1; n++) {
    const [ax, az] = pts[n];
    const [bx, bz] = pts[n + 1];
    const length = (bx - ax) ** 2 + (bz - az) ** 2;
    const t = length ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / length)) : 0;
    least = Math.min(least, Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t));
  }
  return least;
}

export function buildJiufen() {
  const relief = new Relief([0, 0], [WIDE, DEEP], 8, (x, z) => ({ h: land(x, z), look: GRASS }));
  // Each stretch of road, its benches if it is built up, and a bank from the edge of it all to the hillside.
  const made = JIUFEN.roads.map((road) => {
    const points: RibbonPoint[] = road.pts.map(([x, z, h, round]) => ({ x, z, h, round: round || undefined }));
    const edges = relief.ribbon(points, road.width, road.main ? ROAD : LANE, road.town ? { verge: { width: BENCH, look: PAVED } } : {});
    relief.slope(edges.left, 'left', { grade: 0.9, reach: 24 }, BANK);
    relief.slope(edges.right, 'right', { grade: 0.9, reach: 24 }, BANK);
    return { road, edges };
  });
  // Each junction: road from its middle out to the ends of the roads that stop short of it.
  JIUFEN.junctions.forEach(([x, z, h], j) => {
    const arms = made.flatMap(({ road, edges }) => {
      const { left, right } = edges.inner;
      return [...(road.a === j ? [[left[0], right[0]]] : []), ...(road.b === j ? [[left[left.length - 1], right[right.length - 1]]] : [])] as [[number, number, number], [number, number, number]][];
    });
    if (arms.length) relief.junction([x, z, h], arms, ROAD);
  });
  return { ...relief.build(), made };
}

export function jiufen(): LevelDef {
  const { terrain, made } = buildJiufen();
  const ground = (x: number, z: number) => heightAt(terrain, x, z);
  const props: PropDesc[] = [];
  const objects: ObjectDesc[] = [];
  const object = (kind: ObjectKindId, x: number, z: number, rotY = 0) => objects.push({ kind, pos: [x, ground(x, z), z], rotY });
  /** Whether a place is clear of every road and junction by this much. */
  // Each road, and from each end of it that stops short of a junction, on to the middle of that junction.
  const lines = JIUFEN.roads.map((road) => {
    const from = road.a >= 0 ? [JIUFEN.junctions[road.a]] : [];
    const to = road.b >= 0 ? [JIUFEN.junctions[road.b]] : [];
    return { half: road.width / 2, pts: [...from, ...road.pts, ...to] as readonly (readonly number[])[] };
  });
  const clear = (x: number, z: number, by: number) => lines.every((line) => off(line.pts, x, z) > line.half + by);
  const within = (x: number, z: number) => x > 12 && z > 12 && x < WIDE - 12 && z < DEEP - 12;

  // Where the town is built up: houses wall to wall along the back of each pavement, an alley now
  // and then, and on the pavements what stands on a street. Each house only where its bench is whole:
  // not where another road, or another road's bench at another height, has taken it.
  const WALLS = [0xd8c9a8, 0xc9b28a, 0xb9a48c, 0xd4c4a8, 0xbf8f6f, 0xcfd3d6, 0xd9b99a];
  const STANDING: ObjectKindId[] = ['lamp', 'table', 'chair', 'hydrant', 'flowerStall', 'bin', 'stool', 'fishStall', 'gasCylinder', 'bench', 'clothesRack', 'mailbox', 'chickenCage', 'box', 'betelBooth', 'signBlue'];
  const houses: Vec2[] = [];
  made.forEach(({ road, edges }, r) => {
    if (!road.town) return;
    for (const side of ['left', 'right'] as const) {
      const edge = edges.inner[side];
      for (const plot of plots(edge, side, { width: (n) => 5.5 + ((n * 7 + r) % 3), depth: DEPTH, setback: PAVEMENT, skip: (n) => (n + r) % 8 === 5 })) {
        if (!within(plot.x, plot.z) || !clear(plot.x, plot.z, DEPTH / 2 + 0.4)) continue;
        if (houses.some(([x, z]) => Math.hypot(x - plot.x, z - plot.z) < 5.2)) continue;
        const cos = Math.cos(plot.yaw), sin = Math.sin(plot.yaw);
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].map(([a, b]) => ground(plot.x + (a * plot.width * cos) / 2 + (b * DEPTH * sin) / 2, plot.z - (a * plot.width * sin) / 2 + (b * DEPTH * cos) / 2));
        if (Math.max(...corners) - Math.min(...corners) > 1.6) continue;
        const tall = 3.4 + ((plot.n * 5 + r) % 3) * 1.4;
        props.push(...seat(terrain, { shape: 'box', size: [plot.width / 2, tall, DEPTH / 2], pos: [plot.x, 0, plot.z], rot: [0, plot.yaw, 0], color: WALLS[(plot.n * 3 + r) % WALLS.length], fade: true, building: { style: 'old', open: plot.open, crown: 0, seed: 900 + r * 131 + plot.n * 17 + (side === 'left' ? 0 : 7) } }));
        houses.push([plot.x, plot.z]);
      }
      for (const [n, spot] of plots(edge, side, { width: 4.2, depth: 0, setback: 0.7 + ((r * 3) % 2) * 0.5 }).entries()) {
        const out = side === 'left' ? -1 : 1;
        const x = spot.x + Math.sin(spot.yaw) * out * (n % 3) * 0.55;
        const z = spot.z + Math.cos(spot.yaw) * out * (n % 3) * 0.55;
        if (within(x, z) && clear(x, z, 0.5)) object(STANDING[(n * 5 + r * 3 + (side === 'left' ? 0 : 7)) % STANDING.length], x, z, spot.yaw);
      }
    }
  });
  // Lamps along the open main road, a side at a time.
  made.forEach(({ road, edges }, r) => {
    if (!road.main || road.town) return;
    for (const side of ['left', 'right'] as const) {
      for (const spot of plots(edges[side], side, { width: 44, depth: 0, setback: 0.7, skip: (n) => (n + r) % 2 === (side === 'left' ? 0 : 1) })) {
        if (within(spot.x, spot.z) && clear(spot.x, spot.z, 0.3)) object('lamp', spot.x, spot.z, spot.yaw);
      }
    }
  });

  const route = JIUFEN.route;
  /** A place along the way through, and which way it runs there: so far from its start, or from its end. */
  const along = (from: number, back: boolean): { at: Vec2; yaw: number } => {
    const pts = back ? [...route].reverse() : route;
    let left = from;
    for (let n = 0; n < pts.length - 1; n++) {
      const length = Math.hypot(pts[n + 1][0] - pts[n][0], pts[n + 1][1] - pts[n][1]);
      if (left <= length) {
        const t = left / length;
        return { at: [pts[n][0] + (pts[n + 1][0] - pts[n][0]) * t, pts[n][1] + (pts[n + 1][1] - pts[n][1]) * t], yaw: Math.atan2((pts[n + 1][0] - pts[n][0]) * (back ? -1 : 1), (pts[n + 1][1] - pts[n][1]) * (back ? -1 : 1)) };
      }
      left -= length;
    }
    return { at: route[0], yaw: 0 };
  };
  const start = along(10, false);
  const end = along(22, true);
  for (const side of [-1, 1]) object('flagTeal', end.at[0] + Math.cos(end.yaw) * side * 6.5, end.at[1] - Math.sin(end.yaw) * side * 6.5);

  return {
    id: 'jiufen',
    name: '九份試作',
    brief: '照真實九份的道路和地勢做的試作：沿著公路一路開上山',
    ground: { center: [WIDE / 2, DEEP / 2], half: [WIDE / 2, DEEP / 2], style: 'earth' },
    terrain,
    bounds: [[0, 0], [WIDE, DEEP]],
    spawn: [start.at[0], ground(start.at[0], start.at[1]) + 0.9, start.at[1]],
    heading: start.yaw,
    props,
    objects,
    route,
    decals: [],
    cargo: standardLoad(),
    traffic: [],
    finish: { pos: end.at, half: [7, 7] },
    stars: [0.6, 0.8],
    par: 330,
  };
}
