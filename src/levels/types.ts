import type { TerrainDesc } from './terrain';
import type { Vec3 } from '../config';
import type { CargoPlacement } from '../sim/cargo';
import type { VehicleKind } from '../sim/vehicles';
import type { ObjectDesc, ObjectKindId } from './objects';

// A level, as plain data shared by the physics and the renderer.

/** A point or extent on the ground: [x, z]. */
export type Vec2 = [number, number];

/** How a building is drawn. What is solid of it is still its plain box. */
export interface BuildingLook {
  /** Terraced shophouses, downtown blocks, or sheet-metal sheds. */
  style: 'old' | 'tower' | 'shed';
  /** Which sides face a street rather than a neighbour's wall: -X, +X, -Z, +Z. */
  open: [boolean, boolean, boolean, boolean];
  /** Height of the plant room on a tall building's roof; 0 for none. */
  crown: number;
  /** Everything about it that is left to chance follows from this. */
  seed: number;
}

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
  /** A pavement: drawn laid in bricks rather than as a plain slab. Boxes only, unrotated. */
  paving?: boolean;
  /** Drawn as a building, with windows, shopfronts and a roof, rather than as a bare box. */
  building?: BuildingLook;
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
  /** How high the ground under it is, where the ground is not at nought; and how it slopes there, as rise over run toward +X and toward +Z. */
  base?: number;
  tilt?: Vec2;
  /** Colour on the minimap. Left off the map when unset. */
  mapColor?: number;
}

/** A one-way lane that cars drive along and loop back to the start of. At speed 0 they are parked along it. */
export interface TrafficLane {
  from: Vec2;
  to: Vec2;
  /** Where along it its first vehicle (a bus) pulls in, metres from the start, and for how long; and which of the level's crowds waits there to get on. */
  stops?: { at: number; seconds: number; crowd?: number }[];
  /** The lane its vehicles carry on along when they get to its end, by its place in the level's list: turning into a side street, out of one. Without one they start again from its beginning. */
  next?: number;
  /** Where along that next lane a car joins it, metres from its start: a side street meeting it part way. */
  nextAt?: number;
  /** A second lane to carry on along: every other vehicle takes it instead of `next`, from its start. */
  also?: number;
  /** Set to start its vehicles at places along it chosen afresh each time the level is made, rather than evenly. */
  scatter?: boolean;
  /** The lane a car of this one that has been knocked out of the traffic goes back into, at its start (out of sight, behind a wall). Without one it goes back where it was. */
  respawn?: number;
  /** For its first vehicle: it stands where it starts until the truck comes within this far. */
  waitFor?: number;
  cars: number;
  /** Cruising speed, m/s. */
  speed: number;
  /** What its first few vehicles are, in order. The rest are a mix of cars, taxis, small trucks and buses. */
  kinds?: VehicleKind[];
}

/** A patch of ground with people wandering about on it. */
export interface CrowdDesc {
  /** [minX, minZ, maxX, maxZ] */
  area: [number, number, number, number];
  count: number;
  /** Height of the ground there. */
  y: number;
  /** Soldiers of one army or the other: in its colour, and a helmet. Run one down and that army's tanks nearby take notice. */
  army?: 0 | 1;
  /**
   * Soldiers who charge, in waves: every so many seconds the lot of them come up at one end
   * of the patch, its low-X end or its high, and run for the other. None gets there: one by
   * one they are shot down on the way, and are gone. Then the next wave. `phase` is how many
   * seconds into the cycle the wave comes; `falls` is between what shares of the way across
   * they go down, when it is not anywhere from a fifth to four fifths.
   */
  charge?: { every: number; from: 'low' | 'high'; phase?: number; falls?: [number, number] };
  /** People at work: in a hard hat and an orange vest. */
  workers?: boolean;
  /** Dancers: in rows across the patch, facing this way (radians about Y), in step; they do not get out of anyone's way until they are knocked down, and then go back to their places. */
  dance?: number;
  /** What those standing in place do, if not dance: crouch at a fire, feeding it paper. */
  motion?: 'toss' | 'carry' | 'cook' | 'perform';
  /** What they wear, if not everyday clothes: colours to choose from, and a hat. */
  clothes?: number[];
  hat?: number;
  /** How far above the ground they stand: on a stage. */
  raised?: number;
  /** Walled in: whatever happens, they stay on their patch, and are not chased or thrown through its edges. */
  fenced?: boolean;
  /** Set for people who go after a vehicle of this kind, wherever it goes: those with their rubbish, after the refuse lorry. */
  follows?: VehicleKind;
  /**
   * Set where the patch lies across a road, to the axis the road is crossed along. People
   * there go from one end of it to the other and back, and stop only at the ends, on the
   * pavements; traffic waits for them while they are in the road.
   */
  crossing?: 'x' | 'z';
  /** At a crossing: they go over together, a wave every so many seconds, as children let out of school are seen across; not waiting for a gap, for the traffic is stopped for them. */
  waves?: number;
  /** How big they are beside a grown-up: children. */
  size?: number;
}

