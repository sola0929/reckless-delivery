// The terrain showcase, photographed at places along its road. npx tsx dev/relief-places.ts && node dev/relief-shot.mjs
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/');
await page.evaluate(() => localStorage.setItem('cargo-best:city', JSON.stringify({ stars: 1, seconds: 200, fraction: 0.5 })));
await page.goto('http://localhost:5183/?level=relief');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 12000 }).catch(() => { console.log('never started:', errors.join(' / ')); process.exit(1); });
await page.waitForTimeout(1200);
await page.evaluate(() => { document.getElementById('banner').hidden = true; document.getElementById('help').hidden = true; });
await page.mouse.move(640, 360);
const go = async ({ name, x, y, z, yaw }) => {
  await page.evaluate(([x, y, z, yaw]) => {
    const { sim } = window.game;
    for (const c of sim.cargo) if (c.body) c.body.setTranslation({ x: 500, y: 1, z: 500 }, true);
    sim.truck.body.setTranslation({ x, y, z }, true);
    sim.truck.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    sim.truck.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    sim.truck.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, [x, y, z, yaw]);
  await page.waitForTimeout(3200);
  await page.screenshot({ path: `dev/out/relief-${name}.png` });
};
for (const place of JSON.parse(readFileSync('dev/out/relief-places.json', 'utf8'))) await go(place);
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
