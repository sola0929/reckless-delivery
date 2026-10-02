import { Shapes, wallOf, type Plot, type Wall } from './shapes';
import type { Front } from './signs';

// The pieces that buildings of every kind are put together from.

export type Rand = () => number;
export const pick = <T>(rand: Rand, list: readonly T[]): T => list[Math.floor(rand() * list.length)];
export const span = (rand: Rand, lo: number, hi: number): number => lo + rand() * (hi - lo);

/** The ground a building stands on, centred on the origin, and how high it may go. */
export interface Lot {
  hx: number;
  hz: number;
  height: number;
  open: readonly boolean[];
  crown: number;
}

export const GLASS = [0x2d3f52, 0x364c61, 0x425a70, 0x2a3a4a];
export const BLINDS = [0xd8d2c0, 0xc9cdd0, 0xb9c4b0];
export const TRIMS = [0xf0ece2, 0xe6e0d2, 0xcfcac0];
export const CEMENT = 0x9c9a94;
export const DARK = 0x3a3f46;
export const STONE = 0xd2cdc2;
export const STEEL = 0xc3cace;
export const STEEL_TOP = 0xe4e8ea;
export const ROOF_FLOORS = [0x8f9296, 0x8f9296, 0x6a9a76, 0x9a6252, 0xa8a59c];
export const SHUTTERS = [0xb9bec2, 0x8fa8b8, 0x9fb8a4, 0xcfc8b4];
export const PLANTS = [0x4f9a55, 0x3f8448, 0x6aae5a];
/** The inside of a shop with its lights on, seen through the window. */
export const LIT = 0xe4ebe6;
/** Things for sale. */
export const WARES = [0xd85a4a, 0xf0c94a, 0x5f8fd0, 0x4f9f7a, 0xe89ab0, 0xf2f2ee, 0x8a5fb3];
const PRODUCE = [0xe8892a, 0xc8443a, 0x6a9a3a, 0xe0c341, 0x8a4fa0];
const STOOLS = [0xc8372d, 0x2f62a8];
/** Awnings: two colours in stripes, or one. */
const AWNINGS = [[0xc8372d, 0xf4f1e6], [0x2f8f5a, 0xf4f1e6], [0x2f62a8, 0xf4f1e6], [0xf2c12e, 0xf4f1e6], [0x2e5a48, 0x2e5a48], [0x7a2f2a, 0x7a2f2a], [0xe07a28, 0xe07a28]];

/** A colour made lighter or darker. */
export function tone(hex: number, by: number): number {
  const channel = (shift: number) => Math.min(255, Math.round(((hex >> shift) & 255) * by)) << shift;
  return channel(16) | channel(8) | channel(0);
}

/** Which sides of a plot lie along the edge of its lot: -X, +X, -Z, +Z. */
export function edges(p: Plot, lot: Lot): boolean[] {
  return [p.cx - p.hx < -lot.hx + 0.01, p.cx + p.hx > lot.hx - 0.01, p.cz - p.hz < -lot.hz + 0.01, p.cz + p.hz > lot.hz - 0.01];
}

/** A plot with each side brought in by so much: -X, +X, -Z, +Z. */
export function within(p: Plot, inset: number[]): Plot {
  return {
    cx: p.cx + (inset[0] - inset[1]) / 2,
    cz: p.cz + (inset[2] - inset[3]) / 2,
    hx: p.hx - (inset[0] + inset[1]) / 2,
    hz: p.hz - (inset[2] + inset[3]) / 2,
  };
}

/** A window: glass in a frame, now and then with a blind part of the way down. */
export function glazing(s: Shapes, rand: Rand, w: Wall, u0: number, y0: number, u1: number, y1: number, frame: number): void {
  s.panel(w, u0 - 0.07, y0 - 0.07, u1 + 0.07, y1 + 0.07, 0.02, frame);
  s.panel(w, u0, y0, u1, y1, 0.04, pick(rand, GLASS));
  if (rand() < 0.22) s.panel(w, u0, y1 - (y1 - y0) * span(rand, 0.3, 0.6), u1, y1, 0.045, pick(rand, BLINDS));
}

