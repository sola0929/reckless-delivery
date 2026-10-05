// Level 2 in the browser: the start, fresh; then a spell on the coil avenue and a restart with R; the start again.
// node dev/restart-profile.mjs
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e)));
await page.goto('http://localhost:5183/');
await page.evaluate(() => localStorage.setItem('cargo-best:hillcity', JSON.stringify({ stars: 1, seconds: 200, fraction: 0.5 })));
await page.goto('http://localhost:5183/?level=uptown');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.keyboard.press('Enter');
const measure = async (label) => {
  await page.evaluate(() => Object.assign(window.game.timing, { frames: 0, physics: 0, logic: 0, render: 0, worst: 0 }));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(4000);
  await page.keyboard.up('KeyW');
  const t = await page.evaluate(() => ({ ...window.game.timing }));
  console.log(`${label}: ${(t.frames / 4).toFixed(0)} fps; physics ${(t.physics / t.frames).toFixed(1)} ms a frame, drawing ${(t.render / t.frames).toFixed(1)}, worst frame ${t.worst.toFixed(0)} ms`);
};
await page.waitForTimeout(1000);
await measure('fresh start');
await page.keyboard.press('Digit8');
await page.waitForTimeout(500);
await page.keyboard.down('KeyW');
await page.waitForTimeout(15000);
await page.keyboard.up('KeyW');
await page.keyboard.press('KeyR');
await page.waitForTimeout(2000);
await page.keyboard.press('Enter');
await measure('after the avenue and R');
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
