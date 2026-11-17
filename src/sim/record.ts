import RAPIER from '@dimforge/rapier3d-compat';
import { ASLEEP, ENABLED, GONE, KINDS, KIND_NAMES, type Codec, type KindName, type StepRecord } from './schema';
import type { Sim } from './sim';

/** What is known of one kind of thing: the number each has, what was last sent of each, and the list as it last was. */
interface Kept {
  ids: Map<object, number>;
  next: number;
  last: Map<number, unknown[]>;
  members: object[];
  memberIds: number[];
  /** What was last sent of each in the list, in its order. */
  memberLast: unknown[][];
}

/**
 * The bodies of each world that have been moved, turned, woken, put to sleep, or turned on or off by hand since they were
 * last looked at; and those taken out of it: by the world's set of bodies, their handles. A body put somewhere while it
 * sleeps stays asleep there: only this tells that it moved.
 */
const touched = new Map<object, Set<number>>();
const removed = new Map<object, Set<number>>();
let watching = false;
/** Whatever changes a body: puts it somewhere, pushes it, wakes it, sends it to sleep, weighs it again, turns it on or off. */
const TOUCHING = /^(set|apply|add|reset|lock|enable|sleep$|wakeUp$|recompute)/;
function watch(): void {
  if (watching) return;
  watching = true;
  type Handled = { rawSet: object; handle: number };
  const body = RAPIER.RigidBody.prototype as unknown as Record<string, (this: Handled, ...args: unknown[]) => unknown>;
  for (const name of Object.getOwnPropertyNames(body)) {
    if (!TOUCHING.test(name) || typeof Object.getOwnPropertyDescriptor(body, name)?.value !== 'function') continue;
    const was = body[name];
    body[name] = function (this: Handled, ...args: unknown[]) {
      touched.get(this.rawSet)?.add(this.handle);
      return was.apply(this, args);
    };
  }
  const world = RAPIER.World.prototype as unknown as { removeRigidBody(this: unknown, b: Handled): void };
  const remove = world.removeRigidBody;
  world.removeRigidBody = function (b: Handled) {
    removed.get(b.rawSet)?.add(b.handle);
    remove.call(this, b);
  };
}

