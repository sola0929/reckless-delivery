// Level 4's proving ground driven headless at three speeds: down the gangway, over the pontoon and the four boats, up to the
// quay; and up the ship's stern ramp, along its deck, round at the bow and back. npx tsx dev/harbour-drive.ts
import { harbourLab } from '../src/levels/harbourLab';
import { Sim } from '../src/sim/sim';
import type { DriveInput } from '../src/sim/truck';

const level = harbourLab();
if (process.env.CALM) level.waves = [];
type Point = [number, number];

async function drive(name: string, way: Point[], want: number, seconds = 240) {
  const sim = await Sim.create(level);
  const [x0, z0] = way[0], [x1, z1] = way[1];
  sim.teleport(x0, z0, Math.atan2(x1 - x0, z1 - z0));
  for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  let leg = 0, top = 0, tilt = 0;
  for (let i = 0; i < 60 * seconds && leg < way.length - 1 && !sim.result; i++) {
    const p = sim.truck.body.translation(), r = sim.truck.body.rotation();
    while (leg < way.length - 1 && Math.hypot(way[leg + 1][0] - p.x, way[leg + 1][1] - p.z) < 3.5) leg++;
    const [tx, tz] = way[Math.min(leg + 1, way.length - 1)];
    const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
    const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
    const speed = sim.truck.forwardSpeed();
    top = Math.max(top, speed);
    // How far over it leans: the up of its frame against the world's.
    const upY = 1 - 2 * (r.x * r.x + r.z * r.z);
    tilt = Math.max(tilt, Math.acos(Math.max(-1, Math.min(1, upY))) * 180 / Math.PI);
    const input: DriveInput = { throttle: speed < want ? 1 : speed > want + 1 ? -0.6 : 0.1, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false };
    sim.step(input);
    if (process.env.EVENTS) {
      for (const b of sim.waves.drainBreaks()) console.log('   wave', (i / 60).toFixed(1), b.big ? 'BIG' : '', 'truck z', p.z.toFixed(0), 'y', p.y.toFixed(1));
      for (const s of sim.rigs.surges) console.log('   boat', s.down ? 'down' : 'up', (i / 60).toFixed(1), 'truck z', p.z.toFixed(0));
    }
    if (process.env.TRACE && i % 60 === 0 && p.z > 179) console.log('  ', (i / 60).toFixed(0), p.x.toFixed(1), p.y.toFixed(2), p.z.toFixed(1), speed.toFixed(1), leg, (off * 57).toFixed(0));
  }
  const p = sim.truck.body.translation();
  const kept = Math.round((sim.cargoValue() / sim.fullValue) * 100);
  const end = sim.result ? (sim.result.failure ?? 'delivered') : leg >= way.length - 1 ? 'through' : `stuck at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`;
  console.log(`${name} ${(want * 3.6).toFixed(0)} km/h: ${end} at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} leg ${leg}, load ${kept}%, on board ${sim.cargoOnTruck()}/${sim.cargo.length}, top ${(top * 3.6).toFixed(0)} km/h, most lean ${tilt.toFixed(0)}°`);
}

const boats: Point[] = [[0, -20], [0, -2], [0, 24], [0, 46], [0, 80], [0, 96], [0, 104]];
const ship: Point[] = [[0, 100], [0, 110], [0, 118], [-9.5, 128], [-9.5, 179], [-10, 191], [-5, 200], [1, 203], [7, 199], [10, 190], [9.5, 174], [9.5, 132], [0, 122], [0, 104]];

const only = process.env.ONLY ?? "ABCDE";
if (only.includes("B")) for (const v of [3, 6, 10]) await drive("A+B boats", boats, v);
if (only.includes("C")) for (const v of process.env.TRACE ? [3] : [3, 6, 10]) await drive("C ship", ship, v);
const walk: Point[] = process.env.WIDE ? [[0.8, 220], [0.8, 256], [11, 281], [12, 296], [12, 316], [12, 330], [0, 352], [0, 359], [2, 367], [0, 375], [-1, 381], [0, 400]] : [[0.8, 220], [0.8, 256], [11, 281], [11, 288], [9.6, 291], [4, 294.5], [-0.5, 299], [-0.5, 309], [4, 315], [9.6, 320], [12, 325], [12, 330], [0, 352], [1.6, 356], [-1.6, 363], [1.8, 368], [1.8, 371], [-1.6, 372.5], [1.6, 377.5], [-1.6, 382.5], [0, 400]];
if (only.includes("D")) for (const v of process.env.TRACE ? [+process.env.TRACE] : [3, 6, 10]) await drive("D boardwalk", walk, v);

process.exit(0);
