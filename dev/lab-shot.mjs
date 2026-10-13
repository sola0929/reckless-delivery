// Level 3's proving ground in the browser: each station from above and behind the truck. node dev/lab-shot.mjs
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e)));
await page.goto('http://localhost:5183/?level=quarrylab');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const shots = [
  ['A', 16, 30, 0, 14, 9],
  ['A2', 16, 140, 0, 14, 9],
  ['B', 64, 40, 0, 12, 8],
  ['C2', 112, 40, 0, 16, 12],
  ['D', 176, 100, 0, 14, 9],
  ['D2', 175, 190, 0, 12, 7],
  ['E', 304, 110, 0, 18, 14],
  ['top', 160, 140, 0, -1, 330],
];
for (const [name, x, z, yaw, back, up] of shots) {
  await page.evaluate(([x, z, yaw, back, up]) => {
    for (const id of ['banner', 'help', 'hud']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
    const { camera, sim } = window.game;
    sim.teleport(x, z, yaw);
    for (let i = 0; i < 120; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
    window.game.freeze = true;
    const t = sim.truck.body.translation();
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    camera.position.set(t.x - fx * back, t.y + up, t.z - fz * back);
    if (up > 300) { camera.position.set(160, 330, 152.1); camera.lookAt(160, 0, 152); } else camera.lookAt(t.x + fx * 20, t.y, t.z + fz * 20);
    camera.updateProjectionMatrix();
  }, [x, z, yaw, back, up]);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `dev/out/lab-${name}.png` });
  await page.evaluate(() => { window.game.freeze = false; });
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
