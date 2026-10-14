// The tutorial played through in the browser by a simple driver at the keys: a shot at each lesson.
// node dev/tutorial-shot.mjs   (shots in dev/out/tut-*.png)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=tutorial');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 60000 });
await p.waitForTimeout(800);
const shot = (name) => p.screenshot({ path: `dev/out/tut-${name}.png` });
const state = () => p.evaluate(() => {
  const s = game.sim, t = s.truck.body.translation(), r = s.truck.body.rotation();
  const crate = s.cargo.find((c) => c.bonus);
  const cp = crate?.body?.translation();
  return { x: t.x, y: t.y, z: t.z, yaw: Math.atan2(2 * (r.w * r.y + r.x * r.z), 1 - 2 * (r.y * r.y + r.x * r.x)), v: s.truck.forwardSpeed(), mode: s.driver.mode, dx: s.driver.pos.x, dz: s.driver.pos.z, held: crate?.held, fallen: crate?.fallen, cx: cp?.x, cz: cp?.z, red: s.trains.warning(0), lesson: document.getElementById('lesson-text').textContent, help: document.getElementById('lesson-help').textContent, result: !!s.result };
});
const held = new Set();
const keys = async (want) => {
  for (const k of held) if (!want.includes(k)) { await p.keyboard.up(k); held.delete(k); }
  for (const k of want) if (!held.has(k)) { await p.keyboard.down(k); held.add(k); }
};
/** Drive toward a point at about a speed, until near it or `until` says stop. */
async function drive(tx, tz, speed, until = () => false, boost = false) {
  for (let i = 0; i < 600; i++) {
    const s = await state();
    if (until(s) || Math.hypot(tx - s.x, tz - s.z) < 3) return s;
    const want = Math.atan2(tx - s.x, tz - s.z);
    let off = Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw));
    const k = [];
    if (s.v < speed) k.push('KeyW'); else if (s.v > speed + 2) k.push('KeyS');
    if (boost) k.push('ShiftLeft');
    if (off > 0.06) k.push('KeyA'); else if (off < -0.06) k.push('KeyD');
    await keys(k);
    await p.waitForTimeout(40);
  }
  return state();
}
const log = async (what) => { const s = await state(); console.log(`${what}: x ${s.x.toFixed(1)} z ${s.z.toFixed(1)} yaw ${s.yaw.toFixed(2)} v ${s.v.toFixed(1)} | ${s.lesson} | ${s.help}`); };
await log('start'); await shot('1-start');
await drive(52, 0, 9); await log('along the yard');
await drive(60, 0.5, 7); await drive(66, 4, 6); await drive(70.5, 10, 6); await drive(72, 18, 7);
await log('after the bend'); await p.waitForTimeout(300); await shot('2-bend-done');
let s = await drive(72, 50, 9);
await log('approaching the crossing'); await shot('3-crossing');
// Brake to a stop short of the line, wait for the train.
for (let i = 0; i < 200; i++) { s = await state(); if (s.v < 0.2 && i > 5) break; await keys(['KeyS']); await p.waitForTimeout(40); }
await keys([]);
await p.waitForTimeout(1200); await shot('4-train');
for (let i = 0; i < 200; i++) { s = await state(); if (!s.red && i > 10) break; await p.waitForTimeout(80); }
await log('train gone');
await drive(72, 95, 40, (s) => s.z > 76, true);
await log('past the crossing'); await shot('5-bridge');
s = await drive(72, 110, 40, (s) => s.z > 104 || s.y < -1, true);
await shot('6-flight');
await keys([]);
await p.waitForTimeout(1500);
await log('after the jump');
s = await drive(72, 138, 6, (s) => s.z > 132);
for (let i = 0; i < 100; i++) { s = await state(); if (Math.abs(s.v) < 0.3 && i > 5) break; await keys(['KeyS']); await p.waitForTimeout(40); }
await keys([]); await p.waitForTimeout(400);
await log('by the crate'); await shot('7-crate');
await p.keyboard.press('KeyC'); await p.waitForTimeout(800);
await log('out'); await shot('8-out');
console.log(errors);
for (const k of held) await p.keyboard.up(k);
await b.close();
