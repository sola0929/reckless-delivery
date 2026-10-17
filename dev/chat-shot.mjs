// The message window in the browser: start a level, drive off, see the boss's first message come in; then wreck an item.
// node dev/chat-shot.mjs [level]   (shots in dev/out/chat-*.png)
import { chromium } from 'playwright-core';
const level = process.argv[2] ?? 'hillcity';
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
await p.goto(`http://localhost:5183/?level=${level}`);
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 60000 });
await p.keyboard.press('Enter');
await p.keyboard.down('KeyW');
await p.waitForTimeout(3500);
await p.keyboard.up('KeyW');
await p.waitForTimeout(400);
await p.screenshot({ path: "dev/out/chat-1-notice.png" });
await p.waitForTimeout(4500);
await p.screenshot({ path: 'dev/out/chat-2-open.png' });
console.log('chat', await p.evaluate(() => document.getElementById('chat-body').innerText.replace(/\n+/g, ' | ')));
console.log(errors);
await b.close();
