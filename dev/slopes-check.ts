// The proving ground for slopes: that the truck rolls back on the hill unless held, that the driver can get out on it,
// that things come rolling down the avenue and are taken away at the bottom, and that the truck gets up the ramp
// round the tower to the roof. npx tsx dev/slopes-check.ts
import { buildSlopes, slopes } from '../src/levels/slopes';
import { heightAt } from '../src/levels/terrain';
import { Sim } from '../src/sim/sim';

let failures = 0;
const check = (name: string, ok: boolean, detail: string) => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`); };
const { report } = buildSlopes();
const level = slopes();
console.log(`built in ${report.milliseconds} ms: ${report.triangles} triangles; ${level.props.length} props, ${level.objects?.length} objects`);
const NO_FOOT = { moveX: 0, moveZ: 0, run: false, jumpPressed: false, vehiclePressed: false, grabPressed: false, throwHeld: false, throwReleased: false } as never;
const put = (sim: Sim, x: number, z: number, yaw: number, below?: number) => {
  for (const c of sim.cargo) if (c.body) c.body.setTranslation({ x: 300, y: 2, z: -300 }, true);
  sim.truck.body.setTranslation({ x, y: heightAt(level.terrain, x, z, below) + 0.9, z }, true);
  sim.truck.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
  sim.truck.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  sim.truck.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
};

// On the hill, facing up it: left alone it rolls back; with the handbrake on it stays; and the driver can get out.
{
  const sim = await Sim.create(level);
  put(sim, -30, 150, 0);
  for (let i = 0; i < 90; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const held = sim.truck.body.translation().z;
  check('with the handbrake on it stays on the hill', Math.abs(held - 150) < 0.5, `moved ${(held - 150).toFixed(2)} m in 1.5 s`);
  sim.step({ throttle: 0, steer: 0, handbrake: true }, { ...(NO_FOOT as object), vehiclePressed: true } as never);
  check('the driver can get out on the hill', sim.driver.mode === 'onFoot', `mode ${sim.driver.mode}, standing at height ${sim.driver.pos.y.toFixed(2)} over ground at ${heightAt(level.terrain, sim.driver.pos.x, sim.driver.pos.z).toFixed(2)}`);
  for (let i = 0; i < 180; i++) sim.step({ throttle: 0, steer: 0, handbrake: false });
  check('left with the driver out, it stays', Math.abs(sim.truck.body.translation().z - held) < 0.5, `moved ${(sim.truck.body.translation().z - held).toFixed(2)} m in 3 s`);
}
{
  const sim = await Sim.create(level);
  put(sim, -30, 150, 0);
  for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  for (let i = 0; i < 240; i++) sim.step({ throttle: 0, steer: 0, handbrake: false });
  check('let go on the hill it rolls back, gathering speed', sim.truck.forwardSpeed() < -2, `after 4 s: ${sim.truck.forwardSpeed().toFixed(1)} m/s, ${(sim.truck.body.translation().z - 150).toFixed(1)} m`);
}

// Things rolling down the avenue.
{
  const sim = await Sim.create(level);
  const first = level.objects!.length;
  for (let i = 0; i < 60 * 30; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const pool = sim.objects.objects.slice(first);
  const out = pool.filter((o) => o.body.translation().y > -20);
  const zs = out.map((o) => o.body.translation().z);
  const fastest = Math.max(...out.map((o) => Math.hypot(o.body.linvel().x, o.body.linvel().z)));
  const strayed = out.filter((o) => Math.abs(o.body.translation().x) > 13).length;
  check('things come rolling down the avenue', out.length >= 8 && Math.min(...zs) < 150 && fastest > 8, `after 30 s: ${out.length} of ${pool.length} out, from z ${Math.min(...zs).toFixed(0)} to ${Math.max(...zs).toFixed(0)}, the fastest at ${fastest.toFixed(1)} m/s, ${strayed} off the road, ${out.filter((o) => o.knocked).length} brought up against something`);
}

// Up the ramp round the tower to the roof.
{
  const sim = await Sim.create(level);
  const route = level.route!;
  let leg = 3;
  put(sim, route[3][0] + 14, route[3][1], -Math.PI / 2, 60);
  let i = 0, slowest = 99;
  for (; i < 60 * 300 && leg < route.length - 1; i++) {
    const p = sim.truck.body.translation();
    const r = sim.truck.body.rotation();
    while (leg < route.length - 1 && Math.hypot(route[leg + 1][0] - p.x, route[leg + 1][1] - p.z) < 6) leg++;
    const [tx, tz] = route[Math.min(leg + 1, route.length - 1)];
    const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
    const off = Math.atan2(fx * (tz - p.z) - fz * (tx - p.x), fx * (tx - p.x) + fz * (tz - p.z));
    const speed = sim.truck.forwardSpeed();
    sim.step({ throttle: speed < 9 ? 0.9 : 0, steer: Math.max(-1, Math.min(1, -off * 2.4)), handbrake: false });
    if (i > 240 && i % 30 === 0) slowest = Math.min(slowest, speed);
  }
  const end = sim.truck.body.translation();
  check('the truck gets up round the tower to the roof', leg >= route.length - 1 && end.y > 150, `reached leg ${leg} of ${route.length - 1} at height ${end.y.toFixed(0)} m in ${(i / 60).toFixed(0)} s; slowest ${slowest.toFixed(1)} m/s; rightings ${sim.rightings}; finished ${!!sim.result && !sim.result.failure}`);
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
