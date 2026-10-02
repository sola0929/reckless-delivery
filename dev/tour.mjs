// Screenshots of each part of the city, by carrying the truck and its load there.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 20000 });
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
// Map squares are 16 m: x = (17.5 - column) * 16, z = row * 16, rows counted from the south.
const sq = (c, r) => [(17.5 - c) * 16, r * 16];
await go('1-oil-signs', ...sq(17.2, 41.22));
await go('2-oil', ...sq(14.8, 41.22));
await go('3-oil-wide', ...sq(14, 41.3), 700);
const fps = await page.evaluate(() => new Promise((resolve) => { let n = 0; const t0 = performance.now(); const tick = () => (++n < 60 ? requestAnimationFrame(tick) : resolve(Math.round(60000 / (performance.now() - t0)))); requestAnimationFrame(tick); }));
console.log('fps', fps, errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
