// The tutorial's surroundings, looked at from the cab along the way: one shot every so often up the route.
// node dev/tutorial-tour.mjs   (shots in dev/out/tour-*.png)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=tutorial');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 60000 });
const spots = JSON.parse(process.env.SPOTS ?? '[[10,0,1.5708],[50,0,1.5708],[72,20,0],[72,50,0],[72,80,0],[72,110,0],[72,150,0],[72,190,0],[72,225,0]]');
for (const [i, [x, z, yaw]] of spots.entries()) {
  await p.evaluate(([x, z, yaw]) => game.sim.teleport(x, z, yaw), [x, z, yaw]);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `dev/out/tour-${i}.png` });
}
console.log(errors);
await b.close();
