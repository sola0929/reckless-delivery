// Level 4 in the browser, driven from its start along its route at a steady pace by keys held down, as a player would:
// every frame that takes longer than it should, where the truck was, and what the frame went on.
// node dev/harbour-drive-perf.mjs [seconds] [km/h]
import { chromium } from 'playwright-core';
const [seconds = 90, kmh = 22] = process.argv.slice(2).map(Number);
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: +(process.env.W ?? 1600), height: +(process.env.H ?? 900) }, deviceScaleFactor: +(process.env.DPR ?? 1) });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e)));
await page.goto('http://localhost:5183/?level=harbour');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
await page.evaluate((want) => {
  const g = window.game, way = g.sim.level.route, keys = g.input.down;
  const lengths = way.slice(1).map((p, k) => Math.hypot(p[0] - way[k][0], p[1] - way[k][1]));
  const nearest = (x, z) => {
    let best = 0, bestD = Infinity, base = 0;
    for (let k = 0; k < lengths.length; k++) {
      const [ax, az] = way[k], [bx, bz] = way[k + 1], dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengths[k] ** 2));
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < bestD) { bestD = d; best = base + t * lengths[k]; }
      base += lengths[k];
    }
    return best;
  };
  const along = (s) => {
    for (let k = 0; k < lengths.length; k++) {
      if (s <= lengths[k] || k === lengths.length - 1) { const t = Math.min(1, s / lengths[k]); return [way[k][0] + (way[k + 1][0] - way[k][0]) * t, way[k][1] + (way[k + 1][1] - way[k][1]) * t]; }
      s -= lengths[k];
    }
  };
  window.__spikes = [];
  window.__log = [];
  let last = performance.now(), s = 0, still = 0, programs = g.renderer.info.programs.length, geos = g.renderer.info.memory.geometries, texs = g.renderer.info.memory.textures;
  window.__hops = 0;
  const tick = () => {
    const now = performance.now(), dt = now - last;
    last = now;
    const p = g.sim.truck.body.translation(), r = g.sim.truck.body.rotation();
    s = Math.max(s, nearest(p.x, p.z));
    const info = g.renderer.info, np = info.programs.length, ng = info.memory.geometries, nt = info.memory.textures;
    if (dt > 33) window.__spikes.push({ at: [p.x, p.z], s, dt, t: now, why: (np > programs ? '+' + (np - programs) + 'prog [' + info.programs.slice(programs).map((q) => { const k = q.cacheKey.split(','); let best = null, bd = 1e9; for (const o of info.programs.slice(0, programs)) { const ok = o.cacheKey.split(','); if (ok.length !== k.length) continue; const d = k.filter((v, i) => v !== ok[i]).length; if (d < bd) { bd = d; best = ok; } } return best ? k.map((v, i) => v !== best[i] ? i + ':' + best[i] + '->' + v : '').filter(Boolean).join(' ') : 'no match'; }).join(' ') + '] ' : '') + (ng !== geos ? (ng - geos) + 'geo ' : '') + (nt !== texs ? (nt - texs) + 'tex' : '') });
    programs = np; geos = ng; texs = nt;
    const [ax, az] = along(s + 7);
    const fx = 2 * (r.x * r.z + r.w * r.y), fz = 1 - 2 * (r.x * r.x + r.y * r.y);
    const off = Math.atan2(fx * (az - p.z) - fz * (ax - p.x), fx * (ax - p.x) + fz * (az - p.z));
    keys.delete('KeyA'); keys.delete('KeyD'); keys.delete('KeyW'); keys.delete('KeyS');
    if (off > 0.06) keys.add('KeyA'); else if (off < -0.06) keys.add('KeyD');
    const v = g.sim.truck.forwardSpeed();
    if (v < want) keys.add('KeyW'); else if (v > want + 1.5) keys.add('KeyS');
    still = Math.abs(v) < 0.5 ? still + 1 : 0;
    // Held up by something the line does not go round: on past it, as a player would find the way.
    if (still > 90) {
      const [hx, hz] = along(s + 12), [nx, nz] = along(s + 16);
      g.sim.teleport(hx, hz, Math.atan2(nx - hx, nz - hz));
      still = 0;
      window.__hops++;
    }
    window.__s = s;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}, kmh / 3.6);
for (let t = 0; t < seconds; t += 5) {
  await page.evaluate(() => Object.assign(window.game.timing, { frames: 0, physics: 0, logic: 0, render: 0, worst: 0 }));
  await page.waitForTimeout(5000);
  const r = await page.evaluate(() => {
    const g = window.game, t = g.timing, f = t.frames || 1, p = g.sim.truck.body.translation();
    let awake = 0;
    g.sim.world.forEachRigidBody((b) => { if (!b.isSleeping() && b.isDynamic()) awake++; });
    return { fps: f / 5, physics: t.physics / f, logic: t.logic / f, render: t.render / f, worst: t.worst, s: window.__s, x: p.x, z: p.z, awake, hops: window.__hops, spikes: window.__spikes.splice(0) };
  });
  console.log(`${String(t + 5).padStart(3)} s, ${r.s.toFixed(0)} m (${r.x.toFixed(0)},${r.z.toFixed(0)}): ${r.fps.toFixed(0)} fps, physics ${r.physics.toFixed(1)}, game ${r.logic.toFixed(1)}, drawing ${r.render.toFixed(1)} ms, worst ${r.worst.toFixed(0)}; ${r.awake} awake, ${r.hops} hops; ${r.spikes.length} frames over 33 ms${r.spikes.length ? ' (' + r.spikes.slice(0, 6).map((k) => `${k.dt.toFixed(0)}@${k.s.toFixed(0)}m(${k.at.map((v) => v.toFixed(0))})${k.why ? ' ' + k.why : ''}`).join(' ') + ')' : ''}`);
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
