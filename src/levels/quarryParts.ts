import type { ObjectKindId } from './objects';
import type { Look, Relief, RibbonPoint } from './relief';
import type { CrowdDesc, DecalDesc, DropperDesc, FordDesc, PropDesc, RigDesc, TrafficLane } from './types';

// The places of level 3's quarry, each built where it is told and at the height it is told: the stockpile yard, the
// load-out under the plant, the dike across the settling ponds with its machines, the crossing of the river above the
// weir. The proving ground lays them side by side; level 3 strings them along its way. Each runs north from where it is
// put, and lays its own floor, banks or ponds, so it is the same wherever it is.

export const GRAVEL: Look = { tag: 'gravel', color: 0x9c9384, wall: 0x7d7466 };
export const BANK: Look = { tag: 'gravel', color: 0x8f877a, wall: 0x7a7266 };
export const CONCRETE: Look = { tag: 'paved', color: 0x9aa0a6, wall: 0x7e848a };
export const DIKE: Look = { tag: 'earth', color: 0x8a7a5e, wall: 0x6e6048 };
export const POND: Look = { tag: 'water', color: 0x6a6a52, wall: 0x56563f };
export const RIVER: Look = { tag: 'water', color: 0x4f8fa8, wall: 0x3f7f98 };
export const FORD: Look = { tag: 'ford', color: 0x6f9fb2, wall: 0x4f7f92 };
export const COBBLE: Look = { tag: 'gravel', color: 0xa8a294, wall: 0x8a8476 };
export const HAUL: Look = { tag: 'earth', color: 0x8f8470, wall: 0x75695a };
export const SAND: Look = { tag: 'earth', color: 0xcdbb8e, wall: 0xa8986e };
const HEAPS: Look[] = [
  { tag: 'gravel', color: 0xc9b98f, wall: 0xa89a74 },
  { tag: 'gravel', color: 0x9a948a, wall: 0x7a746a },
  { tag: 'gravel', color: 0x857f75, wall: 0x6a645a },
];

