import type { Vec3 } from '../config';
import type { CargoPlacement } from '../sim/cargo';

// A level, as plain data shared by the physics and the renderer.

/** A point or extent on the ground: [x, z]. */
export type Vec2 = [number, number];

export interface PropDesc {
  shape: 'box' | 'cylinder' | 'cone';
  /** box: half extents. cylinder / cone: [radius, halfHeight, unused]. */
  size: Vec3;
  pos: Vec3;
  /** Euler XYZ, radians. */
  rot?: Vec3;
  color: number;
  /** Dynamic when set, static otherwise. */
  mass?: number;
  /** Turns see-through when it comes between the camera and the truck. Boxes only, unrotated. */
  fade?: boolean;
  /** Drawn but not solid: rooftops, foliage, awnings. */
  ghost?: boolean;
  /** Colour of its footprint on the minimap. Left off the map when unset. */
  mapColor?: number;
  /** Drawn on the minimap beneath the decals rather than above them: pavements under grass. */
  mapUnder?: boolean;
}

/** A flat painted mark on the ground, with no physics. */
export interface DecalDesc {
  pos: Vec2;
  /** Full width (across X) and length (along Z) before rotation. */
  size: Vec2;
  rotY?: number;
  color: number;
  /** Height to draw it at; defaults to just above the road. */
  y?: number;
  /** Colour on the minimap. Left off the map when unset. */
  mapColor?: number;
}

/** A one-way lane that cars drive along and loop back to the start of. At speed 0 they are parked along it. */
export interface TrafficLane {
  from: Vec2;
  to: Vec2;
  cars: number;
  /** Cruising speed, m/s. */
  speed: number;
}

export interface FinishZone {
  pos: Vec2;
  half: Vec2;
}

export interface LevelDef {
  id: string;
  name: string;
  /** One line shown at the start. */
  brief: string;
  ground: { center: Vec2; half: Vec2; style: 'grid' | 'asphalt' };
  /** The playable area, for the minimap: [minX, minZ] to [maxX, maxZ]. */
  bounds: [Vec2, Vec2];
  spawn: Vec3;
  /** Direction the truck faces at the start: radians about Y, 0 = toward +Z. */
  heading: number;
  props: PropDesc[];
  decals: DecalDesc[];
  cargo: CargoPlacement[];
  traffic: TrafficLane[];
  /** Where to deliver. Without one the level is free play. */
  finish?: FinishZone;
  /** Multiplies all impact damage to cargo. Below 1 makes the level forgiving; defaults to 1. */
  damageScale?: number;
  /** Share of the load's full value that must arrive to pass, and to earn two and three stars. */
  stars: [number, number, number];
}
