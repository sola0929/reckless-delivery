// Photograph a promotional layout in dev/promo/ at a given size. node dev/promo-compose.mjs <page> <width> <height> [out]
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [name, w = '1920', h = '1080', out = `dev/promo/export/${name}-${w}x${h}.png`] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: Number(w), height: Number(h) } });
await p.goto(pathToFileURL(resolve(`dev/promo/${name}.html`)).href + (process.env.QUERY ? `?${process.env.QUERY}` : ''));
await p.waitForFunction(() => document.fonts.ready.then(() => true));
await p.waitForTimeout(400);
await p.screenshot({ path: out });
console.log(out);
await b.close();
