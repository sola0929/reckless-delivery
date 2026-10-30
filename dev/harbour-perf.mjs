// Level 4's slow stretches in the browser: standing at each, what the frame costs, and what it costs with each sort of
// thing in the scene hidden in turn, to find where the time goes. node dev/harbour-perf.mjs [jump point numbers]
import { chromium } from 'playwright-core';
const only = process.argv.slice(2).map(Number);
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e)));
await page.goto('http://localhost:5183/?level=harbour');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.keyboard.press('Enter');
await page.waitForTimeout(1000);
// The scene's top-level things, sorted: by what they are and what they are drawn with.
await page.evaluate(() => {
  const groups = new Map();
  for (const c of window.game.scene.children) {
    const m = c.material, mat = Array.isArray(m) ? m[0] : m;
    const key = `${c.type}${c.isInstancedMesh ? '(inst)' : ''}${mat ? ':' + mat.type + (mat.transparent ? '/transp' : '') : ''}${c.name ? ' ' + c.name : ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  window.__groups = [...groups.entries()];
});
const summary = await page.evaluate(() => window.__groups.map(([k, cs]) => {
  let tris = 0;
  for (const c of cs) c.traverse((o) => { if (o.geometry) { const g = o.geometry, n = g.index ? g.index.count : g.attributes.position?.count ?? 0; tris += (n / 3) * (o.count ?? 1); } });
  return `${k} ×${cs.length} ${(tris / 1000).toFixed(0)}k tris`;
}));
console.log(summary.join('\n'));
const measure = async () => {
  await page.evaluate(() => Object.assign(window.game.timing, { frames: 0, physics: 0, logic: 0, render: 0, worst: 0 }));
  await page.waitForTimeout(2500);
  return page.evaluate(() => { const t = window.game.timing, f = t.frames || 1; return { fps: f / 2.5, physics: t.physics / f, render: t.render / f, worst: t.worst, calls: window.game.renderer.info.render.calls }; });
};
const fmt = (r) => `${r.fps.toFixed(0)} fps, physics ${r.physics.toFixed(1)} ms, drawing ${r.render.toFixed(1)} ms, worst ${r.worst.toFixed(0)} ms, ${r.calls} calls`;
for (const k of only.length ? only : [1, 2, 3]) {
  await page.keyboard.press(`Digit${k % 10}`);
  await page.waitForTimeout(1500);
  const name = await page.evaluate((k) => window.game.sim.level.checkpoints[k - 1].name, k);
  console.log(`\n${name}: ${fmt(await measure())}`);
  const n = await page.evaluate(() => window.__groups.length);
  for (let g = 0; g < n; g++) {
    const key = await page.evaluate((g) => { const [k, cs] = window.__groups[g]; for (const c of cs) c.userData.wasVisible = c.visible, c.visible = false; return k; }, g);
    const r = await measure();
    await page.evaluate((g) => { for (const c of window.__groups[g][1]) c.visible = c.userData.wasVisible; }, g);
    console.log(`  without ${key}: ${fmt(r)}`);
  }
  await page.evaluate(() => { window.game.renderer.shadowMap.enabled = false; window.game.scene.traverse((o) => { if (o.material) for (const m of [o.material].flat()) m.needsUpdate = true; }); });
  console.log(`  without shadows: ${fmt(await measure())}`);
  await page.evaluate(() => { window.game.renderer.shadowMap.enabled = true; window.game.scene.traverse((o) => { if (o.material) for (const m of [o.material].flat()) m.needsUpdate = true; }); });
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
