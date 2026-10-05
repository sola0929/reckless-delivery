// After the coil avenue, at the top of the descent: what is still awake, what has CCD on, and does sleeping them mend it?
import RAPIER from '@dimforge/rapier3d-compat';
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const level = uptown();
const sim = await Sim.create(level);
const world = (sim as unknown as { world: RAPIER.World }).world;
world.profilerEnabled = true;
const at = (k: number) => { const s = level.checkpoints![k]; sim.teleport(s.pos[0], s.pos[1], s.yaw); };
const toi = (n = 120) => { let sum = 0, eng = 0; for (let i = 0; i < n; i++) { const t0 = performance.now(); sim.step({ throttle: 0, steer: 0, handbrake: true }); eng += performance.now() - t0; sum += world.timingCcdToiComputation(); } return `${(eng / n).toFixed(2)} ms (ccd ${(sum / n).toFixed(2)})`; };
const census = (label: string) => {
  const kindOf = new Map(sim.objects.objects.map((o) => [o.body.handle, o.desc.kind]));
  let awake = 0, ccd = 0; const kinds = new Map<string, number>();
  world.forEachRigidBody((b) => { if (!b.isEnabled() || b.isFixed()) return; if (!b.isSleeping()) { awake++; const k = (kindOf.get(b.handle) ?? '?') + (b.isCcdEnabled() ? '*' : ''); kinds.set(k, (kinds.get(k) ?? 0) + 1); } if (b.isCcdEnabled()) ccd++; });
  console.log(`${label}: awake ${awake}, ccd on ${ccd}; awake: ${[...kinds].map(([k, n]) => `${k}×${n}`).join(' ')}`);
};
at(8); census('fresh'); console.log(toi());
at(7);
for (let i = 0; i < 60 * 20; i++) sim.step({ throttle: 0.6, steer: Math.sin(i / 50) * 0.4, handbrake: false });
at(8); for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
census('after'); console.log(toi());
const coils = sim.objects.objects.filter((o) => o.desc.kind === "steelCoil" && o.body.isEnabled());
console.log(coils.slice(0, 8).map((o) => { const p = o.body.translation(), v = o.body.linvel(); return `${p.x.toFixed(0)},${p.y.toFixed(1)},${p.z.toFixed(0)} v${Math.hypot(v.x, v.y, v.z).toFixed(1)} roll${o.rolling ? 1 : 0} float${o.afloat ? 1 : 0} g${o.body.gravityScale()}`; }).join(" | "));
for (const o of coils) sim.objects.stow(o);
console.log(`coils stowed: ${toi()}`);
const kindOf = new Map(sim.objects.objects.map((o) => [o.body.handle, o.desc.kind]));
const lost: string[] = []; const gone: RAPIER.RigidBody[] = [];
world.forEachRigidBody((b) => { if (!b.isEnabled()) return; const p = b.translation(); if (p.y < -30 || Math.abs(p.x) > 3000 || Math.abs(p.z) > 3000) { lost.push(`${kindOf.get(b.handle) ?? '?'} ${p.x.toFixed(0)},${p.y.toFixed(0)},${p.z.toFixed(0)}`); gone.push(b); } });
console.log(`lost: ${lost.length} ${lost.slice(0, 12).join(' | ')}`);
for (const b of gone) b.setEnabled(false);
console.log(`lost ones disabled: ${toi()}`);
// Put back what was knocked, one kind at a time.
const moved = sim.objects.objects.filter((o) => o.body.isEnabled() && o.desc.kind !== 'steelCoil' && Math.hypot(o.body.translation().x - o.desc.pos[0], o.body.translation().z - o.desc.pos[2]) > 1);
const groupsOf = new Map<string, typeof moved>();
for (const o of moved) { const g = o.desc.kind.startsWith('scooter') ? 'scooter' : o.desc.kind.startsWith('chicken') ? 'chicken' : o.desc.kind; groupsOf.set(g, [...(groupsOf.get(g) ?? []), o]); }
for (const [g, list] of groupsOf) {
  for (const o of list) { const [x, y, z] = o.desc.pos; o.body.setTranslation({ x, y: y + 0.05, z }, false); o.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, false); o.body.setLinvel({ x: 0, y: 0, z: 0 }, false); o.body.setAngvel({ x: 0, y: 0, z: 0 }, false); }
  console.log(`${g}×${list.length} put back: ${toi(60)}`);
}
process.exit(0);
