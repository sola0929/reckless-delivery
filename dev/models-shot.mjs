// Screenshots of the set pieces: the depot's containers, the digger, the tanker, the park
// pond, the lifting bridge and the old gateway.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.waitForTimeout(1500);
// Nothing of the game's own in the way of what is being looked at.
await page.evaluate(() => { document.getElementById('hud').style.display = 'none'; });
// Map squares are 16 m: x = (17.5 - column) * 16, z = row * 16, rows counted from the south.
const sq = (c, r) => [(17.5 - c) * 16, r * 16];
const look = async (name, from, to) => {
  await page.evaluate(([fx, fy, fz, tx, ty, tz]) => {
    const { camera } = window.game;
    window.game.freeze = true;
    camera.position.set(fx, fy, fz);
    camera.lookAt(tx, ty, tz);
  }, [sq(from[0], from[1])[0], from[2], sq(from[0], from[1])[1], sq(to[0], to[1])[0], to[2], sq(to[0], to[1])[1]]);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `dev/out/models-${name}.png` });
};
await look('site-corner', [21.5, 28.5, 30], [21.5, 28.52, 0]);
await look('boards', [15.6, 41, 9], [14.3, 41, 0]);
if (process.argv[2] === 'fix') { await browser.close(); process.exit(0); }
await look('site', [21.6, 26.2, 26], [23.6, 27.6, 2]);
await look('site-yard', [21.7, 27.1, 7], [22.9, 27.6, 1]);
await look('plate', [24.1, 26.5, 5], [24.7, 26.8, 0]);
await look('crossing', [29.9, 35.2, 9], [29, 37, 1]);
if (process.argv[2] === 'new') { await browser.close(); process.exit(0); }
await look('containers', [18.2, 2.2, 9], [15, 3.5, 1]);
await look('digger', [25.2, 17.2, 7], [23.7, 18.4, -1]);
await look('tanker', [14.8, 40.2, 5], [13.9, 40.6, 1]);
await look('pond', [14.6, 18.2, 16], [13.1, 19.2, 0]);
await look('bridge', [21.6, 22.4, 9], [20, 24.5, 1]);
await look('gateway', [26.3, 40.6, 6], [27, 41, 2]);
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
