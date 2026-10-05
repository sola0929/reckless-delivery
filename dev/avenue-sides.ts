// What is either side of the avenue's road, halfway up: where the houses begin, and the street furniture on the pavements.
// npx tsx dev/avenue-sides.ts
import { uptown } from '../src/levels/uptown';
const level = uptown();
const ax = (17.5 - 31) * 16;
const z = 16 * 60;
const near = level.props.filter((p) => p.building && Math.abs(p.pos[2] - z) < p.size[2] + 1 && Math.abs(p.pos[0] - ax) < 40);
for (const p of near) console.log(`house face at ${(p.pos[0] - ax > 0 ? p.pos[0] - p.size[0] - ax : p.pos[0] + p.size[0] - ax).toFixed(1)} m from the avenue's middle`);
const things = (level.objects ?? []).filter((o) => Math.abs(o.pos[2] - z) < 40 && Math.abs(o.pos[0] - ax) < 14);
console.log(things.map((o) => `${o.kind}@${(o.pos[0] - ax).toFixed(1)}`).join(' '));
const r = level.rollers![0];
console.log(`coils let go from ${(r.from[0] - ax).toFixed(1)} to ${(r.to[0] - ax).toFixed(1)}`);
process.exit(0);
