import type { Vec2 } from './types';

// Ground that rises and falls: heights on a square grid, each square cut corner to corner
// into two triangles. The same triangles are what is driven on and what is drawn, and
// `heightAt` reads the height off them, so the three never disagree.

export interface TerrainDesc {
  /** The corner of the grid with the least X and the least Z. */
  min: Vec2;
  /** The side of a square, metres. */
  cell: number;
  /** How many squares there are along X, and along Z. */
  nx: number;
  nz: number;
  /** Heights at the corners of the squares, a row at a time along Z: nx + 1 to a row. */
  heights: number[];
  /** What colour the ground is at each of those corners. */
  colors: number[];
  /**
   * Set when the ground is not a rolling sheet but level and sloping pieces with upright
   * walls between them: the pieces, and the corners and triangles they and their walls come
   * to. `colors` is then by those corners, and the grid above is not used.
   */
  stepped?: { patches: Patch[]; positions: number[]; indices: number[] };
  /** Set by whatever built the ground when it can say what is at a place, as well as how high: the height there, and the name of what it is. */
  surface?: (x: number, z: number, below?: number) => { h: number; tag: string } | null;
  /** Set when the ground is pieces of any shape, not only rectangles square to the axes: see `makePieces`. `stepped` is set as well, with no patches, for whoever only asks whether the ground is in pieces. */
  pieces?: Piece[];
}

/**
 * One piece of ground of any shape: three or four corners, each [x, z, height], in order
 * round it, lying in one plane. Where an edge of it stands above what is beside it, a wall
 * goes straight down from that edge.
 */
export interface Piece {
  pts: [number, number, number][];
  color: number;
  /** The colour of the walls below its edges. */
  wall: number;
}

/**
 * One piece of ground: a rectangle, level or sloping, given by the height at each of its
 * corners in the order (x0, z0), (x1, z0), (x0, z1), (x1, z1). Where it stands above what
 * is beside it, a wall goes straight down from its edge.
 */
export interface Patch {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  h: [number, number, number, number];
  color: number;
  /** The colour of the walls below its edges. */
  wall: number;
}

const onPatch = (p: Patch, x: number, z: number) => {
  const u = (x - p.x0) / (p.x1 - p.x0);
  const v = (z - p.z0) / (p.z1 - p.z0);
  return (p.h[0] * (1 - u) + p.h[1] * u) * (1 - v) + (p.h[2] * (1 - u) + p.h[3] * u) * v;
};

/** The highest piece over a place, and its height there; or nothing, where there is no piece. */
function highest(patches: Patch[], x: number, z: number, but?: Patch): number | null {
  let best: number | null = null;
  for (const p of patches) {
    if (p === but || x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
    const h = onPatch(p, x, z);
    if (best === null || h > best) best = h;
  }
  return best;
}

/**
 * Ground made of pieces. Each is drawn and is solid as it is given; and wherever the edge of
 * one stands above its neighbour, or above nothing, a wall is put in from that edge down to
 * the neighbour, or to `floor`. So a step from one height to another is upright and sharp.
 */
export function makeStepped(patches: Patch[], floor: number): TerrainDesc {
  const positions: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], color: number, toward: number[]) => {
    // The right way round: seen from the side that `toward` is on.
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    const facing = (uy * vz - uz * vy) * toward[0] + (uz * vx - ux * vz) * toward[1] + (ux * vy - uy * vx) * toward[2];
    const first = positions.length / 3;
    for (const p of facing >= 0 ? [a, b, c, d] : [a, d, c, b]) {
      positions.push(p[0], p[1], p[2]);
      colors.push(color);
    }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  };
  const EPS = 0.02;
  for (const p of patches) {
    const [h00, h10, h01, h11] = p.h;
    quad([p.x0, h00, p.z0], [p.x1, h10, p.z0], [p.x1, h11, p.z1], [p.x0, h01, p.z1], p.color, [0, 1, 0]);
    // Its four edges: from, to, and the way out across each.
    const edges: [[number, number], [number, number], [number, number]][] = [
      [[p.x0, p.z0], [p.x1, p.z0], [0, -1]],
      [[p.x1, p.z1], [p.x0, p.z1], [0, 1]],
      [[p.x0, p.z1], [p.x0, p.z0], [-1, 0]],
      [[p.x1, p.z0], [p.x1, p.z1], [1, 0]],
    ];
    for (const [from, to, out] of edges) {
      // Cut the edge wherever a neighbour begins or ends beside it: what lies across it changes there.
      const alongX = out[0] === 0;
      const lo = Math.min(alongX ? from[0] : from[1], alongX ? to[0] : to[1]);
      const hi = Math.max(alongX ? from[0] : from[1], alongX ? to[0] : to[1]);
      const cuts = [...new Set([lo, hi, ...patches.flatMap((q) => (alongX ? [q.x0, q.x1] : [q.z0, q.z1])).filter((v) => v > lo && v < hi)])].sort((a, b) => a - b);
      for (let n = 0; n < cuts.length - 1; n++) {
        const ends = [cuts[n], cuts[n + 1]].map((v, k) => {
          const x = alongX ? v : from[0];
          const z = alongX ? from[1] : v;
          // What lies just across the edge, a hair in from this end of the length.
          const inward = (k ? -1 : 1) * EPS;
          const across = highest(patches, x + out[0] * EPS + (alongX ? inward : 0), z + out[1] * EPS + (alongX ? 0 : inward), p) ?? floor;
          const top = onPatch(p, x, z);
          return { x, z, top, bottom: Math.min(top, across) };
        });
        if (ends[0].top - ends[0].bottom < EPS && ends[1].top - ends[1].bottom < EPS) continue;
        quad([ends[0].x, ends[0].top, ends[0].z], [ends[1].x, ends[1].top, ends[1].z], [ends[1].x, ends[1].bottom, ends[1].z], [ends[0].x, ends[0].bottom, ends[0].z], p.wall, [out[0], 0, out[1]]);
      }
    }
  }
  return { min: [0, 0], cell: 1, nx: 0, nz: 0, heights: [], colors, stepped: { patches, positions, indices } };
}

