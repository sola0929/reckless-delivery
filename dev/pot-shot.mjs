// Level 2's soup pot on top of the temple path's scaffold, seen from the truck coming up the path. node dev/pot-shot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=uptown');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.evaluate(() => { for (const id of ['banner', 'help', 'chat', 'dev-jumps']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
await p.evaluate(() => window.game.sim.teleport(8, 893, 0));
await p.waitForTimeout(3000);
await p.screenshot({ path: 'dev/out/pot-chase.png' });
// From the steps, as a player coming down them would see it.
for (const [name, x, z, yaw] of [['steps', 40, 943, -Math.PI / 2], ['landing', 28, 938, -2.4]]) {
  await p.evaluate(([x, z, yaw]) => window.game.sim.teleport(x, z, yaw), [x, z, yaw]);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `dev/out/pot-${name}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
