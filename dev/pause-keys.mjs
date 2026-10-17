// The pause menu by keyboard: Esc opens it, arrows move along, the leave question backs out with Esc. node dev/pause-keys.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=hillcity');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 60000 });
await p.keyboard.press('Enter');
const at = () => p.evaluate(() => `${document.activeElement?.id || document.activeElement?.tagName} pause=${!document.getElementById('pause').hidden} confirm=${!document.getElementById('pause-confirm').hidden}`);
const step = async (key) => { await p.keyboard.press(key); await p.waitForTimeout(150); console.log(key.padEnd(10), await at()); };
await p.waitForTimeout(300);
for (const key of ['Escape', 'ArrowUp', 'Enter', 'ArrowDown', 'Escape', 'Escape']) await step(key);
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