const sameArray = (a: readonly unknown[], b: readonly unknown[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

/** Whether two pieces of plain data are the same throughout. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return a !== a && b !== b;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!same(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  return true;
}

/** What is kept of a field to tell next time whether it changed: itself, or a copy of what is in it. */
function snapshot(codec: Codec, raw: unknown): unknown {
  switch (codec) {
    case 'v': {
      const v = raw as { x: number; y: number; z: number } | null;
      return v ? [v.x, v.y, v.z] : null;
    }
    case 'a': return [...(raw as unknown[])];
    case 'j': return plain(raw ?? null);
    default: return codec.startsWith('refs:') ? [...(raw as unknown[])] : raw ?? null;
  }
}

/** Whether a field is no longer as kept. */
function changed(codec: Codec, raw: unknown, kept: unknown): boolean {
  switch (codec) {
    case 'v': {
      const v = raw as { x: number; y: number; z: number } | null, k = kept as number[] | null;
      if (!v || !k) return !v !== !k;
      return v.x !== k[0] || v.y !== k[1] || v.z !== k[2];
    }
    case 'a': return !sameArray(raw as unknown[], kept as unknown[]);
    case 'j': return !same(plainish(raw), kept);
    default: return codec.startsWith('refs:') ? !sameArray(raw as unknown[], kept as unknown[]) : (raw ?? null) !== kept;
  }
}

/** For each kind and field, whether it is told to have changed by being another value, or another thing, than it was. */
const BY_IDENTITY = Object.fromEntries(KIND_NAMES.map((k) => [k, KINDS[k].fields.map((f) => !['v', 'a', 'j'].includes(f.codec) && !f.codec.startsWith('refs:'))])) as Record<KindName, boolean[]>;
/** For each kind, the places of the fields that are looked at again after the first time. */
const LIVE = Object.fromEntries(KIND_NAMES.map((k) => [k, KINDS[k].fields.flatMap((f, i) => (f.once ? [] : [i]))])) as Record<KindName, number[]>;
/** Of those, the ones that are fields of their own name told changed by being another value: gone through all at once. */
const PLAIN = Object.fromEntries(KIND_NAMES.map((k) => [k, LIVE[k].filter((i) => BY_IDENTITY[k][i] && !KINDS[k].fields[i].get)])) as Record<KindName, number[]>;
/** And the rest, gone through one at a time. */
const REST = Object.fromEntries(KIND_NAMES.map((k) => [k, LIVE[k].filter((i) => !PLAIN[k].includes(i))])) as Record<KindName, number[]>;
type Scan = (things: readonly object[], last: unknown[][], hit: (n: number, i: number, raw: unknown) => void) => void;
/**
 * For each kind, a function that goes through the plain fields of everything of it and tells of each that changed. It is
 * written out for the fields of that kind, each read where it is named: thousands of loose things read through one place
 * by name each would be read ten times as slowly.
 */
const SCAN = Object.fromEntries(KIND_NAMES.map((k) => {
  const body = PLAIN[k].map((i) => `r = t.${KINDS[k].fields[i].name}; if (r === undefined) r = null; if (r !== l[${i}]) hit(n, ${i}, r);`).join(' ');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return [k, new Function('things', 'last', 'hit', `for (let n = 0; n < things.length; n++) { const t = things[n], l = last[n]; let r; ${body} }`) as Scan];
})) as Record<KindName, Scan>;
/** A copy of plain data, so that what goes across is as it was at this step, whatever it becomes after. */
const plain = <T>(value: T): T => (value === undefined ? undefined : JSON.parse(JSON.stringify(value))) as T;
/** What plain data is, as far as comparing it with a copy goes: nothing is the same as null. */
const plainish = (value: unknown) => value ?? null;

/**
 * Beside the simulation, after each of its steps: what has changed of everything the game sees, written down for the
 * replica on the main thread (schema.ts says what that is). The first record has all of it.
 */
export class Recorder {
  private readonly kept = Object.fromEntries(KIND_NAMES.map((k) => [k, { ids: new Map(), next: 0, last: new Map(), members: [], memberIds: [], memberLast: [] }])) as unknown as Record<KindName, Kept>;
  /** Each body's number, by its handle; each number's body, while it lasts. */
  private readonly bodyIds = new Map<number, number>();
  private readonly bodies: (RAPIER.RigidBody | null)[] = [];
  /** Bodies numbered since the last record, and those awake at it. */
  private fresh = new Set<number>();
  private awake = new Set<number>();
  private again = new Set<number>();
  private readonly touched = new Set<number>();
  private readonly removed = new Set<number>();
  private readonly laneIds = new Map<object, number>();
  private rec!: StepRecord;
  private poses: number[] = [];
  /** What is left to do once the step's lists are gone through: numbers for the things events name. */
  private afterLists: (() => void)[] = [];
  /** Things that left their lists this step. */
  private leaving: [KindName, object][] = [];

  constructor(private readonly sim: Sim) {
    watch();
    const set = (sim.truck.body as unknown as { rawSet: object }).rawSet;
    touched.set(set, this.touched);
    removed.set(set, this.removed);
  }

  /** Everything that changed since the last record; the first time, everything. */
  record(): StepRecord {
    this.rec = { lanes: [], poses: new Float32Array(0), spawns: [], lists: [], changes: [], events: null!, stepLists: null!, forget: [] };
    this.leaving = [];
    this.poses = [];
    this.afterLists = [];
    this.rec.events = this.events();
    this.rec.stepLists = this.stepLists();
    for (const kind of KIND_NAMES) this.syncList(kind);
    for (const then of this.afterLists) then();
    // Let go only now: an event of this step may have named one of them.
    for (const [kind, thing] of this.leaving) {
      const kept = this.kept[kind], id = kept.ids.get(thing);
      if (id === undefined) continue;
      kept.ids.delete(thing);
      kept.last.delete(id);
      this.rec.forget.push([kind, id]);
    }
    this.posesNow();
    this.rec.poses = new Float32Array(this.poses);
    return this.rec;
  }

  private syncList(kind: KindName): void {
    const kept = this.kept[kind];
    const now = KINDS[kind].list(this.sim);
    if (!sameArray(now, kept.members)) {
      const still = new Set(now);
      for (const thing of kept.members) if (!still.has(thing)) this.leaving.push([kind, thing]);
      kept.memberIds = now.map((thing) => this.idOf(kind, thing));
      kept.memberLast = kept.memberIds.map((id) => kept.last.get(id)!);
      this.rec.lists.push([kind, kept.memberIds]);
      kept.members = [...now];
    }
    const { fields } = KINDS[kind];
    const { memberIds, memberLast } = kept;
    const hit = (n: number, i: number, raw: unknown) => {
      const codec = fields[i].codec, last = memberLast[n];
      last[i] = snapshot(codec, raw);
      this.rec.changes.push(kind, memberIds[n], i, this.encode(codec, raw, last[i]));
    };
    SCAN[kind](now, memberLast, hit);
    const rest = REST[kind];
    if (!rest.length) return;
    for (let n = 0; n < now.length; n++) {
      const thing = now[n], last = memberLast[n];
      for (const i of rest) {
        const field = fields[i];
        const raw = field.get ? field.get(thing as never, this.sim) : (thing as Record<string, unknown>)[field.name];
        if (BY_IDENTITY[kind][i] ? (raw ?? null) !== last[i] : changed(field.codec, raw, last[i])) hit(n, i, raw);
      }
    }
  }

  /** The number of a thing, given it the first time it is seen, with all of it sent then. */
  private idOf(kind: KindName, thing: object): number {
    const kept = this.kept[kind];
    let id = kept.ids.get(thing);
    if (id !== undefined) return id;
    id = kept.next++;
    kept.ids.set(thing, id);
    const last: unknown[] = [];
    kept.last.set(id, last);
    const values: unknown[] = [];
    // Spawned before its fields are read: a thing that names itself, or one that names it back, finds it.
    this.rec.spawns.push([kind, id, values]);
    for (const field of KINDS[kind].fields) {
      const raw = field.get ? field.get(thing as never, this.sim) : (thing as Record<string, unknown>)[field.name];
      last.push(snapshot(field.codec, raw));
      values.push(this.encode(field.codec, raw, last[last.length - 1]));
    }
    return id;
  }

  /** A field's value as it goes across, given the field as it is now and the copy kept of it. */
  private encode(codec: Codec, raw: unknown, kept: unknown): unknown {
    switch (codec) {
      case 'n': case 'b': case 's': case 'cargoType': case 'objectKind':
        return raw ?? null;
      case 'v': case 'a': case 'j':
        return kept;
      case 'o':
        return plain(raw ?? null);
      case 'body':
        return raw ? this.bodyId(raw as RAPIER.RigidBody) : -1;
      case 'lane':
        return this.laneId(raw as { from: { x: number; y: number; z: number }; dir: { x: number; y: number; z: number }; cruise: number });
      default: {
        const [how, kind] = codec.split(':') as ['ref' | 'refs', KindName];
        if (how === 'ref') return raw ? this.idOf(kind, raw as object) : -1;
        return (raw as object[]).map((t) => this.idOf(kind, t));
      }
    }
  }

  private bodyId(body: RAPIER.RigidBody): number {
    let id = this.bodyIds.get(body.handle);
    if (id === undefined) {
      id = this.bodies.length;
      this.bodyIds.set(body.handle, id);
      this.bodies.push(body);
      this.fresh.add(id);
    }
    return id;
  }

  private laneId(lane: { from: { x: number; y: number; z: number }; dir: { x: number; y: number; z: number }; cruise: number }): number {
    let id = this.laneIds.get(lane);
    if (id === undefined) {
      id = this.laneIds.size;
      this.laneIds.set(lane, id);
      this.rec.lanes.push([id, { from: [lane.from.x, lane.from.y, lane.from.z], dir: [lane.dir.x, lane.dir.y, lane.dir.z], cruise: lane.cruise }]);
    }
    return id;
  }

  /** Each body that is awake, or has just fallen asleep, or been seen to for itself, or is new or gone. */
  private posesNow(): void {
    const send = this.fresh;
    this.fresh = new Set();
    const awake = new Set<number>();
    this.sim.world.forEachActiveRigidBody((body) => {
      const id = this.bodyIds.get(body.handle);
      if (id === undefined) return;
      awake.add(id);
      send.add(id);
    });
    for (const id of this.awake) if (!awake.has(id)) send.add(id);
    this.awake = awake;
    // What was seen to by hand is sent again after the next step too: woken or put to sleep, it settles into it in a step.
    for (const id of this.again) send.add(id);
    this.again = new Set();
    for (const handle of this.touched) {
      const id = this.bodyIds.get(handle);
      if (id === undefined) continue;
      send.add(id);
      this.again.add(id);
    }
    this.touched.clear();
    for (const handle of this.removed) {
      const id = this.bodyIds.get(handle);
      if (id === undefined) continue;
      this.bodyIds.delete(handle);
      this.bodies[id] = null;
      send.delete(id);
      this.awake.delete(id);
      this.poses.push(id, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, GONE);
    }
    this.removed.clear();
    for (const id of send) {
      const body = this.bodies[id];
      if (!body) continue;
      const t = body.translation(), r = body.rotation(), v = body.linvel();
      const flags = (body.isSleeping() ? ASLEEP : 0) | (body.isEnabled() ? ENABLED : 0);
      this.poses.push(id, t.x, t.y, t.z, r.x, r.y, r.z, r.w, v.x, v.y, v.z, body.mass(), flags);
    }
  }

  /** What the simulation has to tell once: taken from it now, each step, and kept on the far side until the game asks. */
  private events(): StepRecord['events'] {
    const { sim } = this;
    // Things named in an event that are not yet known are given their numbers after the step's lists are gone through.
    const later: (() => void)[] = [];
    const ref = (kind: KindName, thing: object | undefined) => {
      const box = { $: kind, id: -1 };
      if (thing) later.push(() => (box.id = this.idOf(kind, thing)));
      return box;
    };
    const events: StepRecord['events'] = {
      cargo: sim.drainEvents().map((e) => ({ ...plain({ ...e, item: undefined, debris: undefined }), item: ref('cargo', e.item), debris: 'debris' in e ? ref('debris', e.debris) : undefined })),
      knocks: sim.drainKnocks().map((e) => ({ ...plain({ ...e, object: undefined }), object: ref('object', e.object) })),
      landings: sim.drainLandings().map((e) => ({ ...plain({ ...e, object: undefined }), object: ref('object', e.object) })),
      strikes: plain(sim.drainStrikes()),
      pileups: plain(sim.drainPileups()),
      horns: plain(sim.drainHorns()),
      arcs: plain(sim.drainArcs()),
      battleSounds: plain(sim.drainBattleSounds()),
      shots: sim.drainShots(),
      blasts: plain(sim.drainBlasts()),
      bumps: [...sim.drainBumps()],
      splashes: plain(sim.drainSplashes()),
      spouts: plain(sim.drainSpouts()),
      riderHits: [],
      pedestrianHits: [],
      waveBreaks: plain(sim.waves.drainBreaks()),
      saved: sim.takeSaved(),
      mishap: sim.takeMishap(),
    };
    const riders = sim.drainRiderHits(), people = sim.drainPedestrianHits();
    later.push(() => {
      events.riderHits = riders.map((r) => this.idOf('rider', r));
      events.pedestrianHits = people.map((p) => this.idOf('pedestrian', p));
    });
    this.afterLists.push(...later);
    return events;
  }

  private stepLists(): StepRecord['stepLists'] {
    const { sim } = this;
    const lists: StepRecord['stepLists'] = {
      tells: plain(sim.droppers.tells), rockBreaks: plain(sim.droppers.breaks), paneBreaks: plain(sim.skylights.breaks),
      mud: plain(sim.rigs.mud), slams: plain(sim.rigs.slams), surges: plain(sim.rigs.surges),
      clownsHit: [], wobbling: [], toppled: [],
    };
    const { fresh, wobbling, toppled } = sim.clowns;
    this.afterLists.push(() => {
      lists.clownsHit = fresh.map((c) => this.idOf('clown', c));
      lists.wobbling = wobbling.map((c) => this.idOf('clown', c));
      lists.toppled = toppled.map((c) => this.idOf('clown', c));
    });
    return lists;
  }
}
