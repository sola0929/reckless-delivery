// Any level with a way through it, photographed from the truck at places along that way. node dev/route-shot.mjs <level> <share> [<share> ...]
import { chromium } from 'playwright-core';
const [level, ...shares] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/');
await page.evaluate(() => localStorage.setItem('cargo-best:city', JSON.stringify({ stars: 1, seconds: 200, fraction: 0.5 })));
await page.goto(`http://localhost:5183/?level=${level}`);
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 }).catch(() => { console.log('never started:', errors.join(' / ')); process.exit(1); });
await page.waitForTimeout(1500);
await page.evaluate(() => { document.getElementById('banner').hidden = true; document.getElementById('help').hidden = true; });
for (const share of shares) {
  const where = await page.evaluate((share) => {
    const { sim } = window.game;
    const route = sim.level.route;
    const along = [0];
    for (let n = 1; n < route.length; n++) along.push(along[n - 1] + Math.hypot(route[n][0] - route[n - 1][0], route[n][1] - route[n - 1][1]));
    const want = share * along[along.length - 1];
    const n = Math.max(1, along.findIndex((d) => d >= want));
    const t = (want - along[n - 1]) / (along[n] - along[n - 1]);
    const x = route[n - 1][0] + (route[n][0] - route[n - 1][0]) * t, z = route[n - 1][1] + (route[n][1] - route[n - 1][1]) * t;
    const yaw = Math.atan2(route[n][0] - route[n - 1][0], route[n][1] - route[n - 1][1]);
    // How high the way is there: followed up from its start, since it may wind over itself.
    let h = 0;
    for (let k = 0; k < n; k++) h = sim.level.terrain?.surface?.(route[k][0], route[k][1], h + 5)?.h ?? 0;
    const y = (sim.level.terrain?.surface?.(x, z, h + 5)?.h ?? 0) + 0.9;
    for (const c of sim.cargo) if (c.body) c.body.setTranslation({ x: -500, y: 1, z: -500 }, true);
    sim.truck.body.setTranslation({ x, y, z }, true);
    sim.truck.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    sim.truck.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    sim.truck.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    return `${x.toFixed(0)}, ${z.toFixed(0)} at ${y.toFixed(0)} m`;
  }, Number(share));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `dev/out/${level}-route-${share}.png` });
  console.log(`${share}: ${where}`);
}
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
