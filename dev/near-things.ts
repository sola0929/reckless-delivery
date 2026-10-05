// Loose things placed about a spot, and how heavy each is: npx tsx dev/near-things.ts x z [reach]
import { uptown } from '../src/levels/uptown';
import { OBJECT_KINDS } from '../src/levels/objects';
const level = uptown();
const [x, z, reach = 6] = process.argv.slice(2).map(Number);
for (const o of level.objects ?? []) if (Math.hypot(o.pos[0] - x, o.pos[2] - z) < reach) console.log(`${o.kind} (${OBJECT_KINDS[o.kind].mass} kg) at ${o.pos[0].toFixed(1)}, ${o.pos[2].toFixed(1)}`);
process.exit(0);
