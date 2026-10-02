import {
  DARK, GLASS, LIT, PLANTS, ROOF_FLOORS, STONE, WARES,
  airCon, glazing, pick, shopfront, span, tone, waterTower, within,
  type Lot, type Rand,
} from './buildingParts';
import { Shapes, shifted, wallOf, type Plot, type Wall } from './shapes';
import { SIGNS, TRADES, type WideSign } from './signs';

// Downtown: each lot a cluster of towers of different heights. Most are flats or plain
// offices over a row of shops; here and there stands something grander: a head office,
// a hotel, a department store.

const GLASS_WALLS = [0x5f87a6, 0x4f8088, 0x6f7f92, 0x7d8f88, 0x54708e];
const TILE_WALLS = [0xd9cfbb, 0xcaa893, 0xb9bcbd, 0xdfddd5, 0xa5826a, 0xc4b8a0, 0x9fb0b8];
const CONCRETE_WALLS = [0xbdbab2, 0xa9adb0, 0xc8c2b4];
const RAIL_GLASS = 0xa9c8d2;
const PODIUM = 4.8;
const STOREY = 3.5;
const COLONNADE = 2;
/** How far up a wall that stands against the next lot is taken to be hidden by it. */
const PARTY = 10;

export function blocks(s: Shapes, lot: Lot, rand: Rand): void {
  const nx = Math.max(1, Math.round((lot.hx * 2) / 17));
  const nz = Math.max(1, Math.round((lot.hz * 2) / 17));
  const tallest = Math.floor(rand() * nx * nz);
  const least = Math.min(lot.height, PODIUM + STOREY * 2);
  const heights = Array.from({ length: nx * nz }, (_, i) => (i === tallest ? lot.height : Math.max(least, lot.height * span(rand, 0.5, 0.95))));
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const plot: Plot = { cx: (-0.5 + (i + 0.5) / nx) * lot.hx * 2, cz: (-0.5 + (j + 0.5) / nz) * lot.hz * 2, hx: lot.hx / nx, hz: lot.hz / nz };
      // How much of each wall is hidden: by the tower next to it, by the next lot, or not at all.
      const hidden = [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([di, dj], side) => {
        const ni = i + di;
        const nj = j + dj;
        if (ni >= 0 && ni < nx && nj >= 0 && nj < nz) return heights[ni + nj * nx];
        return lot.open[side] ? 0 : PARTY;
      });
      const index = i + j * nx;
      const height = heights[index];
      const crown = index === tallest ? lot.crown : 0;
      const roll = rand();
      if (roll < 0.17) office(s, rand, plot, height, hidden, crown);
      else if (roll < 0.28) hotel(s, rand, plot, height, hidden);
      else if (roll < 0.4 && height <= 34) store(s, rand, plot, height, hidden, crown);
      else tower(s, rand, plot, height, hidden, crown);
    }
  }
}

type Cladding = 'glass' | 'tile' | 'ribbon';

/** The ordinary kind: flats or offices, with a row of shops behind a colonnade wherever it faces a street. */
function tower(s: Shapes, rand: Rand, p: Plot, height: number, hidden: number[], crown: number): void {
  const kind = pick<Cladding>(rand, ['glass', 'tile', 'tile', 'ribbon']);
  const body = pick(rand, kind === 'glass' ? GLASS_WALLS : kind === 'tile' ? TILE_WALLS : CONCRETE_WALLS);
  const trim = kind === 'glass' ? pick(rand, CONCRETE_WALLS) : tone(body, 1.12);
  const floors = Math.max(2, Math.round((height - PODIUM) / STOREY));
  const storey = (height - PODIUM) / floors;
  const lintel = PODIUM - 1.1;
  const street = hidden.map((to) => to === 0);
  s.shell(within(p, street.map((on) => (on ? COLONNADE : 0))), 0, lintel, street.map((on) => (on ? 0x2b3540 : body)));
  s.shell(p, lintel, height, body, pick(rand, ROOF_FLOORS));

  for (let side = 0; side < 4; side++) {
    const w = wallOf(p, side);
    cladding(s, rand, w, kind, Math.max(PODIUM, hidden[side]), height, floors, storey, body, trim);
    if (!street[side]) continue;
    const tenants = shops(s, rand, w, lintel, body);
    if (kind === 'glass') continue;
    // The end shops hang a second sign out over the pavement.
    const ends = rand() < 0.5 ? [-1, 1] : [rand() < 0.5 ? -1 : 1];
    const out = kind === 'ribbon' ? 0.3 : 0.12;
    for (const end of ends) {
      const tall = span(rand, 3.6, 5.6);
      s.blade(w, end * (w.half - 0.2), PODIUM + 0.7, PODIUM + 0.7 + tall, out, out + tall / 4, SIGNS.blade[end < 0 ? tenants[0] : tenants[tenants.length - 1]], DARK);
    }
  }
  plant(s, rand, p, height, body, trim, crown, street);
}

