// The level page's preview pictures: four to a delivery, as the game's own camera sees them with nothing over it.
// node dev/preview-picks.mjs [level]   -> public/previews/<level>-<n>.jpg
// Each pick: a test spot of the level (or a share of the way along its route, for one without), how far on from it to
// stand, and how far to draw the camera back with the wheel.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const PICKS = {
  tutorial: [['spot', 0, 0, 0], ['spot', 1, 0, 0], ['spot', 2, 0, 0], ['spot', 3, 0, 0]],
  hillcity: [['route', 0.25, 0, 0], ['route', 0.65, 0, 0], ['route', 0.75, 0, 0], ['route', 0.85, 0, 0]],
  uptown: [['spot', 1, 8, 300], ['at', [2, 980, -1.6], 0, 300], ['spot', 7, 12, 300], ['at', [-302, 1005, 3.14], 0, 300]],
  quarry: [['spot', 2, 0, 0], ['spot', 4, 0, 0], ['spot', 6, 35, 300], ['spot', 10, 0, 300]],
};
const TRY = {
  uptown: [['at', [10, 955, 0], 0, 300], ['at', [2, 980, -1.6], 0, 300], ['at', [-219, 900, 0], 0, 300], ['at', [-219, 950, 0], 0, 300]],
  quarry: [['spot', 6, 20, 0], ['spot', 6, 35, 300], ['spot', 9, 0, 0], ['spot', 10, 0, 300], ['spot', 8, 40, 300]],
};
mkdirSync('public/previews', { recursive: true });
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
// "try" after the level shoots the TRY list instead, into dev/out/preview/try-<level>-<n>.jpg, to choose from.
const trying = process.argv[3] === 'try';
for (const level of process.argv[2] ? [process.argv[2]] : Object.keys(PICKS)) {
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(`http://localhost:5183/?level=${level}`);
  await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
  await p.keyboard.press('Enter');
  await p.evaluate(() => { for (const id of ['hud', 'help', 'prompt', 'banner', 'chat', 'lesson', 'dev-jumps']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
  for (const [n, [kind, which, ahead, wheel]] of (trying ? TRY[level] : PICKS[level]).entries()) {
    await p.evaluate(([kind, which, ahead]) => {
      const level = window.game.sim.level;
      let x, z, yaw, y;
      if (kind === 'spot') ({ pos: [x, z], yaw, y } = level.checkpoints[which]);
      else if (kind === 'at') [x, z, yaw, y] = which;
      else {
        const route = level.route;
        const legs = route.slice(1).map((q, i) => Math.hypot(q[0] - route[i][0], q[1] - route[i][1]));
        let s = which * legs.reduce((a, b) => a + b, 0), i = 0;
        while (s > legs[i]) s -= legs[i++];
        const [a, q] = [route[i], route[i + 1]];
        x = a[0] + (q[0] - a[0]) * (s / legs[i]);
        z = a[1] + (q[1] - a[1]) * (s / legs[i]);
        yaw = Math.atan2(q[0] - a[0], q[1] - a[1]);
      }
      window.game.sim.teleport(x + Math.sin(yaw) * ahead, z + Math.cos(yaw) * ahead, yaw, y);
    }, [kind, which, ahead]);
    await p.mouse.move(480, 270);
    if (wheel) await p.mouse.wheel(0, wheel);
    await p.waitForTimeout(2800);
    await p.screenshot({ path: trying ? `dev/out/preview/try-${level}-${n}.jpg` : `public/previews/${level}-${n}.jpg`, type: 'jpeg', quality: 74 });
    if (wheel) await p.mouse.wheel(0, -wheel);
  }
  console.log(level, errors.length ? errors.join('\n') : 'no page errors');
  await p.close();
}
await b.close();
