import type { Vec3 } from '../config';
import { Relief, type Look } from './relief';
import type { DecalDesc, LevelDef, PropDesc, Vec2 } from './types';

// A level drawn on the flat, laid on ground with height in it: every street, pavement, house
// and thing in it keeps its place on the map and is put at the height of the ground there.
// The ground is given square by square, on the same squares the map is drawn on: level, or
// sloping one way or the other, and stepping up or down between squares wherever it is told to,
// which makes a wall.

type Rect = [number, number, number, number];

/** How high the ground is, everywhere: a height for the whole map, and over it rectangles (on the squares) that are level or slope. */
export class Heights {
  private readonly patches: { rect: Rect; at: (x: number, z: number) => number }[] = [];

  /**
   * @param cell the side of a square, and `origin` a corner of one
   * @param base the height where nothing else is said: it may change its slope only on the lines between squares
   */
  constructor(readonly cell: number, readonly origin: Vec2, private readonly base: (x: number, z: number) => number = () => 0) {}

  /** Level ground over a rectangle [x0, z0, x1, z1]. */
  level(rect: Rect, height: number): this {
    this.patches.push({ rect, at: () => height });
    return this;
  }

  /** Ground sloping steadily across a rectangle: from one height at its low-X (or low-Z) edge to another at the opposite one. */
  ramp(rect: Rect, toward: 'x' | 'z', from: number, to: number): this {
    const [x0, z0, x1, z1] = rect;
    this.patches.push({ rect, at: (x, z) => from + (to - from) * (toward === 'x' ? (x - x0) / (x1 - x0) : (z - z0) / (z1 - z0)) });
    return this;
  }

  at(x: number, z: number): number {
    for (let n = this.patches.length - 1; n >= 0; n--) {
      const [x0, z0, x1, z1] = this.patches[n].rect;
      if (x >= x0 && x < x1 && z >= z0 && z < z1) return this.patches[n].at(x, z);
    }
    return this.base(x, z);
  }

  /** The lines between squares that cross a length, along X (0) or Z (1). */
  lines(axis: 0 | 1, lo: number, hi: number): number[] {
    const out: number[] = [];
    for (let v = this.origin[axis] + Math.ceil((lo + 0.05 - this.origin[axis]) / this.cell) * this.cell; v < hi - 0.05; v += this.cell) out.push(v);
    return out;
  }
}

/** A height by how far north only: [z, height], from south to north; level before the first and after the last. */
export type Profile = [number, number][];

/** A colour a shade darker: a footing under a house is the house's own plaster, in its shadow. */
const shade = (c: number) => ((Math.round(((c >> 16) & 255) * 0.78) << 16) | (Math.round(((c >> 8) & 255) * 0.78) << 8) | Math.round((c & 255) * 0.78));

export function heightOf(profile: Profile, z: number): number {
  if (z <= profile[0][0]) return profile[0][1];
  for (let n = 1; n < profile.length; n++) {
    const [z0, h0] = profile[n - 1];
    const [z1, h1] = profile[n];
    if (z <= z1) return h0 + ((h1 - h0) * (z - z0)) / (z1 - z0);
  }
  return profile[profile.length - 1][1];
}

export interface LiftLooks {
  ground: Look;
  pit: Look;
  footing: number;
}

interface Part {
  rect: Rect;
  /** The height at its middle, and how it slopes: rise over run toward +X and toward +Z. */
  h: number;
  sx: number;
  sz: number;
}

/** What else is to be done in laying a level on the ground: more ground beyond it, with roads and the like laid on it; and places to clear of whatever the level had there. */
export interface LiftMore {
  bounds?: [Vec2, Vec2];
  add?: (relief: Relief) => void;
  clear?: Rect[];
}

