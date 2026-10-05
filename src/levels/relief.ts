import type { TerrainDesc } from './terrain';

// Ground with height in it, built from what a designer says in metres:
//
//   the base       the natural lie of the land: any height at any place, cut into squares;
//   areas          polygons at a height, or on a slope: yards, terraces, ponds, a gorge;
//   ribbons        roads: a line of points, each with a height and a width, climbing at any
//                  rate, turning through rounded bends, level or banked or in steps;
//   slopes         the banks beside them: from an edge, at a given steepness, out to where
//                  they meet the land, up or down as the land requires; or out a given
//                  distance to a given height;
//   decks          bridges: slabs that are not ground, with ground or nothing beneath.
//
// Roads lie over areas, areas over slopes, and slopes over the land; within each kind, later
// ones lie over earlier ones. Everything comes out as flat triangles with sharp
// edges that are exactly where they were asked for. Where two pieces that meet are at
// different heights, an upright wall joins them: nothing has to be done to get a retaining
// wall or a kerb but to put two things of different heights side by side, and nothing has
// to be done to avoid one but to give them the same height where they meet.

export type P2 = [number, number];
/** A place and the height there: [x, z, height]. */
export type P3 = [number, number, number];

/** What a piece of ground is: its name, for whoever asks what the truck is on, and its colours. */
export interface Look {
  tag: string;
  color: number;
  /** The colour of an upright face below its edge; and of the piece itself where it is too steep for anything to grow. */
  wall: number;
}

/** What is at a place: how high, and what. */
export interface Surface {
  h: number;
  tag: string;
}

/** A line of places with heights, such as the edge of a road: something a slope can start from. */
export type Edge = P3[];

/** A height that goes with a place: a + b·x + c·z. */
type Plane = [number, number, number];
interface Piece {
  poly: P2[];
  /** Its outline before neighbours' corners were put into its edges. */
  hull?: P2[];
  plane: Plane;
  look: Look;
}
interface Tri {
  pts: [P2, P2, P2];
  plane: Plane;
  look: Look;
  /** What it lies over: slopes are 0, areas 1, roads 2. */
  layer: number;
}

const EPS = 1e-4;
const SNAP = 1000;
const snap = (v: number) => Math.round(v * SNAP) / SNAP;
const keyOf = (p: P2) => `${Math.round(p[0] * SNAP)},${Math.round(p[1] * SNAP)}`;
const cross = (a: P2, b: P2, p: P2) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const areaOf = (poly: P2[]) => {
  let sum = 0;
  for (let n = 0; n < poly.length; n++) sum += poly[n][0] * poly[(n + 1) % poly.length][1] - poly[(n + 1) % poly.length][0] * poly[n][1];
  return sum / 2;
};
const at = (plane: Plane, x: number, z: number) => plane[0] + plane[1] * x + plane[2] * z;
function planeOf(a: P3, b: P3, c: P3): Plane {
  const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(det) < 1e-9) return [a[2], 0, 0];
  const bx = ((b[2] - a[2]) * (c[1] - a[1]) - (c[2] - a[2]) * (b[1] - a[1])) / det;
  const bz = ((b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2])) / det;
  return [a[2] - bx * a[0] - bz * a[1], bx, bz];
}

