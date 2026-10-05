// The truck driven up the showcase's stepped street from the quay: how it takes the risers. npx tsx dev/relief-steps-up.ts
import { reliefShow } from '../src/levels/reliefShow';
import { heightAt } from '../src/levels/terrain';
import { Sim } from '../src/sim/sim';

const level = reliefShow();
const run = await Sim.create(level);
for (let i = 0; i < 30; i++) run.step({ throttle: 0, steer: 0, handbrake: true });
for (const c of run.cargo) if (c.body) c.body.setTranslation({ x: 400, y: 2, z: 400 }, true);
run.truck.body.setTranslation({ x: 0, y: heightAt(level.terrain, 0, 450) + 1, z: 450 }, true);
run.truck.body.setRotation({ x: 0, y: 1, z: 0, w: 0 }, true);
let was = 0;
for (let i = 0; i < 60 * 14; i++) {
  const speed = run.truck.forwardSpeed();
  run.step({ throttle: speed < 8 ? 0.9 : 0, steer: 0, handbrake: false });
  const p = run.truck.body.translation();
  if (i % 30 === 0 || was - speed > 1) console.log(`t ${(i / 60).toFixed(1)}  z ${p.z.toFixed(1)}  y ${p.y.toFixed(2)} (ground ${heightAt(level.terrain, p.x, p.z).toFixed(2)})  speed ${speed.toFixed(1)}${was - speed > 1 ? '  <- lost ' + (was - speed).toFixed(1) : ''}`);
  was = speed;
}
process.exit(0);
