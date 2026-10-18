// Level 3's clear pond and its island, and the pump house yard beside it: as the game sees them. node dev/pond-shot.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=quarry');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.evaluate(() => { for (const id of ['banner', 'help', 'chat', 'dev-jumps']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
const shots = JSON.parse(process.argv[2] ?? '[["dike-end",82,780,1.57],["yard",130,680,3.14]]');
for (const [name, x, z, yaw] of shots) {
  await p.evaluate(([x, z, yaw, y]) => window.game.sim.teleport(x, z, yaw, y), [x, z, yaw, shots.find((s) => s[0] === name)[4]]);
  await p.waitForTimeout(2500);
  console.log(name, await p.evaluate(() => { const t = window.game.sim.truck.body.translation(); return `${t.x.toFixed(1)},${t.y.toFixed(1)},${t.z.toFixed(1)}`; }));
  await p.screenshot({ path: `dev/out/pond-${name}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
