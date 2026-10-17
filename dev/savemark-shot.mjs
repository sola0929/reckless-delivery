// The save point's marks, before and after passing: node dev/savemark-shot.mjs <level>   (dev/out/savemark-<level>-*.png)
import { chromium } from 'playwright-core';
const level = process.argv[2] ?? 'quarry';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto(`http://localhost:5183/?level=${level}`);
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 60000 });
await p.keyboard.press('Enter');
await p.waitForTimeout(500);
await p.evaluate(() => {
  const s = game.sim, save = s.level.save, [x0, z0, x1, z1] = save.zone;
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, back = 22;
  s.teleport(mx - Math.sin(save.yaw) * back, mz - Math.cos(save.yaw) * back, save.yaw, save.y);
});
await p.waitForTimeout(2000);
await p.screenshot({ path: `dev/out/savemark-${level}-1.png` });
await p.keyboard.down('KeyW');
for (let i = 0; i < 120; i++) { if (await p.evaluate(() => game.sim.hasSave)) break; await p.waitForTimeout(50); }
await p.keyboard.up('KeyW');
await p.waitForTimeout(1500);
await p.screenshot({ path: `dev/out/savemark-${level}-2.png` });
console.log(level, 'saved', await p.evaluate(() => game.sim.hasSave), errors);
await b.close();
