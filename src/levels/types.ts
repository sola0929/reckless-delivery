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
  shape: 'box' | 'cylinder' | 'cone' | 'sphere';
  /** box: half extents. cylinder / cone: [radius, halfHeight, unused]. sphere: [radius, radius, radius]. */
  size: Vec3;
  pos: Vec3;
  /** Euler XYZ, radians. */
  rot?: Vec3;
  color: number;
  /** Drawn with this surface on it, as the cargo of that kind is: a melon's rind. Static props only. */
  texture?: 'melon';
  /** How it holds what rests on it: 0.8 if not given. Steel planks are slippery under a truck's frame. */
  friction?: number;
  /** Dynamic when set, static otherwise. */
  mass?: number;
  /** Turns see-through when it comes between the camera and the truck. */
  fade?: boolean;
  /** Overhead plant the truck drives under: fades whenever it is anywhere near the camera's line to the truck, and further. Implies `fade`. */
  overhead?: boolean;
  /** Drawn but not solid: rooftops, foliage, awnings. */
  ghost?: boolean;
  /** A storey of a building the truck drives up through: hidden while the truck is below it, so that it is seen from above. Implies `fade`. */
  cutaway?: boolean;
  /** A pavement: drawn laid in bricks rather than as a plain slab. Boxes only, unrotated. */
  paving?: boolean;
  /** Drawn as a building, with windows, shopfronts and a roof, rather than as a bare box. */
  building?: BuildingLook;
  /** Where the line from the camera to the truck has to pass for it to fade, corner to corner, in place of round itself: a building's end wall, faded while the truck is at its door. Needs `fade`. */
  fadeZone?: [Vec3, Vec3];
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
  /** Another lane alongside this one, the same length, the same way: this one's vehicles hold back to keep at least `gap`
   * metres behind that one's, never level with them. */
  keepFrom?: { lane: number; gap: number };
  cars: number;
  /** Cruising speed, m/s. */
  speed: number;
  /** What its first few vehicles are, in order. The rest are a mix of cars, taxis, small trucks and buses. */
  kinds?: VehicleKind[];
}

/**
 * Rocks shaken off a conveyor overhead, falling through holes in the net under it: each place a hole is
 * drops a few now and then, after a moment's warning, and each rock breaks on whatever it lands on.
 */
export interface DropperDesc {
  /** Where each hole is: [x, height of the belt, z]. */
  spots: Vec3[];
  /** Seconds between one fall and the next at a hole, at least and at most. */
  every: [number, number];
  /** How many rocks a fall is, at least and at most. */
  burst: [number, number];
  /** Seconds of warning before a fall: the belt judders and grit trickles down. */
  tell: number;
  /** Where the warning lamps over each hole are, from the hole: one either side of the conveyor. */
  lamps?: Vec3[];
}

/**
 * A machine at work beside the road, going through its motions over and over, heavy and with only so much
 * force behind them, so that the truck in their way is struck and shoved as such a weight would shove it.
 *   slew       an excavator swinging its house round, arm out, from digging on one side to tipping on the other
 *   pile       a pile driver: its hammer drawn up, and dropped
 *   clamshell  a crane swinging a grab of mud from one side to the other, low
 *   ball       a demolition ball swinging on its cable
 *   boom       a telescopic boom pushed out across the road and drawn back
 *   sway       a hanging bridge's deck, rocking from side to side as it hangs: `pos` its middle, `yaw` the way it runs
 *   forklift   a forklift going about a floor: round `path` and round again, or (`back`) along it and back; `pos` the floor's
 *              height at the path's start, `period` seconds a round
 */
export interface RigDesc {
  kind: 'slew' | 'pile' | 'clamshell' | 'ball' | 'boom' | 'sway' | 'forklift';
  /** Where it stands: on the ground there. */
  pos: Vec3;
  /** Which way its work lies: radians about Y, 0 = toward +Z. For a slew or a clamshell, the middle of its swing; for a boom, the way it pushes out; for a ball, the way it swings. */
  yaw: number;
  /** Seconds for one round of its work. */
  period: number;
  /** Where in that round it starts, 0 to 1. */
  phase: number;
  /** A hanging bridge's length, metres, end to end. */
  long?: number;
  /** A forklift's way: the corners it drives between, in the world; and whether it goes along them and back rather than round. */
  path?: Vec2[];
  back?: boolean;
}

