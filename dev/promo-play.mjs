// Screenshots for the promotion, taken by playing: the truck put down somewhere on a level, driven by a timeline of keys,
// the game's own chase camera, a burst of pictures over a stretch of it with nothing over the picture.
// node dev/promo-play.mjs <shot name>   (the shots are in dev/promo/shots.json)   → dev/out/promo/play-<name>-<n>.png
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'fs';
const name = process.argv[2];
const shot = JSON.parse(readFileSync('dev/promo/shots.json', 'utf8'))[name];
if (!shot) throw new Error(`no shot ${name}`);
mkdirSync('dev/out/promo', { recursive: true });
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: shot.scale ?? 1 });
p.on('pageerror', (e) => console.log('ERROR', String(e)));
await p.addInitScript(() => localStorage.setItem('cargo-graphics', 'high'));
await p.goto(`http://localhost:5183/?level=${shot.level}`);
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
if (!shot.hud) await p.addStyleTag({ content: '#hud, #help, #prompt, #banner, #chat, #lesson, #dev-jumps, #lock { visibility: hidden !important; } * { cursor: none !important; }' });
else await p.addStyleTag({ content: '#dev-jumps { visibility: hidden !important; } * { cursor: none !important; }' });
// Where to start: a test spot, a share of the way along the route, or so far back from the nearest thing of a kind to a
// point on the route, facing it.
const where = await p.evaluate((start) => {
  const { sim } = window.game;
  const along = (at) => {
    const route = sim.level.route;
    const legs = route.slice(1).map((q, i) => Math.hypot(q[0] - route[i][0], q[1] - route[i][1]));
    let s = (at / 100) * legs.reduce((a, b) => a + b, 0), i = 0;
    while (s > legs[i]) s -= legs[i++];
    const [a, q] = [route[i], route[i + 1]];
    const t = s / legs[i];
    return { x: a[0] + (q[0] - a[0]) * t, z: a[1] + (q[1] - a[1]) * t, yaw: Math.atan2(q[0] - a[0], q[1] - a[1]) };
  };
  if (start.spot) {
    const c = sim.level.checkpoints.find((c) => c.name === start.spot);
    sim.teleport(c.pos[0], c.pos[1], c.yaw + (start.turn ?? 0), c.y);
    return c.name;
  }
  if (start.at) { sim.teleport(start.at[0], start.at[1], start.at[2], start.at[3]); return 'at ' + start.at.join(','); }
  const here = along(start.route);
  if (start.near) {
    const things = sim.objects.objects.filter((o) => o.desc.kind === start.near);
    things.sort((a, b) => Math.hypot(a.desc.pos[0] - here.x, a.desc.pos[2] - here.z) - Math.hypot(b.desc.pos[0] - here.x, b.desc.pos[2] - here.z));
    const t = things[0];
    if (!t) return 'none of ' + start.near;
    // Back along the route's own heading from it, by `back` metres, and off to one side by `side`.
    const f = { x: Math.sin(here.yaw), z: Math.cos(here.yaw) }, r = { x: f.z, z: -f.x };
    const x = t.desc.pos[0] - f.x * start.back + r.x * (start.side ?? 0), z = t.desc.pos[2] - f.z * start.back + r.z * (start.side ?? 0);
    sim.teleport(x, z, Math.atan2(t.desc.pos[0] - x, t.desc.pos[2] - z) + (start.aim ?? 0));
    return `${start.near} at ${t.desc.pos[0].toFixed(0)},${t.desc.pos[2].toFixed(0)}`;
  }
  sim.teleport(here.x, here.z, here.yaw + (start.turn ?? 0));
  return `route ${start.route}%`;
}, shot.start);
console.log('start', where);
// Nobody runs from the truck: they stay where they were, at their tables.
if (shot.calm) await p.evaluate(() => { for (const q of window.game.sim.pedestrians.list) q.reaction = 1e9; });
// Whoever is knocked flying goes higher, for the picture.
if (shot.fling) await p.evaluate((k) => {
  const seen = new Set();
  const watch = () => {
    for (const q of window.game.sim.pedestrians.list) if (q.state === "down" && !seen.has(q) && q.velocity.y > 0) { seen.add(q); if (seen.size > 2) continue; q.velocity.y *= k; q.velocity.x *= 0.8; q.velocity.z *= 0.8; }
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
}, shot.fling);
// A camera stood still somewhere, looking at a point.
if (shot.fixed) await p.evaluate((c) => { const g = window.game; g.freeze = true; g.camera.position.set(c[0], c[1], c[2]); g.camera.lookAt(c[3], c[4], c[5]); }, shot.fixed);
// A lower camera than the game's own, kept behind and to one side of the truck and looking past it: [back, side, up, look ahead].
if (shot.cam) await p.evaluate((cam) => {
  const g = window.game;
  g.freeze = true;
  const [back, side, up, ahead] = cam;
  let x = null, z = null, yaw = null;
  const follow = () => {
    const t = g.sim.truck.body.translation(), v = g.sim.truck.body.linvel();
    const q = g.sim.truck.body.rotation();
    const heading = Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y));
    // Swung round after the truck smoothly, not snapped to every bump.
    yaw = yaw === null ? heading : yaw + Math.atan2(Math.sin(heading - yaw), Math.cos(heading - yaw)) * 0.06;
    const f = { x: Math.sin(yaw), z: Math.cos(yaw) }, r = { x: f.z, z: -f.x };
    g.camera.position.set(t.x - f.x * back + r.x * side, t.y + up, t.z - f.z * back + r.z * side);
    g.camera.lookAt(t.x + f.x * ahead, t.y + 1, t.z + f.z * ahead);
    requestAnimationFrame(follow);
  };
  requestAnimationFrame(follow);
}, shot.cam);
await p.waitForTimeout(1500);
// Already going, if asked: so many m/s along the way it faces.
if (shot.v) await p.evaluate((v) => { const b = window.game.sim.truck.body, q = b.rotation(); b.setLinvel({ x: 2 * (q.x * q.z + q.w * q.y) * v, y: 0, z: (1 - 2 * (q.x * q.x + q.y * q.y)) * v }, true); }, shot.v);
// The keys, and the pictures, on one clock.
const t0 = Date.now();
const keys = [...(shot.keys ?? [])].sort((a, b) => a[0] - b[0]);
const [from, to, every] = shot.burst;
let n = 0, next = from;
while (Date.now() - t0 < to) {
  const now = Date.now() - t0;
  while (keys.length && keys[0][0] <= now) {
    const [, how, code] = keys.shift();
    if (how === 'down') await p.keyboard.down(code);
    else if (how === 'up') await p.keyboard.up(code);
    else await p.keyboard.press(code);
  }
  // Something sent at the truck: the nearest moving thing of a kind put on its line ahead of it, coming at it as it came.
  if (shot.launch && !shot.launch.done && now >= shot.launch.at) {
    shot.launch.done = true;
    console.log(await p.evaluate((l) => {
      const { sim } = window.game;
      const t = sim.truck.body.translation(), q = sim.truck.body.rotation();
      const f = { x: 2 * (q.x * q.z + q.w * q.y), z: 1 - 2 * (q.x * q.x + q.y * q.y) };
      const n = Math.hypot(f.x, f.z); f.x /= n; f.z /= n;
      const moving = sim.objects.objects.filter((o) => o.desc.kind === l.kind && o.body && Math.hypot(o.body.linvel().x, o.body.linvel().z) > 2);
      const o = moving[0];
      if (!o) return 'nothing moving of ' + l.kind;
      const v = o.body.linvel(), w = o.body.angvel(), sp = Math.hypot(v.x, v.z);
      const k = l.speed / sp;
      o.body.setTranslation({ x: t.x + f.x * l.ahead + f.z * (l.side ?? 0), y: o.body.translation().y - (o.body.translation().y - t.y) + 0.2, z: t.z + f.z * l.ahead - f.x * (l.side ?? 0) }, true);
      o.body.setLinvel({ x: -f.x * l.speed, y: 0, z: -f.z * l.speed }, true);
      o.body.setAngvel({ x: w.x * k, y: w.y * k, z: w.z * k }, true);
      return 'launched ' + l.kind;
    }, shot.launch));
  }
  if (now >= next) {
    await p.screenshot({ path: `dev/out/promo/play-${name}${process.env.TAKE ?? ''}-${n++}.png` });
    next = now + every;
  }
  await p.waitForTimeout(10);
}
console.log(n, 'pictures');
await b.close();