/** The part of a polygon to the left of the line from `a` to `b`, or to its right. */
function clip(poly: P2[], a: P2, b: P2, left: boolean): P2[] {
  const out: P2[] = [];
  const sign = left ? 1 : -1;
  for (let n = 0; n < poly.length; n++) {
    const p = poly[n];
    const q = poly[(n + 1) % poly.length];
    const dp = cross(a, b, p) * sign;
    const dq = cross(a, b, q) * sign;
    if (dp >= 0) out.push(p);
    if ((dp > 0 && dq < 0) || (dp < 0 && dq > 0)) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

/** A simple polygon as triangles, by cutting off its ears. */
function triangulate(poly: P2[]): [P2, P2, P2][] {
  const pts = areaOf(poly) < 0 ? [...poly].reverse() : [...poly];
  const out: [P2, P2, P2][] = [];
  let guard = pts.length * pts.length;
  while (pts.length > 3 && guard-- > 0) {
    for (let n = 0; n < pts.length; n++) {
      const a = pts[(n + pts.length - 1) % pts.length];
      const b = pts[n];
      const c = pts[(n + 1) % pts.length];
      if (cross(a, b, c) <= EPS) continue;
      if (pts.some((p) => p !== a && p !== b && p !== c && cross(a, b, p) > 0 && cross(b, c, p) > 0 && cross(c, a, p) > 0)) continue;
      out.push([a, b, c]);
      pts.splice(n, 1);
      break;
    }
  }
  if (pts.length === 3) out.push([pts[0], pts[1], pts[2]]);
  return out;
}

export interface RibbonPoint {
  x: number;
  z: number;
  h: number;
  /** How wide the road is here, when it is not the ribbon's usual width. */
  width?: number;
  /** Rounds the corner at this point: the radius of the bend, metres, along the middle of the road. */
  round?: number;
  /** How much one side is above the other, as rise over run: the left of the way it is going is the higher when positive. */
  bank?: number;
}

export interface Report {
  pieces: number;
  triangles: number;
  walls: number;
  /** Corners put into edges so that neighbours meet corner to corner. */
  joined: number;
  /** Scraps too small to keep. */
  dropped: number;
  /** The steepest climb along any ribbon, rise over run. */
  steepest: number;
  /** The tightest bend along the middle of any ribbon, as a radius in metres. */
  tightest: number;
  milliseconds: number;
}

export class Relief {
  private readonly features: Tri[] = [];
  private readonly decks: { tris: [P3, P3, P3][]; look: Look; thickness: number; outline: Edge[] }[] = [];
  private steepest = 0;
  private tightest = Infinity;
  readonly nx: number;
  readonly nz: number;

  /**
   * @param min the corner with the least X and Z, and `max` the opposite one
   * @param cell the side of the squares the base is cut into, metres
   * @param base the natural ground: how high it is at a place, and what it is
   */
  constructor(private readonly min: P2, max: P2, private readonly cell: number, private readonly base: (x: number, z: number) => { h: number; look: Look }) {
    this.nx = Math.ceil((max[0] - min[0]) / cell);
    this.nz = Math.ceil((max[1] - min[1]) / cell);
  }

  /** How high the base is at a place: on the flat pieces it is cut into, so that what is built to meet it does meet it. */
  private baseAt(x: number, z: number): number {
    const i = Math.max(0, Math.min(this.nx - 1, Math.floor((x - this.min[0]) / this.cell)));
    const j = Math.max(0, Math.min(this.nz - 1, Math.floor((z - this.min[1]) / this.cell)));
    for (const piece of this.squares(i, j)) if (inside(piece.poly, [x, z])) return at(piece.plane, x, z);
    return this.base(x, z).h;
  }

  /** One square of the base: a flat piece if its corners are level with each other, or two. */
  private squares(i: number, j: number): Piece[] {
    const x0 = this.min[0] + i * this.cell;
    const z0 = this.min[1] + j * this.cell;
    const x1 = x0 + this.cell;
    const z1 = z0 + this.cell;
    // Asked for a little inside each corner: where the land steps, each square takes its own side of the step.
    const e = 0.01;
    const look = this.base((x0 + x1) / 2, (z0 + z1) / 2).look;
    const c: P3[] = [[x0, z0, this.base(x0 + e, z0 + e).h], [x1, z0, this.base(x1 - e, z0 + e).h], [x1, z1, this.base(x1 - e, z1 - e).h], [x0, z1, this.base(x0 + e, z1 - e).h]];
    const flat = planeOf(c[0], c[1], c[2]);
    if (Math.abs(at(flat, x0, z1) - c[3][2]) < 1e-3) return [{ poly: c.map(([x, z]): P2 => [x, z]), plane: flat, look }];
    return [
      { poly: [[x0, z0], [x1, z0], [x1, z1]], plane: flat, look },
      { poly: [[x0, z0], [x1, z1], [x0, z1]], plane: planeOf(c[0], c[2], c[3]), look },
    ];
  }

  private add(a: P3, b: P3, c: P3, look: Look, layer: number): void {
    const pts: [P2, P2, P2] = [[a[0], a[1]], [b[0], b[1]], [c[0], c[1]]];
    const area = areaOf(pts);
    if (Math.abs(area) < EPS) return;
    if (area < 0) pts.reverse();
    this.features.push({ pts, plane: planeOf(a, b, c), look, layer });
  }

  /** A polygon of ground at a height, or at whatever height is given for each place in it. Returns its outline, corners in the order given. */
  area(poly: P2[], height: number | ((x: number, z: number) => number), look: Look): Edge {
    const h = (p: P2): P3 => [p[0], p[1], typeof height === 'number' ? height : height(p[0], p[1])];
    for (const [a, b, c] of triangulate(poly)) this.add(h(a), h(b), h(c), look, 1);
    return [...poly, poly[0]].map(h);
  }

  /** The line a ribbon follows: its points, with bends rounded where asked, and a point every few metres between. */
  private stations(points: RibbonPoint[], width: number, step: number): { x: number; z: number; h: number; width: number; bank: number }[] {
    // The way along: corners, or arcs in place of them. Each given point is remembered by how far along it comes.
    const way: { p: P2; anchor: number }[] = [];
    points.forEach((point, n) => {
      const here: P2 = [point.x, point.z];
      const prev = points[n - 1];
      const next = points[n + 1];
      if (!prev || !next || !point.round) return void way.push({ p: here, anchor: n });
      const inLen = Math.hypot(point.x - prev.x, point.z - prev.z);
      const outLen = Math.hypot(next.x - point.x, next.z - point.z);
      const ux = (point.x - prev.x) / inLen, uz = (point.z - prev.z) / inLen;
      const vx = (next.x - point.x) / outLen, vz = (next.z - point.z) / outLen;
      const turn = Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz);
      if (Math.abs(turn) < 0.05) return void way.push({ p: here, anchor: n });
      // The bend begins this far short of the corner and ends this far past it: never more than nearly half of either leg.
      const reach = Math.min(point.round * Math.tan(Math.abs(turn) / 2), inLen * 0.48, outLen * 0.48);
      const radius = reach / Math.tan(Math.abs(turn) / 2);
      const side = Math.sign(turn);
      const cx = point.x - ux * reach - uz * side * radius;
      const cz = point.z - uz * reach + ux * side * radius;
      const from = Math.atan2(point.z - uz * reach - cz, point.x - ux * reach - cx);
      const pieces = Math.max(2, Math.ceil(Math.abs(turn) / 0.17));
      for (let k = 0; k <= pieces; k++) {
        const a = from + (turn * k) / pieces;
        way.push({ p: [cx + Math.cos(a) * radius, cz + Math.sin(a) * radius], anchor: k === Math.round(pieces / 2) ? n : -1 });
      }
    });
    // Points between, so that no length is longer than `step`.
    const dense: { p: P2; anchor: number }[] = [];
    way.forEach((w, n) => {
      if (n) {
        const before = way[n - 1].p;
        const parts = Math.ceil(Math.hypot(w.p[0] - before[0], w.p[1] - before[1]) / step);
        for (let k = 1; k < parts; k++) dense.push({ p: [before[0] + ((w.p[0] - before[0]) * k) / parts, before[1] + ((w.p[1] - before[1]) * k) / parts], anchor: -1 });
      }
      dense.push(w);
    });
    // Height, width and bank at each: by how far along it is between the given points on either side of it.
    const along: number[] = [0];
    for (let n = 1; n < dense.length; n++) along.push(along[n - 1] + Math.hypot(dense[n].p[0] - dense[n - 1].p[0], dense[n].p[1] - dense[n - 1].p[1]));
    const anchors = dense.map((d, n) => ({ n, anchor: d.anchor })).filter((d) => d.anchor >= 0);
    return dense.map((d, n) => {
      let k = 0;
      while (k < anchors.length - 2 && anchors[k + 1].n <= n) k++;
      const a = anchors[k];
      const b = anchors[Math.min(anchors.length - 1, k + 1)];
      const t = b.n === a.n ? 0 : Math.max(0, Math.min(1, (along[n] - along[a.n]) / (along[b.n] - along[a.n])));
      const pa = points[a.anchor];
      const pb = points[b.anchor];
      return { x: d.p[0], z: d.p[1], h: pa.h + (pb.h - pa.h) * t, width: (pa.width ?? width) + ((pb.width ?? width) - (pa.width ?? width)) * t, bank: (pa.bank ?? 0) + ((pb.bank ?? 0) - (pa.bank ?? 0)) * t };
    });
  }

  /** The two edges of a line of stations: to the left of the way it goes, and to the right. */
  private sides(stations: { x: number; z: number; h: number; width: number; bank: number }[]): { left: Edge; right: Edge } {
    const left: Edge = [];
    const right: Edge = [];
    stations.forEach((s, n) => {
      const before = stations[Math.max(0, n - 1)];
      const after = stations[Math.min(stations.length - 1, n + 1)];
      // Square to the way through this station: half way between the leg in and the leg out, and stretched so that the road keeps its width on both.
      const inDir = unit(s.x - before.x, s.z - before.z);
      const outDir = unit(after.x - s.x, after.z - s.z);
      const dir = unit((n ? inDir[0] : outDir[0]) + (n < stations.length - 1 ? outDir[0] : inDir[0]), (n ? inDir[1] : outDir[1]) + (n < stations.length - 1 ? outDir[1] : inDir[1]));
      const lean = n && n < stations.length - 1 ? Math.max(0.4, dir[0] * outDir[0] + dir[1] * outDir[1]) : 1;
      const half = s.width / 2 / lean;
      // Left of the way it is going: with X to the left when going toward +Z.
      const nx = dir[1];
      const nz = -dir[0];
      left.push([snap(s.x + nx * half), snap(s.z + nz * half), s.h + (s.bank * s.width) / 2]);
      right.push([snap(s.x - nx * half), snap(s.z - nz * half), s.h - (s.bank * s.width) / 2]);
    });
    return { left, right };
  }

  /**
   * A road. It climbs steadily from each point's height to the next's, turns through a
   * rounded bend wherever a point asks for one, and can change width as it goes.
   * With `tread` it goes up in steps instead, each that long and level.
   * With `verge` it has a strip of something else along each side, level with it: a pavement, a shoulder,
   * a bench of level ground for houses. A verge gives way to any road it comes over.
   * Returns its two edges, for slopes to start from: the outer edges of the verges, if it has them;
   * and `inner`, the edges of the road itself.
   */
  ribbon(points: RibbonPoint[], width: number, look: Look, options: { tread?: number; verge?: { width: number; look: Look } } = {}): { left: Edge; right: Edge; middle: Edge; inner: { left: Edge; right: Edge } } {
    const stations = this.stations(points, width, options.tread ?? 6);
    const { left, right } = this.sides(stations);
    const outer = options.verge ? this.sides(stations.map((s) => ({ ...s, width: s.width + 2 * options.verge!.width }))) : null;
    // How tight its bends are: the circle through each three stations in a row.
    for (let n = 1; n < stations.length - 1; n++) {
      const [a, b, c] = [stations[n - 1], stations[n], stations[n + 1]];
      const twice = Math.abs((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z));
      if (twice > 1e-6) this.tightest = Math.min(this.tightest, (Math.hypot(b.x - a.x, b.z - a.z) * Math.hypot(c.x - b.x, c.z - b.z) * Math.hypot(c.x - a.x, c.z - a.z)) / (2 * twice));
    }
    for (let n = 0; n < stations.length - 1; n++) {
      const run = Math.hypot(stations[n + 1].x - stations[n].x, stations[n + 1].z - stations[n].z);
      if (run > 0.01) this.steepest = Math.max(this.steepest, Math.abs(stations[n + 1].h - stations[n].h) / run);
      const flat = (p: P3, like: P3): P3 => (options.tread ? [p[0], p[1], like[2]] : p);
      const a = left[n], b = right[n], c = flat(right[n + 1], right[n]), d = flat(left[n + 1], left[n]);
      this.add(a, b, c, look, 2);
      this.add(a, c, d, look, 2);
      if (outer) {
        for (const [inner, out] of [[left, outer.left], [right, outer.right]]) {
          this.add(out[n], inner[n], flat(inner[n + 1], inner[n]), options.verge!.look, 1);
          this.add(out[n], flat(inner[n + 1], inner[n]), flat(out[n + 1], out[n]), options.verge!.look, 1);
        }
      }
    }
    return { left: outer?.left ?? left, right: outer?.right ?? right, middle: stations.map((s): P3 => [s.x, s.z, s.h]), inner: { left, right } };
  }

  /**
   * A bank from an edge. Either at a given steepness (rise over run) out to where it meets
   * the land, up if the land is above the edge there and down if it is below; or out a given
   * distance to a given height. `side` is which side of the edge it goes: left of the way
   * the edge runs, or right. Returns the line of its far edge, for a second bank to start from.
   */
  slope(edge: Edge, side: 'left' | 'right', shape: { grade: number; reach?: number } | { run: number; to: number | 'land' }, look: Look): Edge {
    const sign = side === 'left' ? 1 : -1;
    const toe: Edge = edge.map((p, n) => {
      const before = edge[Math.max(0, n - 1)];
      const after = edge[Math.min(edge.length - 1, n + 1)];
      const dir = unit(after[0] - before[0], after[1] - before[1]);
      const nx = dir[1] * sign;
      const nz = -dir[0] * sign;
      if ('run' in shape) {
        const x = p[0] + nx * shape.run;
        const z = p[1] + nz * shape.run;
        return [snap(x), snap(z), shape.to === 'land' ? this.baseAt(x, z) : shape.to];
      }
      // Out from the edge until a face of this steepness, rising or falling, reaches the land.
      const up = this.baseAt(p[0] + nx * 0.5, p[1] + nz * 0.5) > p[2];
      const reach = shape.reach ?? 40;
      let d = 0.5;
      for (; d < reach; d += 0.5) {
        const land = this.baseAt(p[0] + nx * d, p[1] + nz * d);
        const face = p[2] + (up ? 1 : -1) * shape.grade * d;
        if (up ? face >= land : face <= land) break;
      }
      const x = p[0] + nx * d;
      const z = p[1] + nz * d;
      return [snap(x), snap(z), d < reach ? this.baseAt(x, z) : p[2] + (up ? 1 : -1) * shape.grade * d];
    });
    for (let n = 0; n < edge.length - 1; n++) {
      this.add(edge[n], edge[n + 1], toe[n + 1], look, 0);
      this.add(edge[n], toe[n + 1], toe[n], look, 0);
    }
    return toe;
  }

  /**
   * A junction: road surface from a middle point out to the ends of the roads that stop short of it.
   * `arms` are those ends, each the two corners of a road's end; they are taken in order round the middle.
   */
  junction(middle: P3, arms: [P3, P3][], look: Look): void {
    const angle = (p: P3) => Math.atan2(p[1] - middle[1], p[0] - middle[0]);
    const ring = arms
      .map(([a, b]) => {
        // Each arm's own two corners in the order they come going round: the short way from one to the other.
        const turn = Math.atan2(Math.sin(angle(b) - angle(a)), Math.cos(angle(b) - angle(a)));
        return turn >= 0 ? [a, b] : [b, a];
      })
      .sort((p, q) => angle([(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2, 0]) - angle([(q[0][0] + q[1][0]) / 2, (q[0][1] + q[1][1]) / 2, 0]))
      .flat();
    for (let n = 0; n < ring.length; n++) this.add(middle, ring[n], ring[(n + 1) % ring.length], look, 2);
  }

  /** A bridge: a slab along a line of points, as wide and as thick as given. It is not ground: what is under it stays as it is. */
  deck(points: RibbonPoint[], width: number, thickness: number, look: Look): void {
    const { left, right } = this.sides(this.stations(points, width, 4));
    const tris: [P3, P3, P3][] = [];
    for (let n = 0; n < left.length - 1; n++) tris.push([left[n], right[n], right[n + 1]], [left[n], right[n + 1], left[n + 1]]);
    this.decks.push({ tris, look, thickness, outline: [left, right] });
  }

  /** Everything, as one piece of ground: what is drawn, what is solid, and what answers when asked how high a place is and what is there. */
  build(): { terrain: TerrainDesc; at: (x: number, z: number) => Surface | null; piecesAt: (x: number, z: number) => { poly: [number, number][]; hull?: [number, number][] }[]; report: Report } {
    const began = Date.now();
    const { min, cell, nx, nz } = this;
    // Which features come over which squares.
    const over: Tri[][] = Array.from({ length: nx * nz }, () => []);
    for (const tri of [0, 1, 2].flatMap((layer) => this.features.filter((f) => f.layer === layer))) {
      const xs = tri.pts.map((p) => p[0]);
      const zs = tri.pts.map((p) => p[1]);
      for (let i = Math.max(0, Math.floor((Math.min(...xs) - min[0]) / cell)); i <= Math.min(nx - 1, Math.floor((Math.max(...xs) - min[0]) / cell)); i++) {
        for (let j = Math.max(0, Math.floor((Math.min(...zs) - min[1]) / cell)); j <= Math.min(nz - 1, Math.floor((Math.max(...zs) - min[1]) / cell)); j++) over[j * nx + i].push(tri);
      }
    }
    // Each square: the base, and then each feature in turn cut out of whatever is there and laid in its place.
    let dropped = 0;
    const cells: Piece[][] = [];
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        let pieces = this.squares(i, j);
        for (const tri of over[j * nx + i]) {
          const next: Piece[] = [];
          for (const piece of pieces) {
            let rest = piece.poly;
            const outside: Piece[] = [];
            let scraps = 0;
            for (let e = 0; e < 3 && rest.length >= 3; e++) {
              const out = clip(rest, tri.pts[e], tri.pts[(e + 1) % 3], false);
              if (out.length >= 3 && Math.abs(areaOf(out)) > EPS) outside.push({ ...piece, poly: out });
              else if (out.length >= 3) scraps++;
              rest = clip(rest, tri.pts[e], tri.pts[(e + 1) % 3], true);
            }
            // None of it is under the feature: it stays as it was, in one piece, not cut along lines that only pass by.
            if (rest.length < 3 || Math.abs(areaOf(rest)) <= EPS) {
              next.push(piece);
              continue;
            }
            dropped += scraps;
            next.push(...outside, { poly: rest, plane: tri.plane, look: tri.look });
          }
          pieces = next;
        }
        // Its outline as it is now, before corners of its neighbours are put into its edges, is what answers whether a place is on it.
        for (const piece of pieces) piece.hull = piece.poly = piece.poly.map(([x, z]): P2 => [snap(x), snap(z)]);
        cells.push(pieces.filter((piece) => Math.abs(areaOf(piece.poly)) > EPS));
      }
    }

    // Neighbours must meet corner to corner: wherever a corner of one lies part way along an edge of another, the edge gets that corner too.
    const bin = (v: number) => Math.floor(v / 2);
    const corners = new Map<string, P2[]>();
    const all = cells.flat();
    for (const piece of all) {
      for (const p of piece.poly) {
        const k = `${bin(p[0])},${bin(p[1])}`;
        const list = corners.get(k);
        if (!list) corners.set(k, [p]);
        else if (!list.some((q) => q[0] === p[0] && q[1] === p[1])) list.push(p);
      }
    }
    let joined = 0;
    for (const piece of all) {
      const out: P2[] = [];
      for (let n = 0; n < piece.poly.length; n++) {
        const a = piece.poly[n];
        const b = piece.poly[(n + 1) % piece.poly.length];
        out.push(a);
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length < 2 / SNAP) continue;
        const between: { t: number; p: P2 }[] = [];
        for (let i = bin(Math.min(a[0], b[0])); i <= bin(Math.max(a[0], b[0])); i++) {
          for (let j = bin(Math.min(a[1], b[1])); j <= bin(Math.max(a[1], b[1])); j++) {
            for (const p of corners.get(`${i},${j}`) ?? []) {
              const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (length * length);
              if (t <= 1e-6 || t >= 1 - 1e-6) continue;
              if (Math.abs(cross(a, b, p)) / length < 1.5 / SNAP) between.push({ t, p });
            }
          }
        }
        between.sort((p, q) => p.t - q.t);
        for (const { p } of between) if (keyOf(p) !== keyOf(out[out.length - 1])) out.push(p);
        joined += between.length;
      }
      piece.poly = out;
    }

    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    let triangles = 0;
    // One height to a corner wherever pieces meet there level with each other: worked out twice, from two pieces, it comes out
    // a hair different each time, and then nothing that looks at the mesh can tell that they are the same corner.
    const seen = new Map<string, number[]>();
    const settle = (q: number[]): number[] => {
      const k = `${Math.round(q[0] * SNAP)},${Math.round(q[2] * SNAP)}`;
      const list = seen.get(k);
      if (!list) {
        seen.set(k, [q[1]]);
        return q;
      }
      const same = list.find((h) => Math.abs(h - q[1]) < 1e-3);
      if (same === undefined) list.push(q[1]);
      return same === undefined ? q : [q[0], same, q[2]];
    };
    const face = (corners: number[][], color: number, toward: number[]) => {
      const pts = corners.map(settle);
      const [a, b, c] = pts;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const facing = (uy * vz - uz * vy) * toward[0] + (uz * vx - ux * vz) * toward[1] + (ux * vy - uy * vx) * toward[2];
      const first = positions.length / 3;
      for (const q of facing >= 0 ? pts : [...pts].reverse()) {
        positions.push(q[0], q[1], q[2]);
        colors.push(color);
      }
      for (let n = 1; n < pts.length - 1; n++) indices.push(first, first + n, first + n + 1);
      triangles += pts.length - 2;
    };
    // The tops: each piece as a fan round its middle, so that corners lying along an edge make no flat triangles.
    for (const piece of all) {
      const mx = piece.poly.reduce((sum, p) => sum + p[0], 0) / piece.poly.length;
      const mz = piece.poly.reduce((sum, p) => sum + p[1], 0) / piece.poly.length;
      // Too steep for anything to grow: bare.
      const color = Math.hypot(piece.plane[1], piece.plane[2]) > 0.85 ? piece.look.wall : piece.look.color;
      for (let n = 0; n < piece.poly.length; n++) {
        const a = piece.poly[n];
        const b = piece.poly[(n + 1) % piece.poly.length];
        face([[mx, at(piece.plane, mx, mz), mz], [a[0], at(piece.plane, a[0], a[1]), a[1]], [b[0], at(piece.plane, b[0], b[1]), b[1]]], color, [0, 1, 0]);
      }
    }
    // The walls: every edge has a piece on each side of it; where one is above the other, an upright face between them.
    const edges = new Map<string, { piece: Piece; a: P2; b: P2 }[]>();
    for (const piece of all) {
      for (let n = 0; n < piece.poly.length; n++) {
        const a = piece.poly[n];
        const b = piece.poly[(n + 1) % piece.poly.length];
        const ka = keyOf(a);
        const kb = keyOf(b);
        if (ka === kb) continue;
        const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        const list = edges.get(k);
        if (list) list.push({ piece, a, b });
        else edges.set(k, [{ piece, a, b }]);
      }
    }
    let walls = 0;
    for (const list of edges.values()) {
      const { piece, a, b } = list[0];
      const other = list[1]?.piece;
      const topA = at(piece.plane, a[0], a[1]);
      const topB = at(piece.plane, b[0], b[1]);
      // At the edge of everything there is nothing beside it, and no wall: the world just stops.
      if (!other) continue;
      const lowA = at(other.plane, a[0], a[1]);
      const lowB = at(other.plane, b[0], b[1]);
      const dA = topA - lowA;
      const dB = topB - lowB;
      if (Math.abs(dA) < 2e-3 && Math.abs(dB) < 2e-3) continue;
      const wall = (p: P2, q: P2, hp: [number, number], hq: [number, number], upper: Piece) => {
        const mx = upper.poly.reduce((sum, v) => sum + v[0], 0) / upper.poly.length;
        const mz = upper.poly.reduce((sum, v) => sum + v[1], 0) / upper.poly.length;
        const pts = [[p[0], hp[0], p[1]], [q[0], hq[0], q[1]]];
        if (Math.abs(hq[0] - hq[1]) > 2e-3) pts.push([q[0], hq[1], q[1]]);
        if (Math.abs(hp[0] - hp[1]) > 2e-3) pts.push([p[0], hp[1], p[1]]);
        if (pts.length < 3) return;
        face(pts, upper.look.wall, [(p[0] + q[0]) / 2 - mx, 0, (p[1] + q[1]) / 2 - mz]);
        walls++;
      };
      if (dA >= -2e-3 && dB >= -2e-3) wall(a, b, [topA, lowA], [topB, lowB], piece);
      else if (dA <= 2e-3 && dB <= 2e-3) wall(a, b, [lowA, topA], [lowB, topB], other);
      else {
        // They cross: one is the higher at one end and the other at the other.
        const t = dA / (dA - dB);
        const m: P2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const hm = topA + (topB - topA) * t;
        wall(a, m, dA > 0 ? [topA, lowA] : [lowA, topA], [hm, hm], dA > 0 ? piece : other);
        wall(m, b, [hm, hm], dB > 0 ? [topB, lowB] : [lowB, topB], dB > 0 ? piece : other);
      }
    }
    // The decks: a top, an underside, and faces round the sides.
    const deckTops: { poly: P2[]; plane: Plane; look: Look }[] = [];
    for (const deck of this.decks) {
      for (const tri of deck.tris) {
        face(tri.map(([x, z, h]) => [x, h, z]), deck.look.color, [0, 1, 0]);
        face(tri.map(([x, z, h]) => [x, h - deck.thickness, z]), deck.look.wall, [0, -1, 0]);
        deckTops.push({ poly: tri.map(([x, z]): P2 => [x, z]), plane: planeOf(tri[0], tri[1], tri[2]), look: deck.look });
      }
      const [left, right] = deck.outline;
      const rim = [...left, ...[...right].reverse(), left[0]];
      const mx = rim.reduce((sum, p) => sum + p[0], 0) / rim.length;
      const mz = rim.reduce((sum, p) => sum + p[1], 0) / rim.length;
      for (let n = 0; n < rim.length - 1; n++) {
        const a = rim[n];
        const b = rim[n + 1];
        face([[a[0], a[2], a[1]], [b[0], b[2], b[1]], [b[0], b[2] - deck.thickness, b[1]], [a[0], a[2] - deck.thickness, a[1]]], deck.look.wall, [(a[0] + b[0]) / 2 - mx, 0, (a[1] + b[1]) / 2 - mz]);
      }
    }

    // The highest thing at a place; or, where a height is given, the highest that is not above it: a deck may pass over ground, or over itself.
    const find = (x: number, z: number, below: number): Surface | null => {
      let best: Surface | null = null;
      for (const top of deckTops) {
        if (!inside(top.poly, [x, z])) continue;
        const h = at(top.plane, x, z);
        if (h <= below && (!best || h > best.h)) best = { h, tag: top.look.tag };
      }
      const i = Math.floor((x - min[0]) / cell);
      const j = Math.floor((z - min[1]) / cell);
      if (i < 0 || j < 0 || i >= nx || j >= nz) return best;
      for (const piece of cells[j * nx + i]) {
        if (!inside(piece.hull ?? piece.poly, [x, z])) continue;
        const h = at(piece.plane, x, z);
        if ((h <= below || !best) && (!best || h > best.h)) best = { h, tag: piece.look.tag };
      }
      return best;
    };
    // Where three pieces meet, a place can fall in the hair's breadth between them and be on none: then the ground beside it will do.
    const query = (x: number, z: number, below = Infinity): Surface | null =>
      find(x, z, below) ?? find(x + 0.004, z + 0.003, below) ?? find(x - 0.004, z - 0.003, below) ?? find(x + 0.003, z - 0.004, below) ?? find(x - 0.003, z + 0.004, below);
    const terrain: TerrainDesc = { min, cell, nx: 0, nz: 0, heights: [], colors, stepped: { patches: [], positions, indices }, surface: query };
    // For looking into it: the pieces of the square a place is in.
    const piecesAt = (x: number, z: number) => cells[Math.floor((z - min[1]) / cell) * nx + Math.floor((x - min[0]) / cell)] ?? [];
    return { terrain, at: query, piecesAt, report: { pieces: all.length, triangles, walls, joined, dropped, steepest: this.steepest, tightest: this.tightest, milliseconds: Date.now() - began } };
  }
}

const unit = (x: number, z: number): P2 => {
  const length = Math.hypot(x, z) || 1;
  return [x / length, z / length];
};

/** Whether a place is within a polygon whose corners all turn the same way, its edge included. */
function inside(poly: P2[], p: P2): boolean {
  let sign = 0;
  for (let n = 0; n < poly.length; n++) {
    const a = poly[n];
    const b = poly[(n + 1) % poly.length];
    // An edge a few millimetres long points nowhere in particular: it says nothing of which side a place is on.
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 0.01) continue;
    // How far to one side of the edge the place is, metres: on it, to within a millimetre, is in. Corners are kept to the
    // millimetre, so which way a short edge points is only roughly known, and the less well the further along its line the place is.
    const side = cross(a, b, p) / length;
    if (Math.abs(side) < 1.5e-3 * (1 + Math.hypot(p[0] - a[0], p[1] - a[1]) / length)) continue;
    if (sign === 0) sign = Math.sign(side);
    else if (Math.sign(side) !== sign) return false;
  }
  return true;
}
