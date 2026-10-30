// Level 4 standing at a jump point for a minute: does a frame cost more the longer the game runs, and what grows with it.
// node dev/harbour-drift.mjs [jump point] [seconds]
import { chromium } from 'playwright-core';
const [at = 1, seconds = 60] = process.argv.slice(2).map(Number);
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e)));
await page.goto('http://localhost:5183/?level=harbour');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
await page.keyboard.press(`Digit${at % 10}`);
for (let t = 0; t < seconds; t += 5) {
  await page.evaluate(() => Object.assign(window.game.timing, { frames: 0, physics: 0, logic: 0, render: 0, worst: 0 }));
  await page.waitForTimeout(5000);
  const r = await page.evaluate(() => {
    const g = window.game, t = g.timing, f = t.frames || 1;
    let meshes = 0, tris = 0;
    g.scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine) meshes++; });
    const w = g.sim.world;
    let awake = 0;
    w.forEachRigidBody((b) => { if (!b.isSleeping() && b.isDynamic()) awake++; });
    return { fps: f / 5, physics: t.physics / f, logic: t.logic / f, render: t.render / f, worst: t.worst, calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, geos: g.renderer.info.memory.geometries, tex: g.renderer.info.memory.textures, meshes, bodies: w.bodies.len(), colliders: w.colliders.len(), awake, children: g.scene.children.length };
  });
  console.log(`${String(t + 5).padStart(3)} s: ${r.fps.toFixed(0)} fps, physics ${r.physics.toFixed(1)}, game ${r.logic.toFixed(1)}, drawing ${r.render.toFixed(1)} ms, worst ${r.worst.toFixed(0)}; ${r.calls} calls, ${(r.tris / 1000).toFixed(0)}k tris, ${r.geos} geometries, ${r.tex} textures, ${r.meshes} meshes, ${r.children} top; ${r.bodies} bodies (${r.awake} awake), ${r.colliders} colliders`);
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
