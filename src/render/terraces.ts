import {
  CEMENT, DARK, GLASS, LIT, PLANTS, ROOF_FLOORS, STEEL, STEEL_TOP, STONE, TRIMS, WARES,
  airCon, awning, cage, edges, glazing, laundry, pick, pitchedRoof, shopfront, span, tone, waterTower, within,
  type Lot, type Rand,
} from './buildingParts';
import { Shapes, shifted, wallOf, type Plot, type Wall } from './shapes';
import { SIGNS, TRADES, type WideSign } from './signs';

// The old town: terraces of narrow shophouses, each built and added to by its own owner,
// and among them the odd newer house, a block of flats over a big shop, or a temple.

const OLD_WALLS = [0xe3d9c3, 0xd8b9a6, 0xbccdb8, 0xdad9d2, 0xaeaca4, 0xb47a5e, 0xd3ba7f, 0xb9c8d2, 0xc9c2b2];
const FLAT_WALLS = [0xd9cfbb, 0xcaa893, 0xb9bcbd, 0xdfddd5, 0xc4b8a0, 0x9fb0b8];
/** Sheet-metal roofs added on top of the real one. */
const SHEETS = [0x4f8d68, 0xa84e40, 0x4b7aa8, 0xb3bcc2, 0x6fa0a0];
const TILES = [0xa8553c, 0x9a4a38, 0xb8674a];
/** Window grilles. */
const CAGES = [0xe8e8e4, 0x4a5058, 0x5f8f74, 0xb9a070];
const SHOP = 3.7;
const FLOOR = 3.2;
const LINTEL = SHOP - 0.4;
/** How far the ground floor stands back: under an arcade, or just in a porch. */
const ARCADE = 1.6;
const PORCH = 0.5;
/** How far a top floor stands back when it leaves a terrace in front of it. */
const STEP = 2.2;

type Look = 'window' | 'balcony' | 'pair';

export function terrace(s: Shapes, lot: Lot, rand: Rand): void {
  const { hx, hz, open } = lot;
  // The houses stand side by side along whichever street there is, back to back if the lot is deep.
  const alongX = open[2] || open[3] || !(open[0] || open[1]);
  const length = (alongX ? hx : hz) * 2;
  const depth = (alongX ? hz : hx) * 2;
  const count = Math.max(1, Math.round(length / span(rand, 4.6, 5.8)));
  const rows = depth > 21 ? 2 : 1;
  const floors = Math.max(2, Math.round((lot.height - SHOP) / FLOOR) + 1);
  const fronts = alongX ? [2, 3] : [0, 1];
  for (let row = 0; row < rows; row++) {
    const onStreet = rows === 2 ? open[fronts[row]] : open[fronts[0]] || open[fronts[1]];
    let shrine = false;
    for (let i = 0; i < count; ) {
      // Most plots hold one house. Now and then two or three have been built on as one.
      const left = count - i;
      const roll = rand();
      let take = 1;
      let build: 'house' | 'flats' | 'temple' = 'house';
      if (onStreet && left >= 2) {
        if (roll < 0.1) {
          build = 'flats';
          take = left >= 3 && rand() < 0.4 ? 3 : 2;
        } else if (roll < 0.135 && !shrine) {
          build = 'temple';
          take = 2;
          shrine = true;
        }
      }
      const a = (-0.5 + (i + take / 2) / count) * length;
      const c = rows === 1 ? 0 : (row - 0.5) * (depth / 2);
      const ha = (take * length) / count / 2;
      const hc = depth / rows / 2;
      const plot: Plot = alongX ? { cx: a, cz: c, hx: ha, hz: hc } : { cx: c, cz: a, hx: hc, hz: ha };
      const street = edges(plot, lot).map((edge, side) => edge && open[side]);
      const main = rows === 2 ? fronts[row] : street[fronts[1]] && (!street[fronts[0]] || rand() < 0.5) ? fronts[1] : fronts[0];
      const lower = floors > 2 && rand() < 0.35 ? 1 : 0;
      if (build === 'temple' && street[main]) temple(s, rand, plot, street, main, alongX);
      else if (build === 'flats') flats(s, rand, plot, floors, street, fronts, main, take);
      else house(s, rand, plot, floors - lower, street, fronts, main);
      i += take;
    }
  }
}

