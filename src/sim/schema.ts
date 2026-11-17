import type { Sim } from './sim';

/**
 * What of the simulation is copied out of it, step by step, for the game to see on the main thread while the simulation
 * runs in a worker: each kind of thing, where its kind is listed, and the fields of it that are read, each with how it
 * goes across. The recorder reads these off the simulation; the replica on the other side writes them into its copies.
 *
 *   n  a number (or null)          b  true or false              s  a string
 *   v  a vector, kept as a THREE.Vector3 on the far side          a  a short list of numbers or flags
 *   j  plain data: sent whole whenever it changes                  body  a body, by its number in the table of bodies
 *   ref:kind  one of the things of that kind, by its number      refs:kind  a list of them
 *   cargoType, objectKind  one of the kinds in the game's own lists, by its name (read off as that name)
 *   lane  one of the traffic's lanes, by its number
 */
/** 'o': plain data, sent as 'j' is, but told to have changed only by being another thing: one of the level's own descriptions, swapped for another. */
export type Codec = 'n' | 'b' | 's' | 'v' | 'a' | 'j' | 'o' | 'body' | 'cargoType' | 'objectKind' | 'lane' | `ref:${KindName}` | `refs:${KindName}`;

export interface FieldSpec {
  name: string;
  codec: Codec;
  /** Set once, when the thing is first seen: never looked at again. */
  once?: boolean;
  /** How it is read off the thing, when it is not simply the field of that name. */
  get?: (thing: never, sim: Sim) => unknown;
}

export type KindName =
  | 'sim' | 'truck' | 'driver' | 'cargo' | 'debris' | 'object' | 'pedestrian' | 'rider' | 'clown' | 'machine'
  | 'rig' | 'rigPart' | 'rock' | 'hole' | 'skylight' | 'shard' | 'prop' | 'car' | 'train' | 'wave' | 'gust';

export interface KindSpec {
  /** Where the things of this kind are, in the simulation. */
  list: (sim: Sim) => readonly object[];
  fields: FieldSpec[];
}

const f = (name: string, codec: Codec, more: Partial<FieldSpec> = {}): FieldSpec => ({ name, codec, ...more });
const once = (name: string, codec: Codec, more: Partial<FieldSpec> = {}): FieldSpec => f(name, codec, { once: true, ...more });
/** Read with a function of the thing, which TypeScript is told the type of here. */
const read = <T>(get: (thing: T, sim: Sim) => unknown) => get as FieldSpec['get'];

