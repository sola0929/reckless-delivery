import * as THREE from 'three';
import { mulberry32 } from '../levels/sandbox';
import type { BuildingLook, PropDesc } from '../levels/types';
import { CEMENT, DARK, SHUTTERS, STEEL, STEEL_TOP, airCon, cage, edges, glazing, laundry, tapeWindows, pick, pitchedRoof, span, tone, waterTower, type Lot, type Rand } from './buildingParts';
import { Shapes, wallOf, type Plot, type Wall } from './shapes';
import { SIGNS, signSheet } from './signs';
import { terrace } from './terraces';
import { blocks } from './towers';

// What a building looks like, worked out from the box that is solid of it: a terrace of
// shophouses, a downtown block or a row of sheds, each split into houses or towers of its
// own, with shopfronts on the sides that face a street and a roof worth looking down on.
// All of it is flat colour, and none of it is solid: the box still is.

const SHED_WALLS = [0x7f8e98, 0x5f8c72, 0x8f5f4a, 0xcfc9b4, 0x52769a, 0x9aa39a];
const SHED_ROOFS = [0xb7bfc5, 0x9aa4ab, 0x7fa08a, 0xa4584a, 0x6f8fae];

// ---------------------------------------------------------------------------------------
// Sheds: sheet metal on a concrete footing, a ridge down the middle of each, doors to the street.

function sheds(s: Shapes, lot: Lot, rand: Rand): void {
  // The ridges run the long way, and the sheds stand side by side across it.
  const alongX = lot.hx >= lot.hz;
  const cross = (alongX ? lot.hz : lot.hx) * 2;
  const count = Math.max(1, Math.round(cross / 15));
  for (let i = 0; i < count; i++) {
    const c = (-0.5 + (i + 0.5) / count) * cross;
    const plot: Plot = alongX ? { cx: 0, cz: c, hx: lot.hx, hz: cross / count / 2 } : { cx: c, cz: 0, hx: cross / count / 2, hz: lot.hz };
    const street = edges(plot, lot).map((edge, side) => edge && lot.open[side]);
    shed(s, rand, plot, alongX, lot.height * span(rand, 0.88, 1), street);
  }
}

function shed(s: Shapes, rand: Rand, p: Plot, alongX: boolean, height: number, street: boolean[]): void {
  const sheet = pick(rand, SHED_WALLS);
  const roof = pick(rand, SHED_ROOFS);
  const reach = alongX ? p.hz : p.hx;
  const rise = Math.min(reach * 0.2, 1.6);
  const eave = height - rise;
  const footing = 1;
  s.shell(p, 0, footing, 0x8b8f92);

  for (const side of alongX ? [2, 3] : [0, 1]) {
    const w = wallOf(p, side);
    s.ribbed(s.at(w, -w.half, footing, 0), s.at(w, w.half, footing, 0), s.at(w, w.half, eave, 0), s.at(w, -w.half, eave, 0), sheet);
    // This side of the roof, from a little beyond the wall up to the ridge.
    const over = 0.45;
    const drop = (rise / reach) * over;
    s.ribbed(s.at(w, -w.half - 0.3, eave - drop, over), s.at(w, w.half + 0.3, eave - drop, over), s.at(w, w.half + 0.3, height, -reach), s.at(w, -w.half - 0.3, height, -reach), roof);
    // Rooflights.
    const lights = Math.floor((w.half * 2) / 7);
    for (let i = 0; i < lights; i++) {
      const u = (-0.5 + (i + 0.5) / lights) * w.half * 2;
      const on = (t: number, du: number) => s.at(w, u + du, eave + rise * t + 0.05, -reach * t);
      s.quad(on(0.2, -0.7), on(0.2, 0.7), on(0.8, 0.7), on(0.8, -0.7), 0xd3e2e8);
    }
    for (const end of [-1, 1]) s.block(w, end * (w.half - 0.15), eave / 2, 0.07, 0.07, eave / 2, 0.07, DARK);
    if (!street[side]) continue;

    const doors = Math.max(1, Math.round((w.half * 2) / 10));
    const bay = (w.half * 2) / doors;
    for (let i = 0; i < doors; i++) {
      const u = (-0.5 + (i + 0.5) / doors) * w.half * 2;
      loadingDoor(s, rand, w, u, eave);
      if (bay < 9) continue;
      // Beside each: a way in for people, and a window for the office.
      s.panel(w, u - 3.9, 0.05, u - 2.9, 2.15, 0.03, 0x3f6f8f);
      glazing(s, rand, w, u + 2.9, 1.6, u + 4.1, 2.7, 0xeeeeea);
    }
  }

  for (const side of alongX ? [0, 1] : [2, 3]) {
    const w = wallOf(p, side);
    s.ribbed(s.at(w, -w.half, footing, 0), s.at(w, w.half, footing, 0), s.at(w, w.half, eave, 0), s.at(w, -w.half, eave, 0), sheet);
    s.tri(s.at(w, -w.half, eave, 0), s.at(w, w.half, eave, 0), s.at(w, 0, height, 0), sheet);
    if (!street[side] || w.half < 3.2) continue;
    const top = loadingDoor(s, rand, w, 0, eave);
    // The firm's name over the door.
    s.block(w, 0, top + 1.15, 0.04, 2.5, 0.65, 0.04, DARK);
    s.panel(w, -2.4, top + 0.55, 2.4, top + 1.75, 0.09, 0xffffff, pick(rand, SIGNS.depot));
  }

  // Along the ridge: a capping, and ventilators turning in the wind.
  const w = wallOf(p, alongX ? 3 : 1);
  s.block(w, 0, height + 0.06, -reach, w.half + 0.3, 0.08, 0.28, tone(roof, 0.85), undefined, true);
  const vents = Math.floor((w.half * 2) / 6);
  for (let i = 0; i < vents; i++) {
    const [x, , z] = s.at(w, (-0.5 + (i + 0.5) / vents) * w.half * 2, 0, -reach);
    s.cylinder(x, height + 0.1, z, 0.2, 0.3, STEEL, STEEL, 6);
    s.cylinder(x, height + 0.4, z, 0.42, 0.34, STEEL, STEEL_TOP, 8);
    s.cone(x, height + 0.74, z, 0.42, 0.2, STEEL_TOP, 8);
  }
}

