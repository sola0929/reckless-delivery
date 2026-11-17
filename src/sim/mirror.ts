import type RAPIER from '@dimforge/rapier3d-compat';
import type { Battle } from './battle';
import type { CargoEvent, CargoItem, Debris } from './cargo';
import type { Clown, Clowns } from './clowns';
import type { Driver, FootInput } from './driver';
import type { Droppers, Hole, Rock } from './droppers';
import type { Machine, Machines } from './machines';
import type { KnockEvent, LandEvent, LooseObject, ObjectSystem } from './objects';
import type { Pedestrian, Pedestrians } from './pedestrians';
import type { Rider, Riders } from './riders';
import type { Rig, RigPart, Rigs } from './rigs';
import type { PropInstance, Sim } from './sim';
import type { Shard, Skylight, Skylights } from './skylights';
import type { Traffic, TrafficCar } from './traffic';
import type { Train, Trains } from './trains';
import type { DriveInput, Truck } from './truck';
import type { WaveState, Waves } from './waves';
import type { GustState, Wind } from './wind';

/**
 * What the game outside the simulation, the drawing and the sound and the HUD, may read of it. The simulation itself
 * satisfies these as it is; a copy of it kept on the main thread, while the simulation runs in a worker, satisfies them too.
 */

/** A body, as it is seen: where it is, how it is turned and moving; never pushed. */
export interface MirrorBody {
  translation(): RAPIER.Vector;
  rotation(): RAPIER.Rotation;
  linvel(): RAPIER.Vector;
  mass(): number;
  isSleeping(): boolean;
  isEnabled(): boolean;
}

/** A thing's bodies, as seen. */
type Swap<V> = V extends RAPIER.RigidBody ? MirrorBody : V;
/** The named fields of a thing, read only, its bodies seen as bodies seen. */
type Mirror<T, K extends keyof T> = { readonly [P in K]: Swap<T[P]> };
/** The same, with some of its fields seen otherwise: what is in them, seen. */
type MirrorWith<T, K extends keyof T, O> = Omit<Mirror<T, K>, keyof O> & O;

export type MirrorObject = Mirror<LooseObject, 'body' | 'cut' | 'desc' | 'kind' | 'knocked' | 'wrecked'>;
export type MirrorPedestrian = Mirror<Pedestrian, 'color' | 'crowd' | 'hat' | 'pos' | 'speed' | 'state' | 'yaw'>;
export type MirrorRider = Mirror<Rider, 'body' | 'down' | 'facing' | 'half' | 'kind' | 'load' | 'person' | 'seated' | 'walking' | 'yaw'>;
export type MirrorClown = Mirror<Clown, 'juggling' | 'person' | 's' | 'speed' | 'state' | 'strain' | 'tumble' | 'wheel' | 'x' | 'yaw' | 'z'>;
export type MirrorMachine = Mirror<Machine, 'body' | 'desc' | 'upper'>;
export type MirrorRigPart = Mirror<RigPart, 'body' | 'shapes'>;
export type MirrorRig = MirrorWith<Rig, 'cable' | 'desc' | 'lamp' | 'parts' | 'pose' | 'warn' | 'was', { readonly parts: readonly MirrorRigPart[] }>;
export type MirrorRock = Mirror<Rock, 'body' | 'falling' | 'half'>;
export type MirrorHole = Mirror<Hole, 'at' | 'lamps' | 'light'>;
export type MirrorSkylight = Mirror<Skylight, 'broken' | 'desc'>;
export type MirrorShard = Mirror<Shard, 'body' | 'half'>;
export type MirrorDebris = Mirror<Debris, 'body' | 'desc'>;
export type MirrorCargoItem = Mirror<CargoItem, 'aboardOnce' | 'attached' | 'body' | 'bonus' | 'fallen' | 'held' | 'knock' | 'lastPos' | 'mass' | 'squeeze' | 'stage' | 'taken' | 'thrown' | 'type' | 'value'>;
export type MirrorTruck = MirrorWith<Truck, 'body' | 'boosting' | 'brakeLevel' | 'controller' | 'forwardSpeed' | 'grip', {
  /** Of its wheels, how each is: on the ground, its spring, steered, turned. */
  readonly controller: Pick<RAPIER.DynamicRayCastVehicleController, 'wheelIsInContact' | 'wheelSuspensionLength' | 'wheelSteering' | 'wheelRotation'>;
}>;
export type MirrorDriver = MirrorWith<Driver, 'airborne' | 'atLeash' | 'charge' | 'held' | 'mode' | 'plan' | 'pos' | 'sinking' | 'speed' | 'tooHeavyLeft' | 'yaw', { readonly held: MirrorCargoItem | null }>;
export type MirrorProp = Mirror<PropInstance, 'body' | 'desc'>;
export type MirrorTrafficCar = Mirror<TrafficCar, 'body' | 'braking' | 'color' | 'kind' | 'knocked' | 'lane' | 's'>;
export type MirrorTrain = Mirror<Train, 'body' | 'track' | 'x' | 'z'>;
export type MirrorWave = Mirror<WaveState, 'desc' | 'front' | 'nextBig' | 'strength' | 'until'>;
export type MirrorGust = Mirror<GustState, 'desc' | 'strength' | 'warned'>;
export type MirrorBattle = Mirror<Battle, 'gunners' | 'launchers' | 'projectiles' | 'rounds' | 'scars' | 'shells' | 'tanks' | 'threat'>;

