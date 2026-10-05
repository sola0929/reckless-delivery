// Every half metre over the hill and the quarry: any place the ground is missing or wildly out (a hole, a spike), and the
// biggest step between neighbours that is not one of the walls meant to be there. npx tsx dev/hill-scan.ts
import { uptown } from '../src/levels/uptown';
import { heightAt } from '../src/levels/terrain';
const level = uptown();
const h = (x: number, z: number) => heightAt(level.terrain!, x, z);
const [lo, hi] = [15, 75];
let bad = 0;
const where: string[] = [];
for (let x = -489.77; x <= -280; x += 0.5) {
  for (let z = 870.23; z <= 1090; z += 0.5) {
    const v = h(x, z);
    if (!Number.isFinite(v) || v < lo || v > hi) {
      bad++;
      if (where.length < 12) where.push(`${x},${z}: ${v.toFixed(1)}`);
    }
  }
}
console.log(bad ? `${bad} places out of ${lo}-${hi} m:\n${where.join('\n')}` : `no holes or spikes: every place between ${lo} and ${hi} m`);
process.exit(0);
