import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { FlockDesc } from './types';
import type { Vec3 } from '../config';
import type { ClownDesc, CrowdDesc, DecalDesc, FloatPartDesc, FordDesc, LevelDef, PropDesc, RigDesc, SignDesc, SlickDesc, Vec2, WaveDesc } from './types';
import type { ObjectDesc, ObjectKindId } from './objects';
import type { Look, P2, Relief } from './relief';

// The amusement park's rides, as level 5 and its proving ground both build them: what each is made of and where the truck
// goes on it. Each takes the place to put it and the level's props, and gives back what else the level needs of it.

// ---------------------------------------------------------------------------------------------------------------------
// A way through the air: a centre line laid out on the ground as straights and bends, and its height along it as a
// string of points joined by grades, each change of grade rounded over a length of its own.

/** A piece of a way's plan: straight on for so far, or round a bend of a radius by an angle (radians, + to the left). */
export type PlanPiece = { long: number } | { radius: number; turn: number };

/** Where along a way, metres, and how high there, with how long a curve rounds the change of grade at that point. */
export type ProfilePoint = [along: number, y: number, round?: number];

export interface WayPoint {
  /** Metres along the way. */
  s: number;
  x: number;
  y: number;
  z: number;
  /** The way it heads on the ground, radians about Y, 0 = toward +Z. */
  yaw: number;
  /** Its grade there, rise over run. */
  grade: number;
}

/** The plan's centre line, from a start heading a way, every `step` metres. */
function planLine(start: Vec2, yaw0: number, plan: PlanPiece[], step: number): { s: number; x: number; z: number; yaw: number }[] {
  const out = [{ s: 0, x: start[0], z: start[1], yaw: yaw0 }];
  let { x, z } = { x: start[0], z: start[1] }, yaw = yaw0, s = 0;
  for (const piece of plan) {
    const long = 'long' in piece ? piece.long : piece.radius * Math.abs(piece.turn);
    const n = Math.max(1, Math.round(long / step));
    for (let k = 0; k < n; k++) {
      const ds = long / n;
      if ('long' in piece) {
        x += Math.sin(yaw) * ds;
        z += Math.cos(yaw) * ds;
      } else {
        // Along the arc: the chord, at the middle heading of this little piece of it.
        const dyaw = (piece.turn / Math.abs(piece.turn)) * (ds / piece.radius);
        const mid = yaw + dyaw / 2, chord = 2 * piece.radius * Math.sin(Math.abs(dyaw) / 2);
        x += Math.sin(mid) * chord;
        z += Math.cos(mid) * chord;
        yaw += dyaw;
      }
      s += ds;
      out.push({ s, x, z, yaw });
    }
  }
  return out;
}

/** The height at a point along a profile: straight grades between its points, each joint rounded over its length. */
export function profileAt(profile: ProfilePoint[], s: number): { y: number; grade: number } {
  const grade = (k: number) => (profile[k + 1][1] - profile[k][1]) / (profile[k + 1][0] - profile[k][0]);
  // On the straight grades first.
  let k = 0;
  while (k < profile.length - 2 && s > profile[k + 1][0]) k++;
  let y = profile[k][1] + grade(k) * (s - profile[k][0]), g = grade(k);
  // Then the rounding of any joint near enough: a parabola over its length, from the grade before to the one after.
  for (let j = 1; j < profile.length - 1; j++) {
    const [at, , round = 0] = profile[j];
    if (round <= 0 || Math.abs(s - at) >= round / 2) continue;
    const g1 = grade(j - 1), g2 = grade(j), u = s - (at - round / 2);
    y = profile[j][1] - g1 * (round / 2) + g1 * u + ((g2 - g1) / (2 * round)) * u * u;
    g = g1 + ((g2 - g1) * u) / round;
  }
  return { y, grade: g };
}

/** The way, every `step` metres: where, how high, heading which way, how steep. */
export function wayPoints(start: Vec2, yaw: number, plan: PlanPiece[], profile: ProfilePoint[], step = 1): WayPoint[] {
  return planLine(start, yaw, plan, step).map((p) => ({ ...p, ...profileAt(profile, p.s) }));
}

const q = new Quaternion(), q2 = new Quaternion(), e = new Euler(), ax = new Vector3();

/** How a box lies whose length is along a way heading `yaw` and rising at `grade`, leaning `lean` about that length: as a prop's rotation. */
export function alongRot(yaw: number, grade: number, lean = 0): Vec3 {
  q.setFromAxisAngle(ax.set(0, 1, 0), yaw).multiply(q2.setFromAxisAngle(ax.set(1, 0, 0), -Math.atan(grade)));
  if (lean) q.multiply(q2.setFromAxisAngle(ax.set(0, 0, 1), lean));
  e.setFromQuaternion(q, 'XYZ');
  return [e.x, e.y, e.z];
}

/** A point beside a way: so far across it (+ to the left of the way it heads) and up from its top. */
export function beside(p: WayPoint, across: number, up = 0): Vec3 {
  return [p.x + Math.cos(p.yaw) * across, p.y + up, p.z - Math.sin(p.yaw) * across];
}

/**
 * Solid lengths along a way between each pair of its points: a box `wide` across and `thick` deep under its top, each a
 * little longer than the gap so that none opens between them round a bend or over a crest.
 */
export function along(props: PropDesc[], way: WayPoint[], wide: number | ((mid: WayPoint) => number), thick: number, color: number, extra: Partial<PropDesc> = {}, across = 0, up = 0): void {
  for (let k = 0; k < way.length - 1; k++) {
    const a = way[k], b = way[k + 1];
    const long = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const yaw = Math.atan2(b.x - a.x, b.z - a.z), grade = (b.y - a.y) / Math.hypot(b.x - a.x, b.z - a.z);
    const mid: WayPoint = { s: (a.s + b.s) / 2, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, yaw, grade };
    const w = typeof wide === 'number' ? wide : wide(mid);
    // Down from its top by half its depth, square to its own slope: so a little back along the way going up.
    const c = Math.cos(Math.atan(grade)), sn = Math.sin(Math.atan(grade));
    const [x, y, z] = beside(mid, across, up - (thick / 2) * c);
    const back = (thick / 2) * sn;
    props.push({ shape: 'box', size: [w / 2, thick / 2, long / 2 + 0.06], pos: [x + Math.sin(yaw) * back, y, z + Math.cos(yaw) * back], rot: alongRot(yaw, grade), color, ...extra });
  }
}

/** A round bar along a way: so far across it and up from its top, of a radius. */
export function rail(props: PropDesc[], way: WayPoint[], across: number | ((p: WayPoint) => number), up: number, radius: number, color: number, extra: Partial<PropDesc> = {}): void {
  const off = (p: WayPoint) => (typeof across === 'number' ? across : across(p));
  for (let k = 0; k < way.length - 1; k++) {
    const a = beside(way[k], off(way[k]), up), b = beside(way[k + 1], off(way[k + 1]), up);
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], long = Math.hypot(d[0], d[1], d[2]);
    props.push({ shape: 'cylinder', size: [radius, long / 2 + 0.02, 0], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: barRot(d), color, ghost: true, ...extra });
  }
}

/**
 * A guard along the edge of a way: a plate of steel banked up outward from the deck's edge, as the lip of a trough. A wheel
 * that strays on to it climbs it, and the truck leans and comes back down it on to the deck: nothing for its side to catch
 * on, nothing standing up to be hit. Shoved hard enough, by a train, it goes over. Its ends lie flat.
 */
export function guard(props: PropDesc[], way: WayPoint[], across: number | ((p: WayPoint) => number), color: number): void {
  const STEEP = 0.6, HALF = 0.36, EASE = 4;
  for (let k = 0; k < way.length - 1; k++) {
    const p = way[k], n = way[k + 1];
    if (n.s - p.s > 2) continue;
    const base = (typeof across === 'number' ? across : (across(p) + across(n)) / 2), side = Math.sign(base);
    const mid: WayPoint = { ...p, x: (p.x + n.x) / 2, y: (p.y + n.y) / 2, z: (p.z + n.z) / 2 };
    const long = Math.hypot(n.x - p.x, n.z - p.z) / 2 + 0.05 + Math.abs(base) * Math.abs(n.yaw - p.yaw) / 2;
    // Laid flat at each end of it and banked up over a few metres: no end stands up to be met head on.
    const BANK = STEEP * Math.min(1, (k + 0.5) / EASE, (way.length - 1.5 - k) / EASE);
    props.push({ shape: 'box', size: [HALF, 0.03, long], pos: beside(mid, base + side * HALF * Math.cos(BANK), HALF * Math.sin(BANK) - 0.02), rot: alongRot(p.yaw, p.grade, side * BANK), color });
    if (k % 2 === 0) props.push({ shape: 'box', size: [0.05, 0.035, long], pos: beside(mid, base + side * (2 * HALF - 0.05) * Math.cos(BANK), (2 * HALF - 0.05) * Math.sin(BANK)), rot: alongRot(p.yaw, p.grade, side * BANK), color: 0xf2efe6, ghost: true });
  }
}

/** How a cylinder lies, upright as made, turned to run along d. */
export function barRot(d: number[]): Vec3 {
  const long = Math.hypot(d[0], d[1], d[2]);
  q.setFromUnitVectors(ax.set(0, 1, 0), new Vector3(d[0] / long, d[1] / long, d[2] / long));
  e.setFromQuaternion(q, 'XYZ');
  return [e.x, e.y, e.z];
}

/** A bar from one point to another. */
export function bar(props: PropDesc[], a: Vec3, b: Vec3, radius: number, color: number, extra: Partial<PropDesc> = {}): void {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  props.push({ shape: 'cylinder', size: [radius, Math.hypot(d[0], d[1], d[2]) / 2, 0], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: barRot(d), color, ...extra });
}

// ---------------------------------------------------------------------------------------------------------------------
// The roller coaster, its track wide enough to take the truck: a steel deck between the two running rails, its spine under
// it, ties every two metres, white columns down to the ground; a chain up the lift hill, fins on the brake run.

export const COASTER = {
  /** The deck the truck runs on, from rail to rail. */
  wide: 4.2,
  thick: 0.14,
  red: 0xd23a32,
  darkRed: 0x9a2a26,
  deck: 0x4a5056,
  column: 0xf0f0ea,
  footing: 0xb8b6ae,
};

