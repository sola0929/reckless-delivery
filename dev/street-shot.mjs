// Screenshots of the road markings, the pavements, the street furniture and the traffic.
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
const view = async (name, from, to, wait = 1200) => {
  await page.evaluate(([fx, fy, fz, tx, ty, tz]) => {
    const { camera } = window.game;
    window.game.freeze = true;
    camera.position.set(fx, fy, fz);
    camera.lookAt(tx, ty, tz);
  }, [...from, ...to]);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `dev/out/street-${name}.png` });
};
const look = (name, from, to, wait) => view(name, [sq(from[0], from[1])[0], from[2], sq(from[0], from[1])[1]], [sq(to[0], to[1])[0], to[2], sq(to[0], to[1])[1]], wait);

await carry(...sq(17.2, 8));
await look('junction', [21.2, 30.2, 22], [22, 31, 0]);
await look('busy', [23.2, 30.7, 7], [26, 31, 1]);
await look('old-street', [19.5, 41.4, 6], [16, 41, 2]);
await look('boulevard', [19, 11.2, 14], [22, 12.6, 0]);
await look('wires', [18.6, 41.45, 9], [15.5, 41.4, 5]);
await look('roundabout', [19.3, 26.4, 16], [20.5, 27.5, 1]);
await look('square', [32.6, 16.2, 26], [31.5, 19.5, 0]);
await look('fountain', [31.9, 18.6, 5], [31.5, 19.5, 1.5]);
const bus = await page.evaluate(() => { const c = window.game.sim.traffic.cars.find((c) => c.kind === 'bus' && c.speed > 3); const p = c.body.translation(); return [p.x, p.z, c.lane.dir.x]; });
await view('bus', [bus[0] + bus[2] * 14, 6, bus[1] - 7], [bus[0] + bus[2] * 6, 1, bus[1]], 300);
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
