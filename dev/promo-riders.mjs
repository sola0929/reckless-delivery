// Where a level's scooter riders are thickest: count of riders within 25 m of each tenth of the route.
import { chromium } from 'playwright-core';
const level = process.argv[2];
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage();
await p.goto(`http://localhost:5183/?level=${level}`);
await p.waitForFunction(() => window.game?.sim, null, { timeout: 90000 });
await p.waitForTimeout(3000);
console.log(await p.evaluate(() => {
  const { sim } = window.game;
  const route = sim.level.route;
  const legs = route.slice(1).map((q, i) => Math.hypot(q[0] - route[i][0], q[1] - route[i][1]));
  const total = legs.reduce((a, b) => a + b, 0);
  const out = [];
  for (let f = 0; f <= 100; f += 4) {
    let s = (f / 100) * total, i = 0;
    while (i < legs.length - 1 && s > legs[i]) s -= legs[i++];
    const [a, q] = [route[i], route[i + 1]], t = Math.min(1, s / legs[i]);
    const x = a[0] + (q[0] - a[0]) * t, z = a[1] + (q[1] - a[1]) * t;
    const n = sim.riders.list.filter((r) => { const c = r.body.translation(); return Math.hypot(c.x - x, c.z - z) < 25; }).length;
    out.push(`${f}%:${n} (${x.toFixed(0)},${z.toFixed(0)})`);
  }
  return out.join('  ');
}));
await b.close();