export interface CoasterDesc {
  start: Vec2;
  yaw: number;
  plan: PlanPiece[];
  profile: ProfilePoint[];
  /** Metres along it: the station's flat (no columns, its own roof), the lift's chain, the brake run's fins. */
  station: [number, number];
  lift: [number, number];
  brakes: [number, number];
  /** Ground height under it, where that is not nought. */
  ground?: (x: number, z: number) => number;
  /** Where it is carried by something else under it (a hill of rock it runs over), and needs no columns. */
  carried?: (x: number, z: number) => boolean;
  /**
   * How much wider its deck is round a bend of a radius, metres: as a road is widened round a bend, for what the truck's back
   * wheels cut inside its front ones. Eased in before each bend and out after it. None if not given.
   */
  widen?: (radius: number) => number;
  /** Built only from so far along it on: before that it runs on another's deck. And this much lower, to lie under that one's where they meet. */
  from?: number;
  to?: number;
  sink?: number;
  /** Where its rail on a side (1 left, -1 right) is left out, from and to metres along: another track joining it there. */
  gaps?: [number, number, number][];
  /** Where its guard on a side is left out and its line is not: along a platform level with it. */
  open?: [number, number, number][];
}

/** Each metre along a way, how much its deck is widened there for the bends: eased in and out over some metres either side. */
function widening(way: WayPoint[], widen?: (radius: number) => number): number[] {
  if (!widen) return way.map(() => 0);
  const raw = way.map((_, k) => {
    const a = way[Math.max(0, k - 2)], b = way[Math.min(way.length - 1, k + 2)];
    const turn = Math.abs(Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw))) / Math.max(0.5, b.s - a.s);
    return turn > 1 / 80 ? widen(1 / turn) : 0;
  });
  const held = raw.map((_, k) => Math.max(...raw.slice(Math.max(0, k - 7), k + 8)));
  return held.map((_, k) => { const near = held.slice(Math.max(0, k - 4), k + 5); return near.reduce((sum, v) => sum + v, 0) / near.length; });
}

export function coaster(props: PropDesc[], d: CoasterDesc): WayPoint[] {
  const way = wayPoints(d.start, d.yaw, d.plan, d.profile, 1);
  const ground = d.ground ?? (() => 0);
  const W = COASTER.wide;
  const wider = widening(way, d.widen);
  /** Half its deck's width at a point along it. */
  const halfAt = (p: WayPoint) => (W + wider[Math.max(0, Math.min(wider.length - 1, Math.round(p.s)))]) / 2;
  const up = way.filter((p) => p.y > ground(p.x, p.z) + 0.02 && p.s >= (d.from ?? -1) && p.s <= (d.to ?? Infinity));
  const sink = -(d.sink ?? 0);
  /** Its lengths along a side, but where that side is open to another track. */
  const runs = (side: number, guarded = false): WayPoint[][] => {
    const out: WayPoint[][] = [[]];
    for (const p of up) {
      if ([...(d.gaps ?? []), ...(guarded ? d.open ?? [] : [])].some(([a, b, s]) => s === side && p.s >= a && p.s <= b)) { if (out[out.length - 1].length) out.push([]); } else out[out.length - 1].push(p);
    }
    return out;
  };
  // The deck, solid; its grating drawn in lines across it every metre; the yellow line down each edge the truck keeps inside.
  along(props, up, (m) => 2 * halfAt(m), COASTER.thick, COASTER.deck, { mapColor: 0x9a2a26 }, 0, sink);
  for (let k = 0; k < up.length; k += 1) {
    const p = up[k];
    props.push({ shape: 'box', size: [halfAt(p) - 0.25, 0.006, 0.03], pos: beside(p, 0, 0.008), rot: alongRot(p.yaw, p.grade), color: 0x3a3f44, ghost: true });
  }
  for (const side of [-1, 1]) for (const run of runs(side)) rail(props, run, (p) => side * (halfAt(p) - 0.12), 0.012, 0.06, 0xe8c22a);
  // The running rails along its edges, and the spine under its middle; under each tie a C of steel out to the rails.
  for (const side of [-1, 1]) for (const run of runs(side, true)) guard(props, run, (p) => side * (halfAt(p) - 0.02), COASTER.red);
  along(props, up, 0.9, 0.8, COASTER.red, { ghost: true }, 0, -0.55);
  for (let k = 0; k < up.length; k += 2) {
    const p = up[k], half = halfAt(p);
    props.push({ shape: 'box', size: [half + 0.15, 0.1, 0.14], pos: beside(p, 0, -0.26), rot: alongRot(p.yaw, p.grade), color: COASTER.darkRed, ghost: true });
    for (const side of [-1, 1]) bar(props, beside(p, side * (half + 0.06), -0.1), beside(p, side * 0.45, -0.9), 0.07, COASTER.darkRed, { ghost: true });
  }
  const half = W / 2;
  // The lift: its chain up the middle, the ratchet's teeth beside it; a catwalk up its side with a handrail.
  const lift = up.filter((p) => p.s >= d.lift[0] && p.s <= d.lift[1]);
  along(props, lift, 0.22, 0.05, 0x2a2c30, { ghost: true }, 0, 0.045);
  for (let k = 0; k < lift.length; k++) for (const side of [-0.28, 0.28]) props.push({ shape: 'box', size: [0.05, 0.03, 0.12], pos: beside(lift[k], side, 0.03), rot: alongRot(lift[k].yaw, lift[k].grade), color: 0xd0a020, ghost: true });
  along(props, lift, 0.8, 0.05, 0x6f767c, { ghost: true }, half + 0.75, -0.2);
  rail(props, lift, half + 1.12, 0.85, 0.03, 0xe8c22a);
  for (let k = 0; k < lift.length; k += 3) bar(props, beside(lift[k], half + 1.12, -0.2), beside(lift[k], half + 1.12, 0.85), 0.025, 0xe8c22a, { ghost: true });
  // The brake run: two rows of copper fins down its middle, low enough to go under the truck.
  const brakes = up.filter((p) => p.s >= d.brakes[0] && p.s <= d.brakes[1]);
  for (const side of [-0.35, 0.35]) along(props, brakes, 0.05, 0.22, 0xb87333, { ghost: true }, side, 0.2);
  // Columns: one under each length of it from the ground to its spine, every ten metres or so, but in the station; up high,
  // two legs spread out to their feet, braced across. Felt: something to keep off driving under it.
  for (let k = 5; k < up.length; k += 10) {
    const p = up[k];
    if (p.s > d.station[0] - 2 && p.s < d.station[1] + 2) continue;
    if (d.carried?.(p.x, p.z)) continue;
    const g = ground(p.x, p.z), top = p.y - 1.05;
    if (top - g < 0.6) continue;
    if (top - g < 7) {
      bar(props, [p.x, g, p.z], [p.x, top, p.z], 0.32, COASTER.column);
      props.push({ shape: 'box', size: [0.7, 0.25, 0.7], pos: [p.x, g + 0.25, p.z], rot: [0, p.yaw, 0], color: COASTER.footing });
      props.push({ shape: 'box', size: [0.5, 0.12, 0.5], pos: [p.x, top, p.z], rot: [0, p.yaw, 0], color: COASTER.column, ghost: true });
      continue;
    }
    const spread = 1.4 + (top - g) * 0.16;
    for (const side of [-1, 1]) {
      const foot = beside({ ...p, y: g }, side * spread), head = beside({ ...p, y: top }, side * 0.4);
      bar(props, foot, head, 0.27, COASTER.column);
      props.push({ shape: 'box', size: [0.65, 0.25, 0.65], pos: [foot[0], g + 0.25, foot[2]], rot: [0, p.yaw, 0], color: COASTER.footing });
    }
    for (let h = g + 3.5; h < top - 1.5; h += 3.5) {
      const f = (h - g) / (top - g), w = spread + (0.4 - spread) * f;
      bar(props, beside({ ...p, y: h }, -w), beside({ ...p, y: h }, w), 0.1, COASTER.column, { ghost: true });
    }
    props.push({ shape: 'box', size: [0.55, 0.14, 0.45], pos: [p.x, top, p.z], rot: [0, p.yaw, 0], color: COASTER.column, ghost: true });
  }
  return way;
}

/** One of a coaster's cars, its middle at a point on the way and facing along it: the car, its two rows of seats, lap bars, wheels. */
export function coasterCar(props: PropDesc[], p: WayPoint, front: boolean, color = COASTER.red): void {
  const rot = alongRot(p.yaw, p.grade);
  const at = (across: number, upBy: number, ahead: number): Vec3 => {
    const [x, y, z] = beside(p, across, upBy);
    return [x + Math.sin(p.yaw) * ahead, y + p.grade * ahead, z + Math.cos(p.yaw) * ahead];
  };
  props.push({ shape: 'box', size: [1.55, 0.35, 1.25], pos: at(0, 0.75, 0), rot, color });
  props.push({ shape: 'box', size: [1.58, 0.08, 1.28], pos: at(0, 1.08, 0), rot, color: 0xf2efe6, ghost: true });
  for (const row of [-0.45, 0.55]) {
    props.push({ shape: 'box', size: [1.3, 0.12, 0.35], pos: at(0, 1.1, row), rot, color: 0x24262a, ghost: true });
    props.push({ shape: 'box', size: [1.3, 0.45, 0.08], pos: at(0, 1.46, row - 0.38), rot, color: 0x24262a, ghost: true });
    for (const x of [-0.75, 0, 0.75]) props.push({ shape: 'box', size: [0.05, 0.22, 0.05], pos: at(x, 1.5, row + 0.2), rot, color: 0xf2c12e, ghost: true });
    props.push({ shape: 'box', size: [1.25, 0.04, 0.05], pos: at(0, 1.72, row + 0.2), rot, color: 0xf2c12e, ghost: true });
  }
  for (const side of [-1, 1]) for (const end of [-0.8, 0.8]) props.push({ shape: 'cylinder', size: [0.24, 0.14, 0], pos: at(side * 1.85, 0.25, end), rot: alongRot(p.yaw, p.grade, Math.PI / 2), color: 0x2a2c30, ghost: true });
  if (front) {
    // The lead car's nose: a fairing sloped down in front, its headlamps and a number.
    props.push({ shape: 'box', size: [1.5, 0.3, 0.5], pos: at(0, 0.9, 1.55), rot: alongRot(p.yaw, p.grade - 0.5), color, ghost: true });
    for (const side of [-0.9, 0.9]) props.push({ shape: 'sphere', size: [0.14, 0.14, 0.08], pos: at(side, 0.95, 1.95), color: 0xfff2c0, ghost: true, glow: true });
  }
}

