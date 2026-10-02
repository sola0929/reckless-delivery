import type { Vec3 } from '../config';
import type { CargoPlacement } from '../sim/cargo';
import type { ObjectDesc } from './objects';

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

/** A patch of ground with people wandering about on it. */
export interface CrowdDesc {
  /** [minX, minZ, maxX, maxZ] */
  area: [number, number, number, number];
  count: number;
  /** Height of the ground there. */
  y: number;
}

/** A hole dug in the ground. Driving into one ends the run. */
export interface PitDesc {
  pos: Vec2;
  half: Vec2;
  depth: number;
  /** Set when it is full of water: how far below the ground the surface lies. What falls in sinks. */
  water?: number;
}

/** A patch of road with something slippery on it. */
export interface SlickDesc {
  pos: Vec2;
  half: Vec2;
  /** How much of their usual hold the tyres keep there, 0 to 1. */
  grip: number;
}

/** A warning sign beside the road. Drawn large and tilted back, to be read from above. */
export interface SignDesc {
  pos: Vec3;
  /** The way it faces: radians about Y, 0 = toward +Z. */
  rotY: number;
  kind: 'slippery';
}

/** A railway track running along X, with trains passing at a steady interval. */
export interface TrackDesc {
  z: number;
  /** 1 for trains heading toward +X, -1 toward -X. */
  direction: 1 | -1;
  /** m/s. */
  speed: number;
  /** Seconds between one train and the next. */
  period: number;
  /** Where in that interval the track starts out, 0 to 1. */
  phase: number;
  /** The X of the road that crosses it, where the signal watches for trains. */
  watchX: number;
}

/** A signal at a crossing: red while a train is coming on its track, green otherwise. */
export interface SignalDesc {
  /** Where the lamp is; or the middle of the panel, when it is one. */
  pos: Vec3;
  /** Index into the level's tracks. */
  track: number;
  /** Set to make it a panel painted flat on the road, this wide (X) and long (Z), instead of a lamp. */
  panel?: Vec2;
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
  /** Loose things that go flying when hit: trees, lamps, bins, stalls. */
  objects?: ObjectDesc[];
  crowds?: CrowdDesc[];
  pits?: PitDesc[];
  slicks?: SlickDesc[];
  signs?: SignDesc[];
  tracks?: TrackDesc[];
  signals?: SignalDesc[];
  /** The intended way through, as points along the road, for the minimap. */
  route?: Vec2[];
  decals: DecalDesc[];
  cargo: CargoPlacement[];
  traffic: TrafficLane[];
  /**
   * Where the run begins: the clock starts once the middle of the truck has crossed the
   * line through `pos`, going the way of `dir`. Without one it starts at once.
   */
  startLine?: { pos: Vec2; dir: Vec2 };
  /** Where to deliver. Without one the level is free play. */
  finish?: FinishZone;
  /** Multiplies all impact damage to cargo. Below 1 makes the level forgiving; defaults to 1. */
  damageScale?: number;
  /** Share of the load's full value that must arrive to pass with one star (0: arriving at all is enough), and to earn two. */
  stars: [number, number];
  /** The third star: two stars' worth delivered within this many seconds. */
  par: number;
}
