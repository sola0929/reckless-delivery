// Screenshots of each part of the city, by carrying the truck and its load there.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/');
await page.waitForFunction(() => window.game, null, { timeout: 20000 });
await page.waitForTimeout(1500);
const go = async (name, x, z, zoomOut = 0) => {
  await page.evaluate(([x, z]) => {
    const { sim } = window.game;
    const t = sim.truck.body.translation();
    const move = (body) => { const p = body.translation(); body.setTranslation({ x: p.x + x - t.x, y: p.y, z: p.z + z - t.z }, true); };
    for (const c of sim.cargo) if (c.body) move(c.body);
    move(sim.truck.body);
  }, [x, z]);
  if (zoomOut) { await page.mouse.move(640, 360); await page.mouse.wheel(0, zoomOut); }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `dev/out/tour-${name}.png` });
};
await go('1-start', -5.25, 30);
await go('2-roadworks', 1, 96);
await go('3-humpback', 147, 196);
await go('4-school', 144.5, 310);
await go('5-roundabout', 143, 362);
await go('6-market', 148, 392);
await go('7-site', 152, 452);
await go('8-park-wide', 70, 300, 700);
const fps = await page.evaluate(() => new Promise((resolve) => { let n = 0; const t0 = performance.now(); const tick = () => (++n < 60 ? requestAnimationFrame(tick) : resolve(Math.round(60000 / (performance.now() - t0)))); requestAnimationFrame(tick); }));
console.log('fps', fps, errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
