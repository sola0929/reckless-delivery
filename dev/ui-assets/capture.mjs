// Run with Vite serving the repository: node dev/ui-assets/capture.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
const root = new URL('../../public/ui/cargo/', import.meta.url);
await fs.mkdir(root, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
 const page = await browser.newPage();
 await page.goto('http://localhost:5183/dev/ui-assets/cargo-thumbnail-source.html');
 await page.waitForFunction(() => typeof window.captureCargo === 'function');
 const ids = await page.evaluate(async () => Object.keys((await import('/src/sim/cargo-types.ts')).CARGO_TYPES));
 // ONLY=tuna,anchor renders just those.
 const only = process.env.ONLY?.split(',');
 for (const id of ids.filter((id) => !only || only.includes(id))) {
  const result = await page.evaluate(id => window.captureCargo(id), id);
  if (!result.occupied || result.edge) throw new Error('Empty or clipped thumbnail: ' + id);
  await fs.writeFile(new URL(id + '.png', root), Buffer.from(result.png.split(',')[1], 'base64'));
 }
 console.log(`Generated ${ids.length} model thumbnails.`);
} finally { await browser.close(); }
