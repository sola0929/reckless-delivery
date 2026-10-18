// Level 2's float across the lane, from each side: the truck stood 12 m off it, facing it. node dev/float-shot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=uptown');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.evaluate(() => { for (const id of ['banner', 'help', 'chat', 'dev-jumps']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
for (const [name, x, z, yaw] of [['east', 10, 880, -Math.PI / 2], ['west', -18, 880, Math.PI / 2], ['near', -16, 880, Math.PI / 2]]) {
  await p.evaluate(([x, z, yaw]) => window.game.sim.teleport(x, z, yaw), [x, z, yaw]);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `dev/out/float-${name}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
