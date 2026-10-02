// Screenshots of the lifting bridge: the approach, and a truck that didn't make it.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const { sim } = window.game;
  const t = sim.truck.body.translation();
  const [x, z] = [-43.5, 366];
  const move = (body) => { const p = body.translation(); body.setTranslation({ x: p.x + x - t.x, y: p.y, z: p.z + z - t.z }, true); };
  for (const c of sim.cargo) if (c.body) move(c.body);
  move(sim.truck.body);
});
await page.mouse.move(640, 360);
await page.mouse.wheel(0, 500);
await page.waitForTimeout(1200);
await page.screenshot({ path: 'dev/out/bridge-1-approach.png' });
await page.keyboard.down('KeyW');
await page.waitForTimeout(2300);
await page.keyboard.up('KeyW');
await page.screenshot({ path: 'dev/out/bridge-2-edge.png' });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'dev/out/bridge-3-splash.png' });
await page.waitForTimeout(3000);
await page.screenshot({ path: 'dev/out/bridge-4-sunk.png' });
await browser.close();
