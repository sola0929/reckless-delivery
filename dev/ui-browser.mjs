// npm run dev -- --port 5190, then node dev/ui-browser.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
const base = process.env.UI_TEST_URL ?? 'http://localhost:5190';
await fs.mkdir('dev/ui-checks', {recursive:true});
const browser = await chromium.launch({channel:'msedge',headless:true});
const errors = [];
const context = await browser.newContext({viewport:{width:1600,height:900}});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if(response.status()>=400) errors.push(`${response.status()} ${response.url()}`); });
const shot = async name => { await page.waitForTimeout(300);await page.screenshot({path:`dev/ui-checks/${name}.png`}); };
const load = async id => {
 await page.goto(`${base}/?level=${id}`);
 await page.waitForFunction(()=>window.game?.sim && document.getElementById('loading').hidden,null,{timeout:90000});
};
try {
 await page.goto(base);
 await page.evaluate(()=>document.fonts.ready);
 await shot('home');
 await page.locator('[data-page="menu-levels"]').click();await shot('levels');
 assert.ok(await page.locator('#preview-go').isVisible());
 const go = await page.locator('#preview-go').boundingBox();assert.ok(go.y+go.height<900, 'launch button fits');
 assert.equal(await page.locator('.preview-shots').evaluate(e=>getComputedStyle(e).transform),'none');
 await page.locator('#menu-levels [data-page="menu-home"]').click();
 await page.locator('[data-page="menu-settings"]').click();await shot('menu-settings');
 await page.locator('#set-sfx').fill('37');await page.locator('#set-sfx').dispatchEvent('input');
 await page.locator('#menu-settings [data-page="menu-home"]').click();
 await page.locator('[data-page="menu-help"]').click();await shot('menu-controls');
 await page.locator('#menu-controls [data-mode="foot"]').click();
 await page.locator('#menu-controls [data-keys="pad"]').click();
 assert.equal(await page.locator('#menu-controls .pause-help-mode').getAttribute('data-mode'),'foot');await shot('menu-pad');

 await load('hillcity');
 assert.equal(await page.locator('#banner-list img').count(),8);
 assert.equal(await page.locator('#banner-list img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),true);
 await shot('manifest');await page.locator('#banner-go').click();await page.waitForTimeout(350);await shot('hud');
 assert.equal(await page.locator('#banner').isVisible(),false);
 await page.locator('#pause-button').click();await page.waitForTimeout(850);await shot('pause');
 await page.locator('#pause-help-open').click();await shot('controls');
 await page.locator('#pause-controls [data-keys="pad"]').click();await shot('pad');
 await page.locator('#pause-settings-open').click();await shot('settings');
 assert.equal(await page.locator('#vol-sfx').inputValue(),'37');
 await page.locator('#vol-sfx').focus();await page.keyboard.press('ArrowUp');assert.equal(await page.locator('#vol-sfx').inputValue(),'38');
 await page.locator('#pause-menu').click();assert.equal(await page.locator('.pause-left-leaf').evaluate(e=>e.inert),true);await shot('confirm');
 await page.keyboard.press('Escape');await page.waitForTimeout(100);assert.equal(await page.locator('#pause-confirm').isVisible(),false);assert.equal(await page.locator('#pause').isVisible(),true);
 await page.locator('#pause-resume').click();
 // Real overturn detection, then retry and real delivery detection.
 await page.evaluate(()=>{const b=window.game.sim.truck.body;b.setTranslation({x:0,y:3,z:20},true);b.setRotation({x:0,y:0,z:1,w:0},true);b.setLinvel({x:0,y:0,z:0},true);});
 await page.waitForFunction(()=>window.game.sim.result,null,{timeout:15000});
 await page.waitForFunction(()=>document.querySelector('#accident-image').naturalWidth===640);
 await page.waitForTimeout(3300);await shot('failure');
 assert.equal(await page.locator('#result-save').isVisible(),false);
 assert.equal(await page.evaluate(()=>window.game.renderer.getRenderTarget()),null);
 await page.locator('#result-retry').click();await page.waitForFunction(()=>!window.game.sim.result);await page.locator('#banner-go').click();await page.waitForTimeout(350);
 await page.evaluate(()=>{const s=window.game.sim,f=s.level.finish;s.teleport(f.pos[0],f.pos[1],0,f.above===undefined?undefined:f.above+2);});
 await page.waitForFunction(()=>window.game.sim.result,null,{timeout:15000});await page.waitForTimeout(1600);await shot('success');
 assert.equal(await page.locator('#result-next').isVisible(),true);assert.equal(await page.locator('#result').evaluate(e=>e.classList.contains('failed')),false);
 assert.equal(await page.locator('#result-value b').textContent(),'$4,000');
 // All delivered types fit, including the longer harbour manifest.
 for (const id of ['uptown','quarry','harbour']) {
  await load(id);await shot(`manifest-${id}`);
  assert.equal(await page.locator('#banner-list img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),true);
  await page.locator('#banner-go').click();await page.waitForTimeout(350);
  const save = await page.evaluate(()=>window.game.sim.level.save);
  if(save){
   await page.evaluate(()=>{const s=window.game.sim,v=s.level.save;s.teleport((v.zone[0]+v.zone[2])/2,(v.zone[1]+v.zone[3])/2,v.yaw,v.y);});
   await page.waitForFunction(()=>window.game.sim.hasSave,null,{timeout:10000});
   // Inject failure after the real checkpoint trigger, keeping the actual scene/pose.
   await page.evaluate(()=>window.game.sim.fail('overturned'));
   await page.waitForFunction(()=>document.querySelector('#accident-image').naturalWidth===640);
   await page.waitForTimeout(3300);await shot(`checkpoint-${id}`);
   assert.equal(await page.locator('#result-save').isVisible(),true);
   const progress=await page.locator('#failure-progress').textContent();assert.ok(parseInt(progress)>0&&parseInt(progress)<100);
   await page.locator('#result-save').click();await page.waitForFunction(()=>!window.game.sim.result);
   assert.equal(await page.locator('#result').isVisible(),false);
   assert.equal(await page.evaluate(()=>window.game.sim.hasSave),true);
  }
 }
 await load('tutorial');assert.equal(await page.locator('#banner').isVisible(),false);
 await page.locator('#pause-button').click();await page.waitForTimeout(900);await shot('tutorial-pause');
 await load('sandbox');await page.keyboard.press('Enter');await page.waitForTimeout(350);await page.locator('#pause-button').click();await page.waitForTimeout(900);await shot('sandbox-pause');
 await page.setViewportSize({width:1280,height:720});await load('hillcity');await shot('manifest-1280');
 const board=await page.locator('.dispatch-board').boundingBox();assert.ok(board.x>=0&&board.y>=0&&board.y+board.height<=720);
 await page.locator('#banner-go').click();await page.waitForTimeout(350);await page.locator('#pause-button').click();await page.waitForTimeout(900);await shot('pause-1280');
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#pause-resume').click();await page.locator('#pause-button').click();
 assert.equal(await page.locator('.pause-left-leaf').evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.deepEqual(errors,[]);console.log('PASS: menus, controls, settings persistence, manifests, overturn, delivery, three checkpoints, tutorial, free play, 1280px and reduced motion.');
} finally {await browser.close();}