/** How a box lies whose length is along `ahead` and whose top faces `up`: as a prop's rotation. */
export function basisRot(ahead: Vec3, up: Vec3): Vec3 {
  const z = new Vector3(...ahead).normalize(), x = new Vector3().crossVectors(new Vector3(...up), z).normalize();
  e.setFromQuaternion(q.setFromRotationMatrix(new Matrix4().makeBasis(x, new Vector3().crossVectors(z, x), z)), 'XYZ');
  return [e.x, e.y, e.z];
}

/**
 * A loop, upright: from a point of a way and heading as it does, forward and up and over and down again to the height it
 * began at, stepped `shift` to the left as it goes so that it comes down beside where it went up. Its points a metre or
 * so apart, with which way is up from the track at each (in toward its middle).
 */
export function loopPoints(from: WayPoint, radius: number, shift: number): { pos: Vec3; up: Vec3 }[] {
  const n = Math.round(2 * Math.PI * radius), fx = Math.sin(from.yaw), fz = Math.cos(from.yaw), lx = Math.cos(from.yaw), lz = -Math.sin(from.yaw);
  return Array.from({ length: n }, (_, k) => {
    const a = ((k + 1) / n) * 2 * Math.PI, out = radius * Math.sin(a), side = (shift * (k + 1)) / n;
    return { pos: [from.x + fx * out + lx * side, from.y + radius * (1 - Math.cos(a)), from.z + fz * out + lz * side] as Vec3, up: [-fx * Math.sin(a), Math.cos(a), -fz * Math.sin(a)] as Vec3 };
  });
}

/** A loop's track and what holds it up: its deck plate by plate round it, the rails, the spine outside; two towers beside it, tied to it at its sides and its top. */
export function loopTrack(props: PropDesc[], from: WayPoint, pts: { pos: Vec3; up: Vec3 }[], radius: number): void {
  const all = [{ pos: [from.x, from.y, from.z] as Vec3, up: [0, 1, 0] as Vec3 }, ...pts];
  const off = (p: { pos: Vec3; up: Vec3 }, left: Vec3, across: number, upBy: number): Vec3 => [p.pos[0] + left[0] * across + p.up[0] * upBy, p.pos[1] + left[1] * across + p.up[1] * upBy, p.pos[2] + left[2] * across + p.up[2] * upBy];
  const left: Vec3 = [Math.cos(from.yaw), 0, -Math.sin(from.yaw)];
  for (let k = 0; k < all.length - 1; k++) {
    const a = all[k], b = all[k + 1], d: Vec3 = [b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]], long = Math.hypot(...d);
    const mid = { pos: [(a.pos[0] + b.pos[0]) / 2, (a.pos[1] + b.pos[1]) / 2, (a.pos[2] + b.pos[2]) / 2] as Vec3, up: [(a.up[0] + b.up[0]) / 2, (a.up[1] + b.up[1]) / 2, (a.up[2] + b.up[2]) / 2] as Vec3 };
    const rot = basisRot(d, mid.up);
    props.push({ shape: 'box', size: [COASTER.wide / 2, COASTER.thick / 2, long / 2 + 0.08], pos: off(mid, left, 0, -COASTER.thick / 2), rot, color: COASTER.deck, ghost: true });
    props.push({ shape: 'box', size: [COASTER.wide / 2 + 0.15, 0.1, 0.14], pos: off(mid, left, 0, -0.26), rot, color: COASTER.darkRed, ghost: true });
    props.push({ shape: 'box', size: [0.45, 0.4, long / 2 + 0.1], pos: off(mid, left, 0, -0.75), rot, color: COASTER.red, ghost: true });
    for (const side of [-1, 1]) {
      bar(props, off(a, left, side * (COASTER.wide / 2 + 0.06), 0.06), off(b, left, side * (COASTER.wide / 2 + 0.06), 0.06), 0.2, COASTER.red, { ghost: true });
      bar(props, off(a, left, side * (COASTER.wide / 2 - 0.12), 0.012), off(b, left, side * (COASTER.wide / 2 - 0.12), 0.012), 0.06, 0xe8c22a, { ghost: true });
    }
  }
  // The towers: one each side of it at its middle, as high as it; a beam across over its top; ties in to its sides.
  const top = all[Math.round(all.length / 2)], quarter = all[Math.round(all.length / 4)], three = all[Math.round((all.length * 3) / 4)];
  const mx = (from.x + all[all.length - 1].pos[0]) / 2, mz = (quarter.pos[2] + three.pos[2]) / 2, high = from.y + 2 * radius + 1.6;
  for (const side of [-1, 1]) {
    const tx = mx + left[0] * side * (COASTER.wide + 3.2), tz = mz + left[2] * side * (COASTER.wide + 3.2);
    for (const lean of [-1, 1]) {
      const fx = Math.sin(from.yaw) * lean * 2.6, fz = Math.cos(from.yaw) * lean * 2.6;
      bar(props, [tx + fx, 0, tz + fz], [tx, high, tz], 0.3, COASTER.column, { ghost: true });
      props.push({ shape: 'box', size: [0.7, 0.25, 0.7], pos: [tx + fx, 0.25, tz + fz], color: COASTER.footing, ghost: true });
    }
    bar(props, [tx, high, tz], off(top, left, side * 1.2, -1.2), 0.14, COASTER.column, { ghost: true });
    for (const p of [quarter, three]) bar(props, [tx, p.pos[1], tz], off(p, left, side * (COASTER.wide / 2 + 0.2), -0.9), 0.14, COASTER.column, { ghost: true });
    for (let h = 3.5; h < high - 1; h += 3.5) for (const lean of [-1, 1]) {
      const k = 1 - h / high;
      bar(props, [tx + Math.sin(from.yaw) * lean * 2.6 * k, h, tz + Math.cos(from.yaw) * lean * 2.6 * k], [tx - Math.sin(from.yaw) * lean * 2.6 * (1 - (h + 3.5) / high), Math.min(high, h + 3.5), tz - Math.cos(from.yaw) * lean * 2.6 * (1 - (h + 3.5) / high)], 0.08, COASTER.column, { ghost: true });
    }
  }
}

/**
 * A coaster's train, running: so many cars, each carried round the ring on its own (so that they follow its bends), the
 * first with its nose and lamps. In its seats its riders, their arms up, a bar over each one's shoulders. `pace` and `stop` as a rig's track.
 */
