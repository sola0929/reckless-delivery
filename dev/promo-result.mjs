// The result page for the promotion: level 1's load carried into the bay with some of it left behind and some of it
// broken, the page as it stands once its numbers have run up. node dev/promo-result.mjs → dev/out/promo/pick-result.png
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.log('ERROR', String(e)));
await p.addInitScript(() => localStorage.setItem('cargo-graphics', 'high'));
await p.goto('http://localhost:5183/?level=hillcity');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.waitForTimeout(1500);
// Through the banquet first, so the page has people, tables and things knocked over to count.
await p.evaluate(() => window.game.sim.teleport(-108, 658, 1.57));
await p.waitForTimeout(1200);
await p.keyboard.down('KeyW');
await p.waitForTimeout(5500);
await p.keyboard.up('KeyW');
await p.evaluate((bad) => { window.__bad = bad; }, Number(process.env.BAD ?? 0));
await p.evaluate(() => {
  const { sim } = window.game;
  // As long as a run takes: the clock only starts once out of the yard, and the jump here skipped the drive.
  sim.time = 187.4;
  // Some of it knocked about on the way: a stage or two of damage here and there, one or two things left behind.
  const t = sim.truck.body.translation();
  const [x, z] = sim.level.finish.pos;
  const move = (body, dx = 0) => { const q = body.translation(); body.setTranslation({ x: q.x + x - t.x + dx, y: q.y, z: q.z + z - t.z }, true); body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setAngvel({ x: 0, y: 0, z: 0 }, true); };
  // What is still on the bed goes with it; what fell in the banquet stays there, lost.
  // A bad run: some of what is still aboard knocked about hard, and only some of it carried in.
  const bad = Number(window.__bad ?? 0);
  let n = 0;
  sim.cargo.forEach((c) => {
    if (!c.body || c.bonus || !sim.truck.isOnBed(c.body.translation())) return;
    n++;
    if (bad && n % 3 === 0) return;
    if (bad && n % 2 === 0) sim.cargoSystem['damage'](c, bad);
    move(c.body);
  });
  move(sim.truck.body);
});
await p.waitForFunction(() => !document.getElementById('result').hidden, null, { timeout: 30000 });
await p.waitForTimeout(4500);
await p.addStyleTag({ content: '* { cursor: none !important; } #dev-jumps, #minimap { visibility: hidden !important; }' });
await p.screenshot({ path: 'dev/out/promo/pick-result.png' });
await b.close();
