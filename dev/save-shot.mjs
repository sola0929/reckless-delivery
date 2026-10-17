// The save point in the browser, on level 3: drive through it (wrecking one item first), fail, go back to it from the
// result page. node dev/save-shot.mjs [level]   (shots in dev/out/save-*.png)
import { chromium } from 'playwright-core';
const level = process.argv[2] ?? 'quarry';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto(`http://localhost:5183/?level=${level}`);
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 60000 });
await p.keyboard.press('Enter');
await p.waitForTimeout(500);
const state = () => p.evaluate(() => { const s = game.sim, t = s.tally(); return { value: Math.round(s.cargoValue()), t, saved: s.hasSave, result: !!s.result, retries: s.retries, pieces: s.cargo[1].pieces.length }; });
// Short of the save zone, wreck item 1, then drive in.
await p.evaluate(() => {
  const s = game.sim, save = s.level.save, [x0, z0, x1, z1] = save.zone;
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, back = 11;
  s.teleport(mx - Math.sin(save.yaw) * back, mz - Math.cos(save.yaw) * back, save.yaw, save.y);
});
await p.waitForTimeout(1200);
await p.evaluate(() => { game.sim.cargoSystem.damage(game.sim.cargo[1], 100); game.sim.cargoSystem.damage(game.sim.cargo[0], 40); });
await p.waitForTimeout(1200);
await p.keyboard.down('KeyW');
for (let i = 0; i < 80; i++) { if ((await state()).saved) break; await p.waitForTimeout(50); }
await p.keyboard.up('KeyW');
await p.waitForTimeout(300);
await p.screenshot({ path: 'dev/out/save-1-saved.png' });
const atSave = await state();
console.log('at the save', JSON.stringify(atSave));
await p.waitForTimeout(1500);
await p.evaluate(() => game.sim.fail('water'));
await p.waitForTimeout(1200);
await p.screenshot({ path: 'dev/out/save-2-failed.png' });
console.log('result buttons', await p.evaluate(() => ({ save: !document.getElementById('result-save').hidden, retry: document.getElementById('result-retry').textContent })));
console.log('on top at the button', await p.evaluate(() => { const r = document.getElementById('result-save').getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e?.id || e?.tagName; }), 'retry', await p.evaluate(() => { const r = document.getElementById('result-retry').getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e?.id || e?.tagName; }));
await p.evaluate(() => document.getElementById('result-save').click());
await p.waitForTimeout(2500);
await p.screenshot({ path: 'dev/out/save-3-back.png' });
console.log('back', JSON.stringify(await state()));
console.log(errors);
await b.close();