export function lift(flat: LevelDef, heights: Heights, looks: LiftLooks, more: LiftMore = {}): LevelDef {
  const g = (x: number, z: number) => heights.at(x, z);
  // Cleared away: anything whose footprint touches a place to clear.
  const touches = (x0: number, z0: number, x1: number, z1: number) => (more.clear ?? []).some(([a, b, c, d]) => x1 > a && x0 < c && z1 > b && z0 < d);
  const reach = (p: PropDesc) => {
    const yaw = p.rot?.[1] ?? 0;
    const [a, c] = p.shape === 'box' ? [p.size[0], p.size[2]] : [p.size[0], p.size[0]];
    return [Math.abs(Math.cos(yaw)) * a + Math.abs(Math.sin(yaw)) * c, Math.abs(Math.sin(yaw)) * a + Math.abs(Math.cos(yaw)) * c];
  };
  const level: LevelDef = more.clear
    ? {
        ...flat,
        props: flat.props.filter((p) => { const [ex, ez] = reach(p); return !touches(p.pos[0] - ex, p.pos[2] - ez, p.pos[0] + ex, p.pos[2] + ez); }),
        objects: flat.objects?.filter((o) => !touches(o.pos[0], o.pos[2], o.pos[0], o.pos[2])),
        decals: flat.decals.filter((d) => !touches(d.pos[0], d.pos[1], d.pos[0], d.pos[1])),
      }
    : flat;
  const INSET = 0.02;
  /** The lie of the ground over a rectangle that is within one square. */
  const lie = (rect: Rect): Part => {
    const [x0, z0, x1, z1] = rect;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const flat = (v: number) => (Math.abs(v) < 1e-6 ? 0 : v);
    return { rect, h: g(cx, cz), sx: flat((g(x1 - INSET, cz) - g(x0 + INSET, cz)) / (x1 - x0 - 2 * INSET)), sz: flat((g(cx, z1 - INSET) - g(cx, z0 + INSET)) / (z1 - z0 - 2 * INSET)) };
  };
  /** A rectangle cut along the lines between squares: across X, across Z, or both. */
  const cut = (rect: Rect, acrossX = true, acrossZ = true): Rect[] => {
    const xs = [rect[0], ...(acrossX ? heights.lines(0, rect[0], rect[2]) : []), rect[2]];
    const zs = [rect[1], ...(acrossZ ? heights.lines(1, rect[1], rect[3]) : []), rect[3]];
    const out: Rect[] = [];
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) out.push([xs[i], zs[j], xs[i + 1], zs[j + 1]]);
    return out;
  };
  /** How the ground under a rectangle varies: not at all, or along X, or along Z. */
  const over = (rect: Rect): { level: boolean; alongX: boolean; alongZ: boolean } => {
    const parts = cut(rect).map(lie);
    const same = (a: number, b: number) => Math.abs(a - b) < 1e-4;
    const alongX = parts.some((p) => p.sx !== 0 || parts.some((q) => same(p.rect[1], q.rect[1]) && !same(p.h, q.h)));
    const alongZ = parts.some((p) => p.sz !== 0 || parts.some((q) => same(p.rect[0], q.rect[0]) && !same(p.h, q.h)));
    return { level: !alongX && !alongZ, alongX, alongZ };
  };
  /** How to turn a thing lying flat so that it lies along the slope, and how much longer it must be each way to cover the same ground. */
  const lean = (part: Part) => {
    const back = -Math.atan(part.sz);
    const side = Math.atan(part.sx * Math.cos(back));
    return { back, side, wide: 1 / Math.cos(side), long: 1 / Math.cos(back) };
  };

  const props: PropDesc[] = [];
  for (const p of level.props) {
    const raised = (): PropDesc => ({ ...p, pos: [p.pos[0], p.pos[1] + g(p.pos[0], p.pos[2]), p.pos[2]] });
    const yaw = p.rot?.[1] ?? 0;
    const upright = !p.rot || (p.rot[0] === 0 && p.rot[2] === 0);
    const quarter = Math.abs(Math.sin(yaw)) > 0.999;
    if (p.shape !== 'box' || p.mass !== undefined || !upright || !(quarter || Math.abs(Math.sin(yaw)) < 0.001)) {
      props.push(raised());
      continue;
    }
    // How far it reaches east and west, and north and south, of its middle.
    const [ex, ez] = quarter ? [p.size[2], p.size[0]] : [p.size[0], p.size[2]];
    const rect: Rect = [p.pos[0] - ex, p.pos[2] - ez, p.pos[0] + ex, p.pos[2] + ez];
    const ground = over(rect);
    if (ground.level || (!p.building && ex < 1.2 && ez < 1.2) || (p.building && quarter)) {
      props.push(raised());
      continue;
    }
    if (p.building) {
      // A block of houses on a slope: in lengths, each with its floor level at the highest ground under it (none of it sunk in the
      // hill) and a footing under its low side, stepping up the hill.
      const nx = ground.alongX ? Math.ceil((2 * ex) / 11) : 1;
      const nz = ground.alongZ ? Math.ceil((2 * ez) / 11) : 1;
      const { open } = p.building;
      for (let i = 0; i < nx; i++) {
        for (let k = 0; k < nz; k++) {
          const x0 = rect[0] + (2 * ex * i) / nx, x1 = rect[0] + (2 * ex * (i + 1)) / nx;
          const z0 = rect[1] + (2 * ez * k) / nz, z1 = rect[1] + (2 * ez * (k + 1)) / nz;
          const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
          const under = [g(x0 + INSET, z0 + INSET), g(x1 - INSET, z0 + INSET), g(x0 + INSET, z1 - INSET), g(x1 - INSET, z1 - INSET), g(cx, cz)];
          const floor = Math.max(...under);
          const low = Math.min(...under);
          props.push({ ...p, size: [(x1 - x0) / 2, p.size[1], (z1 - z0) / 2], pos: [cx, p.pos[1] + floor, cz], building: { ...p.building, open: [open[0] && i === 0, open[1] && i === nx - 1, open[2] && k === 0, open[3] && k === nz - 1], seed: p.building.seed + (i * 7 + k) * 101 } });
          if (floor - low > 0.03) {
            const half = (floor - low) / 2 + 0.2;
            props.push({ shape: 'box', size: [(x1 - x0) / 2, half, (z1 - z0) / 2], pos: [cx, p.pos[1] - p.size[1] + floor - half, cz], color: shade(p.color) });
          }
        }
      }
      continue;
    }
    // A pavement, a kerb, a wall, a line of anything laid along the ground: in pieces, each laid along the slope it is on.
    for (const piece of cut(rect, ground.alongX, ground.alongZ)) {
      const part = lie(piece);
      const { back, side, wide, long } = lean(part);
      props.push({ ...p, size: [((piece[2] - piece[0]) / 2) * wide, p.size[1], ((piece[3] - piece[1]) / 2) * long], pos: [(piece[0] + piece[2]) / 2, p.pos[1] + part.h, (piece[1] + piece[3]) / 2], rot: back || side ? [back, 0, side] : undefined });
    }
  }

  const decals: DecalDesc[] = [];
  for (const d of level.decals) {
    const turned = Math.abs(Math.sin(d.rotY ?? 0));
    const [ex, ez] = turned > 0.999 ? [d.size[1] / 2, d.size[0] / 2] : [d.size[0] / 2, d.size[1] / 2];
    const rect: Rect = [d.pos[0] - ex, d.pos[1] - ez, d.pos[0] + ex, d.pos[1] + ez];
    const square = turned < 0.001 || turned > 0.999;
    const ground = square ? over(rect) : null;
    if (!ground || ground.level) {
      // Turned to some odd angle, or on the level: where it is, by the ground at its middle.
      const here = lie([d.pos[0] - 0.5, d.pos[1] - 0.5, d.pos[0] + 0.5, d.pos[1] + 0.5]);
      decals.push({ ...d, base: here.h, tilt: here.sx || here.sz ? [here.sx, here.sz] : undefined });
      continue;
    }
    for (const piece of cut(rect, ground.alongX, ground.alongZ)) {
      const part = lie(piece);
      const [w, l] = [piece[2] - piece[0], piece[3] - piece[1]];
      decals.push({ ...d, pos: [(piece[0] + piece[2]) / 2, (piece[1] + piece[3]) / 2], size: turned > 0.999 ? [l, w] : [w, l], base: part.h, tilt: part.sx || part.sz ? [part.sx, part.sz] : undefined });
    }
  }

  const up = (pos: Vec3): Vec3 => [pos[0], pos[1] + g(pos[0], pos[2]), pos[2]];
  const [[minX, minZ], [maxX, maxZ]] = more.bounds ?? level.bounds;
  // The ground: the squares, each as it lies; and each pit dug in it.
  const { cell, origin } = heights;
  const corner = (axis: 0 | 1, least: number) => origin[axis] - Math.ceil((origin[axis] - (least - 24)) / cell) * cell;
  const relief = new Relief([corner(0, minX), corner(1, minZ)], [maxX + 24 + cell, maxZ + 24 + cell], cell, (x, z) => ({ h: g(x, z), look: looks.ground }));
  for (const pit of level.pits ?? []) {
    for (const [x0, z0, x1, z1] of cut([pit.pos[0] - pit.half[0], pit.pos[1] - pit.half[1], pit.pos[0] + pit.half[0], pit.pos[1] + pit.half[1]])) {
      // Its floor lies as the ground it is dug in does: by the ground just inside each of its corners.
      const floor = (x: number, z: number) => g(Math.max(x0 + INSET, Math.min(x1 - INSET, x)), Math.max(z0 + INSET, Math.min(z1 - INSET, z))) - pit.depth;
      relief.area([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], floor, looks.pit);
    }
  }
  more.add?.(relief);
  const middle = (level.bounds[0][0] + level.bounds[1][0]) / 2;

  return {
    ...level,
    terrain: relief.build().terrain,
    props,
    decals,
    objects: level.objects?.map((o) => ({ ...o, pos: up(o.pos) })),
    pits: level.pits?.map((p) => ({ ...p, base: g(p.pos[0], p.pos[1]) })),
    tracks: level.tracks?.map((t) => ({ ...t, y: g(middle, t.z) })),
    slicks: level.slicks?.map((s) => ({ ...s, y: g(s.pos[0], s.pos[1]) })),
    signs: level.signs?.map((s) => ({ ...s, pos: up(s.pos) })),
    signals: level.signals?.map((s) => ({ ...s, pos: up(s.pos) })),
    gates: level.gates?.map((t) => ({ ...t, pos: up(t.pos) })),
    fountains: level.fountains?.map(up),
    spawn: up(level.spawn),
  };
}
