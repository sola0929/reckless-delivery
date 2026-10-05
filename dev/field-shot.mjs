// The battlefield, photographed at a few places along it. node dev/field-shot.mjs
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/');
await page.evaluate(() => localStorage.setItem('cargo-best:city', JSON.stringify({ stars: 1, seconds: 200, fraction: 0.5 })));
await page.goto('http://localhost:5183/?level=battlefield');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 12000 }).catch(() => { console.log('never started:', errors.join(' / ')); process.exit(1); });
await page.waitForTimeout(1200);
await page.evaluate(() => { document.getElementById('banner').hidden = true; document.getElementById('help').hidden = true; });
await page.mouse.move(640, 360);
const go = async (name, x, z, yaw, wait, wheel = 0) => {
  await page.evaluate(([x, z, yaw]) => {
    const { sim } = window.game;
    const t = sim.truck.body.translation();
    const turn = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
    for (const c of sim.cargo) if (c.body) c.body.setTranslation({ x: 500, y: 1, z: 500 }, true);
    sim.truck.body.setTranslation({ x, y: t.y, z }, true);
    sim.truck.body.setRotation(turn, true);
    sim.truck.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }, [x, z, yaw]);
  for (let i = 0; i < Math.abs(wheel); i++) await page.mouse.wheel(0, Math.sign(wheel) * 300);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `dev/out/field-${name}.png` });
};
await go('7-farm', 19.5, 272, 0, 6500);
await go('8-farm-mid', 19.5, 318, 0, 5000);
await go('9-wood', 19.5, 376, 0, 1500);
await go('10-wood-smoke', 46, 404, 0, 2500);
await go('11-wood-leg', 30, 428.5, -1.2, 2000);
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