export function coasterTrain(track: { way: Vec3[]; ups: Vec3[] }, cars: number, pace: [number, number][], stop: [number, number], says: NonNullable<RigDesc['track']>['says'], color = COASTER.red, delay = 0): RigDesc[] {
  const { way, ups } = track;
  const mid: Vec3 = [way.reduce((m, p) => m + p[0], 0) / way.length, 0, way.reduce((m, p) => m + p[2], 0) / way.length];
  return Array.from({ length: cars }, (_, n): RigDesc => {
    const parts: FloatPartDesc[] = [
      { shape: 'box', half: [1.5, 0.33, 1.3], pos: [0, 0.72, 0], color, solid: true },
      { shape: 'box', half: [1.5, 0.5, 1.25], pos: [0, 1.5, 0], color, solid: true, hidden: true },
      { shape: 'box', half: [1.53, 0.07, 1.33], pos: [0, 1.08, 0], color: 0xf2efe6 },
      { shape: 'box', half: [1.2, 0.05, 0.9], pos: [0, 0.22, 0], color: 0x2a2c30 },
    ];
    // Its sides, cut down at each row to step in over; a grab bar along the front of each row.
    for (const side of [-1, 1]) {
      parts.push({ shape: 'box', half: [0.06, 0.2, 1.3], pos: [side * 1.47, 1.3, 0], color });
      parts.push({ shape: 'box', half: [0.065, 0.03, 1.3], pos: [side * 1.47, 1.5, 0], color: 0xf2c12e });
    }
    for (const [r, row] of [-0.5, 0.62].entries()) {
      parts.push({ shape: 'box', half: [1.38, 0.1, 0.36], pos: [0, 1.16, row], color: 0x24262a });
      parts.push({ shape: 'box', half: [1.38, 0.3, 0.07], pos: [0, 1.46, row - 0.4], color: 0x24262a });
      for (const [i, x] of [-0.86, 0, 0.86].entries()) {
        const who = n * 6 + r * 3 + i;
        // The seat's headrest; who sits in it; the bar down over their shoulders, yellow, padded black.
        parts.push({ shape: 'box', half: [0.2, 0.09, 0.05], pos: [x, 1.84, row - 0.42], color: 0xf2c12e });
        parts.push(...rider([x, 1.26, row - 0.08], 0, who));
        for (const side of [-1, 1]) {
          parts.push({ shape: 'box', half: [0.035, 0.2, 0.035], pos: [x + side * 0.15, 1.78, row + 0.1], rot: [0.5, 0, 0], color: 0xf2c12e });
          // Arms: most of them up in the air, the rest holding on.
          if (who % 4) parts.push({ shape: 'box', half: [0.05, 0.24, 0.05], pos: [x + side * 0.3, 2.08, row - 0.02], rot: [0, 0, -side * 0.35], color: SKIN[who % SKIN.length] });
          else parts.push({ shape: 'box', half: [0.05, 0.05, 0.2], pos: [x + side * 0.24, 1.7, row + 0.14], color: SKIN[who % SKIN.length] });
        }
        parts.push({ shape: 'box', half: [0.2, 0.05, 0.04], pos: [x, 1.6, row + 0.2], color: 0x24262a });
      }
    }
    for (const side of [-1, 1]) for (const end of [-0.8, 0.8]) parts.push({ shape: 'cyl', half: [0.24, 0.14, 0], pos: [side * 1.7, 0.25, end], rot: [0, 0, Math.PI / 2], color: 0x2a2c30 });
    if (n === 0) {
      parts.push({ shape: 'box', half: [1.45, 0.3, 0.5], pos: [0, 0.9, 1.6], rot: [0.5, 0, 0], color, solid: true });
      parts.push({ shape: 'box', half: [1.0, 0.04, 0.3], pos: [0, 1.13, 1.52], rot: [0.5, 0, 0], color: 0xf2c12e });
      for (const side of [-0.9, 0.9]) parts.push({ shape: 'orb', half: [0.15, 0.15, 0.1], pos: [side, 0.86, 2.0], color: 0xfff2c0 });
    } else {
      parts.push({ shape: 'box', half: [0.12, 0.08, 0.2], pos: [0, 0.6, 1.45], color: 0x2a2c30 });
    }
    return { kind: 'float', hull: 'vessel', pos: mid, yaw: 0, period: 1, phase: 0, parts, track: { way, ups, pace, stop, delay, lead: n * 3.0, says: n % 2 ? undefined : says } };
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// The teacups: three turntables in a row, side by side, each turning its own way at its own pace, flush with the paving
// round them; on each four cups, solid, turning with it, the way across its middle between them open. The truck drives on at the gap in
// the planters at one end and off by the other, each table it crosses carrying it round its own way under it.

export const TEACUPS = { radius: 10, ring: 6.7, top: 0.08 };
/** How much wider and how much taller a cup is drawn than the sizes written in it; those sitting in it stay their own size. */
const CUP_WIDE = 1.4, CUP_TALL = 1.2;

/** A bar, as a part of something that moves: a cylinder from a to b in its own frame. */
export function rigBar(a: Vec3, b: Vec3, radius: number, color: number, solid = false): FloatPartDesc {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  return { shape: 'cyl', half: [radius, Math.hypot(d[0], d[1], d[2]) / 2, 0], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: barRot(d), color, solid };
}

/** A round outline of so many corners: [x, z] round a middle. */
export function ring(r: number, n = 14, rz = r, turn = 0): Vec2[] {
  return Array.from({ length: n }, (_, k) => [Math.cos(turn + (k / n) * Math.PI * 2) * r, Math.sin(turn + (k / n) * Math.PI * 2) * rz] as Vec2);
}

const CUP_COLORS = [0xf28cb0, 0x7fd3b8, 0xf6d55c, 0x7fb8ef, 0xb79be8, 0xf5a05a, 0x9ad66a, 0xef7f7f];
const SKIN = [0xf1c9a5, 0xe0ac84, 0xc68a62, 0xf6d7b8];
const SHIRTS = [0xe8544a, 0x3f7fd0, 0xf2c12e, 0x4fa86a, 0xf2efe6, 0x8a5ac8, 0xf08a3a];

/** Someone sitting, as part of a ride: their seat at a point, facing along +Z turned by yaw. */
function rider(at: Vec3, yaw: number, n: number): FloatPartDesc[] {
  const [x, y, z] = at, fx = Math.sin(yaw), fz = Math.cos(yaw);
  return [
    { shape: 'box', half: [0.22, 0.3, 0.16], pos: [x, y + 0.3, z], rot: [0, yaw, 0], color: SHIRTS[n % SHIRTS.length] },
    { shape: 'orb', half: [0.17, 0.19, 0.17], pos: [x + fx * 0.02, y + 0.8, z + fz * 0.02], color: SKIN[n % SKIN.length] },
    { shape: 'orb', half: [0.18, 0.1, 0.18], pos: [x - fx * 0.02, y + 0.92, z - fz * 0.02], color: [0x2a2420, 0x4a3020, 0x1c1c1c, 0x8a5a30][n % 4] },
  ];
}

const P = Math.PI;
const HAIR = [0x2a2420, 0x4a3020, 0x1c1c1c, 0x8a5a30];

/** Round a middle, a band of so many sides from one height and radius to another: whole, or given `inner` radii (at its foot
 *  and at its top), a wall open within, lofted piece by piece. */
function band(cx: number, cz: number, r0: number, r1: number, y0: number, y1: number, color: number, inner?: [number, number], n = 20): FloatPartDesc[] {
  const pt = (r: number, k: number): Vec2 => [cx + Math.cos((k / n) * 2 * P) * r, cz + Math.sin((k / n) * 2 * P) * r];
  if (!inner) return [{ shape: 'loft', color, lo: Array.from({ length: n }, (_, k) => pt(r0, k)), hi: Array.from({ length: n }, (_, k) => pt(r1, k)), y0, y1 }];
  return Array.from({ length: n }, (_, k): FloatPartDesc => ({
    shape: 'loft', color, y0, y1,
    lo: [pt(r0, k), pt(r0, k + 1), pt(inner[0], k + 1), pt(inner[0], k)],
    hi: [pt(r1, k), pt(r1, k + 1), pt(inner[1], k + 1), pt(inner[1], k)],
  }));
}

/** Someone in a teacup, on the bench round its inside at angle `b` from its middle, facing the wheel: hands on it, or up. */
function cupRider(cx: number, cz: number, b: number, seat: number, wheel: number, n: number, wave: boolean): FloatPartDesc[] {
  const x = cx + Math.cos(b) * 1.75, z = cz + Math.sin(b) * 1.75, fx = -Math.cos(b), fz = -Math.sin(b), yaw = Math.atan2(fx, fz);
  const shirt = SHIRTS[n % SHIRTS.length], skin = SKIN[n % SKIN.length];
  const parts: FloatPartDesc[] = [
    { shape: 'box', half: [0.21, 0.26, 0.14], pos: [x, seat + 0.26, z], rot: [0, yaw, 0], color: shirt },
    { shape: 'orb', half: [0.24, 0.09, 0.15], pos: [x, seat + 0.52, z], rot: [0, yaw, 0], color: shirt },
    { shape: 'cyl', half: [0.06, 0.06, 0], pos: [x, seat + 0.62, z], color: skin },
    { shape: 'orb', half: [0.16, 0.18, 0.16], pos: [x + fx * 0.02, seat + 0.8, z + fz * 0.02], color: skin },
    { shape: 'orb', half: [0.17, 0.1, 0.17], pos: [x - fx * 0.03, seat + 0.91, z - fz * 0.03], color: HAIR[n % HAIR.length] },
  ];
  for (const s of [-1, 1]) {
    const sx = x + fz * s * 0.26, sy = seat + 0.48, sz = z - fx * s * 0.26;
    const hand: Vec3 = wave
      ? [sx + fz * s * 0.14 + fx * 0.06, sy + 0.6, sz - fx * s * 0.14 + fz * 0.06]
      : [cx - fx * 1.05 + fz * s * 0.24, wheel + 0.04, cz - fz * 1.05 - fx * s * 0.24];
    parts.push(rigBar([sx, sy, sz], hand, 0.065, shirt));
    parts.push({ shape: 'orb', half: [0.075, 0.075, 0.075], pos: hand, color: skin });
  }
  return parts;
}

/**
 * One of the teacups' tables: its floor in two colours of wedge with a gold band and bulbs round it, a teapot painted in
 * its middle, its cups round it. `spin` radians a second, positive or negative; `seed` picks its colours and its cups' places.
 * `radius` if not the usual. Each cup turns on its saucer as well, its own way and pace: drawn so, felt as it stands.
 */
export function teaTable(at: Vec2, spin: number, cups: number, seed: number, floor: [number, number], radius = TEACUPS.radius): RigDesc {
  const { top } = TEACUPS, R = radius, RING = radius - (TEACUPS.radius - TEACUPS.ring), BULBS = Math.round(R * 2.4);
  const parts: FloatPartDesc[] = [];
  parts.push({ shape: 'cyl', half: [R, top / 2, 0], pos: [0, top / 2, 0], color: floor[0], solid: true });
  for (let k = 0; k < 12; k += 2) {
    const a0 = (k / 12) * Math.PI * 2, a1 = ((k + 1) / 12) * Math.PI * 2;
    const wedge: Vec2[] = [[0, 0], ...Array.from({ length: 4 }, (_, j) => { const a = a0 + ((a1 - a0) * j) / 3; return [Math.cos(a) * (R - 0.45), Math.sin(a) * (R - 0.45)] as Vec2; })];
    parts.push({ shape: 'loft', color: floor[1], lo: wedge, hi: wedge, y0: top, y1: top + 0.006 });
  }
  parts.push({ shape: 'cyl', half: [R + 0.06, top / 2, 0], pos: [0, top / 2 - 0.012, 0], color: 0xd9a830 });
  for (let k = 0; k < BULBS; k++) {
    const a = (k / BULBS) * Math.PI * 2;
    parts.push({ shape: 'orb', half: [0.09, 0.06, 0.09], pos: [Math.cos(a) * (R - 0.22), top + 0.04, Math.sin(a) * (R - 0.22)], color: k % 2 ? 0xfff2b0 : 0xffffff });
  }
  // In its middle, painted on the floor, a ring of gold round a teapot's outline: nothing stands there, so that the way
  // across between the cups is open.
  parts.push({ shape: 'cyl', half: [2.2, 0.004, 0], pos: [0, top + 0.004, 0], color: 0xd9a830 });
  parts.push({ shape: 'cyl', half: [1.9, 0.004, 0], pos: [0, top + 0.009, 0], color: floor[0] });
  parts.push({ shape: 'orb', half: [1.1, 0.004, 0.85], pos: [0, top + 0.014, 0], color: CUP_COLORS[(seed + 3) % CUP_COLORS.length] });
  parts.push({ shape: 'box', half: [0.5, 0.004, 0.16], pos: [1.35, top + 0.014, 0.2], rot: [0, -0.5, 0], color: CUP_COLORS[(seed + 3) % CUP_COLORS.length] });
  // The cups round it, each on its saucer: a foot, its bowl rounding out to the brim and open within, light inside, a
  // bench round the inside, a white lip, a gold band under it, dots, a handle, the wheel in its middle that turns it, two
  // or three sitting in it up to their chests, hands on the wheel or up in the air. Felt as one round block, as before.
  for (let k = 0; k < cups; k++) {
    const a = (k / cups) * Math.PI * 2 + seed * 0.7, cx = Math.cos(a) * RING, cz = Math.sin(a) * RING, color = CUP_COLORS[(k + seed * 2) % CUP_COLORS.length];
    const from = parts.length;
    parts.push(...band(cx, cz, 1.82, 2.05, top + 0.02, top + 0.17, 0xf7f4ee, undefined, 28));
    parts.push(...band(cx, cz, 2.0, 2.0, top + 0.17, top + 0.18, 0xd9a830, [1.9, 1.9], 28));
    const own = parts.length;
    parts.push({ shape: 'cyl', half: [1.55, 0.6, 1.65], pos: [cx, top + 0.8, cz], color, solid: true, hidden: true });
    const floor = top + 0.75, waist = top + 1.08, brim = top + 1.4, seat = top + 1.15, wheel = top + 1.45, inside = 0xfbf3e4;
    /** How far out its side is at a height: the bowl's curve from its floor to its brim. */
    const side = (y: number) => (y < waist ? 1.58 + (0.13 * (y - floor)) / (waist - floor) : 1.71 + (0.07 * (y - waist)) / (brim - waist));
    parts.push(...band(cx, cz, 0.95, 1.0, top + 0.17, top + 0.32, 0xf7f4ee));
    parts.push(...band(cx, cz, 1.0, 1.36, top + 0.32, top + 0.52, color));
    parts.push(...band(cx, cz, 1.36, 1.58, top + 0.52, floor, color));
    parts.push(...band(cx, cz, 1.46, 1.46, floor, floor + 0.012, inside));
    // Its side in two layers, its colour without and light within; the lip over both, flaring out a little.
    parts.push(...band(cx, cz, 1.58, 1.71, floor, waist, color, [1.51, 1.64]));
    parts.push(...band(cx, cz, 1.53, 1.66, floor, waist - 0.004, inside, [1.46, 1.59]));
    parts.push(...band(cx, cz, 1.71, 1.78, waist, brim, color, [1.64, 1.71]));
    parts.push(...band(cx, cz, 1.66, 1.73, waist, brim - 0.004, inside, [1.59, 1.66]));
    parts.push(...band(cx, cz, 1.78, 1.82, brim, brim + 0.07, 0xffffff, [1.66, 1.63]));
    parts.push(...band(cx, cz, side(top + 1.22) + 0.03, side(top + 1.3) + 0.03, top + 1.22, top + 1.3, 0xd9a830, [1.68, 1.68]));
    parts.push(...band(cx, cz, 1.47, 1.62, floor, seat, shade(color, 0.72), [0.98, 0.98]));
    for (let d = 0; d < 8; d++) {
      const b = (d / 8) * P * 2 + 0.2;
      parts.push({ shape: 'orb', half: [0.05, 0.17, 0.19], pos: [cx + Math.cos(b) * (side(top + 0.93) + 0.01), top + 0.93, cz + Math.sin(b) * (side(top + 0.93) + 0.01)], rot: [0, -b, -0.37], color: 0xffffff });
    }
    // Its handle: a loop out from its side, in pieces round a half circle, its ends on the bowl.
    const hx = Math.cos(a + 1.2), hz = Math.sin(a + 1.2);
    for (let j = 0; j <= 8; j++) {
      const f = -P / 2 + (j / 8) * P, y = top + 1.06 + 0.25 * Math.sin(f), out = side(y) - 0.03 + 0.4 * Math.cos(f);
      parts.push({ shape: 'box', half: [0.08, 0.08, 0.09], pos: [cx + hx * out, y, cz + hz * out], rot: [0, -(a + 1.2), f], color });
    }
    // The wheel on its post: a gold ring, three spokes, a knob in the middle.
    parts.push({ shape: 'cyl', half: [0.09, (wheel - floor) / 2, 0], pos: [cx, (floor + wheel) / 2, cz], color: 0x8a8f96 });
    for (let w = 0; w < 16; w++) {
      const b = (w / 16) * P * 2;
      parts.push({ shape: 'box', half: [0.045, 0.04, 0.11], pos: [cx + Math.cos(b) * 0.76, wheel, cz + Math.sin(b) * 0.76], rot: [0, -b, 0], color: 0xe0c040 });
    }
    for (let w = 0; w < 3; w++) parts.push({ shape: 'box', half: [0.76, 0.025, 0.03], pos: [cx, wheel, cz], rot: [0, (w * P) / 3, 0], color: 0xd9a830 });
    parts.push({ shape: 'orb', half: [0.13, 0.1, 0.13], pos: [cx, wheel + 0.03, cz], color: 0xe0c040 });
    // All that, drawn bigger round its middle; then three or four sitting in it, at their own size.
    for (let j = from; j < parts.length; j++) {
      const p = parts[j], up = (y: number) => top + (y - top) * CUP_TALL, out = ([x, z]: Vec2): Vec2 => [cx + (x - cx) * CUP_WIDE, cz + (z - cz) * CUP_WIDE];
      if (p.pos) p.pos = [cx + (p.pos[0] - cx) * CUP_WIDE, up(p.pos[1]), cz + (p.pos[2] - cz) * CUP_WIDE];
      if (p.half) p.half = [p.half[0] * CUP_WIDE, p.half[1] * CUP_TALL, p.half[2] * CUP_WIDE];
      if (p.lo) p.lo = p.lo.map(out);
      if (p.hi) p.hi = p.hi.map(out);
      if (p.y0 !== undefined) p.y0 = up(p.y0);
      if (p.y1 !== undefined) p.y1 = up(p.y1);
    }
    const riding = 3 + ((k + seed) % 2);
    for (let n = 0; n < riding; n++) {
      const b = a + (n / riding) * P * 2 + 0.6;
      parts.push(...cupRider(cx, cz, b, top + (seat - top) * CUP_TALL, top + (wheel - top) * CUP_TALL, k * 3 + n + seed, (k * 3 + n + seed) % 4 === 0));
    }
    // All of it but its saucer turning together: every other cup the other way, none at quite another's pace.
    const rate = (k % 2 ? -1 : 1) * (0.75 + ((k * 5 + seed * 3) % 7) * 0.12);
    for (let j = own; j < parts.length; j++) parts[j].twirl = [cx, cz, rate];
  }
  return { kind: 'float', hull: 'vessel', pos: [at[0], 0, at[1]], yaw: seed, period: 1, phase: 0, spin, parts };
}

// ---------------------------------------------------------------------------------------------------------------------
// The pirate ships: two boats hung side by side from one axle on three A-frames, each swinging to and fro along the way
// under it, a quarter of a swing apart, high at the ends of its swing and down at the bottom to the height of the truck's
// cab. Each covers half the way: wait for the one on your side to swing away, follow it under, be out before it comes back.

export const PIRATE = { pivot: 15, arm: 12.5, swing: 1.3, period: 10, beam: 2.3, long: 8.2, gap: 3.7, frame: 7.4 };

/** A pirate ship's deck height along it, from its middle: level amidships, rising to each end. */
const shipDeck = (z: number) => -PIRATE.arm + 2.5 + 0.035 * z * z;
/** Its keel there: on the circle round the axle it swings on, so that it comes no lower anywhere in its swing than at the bottom. */
const shipKeel = (z: number) => -Math.sqrt(PIRATE.arm * PIRATE.arm - z * z);

function pirateShip(color: number, flag: number, seed: number): FloatPartDesc[] {
  const { beam, long } = PIRATE;
  const parts: FloatPartDesc[] = [];
  // The hull in slices a metre long, each from its keel on the arc up to its rail: narrow below, full at the rail, fining
  // to each end; a band of gold under the rail, its deck of planks; felt as a box in each slice.
  const STEP = 1;
  for (let z0 = -long; z0 < long - 1e-6; z0 += STEP) {
    const z1 = z0 + STEP, zm = (z0 + z1) / 2;
    const fine = (z: number) => Math.max(0.25, 1 - (z / long) ** 2 * 0.75);
    const keel = shipKeel(zm), deck = shipDeck(zm);
    const outline = (w0: number, w1: number): Vec2[] => [[-w0, z0], [-w1, z1], [w1, z1], [w0, z0]].map(([x, z]) => [x, z] as Vec2);
    parts.push({ shape: 'loft', color, lo: outline(beam * 0.4 * fine(z0), beam * 0.4 * fine(z1)), hi: outline(beam * fine(z0), beam * fine(z1)), y0: keel, y1: deck });
    parts.push({ shape: 'loft', color: 0xd9a830, lo: outline(beam * fine(z0) + 0.03, beam * fine(z1) + 0.03), hi: outline(beam * fine(z0) + 0.03, beam * fine(z1) + 0.03), y0: deck - 0.4, y1: deck - 0.18 });
    parts.push({ shape: 'loft', color: 0x7a5030, lo: outline(beam * fine(z0) - 0.1, beam * fine(z1) - 0.1), hi: outline(beam * fine(z0) - 0.1, beam * fine(z1) - 0.1), y0: deck, y1: deck + 0.03 });
    parts.push({ shape: 'box', half: [beam * fine(zm) * 0.8, (deck - keel) / 2, STEP / 2], pos: [0, (deck + keel) / 2, zm], color, solid: true, hidden: true });
  }
  // The bow a dragon's neck and head, eyes and tongue; the stern its tail, curled up.
  const bowY = shipDeck(long), stern = shipDeck(-long);
  parts.push(rigBar([0, bowY - 0.6, long - 0.3], [0, bowY + 2.0, long + 0.9], 0.42, 0x3f8a4a));
  parts.push({ shape: 'orb', half: [0.6, 0.55, 0.95], pos: [0, bowY + 2.3, long + 1.4], color: 0x3f8a4a });
  parts.push({ shape: 'box', half: [0.32, 0.12, 0.45], pos: [0, bowY + 2.05, long + 2.1], color: 0xd23a32 });
  for (const side of [-1, 1]) {
    parts.push({ shape: 'orb', half: [0.13, 0.13, 0.13], pos: [side * 0.42, bowY + 2.55, long + 1.75], color: 0xf6d55c });
    parts.push({ shape: 'box', half: [0.06, 0.35, 0.2], pos: [side * 0.3, bowY + 2.95, long + 1.0], rot: [-0.5, 0, side * 0.3], color: 0xd9a830 });
  }
  parts.push(rigBar([0, stern - 0.6, -long + 0.3], [0, stern + 1.6, -long - 0.9], 0.34, 0x3f8a4a));
  parts.push({ shape: 'box', half: [0.08, 0.75, 0.6], pos: [0, stern + 2.0, -long - 1.3], rot: [0.4, 0, 0], color: 0xd23a32 });
  // Round shields along each side, under the rail.
  for (const side of [-1, 1]) for (let k = -3; k <= 3; k++) {
    const z = k * 1.9, w = beam * Math.max(0.25, 1 - (z / long) ** 2 * 0.75);
    parts.push({ shape: 'cyl', half: [0.4, 0.05, 0], pos: [side * (w + 0.02), shipDeck(z) - 0.8, z], rot: [0, 0, Math.PI / 2], color: [0xd23a32, 0xf2efe6, 0x2f6fb0][(k + 3 + seed) % 3] });
  }
  // Benches across it in rows, rising with its deck to each end, facing the middle; their riders, arms up; a bar along each row.
  for (let r = -3; r <= 3; r++) {
    const z = r * 2.0, y = shipDeck(z), face = r > 0 ? -1 : 1, w = beam * Math.max(0.25, 1 - (z / long) ** 2 * 0.75) - 0.35;
    parts.push({ shape: 'box', half: [w, 0.12, 0.32], pos: [0, y + 0.3, z], color: 0x8a5a32 });
    parts.push({ shape: 'box', half: [w, 0.38, 0.06], pos: [0, y + 0.68, z - face * 0.36], color: 0x6b4426 });
    parts.push({ shape: 'box', half: [w - 0.1, 0.03, 0.03], pos: [0, y + 0.9, z + face * 0.42], color: 0xf2c12e });
    const seats = Math.max(2, Math.round(w * 1.7));
    for (let n = 0; n < seats; n++) parts.push(...rider([-w + 0.35 + (n * (2 * w - 0.7)) / Math.max(1, seats - 1), y + 0.42, z], face > 0 ? 0 : Math.PI, seed * 31 + r * 5 + n));
  }
  // Its mast and sail with a skull, its flag at the top; the arms up from it to the axle, two pairs braced, and the
  // bearing round the axle.
  const mid = shipDeck(0);
  parts.push({ shape: 'cyl', half: [0.16, 2.8, 0], pos: [0, mid + 2.8, 0], color: 0x6b4426 });
  parts.push({ shape: 'box', half: [beam * 0.85, 1.15, 0.05], pos: [0, mid + 3.5, 0.2], color: 0xf2efe6 });
  parts.push({ shape: 'orb', half: [0.42, 0.42, 0.05], pos: [0, mid + 3.7, 0.27], color: flag });
  parts.push({ shape: 'box', half: [0.02, 0.3, 0.45], pos: [0, mid + 5.8, 0.5], color: 0x1c1c1c });
  for (const side of [-1, 1]) for (const end of [-1, 1]) parts.push(rigBar([side * 1.6, -0.6, end * 0.6], [side * (beam - 0.25), mid + 0.2, end * 3.4], 0.24, 0xe0e2e4));
  for (const side of [-1, 1]) parts.push(rigBar([side * 1.75, mid + 4.5, -2], [side * 1.75, mid + 4.5, 2], 0.14, 0xe0e2e4));
  parts.push({ shape: 'box', half: [1.8, 0.6, 0.8], pos: [0, -0.3, 0], color: 0x5a6068 });
  return parts;
}

/** The two ships over a way north through `at`, and their frames into `props`: the ships' rigs, west first. */
export function pirateShips(props: PropDesc[], at: Vec2, phases: [number, number]): RigDesc[] {
  const { pivot, swing, period, gap, frame } = PIRATE;
  const [cx, cz] = at;
  // Three A-frames, the middle one between the ships: each two legs spread along the way, braced, on concrete feet.
  for (const fx of [cx - frame, cx, cx + frame]) {
    for (const end of [-1, 1]) {
      bar(props, [fx, 0, cz + end * 10.5], [fx, pivot + 0.3, cz + end * 0.4], 0.45, 0xe8e2d0);
      props.push({ shape: 'box', size: [0.8, 0.3, 1.1], pos: [fx, 0.3, cz + end * 10.5], color: COASTER.footing });
    }
    for (const h of [5, 10]) bar(props, [fx, h, cz - 10.1 * (1 - h / pivot)], [fx, h, cz + 10.1 * (1 - h / pivot)], 0.16, 0xe8e2d0, { ghost: true });
    props.push({ shape: 'cylinder', size: [0.75, 0.55, 0], pos: [fx, pivot + 0.2, cz], rot: [0, 0, Math.PI / 2], color: 0x5a6068, ghost: true });
  }
  bar(props, [cx - frame, pivot + 0.2, cz], [cx + frame, pivot + 0.2, cz], 0.35, 0x8a9098, { ghost: true });
  return [
    { kind: 'float', hull: 'vessel', pos: [cx - gap, pivot, cz], yaw: 0, period, phase: phases[0], pitch: swing, parts: pirateShip(0x2a6f9e, 0x1c1c1c, 1) },
    { kind: 'float', hull: 'vessel', pos: [cx + gap, pivot, cz], yaw: 0, period, phase: phases[1], pitch: swing, parts: pirateShip(0x9e3a2a, 0xf2efe6, 2) },
  ];
}

// ---------------------------------------------------------------------------------------------------------------------
// The big water slide: a family raft slide made big enough to take the truck. A wide trough of fibreglass, its floor
// running with water and slippery as such (the tyres hold a fifth as well as on a road), its sides curving up into
// walls; on white columns; a length of it closed over as a tube. It ends in its splash pool.

export const SLIDE = { floor: 4.2, chamfer: 0.9, wall: 1.7, grip: 0.2, inside: 0x4fb0dc, shell: 0xf2a52e, rim: 0xffffff };

export interface SlideDesc {
  start: Vec2;
  yaw: number;
  plan: PlanPiece[];
  profile: ProfilePoint[];
  /** Metres along it closed over as a tube. */
  tube: [number, number];
  ground?: (x: number, z: number) => number;
}

export function waterSlide(props: PropDesc[], d: SlideDesc): WayPoint[] {
  const way = wayPoints(d.start, d.yaw, d.plan, d.profile, 1);
  const ground = d.ground ?? (() => 0);
  const { floor, chamfer, wall, grip, inside, shell, rim } = SLIDE;
  const half = floor / 2, c = chamfer / Math.SQRT2;
  const wet = { grip };
  // Its floor, and the water running down it in a sheet with streaks of white in it.
  along(props, way, floor, 0.2, inside, { ...wet, mapColor: 0x4fb0dc });
  along(props, way, floor - 0.6, 0.01, 0x8fd8f0, { ghost: true }, 0, 0.012);
  for (let k = 0; k < way.length - 1; k += 3) {
    const p = way[k];
    for (const a of [-1.1, 0.2, 1.3]) props.push({ shape: 'box', size: [0.05, 0.006, 0.6], pos: beside(p, a + ((k * 7) % 5) * 0.08, 0.025), rot: alongRot(p.yaw, p.grade), color: 0xe8f8fc, ghost: true });
  }
  // Each side: the curve up from the floor, as a chamfer at 45 degrees, then the wall, its rim rolled over in white; the
  // shell outside in orange. All of it slippery.
  for (const side of [-1, 1]) {
    for (let k = 0; k < way.length - 1; k++) {
      const a = way[k], b = way[k + 1];
      const long = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      const yaw = Math.atan2(b.x - a.x, b.z - a.z), grade = (b.y - a.y) / Math.hypot(b.x - a.x, b.z - a.z);
      const mid: WayPoint = { s: (a.s + b.s) / 2, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, yaw, grade };
      props.push({ shape: 'box', size: [chamfer / 2, 0.1, long / 2 + 0.06], pos: beside(mid, side * (half + c / 2 - 0.05), c / 2 - 0.08), rot: alongRot(yaw, grade, side * Math.PI / 4), color: inside, ...wet });
    }
    along(props, way, 0.24, wall, inside, wet, side * (half + c + 0.08), c + wall - 0.1);
    along(props, way, 0.1, wall + c + 0.2, shell, { ghost: true }, side * (half + c + 0.25), c + wall - 0.1);
    rail(props, way, side * (half + c + 0.16), c + wall - 0.05, 0.17, rim);
  }
  // Under it, its cradles and white columns down to the ground, every eight metres.
  for (let k = 4; k < way.length; k += 8) {
    const p = way[k], g = ground(p.x, p.z);
    if (p.y - g < 1.2) continue;
    props.push({ shape: 'box', size: [half + c + 0.3, 0.18, 0.3], pos: beside(p, 0, -0.3), rot: alongRot(p.yaw, p.grade), color: 0xd8dad6, ghost: true });
    for (const side of [-1, 1]) {
      bar(props, [beside(p, side * 1.6)[0], g, beside(p, side * 1.6)[2]], beside(p, side * 1.6, -0.45), 0.2, 0xeceee8);
      props.push({ shape: 'box', size: [0.45, 0.2, 0.45], pos: [beside(p, side * 1.6)[0], g + 0.2, beside(p, side * 1.6)[2]], color: COASTER.footing });
    }
  }
  // The tube: closed over, in the slide's orange with a band of white, see-through when it hides the truck.
  const tube = way.filter((p) => p.s >= d.tube[0] && p.s <= d.tube[1]);
  for (const side of [-1, 1]) {
    for (let k = 0; k < tube.length - 1; k++) {
      const a = tube[k], b = tube[k + 1];
      const long = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      const yaw = Math.atan2(b.x - a.x, b.z - a.z), grade = (b.y - a.y) / Math.hypot(b.x - a.x, b.z - a.z);
      const mid: WayPoint = { s: (a.s + b.s) / 2, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, yaw, grade };
      props.push({ shape: 'box', size: [1.7, 0.12, long / 2 + 0.06], pos: beside(mid, side * 1.75, c + wall + 0.95), rot: alongRot(yaw, grade, -side * 0.52), color: k % 6 < 1 ? 0xffffff : shell, ghost: true, fade: true, overhead: true });
    }
  }
  return way;
}

// ---------------------------------------------------------------------------------------------------------------------
// The raft ride's lift: a conveyor up out of its channel to the slide's tower, steel, its belt of rollers, a kerb along
// each side; on trestles.

export function raftLift(props: PropDesc[], way: WayPoint[], ground: (x: number, z: number) => number = () => 0): void {
  const W = 5.6;
  along(props, way, W, 0.3, 0x3a3e44, { mapColor: 0x6f767c });
  for (let k = 0; k < way.length; k++) props.push({ shape: 'cylinder', size: [0.07, W / 2 - 0.3, 0], pos: beside(way[k], 0, 0.02), rot: alongRot(way[k].yaw, way[k].grade, Math.PI / 2), color: 0x9aa0a6, ghost: true });
  for (const side of [-1, 1]) {
    along(props, way, 0.2, 0.55, 0xe8c22a, {}, side * (W / 2 + 0.1), 0.5);
    along(props, way, 0.24, 0.9, 0x5a6068, { ghost: true }, side * (W / 2 + 0.2), -0.1);
  }
  for (let k = 3; k < way.length; k += 6) {
    const p = way[k], g = ground(p.x, p.z);
    if (p.y - g < 1) continue;
    for (const side of [-1, 1]) bar(props, [beside(p, side * (W / 2))[0], g, beside(p, side * (W / 2))[2]], beside(p, side * (W / 2), -0.55), 0.18, 0x7a828a);
    bar(props, beside({ ...p, y: g + (p.y - g) * 0.5 }, -W / 2), beside({ ...p, y: g + (p.y - g) * 0.5 }, W / 2), 0.08, 0x7a828a, { ghost: true });
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The park's buildings: kiosks, shops, a restaurant, toilets. Each is a box of walls in its own colour, its corners in
// white, a base of tile; its front (facing `yaw`) a counter window or shop windows and a door, a striped awning over them,
// its name on a board above; a roof that is a flat one with a cornice, a pitched one, or a dome.

export interface KioskDesc {
  at: Vec2;
  /** The way its front faces: radians about Y, 0 = toward +Z. */
  yaw: number;
  /** Half its width along its front, half its depth. */
  half: Vec2;
  high: number;
  wall: number;
  trim: number;
  roof: 'flat' | 'pitched' | 'dome';
  roofColor: number;
  name?: string;
  nameColors?: [string, string, string];
  /** A counter window across the front, or windows and a door as a shop's. */
  front: 'counter' | 'shop' | 'toilets';
  awning?: [number, number];
}

export function kiosk(props: PropDesc[], signs: import('./types').SignDesc[], d: KioskDesc): void {
  const [cx, cz] = d.at, [hw, hd] = d.half, h = d.high;
  const fx = Math.sin(d.yaw), fz = Math.cos(d.yaw), rx = Math.cos(d.yaw), rz = -Math.sin(d.yaw);
  /** A point so far across its front (to the right as faced), so far out in front of its middle, and up. */
  const at = (across: number, out: number, up: number): Vec3 => [cx + rx * across + fx * out, up, cz + rz * across + fz * out];
  const rot: Vec3 = [0, d.yaw, 0];
  props.push({ shape: 'box', size: [hw, h / 2, hd], pos: at(0, 0, h / 2), rot, color: d.wall, fade: true, mapColor: 0xb0a080 });
  props.push({ shape: 'box', size: [hw + 0.06, 0.25, hd + 0.06], pos: at(0, 0, 0.25), rot, color: 0x8a8278, ghost: true });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) props.push({ shape: 'box', size: [0.16, h / 2 + 0.01, 0.16], pos: at(sx * (hw - 0.09), sz * (hd - 0.09), h / 2 + 0.01), rot, color: d.trim, ghost: true });
  // The front.
  if (d.front === 'counter') {
    props.push({ shape: 'box', size: [hw - 0.5, 0.65, 0.03], pos: at(0, hd + 0.01, 1.75), rot, color: 0x2a3a48, ghost: true });
    props.push({ shape: 'box', size: [hw - 0.4, 0.06, 0.35], pos: at(0, hd + 0.3, 1.05), rot, color: d.trim, ghost: true });
  } else if (d.front === 'shop') {
    for (const sx of [-1, 1]) props.push({ shape: 'box', size: [hw * 0.32, 0.8, 0.03], pos: at(sx * hw * 0.55, hd + 0.01, 1.4), rot, color: 0x2a3a48, ghost: true });
    props.push({ shape: 'box', size: [0.55, 1.05, 0.03], pos: at(0, hd + 0.01, 1.05), rot, color: 0x5a4030, ghost: true });
  } else {
    for (const sx of [-1, 1]) props.push({ shape: 'box', size: [0.5, 1.05, 0.03], pos: at(sx * hw * 0.5, hd + 0.01, 1.05), rot, color: 0x3a5a7a, ghost: true });
    for (const [sx, c] of [[-1, 0x2f6fb0], [1, 0xd23a32]] as const) props.push({ shape: 'cylinder', size: [0.22, 0.02, 0], pos: at(sx * hw * 0.5, hd + 0.04, 2.45), rot: [Math.PI / 2, d.yaw, 0], color: c, ghost: true });
  }
  // The awning just over the windows; the name between it and the roof, as large as fits there.
  const awn = Math.min(h - 0.75, 2.3);
  if (d.awning) {
    const n = Math.max(3, Math.round(hw * 2));
    for (let k = 0; k < n; k++) {
      const x = -hw + (2 * hw * (k + 0.5)) / n;
      props.push({ shape: 'box', size: [hw / n, 0.04, 0.6], pos: at(x, hd + 0.55, awn), rot: alongRot(d.yaw, -0.4), color: d.awning[k % 2], ghost: true });
    }
  }
  if (d.name) {
    const low = awn + 0.32, high = h - 0.04;
    signs.push({ pos: at(0, hd + 0.08, (low + high) / 2), rotY: d.yaw, kind: 'name', text: d.name, colors: d.nameColors ?? ['#ffffff', '#2a3a48', '#d9a830'], wide: Math.min(2 * hw - 0.6, 0.9 * d.name.length + 0.8, (high - low) / 0.218) });
  }
  // Its sides and back: a band round it at the height of the door's head, windows in each side, a door at the back, a
  // lamp either side of the front.
  const seed = Math.abs(Math.round(cx * 7 + cz * 13));
  // Only the big pieces fade with the building: each that does is drawn on its own.
  const show = { ghost: true };
  const big = { ghost: true, fade: true };
  for (const sz of [-1, 1]) props.push({ shape: 'box', size: [hw + 0.03, 0.07, 0.03], pos: at(0, sz * (hd + 0.01), Math.min(h - 0.9, 2.5)), rot, color: d.trim, ...show });
  for (const sx of [-1, 1]) {
    props.push({ shape: 'box', size: [0.03, 0.07, hd + 0.03], pos: at(sx * (hw + 0.01), 0, Math.min(h - 0.9, 2.5)), rot, color: d.trim, ...show });
    const n = hd > 2.6 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const out = n === 1 ? 0 : (k - 0.5) * hd * 0.9;
      props.push({ shape: 'box', size: [0.03, 0.5, 0.48], pos: at(sx * (hw + 0.012), out, 1.55), rot, color: 0x2a3a48, ...show });
      props.push({ shape: 'box', size: [0.05, 0.05, 0.56], pos: at(sx * (hw + 0.02), out, 1.0), rot, color: d.trim, ...show });
      props.push({ shape: 'box', size: [0.035, 0.5, 0.03], pos: at(sx * (hw + 0.02), out, 1.55), rot, color: d.trim, ...show });
    }
    props.push({ shape: 'sphere', size: [0.11, 0.14, 0.11], pos: at(sx * (hw - 0.3), hd + 0.14, Math.min(h - 1.1, 2.2)), color: 0xffe9a8, ghost: true, glow: true });
  }
  props.push({ shape: 'box', size: [0.45, 1.0, 0.03], pos: at(hw * 0.4, -hd - 0.012, 1.0), rot, color: 0x6a7078, ...show });
  // The roof.
  if (d.roof === 'flat') {
    // A deck in its colour inside a parapet; on it what a roof has: the cooler in its cage, vents, a light well.
    props.push({ shape: 'box', size: [hw + 0.25, 0.1, hd + 0.25], pos: at(0, 0, h + 0.1), rot, color: d.roofColor, ...big });
    for (const sz of [-1, 1]) props.push({ shape: 'box', size: [hw + 0.3, 0.22, 0.09], pos: at(0, sz * (hd + 0.21), h + 0.3), rot, color: d.trim, ...show });
    for (const sx of [-1, 1]) props.push({ shape: 'box', size: [0.09, 0.22, hd + 0.12], pos: at(sx * (hw + 0.21), 0, h + 0.3), rot, color: d.trim, ...show });
    const side = seed % 2 ? 1 : -1;
    props.push({ shape: 'box', size: [0.55, 0.3, 0.4], pos: at(side * (hw - 1.0), -hd + 0.8, h + 0.5), rot, color: 0xc8ccd0, ...show });
    props.push({ shape: 'cylinder', size: [0.3, 0.02, 0], pos: at(side * (hw - 1.0), -hd + 0.8, h + 0.82), color: 0x5a6068, ...show });
    props.push({ shape: 'box', size: [Math.min(1.1, hw * 0.3), 0.08, Math.min(0.8, hd * 0.3)], pos: at(-side * hw * 0.3, 0.1, h + 0.28), rot, color: 0x9fd0e6, ...show });
    props.push({ shape: 'box', size: [Math.min(1.1, hw * 0.3) + 0.06, 0.05, Math.min(0.8, hd * 0.3) + 0.06], pos: at(-side * hw * 0.3, 0.1, h + 0.24), rot, color: d.trim, ...show });
    for (const k of [0, 1]) {
      props.push({ shape: 'cylinder', size: [0.12, 0.25, 0], pos: at(-side * (hw - 0.7 - k * 0.6), -hd + 0.6, h + 0.45), color: 0xb8bec4, ...show });
      props.push({ shape: 'cone', size: [0.2, 0.09, 0], pos: at(-side * (hw - 0.7 - k * 0.6), -hd + 0.6, h + 0.78), color: 0x8a8f96, ...show });
    }
  } else if (d.roof === 'pitched') {
    // Two slopes of tiles in courses, the ridge along the top; the gables closed in the wall's colour, a round window in each.
    const rise = hd * 0.6, steep = 0.6;
    for (const side of [-1, 1]) {
      props.push({ shape: 'box', size: [hw + 0.35, 0.1, hd * 0.62], pos: at(0, side * hd * 0.5, h + hd * 0.3), rot: alongRot(d.yaw, -side * steep), color: d.roofColor, ...big });
      for (let k = 1; k < 5; k++) {
        const t = k / 5;
        props.push({ shape: 'box', size: [hw + 0.37, 0.035, 0.05], pos: at(0, side * hd * 1.02 * (1 - t), h + rise * t * 1.02 + 0.13), rot: alongRot(d.yaw, -side * steep), color: shade(d.roofColor, 0.82), ...show });
      }
    }
    props.push({ shape: 'box', size: [hw + 0.4, 0.1, 0.14], pos: at(0, 0, h + rise + 0.04), rot, color: d.trim, ...show });
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const y0 = (rise * k) / 4, y1 = (rise * (k + 1)) / 4;
        props.push({ shape: 'box', size: [0.08, (y1 - y0) / 2, hd * (1 - (k + 0.5) / 4)], pos: at(sx * (hw - 0.08), 0, h + (y0 + y1) / 2), rot, color: d.wall, ...show });
      }
      props.push({ shape: 'cylinder', size: [Math.min(0.4, rise * 0.25), 0.03, 0], pos: at(sx * (hw + 0.02), 0, h + rise * 0.35), rot: [0, d.yaw, Math.PI / 2], color: 0x2a3a48, ...show });
    }
    if (hw > 3) {
      const side = seed % 2 ? 1 : -1;
      props.push({ shape: 'box', size: [0.3, 0.6, 0.3], pos: at(side * hw * 0.5, -hd * 0.45, h + rise * 0.55 + 0.5), rot, color: 0xb86a4a, ...show });
      props.push({ shape: 'box', size: [0.36, 0.06, 0.36], pos: at(side * hw * 0.5, -hd * 0.45, h + rise * 0.55 + 1.14), rot, color: 0x6a4a30, ...show });
    }
  } else {
    // A dome on a drum, a gilt spike on it, a ball at each corner of the roof.
    const r = Math.min(hw, hd);
    props.push({ shape: 'box', size: [hw + 0.1, 0.12, hd + 0.1], pos: at(0, 0, h + 0.12), rot, color: d.trim, ...big });
    props.push({ shape: 'cylinder', size: [r * 0.9, 0.2, 0], pos: at(0, 0, h + 0.42), color: d.trim, ...show });
    props.push({ shape: 'sphere', size: [r * 0.88, r * 0.75, r * 0.88], pos: at(0, 0, h + 0.6), color: d.roofColor, ...big });
    props.push({ shape: 'cylinder', size: [r * 0.9 + 0.02, 0.05, 0], pos: at(0, 0, h + 0.66), color: 0xd9a830, ...show });
    props.push({ shape: 'cone', size: [0.15, 0.5, 0], pos: at(0, 0, h + r * 0.75 + 1.0), color: 0xd9a830, ...show });
    props.push({ shape: 'sphere', size: [0.2, 0.2, 0.2], pos: at(0, 0, h + r * 0.75 + 0.62), color: 0xd9a830, ...show });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) props.push({ shape: 'sphere', size: [0.22, 0.22, 0.22], pos: at(sx * (hw - 0.15), sz * (hd - 0.15), h + 0.44), color: d.roofColor, ...show });
  }
}

