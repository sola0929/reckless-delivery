// Level 4's way over the market's roof, headless: from the top of the billboard over the two ridges, round on the plant
// deck, down the valley and round along the joint to the canopy, at steady speeds, steered by looking ahead along the way;
// HUMAN=1 a fifth of a second late. Then: straight on over the first crest into its skylight; up the valley's side into
// one; stopped on a ridge's slope and away again.
// Down: from the joint down the canopy's fallen end bay, round on the dock and along it to the ramp off it.
// Ice: from the dock through the ice plant's yard round the lorry's west and its east, up the ramp, through the gate.
// npx tsx dev/harbour-mroof.ts [way|skylights|down|ice|restart]
import { harbour } from '../src/levels/harbour';
import { JOINT, MARKET_ROOF_WAY } from '../src/levels/harbourMarketRoof';
import { ICE_WAY, ICE_WAY_EAST } from '../src/levels/harbourIce';
import { Sim } from '../src/sim/sim';
import type { Vec2 } from '../src/levels/types';

const level = harbour();
const what = process.argv[2] ?? 'way';

function follower(way: Vec2[]) {
  const lengths = way.slice(1).map((p, k) => Math.hypot(p[0] - way[k][0], p[1] - way[k][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  const along = (s: number): Vec2 => {
    for (let k = 0; k < lengths.length; k++) {
      if (s <= lengths[k] || k === lengths.length - 1) {
        const t = Math.min(1, s / lengths[k]);
        return [way[k][0] + (way[k + 1][0] - way[k][0]) * t, way[k][1] + (way[k + 1][1] - way[k][1]) * t];
      }
      s -= lengths[k];
    }
    return way.at(-1)!;
  };
  const nearest = (x: number, z: number) => {
    let best = 0, bestD = Infinity, base = 0;
    for (let k = 0; k < lengths.length; k++) {
      const [ax, az] = way[k], [bx, bz] = way[k + 1], dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengths[k] ** 2));
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < bestD) { bestD = d; best = base + t * lengths[k]; }
      base += lengths[k];
    }
    return best;
  };
  return { total, along, nearest };
}

