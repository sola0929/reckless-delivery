// Knock a power pole over and look at its wires and its neighbours'; and the boards before the oil.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.waitForTimeout(1200);
await page.evaluate(() => { document.getElementById('hud').style.display = 'none'; window.game.freeze = true; });
const view = (from, to) => page.evaluate(([f, t]) => { const { camera } = window.game; camera.position.set(...f); camera.lookAt(...t); }, [from, to]);
// A pole with a neighbour on each side, on the back street.
const pole = await page.evaluate(() => {
  const poles = window.game.sim.objects.objects.filter((o) => o.desc.kind === 'utilityPole' && Math.abs(o.desc.pos[2] - 656) < 12);
  const p = poles[Math.floor(poles.length / 2)];
  return { index: window.game.sim.objects.objects.indexOf(p), pos: p.desc.pos };
});
const [x, , z] = pole.pos;
const side = z > 656 ? -1 : 1;
await view([x, 9, z + side * 17], [x, 4, z]);
await page.waitForTimeout(500);
await page.screenshot({ path: 'dev/out/wires-1-before.png' });
await page.evaluate((i) => { const o = window.game.sim.objects.objects[i]; o.body.setLinvel({ x: 4, y: 0, z: 0 }, true); o.body.setAngvel({ x: 0, y: 0, z: -1.2 }, true); }, pole.index);
await page.waitForTimeout(450);
await page.screenshot({ path: 'dev/out/wires-2-parting.png' });
await page.waitForTimeout(2200);
await page.screenshot({ path: 'dev/out/wires-3-after.png' });
const cut = await page.evaluate(() => window.game.sim.objects.objects.filter((o) => o.cut).map((o) => `${o.desc.kind}:${o.cut}`).join(' '));
await view([52.5 - 5, 2.2, 656 + 1.5], [52.5, 0.5, 656]);
await page.waitForTimeout(400);
await page.screenshot({ path: 'dev/out/wires-4-boards.png' });
console.log('wires parted on:', cut, '|', errors.length ? errors.join(' / ') : 'no console errors');
await browser.close();
