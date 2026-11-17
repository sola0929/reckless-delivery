import * as THREE from 'three';
import type { DriveInput } from './sim/truck';
import type { FootInput } from './sim/driver';
import type { LevelDef } from './levels/types';
import { OBJECT_KINDS } from './levels/objects';
import { CARGO_TYPES } from './sim/cargo-types';
import { Sim } from './sim/sim';
import { Wind } from './sim/wind';
import { Recorder } from './sim/record';
import { PHYSICS } from './config';
import type { FromWorker, Op, ToWorker } from './sim/worker';
import { ASLEEP, ENABLED, GONE, KINDS, POSE_ROW, RECORDED_OPS, WAITED_OPS, type KindName, type StepEvents, type StepRecord } from './sim/schema';
import type { MirrorBody, MirrorCargoEvent, MirrorKnockEvent, MirrorLandEvent, MirrorPedestrian, MirrorRider, MirrorSim } from './sim/mirror';

/** A body as the main thread knows it: where it was at the last step it was told of. */
class Ghost implements MirrorBody {
  x = 0; y = 0; z = 0;
  qx = 0; qy = 0; qz = 0; qw = 1;
  vx = 0; vy = 0; vz = 0;
  m = 0;
  flags = ENABLED;
  translation() { return { x: this.x, y: this.y, z: this.z }; }
  rotation() { return { x: this.qx, y: this.qy, z: this.qz, w: this.qw }; }
  linvel() { return { x: this.vx, y: this.vy, z: this.vz }; }
  mass() { return this.m; }
  isSleeping() { return (this.flags & ASLEEP) !== 0; }
  isEnabled() { return (this.flags & ENABLED) !== 0; }
}

/** What the replica asks of whatever runs the simulation: the game's controls and commands, passed on. */
export interface SimSource {
  step(drive: DriveInput, foot: FootInput): void;
  reset(): void;
  backToSave(): void;
  teleport(x: number, z: number, yaw: number, floor?: number): void;
  honk(): void;
  finishShut(shut: boolean): void;
}

type Thing = Record<string, unknown>;
type Box = { $: KindName; id: number } | undefined;

/**
 * The simulation as the main thread sees it while it runs somewhere else: a copy of everything the game reads of it, kept
 * up to date one step at a time from the recorder's records. Its bodies are ghosts, its lists are the same arrays all
 * along, and the things in them are the same objects from the first step they are seen to the last.
 */
export class Replica implements MirrorSim {
  // Set from the records: see schema.ts.
  time = 0;
  started = false;
  truckWear = 0;
  lastHonk = -1;
  hasSave = false;
  savedAt = 0;
  result: MirrorSim['result'] = null;
  fullValue = 0;
  reachable = false;
  atDoor = false;
  private onTruck = 0;
  private cargoWorth = 0;
  private tripSoFar: ReturnType<MirrorSim['trip']> = null!;
  private toFinish: number | null = null;
  clownTime = 0;
  warnings: boolean[] = [];
  private shut = false;

  readonly truck = { forwardSpeed: () => 0, controller: null! } as unknown as MirrorSim['truck'] & Thing;
  readonly driver = {} as MirrorSim['driver'] & Thing;
  readonly cargo: MirrorSim['cargo'][number][] = [];
  readonly props: MirrorSim['props'][number][] = [];
  readonly objects = { objects: [] as MirrorSim['objects']['objects'][number][] };
  readonly pedestrians = { list: [] as MirrorPedestrian[] };
  readonly riders = { list: [] as MirrorRider[] };
  readonly clowns: MirrorSim['clowns'];
  readonly machines = { list: [] as MirrorSim['machines']['list'][number][] };
  readonly rigs = { list: [] as MirrorSim['rigs']['list'][number][], mud: [] as MirrorSim['rigs']['mud'], slams: [] as MirrorSim['rigs']['slams'], surges: [] as MirrorSim['rigs']['surges'] };
  readonly droppers = { rocks: [] as MirrorSim['droppers']['rocks'][number][], holes: [] as MirrorSim['droppers']['holes'][number][], tells: [] as MirrorSim['droppers']['tells'], breaks: [] as MirrorSim['droppers']['breaks'] };
  readonly skylights = { lights: [] as MirrorSim['skylights']['lights'][number][], shards: [] as MirrorSim['skylights']['shards'][number][], breaks: [] as MirrorSim['skylights']['breaks'] };
  readonly traffic = { cars: [] as MirrorSim['traffic']['cars'][number][] };
  readonly trains: MirrorSim['trains'];
  readonly waves: MirrorSim['waves'];
  readonly wind: MirrorSim['wind'];
  /** Nothing of a battle: a level with one keeps its simulation on the main thread. */
  readonly battle: MirrorSim['battle'] = { gunners: [], launchers: [], projectiles: [], rounds: [], scars: [], shells: [], tanks: [], threat: null };

