// The HUD in play, with the pause button in its corner; and the pause menu over it.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.keyboard.down('KeyW');
await page.waitForTimeout(5000);
await page.keyboard.up('KeyW');
await page.screenshot({ path: 'dev/out/hud-1-play.png' });
await page.click('#pause-button');
await page.waitForTimeout(400);
await page.screenshot({ path: 'dev/out/hud-2-paused.png' });
await browser.close();
