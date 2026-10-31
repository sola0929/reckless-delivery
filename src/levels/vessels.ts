import { Euler, Quaternion, Vector3 } from 'three';
import type { FloatPartDesc, Vec2 } from './types';
import type { Vec3 } from '../config';

// What floats in level 4's outer harbour, piece by piece, for `hull: 'vessel'`: each in its own frame, across it x, along
// it z with its bow toward +z, its deck's top at nought. What is solid of it is plain boxes and cylinders under what is
// drawn: the hull is lofted for the look of it and stood for by boxes the truck can meet.

type Parts = FloatPartDesc[];

const box = (parts: Parts, half: Vec3, pos: Vec3, color: number, more: Partial<FloatPartDesc> = {}) => parts.push({ shape: 'box', half, pos, color, ...more });
const cyl = (parts: Parts, radius: number, halfLong: number, pos: Vec3, color: number, more: Partial<FloatPartDesc> = {}) => parts.push({ shape: 'cyl', half: [radius, halfLong, 0], pos, color, ...more });
/** A rod from one point to another, as a thin box turned to lie along it. */
function rod(parts: Parts, a: Vec3, b: Vec3, thick: number, color: number, solid = false): void {
  const d = new Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), long = d.length();
  const turn = new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), d.normalize()));
  parts.push({ shape: 'box', half: [thick, thick, long / 2], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [turn.x, turn.y, turn.z], color, solid });
}

/**
 * The outline of a hull at one height: its transom across the stern, straight sides, the bow drawn in to the stem. `w`
 * half its beam, `l` half its length (stern at -l), `bow` how far back from the stem the sides start to come in.
 */
function outline(w: number, l: number, bow: number, transom = 0.85): Vec2[] {
  const side: Vec2[] = [[w * transom, -l], [w, -l + Math.min(1.6, l * 0.12)], [w, l - bow], [w * 0.8, l - bow * 0.5], [w * 0.42, l - bow * 0.14]];
  return [...side, [0, l + 0.15], ...side.reverse().map(([x, z]): Vec2 => [-x, z])];
}

/** Bulwarks along an outline's sides, from one corner to the next, with gaps where it is crossed: [side, z] each 2.4 m either way. */
function bulwarks(parts: Parts, ring: Vec2[], high: number, color: number, cap: number, gaps: [number, number][], gap = 2.4): void {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    // Inset a little from the hull's edge.
    const pieces: [Vec2, Vec2][] = [[a, b]];
    // A straight side along z is cut where it is crossed.
    if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[0]) > 0.5) {
      const side = Math.sign(a[0]);
      const z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]);
      let runs: [number, number][] = [[z0, z1]];
      for (const [s, z] of gaps) {
        if (s !== side) continue;
        runs = runs.flatMap(([r0, r1]): [number, number][] => (z + gap <= r0 || z - gap >= r1 ? [[r0, r1]] : [[r0, z - gap], [z + gap, r1]].filter(([p, q]) => q - p > 0.3) as [number, number][]));
      }
      pieces.length = 0;
      for (const [r0, r1] of runs) pieces.push([[a[0], r0], [a[0], r1]]);
    }
    for (const [p, q] of pieces) {
      const dx = q[0] - p[0], dz = q[1] - p[1], long = Math.hypot(dx, dz);
      if (long < 0.05) continue;
      const nx = -dz / long, nz = dx / long;
      // Inward is toward the middle.
      const inward = nx * -(p[0] + q[0]) + nz * -(p[1] + q[1]) > 0 ? 1 : -1;
      const mx = (p[0] + q[0]) / 2 + nx * inward * 0.06, mz = (p[1] + q[1]) / 2 + nz * inward * 0.06;
      const yaw = Math.atan2(dx, dz);
      parts.push({ shape: 'box', half: [0.05, high / 2, long / 2], pos: [mx, high / 2, mz], rot: [0, yaw, 0], color, solid: true });
      parts.push({ shape: 'box', half: [0.09, 0.04, long / 2], pos: [mx, high + 0.02, mz], rot: [0, yaw, 0], color: cap });
    }
  }
}

export interface BoatOptions {
  /** Half its beam and half its length. */
  w: number;
  l: number;
  color: number;
  /** What it fishes with: long lines on a great reel, a trawl's net on its drum, or squid by lamplight. */
  kind: 'longline' | 'trawl' | 'squid';
  /** Where its sides are crossed: which side (-1, 1) and how far along. */
  gaps: [number, number][];
  /** Its wheelhouse's colour, and a second colour for its trim. */
  house?: number;
  trim?: number;
  /** Its flags, if it is flying them: the colours of each. */
  flags?: number[][];
  /** Where along it its gear stands, and its fish hold's hatch: clear of where it is crossed. */
  gear: number;
  hold: number;
}

/**
 * A Taiwanese fishing boat in for the storm: steel hull painted in its owner's colours over red below the waterline, a
 * white band along its sheer; its wheelhouse aft, two tiers with the radar mast; its fish hold's hatch forward and its gear
 * as it fishes; old tyres hung along its sides for the boats it lies against; its flags up on the line from mast to
 * mast, as the boats here fly them in harbour. Its bulwarks cut away where the plates are laid across it.
 */