/** One of a quarry's big machines, and the yard it goes about in: [x0, z0, x1, z1]. */
export interface MachineDesc {
  kind: 'dumper' | 'loader' | 'excavator';
  pos: Vec2;
  /** Which way it faces at first: radians about Y, 0 = toward +Z. */
  yaw: number;
  area: [number, number, number, number];
}

/**
 * A stretch of road that scooters ride along in a swarm, one way. They keep within a band
 * to either side of the line, weaving through whatever else is on it.
 */
export interface RiderLane {
  from: Vec2;
  to: Vec2;
  /** What is going along it: scooters, ridden; or a god's sedan chair, carried by four. */
  kind?: 'scooter' | 'palanquin' | 'movers';
  /** For movers: what the two of them are carrying between them. */
  load?: ObjectKindId;
  /** How far across the road they may be: metres to the left of the line, as they ride, at each edge of the band. To the right is negative. */
  band: Vec2;
  /**
   * How far across they will go to get past something in their way, if further than the band: over the centre line, between
   * a bus and what is coming the other way. Set, they also edge across at a walk when stuck behind something.
   */
  reach?: Vec2;
  riders: number;
  /** At the end of it they turn round into this other lane, by its place in the list. Without one they start again from the beginning. */
  turnInto?: number;
}

/** A line across the top of a hill from which things are let go, one after another, to roll down it. */
export interface RollerDesc {
  /** The two ends of the line. */
  from: Vec2;
  to: Vec2;
  /** Which way is down the hill, as a direction on the map. */
  down: Vec2;
  /** What is let go, in turn. Round things, which are laid on their sides. */
  kinds: ObjectKindId[];
  /** Seconds between one and the next. */
  every: number;
  /** How fast each sets off, m/s, and how far down the hill it gets before it is taken away. */
  speed: number;
  run: number;
  /** For trying things out: left to roll with nothing keeping them straight; and made with their edges sharp. */
  free?: boolean;
  sharp?: boolean;
  /** Let go only while the truck is within this many metres of the hill they come down (anywhere along their run), rather than anywhere near the line they start from. */
  within?: number;
}

/** A hole dug in the ground. Driving into one ends the run. */
export interface PitDesc {
  pos: Vec2;
  half: Vec2;
  depth: number;
  /** How high the ground it is dug in is, where that is not at nought: for where its water lies. */
  base?: number;
  /** Set when it is full of water: how far below the ground the surface lies. What falls in sinks. */
  water?: number;
}

/** A patch of road with something slippery on it. */
export interface SlickDesc {
  pos: Vec2;
  half: Vec2;
  /** How high the road it lies on is, where that is not at nought. */
  y?: number;
  /** How much of their usual hold the tyres keep there, 0 to 1. */
  grip: number;
}

/** A warning sign beside the road. Drawn large and tilted back, to be read from above. */
export interface SignDesc {
  pos: Vec3;
  /** The way it faces: radians about Y, 0 = toward +Z. */
  rotY: number;
  /** Slippery road; a way for people on foot only; turn round here; a diversion to the left; straight on to the temple square; a school ahead; works in the road. */
  kind: 'slippery' | 'pedestrian' | 'uturn' | 'detour' | 'ahead' | 'school' | 'works' | 'schoolName' | 'gasShop' | 'bends';
}