/** The outdoor half of an air conditioner, hung on a wall with its foot at `y`. */
export function airCon(s: Shapes, w: Wall, u: number, y: number): void {
  s.block(w, u, y + 0.28, 0.17, 0.42, 0.28, 0.17, 0xd6d6d0);
  s.panel(w, u - 0.3, y + 0.07, u + 0.14, y + 0.49, 0.345, 0x4a5058);
}

/** A grille standing out round a window: a tray below, a rail above, and bars between. */
export function cage(s: Shapes, w: Wall, u0: number, y0: number, u1: number, y1: number, depth: number, color: number): void {
  const middle = (u0 + u1) / 2;
  const hu = (u1 - u0) / 2;
  s.block(w, middle, y0, depth / 2, hu, 0.035, depth / 2, color);
  s.block(w, middle, y1, depth / 2, hu, 0.035, depth / 2, color);
  const bars = Math.max(2, Math.round((u1 - u0) / 0.5));
  for (let i = 0; i <= bars; i++) {
    const u = u0 + ((u1 - u0) * i) / bars;
    s.panel(w, u - 0.03, y0, u + 0.03, y1, depth, color);
  }
}

const CLOTHES = [0xf2f2ee, 0x5f8fd0, 0xd85a4a, 0xf0c94a, 0xe89ab0, 0x4f9f7a, 0x33383e];

/** Washing on a pole. */
export function laundry(s: Shapes, rand: Rand, w: Wall, u0: number, u1: number, y: number, out: number): void {
  s.block(w, (u0 + u1) / 2, y, out, (u1 - u0) / 2, 0.02, 0.02, 0x8a8f96, 0x8a8f96, true);
  for (let u = u0 + 0.35; u < u1 - 0.3; u += span(rand, 0.6, 0.85)) {
    const half = span(rand, 0.18, 0.26);
    s.panel(w, u - half, y - span(rand, 0.5, 0.9), u + half, y, out, pick(rand, CLOTHES), undefined, true);
  }
}

/** A stainless water tank on its stand. */
export function waterTower(s: Shapes, x: number, y: number, z: number, radius: number): void {
  s.box(x, y + 0.18, z, radius * 0.85, 0.18, radius * 0.85, 0x5a6068);
  s.cylinder(x, y + 0.36, z, radius, radius * 2.3, STEEL, STEEL_TOP, 10);
  s.cylinder(x, y + 0.36 + radius * 2.3, z, radius * 0.3, 0.08, 0x9aa2a8, 0x9aa2a8, 6);
}

/** A canvas awning over a shop, sloping out from the wall at `y`, with a valance along its front edge. */
export function awning(s: Shapes, rand: Rand, w: Wall, u0: number, u1: number, y: number, reach = 1.15): void {
  const colors = pick(rand, AWNINGS);
  const stripes = Math.max(1, Math.round((u1 - u0) / 0.55));
  const drop = reach * 0.5;
  for (let i = 0; i < stripes; i++) {
    const a = u0 + ((u1 - u0) * i) / stripes;
    const b = u0 + ((u1 - u0) * (i + 1)) / stripes;
    s.quad(s.at(w, a, y - drop, reach), s.at(w, b, y - drop, reach), s.at(w, b, y, 0), s.at(w, a, y, 0), colors[i % 2]);
    s.panel(w, a, y - drop - 0.22, b, y - drop, reach, colors[i % 2]);
  }
}

/**
 * A ridged roof over a plot, standing on `y`: tiles or sheet on the two slopes, a wall
 * filling each end. The ridge runs along X, or else along Z.
 */
