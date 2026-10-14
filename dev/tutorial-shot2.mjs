// The tutorial in the browser, its other ends: falling short at the bridge and being put back; and the end, the
// graduation card. The crate is put aboard by hand here, the walk being dev/tutorial-fetch.ts's.
// node dev/tutorial-shot2.mjs   (shots in dev/out/tut2-*.png)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=tutorial');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 60000 });
await p.waitForTimeout(600);
const shot = (name) => p.screenshot({ path: `dev/out/tut2-${name}.png` });
const state = () => p.evaluate(() => { const s = game.sim, t = s.truck.body.translation(); return { z: t.z, y: t.y, v: s.truck.forwardSpeed(), red: s.trains.warning(0), lesson: document.getElementById('lesson-text').textContent, help: document.getElementById('lesson-help').textContent, step: document.getElementById('lesson-step').textContent, fade: document.getElementById('fade').className, result: !!s.result }; });
const log = async (what) => { const s = await state(); console.log(`${what}: z ${s.z.toFixed(1)} y ${s.y.toFixed(1)} | ${s.step} ${s.lesson} | ${s.help} | fade '${s.fade}'`); };
// To the crossing's stop line (the test jump), lesson 1 done on the way.
await p.keyboard.press('Digit3');
await p.waitForTimeout(500);
for (let i = 0; i < 150; i++) { const s = await state(); if (s.red) break; await p.waitForTimeout(60); }
await log('waiting at the line'); await shot('1-line');
for (let i = 0; i < 200; i++) { const s = await state(); if (!s.red) break; await p.waitForTimeout(60); }
// Throttle only: short of the far bank.
await p.keyboard.down('KeyW');
for (let i = 0; i < 100; i++) { const s = await state(); if (s.y < -1) break; await p.waitForTimeout(50); }
await shot('2-falling');
await p.keyboard.up('KeyW');
for (let i = 0; i < 60; i++) { const s = await state(); if (s.fade) break; await p.waitForTimeout(50); }
await log('fading'); 
await p.waitForTimeout(900);
await log('put back'); await shot('3-put-back');
// To the bay with the crate aboard: lessons 2 to 4 done by moving the truck past them, the crate set on the bed.
for (let i = 0; i < 200; i++) { const s = await state(); if (!s.red && i > 20) break; await p.waitForTimeout(60); }
await p.evaluate(() => { game.sim.teleport(72, 108, 0); });
await p.waitForTimeout(1500);
await p.evaluate(() => { const s = game.sim, t = s.truck.body.translation(), c = s.cargo.find((c) => c.bonus); c.body.setTranslation({ x: t.x, y: t.y + 1.6, z: t.z - 1.6 }, true); });
await p.waitForTimeout(2500);
await log('crate aboard');
await p.keyboard.down('KeyW'); for (let i = 0; i < 200; i++) { const s = await state(); if (s.z > 158) break; await p.waitForTimeout(30); } await p.keyboard.up('KeyW');
for (let i = 0; i < 160; i++) { const s = await state(); if (s.result) break; if (s.z < 168 && s.v < 3) { await p.keyboard.up('KeyS'); await p.keyboard.down('KeyW'); } else { await p.keyboard.up('KeyW'); if (s.v > 0.3) await p.keyboard.down('KeyS'); else await p.keyboard.up('KeyS'); } await p.waitForTimeout(60); }
await p.keyboard.up('KeyW');
await p.keyboard.up('KeyS');
await p.waitForTimeout(1500);
await log('end'); console.log(await p.evaluate(() => { const s = game.sim, t = s.truck.body.translation(); return JSON.stringify({ x: t.x, z: t.z, v: s.truck.forwardSpeed(), dwell: s.dwell, mode: s.driver.mode }); })); await shot('4-end');
console.log(errors);
await b.close();
