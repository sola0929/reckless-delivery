import * as THREE from 'three';
import { mulberry32 } from '../levels/sandbox';
import type { BuildingLook, PropDesc } from '../levels/types';
import { DARK, SHUTTERS, STEEL, STEEL_TOP, edges, glazing, pick, span, tone, type Lot, type Rand } from './buildingParts';
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

const STYLES = { old: terrace, tower: blocks, shed: sheds };

function shapesOf(desc: PropDesc, look: BuildingLook): Shapes {
  const [hx, hy, hz] = desc.size;
  const shapes = new Shapes();
  STYLES[look.style](shapes, { hx, hz, height: hy * 2, open: look.open, crown: look.crown }, mulberry32(look.seed));
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
