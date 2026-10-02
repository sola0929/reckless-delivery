// Left alone for ten seconds, nothing in the city falls over or wakes up. npx tsx dev/settle-check.ts
import { city } from '../src/levels/city';
import { Sim } from '../src/sim/sim';
const sim = await Sim.create(city());
for (let i = 0; i < 600; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
const tilt = (o: { body: { rotation(): { x: number; z: number } } }) => { const r = o.body.rotation(); return 1 - 2 * (r.x * r.x + r.z * r.z); };
const tipped = sim.objects.objects.filter((o) => tilt(o) < 0.9);
const awake = sim.objects.objects.filter((o) => !o.body.isSleeping());
for (const o of tipped.slice(0, 6)) console.log('  tipped:', o.desc.kind, o.desc.pos.map((n) => n.toFixed(1)).join(', '));
console.log(`${tipped.length || awake.length ? 'FAIL' : 'PASS'}  ${sim.objects.objects.length} objects, ${tipped.length} tipped, ${awake.length} awake`);
