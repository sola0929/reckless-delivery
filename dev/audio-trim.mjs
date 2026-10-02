// Cut a stretch out of a recording and save it as a mono WAV, resampled and brought up to a
// set loudness. There is no ffmpeg on this machine, so the browser does the decoding.
// node dev/audio-trim.mjs <source under public/audio> <output under public/audio> <from s> <seconds> <rate Hz> <peak 0-1>
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
const [source, output, from, seconds, rate, peak] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
await page.goto('http://localhost:5183/?level=sandbox');
const base64 = await page.evaluate(async ([source, from, seconds, rate, peak]) => {
  const data = await (await fetch(`/audio/${source}`)).arrayBuffer();
  const decoded = await new OfflineAudioContext(1, 44100, 44100).decodeAudioData(data);
  const length = Math.floor(seconds * rate);
  const ctx = new OfflineAudioContext(1, length, rate);
  const node = ctx.createBufferSource();
  node.buffer = decoded;
  node.connect(ctx.destination);
  node.start(0, from);
  const samples = (await ctx.startRendering()).getChannelData(0);
  let top = 0;
  for (const s of samples) top = Math.max(top, Math.abs(s));
  const gain = top > 0 ? peak / top : 1;
  // 16-bit PCM WAV.
  const bytes = new DataView(new ArrayBuffer(44 + length * 2));
  const text = (at, s) => { for (let i = 0; i < s.length; i++) bytes.setUint8(at + i, s.charCodeAt(i)); };
  text(0, 'RIFF'); bytes.setUint32(4, 36 + length * 2, true); text(8, 'WAVEfmt ');
  bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 1, true);
  bytes.setUint32(24, rate, true); bytes.setUint32(28, rate * 2, true); bytes.setUint16(32, 2, true); bytes.setUint16(34, 16, true);
  text(36, 'data'); bytes.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i++) bytes.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i] * gain)) * 32767, true);
  let binary = '';
  const u8 = new Uint8Array(bytes.buffer);
  for (let i = 0; i < u8.length; i += 0x8000) binary += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(binary);
}, [source, Number(from), Number(seconds), Number(rate), Number(peak)]);
writeFileSync(`public/audio/${output}`, Buffer.from(base64, 'base64'));
console.log(`${output}: ${seconds} s at ${rate} Hz, ${Math.round(base64.length * 0.75 / 1024)} KB`);
await browser.close();
