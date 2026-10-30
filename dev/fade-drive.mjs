// Driving on from a place with the throttle held, every few tenths of a second: what is see-through, as the game draws it.
// node dev/fade-drive.mjs level x,z,yaw[,floor] seconds [steer key at ms]; LOOK=KeyQ or KeyE holds the camera turned
import { chromium } from 'playwright-core';
const [level, spot, seconds = '6', steerAt] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`http://localhost:5183/?level=${level}`);
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const [x, z, yaw, floor] = spot.split(',').map(Number);
await page.evaluate(([x, z, yaw, floor]) => window.game.sim.teleport(x, z, yaw, Number.isNaN(floor) ? undefined : floor), [x, z, yaw, floor]);
await page.waitForTimeout(800);
await page.keyboard.down('KeyW');
if (process.env.LOOK) await page.keyboard.down(process.env.LOOK);
const seen = new Map();
const t0 = Date.now();
let steered = false;
while (Date.now() - t0 < Number(seconds) * 1000) {
  if (steerAt && !steered && Date.now() - t0 > Number(steerAt.split(':')[1])) { await page.keyboard.down(steerAt.split(':')[0]); steered = true; }
  const r = await page.evaluate(() => ({ t: window.game.sim.truck.body.translation(), f: window.game.levelView.faders.filter((f) => f.opacity < 0.95).map((f) => [f.box.min.toArray().map((v) => +v.toFixed(1)).join(','), f.box.max.toArray().map((v) => +v.toFixed(1)).join(','), !!f.overhead]) }));
  for (const [a, b, o] of r.f) { const key = `${a} .. ${b}${o ? ' overhead' : ''}`; if (!seen.has(key)) seen.set(key, `truck at ${r.t.x.toFixed(1)},${r.t.y.toFixed(1)},${r.t.z.toFixed(1)}`); }
  await page.waitForTimeout(250);
}
for (const [k, v] of seen) console.log(k, ' first when', v);
if (!seen.size) console.log('nothing went see-through');
await browser.close();
