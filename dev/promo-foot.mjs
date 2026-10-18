// The on-foot screenshot: the truck driven through the banquet and stopped in the mess, the driver out and running back
// to it with the skeleton in their arms, photographed from ahead of them as they come.
// node dev/promo-foot.mjs [item type] → dev/out/promo/play-foot-<n>.png
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
const carry = process.argv[2] ?? 'skeleton';
mkdirSync('dev/out/promo', { recursive: true });
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.log('ERROR', String(e)));
await p.addInitScript(() => localStorage.setItem('cargo-graphics', 'high'));
await p.goto('http://localhost:5183/?level=hillcity');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.addStyleTag({ content: '#hud, #help, #prompt, #banner, #chat, #lesson, #dev-jumps, #lock { visibility: hidden !important; } * { cursor: none !important; }' });
await p.evaluate(() => {
  const { sim } = window.game;
  const route = sim.level.route;
  const legs = route.slice(1).map((q, i) => Math.hypot(q[0] - route[i][0], q[1] - route[i][1]));
  let s = 0.66 * legs.reduce((a, b) => a + b, 0), i = 0;
  while (s > legs[i]) s -= legs[i++];
  const [a, q] = [route[i], route[i + 1]], t = s / legs[i];
  sim.teleport(a[0] + (q[0] - a[0]) * t, a[1] + (q[1] - a[1]) * t, Math.atan2(q[0] - a[0], q[1] - a[1]));
  for (const car of sim.traffic.cars) { const c = car.body.translation(); const p = sim.truck.body.translation(); if (Math.hypot(c.x - p.x, c.z - p.z) < 60) { car.knocked = 1e9; car.body.setTranslation({ x: c.x, y: c.y - 200, z: c.z }, true); } }
});
await p.waitForTimeout(1500);
// Through the tables, then stop.
await p.waitForTimeout(800);
await p.keyboard.press('KeyC');
await p.waitForTimeout(600);
await p.evaluate((d) => { window.__dmg = d; }, Number(process.env.DMG ?? 0));
// Out, and away from the truck a little way, facing back towards it, holding the thing.
const ok = await p.evaluate((carry) => {
  const { sim } = window.game;
  const d = sim.driver;
  if (d.mode !== 'onFoot') return 'not out: ' + d.mode;
  const t = sim.truck.body.translation();
  const item = sim.cargo.find((c) => c.body && c.type.id === carry);
  if (!item) return 'no ' + carry;
  // Start some way behind the truck, the rest of the load strewn on the road between.
  const q = sim.truck.body.rotation();
  const fx = 2 * (q.x * q.z + q.w * q.y), fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  const back = (k, side) => ({ x: t.x - fx * k + fz * side, z: t.z - fz * k - fx * side });
  const at = back(13, 0.6);
  d.body.setTranslation({ x: at.x, y: d.pos.y + 0.2, z: at.z }, true);
  d.pos.set(at.x, d.pos.y, at.z);
  let n = 0;
  for (const c of sim.cargo) if (c.body && c !== item && !c.bonus && ['crate', 'watermelon', 'smallCrate', 'jar'].includes(c.type.id) && n < 7) {
    const pos = back(6 + n * 1.3, ((n * 37) % 7) - 3);
    c.body.setTranslation({ x: pos.x, y: t.y + 0.3, z: pos.z }, true);
    c.body.setRotation({ x: 0.2 * (n % 3), y: 0.5, z: 0.1, w: 1 }, true);
    n++;
  }
  window.__mid = back(6.5, 0);
  window.__f = { x: fx, z: fz };
  // Half wrecked, as it fell: the stage it reaches at this much damage.
  if (window.__dmg) sim.cargoSystem['damage'](item, window.__dmg);
  sim.cargoSystem.hold(item);
  d.held = item;
  window.__truck = { x: t.x, z: t.z };
  return 'carrying ' + carry;
}, carry);
console.log(ok);
await p.waitForTimeout(400);
// Walk back to the truck: towards it is up the screen for the game's own camera, so steer by the driver's bearing.
// A low camera behind and to one side of them, following, looking on past them to the truck.
await p.evaluate((cam) => {
  const g = window.game;
  const [back, side, up] = cam.split(',').map(Number);
  const step = () => {
    const d = g.sim.driver, t = window.__truck;
    const to = Math.atan2(t.x - d.pos.x, t.z - d.pos.z);
    const f = { x: Math.sin(to), z: Math.cos(to) }, r = { x: f.z, z: -f.x };
    g.camera.position.set(d.pos.x - f.x * back + r.x * side, d.pos.y + up, d.pos.z - f.z * back + r.z * side);
    g.camera.lookAt(d.pos.x + f.x * 4, d.pos.y + 1.1, d.pos.z + f.z * 4);
    requestAnimationFrame(step);
  };
  // The walk goes by the camera's last heading: frozen once it is settled behind them.
  setTimeout(() => { g.freeze = true; requestAnimationFrame(step); }, 50);
}, process.env.CAM ?? '3.2,1.6,1.5');
// The game's walk is camera-relative: the frozen camera looks back at the driver, so "back" (S) walks them towards it.
await p.keyboard.down(process.env.WALK ?? 'KeyW');
await p.keyboard.down('ShiftLeft');
for (let n = 0; n < 14; n++) {
  await p.waitForTimeout(160);
  await p.screenshot({ path: `dev/out/promo/play-foot-${n}.png` });
}
await b.close();