/** A row of shops behind a colonnade, each with its sign on the beam above. Returns what each is let as, from left to right. */
function shops(s: Shapes, rand: Rand, w: Wall, lintel: number, body: number): number[] {
  const bays = Math.max(1, Math.round((w.half * 2) / 5.2));
  const width = (w.half * 2) / bays;
  s.panel(w, -w.half, lintel, w.half, PODIUM + 0.25, 0.03, STONE);
  for (let i = 0; i <= bays; i++) {
    const u = Math.max(-w.half + 0.32, Math.min(w.half - 0.32, -w.half + i * width));
    s.block(w, u, lintel / 2, -0.32, 0.32, lintel / 2, 0.32, STONE, STONE, true);
  }
  const tenants: number[] = [];
  for (let i = 0; i < bays; i++) {
    const u = -w.half + (i + 0.5) * width;
    const hw = width / 2 - 0.5;
    const trade = Math.floor(rand() * TRADES.length);
    shopfront(s, rand, shifted(w, -COLONNADE, u, width / 2), hw, lintel - 0.1, TRADES[trade].front, COLONNADE, body);
    s.panel(w, u - hw, lintel + 0.14, u + hw, PODIUM + 0.14, 0.07, 0xffffff, SIGNS.shop[trade]);
    tenants.push(trade);
  }
  return tenants;
}

