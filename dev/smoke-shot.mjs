// The smoke on the proving ground, from the usual view and from one pulled right back. node dev/smoke-shot.mjs
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/?level=range');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.waitForTimeout(1200);
await page.evaluate(() => { document.getElementById('banner').hidden = true; document.getElementById('help').hidden = true; });
await page.evaluate(([x, z]) => {
  const { sim } = window.game;
  const t = sim.truck.body.translation();
  const move = (body) => { const p = body.translation(); body.setTranslation({ x: p.x + x - t.x, y: p.y, z: p.z + z - t.z }, true); body.setLinvel({ x: 0, y: 0, z: 0 }, true); };
  for (const c of sim.cargo) if (c.body) move(c.body);
  move(sim.truck.body);
}, [0, 420]);
await page.waitForTimeout(1500);
await page.screenshot({ path: 'dev/out/smoke-near.png' });
await page.mouse.move(640, 360);
for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 300);
await page.waitForTimeout(1200);
await page.screenshot({ path: 'dev/out/smoke-far.png' });
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
