// Nothing the truck hits should be pushed along stuck to its nose: a few seconds on, every
// pole, post and barrier arm it has knocked must have been left behind. One that has come
// down on the cab roof or in the bed and is lying there is another matter, and is allowed.
// npx tsx dev/carry-test.ts
import { city } from '../src/levels/city';
import type { ObjectKindId } from '../src/levels/objects';
import { sandbox } from '../src/levels/sandbox';
import { Sim } from '../src/sim/sim';

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
/** The knocked things being pushed along by the truck: right by it, going at its speed, and not lying on top of it. */
const clinging = (sim: Sim): string[] => {
  const t = sim.truck.body.translation();
  const tv = sim.truck.body.linvel();
  return sim.objects.objects
    .filter((o) => {
      if (!o.knocked) return false;
      const p = o.body.translation();
      const v = o.body.linvel();
      const onTop = p.y > t.y + 0.25;
      return !onTop && Math.hypot(p.x - t.x, p.z - t.z) < 5.5 && Math.hypot(tv.x, tv.z) > 2 && Math.hypot(v.x - tv.x, v.z - tv.z) < 2;
    })
    .map((o) => o.desc.kind);
};

// The depot gate: an arm each side of a post, straight through the middle of it.
for (const throttle of [0.35, 0.6, 1]) {
  const sim = await Sim.create(city());
  for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: false });
  let steps = 0;
  while (sim.truck.body.translation().z < 150 && steps++ < 60 * 40) sim.step({ throttle, steer: 0, handbrake: false });
  const left = clinging(sim);
  check(`through the depot gate at throttle ${throttle}`, sim.truck.body.translation().z >= 150 && left.length === 0, left.length ? `still on the truck: ${left.join(', ')}` : `${(steps / 60).toFixed(0)} s`);
}

// One of each tall thin thing, hit square on and off centre, slowly and fast.
const base = sandbox();
const [sx, , sz] = base.spawn;
for (const kind of ['lamp', 'post', 'signWarn', 'bollard', 'gateArm', 'barrier', 'treeSmall'] as ObjectKindId[]) {
  const stuck: string[] = [];
  for (const speed of [5, 10, 18]) {
    for (const offset of [0, 0.9]) {
      const y = kind === 'gateArm' ? 1 : 0;
      const sim = await Sim.create({ ...base, props: [], traffic: [], objects: [{ kind, pos: [sx + offset, y, sz + 50], rotY: 0 }] });
      for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: false });
      for (let i = 0; i < 60 * 40 && sim.truck.body.translation().z < sz + 110; i++) {
        sim.step({ throttle: sim.truck.forwardSpeed() < speed ? 1 : 0, steer: 0, handbrake: false });
      }
      if (clinging(sim).length || sim.truck.body.translation().z < sz + 110) stuck.push(`${speed} m/s, ${offset} m off`);
    }
  }
  check(`a ${kind} is left behind`, stuck.length === 0, stuck.join('; '));
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
