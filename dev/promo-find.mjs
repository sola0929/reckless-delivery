// What loose things stand round a point on a level's route: kind, count, middle. node dev/promo-find.mjs <level> <route %> [radius]
import { chromium } from 'playwright-core';
const [level, at, radius = '60'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage();
await p.goto(`http://localhost:5183/?level=${level}`);
await p.waitForFunction(() => window.game?.sim, null, { timeout: 90000 });
console.log(await p.evaluate(([at, radius]) => {
  const { sim } = window.game;
  const route = sim.level.route;
  const legs = route.slice(1).map((q, i) => Math.hypot(q[0] - route[i][0], q[1] - route[i][1]));
  let s = (at / 100) * legs.reduce((a, b) => a + b, 0), i = 0;
  while (s > legs[i]) s -= legs[i++];
  const [a, q] = [route[i], route[i + 1]], t = s / legs[i];
  const x = a[0] + (q[0] - a[0]) * t, z = a[1] + (q[1] - a[1]) * t;
  const by = {};
  for (const o of sim.objects.objects) {
    const [ox, , oz] = o.desc.pos;
    if (Math.hypot(ox - x, oz - z) > radius) continue;
    (by[o.desc.kind] ??= []).push([ox, oz]);
  }
  return `at ${x.toFixed(0)},${z.toFixed(0)} heading ${Math.atan2(q[0] - a[0], q[1] - a[1]).toFixed(2)}\n` + Object.entries(by).map(([k, v]) => `${k} ×${v.length} ` + v.slice(0, 6).map((p) => p.map((n) => n.toFixed(0)).join(',')).join(' ')).join('\n');
}, [Number(at), Number(radius)]));
await b.close();