export const KINDS: Record<KindName, KindSpec> = {
  sim: {
    list: (sim) => [sim],
    fields: [
      f('time', 'n'), f('started', 'b'), f('truckWear', 'n'), f('lastHonk', 'n'),
      f('hasSave', 'b'), f('savedAt', 'n'), f('result', 'j'), once('fullValue', 'n'),
      f('onTruck', 'n', { get: read<Sim>((s) => s.cargoOnTruck()) }),
      f('cargoWorth', 'n', { get: read<Sim>((s) => s.cargoValue()) }),
      f('tripSoFar', 'j', { get: read<Sim>((s) => s.trip()) }),
      f('toFinish', 'n', { get: read<Sim>((s) => s.distanceToFinish()) }),
      // Only worked out on foot, empty-handed, where the game shows them: driving, each step would go through the load for nothing.
      f('reachable', 'b', { get: read<Sim>((s) => s.driver.mode === 'onFoot' && !s.driver.held && s.reachable) }),
      f('atDoor', 'b', { get: read<Sim>((s) => s.driver.mode === 'onFoot' && s.atDoor) }),
      f('clownTime', 'n', { get: read<Sim>((s) => s.clowns.time) }),
      f('warnings', 'a', { get: read<Sim>((s) => (s.level.tracks ?? []).map((_, i) => s.trains.warning(i))) }),
    ],
  },
  truck: {
    list: (sim) => [sim.truck],
    fields: [
      once('body', 'body'), f('boosting', 'b'), f('brakeLevel', 'n'), f('grip', 'n'),
      f('forward', 'n', { get: read<Sim['truck']>((t) => t.forwardSpeed()) }),
      // Each wheel: on the ground or not, how far its spring is out, how it is steered, how far round it has turned.
      f('wheels', 'a', {
        get: read<Sim['truck']>((t) => {
          const out: number[] = [];
          for (let i = 0; i < 4; i++) out.push(t.controller.wheelIsInContact(i) ? 1 : 0, t.controller.wheelSuspensionLength(i) ?? 0, t.controller.wheelSteering(i) ?? 0, t.controller.wheelRotation(i) ?? 0);
          return out;
        }),
      }),
    ],
  },
  driver: {
    list: (sim) => [sim.driver],
    fields: [
      f('mode', 's'), f('pos', 'v'), f('yaw', 'n'), f('speed', 'n'), f('held', 'ref:cargo'), f('charge', 'n'), f('plan', 'j'),
      f('airborne', 'b'), f('tooHeavyLeft', 'n'), f('atLeash', 'b'), f('sinking', 'n'),
    ],
  },
  cargo: {
    list: (sim) => sim.cargo,
    fields: [
      once('type', 'cargoType', { get: read<Sim['cargo'][number]>((item) => item.type.id) }), once('mass', 'n'), f('bonus', 'b'), f('attached', 'a'), f('body', 'body'), f('stage', 'n'),
      f('fallen', 'b'), f('held', 'b'), f('thrown', 'b'), f('taken', 'b'), f('aboardOnce', 'b'),
      f('knock', 'n'), f('squeeze', 'n'), f('lastPos', 'v'), f('value', 'n'),
    ],
  },
  debris: {
    list: (sim) => sim.cargoSystem.debris,
    fields: [once('desc', 'j'), once('body', 'body')],
  },
  object: {
    list: (sim) => sim.objects.objects,
    fields: [once('desc', 'j'), once('kind', 'objectKind', { get: read<Sim['objects']['objects'][number]>((o) => o.desc.kind) }), once('body', 'body'), f('knocked', 'b'), f('wrecked', 'b'), f('cut', 'n')],
  },
  pedestrian: {
    list: (sim) => sim.pedestrians.list,
    fields: [f('crowd', 'o'), f('color', 'n'), f('hat', 'n'), f('pos', 'v'), f('speed', 'n'), f('state', 's'), f('yaw', 'n')],
  },
  rider: {
    list: (sim) => sim.riders.list,
    fields: [
      once('half', 'j'), once('kind', 's'), once('load', 's'), once('body', 'body'), f('down', 'n'), f('facing', 'n'),
      f('person', 'v'), f('seated', 'b'), f('walking', 'b'), f('yaw', 'n'),
    ],
  },
  clown: {
    list: (sim) => sim.clowns.list,
    fields: [
      f('juggling', 'b'), f('person', 'v'), f('s', 'n'), f('speed', 'n'), f('state', 's'), f('strain', 'n'), f('tumble', 'n'),
      f('wheel', 'v'), f('x', 'n'), f('yaw', 'n'), f('z', 'n'),
    ],
  },
  machine: {
    list: (sim) => sim.machines.list,
    fields: [once('desc', 'j'), once('body', 'body'), once('upper', 'body')],
  },
  rig: {
    list: (sim) => sim.rigs.list,
    fields: [once('desc', 'j'), once('lamp', 'j'), f('parts', 'refs:rigPart'), f('cable', 'j'), f('pose', 'j'), f('was', 'j'), f('warn', 'b')],
  },
  rigPart: {
    list: (sim) => sim.rigs.list.flatMap((rig) => rig.parts),
    fields: [once('shapes', 'j'), once('body', 'body')],
  },
  rock: {
    list: (sim) => sim.droppers.rocks,
    fields: [once('half', 'j'), once('body', 'body'), f('falling', 'b')],
  },
  hole: {
    list: (sim) => sim.droppers.holes,
    fields: [once('at', 'j'), once('lamps', 'j'), f('light', 's')],
  },
  skylight: {
    list: (sim) => sim.skylights.lights,
    fields: [once('desc', 'j'), f('broken', 'b')],
  },
  shard: {
    list: (sim) => sim.skylights.shards,
    fields: [once('half', 'j'), once('body', 'body')],
  },
  prop: {
    list: (sim) => sim.props,
    fields: [once('desc', 'j'), once('body', 'body')],
  },
  car: {
    list: (sim) => sim.traffic.cars,
    fields: [once('body', 'body'), f('braking', 'b'), f('color', 'n'), f('kind', 's'), f('knocked', 'n'), f('lane', 'lane'), f('s', 'n')],
  },
  train: {
    list: (sim) => sim.trains.trains,
    fields: [once('body', 'body'), f('track', 'n'), f('x', 'n'), f('z', 'n')],
  },
  wave: {
    list: (sim) => sim.waves.list,
    fields: [once('desc', 'j'), f('front', 'n'), f('nextBig', 'b'), f('strength', 'n'), f('until', 'n')],
  },
  gust: {
    list: (sim) => sim.wind.list,
    fields: [once('desc', 'j'), f('strength', 'n'), f('warned', 'b')],
  },
};

