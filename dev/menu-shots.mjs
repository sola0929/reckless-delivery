// Every page of the main menu, and whether its back button is in sight. node dev/menu-shots.mjs [width] [height]
import { chromium } from 'playwright-core';
const [w, h] = [Number(process.argv[2] ?? 1280), Number(process.argv[3] ?? 720)];
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: w, height: h } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/');
await p.waitForTimeout(1500);
for (const page of (process.argv[4] ? process.argv[4].split(',') : ['menu-home', 'menu-offer', 'menu-levels', 'menu-settings', 'menu-help'])) {
  const info = await p.evaluate((id) => {
    for (const el of document.querySelectorAll('.menu-page')) el.hidden = el.id !== id;
    const back = document.querySelector(`#${id} .back`);
    const r = back?.getBoundingClientRect();
    const side = document.querySelector('.menu-side');
    return { back: r ? `${Math.round(r.top)}-${Math.round(r.bottom)} of ${innerHeight}` : 'none', scroll: `${side.scrollHeight}/${side.clientHeight}`, overflow: getComputedStyle(side).overflowY };
  }, page);
  await p.waitForTimeout(page === 'menu-levels' ? 1500 : 400);
  console.log(page, JSON.stringify(info));
  await p.screenshot({ path: `dev/out/menu-${page}-${w}x${h}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
