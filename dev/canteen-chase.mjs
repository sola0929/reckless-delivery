// Level 2's canteen as the game's own camera sees it, the truck stopped at the bay and out in the yard. node dev/canteen-chase.mjs [tag]
import { chromium } from 'playwright-core';
const tag = process.argv[2] ?? 'a';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=uptown');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 60000 });
await p.keyboard.press('Enter');
await p.waitForTimeout(500);
for (const [name, x, z, yaw] of [['yard', -360, 990, 0], ['side', -350, 1012, -Math.PI / 2]]) {
  await p.evaluate(([x, z, yaw]) => {
    for (const id of ['banner', 'help', 'chat']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
    window.game.sim.teleport(x, z, yaw);
  }, [x, z, yaw]);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `dev/out/canteen-${tag}-${name}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
