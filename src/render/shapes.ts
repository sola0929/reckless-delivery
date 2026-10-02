import * as THREE from 'three';
import { BLANK, RIBS, type UV } from './signs';

type P = [number, number, number];

/** A rectangle of ground with its sides along X and Z. */
export interface Plot {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
}

/**
 * An upright face to put things on. Places on it are given as `u`, metres to the right of
 * its middle as seen from outside; a height; and `out`, metres proud of it.
 */
export interface Wall {
  ox: number;
  oz: number;
  /** The way it faces. */
  nx: number;
  nz: number;
  half: number;
}

const NORMALS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/** One side of a plot: 0 to 3 for -X, +X, -Z, +Z. */
export function wallOf(p: Plot, side: number): Wall {
  const [nx, nz] = NORMALS[side];
  return { ox: p.cx + nx * p.hx, oz: p.cz + nz * p.hz, nx, nz, half: nx ? p.hz : p.hx };
}

/** A wall facing the same way, moved outward (inward when negative) and along, and made a new width. */
export function shifted(w: Wall, out: number, u = 0, half = w.half): Wall {
  return { ...w, ox: w.ox + w.nz * u + w.nx * out, oz: w.oz - w.nx * u + w.nz * out, half };
}

const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Sides of a box to leave out. The underside is always left out: nothing here is seen from below. */
export const SKIP = { nx: 1, px: 2, nz: 4, pz: 8, top: 16 };

/**
 * Collects flat-coloured faces into one mesh. Corners are always given anticlockwise as
 * seen from the side the face is to be seen from, starting at the bottom left.
 */
export class Shapes {
  private readonly position: number[] = [];
  private readonly normal: number[] = [];
  private readonly color: number[] = [];
  private readonly uv: number[] = [];
  private readonly index: number[] = [];
  private readonly tint = new THREE.Color();
  /** Spots noted while building: places outside where something loose belongs, such as the gas for a kitchen. */
  readonly marks: { kind: 'eatery'; x: number; z: number }[] = [];

  mark(kind: 'eatery', at: P): void {
    this.marks.push({ kind, x: at[0], z: at[2] });
  }

  private corner(p: P, n: P, u: number, v: number): void {
    this.position.push(p[0], p[1], p[2]);
    this.normal.push(n[0], n[1], n[2]);
    this.color.push(this.tint.r, this.tint.g, this.tint.b);
    this.uv.push(u, v);
  }

  private facing(a: P, b: P, c: P): P | null {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const n: P = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const length = Math.hypot(n[0], n[1], n[2]);
    if (length < 1e-9) return null;
    return [n[0] / length, n[1] / length, n[2] / length];
  }

  quad(a: P, b: P, c: P, d: P, color: number, uv: UV = BLANK): void {
    const n = this.facing(a, b, d);
    if (!n) return;
    const first = this.position.length / 3;
    this.tint.setHex(color);
    this.corner(a, n, uv[0], uv[1]);
    this.corner(b, n, uv[2], uv[1]);
    this.corner(c, n, uv[2], uv[3]);
    this.corner(d, n, uv[0], uv[3]);
    this.index.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }

  tri(a: P, b: P, c: P, color: number): void {
    const n = this.facing(a, b, c);
    if (!n) return;
    const first = this.position.length / 3;
    this.tint.setHex(color);
    for (const p of [a, b, c]) this.corner(p, n, BLANK[0], BLANK[1]);
    this.index.push(first, first + 1, first + 2);
  }

