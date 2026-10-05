// Level 2 in the browser, at each jump point in turn, driving on for a few seconds: where a frame's time goes (physics, the
// rest of the game, drawing), how many draw calls and triangles, and the frame rate. node dev/frame-profile.mjs [level] [jump points]
import { chromium } from 'playwright-core';
const [level = 'uptown', ...only] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e)));
await page.goto('http://localhost:5183/');
await page.evaluate(() => localStorage.setItem('cargo-best:hillcity', JSON.stringify({ stars: 1, seconds: 200, fraction: 0.5 })));
await page.goto(`http://localhost:5183/?level=${level}`);
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
const gpu = await page.evaluate(() => {
  const gl = window.game.renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log(`drawing with: ${gpu}`);
await page.keyboard.press('Enter');
const names = await page.evaluate(() => window.game.sim.level.checkpoints?.map((c) => c.name) ?? []);
for (let k = 0; k < names.length; k++) {
  if (only.length && !only.map(Number).includes(k + 1)) continue;
  await page.keyboard.press(`Digit${(k + 1) % 10}`);
  await page.waitForTimeout(800);
  await page.evaluate(() => Object.assign(window.game.timing, { frames: 0, physics: 0, logic: 0, render: 0, worst: 0 }));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(4000);
  await page.keyboard.up('KeyW');
  const t = await page.evaluate(() => ({ ...window.game.timing, calls: window.game.renderer.info.render.calls, tris: window.game.renderer.info.render.triangles }));
  const f = t.frames || 1;
  console.log(`${names[k].padEnd(8, '　')} ${(t.frames / 4).toFixed(0)} fps; per frame: physics ${(t.physics / f).toFixed(1)} ms, rest of game ${((t.logic - t.physics) / f).toFixed(1)} ms, drawing ${(t.render / f).toFixed(1)} ms, worst ${t.worst.toFixed(0)} ms; ${t.calls} draw calls, ${(t.tris / 1000).toFixed(0)}k triangles`);
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
