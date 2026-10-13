// Level 3's proving ground, headless: the ground builds, the truck stands at each jump point, the machines go through
// their rounds, rocks fall and break. npx tsx dev/lab-check.ts
import { quarryLab } from '../src/levels/quarryLab';
import { Sim } from '../src/sim/sim';
const t0 = Date.now();
const level = quarryLab();
console.log(`built in ${Date.now() - t0} ms: ${level.props.length} props, ${level.objects?.length} objects`);
const sim = await Sim.create(level);
for (const spot of level.checkpoints!) {
  sim.teleport(spot.pos[0], spot.pos[1], spot.yaw);
  for (let i = 0; i < 90; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const p = sim.truck.body.translation();
  console.log(`${spot.name.padEnd(8, '　')} truck at ${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)}; load aboard ${sim.cargo.filter((c) => c.body && sim.truck.isOnBed(c.body.translation())).length}/${sim.cargo.length}`);
}
// The machines: put the truck by the dike and watch each one's moving part for 16 s.
sim.teleport(level.checkpoints![2].pos[0], level.checkpoints![2].pos[1], 0);
const travel = sim.rigs.list.map(() => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }));
for (let i = 0; i < 60 * 16; i++) {
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  sim.rigs.list.forEach((rig, n) => {
    const p = rig.parts[rig.parts.length - 1].body.translation();
    [p.x, p.y, p.z].forEach((v, k) => { travel[n].min[k] = Math.min(travel[n].min[k], v); travel[n].max[k] = Math.max(travel[n].max[k], v); });
  });
}
sim.rigs.list.forEach((rig, n) => console.log(`${rig.desc.kind.padEnd(9)} moving part ranged x ${travel[n].min[0].toFixed(1)}..${travel[n].max[0].toFixed(1)}, y ${travel[n].min[1].toFixed(1)}..${travel[n].max[1].toFixed(1)}, z ${travel[n].min[2].toFixed(1)}..${travel[n].max[2].toFixed(1)}`));
// The conveyors: 20 s with the truck under them.
sim.teleport(64, 50, 0);
let tells = 0, breaks = 0, maxFalling = 0;
for (let i = 0; i < 60 * 20; i++) {
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  tells += sim.droppers.tells.length;
  breaks += sim.droppers.breaks.length;
  maxFalling = Math.max(maxFalling, sim.droppers.rocks.filter((r) => r.falling).length);
}
console.log(`conveyors in 20 s: ${tells} warnings, ${breaks} rocks broken, at most ${maxFalling} falling at once; load value ${(sim.cargo.reduce((s, c) => s + c.value, 0) / sim.fullValue * 100).toFixed(0)}%`);
process.exit(0);
