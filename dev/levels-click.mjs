// The level page: a click chooses and stays; Enter on the chosen row goes in. node dev/levels-click.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5183/');
await p.waitForTimeout(800);
await p.click('[data-page="menu-levels"]');
await p.waitForTimeout(500);
await p.click('.level-card:nth-of-type(2)');
await p.waitForTimeout(500);
console.log('after click:', p.url(), '|', await p.evaluate(() => document.querySelector('.preview-name').textContent));
await p.keyboard.press('Enter');
await p.waitForTimeout(800);
console.log('after Enter:', p.url());
await b.close();
