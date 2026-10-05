// The terrain builder, tried on its showcase: what it made, whether what it says about heights
// is what is solid, whether the truck gets along the road both ways, and whether anything
// sliding along the road catches on the joins in it. npx tsx dev/relief-check.ts
import RAPIER from '@dimforge/rapier3d-compat';
import { buildReliefShow, reliefShow } from '../src/levels/reliefShow';
import { heightAt } from '../src/levels/terrain';
import { Sim } from '../src/sim/sim';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const { report } = buildReliefShow();
console.log(`built in ${report.milliseconds} ms: ${report.pieces} pieces, ${report.triangles} triangles, ${report.walls} walls, ${report.joined} corners joined, ${report.dropped} scraps dropped, steepest road ${(report.steepest * 100).toFixed(0)}%, tightest bend ${report.tightest.toFixed(1)} m radius`);

const level = reliefShow();
const sim = await Sim.create(level);
const world = (sim as unknown as { world: RAPIER.World }).world;
world.step();

// What the height query says against what a ray straight down finds, at places all over it.
let worst = 0, where = '', tried = 0, missed = 0, lost = '';
for (let n = 0; n < 4000; n++) {
  const x = -90 + ((n * 7919) % 1960) / 10;
  const z = -25 + ((n * 104729) % 7000) / 10;
  // Away from the truck and its load, which a ray would find first.
  if (Math.abs(x) < 6 && z < 0) continue;
  const said = heightAt(level.terrain, x, z);
  const hit = world.castRay(new RAPIER.Ray({ x, y: 80, z }, { x: 0, y: -1, z: 0 }), 200, true);
  if (!hit) continue;
  tried++;
  const found = 80 - hit.timeOfImpact;
  // Nothing said where there is ground: the hillside is all well above nought.
  if (z > 230 && said < 0.01 && found > 0.5) { missed++; lost = `${x.toFixed(1)}, ${z.toFixed(1)}`; }
  // Not within a hand's breadth of a wall or a post, where the two may fairly differ.
  if (Math.abs(found - said) > worst && Math.abs(found - said) < 0.6) { worst = Math.abs(found - said); where = `${x.toFixed(1)}, ${z.toFixed(1)}: said ${said.toFixed(2)}, found ${found.toFixed(2)}`; }
}
check('the height it gives is the height that is solid', worst < 0.05 && tried > 3000 && !missed, `${tried} places; ${missed} with no answer${lost ? ` (such as ${lost})` : ''}; the most they differ by, away from edges, is ${(worst * 100).toFixed(1)} cm${where ? ` at ${where}` : ''}`);

// The truck along the road, there and back. Back is in two parts: the stepped street is for coming down,
// and a truck that stops on it going up may not get going again.
async function drive(reverse: boolean, name: string, keep: (z: number) => boolean = () => true): Promise<string> {
  const run = await Sim.create(reliefShow());
  const route = (reverse ? [...level.route!].reverse() : level.route!).filter(([, z]) => keep(z));
  for (let i = 0; i < 60; i++) run.step({ throttle: 0, steer: 0, handbrake: true });
  if (reverse) {
    const [x, z] = route[0];
    const turn = { x: 0, y: 1, z: 0, w: 0 };
    for (const c of run.cargo) if (c.body) c.body.setTranslation({ x: 400, y: 2, z: 400 }, true);
    run.truck.body.setTranslation({ x, y: heightAt(level.terrain, x, z) + 1, z }, true);
    run.truck.body.setRotation(turn, true);
  }
  let leg = 0, worstDrop = 0, was = 0, at = '', took = 0;
  for (let i = 0; i < 60 * 320 && leg < route.length - 1; i++) {
    const p = run.truck.body.translation();
    const r = run.truck.body.rotation();
    while (leg < route.length - 1 && Math.hypot(route[leg + 1][0] - p.x, route[leg + 1][1] - p.z) < 7) leg++;
    const [ax, az] = route[Math.min(leg, route.length - 2)];
    const [cx, cz] = route[Math.min(leg + 1, route.length - 1)];
    const length = Math.hypot(cx - ax, cz - az);
    const t = Math.min(1, ((p.x - ax) * (cx - ax) + (p.z - az) * (cz - az)) / (length * length) + 9 / length);
    const tx = ax + (cx - ax) * t, tz = az + (cz - az) * t;
    const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
    const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
    const speed = run.truck.forwardSpeed();
    const want = Math.abs(off) > 0.3 ? 4.5 : 8;
    run.step({ throttle: speed < want ? 0.9 : speed > want + 2 ? -0.4 : 0, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false });
    if (i > 200 && was - speed > worstDrop) { worstDrop = was - speed; at = `${p.x.toFixed(0)}, ${p.z.toFixed(0)}`; }
    was = speed;
    took = i / 60;
  }
  const end = run.truck.body.translation();
  const done = leg >= route.length - 1;
  check(`the truck gets along it, ${name}`, done, `reached leg ${leg} of ${route.length - 1} at ${end.x.toFixed(0)}, ${end.z.toFixed(0)}; most speed lost in one step ${worstDrop.toFixed(2)} m/s at ${at}${reverse ? '' : `; load ${Math.round((run.cargoValue() / run.fullValue) * 100)}%`}; rightings ${run.rightings}; ${took.toFixed(0)} s, ending at ${run.truck.forwardSpeed().toFixed(1)} m/s, ${(end.y - heightAt(level.terrain, end.x, end.z)).toFixed(2)} m above the ground`);
  return '';
}
await drive(false, 'south to north');
await drive(true, 'north to south, down the street on the hill', (z) => z > 432);
await drive(true, 'north to south, from the top of the steps', (z) => z < 384);

// Boxes slid along the level road of the quay, across every join in it: against the same on one piece.
const lanes: { name: string; body: RAPIER.RigidBody; from: number }[] = [];
for (const [name, round, sign] of [['sharp', false, 1], ['rounded', true, -1]] as const) {
  for (const [off, label] of [[1.3, 'along the road'], [3.3, 'near its edge']] as const) {
    const x = off * sign;
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, heightAt(level.terrain, x, 440) + 0.31, 440).setLinvel(0, 0, 14).setCanSleep(false));
    world.createCollider((round ? RAPIER.ColliderDesc.roundCuboid(0.42, 0.22, 0.42, 0.08) : RAPIER.ColliderDesc.cuboid(0.5, 0.3, 0.5)).setMass(120).setFriction(0.05), body);
    lanes.push({ name: `${name} box ${label}`, body, from: 440 });
  }
}
const most = lanes.map(() => 0);
const jump = lanes.map(() => 0);
for (let i = 0; i < 120; i++) {
  const before = lanes.map((l) => l.body.linvel().z);
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  lanes.forEach((l, n) => { const v = l.body.linvel(); most[n] = Math.max(most[n], before[n] - v.z); jump[n] = Math.max(jump[n], Math.abs(v.y)); });
}
lanes.forEach((l, n) => check(`${l.name} slides over the joins`, most[n] < 0.5 && jump[n] < 0.6 && l.body.translation().z - l.from > 16.5, `went ${(l.body.translation().z - l.from).toFixed(1)} m, most lost in one step ${most[n].toFixed(2)} m/s, most upward speed ${jump[n].toFixed(2)}`));

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
