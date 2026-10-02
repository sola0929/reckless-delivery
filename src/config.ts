// Shared tuning values. Coordinates: Y up, the truck drives toward +Z, +X is its left.

export type Vec3 = [number, number, number];

export const PHYSICS = {
  dt: 1 / 60,
  gravity: -9.81,
  solverIterations: 8,
  maxStepsPerFrame: 4,
};

// Collision group bits.
export const GROUP = {
  ground: 0x0001,
  truck: 0x0002,
  cargo: 0x0004,
  prop: 0x0008,
  person: 0x0010,
  all: 0xffff,
};

export function groups(membership: number, filter: number): number {
  return ((membership << 16) | filter) >>> 0;
}

export const TRUCK = {
  // Colliders, in chassis space. The bed is 2.28 m wide and 5.44 m long inside, with its
  // floor at the top of the frame. The walls are 1 m high: enough to cover the lower half
  // of a second layer of crates, so it survives ordinary driving but not rough handling.
  frame: { half: [1.3, 0.22, 3.7] as Vec3, pos: [0, 0, 0] as Vec3, density: 220 },
  cab: { half: [1.3, 0.8, 0.9] as Vec3, pos: [0, 1.02, 2.8] as Vec3, density: 60 },
  sideWall: { half: [0.08, 0.5, 2.8] as Vec3, pos: [1.22, 0.72, -0.9] as Vec3, density: 100 },
  tailgate: { half: [1.14, 0.5, 0.08] as Vec3, pos: [0, 0.72, -3.62] as Vec3, density: 100 },
  // Share of a wall's height drawn as solid board; the rest is open rails. The collider is solid throughout.
  wallBoard: 0.6,
  bedFriction: 0.9,

  // Volume that counts as "still on the truck", in chassis space.
  bedZone: { min: [-1.45, 0.0, -3.85] as Vec3, max: [1.45, 4, 2.0] as Vec3 },

  wheel: {
    radius: 0.5,
    width: 0.38,
    restLength: 0.42,
    maxTravel: 0.32,
    stiffness: 16,
    compression: 2.4,
    relaxation: 4.0,
    maxSuspensionForce: 100000,
    frictionSlip: 2.2,
    sideFrictionStiffness: 1.0,
    // Front left, front right, rear left, rear right.
    positions: [
      [1.35, 0, 2.6],
      [-1.35, 0, 2.6],
      [1.35, 0, -2.0],
      [-1.35, 0, -2.0],
    ] as Vec3[],
  },

  // Driving feel, as accelerations in m/s² so they stay valid if the truck's mass changes.
  // Cargo starts to slide at about 8 m/s² (0.8 g).
  accel: 6.5,
  boostAccel: 12,
  reverseAccel: 5,
  maxSpeed: 25,
  boostMaxSpeed: 33,
  maxReverseSpeed: 8,
  // Holding the brake ramps from a gentle stop to an emergency stop.
  brakeDecel: 6.5,
  hardBrakeDecel: 14,
  brakeRamp: 0.45,
  // Share of braking done by the front axle.
  brakeFrontBias: 0.6,
  handbrakeDecel: 7,
  rollingDecel: 0.5,
  // Extra height, in metres, at which drive and brake forces act: exaggerates squat and dive.
  pitchLeverage: 0.5,
  // Lying this far over (cosine of the tilt) and still for this long, the truck rights itself.
  overturnedUp: 0.35,
  overturnedSeconds: 1.5,
  maxSteer: 0.6,
  minSteer: 0.16,
  steerRate: 2.4,
};

/** The driver on foot. */
export const DRIVER = {
  radius: 0.3,
  /** Head to toe. */
  height: 1.7,
  walkSpeed: 4,
  runSpeed: 7.5,
  /** The truck must be this slow, m/s, to get out. */
  exitSpeed: 1,
  /** Where the driver steps out, in chassis space, mirrored for the other side. */
  door: [2.3, 0.2, 2.6] as Vec3,
  /** How close to a door to climb back in, and to an item to pick it up. */
  doorReach: 2.4,
  reach: 1.8,
  /**
   * Jumping. The driver falls under heavier gravity than everything else, m/s²: at real
   * gravity a jump hangs in the air for a full second and feels like the moon. With these
   * two it reaches about 1.6 m and lasts about 0.65 s. That clears a car roof (1.5 m) but not
   * the walls of the truck bed (1.94 m). Loads over jumpMaxLoad kg rule it out.
   */
  gravity: 30,
  jumpSpeed: 9.5,
  jumpMaxLoad: 12,
  /** How far from the truck the driver may wander. */
  leash: 35,
  /** Height above the feet at which a load is carried. */
  carryHeight: 2.05,
  /** Speed with a load, walking or running: 1 at no weight, falling to the floor value for heavy loads. */
  carrySlowPerKg: 0.006,
  carrySlowest: 0.6,
  /**
   * Throwing: holding the button pushes the landing point outward at a steady rate, so the
   * feel is the same whatever is being thrown. Heavier loads just top out sooner: the
   * longest range is throwMax for a weightless load, less throwPerKg for each kg, and never
   * below throwShortest. A 10 kg crate reaches about 9 m after 2.3 s.
   */
  throwMin: 1.5,
  throwRate: 3.4,
  throwMax: 12,
  throwPerKg: 0.28,
  throwShortest: 4.5,
  /** Seconds on the ground after being run down, and of safety after getting up. */
  downSeconds: 1.8,
  safeSeconds: 1,
};

export const CAMERA = {
  fov: 50,
  height: 15,
  distance: 9.5,
  heightPerSpeed: 0.3,
  distancePerSpeed: 0.25,
  lookAhead: 3,
  lookAheadPerSpeed: 0.4,
  // Where the camera aims when fully zoomed in: just behind the truck's centre.
  closeLookAhead: -1,
  yawFollow: 2.5,
  speedFollow: 2,
  // How far the camera falls behind per m/s² of acceleration, and how fast it reacts.
  surgeDistance: 0.14,
  surgeFollow: 5,
  surgeLimit: 16,
  // Field of view widens while boosting.
  boostFov: 8,
  fovFollow: 4,
  // Following the driver on foot: how much closer, how fast it closes in, and how long the
  // view takes to slide across when they get out or back in.
  footZoom: 0.72,
  footZoomFollow: 3,
  handoverSeconds: 0.6,
  handoverFollow: 9,
  minZoom: 0.5,
  maxZoom: 2.2,
};
