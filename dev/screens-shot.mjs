// Screenshots of the level page, with no record and with one; the card at the start; and
// the result page, for a pass and for a failure.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const levels = async (name) => {
  await page.goto('http://localhost:5183/');
  await page.waitForSelector('#menu-start');
  await page.click('[data-page="menu-levels"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `dev/out/screens-${name}.png` });
};
await page.goto('http://localhost:5183/');
await page.evaluate(() => localStorage.clear());
await levels('levels-new');
await page.evaluate(() => localStorage.setItem('cargo-best:city', JSON.stringify({ stars: 2, seconds: 171, fraction: 0.74 })));
await levels('levels-played');

await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'dev/out/screens-start.png' });
const end = async (name, make) => {
  await page.evaluate(make);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `dev/out/screens-${name}.png` });
};
await end('result-pass', () => { const { sim } = window.game; sim.result = { value: 3350, fraction: 3350 / sim.fullValue, stars: 3, seconds: 158, tally: { intact: 12, damaged: 4, destroyed: 1, lost: 1 } }; });
await page.keyboard.press('KeyR');
await page.waitForTimeout(600);
await end('result-faster', () => { const { sim } = window.game; sim.result = { value: 2900, fraction: 2900 / sim.fullValue, stars: 3, seconds: 131, tally: { intact: 10, damaged: 5, destroyed: 1, lost: 2 } }; });
await page.keyboard.press('KeyR');
await page.waitForTimeout(600);
await end('result-fail', () => { const { sim } = window.game; sim.result = { value: 0, fraction: 0, stars: 0, seconds: 64, failure: 'water', tally: { intact: 9, damaged: 5, destroyed: 2, lost: 2 } }; });
console.log('full value', await page.evaluate(() => window.game.sim.fullValue), errors.length ? errors.join('\n') : 'no console errors');
// Leave the browser's record as it was found: none.
await page.evaluate(() => localStorage.removeItem('cargo-best:city'));
await browser.close();
