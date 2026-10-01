// How much of the load survives driving head-on into a wall or a tree at different
// speeds: npx tsx dev/crash-test.ts
import { sandbox } from '../src/levels/sandbox';
import type { LevelDef } from '../src/levels/types';
import { Sim } from '../src/sim/sim';

const verbose = process.argv.includes('-v');
let failures = 0;

/** An empty lot with one thing to hit, 140 m ahead of the truck. */
function lot(obstacle: 'wall' | 'tree'): LevelDef {
  return {
    ...sandbox(),
    props: [
      obstacle === 'wall'
        ? { shape: 'box', size: [10, 3, 1], pos: [0, 3, 141], color: 0x888888 }
        : { shape: 'cylinder', size: [0.18, 1.3, 0], pos: [0, 1.3, 140.2], color: 0x6b4a2e },
    ],
  };
}

async function crash(obstacle: 'wall' | 'tree', kmh: number): Promise<number> {
  const sim = await Sim.create(lot(obstacle));
  const idle = { throttle: 0, steer: 0, handbrake: false };
  for (let i = 0; i < 60; i++) sim.step(idle);
  const target = kmh / 3.6;
  // Build up speed gently so the load is undisturbed, hold it, and drive straight in.
  let hit = false;
  for (let i = 0; i < 60 * 40 && !hit; i++) {
    const speed = sim.truck.forwardSpeed();
    sim.step({ throttle: speed < target ? 0.6 : 0, steer: 0, handbrake: false });
    hit = sim.truck.body.translation().z > 100 && sim.truck.forwardSpeed() < speed - 1.5;
  }
  for (let i = 0; i < 60 * 5; i++) sim.step(idle);

  const kept = sim.cargoValue() / sim.fullValue;
  const count = (test: (c: (typeof sim.cargo)[number]) => boolean) => sim.cargo.filter(test).length;
  console.log(
    `${obstacle} at ${String(kmh).padStart(2)} km/h: kept ${String(Math.round(kept * 100)).padStart(3)}%` +
      `  intact ${count((c) => c.stage === 0 && !c.fallen)}  light ${count((c) => c.stage === 1 && !c.fallen)}` +
      `  heavy ${count((c) => c.stage === 2 && !c.fallen)}  destroyed ${count((c) => c.stage === 3)}  lost ${count((c) => c.fallen && c.stage !== 3)}`,
  );
  if (verbose) console.log(`    peaks ${sim.cargo.map((c) => c.peakImpact.toFixed(0)).join(' ')}`);
  return kept;
}

function check(name: string, ok: boolean): void {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

for (const obstacle of ['wall', 'tree'] as const) {
  const kept: number[] = [];
  for (const kmh of [20, 40, 60, 80]) kept.push(await crash(obstacle, kmh));
  const [at20, at40, at60, at80] = kept;
  // One crash, however bad, should leave room to recover: failing a level (below 60%)
  // ought to take more than a single mistake.
  check(`a ${obstacle} at 20 km/h is a scare, not a disaster`, at20 > 0.9);
  check(`at 40 km/h the load is dented`, at40 > 0.75 && at40 < 0.95);
  check(`at 60 km/h it is serious but survivable`, at60 > 0.6 && at60 < 0.85);
  check(`at 80 km/h it is touch and go`, at80 > 0.3 && at80 < 0.75);
  check(`faster is always worse`, at20 >= at40 && at40 >= at60 && at60 >= at80);
}

// The worst a player can do in one go: hold boost from a standstill straight into a wall.
{
  const sim = await Sim.create({ ...sandbox(), props: [{ shape: 'box', size: [10, 3, 1], pos: [0, 3, 145], color: 0x888888 }] });
  const idle = { throttle: 0, steer: 0, handbrake: false };
  for (let i = 0; i < 60; i++) sim.step(idle);
  let top = 0;
  for (let i = 0; i < 60 * 30; i++) {
    const speed = sim.truck.forwardSpeed();
    top = Math.max(top, speed);
    sim.step({ throttle: 1, steer: 0, handbrake: false, boost: true });
    if (sim.truck.body.translation().z > 100 && sim.truck.forwardSpeed() < speed - 1.5) break;
  }
  for (let i = 0; i < 60 * 5; i++) sim.step(idle);
  const kept = sim.cargoValue() / sim.fullValue;
  console.log(`boost flat out into a wall at ${Math.round(top * 3.6)} km/h: kept ${Math.round(kept * 100)}%`);
  check('one flat-out crash does not write the load off', kept > 0.45);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