export type MirrorSim = MirrorWith<Sim, 'backToSave' | 'cargoOnTruck' | 'cargoValue' | 'distanceToFinish' | 'drainArcs' | 'drainBattleSounds' | 'drainBlasts' | 'drainBumps' | 'drainEvents' | 'drainHorns' | 'drainKnocks' | 'drainLandings' | 'drainPedestrianHits' | 'drainPileups' | 'drainRiderHits' | 'drainShots' | 'drainSplashes' | 'drainSpouts' | 'drainStrikes' | 'finishShut' | 'fordAt' | 'fullValue' | 'hasSave' | 'honk' | 'lastHonk' | 'level' | 'props' | 'reset' | 'result' | 'savedAt' | 'started' | 'step' | 'takeMishap' | 'takeSaved' | 'teleport' | 'time' | 'trip' | 'truckWear' | 'wetAt', {
  /** Told the simulation: whether the bay takes the load yet. */
  finishShut: boolean;
  /** Whether the driver, on foot, has something in reach to lift; and is by the cab door. */
  readonly reachable: boolean;
  readonly atDoor: boolean;
  drainEvents(): MirrorCargoEvent[];
  /**
   * With the simulation in a worker: true; and the steps are asked for ahead, each frame, with the controls; taken as they
   * come back while it is ready; and while what it was told to do is still being done, it is busy, and what comes after
   * that waits. Without one, none of this is there: it steps when told and is done at once.
   */
  readonly threaded?: boolean;
  ask?(steps: number, drive: DriveInput, first: FootInput, rest: FootInput): void;
  ready?(): boolean;
  busy?(): boolean;
  stalledFor?(): number;
  after?(then: () => void): void;
  drainKnocks(): MirrorKnockEvent[];
  drainLandings(): MirrorLandEvent[];
  drainRiderHits(): MirrorRider[];
  drainPedestrianHits(): MirrorPedestrian[];
  readonly truck: MirrorTruck;
  readonly props: readonly MirrorProp[];
  readonly driver: MirrorDriver;
  readonly cargo: readonly MirrorCargoItem[];
  readonly objects: Mirror<ObjectSystem, never> & { readonly objects: readonly MirrorObject[] };
  readonly pedestrians: Mirror<Pedestrians, never> & { readonly list: readonly MirrorPedestrian[] };
  readonly riders: Mirror<Riders, never> & { readonly list: readonly MirrorRider[] };
  readonly clowns: Mirror<Clowns, 'time'> & { readonly list: readonly MirrorClown[]; readonly fresh: readonly MirrorClown[]; readonly wobbling: readonly MirrorClown[]; readonly toppled: readonly MirrorClown[] };
  readonly machines: Mirror<Machines, never> & { readonly list: readonly MirrorMachine[] };
  readonly rigs: Mirror<Rigs, 'mud' | 'slams' | 'surges'> & { readonly list: readonly MirrorRig[] };
  readonly droppers: Mirror<Droppers, 'breaks' | 'tells'> & { readonly rocks: readonly MirrorRock[]; readonly holes: readonly MirrorHole[] };
  readonly skylights: Mirror<Skylights, 'breaks'> & { readonly lights: readonly MirrorSkylight[]; readonly shards: readonly MirrorShard[] };
  readonly battle: MirrorBattle;
  readonly traffic: MirrorWith<Traffic, 'cars', { readonly cars: readonly MirrorTrafficCar[] }>;
  readonly trains: MirrorWith<Trains, 'trains' | 'warning', { readonly trains: readonly MirrorTrain[] }>;
  readonly waves: MirrorWith<Waves, 'drainBreaks' | 'list', { readonly list: readonly MirrorWave[] }>;
  readonly wind: MirrorWith<Wind, 'at' | 'list', { readonly list: readonly MirrorGust[] }>;
}>;

/** An event as seen: the things it names, as seen. */
type SeenIn<V> = V extends CargoItem ? MirrorCargoItem : V extends Debris ? MirrorDebris : V extends LooseObject ? MirrorObject : V;
type Seen<E> = E extends unknown ? { readonly [P in keyof E]: SeenIn<E[P]> } : never;
export type MirrorCargoEvent = Seen<CargoEvent>;
export type MirrorKnockEvent = Seen<KnockEvent>;
export type MirrorLandEvent = Seen<LandEvent>;
