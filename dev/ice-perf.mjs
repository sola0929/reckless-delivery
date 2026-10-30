// Level 4's ice yard in the browser: from a few places, straight on into what is there for four seconds, and what the
// frames cost while it all comes down. node dev/ice-perf.mjs
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e)));
await page.goto('http://localhost:5183/?level=harbour');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.keyboard.press('Enter');
await page.waitForTimeout(1000);
const runs = [
  ['into the baskets, west', [-49.5, 333, -0.1, 0.9]],
  ['into the block carts, east', [-40, 333, 0.15, 0.9]],
  ['down the dock\'s middle row', [-44, 290, Math.PI, 2.1]],
  ['along the yard, no smashing', [-44, 357, 0, 0.9]],
];
for (const [name, at] of runs) {
  await page.evaluate((at) => window.game.sim.teleport(...at), at);
  await page.waitForTimeout(800);
  await page.evaluate(() => Object.assign(window.game.timing, { frames: 0, physics: 0, logic: 0, render: 0, worst: 0 }));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(4000);
  await page.keyboard.up('KeyW');
  const t = await page.evaluate(() => ({ ...window.game.timing, awake: window.game.sim.objects.objects.filter((o) => !o.body.isSleeping()).length }));
  const f = t.frames || 1;
  console.log(`${name}: ${(f / 4).toFixed(0)} fps; physics ${(t.physics / f).toFixed(1)} ms, game ${(t.logic / f).toFixed(1)} ms, drawing ${(t.render / f).toFixed(1)} ms, worst ${t.worst.toFixed(0)} ms; ${t.awake} awake`);
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