/** A pseudo-random number for a place, 0 to 1: the same each time. */
export const hash = (x: number, z: number) => {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** Where a place's things go, and how to put a loose thing down at the ground's height once the ground is made. */
export interface Site {
  relief: Relief;
  props: PropDesc[];
  decals: DecalDesc[];
  traffic: TrafficLane[];
  rigs: RigDesc[];
  droppers: DropperDesc[];
  fords: FordDesc[];
  crowds: CrowdDesc[];
  object: (kind: ObjectKindId, x: number, z: number, rotY?: number, y?: number) => void;
}

/** A patch of yellow and black stripes on the ground: where something comes down or sweeps across. */
export function hatch(s: Site, x: number, z: number, w: number, l: number, at = 0): void {
  s.decals.push({ pos: [x, z], size: [w, l], color: 0xe8b81e, base: at, y: 0.03 });
  for (let k = -2; k <= 2; k++) s.decals.push({ pos: [x + k * (w / 5), z], size: [w / 10, Math.min(w, l) * 0.95], rotY: Math.PI / 4, color: 0x24262a, base: at, y: 0.05 });
}

// ---------------------------------------------------------------------------------------------------------------------
// The stockpile yard.

/**
 * A heap's shape, from its foot in to its top: how far in (as a share of the way to the middle) and how high there. Across the
 * lane, where the truck meets it, the foot rises at 12 degrees, then 22, then over 30: low on it the truck leans, higher it
 * goes over.
 */
const HEAP_RINGS: [number, number][] = [[1, 0], [0.85, 0.6], [0.7, 1.8], [0.5, 4.3], [0.3, 6.0], [0, 6.8]];
/** Each heap's half length across the lane and half width along it. */
const HEAP_ACROSS = 13.5, HEAP_ALONG = 11.5;
/**
 * The heaps from the two sides in turn: how far each reaches past the middle, and where along. Some reach far, so that the way
 * between them is narrow, some not so far; each as close to the last as it can be without the two running into each other.
 */
export const HEAP_ROW: [number, number][] = [[4.5, 8], [6, 27.5], [6.5, 48], [3, 66.5], [3, 82.5], [5.5, 100.5], [6.5, 121], [4, 140.5], [3, 157.5], [6, 176], [6.5, 196.5], [3.5, 215.5]];
/** The yard: how far it reaches either side of its middle line, and from where to where along. */
export const YARD_HALF = 24, YARD_FROM = -8, YARD_TO = 232;

/**
 * A: the stockpile yard, its middle line at x, from z on north, its floor at y (the floor itself is the land's, YARD_HALF
 * either side and from YARD_FROM to YARD_TO: laid as one piece here, its long diagonal crossing a heap left a spike in it). Big heaps from both sides in turn, each
 * reaching 3 to 6.5 m past the middle, so that there is no straight way through: the way snakes between them, one side of
 * the truck up the foot of one heap and then of the next.
 */
export function heapYard(s: Site, x0: number, z0: number, y: number): void {
  /** What of a piece lies on the yard's side of a wall at x = edge: side 1 keeps what is east of it, -1 west. */
  const clip = (poly: [number, number][], edge: number, side: number) => {
    const out: [number, number][] = [];
    const inside = (p: [number, number]) => (p[0] - edge) * side >= 0;
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length];
      if (inside(a)) out.push(a);
      if (inside(a) !== inside(b)) out.push([edge, a[1] + ((b[1] - a[1]) * (edge - a[0])) / (b[0] - a[0])]);
    });
    return out;
  };
  // Each heap is pushed up against the yard's wall on its own side, as heaps are against the bin walls: on that side it
  // runs out twice as far as it would to reach the wall, cut off by it, so that against the wall it stands half its
  // height and steep. There is no going round a heap behind it: only by the lane in front of it.
  const heap = (cx: number, cz: number, out: number, look: Look) => {
    const SIDES = 20;
    const far = 2 * Math.abs(x0 + out * YARD_HALF - cx);
    const across = (dx: number) => (dx * out > 0 ? far : HEAP_ACROSS);
    const ring = (k: number, f: number): [number, number] => {
      const c = Math.cos((k / SIDES) * Math.PI * 2);
      return [cx + c * across(c) * f, cz + Math.sin((k / SIDES) * Math.PI * 2) * HEAP_ALONG * f];
    };
    for (let k = 0; k < SIDES; k++) {
      for (let n = 0; n < HEAP_RINGS.length - 1; n++) {
        const [fo, ho] = HEAP_RINGS[n], [fi, hi] = HEAP_RINGS[n + 1];
        const height = (x: number, z: number) => y + (Math.hypot((x - cx) / across(x - cx), (z - cz) / HEAP_ALONG) > (fo + fi) / 2 ? ho : hi);
        const piece = clip(clip(fi === 0 ? [ring(k, fo), ring(k + 1, fo), [cx, cz]] : [ring(k, fo), ring(k + 1, fo), ring(k + 1, fi), ring(k, fi)], x0 - YARD_HALF, 1), x0 + YARD_HALF, -1);
        if (piece.length >= 3) s.relief.area(piece, height, look);
      }
    }
  };
  HEAP_ROW.forEach(([reach, z], n) => heap(x0 + (n % 2 ? 1 : -1) * (HEAP_ACROSS - reach), z0 + z, n % 2 ? 1 : -1, HEAPS[n % 3]));
}

// ---------------------------------------------------------------------------------------------------------------------
// The load-out.

/** The load-out's road: how wide, from where to where along; how high the banks either side of it stand above it, and how far out they reach. */
export const LOADOUT_WIDE = 8, LOADOUT_FROM = -20, LOADOUT_TO = 104, LOADOUT_BANK = 6, LOADOUT_BANK_OUT = 14;

/** The load-out's rows of bins: where each crosses the middle of the road; its angle off straight across; how high its frame is; where across the road its bins are. */
export const LOADOUT_ROWS: [number, number, number, number[]][] = [
  [12, 0, 6.6, [-2.6, 0, 2.6]],
  [24, 0.6, 9.8, [-2.8, -0.2, 2.6]],
  [29, -0.6, 7.2, [-2.4, 0.2, 2.8]],
  [42, 0, 6.8, [-2.6, 0, 2.6]],
  [52, 0.85, 8.6, [-2.6, 0, 2.6]],
  [64, -0.45, 7.0, [-2.8, -0.2, 2.4]],
  [72, 0.45, 8.2, [-2.4, 0.2, 2.8]],
  [86, 0, 6.8, [-2.6, 0, 2.6]],
];

