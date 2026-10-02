import * as THREE from 'three';
import { CLEARANCE, VEHICLES, type VehicleKind } from '../sim/vehicles';
import { Shapes } from './shapes';

// What the traffic looks like: each vehicle one mesh in flat colours, on wheels, with its
// lamps and its glass. They all share a material; the colours are in the corners.

const GLASS = 0x1b2a3a;
const TYRE = 0x17181a;
const HUB = 0xc8ccd0;
const DARK = 0x2a2e34;
const LAMP = 0xfff2c0;
const TAIL = 0xd0302a;
const AMBER = 0xffb030;

const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.15 });

/** Four wheels, at so far out from the middle and so far fore and aft of it. */
function wheels(s: Shapes, out: number, fore: number, aft: number, radius: number): void {
  for (const x of [-out, out]) for (const z of [fore, aft]) s.wheel(x, radius, z, radius, 0.13, TYRE, HUB);
}

/** Lamps at both ends, and bumpers under them. */
function ends(s: Shapes, width: number, length: number, y: number): void {
  for (const x of [-width * 0.68, width * 0.68]) {
    s.box(x, y, length + 0.01, width * 0.2, 0.08, 0.03, LAMP);
    s.box(x, y, -length - 0.01, width * 0.2, 0.08, 0.03, TAIL);
  }
  for (const z of [length + 0.04, -length - 0.04]) s.box(0, y - 0.28, z, width, 0.09, 0.06, DARK);
}

function car(s: Shapes, color: number, taxi: boolean): void {
  wheels(s, 0.8, 1.3, -1.3, 0.33);
  s.box(0, 0.56, 0, 0.9, 0.3, 2.1, color);
  // The cabin: glass all round, pillars at the corners, a roof in the body's colour.
  s.box(0, 1.1, -0.2, 0.8, 0.26, 1.05, GLASS);
  for (const x of [-0.78, 0.78]) for (const z of [0.82, -1.22]) s.box(x, 1.1, z, 0.05, 0.26, 0.05, color);
  s.box(0, 1.39, -0.2, 0.82, 0.04, 1.07, color);
  ends(s, 0.9, 2.1, 0.62);
  if (taxi) s.box(0, 1.5, -0.2, 0.26, 0.08, 0.11, 0xf2efe6);
}

function pickup(s: Shapes, color: number): void {
  wheels(s, 0.82, 1.4, -1.35, 0.34);
  s.box(0, 0.5, 0, 0.9, 0.22, 2.2, DARK);
  // The cab.
  s.box(0, 1.05, 1.42, 0.88, 0.45, 0.72, color);
  s.box(0, 1.22, 2.15, 0.76, 0.24, 0.02, GLASS);
  for (const x of [-0.89, 0.89]) s.box(x, 1.22, 1.5, 0.02, 0.22, 0.42, GLASS);
  // The bed: a floor, boards round it, and whatever is being carried.
  s.box(0, 0.76, -0.75, 0.9, 0.05, 1.42, 0x8a8f96);
  for (const x of [-0.87, 0.87]) s.box(x, 0.98, -0.75, 0.04, 0.2, 1.42, color);
  s.box(0, 0.98, -2.15, 0.9, 0.2, 0.04, color);
  s.box(-0.3, 1.05, -0.4, 0.4, 0.26, 0.45, 0xb98a55);
  s.box(0.35, 0.98, -1.35, 0.42, 0.2, 0.5, 0x4f8d68);
  ends(s, 0.9, 2.2, 0.66);
}

function bus(s: Shapes, color: number): void {
  wheels(s, 1.12, 3.3, -3.2, 0.5);
  const stripe = 0xf2efe6;
  s.box(0, 1.75, 0, 1.25, 1.3, 5.2, color);
  s.box(0, 1.25, 0, 1.26, 0.12, 5.21, stripe);
  // Windows down both sides and across the front, and the destination over them.
  for (const x of [-1.26, 1.26]) s.box(x, 2.3, -0.2, 0.02, 0.42, 4.6, GLASS);
  s.box(0, 2.15, 5.21, 1.1, 0.6, 0.02, GLASS);
  s.box(0, 2.9, 5.21, 0.8, 0.12, 0.02, AMBER);
  s.box(0, 2.2, -5.21, 0.9, 0.4, 0.02, GLASS);
  // Doors on the kerb side, and the cooler on the roof.
  for (const z of [3.7, -1.2]) s.box(-1.27, 1.5, z, 0.02, 0.95, 0.55, 0x4a5058);
  s.box(0, 3.15, -1, 0.9, 0.12, 1.6, 0xd8dcde);
  ends(s, 1.25, 5.2, 0.9);
}

function garbage(s: Shapes): void {
  const yellow = 0xf2c12e;
  wheels(s, 1.08, 2.2, -1.6, 0.5);
  s.box(0, 0.75, 0, 1.1, 0.2, 3.3, DARK);
  // The cab, the body the rubbish is pressed into, and the hopper it is thrown in at.
  s.box(0, 1.65, 2.4, 1.15, 0.75, 0.88, yellow);
  s.box(0, 1.95, 3.29, 1, 0.35, 0.02, GLASS);
  for (const x of [-1.16, 1.16]) s.box(x, 1.95, 2.5, 0.02, 0.3, 0.5, GLASS);
  s.box(0, 1.95, -0.25, 1.2, 1.05, 1.75, 0xf2efe6);
  s.box(0, 1.6, -0.25, 1.21, 0.14, 1.76, yellow);
  s.box(0, 1.55, -2.65, 1.2, 0.8, 0.65, 0x4a5058);
  s.box(0, 1.0, -3.2, 1.1, 0.3, 0.12, yellow);
  // Its lamp, turning.
  s.box(0, 2.48, 2.4, 0.16, 0.08, 0.16, AMBER);
  ends(s, 1.2, 3.3, 1.05);
}

const BUSES = [0x3f8f5f, 0x2f6fb0, 0xd06a2a, 0xb33a3a];

/** One vehicle of the traffic, drawn about the middle of its body, which is where the physics has it. */
export function vehicleMesh(kind: VehicleKind, color: number, n: number): THREE.Mesh {
  const shapes = new Shapes();
  if (kind === 'taxi') car(shapes, 0xf2c12e, true);
  else if (kind === 'pickup') pickup(shapes, 0x2f62a8);
  else if (kind === 'bus') bus(shapes, BUSES[n % BUSES.length]);
  else if (kind === 'garbage') garbage(shapes);
  else car(shapes, color, false);
  const geometry = shapes.geometry();
  // Drawn standing on the road; the body's middle is that much above it.
  geometry.translate(0, -(CLEARANCE + VEHICLES[kind].half.height), 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
