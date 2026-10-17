// The ui-tour shots on one sheet, two across. node dev/tour-sheet.mjs
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const names = ['home', 'settings', 'banner', 'tucked', 'pause', 'result'];
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 300 } });
await p.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(2,640px)">${names.map((n) => `<div style="position:relative"><img src="data:image/png;base64,${readFileSync(`dev/out/tour-${n}.png`).toString('base64')}" style="width:640px;display:block"><b style="position:absolute;left:6px;top:4px;color:#ff0;font:bold 22px sans-serif;text-shadow:0 0 4px #000">${n}</b></div>`).join('')}</body>`);
await p.waitForTimeout(400);
await p.screenshot({ path: 'dev/out/tour-sheet.png', fullPage: true });
await b.close();