/** A roller door big enough for a truck, with or without a canopy over it. Returns the height of its head. */
function loadingDoor(s: Shapes, rand: Rand, w: Wall, u: number, eave: number): number {
  const half = Math.min(2.1, w.half - 0.6);
  const top = Math.min(eave - 0.7, 4.3);
  s.block(w, u, top / 2 + 0.1, 0.05, half + 0.2, top / 2 + 0.1, 0.05, 0x4f555c);
  s.shutter(w, u - half, 0.05, u + half, top, 0.11, pick(rand, SHUTTERS));
  if (rand() < 0.5) s.block(w, u, top + 0.5, 0.8, half + 0.5, 0.05, 0.8, pick(rand, [0xd0a030, 0xb7bfc5, 0x4f8d68]), undefined, true);
  return top + 0.2;
}

// ---------------------------------------------------------------------------------------
// A rooftop addition, as on half the flat roofs here: a room of sheet metal on a cement curb, its sheet roof sloping to
// the front, aluminium windows behind iron grilles, a door, an air conditioner; on its roof a water tank, and against
// the storm old tyres and bricks laid on the sheet. Its front, and whichever other sides are open, have the windows.

const ADD_WALLS = [0x9fb3c0, 0xe2e0d6, 0x8fa596, 0xc9b98f, 0x7f97ab, 0xb7bcc0];
const ADD_ROOFS = [0x4b7aa8, 0x4f8d68, 0xa84e40, 0xb3bcc2, 0x6fa0a0, 0x8a6a4a];
const GRILLES = [0xe8e6e0, 0x6f8f7a, 0x4a5058, 0xd8c8a0];

