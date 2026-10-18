// Level 3's ponds: the islands (as drawn, and their water), the still water patches, and the ground round the dike.
import { LEVELS } from '../src/levels';
import { heightAt } from '../src/levels/terrain';
const level = LEVELS.quarry();
for (const p of level.props.filter((p) => p.shape === 'cylinder' && (p.color === 0x6f8a4a || p.color === 0x7a6a50))) console.log('island disc', p.pos.map((v) => +v.toFixed(1)).join(','), 'r', p.size[0]);
console.log('still', JSON.stringify((level as any).stillWater));
for (const [x, z] of [[80, 560], [86, 560], [100, 560], [104, 560], [120, 558], [128, 558], [136, 640]]) console.log('ground', x, z, heightAt(level.terrain, x, z).toFixed(2));
