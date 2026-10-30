// Level 4's storm as the game's camera sees it: the rain, the sea and its surf, and a flash of lightning made to come.
// node dev/storm-look.mjs '[[x,z,yaw,y?,flashAt?],...]' [name] -> dev/out/look/<name>-<n>.jpg; flashAt: seconds after a
// near flash is made to come that the picture is taken, or none for none.
import { chromium } from 'playwright-core';
const spots = JSON.parse(process.argv[2]);
const name = process.argv[3] ?? 'storm';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=harbour');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.evaluate(() => { for (const id of ['hud', 'help', 'prompt', 'banner', 'chat', 'lesson', 'dev-jumps']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
for (const [n, [x, z, yaw, y, flashAt]] of spots.entries()) {
  await p.evaluate(([x, z, yaw, y]) => { window.game.sim.teleport(x, z, yaw, y ?? undefined); window.game.storm.nextFlash = 99; }, [x, z, yaw, y]);
  await p.waitForTimeout(3000);
  if (flashAt !== undefined && flashAt !== null) {
    // A near one, with its bolt.
    await p.evaluate(() => { const s = window.game.storm; const r = Math.random; Math.random = () => 0.75; s.nextFlash = 0; requestAnimationFrame(() => requestAnimationFrame(() => (Math.random = r))); });
    await p.waitForTimeout(flashAt * 1000);
  }
  await p.screenshot({ path: `dev/out/look/${name}-${n}.jpg`, type: 'jpeg', quality: 82 });
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