/** Shallow water running over the road: it holds the truck back, and its current pushes it downstream. */
export interface FordDesc {
  pos: Vec2;
  half: Vec2;
  /** The way the water runs and how fast, m/s: it pushes the truck by how much faster it runs than the truck goes its way. */
  flow: Vec2;
  /** How much it holds the truck back (0 to 1), if not as a ford usually does. */
  drag?: number;
  /** How well the tyres grip on its bed (1 as on dry ground), if not as on dry ground. */
  grip?: number;
  /** How hard the tyres hold against being pushed sideways on its bed, over and above `grip` (1 as on dry ground): less where the water is deep enough to half float the truck. */
  sideGrip?: number;
  /** How high its water stands, where it is drawn with a surface running the way it flows; its bed is wherever the ground is under it. */
  surface?: number;
  /** How far its water pours down over the edge it runs to, where it falls over a ledge. */
  fall?: number;
  /** Over a truck's height: its surface drawn dark, the bed not seen through it. */
  deep?: boolean;
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
  /** Stands where it is put, switched off: a machine parked for the day. */
  parked?: boolean;
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

/**
 * Water lying still, or nearly, over ground that is its own surface: what goes in floats, drifting slowly toward where
 * the water goes out and turning round in front of it there; what is heavy sinks.
 */
export interface StillWaterDesc {
  /** [minX, minZ, maxX, maxZ] */
  area: [number, number, number, number];
  surface: number;
  /** Where its water goes out. */
  outlet: Vec2;
  /** How fast what floats drifts, m/s. */
  drift: number;
  /** Brown with mud: thrown up brown. */
  muddy?: boolean;
}

/** A bird standing about: up and away when the truck comes near or sounds its horn, and down again at another of the birds' places, away from it. */
export interface BirdDesc {
  pos: Vec3;
  yaw: number;
  /** Only a place for one to come down at: none stands there at first. */
  empty?: boolean;
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
  /** What it is: spilt oil, drawn as dark pools (the default); or gravel spilt from a lorry, which the level draws itself. */
  look?: 'oil' | 'gravel';
}

/** A warning sign beside the road. Drawn large and tilted back, to be read from above. */
/**
 * One lesson of the tutorial: a single thing to do, said in a line at the top of the screen when the place for it comes up,
 * and done when it has been done there.
 */
export interface LessonDesc {
  /** The task, keys in <b>…</b>: as said to someone at the keyboard, and to someone holding a controller. */
  keys: string;
  pad: string;
  /** Said under it as well, once the player has been at it a while, or has had to try it again. */
  help: string;
  /** Shown only once the truck is past this Z, going north; until then the line is left empty. */
  from?: number;
  /** A ring on the ground to make for, and the arrow pointing to it. */
  goal?: Vec2;
  /** Done once the truck is past this Z on the ground (or, given `stopBefore`, once it stands still short of that Z while a
   *  crossing's lamps are on); once what was lying in the road is aboard and the driver back at the wheel; or on delivery. */
  done: { pastZ: number; stopBefore?: number } | 'found' | 'delivered';
  /** Where the truck is put back to try again after a mishap here, and the way it then faces (radians about Y, 0 = north). */
  retry: { pos: Vec2; yaw: number };
}

export interface SignDesc {
  pos: Vec3;
  /** The way it faces: radians about Y, 0 = toward +Z. */
  rotY: number;
  /** Slippery road; a way for people on foot only; turn round here; a diversion to the left; straight on to the temple square; a school ahead; works in the road; the name over a quarry's loading shed. */
  kind: 'slippery' | 'pedestrian' | 'uturn' | 'detour' | 'ahead' | 'school' | 'works' | 'schoolName' | 'gasShop' | 'bends' | 'loadOut' | 'safety' | 'pondWorks' | 'pumpStation' | 'floodGate' | 'unload' | 'brokenBridge' | 'freight';
  /** As a prop's: faded while the camera's line to the truck passes through this box. Upright name signs only. */
  fadeZone?: [Vec3, Vec3];
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
  /**
   * Held close to the crossing, out of sight, until the truck comes this close to it, metres; then it comes across. Unset,
   * the trains run from the start, one every period.
   */
  await?: number;
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
  /** Only counted with the truck higher than this: on a roof, not on the floors under it. */
  above?: number;
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
  /** Still water things float on or sink in. */
  stillWater?: StillWaterDesc[];
  /** Concrete just poured, on a floor at a height: it drags at the truck and gives its tyres little hold. */
  wet?: { area: [number, number, number, number]; y: number; drag: number; grip: number }[];
  /** Still water drawn over ponds, for the look of it only: where, how high, its colour, and which way and how fast, m/s, its ripples drift (barely, if not given). */
  pools?: { area: [number, number, number, number]; surface: number; tint: number; flow?: Vec2 }[];
  /** Birds that fly up from the truck. */
  birds?: BirdDesc[];
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
  checkpoints?: { name: string; pos: Vec2; yaw: number; /** The floor to put it down on, where that is not the ground: up a building. */ y?: number }[];
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
  /**
   * A practice run, the tutorial: nothing ends it but the delivery. Down a hole, in the water, over on its roof, hit by a train:
   * the game puts the truck back to try that part again. No stars, no par, no record.
   */
  practice?: boolean;
  /** The tutorial's lessons, one after another: each shown when it is reached, done when its task is. */
  lessons?: LessonDesc[];
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
  /** Conveyors overhead dropping rocks. */
  droppers?: DropperDesc[];
  /** Machines at work in a fixed round. */
  rigs?: RigDesc[];
  /** Water to drive through. */
  fords?: FordDesc[];
}
