// Level 3's island in the settling pond: pictures, and the driver jumping out along the stones from the dike and back.
// node dev/island-check.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=quarry');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.evaluate(() => { for (const id of ['banner', 'help', 'chat', 'dev-jumps']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
// The truck on the dike beside the stones, facing north, so the view faces +Z and D walks +X... (+X is to the left of +Z: A walks +X)
await p.evaluate(() => window.game.sim.teleport(79.5, 722, 0));
await p.waitForTimeout(2500);
await p.screenshot({ path: 'dev/out/island-dike.png' });
await p.keyboard.press('KeyC');
await p.waitForTimeout(1200);
const where = () => p.evaluate(() => { const d = window.game.sim.driver; return `${d.mode} ${d.pos.x.toFixed(2)},${d.pos.y.toFixed(2)},${d.pos.z.toFixed(2)}`; });
const put = (x, y, z) => p.evaluate(([x, y, z]) => { const d = window.game.sim.driver; d.pos.set(x, y, z); d['body'].setTranslation({ x, y: y + 0.9, z }, true); }, [x, y, z]);
// Stand at the dike's edge, then jump east (+X: key A) stone by stone.
await put(82.8, 6.25, 722.2);
await p.waitForTimeout(500);
console.log('edge', await where());
const hop = async (key, ms) => { await p.evaluate(() => { const d = window.game.sim.driver; d["body"]; });  await p.keyboard.press('Space'); await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); await p.waitForTimeout(500); console.log(key, await where()); };
for (let n = 0; n < 4; n++) await hop('KeyA', 640);
await p.screenshot({ path: 'dev/out/island-on.png' });
// And back.
for (let n = 0; n < 4; n++) await hop('KeyD', 640);
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
