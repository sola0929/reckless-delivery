// Headless check that the driver never gets stuck to a parked car: 90 combinations of
// where they press against it, at what angle, and whether they keep pressing through a
// jump. One in ninety used to jam. npx tsx dev/stuck-test.ts
import { sandbox } from '../src/levels/sandbox';
import { NO_FOOT_INPUT, type FootInput } from '../src/sim/driver';
import { Sim } from '../src/sim/sim';
const idle = { throttle: 0, steer: 0, handbrake: false };
const foot = (extra: Partial<FootInput>): FootInput => ({ ...NO_FOOT_INPUT, ...extra });
let stuck = 0, trials = 0;
// Press against a parked car from its ends and sides, at different spots and angles, jump, then try to walk in all four directions.
for (const [face, ax, az, px, pz] of [['front', 0, 1, 0, -1], ['back', 0, -1, 0, 1], ['side', -1, 0, 1, 0]] as const) {
  for (const offset of [-0.8, -0.4, 0, 0.4, 0.8]) {
    for (const lean of [0, 0.4, -0.4]) {
      for (const hold of [true, false]) {
        const sim = await Sim.create({ ...sandbox(), props: [], traffic: [{ from: [10, -10], to: [10, 10], cars: 1, speed: 0 }] });
        const d = sim.driver;
        const car = sim.traffic.cars[0];
        const cx = 10, cz = car.lane.from.z + car.lane.dir.z * car.s;
        const step = (f: Partial<FootInput> = {}) => sim.step(idle, foot(f));
        for (let i = 0; i < 60; i++) step();
        step({ vehiclePressed: true });
        // Start 4 m out from the chosen face, shifted along it.
        const tx = cx + ax * 4 + (ax === 0 ? offset : 0), tz = cz + az * 4.5 + (az === 0 ? offset * 2 : 0);
        for (let n = 0; n < 900 && Math.hypot(tx - d.pos.x, tz - d.pos.z) > 0.25; n++) { const ex = tx - d.pos.x, ez = tz - d.pos.z, dist = Math.hypot(ex, ez); step({ moveX: ex / dist, moveZ: ez / dist }); }
        const push = { moveX: px + (px === 0 ? lean : 0), moveZ: pz + (pz === 0 ? lean : 0) };
        const len = Math.hypot(push.moveX, push.moveZ); push.moveX /= len; push.moveZ /= len;
        for (let i = 0; i < 90; i++) step(push);
        step({ ...push, jumpPressed: true });
        for (let i = 0; i < 80; i++) step(hold ? push : {});
        const after = d.pos.clone();
        const moves: number[] = [];
        for (const [mx, mz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const b = d.pos.clone(); for (let i = 0; i < 20; i++) step({ moveX: mx, moveZ: mz }); moves.push(d.pos.distanceTo(b)); }
        trials++;
        const free = moves.filter((m) => m > 0.8).length;
        if (free < 2) { stuck++; console.log(`STUCK ${face} offset ${offset} lean ${lean} hold ${hold}: at (${(after.x - cx).toFixed(2)}, ${after.y.toFixed(2)}, ${(after.z - cz).toFixed(2)}) rel. to car, moves ${moves.map((m) => m.toFixed(2)).join('/')}`); }
      }
    }
  }
}
console.log(`${stuck} stuck out of ${trials}`);
process.exit(stuck ? 1 : 0);
