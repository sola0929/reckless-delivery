// Screenshots of the traffic: scooters ridden along the busy street, the boulevard and the
// back street, and people on the pavements and crossing the road.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.waitForTimeout(1500);
// Map squares are 16 m: x = (17.5 - column) * 16, z = row * 16, rows counted from the south.
const sq = (c, r) => [(17.5 - c) * 16, r * 16];
const carry = (x, z) => page.evaluate(([x, z]) => {
  const { sim } = window.game;
  const t = sim.truck.body.translation();
  const move = (body) => { const p = body.translation(); body.setTranslation({ x: p.x + x - t.x, y: p.y, z: p.z + z - t.z }, true); };
  for (const c of sim.cargo) if (c.body) move(c.body);
  move(sim.truck.body);
}, [x, z]);
/** From a camera at `from` looking at `to`, both [column, row, height], with the truck parked out of the way at `truck`. */
const look = async (name, from, to, truck, wait = 2500) => {
  await carry(...sq(truck[0], truck[1]));
  await page.evaluate(([fx, fy, fz, tx, ty, tz]) => {
    const { camera } = window.game;
    window.game.freeze = true;
    camera.position.set(fx, fy, fz);
    camera.lookAt(tx, ty, tz);
  }, [sq(from[0], from[1])[0], from[2], sq(from[0], from[1])[1], sq(to[0], to[1])[0], to[2], sq(to[0], to[1])[1]]);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `dev/out/riders-${name}.png` });
};
/** From behind the truck, as the game is played, after standing there a while. */
const drive = async (name, c, r, wait = 3000) => {
  await page.evaluate(() => { window.game.freeze = false; });
  await carry(...sq(c, r));
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `dev/out/riders-${name}.png` });
};

await look('busy-street', [22.6, 30.9, 9], [26, 31, 0], [22, 29]);
await look('busy-above', [25, 30.2, 26], [25.4, 31, 0], [22, 29]);
await look('back-street', [20.8, 41, 8], [17, 41, 0], [22.5, 41]);
await look('back-turn', [14.2, 40.6, 14], [14.8, 41, 0], [22.5, 41]);
await look('boulevard', [20, 11.6, 12], [24, 12.5, 0], [17.2, 8]);
await drive('drive-busy', 25, 30.78);
await drive('drive-back', 18, 41.22);
const fps = await page.evaluate(() => new Promise((resolve) => { let n = 0; const t0 = performance.now(); const tick = () => (++n < 120 ? requestAnimationFrame(tick) : resolve(Math.round(120000 / (performance.now() - t0)))); requestAnimationFrame(tick); }));
console.log('fps', fps, 'rider hits', await page.evaluate(() => window.game.sim.riders.hits), errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
