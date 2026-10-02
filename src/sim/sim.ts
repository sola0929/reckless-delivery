import RAPIER from '@dimforge/rapier3d-compat';
import { Euler, Quaternion } from 'three';
import { GROUP, PHYSICS, groups } from '../config';
import { sandbox } from '../levels/sandbox';
import { groundTiles } from '../levels/ground';
import type { LevelDef, PitDesc, PropDesc, TrackDesc } from '../levels/types';
import { CargoSystem, type CargoEvent, type CargoItem } from './cargo';
import { Driver, NO_FOOT_INPUT, type FootInput } from './driver';
import { BLAST_RADIUS, ObjectSystem, type Blast, type KnockEvent, type LandEvent } from './objects';
import { Pedestrians, type Pedestrian, type Vehicle } from './pedestrians';
import { Riders, SCOOTER_MASS, type Rider } from './riders';
import { Traffic } from './traffic';
import { Trains } from './trains';
import { Truck, type DriveInput } from './truck';
import { Water, type Splash } from './water';

export interface PropInstance {
  desc: PropDesc;
  body: RAPIER.RigidBody;
}

interface Pose {
  body: RAPIER.RigidBody;
  pos: RAPIER.Vector;
  rot: RAPIER.Rotation;
}

/** The ways a run can end badly: the truck on its roof, in a pit, or in the river. */
export type Failure = 'overturned' | 'pit' | 'water';

/** The load, counted by what state each item ended up in. */
export interface Tally {
  /** Aboard and unmarked. */
  intact: number;
  /** Aboard, but knocked about. */
  damaged: number;
  /** Wrecked, wherever its pieces are. */
  destroyed: number;
  /** Left behind somewhere along the way. */
  lost: number;
}

/** How a delivery turned out. */
export interface Result {
  /** Value of the cargo still on the truck at the delivery bay. */
  value: number;
  /** That value as a share of the full load. */
  fraction: number;
  /** 0 (failed) to 3. */
  stars: number;
  seconds: number;
  /** Set when the run ended without a delivery, and why. */
  failure?: Failure;
  /** What became of each item of the load. */
  tally: Tally;
}

/** Half the depth of the ground slab: deep enough to wall in any pit. */
const GROUND_THICKNESS = 3;
/** The truck this far below the road, for this long, has fallen into a pit. */
const PIT_DEPTH = 0.6;
const PIT_SECONDS = 1;
/** Height of the truck's chassis above the road when standing on it. */
const TRUCK_REST = 0.72;
/** The truck must sit this still, for this long, inside the bay to deliver. */
const DELIVERY_SPEED = 0.6;
const DELIVERY_SECONDS = 0.6;
/** Hitting something loose shakes the load by this many times the speed the truck loses to it. */
const JOLT_PER_SPEED_LOST = 4;
/** A truck hit by a train isn't hit again by the same one. */
const STRUCK_SECONDS = 1.5;
/** Pushing at something for this long without moving counts as being stuck on it. */
const STALL_SECONDS = 0.6;
/** However fast the train, the truck leaves it no faster than this, m/s. */
const FLING_MAX = 26;
/** The truck's speed changing by more than this in one step, m/s, is a knock that marks it. */
const WEAR_THRESHOLD = 0.8;
/** And by more than this, a knock worth reporting at all: hard braking alone comes to about 0.25. */
const BUMP_THRESHOLD = 0.4;
/** Wear, out of 100, per m/s beyond that; and the most one step can add. */
const WEAR_PER_SPEED = 4;
const WEAR_STEP_MAX = 40;
/** A blast right beside the truck shakes the load by this much, m/s, and shoves the truck this fast. */
const BLAST_JOLT = 20;
const BLAST_SHOVE = 2.6;
/** How much of that a car passes on, beside what a roadside object of the same weight would: it gives. */
const CAR_JOLT = 0.7;
/** A scooter passes on rather more for its weight: light as it is, it would otherwise cost nothing at all. It still comes to well under a car's. */
const SCOOTER_JOLT = 1.25;
const PARKED: DriveInput = { throttle: 0, steer: 0, handbrake: true };