  private readonly ghosts: Ghost[] = [];
  private readonly lanes: { from: THREE.Vector3; dir: THREE.Vector3; cruise: number }[] = [];
  private readonly things = new Map<KindName, Map<number, Thing>>();
  private readonly lists: Partial<Record<KindName, Thing[]>>;
  private readonly rigParts: Thing[] = [];
  private readonly debris: Thing[] = [];
  private queue = Replica.noEvents();
  private source: SimSource | null = null;

  constructor(readonly level: LevelDef) {
    const self = this;
    this.clowns = { list: [], fresh: [], wobbling: [], toppled: [], get time() { return self.clownTime; } };
    this.trains = { trains: [], warning: (track: number) => !!self.warnings[track] };
    const waveBreaks = () => this.take('waveBreaks') as ReturnType<MirrorSim['waves']['drainBreaks']>;
    this.waves = { list: [], drainBreaks: waveBreaks };
    // The wind's own sums, over the gusts as they are here.
    this.wind = Object.assign(Object.create(Wind.prototype) as Wind, { list: [] }) as unknown as MirrorSim['wind'];
    (this.truck as Thing).wheels = [];
    Object.assign(this.truck, {
      forwardSpeed: () => (this.truck as Thing).forward as number,
      controller: {
        wheelIsInContact: (i: number) => ((this.truck as Thing).wheels as number[])[i * 4] === 1,
        wheelSuspensionLength: (i: number) => ((this.truck as Thing).wheels as number[])[i * 4 + 1] ?? null,
        wheelSteering: (i: number) => ((this.truck as Thing).wheels as number[])[i * 4 + 2] ?? null,
        wheelRotation: (i: number) => ((this.truck as Thing).wheels as number[])[i * 4 + 3] ?? null,
      },
    });
    this.lists = {
      cargo: this.cargo as unknown as Thing[], debris: this.debris, object: this.objects.objects as unknown as Thing[],
      pedestrian: this.pedestrians.list as unknown as Thing[], rider: this.riders.list as unknown as Thing[],
      clown: this.clowns.list as unknown as Thing[], machine: this.machines.list as unknown as Thing[],
      rig: this.rigs.list as unknown as Thing[], rigPart: this.rigParts, rock: this.droppers.rocks as unknown as Thing[],
      hole: this.droppers.holes as unknown as Thing[], skylight: this.skylights.lights as unknown as Thing[],
      shard: this.skylights.shards as unknown as Thing[], prop: this.props as unknown as Thing[],
      car: this.traffic.cars as unknown as Thing[], train: this.trains.trains as unknown as Thing[],
      wave: this.waves.list as unknown as Thing[], gust: this.wind.list as unknown as Thing[],
    };
  }

  /** For checking: the simulation run here, as it always has been, but seen only through a replica of it. */
  static local(sim: Sim): Replica {
    const replica = new Replica(sim.level);
    const recorder = new Recorder(sim);
    // As it would come across from a worker: copied, nothing shared.
    const sync = () => replica.apply(structuredClone(recorder.record()));
    replica.source = {
      step: (drive, foot) => { sim.step(drive, foot); sync(); },
      reset: () => { replica.dropEvents(); sim.reset(); sync(); },
      backToSave: () => { replica.dropEvents(); sim.backToSave(); sync(); },
      teleport: (x, z, yaw, floor) => { sim.teleport(x, z, yaw, floor); sync(); },
      honk: () => { sim.honk(); sync(); },
      finishShut: (shut) => { sim.finishShut = shut; },
    };
    sync();
    return replica;
  }

