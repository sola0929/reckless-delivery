// The view on foot: how far round it turns walking forward and to one side, straight to the side, and backward.
// node dev/foot-cam.mjs   (degrees of camera yaw turned in two seconds of each)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=hillcity');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.evaluate(() => window.game.sim.teleport(-211, 296, -Math.PI / 2));
await p.waitForTimeout(1500);
await p.keyboard.press('KeyC');
await p.waitForTimeout(1200);
const yaw = () => p.evaluate(() => { const d = window.game.camera.getWorldDirection(new window.game.camera.position.constructor()); return Math.atan2(d.x, d.z) * 180 / Math.PI; });
for (const keys of [['KeyW', 'KeyA'], ['KeyA'], ['KeyS'], ['KeyW'], ['KeyE'], ['KeyQ']]) {
  const before = await yaw();
  for (const k of keys) await p.keyboard.down(k);
  await p.waitForTimeout(2000);
  for (const k of keys) await p.keyboard.up(k);
  await p.waitForTimeout(300);
  let turned = (await yaw()) - before;
  turned = ((turned + 540) % 360) - 180;
  console.log(keys.join('+').padEnd(10), 'turned', turned.toFixed(0), 'deg');
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