  /** A face of ribbed sheet. The ribs run the way a → d does; there are eight to every `pitch` metres of a → b. */
  ribbed(a: P, b: P, c: P, d: P, color: number, pitch = 2): void {
    const pieces = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / pitch));
    for (let i = 0; i < pieces; i++) {
      const t0 = i / pieces;
      const t1 = (i + 1) / pieces;
      this.quad(lerp(a, b, t0), lerp(a, b, t1), lerp(d, c, t1), lerp(d, c, t0), color, RIBS);
    }
  }

  box(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, color: number, top = color, skip = 0): void {
    const x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy, z0 = cz - hz, z1 = cz + hz;
    if (!(skip & SKIP.px)) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color);
    if (!(skip & SKIP.nx)) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color);
    if (!(skip & SKIP.pz)) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color);
    if (!(skip & SKIP.nz)) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color);
    if (!(skip & SKIP.top)) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top);
  }

  /** The four walls of a plot from one height to another, one colour to a side, and a flat roof if a colour is given for it. */
  shell(p: Plot, y0: number, y1: number, colors: number | number[], roof?: number): void {
    for (let side = 0; side < 4; side++) {
      const w = wallOf(p, side);
      this.panel(w, -w.half, y0, w.half, y1, 0, typeof colors === 'number' ? colors : colors[side]);
    }
    if (roof !== undefined) this.deck(p, y1, roof);
  }

  /** A flat floor over a plot, seen from above. */
  deck(p: Plot, y: number, color: number): void {
    this.quad([p.cx - p.hx, y, p.cz + p.hz], [p.cx + p.hx, y, p.cz + p.hz], [p.cx + p.hx, y, p.cz - p.hz], [p.cx - p.hx, y, p.cz - p.hz], color);
  }

  /** A parapet round the edge of a plot: its outer faces carry on the walls below. */
  rim(p: Plot, y: number, height: number, thick: number, colors: number | number[], inner: number, cap: number): void {
    for (let side = 0; side < 4; side++) {
      const w = wallOf(p, side);
      const back = shifted(w, -thick, 0, w.half - thick);
      this.panel(w, -w.half, y, w.half, y + height, 0, typeof colors === 'number' ? colors : colors[side]);
      this.panel({ ...back, nx: -w.nx, nz: -w.nz }, -back.half, y, back.half, y + height, 0, inner);
      // The top, mitred into its neighbours at each end.
      this.quad(this.at(w, -w.half, y + height, 0), this.at(w, w.half, y + height, 0), this.at(w, w.half - thick, y + height, -thick), this.at(w, -w.half + thick, y + height, -thick), cap);
    }
  }

  /** A place on a wall, in the world. */
  at(w: Wall, u: number, y: number, out: number): P {
    return [w.ox + w.nz * u + w.nx * out, y, w.oz - w.nx * u + w.nz * out];
  }

  /** A flat rectangle on a wall, facing the way the wall does; from both sides if `both`. */
  panel(w: Wall, u0: number, y0: number, u1: number, y1: number, out: number, color: number, uv: UV = BLANK, both = false): void {
    const a = this.at(w, u0, y0, out);
    const b = this.at(w, u1, y0, out);
    const c = this.at(w, u1, y1, out);
    const d = this.at(w, u0, y1, out);
    this.quad(a, b, c, d, color, uv);
    if (both) this.quad(b, a, d, c, color, uv);
  }

  /** A roller shutter on a wall: ribbed from side to side. */
  shutter(w: Wall, u0: number, y0: number, u1: number, y1: number, out: number, color: number): void {
    this.ribbed(this.at(w, u1, y0, out), this.at(w, u1, y1, out), this.at(w, u0, y1, out), this.at(w, u0, y0, out), color, 1.6);
  }

  /**
   * A box on a wall, given by its middle and its half sizes along the wall, upward and
   * outward. Its back is left out unless it is `whole`: most of these stand against the wall.
   */
  block(w: Wall, u: number, y: number, out: number, hu: number, hy: number, hn: number, color: number, top = color, whole = false): void {
    const [cx, , cz] = this.at(w, u, y, out);
    const back = whole ? 0 : w.nx > 0 ? SKIP.nx : w.nx < 0 ? SKIP.px : w.nz > 0 ? SKIP.nz : SKIP.pz;
    this.box(cx, y, cz, w.nx ? hn : hu, hy, w.nx ? hu : hn, color, top, back);
  }

  /** A sign standing out from a wall, to be read from either way along the street. */
  blade(w: Wall, u: number, y0: number, y1: number, out0: number, out1: number, uv: UV, edge: number): void {
    const thick = 0.07;
    this.block(w, u, (y0 + y1) / 2, (out0 + out1) / 2, thick, (y1 - y0) / 2, (out1 - out0) / 2, edge, edge, true);
    const right = u + thick + 0.012;
    const left = u - thick - 0.012;
    this.quad(this.at(w, right, y0, out1), this.at(w, right, y0, out0), this.at(w, right, y1, out0), this.at(w, right, y1, out1), 0xffffff, uv);
    this.quad(this.at(w, left, y0, out0), this.at(w, left, y0, out1), this.at(w, left, y1, out1), this.at(w, left, y1, out0), 0xffffff, uv);
  }

  /** An upright cylinder standing on `y`. */
  cylinder(cx: number, y: number, cz: number, radius: number, height: number, color: number, top = color, sides = 8): void {
    const rim = (i: number, at: number): P => {
      const angle = (i / sides) * Math.PI * 2;
      return [cx + Math.cos(angle) * radius, at, cz + Math.sin(angle) * radius];
    };
    for (let i = 0; i < sides; i++) {
      this.quad(rim(i + 1, y), rim(i, y), rim(i, y + height), rim(i + 1, y + height), color);
      this.tri([cx, y + height, cz], rim(i + 1, y + height), rim(i, y + height), top);
    }
  }

  cone(cx: number, y: number, cz: number, radius: number, height: number, color: number, sides = 8): void {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      this.tri([cx, y + height, cz], [cx + Math.cos(a1) * radius, y, cz + Math.sin(a1) * radius], [cx + Math.cos(a0) * radius, y, cz + Math.sin(a0) * radius], color);
    }
  }

  get triangles(): number {
    return this.index.length / 3;
  }

  /** Everything collected so far as one geometry, packed small: a city is a great many corners. */
  geometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const packed = (values: number[], scale: number, Kind: Int8ArrayConstructor | Uint16ArrayConstructor) => {
      const array = new Kind(values.length);
      for (let i = 0; i < values.length; i++) array[i] = Math.round(values[i] * scale);
      return array;
    };
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(packed(this.normal, 127, Int8Array), 3, true));
    geometry.setAttribute('color', new THREE.BufferAttribute(packed(this.color, 65535, Uint16Array), 3, true));
    geometry.setAttribute('uv', new THREE.BufferAttribute(packed(this.uv, 65535, Uint16Array), 2, true));
    geometry.setIndex(this.index);
    return geometry;
  }
}