function addition(s: Shapes, lot: Lot, rand: Rand): void {
  const p: Plot = { cx: 0, cz: 0, hx: lot.hx, hz: lot.hz };
  const sheet = pick(rand, ADD_WALLS), roof = pick(rand, ADD_ROOFS), grille = pick(rand, GRILLES);
  // Low at the front, the first open side; high at the back.
  const front = Math.max(0, lot.open.findIndex(Boolean));
  const deep = front < 2 ? lot.hx * 2 : lot.hz * 2;
  const rise = Math.min(0.6, deep * 0.06), low = lot.height - rise, curb = 0.45;
  /** How high its walls stand at a place: up the slope from the front. */
  const topAt = (x: number, z: number) => {
    const t = front === 0 ? (x + lot.hx) / deep : front === 1 ? (lot.hx - x) / deep : front === 2 ? (z + lot.hz) / deep : (lot.hz - z) / deep;
    return low + rise * Math.max(0, Math.min(1, t));
  };
  let door = false, cooled = false;
  for (let side = 0; side < 4; side++) {
    const w = wallOf(p, side);
    const a = s.at(w, -w.half, 0, 0), b = s.at(w, w.half, 0, 0);
    s.quad(a, b, s.at(w, w.half, curb, 0), s.at(w, -w.half, curb, 0), CEMENT);
    s.ribbed(s.at(w, -w.half, curb, 0), s.at(w, w.half, curb, 0), s.at(w, w.half, topAt(b[0], b[2]), 0), s.at(w, -w.half, topAt(a[0], a[2]), 0), sheet, 1.2);
    if (!lot.open[side]) continue;
    const bays = Math.max(1, Math.floor((w.half * 2) / 3.1));
    for (let i = 0; i < bays; i++) {
      const u = (-0.5 + (i + 0.5) / bays) * w.half * 2;
      if (!door && i === 0 && w.half > 1.6) {
        s.panel(w, u - 0.45, 0.02, u + 0.45, 2.05, 0.03, pick(rand, [0x8a9aa4, 0x6f5a48, 0xc8ccd0]));
        s.panel(w, u - 0.3, 1.2, u + 0.3, 1.8, 0.035, pick(rand, [0x2d3f52, 0x364c61]));
        door = true;
        continue;
      }
      glazing(s, rand, w, u - 0.65, 1.0, u + 0.65, 1.85, 0xd8dcde);
      cage(s, w, u - 0.72, 0.95, u + 0.72, 1.92, 0.12, grille);
      if (!cooled && rand() < 0.6) {
        airCon(s, w, u + 1.25 > w.half - 0.5 ? u - 1.25 : u + 1.25, 1.55);
        cooled = true;
      }
    }
    if (rand() < 0.45) laundry(s, rand, w, -w.half + 0.4, Math.min(w.half - 0.4, -w.half + 3.2), Math.min(low, 2.2) - 0.05, 0.45);
  }
  // The roof: the sheet from a little out over the front up to the back, ribbed; along its edges, what holds it down.
  const fw = wallOf(p, front);
  const over = 0.3, drop = (rise / deep) * over;
  s.ribbed(s.at(fw, -fw.half - 0.2, low - drop, over), s.at(fw, fw.half + 0.2, low - drop, over), s.at(fw, fw.half + 0.2, lot.height + 0.02, -deep - 0.2), s.at(fw, -fw.half - 0.2, lot.height + 0.02, -deep - 0.2), roof, 1.2);
  const onRoof = (u: number, d: number) => { const [x, , z] = s.at(fw, u, 0, -d); return { x, z, y: topAt(x, z) + 0.05 }; };
  for (let i = 0; i < 2 + Math.floor(rand() * 3); i++) {
    const at = onRoof(span(rand, -fw.half + 0.6, fw.half - 0.6), span(rand, 0.5, deep - 0.5));
    if (rand() < 0.55) s.cylinder(at.x, at.y, at.z, 0.36, 0.2, 0x1f2124, 0x2a2c30, 8);
    else s.box(at.x, at.y + 0.06, at.z, 0.2, 0.06, 0.1, 0x9a5a44);
  }
  if (rand() < 0.6 && deep > 3 && fw.half > 1.6) {
    const at = onRoof(fw.half - 1, deep - 1);
    waterTower(s, at.x, at.y, at.z, 0.5);
  }
}

// ---------------------------------------------------------------------------------------
// A big hall's roof seen from on top of it: gables of sheet side by side, their ridges the long way (along Z), each end
// closed by its triangle of sheet, a box gutter down each valley between. Only the roof: the box is its height from its
// eaves to its ridges.

const GABLE_SHEETS = [0x8e989c, 0x9aa4a8, 0x939da1];

function gables(s: Shapes, lot: Lot, rand: Rand): void {
  const n = Math.max(1, Math.round((lot.hx * 2) / 12)), wide = (lot.hx * 2) / n;
  for (let i = 0; i < n; i++) {
    const p: Plot = { cx: -lot.hx + wide * (i + 0.5), cz: 0, hx: wide / 2, hz: lot.hz };
    const sheet = pick(rand, GABLE_SHEETS);
    const cuts = (lot.cuts ?? []).filter(([x0, , x1]) => x1 > p.cx - p.hx && x0 < p.cx + p.hx);
    if (cuts.length) cutGable(s, p, lot.height, sheet, tone(sheet, 0.86), cuts);
    else pitchedRoof(s, p, 0, false, lot.height, sheet, tone(sheet, 0.86), 0);
    if (i > 0) s.box(-lot.hx + wide * i, 0.02, 0, 0.22, 0.03, lot.hz, 0x4a5056);
  }
}

