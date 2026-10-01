import RAPIER from '@dimforge/rapier3d-compat';
import { Euler, Quaternion } from 'three';
import { GROUP, PHYSICS, TRUCK, groups } from '../config';
import { CargoSystem, type CargoEvent, type CargoItem } from './cargo';
import { GROUND_HALF, buildCargo, buildProps, type PropDesc } from './sandbox';
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

/** The whole physics world. Has no rendering dependencies, so it also runs headless. */
export class Sim {
  readonly world: RAPIER.World;
  readonly truck: Truck;
  readonly props: PropInstance[] = [];
  readonly cargoSystem: CargoSystem;
  /** Value of the full load when undamaged. */
  readonly fullValue: number;
  private readonly eventQueue: RAPIER.EventQueue;
  private readonly startPoses: Pose[] = [];

  static async create(): Promise<Sim> {
    await RAPIER.init();
    return new Sim();
  }

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
    this.world.timestep = PHYSICS.dt;
    this.world.numSolverIterations = PHYSICS.solverIterations;
    this.eventQueue = new RAPIER.EventQueue(true);

    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(...GROUND_HALF)
        .setTranslation(0, -GROUND_HALF[1], 0)
        .setFriction(0.9)
        .setCollisionGroups(groups(GROUP.ground, GROUP.all)),
    );

    const q = new Quaternion();
    const e = new Euler();
    for (const desc of buildProps()) {
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

    this.truck = new Truck(this.world);
    this.cargoSystem = new CargoSystem(this.world);
    this.cargoSystem.load(buildCargo(), TRUCK.spawn);
    this.fullValue = this.cargo.reduce((sum, item) => sum + item.type.value, 0);
  }

  get cargo(): CargoItem[] {
    return this.cargoSystem.items;
  }

  /** Advance one fixed step of PHYSICS.dt. */
  step(input: DriveInput): void {
    this.truck.update(PHYSICS.dt, input);
    this.world.step(this.eventQueue);
    this.eventQueue.drainContactForceEvents((event) => {
      this.cargoSystem.addForce(event.collider1(), event.collider2(), event.totalForceMagnitude());
    });
    this.cargoSystem.update(this.truck);
  }

  /** Cargo events since the last call: damage, parts coming off, items lost. */
  drainEvents(): CargoEvent[] {
    return this.cargoSystem.drainEvents();
  }

  cargoOnTruck(): number {
    let n = 0;
    for (const c of this.cargo) if (c.body && !c.lost && this.truck.isOnBed(c.body.translation())) n++;
    return n;
  }

  /** What the load is worth right now. */
  cargoValue(): number {
    let sum = 0;
    for (const c of this.cargo) sum += c.value;
    return sum;
  }

  /** Put everything back at the start. Cargo bodies are rebuilt, so views must be too. */
  reset(): void {
    this.truck.reset();
    const zero = { x: 0, y: 0, z: 0 };
    for (const p of this.startPoses) {
      p.body.setTranslation(p.pos, true);
      p.body.setRotation(p.rot, true);
      p.body.setLinvel(zero, true);
      p.body.setAngvel(zero, true);
    }
    this.cargoSystem.load(buildCargo(), TRUCK.spawn);
  }
}
