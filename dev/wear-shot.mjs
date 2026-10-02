// Screenshots of the opening manifest, and of the truck at each stage of wear.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 20000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'dev/out/wear-0-manifest.png' });
await page.waitForTimeout(9000);
const view = (dx, y, dz) => page.evaluate(([dx, y, dz]) => { window.game.freeze = true; const { camera, sim } = window.game; const t = sim.truck.body.translation(); camera.position.set(t.x + dx, y, t.z + dz); camera.lookAt(t.x, 1, t.z + 1.5); }, [dx, y, dz]);
for (const [name, wear] of [['1-light', 20], ['2-heavy', 50], ['3-wreck', 100]]) {
  await page.evaluate((wear) => { window.game.sim.truckWear = wear; }, wear);
  await view(5.5, 3.4, 9);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `dev/out/wear-${name}.png` });
}
await page.evaluate(() => { window.game.freeze = false; });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'dev/out/wear-4-chase.png' });
await page.keyboard.press('KeyR');
await page.waitForTimeout(800);
await view(5.5, 3.4, 9);
await page.waitForTimeout(300);
await page.screenshot({ path: 'dev/out/wear-5-reset.png' });
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
