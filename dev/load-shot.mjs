// Screenshots of the truck and its load: at the start, close up, and after some rough driving.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.mouse.move(640, 360);
await page.mouse.wheel(0, -900);
await page.waitForTimeout(4500);
await page.screenshot({ path: 'dev/out/load-1-start.png' });
// A low view from the front quarter, to look at the truck itself.
await page.evaluate(() => { window.game.freeze = true; const { camera, sim } = window.game; const t = sim.truck.body.translation(); camera.position.set(t.x + 5.5, 3.2, t.z + 8.5); camera.lookAt(t.x, 1, t.z + 0.5); });
await page.screenshot({ path: 'dev/out/load-2-front.png' });
await page.evaluate(() => { const { camera, sim } = window.game; const t = sim.truck.body.translation(); camera.position.set(t.x - 5.5, 3.6, t.z - 8); camera.lookAt(t.x, 1, t.z - 0.5); });
await page.screenshot({ path: 'dev/out/load-3-rear.png' });
// Wreck everything, to see what each item looks like damaged and destroyed.
await page.evaluate(() => { const { sim } = window.game; window.game.freeze = false; for (const c of sim.cargo) c.knock = 9; });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'dev/out/load-4-damaged.png' });
for (let i = 0; i < 7; i++) {
  await page.evaluate(() => { const { sim } = window.game; for (const c of sim.cargo) c.knock = 60; });
  await page.waitForTimeout(1300);
}
await page.waitForTimeout(1500);
await page.screenshot({ path: 'dev/out/load-5-wrecked.png' });
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
