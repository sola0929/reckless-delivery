// The level page, with records as a player part way through would have them: level 1 with one hidden thing found,
// level 2 with all three on one run. node dev/levels-shot.mjs [name] [level card to point at, 0-based]
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: Number(process.argv[4] ?? 1280), height: Number(process.argv[5] ?? 720) } });
await p.addInitScript(() => {
  localStorage.setItem('cargo-best:hillcity', JSON.stringify({ stars: 2, seconds: 98, fraction: 0.47, found: 1, items: ['amp'] }));
  localStorage.setItem('cargo-best:uptown', JSON.stringify({ stars: 3, seconds: 140, fraction: 1.12, found: 3, items: ['stockpot', 'riceCooker', 'lightbox'] }));
});
await p.goto('http://localhost:5183/');
await p.waitForSelector('#menu-start');
await p.click('[data-page="menu-levels"]');
await p.waitForTimeout(400);
const card = Number(process.argv[3] ?? 0);
await p.focus(`#menu-level-list .level-card >> nth=${card}`);
await p.waitForTimeout(400);
await p.screenshot({ path: `dev/out/levels-${process.argv[2] ?? 'page'}.png` });
await b.close();
