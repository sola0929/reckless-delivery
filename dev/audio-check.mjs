// The sound can't be listened to from here, so measure it: the engine's note and the
// loudness of the output, standing, driving, and running into things at different speeds.
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
await page.waitForTimeout(800);
const read = () => page.evaluate(() => { const { audio, sim } = window.game; return { hz: audio.engineRate, level: audio.level(), loaded: audio.loaded, speed: sim.truck.forwardSpeed(), running: audio.running }; });
/** Loudest moment over a stretch of time. */
const peak = async (ms) => { let top = 0; const end = Date.now() + ms; while (Date.now() < end) { top = Math.max(top, (await read()).level); await page.waitForTimeout(15); } return top; };
const show = (name, r) => console.log(`${name.padEnd(34)} rate ${r.hz.toFixed(2)}   level ${r.level.toFixed(3)}   ${(r.speed * 3.6).toFixed(0)} km/h`);

const idle = await read();
console.log('audio running:', idle.running);
show('standing, engine ticking over', idle);
await page.keyboard.down('KeyW');
const notes = [];
for (let i = 0; i < 12; i++) { await page.waitForTimeout(350); const r = await read(); notes.push(r.hz); show(`accelerating, ${((i + 1) * 0.35).toFixed(1)} s`, r); }
await page.keyboard.up('KeyW');
await page.waitForTimeout(700);
show('coasting, pedal up', await read());
const drops = notes.filter((hz, i) => i > 0 && hz < notes[i - 1] - 0.05).length;
console.log(`sudden drops in pitch on the way up (there should be none): ${drops}`);

// Crashes: put the truck short of the wall behind the start and reverse into it, harder each time.
for (const [name, speed] of [['nudge', 1.5], ['bump', 4], ['crash', 9], ['big crash', 16]]) {
  if (errors.length) {
    console.log(['errors so far:', ...errors].join(' | '));
    break;
  }
  // Start over the way a player would, so that the game rebuilds what it draws.
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(400);
  await page.evaluate((speed) => {
    const { sim } = window.game;
    for (const c of sim.cargo) c.body?.setLinvel({ x: 0, y: 0, z: -speed }, true);
    sim.truck.body.setTranslation({ x: 0, y: 0.9, z: -30 }, true);
    for (const c of sim.cargo) { const p = c.body.translation(); c.body.setTranslation({ x: p.x, y: p.y, z: p.z - 30 }, true); }
    sim.truck.body.setLinvel({ x: 0, y: 0, z: -speed }, true);
  }, speed);
  const before = (await read()).level;
  const loudest = await peak(1500);
  const wear = await page.evaluate(() => window.game.sim.truckWear);
  console.log(`${name.padEnd(12)} into the wall at ${(speed * 3.6).toFixed(0).padStart(2)} km/h: loudest ${loudest.toFixed(3)} (engine alone ${before.toFixed(3)}), wear ${wear.toFixed(0)}`);
}
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
