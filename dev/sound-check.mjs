// The looping sounds, the music and the volume controls: are they there, do they come on
// when they should, and do the sliders do anything.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const checks = [];
const check = (name, ok, detail = '') => { checks.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

await page.goto('http://localhost:5183/');
await page.waitForSelector('#menu-start');
await page.mouse.click(900, 400);
await page.waitForTimeout(800);
const menuMusic = await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => r.name.includes('/audio/')).map((r) => r.name.split('/').pop()));
check('the main menu plays its music', menuMusic.some((name) => name.startsWith('music-')), menuMusic.join(', '));
await page.hover('#menu-start');
await page.waitForTimeout(300);
check('and its buttons make a sound', (await page.evaluate(() => performance.getEntriesByType('resource').some((r) => r.name.includes('ui-move')))));

await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 20000 });
await page.keyboard.press('KeyQ');
await page.waitForFunction(() => window.game.audio?.loaded && window.game.audio.loops?.bell, null, { timeout: 20000 });
const loop = (name) => page.evaluate((name) => window.game.audio.loops[name].gain.gain.value, name);
const carry = (x, z) => page.evaluate(([x, z]) => {
  const { sim } = window.game;
  const t = sim.truck.body.translation();
  for (const c of sim.cargo) if (c.body) { const p = c.body.translation(); c.body.setTranslation({ x: p.x + x - t.x, y: p.y, z: p.z + z - t.z }, true); }
  sim.truck.body.setTranslation({ x, y: t.y, z }, true);
}, [x, z]);

await page.waitForTimeout(500);
check('no squeal standing still', (await loop('skid')) < 0.01, `${(await loop('skid')).toFixed(3)}`);
check('no train or bell at the depot', (await loop('train')) < 0.01 && (await loop('bell')) < 0.01);
await page.keyboard.down('KeyW');
await page.waitForTimeout(3000);
await page.keyboard.up('KeyW');
await page.keyboard.down('KeyS');
let squeal = 0;
for (let i = 0; i < 20; i++) { await page.waitForTimeout(60); squeal = Math.max(squeal, await loop('skid')); }
await page.keyboard.up('KeyS');
check('the tyres squeal under hard braking', squeal > 0.15, `loudest ${squeal.toFixed(2)}`);
await page.waitForTimeout(1500);
check('and stop when the truck has', (await loop('skid')) < 0.02, `${(await loop('skid')).toFixed(3)}`);

// Beside the crossing: wait long enough for trains to come and go.
const track = await page.evaluate(() => { const t = window.game.sim.level.tracks[0]; return { x: t.watchX, z: t.z }; });
await carry(track.x - 3.5, track.z - 12);
let bell = 0, train = 0, bellOff = false;
for (let i = 0; i < 160; i++) {
  await page.waitForTimeout(100);
  const b = await loop('bell');
  bell = Math.max(bell, b);
  train = Math.max(train, await loop('train'));
  if (b < 0.02) bellOff = true;
}
check('the crossing bell rings when a signal is at red', bell > 0.2, `loudest ${bell.toFixed(2)}`);
check('and is silent in between', bellOff);
check('trains are heard going by', train > 0.3, `loudest ${train.toFixed(2)}`);

// The volume controls.
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.screenshot({ path: 'dev/out/pause-sound.png' });
await page.evaluate(() => { const s = document.getElementById('vol-sfx'); s.value = '20'; s.dispatchEvent(new Event('input')); });
await page.waitForTimeout(300);
const master = await page.evaluate(() => window.game.audio.master.gain.value);
check('the effects slider turns the effects down', Math.abs(master - 0.2) < 0.03, `master ${master.toFixed(2)}`);
await page.evaluate(() => { const m = document.getElementById('vol-mute'); m.checked = true; m.dispatchEvent(new Event('change')); });
await page.waitForTimeout(300);
check('mute silences them', (await page.evaluate(() => window.game.audio.master.gain.value)) < 0.01);
const saved = await page.evaluate(() => localStorage.getItem('cargo-sound'));
check('and the settings are remembered', saved.includes('"muted":true'), saved);
await page.evaluate(() => localStorage.removeItem('cargo-sound'));
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
process.exit(checks.every(Boolean) && !errors.length ? 0 : 1);
