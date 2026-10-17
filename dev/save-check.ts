// The save point on each level, headless: short of it, hurt one item, wreck another, throw a third off; drive through the
// save point; then lose everything and go back to it. The load must come back as it was saved, worth what it was then.
// npx tsx dev/save-check.ts [level ...]
import { LEVELS } from '../src/levels';
import { Sim } from '../src/sim/sim';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['hillcity', 'uptown', 'quarry'];
const park = { throttle: 0, steer: 0, handbrake: true };
for (const id of ids) {
  const level = LEVELS[id]();
  const save = level.save!;
  const sim = await Sim.create({ ...level, crowds: [] });
  const [x0, z0, x1, z1] = save.zone;
  const mid = [(x0 + x1) / 2, (z0 + z1) / 2];
  // Which way to come in: along the restart's heading, from 20 m back from the zone's middle.
  const fx = Math.sin(save.yaw), fz = Math.cos(save.yaw);
  const back = id === 'quarry' ? 11 : 20;
  sim.teleport(mid[0] - fx * back, mid[1] - fz * back, save.yaw, save.y);
  for (let i = 0; i < 60; i++) sim.step(park);
  const items = sim.cargo;
  const cs = (sim as any).cargoSystem;
  cs.damage(items[0], 45);
  cs.damage(items[1], 100);
  items[2].body!.setTranslation({ x: mid[0] + 30, y: 40, z: mid[1] }, true);
  for (let i = 0; i < 90; i++) sim.step(park);
  const describe = () => {
    const t = sim.tally();
    return `$${Math.round(sim.cargoValue())} (${t.intact} intact, ${t.damaged} damaged, ${t.destroyed} destroyed, ${t.lost} lost; item 0 hp ${Math.round(items[0].hp)}, item 1 stage ${items[1].stage}, scrap ${items[1].scrapShare.toFixed(2)})`;
  };
  const before = sim.hasSave;
  let saved = false;
  for (let i = 0; i < 60 * 8 && !saved; i++) {
    sim.step({ throttle: sim.truck.forwardSpeed() < 3 ? 0.5 : 0, steer: 0, handbrake: false });
    saved = sim.takeSaved();
  }
  for (let i = 0; i < 60; i++) sim.step(park);
  console.log(`${id}: saved before the zone ${before}; saved driving in ${saved}: ${describe()}`);
  for (const item of items) item.body?.setTranslation({ x: mid[0] + 60, y: 40, z: mid[1] }, true);
  for (let i = 0; i < 30; i++) sim.step(park);
  console.log(`  everything thrown off: $${Math.round(sim.cargoValue())}`);
  sim.backToSave();
  for (let i = 0; i < 150; i++) sim.step(park);
  const t = sim.truck.body.translation();
  console.log(`  back to the save: ${describe()}; truck at ${t.x.toFixed(1)},${t.z.toFixed(1)}; retries ${sim.retries}`);
}
process.exit(0);