/** One wall of a tower, from `from` upward: what is lower is hidden behind whatever stands against it. */
function cladding(s: Shapes, rand: Rand, w: Wall, kind: Cladding, from: number, height: number, floors: number, storey: number, body: number, trim: number): void {
  const half = w.half;
  const first = Math.max(0, Math.ceil((from - PODIUM) / storey - 0.01));
  if (first >= floors) return;
  const foot = PODIUM + first * storey;
  const middle = (foot + height) / 2;
  const run = (height - foot) / 2;

  if (kind === 'glass') {
    // A curtain wall: a darker band at every floor, mullions from top to bottom, piers at the corners.
    const band = tone(body, 0.78);
    for (let k = first; k < floors; k++) s.panel(w, -half + 0.6, PODIUM + k * storey, half - 0.6, PODIUM + k * storey + 0.6, 0.03, band);
    const panes = Math.max(2, Math.round((half * 2 - 1.2) / 1.9));
    for (let i = 1; i < panes; i++) {
      const u = -half + 0.6 + (i / panes) * (half * 2 - 1.2);
      s.panel(w, u - 0.05, foot, u + 0.05, height - 0.8, 0.045, trim);
    }
    for (const end of [-1, 1]) s.block(w, end * (half - 0.3), middle, 0.07, 0.3, run, 0.07, trim);
    s.block(w, 0, height - 0.4, 0.09, half, 0.4, 0.09, trim);
    return;
  }

  if (kind === 'ribbon') {
    // Offices: a strip of window the width of each floor, and fins to keep the sun off.
    for (let k = first; k < floors; k++) s.panel(w, -half + 0.4, PODIUM + k * storey + 1, half - 0.4, PODIUM + k * storey + 2.55, 0.03, GLASS[k % 2]);
    const fins = Math.max(2, Math.round((half * 2) / 3.6));
    for (let i = 0; i <= fins; i++) {
      const u = Math.max(-half + 0.12, Math.min(half - 0.12, -half + (i / fins) * half * 2));
      s.block(w, u, middle, 0.15, 0.12, run, 0.15, trim);
    }
    s.block(w, 0, height - 0.35, 0.18, half, 0.35, 0.18, trim);
    return;
  }

  // Flats over shops, faced in tile: each bay the same all the way up.
  const bays = Math.max(2, Math.round((half * 2) / 3.4));
  const width = (half * 2) / bays;
  const kinds = Array.from({ length: bays }, (_, i) => {
    const roll = rand();
    // No balconies at the ends, where the signs hang.
    return roll < 0.3 && i > 0 && i < bays - 1 ? 'balcony' : roll < 0.88 ? 'window' : 'stair';
  });
  const railing = tone(body, 0.86);
  for (let k = first; k < floors; k++) {
    const y = PODIUM + k * storey;
    for (let i = 0; i < bays; i++) {
      const u = -half + (i + 0.5) * width;
      if (kinds[i] === 'balcony') {
        s.panel(w, u - width / 2 + 0.55, y + 0.15, u + width / 2 - 0.55, y + 2.5, 0.03, pick(rand, GLASS));
        s.block(w, u, y + 0.55, 0.4, width / 2 - 0.2, 0.55, 0.4, railing, 0x6f6d68);
      } else if (kinds[i] === 'window') {
        glazing(s, rand, w, u - width / 2 + 0.7, y + 1.05, u + width / 2 - 0.7, y + 2.5, trim);
        if (rand() < 0.22) airCon(s, w, u + width / 2 - 0.75, y + 0.2);
      } else s.panel(w, u - 0.35, y + 1.5, u + 0.35, y + 2.3, 0.03, pick(rand, GLASS));
    }
  }
  for (const end of [-1, 1]) s.block(w, end * (half - 0.12), middle, 0.05, 0.12, run, 0.05, trim);
  s.block(w, 0, height - 0.3, 0.07, half, 0.3, 0.07, trim);
}

/** What stands on a tower's roof: a plant room with tanks on it, chillers, a cooling tower, a mast, a hoarding. */
function plant(s: Shapes, rand: Rand, p: Plot, height: number, body: number, trim: number, crown: number, street: boolean[]): void {
  s.rim(p, height, 1, 0.3, body, tone(body, 0.85), trim);
  const tall = crown || span(rand, 2.4, 3.2);
  const room: Plot = { cx: 0, cz: 0, hx: p.hx * span(rand, 0.3, 0.45), hz: p.hz * span(rand, 0.3, 0.45) };
  const toward = rand() < 0.5 ? -1 : 1;
  room.cx = p.cx + span(rand, -1, 1) * Math.max(0, p.hx - room.hx - 1.6);
  room.cz = p.cz + toward * Math.max(0, p.hz - room.hz - 1.6) * span(rand, 0.4, 1);
  s.shell(room, height, height + tall, tone(body, 0.88), 0x80858b);

  const tanks = Math.max(1, Math.min(1 + Math.floor(rand() * 3), Math.floor((room.hx * 2) / 2.1)));
  for (let i = 0; i < tanks; i++) waterTower(s, room.cx + (i - (tanks - 1) / 2) * 2.1, height + tall, room.cz, 0.8);
  if (height > 30 && rand() < 0.5) {
    // A mast, banded so that aircraft see it.
    for (let i = 0; i < 6; i++) s.box(room.cx + room.hx - 0.3, height + tall + 0.7 + i * 1.4, room.cz + room.hz - 0.3, 0.1, 0.7, 0.1, i % 2 ? 0xe8e8e8 : 0xd03a2a);
  }

  // Along the far edge from the plant room: chillers in a row, and a cooling tower at the end of it.
  const z = p.cz - toward * (p.hz - 1.7);
  const chillers = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < chillers; i++) {
    const x = p.cx - p.hx + 2 + i * 2.3;
    if (x > p.cx + p.hx - 5) break;
    s.box(x, height + 0.5, z, 0.8, 0.5, 0.6, 0xc9ccce, 0x4a5058);
  }
  if (rand() < 0.5) s.cylinder(p.cx + p.hx - 2.4, height, z, 1.3, 1.5, 0xd8d2bc, 0x3a3f46, 10);

  const sides = street.flatMap((on, side) => (on ? [side] : []));
  if (sides.length && rand() < 0.5) {
    const w = wallOf(p, pick(rand, sides));
    const half = Math.min(w.half - 1.2, span(rand, 3.6, 5.4));
    if (half < 2.5) return;
    const y = height + 2;
    const post = (y + half - height) / 2;
    for (const end of [-0.7, 0.7]) s.block(w, end * half, height + post, -0.78, 0.08, post, 0.08, DARK, DARK, true);
    s.block(w, 0, y + half / 2, -0.58, half, half / 2, 0.1, DARK, DARK, true);
    s.panel(w, -half, y, half, y + half, -0.47, 0xffffff, pick(rand, SIGNS.board));
  }
}

