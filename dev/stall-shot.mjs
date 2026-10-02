// Drive through the market stalls and look at what is left of them.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 20000 });
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const { sim } = window.game;
  const t = sim.truck.body.translation();
  const [x, z] = [-152 + 3.6, 222];
  for (const c of sim.cargo) if (c.body) { const p = c.body.translation(); c.body.setTranslation({ x: p.x + x - t.x, y: p.y, z: p.z + z - t.z }, true); }
  sim.truck.body.setTranslation({ x, y: t.y, z }, true);
});
await page.waitForTimeout(600);
await page.screenshot({ path: 'dev/out/stall-1-before.png' });
await page.keyboard.down('KeyW');
await page.waitForTimeout(1700);
await page.screenshot({ path: 'dev/out/stall-2-hit.png' });
await page.waitForTimeout(1600);
await page.keyboard.up('KeyW');
await page.waitForTimeout(1500);
const wrecked = await page.evaluate(() => window.game.sim.objects.objects.filter((o) => o.wrecked).length);
await page.evaluate(() => { window.game.freeze = true; const { camera } = window.game; camera.position.set(-152 - 6, 9, 228); camera.lookAt(-152 + 3.5, 0.5, 240); });
await page.waitForTimeout(300);
await page.screenshot({ path: 'dev/out/stall-3-after.png' });
console.log('stalls wrecked:', wrecked, errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