  /** One step's record, put into effect. */
  apply(rec: StepRecord): void {
    for (const [id, lane] of rec.lanes) this.lanes[id] = { from: new THREE.Vector3(...lane.from), dir: new THREE.Vector3(...lane.dir), cruise: lane.cruise };
    const { poses } = rec;
    for (let r = 0; r < poses.length; r += POSE_ROW) {
      const flags = poses[r + 12];
      if (flags & GONE) {
        delete this.ghosts[poses[r]];
        continue;
      }
      const g = this.ghost(poses[r]);
      g.x = poses[r + 1]; g.y = poses[r + 2]; g.z = poses[r + 3];
      g.qx = poses[r + 4]; g.qy = poses[r + 5]; g.qz = poses[r + 6]; g.qw = poses[r + 7];
      g.vx = poses[r + 8]; g.vy = poses[r + 9]; g.vz = poses[r + 10];
      g.m = poses[r + 11];
      g.flags = flags;
    }
    // Everything new made first, then filled in: what is new may name what is new.
    for (const [kind, id] of rec.spawns) this.kindOf(kind).set(id, this.make(kind));
    for (const [kind, id, values] of rec.spawns) {
      const thing = this.kindOf(kind).get(id)!;
      KINDS[kind].fields.forEach((_, i) => this.write(kind, thing, i, values[i]));
    }
    for (const [kind, ids] of rec.lists) {
      const list = this.lists[kind];
      if (!list) continue;
      const of = this.kindOf(kind);
      list.length = 0;
      for (const id of ids) list.push(of.get(id)!);
    }
    const { changes } = rec;
    for (let c = 0; c < changes.length; c += 4) {
      const kind = changes[c] as KindName;
      this.write(kind, this.kindOf(kind).get(changes[c + 1] as number)!, changes[c + 2] as number, changes[c + 3]);
    }
    const s = rec.stepLists;
    this.droppers.tells = s.tells as never;
    this.droppers.breaks = s.rockBreaks as never;
    this.skylights.breaks = s.paneBreaks as never;
    this.rigs.mud = s.mud as never;
    this.rigs.slams = s.slams as never;
    this.rigs.surges = s.surges as never;
    const clowns = this.kindOf('clown');
    Object.assign(this.clowns, {
      fresh: s.clownsHit.map((id) => clowns.get(id)), wobbling: s.wobbling.map((id) => clowns.get(id)), toppled: s.toppled.map((id) => clowns.get(id)),
    });
    this.keep(rec.events);
    // Gone for good, and named by nothing to come: let go, after its events have found it.
    for (const [kind, id] of rec.forget) this.things.get(kind)?.delete(id);
  }

  private kindOf(kind: KindName): Map<number, Thing> {
    let of = this.things.get(kind);
    if (!of) this.things.set(kind, (of = new Map()));
    return of;
  }

  private make(kind: KindName): Thing {
    if (kind === 'sim') return this as unknown as Thing;
    if (kind === 'truck') return this.truck;
    if (kind === 'driver') return this.driver;
    return {};
  }

  private ghost(id: number): Ghost {
    return (this.ghosts[id] ??= new Ghost());
  }

  private write(kind: KindName, thing: Thing, field: number, value: unknown): void {
    const { name, codec } = KINDS[kind].fields[field];
    switch (codec) {
      case 'n': case 'b': case 's': case 'a':
        thing[name] = value;
        return;
      case 'v': {
        const v = value as [number, number, number] | null;
        const had = thing[name];
        if (!v) thing[name] = null;
        else if (had instanceof THREE.Vector3) had.set(v[0], v[1], v[2]);
        else thing[name] = new THREE.Vector3(v[0], v[1], v[2]);
        return;
      }
      case 'j': case 'o':
        thing[name] = value;
        return;
      case 'body':
        thing[name] = (value as number) < 0 ? null : this.ghost(value as number);
        return;
      case 'cargoType':
        thing[name] = CARGO_TYPES[value as keyof typeof CARGO_TYPES];
        return;
      case 'objectKind':
        thing[name] = OBJECT_KINDS[value as keyof typeof OBJECT_KINDS];
        return;
      case 'lane':
        thing[name] = this.lanes[value as number];
        return;
      default: {
        const [how, of] = codec.split(':') as ['ref' | 'refs', KindName];
        const things = this.kindOf(of);
        thing[name] = how === 'ref' ? ((value as number) < 0 ? null : things.get(value as number)) : (value as number[]).map((id) => things.get(id));
      }
    }
  }

  // What the simulation tells once: kept from each step's record until the game asks for it.