/** A gable as pitchedRoof draws one, ridge along Z, its slopes' sheet left out where its skylights are. */
function cutGable(s: Shapes, p: Plot, rise: number, color: number, gable: number, cuts: [number, number, number, number][]): void {
  for (const side of [-1, 1]) {
    const foot = p.cx + side * p.hx;
    const at = (f: number, z: number): [number, number, number] => [foot + (p.cx - foot) * f, rise * f, z];
    const sheet = (f0: number, f1: number, z0: number, z1: number) => {
      if (f1 - f0 < 0.005 || z1 - z0 < 0.005) return;
      const a = at(f0, z0), b = at(f0, z1), c = at(f1, z1), d = at(f1, z0);
      // Faced up: the way round its corners that makes it so.
      const up = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]);
      if (up > 0) s.ribbed(a, b, c, d, color, 1.4);
      else s.ribbed(b, a, d, c, color, 1.4);
    };
    const holes = cuts
      .map(([x0, z0, x1, z1]) => {
        const fa = (x0 - foot) / (p.cx - foot), fb = (x1 - foot) / (p.cx - foot);
        return [Math.max(0, Math.min(fa, fb)), Math.min(1, Math.max(fa, fb)), z0, z1];
      })
      .filter(([f0, f1]) => f1 > f0 + 0.01)
      .sort((h, k) => h[2] - k[2]);
    let z = -p.hz;
    for (const [f0, f1, z0, z1] of holes) {
      sheet(0, 1, z, z0);
      sheet(0, f0, z0, z1);
      sheet(f1, 1, z0, z1);
      z = z1;
    }
    sheet(0, 1, z, p.hz);
  }
  for (const side of [2, 3]) {
    const w = wallOf(p, side);
    s.tri(s.at(w, -w.half, 0, 0), s.at(w, w.half, 0, 0), s.at(w, 0, rise, 0), gable);
  }
  // Its capping, but where a rooflight is over the ridge: that has its own.
  const over = cuts.filter(([x0, , x1]) => x0 < p.cx + 0.01 && x1 > p.cx - 0.01).map(([, z0, , z1]) => [z0, z1]).sort((a, b) => a[0] - b[0]);
  let z = -p.hz - 0.15;
  for (const [z0, z1] of [...over, [p.hz + 0.15, p.hz + 0.15]]) {
    if (z0 > z) s.box(p.cx, rise + 0.04, (z + z0) / 2, 0.17, 0.09, (z0 - z) / 2, tone(color, 0.8));
    z = Math.max(z, z1);
  }
}

const STYLES = { old: terrace, tower: blocks, shed: sheds, addition, gables };

function shapesOf(desc: PropDesc, look: BuildingLook): Shapes {
  const [hx, hy, hz] = desc.size;
  const shapes = new Shapes();
  tapeWindows(!!look.taped);
  STYLES[look.style](shapes, { hx, hz, height: hy * 2, open: look.open, crown: look.crown, low: look.low, cuts: look.cuts, front: look.front }, mulberry32(look.seed));
  tapeWindows(false);
  return shapes;
}

/**
 * The places outside a building where it wants something loose stood, in the world: for
 * now, the gas outside each eating house. Worked out the same way the building is drawn,
 * so the two agree; it needs nothing of the screen, and so can be asked for by the level.
 */
export function buildingMarks(desc: PropDesc, look: BuildingLook): { kind: 'eatery'; x: number; z: number }[] {
  return shapesOf(desc, look).marks.map((mark) => ({ kind: mark.kind, x: mark.x + desc.pos[0], z: mark.z + desc.pos[2] }));
}

/** A building drawn in full, in place of the box that is solid of it. */
export function buildingMesh(desc: PropDesc, look: BuildingLook): THREE.Mesh {
  const hy = desc.size[1];
  const shapes = shapesOf(desc, look);
  // A material to each building, so that each can fade on its own; the sheet of signs is shared.
  // Shadows are cast by the faces turned to the sun rather than, as is usual, those turned away:
  // much of this is open underneath or a single sheet, with nothing turned away to cast one.
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, map: signSheet(), roughness: 0.85, shadowSide: THREE.FrontSide });
  const mesh = new THREE.Mesh(shapes.geometry(), material);
  mesh.position.set(desc.pos[0], desc.pos[1] - hy, desc.pos[2]);
  if (desc.rot) mesh.rotation.set(...desc.rot);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
