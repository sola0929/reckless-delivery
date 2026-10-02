// Screenshots of the city's buildings: from the driving camera in each district, and from
// a camera put where it shows a street or a skyline. Also what they cost to draw.
// Usage: node dev/buildings-shot.mjs [name ...] to take only the shots named.
import { chromium } from 'playwright-core';
const only = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.waitForTimeout(1500);
// Map squares are 16 m: x = (17.5 - column) * 16, z = row * 16, rows counted from the south.
const sq = (c, r) => [(17.5 - c) * 16, r * 16];
const carry = (x, z) => page.evaluate(([x, z]) => {
  const { sim } = window.game;
  const t = sim.truck.body.translation();
  const move = (body) => { const p = body.translation(); body.setTranslation({ x: p.x + x - t.x, y: p.y, z: p.z + z - t.z }, true); };
  for (const c of sim.cargo) if (c.body) move(c.body);
  move(sim.truck.body);
}, [x, z]);
/** From behind the truck, as the game is played. */
const drive = async (name, c, r) => {
  if (only.length && !only.includes(name)) return;
  await page.evaluate(() => { window.game.freeze = false; });
  await carry(...sq(c, r));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `dev/out/buildings-${name}.png` });
};
/** From a camera at `from` looking at `to`, both [column, row, height]. The truck is put at `truck`, [column, row]: somewhere on a road. */
const look = async (name, from, to, truck) => {
  if (only.length && !only.includes(name)) return;
  await carry(...sq(truck[0], truck[1]));
  await page.waitForTimeout(600);
  await page.evaluate(([fx, fy, fz, tx, ty, tz]) => {
    const { camera } = window.game;
    window.game.freeze = true;
    camera.position.set(fx, fy, fz);
    camera.lookAt(tx, ty, tz);
  }, [sq(from[0], from[1])[0], from[2], sq(from[0], from[1])[1], sq(to[0], to[1])[0], to[2], sq(to[0], to[1])[1]]);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `dev/out/buildings-${name}.png` });
};

await drive('drive-depot', 17.2, 8);
await drive('drive-boulevard', 22, 12.22);
await drive('drive-busy', 25, 30.67);
await drive('drive-back', 20, 41.22);
await look('street-old', [23.6, 41.1, 7], [19, 41.22, 4], [19, 41.22]);
await look('fronts-old', [20.2, 40.9, 6], [19.2, 41.9, 5], [20.2, 41.22]);
await look('temple', [25.5, 40.75, 7], [25.17, 41.8, 3], [24.5, 41.22]);
await drive('drive-temple', 25.3, 41.22);
await look('roofs-old', [22, 39.5, 30], [18, 41.22, 0], [18, 41.22]);
await look('street-downtown', [24.6, 9.2, 9], [24, 13, 8], [24, 11]);
await look('fronts-downtown', [21.4, 12.6, 9], [22.4, 11.4, 8], [21.4, 12.22]);
await look('skyline-downtown', [21, 9.5, 70], [27, 13.5, 10], [26, 12.22]);
await look('faded-downtown', [22, 10.4, 24], [22, 12.22, 0], [22, 12.22]);
await look('street-sheds', [17.4, 5.2, 7], [17.2, 9, 3], [17.2, 8]);
await look('roofs-sheds', [20, 4, 32], [17.2, 8, 0], [17.2, 8]);

if (!only.length) {
  const cost = await page.evaluate(() => {
    let triangles = 0;
    let bytes = 0;
    let meshes = 0;
    window.game.scene.traverse((o) => {
      if (!o.isMesh || !o.material.vertexColors) return;
      meshes++;
      triangles += o.geometry.index.count / 3;
      for (const a of Object.values(o.geometry.attributes)) bytes += a.array.byteLength;
      bytes += o.geometry.index.array.byteLength;
    });
    const { render } = window.game.renderer.info;
    return { buildings: meshes, triangles, megabytes: +(bytes / 1e6).toFixed(1), drawnCalls: render.calls, drawnTriangles: render.triangles };
  });
  await page.evaluate(() => { window.game.freeze = false; });
  await carry(...sq(22, 12.22));
  await page.waitForTimeout(800);
  const fps = await page.evaluate(() => new Promise((resolve) => { let n = 0; const t0 = performance.now(); const tick = () => (++n < 120 ? requestAnimationFrame(tick) : resolve(Math.round(120000 / (performance.now() - t0)))); requestAnimationFrame(tick); }));
  console.log(JSON.stringify(cost), 'fps', fps);
}
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
