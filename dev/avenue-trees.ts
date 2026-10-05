// Street trees left beside the coil avenue: there should be none. npx tsx dev/avenue-trees.ts
import { uptown } from '../src/levels/uptown';
const level = uptown();
const ax = (17.5 - 31) * 16;
const left = (level.objects ?? []).filter((o) => o.kind.startsWith('tree') && Math.abs(o.pos[0] - ax) < 14 && o.pos[2] > 16 * 51 + 8);
console.log(`${left.length} street trees beside the avenue`);
process.exit(0);
