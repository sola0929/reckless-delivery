// Level 1's scaffold, tried: from the formwork on the stair tower's top landing, a jump onto the 6 m lift; then, holding
// the air conditioner, walking off the edge of the 6 m lift to the ground. node dev/scaffold-check.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto('http://localhost:5183/?level=hillcity');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
// The truck in the yard by the tower, facing -X, so that the view faces -X and W walks that way.
await p.evaluate(() => window.game.sim.teleport(-84, 437, -Math.PI / 2));
await p.waitForTimeout(1500);
await p.keyboard.press('KeyC');
await p.waitForTimeout(1500);
const put = (x, y, z) => p.evaluate(([x, y, z]) => {
  const d = window.game.sim.driver;
  d.pos.set(x, y, z);
  d['body'].setTranslation({ x, y: y + 0.9, z }, true);
}, [x, y, z]);
const where = () => p.evaluate(() => { const d = window.game.sim.driver; return `${d.mode} at ${d.pos.x.toFixed(2)},${d.pos.y.toFixed(2)},${d.pos.z.toFixed(2)}`; });
await put(-91.85, 11 + 5.42, 434.5);
await p.waitForTimeout(600);
console.log('on the formwork:', await where());
await p.keyboard.press('Space');
await p.keyboard.down('KeyW');
for (let k = 0; k < 14; k++) { await p.waitForTimeout(50); console.log('  ', await where()); }
await p.keyboard.up('KeyW');
await p.waitForTimeout(500);
await p.evaluate(() => { for (const id of ['help', 'chat', 'dev-jumps']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
await p.keyboard.down('KeyW');
await p.waitForTimeout(1500);
await p.keyboard.up('KeyW');
await p.waitForTimeout(800);
await p.screenshot({ path: 'dev/out/scaffold-on-lift.png' });
console.log('after the jump:', await where(), '(the 6 m lift is at y 17.03, x -94.7 to -93.7)');
// Holding the air conditioner on the 6 m lift, walk out over its outer edge.
await p.evaluate(() => {
  const { sim } = window.game;
  const ac = sim.cargo.find((c) => c.type.id === 'aircon');
  sim.cargoSystem.hold(ac);
  sim.driver.held = ac;
});
await put(-94.2, 17.04, 441);
await p.waitForTimeout(400);
const hpBefore = await p.evaluate(() => window.game.sim.cargo.find((c) => c.type.id === 'aircon').hp);
// Walk +X, off the outer edge: S, with the view facing -X.
await p.keyboard.down('KeyS');
await p.waitForTimeout(900);
await p.keyboard.up('KeyS');
await p.waitForTimeout(2500);
console.log('after walking off with it:', await where(), await p.evaluate(() => { const { sim } = window.game; const ac = sim.cargo.find((c) => c.type.id === 'aircon'); return `held ${sim.driver.held === ac}, aircon hp ${ac.hp.toFixed(0)}`; }), 'hp before', hpBefore.toFixed(0));
console.log(errors.length ? errors.join('\n') : 'no page errors');
await b.close();