  private static noEvents(): StepEvents {
    return {
      cargo: [], knocks: [], landings: [], strikes: [], pileups: [], horns: [], arcs: [], battleSounds: [], shots: 0, blasts: [],
      bumps: [], splashes: [], spouts: [], riderHits: [], pedestrianHits: [], waveBreaks: [], saved: false, mishap: null,
    };
  }

  private keep(events: StepEvents): void {
    const q = this.queue;
    const find = (box: Box) => (box && box.id >= 0 ? this.kindOf(box.$).get(box.id) : undefined);
    for (const e of events.cargo as Thing[]) q.cargo.push({ ...e, item: find(e.item as Box), ...(e.debris ? { debris: find(e.debris as Box) } : {}) });
    for (const e of events.knocks as Thing[]) q.knocks.push({ ...e, object: find(e.object as Box) });
    for (const e of events.landings as Thing[]) q.landings.push({ ...e, object: find(e.object as Box) });
    for (const key of ['strikes', 'pileups', 'horns', 'arcs', 'battleSounds', 'blasts', 'splashes', 'spouts', 'waveBreaks'] as const) q[key].push(...events[key]);
    q.bumps.push(...events.bumps);
    q.shots += events.shots;
    q.riderHits.push(...events.riderHits);
    q.pedestrianHits.push(...events.pedestrianHits);
    q.saved ||= events.saved;
    if (events.mishap) q.mishap = events.mishap;
  }

  private take<K extends keyof StepEvents>(key: K): StepEvents[K] {
    const value = this.queue[key];
    const q = this.queue as Record<keyof StepEvents, unknown>;
    q[key] = key === 'shots' ? 0 : key === 'saved' ? false : key === 'mishap' ? null : [];
    return value;
  }

  /** Back to the start or the save: whatever the run before had still to tell is not told. */
  dropEvents(): void {
    this.queue = Replica.noEvents();
  }

  drainEvents() { return this.take('cargo') as MirrorCargoEvent[]; }
  drainKnocks() { return this.take('knocks') as MirrorKnockEvent[]; }
  drainLandings() { return this.take('landings') as MirrorLandEvent[]; }
  drainStrikes() { return this.take('strikes') as ReturnType<Sim['drainStrikes']>; }
  drainPileups() { return this.take('pileups') as ReturnType<Sim['drainPileups']>; }
  drainHorns() { return this.take('horns') as ReturnType<Sim['drainHorns']>; }
  drainArcs() { return this.take('arcs') as ReturnType<Sim['drainArcs']>; }
  drainBattleSounds() { return this.take('battleSounds') as ReturnType<Sim['drainBattleSounds']>; }
  drainShots() { return this.take('shots'); }
  drainBlasts() { return this.take('blasts') as ReturnType<Sim['drainBlasts']>; }
  drainBumps() { return this.take('bumps'); }
  drainSplashes() { return this.take('splashes') as ReturnType<Sim['drainSplashes']>; }
  drainSpouts() { return this.take('spouts') as ReturnType<Sim['drainSpouts']>; }
  drainRiderHits() { const riders = this.kindOf('rider'); return this.take('riderHits').map((id) => riders.get(id)) as unknown as MirrorRider[]; }
  drainPedestrianHits() { const people = this.kindOf('pedestrian'); return this.take('pedestrianHits').map((id) => people.get(id)) as unknown as MirrorPedestrian[]; }
  takeSaved() { return this.take('saved'); }
  takeMishap() { return this.take('mishap') as ReturnType<Sim['takeMishap']>; }

  // What it says of itself.

  cargoOnTruck() { return this.onTruck; }
  cargoValue() { return this.cargoWorth; }
  trip() { return this.tripSoFar; }
  distanceToFinish() { return this.toFinish; }
  wetAt(p: { x: number; y: number; z: number }) { return Sim.prototype.wetAt.call(this as unknown as Sim, p); }
  fordAt(p: { x: number; y?: number; z: number }) { return Sim.prototype.fordAt.call(this as unknown as Sim, p); }
  get finishShut() { return this.shut; }
  set finishShut(shut: boolean) {
    if (shut !== this.shut) this.source?.finishShut(shut);
    this.shut = shut;
  }

  // What it is told to do.