// ---------------------------------------------------------------- pieces of any shape

/** Pieces sorted into squares of ground this big, so that finding the one over a place does not mean looking at them all. */
const BUCKET = 12;
type Index = Map<number, Piece[]>;
const indexes = new WeakMap<Piece[], Index>();
const key = (i: number, j: number) => i * 65536 + j;

function indexOf(pieces: Piece[]): Index {
  let index = indexes.get(pieces);
  if (index) return index;
  index = new Map();
  for (const piece of pieces) {
    const xs = piece.pts.map((q) => q[0]);
    const zs = piece.pts.map((q) => q[1]);
    for (let i = Math.floor(Math.min(...xs) / BUCKET); i <= Math.floor(Math.max(...xs) / BUCKET); i++) {
      for (let j = Math.floor(Math.min(...zs) / BUCKET); j <= Math.floor(Math.max(...zs) / BUCKET); j++) {
        const k = key(i + 4096, j + 4096);
        const list = index.get(k);
        if (list) list.push(piece);
        else index.set(k, [piece]);
      }
    }
  }
  indexes.set(pieces, index);
  return index;
}

/** How high a piece is at a place, if the place is over it. */
function onPiece(piece: Piece, x: number, z: number): number | null {
  const { pts } = piece;
  // Over it if it is on the same side of every edge, whichever way round the corners were given.
  let sign = 0;
  for (let n = 0; n < pts.length; n++) {
    const [ax, az] = pts[n];
    const [bx, bz] = pts[(n + 1) % pts.length];
    const side = (bx - ax) * (z - az) - (bz - az) * (x - ax);
    if (Math.abs(side) < 1e-6) continue;
    if (sign === 0) sign = Math.sign(side);
    else if (Math.sign(side) !== sign) return null;
  }
  // The plane through its first three corners.
  const [[x0, z0, h0], [x1, z1, h1], [x2, z2, h2]] = pts;
  const det = (x1 - x0) * (z2 - z0) - (x2 - x0) * (z1 - z0);
  const u = ((x - x0) * (z2 - z0) - (x2 - x0) * (z - z0)) / det;
  const v = ((x1 - x0) * (z - z0) - (x - x0) * (z1 - z0)) / det;
  return h0 + (h1 - h0) * u + (h2 - h0) * v;
}

/** The highest piece over a place, and its height there; or nothing, where there is no piece. */
function over(index: Index, x: number, z: number, but?: Piece): number | null {
  let best: number | null = null;
  for (const piece of index.get(key(Math.floor(x / BUCKET) + 4096, Math.floor(z / BUCKET) + 4096)) ?? []) {
    if (piece === but) continue;
    const h = onPiece(piece, x, z);
    if (h !== null && (best === null || h > best)) best = h;
  }
  return best;
}

/**
 * Ground made of pieces of any shape. Each is drawn and is solid as it is given; and wherever
 * an edge of one stands above whatever is beside it, or above nothing, a wall is put in from
 * that edge down to it, or to `floor`. So a road can run at any angle, climb at any rate,
 * and still have a clean edge and an upright face below it.
 */
