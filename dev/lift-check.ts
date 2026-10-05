// Laying a flat level on ground with height in it: a small made-up level over a terrace, a slope
// to the east and a slope to the north, and whether its ground, its pavement and its markings all
// end up at the height the ground is said to have. npx tsx dev/lift-check.ts
import { Euler, Vector3 } from 'three';
import { Heights, lift } from '../src/levels/lift';
import { heightAt } from '../src/levels/terrain';
import type { LevelDef } from '../src/levels/types';

let failures = 0;
const check = (name: string, ok: boolean, detail: string) => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`); };

// A terrace 6 m up on the west, a slope up to the east beside it, and north of both a slope up to the north.
const heights = new Heights(16, [0, 0])
  .level([-32, 0, 0, 32], 6)
  .ramp([0, 0, 32, 32], 'x', 0, 4)
  .ramp([-32, 32, 32, 64], 'z', 2, 7);
const THICK = 0.15;
const flat = {
  id: 'made-up', name: '', brief: '',
  ground: { center: [0, 0], half: [64, 64], style: 'asphalt' },
  bounds: [[-64, -64], [64, 96]],
  spawn: [40, 0.9, -40], heading: 0,
  props: [
    // A pavement across the terrace, the slope to the east and the flat beyond; and one up the slope to the north.
    { shape: 'box', size: [28, THICK, 6], pos: [12, THICK, 16], color: 0x999999, paving: true },
    { shape: 'box', size: [5, THICK, 30], pos: [10, THICK, 40], color: 0x999999, paving: true },
    // A block of houses on the slope to the east.
    { shape: 'box', size: [14, 5, 6], pos: [16, 5, 8], color: 0xcccccc, building: { style: 'old', open: [false, false, true, false], crown: 0, seed: 1 } },
  ],
  objects: [], decals: [
    { pos: [12, 16], size: [56, 4], color: 0xffffff },
    { pos: [10, 40], size: [30, 2], rotY: Math.PI / 2, color: 0xffffff },
  ],
  pits: [{ pos: [16, 48], half: [6, 6], depth: 2 }],
  cargo: [], traffic: [], stars: [0, 0.6], par: 60,
} as unknown as LevelDef;
const level = lift(flat, heights, { ground: { tag: 'road', color: 0x5b626b, wall: 0x70757c }, pit: { tag: 'pit', color: 0x4a3a2a, wall: 0x4a3a2a }, footing: 0x8d8a84 });
const g = (x: number, z: number) => heights.at(x, z);

// The ground itself.
let worst = 0, tried = 0;
for (let n = 0; n < 2000; n++) {
  const x = -60 + ((n * 7919) % 1200) / 10, z = -60 + ((n * 104729) % 1500) / 10;
  if (Math.abs(x - 16) < 6.2 && Math.abs(z - 48) < 6.2) continue;
  tried++;
  worst = Math.max(worst, Math.abs(heightAt(level.terrain, x, z) - g(x, z)));
}
check('the ground is as high as it was said to be', worst < 0.01, `${tried} places, most out by ${(worst * 100).toFixed(1)} cm`);
check('the pit is dug in the slope', Math.abs(heightAt(level.terrain, 16, 48) - (g(16, 48) - 2)) < 0.01, `floor at ${heightAt(level.terrain, 16, 48).toFixed(2)}, ground there ${g(16, 48).toFixed(2)}`);

// The pavement: the top of every piece of it, at its corners and middle, against the ground under it.
const euler = new Euler();
const spot = new Vector3();
let out = 0, pieces = 0;
for (const p of level.props.filter((q) => q.paving)) {
  pieces++;
  for (const [a, b] of [[0, 0], [-0.98, -0.98], [0.98, -0.98], [0.98, 0.98], [-0.98, 0.98]]) {
    spot.set(a * p.size[0], p.size[1], b * p.size[2]);
    if (p.rot) spot.applyEuler(euler.set(...p.rot));
    out = Math.max(out, Math.abs(p.pos[1] + spot.y - (g(p.pos[0] + spot.x, p.pos[2] + spot.z) + 2 * THICK)));
  }
}
check('the pavement lies along the ground', out < 0.03 && pieces > 4, `${pieces} pieces, top most out by ${(out * 100).toFixed(1)} cm`);

// The markings: each piece's corners.
let off = 0;
for (const d of level.decals) {
  const [sx, sz] = d.tilt ?? [0, 0];
  const turned = Math.abs(Math.sin(d.rotY ?? 0)) > 0.5;
  const [ex, ez] = turned ? [d.size[1] / 2, d.size[0] / 2] : [d.size[0] / 2, d.size[1] / 2];
  for (const [a, b] of [[-0.98, -0.98], [0.98, -0.98], [0.98, 0.98], [-0.98, 0.98]]) off = Math.max(off, Math.abs(d.base! + sx * a * ex + sz * b * ez - g(d.pos[0] + a * ex, d.pos[1] + b * ez)));
}
check('the markings lie along the ground', off < 0.01 && level.decals.length > 4, `${level.decals.length} pieces, most out by ${(off * 100).toFixed(1)} cm`);

// The houses: in lengths, each floor at the ground under its middle, none hanging.
const houses = level.props.filter((p) => p.building);
const floors = houses.map((p) => p.pos[1] - p.size[1] - g(p.pos[0], p.pos[2]));
check('the block of houses steps up the slope', houses.length === 2 && floors.every((f) => Math.abs(f) < 0.01) && level.props.filter((p) => !p.building && !p.paving).length === 2, `${houses.length} lengths, floors ${houses.map((p) => (p.pos[1] - p.size[1]).toFixed(2)).join(' and ')}, ${level.props.filter((p) => !p.building && !p.paving).length} footings`);

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
