// Which way the view turns for a drag to the right with the right button, driving and on foot, beside which way E turns it.
// Camera yaw measured as atan2(x, z) of where it looks: plus is to the left, as walking left showed. node dev/drag-dir.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5183/?level=hillcity');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.waitForTimeout(1500);
const yaw = () => p.evaluate(() => { const d = window.game.camera.getWorldDirection(new window.game.camera.position.constructor()); return Math.atan2(d.x, d.z) * 180 / Math.PI; });
const turned = (a, b) => (((b - a) + 540) % 360 - 180).toFixed(0);
for (const mode of ['driving', 'on foot']) {
  if (mode === 'on foot') { await p.keyboard.press('KeyC'); await p.waitForTimeout(1500); }
  let a = await yaw();
  await p.mouse.move(640, 360);
  await p.mouse.down({ button: 'right' });
  for (let k = 0; k < 10; k++) { await p.mouse.move(640 + k * 15, 360); await p.waitForTimeout(30); }
  const mid = await yaw();
  await p.mouse.up({ button: 'right' });
  console.log(mode, 'drag right:', turned(a, mid));
  a = await yaw();
  await p.keyboard.down('KeyE'); await p.waitForTimeout(500); const e = await yaw(); await p.keyboard.up('KeyE');
  console.log(mode, 'E held:', turned(a, e));
  await p.waitForTimeout(1500);
}
await b.close();
