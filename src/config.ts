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
  all: 0xffff,
};

export function groups(membership: number, filter: number): number {
  return ((membership << 16) | filter) >>> 0;
}

export const TRUCK = {
  spawn: [0, 0.9, 0] as Vec3,

  // Colliders, in chassis space. The bed is 2.28 m wide and 5.44 m long inside,
  // with its floor at the top of the frame.
  frame: { half: [1.3, 0.22, 3.7] as Vec3, pos: [0, 0, 0] as Vec3, density: 220 },
  cab: { half: [1.3, 0.8, 0.9] as Vec3, pos: [0, 1.02, 2.8] as Vec3, density: 60 },
  sideWall: { half: [0.08, 0.35, 2.8] as Vec3, pos: [1.22, 0.57, -0.9] as Vec3, density: 100 },
  tailgate: { half: [1.14, 0.35, 0.08] as Vec3, pos: [0, 0.57, -3.62] as Vec3, density: 100 },
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
  maxSteer: 0.6,
  minSteer: 0.16,
  steerRate: 2.4,
};

export const CAMERA = {
  fov: 50,
  height: 15,
  distance: 9.5,
  heightPerSpeed: 0.3,
  distancePerSpeed: 0.25,
  lookAhead: 3,
  lookAheadPerSpeed: 0.4,
  yawFollow: 2.5,
  speedFollow: 2,
  // How far the camera falls behind per m/s² of acceleration, and how fast it reacts.
  surgeDistance: 0.14,
  surgeFollow: 5,
  surgeLimit: 16,
  // Field of view widens while boosting.
  boostFov: 8,
  fovFollow: 4,
  minZoom: 0.5,
  maxZoom: 2.2,
};