function house(s: Shapes, rand: Rand, p: Plot, floors: number, street: boolean[], fronts: number[], main: number): void {
  const trade = Math.floor(rand() * TRADES.length);
  const roll = rand();
  if (roll < 0.13) {
    modern(s, rand, p, floors, street, fronts, main, trade);
    return;
  }
  // With an arcade along the street, or with the shop right at the pavement under an awning.
  const arcade = roll > 0.42;
  const body = pick(rand, OLD_WALLS);
  const trim = pick(rand, TRIMS);
  const top = SHOP + (floors - 1) * FLOOR;
  // Bare cement wherever a wall was only ever meant to have a neighbour against it.
  const faces = street.map((on) => (on ? body : CEMENT));
  const frontage = street.map((on, side) => on && fronts.includes(side));
  const recess = frontage.map((on) => (on ? (arcade ? ARCADE : PORCH) : 0));
  s.shell(within(p, recess), 0, LINTEL, faces.map((color, side) => (recess[side] ? tone(body, 0.72) : color)));

  // The top: flat with a parapet; or the top floor stood back behind a terrace; or, on a low old house, tiles.
  const stepped = floors >= 3 && rand() < 0.25;
  const pitched = floors === 2 && rand() < 0.35;
  const floor = pick(rand, ROOF_FLOORS);
  let attic = p;
  if (stepped) {
    attic = within(p, frontage.map((on) => (on ? STEP : 0)));
    s.shell(p, LINTEL, top - FLOOR, faces, floor);
    s.rim(p, top - FLOOR, 0.9, 0.18, faces, CEMENT, trim);
    s.shell(attic, top - FLOOR, top, faces, floor);
    s.rim(attic, top, 0.9, 0.18, faces, CEMENT, trim);
  } else if (pitched) {
    s.shell(p, LINTEL, top, faces);
    const alongX = fronts[0] === 2;
    pitchedRoof(s, p, top, alongX, Math.min((alongX ? p.hz : p.hx) * 0.4, 2), pick(rand, TILES), body);
  } else {
    s.shell(p, LINTEL, top, faces, floor);
    s.rim(p, top, 0.9, 0.18, faces, CEMENT, trim);
  }

  const look = pick<Look>(rand, ['window', 'window', 'balcony', 'balcony', 'pair']);
  const bars = rand() < 0.45 ? pick(rand, CAGES) : null;
  for (let side = 0; side < 4; side++) {
    if (!street[side]) continue;
    const w = wallOf(p, side);
    if (!frontage[side]) {
      flank(s, rand, w, floors, top, trim);
      continue;
    }
    const half = w.half;
    if (arcade) {
      for (const end of [-1, 1]) s.block(w, end * (half - 0.24), LINTEL / 2, -0.24, 0.24, LINTEL / 2, 0.24, body, body, true);
      shopfront(s, rand, shifted(w, -ARCADE), half - 0.55, LINTEL - 0.15, TRADES[trade].front, ARCADE, body);
    } else {
      for (const end of [-1, 1]) s.block(w, end * (half - 0.1), LINTEL / 2, -PORCH / 2, 0.1, LINTEL / 2, PORCH / 2, body, body, true);
      shopfront(s, rand, shifted(w, -PORCH), half - 0.25, LINTEL - 0.15, TRADES[trade].front, PORCH, body);
      if (rand() < 0.8) awning(s, rand, w, -half + 0.2, half - 0.2, LINTEL - 0.05);
    }
    upstairs(s, rand, w, stepped ? shifted(w, -STEP) : null, floors, top, body, trim, look, bars, trade);
    // On the terrace in front of a top floor that stands back: something growing.
    if (stepped) for (let u = -half + 0.6; u < half - 0.5; u += span(rand, 0.9, 1.8)) s.block(w, u, top - FLOOR + 0.3, -0.5, 0.22, 0.3, 0.22, 0x9a6a4a, pick(rand, PLANTS), true);
  }
  if (!pitched) rooftop(s, rand, wallOf(attic, main), (main < 2 ? attic.hx : attic.hz) * 2, top, body);
}

/**
 * The street face of a house above its shop: the shop's sign across the beam, a window or
 * a balcony to each floor, and its other sign out over the pavement. `attic` is the wall of
 * the top floor where that stands back.
 */
