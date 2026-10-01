// Headless check that cargo never passes through the bed walls: npx tsx dev/clip-test.ts
// Cargo may leave over the top of a wall, but not through it.
import { Quaternion, Vector3 } from 'three';
import { TRUCK } from '../src/config';
import { Sim } from '../src/sim/sim';
import type { DriveInput } from '../src/sim/truck';

const sim = await Sim.create();
const wallTop = TRUCK.sideWall.pos[1] + TRUCK.sideWall.half[1];
const outerX = TRUCK.sideWall.pos[0] + TRUCK.sideWall.half[0];
const backOuter = TRUCK.tailgate.pos[2] - TRUCK.tailgate.half[2];
const cabBack = TRUCK.cab.pos[2] - TRUCK.cab.half[2];

const sideX = TRUCK.sideWall.pos[0];
const backZ = TRUCK.tailgate.pos[2];
const q = new Quaternion();

/** Cargo centres in chassis space. */
function localCentres(): Vector3[] {
  const t = sim.truck.body.translation();
  const r = sim.truck.body.rotation();
  q.set(r.x, r.y, r.z, r.w).invert();
  return sim.cargo.map((c) => {
    const p = c.lastPos;
    return new Vector3(p.x - t.x, p.y - t.y, p.z - t.z).applyQuaternion(q);
  });
}

let failures = 0;

function scenario(name: string, script: [number, DriveInput][]): void {
  sim.reset();
  const clipped: string[] = [];
  let time = 0;
  let prev = localCentres();
  const idle: DriveInput = { throttle: 0, steer: 0, handbrake: false };
  for (const [seconds, input] of [[1, idle] as [number, DriveInput], ...script]) {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      sim.step(input);
      time += 1 / 60;
      const now = localCentres();
      now.forEach((p, k) => {
        // A destroyed or lost item no longer moves; the truck driving on would look like a crossing.
        if (!sim.cargo[k].body || sim.cargo[k].lost) return;
        // A crate going over a wall has its centre above the wall top as it crosses the
        // wall's mid-plane. Crossing below the top means it went through.
        if (p.y > wallTop - 0.05 || p.y < 0) return;
        const side = Math.abs(prev[k].x) < sideX && Math.abs(p.x) >= sideX && p.z > backOuter && p.z < cabBack;
        const back = prev[k].z > backZ && p.z <= backZ && Math.abs(p.x) < outerX;
        if (side || back) clipped.push(`crate ${k} through the ${side ? 'side wall' : 'tailgate'} at t=${time.toFixed(1)}s, height ${p.y.toFixed(2)}`);
      });
      prev = now;
    }
  }
  const ok = clipped.length === 0;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(28)} cargo left ${sim.cargoOnTruck()}/${sim.cargo.length}`);
  for (const line of clipped) console.log(`        ${line}`);
}

const go = (throttle: number, steer = 0, handbrake = false): DriveInput => ({ throttle, steer, handbrake });

scenario('hard left at speed', [[4, go(1)], [3, go(1, 1)]]);
scenario('hard right at speed', [[4, go(1)], [3, go(1, -1)]]);
scenario('weave', [[3, go(1)], [1, go(1, 1)], [1, go(1, -1)], [1, go(1, 1)], [1, go(1, -1)], [2, go(0)]]);
scenario('handbrake turn', [[5, go(1)], [2, go(0, 1, true)], [2, go(0)]]);
scenario('full throttle launch', [[6, go(1)]]);
scenario('reverse then brake', [[4, go(-1)], [2, go(1)]]);
scenario('speed bumps and ramp', [[14, go(1)], [3, go(-1)]]);
scenario('reverse into the wall', [[8, go(-1)]]);
scenario('slow tight circles', [[1.5, go(1)], [10, go(0.5, 1)]]);
const boost = (steer = 0): DriveInput => ({ throttle: 1, steer, handbrake: false, boost: true });
scenario('boost launch', [[3, boost()], [2, go(0)]]);
scenario('boost then emergency stop', [[4, boost()], [3, go(-1)], [1, go(0)]]);
scenario('repeated boost and brake', [[1.5, boost()], [1, go(-1)], [1.5, boost()], [1, go(-1)], [1.5, boost()], [1.5, go(-1)]]);
scenario('boost through a turn', [[2.5, boost()], [3, boost(1)], [2, go(-1, -1)]]);

console.log(failures ? `\n${failures} scenario(s) failed` : '\nno cargo passed through a wall');
process.exit(failures ? 1 : 0);
