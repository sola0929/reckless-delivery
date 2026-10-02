// Count the secondary sounds (cargo knocking about, loose things landing, things breaking)
// in a few situations: there should be none standing still, a few under hard driving, and
// plenty when ploughing through a market.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 20000 });
await page.keyboard.press('KeyQ');
await page.waitForFunction(() => window.game.audio?.loaded, null, { timeout: 15000 });
await page.evaluate(() => {
  const { audio } = window.game;
  window.heard = [];
  for (const name of ['thud', 'smash', 'knock', 'bump']) {
    const original = audio[name].bind(audio);
    audio[name] = (...args) => { window.heard.push(`${name}:${typeof args[0] === 'string' ? args[0] : args[0].toFixed(1)}`); return original(...args); };
  }
});
const tally = async (name) => {
  const heard = await page.evaluate(() => { const h = window.heard; window.heard = []; return h; });
  const counts = {};
  for (const h of heard) { const key = h.startsWith('bump') ? 'bump' : h; counts[key] = (counts[key] ?? 0) + 1; }
  console.log(`${name}: ${heard.length} sounds  ${Object.entries(counts).map(([k, n]) => `${k}×${n}`).join('  ')}`);
};
const carry = (x, z) => page.evaluate(([x, z]) => {
  const { sim } = window.game;
  const t = sim.truck.body.translation();
  for (const c of sim.cargo) if (c.body) { const p = c.body.translation(); c.body.setTranslation({ x: p.x + x - t.x, y: p.y, z: p.z + z - t.z }, true); }
  sim.truck.body.setTranslation({ x, y: t.y, z }, true);
}, [x, z]);

await page.waitForTimeout(3000);
await tally('standing still for 3 s');

await page.keyboard.down('KeyW');
await page.waitForTimeout(2500);
await page.keyboard.up('KeyW');
await page.waitForTimeout(1500);
await tally('gentle: W for 2.5 s, then coast');

await page.keyboard.press('KeyR');
await page.waitForTimeout(600);
await tally('(reset)');
await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(1500);
await page.keyboard.up('ShiftLeft');
await page.keyboard.down('KeyS');
await page.waitForTimeout(1500);
await page.keyboard.up('KeyS');
await page.waitForTimeout(1500);
await tally('rough: boost 1.5 s, hard brake');

await page.keyboard.press('KeyR');
await page.waitForTimeout(600);
await carry(-152 + 2.2, 225.6);
await page.waitForTimeout(500);
await tally('(moved to the market)');
await page.keyboard.down('KeyW');
await page.waitForTimeout(4000);
await page.keyboard.up('KeyW');
await page.waitForTimeout(2500);
await tally('through the market stalls, 4 s');

await page.evaluate(() => { for (const c of window.game.sim.cargo) if (['jar', 'watermelon', 'crate'].includes(c.type.id)) c.knock = 60; });
for (let i = 0; i < 6; i++) { await page.waitForTimeout(1300); await page.evaluate(() => { for (const c of window.game.sim.cargo) if (c.body && ['jar', 'watermelon', 'crate'].includes(c.type.id)) c.knock = 60; }); }
await page.waitForTimeout(1500);
await tally('jars, melons and crates wrecked');
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
