// Level 2's canteen at the quarry gate yard: coming up to the bay, and from above. node dev/canteen-shot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=uptown');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 60000 });
await p.keyboard.press('Enter');
await p.waitForTimeout(500);
for (const [name, x, z, yaw, back, up, ahead] of [['sign', -352, 1012, -Math.PI / 2, 6, 7, 12]]) {
  await p.evaluate(([x, z, yaw, back, up, ahead]) => {
    for (const id of ['banner', 'help', 'hud', 'chat']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
    const { camera, sim } = window.game;
    sim.teleport(x, z, yaw);
    window.game.freeze = true;
    const t = sim.truck.body.translation();
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    camera.position.set(t.x - fx * back, t.y + up, t.z - fz * back);
    camera.lookAt(t.x + fx * ahead, t.y - 2, t.z + fz * ahead);
    camera.updateProjectionMatrix();
  }, [x, z, yaw, back, up, ahead]);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `dev/out/canteen-${name}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
