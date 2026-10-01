// Headless check of the truck and cargo physics: npm run sim-test
import { Quaternion, Vector3 } from 'three';
import { Sim } from '../src/sim/sim';
import type { DriveInput } from '../src/sim/truck';

const sim = await Sim.create();
const idle: DriveInput = { throttle: 0, steer: 0, handbrake: false };
let failures = 0;

function run(seconds: number, input: DriveInput, each?: () => void): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    sim.step(input);
    each?.();
  }
}

function upY(): number {
  const r = sim.truck.body.rotation();
  return new Vector3(0, 1, 0).applyQuaternion(new Quaternion(r.x, r.y, r.z, r.w)).y;
}

function report(label: string): void {
  const t = sim.truck.body.translation();
  console.log(
    `${label.padEnd(26)} pos=(${t.x.toFixed(1)}, ${t.y.toFixed(2)}, ${t.z.toFixed(1)})` +
      ` speed=${sim.truck.forwardSpeed().toFixed(1)}m/s up=${upY().toFixed(2)}` +
      ` cargo=${sim.cargoOnTruck()}/${sim.cargo.length}`,
  );
}

function check(name: string, ok: boolean): void {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

const mass = sim.truck.body.mass();
console.log(`truck mass ${mass.toFixed(0)} kg`);

// 1. Settle: the load must come to rest in the bed without jittering.
run(3, idle);
report('settled');
// Measured as displacement: resting velocities read non-zero because the suspension
// pushes back with an impulse every step.
const rest = sim.cargo.map((c) => c.lastPos.clone());
let maxDrift = 0;
run(10, idle, () => {
  sim.cargo.forEach((c, i) => {
    const p = c.lastPos;
    maxDrift = Math.max(maxDrift, Math.hypot(p.x - rest[i].x, p.y - rest[i].y, p.z - rest[i].z));
  });
});
console.log(`  cargo max drift over 10s at rest ${(maxDrift * 1000).toFixed(2)} mm`);
check('all cargo on truck after settling', sim.cargoOnTruck() === sim.cargo.length);
check('cargo at rest', maxDrift < 0.001);
check('truck upright', upY() > 0.99);

// 2. Gentle driving keeps the load.
run(4, { throttle: 0.5, steer: 0, handbrake: false });
report('half throttle 4s');
check('drives forward (+Z)', sim.truck.body.translation().z > 5);
check('gentle acceleration keeps all cargo', sim.cargoOnTruck() === sim.cargo.length);

// 3. Full throttle, then steer left.
run(4, { throttle: 1, steer: 0, handbrake: false });
report('full throttle 4s');
const before = sim.truck.body.translation().x;
run(2, { throttle: 0.6, steer: 1, handbrake: false });
report('steer left 2s');
check('steering left moves toward +X', sim.truck.body.translation().x > before + 1);
check('truck stays upright in a hard turn', upY() > 0.8);
check('a hard turn on W alone keeps the lower layer', sim.cargoOnTruck() >= sim.cargo.length - 4);

// 4. Emergency stop.
run(3, { throttle: -1, steer: 0, handbrake: false });
report('brake 3s');

// 5. Reset, then hit the speed bumps and the ramp flat out.
sim.reset();
run(1, idle);
check('reset restores all cargo', sim.cargoOnTruck() === sim.cargo.length);
let peakY = 0;
const trackPeak = () => {
  peakY = Math.max(peakY, sim.truck.body.translation().y);
};
run(14, { throttle: 1, steer: 0, handbrake: false }, trackPeak);
report('flat out, in the air');
// Land and stop before counting what is left.
run(4, { throttle: -1, steer: 0, handbrake: false }, trackPeak);
report('landed and braked');
console.log(`  peak chassis height ${peakY.toFixed(2)} m`);
check('truck gets airborne off the ramp', peakY > 1.5);

// 6. Rolled onto its roof and left there, the truck rights itself.
sim.reset();
run(1, idle);
const at = sim.truck.body.translation();
sim.truck.body.setTranslation({ x: at.x, y: at.y + 1.5, z: at.z }, true);
sim.truck.body.setRotation({ x: 0, y: 0, z: 1, w: 0 }, true);
run(1, idle);
check('truck is on its roof', upY() < -0.9);
run(4, idle);
report('after righting');
check('an overturned truck rights itself', upY() > 0.95 && sim.rightings === 1);
run(1, { throttle: 1, steer: 0, handbrake: false });
check('and can drive on', sim.truck.forwardSpeed() > 2);

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
