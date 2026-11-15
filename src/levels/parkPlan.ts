import { wayPoints, type PlanPiece, type ProfilePoint } from './parkParts';
import type { P2 } from './relief';
import type { Vec2 } from './types';

// Level 5, 幸福島樂園: where everything in the park is. The park lies round a lake, its rides round the shore; the way
// goes in at the gate on the south, round the lake the way the clock's hands go, and out at the back of the pirate
// restaurant on the south-east. Z is north; X is west, as the minimap and the driver see it (the minimap draws X growing
// to the left): east is toward less X. The squares are 16 m.
//
//   1  in              the coaches' bay, the queue for the gate across its yard, the gate, the main street, the hub
//   2  the teacups     west from the hub across three turntables, one after another; out, and north up a narrow way
//   3  the coaster     up the station's ramp onto the track: the lift, the drop into the mine, round its bend
//                      east inside the rock and down off the brake run
//   4  the north shore east along the lake, between the stage and the ferris wheel and the water: the calm stretch
//   5  the wave pool   east across its shallows as its waves come in from the machine house on the north
//   6  the slide       up the lift south along the east shore, down the big slide into its splash pool
//   7  the pirate bay  south under the swinging ships, the games stalls either side; past the restaurant to its back door

export const CELL = 16;
const P = Math.PI;

/** The gate: the middle of its arch. The queue's yard south of it, outside the park; the main street north of it. */
export const GATE: Vec2 = [200, 168];
export const STREET = { x0: 192, x1: 208, z0: GATE[1] + 3, z1: 216 };
/** The hub, the carousel in its middle, and how far out its paving goes. */
export const HUB: Vec2 = [200, 240];
export const HUB_R = 24;

/**
 * The teacups' tables, as the way comes to them, west from the hub: their middles, how fast each turns which way (radians a
 * second), how many cups on it, how big it is. Rim to rim but for a sill between, as gears mesh: each turning against the
 * next, and their rims at one speed, so that where two meet both go the same way. Small, larger, largest.
 */
export const TABLES: [number, number, number, number, number][] = [[249.35, 240, 0.3, 3, 9.9], [271.65, 234, -0.19, 4, 12.4], [299.1, 240, 0.15, 4, 14.9]];
/** How each stands at first, radians: set so that the cups of one and the next come by where they meet together, and leave it clear together. */
export const TEA_TURN = [0, 1.0, 0.15];
/** The planters round each, so far out from its rim; half the width of the gaps in them where the way goes on and off, metres. */
export const TEA_EDGE = 1.2;
export const TEA_MOUTH = 5.4;
/** How far from a table's middle its planters are. */
export const teaFence = (k: number): number => TABLES[k][4] + TEA_EDGE;

/**
 * The coaster: its way, from the foot of the ramp up to its station to the foot of the ramp down off its brake run. North
 * up the lift and the first drop; into the mine's rock, east out of the ring through the old mine; out of it the brakes,
 * and down on to the north shore. Short: the user found the longer one, with its helix and its hill, too long. From
 * its station to the foot of its drop it is the ring's own track, and the train comes round on it.
 */
export const COASTER_AT: Vec2 = [332, 266];
export const COASTER_PLAN: PlanPiece[] = [{ long: 156 }, { radius: 11, turn: P }, { long: 7 }, { radius: 11, turn: P / 2 }, { long: 70 }];
export const COASTER_PROFILE: ProfilePoint[] = [[0, 0], [8, 1.2, 4], [50, 1.2, 8], [94, 11.1, 12], [99, 11.1, 12], [126, 3.0, 10], [141, 7.0, 12], [156, 3.0, 10], [190, 1.8, 8], [219, 1.5, 8], [240, 1.0, 8], [251, 1.0, 6], [262, 0, 6], [284.9, 0]];
/**
 * The ring its trains run round, on and on, and the truck's way with it for as much of it as may be. From where the truck's
 * way joins it (`RING_JOIN` metres along the truck's way is nought along the ring): north through the station, up the lift,
 * down the drop, over the camelback, into the mine and round inside it to the south, coming down (so far one track with the
 * truck's way, so the same heights). `RING_PART` metres along it the truck's way turns off east, out by the mine's old
 * level under the camelback to the shore; the ring goes on south out of the mine, through its loop (stepped aside by
 * `LOOP.shift` as it goes over), over a last hill and round on its brakes to the station. In two lengths: up to the loop,
 * and from it.
 */
