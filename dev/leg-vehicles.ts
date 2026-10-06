// Level 2's last leg: what vehicles and objects stand on it. npx tsx dev/leg-vehicles.ts
import { uptown } from '../src/levels/uptown';
const level = uptown();
for (const lane of level.traffic ?? []) {
  const [x, z] = lane.from;
  if (x > -350 && x < -334 && z > 960 && z < 1035) console.log('lane', lane.kinds, lane.from, lane.to, lane.speed);
}
for (const o of level.objects ?? []) if (o.pos[0] > -347 && o.pos[0] < -338 && o.pos[2] > 965 && o.pos[2] < 1032) console.log(o.kind, o.pos.map((v) => v.toFixed(1)).join(', '));
process.exit(0);
