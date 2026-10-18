// The view on foot: out of the truck at level 1's square, walked a little way toward the stage. node dev/foot-view.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=hillcity');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.evaluate(() => window.game.sim.teleport(-211, 296, -Math.PI / 2));
await p.waitForTimeout(2000);
await p.keyboard.press('KeyC');
await p.waitForTimeout(800);
await p.keyboard.down('KeyW');
await p.waitForTimeout(1500);
await p.keyboard.up('KeyW');
await p.waitForTimeout(1500);
await p.screenshot({ path: 'dev/out/foot-view.png' });
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
