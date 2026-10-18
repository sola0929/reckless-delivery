// Open a page and print what went wrong on it. node dev/page-errors.mjs [path]
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('ERROR', String(e)));
p.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
await p.goto('http://localhost:5183/' + (process.argv[2] ?? ''));
await p.waitForTimeout(3000);
await b.close();
