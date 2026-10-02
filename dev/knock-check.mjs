// Drive the truck into one roadside thing at a time and measure how loud the knock is and
// how bright: wood should crack, metal should ring, a cone should only thud.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/?level=sandbox');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 20000 });
await page.keyboard.press('KeyQ');
await page.waitForFunction(() => window.game.audio?.loaded, null, { timeout: 15000 });
for (const [material, weight] of [['tree', 1], ['tree', 1], ['wood', 1], ['wood', 1], ['wood', 0.03], ['wood', 0.03], ['metal', 1], ['barrel', 0.1], ['soft', 0]]) {
  await page.waitForTimeout(3300);
  const heard = await page.evaluate(async ([material, weight]) => {
    const { audio } = window.game;
    const quiet = audio.level();
    audio.knock(material, 0.8, weight);
    let loudest = 0;
    const start = performance.now();
    let lasted = 0;
    while (performance.now() - start < 3200) {
      const level = audio.level();
      loudest = Math.max(loudest, level);
      if (level > quiet * 2.5) lasted = (performance.now() - start) / 1000;
      await new Promise((r) => setTimeout(r, 10));
    }
    return { quiet, loudest, lasted };
  }, [material, weight]);
  console.log(`${material.padEnd(6)} weight ${weight}: loudest ${heard.loudest.toFixed(3)} (engine alone ${heard.quiet.toFixed(3)}), heard for ${heard.lasted.toFixed(2)} s`);
}
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
