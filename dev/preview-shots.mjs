// Candidate pictures for the level page's previews, as the game's own camera sees them with nothing over it.
// node dev/preview-shots.mjs <level> [route|spots]   -> dev/out/preview/<level>-<n>.jpg
// "spots" stands the truck at each of the level's test spots; "route" at every tenth of the way along its route.
import { chromium } from 'playwright-core';
const [level, mode = 'spots'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto(`http://localhost:5183/?level=${level}`);
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.evaluate(() => { for (const id of ['hud', 'help', 'prompt', 'banner', 'chat', 'lesson']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
const spots = await p.evaluate((mode) => {
  const level = window.game.sim.level;
  if (mode === 'spots') return (level.checkpoints ?? []).map((c) => [c.name, c.pos[0], c.pos[1], c.yaw]);
  const route = level.route ?? [];
  const legs = route.slice(1).map((q, i) => Math.hypot(q[0] - route[i][0], q[1] - route[i][1]));
  const total = legs.reduce((a, b) => a + b, 0);
  const out = [];
  for (let f = 0.05; f < 1; f += 0.1) {
    let s = f * total, i = 0;
    while (s > legs[i]) s -= legs[i++];
    const [a, q] = [route[i], route[i + 1]];
    const t = s / legs[i];
    out.push([`${Math.round(f * 100)}%`, a[0] + (q[0] - a[0]) * t, a[1] + (q[1] - a[1]) * t, Math.atan2(q[0] - a[0], q[1] - a[1])]);
  }
  return out;
}, mode);
for (const [k, [name, x, z, yaw]] of spots.entries()) {
  await p.evaluate(([x, z, yaw]) => window.game.sim.teleport(x, z, yaw), [x, z, yaw]);
  await p.waitForTimeout(2600);
  await p.screenshot({ path: `dev/out/preview/${level}-${k}.jpg`, type: 'jpeg', quality: 72 });
  console.log(k, name);
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
