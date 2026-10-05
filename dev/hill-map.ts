// A rough picture of the hill's heights, 2 m to a character: '#' where the ground is out of reason. npx tsx dev/hill-map.ts
import { uptown } from '../src/levels/uptown';
import { heightAt } from '../src/levels/terrain';
const level = uptown();
for (let z = 1080.3; z >= 930; z -= 4) {
  let row = '';
  for (let x = -280.3; x >= -360; x -= 2) {
    const v = heightAt(level.terrain!, x, z);
    row += !Number.isFinite(v) || v < 15 || v > 75 ? '#' : String.fromCharCode(97 + Math.max(0, Math.min(25, Math.round((v - 20) / 2))));
  }
  console.log(`${z.toFixed(0)} ${row}`);
}
process.exit(0);
