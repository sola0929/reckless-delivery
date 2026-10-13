// Each machine on level 3's proving ground: where its moving part is against where its round says it should be, every second.
// npx tsx dev/rig-trace.ts
import { Quaternion, Vector3 } from 'three';
import { quarryLab } from '../src/levels/quarryLab';
import { Sim } from '../src/sim/sim';
const level = quarryLab();
const sim = await Sim.create(level);
sim.teleport(300, 140, 0);
const facing = (rig: (typeof sim.rigs.list)[number], part: number) => {
  const r = rig.parts[part].body.rotation();
  const v = new Vector3(0, 0, 1).applyQuaternion(new Quaternion(r.x, r.y, r.z, r.w));
  return Math.atan2(v.x, v.z) - rig.desc.yaw;
};
for (let s = 0; s < 14; s++) {
  for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
  const row = sim.rigs.list.slice(0, 5).map((rig) => {
    const last = rig.parts[rig.parts.length - 1].body.translation();
    if (rig.desc.kind === 'slew') return `slew ${(((facing(rig, 1) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI).toFixed(2)}`;
    if (rig.desc.kind === 'pile') return `pile y ${(last.y - rig.desc.pos[1]).toFixed(2)}`;
    if (rig.desc.kind === 'clamshell') return `crane ${(((facing(rig, 1) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI).toFixed(2)} grab ${(last.y - rig.desc.pos[1]).toFixed(2)}`;
    if (rig.desc.kind === 'ball') return `ball x ${(last.x - rig.desc.pos[0]).toFixed(1)}`;
    return `boom x ${(last.x - rig.desc.pos[0]).toFixed(1)}`;
  });
  console.log(`${s + 1}s  ${row.join(' | ')}`);
}
process.exit(0);
