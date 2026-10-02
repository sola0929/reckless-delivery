// Look at recordings without ears: loudness over time (to choose what to loop, and to see
// where a crash starts and how long it rings), and for engines the pitch of the rumble and
// how bright the sound is. node dev/audio-analyse.mjs <file under public/audio> ...
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
await page.goto('http://localhost:5183/?level=sandbox');
for (const file of process.argv.slice(2)) {
  const info = await page.evaluate(async (file) => {
    const data = await (await fetch(`/audio/${file}`)).arrayBuffer();
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const buffer = await ctx.decodeAudioData(data);
    const samples = buffer.getChannelData(0);
    const rate = buffer.sampleRate;
    const long = buffer.duration > 8;
    const window = Math.floor(rate * (long ? 1 : 0.05));
    const rms = [];
    for (let i = 0; i + window <= samples.length; i += window) {
      let sum = 0;
      for (let j = i; j < i + window; j++) sum += samples[j] * samples[j];
      rms.push(Math.sqrt(sum / window));
    }
    // Over two seconds from the middle: the strongest low note, and the share of the
    // sound's energy that sits below 150 Hz and above 1 kHz.
    const from = Math.floor(samples.length / 2);
    const n = Math.min(samples.length - from, rate * 2);
    const power = (hz) => {
      let re = 0, im = 0;
      const w = (2 * Math.PI * hz) / rate;
      for (let i = 0; i < n; i++) { re += samples[from + i] * Math.cos(w * i); im += samples[from + i] * Math.sin(w * i); }
      return (re * re + im * im) / n;
    };
    let best = 0, bestHz = 0, low = 0, high = 0, all = 0;
    for (let hz = 16; hz <= 150; hz += 1) { const p = power(hz); low += p; if (p > best) { best = p; bestHz = hz; } }
    for (let hz = 150; hz <= 1000; hz += 10) all += power(hz) * 10;
    for (let hz = 1000; hz <= 8000; hz += 50) high += power(hz) * 50;
    all += low + high;
    return { duration: buffer.duration, step: window / rate, rms, bestHz, low: low / all, high: high / all };
  }, file);
  console.log(`${file}: ${info.duration.toFixed(1)} s; strongest low note ${info.bestHz} Hz; below 150 Hz ${(info.low * 100).toFixed(0)}%, above 1 kHz ${(info.high * 100).toFixed(0)}%`);
  console.log(`  rms per ${info.step} s: ${info.rms.slice(0, 60).map((r) => r.toFixed(2).slice(1)).join(' ')}`);
}
await browser.close();