function upstairs(s: Shapes, rand: Rand, w: Wall, attic: Wall | null, floors: number, top: number, body: number, trim: number, look: Look, bars: number | null, trade: number): void {
  const half = w.half;
  // Across the beam; or across the front of the balcony, if that is in the way.
  const out = look === 'balcony' ? 1.02 : 0;
  s.block(w, 0, SHOP + 0.2, out + 0.06, half - 0.28, 0.58, 0.06, DARK);
  s.panel(w, -(half - 0.32), SHOP - 0.34, half - 0.32, SHOP + 0.74, out + 0.13, 0xffffff, SIGNS.shop[trade]);

  for (let k = 1; k < floors; k++) {
    const y = SHOP + (k - 1) * FLOOR;
    const on = attic && k === floors - 1 ? attic : w;
    // Nothing hangs where the sign is.
    const clear = k > 1;
    if (k > 1) s.panel(on, -half, y - 0.09, half, y + 0.09, 0.015, trim);
    if (look === 'balcony') balcony(s, rand, on, y, body, trim, bars, clear);
    else if (look === 'pair') for (const side of [-1, 1]) opening(s, rand, on, (side * half) / 2, half / 2 - 0.55, y, trim, bars, clear && side > 0);
    else opening(s, rand, on, 0, half - 0.75, y, trim, bars, clear);
  }
  s.block(attic ?? w, 0, top - 0.1, 0.05, half, 0.1, 0.05, trim);

  // The same shop's sign again, out over the pavement, well above anything that drives under it.
  if (rand() < 0.65) {
    const y0 = SHOP + 1.05;
    const tall = Math.min(top - (attic ? FLOOR : 0) + 0.7 - y0, span(rand, 3, 4.4));
    if (tall > 2.2) s.blade(w, (rand() < 0.5 ? -1 : 1) * (half - 0.1), y0, y0 + tall, 0.1, 0.1 + tall / 4, SIGNS.blade[trade], DARK);
  }
}

/** One window of a house, with its sill or its grille, and perhaps an air conditioner under it. */
function opening(s: Shapes, rand: Rand, w: Wall, u: number, hw: number, y: number, trim: number, bars: number | null, cooled: boolean): void {
  const y0 = y + 1.15;
  const y1 = y + 2.6;
  glazing(s, rand, w, u - hw, y0, u + hw, y1, trim);
  if (hw > 0.9) for (const at of [-hw / 3, hw / 3]) s.panel(w, u + at - 0.03, y0, u + at + 0.03, y1, 0.05, trim);
  if (bars !== null) cage(s, w, u - hw - 0.1, y0 - 0.08, u + hw + 0.1, y1 + 0.08, 0.45, bars);
  else s.block(w, u, y0 - 0.06, 0.07, hw + 0.12, 0.04, 0.07, trim);
  if (cooled && rand() < 0.45) airCon(s, w, u + (rand() < 0.5 ? -1 : 1) * (hw - 0.45), y + 0.3);
}

/** A balcony across the front of a house: glass doors behind it, and whatever its owner keeps on it. */
function balcony(s: Shapes, rand: Rand, w: Wall, y: number, body: number, trim: number, bars: number | null, clear: boolean): void {
  const half = w.half - 0.45;
  const side = tone(body, 0.92);
  glazing(s, rand, w, -half + 0.55, y + 0.12, half - 0.55, y + 2.35, trim);
  s.block(w, 0, y + 0.04, 0.5, half, 0.04, 0.5, 0x8c8a84);
  s.block(w, 0, y + 0.55, 0.95, half, 0.55, 0.06, side, trim, true);
  for (const end of [-1, 1]) s.block(w, end * (half - 0.06), y + 0.55, 0.45, 0.06, 0.55, 0.45, side, trim, true);
  if (bars !== null) {
    // Caged in from the wall to the floor above.
    const count = Math.max(2, Math.round((half * 2) / 0.5));
    for (let i = 0; i <= count; i++) {
      const u = -half + (half * 2 * i) / count;
      s.panel(w, u - 0.03, y + 1.1, u + 0.03, y + 2.85, 1, bars);
    }
    s.block(w, 0, y + 2.85, 0.52, half, 0.035, 0.52, bars, bars, true);
  } else if (rand() < 0.4) laundry(s, rand, w, -half + 0.3, half - 0.3, y + 2.3, 0.72);
  if (rand() < 0.35) {
    const pots = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < pots; i++) s.block(w, span(rand, -half + 0.4, half - 0.4), y + 1.24, 0.95, 0.24, 0.14, 0.13, pick(rand, PLANTS), undefined, true);
  }
  if (clear && rand() < 0.4) airCon(s, shifted(w, 1.01), (rand() < 0.5 ? -1 : 1) * (half - 0.7), y + 0.2);
}

/** The side of a corner house: plain, with a window to each room. */
function flank(s: Shapes, rand: Rand, w: Wall, floors: number, top: number, trim: number): void {
  const count = Math.max(1, Math.floor((w.half * 2 - 1) / 3.4));
  for (let k = 1; k < floors; k++) {
    const y = SHOP + (k - 1) * FLOOR;
    s.panel(w, -w.half, y - 0.09, w.half, y + 0.09, 0.015, trim);
    for (let i = 0; i < count; i++) {
      const u = (-0.5 + (i + 0.5) / count) * w.half * 2;
      glazing(s, rand, w, u - 0.65, y + 1.15, u + 0.65, y + 2.5, trim);
      s.block(w, u, y + 1.09, 0.07, 0.77, 0.04, 0.07, trim);
      if (rand() < 0.3) airCon(s, w, u + 0.2, y + 0.3);
    }
  }
  s.panel(w, -0.5, 0.05, 0.5, 2.15, 0.02, 0x5a4a3c);
  s.block(w, 0, top - 0.1, 0.05, w.half, 0.1, 0.05, trim);
}