/** A railway track running along X, with trains passing at a steady interval. */
export interface TrackDesc {
  z: number;
  /** How high the ground it is laid on is, where that is not at nought. */
  y?: number;
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

/** The arm of a level-crossing gate: down across the road while its track's signal is red, up otherwise. Driven through, it snaps. */
export interface GateDesc {
  /** Where it is hinged. */
  pos: Vec3;
  /** The way it reaches when down: 1 toward +X, -1 toward -X. */
  reach: 1 | -1;
  length: number;
  /** Index into the level's tracks. */
  track: number;
}

/** A stretch of ground that is being shelled while the truck is on it. */
export interface ShellZone {
  /** [minX, minZ, maxX, maxZ] */
  area: [number, number, number, number];
  /** Seconds between one shell and the next, about. */
  every: number;
}

/**
 * A soldier with a machine gun, behind a length of concrete that nothing knocks down, firing
 * across the road at the other army: now a long burst, now the odd round, now nothing while
 * he reloads. He is not aiming at the truck; whatever of it is in the way is hit, and a
 * round goes through the load. Anything solid stops one, so a wreck is something to be behind.
 */
export interface GunnerDesc {
  pos: Vec2;
  /** The way he fires: radians about Y, 0 = toward +Z. */
  aim: number;
  side: 0 | 1;
  /** How far his rounds carry, metres, when it is further than across a road. */
  reach?: number;
}

/** A soldier with a rocket launcher: locks on to the truck while it is in sight and in range, then fires straight. */
export interface LauncherDesc {
  pos: Vec3;
  range: number;
  side: 0 | 1;
}

/**
 * A tank, standing where it is, shelling the other army a long way off. It takes no notice
 * of the truck unless the truck runs down one of its own army's soldiers nearby.
 */
export interface TankDesc {
  pos: Vec2;
  /** The way it faces: radians about Y, 0 = toward +Z. */
  rotY: number;
  side: 0 | 1;
  /** Which way its gun points while it has only the other army to shoot at: radians about Y, in the world. The way the tank faces, if unset. */
  gun?: number;
}

/** A patch of the road that holds the truck back: mud, which is also slippery, or barbed wire, which is worse. */
export interface PatchDesc {
  pos: Vec2;
  half: Vec2;
  kind: 'mud' | 'wire';
}

/** A bank of smoke: inside it, nothing can be seen but what is close by. */
export interface SmokeDesc {
  pos: Vec2;
  radius: number;
}

/** A bank of earth from one point to another: too steep and too high to drive over. */
export interface BankDesc {
  from: Vec2;
  to: Vec2;
  height: number;
}

/** A mound of thrown-up earth: low enough to drive over, and it tips whatever does. */
export interface MoundDesc {
  pos: Vec2;
  radius: number;
  height: number;
}

/** A shell hole, as it is seen: the ring of earth thrown up round it. The hole itself is one of the level's pits, this far from its middle to its sides. */
export interface CraterDesc {
  pos: Vec2;
  radius: number;
}

/** What is left of a tank or a lorry: it does not move, and it stops a bullet. */
export interface WreckDesc {
  kind: 'tank' | 'truck';
  pos: Vec2;
  rotY: number;
}

/** Everything about a level that is a battle. */
export interface BattleDesc {
  banks?: BankDesc[];
  mounds?: MoundDesc[];
  craters?: CraterDesc[];
  wrecks?: WreckDesc[];
  shelling?: ShellZone[];
  gunners?: GunnerDesc[];
  launchers?: LauncherDesc[];
  tanks?: TankDesc[];
  patches?: PatchDesc[];
  smoke?: SmokeDesc[];
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
  ground: { center: Vec2; half: Vec2; style: 'grid' | 'asphalt' | 'earth' };
  /** Ground that rises and falls, in place of the flat. A level without it is level, at nought, as it always was. */
  terrain?: TerrainDesc;
  /** Kinds of ground, by the names the terrain gives them, that there is no driving out of: water, say. A truck that is on one is done for, as it is in a pit. */
  sinks?: string[];
  /** Ground there is no driving out of: a paddy, a canal. Each is [minX, minZ, maxX, maxZ]. A truck that is in one is done for, as it is in a pit. */
  bogs?: [number, number, number, number][];
  /** The time of day, when it is not the middle of it. */
  light?: 'dusk';
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
  gates?: GateDesc[];
  /** The intended way through, as points along the road, for the minimap. */
  route?: Vec2[];
  decals: DecalDesc[];
  cargo: CargoPlacement[];
  traffic: TrafficLane[];
  riders?: RiderLane[];
  /** Big machines going about a yard as they please. */
  machines?: MachineDesc[];
  /** Rice spread out on tarps to dry, [x, z] middle and half size: whatever wheels go over it throw it up. Only seen, not felt. */
  spreads?: { pos: Vec2; half: Vec2 }[];
  /** Traffic, scooters and people further than this from the truck, metres, stand still until it comes nearer: on a level too big to see across. */
  quietBeyond?: number;
  /** For testing: places just before each part of the level, to put the truck down at, by number key. */
  checkpoints?: { name: string; pos: Vec2; yaw: number }[];
  battle?: BattleDesc;
  /** Where water plays: the top of each fountain's jet. */
  fountains?: Vec3[];
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
  /** Things playing music, by their place in `objects`: notes rise from each until it is knocked over. */
  music?: number[];
  /** Places people do not walk into: a stage, a temple. */
  keepOut?: [number, number, number, number][];
  /** Things with a fire in them, by their place in `objects`: it glows and throws up sparks until it is knocked over. */
  fires?: number[];
  /**
   * Manholes over a burst main, by the place of each cover in `objects`: once the truck is near, each in turn, every so many
   * seconds, throws up a column of water; the first time, it throws its cover up with it.
   */
  manholes?: { cover: number; every: number; phase: number }[];
  /** Places a column of black smoke rises from all the time: a wreck burning. */
  smokes?: Vec3[];
  /** Whether the truck runs away down a hill when it is left without its handbrake on. */
  rollback?: boolean;
  /** Places things are let go from, to roll down a hill. */
  rollers?: RollerDesc[];
}