/**
 * B: the load-out, its road's middle at x, from z on north, at y: a road 8 m wide with nothing standing in it, cut down
 * between banks 6 m high: eight rows of bins on steel frames across it, some straight across, some aslant and crossing
 * each other, at different heights, a belt along the top of each filling them. Lorries are loaded by driving in under a
 * bin and stopping; its gate opens and rock pours out for a second and more, on a beat of its own, the same each time; its
 * lamps flash before. The way through is a matter of picking the gaps. Without its banks (banked false) the place round
 * about walls the road in itself, and the frames' legs stand on the ground.
 */
export function loadOut(s: Site, B: number, z0: number, y: number, banked = true): void {
  if (banked) for (const side of [-1, 1]) {
    const a = B + side * (LOADOUT_WIDE / 2), b = B + side * LOADOUT_BANK_OUT;
    s.relief.area([[Math.min(a, b), z0 + LOADOUT_FROM], [Math.max(a, b), z0 + LOADOUT_FROM], [Math.max(a, b), z0 + LOADOUT_TO], [Math.min(a, b), z0 + LOADOUT_TO]], y + LOADOUT_BANK, BANK);
  }
  s.relief.ribbon([{ x: B, z: z0 + LOADOUT_FROM, h: y }, { x: B, z: z0 + LOADOUT_TO, h: y }], LOADOUT_WIDE, CONCRETE);
  const rows = LOADOUT_ROWS;
  const STEEL = 0x8c9096, BIN = 0xa08a52, GATE = 0x34373c;
  for (const [dz, angle, high, bins] of rows) {
    const z = z0 + dz, yy = y + high;
    const c = Math.cos(angle), sn = Math.sin(angle);
    /** A place along it, so far from the middle of the road across it. */
    const along = (t: number): [number, number] => [B + t * c, z + t * sn];
    const reach = 7.5 / c;
    const rot: [number, number, number] = [0, -angle, 0];
    const top = yy + 1.9;
    // The frame's beam, and the belt along the top with rock on it; nothing of it to be run into, all of it seen through
    // when it is between the camera and the truck.
    s.props.push({ shape: 'box', size: [reach, 0.3, 0.7], pos: [B, yy, z], rot, color: STEEL, overhead: true, fade: true, ghost: true });
    s.props.push({ shape: 'box', size: [reach, 0.15, 0.5], pos: [B, top, z], rot, color: STEEL, overhead: true, fade: true, ghost: true });
    s.props.push({ shape: 'box', size: [reach, 0.1, 0.4], pos: [B, top + 0.24, z], rot, color: 0x8b8880, overhead: true, fade: true, ghost: true });
    // Its legs, up from the banks either side to the belt.
    for (const t of [-reach + 0.4, reach - 0.4]) {
      const [x, zz] = along(t);
      const foot = y + (banked ? LOADOUT_BANK : 0), tall = top - foot;
      s.props.push({ shape: 'box', size: [0.35, tall / 2, 0.35], pos: [x, foot + tall / 2, zz], color: STEEL, overhead: true, fade: true });
    }
    // Each bin standing on the beam, its hopper narrowing under it to a gate.
    const spots = bins.map((h) => {
      const [x, zz] = along(h / c);
      s.props.push({ shape: 'box', size: [0.6, 0.7, 0.6], pos: [x, yy + 1.0, zz], rot, color: BIN, overhead: true, fade: true, ghost: true });
      s.props.push({ shape: 'cone', size: [0.6, 0.35, 0], pos: [x, yy - 0.65, zz], rot: [Math.PI, -angle, 0], color: BIN, overhead: true, fade: true, ghost: true });
      s.props.push({ shape: 'box', size: [0.3, 0.08, 0.3], pos: [x, yy - 1.12, zz], rot, color: GATE, overhead: true, fade: true, ghost: true });
      return [x, yy - 0.6, zz] as [number, number, number];
    });
    // A band of yellow and black hazard stripes painted across the road under the row, from wall to wall: where its rock
    // comes down.
    const long = LOADOUT_WIDE / c - 0.2;
    s.decals.push({ pos: [B, z], size: [long, 0.5], rotY: -angle, color: 0xe8b81e, base: y, y: 0.03 });
    for (let t = -long / 2 + 0.3; t < long / 2 - 0.2; t += 0.55) {
      const [x, zz] = along(t);
      s.decals.push({ pos: [x, zz], size: [0.14, 0.48], rotY: -angle + Math.PI / 4, color: 0x24262a, base: y, y: 0.04 });
    }
    // A lamp either side of each gate, like those on any site's barriers.
    const lamps: [number, number, number][] = [-1, 1].map((side) => [-sn * 0.42 * side, -0.62, c * 0.42 * side]);
    s.droppers.push({ spots, every: [3.6, 5.0], burst: [6, 6], tell: 1.0, lamps });
  }
  // Two lorries in under bins, being loaded, standing there: that way past those bins is shut.
  for (const [x, z] of [[B - 2.6, z0 + 42], [B + 2.6, z0 + 86]] as const) s.traffic.push({ from: [x, z + 0.25], to: [x, z - 0.25], cars: 1, speed: 0, kinds: ['dumpTruck'] });
}

