import RAPIER from '@dimforge/rapier3d-compat';
import { Euler, Quaternion } from 'three';
import { GROUP, PHYSICS, groups } from '../config';
import { sandbox } from '../levels/sandbox';
import type { LevelDef, PropDesc } from '../levels/types';
import { CargoSystem, type CargoEvent, type CargoItem } from './cargo';
import { Driver, NO_FOOT_INPUT, type FootInput } from './driver';
import { Traffic } from './traffic';
import { Truck, type DriveInput } from './truck';

export interface PropInstance {
  desc: PropDesc;
  body: RAPIER.RigidBody;
}

interface Pose {
  body: RAPIER.RigidBody;
  pos: RAPIER.Vector;
  rot: RAPIER.Rotation;
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
  /** The run ended because the truck overturned. */
  overturned?: boolean;
}

const GROUND_THICKNESS = 0.5;
/** The truck must sit this still, for this long, inside the bay to deliver. */
const DELIVERY_SPEED = 0.6;
const DELIVERY_SECONDS = 0.6;
const PARKED: DriveInput = { throttle: 0, steer: 0, handbrake: true };

/** The whole physics world for one level. Has no rendering dependencies, so it also runs headless. */
export class Sim {
  readonly world: RAPIER.World;
  readonly truck: Truck;
  readonly props: PropInstance[] = [];
  readonly cargoSystem: CargoSystem;
  readonly traffic: Traffic;
  readonly driver: Driver;
  /** Value of the full load when undamaged. */
  readonly fullValue: number;
  /** Seconds driven so far; stops at delivery. */
  time = 0;
  /** How many times the truck has been set back on its wheels after overturning. */
  rightings = 0;
  /** Set once the load has been delivered. */
  result: Result | null = null;
  private dwell = 0;
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

    const { center, half } = level.ground;
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(half[0], GROUND_THICKNESS, half[1])
        .setTranslation(center[0], -GROUND_THICKNESS, center[1])
        .setFriction(0.9)
        .setCollisionGroups(groups(GROUP.ground, GROUP.all)),
    );

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
    this.driver = new Driver(this.world);
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
    this.truck.update(PHYSICS.dt, driving ? input : PARKED);
    this.driver.update(PHYSICS.dt, foot, this.truck, this.cargoSystem, this.traffic, !this.result);
    if (this.truck.isOverturned(PHYSICS.dt)) this.overturn();
    this.traffic.update(PHYSICS.dt, this.truck);
    this.world.step(this.eventQueue);
    this.eventQueue.drainContactForceEvents((event) => {
      this.cargoSystem.addForce(event.collider1(), event.collider2(), event.totalForceMagnitude());
    });
    this.cargoSystem.update(this.truck);
    if (!this.result) {
      this.time += PHYSICS.dt;
      this.checkDelivery();
    }
  }

  /** Cargo events since the last call: damage, parts coming off, items lost. */
  drainEvents(): CargoEvent[] {
    return this.cargoSystem.drainEvents();
  }

  cargoOnTruck(): number {
    let n = 0;
    for (const c of this.cargo) if (c.body && !c.held && this.truck.isOnBed(c.body.translation())) n++;
    return n;
  }

  /** What is aboard is worth right now. Anything that has fallen off is left out until it is brought back. */
  cargoValue(): number {
    let sum = 0;
    for (const c of this.cargo) if (!c.fallen) sum += c.value;
    return sum;
  }

  /** What would be handed over if the truck delivered this instant: only what is on the bed. */
  deliverableValue(): number {
    let sum = 0;
    for (const c of this.cargo) if (c.body && !c.held && this.truck.isOnBed(c.body.translation())) sum += c.value;
    return sum;
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
    this.truck.reset();
    this.traffic.reset();
    const zero = { x: 0, y: 0, z: 0 };
    for (const p of this.startPoses) {
      p.body.setTranslation(p.pos, true);
      p.body.setRotation(p.rot, true);
      p.body.setLinvel(zero, true);
      p.body.setAngvel(zero, true);
    }
    this.cargoSystem.load(this.level.cargo, this.level.spawn, this.level.heading);
    this.driver.reset();
    this.time = 0;
    this.rightings = 0;
    this.dwell = 0;
    this.result = null;
  }

  /** An overturned truck ends the run. In free play there is no run to end, so it is set back on its wheels. */
  private overturn(): void {
    if (this.level.finish) {
      this.result ??= { value: 0, fraction: 0, stars: 0, seconds: this.time, overturned: true };
      return;
    }
    this.truck.setUpright();
    this.rightings++;
    this.cargoSystem.clearFootprint(this.truck);
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
      stars: this.level.stars.filter((needed) => fraction >= needed).length,
      seconds: this.time,
    };
  }
}