/**
 * The roof of a house, as its owner has made use of it: the head of the stairs with the
 * water tank on top, and then a sheet-metal roof over the rest, or plants, washing, an
 * aerial, a solar heater. `w` is the front wall, and everything is placed back from it.
 * A `tidy` roof is one nobody has built on.
 */
function rooftop(s: Shapes, rand: Rand, w: Wall, depth: number, top: number, body: number, tidy = false): void {
  const hu = w.half - 0.3;
  /** How far back from the front the open part of the roof runs. */
  let reach = depth - 0.5;
  if (depth >= 7.5) {
    const u = (rand() < 0.5 ? -1 : 1) * (hu - 1.2);
    const out = -(depth - 1.8);
    s.block(w, u, top + 1.25, out, 1.2, 1.25, 1.5, tone(body, 0.9), 0x8f9296, true);
    s.panel(shifted(w, out + 1.5, u, 1.2), -0.42, top + 0.05, 0.42, top + 2, 0.02, 0x4a4038);
    if (rand() < 0.8) {
      const [x, , z] = s.at(w, u, 0, out);
      waterTower(s, x, top + 2.5, z, span(rand, 0.5, 0.68));
    }
    // A wide roof serves more than one household.
    if (hu > 4) {
      const [x, , z] = s.at(w, -u, 0, out);
      waterTower(s, x, top, z, 0.6);
    }
    reach = depth - 3.6;
  } else if (rand() < 0.7) {
    const [x, , z] = s.at(w, (rand() < 0.5 ? -1 : 1) * (hu - 0.8), 0, -(depth - 1.1));
    waterTower(s, x, top, z, 0.5);
    reach = depth - 2.2;
  }

  if (!tidy && reach > 3 && rand() < 0.55) {
    // Another floor, more or less: a sheet roof sloping to the front, walled in or left open.
    const sheet = pick(rand, SHEETS);
    const d0 = 0.3;
    const d1 = reach * span(rand, 0.6, 1);
    const low = top + 2.25;
    const high = low + (d1 - d0) * 0.16;
    const eave = 0.35;
    s.ribbed(s.at(w, -hu, low - eave * 0.16, -d0 + eave), s.at(w, hu, low - eave * 0.16, -d0 + eave), s.at(w, hu, high, -d1), s.at(w, -hu, high, -d1), sheet);
    if (rand() < 0.55) {
      const side = pick(rand, [0xd9d4c6, 0xc9cfd2, tone(sheet, 1.15)]);
      const front = shifted(w, -d0, 0, hu);
      s.panel(front, -hu, top, hu, low, 0, side);
      glazing(s, rand, front, -hu + 0.7, top + 1, hu - 0.7, top + 1.85, 0xeeeeea);
      s.quad(s.at(w, -hu, top, -d1), s.at(w, -hu, top, -d0), s.at(w, -hu, low, -d0), s.at(w, -hu, high, -d1), side);
      s.quad(s.at(w, hu, top, -d0), s.at(w, hu, top, -d1), s.at(w, hu, high, -d1), s.at(w, hu, low, -d0), side);
      s.quad(s.at(w, hu, top, -d1), s.at(w, -hu, top, -d1), s.at(w, -hu, high, -d1), s.at(w, hu, high, -d1), side);
    } else {
      for (const u of [-hu + 0.1, hu - 0.1]) for (const [d, y] of [[d0, low], [d1, high]]) s.block(w, u, (top + y) / 2, -d, 0.05, (y - top) / 2, 0.05, 0x6a7078, 0x6a7078, true);
    }
    return;
  }
  if (reach < 2) return;

  if (rand() < 0.5) {
    const side = rand() < 0.5 ? -1 : 1;
    const pots = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < pots; i++) {
      const d = 0.6 + ((reach - 1) * (i + rand() * 0.5)) / pots;
      s.block(w, side * (hu - 0.25), top + 0.2, -d, 0.25, 0.2, 0.25, 0x9a6a4a, 0x5a4634, true);
      s.block(w, side * (hu - 0.25), top + 0.62, -d, 0.3, 0.24, 0.3, pick(rand, PLANTS), undefined, true);
    }
  }
  if (hu > 1.4 && rand() < 0.3) {
    // A solar water heater: a panel tilted to the sun, and its tank along the top edge.
    const u = span(rand, -hu + 1.2, hu - 1.2);
    const d = reach * 0.55;
    s.quad(s.at(w, u - 0.8, top + 0.35, -d + 0.8), s.at(w, u + 0.8, top + 0.35, -d + 0.8), s.at(w, u + 0.8, top + 1.2, -d - 0.6), s.at(w, u - 0.8, top + 1.2, -d - 0.6), 0x26384f);
    s.block(w, u, top + 1.35, -d - 0.75, 0.85, 0.2, 0.2, STEEL, STEEL_TOP, true);
  }
  if (rand() < 0.35) {
    const u = (rand() < 0.5 ? -1 : 1) * (hu - 0.5);
    const d = reach - 0.3;
    s.block(w, u, top + 1.5, -d, 0.03, 1.5, 0.03, DARK, DARK, true);
    for (let i = 0; i < 3; i++) s.block(w, u, top + 2.9 - i * 0.35, -d, 0.45 - i * 0.08, 0.02, 0.02, DARK, DARK, true);
  }
  if (rand() < 0.3) {
    const line = shifted(w, -reach * 0.4);
    for (const end of [-1, 1]) s.block(line, end * (hu - 0.5), top + 0.9, 0, 0.03, 0.9, 0.03, DARK, DARK, true);
    laundry(s, rand, line, -hu + 0.5, hu - 0.5, top + 1.8, 0);
  }
}

