// Level 4's outer harbour in the browser: from a few places along the way, driven on for four seconds, what the frames cost.
// node dev/outer-perf.mjs
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
  ['down off the gate onto the quay', [-44, 404, 0, 3.6]],
  ['over the pontoon onto the boats', [-6, 440, Math.PI / 2, -1.9]],
  ['along the pier to the ramp', [49.7, 450, 0, 0]],
  ["along the ship's lane", [41.6, 494, 0, 2]],
]
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