export function pitchedRoof(s: Shapes, p: Plot, y: number, alongX: boolean, rise: number, color: number, gable: number, over = 0.4): void {
  const reach = alongX ? p.hz : p.hx;
  const drop = (rise / reach) * over;
  const slopes = alongX ? [2, 3] : [0, 1];
  for (const side of slopes) {
    const w = wallOf(p, side);
    s.ribbed(s.at(w, -w.half - 0.15, y - drop, over), s.at(w, w.half + 0.15, y - drop, over), s.at(w, w.half + 0.15, y + rise, -reach), s.at(w, -w.half - 0.15, y + rise, -reach), color, 1.4);
  }
  for (const side of alongX ? [0, 1] : [2, 3]) {
    const w = wallOf(p, side);
    s.tri(s.at(w, -w.half, y, 0), s.at(w, w.half, y, 0), s.at(w, 0, y + rise, 0), gable);
  }
  const w = wallOf(p, slopes[1]);
  s.block(w, 0, y + rise + 0.04, -reach, w.half + 0.15, 0.09, 0.17, tone(color, 0.8), undefined, true);
}

/**
 * What a shop shows the street, on the wall `w` at the back of its arcade or porch. `hw`
 * is half its width, `head` the height of the opening, and `depth` the room in front of
 * the wall for whatever the shop keeps outside.
 */
