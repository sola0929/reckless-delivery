// What in a run leaves the physics slower after a restart: one place at a time. npx tsx dev/reset-which.ts <jump point, 1-10>
import RAPIER from '@dimforge/rapier3d-compat';
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const without = process.argv[3];
const sim = await Sim.create(without === 'coils' ? { ...level, rollers: [] } : without === 'traffic' ? { ...level, traffic: [] } : without === 'riders' ? { ...level, riders: [] } : without === 'crowds' ? { ...level, crowds: [] } : level);

const world = (sim as unknown as { world: RAPIER.World }).world;
let engine = 0;
const step = world.step.bind(world);
world.step = ((...args: Parameters<typeof world.step>) => { const t0 = performance.now(); step(...args); engine += performance.now() - t0; }) as typeof world.step;
const time = () => {
  engine = 0;
  for (let i = 0; i < 300; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  return (engine / 300).toFixed(2);
};
time();
const fresh = time();
const k = Number(process.argv[2]) - 1;
const spot = level.checkpoints![k];
sim.teleport(spot.pos[0], spot.pos[1], spot.yaw);
for (let i = 0; i < 60 * 20; i++) sim.step({ throttle: 0.6, steer: Math.sin(i / 50) * 0.4, handbrake: false });
if (without === 'stow-first') {
  for (const c of sim.objects.objects.filter((o) => o.desc.kind === 'steelCoil' && o.desc.pos[1] < -50)) sim.objects.stow(c);
  sim.step({ throttle: 0, steer: 0, handbrake: true });
}
sim.reset();
console.log(`${spot.name}${without ? ` without ${without}` : ''}: engine ${fresh} ms a step fresh, ${time()} after 20 s there and a restart`);
const coils = sim.objects.objects.filter((o) => o.desc.kind === 'steelCoil' && o.desc.pos[1] < -50);
const away = coils.filter((c) => { const p = c.body.translation(); return Math.hypot(p.x - c.desc.pos[0], p.y - c.desc.pos[1], p.z - c.desc.pos[2]) > 0.5; });
console.log(`coils not back where they wait: ${away.length} of ${coils.length}; awake ${coils.filter((c) => !c.body.isSleeping()).length}; gravity ${[...new Set(coils.map((c) => c.body.gravityScale()))].join('/')}; ccd ${coils.filter((c) => c.body.isCcdEnabled()).length}`);
const cars = sim.traffic.cars;
console.log(`cars: ${cars.filter((c) => c.body.isDynamic()).length} dynamic of ${cars.length}; knocked ${cars.filter((c) => c.knocked > 0).length}`);
const moved = sim.objects.objects.filter((o) => { const p = o.body.translation(); return Math.hypot(p.x - o.desc.pos[0], p.y - o.desc.pos[1], p.z - o.desc.pos[2]) > 0.5; });
console.log(`objects not where they were put: ${moved.length}: ${[...new Set(moved.map((o) => o.desc.kind))].slice(0, 12).join(', ')}`);
process.exit(0);
