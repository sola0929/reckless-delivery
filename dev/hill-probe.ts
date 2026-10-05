// Heights of the ground in a small patch: to look into a spot. npx tsx dev/hill-probe.ts x z
import { uptown } from '../src/levels/uptown';
import { heightAt } from '../src/levels/terrain';
const level = uptown();
const [x0, z0] = process.argv.slice(2).map(Number);
for (let dz = 4; dz >= -4; dz -= 1) {
  const row: string[] = [];
  for (let dx = -4; dx <= 4; dx += 1) row.push(heightAt(level.terrain!, x0 + dx, z0 + dz).toFixed(1).padStart(7));
  console.log(`${(z0 + dz).toFixed(0)} ${row.join('')}`);
}
process.exit(0);