export function fishingBoat(o: BoatOptions): Parts {
  const parts: Parts = [];
  const { w, l, color } = o;
  const bow = Math.min(5.5, l * 0.45);
  const house = o.house ?? 0xeceae2, trim = o.trim ?? 0x2a3440, DECK = 0x8a7656;
  // The hull: red below, its colour above, a white band at the top; lofted.
  const keel = outline(w * 0.42, l * 0.86, bow * 0.7, 0.6), water = outline(w * 0.9, l * 0.96, bow * 0.9, 0.78), top = outline(w, l, bow);
  const band = outline(w + 0.015, l + 0.015, bow);
  parts.push({ shape: 'loft', lo: keel, hi: water, y0: -2.6, y1: -1.25, color: 0xa83228 });
  parts.push({ shape: 'loft', lo: water, hi: top, y0: -1.25, y1: -0.22, color });
  parts.push({ shape: 'loft', lo: band, hi: band, y0: -0.22, y1: -0.04, color: 0xf2f0ea });
  // Its rubbing strake, black, a little proud of the hull below the band.
  const strake = outline(w + 0.05, l + 0.05, bow);
  parts.push({ shape: 'loft', lo: strake, hi: strake, y0: -0.5, y1: -0.36, color: 0x2a2c30 });
  // What is felt of it: its body and its bow, under what is drawn.
  box(parts, [w - 0.02, 1.2, l - bow / 2], [0, -1.25, -bow / 2], color, { solid: true, hidden: true });
  box(parts, [w * 0.62, 1.2, bow * 0.45], [0, -1.25, l - bow * 0.45], color, { solid: true, hidden: true });
  // The deck, worn timber over steel: full width aft of the bow, narrower into it.
  box(parts, [w - 0.1, 0.04, l - bow / 2 - 0.05], [0, -0.04, -bow / 2], DECK, { solid: true });
  box(parts, [w * 0.55, 0.04, bow * 0.35], [0, -0.04, l - bow * 0.65], DECK, { solid: true });
  for (let z = -l + 0.9; z < l - bow; z += 1.1) box(parts, [w - 0.12, 0.003, 0.012], [0, 0.002, z], 0x6e5c42);
  bulwarks(parts, top, 0.75, color, 0xf2f0ea, o.gaps);
  // Where it is crossed: the bulwark's removed pieces lying on the deck by the gap, the edge painted.
  for (const [side, z] of o.gaps) {
    box(parts, [0.02, 0.06, 2.3], [side * (w - 0.02), -0.12, z], 0xe0b020);
    box(parts, [0.35, 0.05, 1.1], [side * (w - 0.6), 0.05, z + (z > 0 ? -3.6 : 3.6)], color, { rot: [0, 0.2, 0] });
  }
  // Tyres hung along its sides, on ropes from its bulwark.
  for (const side of [-1, 1]) for (let z = -l + 2.4; z < l - bow; z += 2.6) {
    if (o.gaps.some(([s, g]) => s === side && Math.abs(g - z) < 2.6)) continue;
    cyl(parts, 0.34, 0.11, [side * (w + 0.12), -0.6, z], 0x1e1f22, { rot: [0, 0, Math.PI / 2] });
    box(parts, [0.012, 0.3, 0.012], [side * (w + 0.06), 0.1, z], 0xd8d0b8);
  }
  // The wheelhouse aft: two tiers, windows round, its door, the radar mast, the whips, a light each side; the exhaust.
  const h0 = -l + 0.9, h1 = -l + 4.7, hw = w * 0.62;
  box(parts, [hw, 1.15, (h1 - h0) / 2], [0, 1.15, (h0 + h1) / 2], house, { solid: true });
  box(parts, [hw + 0.01, 0.25, (h1 - h0) / 2 + 0.01], [0, 1.6, (h0 + h1) / 2], trim);
  box(parts, [hw + 0.06, 0.06, (h1 - h0) / 2 + 0.06], [0, 2.33, (h0 + h1) / 2], o.trim ?? color);
  box(parts, [hw * 0.72, 0.75, (h1 - h0) / 2 - 0.5], [0, 3.1, (h0 + h1) / 2 + 0.2], house, { solid: true });
  box(parts, [hw * 0.72 + 0.01, 0.22, (h1 - h0) / 2 - 0.49], [0, 3.35, (h0 + h1) / 2 + 0.2], trim);
  box(parts, [hw * 0.8, 0.05, (h1 - h0) / 2 - 0.3], [0, 3.88, (h0 + h1) / 2 + 0.2], 0xd8d6ce);
  for (const side of [-1, 1]) {
    box(parts, [0.01, 0.8, 0.4], [side * (hw + 0.01), 0.85, h1 - 1.0], 0x9aa0a6);
    cyl(parts, 0.07, 0.07, [side * (hw * 0.8 + 0.05), 4.0, h1 - 0.7], side < 0 ? 0xc8372d : 0x2e9a5a);
    // A lifebuoy on the wheelhouse's side.
    cyl(parts, 0.3, 0.05, [side * (hw + 0.05), 1.2, h0 + 1.0], 0xe8622a, { rot: [0, 0, Math.PI / 2] });
  }
  const mastZ = (h0 + h1) / 2;
  cyl(parts, 0.07, 1.8, [0, 5.7, mastZ], 0xd8d6ce, { solid: true });
  box(parts, [0.9, 0.06, 0.14], [0, 6.6, mastZ], 0x2a2c30, { rot: [0, 0.6, 0] });
  for (const x of [-0.6, 0.6]) cyl(parts, 0.015, 1.1, [x, 5.0, mastZ - 0.4], 0x2a2c30);
  cyl(parts, 0.17, 1.2, [hw * 0.55, 3.4, h0 + 0.4], 0x2a2c30);
  // Its gear, forward of where it is crossed.
  const fore = o.gear - 0.9;
  if (o.kind === 'longline') {
    // The line's great reel on its frame, a stack of the baskets the line is coiled in, its float flags.
    cyl(parts, 0.75, 0.9, [0, 0.95, fore + 0.9], 0x3a5f8a, { rot: [0, 0, Math.PI / 2], solid: true });
    cyl(parts, 0.22, 1.0, [0, 0.95, fore + 0.9], 0x9aa0a6, { rot: [0, 0, Math.PI / 2] });
    for (const x of [-1.0, 1.0]) box(parts, [0.06, 0.55, 0.5], [x, 0.55, fore + 0.9], 0x5f666c, { solid: true });
    for (let k = 0; k < 6; k++) box(parts, [0.28, 0.16, 0.28], [w * 0.55, 0.16 + k * 0.32, fore + 0.4], [0x2f6ab8, 0xe8b82e][k % 2]);
    for (const x of [-0.5, -0.2, 0.15]) cyl(parts, 0.012, 1.0, [w * 0.5 + x, 1.0, fore + 2.4], 0x2a2c30);
  } else if (o.kind === 'trawl') {
    // The net's drum aft of the hatch, the net wound on it green; the gallows.
    cyl(parts, 0.6, w * 0.55, [0, 0.75, fore + 0.8], 0x3f6a4a, { rot: [0, 0, Math.PI / 2], solid: true });
    for (const x of [-1, 1]) box(parts, [0.08, 0.6, 0.4], [x * (w * 0.6), 0.6, fore + 0.8], 0x5f666c, { solid: true });
    for (const x of [-1, 1]) rod(parts, [x * (w - 0.4), 0, -l + 0.6], [x * (w - 0.4), 3.2, -l + 0.4], 0.08, 0x5f666c);
    rod(parts, [-(w - 0.4), 3.2, -l + 0.4], [w - 0.4, 3.2, -l + 0.4], 0.08, 0x5f666c);
  } else {
    // Squid by lamplight: two rows of great lamps the length of it, each under its shade, on wires from mast to mast high
    // over the deck; the jigging machines along its sides.
    for (const side of [-1, 1]) {
      const x = side * (w - 0.9);
      cyl(parts, 0.06, 2.3, [x, 2.3, -l + 5.4], 0x9aa0a6, { solid: true });
      cyl(parts, 0.06, 2.3, [x, 2.3, l - bow - 0.3], 0x9aa0a6, { solid: true });
      rod(parts, [x, 4.5, -l + 5.4], [x, 4.5, l - bow - 0.3], 0.015, 0x2a2c30);
      for (let z = -l + 6; z < l - bow - 0.6; z += 0.95) {
        cyl(parts, 0.14, 0.16, [x, 4.25, z], 0xf4f0d8);
        box(parts, [0.2, 0.03, 0.2], [x, 4.45, z], 0xd8d6ce);
      }
      for (let z = -l + 6; z < l - bow - 0.6; z += 2.2) {
        if (o.gaps.some(([s, g]) => s === side && Math.abs(g - z) < 3)) continue;
        box(parts, [0.18, 0.25, 0.22], [side * (w - 0.35), 0.25, z], 0x5f666c, { solid: true });
      }
    }
  }
  // The fish hold's hatch; the foremast, a light on it; the flag line from its top to the radar mast's.
  box(parts, [0.9, 0.22, 0.9], [0, 0.22, o.hold], 0x6f7a74, { solid: true });
  box(parts, [0.8, 0.03, 0.8], [0, 0.46, o.hold], 0x5a6660);
  const foreMast = l - bow * 0.55;
  cyl(parts, 0.08, 2.9, [0, 2.9, foreMast], 0xd8d6ce, { solid: true });
  cyl(parts, 0.07, 0.07, [0, 5.9, foreMast], 0xf2f0d8);
  rod(parts, [0, 5.75, foreMast], [0, 7.4, mastZ], 0.012, 0x2a2c30);
  // The bow: its anchor at the stem, its bitts.
  for (const x of [-0.5, 0.5]) cyl(parts, 0.1, 0.2, [x, 0.2, l - bow * 0.35], 0x2a2c30, { solid: true });
  // On the wheelhouse's roof: the life raft in its canister on its cradle, the water tank, the searchlight.
  const roofY = 3.93, roofZ = (h0 + h1) / 2 + 0.2;
  cyl(parts, 0.32, 0.5, [-hw * 0.4, roofY + 0.36, roofZ - 0.6], 0xf2f0ea, { rot: [0, 0, Math.PI / 2] });
  box(parts, [0.45, 0.05, 0.3], [-hw * 0.4, roofY + 0.05, roofZ - 0.6], 0x5f666c);
  cyl(parts, 0.4, 0.35, [hw * 0.4, roofY + 0.35, roofZ - 0.5], 0x2f62a8);
  cyl(parts, 0.13, 0.1, [0, roofY + 0.15, roofZ + 1.2], 0x9aa0a6, { rot: [Math.PI / 2, 0, 0] });
  // Aft of the wheelhouse the crew's washing, out on a line from its side to the stern; their basin and stools.
  const lx = w * 0.72;
  rod(parts, [lx, 2.1, h0 + 0.2], [w - 0.35, 1.9, -l + 0.35], 0.01, 0xd8d0b8);
  [0xd23c2c, 0xf2f0ea, 0x2f62a8, 0xe8b82e].forEach((c, k) => {
    const t = (k + 1) / 5;
    box(parts, [0.02, 0.28, 0.22], [lx + (w - 0.35 - lx) * t, 2.1 - 0.2 * t - 0.3, h0 + 0.2 + (-l + 0.35 - h0 - 0.2) * t], c);
  });
  // Floats in their net along the inside of the bulwark forward, tied off.
  for (const side of [-1, 1]) for (let k = 0; k < 5; k++) {
    const z = l - bow - 0.6 - k * 0.5;
    if (o.gaps.some(([s, g]) => s === side && Math.abs(g - z) < 2.8)) continue;
    parts.push({ shape: 'cyl', half: [0.2, 0.2, 0], pos: [side * (w - 0.35), 0.45, z], color: k % 2 ? 0xe8622a : 0xf2f0ea });
  }
  if (o.kind === 'longline') {
    // The flag buoys the line is marked with, racked at the stern: bamboo poles each with its float at the foot and its
    // flag at the top, leaning together.
    for (let k = 0; k < 9; k++) {
      const x = -w + 0.6 + (k % 3) * 0.32, z = -l + 0.5 + Math.floor(k / 3) * 0.3, lean = 0.08 + (k % 2) * 0.05;
      rod(parts, [x, 0.3, z], [x - lean * 3, 3.6, z + 0.1], 0.025, 0xc8b070);
      parts.push({ shape: 'cyl', half: [0.17, 0.17, 0], pos: [x, 0.35, z], color: 0xe8622a });
      box(parts, [0.01, 0.17, 0.26], [x - lean * 3, 3.4, z + 0.36], [0xd23c2c, 0xf2c12e, 0x2e9a5a][k % 3]);
    }
    box(parts, [0.6, 0.06, 0.5], [-w + 0.92, 0.9, -l + 0.8], 0x5f666c);
  } else if (o.kind === 'trawl') {
    // Its trawl doors hung on the gallows at the stern, one each side, dark steel, a shoe along the bottom of each.
    for (const x of [-1, 1]) {
      box(parts, [0.07, 0.6, 0.85], [x * (w - 0.25), 1.75, -l + 0.4], 0x3a3f45);
      box(parts, [0.09, 0.06, 0.85], [x * (w - 0.25), 1.15, -l + 0.4], 0x8a8f96);
      rod(parts, [x * (w - 0.4), 3.2, -l + 0.4], [x * (w - 0.25), 2.35, -l + 0.4], 0.02, 0x2a2c30);
    }
  } else {
    // The sea anchor, its red canopy bundled and lashed on the wheelhouse roof's aft end.
    box(parts, [0.5, 0.22, 0.35], [0, roofY + 0.22, roofZ - 1.3], 0xc8372d);
  }
  if (o.flags) {
    // 大漁旗 on the line, hanging from it: big bright flags in bands of their colours.
    const n = o.flags.length;
    o.flags.forEach((colours, k) => {
      const t = (k + 0.7) / (n + 0.4), z = foreMast + (mastZ - foreMast) * t, y = 5.75 + (7.4 - 5.75) * t;
      const band = 0.9 / colours.length;
      colours.forEach((c, j) => box(parts, [0.012, band / 2, 0.65], [0, y - 0.1 - band * (j + 0.5), z], c));
    });
  }
  return parts;
}