// ---------------------------------------------------------------------------------------

/**
 * A glass entrance hall the height of `head`: stone round it, timber and greenery seen
 * through it. With a `sign`, it is the way in: doors, a canopy out over the pavement, and
 * the building's name along the canopy's edge.
 */
function lobby(s: Shapes, rand: Rand, w: Wall, head: number, frame: number, sign: WideSign | null, name = 0): void {
  const half = w.half;
  for (const end of [-1, 1]) s.block(w, end * (half - 0.35), head / 2, 0.06, 0.35, head / 2, 0.06, STONE);
  s.block(w, 0, head - 0.3, 0.06, half, 0.3, 0.06, STONE);
  s.panel(w, -half + 0.7, 0.15, half - 0.7, head - 0.6, 0.03, 0x9fb6bf);
  const feature = Math.min(2.2, half - 2.4);
  if (feature > 0.8) s.panel(w, -feature, 0.3, feature, Math.min(3, head - 1), 0.035, 0xb08a62);
  for (const end of [-1, 1]) s.panel(w, end * (half - 1.6) - 0.3, 0.3, end * (half - 1.6) + 0.3, 1.5, 0.035, pick(rand, PLANTS));
  const panes = Math.max(2, Math.round((half * 2 - 1.4) / 2.2));
  for (let i = 0; i <= panes; i++) {
    const u = -half + 0.7 + (i / panes) * (half * 2 - 1.4);
    s.panel(w, u - 0.04, 0.15, u + 0.04, head - 0.6, 0.045, frame);
  }
  if (head > 5) s.panel(w, -half + 0.7, 3.3, half - 0.7, 3.42, 0.045, frame);
  if (!sign) return;

  s.panel(w, -1.1, 0.05, 1.1, 2.7, 0.05, 0x2a3a4a);
  s.panel(w, -0.03, 0.05, 0.03, 2.7, 0.055, frame);
  const reach = Math.min(3.4, half - 1);
  s.block(w, 0, 3.2, 1.2, reach + 0.3, 0.1, 1.2, DARK, 0xd8d4c8, true);
  s.block(w, 0, 3.3 + reach / 8, 2.34, reach, reach / 8, 0.05, SIGNS.wideGround[sign], undefined, true);
  s.panel(w, -reach, 3.3, reach, 3.3 + reach / 4, 2.4, 0xffffff, SIGNS.wide[sign][name]);
}

/**
 * A head office: dark glass behind close-set fins, a tall glass hall at the street, and
 * the top two floors stood back behind a glass rail. The tallest have somewhere to land on top.
 */
