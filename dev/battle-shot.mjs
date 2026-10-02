// Screenshots along the proving ground: the barrage, the guns, a launcher locking on, the tanks, the smoke, the mines.
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
const go = async (name, x, z, wait) => {
  await page.evaluate(([x, z]) => {
    const { sim } = window.game;
    const t = sim.truck.body.translation();
    const move = (body) => { const p = body.translation(); body.setTranslation({ x: p.x + x - t.x, y: p.y, z: p.z + z - t.z }, true); body.setLinvel({ x: 0, y: 0, z: 0 }, true); };
    for (const c of sim.cargo) if (c.body) move(c.body);
    move(sim.truck.body);
  }, [x, z]);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `dev/out/battle-${name}.png` });
};
await go('1-shelling', 0, 60, 2600);
await go('2-guns', 0, 112, 1500);
await go('3-launcher', 0, 200, 2300);
await go('4-tanks', 0, 258, 1200);
await go('5-smoke', 0, 338, 1500);
await go('6-mines', 0, 384, 1200);
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
