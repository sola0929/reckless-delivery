// The level page as it opens, then after a step down the list and a while for the pictures to turn. node dev/levels-page.mjs [w] [h]
import { chromium } from 'playwright-core';
const [w, h] = [Number(process.argv[2] ?? 1280), Number(process.argv[3] ?? 720)];
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: w, height: h } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/');
await p.waitForTimeout(800);
await p.click('[data-page="menu-levels"]');
await p.waitForTimeout(1200);
await p.screenshot({ path: `dev/out/levels-a-${w}x${h}.png` });
await p.keyboard.press('ArrowDown');
await p.keyboard.press('ArrowDown');
await p.waitForTimeout(4200);
await p.screenshot({ path: `dev/out/levels-b-${w}x${h}.png` });
console.log(await p.evaluate(() => `${document.activeElement?.className} | ${document.querySelector('.preview-name').textContent} | ${document.querySelector('.preview-caption').textContent}`));
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
