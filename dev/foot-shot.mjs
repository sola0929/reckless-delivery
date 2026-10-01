// Screenshots of the driver on foot: out of the cab, carrying, winding up a throw, the landing.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/?level=sandbox');
await page.waitForFunction(() => window.game, null, { timeout: 20000 });
await page.waitForTimeout(1200);
const shot = (name) => page.screenshot({ path: `dev/out/foot-${name}.png` });
const state = () => page.evaluate(() => { const { sim } = window.game; const d = sim.driver; return { mode: d.mode, held: d.held?.type.id ?? null, charge: +d.charge.toFixed(2), inBed: d.plan?.inBed ?? null, value: Math.round(sim.cargoValue()), onTruck: sim.cargoOnTruck(), prompt: document.getElementById('prompt').textContent }; });

await page.keyboard.press('KeyC');
await page.waitForTimeout(900);
await shot('1-out');
console.log('out      ', await state());

// Put two small crates on the ground near the driver, as if they had fallen off.
await page.evaluate(() => {
  const { sim } = window.game;
  const d = sim.driver.pos;
  sim.cargo.filter((c) => c.type.id === 'smallCrate').slice(0, 2).forEach((c, i) => c.body.setTranslation({ x: d.x + 1.2, y: 0.4, z: d.z - 1 - i * 2.5 }, true));
});
await page.waitForTimeout(3200);
await shot('2-fallen');
console.log('fallen   ', await state());

await page.keyboard.press('KeyE');
await page.waitForTimeout(500);
// Walk a little way from the truck, carrying it.
await page.keyboard.down('KeyA'); await page.waitForTimeout(900); await page.keyboard.up('KeyA');
await page.waitForTimeout(400);
await shot('3-carrying');
console.log('carrying ', await state());

// Point at the middle of the truck bed and wind up until the landing marker is over it.
const aim = await page.evaluate(() => {
  const { sim, camera } = window.game;
  const t = sim.truck.body.translation();
  const p = sim.driver.pos.clone().set(t.x, sim.driver.pos.y, t.z - 0.8).project(camera);
  return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight };
});
await page.mouse.move(aim.x, aim.y);
await page.waitForTimeout(200);
await page.mouse.down();
for (let i = 0; i < 40; i++) { await page.waitForTimeout(60); if ((await state()).inBed) break; }
await page.waitForTimeout(150);
await shot('4-winding-up');
console.log('winding  ', await state());
await page.mouse.up();
await page.waitForTimeout(2500);
await shot('5-landed');
console.log('landed   ', await state());
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
