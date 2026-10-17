// The menu truck with the box on top at the height of its hop, held there. node dev/hop-shot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5183/');
await p.waitForTimeout(1000);
console.log(await p.evaluate(() => {
  const hops = document.getAnimations().filter((a) => a.animationName === 'hop');
  for (const a of hops) { a.pause(); a.currentTime = 3800 * 0.8; }
  return hops.length;
}));
await p.waitForTimeout(200);
await p.screenshot({ path: 'dev/out/hop.png', clip: { x: 620, y: 200, width: 660, height: 380 } });
await b.close();