export const KIND_NAMES = Object.keys(KINDS) as KindName[];

/** A body's row in a step's table of moved bodies: its number, where it is, how it is turned, how fast it goes, its mass, flags. */
export const POSE_ROW = 13;
export const ASLEEP = 1, ENABLED = 2, GONE = 4;

/** What happened in a step that the game is told of once: each list as the simulation gave it, things in it by kind and number. */
export interface StepEvents {
  cargo: unknown[];
  knocks: unknown[];
  landings: unknown[];
  strikes: unknown[];
  pileups: unknown[];
  horns: unknown[];
  arcs: unknown[];
  battleSounds: unknown[];
  shots: number;
  blasts: unknown[];
  bumps: number[];
  splashes: unknown[];
  spouts: unknown[];
  riderHits: number[];
  pedestrianHits: number[];
  waveBreaks: unknown[];
  saved: boolean;
  mishap: unknown;
}

/** What a step leaves for the game to read until the next step: lists the simulation fills afresh each step. */
export interface StepLists {
  tells: unknown[];
  rockBreaks: unknown[];
  paneBreaks: unknown[];
  mud: unknown[];
  slams: unknown[];
  surges: unknown[];
  clownsHit: number[];
  wobbling: number[];
  toppled: number[];
}

/** One step, as it goes across. */
export interface StepRecord {
  /** Lanes seen for the first time: number, where it starts, which way it runs, how fast its cars go. */
  lanes: [number, { from: [number, number, number]; dir: [number, number, number]; cruise: number }][];
  /** The bodies that moved, or woke, slept, were turned on or off or went, POSE_ROW numbers each. */
  poses: Float32Array;
  /** Things seen for the first time: kind, number, and every field's value in order. */
  spawns: [KindName, number, unknown[]][];
  /** Lists whose members changed: kind, and the numbers of what is in it now, in order. */
  lists: [KindName, number[]][];
  /** Fields that changed: kind, number, field's place, value; four entries each, one after another. */
  changes: unknown[];
  events: StepEvents;
  stepLists: StepLists;
  /** Things gone from their lists this step, not to come back (lists only lose things when a run starts again): let go on both sides. */
  forget: [KindName, number][];
}

/** What the worker is told to do after which it sends a record back (the rest show in the next step's); and those of them the game waits for. */
export const RECORDED_OPS: readonly string[] = ['step', 'reset', 'backToSave', 'teleport'];
export const WAITED_OPS: readonly string[] = ['reset', 'backToSave', 'teleport'];
