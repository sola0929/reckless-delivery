// Level 2's last leg down and the yard at the quarry gate: from behind the truck, and from above. node dev/end-shot.mjs
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/');
await page.evaluate(() => localStorage.setItem('cargo-best:hillcity', JSON.stringify({ stars: 1, seconds: 200, fraction: 0.5 })));
await page.goto('http://localhost:5183/?level=uptown');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.waitForTimeout(2000);
const info = await page.evaluate(() => window.game.sim.level.checkpoints.map((c) => [c.name, c.pos, c.yaw]));
console.log(JSON.stringify(info.slice(8)));
for (const [name, x, z, yaw, back, up] of [['leg', -340.8, 1022, Math.PI, 9, 5], ['corner', -341, 1028, Math.PI + 0.45, 10, 8], ['entry', -338, 958, -Math.PI / 2 + 0.25, 9, 7], ['yard', -358, 958, -0.34, 9, 6], ['yard-far', -366, 1000, Math.PI - 0.3, 6, 5]]) {
  await page.evaluate(([x, z, yaw, back, up]) => {
    for (const id of ['banner', 'help', 'hud']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
    const { camera, sim } = window.game;
    sim.teleport(x, z, yaw);
    window.game.freeze = true;
    const t = sim.truck.body.translation();
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    camera.position.set(t.x - fx * back, t.y + up, t.z - fz * back);
    camera.lookAt(t.x + fx * 25, t.y - 2, t.z + fz * 25);
    camera.updateProjectionMatrix();
  }, [x, z, yaw, back, up]);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `dev/out/end-${name}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
