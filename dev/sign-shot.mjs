// Level 2's small square off the coil road and the canteen's lightbox in it: from the way in, and close up. node dev/sign-shot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=uptown');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.evaluate(() => { for (const id of ['banner', 'help', 'chat', 'dev-jumps']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
await p.evaluate(() => window.game.sim.teleport(-152, 856, 0));
await p.waitForTimeout(3000);
await p.screenshot({ path: 'dev/out/sign-way-in.png' });
console.log(await p.evaluate(() => { const s = window.game.sim.cargo.find((c) => c.type.id === 'lightbox').body.translation(); return `sign ${s.x.toFixed(1)},${s.y.toFixed(2)},${s.z.toFixed(1)}`; }));
await p.evaluate(() => {
  const { camera } = window.game;
  window.game.freeze = true;
  camera.position.set(-152, 27.5, 877);
  camera.lookAt(-152.5, 24.2, 884.5);
  camera.updateProjectionMatrix();
});
await p.waitForTimeout(800);
await p.screenshot({ path: 'dev/out/sign-close.png' });
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
