// The level menu as a server shows it: which cards and free-play strips are there. node dev/menu-shot.mjs [base url]
import { chromium } from 'playwright-core';
const [base = 'http://localhost:4173/'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(base);
await page.waitForTimeout(1500);
const cards = await page.evaluate(() => [...document.querySelectorAll('.level-card')].map((c) => `${c.querySelector('.level-name').textContent} (${c.querySelector('.level-state').textContent})`));
const free = await page.evaluate(() => [...document.querySelectorAll('.level-free .level-name')].map((n) => n.textContent));
await page.evaluate(() => document.querySelector('[data-page="menu-levels"]')?.click());
await page.waitForTimeout(500);
await page.screenshot({ path: 'dev/out/menu-levels.png' });
// A proving ground asked for by address: the menu, not the level.
await page.goto(`${base}?level=sandbox`);
await page.waitForTimeout(1500);
const sandbox = await page.evaluate(() => (document.body.classList.contains('in-menu') ? 'menu' : 'the level'));
console.log(`cards: ${cards.join(', ')}\nfree play: ${free.join(', ') || 'none'}\n?level=sandbox shows ${sandbox}`);
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