/** One star for passing, a second for delivering most of the load, a third for doing that inside the par time. */
export function starsFor(level: LevelDef, fraction: number, seconds: number): number {
  const [pass, two] = level.stars;
  if (fraction < pass) return 0;
  if (fraction < two) return 1;
  return seconds <= level.par ? 3 : 2;
}

/** The whole physics world for one level. Has no rendering dependencies, so it also runs headless. */
export class Sim {
  readonly world: RAPIER.World;
  readonly truck: Truck;
  readonly props: PropInstance[] = [];
  readonly cargoSystem: CargoSystem;
  readonly traffic: Traffic;
  readonly riders: Riders;
  readonly driver: Driver;
  readonly trains: Trains;
  readonly water: Water;
  readonly objects: ObjectSystem;
  readonly pedestrians: Pedestrians;
  /** Value of the full load when undamaged. */
  readonly fullValue: number;
  /** Seconds since the start line was crossed; stops at delivery. */
  time = 0;
  /** Whether the run is under way: the truck has crossed the start line, if the level has one. */
  started: boolean;
  /** How many times the truck has been set back on its wheels after overturning. */
  rightings = 0;
  /**
   * How battered the truck is, 0 to 100. For show only: it drives the same however it looks.
   */
  truckWear = 0;
  /** Set once the load has been delivered. */
  result: Result | null = null;
  private dwell = 0;
  private inPit = 0;
  private struck = 0;
  private readonly truckVel = { x: 0, y: 0, z: 0 };
  private bumps: number[] = [];
  private stalled = 0;
  private strikes: { x: number; y: number; z: number }[] = [];
  private blasts: Blast[] = [];
  private pileups: { x: number; z: number; speed: number }[] = [];
  private readonly eventQueue: RAPIER.EventQueue;
  private readonly startPoses: Pose[] = [];

  static async create(level: LevelDef = sandbox()): Promise<Sim> {
    await RAPIER.init();
    return new Sim(level);
  }

