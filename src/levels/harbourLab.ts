import { standardLoad } from './sandbox';
import type { ObjectDesc } from './objects';
import { type DecalDesc, type LevelDef, type PitDesc, type PropDesc, type RigDesc, type WaveDesc, STARS } from './types';

// A proving ground for level 4, the harbour in a typhoon: what moves under the truck on the water, at the sizes the level
// is to have, one after another going north, under a storm sky in the rain.
//
//   A  gangway and pontoon   a 25 m ramp from the quay down to a pontoon that rises and falls on the swell
//   B  boats lashed together four fishing boats side by side, each rocking on its own, crossed on plates from one to the next;
//                            a short gangway up from the last to the quay
//   C  ship                  a ship along the quay, rolling slowly: up its stern ramp, along one side of its hatches, round
//                            at the bow and back down the other side
//   D  boardwalk            out over the water on piles, 170 m: a wide way with bends and a narrow one off it, waves now
//                            and then; a big one throws a moored boat down on the wide way ahead, breaking it
//
// The quay is the ground, at nought; the harbour water three metres below it.

const WATER = -3;

export function harbourLab(): LevelDef {
  const pits: PitDesc[] = [
    { pos: [0, 47], half: [30, 47], depth: 8, water: -WATER },
    { pos: [0, 164], half: [30, 50], depth: 8, water: -WATER },
  ];
  const rigs: RigDesc[] = [];
  const add = (rig: RigDesc) => rigs.push(rig) - 1;

  // A: the pontoon, and the gangway down to it.
  const pontoon = add({ kind: 'float', hull: 'pontoon', pos: [0, -2.4, 35], yaw: 0, half: [4.5, 0, 10], heave: 0.4, roll: 0.02, pitch: 0.015, period: 6, phase: 0 });
  add({ kind: 'gangway', pos: [0, 0, 0.5], yaw: 0, half: [2.2, 0, 0], long: 25, rests: pontoon, period: 1, phase: 0 });

  // B: four boats, their lengths across the way, beam to beam half a metre apart; each beam room for the truck to stop on.
  const colors = [0x2f6fb0, 0xd23c2c, 0x2e9a6a, 0xe0a020];
  let last = 0;
  [50.3, 60.4, 70.5, 80.6].forEach((z, n) => {
    last = add({ kind: 'float', hull: 'boat', pos: [0, [-2.2, -1.75, -2.35, -1.9][n], z], yaw: Math.PI / 2, half: [4.8, 0, 9], heave: 0.3, roll: 0.07, pitch: 0.02, color: colors[n], period: [4.2, 5.1, 4.6, 5.6][n], phase: [0, 0.35, 0.7, 0.15][n] });
  });
  add({ kind: 'gangway', pos: [0, 0, 94], yaw: Math.PI, half: [2.2, 0, 0], long: 9.5, rests: last, period: 1, phase: 0 });

  // C: the ship, its stern ramp down onto the quay.
  add({ kind: 'float', hull: 'ship', pos: [0, 2, 164], yaw: 0, half: [14, 0, 45], heave: 0.35, roll: 0.14, lurch: 0.45, pitch: 0.02, ramp: [9, 2], period: 7, phase: 0,
    // Containers loose along the way up the port side, light and heavy: each off in its turn, at its own pace.
    loose: [[-1, -26, 0.1], [-1, -12, 0.9], [-1, 2, 0.4], [-1, 16, 0.65]] });

  // The quay's edge marked, and bollards along it.
  const props: PropDesc[] = [];
  const decals: DecalDesc[] = [];
  const objects: ObjectDesc[] = [];
  const waves: WaveDesc[] = [];

  // D: the boardwalk out over the water on its piles, 170 m from the quay to the far quay: a wide way with bends, and a
  // narrow one off it. A wave comes in from the sea now and then and shoves across it. Coming up to the fork, a big one
  // takes up the fishing boat moored alongside and throws it down on the wide way ahead, which gives way under it: the
  // narrow one round is the way on.
  pits.push({ pos: [0, 314], half: [58, 86], depth: 8, water: -WATER });
  // Low lengths a metre and a half down, near the water, which the waves come over; high ones at the quay's level, and
  // the narrow way a little under it, dry.
  const WIDE = 6.5, NARROW = 4.5, HIGH = 0, LOW = -1.5, UP = -0.6;
  const wash: { pos: [number, number]; half: [number, number]; yaw: number }[] = [];
  // A length of it from a to b, at a height, or sloping from one to another: level for so far at either end, to meet the
  // square at a bend at the same height, and sloping between.
  const piece = (a: [number, number], b: [number, number], wide: number, ha: number, hb: number, breaks?: number) => {
    const long = Math.hypot(b[0] - a[0], b[1] - a[1]), pos: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
    // What the waves come over, in short lengths, so that what is in the lee of something stays dry.
    const n = Math.ceil(long / 4);
    if (ha === LOW && hb === LOW) for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n - 0.5;
      wash.push({ pos: [pos[0] + (b[0] - a[0]) * f, pos[1] + (b[1] - a[1]) * f], half: [wide / 2, long / n / 2], yaw });
    }
    return add({ kind: 'float', hull: 'walk', pos: [pos[0], (ha + hb) / 2, pos[1]], yaw, half: [wide / 2, 0, long / 2], rise: hb - ha, period: 1, phase: 0, breaks });
  };
  const walk = (a: [number, number], b: [number, number], wide: number, h: number | [number, number], { ends = [0, 0], breaks }: { ends?: [number, number]; breaks?: number } = {}) => {
    const [ha, hb] = typeof h === 'number' ? [h, h] : h;
    if (ha === hb) return piece(a, b, wide, ha, hb, breaks);
    const long = Math.hypot(b[0] - a[0], b[1] - a[1]), at = (d: number): [number, number] => [a[0] + ((b[0] - a[0]) * d) / long, a[1] + ((b[1] - a[1]) * d) / long];
    if (ends[0] > 0) piece(a, at(ends[0]), wide, ha, ha);
    if (ends[1] > 0) piece(at(long - ends[1]), b, wide, hb, hb);
    return piece(at(ends[0]), at(long - ends[1]), wide, ha, hb);
  };
  // Where the way bends: a square of decking over the joint.
  const pad = (at: [number, number], wide: number, yaw: number, h: number) => {
    const half = wide / 2 + 0.4;
    if (h === LOW) wash.push({ pos: at, half: [half, half], yaw });
    add({ kind: 'float', hull: 'walk', pos: [at[0], h - 0.01, at[1]], yaw, half: [half, 0, half], period: 1, phase: 0 });
  };
  // Down off the quay to the low way along the water; the anglers' place on it.
  walk([0, 227], [0, 243], WIDE, [HIGH, LOW]);
  walk([0, 243], [0, 258], WIDE, LOW);
  pad([0, 258], WIDE, 0.23, LOW);
  walk([0, 258], [12, 282], WIDE, LOW);
  pad([12, 282], WIDE, 0.23, LOW);
  walk([12, 282], [12, 298], WIDE, LOW);
  // The boat moored alongside the wide way, and the stretch of it it comes down on: lifted on the swell of a big wave
  // called for as the truck comes down off the quay, over the deck at the top of it, down on it as it breaks.
  const boat = add({ kind: 'float', hull: 'boat', pos: [23.5, -2.2, 307], yaw: 0, half: [3, 0, 9], heave: 0.3, roll: 0.07, pitch: 0.02, color: 0x2e9a6a, period: 5, phase: 0.3,
    surge: { at: [2, 262], reach: 8, to: [12.5, LOW - 0.7, 307], yaw: 0.45, roll: 0.32, lift: 3.2, seconds: 2.4 } });
  walk([12, 298], [12, 316], WIDE, LOW, { breaks: boat });
  walk([12, 316], [12, 330], WIDE, LOW);
  pad([12, 330], WIDE, -0.25, LOW);
  // Low on along the water to the far quay, and up to it at the very end.
  walk([12, 330], [0, 352], WIDE, LOW);
  pad([0, 352], WIDE, -0.25, LOW);
  walk([0, 352], [0, 385], WIDE, LOW);
  walk([0, 385], [0, 401], WIDE, [LOW, HIGH]);
  // The narrow way: off the wide one before the boat, up on taller piles, round to the west of it, and down again onto
  // it after. Dry up there, but narrow and with nothing at its edges.
  pad([9.6, 291], NARROW, -0.96, LOW);
  walk([9.6, 291], [-1, 298], NARROW, [LOW, UP], { ends: [2.6, 2.6] });
  pad([-1, 298], NARROW, -0.5, UP);
  walk([-1, 298], [-1, 310], NARROW, UP);
  pad([-1, 310], NARROW, 0.6, UP);
  walk([-1, 310], [9.6, 320], NARROW, [UP, LOW], { ends: [2.6, 2.6] });
  pad([9.6, 320], NARROW, 0.8, LOW);
  // Boats moored along the narrow way, rocking; nothing to stop a truck going over the edge between them.
  add({ kind: 'float', hull: 'boat', pos: [-9, -2.1, 304], yaw: 0, half: [2.6, 0, 7.5], heave: 0.25, roll: 0.07, pitch: 0.02, color: 0x2f6fb0, period: 4.6, phase: 0.1 });
  add({ kind: 'float', hull: 'boat', pos: [-9.5, -2.0, 322], yaw: 0.1, half: [2.6, 0, 7.5], heave: 0.25, roll: 0.07, pitch: 0.02, color: 0xe0a020, period: 5.3, phase: 0.6 });
  // The coastguard's car on the quay at the start; the anglers' things down on the low way, where the waves get at them;
  // the sea's leavings along it.
  props.push({ shape: 'box', size: [0.95, 0.7, 2.3], pos: [-2.2, 0.75, 222], color: 0xeef0f2 });
  props.push({ shape: 'box', size: [0.97, 0.12, 2.32], pos: [-2.2, 1.0, 222], color: 0x2a5aa8 });
  props.push({ shape: 'box', size: [0.5, 0.08, 0.12], pos: [-2.2, 1.52, 221.6], color: 0xd23c2c });
  for (const [x, z] of [[1.9, 248], [1.1, 249.5], [2.3, 251.2], [0.6, 247.2]]) objects.push({ kind: 'chair', pos: [x, LOW, z], rotY: x });
  objects.push({ kind: 'umbrella', pos: [1.8, LOW, 249.8] }, { kind: 'box', pos: [0.4, LOW, 250.6] }, { kind: 'box', pos: [2.6, LOW, 253] });
  objects.push({ kind: 'driftwood', pos: [6.5, LOW, 271], rotY: 1.0, rolls: true }, { kind: 'fishTank', pos: [14, LOW, 296], rotY: 0.3 });
  objects.push({ kind: 'box', pos: [-1.6, UP, 303] }, { kind: 'box', pos: [-1.2, UP, 305.5] }, { kind: 'driftwood', pos: [12.5, LOW, 325], rotY: -0.5, rolls: true });
  objects.push({ kind: 'fishTank', pos: [8.5, LOW, 336], rotY: -0.4 }, { kind: 'driftwood', pos: [3.6, LOW, 346], rotY: 0.9, rolls: true });
  // What stands between the low way and the sea, each a different thing, the gaps between them to be got across between
  // waves: a breakwater of tetrapods heaped at the bend; a net shed on piles after the fork. (The green boat shelters the
  // stretch it lies off, until it is thrown.)
  for (const [x, z, r] of [[19, 273, 0.3], [20.5, 275.5, 1.1], [18.6, 278, 2.0], [20, 280.5, 0.7], [18.8, 283, 1.6], [20.4, 285.5, 0.2], [19.2, 288, 1.3], [19.6, 276.8, 0.9], [19.4, 282, 2.4], [19.8, 286.7, 0.5]]) {
    // Each a tetrapod as near as boxes go: a block and its legs out, grey concrete, half out of the water.
    props.push({ shape: 'box', size: [1.1, 1.1, 1.1], pos: [x, -0.9 + (z % 2) * 0.4, z], rot: [r, r * 1.7, r * 0.6], color: 0x9a9c98 });
    props.push({ shape: 'box', size: [0.45, 1.6, 0.45], pos: [x, -0.5 + (z % 2) * 0.4, z], rot: [r * 0.8, r, r * 1.3], color: 0x8e908c });
  }
  // The net shed: on its own piles off the way, its long wall to the sea, its roof over; nets and floats hung on it.
  for (const z of [317, 321, 325, 329, 333]) for (const x of [17, 20]) props.push({ shape: 'box', size: [0.18, 2.2, 0.18], pos: [x, -1.4, z], color: 0x3e3428 });
  props.push({ shape: 'box', size: [1.7, 0.12, 8.6], pos: [18.5, 0.2, 325], color: 0x6e5a42 });
  props.push({ shape: 'box', size: [0.1, 1.4, 8.4], pos: [20, 1.7, 325], color: 0x5f7f8a });
  props.push({ shape: 'box', size: [0.1, 1.4, 8.4], pos: [17, 1.7, 325], color: 0x5f7f8a });
  props.push({ shape: 'box', size: [2.0, 0.08, 8.9], pos: [18.5, 3.2, 325], rot: [0, 0, 0.12], color: 0xa04a32 });
  for (const z of [319, 322.5, 326, 329.5]) props.push({ shape: 'sphere', size: [0.28, 0.28, 0.28], pos: [16.8, 1.6, z], color: 0xe07020 });
  // On the last low stretch, a boat moored alongside on the sea side; and the fishermen's place on the way, selling the
  // catch and drying it: a stall and its stools, tanks of live fish one side then the other, a row of drying racks,
  // drums of water and fish boxes stacked, to be wound through as the waves come over.
  objects.push({ kind: 'fishStall', pos: [-1.1, LOW, 356], rotY: 0 }, { kind: 'stool', pos: [-0.6, LOW, 354.9] }, { kind: 'stool', pos: [-1.6, LOW, 357.1] });
  objects.push({ kind: 'fishTank', pos: [0.9, LOW, 363], rotY: 0 }, { kind: 'fishTank', pos: [-0.9, LOW, 377.5], rotY: 0 });
  for (const z of [366, 368.4, 370.8]) objects.push({ kind: 'dryingRack', pos: [-1.2, LOW, z], rotY: 0 });
  objects.push({ kind: 'waterDrum', pos: [0.8, LOW, 371.5] }, { kind: 'waterDrum', pos: [1.5, LOW, 372.3] }, { kind: 'waterDrum', pos: [0.7, LOW, 373.2] });
  for (const [x, z] of [[0.9, 382], [1.5, 382.2], [0.8, 383.2], [1.6, 383.4]]) objects.push({ kind: 'box', pos: [x, LOW, z] });
  add({ kind: 'float', hull: 'boat', pos: [6.4, -2.1, 360], yaw: -0.03, half: [2.8, 0, 8.5], heave: 0.3, roll: 0.07, pitch: 0.02, color: 0x2f8fa0, period: 4.9, phase: 0.2 });
  waves.push({ from: [17, 227], to: [17, 401], inland: [-1, 0], reach: 40, period: 6, phase: 0.1, big: 4, force: 1, piles: true, wash, y: LOW,
    lee: [[45, 62], [71, 89], [89, 106], [123, 143]] });
  for (const z of [0, 94, 114]) decals.push({ pos: [0, z + (z === 0 ? -0.3 : 0.3)], size: [60, 0.3], color: 0xe0b020 });
  for (const z of [0, 94, 114]) for (const x of [-24, -16, -8, 8, 16, 24]) props.push({ shape: 'cylinder', size: [0.25, 0.4, 0], pos: [x, 0.4, z + (z === 0 ? -0.8 : 0.8)], color: 0x2a2c30 });

  return {
    id: 'harbourlab',
    name: '第四關試驗場',
    brief: '會晃的浮動碼頭、並排漁船、大船甲板、會被浪打斷的木棧道，在颱風天的雨裡：按數字鍵跳到各站',
    ground: { center: [0, 181], half: [60, 241], style: 'asphalt' },
    light: 'storm',
    decks: true,
    pits,
    waves,
    objects,
    bounds: [[-58, -50], [58, 420]],
    spawn: [0, 0.9, -24],
    heading: 0,
    props,
    decals,
    cargo: standardLoad(),
    traffic: [],
    rigs,
    route: [[0, -24], [0, 410]],
    checkpoints: [
      { name: 'A 跳板', pos: [0, -14], yaw: 0 },
      { name: 'B 漁船', pos: [0, 35], yaw: 0, y: -2.4 },
      { name: 'C 大船', pos: [0, 100], yaw: 0 },
      { name: 'C 甲板', pos: [-8, 134], yaw: 0, y: 2 },
      { name: 'D 木棧道', pos: [0, 220], yaw: 0 },
    ],
    // Behind where it starts: the lab is not to be finished, but has a finish, so that falling in the water ends the run.
    finish: { pos: [0, -44], half: [4, 4] },
    stars: STARS,
    par: 600,
  };
}