export function makePieces(pieces: Piece[], floor: number): TerrainDesc {
  const index = indexOf(pieces);
  const positions: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];
  const face = (corners: number[][], color: number, toward: number[]) => {
    const [a, b, c] = corners;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const facing = (uy * vz - uz * vy) * toward[0] + (uz * vx - ux * vz) * toward[1] + (ux * vy - uy * vx) * toward[2];
    const first = positions.length / 3;
    for (const q of facing >= 0 ? corners : [...corners].reverse()) {
      positions.push(q[0], q[1], q[2]);
      colors.push(color);
    }
    for (let n = 1; n < corners.length - 1; n++) indices.push(first, first + n, first + n + 1);
  };
  const EPS = 0.03;
  for (const piece of pieces) {
    const { pts } = piece;
    face(pts.map(([x, z, h]) => [x, h, z]), piece.color, [0, 1, 0]);
    const mx = pts.reduce((sum, q) => sum + q[0], 0) / pts.length;
    const mz = pts.reduce((sum, q) => sum + q[1], 0) / pts.length;
    for (let n = 0; n < pts.length; n++) {
      const [ax, az, ah] = pts[n];
      const [bx, bz, bh] = pts[(n + 1) % pts.length];
      const length = Math.hypot(bx - ax, bz - az);
      // The way out across this edge: square to it, and away from the middle of the piece.
      let nx = (bz - az) / length;
      let nz = -(bx - ax) / length;
      if (nx * (ax - mx) + nz * (az - mz) < 0) {
        nx = -nx;
        nz = -nz;
      }
      // Along the edge a metre or so at a time: what lies across it may change anywhere.
      const steps = Math.max(1, Math.ceil(length / 1.5));
      const cut = (t: number, inward: number) => {
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        const top = ah + (bh - ah) * t;
        // A hair in from this end of the length, so as to ask about this length and not the next.
        const s = t + (inward * EPS) / length;
        const across = over(index, ax + (bx - ax) * s + nx * EPS, az + (bz - az) * s + nz * EPS, piece) ?? floor;
        return { x, z, top, bottom: Math.min(top, across) };
      };
      for (let k = 0; k < steps; k++) {
        const from = cut(k / steps, 1);
        const to = cut((k + 1) / steps, -1);
        if (from.top - from.bottom < EPS && to.top - to.bottom < EPS) continue;
        face([[from.x, from.top, from.z], [to.x, to.top, to.z], [to.x, to.bottom, to.z], [from.x, from.bottom, from.z]], piece.wall, [nx, 0, nz]);
      }
    }
  }
  return { min: [0, 0], cell: 1, nx: 0, nz: 0, heights: [], colors, pieces, stepped: { patches: [], positions, indices } };
}

/**
 * Lay a grid over a rectangle and ask for the height at each corner of it, and then for the
 * colour there, given the height and how steep it is (rise over run).
 */
export function makeTerrain(min: Vec2, max: Vec2, cell: number, height: (x: number, z: number) => number, color: (x: number, z: number, h: number, slope: number) => number): TerrainDesc {
  const nx = Math.ceil((max[0] - min[0]) / cell);
  const nz = Math.ceil((max[1] - min[1]) / cell);
  const heights: number[] = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) heights.push(height(min[0] + i * cell, min[1] + j * cell));
  const at = (i: number, j: number) => heights[Math.max(0, Math.min(nz, j)) * (nx + 1) + Math.max(0, Math.min(nx, i))];
  const colors: number[] = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const slope = Math.hypot(at(i + 1, j) - at(i - 1, j), at(i, j + 1) - at(i, j - 1)) / (2 * cell);
      colors.push(color(min[0] + i * cell, min[1] + j * cell, at(i, j), slope));
    }
  }
  return { min, cell, nx, nz, heights, colors };
}

/** How high the ground is at a place. Level, at nought, where there is no terrain; and held at its edge beyond the edge of it. */
export function heightAt(terrain: TerrainDesc | undefined, x: number, z: number, below?: number): number {
  if (!terrain) return 0;
  if (terrain.surface) return terrain.surface(x, z, below)?.h ?? 0;
  if (terrain.pieces) return over(indexOf(terrain.pieces), x, z) ?? 0;
  if (terrain.stepped) return highest(terrain.stepped.patches, x, z) ?? 0;
  const { min, cell, nx, nz, heights } = terrain;
  const u = Math.max(0, Math.min(nx - 1e-6, (x - min[0]) / cell));
  const v = Math.max(0, Math.min(nz - 1e-6, (z - min[1]) / cell));
  const i = Math.floor(u);
  const j = Math.floor(v);
  const fx = u - i;
  const fz = v - j;
  const row = j * (nx + 1) + i;
  const h00 = heights[row];
  const h10 = heights[row + 1];
  const h01 = heights[row + nx + 1];
  const h11 = heights[row + nx + 2];
  // The square is cut from its least corner to its greatest: which side of the cut is this?
  return fx >= fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz : h00 + (h01 - h00) * fz + (h11 - h01) * fx;
}

/** The corners and the triangles, for whoever is to make a solid or a picture of it. Every triangle faces up. */
export function terrainMesh(terrain: TerrainDesc): { positions: Float32Array; indices: Uint32Array } {
  if (terrain.stepped) return { positions: new Float32Array(terrain.stepped.positions), indices: new Uint32Array(terrain.stepped.indices) };
  const { min, cell, nx, nz, heights } = terrain;
  const positions = new Float32Array((nx + 1) * (nz + 1) * 3);
  for (let j = 0, n = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++, n++) {
      positions[n * 3] = min[0] + i * cell;
      positions[n * 3 + 1] = heights[n];
      positions[n * 3 + 2] = min[1] + j * cell;
    }
  }
  const indices = new Uint32Array(nx * nz * 6);
  for (let j = 0, n = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const d = a + nx + 1;
      const c = d + 1;
      indices[n++] = a; indices[n++] = c; indices[n++] = b;
      indices[n++] = a; indices[n++] = d; indices[n++] = c;
    }
  }
  return { positions, indices };
}
