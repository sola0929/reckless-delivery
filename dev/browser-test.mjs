// Drives the running dev server in a real browser and saves screenshots to dev/out.
// Usage: npm run dev -- --port 5183, then node dev/browser-test.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = process.env.GAME_URL ?? 'http://localhost:5183/';
const out = new URL('./out/', import.meta.url);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const shot = (name) => page.screenshot({ path: new URL(`${name}.png`, out).pathname.slice(1) });
const state = () =>
  page.evaluate(() => {
    const { sim } = window.game;
    const t = sim.truck.body.translation();
    return {
      pos: [t.x, t.y, t.z].map((v) => +v.toFixed(1)),
      speed: +sim.truck.forwardSpeed().toFixed(1),
      cargo: `${sim.cargoOnTruck()}/${sim.cargo.length}`,
      hud: document.getElementById('speed').textContent + ' km/h, ' + document.getElementById('cargo').textContent + ', ' + document.getElementById('value').textContent,
    };
  });

// The sandbox first: driving, damage and reset.
await page.goto(base + '?level=sandbox');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 15000 });
await page.waitForTimeout(1500);
await shot('1-start');
console.log('start      ', await state());

await page.keyboard.down('KeyW');
await page.waitForTimeout(2500);
await shot('2-driving');
console.log('W 2.5s     ', await state());

await page.keyboard.down('KeyA');
await page.waitForTimeout(1500);
await shot('3-turning');
console.log('turning    ', await state());
await page.keyboard.up('KeyA');
await page.keyboard.up('KeyW');

await page.keyboard.press('KeyR');
await page.waitForTimeout(800);
await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(700);
await shot('4-boost');
await page.waitForTimeout(1300);
console.log('Shift 2s   ', await state());
await page.keyboard.up('ShiftLeft');
await page.keyboard.down('KeyS');
await page.waitForTimeout(900);
await shot('5-hard-brake');
console.log('S 0.9s     ', await state());
await page.waitForTimeout(1200);
await page.keyboard.up('KeyS');

await page.keyboard.press('KeyR');
await page.waitForTimeout(800);
await shot('6-reset');
console.log('after reset', await state());

// Then the city level: the start, a stretch of driving, and the result screen.
await page.goto(base + '?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 15000 });
await page.waitForTimeout(1500);
await shot('7-city-start');
// A short run that stops before the first busy street.
await page.keyboard.down('KeyW');
await page.waitForTimeout(2500);
await page.keyboard.up('KeyW');
await shot('8-city-street');
console.log('city drive ', await state());
// Stop, then carry the truck and its load to the delivery bay to check the result screen.
for (let i = 0; i < 12 && (await state()).speed > 0.3; i++) {
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(150);
  await page.keyboard.up('KeyS');
  await page.waitForTimeout(150);
}
await page.waitForTimeout(800);
await page.evaluate(() => {
  const { sim } = window.game;
  const t = sim.truck.body.translation();
  const [fx, fz] = sim.level.finish.pos;
  const move = (body) => {
    const p = body.translation();
    body.setTranslation({ x: p.x + fx - t.x, y: p.y, z: p.z + fz - t.z }, true);
  };
  for (const c of sim.cargo) if (c.body) move(c.body);
  move(sim.truck.body);
});
await page.waitForTimeout(2500);
await shot('9-city-result');
console.log('result     ', await page.evaluate(() => ({ ...window.game.sim.result, shown: !document.getElementById('result').hidden })));

const fps = await page.evaluate(
  () => new Promise((resolve) => {
    let n = 0;
    const t0 = performance.now();
    const tick = () => (++n < 60 ? requestAnimationFrame(tick) : resolve(Math.round(60000 / (performance.now() - t0))));
    requestAnimationFrame(tick);
  }),
);
console.log('fps', fps);
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
