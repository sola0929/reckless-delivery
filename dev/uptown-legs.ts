// Level 2 driven from one of its testing jump points to the end of the way, with the traffic, people and coils taken away:
// does the truck get through, and with how much of its load? npx tsx dev/uptown-legs.ts <jump point number, 1-10>
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const k = Number(process.argv[2] ?? 5) - 1;
const spot = level.checkpoints![k];
const sim = await Sim.create({ ...level, traffic: [], crowds: [], rollers: [], riders: [], machines: [] });
sim.teleport(spot.pos[0], spot.pos[1], spot.yaw);
for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const route = level.route!;
// Pick up the way at the stretch nearest the jump point.
let leg = 0, best = Infinity;
for (let n = 0; n < route.length - 1; n++) {
  const [ax, az] = route[n], [bx, bz] = route[n + 1];
  const L = Math.hypot(bx - ax, bz - az) || 1;
  const t = Math.max(0, Math.min(1, ((spot.pos[0] - ax) * (bx - ax) + (spot.pos[1] - az) * (bz - az)) / (L * L)));
  const d = Math.hypot(ax + (bx - ax) * t - spot.pos[0], az + (bz - az) * t - spot.pos[1]);
  if (d < best) { best = d; leg = n; }
}
const from = leg;
let i = 0, still = 0;
for (; i < 60 * 240 && leg < route.length - 1 && still < 60 * 15; i++) {
  const p = sim.truck.body.translation();
  const r = sim.truck.body.rotation();
  while (leg < route.length - 1 && Math.hypot(route[leg + 1][0] - p.x, route[leg + 1][1] - p.z) < 4) leg++;
  const [ax, az] = route[Math.min(leg, route.length - 2)];
  const [cx, cz] = route[Math.min(leg + 1, route.length - 1)];
  const length = Math.hypot(cx - ax, cz - az) || 1;
  const t = Math.min(1, ((p.x - ax) * (cx - ax) + (p.z - az) * (cz - az)) / (length * length) + 4.5 / length);
  const tx = ax + (cx - ax) * t, tz = az + (cz - az) * t;
  const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
  const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
  const speed = sim.truck.forwardSpeed();
  const want = Math.abs(off) > 0.3 ? 3 : 6;
  sim.step({ throttle: speed < want ? 0.8 : speed > want + 1 ? -0.7 : 0, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false });
  still = Math.abs(speed) < 0.3 ? still + 1 : 0;
}
for (let n = 0; n < 60 * 4; n++) sim.step({ throttle: -1, steer: 0, handbrake: true });
const end = sim.truck.body.translation();
const done = !!sim.result && !sim.result.failure;
console.log(`from ${spot.name}: ${done ? 'DELIVERED' : leg >= route.length - 1 ? 'REACHED THE END' : `STUCK at ${end.x.toFixed(0)}, ${end.z.toFixed(0)}`} (way legs ${from} to ${leg} of ${route.length - 1}) in ${(i / 60).toFixed(0)} s; load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%`);
process.exit(0);