// ---------------------------------------------------------------------------------------------------------------------
// The dike.

/** How high the dike's top stands over the ponds' floor, and how wide it is. */
export const DIKE_H = 2.2, DIKE_WIDE = 6.5;
/** The ponds either side of it: how far out from its line, how far below its floor their water stands; where they run along. */
export const PONDS_HALF = 24, POND_DOWN = 0.6, PONDS_FROM = -8, PONDS_TO = 256;
/** Where the dike starts and ends along, and its middle across from its line at its end. */
export const DIKE_FROM = -6, DIKE_TO = 248, DIKE_END_OFF = 2.5;

/**
 * C: the dike, its line at x, from z on north, the ponds' floor at y (its top DIKE_H above; the ponds themselves are the
 * land's, at y - POND_DOWN, for the dike's banks run down to the land and would be covered by a pond laid here): 6.5 m, across the ponds, and
 * the machines at work along it in eight groups: one, or two together to be got past in one go, and between each group and
 * the next a stretch no machine reaches, at least as long as the truck, where it can wait its moment. Straight past each
 * group, jinking 5 m to the other side between one and the next, so that it cannot be taken flat out; edged with crash
 * barriers, then sandbags, then nothing.
 */
/** Returns where along its edges a thing so far in from one stands, and which way the edge runs there. */
export function dike(s: Site, C: number, z0: number, y: number): (dz: number, side: number, inset: number) => [number, number, number] {
  const top = y + DIKE_H;
  /** Each group's place along the dike, the dike's middle there across, and how long it runs straight there. */
  const stations: [number, number, number][] = [[16, 0, 8], [35, 2.5, 6], [49, -2.5, 6], [70.5, 2.5, 16], [100, -2.5, 22], [123, 2.5, 6], [167, -2.5, 64], [223, 2.5, 28]];
  const line: RibbonPoint[] = [{ x: C, z: z0 + DIKE_FROM, h: top }];
  for (const [z, off, run] of stations) line.push({ x: C + off, z: z0 + z - run / 2, h: top, round: 3 }, { x: C + off, z: z0 + z + run / 2, h: top, round: 3 });
  line.push({ x: C + DIKE_END_OFF, z: z0 + DIKE_TO, h: top });
  const made = s.relief.ribbon(line, DIKE_WIDE, DIKE);
  for (const side of ['left', 'right'] as const) s.relief.slope(made[side], side, { run: 2.6, to: 'land' }, DIKE);
  /** The dike's middle across, and which way it runs, so far along (from its own start). */
  const middle = (dz: number): { x: number; dx: number } => {
    const z = z0 + dz;
    for (let n = 0; n < line.length - 1; n++) {
      const p = line[n], q = line[n + 1];
      if (z >= p.z && z <= q.z) return { x: p.x + ((q.x - p.x) * (z - p.z)) / (q.z - p.z), dx: (q.x - p.x) / (q.z - p.z) };
    }
    return { x: line[line.length - 1].x, dx: 0 };
  };
  const pad = (x0: number, za: number, x1: number, zb: number, h: number) => s.relief.area([[x0, za], [x1, za], [x1, zb], [x0, zb]], h, DIKE);
  const westAt = (dz: number) => middle(dz).x - DIKE_WIDE / 2, eastAt = (dz: number) => middle(dz).x + DIKE_WIDE / 2;
  /** A machine beside the dike, east or west of it, so far out from its edge, on a pad of ground of its own. */
  const machine = (kind: RigDesc['kind'], dz: number, side: 1 | -1, out: number, padOut: number, padHalf: number, period: number, phase: number) => {
    const z = z0 + dz;
    const edge = side > 0 ? eastAt(dz) : westAt(dz);
    if (kind === 'ball') {
      // A ball crane stands down at the dike's foot, past its slope, on ground of its own just out of the pond: low, so
      // that its jib slants up as a crane's does and still swings the ball at the height of a truck's side.
      const foot = edge + side * 2.6;
      s.rigs.push({ kind, pos: [foot + side * out, y, z], yaw: -side * Math.PI / 2, period, phase });
      pad(Math.min(foot, foot + side * padOut), z - padHalf, Math.max(foot, foot + side * padOut), z + padHalf, y);
      hatch(s, middle(dz).x, z, DIKE_WIDE - 0.6, 14, top);
      return;
    }
    s.rigs.push({ kind, pos: [edge + side * out, top, z], yaw: -side * Math.PI / 2, period, phase });
    pad(Math.min(edge, edge + side * padOut), z - padHalf, Math.max(edge, edge + side * padOut), z + padHalf, top);
    hatch(s, middle(dz).x, z, DIKE_WIDE - 0.6, kind === 'pile' ? 2.5 : 4, top);
  };
  /** A pile driver's hammer is over the middle of the dike: 2.2 m across, it leaves less than a truck's width either side. */
  const PILE_AT = 5.4 - DIKE_WIDE / 2;
  // 1 an excavator digging the pond on the west and tipping across the dike.
  machine('slew', 16, -1, 2.9, 7.5, 7, 5.5, 0);
  // 2 a pile driver, by itself: time enough under it while it is up not to have to rush.
  machine('pile', 35, 1, PILE_AT, 9, 5, 5, 0.2);
  // 3 a boom from the west.
  machine('boom', 49, -1, 2.4, 9.5, 4.5, 6, 0.6);
  // 4 a crane with a grab, carrying mud across from the far pond.
  machine('clamshell', 66, 1, 3, 6, 6, 8, 0.1);
  // 5 a demolition ball, big and heavy, on a crane slewing round and round: flung out on its cable, it comes round low
  // and across the dike once a turn, along 22 m of it.
  machine('ball', 100, -1, 3, 7, 3.5, 4.4, 0);
  // 6 a second pile driver, from the east.
  machine('pile', 123, 1, PILE_AT, 9, 4.5, 5, 0.7);
  // 7 three ball cranes one after another, on either side in turn, each turning at its own rate; nowhere between them to stop.
  machine('ball', 146, -1, 3, 7, 3.5, 4.2, 0.2);
  machine('ball', 167, 1, 3, 7, 3.5, 4.6, 0.55);
  machine('ball', 188, -1, 3, 7, 3.5, 4.0, 0.85);
  // 8 two excavators facing each other, swinging in turn.
  machine('slew', 217, -1, 2.9, 7.5, 7, 4.6, 0);
  machine('slew', 229, 1, 2.9, 7.5, 7, 4.6, 0.5);
  // Along the edges, following the dike round its jinks: crash barriers, then sandbags, then nothing; none where a boom
  // comes out over the edge.
  const along = (dz: number, side: number, inset: number): [number, number, number] => {
    const { x, dx } = middle(dz);
    const len = Math.hypot(1, dx);
    return [x + (side * (DIKE_WIDE / 2 - inset)) / len, z0 + dz - (side * (DIKE_WIDE / 2 - inset) * dx) / len, Math.atan2(dx, 1)];
  };
  const clear = (dz: number) => Math.abs(dz - 49) < 2.2 || Math.abs(dz - 100) < 12;
  for (let dz = 6; dz < 46; dz += 4) {
    if (clear(dz)) continue;
    for (const side of [-1, 1]) {
      const [x, zz, yaw] = along(dz, side, 0.25);
      s.object('guardrail', x, zz, yaw + (side > 0 ? Math.PI : 0), top);
    }
  }
  for (let dz = 46; dz < 110; dz += 0.95) {
    if (clear(dz)) continue;
    for (const side of [-1, 1]) {
      const [x, zz, yaw] = along(dz, side, 0.3);
      s.object('sandbag', x, zz, Math.PI / 2 + yaw, top);
    }
  }
  for (const dz of [26, 112]) s.object('pumpSet', eastAt(dz) + 1.2, z0 + dz, 0, top);
  return along;
}