export const RING_JOIN = 29, RING_PART = 127 + 11 * P + 7;
export const RING_AT: Vec2 = [COASTER_AT[0], COASTER_AT[1] + RING_JOIN];
export const RING_A = wayPoints(RING_AT, 0, [{ long: 127 }, { radius: 11, turn: P }, { long: 50 }], [[0, 1.2], [21, 1.2, 8], [65, 11.1, 12], [70, 11.1, 12], [97, 3.0, 10], [112, 7.0, 12], [127, 3.0, 10], [161, 1.8, 8], [190, 1.5, 8], [211.6, 1.5]], 1);
export const LOOP = { radius: 7.5, shift: 4.8 };
const loopAt = RING_A[RING_A.length - 1];
export const RING_B_AT: Vec2 = [loopAt.x + LOOP.shift, loopAt.z];
export const RING_B_PLAN: PlanPiece[] = [{ long: loopAt.z - RING_AT[1] }, { radius: (loopAt.x + LOOP.shift - RING_AT[0]) / 2, turn: P }];
export const RING_B_PROFILE: ProfilePoint[] = [[0, 1.5], [10, 1.5, 8], [35, 5.0, 10], [55, 3.0, 10], [77, 2.0, 8], [100, 1.2, 8], [119.2, 1.2]];
export const RING_B = wayPoints(RING_B_AT, P, RING_B_PLAN, RING_B_PROFILE, 1);
/** A butte of the mine's red rock, west of it: to look at. */
export const BUTTE: Vec2 = [378, 416];
export const RIDE = wayPoints(COASTER_AT, 0, COASTER_PLAN, COASTER_PROFILE, 1);
export const RIDE_END = RIDE[RIDE.length - 1];
/** Metres along it: the station, the lift, the tunnel through the rock, the brake run. */
export const STATION: [number, number] = [30, 50];
export const LIFT: [number, number] = [50, 94];
export const TUNNEL: [number, number] = [159, 240];
export const BRAKES: [number, number] = [248, 262];

/** The north shore's way and the wave pool's lane, one line east along the lake: its middle (Z). */
export const SHORE_Z = Math.round(RIDE_END.z);
/** The north shore, east from the foot of the coaster's last ramp (its X the larger) to the wave pool's ramp down into it. */
export const SHORE = { x0: 180, x1: RIDE_END.x };
/** The wave pool, its east end and its west (the way goes east, toward less X), and across it from the lane's middle: the machine house's face on the north, the deep
 * water's edge, the lane's two sides, where the beach begins, where it ends at its wall above the lake. */
export const POOL = { x0: 106, x1: 170 };
export const WAVE_HOUSE = SHORE_Z + 36, SHELF = SHORE_Z + 18, LANE_N = SHORE_Z + 6, LANE_S = SHORE_Z - 6, BEACH = SHORE_Z - 15, BEACH_END = SHORE_Z - 30;
export const POOL_WATER = -0.1;

/** The raft lift south down the east shore, from its foot to the tower; the tower's deck; the slide's top, 12 m up. */
export const LIFT_X = 83;
export const TOP = 12;
export const LIFT_FOOT = SHORE_Z - 16;
export const TOWER = { z0: LIFT_FOOT - 72 - 14, z1: LIFT_FOOT - 72 };
/** The big slide: from the tower south, round east, back west in a tube, down into the splash pool. */
export const SLIDE_PLAN: PlanPiece[] = [{ long: 10 }, { radius: 18, turn: P / 2 }, { long: 25 }, { radius: 18, turn: -P }, { long: 30 }, { long: 12 }];
export const SLIDE_PROFILE: ProfilePoint[] = [[0, TOP], [10, TOP, 6], [38, 9.0, 8], [63, 5.6, 10], [120, 2.2, 10], [150, 0.4, 6], [161.5, 0.0]];
export const SLIDE_TUBE: [number, number] = [70, 112];
export const SLIDE = wayPoints([LIFT_X, TOWER.z0], P, SLIDE_PLAN, SLIDE_PROFILE, 1);
export const SLIDE_END = SLIDE[SLIDE.length - 1];
/** The splash pool at its foot, on west from it: how long the pool is, the ramp up out of it, half its width. */
export const SPLASH = { long: 20, ramp: 12, half: 11 };

/** The pirate ships, a lane under each, swinging along the way south; the truck's lane is under the western one (more X). */
export const SHIPS: Vec2 = [136.3, 176];
export const PIRATE_LANE = 140;
/** The pirate restaurant, east of the lane (less X) at the bay's south end; its back door on its south side, onto the yard. */
export const RESTAURANT = { x0: 92, x1: 130, z0: 96, z1: 126 };
export const FINISH: Vec2 = [112, 84];

/** The lake: its shore round, corner by corner; the canal south out of it between the hub and the pirate bay. */
export const LAKE: P2[] = ([
  [138, 270], [276, 270], [342, 270], [350, 278], [350, 364], [342, 372], [278, 372], [270, 380], [270, 392], [140, 392], [130, 382], [130, 278],
] as P2[]).map(([x, z]): P2 => [448 - x, z]).reverse();
export const CANAL = { x0: 162, x1: 172, z0: 176, z1: 272 };
export const ISLAND: Vec2 = [214, 328];
export const ISLAND_R = 22;
export const LAKE_BED = -1.8;
export const LAKE_WATER = -0.35;

/** The map's corners: the least X and Z, the most. */
export const MIN: Vec2 = [0, 0];
export const MAX: Vec2 = [448, 464];
