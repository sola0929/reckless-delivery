// All the chat faces side by side: npx tsx dev/faces-shot.ts   (dev/out/faces.png)
import { chromium } from 'playwright-core';
import { FACES } from '../src/chat-faces';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 600, height: 140 } });
await p.setContent(`<body style="margin:10px;background:#8caacd;display:flex;gap:16px">${Object.values(FACES).map((f) => `<div style="width:100px;height:100px">${f}</div>`).join('')}</body>`);
await p.screenshot({ path: 'dev/out/faces.png' });
await b.close();