  step(drive: DriveInput, foot: FootInput): void { this.source?.step(drive, foot); }
  reset(): void { this.source?.reset(); }
  backToSave(): void { this.source?.backToSave(); }
  teleport(x: number, z: number, yaw: number, floor?: number): void { this.source?.teleport(x, z, yaw, floor); }
  honk(): void { this.source?.honk(); }

  // With the simulation in a worker: see WorkerLink.

  private link: WorkerLink | null = null;
  /** Whether the simulation runs in a worker, and is to be asked for its steps ahead. */
  get threaded(): boolean { return this.link !== null; }
  ask(steps: number, drive: DriveInput, first: FootInput, rest: FootInput): void { this.link?.ask(steps, drive, first, rest); }
  ready(): boolean { return this.link ? this.link.ready() : true; }
  busy(): boolean { return this.link?.busy() ?? false; }
  after(then: () => void): void {
    if (this.link) this.link.after(then);
    else then();
  }
  /** The physics rate chosen, told the worker; the main thread's own setting is the game's clock. */
  tellRate(dt: number): void { this.link?.rate(dt); }
  /** How long the worker took over its last batch of steps, milliseconds. */
  get workerTook(): number { return this.link?.took ?? 0; }
  /** All the worker has spent on its batches so far, ms, and how many batches: for the diagnostics panel. */
  get workerBusy(): { ms: number; batches: number } { return { ms: this.link?.spent ?? 0, batches: this.link?.batches ?? 0 }; }
  /** How long the worker has been without answering, ms. */
  stalledFor(): number { return this.link?.stalledFor() ?? 0; }
  /** What to do if the worker fails once it is going: told once. */
  onFail(then: (why: string) => void): void { if (this.link) this.link.onFail = then; }

  /** The simulation of a level, made and run in a worker; the replica of it here, once the worker has made it. */
  static async inWorker(levelId: string, level: LevelDef): Promise<Replica> {
    const replica = new Replica(level);
    const worker = new Worker(new URL('./sim/worker.ts', import.meta.url), { type: 'module' });
    const link = new WorkerLink(worker, replica);
    replica.link = link;
    replica.source = link;
    try {
      await link.start(levelId);
    } catch (e) {
      worker.terminate();
      throw e;
    }
    return replica;
  }
}

/** The ops after which the worker sends a record back; and those of them the game waits on before going on. */
const RECORDED = new Set(RECORDED_OPS);
const WAITED = new Set(WAITED_OPS);

/**
 * The main thread's end of the worker. Each frame the game asks for the steps it wants, with the controls as they are;
 * they are sent as soon as the worker is free, and their records come back by the next frame, to be taken one step at a
 * time as the game goes round its loop, as if it had stepped then. Never more than one batch is out: a worker slower than
 * the clock slows the game, as the main thread did, rather than falling ever further behind.
 *
 * Putting the run back to its start or its save, or the truck somewhere else, is waited on: until its record is back
 * nothing goes on, and what the game does after it is done then.
 */
class WorkerLink implements SimSource {
  private queue: Op[] = [];
  private flight: Op[] | null = null;
  private readonly inbox: StepRecord[] = [];
  private waiting = 0;
  private thens: (() => void)[] = [];
  took = 0;
  /** Summed over every batch: what the diagnostics panel reads. */
  spent = 0;
  batches = 0;
  /** Controls on foot with something pressed once in them (get out, lift, jump, give up a throw), asked for when the worker had no room: each kept for a step of its own, in order. */
  private presses: FootInput[] = [];
  private started: ((record: StepRecord) => void) | null = null;
  private notStarted: ((why: Error) => void) | null = null;
  private failed = false;
  private sentAt = 0;
  onFail: ((why: string) => void) | null = null;

  constructor(private readonly worker: Worker, private readonly replica: Replica) {
    worker.onmessage = ({ data }: MessageEvent<FromWorker>) => this.receive(data);
    worker.onerror = (e) => {
      e.preventDefault();
      this.fail(e.message ? `${e.message} (${e.filename}:${e.lineno})` : 'its script could not be loaded');
    };
    worker.onmessageerror = () => this.fail('a message from the worker could not be read');
  }

  /** The worker has failed: before it started, its start does; after, the game is told, once. Nothing waited on is said to be done. */
  private fail(why: string): void {
    if (this.failed) return;
    this.failed = true;
    console.error('simulation worker failed:', why);
    this.worker.terminate();
    if (this.notStarted) {
      this.notStarted(new Error(why));
      this.started = this.notStarted = null;
      return;
    }
    this.onFail?.(why);
  }

