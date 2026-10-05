// A level's load on the truck as it starts, seen from above and behind. node dev/load-shot.mjs [level]
import { chromium } from 'playwright-core';
const [level = 'uptown'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/');
await page.evaluate(() => localStorage.setItem('cargo-best:city', JSON.stringify({ stars: 1, seconds: 200, fraction: 0.5 })));
await page.goto(`http://localhost:5183/?level=${level}`);
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  for (const id of ['banner', 'help', 'hud']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
  const { camera, sim } = window.game;
  window.game.freeze = true;
  const t = sim.truck.body.translation();
  const r = sim.truck.body.rotation();
  // Behind the truck, a little to one side, and above.
  const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
  camera.position.set(t.x - fx * 6 + fz * 2.5, t.y + 5, t.z - fz * 6 - fx * 2.5);
  camera.lookAt(t.x, t.y + 0.8, t.z);
  camera.updateProjectionMatrix();
});
await page.waitForTimeout(600);
await page.screenshot({ path: `dev/out/load-${level}.png` });
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
