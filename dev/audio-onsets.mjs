// Find the separate hits in a recording of several: where each starts, how loud it is and
// how long before it has died away. node dev/audio-onsets.mjs <file under public/audio> ...
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
await page.goto('http://localhost:5183/?level=sandbox');
for (const file of process.argv.slice(2)) {
  const hits = await page.evaluate(async (file) => {
    const data = await (await fetch(`/audio/${file}`)).arrayBuffer();
    const buffer = await new OfflineAudioContext(1, 44100, 44100).decodeAudioData(data);
    const samples = buffer.getChannelData(0);
    const window = Math.floor(buffer.sampleRate * 0.02);
    const rms = [];
    for (let i = 0; i + window <= samples.length; i += window) {
      let sum = 0;
      for (let j = i; j < i + window; j++) sum += samples[j] * samples[j];
      rms.push(Math.sqrt(sum / window));
    }
    const top = Math.max(...rms);
    const hits = [];
    for (let i = 1; i < rms.length; i++) {
      // A hit: loud, and at least three times what came just before.
      if (rms[i] < top * 0.25 || rms[i] < Math.max(rms[i - 1], rms[i - 2] ?? 0, 0.004) * 3) continue;
      let end = i;
      while (end < rms.length && rms[end] > rms[i] * 0.06) end++;
      hits.push({ at: i * 0.02, peak: Math.max(...rms.slice(i, i + 5)), rings: (end - i) * 0.02 });
      i = end;
    }
    return hits;
  }, file);
  console.log(`${file}: ${hits.map((h) => `${h.at.toFixed(2)}s (peak ${h.peak.toFixed(2)}, ${h.rings.toFixed(2)}s)`).join('  ')}`);
}
await browser.close();