/** A colour, darker or lighter by a factor. */
function shade(color: number, by: number): number {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(((color >> n) & 255) * by)));
  return (c(16) << 16) | (c(8) << 8) | c(0);
}

// ---------------------------------------------------------------------------------------------------------------------
// What goes under and round the rides.

/** The ground under a way, wherever it is higher than `above`: so far each side of it, a fall to come down on. */
export function dropUnder(relief: Relief, way: WayPoint[], above: number, reach: number, look: Look): void {
  for (let k = 0; k < way.length - 2; k += 2) {
    const a = way[k], b = way[k + 2];
    if (Math.min(a.y, b.y) < above || Math.hypot(b.x - a.x, b.z - a.z) > 4) continue;
    const side = (p: WayPoint, d: number): P2 => [p.x + Math.cos(p.yaw) * d, p.z - Math.sin(p.yaw) * d];
    const ext = (p: WayPoint, d: number): WayPoint => ({ ...p, x: p.x + Math.sin(p.yaw) * d, z: p.z + Math.cos(p.yaw) * d });
    const a2 = ext(a, -0.6), b2 = ext(b, 0.6);
    relief.area([side(a2, -reach), side(b2, -reach), side(b2, reach), side(a2, reach)], 0, look);
  }
}

/** A carousel: its floor turning under a striped roof on a centre post, horses on poles in two rings. */
export function carousel(at: Vec2): RigDesc {
  const parts: FloatPartDesc[] = [];
  const R = 8;
  parts.push({ shape: 'cyl', half: [R, 0.3, 0], pos: [0, 0.3, 0], color: 0xf2e6cc, solid: true });
  parts.push({ shape: 'cyl', half: [R + 0.05, 0.12, 0], pos: [0, 0.52, 0], color: 0xd9a830 });
  parts.push({ shape: 'cyl', half: [1.4, 3.0, 0], pos: [0, 3.6, 0], color: 0xd23a32, solid: true });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const roof = [[0, 0], [Math.cos(a) * (R + 0.6), Math.sin(a) * (R + 0.6)], [Math.cos(a + Math.PI / 6) * (R + 0.6), Math.sin(a + Math.PI / 6) * (R + 0.6)]] as Vec2[];
    parts.push({ shape: 'loft', color: k % 2 ? 0xffffff : 0xd23a32, lo: roof, hi: roof.map(([x, z], i) => (i === 0 ? [x, z] : [x * 0.02, z * 0.02]) as Vec2), y0: 6.4, y1: 8.6 });
    parts.push({ shape: 'box', half: [0.05, 0.45, R * 0.27], pos: [Math.cos(a + Math.PI / 12) * (R + 0.55), 6.0, Math.sin(a + Math.PI / 12) * (R + 0.55)], rot: [0, -(a + Math.PI / 12), 0], color: k % 2 ? 0xf2c12e : 0x3f7fd0 });
  }
  parts.push({ shape: 'orb', half: [0.5, 0.5, 0.5], pos: [0, 8.9, 0], color: 0xf2c12e });
  for (const [r, n] of [[6.4, 12], [4.2, 8]] as const) for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + r;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, h = 1.6 + ((k % 3) - 1) * 0.35;
    parts.push({ shape: 'cyl', half: [0.05, 2.9, 0], pos: [x, 3.5, z], color: 0xd9a830 });
    parts.push({ shape: 'box', half: [0.25, 0.32, 0.7], pos: [x, h, z], rot: [0, -a, 0], color: [0xffffff, 0xf2c8a0, 0x6a4a30, 0xd8d0c8][k % 4] });
    parts.push({ shape: 'box', half: [0.16, 0.32, 0.18], pos: [x + Math.cos(a + Math.PI / 2) * 0.6, h + 0.45, z + Math.sin(a + Math.PI / 2) * 0.6], rot: [0, -a, 0.4], color: [0xffffff, 0xf2c8a0, 0x6a4a30, 0xd8d0c8][k % 4] });
    parts.push({ shape: 'box', half: [0.27, 0.05, 0.3], pos: [x, h + 0.36, z], rot: [0, -a, 0], color: [0xd23a32, 0x3f7fd0, 0xf2c12e][k % 3] });
  }
  return { kind: 'float', hull: 'vessel', pos: [at[0], 0, at[1]], yaw: 0, period: 1, phase: 0, spin: -0.35, parts };
}

