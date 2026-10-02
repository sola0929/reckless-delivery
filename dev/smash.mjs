// Drive through the market and along a tree-lined kerb, and photograph the mess.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 20000 });
await page.waitForTimeout(1200);
const sq = (c, r) => [(17.5 - c) * 16, r * 16];
const go = (x, z) => page.evaluate(([x, z]) => {
  const { sim } = window.game;
  const t = sim.truck.body.translation();
  const move = (body) => { const p = body.translation(); body.setTranslation({ x: p.x + x - t.x, y: p.y, z: p.z + z - t.z }, true); };
  for (const c of sim.cargo) if (c.body) move(c.body);
  move(sim.truck.body);
}, [x, z]);
const state = () => page.evaluate(() => { const { sim } = window.game; return { knocked: sim.objects.objects.filter((o) => o.knocked).length, people: sim.pedestrians.hits, speed: Math.round(sim.truck.forwardSpeed() * 3.6), value: Math.round(sim.cargoValue()), onTruck: sim.cargoOnTruck() }; });

await go(sq(27, 13.2)[0] + 4.6, sq(27, 13.2)[1]);
await page.waitForTimeout(800);
await page.keyboard.down('KeyW');
await page.waitForTimeout(2600);
await page.screenshot({ path: 'dev/out/smash-1-market.png' });
console.log('market   ', await state());
await page.keyboard.up('KeyW');
await page.waitForTimeout(1500);

// Along the pavement beside the first street: trees, lamps, a hydrant.
await go((17.5 - 17) * 16 - 9.3, 6.5 * 16);
await page.waitForTimeout(800);
await page.keyboard.down('KeyW');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'dev/out/smash-2-kerb.png' });
console.log('kerb     ', await state());
await page.keyboard.up('KeyW');
const fps = await page.evaluate(() => new Promise((resolve) => { let n = 0; const t0 = performance.now(); const tick = () => (++n < 60 ? requestAnimationFrame(tick) : resolve(Math.round(60000 / (performance.now() - t0)))); requestAnimationFrame(tick); }));
console.log('fps', fps, errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
