// Every screen of the game once, for a look over the UI: the menu's pages, the game, paused, and a delivery's result.
// node dev/ui-sweep.mjs [width] [height]   -> dev/out/ui-<w>-<screen>.png
import { chromium } from 'playwright-core';
const [w, h] = [Number(process.argv[2] ?? 1280), Number(process.argv[3] ?? 720)];
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: w, height: h } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.addInitScript(() => localStorage.setItem('cargo-best:hillcity', JSON.stringify({ stars: 2, seconds: 98, fraction: 0.47, found: 1, items: ['amp'] })));
const shot = (name) => p.screenshot({ path: `dev/out/ui-${w}${process.argv[4] ?? ''}-${name}.png` });
await p.goto('http://localhost:5183/');
await p.waitForSelector('#menu-start');
await p.waitForTimeout(500);
await shot('home');
for (const page of ['menu-settings', 'menu-help']) {
  await p.click(`#menu-home [data-page="${page}"]`);
  await p.waitForTimeout(400);
  await shot(page);
  if (page === 'menu-help' && await p.$('#menu-controls [data-keys="pad"]')) { await p.click('#menu-controls [data-keys="pad"]'); await p.waitForTimeout(200); await shot(page + '-pad'); }
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
}
await p.goto('http://localhost:5183/?level=hillcity' + (process.argv[4] ? '&pad=' + process.argv[4] : ''));
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.waitForTimeout(800);
await shot('banner');
await p.keyboard.press('Enter');
await p.waitForTimeout(2500);
await shot('play');
await p.keyboard.press('Escape');
await p.waitForTimeout(500);
await shot('pause');
await p.click('#pause-settings-open');
await p.waitForTimeout(200);
await shot('pause-settings');
await p.click('#pause-help-open');
await p.waitForTimeout(300);
await shot('pause-keys');
await p.click('#pause-controls [data-keys="pad"]');
await p.waitForTimeout(200);
await p.evaluate(() => { window.game.input.usingPad = true; });
await p.waitForTimeout(100);
await shot('pause-keys-pad');
await p.click('#pause-controls [data-mode="foot"]');
await p.waitForTimeout(150);
await shot('pause-keys-foot');
await p.click('#pause-info-open');
await p.waitForTimeout(300);
await shot('pause-back');
await p.keyboard.press('Escape');
await p.waitForTimeout(400);
if (process.argv[5] === 'pad') await p.evaluate(() => { window.game.input.usingPad = true; });
await p.evaluate(() => { const f = window.game.sim.level.finish; window.game.sim.teleport(f.pos[0], f.pos[1], 0); });
await p.waitForTimeout(6000);
await shot('result');
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