// ---------------------------------------------------------------------------------------------------------------------
// The level's own: what it gathers as it is built, and the plain things it is built of.

export interface ParkSite {
  relief: Relief;
  props: PropDesc[];
  objects: ObjectDesc[];
  crowds: CrowdDesc[];
  signs: SignDesc[];
  rigs: RigDesc[];
  fords: FordDesc[];
  waves: WaveDesc[];
  decals: DecalDesc[];
  pools: NonNullable<LevelDef['pools']>;
  fountains: Vec3[];
  flocks: FlockDesc[];
  stillWater: NonNullable<LevelDef['stillWater']>;
  keepOut: [number, number, number, number][];
  clowns: ClownDesc[];
  slicks: SlickDesc[];
}

export function parkSite(relief: Relief): ParkSite {
  return { relief, props: [], objects: [], crowds: [], signs: [], rigs: [], fords: [], waves: [], decals: [], pools: [], fountains: [], flocks: [], stillWater: [], keepOut: [], clowns: [], slicks: [] };
}

/** Something loose, standing at a place: turned so, on the ground or at a height. */
export function put(s: ParkSite, kind: ObjectKindId, x: number, z: number, rotY = 0, y = 0): void {
  s.objects.push({ kind, pos: [x, y, z], rotY });
}

/** A box between two corners. */
export function box(props: PropDesc[], x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, extra: Partial<PropDesc> = {}): void {
  props.push({ shape: 'box', size: [(x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2], pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], color, ...extra });
}