/**
 * A pontoon on its floats, concrete topped, steel edged: its deck crossed where the gangway comes down onto it and the
 * plate goes off it; its kerbs elsewhere, cleats, rubber along its sides, the hoops it rides up and down its piles by.
 */
export function pontoon(w: number, l: number, crossing: number, piles: Vec2[]): Parts {
  const parts: Parts = [];
  box(parts, [w, 0.25, l], [0, -0.25, 0], 0x8e908a, { solid: true });
  box(parts, [w - 0.3, 0.45, l - 0.3], [0, -0.92, 0], 0x3a3f45);
  for (let z = -l + 2; z < l; z += 2) box(parts, [w - 0.05, 0.004, 0.02], [0, 0.002, z], 0x7a7c76);
  for (const side of [-1, 1]) {
    box(parts, [0.06, 0.18, l], [side * (w + 0.02), -0.2, 0], 0x1e1f22);
    // Its kerb, but where it is crossed.
    for (const [z0, z1] of [[-l, crossing - 2.6], [crossing + 2.6, l]]) {
      if (z1 - z0 < 0.3) continue;
      box(parts, [0.1, 0.09, (z1 - z0) / 2], [side * (w - 0.1), 0.09, (z0 + z1) / 2], 0xe0b020, { solid: true });
    }
    for (const z of [-l + 1.2, crossing - 3.4, crossing + 3.4, l - 1.2]) box(parts, [0.12, 0.08, 0.3], [side * (w - 0.45), 0.08, z], 0x2a2c30);
  }
  for (const end of [-1, 1]) box(parts, [w, 0.09, 0.1], [0, 0.09, end * (l - 0.1)], 0xe0b020, { solid: true });
  for (const [x, z] of piles) {
    // The hoop round the pile, on its bracket out from the pontoon's end.
    const out = Math.sign(z) * (Math.abs(z) - l);
    box(parts, [0.45, 0.12, out / 2], [x, 0.1, Math.sign(z) * (l + Math.abs(out) / 2)], 0x5f666c);
    for (const [dx, dz] of [[-0.45, 0], [0.45, 0], [0, -0.45], [0, 0.45]]) box(parts, [dz ? 0.45 : 0.05, 0.12, dx ? 0.45 : 0.05], [x + dx, 0.1, z + dz], 0x5f666c);
  }
  // A light on a post at one corner, a lifebuoy at the other, a ladder down to the water.
  cyl(parts, 0.06, 1.6, [-w + 0.5, 1.6, l - 0.5], 0x5f666c, { solid: true });
  box(parts, [0.18, 0.12, 0.18], [-w + 0.5, 3.25, l - 0.5], 0xf2f0d8);
  box(parts, [0.04, 0.5, 0.04], [w - 0.5, 0.5, -l + 0.5], 0xd8d6ce, { solid: true });
  cyl(parts, 0.32, 0.05, [w - 0.5, 0.8, -l + 0.42], 0xe8622a, { rot: [Math.PI / 2, 0, 0] });
  for (let k = 0; k < 4; k++) box(parts, [0.3, 0.02, 0.02], [-w + 2, -0.3 - k * 0.3, -l - 0.06], 0x9aa0a6);
  return parts;
}

