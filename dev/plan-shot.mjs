// A level seen from straight overhead, as a plan: to judge the layout before anything is driven. node dev/plan-shot.mjs [level] [x] [z] [height]
import { chromium } from 'playwright-core';
const [level = 'hilltown', x = '30', z = '232', height = '150'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/');
await page.evaluate(() => localStorage.setItem('cargo-best:city', JSON.stringify({ stars: 1, seconds: 200, fraction: 0.5 })));
await page.goto(`http://localhost:5183/?level=${level}`);
await page.waitForFunction(() => window.game?.sim, null, { timeout: 15000 });
await page.waitForTimeout(1500);
await page.evaluate(([x, z, height]) => {
  for (const id of ['banner', 'help', 'hud']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
  const { camera, scene } = window.game;
  window.game.freeze = true;
  scene.fog = null;
  // North to the right, so that a long level fits a wide picture.
  camera.up.set(1, 0, 0);
  camera.position.set(x, height, z);
  camera.lookAt(x, 0, z);
  camera.far = 600;
  camera.updateProjectionMatrix();
}, [Number(x), Number(z), Number(height)]);
await page.waitForTimeout(700);
await page.screenshot({ path: `dev/out/plan-${level}-${z}.png` });
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
