// The kinds of vehicle in the traffic. Each is solid as two boxes, a lower and an upper,
// which is also roughly how it is drawn: so what can be stood on is what is seen.

export type VehicleKind = 'car' | 'taxi' | 'pickup' | 'bus' | 'garbage';

interface Box {
  half: [number, number, number];
  /** Relative to the middle of the vehicle. */
  pos: [number, number, number];
  massShare: number;
}

export interface VehicleSpec {
  /** Its overall extent: for following distances, and for telling when something is in its way. */
  half: { width: number; height: number; length: number };
  mass: number;
  /** Its own pace, m/s, whatever the lane's: for the one that holds everybody up. */
  crawl?: number;
  boxes: Box[];
}

/** How far above the road the underside of every vehicle is. */
export const CLEARANCE = 0.2;

function spec(width: number, height: number, length: number, mass: number, upper: { width: number; length: number; share: number; z: number }, lowerShare = 0.55, crawl?: number): VehicleSpec {
  const low = height * lowerShare;
  const high = height - low;
  return {
    half: { width, height, length },
    mass,
    crawl,
    boxes: [
      { half: [width, low, length], pos: [0, -height + low, 0], massShare: 0.75 },
      { half: [width * upper.width, high, length * upper.length], pos: [0, height - high, length * upper.z], massShare: 0.25 },
    ],
  };
}

export const VEHICLES: Record<VehicleKind, VehicleSpec> = {
  car: spec(0.9, 0.65, 2.1, 1200, { width: 0.9, length: 0.525, share: 0.25, z: -0.1 }),
  taxi: spec(0.9, 0.65, 2.1, 1200, { width: 0.9, length: 0.525, share: 0.25, z: -0.1 }),
  // A small blue truck: the cab at the front, and a low open bed behind it.
  pickup: spec(0.9, 0.7, 2.2, 1300, { width: 0.95, length: 0.34, share: 0.25, z: 0.6 }, 0.45),
  bus: spec(1.25, 1.45, 5.2, 4500, { width: 0.97, length: 0.98, share: 0.25, z: 0 }, 0.35),
  // The refuse lorry, which goes at a walk with the street behind it.
  garbage: spec(1.2, 1.3, 3.3, 5000, { width: 0.97, length: 0.97, share: 0.25, z: 0 }, 0.35, 2.6),
};
