// Level 1's scaffold in the roadworks: the truck in the lane beside it as the game sees it, and a close look at the
// stair tower, the formwork and the air conditioner on the 6 m lift. node dev/scaffold-shot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=hillcity');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.evaluate(() => { for (const id of ['banner', 'help', 'chat', 'dev-jumps']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
await p.evaluate(() => window.game.sim.teleport(-100, 451.5, Math.PI / 2));
await p.waitForTimeout(3000);
await p.screenshot({ path: 'dev/out/scaffold-chase.png' });
console.log(await p.evaluate(() => { const a = window.game.sim.cargo.find((c) => c.type.id === 'aircon').body.translation(); return `aircon ${a.x.toFixed(1)},${a.y.toFixed(2)},${a.z.toFixed(1)}`; }));
await p.evaluate(() => {
  const { camera } = window.game;
  window.game.freeze = true;
  camera.position.set(-84, 22, 440);
  camera.lookAt(-93, 14, 439);
  camera.updateProjectionMatrix();
});
await p.waitForTimeout(800);
await p.screenshot({ path: 'dev/out/scaffold-tower.png' });
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
