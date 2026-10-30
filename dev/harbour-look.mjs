// Level 4 as the game's camera sees it at given places: node dev/harbour-look.mjs '[[x,z,yaw,y?,wheel?,wait?],...]' [name]
// -> dev/out/look/<name>-<n>.jpg. wait: seconds to stand there before the picture (things falling, gusts).
import { chromium } from 'playwright-core';
const spots = JSON.parse(process.argv[2]);
const name = process.argv[3] ?? 'look';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=harbour');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.evaluate(() => { for (const id of ['hud', 'help', 'prompt', 'banner', 'chat', 'lesson', 'dev-jumps']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
for (const [n, [x, z, yaw, y, wheel = 0, wait = 2.5]] of spots.entries()) {
  await p.evaluate(([x, z, yaw, y]) => window.game.sim.teleport(x, z, yaw, y ?? undefined), [x, z, yaw, y]);
  await p.mouse.move(480, 270);
  if (wheel) await p.mouse.wheel(0, wheel);
  await p.waitForTimeout(wait * 1000);
  await p.screenshot({ path: `dev/out/look/${name}-${n}.jpg`, type: 'jpeg', quality: 80 });
  if (wheel) await p.mouse.wheel(0, -wheel);
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
