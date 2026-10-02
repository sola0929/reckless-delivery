// The main menu at a few window sizes: the title must stay on one line at all of them.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
for (const [w, h] of [[1920, 1080], [1280, 720], [900, 700]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('http://localhost:5183/');
  await page.waitForSelector('#menu-start');
  await page.waitForTimeout(300);
  const logo = await page.evaluate(() => { const e = document.querySelector('.logo'); const r = e.getBoundingClientRect(); return { height: Math.round(r.height), size: parseFloat(getComputedStyle(e).fontSize) }; });
  console.log(`${w}x${h}: title ${logo.height}px tall at ${logo.size}px type -> ${logo.height < logo.size * 1.5 ? 'one line' : 'WRAPPED'}`);
  if (w === 1920) await page.screenshot({ path: 'dev/out/menu-wide.png' });
  await page.close();
}
await browser.close();
