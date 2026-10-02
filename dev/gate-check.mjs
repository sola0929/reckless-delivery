// Whether each crossing gate is down when its track's signal is red, and up when it is green.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
let wrong = 0, seenDown = 0, seenUp = 0;
for (let n = 0; n < 12; n++) {
  await page.waitForTimeout(700);
  const rows = await page.evaluate(() => {
    const { sim, scene } = window.game;
    const pivots = scene.children.filter((o) => o.isGroup && o.children.length === 1 && o.children[0].isMesh && Math.abs(o.position.y - 1.05) < 0.01);
    return pivots.map((p, i) => ({ red: sim.trains.warning(sim.level.gates[i].track), angle: p.rotation.z }));
  });
  for (const r of rows) {
    if (r.red && r.angle < 0.05) seenDown++;
    if (!r.red && r.angle > 1.35) seenUp++;
    // Allow for the second it takes to swing.
    if ((r.red && r.angle > 1.39) || (!r.red && r.angle < 0.01)) wrong++;
  }
}
console.log('gates seen down on red', seenDown, '| up on green', seenUp, '| the wrong way round', wrong);
await browser.close();