export interface ShipOptions {
  w: number;
  l: number;
  /** Half the hatches' width; and where along the hatches run, and the gaps between them. */
  hatch: number;
  hatches: [number, number][];
  /** Where its rail along the side the containers slide on is open: [z0, z1]. */
  open: [number, number][];
  /** Where the forecastle starts. */
  fore: number;
  /** Along the near lane, clear of where the loose containers slide: the lashing gear's bins against the hatches, the
   * mushroom vents and the lamp posts at the rail, the fire hose boxes, the lifebuoys; and where the loose ones stood. */
  bins: number[];
  vents: number[];
  lamps: number[];
  hoses: number[];
  buoys: number[];
  loose: number[];
}

/**
 * A reefer ship of the kind that carries frozen fish home from the fishing grounds, come in to load before the port
 * closes: dark hull over red, its accommodation and bridge aft on the side away from its open lane, the funnel; hatches
 * down its middle with its cranes between them; on the far side its own containers stacked and lashed; on the near side
 * the lane its loose ones are on, its rail open in places; forward of the hatches the deck its loads come aboard on, under
 * the fore crane; the forecastle over its bow.
 */
export function reeferShip(o: ShipOptions): Parts {
  const parts: Parts = [];
  const { w, l, hatch, fore } = o;
  const HULL = 0x2b3a55, WHITE = 0xe8e8e0, DECK = 0x5f7a62, RAIL = 0xe8e8e0, SUPER = 0xf0eee6, DARK = 0x2a2e34, YELLOW = 0xe0b020, CRANE = 0xd8a020;
  const bow = l * 0.45;
  const keel = outline(w * 0.82, l * 0.95, bow * 0.85, 0.75), water = outline(w * 0.98, l * 0.99, bow * 0.95, 0.88), top = outline(w, l, bow, 0.9);
  parts.push({ shape: 'loft', lo: keel, hi: water, y0: -7.2, y1: -4.7, color: 0xa83228 });
  parts.push({ shape: 'loft', lo: water, hi: top, y0: -4.7, y1: -0.6, color: HULL });
  parts.push({ shape: 'loft', lo: top, hi: top, y0: -0.6, y1: -0.05, color: WHITE });
  box(parts, [w - 0.05, 3.5, l - bow / 2], [0, -3.6, -bow / 2], HULL, { solid: true, hidden: true });
  box(parts, [w * 0.7, 3.5, bow * 0.45], [0, -3.6, l - bow * 0.45], HULL, { solid: true, hidden: true });
  // The main deck to the forecastle; the forecastle raised over the bow.
  const fy = 2.4;
  box(parts, [w - 0.2, 0.05, (fore + l) / 2 - 0.1], [0, -0.05, (fore - l) / 2], DECK, { solid: true });
  const fw = (z: number) => (z <= l - bow ? w : w - (w * 0.2 * (z - (l - bow))) / (bow * 0.5));
  box(parts, [fw(fore + 4) - 0.35, fy / 2, (l - bow * 0.3 - fore) / 2], [0, fy / 2, (fore + l - bow * 0.3) / 2], WHITE, { solid: true });
  box(parts, [fw(fore + 4) - 0.34, 0.05, (l - bow * 0.3 - fore) / 2], [0, fy + 0.02, (fore + l - bow * 0.3) / 2], DECK);
  // Its after face: doors, a ladder up each side.
  for (const x of [-4, 4]) box(parts, [0.5, 0.95, 0.03], [x, 0.95, fore - 0.02], 0x9aa0a6);
  for (const x of [-(fw(fore) - 1.2), fw(fore) - 1.2]) rod(parts, [x, 0, fore - 1.6], [x, fy, fore], 0.25, 0x7a8288);
  // Walkway lines painted along the lanes; the deck's seams.
  for (const x of [-(hatch + 0.6), hatch + 0.6]) box(parts, [0.06, 0.004, (fore + l) / 2 - 4], [x, 0.003, (fore - l) / 2], YELLOW);
  for (let z = -l + 3; z < fore; z += 3) box(parts, [w - 0.3, 0.002, 0.012], [0, 0.002, z], 0x4f6852);
  // Rails: bulwarks round the deck, open where it says on the near (-x) side and at the stern for the ramp.
  const ring = top.filter(([, z]) => z < fore + 0.5);
  for (let i = 0; i + 1 < ring.length; i++) {
    const a = ring[i], b = ring[i + 1];
    if (a[1] > fore || b[1] > fore) continue;
    const runs: [Vec2, Vec2][] = [];
    if (Math.abs(a[1] - b[1]) < 1e-6) {
      // The transom: open in the middle for the ramp.
      runs.push([[a[0], a[1]], [Math.sign(a[0]) * 3.4, a[1]]], [[Math.sign(b[0]) * 3.4, b[1]], [b[0], b[1]]]);
    } else if (a[0] < 0 && Math.abs(a[0] - b[0]) < 1e-6) {
      let at = Math.min(a[1], b[1]);
      const end = Math.min(Math.max(a[1], b[1]), fore);
      for (const [z0, z1] of [...o.open].sort((p, q) => p[0] - q[0])) {
        if (z0 > at) runs.push([[a[0], at], [a[0], Math.min(z0, end)]]);
        at = Math.max(at, z1);
      }
      if (end > at) runs.push([[a[0], at], [a[0], end]]);
    } else runs.push([a, [b[0], Math.min(b[1], fore)]]);
    for (const [p, q] of runs) {
      const dx = q[0] - p[0], dz = q[1] - p[1], long = Math.hypot(dx, dz);
      if (long < 0.2) continue;
      const nx = -dz / long, nz = dx / long, inward = nx * -(p[0] + q[0]) + nz * -(p[1] + q[1]) > 0 ? 1 : -1;
      const mx = (p[0] + q[0]) / 2 + nx * inward * 0.12, mz = (p[1] + q[1]) / 2 + nz * inward * 0.12, yaw = Math.atan2(dx, dz);
      parts.push({ shape: 'box', half: [0.1, 0.55, long / 2], pos: [mx, 0.55, mz], rot: [0, yaw, 0], color: RAIL, solid: true });
      parts.push({ shape: 'box', half: [0.14, 0.04, long / 2], pos: [mx, 1.12, mz], rot: [0, yaw, 0], color: 0xcfcfc6 });
    }
  }
  // Where the rail is open on the near side: its stanchions bent over, the chain that should have been across gone.
  for (const [z0, z1] of o.open) {
    box(parts, [0.1, 0.25, 0.08], [-(w - 0.15), 0.25, z0 + 0.1], RAIL, { rot: [0.5, 0, 0.6] });
    box(parts, [0.1, 0.25, 0.08], [-(w - 0.15), 0.25, z1 - 0.1], RAIL, { rot: [-0.4, 0, 0.7] });
    box(parts, [0.03, 0.005, (z1 - z0) / 2], [-(w - 0.2), 0.004, (z0 + z1) / 2], 0xc8372d);
  }
  // The hatches: coamings and their covers, panelled and ribbed, cleats along their edges.
  for (const [z0, z1] of o.hatches) {
    box(parts, [hatch, 0.6, (z1 - z0) / 2], [0, 0.6, (z0 + z1) / 2], 0x8a3a2a, { solid: true });
    box(parts, [hatch - 0.12, 0.08, (z1 - z0) / 2 - 0.12], [0, 1.26, (z0 + z1) / 2], 0x9a4434);
    for (let z = z0 + 1.5; z < z1 - 0.5; z += 1.5) box(parts, [hatch - 0.1, 0.05, 0.05], [0, 1.36, z], 0x7a3022);
    for (let z = z0 + 0.8; z < z1; z += 2.2) for (const x of [-hatch - 0.05, hatch + 0.05]) box(parts, [0.06, 0.08, 0.1], [x, 1.05, z], DARK);
  }
  // Its cranes between the hatches, on their pedestals: the house, the jib up and over toward its own side.
  const crane = (x: number, z: number, aim: number) => {
    cyl(parts, 1.0, 2.0, [x, 2.0, z], CRANE, { solid: true });
    box(parts, [1.3, 1.0, 1.6], [x, 5.0, z], CRANE, { rot: [0, aim, 0] });
    box(parts, [0.6, 0.45, 0.02], [x + Math.sin(aim) * 0.9, 5.3, z + Math.cos(aim) * 1.62], 0x2a3a4a, { rot: [0, aim, 0] });
    const head: Vec3 = [x + Math.sin(aim) * 12, 15.5, z + Math.cos(aim) * 12];
    rod(parts, [x, 5.6, z], head, 0.3, CRANE);
    rod(parts, [x, 6.4, z], head, 0.03, DARK);
    rod(parts, head, [head[0], 8.6, head[2]], 0.025, DARK);
    box(parts, [0.25, 0.3, 0.25], [head[0], 8.4, head[2]], YELLOW);
    return head;
  };
  for (let k = 0; k + 1 < o.hatches.length; k++) crane(0, (o.hatches[k][1] + o.hatches[k + 1][0]) / 2, 0.9);
  // The near lane's fittings. The bins for the lashing bars and twistlocks, against the hatch coaming, bars standing in them.
  for (const z of o.bins) {
    box(parts, [0.6, 0.45, 0.95], [-(hatch + 0.65), 0.45, z], 0x6f7a74, { solid: true });
    box(parts, [0.61, 0.05, 0.96], [-(hatch + 0.65), 0.88, z], 0x4f5a54);
    for (let k = 0; k < 5; k++) box(parts, [0.025, 0.4, 0.025], [-(hatch + 0.35) - k * 0.15, 1.1, z - 0.5 + k * 0.25], 0x8a9096, { rot: [0.15, 0, 0.1 * (k - 2)] });
  }
  for (const z of o.vents) {
    cyl(parts, 0.24, 0.45, [-(w - 0.6), 0.45, z], 0xe8e8e0, { solid: true });
    cyl(parts, 0.36, 0.09, [-(w - 0.6), 0.98, z], 0xe8e8e0);
  }
  for (const z of o.lamps) {
    cyl(parts, 0.06, 1.7, [-(w - 0.5), 1.7, z], 0x9aa0a6, { solid: true });
    box(parts, [0.18, 0.12, 0.25], [-(w - 0.65), 3.4, z], 0xf2f0d8);
  }
  for (const z of o.hoses) {
    box(parts, [0.12, 0.35, 0.3], [-(w - 0.4), 0.75, z], 0xc8372d);
    box(parts, [0.02, 0.25, 0.2], [-(w - 0.53), 0.75, z], 0xf2f0ea);
  }
  for (const z of o.buoys) cyl(parts, 0.32, 0.05, [-(w - 0.28), 0.8, z], 0xe8622a, { rot: [0, 0, Math.PI / 2] });
  // Where each loose container stood: the bars that held it, snapped, lying across the deck by the hatch; its twistlocks.
  for (const z of o.loose) {
    rod(parts, [-(hatch + 0.5), 0.03, z + 1.5], [-(hatch + 2.6), 0.03, z + 2.1], 0.025, 0x8a9096);
    rod(parts, [-(hatch + 0.7), 0.03, z - 1.6], [-(hatch + 2.2), 0.03, z - 2.5], 0.025, 0x8a9096);
    for (const dz of [-1.1, 1.1]) box(parts, [0.1, 0.05, 0.08], [-(w - 1.0), 0.05, z + dz], 0x3a3f45);
  }
  // Her accommodation ladder stowed along the near side of her hull, under the rail.
  box(parts, [0.12, 0.35, 6], [-(w + 0.12), -1.4, -6], 0x9aa0a6);
  // Its own containers on the far side, stacked and lashed: rows along it, bays one after another, some two high, reefers
  // among them plugged in; what is felt of them one block.
  const first = o.hatches[0][0], last = o.hatches.at(-1)![1];
  box(parts, [(w - hatch - 1.3) / 2, 1.3, (last - first) / 2], [(w + hatch + 0.5) / 2, 1.3, (first + last) / 2], 0x3f6f8a, { solid: true, hidden: true });
  const COLORS = [0x3f6f8a, 0xb5533c, 0x3d7a5a, 0xd08a26, 0xe8e8e0, 0x8a4a3a];
  let n = 0;
  for (let z = first + 3.1; z < last - 2.9; z += 6.4) {
    for (let r = 0; r < 4; r++) {
      const x = hatch + 1.5 + r * 2.5;
      if (x + 1.2 > w - 0.3) continue;
      const tiers = 1 + ((n * 7 + r * 3) % 5 > 1 ? 1 : 0);
      for (let t = 0; t < tiers; t++) {
        const c = COLORS[(n * 5 + r + t * 2) % COLORS.length], y = 1.3 + t * 2.6;
        box(parts, [1.2, 1.3, 3.0], [x, y, z], c);
        const dark = shade(c, 0.74);
        for (let k = -5; k <= 5; k++) for (const s of [-1, 1]) box(parts, [0.025, 1.12, 0.09], [x + s * 1.22, y, z + k * 0.5], dark);
        box(parts, [1.08, 1.16, 0.02], [x, y, z + 3.02], shade(c, 1.12));
        for (const a of [-0.8, -0.3, 0.3, 0.8]) box(parts, [0.03, 1.1, 0.03], [x + a, y, z + 3.05], 0xb9c0c6);
        if (c === 0xe8e8e0) box(parts, [1.0, 1.0, 0.1], [x, y, z - 3.05], 0x7a8288);
      }
      // Lashing bars from the deck up to the first tier's top corners at its ends.
      for (const s of [-1, 1]) rod(parts, [x + s * 0.9, 0.1, z + 3.3], [x + s * 1.15, 2.5, z + 3.05], 0.02, 0x8a9096);
      n++;
    }
  }
  // Aft, on the far side: the accommodation, four decks, the bridge over them reaching across with its wings, the funnel
  // behind; boats in their davits on its side. All of it faded when it is between the camera and the truck, as it is from
  // the stern ramp.
  const house = parts.length;
  const a0 = -l + 3, a1 = Math.min(first - 2, -l + 17), ax0 = 1.4, ax1 = w - 0.6;
  box(parts, [(ax1 - ax0) / 2, 4.6, (a1 - a0) / 2], [(ax0 + ax1) / 2, 4.6, (a0 + a1) / 2], SUPER, { solid: true });
  for (let deck = 0; deck < 4; deck++) {
    const y = 1.2 + deck * 2.3;
    box(parts, [(ax1 - ax0) / 2 + 0.01, 0.35, 0.02], [(ax0 + ax1) / 2, y, a1 + 0.01], 0x2a3440);
    for (let z = a0 + 1; z < a1 - 0.6; z += 1.6) box(parts, [0.02, 0.35, 0.45], [ax0 - 0.01, y, z], 0x2a3440);
    box(parts, [(ax1 - ax0) / 2 + 0.2, 0.05, (a1 - a0) / 2 + 0.2], [(ax0 + ax1) / 2, y + 1.15, (a0 + a1) / 2], 0xd8d6ce);
  }
  const b0 = a1 - 5, b1 = a1;
  // Its wing out over the near side only a little way: what is over the lane would be between the camera and the truck.
  const bx0 = -3.5, bx1 = w - 0.4;
  box(parts, [(bx1 - bx0) / 2, 1.3, (b1 - b0) / 2], [(bx0 + bx1) / 2, 10.5, (b0 + b1) / 2], SUPER);
  box(parts, [(bx1 - bx0) / 2 + 0.01, 0.45, (b1 - b0) / 2 + 0.01], [(bx0 + bx1) / 2, 10.75, (b0 + b1) / 2], 0x223040);
  box(parts, [(bx1 - bx0) / 2 + 0.2, 0.08, (b1 - b0) / 2 + 0.3], [(bx0 + bx1) / 2, 11.86, (b0 + b1) / 2], 0xd8d6ce);
  cyl(parts, 0.12, 2.5, [ax0 + 3, 14.4, (b0 + b1) / 2], WHITE);
  box(parts, [1.4, 0.08, 0.2], [ax0 + 3, 16.1, (b0 + b1) / 2], DARK, { rot: [0, 0.4, 0] });
  box(parts, [1.6, 2.6, 1.9], [(ax0 + ax1) / 2 + 1, 12.5, a0 + 2.2], 0x2f62a8);
  box(parts, [1.61, 0.4, 1.91], [(ax0 + ax1) / 2 + 1, 14.7, a0 + 2.2], DARK);
  box(parts, [1.62, 0.35, 1.92], [(ax0 + ax1) / 2 + 1, 13.2, a0 + 2.2], 0xc8372d);
  box(parts, [0.9, 0.7, 3.2], [ax1 + 0.25, 7.1, (a0 + a1) / 2], 0xe8622a);
  for (const z of [(a0 + a1) / 2 - 2.6, (a0 + a1) / 2 + 2.6]) rod(parts, [ax1 - 0.4, 6.4, z], [ax1 + 0.4, 8.4, z], 0.08, 0x9aa0a6);
  for (const p of parts.slice(house)) p.fade = true;
  // The stern: the ramp's gantry, a post each side of the opening; the mooring winches and bitts on the near side; the flag.
  for (const x of [-3.9, 3.9]) {
    box(parts, [0.25, 3.2, 0.25], [x, 3.2, -l + 0.6], YELLOW, { solid: true });
    box(parts, [0.4, 0.3, 0.4], [x, 6.5, -l + 0.6], DARK);
  }
  rod(parts, [-3.9, 6.6, -l + 0.6], [3.9, 6.6, -l + 0.6], 0.18, YELLOW);
  for (const [x, z] of [[-10.5, -l + 2.2], [-6.2, -l + 2.0]]) cyl(parts, 0.2, 0.3, [x, 0.3, z], DARK, { solid: true });
  box(parts, [0.9, 0.55, 0.7], [-9, 0.55, -l + 5.2], 0x3d7a5a, { solid: true });
  cyl(parts, 0.5, 0.75, [-9, 0.75, -l + 5.2], 0x2a2e34, { rot: [0, 0, Math.PI / 2] });
  cyl(parts, 0.04, 1.2, [0, 2.3, -l + 0.3], 0xd8d6ce);
  box(parts, [0.01, 0.3, 0.45], [0, 3.15, -l - 0.15], 0xc8372d);
  // Forward: the deck loads come aboard on, a square painted on it under the fore crane's hook, its net laid out; the
  // fore crane on the far side; on the forecastle the windlasses, the chains to the hawse pipes, the foremast.
  const lz = (last + fore) / 2;
  for (const [x, z, hx, hz] of [[-3.5, lz, 5.5, 0.06], [-3.5, lz, 0.06, (fore - last) / 2 - 1.2]] as const) {
    for (const s of [-1, 1]) box(parts, hz < 1 ? [hx, 0.004, 0.08] : [0.08, 0.004, hz], hz < 1 ? [x, 0.004, z + s * ((fore - last) / 2 - 1.2)] : [x + s * 5.5, 0.004, z], YELLOW);
  }
  for (let k = -4; k <= 4; k++) box(parts, [0.12, 0.004, 0.5], [-3.5 + k * 1.1, 0.005, lz], 0xe8e2d0, { rot: [0, 0.785, 0] });
  const hook = crane(w - 4.5, fore - 2.5, -1.25);
  void hook;
  for (const x of [-2.2, 2.2]) {
    cyl(parts, 0.45, 0.4, [x, fy + 0.45, l - bow * 0.55], 0x3d7a5a, { rot: [0, 0, Math.PI / 2] });
    rod(parts, [x, fy + 0.1, l - bow * 0.55 + 0.5], [x * 1.4, fy + 0.1, l - bow * 0.35], 0.12, DARK);
  }
  cyl(parts, 0.15, 4, [0, fy + 4, fore + 3], WHITE);
  box(parts, [0.9, 0.06, 0.06], [0, fy + 6.5, fore + 3], WHITE);
  cyl(parts, 0.1, 0.1, [0, fy + 8.1, fore + 3], 0xf2f0d8);
  for (const s of [-1, 1]) box(parts, [0.05, 0.5, (l - bow * 0.3 - fore) / 2], [s * (fw(fore + 4) - 0.4), fy + 0.5, (fore + l - bow * 0.3) / 2], RAIL);
  return parts;
}

