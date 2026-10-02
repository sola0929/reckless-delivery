// The settings page on the main menu: that a choice made there is the one the game starts with.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/');
await page.waitForSelector('#menu-start');
await page.click('[data-page="menu-settings"]');
await page.click('#set-quality [data-quality="low"]');
await page.fill('#set-music', '20');
await page.waitForTimeout(300);
await page.screenshot({ path: 'dev/out/screens-settings.png' });
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
const got = await page.evaluate(() => ({ ratio: window.game.renderer.getPixelRatio(), par: window.game.sim.level.par, lit: document.querySelector('#gfx-quality .on')?.dataset.quality, music: document.getElementById('vol-music').value }));
console.log(got.ratio === 0.75 && got.lit === 'low' && got.music === '20' ? 'PASS' : 'FAIL', JSON.stringify(got), errors.length ? errors.join(' / ') : 'no console errors');
await browser.close();
