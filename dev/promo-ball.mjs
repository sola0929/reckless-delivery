// The wrecking ball for the promotion: level 3's dike, the truck stood where the ball's swing crosses the road, the paint
// taken off the load, and a burst of pictures as the ball comes round into it, from beside and ahead.
// node dev/promo-ball.mjs [which ball, 0 up] [camera back,side,up,ahead] → dev/out/promo/play-ball-<n>.png
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
const [which = '0', cam = '-9,8,2.4,-2'] = process.argv.slice(2);
mkdirSync('dev/out/promo', { recursive: true });
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.log('ERROR', String(e)));
await p.addInitScript(() => localStorage.setItem('cargo-graphics', 'high'));
await p.goto('http://localhost:5183/?level=quarry');
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.addStyleTag({ content: '#hud, #help, #prompt, #banner, #chat, #lesson, #dev-jumps, #lock { visibility: hidden !important; } * { cursor: none !important; }' });
// Where the ball crosses the road: watched for a whole round, the point of its path nearest the route.
const info = await p.evaluate(async (which) => {
  const { sim } = window.game;
  const rigs = sim.rigs.list.filter((r) => r.desc.kind === 'ball');
  const rig = rigs[Number(which)];
  if (!rig) return `only ${rigs.length} balls`;
  const ball = rig.parts[2].body;
  const route = sim.level.route;
  const near = (x, z) => {
    let best = { d: 1e9, yaw: 0 };
    for (let i = 0; i < route.length - 1; i++) {
      const [a, q] = [route[i], route[i + 1]];
      const dx = q[0] - a[0], dz = q[1] - a[1], len = Math.hypot(dx, dz);
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (len * len)));
      const d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z);
      if (d < best.d) best = { d, yaw: Math.atan2(dx, dz), x: a[0] + dx * t, z: a[1] + dz * t };
    }
    return best;
  };
  let best = null;
  const samples = [];
  const t0 = performance.now();
  while (performance.now() - t0 < rig.desc.period * 1000 + 500) {
    await new Promise((r) => requestAnimationFrame(r));
    const q = ball.translation();
    const n = near(q.x, q.z);
    samples.push({ ...n, bx: q.x, bz: q.z, y: q.y });
  }
  const low = Math.min(...samples.map((q) => q.y));
  for (const q of samples) if (q.y < low + 0.8 && (!best || q.d < best.d)) best = q;
  window.__spot = best;
  window.__ball = ball;
  return `ball ${which} of ${rigs.length}, crosses the road ${best.d.toFixed(1)} m from its line at ${best.bx?.toFixed(0)},${best.bz?.toFixed(0)}`;
}, which);
console.log(info);
await p.evaluate((k) => { window.__ahead = k; }, Number(process.env.AHEAD ?? 1.5));
await p.evaluate(() => {
  const { sim } = window.game;
  const s = window.__spot;
  // The cab just short of where it comes through, so that it meets the side of the bed and the load.
  const k = Number(window.__ahead ?? 1.5); sim.teleport(s.bx - Math.sin(s.yaw) * k, s.bz - Math.cos(s.yaw) * k, s.yaw);
});
await p.waitForTimeout(400);
await p.evaluate(() => {
  const { sim } = window.game;
  for (const c of sim.cargo) if (c.body && /^paint/.test(c.type.id)) { const q = c.body.translation(); c.body.setTranslation({ x: q.x, y: q.y - 300, z: q.z }, true); c.body.setGravityScale(0, true); c.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
});
await p.evaluate((cam) => {
  const g = window.game;
  g.freeze = true;
  const [back, side, up, ahead] = cam.split(',').map(Number);
  const s = window.__spot;
  const f = { x: Math.sin(s.yaw), z: Math.cos(s.yaw) }, r = { x: f.z, z: -f.x };
  const t = g.sim.truck.body.translation();
  g.camera.position.set(t.x - f.x * back + r.x * side, t.y + up, t.z - f.z * back + r.z * side);
  g.camera.lookAt(t.x + f.x * ahead, t.y + 1.4, t.z + f.z * ahead);
}, cam);
if (process.env.POSE) {
  await p.evaluate((gap) => { window.__gap = gap; }, Number(process.env.GAP ?? 0.05));
  // The moment the ball meets the side of the bed, held there: everything stopped, gravity off, the ball kept from going
  // on into the truck, and the load thrown up off the far side as the blow throws it.
  await p.waitForFunction(() => {
    const g = window.game, q = window.__ball.translation(), b = g.sim.truck.body, t = b.translation(), o = b.rotation();
    const fx = 2 * (o.x * o.z + o.w * o.y), fz = 1 - 2 * (o.x * o.x + o.y * o.y);
    // The ball's middle in the truck's own frame, and how far it is from the box the truck and its load fill.
    const dx = q.x - t.x, dz = q.z - t.z;
    const lx = dx * fz - dz * fx, lz = dx * fx + dz * fz, ly = q.y - t.y;
    const cx = Math.max(-1.3, Math.min(1.3, lx)), cz = Math.max(-3.7, Math.min(3.7, lz)), cy = Math.max(-1, Math.min(1.6, ly));
    window.__d = Math.hypot(lx - cx, lz - cz, ly - cy) - 1.1;
    return window.__d < Number(window.__gap ?? 0.05) && window.__d > 0.2;
  }, null, { timeout: 40000, polling: 'raf' });
  await p.evaluate((pose) => {
    const { sim } = window.game;
    sim.world.gravity = { x: 0, y: 0, z: 0 };
    const ball = window.__ball;
    ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
    ball.setLinearDamping(1e6);
    const b = sim.truck.body, t = b.translation(), o = b.rotation();
    b.setLinvel({ x: 0, y: 0, z: 0 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    const q = ball.translation();
    // Away from the ball, across the truck; and the truck's own forward.
    let ax = t.x - q.x, az = t.z - q.z; const n = Math.hypot(ax, az); ax /= n; az /= n;
    const fx = 2 * (o.x * o.z + o.w * o.y), fz = 1 - 2 * (o.x * o.x + o.y * o.y);
    let k = 0;
    for (const c of sim.cargo) {
      if (!c.body || c.bonus || !pose.length) continue;
      const [out, up, along, spin] = pose[k % pose.length];
      const p0 = c.body.translation();
      c.body.setTranslation({ x: p0.x + ax * out + fx * along, y: p0.y + up, z: p0.z + az * out + fz * along }, true);
      c.body.setRotation({ x: Math.sin(spin) * 0.4, y: Math.cos(spin * 1.3) * 0.3, z: Math.sin(spin * 0.7) * 0.4, w: 1 }, true);
      c.body.setLinvel({ x: 0, y: 0, z: 0 }, true); c.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      k++;
    }
  }, JSON.parse(process.env.POSE));
  await p.waitForTimeout(90);
  await p.evaluate(() => { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { code: 'Escape', key: 'Escape' })); });
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'dev/out/promo/play-ball-pose.png' });
  await b.close();
  process.exit(0);
}
await p.evaluate((r) => { window.__reach = r; }, Number(process.env.REACH ?? 7));
// Wait for it to come round to within reach, then a quick burst.
await p.waitForFunction(() => { const g = window.game, q = window.__ball.translation(), t = g.sim.truck.body.translation(); return Math.hypot(q.x - t.x, q.y - t.y, q.z - t.z) < Number(window.__reach ?? 7); }, null, { timeout: 40000, polling: 'raf' });
for (let n = 0; n < Number(process.env.SHOTS ?? 14); n++) {
  await p.screenshot({ path: `dev/out/promo/play-ball-${n}.png` });
  await p.waitForTimeout(60);
}
await b.close();
