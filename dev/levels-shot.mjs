// The level page of the main menu, with the first delivery passed. node dev/levels-shot.mjs
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/');
await page.evaluate(() => localStorage.setItem('cargo-best:city', JSON.stringify({ stars: 2, seconds: 171, fraction: 0.74 })));
await page.goto('http://localhost:5183/');
await page.waitForSelector('#menu-start');
await page.click('[data-page="menu-levels"]');
await page.waitForTimeout(400);
await page.screenshot({ path: 'dev/out/menu-levels.png' });
console.log(await page.evaluate(() => [...document.querySelectorAll('#menu-level-list .level-card')].map((c) => c.querySelector('.level-name').textContent + ' / ' + c.className).join('\n')));
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
