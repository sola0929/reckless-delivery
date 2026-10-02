// Screenshot of the fridge and wardrobe part-damaged, with doors off.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 20000 });
await page.waitForTimeout(2500);
for (let i = 0; i < 5; i++) {
  await page.evaluate(() => { for (const c of window.game.sim.cargo) if (['fridge', 'wardrobe', 'watermelon'].includes(c.type.id) && c.stage < 2) c.knock = 40; });
  await page.waitForTimeout(1300);
}
const stages = await page.evaluate(() => window.game.sim.cargo.filter((c) => ['fridge', 'wardrobe'].includes(c.type.id)).map((c) => `${c.type.id}: stage ${c.stage}, hp ${Math.round(c.hp)}`));
await page.evaluate(() => { window.game.freeze = true; const { camera, sim } = window.game; const t = sim.truck.body.translation(); camera.position.set(t.x + 0.3, 3.6, t.z - 2.2); camera.lookAt(t.x, 1.1, t.z + 1.6); });
await page.waitForTimeout(300);
await page.screenshot({ path: 'dev/out/doors-off.png' });
console.log(stages.join(' | '), errors.length ? errors.join('\n') : 'no errors');
await browser.close();