// ---------------------------------------------------------------------------------------------------------------------
// The river crossing.

/** The river bed: how far down under the bank's foot, how high the water stands, and how fast it runs across, m/s. */
export const RIVER_BED = -1.05, RIVER_SURFACE = -0.15, RIVER_FLOW = 4.4;
/** Its east edge and the ledge on its west, across from the way's line; how wide the fast water before the ledge is, and how fast. */
export const RIVER_EAST = 12, RIVER_LIP = -12, LIP_WIDE = 3, LIP_FLOW = 6;
/** The least room between one boulder and the next, m: a truck is 2.6 wide and 7.4 long, has to be turning as it goes between them, and is carried sideways as it goes. */
const RIVER_SPACE = 5.8;
/** The channel under the ledge: how wide, its bed, its water. */
export const FALL_WIDE = 11, FALL_BED = -4.2, FALL_SURFACE = -3.2;
/** Where the way goes down into the river and comes up out of it, along from where it is put. */
export const RIVER_IN = -20, RIVER_OUT = 160;

/**
 * D: the crossing of the river, the way's line at x, from z on north, the banks' foot at y (the banks themselves, and the
 * ground the channel below the weir is cut into, are the land's): down into water 0.9 m deep
 * running across from east to west, round boulders standing in it, the current pushing the truck downstream all the way,
 * onto the boulders below it; along its west edge the water runs faster and pours over a weir into a deep channel below,
 * and a truck let drift too near goes over with it.
 */
