// The ground over level 1's market square on its hillside, every 8 m. npx tsx dev/plaza-heights.ts
import { cityHeights } from '../src/levels/hillcity';
const h = cityHeights();
for (let x = -192; x >= -256; x -= 8) console.log(x, [264, 272, 280, 288, 296, 304, 312, 320, 328].map((z) => h.at(x, z).toFixed(1)).join(' '));
