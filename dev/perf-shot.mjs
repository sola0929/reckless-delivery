// How heavy a level is to draw: draw calls, triangles and frame times at the start, in the browser. node dev/perf-shot.mjs <level> [<level> ...]
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
for (const level of process.argv.slice(2)) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5183/');
  await page.evaluate(() => localStorage.setItem('cargo-best:city', JSON.stringify({ stars: 1, seconds: 200, fraction: 0.5 })));
  await page.goto(`http://localhost:5183/?level=${level}`);
  await page.waitForFunction(() => window.game?.sim, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(async () => {
    const times = [];
    let last = performance.now();
    await new Promise((done) => { const tick = (now) => { times.push(now - last); last = now; if (times.length < 120) requestAnimationFrame(tick); else done(); }; requestAnimationFrame(tick); });
    times.sort((a, b) => a - b);
    const g = window.game;
    const info = g.view?.renderer?.info ?? g.renderer?.info;
    const scene = g.view?.scene ?? g.scene;
    let meshes = 0;
    scene?.traverse((o) => { if (o.isMesh || o.isInstancedMesh) meshes++; });
    return { median: times[60].toFixed(1), worst: times[114].toFixed(1), calls: info?.render?.calls, triangles: info?.render?.triangles, meshes, bodies: g.sim.world?.bodies?.len?.() ?? g.sim.world?.bodies?.length };
  });
  console.log(level, JSON.stringify(r));
  await page.close();
}
await browser.close();
