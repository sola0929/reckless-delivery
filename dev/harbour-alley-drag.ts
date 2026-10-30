// Level 4's alleys: the truck driven north past their mouths along the way left between what is down across the street
// (the town lane by the van, the harbour lane by the scaffold, the town lane by the billboard) at a steady pace, with
// the level's gusts and without; how long it takes, how slow it gets where, and what blown things are against it then.
// npx tsx dev/harbour-alley-drag.ts [seconds stood before the first alley first] [km/h]
import { harbour } from '../src/levels/harbour';
import { Sim } from '../src/sim/sim';

const wait = Number(process.argv[2] ?? 0), kmh = Number(process.argv[3] ?? 15);
const WAY: [number, number][] = [[-2.6, 140], [-2.6, 166], [2.6, 172.5], [2.6, 196], [-3.2, 206], [-3.2, 226]];
for (const gusts of [true, false]) {
  const level = harbour();
  if (!gusts) level.gusts = [];
  const sim = await Sim.create(level);
  sim.teleport(WAY[0][0], WAY[0][1], 0);
  for (let i = 0; i < 60 * Math.max(1, wait); i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const want = kmh / 3.6;
  let slowest = Infinity, at = 0, against = '', k = 1, stuck = 0, crawl = 0;
  const start = sim.time;
  for (let i = 0; i < 60 * 90; i++) {
    const p = sim.truck.body.translation(), v = sim.truck.body.linvel(), r = sim.truck.body.rotation(), speed = Math.hypot(v.x, v.z);
    while (k < WAY.length - 1 && p.z > WAY[k][1] - 2) k++;
    const [tx, tz] = WAY[k], yaw = Math.atan2(2 * (r.w * r.y + r.x * r.z), 1 - 2 * (r.y * r.y + r.x * r.x));
    let turn = Math.atan2(tx - p.x, tz - p.z) - yaw;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    sim.step({ throttle: speed < want ? 1 : 0.2, steer: Math.max(-1, Math.min(1, turn * 2.2)), handbrake: false });
    if (i > 90 && p.z > 150) {
      if (speed < 1) crawl += 1 / 60;
      if (speed < slowest) {
        slowest = speed; at = p.z;
        const near = sim.objects.objects.filter((o) => o.blown && o.body.isEnabled() && Math.hypot(o.body.translation().x - p.x, o.body.translation().z - p.z) < 4.5);
        against = near.map((o) => `${o.desc.kind}(${o.body.mass().toFixed(0)}kg)`).join(' ');
      }
    }
    stuck = speed < 0.3 ? stuck + 1 : 0;
    if (p.z > 225 || stuck > 600) break;
  }
  const p = sim.truck.body.translation();
  console.log(`${gusts ? 'gusts' : 'calm '} ${kmh} km/h, stood ${wait} s: ${p.z > 225 ? 'through' : `stuck at ${p.x.toFixed(1)},${p.z.toFixed(1)}`} in ${(sim.time - start).toFixed(1)} s, under 3.6 km/h for ${crawl.toFixed(1)} s, slowest ${(slowest * 3.6).toFixed(1)} km/h at z ${at.toFixed(0)}${against ? ' with ' + against : ''}, load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%`);
}
