// The hidden amplifier on level 1, end to end: put on the bed (as if thrown there), the find said and counted; then
// delivered, the result page's line for it, and the card's slot lit. node dev/hidden-check.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=hillcity');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
// Out of the gate first: the run, and its clock, start there.
await p.keyboard.down('KeyW');
await p.waitForTimeout(2500);
await p.keyboard.up('KeyW');
await p.waitForTimeout(1500);
const minimapBefore = await p.evaluate(() => window.game.sim.cargo.filter((c) => c.bonus && c.fallen).length);
await p.evaluate(() => {
  const { sim } = window.game;
  const t = sim.truck.body.translation();
  const amp = sim.cargo.find((c) => c.type.id === 'amp');
  amp.body.setTranslation({ x: t.x, y: t.y + 1.6, z: t.z - 1.5 }, true);
  amp.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
});
await p.waitForTimeout(1200);
await p.screenshot({ path: 'dev/out/hidden-found.png' });
console.log('found:', await p.evaluate(() => `${document.getElementById('hidden-stat').hidden ? 'stat hidden' : 'stat ' + document.getElementById('hidden').textContent} | popups: ${[...document.querySelectorAll('.popup')].map((e) => e.textContent).join(', ')}`), '| bonus lying off the truck before:', minimapBefore);
await p.evaluate(() => window.game.sim.teleport(88, 720, 0));
await p.waitForTimeout(6000);
console.log('result:', await p.evaluate(() => `${document.getElementById('result-hidden').textContent} | ${document.querySelector('#result-value .figure').textContent}`));
await p.screenshot({ path: 'dev/out/hidden-result.png' });
await p.goto('http://localhost:5183/');
await p.waitForTimeout(800);
console.log('card:', await p.evaluate(() => document.querySelector('.level-hidden')?.outerHTML.slice(0, 160)));
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