async function drive(name: string, way: Vec2[], wanted: number | ((x: number, z: number) => number), start: [number, number, number, number], look = 6) {
  const sim = await Sim.create(level);
  sim.teleport(start[0], start[1], start[2], start[3]);
  for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const f = follower(way);
  const seen: number[] = [];
  let top = 0, still = 0, s = 0;
  for (let i = 0; i < 60 * 90 && !sim.result; i++) {
    const p = sim.truck.body.translation(), r = sim.truck.body.rotation();
    s = f.nearest(p.x, p.z);
    if (s > f.total - 2) break;
    const [ax, az] = f.along(s + look);
    const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
    const off = Math.atan2(fx * (az - p.z) - fz * (ax - p.x), fx * (ax - p.x) + fz * (az - p.z));
    const speed = sim.truck.forwardSpeed();
    const want = typeof wanted === 'number' ? wanted : wanted(p.x, p.z);
    top = Math.max(top, speed);
    still = Math.abs(speed) < 0.3 ? still + 1 : 0;
    if (still > 60 * 4) break;
    const steerNow = Math.max(-1, Math.min(1, -off * 2.2));
    seen.push(steerNow);
    const steer = process.env.HUMAN ? seen[Math.max(0, seen.length - 13)] : steerNow;
    const before = sim.cargoValue();
    sim.step({ throttle: speed < want ? 1 : speed > want + 1 ? -0.6 : 0.1, steer, handbrake: false });
    if (process.env.TRACE && (i % (process.env.EVERY ? +process.env.EVERY : 60) === 0 || before - sim.cargoValue() > 3)) console.log(`   ${(i / 60).toFixed(1)} s: ${p.x.toFixed(1)},${p.y.toFixed(2)},${p.z.toFixed(1)} ${(speed * 3.6).toFixed(0)} km/h${before - sim.cargoValue() > 3 ? ' lost ' + (before - sim.cargoValue()).toFixed(0) : ''}`);
  }
  // A moment more, for what is coming down to come down.
  for (let i = 0; i < 90 && !sim.result; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const p = sim.truck.body.translation();
  const kept = Math.round((sim.cargoValue() / sim.fullValue) * 100);
  const end = sim.result ? sim.result.failure ?? 'done' : s > f.total - 2 ? 'through' : 'stuck';
  const want = typeof wanted === 'number' ? wanted : wanted(p.x, p.z);
  console.log(`${name} ${(want * 3.6).toFixed(0)} km/h: ${end} at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} (${s.toFixed(0)} of ${f.total.toFixed(0)} m), load ${kept}%, top ${(top * 3.6).toFixed(0)} km/h`);
  return sim;
}

// On from near the billboard's top: its last few metres and over onto the roof.
const START: [number, number, number, number] = [44, 364.7, -Math.PI / 2 + 0.17, 4.75];
const WAY: Vec2[] = [[44, 364.7], [41, 364.4], ...MARKET_ROOF_WAY];

if (what === 'way') {
  for (const v of (process.env.SPEEDS ?? '3,5,7,10').split(',').map(Number)) await drive('the way', WAY, v, START);
} else if (what === 'easy') {
  // Ways over that are not the way: along the east eaves straight to the joint; down each valley but the one meant; and
  // along the joint from its east end.
  const J = JOINT.z1 - 6.5;
  await drive('along the east eaves', [[44, 364.7], [38.6, 362], [38.6, 300], [33, J], [-22, J]], 5, START);
  await drive('down valley 28', [[44, 364.7], [41, 364.4], [38.5, 362.6], [36, 360.6], [33, 359.4], [28, 357], [28, 300], [22, J], [-22, J]], 5, START);
  await drive('down valley 16 off the deck', [[0, 355.5], [8, 355.5], [13, 354], [15, 351], [15, 346], [15, 300], [10, J], [-22, J]], 5, [0, 355.5, Math.PI / 2, 4.5]);
  await drive('down valley -8, past the switch boxes', [[2, 356.5], [-6, 357], [-9.4, 354], [-9.4, 346], [-8.6, 300], [-12, J], [-22, J]], 5, [2, 356.5, -Math.PI / 2, 4.5]);
  await drive('down valley 4, over ridge -2 into valley -8', [[4, 352], [4, 349], [5.35, 342], [5.35, 336], [2, 333.5], [-3, 332.5], [-8, 330.5], [-8, 300], [-12, J], [-22, J]], 5, [4, 352, Math.PI, 4.5]);
  await drive('down valley 16, round the far end of the condensers', [[0, 355.5], [8, 355.5], [16, 355], [17.2, 351], [17.2, 346], [16.4, 300], [10, J], [-22, J]], 5, [0, 355.5, Math.PI / 2, 4.5]);
  await drive('down valley -8 off the deck', [[2, 353], [-4, 354.5], [-8, 351.5], [-8, 346], [-8, 300], [-12, J], [-22, J]], 5, [2, 353, -Math.PI / 2, 4.5]);
  // Off the deck's west end onto the last gable, and down it by the west edge: on its crest, down its west slope, by its eaves.
  for (const [name, x] of [['down the last crest', -14], ['down the last gable\'s east slope', -11], ['down its west slope', -16.5], ['by the west eaves', -18.4]] as [string, number][])
    await drive(name, [[-3, 357], [-7, 357], [x, 352], [x, 300], [x, J], [-22, J]], 5, [-3, 357, -Math.PI / 2, 4.5]);
  // And put down on the last gable and in the valley east of it, straight down at every line across them, past the sign.
  for (let x = -19; x <= -3; x += 1) await drive(`down the last gable at ${x}`, [[x, 336], [x, 300], [x, J], [-22, J]], 5, [x, 336, Math.PI, 4.9]);
  await drive('down ridge -2',[[2, 356.5], [-2, 351], [-2, 300], [-6, J], [-22, J]], 5, [2, 356.5, Math.PI, 4.5]);
} else if (what === 'down') {
  const DOWN: Vec2[] = [[-4, JOINT.z1 - 6.5], [-22, JOINT.z1 - 6.5], [-35, JOINT.z1 - 6], [-41.5, JOINT.z1 - 4], [-44, JOINT.z1], [-44, 326]];
  for (const v of (process.env.SPEEDS ?? '3,5,7,10').split(',').map(Number)) await drive('down the canopy', DOWN, v, [-4, JOINT.z1 - 6.5, -Math.PI / 2, 4.5]);
  // Off its open side half way down, into the bay; and out of the bay through the gap in its wall into the ice yard.
  await drive('off its open side', [[-4, JOINT.z1 - 6.5], [-22, JOINT.z1 - 6.5], [-26, JOINT.z1 - 14], [-26, 270]], 3, [-4, JOINT.z1 - 6.5, -Math.PI / 2, 4.5]);
  await drive('out of the bay', [[-24, 275], [-24, 345]], 3, [-24, 275, 0, 0]);
  // Flat out straight down it and on, not round: into the plant's wall.
  await drive('straight on down it', [[-4, JOINT.z1 - 6.5], [-70, JOINT.z1 - 6.5]], 10, [-4, JOINT.z1 - 6.5, -Math.PI / 2, 4.5]);
} else if (what === 'ice') {
  for (const [name, way] of [['west', ICE_WAY], ['east', ICE_WAY_EAST]] as const)
    for (const v of (process.env.SPEEDS ?? '3,5,7,10').split(',').map(Number)) await drive(`the ice yard, ${name}`, [[-44, 300], [-44, 318], ...way], v, [-44, 300, 0, 1.2]);
} else if (what === 'skylights') {
  // Straight on west over the first crest, not round to its gap; through the gap and straight on west, not round north to
  // the second's; up the valley's east side onto the rooflight over its ridge, 3.8 m off its middle.
  await drive('straight on over the first crest', [[44, 364.7], [36, 366.1], [20, 368.9]], 3, START);
  await drive('straight on after the first gap', [[44, 364.7], [41, 364.4], [38.5, 362.6], [36, 360.6], [33, 359.4], [20, 357.5]], 3, START);
  await drive('up the valley side', [[4, 352], [7.8, 343], [7.8, 336]], 3, [4, 352, Math.PI, 4.5]);
  // Only grazing that rooflight, from x 7.75: the outer tyre just over its edge. Should not go through.
  for (const x of [6.6, 6.9]) await drive(`grazing it, outer wheel at ${(x + 1.35).toFixed(2)}`, [[4, 352], [x, 344], [x, 336]], 3, [4, 352, Math.PI, 4.5]);
} else {
  // Stopped facing up a ridge's slope, half way up, and away again.
  const sim = await Sim.create(level);
  sim.teleport(25, 363, -Math.PI / 2, 5.0);
  for (let i = 0; i < 120; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const a = sim.truck.body.translation();
  for (let i = 0; i < 60 * 4; i++) sim.step({ throttle: 1, steer: 0, handbrake: false });
  const b = sim.truck.body.translation();
  console.log(`stopped on the slope at ${a.x.toFixed(1)},${a.y.toFixed(2)}; 4 s on: ${b.x.toFixed(1)},${b.y.toFixed(2)} (${(a.x - b.x).toFixed(1)} m on)${sim.result ? ' ' + sim.result.failure : ''}`);
}
