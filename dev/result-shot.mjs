// Screenshot of the result page: carry the truck into the delivery bay and wait.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const { sim } = window.game;
  const t = sim.truck.body.translation();
  const [x, z] = sim.level.finish.pos;
  const move = (body, dx = 0) => { const p = body.translation(); body.setTranslation({ x: p.x + x - t.x + dx, y: p.y, z: p.z + z - t.z }, true); };
  // Leave a few items behind, so the page has something to count.
  sim.cargo.forEach((c, i) => c.body && move(c.body, i % 6 === 0 ? 9 : 0));
  move(sim.truck.body);
});
await page.waitForTimeout(5000);
await page.screenshot({ path: 'dev/out/result-delivered.png' });
await page.click('#result-retry');
await page.waitForTimeout(800);
const hidden = await page.evaluate(() => document.getElementById('result').hidden);
console.log('retry button hides the page:', hidden, errors.length ? errors.join('\n') : 'no errors');
await browser.close();