export function riverCrossing(s: Site, D: number, z0: number, y: number): void {
  const bed = y + RIVER_BED, surface = y + RIVER_SURFACE, fallSurface = y + FALL_SURFACE;
  const mid = D + (RIVER_EAST + RIVER_LIP) / 2, wide = RIVER_EAST - RIVER_LIP;
  s.relief.ribbon([{ x: mid, z: z0 + RIVER_IN, h: y }, { x: mid, z: z0 - 12, h: bed }, { x: mid, z: z0 + 152, h: bed }, { x: mid, z: z0 + RIVER_OUT, h: y }], wide, FORD);
  // The water over it from where the way in goes under to where the way out comes up; faster over the last few metres
  // before the ledge, drawn on to it.
  s.fords.push({ pos: [D + RIVER_LIP + LIP_WIDE / 2, z0 + 70], half: [LIP_WIDE / 2, 89], flow: [-LIP_FLOW, 0], drag: 0.1, grip: 0.65, sideGrip: 0.13 });
  s.fords.push({ pos: [mid, z0 + 70], half: [wide / 2, 89], flow: [-RIVER_FLOW, 0], drag: 0.1, grip: 0.65, sideGrip: 0.13, surface, fall: surface - fallSurface });
  // The channel under the ledge, deep, running away north; and its bank beyond.
  const low = D + RIVER_LIP - FALL_WIDE / 2;
  s.relief.ribbon([{ x: low, z: z0 - 16, h: y + FALL_BED }, { x: low, z: z0 + 150, h: y + FALL_BED }], FALL_WIDE, RIVER);
  s.fords.push({ pos: [low, z0 + 67], half: [FALL_WIDE / 2, 83], flow: [0, 2], surface: fallSurface });
  // The water white where it goes over: along the lip, and broken white at the foot.
  s.decals.push({ pos: [D + RIVER_LIP + 0.25, z0 + 70], size: [0.5, 178], color: 0xd8eaf0, base: surface, y: 0.02 });
  for (let dz = -14; dz < 148; dz += 1.6) {
    s.decals.push({ pos: [D + RIVER_LIP - 1.6 - hash(dz, 11) * 2.6, z0 + dz], size: [0.12 + hash(dz, 12) * 0.2, 2 + hash(dz, 13) * 4], rotY: (hash(dz, 14) - 0.5) * 0.3, color: 0xe8f0f2, base: fallSurface, y: 0.02 });
  }
  /** A boulder: two blocks one on the other, turned each its own way; so far across from the way's line, so long and wide, so tall. */
  const boulder = (dx: number, dz: number, hx: number, hz: number, tall: number, turn: number) => {
    const tone = 0x7d7a72 + (hash(dx, dz) < 0.5 ? 0x080808 : 0);
    const z = z0 + dz;
    s.props.push({ shape: 'box', size: [hx, tall, hz], pos: [D + dx, bed + tall - 0.3, z], rot: [0.06, turn, 0.05], color: tone });
    s.props.push({ shape: 'box', size: [hx * 0.7, tall * 0.45, hz * 0.75], pos: [D + dx, bed + tall * 2 - 0.25, z + 0.1], rot: [-0.1, turn + 0.5 + hash(dz, dx) * 0.6, 0.12], color: tone });
    // The water heaped up white against it upstream, and broken white below it.
    const across = Math.abs(hx * Math.sin(turn)) + Math.abs(hz * Math.cos(turn)), along = Math.abs(hx * Math.cos(turn)) + Math.abs(hz * Math.sin(turn));
    s.decals.push({ pos: [D + dx + along + 0.15, z], size: [0.3, across * 2.1], color: 0xf2f7f8, base: surface, y: 0.02 });
    for (const k of [-1, 0, 1]) s.decals.push({ pos: [D + dx - along - 1.6 + Math.abs(k) * 0.4, z + k * across * 0.8], size: [2.6 - Math.abs(k), 0.14], rotY: k * 0.18, color: 0xe8f0f2, base: surface, y: 0.02 });
  };
  // Boulders strewn all over the river as it left them, big and small, every way round, each far enough from the next
  // for a truck to get between (RIVER_SPACE) and no further than it has to be: so there is a way through everywhere
  // and a straight one nowhere, and the truck weaves the whole way. Fewer out in the fast water by the ledge.
  const placed: [number, number, number][] = [];
  for (let n = 0; n < 8000; n++) {
    const dz = 4 + hash(n, 21) * 144, dx = RIVER_LIP + 0.5 + hash(n, 22) * (RIVER_EAST - RIVER_LIP - 0.5);
    const big = hash(n, 23);
    const hx = 0.6 + big * big * 1.4, hz = 0.5 + hash(n, 24) * 0.7, turn = hash(n, 25) * Math.PI;
    const r = Math.hypot(hx, hz);
    if (dx < RIVER_LIP + LIP_WIDE && hash(n, 26) < 0.6) continue;
    if (placed.some(([x, zz, rr]) => Math.hypot(dx - x, dz - zz) < r + rr + RIVER_SPACE)) continue;
    placed.push([dx, dz, r]);
    boulder(dx, dz, hx, hz, 0.75 + hash(n, 28) * 0.45, turn);
  }
  // Stones just under the water between the boulders, to be driven round or bumped over: the water ripples white over each.
  for (let dz = 10; dz < 150; dz += 7) {
    const x = D + RIVER_LIP + LIP_WIDE + hash(dz, 3) * (RIVER_EAST - RIVER_LIP - LIP_WIDE - 1);
    s.props.push({ shape: 'box', size: [0.5, 0.2, 0.45], pos: [x, bed + 0.08, z0 + dz], rot: [0.1, hash(dz, 4) * 3, 0.1], color: 0x6f6c64 });
    s.decals.push({ pos: [x - 0.6, z0 + dz], size: [1.6, 0.5], color: 0xe8f0f2, base: surface, y: 0.02 });
  }
}
