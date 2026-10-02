// The main menu, the opening banner, the clock starting at the gate, and the pause menu.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
const checks = [];
const check = (name, ok, detail = '') => { checks.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const timer = () => page.evaluate(() => document.getElementById('timer').textContent);
const shown = (id) => page.evaluate((id) => { const e = document.getElementById(id); return !e.hidden && getComputedStyle(e).display !== 'none'; }, id);

await page.goto('http://localhost:5183/');
await page.waitForSelector('#menu-start');
await page.waitForTimeout(400);
await page.screenshot({ path: 'dev/out/menu-1-main.png' });
await page.click('[data-page="menu-help"]');
await page.waitForTimeout(350);
await page.screenshot({ path: 'dev/out/menu-1c-help.png' });
await page.keyboard.press('Escape');
await page.click('[data-page="menu-levels"]');
await page.waitForTimeout(350);
await page.screenshot({ path: 'dev/out/menu-1b-levels.png' });
check('the level page lists the levels', (await page.locator('.level-card').count()) >= 4 && (await page.locator('.level-card:disabled').count()) >= 3);
check('the bare address shows the main menu, not the game', (await shown('menu')) && !(await shown('hud')));
await page.click('.level-card');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 20000 });
check('choosing a level starts it', page.url().includes('level=city'));

await page.waitForTimeout(8000);
check('the clock waits at the depot', (await timer()) === '0:00', await timer());
check('and the manifest stays up', await page.evaluate(() => !document.getElementById('banner').classList.contains('leaving')));

await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.screenshot({ path: 'dev/out/menu-2-pause.png' });
check('Esc opens the pause menu', await shown('pause'));
const before = await page.evaluate(() => window.game.sim.traffic.cars[0].s);
await page.waitForTimeout(1500);
check('nothing moves while paused', before === (await page.evaluate(() => window.game.sim.traffic.cars[0].s)));
await page.click('#pause-resume');
await page.waitForTimeout(500);
check('resume closes it and things move again', !(await shown('pause')) && before !== (await page.evaluate(() => window.game.sim.traffic.cars[0].s)));

await page.keyboard.down('KeyW');
await page.waitForTimeout(5500);
await page.keyboard.up('KeyW');
const z = await page.evaluate(() => window.game.sim.truck.body.translation().z);
check('past the gate the clock runs', (await timer()) !== '0:00', `timer ${await timer()}, truck at z = ${z.toFixed(0)}`);
check('and the manifest goes', await page.evaluate(() => document.getElementById('banner').classList.contains('leaving')));

await page.keyboard.press('Escape');
await page.click('#pause-retry');
await page.waitForTimeout(600);
check('retry from the pause menu starts over, unpaused', !(await shown('pause')) && (await timer()) === '0:00' && (await page.evaluate(() => window.game.sim.truck.body.translation().z)) < 60);

await page.click('#pause-button');
await page.waitForTimeout(300);
check('the button in the corner pauses too', await shown('pause'));
await page.click('#pause-menu');
await page.waitForTimeout(200);
await page.screenshot({ path: 'dev/out/menu-3-confirm.png' });
check('leaving asks first', (await shown('pause-confirm')) && page.url().includes('level='));
await page.click('#pause-stay');
check('and can be called off', (await shown('pause-choices')) && !(await shown('pause-confirm')));
await page.click('#pause-menu');
await page.click('#pause-leave');
await page.waitForSelector('#menu-start');
check('back to the main menu', (await shown('menu')) && !page.url().includes('level='));
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
process.exit(checks.every(Boolean) && !errors.length ? 0 : 1);