/** A planter: a long box of concrete faced in tile, a hedge along its top; solid, as anything that holds a hedge is. */
export function planter(props: PropDesc[], x0: number, z0: number, x1: number, z1: number, high = 0.75, y = 0): void {
  box(props, x0, y, z0, x1, y + high, z1, 0xe8dcc6, { mapColor: 0x6f9e52 });
  box(props, x0 + 0.06, y + high, z0 + 0.06, x1 - 0.06, y + high + 0.05, z1 - 0.06, 0x6a4a30, { ghost: true });
  box(props, x0 + 0.12, y + high + 0.05, z0 + 0.12, x1 - 0.12, y + high + 0.55, z1 - 0.12, 0x4f8a3a, { ghost: true });
}

/** A planter from one place to another, at any angle: its hedge on top in a long round. */
export function hedge(props: PropDesc[], a: Vec2, b: Vec2, wide = 0.9, high = 0.8, flowers?: number): void {
  const long = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
  const mid: Vec3 = [(a[0] + b[0]) / 2, high / 2, (a[1] + b[1]) / 2];
  props.push({ shape: 'box', size: [wide / 2, high / 2, long / 2], pos: mid, rot: [0, yaw, 0], color: 0xf6e8d4, mapColor: 0x6f9e52 });
  props.push({ shape: 'sphere', size: [wide / 2 + 0.15, 0.45, long / 2 + 0.1], pos: [mid[0], high + 0.2, mid[2]], rot: [0, yaw, 0], color: 0x4f8a3a, ghost: true });
  if (flowers !== undefined) for (let d = 0.8; d < long - 0.4; d += 1.6) {
    const t = d / long;
    props.push({ shape: 'sphere', size: [0.32, 0.22, 0.32], pos: [a[0] + (b[0] - a[0]) * t, high + 0.55, a[1] + (b[1] - a[1]) * t], color: [flowers, 0xffffff][Math.round(d / 1.6) % 2], ghost: true });
  }
}
