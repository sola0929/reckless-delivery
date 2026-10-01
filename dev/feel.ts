// Measures acceleration and braking: npx tsx dev/feel.ts
import { Quaternion, Vector3 } from 'three';
import { Sim } from '../src/sim/sim';
import type { DriveInput } from '../src/sim/truck';
const sim = await Sim.create();
const idle: DriveInput = { throttle: 0, steer: 0, handbrake: false };
const pitchDeg = () => { const r = sim.truck.body.rotation(); const f = new Vector3(0, 0, 1).applyQuaternion(new Quaternion(r.x, r.y, r.z, r.w)); return (Math.asin(f.y) * 180) / Math.PI; };
function launch(label: string, input: DriveInput): void {
  sim.reset(); for (let i = 0; i < 60; i++) sim.step(idle);
  let lifted = 0, t60 = NaN, t100 = NaN, peakPitch = 0, peakA = 0, prev = 0;
  for (let i = 1; i <= 600; i++) {
    sim.step(input);
    const v = sim.truck.forwardSpeed();
    peakA = Math.max(peakA, (v - prev) * 60); prev = v;
    if (i <= 72) { peakPitch = Math.max(peakPitch, pitchDeg()); if (!sim.truck.controller.wheelIsInContact(0)) lifted++; }
    if (isNaN(t60) && v >= 60 / 3.6) t60 = i / 60;
    if (isNaN(t100) && v >= 100 / 3.6) t100 = i / 60;
    if (i === 180) console.log(`${label}: after 3s ${(v * 3.6).toFixed(0)} km/h, cargo ${sim.cargoOnTruck()}/${sim.cargo.length}`);
  }
  console.log(`${label}: 0-60 ${t60.toFixed(2)}s, 0-100 ${t100.toFixed(2)}s, top ${(sim.truck.forwardSpeed() * 3.6).toFixed(0)} km/h, peak accel ${peakA.toFixed(1)} m/s², nose-up ${peakPitch.toFixed(1)}° (front wheel off the ground ${lifted} steps)`);
}
function stop(label: string, fromKmh: number, holdS: boolean): void {
  sim.reset(); for (let i = 0; i < 60; i++) sim.step(idle);
  // Get up to speed gently so the load is undisturbed.
  while (sim.truck.forwardSpeed() < fromKmh / 3.6) sim.step({ throttle: 1, steer: 0, handbrake: false });
  const z0 = sim.truck.body.translation().z; const before = sim.cargoOnTruck();
  let n = 0, peakDive = 0;
  while (sim.truck.forwardSpeed() > 0.3 && n < 1200) {
    // Pulsed braking: 0.15 s on, 0.15 s off.
    const on = holdS || Math.floor(n / 9) % 2 === 0;
    sim.step({ throttle: on ? -1 : 0, steer: 0, handbrake: false }); n++;
    peakDive = Math.min(peakDive, pitchDeg());
  }
  for (let i = 0; i < 60; i++) sim.step(idle);
  console.log(`${label}: ${fromKmh}->0 in ${(n / 60).toFixed(2)}s, ${(sim.truck.body.translation().z - z0).toFixed(1)} m, avg ${(fromKmh / 3.6 / (n / 60)).toFixed(1)} m/s², dive ${(-peakDive).toFixed(1)}°, cargo ${before} -> ${sim.cargoOnTruck()}`);
}
launch('W      ', { throttle: 1, steer: 0, handbrake: false });
launch('Shift  ', { throttle: 1, steer: 0, handbrake: false, boost: true });
stop('hold S ', 80, true);
stop('pulse S', 80, false);
