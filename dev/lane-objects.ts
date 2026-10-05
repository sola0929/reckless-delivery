// What stands in level 2's market lane, near a point. npx tsx dev/lane-objects.ts x z
import { uptown } from '../src/levels/uptown';
const [x, z] = process.argv.slice(2).map(Number);
const level = uptown();
for (const o of level.objects ?? []) if (Math.hypot(o.pos[0] - x, o.pos[2] - z) < 5) console.log(o.kind, o.pos.map((v) => v.toFixed(1)).join(', '));
process.exit(0);
