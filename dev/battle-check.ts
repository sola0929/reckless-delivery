// Each thing a battle does, tried once on the proving ground. npx tsx dev/battle-check.ts
import { range } from '../src/levels/range';
import { Sim } from '../src/sim/sim';
import type { DriveInput } from '../src/sim/truck';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const stop: DriveInput = { throttle: 0, steer: 0, handbrake: true };
const go: DriveInput = { throttle: 1, steer: 0, handbrake: false };
async function at(x: number, z: number): Promise<Sim> {
  const sim = await Sim.create(range());
  for (let i = 0; i < 90; i++) sim.step(stop);
  const t = sim.truck.body.translation();
  const move = (b: { translation(): { x: number; y: number; z: number }; setTranslation(p: { x: number; y: number; z: number }, wake: boolean): void }) => { const p = b.translation(); b.setTranslation({ x: p.x + x - t.x, y: p.y, z: p.z + z - t.z }, true); };
  for (const c of sim.cargo) if (c.body) move(c.body);
  move(sim.truck.body);
  return sim;
}
const kept = (sim: Sim) => `${Math.round((sim.cargoValue() / sim.fullValue) * 100)}% of the load left`;

{ // Shelling: nothing lands without its circle having been up two seconds; flat out in a straight line is the way to be hit.
  const sim = await at(0, 65);
  let landed = 0, warned = 99;
  for (let i = 0; i < 60 * 9; i++) { sim.step(stop); for (const s of sim.battle.shells) warned = Math.min(warned, s.total); landed += sim.battle.bursts.filter((b) => b.kind === 'shell').length; }
  check('shells fall on a truck that sits in the barrage', landed >= 4 && sim.cargoValue() < sim.fullValue, `${landed} landed, ${kept(sim)}`);
  check('each with two seconds of warning', warned >= 2, `${warned} s`);
  check('and none of it ends anything', !sim.result);
  const dash = await at(0, -20);
  let direct = 0, high = 0, seconds = 0;
  for (let i = 0; i < 60 * 12 && dash.truck.body.translation().z < 112; i++) {
    dash.step(go);
    seconds = i / 60;
    direct += dash.battle.bursts.filter((b) => b.kind === 'shell' && b.direct).length;
    high = Math.max(high, dash.truck.body.translation().y);
  }
  check('flat out in a straight line, the truck is hit', direct >= 1 && !dash.result, `${direct} direct hits, thrown ${high.toFixed(1)} m up, through in ${seconds.toFixed(1)} s, ${kept(dash)}`);
}
{ // Crossfire: rounds all over the stretch, some through the load; none outside it.
  const on = await at(0, 170), off = await at(0, 10);
  let most = 0, shots = 0;
  for (let i = 0; i < 60 * 8; i++) { on.step(stop); off.step(stop); most = Math.max(most, on.battle.rounds.length); shots += on.drainShots(); }
  check('stray rounds cross the road and go through the load', most >= 8 && shots > 0 && on.cargoValue() < on.fullValue, `up to ${most} in the air, ${shots} hits in 8 s, ${kept(on)}`);
  check('and only where the fighting is', off.cargoValue() === off.fullValue && off.battle.rounds.length === 0, kept(off));
}
{ // A launcher: locks for three seconds, fires straight; a standing truck is hit and thrown, then left alone a while.
  const open = await at(0, 250), hidden = await at(-6.2, 250);
  let lock = 0, fired = 0, high = 0, behind = 0;
  const hits: number[] = [];
  for (let i = 0; i < 60 * 16; i++) {
    open.step(stop); hidden.step(stop);
    if (!fired) lock += 1 / 60;
    fired += open.battle.sounds.filter((s) => s.kind === 'launch').length;
    if (open.battle.bursts.some((b) => b.direct)) hits.push(i / 60);
    high = Math.max(high, open.truck.body.translation().y);
    behind = Math.max(behind, hidden.battle.launchers[0].lock);
  }
  const gap = Math.min(99, ...hits.slice(1).map((t, i) => t - hits[i]));
  check('a launcher locks on, then fires', fired >= 1 && lock > 1.2 && lock < 1.8, `first fired after ${lock.toFixed(1)} s`);
  check('a truck that sits there is hit and thrown, and the run goes on', hits.length >= 1 && high > 1.8 && !open.result, `${hits.length} hits, thrown ${high.toFixed(1)} m up, ${kept(open)}`);
  check('and after a hit it is left alone long enough to get going', gap > 8, `hits at ${hits.map((t) => t.toFixed(1)).join(', ')} s`);
  check('a wall between breaks the lock', behind < 0.05, `lock reached ${behind.toFixed(2)}`);
}
{ // Tanks: bumped or passed, nothing. One of their soldiers run down, those of his army nearby turn their guns.
  const bump = await at(-7, 312);
  for (let i = 0; i < 60 * 3; i++) bump.step({ throttle: 0.6, steer: -0.2, handbrake: false });
  const sim = await at(0, 345);
  for (let i = 0; i < 60 * 2; i++) sim.step(stop);
  check('a tank passed by takes no notice', sim.battle.tanks.every((t) => !t.hostile) && (bump.pedestrians.hits > 0 || bump.battle.tanks.every((t) => !t.hostile)));
  sim.battle.rouse(0, 0, 345);
  let shot = -1;
  for (let i = 0; i < 60 * 8 && shot < 0; i++) { sim.step(stop); if (sim.battle.sounds.some((s) => s.kind === 'cannon' && !s.far)) shot = i / 60; }
  check('a soldier run down: his army\'s tanks nearby turn on the truck, the other army\'s do not', sim.battle.tanks[0].hostile && !sim.battle.tanks[1].hostile && shot > 1, `fired after ${shot.toFixed(1)} s`);
  const mow = await at(-3, 306);
  for (let i = 0; i < 60 * 5; i++) mow.step({ throttle: 0.7, steer: 0, handbrake: false });
  check('driving through the soldiers rouses them', mow.pedestrians.hits === 0 || mow.battle.tanks.some((t) => t.hostile), `${mow.pedestrians.hits} run down`);
  const t = sim.truck.body.translation();
  sim.truck.body.setTranslation({ x: t.x, y: t.y, z: t.z - 120 }, true);
  for (let i = 0; i < 60 * 3; i++) sim.step(stop);
  check('and out of reach they give up', sim.battle.tanks.every((tank) => !tank.hostile));
}
{ // Mud and wire hold the truck back; a mine goes off under it.
  const road = await at(0, 10), mud = await at(-3, 239), wire = await at(3.5, 147);
  let wired = 0;
  for (let i = 0; i < 150; i++) { road.step(go); mud.step(go); wire.step(go); if (i === 60) wired = wire.truck.forwardSpeed(); }
  check('mud and wire hold the truck back', mud.truck.forwardSpeed() < road.truck.forwardSpeed() * 0.85 && wired < 5.5, `after 2.5 s: road ${(road.truck.forwardSpeed() * 3.6).toFixed(0)}, mud ${(mud.truck.forwardSpeed() * 3.6).toFixed(0)} km/h; wire ${(wired * 3.6).toFixed(0)} after 1 s`);
  const mines = await at(0.5, 464);
  let bang = 0;
  for (let i = 0; i < 60 * 4; i++) { mines.step({ throttle: 0.6, steer: 0, handbrake: false }); bang += mines.drainBlasts().filter((b) => b.kind === 'mine').length; }
  check('a mine on the straight line goes off under the truck, and only that one', bang >= 1 && bang <= 2 && !mines.result, `${bang} went off, ${kept(mines)}`);
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