  private constructor(readonly level: LevelDef) {
    this.world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
    this.world.timestep = PHYSICS.dt;
    this.world.numSolverIterations = PHYSICS.solverIterations;
    this.eventQueue = new RAPIER.EventQueue(true);

    const groundGroups = groups(GROUP.ground, GROUP.all);
    for (const [x0, z0, x1, z1] of groundTiles(level)) {
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid((x1 - x0) / 2, GROUND_THICKNESS, (z1 - z0) / 2)
          .setTranslation((x0 + x1) / 2, -GROUND_THICKNESS, (z0 + z1) / 2)
          .setFriction(0.9)
          .setCollisionGroups(groundGroups),
      );
    }
    // Each pit has a floor; its walls are the sides of the ground around it.
    for (const pit of level.pits ?? []) {
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(pit.half[0], 0.5, pit.half[1])
          .setTranslation(pit.pos[0], -pit.depth - 0.5, pit.pos[1])
          .setFriction(0.9)
          .setCollisionGroups(groundGroups),
      );
    }

    const q = new Quaternion();
    const e = new Euler();
    for (const desc of level.props) {
      if (desc.ghost) continue;
      const [rx, ry, rz] = desc.rot ?? [0, 0, 0];
      q.setFromEuler(e.set(rx, ry, rz));
      const dynamic = desc.mass !== undefined;
      const body = this.world.createRigidBody(
        (dynamic ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.fixed())
          .setTranslation(...desc.pos)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
      );
      const [a, b, c] = desc.size;
      const shape =
        desc.shape === 'box' ? RAPIER.ColliderDesc.cuboid(a, b, c)
        : desc.shape === 'cylinder' ? RAPIER.ColliderDesc.cylinder(b, a)
        : RAPIER.ColliderDesc.cone(b, a);
      shape.setFriction(0.8).setCollisionGroups(groups(dynamic ? GROUP.prop : GROUP.ground, GROUP.all));
      if (dynamic) shape.setMass(desc.mass!);
      this.world.createCollider(shape, body);
      this.props.push({ desc, body });
      if (dynamic) this.startPoses.push({ body, pos: body.translation(), rot: body.rotation() });
    }

    this.truck = new Truck(this.world, level.spawn, level.heading);
    this.traffic = new Traffic(this.world, level.traffic);
    this.riders = new Riders(this.world, level.riders ?? []);
    this.driver = new Driver(this.world);
    this.started = !level.startLine;
    this.water = new Water(level.pits ?? []);
    this.trains = new Trains(this.world, level.tracks ?? [], level.bounds[0][0], level.bounds[1][0]);
    this.objects = new ObjectSystem(this.world, level.objects ?? []);
    this.follow();
    this.pedestrians = new Pedestrians(level.crowds ?? []);
    this.cargoSystem = new CargoSystem(this.world, level.damageScale ?? 1);
    this.cargoSystem.load(level.cargo, level.spawn, level.heading);
    this.fullValue = this.cargo.reduce((sum, item) => sum + item.type.value, 0);
  }

  get cargo(): CargoItem[] {
    return this.cargoSystem.items;
  }

  /**
   * Advance one fixed step of PHYSICS.dt. The truck only answers its controls while the
   * driver is in it and the run isn't over; otherwise it sits with the handbrake on.
   */
  step(input: DriveInput, foot: FootInput = NO_FOOT_INPUT): void {
    const driving = this.driver.mode === 'driving' && !this.result;
    this.truck.grip = this.gripAt(this.truck.body.translation());
    this.truck.update(PHYSICS.dt, driving ? input : PARKED);
    this.driver.update(PHYSICS.dt, foot, this.truck, this.cargoSystem, this.traffic, this.riders, this.trains, !this.result);
    this.trains.update(PHYSICS.dt);
    this.struck -= PHYSICS.dt;
    const train = this.struck <= 0 ? this.trains.striking(this.truck) : null;
    if (train) this.strike(train);
    if (this.truck.isOverturned(PHYSICS.dt)) this.overturn();
    // Down a hole there is no driving out of.
    this.inPit = this.truck.body.translation().y < TRUCK_REST - PIT_DEPTH ? this.inPit + PHYSICS.dt : 0;
    if (this.inPit > PIT_SECONDS && this.level.finish) {
      const t = this.truck.body.translation();
      this.fail(this.water.poolAt(t.x, t.z) ? 'water' : 'pit');
    }
    const walkers = this.pedestrians.inRoad().map((p) => p.pos);
    this.traffic.update(PHYSICS.dt, this.truck, walkers, this.riders.inTheWay());
    this.pileups.push(...this.traffic.pileups);
    this.riders.update(PHYSICS.dt, this.truck, this.traffic, walkers);
    this.world.step(this.eventQueue);
    this.eventQueue.drainContactForceEvents((event) => {
      this.cargoSystem.addForce(event.collider1(), event.collider2(), event.totalForceMagnitude());
    });
    this.wear();
    this.cargoSystem.update(this.truck);
    // Trying to move and getting nowhere: something is in the way that won't shift.
    const trying = driving && (input.throttle !== 0) && !input.handbrake && Math.abs(this.truck.forwardSpeed()) < 0.4;
    this.stalled = trying ? this.stalled + PHYSICS.dt : 0;
    this.objects.update(this.truck, this.stalled > STALL_SECONDS);
    for (const blast of this.objects.blasts) this.blast(blast);
    this.shake();
    this.soak();
    this.follow();
    this.pedestrians.update(PHYSICS.dt, this.truck, this.vehicles());
    if (!this.started) this.started = this.pastStart();
    if (!this.result) {
      if (this.started) this.time += PHYSICS.dt;
      this.checkDelivery();
    }
  }

  /** Cargo events since the last call: damage, parts coming off, items lost. */
  drainEvents(): CargoEvent[] {
    return this.cargoSystem.drainEvents();
  }

  /** Loose objects sent flying since the last call. */
  drainKnocks(): KnockEvent[] {
    return this.objects.drainEvents();
  }

  /** Loose objects that have come down on something since the last call. */
  drainLandings(): LandEvent[] {
    return this.objects.drainLandings();
  }

  /** Where the truck was each time a train hit it, since the last call. */
  drainStrikes(): { x: number; y: number; z: number }[] {
    const out = this.strikes;
    this.strikes = [];
    return out;
  }

  /** Cars run into by other cars since the last call: where, and how fast. */
  drainPileups(): { x: number; z: number; speed: number }[] {
    const out = this.pileups;
    this.pileups = [];
    return out;
  }

  /** Explosions since the last call. */
  drainBlasts(): Blast[] {
    const out = this.blasts;
    this.blasts = [];
    return out;
  }

  /** Knocks the truck has taken since the last call: each the change in its speed in one step, m/s. */
  drainBumps(): number[] {
    const out = this.bumps;
    this.bumps = [];
    return out;
  }

  /** Things that have just gone into the water. */
  drainSplashes(): Splash[] {
    return this.water.drainSplashes();
  }

  /** Scooter riders knocked off since the last call. */
  drainRiderHits(): Rider[] {
    return this.riders.drainEvents();
  }

  /** Pedestrians sent flying since the last call. */
  drainPedestrianHits(): Pedestrian[] {
    return this.pedestrians.drainEvents();
  }

  cargoOnTruck(): number {
    let n = 0;
    for (const c of this.cargo) if (c.body && !c.held && this.truck.isOnBed(c.body.translation())) n++;
    return n;
  }

  /** What is aboard is worth right now. Anything that has fallen off is left out until it is brought back. */
  cargoValue(): number {
    let sum = 0;
    // A wreck has no body to fall off; its worth already follows how much of it is still aboard.
    for (const c of this.cargo) if (c.stage === 3 || !c.fallen) sum += c.value;
    return sum;
  }

  /** What would be handed over if the truck delivered this instant: only what is on the bed. */
  deliverableValue(): number {
    let sum = 0;
    for (const c of this.cargo) {
      if (c.stage === 3 || (c.body && !c.held && this.truck.isOnBed(c.body.translation()))) sum += c.value;
    }
    return sum;
  }

  /** Count the load by the state each item is in right now. */
  tally(): Tally {
    const tally: Tally = { intact: 0, damaged: 0, destroyed: 0, lost: 0 };
    for (const c of this.cargo) {
      if (c.stage === 3) tally.destroyed++;
      else if (!c.body || c.held || !this.truck.isOnBed(c.body.translation())) tally.lost++;
      else if (c.stage === 0) tally.intact++;
      else tally.damaged++;
    }
    return tally;
  }

  /** Metres from the truck to the delivery bay, or null in free play. */
  distanceToFinish(): number | null {
    const finish = this.level.finish;
    if (!finish) return null;
    const t = this.truck.body.translation();
    return Math.hypot(finish.pos[0] - t.x, finish.pos[1] - t.z);
  }

  /** Put everything back at the start. Cargo bodies are rebuilt, so views must be too. */
  reset(): void {
    this.water.reset();
    this.truck.reset();
    this.traffic.reset();
    this.riders.reset();
    const zero = { x: 0, y: 0, z: 0 };
    for (const p of this.startPoses) {
      p.body.setTranslation(p.pos, true);
      p.body.setRotation(p.rot, true);
      p.body.setLinvel(zero, true);
      p.body.setAngvel(zero, true);
    }
    this.cargoSystem.load(this.level.cargo, this.level.spawn, this.level.heading);
    this.driver.reset();
    this.trains.reset();
    this.objects.reset();
    this.pedestrians.reset();
    this.time = 0;
    this.started = !this.level.startLine;
    this.rightings = 0;
    this.dwell = 0;
    this.inPit = 0;
    this.struck = 0;
    this.truckWear = 0;
    this.truckVel.x = this.truckVel.y = this.truckVel.z = 0;
    this.bumps = [];
    this.stalled = 0;
    this.strikes = [];
    this.blasts = [];
    this.pileups = [];
    this.result = null;
  }

  /** Keep those who go after a vehicle at its tail: the patch they wander in is moved along behind it. */
  private follow(): void {
    for (const crowd of this.level.crowds ?? []) {
      if (!crowd.follows) continue;
      const car = this.traffic.cars.find((c) => c.kind === crowd.follows && c.knocked <= 0);
      if (!car) continue;
      const back = car.spec.half.length + 2.6;
      const x = car.lane.from.x + car.lane.dir.x * (car.s - back);
      const z = car.lane.from.z + car.lane.dir.z * (car.s - back);
      crowd.area = [x - 2, z - 2, x + 2, z + 2];
    }
  }

  /** Everything driven or ridden along the roads, the truck apart. */
  private vehicles(): Vehicle[] {
    const moving: Vehicle[] = this.riders.moving();
    for (const car of this.traffic.cars) {
      if (car.knocked > 0 || car.lane.cruise === 0) continue;
      const p = car.body.translation();
      moving.push({ x: p.x, z: p.z, vx: car.lane.dir.x * car.speed, vz: car.lane.dir.z * car.speed });
    }
    return moving;
  }

  /** An overturned truck ends the run. In free play there is no run to end, so it is set back on its wheels. */
  private overturn(): void {
    if (this.level.finish) {
      this.fail('overturned');
      return;
    }
    this.truck.setUpright();
    this.rightings++;
    this.cargoSystem.clearFootprint(this.truck);
  }

  /** Every hard knock to the truck leaves its mark. */
  private wear(): void {
    const lv = this.truck.body.linvel();
    const dv = Math.hypot(lv.x - this.truckVel.x, lv.y - this.truckVel.y, lv.z - this.truckVel.z);
    this.truckVel.x = lv.x;
    this.truckVel.y = lv.y;
    this.truckVel.z = lv.z;
    // Heard before it is seen: a knock too light to mark the truck still makes a noise.
    if (dv > BUMP_THRESHOLD) this.bumps.push(dv);
    if (dv > WEAR_THRESHOLD) this.truckWear = Math.min(100, this.truckWear + Math.min(WEAR_STEP_MAX, (dv - WEAR_THRESHOLD) * WEAR_PER_SPEED));
  }

  private pastStart(): boolean {
    const line = this.level.startLine;
    if (!line) return true;
    const t = this.truck.body.translation();
    return (t.x - line.pos[0]) * line.dir[0] + (t.z - line.pos[1]) * line.dir[1] > 0;
  }

  private gripAt(p: { x: number; z: number }): number {
    for (const s of this.level.slicks ?? []) if (Math.abs(p.x - s.pos[0]) < s.half[0] && Math.abs(p.z - s.pos[1]) < s.half[1]) return s.grip;
    return 1;
  }

  /**
   * A train doesn't stop. The truck is sent flying along the track and off to the side it
   * was nearer, with its load: no failure in itself, though what is left afterwards may be.
   */
  private strike(track: TrackDesc): void {
    const body = this.truck.body;
    const t = body.translation();
    const side = t.z < track.z ? -1 : 1;
    const fling = { x: track.direction * Math.min(track.speed * 0.6, FLING_MAX), y: 6.5, z: side * 7 };
    for (const item of this.cargo) if (item.body && !item.held && this.truck.isOnBed(item.body.translation())) item.body.setLinvel(fling, true);
    body.setLinvel(fling, true);
    body.setAngvel({ x: 0, y: track.direction * side * 2.2, z: 0 }, true);
    this.struck = STRUCK_SECONDS;
    this.strikes.push({ x: t.x, y: t.y, z: t.z });
  }

  /**
   * Something has blown up. People and riders near it are thrown down; the truck, if it is
   * near, is shoved away and its load shaken, the more the nearer. It ends nothing by itself.
   */
  private blast(at: Blast): void {
    this.blasts.push(at);
    this.pedestrians.blast(at.x, at.z, BLAST_RADIUS);
    this.riders.blast(at.x, at.z, BLAST_RADIUS);
    this.driver.blast(at.x, at.z, BLAST_RADIUS, this.cargoSystem);
    const t = this.truck.body.translation();
    const dx = t.x - at.x;
    const dz = t.z - at.z;
    // From the nearest part of the truck, near enough, rather than from its middle.
    const away = Math.max(0, Math.hypot(dx, dz) - 2.5);
    const near = 1 - away / BLAST_RADIUS;
    if (near <= 0) return;
    const out = Math.max(Math.hypot(dx, dz), 0.3);
    const mass = this.truck.body.mass();
    this.truck.body.applyImpulse({ x: (dx / out) * BLAST_SHOVE * near * mass, y: BLAST_SHOVE * 0.2 * near * mass, z: (dz / out) * BLAST_SHOVE * near * mass }, true);
    this.cargoSystem.jolt(BLAST_JOLT * near, this.truck);
  }

  /** Running into something heavy checks the truck, and the load feels it. */
  private shake(): void {
    const truckMass = this.truck.body.mass();
    // A car or a scooter, by however fast the two came together: it may have run into a truck
    // that was standing. The heavier it is, the more of that the load feels.
    let jolt = 0;
    for (const car of this.traffic.fresh) jolt = Math.max(jolt, ((car.impact * car.spec.mass) / (truckMass + car.spec.mass)) * CAR_JOLT);
    for (const rider of this.riders.fresh) jolt = Math.max(jolt, ((rider.impact * SCOOTER_MASS) / (truckMass + SCOOTER_MASS)) * SCOOTER_JOLT);
    if (jolt > 0) this.cargoSystem.jolt(jolt * JOLT_PER_SPEED_LOST, this.truck);
    if (!this.objects.fresh.length) return;
    const t = this.truck.body.translation();
    const lv = this.truck.body.linvel();
    const speed = Math.hypot(lv.x, lv.z);
    jolt = 0;
    for (const { object } of this.objects.fresh) {
      const p = object.body.translation();
      if (Math.hypot(p.x - t.x, p.z - t.z) > 6) continue;
      const mass = object.body.mass();
      jolt = Math.max(jolt, (speed * mass) / (truckMass + mass));
    }
    if (jolt > 0) this.cargoSystem.jolt(jolt * JOLT_PER_SPEED_LOST, this.truck);
  }

  /** Whatever has gone into the water sinks; a driver who has is hauled out beside the truck. */
  private soak(): void {
    // Lost to the river but hung up on the lip of it: off it comes, toward the middle of the water.
    const t = this.truck.body.translation();
    const pool = this.result?.failure === 'water' && !this.water.under(t) ? this.water.poolAt(t.x, t.z) ?? this.nearestPool(t) : null;
    if (pool) {
      const dz = Math.sign(pool.pos[1] - t.z) || 1;
      const mass = this.truck.body.mass();
      this.truck.body.applyImpulse({ x: 0, y: 0, z: dz * 6 * PHYSICS.dt * mass }, true);
    }
    this.water.soak(this.truck.body);
    for (const item of this.cargo) if (item.body && !item.held) this.water.soak(item.body);
    for (const piece of this.cargoSystem.debris) this.water.soak(piece.body);
    for (const object of this.objects.objects) if (object.knocked) this.water.soak(object.body);
    for (const car of this.traffic.cars) if (car.knocked > 0) this.water.soak(car.body);
    for (const rider of this.riders.list) if (rider.knocked > 0) this.water.soak(rider.body);
    if (this.driver.mode !== 'driving' && this.water.under({ x: this.driver.pos.x, y: this.driver.pos.y + 1, z: this.driver.pos.z })) {
      this.driver.fishOut(this.truck, this.cargoSystem);
    }
  }

  /** The water nearest to a point, if the level has any. */
  private nearestPool(p: { x: number; z: number }): PitDesc | null {
    let best: PitDesc | null = null;
    for (const pit of this.level.pits ?? []) {
      if (pit.water === undefined) continue;
      if (!best || Math.abs(pit.pos[1] - p.z) < Math.abs(best.pos[1] - p.z)) best = pit;
    }
    return best;
  }

  private fail(failure: Failure): void {
    this.result ??= { value: 0, fraction: 0, stars: 0, seconds: this.time, failure, tally: this.tally() };
  }

  private checkDelivery(): void {
    const finish = this.level.finish;
    // The driver has to be in the cab: parking in the bay and wandering off doesn't count.
    if (!finish || this.driver.mode !== 'driving') return;
    const t = this.truck.body.translation();
    const inside = Math.abs(t.x - finish.pos[0]) < finish.half[0] && Math.abs(t.z - finish.pos[1]) < finish.half[1];
    this.dwell = inside && Math.abs(this.truck.forwardSpeed()) < DELIVERY_SPEED ? this.dwell + PHYSICS.dt : 0;
    if (this.dwell < DELIVERY_SECONDS) return;

    const value = this.deliverableValue();
    const fraction = value / this.fullValue;
    this.result = {
      value,
      fraction,
      stars: starsFor(this.level, fraction, this.time),
      seconds: this.time,
      tally: this.tally(),
    };
  }
}