// ---------------------------------------------------------------------------------------

/**
 * A house built lately, by an architect: glass from wall to wall on every floor, timber
 * screens across half of it, the whole front held in one projecting frame, and a garden
 * on the roof instead of a shed.
 */
function modern(s: Shapes, rand: Rand, p: Plot, floors: number, street: boolean[], fronts: number[], main: number, trade: number): void {
  const body = pick(rand, [0xf0eee8, 0x3c4046, 0xd2cabb]);
  const line = body === 0x3c4046 ? 0xd8d4c8 : 0x2a2e33;
  const wood = pick(rand, [0xb08a62, 0x9a7450]);
  const top = SHOP + (floors - 1) * FLOOR;
  const faces = street.map((on) => (on ? body : CEMENT));
  const frontage = street.map((on, side) => on && fronts.includes(side));
  s.shell(within(p, frontage.map((on) => (on ? PORCH : 0))), 0, LINTEL, faces.map((color, side) => (frontage[side] ? 0x26303a : color)));
  s.shell(p, LINTEL, top, faces, 0xa8a59c);
  s.rim(p, top, 0.5, 0.12, faces, CEMENT, line);

  for (let side = 0; side < 4; side++) {
    if (!street[side]) continue;
    const w = wallOf(p, side);
    if (!frontage[side]) {
      flank(s, rand, w, floors, top, TRIMS[0]);
      continue;
    }
    const half = w.half;
    // The shop: one sheet of glass, the door at one end, the name small beside it.
    const back = shifted(w, -PORCH);
    const door = rand() < 0.5 ? -1 : 1;
    s.panel(back, -half + 0.2, 0.15, half - 0.2, LINTEL - 0.15, 0.03, LIT);
    s.panel(back, door > 0 ? half - 1.4 : -half + 0.2, 0.15, door > 0 ? half - 0.2 : -half + 1.4, LINTEL - 0.15, 0.04, 0x2f4252);
    for (let u = -half + 1.5; u < half - 1.4; u += 1.3) s.panel(back, u - 0.03, 0.15, u + 0.03, LINTEL - 0.15, 0.045, line);
    for (let d = 0.6; d < half * 2 - 2; d += span(rand, 0.6, 0.9)) s.panel(back, -door * (half - d) - 0.2, 0.5, -door * (half - d) + 0.2, 0.5 + span(rand, 0.4, 1), 0.04, pick(rand, WARES));
    for (const end of [-1, 1]) s.block(w, end * (half - 0.08), LINTEL / 2, -PORCH / 2, 0.08, LINTEL / 2, PORCH / 2, body, body, true);
    const wide = Math.min(3.2, half * 2 - 0.9);
    s.panel(w, -door * (half - 0.45) - (door < 0 ? wide : 0), LINTEL + 0.02, -door * (half - 0.45) + (door < 0 ? 0 : wide), LINTEL + 0.02 + wide / 4, 0.05, 0xffffff, SIGNS.shop[trade]);

    // Above: glass, with a timber screen over one half of each floor, turn and turn about.
    for (let k = 1; k < floors; k++) {
      const y = SHOP + (k - 1) * FLOOR;
      s.panel(w, -half + 0.3, y + 0.65, half - 0.3, y + 2.85, 0.03, line);
      s.panel(w, -half + 0.38, y + 0.73, half - 0.38, y + 2.77, 0.04, pick(rand, GLASS));
      for (let u = -half + 1.5; u < half - 1.3; u += 1.3) s.panel(w, u - 0.03, y + 0.73, u + 0.03, y + 2.77, 0.045, line);
      const screen = k % 2 ? 1 : -1;
      for (let u = 0.25; u < half - 0.4; u += 0.3) s.block(w, screen * u, y + 1.75, 0.14, 0.04, 1.15, 0.1, wood);
    }
    for (const end of [-1, 1]) s.block(w, end * (half - 0.09), (SHOP + 0.5 + top) / 2, 0.16, 0.09, (top - SHOP - 0.5) / 2, 0.16, body);
    s.block(w, 0, top - 0.09, 0.16, half, 0.09, 0.16, body);
    s.block(w, 0, SHOP + 0.5, 0.16, half, 0.07, 0.16, body);
  }

  // The roof: decking, beds of green down both sides, a frame for something to climb, and the stair head.
  const w = wallOf(p, main);
  const depth = (main < 2 ? p.hx : p.hz) * 2;
  const hu = w.half - 0.25;
  const reach = Math.min(depth - 0.6, depth * 0.6);
  s.block(w, 0, top + 0.03, -0.3 - reach / 2, hu, 0.03, reach / 2, 0xa9825c, 0xa9825c, true);
  for (const end of [-1, 1]) s.block(w, end * (hu - 0.3), top + 0.28, -0.3 - reach / 2, 0.28, 0.28, reach / 2, 0x7a7670, pick(rand, PLANTS), true);
  if (reach > 3) {
    for (const end of [-1, 1]) for (const d of [0.6, reach - 0.3]) s.block(w, end * (hu - 0.8), top + 1.15, -d, 0.05, 1.15, 0.05, line, line, true);
    for (let d = 0.6; d < reach; d += 0.7) s.block(w, 0, top + 2.34, -d, hu - 0.7, 0.05, 0.06, wood, wood, true);
  }
  if (depth >= 7.5) {
    const u = (rand() < 0.5 ? -1 : 1) * (hu - 1.2);
    s.block(w, u, top + 1.2, -(depth - 1.7), 1.2, 1.2, 1.4, body, 0x8f9296, true);
    // Solar panels on top of it.
    s.quad(s.at(w, u - 1, top + 2.5, -(depth - 2.8)), s.at(w, u + 1, top + 2.5, -(depth - 2.8)), s.at(w, u + 1, top + 3, -(depth - 0.7)), s.at(w, u - 1, top + 3, -(depth - 0.7)), 0x26384f);
  }
}

