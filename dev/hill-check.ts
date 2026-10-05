// The way down the hill to the quarry: the ground along it and across it, step by step, and the truck driven down it from
// the landing to the quarry office. npx tsx dev/hill-check.ts
import { Quaternion, Vector3 } from 'three';
import { uptown } from '../src/levels/uptown';
import { heightAt } from '../src/levels/terrain';
import { Sim } from '../src/sim/sim';

const level = uptown();
const route = level.route!;
const from = route.findIndex(([x]) => x < -270) - 1;
const way = route.slice(from);
const h = (x: number, z: number) => heightAt(level.terrain!, x, z);
// Along the middle of the way, every half metre, and four metres out to either side.
let jump = 0, jumpAt = '', steep = 0, steepAt = '', across = 0, acrossAt = '';
for (let n = 0; n < way.length - 1; n++) {
  const [ax, az] = way[n], [bx, bz] = way[n + 1];
  const len = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / len, uz = (bz - az) / len;
  let last = NaN;
  for (let d = 0; d <= len; d += 0.5) {
    const x = ax + ux * d, z = az + uz * d;
    const here = h(x, z);
    if (!Number.isNaN(last)) {
      if (Math.abs(here - last) > jump) { jump = Math.abs(here - last); jumpAt = `${x.toFixed(0)},${z.toFixed(0)}`; }
      if (Math.abs(here - last) / 0.5 > steep) { steep = Math.abs(here - last) / 0.5; steepAt = `${x.toFixed(0)},${z.toFixed(0)}`; }
    }
    last = here;
    const side = Math.abs(h(x - uz * 3.5, z + ux * 3.5) - h(x + uz * 3.5, z - ux * 3.5));
    if (side > across) { across = side; acrossAt = `${x.toFixed(0)},${z.toFixed(0)}`; }
  }
}
console.log(`ground along the way down: biggest step ${jump.toFixed(2)} m at ${jumpAt}, steepest ${(steep * 100).toFixed(0)}% at ${steepAt}; most tilt across 7 m ${across.toFixed(2)} m at ${acrossAt}`);

const sim = await Sim.create({ ...level, traffic: [], crowds: [], rollers: [], riders: [] });
// The truck and its load put down at the top, pointing east.
const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2);
const start = way[0];
const to = new Vector3(start[0], h(start[0], start[1]) + 1.2, start[1]);
const fromP = sim.truck.body.translation();
const fr = sim.truck.body.rotation();
const turn = q.clone().multiply(new Quaternion(fr.x, fr.y, fr.z, fr.w).invert());
for (const item of sim.cargo) {
  if (!item.body) continue;
  const p = item.body.translation();
  const r = item.body.rotation();
  item.body.setTranslation(new Vector3(p.x - fromP.x, p.y - fromP.y, p.z - fromP.z).applyQuaternion(turn).add(to), true);
  const rot = turn.clone().multiply(new Quaternion(r.x, r.y, r.z, r.w));
  item.body.setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w }, true);
}
sim.truck.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
sim.truck.body.setTranslation(to, true);
let leg = 0, i = 0, low = Infinity;
for (; i < 60 * 150 && leg < way.length - 1; i++) {
  const p = sim.truck.body.translation();
  const r = sim.truck.body.rotation();
  low = Math.min(low, p.y - h(p.x, p.z));
  while (leg < way.length - 1 && Math.hypot(way[leg + 1][0] - p.x, way[leg + 1][1] - p.z) < 4) leg++;
  const [ax, az] = way[Math.min(leg, way.length - 2)];
  const [cx, cz] = way[Math.min(leg + 1, way.length - 1)];
  const length = Math.hypot(cx - ax, cz - az) || 1;
  const t = Math.min(1, ((p.x - ax) * (cx - ax) + (p.z - az) * (cz - az)) / (length * length) + 4.5 / length);
  const tx = ax + (cx - ax) * t, tz = az + (cz - az) * t;
  const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
  const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
  const speed = sim.truck.forwardSpeed();
  const want = Math.abs(off) > 0.3 ? 3 : 6;
  sim.step({ throttle: speed < want ? 0.8 : speed > want + 1 ? -0.7 : 0, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false });
}
for (let k = 0; k < 60 * 4; k++) sim.step({ throttle: -1, steer: 0, handbrake: true });
const end = sim.truck.body.translation();
console.log(`${sim.result && !sim.result.failure ? 'DELIVERED' : leg >= way.length - 1 ? 'REACHED' : 'STOPPED'} at leg ${leg} of ${way.length - 1} (${end.x.toFixed(0)}, ${end.z.toFixed(0)}, h ${end.y.toFixed(1)}) in ${(i / 60).toFixed(0)} s; load ${Math.round((sim.cargoValue() / sim.fullValue) * 100)}%; rightings ${sim.rightings}; lowest above ground ${low.toFixed(2)} m`);
const count = (kind: string) => `${sim.objects.objects.filter((o) => o.desc.kind.startsWith(kind) && o.knocked).length}/${sim.objects.objects.filter((o) => o.desc.kind.startsWith(kind)).length}`;
const hens = sim.objects.objects.filter((o) => o.desc.kind.startsWith('chicken') && o.knocked);
const spread = hens.map((o) => Math.hypot(o.body.translation().x - o.desc.pos[0], o.body.translation().z - o.desc.pos[2]));
console.log(`hens that ran: each went ${spread.length ? Math.min(...spread).toFixed(1) : '-'} to ${spread.length ? Math.max(...spread).toFixed(1) : '-'} m`);
console.log(`on the way: hens put up ${count('chicken')}, trays scattered ${count('trayGrain')} + ${count('trayVeg')}, chevrons ${count('chevron')}, lamps ${count('lamp')}`);
process.exit(0);
