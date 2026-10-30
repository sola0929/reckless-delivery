// Which faded things are see-through with the truck at each of some places, as the game draws it: to find what turns
// see-through where it should not. node dev/fade-check.mjs level x,z,yaw[,floor] ...
import { chromium } from 'playwright-core';
const [level, ...spots] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`http://localhost:5183/?level=${level}`);
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.waitForTimeout(1500);
for (const spot of spots) {
  const [x, z, yaw, floor] = spot.split(',').map(Number);
  await page.evaluate(([x, z, yaw, floor]) => window.game.sim.teleport(x, z, yaw, Number.isNaN(floor) ? undefined : floor), [x, z, yaw, floor]);
  await page.waitForTimeout(1800);
  const faded = await page.evaluate(() => window.game.levelView.faders.filter((f) => f.opacity < 0.99).map((f) => ({ min: f.box.min.toArray().map((v) => +v.toFixed(1)), max: f.box.max.toArray().map((v) => +v.toFixed(1)), o: +f.opacity.toFixed(2), overhead: !!f.overhead })));
  const cam = await page.evaluate(() => window.game.camera.position.toArray().map((v) => +v.toFixed(1)));
  console.log(`at ${spot} (camera ${cam.join(',')}):`, faded.length ? '' : 'nothing see-through');
  for (const f of faded) console.log('   ', f.min.join(','), '..', f.max.join(','), 'opacity', f.o, f.overhead ? 'overhead' : '');
}
await browser.close();
