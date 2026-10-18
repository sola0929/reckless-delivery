// Loose things within a radius of a point on a level. node dev/promo-near.mjs <level> <x> <z> [radius]
import { chromium } from 'playwright-core';
const [level, x, z, radius = '14'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage();
await p.goto(`http://localhost:5183/?level=${level}`);
await p.waitForFunction(() => window.game?.sim, null, { timeout: 90000 });
console.log(await p.evaluate(([x, z, radius]) => window.game.sim.objects.objects.filter((o) => Math.hypot(o.desc.pos[0] - x, o.desc.pos[2] - z) < radius).map((o) => `${o.desc.kind} ${o.desc.pos.map((n) => n.toFixed(1)).join(',')}`).join('\n'), [Number(x), Number(z), Number(radius)]));
await b.close();