/** A colour darker or lighter by a factor. */
function shade(color: number, k: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * k)), g = Math.min(255, Math.round(((color >> 8) & 255) * k)), b = Math.min(255, Math.round((color & 255) * k));
  return (r << 16) | (g << 8) | b;
}

/**
 * A fishing boat thrown over and lying upside down, as one ashore after a typhoon: its bottom up, red, the keel along its
 * top, the propeller and rudder at its stern up in the air; its bulwarks crushed under it on the ground, its white band
 * and its tyres just above. What stood on its deck is broken off: the level lays that by it. Its frame as a boat's, the
 * deck's top at nought: stand it at the height of its bulwarks for them to be on the ground.
 */
export function capsizedBoat(o: BoatOptions): Parts {
  const out: Parts = [];
  const flip = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI);
  for (const p of fishingBoat(o)) {
    if (p.shape === 'loft') {
      // Turned over: what was its bottom now its top.
      out.push({ ...p, lo: p.hi, hi: p.lo, y0: -p.y1!, y1: -p.y0! });
      continue;
    }
    const [x, y, z] = p.pos ?? [0, 0, 0];
    // Nothing that stood above its bulwarks.
    if (y > 0.85) continue;
    const turned = flip.clone().multiply(new Quaternion().setFromEuler(new Euler(...(p.rot ?? [0, 0, 0]))));
    const e = new Euler().setFromQuaternion(turned);
    out.push({ ...p, pos: [-x, -y, z], rot: [e.x, e.y, e.z] });
  }
  const { l } = o;
  // Its keel the length of it; at the stern the rudder on its stock, the propeller on its shaft, bronze.
  box(out, [0.13, 0.12, l * 0.78], [0, 2.68, -l * 0.08], 0x3a2a24, { solid: true });
  box(out, [0.07, 0.62, 0.48], [0, 2.95, -l + 0.35], 0x3a2a24);
  cyl(out, 0.07, 0.6, [0, 2.2, -l + 1.3], 0x8a8f96, { rot: [Math.PI / 2, 0, 0] });
  for (const a of [0, 2.1, 4.2]) box(out, [0.05, 0.42, 0.13], [Math.sin(a) * 0.4, 2.2 + Math.cos(a) * 0.4, -l + 0.95], 0xc9a24a, { rot: [0.3, 0, -a] });
  // Weed and shell along where its waterline was, green.
  for (const side of [-1, 1]) box(out, [0.02, 0.1, l * 0.8], [side * (o.w * 0.9 + 0.01), 1.25, -0.2], 0x4f6a3a);
  return out;
}
