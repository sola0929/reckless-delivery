// Each picture quality in turn: that it takes, and that nothing complains.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.keyboard.press('Escape');
for (const quality of ['low', 'medium', 'high']) {
  await page.click(`#gfx-quality [data-quality="${quality}"]`);
  await page.waitForTimeout(500);
  const now = await page.evaluate(() => { const { renderer, camera, scene } = window.game; const sun = scene.children.find((o) => o.isDirectionalLight); return `pixel ratio ${renderer.getPixelRatio()}, shadows ${sun.castShadow ? sun.shadow.mapSize.x : 'off'}, sight ${camera.far} m`; });
  console.log(quality, '→', now);
}
await page.screenshot({ path: 'dev/out/quality-pause.png' });
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