function office(s: Shapes, rand: Rand, p: Plot, height: number, hidden: number[], crown: number): void {
  const street = hidden.map((to) => to === 0);
  const glass = pick(rand, [0x34495a, 0x3d5560, 0x454b55, 0x5a4f44]);
  const fin = pick(rand, [0xe9ebec, 0xc8a070, 0xdfe3e6]);
  const hall = Math.min(8.4, Math.max(PODIUM, height * 0.3));
  const shoulder = height > 20 ? height - STOREY * 2 : height;
  s.shell(p, 0, shoulder, glass, 0x8f9296);
  let top = p;
  if (shoulder < height) {
    top = within(p, [2, 2, 2, 2]);
    s.rim(p, shoulder, 1.1, 0.12, RAIL_GLASS, RAIL_GLASS, fin);
    s.shell(top, shoulder, height, glass, 0x7c8288);
  }
  // A screen round the roof, so that none of the machinery shows.
  s.rim(top, height, 1.6, 0.25, fin, tone(fin, 0.8), fin);

  const name = Math.floor(rand() * SIGNS.wide.office.length);
  let named = false;
  for (let side = 0; side < 4; side++) {
    const w = wallOf(p, side);
    const from = Math.max(street[side] ? hall : 0, hidden[side]);
    if (from < shoulder - 2) {
      const count = Math.max(2, Math.round((w.half * 2 - 0.8) / 1.3));
      for (let i = 0; i <= count; i++) s.block(w, -w.half + 0.4 + (i / count) * (w.half * 2 - 0.8), (from + shoulder) / 2, 0.14, 0.05, (shoulder - from) / 2, 0.14, fin);
      for (let y = hall; y < shoulder - 1; y += STOREY) if (y >= from) s.panel(w, -w.half, y, w.half, y + 0.35, 0.02, tone(glass, 0.72));
      s.block(w, 0, shoulder - 0.25, 0.17, w.half, 0.25, 0.17, fin);
    }
    if (!street[side]) continue;
    lobby(s, rand, w, hall, fin, named ? null : 'office', name);
    named = true;
  }

  const radius = Math.min(top.hx, top.hz) - 2.2;
  if ((height > 36 || crown) && radius > 2) {
    s.cylinder(top.cx, height + 0.02, top.cz, radius + 0.3, 0.02, 0xf2c12e, 0xf2c12e, 16);
    s.cylinder(top.cx, height + 0.04, top.cz, radius, 0.03, 0x565c64, 0x565c64, 16);
    for (const end of [-1, 1]) s.box(top.cx + end * radius * 0.3, height + 0.09, top.cz, radius * 0.07, 0.02, radius * 0.42, 0xf0f0ec);
    s.box(top.cx, height + 0.09, top.cz, radius * 0.3, 0.02, radius * 0.07, 0xf0f0ec);
  } else {
    // Otherwise a garden up there.
    s.box(top.cx, height + 0.03, top.cz, top.hx * 0.6, 0.03, top.hz * 0.6, 0xa9825c);
    for (const end of [-1, 1]) s.box(top.cx + end * (top.hx * 0.6 + 0.5), height + 0.3, top.cz, 0.4, 0.3, top.hz * 0.6, 0x7a7670, pick(rand, PLANTS));
  }
}

