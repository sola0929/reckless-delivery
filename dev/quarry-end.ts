// Level 3's second half, driven headless: the sand bar, the bridge without its lorries and with them (a driver that keeps
// to whichever lane's next lorry is further off), and the site up to the roof (boost on the run-up to the gap).
// npx tsx dev/quarry-end.ts [leg names...]
import { quarry } from '../src/levels/quarry';
import { Sim } from '../src/sim/sim';
import type { DriveInput } from '../src/sim/truck';

const level = quarry();
const only = process.argv.slice(2);
type Point = [number, number, number?, boolean?];

/** Drive points in turn, each with the speed to make for it, m/s, and whether to boost; `lanes` picks between two x's on the way. */
async function drive(name: string, way: Point[], opts: { traffic?: boolean; scale?: number; lanes?: [number, number]; seconds?: number; wait?: number } = {}) {
  const sim = await Sim.create({ ...level, crowds: [], traffic: opts.traffic ? level.traffic : level.traffic.filter((l) => l.speed === 0) });
  const [x0, z0] = way[0], [x1, z1] = way[1];
  sim.teleport(x0, z0, Math.atan2(x1 - x0, z1 - z0));
  for (let i = 0; i < 60 * (1 + (opts.wait ?? 0)); i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  let leg = 0, top = 0, laneX = opts.lanes?.[0];
  for (let i = 0; i < 60 * (opts.seconds ?? 90) && leg < way.length - 1 && !sim.result; i++) {
    const p = sim.truck.body.translation(), r = sim.truck.body.rotation();
    while (leg < way.length - 1 && Math.hypot(way[leg + 1][0] - p.x, way[leg + 1][1] - p.z) < 3) leg++;
    // Changing lanes, it is past the end when it is level with it.
    if (opts.lanes && p.z > way[way.length - 1][1]) leg = way.length - 1;
    let [tx, tz, want = 6, boost = false] = way[Math.min(leg + 1, way.length - 1)];
    want *= opts.scale ?? 1;
    if (opts.lanes && p.z > 1088) {
      // The lane whose nearest lorry coming is further off; look 25 m up it.
      const next = (x: number) => Math.min(...sim.traffic.cars.map((c) => c.body.translation()).filter((c) => Math.abs(c.x - x) < 1.2 && c.z > p.z - 2).map((c) => c.z - p.z), 999);
      const [a, b] = opts.lanes;
      if (laneX === undefined || next(laneX) < 75) laneX = next(a) >= next(b) ? a : b;
      tx = laneX;
      tz = p.z + 11;
    }
    const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
    const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
    const speed = sim.truck.forwardSpeed();
    top = Math.max(top, speed);
    const input: DriveInput = { throttle: speed < want ? 1 : speed > want + 1 ? -0.6 : 0.1, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false, boost: boost && speed < want };
    sim.step(input);
  }
  const p = sim.truck.body.translation();
  const kept = Math.round((sim.cargoValue() / sim.fullValue) * 100);
  const end = sim.result ? (sim.result.failure ?? 'delivered') : leg >= way.length - 1 ? 'through' : `stuck at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`;
  console.log(`${name}: ${end}, load ${kept}%, top ${(top * 3.6).toFixed(0)} km/h`);
}

const legs: [string, () => Promise<void>][] = [
  ['sand bar', () => drive('sand bar', [[96, 1030], [96, 1050, 6], [110, 1066, 6], [124.4, 1080, 6], [125.9, 1094, 6]])],
  ['bridge empty', async () => { for (const v of [7, 10, 14]) await drive(`bridge empty ${v * 3.6} km/h`, [[125.9, 1084], [125.9, 1100, v], [125.9, 1365, v]]); }],
  // Set off at a few moments, by waiting at the bridge's foot a while first.
  ['bridge lorries', async () => { for (const v of [7, 10]) for (const wait of [0, 2.5, 5]) await drive(`bridge lorries ${v * 3.6} km/h after ${wait} s`, [[119, 1072], [123, 1084, 5], [125.9, 1092, v], [125.9, 1365, v]], { traffic: true, lanes: [125.9, 130.1], seconds: 60, wait }); }],
  ['bridge straight', async () => { for (const v of [10, 16]) await drive(`bridge straight on, no dodging, ${v * 3.6} km/h`, [[125.9, 1084], [125.9, 1100, v, true], [125.9, 1360, v, true]], { traffic: true, seconds: 40 }); }],
  ['site', () => drive('site', [
    [126, 1394], [114, 1394, 6], [96, 1396, 6], [82, 1402, 5], [79.25, 1414, 5], [79.25, 1472, 5], [79, 1478, 3], [76.5, 1482.5, 3], [72, 1484.4, 3], [66, 1484.4, 4], [61, 1478, 4], [58, 1470, 3], [54, 1468, 3], [50, 1468, 3], [44, 1468, 3],
    [28, 1468, 3], [22, 1470, 3], [18.75, 1480, 4], [18.75, 1508, 5], [14, 1516, 3], [4, 1518, 3], [-3, 1516, 3], [-6, 1508, 3], [-6, 1496, 4], [-6, 1482, 5], [-6, 1466, 8],
    [-6, 1450, 16, true], [-6, 1436, 18, true], [-6, 1408, 4], [0.5, 1403, 3], [0.5, 1399, 3], [-3, 1395.5, 2.5], [-8, 1394.5, 2], [-10, 1392, 1.5], [-10, 1389, 0],
  ], { seconds: 150 })],
];
for (const [name, run] of legs) if (!only.length || only.includes(name)) await run();
process.exit(0);
