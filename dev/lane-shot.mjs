// Level 2's market lane, from behind the truck at its checkpoint and from above. node dev/lane-shot.mjs
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
for (const [name, back, up] of [['behind', 9, 4.5], ['eat', 0, 0]]) {
  await page.evaluate(([back, up]) => {
    for (const id of ['banner', 'help', 'hud']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
    const { camera, sim } = window.game;
    const cp = sim.level.checkpoints.find((c) => c.name === '小巷市場');
    sim.teleport(cp.pos[0], cp.pos[1], cp.yaw);
    window.game.freeze = true;
    const t = sim.truck.body.translation();
    const fx = Math.sin(cp.yaw), fz = Math.cos(cp.yaw);
    camera.position.set(t.x - fx * back, t.y + up, t.z - fz * back);
    if (back === 0) { camera.position.set(-22, t.y + 3, 880); camera.lookAt(-27, t.y + 0.5, 896); } else camera.lookAt(t.x + fx * 22, t.y, t.z + fz * 22);
    camera.updateProjectionMatrix();
  }, [back, up]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `dev/out/lane-${name}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