export function shopfront(s: Shapes, rand: Rand, w: Wall, hw: number, head: number, front: Front, depth: number, body: number): void {
  // Some are shut today.
  if (front !== 'plain' && rand() < 0.14) {
    s.shutter(w, -hw, 0.05, hw, head, 0.03, pick(rand, SHUTTERS));
    return;
  }
  const side = rand() < 0.5 ? -1 : 1;
  switch (front) {
    case 'glass': {
      // A lit window with the goods set out in it, and a glass door at one end.
      s.panel(w, -hw, 0, hw, 0.45, 0.03, pick(rand, TRIMS));
      s.panel(w, -hw, 0.45, hw, head, 0.03, LIT);
      const door = side > 0 ? hw - 1.1 : -hw;
      s.panel(w, door, 0, door + 1.1, head, 0.04, 0x2f4252);
      s.panel(w, door + 0.5, 0.9, door + 0.6, 1.35, 0.05, 0xd8d4c8);
      const from = side > 0 ? -hw + 0.25 : -hw + 1.35;
      const to = side > 0 ? hw - 1.35 : hw - 0.25;
      for (let u = from; u < to - 0.4; u += span(rand, 0.55, 0.8)) s.panel(w, u, 0.55, u + 0.4, 0.55 + span(rand, 0.3, 0.95), 0.04, pick(rand, WARES));
      s.panel(w, -hw, head - 0.12, hw, head, 0.045, DARK);
      s.panel(w, -hw, 0.45, hw, 0.53, 0.045, DARK);
      break;
    }
    case 'eatery': {
      // Open to the street: the menu on the wall, the stove out front, a table and stools.
      // Its gas stands out on the pavement, by the end the stove is at.
      s.mark('eatery', s.at(w, side * hw, 0, depth + 0.45));
      s.panel(w, -hw, 0, hw, head, 0.03, 0x4a3b2e);
      s.panel(w, -hw + 0.3, head - 0.8, hw - 0.3, head - 0.2, 0.04, pick(rand, [0xc8372d, 0xf2c12e, 0xf4f1e6]));
      if (depth < 1) {
        s.block(w, 0, 0.5, 0.2, hw - 0.3, 0.5, 0.2, STEEL, STEEL_TOP);
        break;
      }
      s.block(w, side * (hw - 0.75), 0.45, depth - 0.5, 0.65, 0.45, 0.35, STEEL, STEEL_TOP, true);
      const [px, , pz] = s.at(w, side * (hw - 0.95), 0, depth - 0.5);
      s.cylinder(px, 0.9, pz, 0.24, 0.28, 0x8a8f96, 0xe6dcc0, 8);
      const table = -side * hw * 0.35;
      s.block(w, table, 0.7, 0.75, 0.5, 0.03, 0.32, 0xd8d4c8, 0xd8d4c8, true);
      s.block(w, table, 0.34, 0.75, 0.04, 0.34, 0.04, DARK, DARK, true);
      for (const [du, dn] of [[-0.32, 0.46], [0.32, 0.46], [0, -0.44]]) {
        const [x, , z] = s.at(w, table + du, 0, 0.75 + dn);
        s.cylinder(x, 0, z, 0.15, 0.42, pick(rand, STOOLS), undefined, 6);
      }
      break;
    }
    case 'drinks': {
      // A counter right across, striped in the shop's colour, with the list of drinks lit up above it.
      const band = pick(rand, [0xe07a28, 0x2f8f5a, 0xc8372d, 0x7a3fa0]);
      s.panel(w, -hw, 1.05, hw, head, 0.03, 0x33302c);
      s.block(w, 0, 0.52, 0.22, hw, 0.52, 0.22, 0xf0ece2, band);
      s.panel(w, -hw, 0.6, hw, 0.88, 0.45, band);
      s.panel(w, -hw + 0.2, head - 0.75, hw - 0.2, head - 0.15, 0.04, LIT);
      for (let u = -hw + 0.4; u < hw - 0.6; u += 0.55) s.panel(w, u, head - 0.62, u + 0.32, head - 0.28, 0.05, pick(rand, WARES));
      break;
    }
    case 'grocer': {
      // Open, with the stock in trays on steps out to the pavement.
      s.panel(w, -hw, 0, hw, head, 0.03, 0x2b2622);
      const rows = Math.max(1, Math.floor(Math.min(depth - 0.1, 1.4) / 0.45));
      for (let row = 0; row < rows; row++) {
        const out = 0.25 + row * 0.45;
        const y = 0.9 - row * 0.22;
        s.block(w, 0, (y - 0.12) / 2, out, hw - 0.3, (y - 0.12) / 2, 0.21, 0x8a6a48, 0x8a6a48, true);
        for (let u = -hw + 0.56; u < hw - 0.5; u += 0.56) s.block(w, u, y, out, 0.24, 0.12, 0.19, pick(rand, PRODUCE), undefined, true);
      }
      break;
    }
    case 'workshop': {
      // A dark bay: tyres stacked at the door, a tool chest, a drum of oil.
      s.panel(w, -hw, 0, hw, head, 0.03, 0x26282c);
      s.panel(w, -0.9, head - 1.3, 0.9, head - 0.6, 0.04, 0xf2c12e);
      if (depth < 1) break;
      const [tx, , tz] = s.at(w, side * (hw - 0.5), 0, depth - 0.5);
      for (let i = 0; i < 3; i++) s.cylinder(tx, i * 0.22, tz, 0.32, 0.2, 0x1e1f22, 0x2c2e33, 8);
      s.block(w, -side * (hw - 0.6), 0.45, 0.4, 0.4, 0.45, 0.3, 0xc8372d, 0xa82a22, true);
      const [dx, , dz] = s.at(w, -side * (hw - 1.6), 0, 0.45);
      s.cylinder(dx, 0, dz, 0.28, 0.85, 0x2f62a8, 0x274f88, 8);
      break;
    }
    default: {
      // Nothing to sell at the door: a wall, a way in, a window, and the stairs up.
      s.panel(w, -hw, 0, hw, head, 0.03, tone(body, 0.9));
      const door = side > 0 ? hw - 1.3 : -hw + 0.3;
      s.panel(w, door, 0, door + 1, 2.2, 0.04, 0x6a4a34);
      const pane = side > 0 ? -hw + 0.4 : hw - 2.1;
      if (hw > 1.9) glazing(s, rand, w, pane, 1, pane + 1.7, 2.2, TRIMS[0]);
    }
  }
}
