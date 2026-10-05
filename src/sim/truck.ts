import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { GROUP, TRUCK, groups, type Vec3 } from '../config';

export interface DriveInput {
  /** -1 (brake / reverse) to 1 (accelerate). */
  throttle: number;
  /** -1 (right) to 1 (left). */
  steer: number;
  handbrake: boolean;
  /** Hard acceleration; only applies while throttle is positive. */
  boost?: boolean;
}

const WHEEL_DOWN = { x: 0, y: -1, z: 0 };
const WHEEL_AXLE = { x: -1, y: 0, z: 0 };
// The wheels stand on the ground and on nothing else. Were loose things ground to them, the
// truck would climb onto whatever it hit and sit there instead of shoving it aside.
const WHEEL_RAY_GROUPS = groups(GROUP.all, GROUP.ground);
const TRUCK_GROUPS = groups(GROUP.truck, GROUP.all);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class Truck {
  readonly body: RAPIER.RigidBody;
  readonly controller: RAPIER.DynamicRayCastVehicleController;
  /** True while the boost is actually driving the wheels. */
  boosting = false;
  /** How well the tyres hold the road, 1 normally; less on a slick. Set by whoever knows what the truck is driving on. */
  grip = 1;
  /** How much whatever is under the wheels holds the truck back: 0 on a road, toward 1 in the worst of it. */
  drag = 0;
  /** Whether it runs away down a hill when it is left without the handbrake on. Otherwise it stays wherever it stops. */
  rolls = false;
  private dragged = 0;
  /** 0 when off the brakes, up to 1 for a full emergency stop. */
  brakeLevel = 0;
  private steer = 0;
  private brakeTime = 0;
  /** Seconds spent lying still on its side or roof. */
  private overturned = 0;

  private readonly q = new Quaternion();
  private readonly q2 = new Quaternion();
  private readonly v = new Vector3();
  private readonly v2 = new Vector3();

  /** `heading` is the starting direction: radians about Y, 0 = toward +Z. */
  constructor(world: RAPIER.World, private readonly spawn: Vec3, private readonly heading: number) {
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCanSleep(false));
    this.reset();

    const box = (part: { half: Vec3; pos: Vec3; density: number }, mirrorX = false) => {
      const desc = RAPIER.ColliderDesc.cuboid(...part.half)
        .setTranslation(mirrorX ? -part.pos[0] : part.pos[0], part.pos[1], part.pos[2])
        .setDensity(part.density)
        .setFriction(TRUCK.bedFriction)
        .setCollisionGroups(TRUCK_GROUPS);
      world.createCollider(desc, this.body);
    };
    box(TRUCK.frame);
    box(TRUCK.cab);
    box(TRUCK.sideWall);
    box(TRUCK.sideWall, true);
    box(TRUCK.tailgate);

    this.controller = world.createVehicleController(this.body);
    this.controller.indexUpAxis = 1;
    this.controller.setIndexForwardAxis = 2;

    const w = TRUCK.wheel;
    w.positions.forEach(([wx, wy, wz], i) => {
      this.controller.addWheel({ x: wx, y: wy, z: wz }, WHEEL_DOWN, WHEEL_AXLE, w.restLength, w.radius);
      this.controller.setWheelSuspensionStiffness(i, w.stiffness);
      this.controller.setWheelSuspensionCompression(i, w.compression);
      this.controller.setWheelSuspensionRelaxation(i, w.relaxation);
      this.controller.setWheelMaxSuspensionTravel(i, w.maxTravel);
      this.controller.setWheelMaxSuspensionForce(i, w.maxSuspensionForce);
      this.controller.setWheelFrictionSlip(i, w.frictionSlip);
      this.controller.setWheelSideFrictionStiffness(i, w.sideFrictionStiffness);
    });
  }

  /** Signed speed along the truck's nose, m/s. */
  forwardSpeed(): number {
    const r = this.body.rotation();
    const lv = this.body.linvel();
    this.v.set(0, 0, 1).applyQuaternion(this.q.set(r.x, r.y, r.z, r.w));
    return this.v.x * lv.x + this.v.y * lv.y + this.v.z * lv.z;
  }

  /** Call once per physics step, before world.step(). */
  update(dt: number, input: DriveInput): void {
    const speed = this.forwardSpeed();
    const mass = this.body.mass();
    // Engine force falls off toward top speed, but stays strong through the mid range.
    const pull = (accel: number, v: number, top: number) => accel * mass * Math.max(0, 1 - (v / top) ** 2);
    let engine = 0;
    let braking = false;
    this.boosting = false;

    if (input.throttle > 0) {
      if (speed < -0.5) braking = true;
      else if (input.boost) {
        engine = input.throttle * pull(TRUCK.boostAccel, speed, TRUCK.boostMaxSpeed);
        this.boosting = true;
      } else engine = input.throttle * pull(TRUCK.accel, speed, TRUCK.maxSpeed);
    } else if (input.throttle < 0) {
      if (speed > 0.5) braking = true;
      else engine = input.throttle * pull(TRUCK.reverseAccel, -speed, TRUCK.maxReverseSpeed);
    }

    // A tap brakes gently; holding ramps up to an emergency stop.
    this.brakeTime = braking ? this.brakeTime + dt : 0;
    const ramp = clamp(this.brakeTime / TRUCK.brakeRamp, 0, 1);
    // On a hill, where the level has it so, only the handbrake holds it: let go, it starts to roll and gathers speed.
    const turn = this.body.rotation();
    const hill = this.rolls && !input.handbrake && Math.abs(this.v.set(0, 0, 1).applyQuaternion(this.q.set(turn.x, turn.y, turn.z, turn.w)).y) > TRUCK.rollsAbove;
    const parked = engine === 0 && input.throttle === 0 && Math.abs(speed) < 0.5 && !hill;
    let decel = (hill ? TRUCK.rollingDecelHill : TRUCK.rollingDecel) + TRUCK.coastDrag * Math.abs(speed);
    if (braking) decel = TRUCK.brakeDecel + (TRUCK.hardBrakeDecel - TRUCK.brakeDecel) * ramp;
    else if (parked) decel = TRUCK.hardBrakeDecel;
    else if (engine !== 0) decel = 0;
    this.brakeLevel = braking ? decel / TRUCK.hardBrakeDecel : 0;

    // The controller takes brakes as an impulse per wheel per step.
    const brakeImpulse = decel * mass * dt;
    const frontBrake = (brakeImpulse * TRUCK.brakeFrontBias) / 2;

    // In mud or wire the engine has less to give, and the truck is dragged back the faster it goes.
    engine *= 1 - this.drag * 0.5;
    if (this.drag !== this.dragged) this.body.setLinearDamping((this.dragged = this.drag) * 1.5);

    // Less steering lock at speed, so a full key press doesn't flip the truck.
    const t = clamp(Math.abs(speed) / TRUCK.boostMaxSpeed, 0, 1);
    const target = input.steer * (TRUCK.maxSteer + (TRUCK.minSteer - TRUCK.maxSteer) * t);
    const step = TRUCK.steerRate * dt * (1 - this.drag * 0.45);
    this.steer += clamp(target - this.steer, -step, step);

    const c = this.controller;
    for (let i = 0; i < 4; i++) {
      c.setWheelFrictionSlip(i, TRUCK.wheel.frictionSlip * this.grip);
      c.setWheelSideFrictionStiffness(i, TRUCK.wheel.sideFrictionStiffness * this.grip);
    }
    c.setWheelSteering(0, this.steer);
    c.setWheelSteering(1, this.steer);
    // Rear-wheel drive. A wheel only brakes while its engine force is zero.
    const rearEngine = input.handbrake ? 0 : engine / 2;
    c.setWheelEngineForce(2, rearEngine);
    c.setWheelEngineForce(3, rearEngine);
    c.setWheelBrake(0, frontBrake);
    c.setWheelBrake(1, frontBrake);
    const rearBrake = input.handbrake
      ? (TRUCK.handbrakeDecel * mass * dt) / 2
      : (brakeImpulse * (1 - TRUCK.brakeFrontBias)) / 2;
    c.setWheelBrake(2, rearBrake);
    c.setWheelBrake(3, rearBrake);

    this.applyAsForces(dt, parked, () => c.updateVehicle(dt, undefined, WHEEL_RAY_GROUPS));
  }

  /**
   * The vehicle controller changes the chassis velocity with one impulse per step, while
   * gravity and cargo contacts act continuously across the solver's substeps. That mismatch
   * vibrates the bed and makes resting cargo creep. So take the velocity change the
   * controller wants, undo it, and hand it to the solver as a force and torque instead.
   */
  private applyAsForces(dt: number, parked: boolean, controllerStep: () => void): void {
    const body = this.body;
    const lv0 = body.linvel();
    const av0 = body.angvel();
    controllerStep();
    const lv1 = body.linvel();
    const av1 = body.angvel();

    const k = body.mass() / dt;
    const force = { x: (lv1.x - lv0.x) * k, y: (lv1.y - lv0.y) * k, z: (lv1.z - lv0.z) * k };
    // The brake alone leaves a few mm/s of creep when parked, so pin the truck in place.
    if (parked && Math.hypot(lv0.x, lv0.z) < 0.05) lv0.x = lv0.z = force.x = force.z = 0;

    body.setLinvel(lv0, true);
    body.setAngvel(av0, true);
    body.resetForces(true);
    body.addForce(force, true);

    // Torque = I * (change in angular velocity) / dt, with I diagonal in the principal frame.
    const r = body.rotation();
    const pf = body.principalInertiaLocalFrame();
    const inertia = body.principalInertia();
    const toPrincipal = this.q.set(r.x, r.y, r.z, r.w).multiply(this.q2.set(pf.x, pf.y, pf.z, pf.w));
    const dw = this.v.set(av1.x - av0.x, av1.y - av0.y, av1.z - av0.z);
    dw.applyQuaternion(this.q2.copy(toPrincipal).invert());
    dw.set(dw.x * inertia.x, dw.y * inertia.y, dw.z * inertia.z).applyQuaternion(toPrincipal).divideScalar(dt);

    // Exaggerate squat and dive: treat drive and brake forces as if the centre of mass sat
    // higher than it does. Only along the truck's length, so it doesn't make it roll over.
    this.q.set(r.x, r.y, r.z, r.w);
    const forward = this.v2.set(0, 0, 1).applyQuaternion(this.q);
    const along = force.x * forward.x + force.y * forward.y + force.z * forward.z;
    const side = this.v2.set(1, 0, 0).applyQuaternion(this.q);
    dw.addScaledVector(side, -TRUCK.pitchLeverage * along);

    body.resetTorques(true);
    body.addTorque({ x: dw.x, y: dw.y, z: dw.z }, true);
  }

  /** True once the truck has lain still on its side or roof for long enough to call it overturned. */
  isOverturned(dt: number): boolean {
    const r = this.body.rotation();
    this.q.set(r.x, r.y, r.z, r.w);
    const up = this.v.set(0, 1, 0).applyQuaternion(this.q).y;
    const lv = this.body.linvel();
    const still = Math.hypot(lv.x, lv.y, lv.z) < 1;
    this.overturned = up < TRUCK.overturnedUp && still ? this.overturned + dt : 0;
    return this.overturned >= TRUCK.overturnedSeconds;
  }

  /** Set the truck back on its wheels where it lies, facing the way it was. */
  setUpright(): void {
    const r = this.body.rotation();
    this.q.set(r.x, r.y, r.z, r.w);
    const forward = this.v.set(0, 0, 1).applyQuaternion(this.q);
    const yaw = Math.atan2(forward.x, forward.z);
    const t = this.body.translation();
    const zero = { x: 0, y: 0, z: 0 };
    this.body.setTranslation({ x: t.x, y: t.y + 1, z: t.z }, true);
    this.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    this.body.setLinvel(zero, true);
    this.body.setAngvel(zero, true);
    this.overturned = 0;
  }

  reset(): void {
    const [x, y, z] = this.spawn;
    this.body.setTranslation({ x, y, z }, true);
    this.body.setRotation({ x: 0, y: Math.sin(this.heading / 2), z: 0, w: Math.cos(this.heading / 2) }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.steer = 0;
    this.brakeTime = 0;
    this.overturned = 0;
    this.brakeLevel = 0;
    this.boosting = false;
  }

  /** True if a point on the ground plan lies over the inside of the bed, whatever its height. */
  isOverBed(x: number, z: number): boolean {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.v.set(x - t.x, 0, z - t.z).applyQuaternion(this.q.set(r.x, r.y, r.z, r.w).invert());
    const side = TRUCK.sideWall.pos[0] - TRUCK.sideWall.half[0];
    const back = TRUCK.tailgate.pos[2] + TRUCK.tailgate.half[2];
    const front = TRUCK.cab.pos[2] - TRUCK.cab.half[2];
    return Math.abs(this.v.x) < side && this.v.z > back && this.v.z < front;
  }

  /** True if a world-space point lies inside the cargo bed zone. */
  isOnBed(p: { x: number; y: number; z: number }): boolean {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.v.set(p.x - t.x, p.y - t.y, p.z - t.z).applyQuaternion(this.q.set(r.x, r.y, r.z, r.w).invert());
    const { min, max } = TRUCK.bedZone;
    return (
      this.v.x >= min[0] && this.v.x <= max[0] &&
      this.v.y >= min[1] && this.v.y <= max[1] &&
      this.v.z >= min[2] && this.v.z <= max[2]
    );
  }
}
