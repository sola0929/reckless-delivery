// The air conditioner on the 6 m lift, close up from the height the game's camera looks from. node dev/aircon-shot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=hillcity');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.evaluate(() => { for (const id of ['banner', 'help', 'chat', 'dev-jumps', 'hud']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
await p.waitForTimeout(1000);
await p.evaluate(() => {
  const { camera } = window.game;
  window.game.freeze = true;
  camera.position.set(-96.5, 21, 447.5);
  camera.lookAt(-94.2, 17.2, 444.4);
  camera.updateProjectionMatrix();
});
await p.waitForTimeout(800);
await p.screenshot({ path: 'dev/out/aircon.png' });
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