/** A hotel: every room with its glass-railed balcony, a hall and canopy at the street, its name on the roof, and a pool. */
function hotel(s: Shapes, rand: Rand, p: Plot, height: number, hidden: number[]): void {
  const street = hidden.map((to) => to === 0);
  const body = pick(rand, [0xd8c8ae, 0xc9b49a, 0xe2dccf, 0xb9a48c]);
  const trim = tone(body, 1.1);
  const hall = PODIUM + 0.8;
  const floors = Math.max(2, Math.round((height - hall) / 3.3));
  const storey = (height - hall) / floors;
  s.shell(p, 0, height, body, 0x9a8f80);
  s.rim(p, height, 1, 0.3, body, tone(body, 0.85), trim);

  const name = Math.floor(rand() * SIGNS.wide.hotel.length);
  let named = false;
  for (let side = 0; side < 4; side++) {
    const w = wallOf(p, side);
    const from = Math.max(street[side] ? hall : 0, hidden[side]);
    const first = Math.max(0, Math.ceil((from - hall) / storey - 0.01));
    const bays = Math.max(2, Math.round((w.half * 2) / 3.6));
    const width = (w.half * 2) / bays;
    if (first < floors) {
      const foot = hall + first * storey;
      for (let k = first; k < floors; k++) {
        const y = hall + k * storey;
        for (let i = 0; i < bays; i++) {
          const u = -w.half + (i + 0.5) * width;
          s.panel(w, u - width / 2 + 0.4, y + 0.2, u + width / 2 - 0.4, y + 2.6, 0.03, pick(rand, GLASS));
          s.block(w, u, y + 0.06, 0.38, width / 2 - 0.12, 0.06, 0.38, trim);
          s.panel(w, u - width / 2 + 0.14, y + 0.12, u + width / 2 - 0.14, y + 1.05, 0.72, RAIL_GLASS, undefined, true);
        }
      }
      // A wall between each room's balcony and the next.
      for (let i = 0; i <= bays; i++) {
        const u = Math.max(-w.half + 0.1, Math.min(w.half - 0.1, -w.half + i * width));
        s.block(w, u, (foot + height) / 2, 0.4, 0.1, (height - foot) / 2, 0.4, body);
      }
    }
    if (!street[side]) continue;
    lobby(s, rand, w, hall, 0xc8a070, named ? null : 'hotel', name);
    const reach = Math.min(w.half - 1.5, 5);
    if (!named && reach > 3) {
      // The name again, standing on the edge of the roof.
      for (const end of [-0.7, 0.7]) s.block(w, end * reach, height + 0.8, -0.7, 0.08, 0.8, 0.08, DARK, DARK, true);
      s.block(w, 0, height + 1.6 + reach / 8, -0.62, reach + 0.1, reach / 8 + 0.1, 0.08, DARK, DARK, true);
      s.panel(w, -reach, height + 1.6, reach, height + 1.6 + reach / 4, -0.53, 0xffffff, SIGNS.wide.hotel[name]);
    }
    named = true;
  }

  // On the roof: the pool, a few loungers beside it, and the plant kept to one end.
  const pool: Plot = { cx: p.cx, cz: p.cz - p.hz * 0.35, hx: p.hx * 0.5, hz: p.hz * 0.26 };
  s.box(pool.cx, height + 0.2, pool.cz, pool.hx, 0.2, pool.hz, 0xe8e4da);
  s.deck(within(pool, [0.4, 0.4, 0.4, 0.4]), height + 0.41, 0x5fb4d8);
  for (let x = pool.cx - pool.hx + 0.8; x < pool.cx + pool.hx - 0.5; x += 1.5) s.box(x, height + 0.15, pool.cz + pool.hz + 1.2, 0.35, 0.15, 0.9, pick(rand, [0xf0f0ec, 0xe07a28, 0x2f62a8]));
  const room: Plot = { cx: p.cx + p.hx * 0.35, cz: p.cz + p.hz * 0.55, hx: p.hx * 0.4, hz: p.hz * 0.25 };
  s.shell(room, height, height + 2.6, tone(body, 0.88), 0x80858b);
  waterTower(s, room.cx, height + 2.6, room.cz, 0.8);
}

/**
 * A department store: little window above the street, so the walls carry posters, banners
 * and a band of the house colour with the name on it; and at the street, one long lit window.
 */
