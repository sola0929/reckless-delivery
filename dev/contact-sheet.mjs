// A sheet of the candidate pictures for one level, numbered, to choose from. node dev/contact-sheet.mjs <level>
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
const level = process.argv[2];
const files = readdirSync('dev/out/preview').filter((f) => f.startsWith(`${level}-`) && /^\D+-\d+\.jpg$/.test(f.replace(level, 'x'))).sort((a, b) => parseInt(a.slice(level.length + 1)) - parseInt(b.slice(level.length + 1)));
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1440, height: 300 } });
await p.setContent(`<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(4,360px);gap:0">${files.map((f) => `<div style="position:relative"><img src="data:image/jpeg;base64,${readFileSync(`dev/out/preview/${f}`).toString('base64')}" style="width:360px;display:block"><b style="position:absolute;left:6px;top:4px;color:#ff0;font:bold 28px sans-serif;text-shadow:0 0 4px #000">${f.slice(level.length + 1, -4)}</b></div>`).join('')}</body>`);
await p.waitForTimeout(500);
await p.screenshot({ path: `dev/out/preview/sheet-${level}.png`, fullPage: true });
await b.close();
