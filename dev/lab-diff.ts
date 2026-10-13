// Where the proving ground's ground differs from a saved sampling of it: npx tsx dev/lab-diff.ts save | compare
import { readFileSync, writeFileSync } from 'node:fs';
import { quarryLab } from '../src/levels/quarryLab';
import { heightAt } from '../src/levels/terrain';
const level = quarryLab();
const heights: number[] = [];
for (let x = -24; x <= 344; x += 2) for (let z = -24; z <= 328; z += 2) heights.push(Math.round(heightAt(level.terrain!, x, z) * 1000) / 1000);
const file = `${process.env.TEMP}/lab-ground.json`;
if (process.argv[2] === 'save') writeFileSync(file, JSON.stringify(heights));
else {
  const was: number[] = JSON.parse(readFileSync(file, 'utf8'));
  let n = 0, k = 0;
  for (let x = -24; x <= 344; x += 2) for (let z = -24; z <= 328; z += 2, k++) if (Math.abs(was[k] - heights[k]) > 0.01 && n++ < 15) console.log(x, z, was[k], '->', heights[k]);
  console.log(n, 'differ');
}
process.exit(0);
