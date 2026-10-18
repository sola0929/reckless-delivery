// Level 1's riverside platform: pictures of it, and the bicycle thrown from it up into the truck on the bank, as the
// driver's throw would go (a 45 degree lob onto the bed). node dev/platform-check.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=hillcity');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.evaluate(() => { for (const id of ['banner', 'help', 'chat', 'dev-jumps']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
await p.evaluate(() => window.game.sim.teleport(46, 410.6, Math.PI / 2));
await p.waitForTimeout(3000);
await p.screenshot({ path: 'dev/out/platform-chase.png' });
console.log(await p.evaluate(() => {
  const { sim } = window.game;
  const bike = sim.cargo.find((c) => c.type.id === 'bicycle');
  const a = bike.body.translation();
  const t = sim.truck.body.translation();
  return `bike ${a.x.toFixed(1)},${a.y.toFixed(2)},${a.z.toFixed(1)} truck ${t.x.toFixed(1)},${t.y.toFixed(2)},${t.z.toFixed(1)} mass ${bike.body.mass().toFixed(1)}`;
}));
await p.evaluate(() => {
  const { camera } = window.game;
  window.game.freeze = true;
  camera.position.set(38, 14, 398);
  camera.lookAt(47, 10, 407);
  camera.updateProjectionMatrix();
});
await p.waitForTimeout(700);
await p.screenshot({ path: 'dev/out/platform-river.png' });
// The throw: from where the driver would stand by the bicycle, the item overhead, onto the middle of the bed.
const landed = await p.evaluate(async () => {
  const { sim } = window.game;
  const bike = sim.cargo.find((c) => c.type.id === 'bicycle');
  const t = sim.truck.body.translation();
  const start = { x: 47.5, y: t.y - 0.8 - 0.6 + 2.05 + 0.6, z: 406.6 };
  const feet = start.y - 2.05;
  const landing = { x: t.x - 0.9, y: t.y + 0.22 + 0.8, z: t.z };
  const range = Math.hypot(landing.x - start.x, landing.z - start.z);
  const drop = landing.y - start.y;
  const speed = Math.sqrt((9.81 * range * range) / (range - drop));
  const flat = speed * Math.cos(Math.PI / 4);
  const dx = (landing.x - start.x) / range, dz = (landing.z - start.z) / range;
  sim.cargoSystem.hold(bike);
  const V = bike.body.translation().constructor;
  sim.cargoSystem.release(bike, { x: start.x, y: start.y, z: start.z, clone() { return this; } }, { x: dx * flat, y: speed * Math.sin(Math.PI / 4), z: dz * flat }, true);
  await new Promise((r) => setTimeout(r, 3500));
  const a = bike.body.translation();
  return `range ${range.toFixed(1)} m, feet at ${feet.toFixed(2)}; bike now ${a.x.toFixed(1)},${a.y.toFixed(2)},${a.z.toFixed(1)} on bed: ${sim.truck.isOnBed(a)} found: ${bike.aboardOnce}`;
});
console.log(landed);
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
