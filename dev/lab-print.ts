// A fingerprint of the proving ground's data, piece by piece, and its ground sampled every 2 m: to show a change to the
// code it is built from left it as it was. npx tsx dev/lab-print.ts
import { createHash } from 'node:crypto';
import { quarryLab } from '../src/levels/quarryLab';
import { heightAt } from '../src/levels/terrain';
const level = quarryLab();
const round = (v: unknown): unknown => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : Array.isArray(v) ? v.map(round) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, w]) => [k, round(w)])) : v);
const print = (v: unknown) => createHash('sha1').update(JSON.stringify(round(v))).digest('hex').slice(0, 12);
for (const key of ['props', 'objects', 'decals', 'rigs', 'droppers', 'fords', 'traffic', 'crowds'] as const) console.log(key, (level[key] as unknown[] | undefined)?.length, print(level[key]));
const heights: number[] = [];
for (let x = -24; x <= 344; x += 2) for (let z = -24; z <= 328; z += 2) heights.push(heightAt(level.terrain!, x, z));
console.log('ground', print(heights));
process.exit(0);
