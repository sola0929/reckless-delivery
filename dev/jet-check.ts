// A truck stood with one corner over a manhole, and then driven over the burst main: how far it is thrown, and what the load
// loses. npx tsx dev/jet-check.ts
import { Quaternion, Vector3 } from 'three';
import { LEVELS } from '../src/levels/index';
import { Sim } from '../src/sim/sim';
const level = LEVELS.uptown();
for (const run of ['standing', 'driving'] as const) {
  const sim = await Sim.create(level);
  const cargo = { get value() { return Math.round(sim.cargoValue()); } };
  const hole = sim.objects.objects[level.manholes![1].cover].desc.pos;
  // Pointing east (-X), its front left over the hole when standing; well back, and driving east along that lane, when not.
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2);
  const back = run === 'standing' ? -2.5 : 40;
  // The truck moved there, and its load with it, each piece where it was on the bed.
  const from = sim.truck.body.translation();
  const fr = sim.truck.body.rotation();
  const was = new Quaternion(fr.x, fr.y, fr.z, fr.w);
  const to = new Vector3(hole[0] + back, hole[1] + 1.2, hole[2] + (run === 'standing' ? -0.8 : 0));
  const turn = q.clone().multiply(was.clone().invert());
  for (const item of sim.cargo) {
    if (!item.body) continue;
    const p = item.body.translation();
    const r = item.body.rotation();
    const at = new Vector3(p.x - from.x, p.y - from.y, p.z - from.z).applyQuaternion(turn).add(to);
    const rot = turn.clone().multiply(new Quaternion(r.x, r.y, r.z, r.w));
    item.body.setTranslation(at, true);
    item.body.setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w }, true);
  }
  sim.truck.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
  sim.truck.body.setTranslation(to, true);
  for (let i = 0; i < 30; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const start = cargo.value;
  const y0 = sim.truck.body.translation().y;
  let rise = 0;
  let tilt = 0;
  for (let i = 0; i < 60 * 14; i++) {
    sim.step({ throttle: run === 'driving' ? 0.45 : 0, steer: 0, handbrake: run === 'standing' });
    rise = Math.max(rise, sim.truck.body.translation().y - y0);
    const r = sim.truck.body.rotation();
    const up = new Vector3(0, 1, 0).applyQuaternion(new Quaternion(r.x, r.y, r.z, r.w));
    tilt = Math.max(tilt, Math.acos(Math.min(1, up.y)) * 57.3);
  }
  console.log(`${run}: lifted ${rise.toFixed(2)} m, tipped ${tilt.toFixed(0)} degrees, load worth ${start} -> ${cargo.value}`);
}
process.exit(0);