const STORES: { sign: WideSign; front: 'lit' | 'stone'; shade: boolean }[] = [
  { sign: 'mart', front: 'lit', shade: false },
  { sign: 'mart', front: 'lit', shade: false },
  { sign: 'market', front: 'lit', shade: true },
  { sign: 'clinic', front: 'lit', shade: false },
  { sign: 'telecom', front: 'lit', shade: false },
  { sign: 'bank', front: 'stone', shade: false },
];

/**
 * Two or three plots built on together: a block of flats, every floor alike, over one big
 * shop with a single long sign.
 */
function flats(s: Shapes, rand: Rand, p: Plot, floors: number, street: boolean[], fronts: number[], main: number, bays: number): void {
  const store = pick(rand, STORES);
  const body = pick(rand, FLAT_WALLS);
  const trim = pick(rand, TRIMS);
  const top = SHOP + (floors - 1) * FLOOR;
  const faces = street.map((on) => (on ? body : CEMENT));
  const frontage = street.map((on, side) => on && fronts.includes(side));
  s.shell(within(p, frontage.map((on) => (on ? PORCH : 0))), 0, LINTEL, faces.map((color, side) => (frontage[side] ? (store.front === 'stone' ? STONE : 0x26303a) : color)));
  s.shell(p, LINTEL, top, faces, pick(rand, ROOF_FLOORS));
  s.rim(p, top, 0.9, 0.18, faces, CEMENT, trim);
  const look = pick<Look>(rand, ['window', 'balcony', 'pair']);

  for (let side = 0; side < 4; side++) {
    if (!street[side]) continue;
    const w = wallOf(p, side);
    if (!frontage[side]) {
      flank(s, rand, w, floors, top, trim);
      continue;
    }
    const half = w.half;
    const back = shifted(w, -PORCH);
    const head = LINTEL - 0.15;
    for (const end of [-1, 1]) s.block(w, end * (half - 0.15), LINTEL / 2, -PORCH / 2, 0.15, LINTEL / 2, PORCH / 2, body, body, true);
    if (store.front === 'stone') {
      // A bank: stone, tall narrow windows, bronze doors, and a cash machine glowing at one end.
      for (let u = -half + 1.4; u < half - 1; u += 1.9) if (Math.abs(u) > 1.6) s.panel(back, u - 0.45, 0.8, u + 0.45, head - 0.3, 0.03, 0x25313d);
      s.panel(back, -1.2, 0, 1.2, head - 0.2, 0.03, 0x8a6a3a);
      s.panel(back, -0.03, 0, 0.03, head - 0.2, 0.04, 0x5a4424);
      s.panel(back, half - 1.3, 0.9, half - 0.5, 1.9, 0.03, LIT);
    } else {
      // Glass from end to end, sliding doors in the middle, and shelves of things inside.
      s.panel(back, -half + 0.3, 0, half - 0.3, 0.35, 0.03, trim);
      s.panel(back, -half + 0.3, 0.35, half - 0.3, head, 0.03, LIT);
      s.panel(back, -1, 0, 1, head - 0.3, 0.04, 0x3a5468);
      s.panel(back, -0.03, 0, 0.03, head - 0.3, 0.05, 0xd8d4c8);
      for (let u = -half + 0.5; u < half - 0.8; u += 0.5) {
        if (Math.abs(u + 0.2) < 1.3) continue;
        for (const y of [0.6, 1.35]) s.panel(back, u, y, u + 0.38, y + span(rand, 0.3, 0.6), 0.04, pick(rand, WARES));
      }
      for (let u = -half + 0.3; u < half; u += 1.6) if (Math.abs(u) > 1.1) s.panel(back, u - 0.03, 0.35, u + 0.03, head, 0.045, DARK);
      if (store.shade) awning(s, rand, w, -half + 0.3, half - 0.3, LINTEL - 0.05, 1.3);
    }
    // The sign, with its colour carried on to both ends of the building.
    const reach = Math.min(half - 0.3, 4.4);
    s.block(w, 0, SHOP + 0.2, 0.08, half - 0.12, 0.56, 0.08, SIGNS.wideGround[store.sign]);
    s.panel(w, -reach, SHOP + 0.2 - reach / 8, reach, SHOP + 0.2 + reach / 8, 0.17, 0xffffff, SIGNS.wide[store.sign][0]);

    // Above: every bay and every floor the same.
    const width = (half * 2) / bays;
    for (let k = 1; k < floors; k++) {
      const y = SHOP + (k - 1) * FLOOR;
      if (k > 1) s.panel(w, -half, y - 0.09, half, y + 0.09, 0.015, trim);
      for (let i = 0; i < bays; i++) {
        const bay = shifted(w, 0, -half + (i + 0.5) * width, width / 2);
        if (look === 'balcony' && k > 1) balcony(s, rand, bay, y, body, trim, null, true);
        else if (look === 'pair') for (const end of [-1, 1]) opening(s, rand, bay, (end * width) / 4, width / 4 - 0.55, y, trim, null, k > 1 && end > 0);
        else opening(s, rand, bay, 0, width / 2 - 0.75, y, trim, null, k > 1);
      }
    }
    for (let i = 1; i < bays; i++) s.block(w, -half + i * width, (SHOP + 0.9 + top) / 2, 0.06, 0.14, (top - SHOP - 0.9) / 2, 0.06, trim);
    s.block(w, 0, top - 0.1, 0.05, half, 0.1, 0.05, trim);
  }
  rooftop(s, rand, wallOf(p, main), (main < 2 ? p.hx : p.hz) * 2, top, body, true);
}