function store(s: Shapes, rand: Rand, p: Plot, height: number, hidden: number[], crown: number): void {
  const street = hidden.map((to) => to === 0);
  const body = pick(rand, [0xe6dfd2, 0xd9c7c0, 0xc9d2d6, 0xe2d6b8]);
  const accent = pick(rand, [0x8a2f6a, 0xc8372d, 0x2f62a8, 0xe07a28]);
  const joint = tone(body, 0.8);
  s.shell(p, 0, height, body, pick(rand, ROOF_FLOORS));

  let named = false;
  for (let side = 0; side < 4; side++) {
    const w = wallOf(p, side);
    const half = w.half;
    const from = Math.max(street[side] ? PODIUM : 0, hidden[side]);
    if (from < height - 3) {
      // The joints between the facing panels, and the band round the top.
      for (let y = PODIUM + STOREY; y < height - 1.5; y += STOREY) if (y > from) s.panel(w, -half, y, half, y + 0.08, 0.02, joint);
      const columns = Math.max(2, Math.round((half * 2) / 3.2));
      for (let i = 1; i < columns; i++) s.panel(w, -half + (i / columns) * half * 2 - 0.04, from, -half + (i / columns) * half * 2 + 0.04, height - 1.2, 0.02, joint);
      s.block(w, 0, height - 0.6, 0.1, half, 0.6, 0.1, accent);
    }
    if (!street[side]) continue;

    // Up the wall: a glazed stair at one end, banners at the other, posters between.
    const end = rand() < 0.5 ? -1 : 1;
    const stair = end > 0 ? half - 2.8 : -half + 0.4;
    s.panel(w, stair, PODIUM + 0.4, stair + 2.4, height - 1.6, 0.03, GLASS[1]);
    for (let y = PODIUM + STOREY; y < height - 2; y += STOREY) s.panel(w, stair, y, stair + 2.4, y + 0.14, 0.04, tone(body, 1.05));
    const tall = height - PODIUM - 4.5;
    if (tall > 4) for (const j of [0, 1]) s.block(w, -end * (half - 1.4 - j * 1.6), PODIUM + 1.5 + tall / 2, 0.06, 0.55, tall / 2, 0.06, j ? 0xf2c12e : accent);
    const poster = Math.min(half - 3.8, 3.4);
    if (poster >= 2) {
      for (let y = PODIUM + 2.2; y + poster < height - 2.2; y += poster + 1.2) {
        s.block(w, end * 0.4, y + poster / 2, 0.05, poster + 0.12, poster / 2 + 0.12, 0.05, DARK);
        s.panel(w, end * 0.4 - poster, y, end * 0.4 + poster, y + poster, 0.11, 0xffffff, pick(rand, SIGNS.board));
      }
    }
    if (!named) {
      const reach = Math.min(half - 1, 4.8);
      s.panel(w, -reach, height - 0.6 - reach / 8, reach, height - 0.6 + reach / 8, 0.22, 0xffffff, pick(rand, SIGNS.wide.store));
      named = true;
    }

    // At the street: the window, with figures in it; doors in the middle; a canopy the length of the front.
    s.panel(w, -half + 0.3, 0, half - 0.3, 0.4, 0.03, STONE);
    s.panel(w, -half + 0.3, 0.4, half - 0.3, 3.3, 0.03, LIT);
    s.panel(w, -1.5, 0, 1.5, 3, 0.04, 0x3a5468);
    s.panel(w, -1.6, 3, 1.6, 3.2, 0.045, accent);
    for (let u = -half + 0.8; u < half - 0.9; u += 1.1) if (Math.abs(u + 0.2) > 1.9) s.panel(w, u, 0.6, u + 0.36, 0.6 + span(rand, 1.2, 1.7), 0.04, pick(rand, WARES));
    const panes = Math.max(2, Math.round((half * 2 - 0.6) / 2.4));
    for (let i = 0; i <= panes; i++) {
      const u = -half + 0.3 + (i / panes) * (half * 2 - 0.6);
      if (Math.abs(u) > 1.5) s.panel(w, u - 0.04, 0.4, u + 0.04, 3.3, 0.045, DARK);
    }
    s.block(w, 0, 3.6, 0.7, half, 0.1, 0.7, accent, tone(accent, 1.15), true);
  }
  plant(s, rand, p, height, body, tone(body, 1.1), crown, street);
}
