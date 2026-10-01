// How much value survives different driving styles: npx tsx dev/damage-test.ts
import { STAGE_NAMES } from '../src/sim/cargo-types';
import { Sim } from '../src/sim/sim';
import type { DriveInput } from '../src/sim/truck';

const sim = await Sim.create();
const go = (throttle: number, steer = 0, boost = false, handbrake = false): DriveInput => ({ throttle, steer, handbrake, boost });
const idle = go(0);
const verbose = process.argv.includes('-v');
let failures = 0;

function scenario(name: string, script: [number, DriveInput][], expect: (kept: number) => boolean): void {
  sim.reset();
  const counts = { damage: 0, detach: 0, destroyed: 0, lost: 0 };
  for (const [seconds, input] of [[1.5, idle] as [number, DriveInput], ...script, [3, idle] as [number, DriveInput]]) {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      sim.step(input);
      for (const e of sim.drainEvents()) if (e.kind in counts) counts[e.kind as keyof typeof counts]++;
    }
  }
  const kept = sim.cargoValue() / sim.fullValue;
  const ok = expect(kept);
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(30)} value ${(kept * 100).toFixed(0).padStart(3)}%  ` +
      `on truck ${sim.cargoOnTruck()}/${sim.cargo.length}  hits ${counts.damage}  parts off ${counts.detach}  destroyed ${counts.destroyed}  lost ${counts.lost}`,
  );
  if (verbose) {
    const byType = new Map<string, string[]>();
    for (const c of sim.cargo) {
      const list = byType.get(c.type.name) ?? [];
      list.push(`${c.lost ? '遺失' : STAGE_NAMES[c.stage]} hp${c.hp.toFixed(0)} peak${c.peakImpact.toFixed(1)}`);
      byType.set(c.type.name, list);
    }
    for (const [type, list] of byType) console.log(`        ${type}: ${list.join(' | ')}`);
  }
}

const pulse = (n: number): [number, DriveInput][] => Array.from({ length: n }, (_, i) => [0.15, i % 2 ? idle : go(-1)] as [number, DriveInput]);

scenario('parked', [[5, idle]], (k) => k === 1);
// The careful runs stop short of the speed bumps at z = 30.
scenario('careful: W, pulsed brake', [[2, go(1)], ...pulse(30)], (k) => k > 0.98);
scenario('careful: gentle weave', [[1.5, go(1)], [1, go(0.3, 0.25)], [1, go(0.3, -0.25)], ...pulse(30)], (k) => k > 0.98);
scenario('speed bumps at 30 km/h', [[1.5, go(1)], [5, go(0.15)], ...pulse(30)], (k) => k > 0.9);
scenario('speed bumps at full throttle', [[7, go(1)], ...pulse(40)], (k) => k > 0.5);
// One rough manoeuvre should cost something, but not most of the load.
scenario('boost launch', [[3, go(1, 0, true)], ...pulse(40)], (k) => k > 0.7 && k < 0.95);
scenario('emergency stop from 80', [[6, go(1)], [3, go(-1)]], (k) => k > 0.85 && k < 1);
scenario('hard turn at speed', [[4, go(1)], [3, go(1, 1)], [2, go(-1)]], (k) => k > 0.5 && k < 0.95);
scenario('ramp jump flat out', [[14, go(1)], [4, go(-1)]], (k) => k > 0.75);
// Damage scales with the force of the hit, so a real crash or sustained recklessness is ruinous.
scenario('reverse into the wall', [[8, go(-1)]], (k) => k > 0.15 && k < 0.7);
scenario('boost and brake, three times', [[1.5, go(1, 0, true)], [1.2, go(-1)], [1.5, go(1, 0, true)], [1.2, go(-1)], [1.5, go(1, 0, true)], [1.5, go(-1)]], (k) => k > 0.1 && k < 0.6);

console.log(failures ? `\n${failures} scenario(s) outside the expected range` : '\nall scenarios in the expected range');
process.exit(failures ? 1 : 0);