  start(level: string): Promise<void> {
    return new Promise((done, fail) => {
      this.notStarted = fail;
      this.started = (record) => {
        this.replica.apply(record);
        done();
      };
      // For testing: ?slow=3 in the address has the worker take three times as long, as on a slow machine.
      const slow = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('slow') ?? 1) : 1;
      this.post({ kind: 'start', level, dt: PHYSICS.dt, slow });
    });
  }

  ask(steps: number, drive: DriveInput, first: FootInput, rest: FootInput): void {
    // Not more asked ahead than a frame's worth at most: beyond that, the time is let go.
    const out = this.queue.filter((op) => op.op === 'step').length + (this.flight?.filter((op) => op.op === 'step').length ?? 0);
    const room = Math.max(0, Math.min(steps, PHYSICS.maxStepsPerFrame - out));
    // The time can be let go; a key pressed once cannot: kept for the next steps there is room for, one step each.
    if (first.vehiclePressed || first.grabPressed || first.jumpPressed || first.cancelPressed) this.presses.push(first);
    for (let i = 0; i < room; i++) {
      const foot = this.presses.shift() ?? (i === 0 && !this.presses.length ? first : rest);
      this.queue.push({ op: 'step', drive: { ...drive }, foot });
    }
    this.send();
  }

  ready(): boolean {
    return this.inbox.length > 0 && this.waiting === 0;
  }

  busy(): boolean {
    return this.waiting > 0;
  }

  after(then: () => void): void {
    if (this.waiting) this.thens.push(then);
    else then();
  }

  /** The next step's record, put into effect: called once for each step the game takes. */
  step(): void {
    const record = this.inbox.shift();
    if (record) this.replica.apply(record);
  }

  reset(): void { this.command({ op: 'reset' }); }
  backToSave(): void { this.command({ op: 'backToSave' }); }
  teleport(x: number, z: number, yaw: number, floor?: number): void { this.command({ op: 'teleport', x, z, yaw, floor }); }
  honk(): void { this.command({ op: 'honk' }); }
  finishShut(shut: boolean): void { this.command({ op: 'shut', shut }); }
  rate(dt: number): void { this.command({ op: 'rate', dt }); }

  private command(op: Op): void {
    if (op.op === 'reset' || op.op === 'backToSave') this.presses = [];
    if (WAITED.has(op.op)) this.waiting++;
    this.queue.push(op);
    this.send();
  }

  /** How long the batch out with the worker has been out, ms; 0 with none out. */
  stalledFor(): number {
    return this.flight ? performance.now() - this.sentAt : 0;
  }

  private send(): void {
    if (this.failed || this.flight || !this.queue.length) return;
    this.sentAt = performance.now();
    this.flight = this.queue;
    this.queue = [];
    this.post({ kind: 'run', ops: this.flight });
  }

  private post(message: ToWorker): void {
    this.worker.postMessage(message);
  }

  private receive(data: FromWorker): void {
    if (this.failed) return;
    if (data.kind === 'failed') {
      this.fail(data.message);
      return;
    }
    if (data.kind === 'started') {
      this.started?.(data.record);
      this.started = this.notStarted = null;
      return;
    }
    const ops = (this.flight ?? []).filter((op) => RECORDED.has(op.op));
    this.flight = null;
    this.took = data.took;
    this.spent += data.took;
    this.batches++;
    // Up to the last thing waited on, everything is put into effect at once, with what was still to be taken before it.
    const lastWaited = ops.map((op) => WAITED.has(op.op)).lastIndexOf(true);
    if (lastWaited >= 0) {
      for (const record of this.inbox.splice(0)) this.replica.apply(record);
      for (let i = 0; i <= lastWaited; i++) {
        // A new run: what the old one had still to tell is let go (a jump elsewhere keeps it: it is the same run).
        if (ops[i].op === 'reset' || ops[i].op === 'backToSave') this.replica.dropEvents();
        this.replica.apply(data.records[i]);
        if (WAITED.has(ops[i].op)) this.waiting--;
      }
    }
    this.inbox.push(...data.records.slice(lastWaited + 1));
    if (!this.waiting && this.thens.length) {
      const thens = this.thens;
      this.thens = [];
      for (const then of thens) then();
    }
    this.send();
  }
}
