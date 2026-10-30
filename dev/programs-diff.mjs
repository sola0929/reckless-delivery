// Which shader programs are made only once the game is running, not at loading: their names and keys, at the first
// frames and after driving a while. node dev/programs-diff.mjs [level] [seconds]
import { chromium } from 'playwright-core';
const [level = 'harbour', seconds = 20] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`http://localhost:5183/?level=${level}`);
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
const list = () => page.evaluate(() => window.game.renderer.info.programs.map((p) => `${p.name} ${p.cacheKey.length > 160 ? p.cacheKey.replace(/,/g, ' ').slice(0, 400) : p.cacheKey}`));
const a = await list();
console.log(`at load: ${a.length} programs`);
await page.keyboard.press('Enter');
await page.waitForTimeout(2000);
const b = await list();
console.log(`after the first frames: ${b.length}`);
for (const p of b.filter((p) => !a.includes(p))) console.log('  new: ' + p);
await page.keyboard.down('KeyW');
for (let t = 0; t < +seconds; t++) {
  await page.waitForTimeout(1000);
  if (t % 4 === 1) await page.keyboard.press('KeyH');
}
await page.keyboard.up('KeyW');
const c = await list();
console.log(`after driving: ${c.length}`);
for (const p of c.filter((p) => !b.includes(p))) console.log('  new: ' + p);
await browser.close();