const RED = 0xb8362a;
const GOLD = 0xd8a838;
const JADE = 0x2f7a5a;

/**
 * A temple among the houses: a porch of red and carved-stone columns, three pairs of doors,
 * lanterns, a burner for incense, and a sweeping roof of orange tiles with its ends turned up.
 */
function temple(s: Shapes, rand: Rand, p: Plot, street: boolean[], main: number, alongX: boolean): void {
  const w = wallOf(p, main);
  const half = w.half;
  const reach = main < 2 ? p.hx : p.hz;
  const base = 0.35;
  const wall = 4.2;
  const stone = 0xbdb7aa;
  s.shell(p, 0, base, stone, stone);
  const porch = [0, 0, 0, 0];
  porch[main] = ARCADE;
  s.shell(within(p, porch), base, wall, street.map((on, side) => (side === main ? RED : on ? 0xe8e2d4 : CEMENT)));

  // The beam across the porch, and the columns under it: stone in the middle, red at the ends.
  s.block(w, 0, wall - 0.3, -0.2, half, 0.3, 0.2, JADE, JADE, true);
  s.panel(w, -half, wall - 0.66, half, wall - 0.58, 0.01, GOLD);
  const inner = half * 0.36;
  for (const u of [-(half - 0.35), -inner, inner, half - 0.35]) {
    const [x, , z] = s.at(w, u, 0, -0.3);
    s.box(x, base + 0.12, z, 0.3, 0.12, 0.3, stone);
    s.cylinder(x, base + 0.24, z, 0.2, wall - 0.84 - base, Math.abs(u) < half * 0.5 ? 0x9a968c : RED, undefined, 8);
  }
  // Doors: the middle pair the grandest.
  const back = shifted(w, -ARCADE);
  for (const [u, hw] of [[0, 0.95], [-half * 0.66, 0.6], [half * 0.66, 0.6]]) {
    s.panel(back, u - hw - 0.12, base, u + hw + 0.12, base + 2.75, 0.02, GOLD);
    s.panel(back, u - hw, base, u + hw, base + 2.63, 0.04, 0x6f1c18);
    s.panel(back, u - 0.025, base, u + 0.025, base + 2.63, 0.05, GOLD);
  }
  for (const u of [-half * 0.34, half * 0.34]) s.panel(back, u - 0.4, base + 1.2, u + 0.4, base + 2.2, 0.03, JADE);
  // Its name, hung under the beam; lanterns either side; lions at the door; the burner out front.
  s.block(w, 0, wall - 1.2, -0.12, 1.4, 0.4, 0.05, 0x5a1612, 0x5a1612, true);
  s.panel(w, -1.34, wall - 1.54, 1.34, wall - 0.86, -0.06, 0xffffff, SIGNS.temple);
  for (const u of [-(inner + half - 0.35) / 2, (inner + half - 0.35) / 2]) {
    const [x, , z] = s.at(w, u, 0, -0.3);
    s.cylinder(x, wall - 1.5, z, 0.22, 0.46, 0xd0302a, GOLD, 8);
    s.cylinder(x, wall - 1.04, z, 0.03, 0.44, DARK, DARK, 4);
  }
  for (const u of [-(inner - 0.75), inner - 0.75]) {
    const [x, , z] = s.at(w, u, 0, -0.22);
    s.box(x, base + 0.14, z, 0.26, 0.14, 0.3, stone);
    s.box(x, base + 0.5, z, 0.2, 0.22, 0.24, 0x9a968c);
  }
  const [bx, , bz] = s.at(w, 0, 0, -0.75);
  s.cylinder(bx, base, bz, 0.34, 0.6, 0x5a4a32, 0xb8b0a0, 8);
  s.cylinder(bx, base + 0.6, bz, 0.42, 0.1, GOLD, 0xb8b0a0, 8);

  // The roof: shallow at the eaves, steeper toward the ridge, as these are.
  const tile = pick(rand, [0xd9772e, 0xc9642a]);
  const rise = Math.min(reach * 0.5, 2.4);
  const over = 0.5;
  const knee = 0.55;
  for (const side of alongX ? [2, 3] : [0, 1]) {
    const face = wallOf(p, side);
    const low = (u: number) => s.at(face, u, wall - 0.1, over);
    const mid = (u: number) => s.at(face, u, wall + rise * 0.4, -reach * knee);
    const high = (u: number) => s.at(face, u, wall + rise, -reach);
    const edge = face.half + 0.2;
    s.ribbed(low(-edge), low(edge), mid(edge), mid(-edge), tile, 1.1);
    s.ribbed(mid(-edge), mid(edge), high(edge), high(-edge), tile, 1.1);
  }
  for (const side of alongX ? [0, 1] : [2, 3]) {
    const end = wallOf(p, side);
    const k = end.half * (1 - knee);
    s.quad(s.at(end, -end.half, wall, 0), s.at(end, end.half, wall, 0), s.at(end, k, wall + rise * 0.4, 0), s.at(end, -k, wall + rise * 0.4, 0), 0xe8e2d4);
    s.tri(s.at(end, -k, wall + rise * 0.4, 0), s.at(end, k, wall + rise * 0.4, 0), s.at(end, 0, wall + rise, 0), 0xe8e2d4);
  }
  // The ridge, turned up at both ends, with a pearl in the middle of it.
  const ridge = wall + rise;
  s.block(w, 0, ridge + 0.12, -reach, half + 0.2, 0.16, 0.14, JADE, GOLD, true);
  for (const end of [-1, 1]) {
    s.block(w, end * (half - 0.3), ridge + 0.42, -reach, 0.34, 0.14, 0.12, JADE, GOLD, true);
    s.block(w, end * (half + 0.02), ridge + 0.74, -reach, 0.18, 0.2, 0.1, GOLD, GOLD, true);
  }
  const [rx, , rz] = s.at(w, 0, 0, -reach);
  s.cylinder(rx, ridge + 0.28, rz, 0.24, 0.3, GOLD, GOLD, 8);
  s.cone(rx, ridge + 0.58, rz, 0.2, 0.34, 0xd0302a, 8);
}
