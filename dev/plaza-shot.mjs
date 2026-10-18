// Level 1's concert square: the truck stopped at the bollards as the game's camera sees it, and from high over the stage.
// Prints how far the hidden amplifier is from the truck there. node dev/plaza-shot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=hillcity');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.evaluate(() => { for (const id of ['banner', 'help', 'chat', 'dev-jumps']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
await p.evaluate(() => window.game.sim.teleport(-210, 296, -Math.PI / 2));
await p.waitForTimeout(3500);
console.log(await p.evaluate(() => {
  const { sim } = window.game;
  const t = sim.truck.body.translation();
  const amp = sim.cargo.find((c) => c.type.id === 'amp');
  const a = amp.body.translation();
  return `truck ${t.x.toFixed(1)},${t.z.toFixed(1)}  amp ${a.x.toFixed(1)},${a.y.toFixed(2)},${a.z.toFixed(1)}  apart ${Math.hypot(a.x - t.x, a.z - t.z).toFixed(1)} m  full ${sim.fullValue}`;
}));
await p.screenshot({ path: 'dev/out/plaza-chase.png' });
await p.evaluate(() => {
  const { camera } = window.game;
  window.game.freeze = true;
  camera.position.set(-214, 40, 314);
  camera.lookAt(-238, 17, 296);
  camera.updateProjectionMatrix();
});
await p.waitForTimeout(800);
await p.screenshot({ path: 'dev/out/plaza-high.png' });
await p.evaluate(() => {
  const { camera } = window.game;
  camera.position.set(-247.5, 18.8, 293.5);
  camera.lookAt(-243, 17.3, 296.4);
  camera.updateProjectionMatrix();
});
await p.waitForTimeout(800);
await p.screenshot({ path: 'dev/out/plaza-back.png' });
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
