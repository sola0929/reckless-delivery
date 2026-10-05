// After the coil avenue, on the descent: with one group of bodies switched off, how slow is the physics? npx tsx dev/after-which.ts <group>
import RAPIER from '@dimforge/rapier3d-compat';
import { uptown } from '../src/levels/uptown';
import { Sim } from '../src/sim/sim';
const which = process.argv[2] ?? 'none';
const level = uptown();
const sim = await Sim.create(level);
const world = (sim as unknown as { world: RAPIER.World }).world;
const at = (k: number) => { const s = level.checkpoints![k]; sim.teleport(s.pos[0], s.pos[1], s.yaw); };
world.profilerEnabled = true;
const time = (n = 600) => { let eng = 0, ph = 0, bp = 0, np = 0, so = 0, ccd = 0, isl = 0; for (let i = 0; i < n; i++) { const t0 = performance.now(); sim.step({ throttle: 0, steer: 0, handbrake: true }); eng += performance.now() - t0; ph += world.timingStep(); bp += world.timingBroadPhase(); np += world.timingNarrowPhase(); so += world.timingSolver(); ccd += world.timingCcd(); isl += world.timingIslandConstruction(); } const f = (v: number) => (v / n).toFixed(2); return `${f(eng)} [rapier ${f(ph)}: broad ${f(bp)} narrow ${f(np)} solver ${f(so)} ccd ${f(ccd)} islands ${f(isl)}]`; };
if (which === 'waited' || which === 'waitedStart') {
  at(which === 'waited' ? 8 : 0);
  for (let i = 0; i < 60 * 20; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
} else if (which !== 'fresh') {
  at(7);
  for (let i = 0; i < 60 * 20; i++) sim.step({ throttle: 0.6, steer: Math.sin(i / 50) * 0.4, handbrake: false });
}
at(8);
const S = sim as any;
const cars = new Set(S.traffic.cars.map((c: any) => c.body.handle));
const riders = new Set(S.riders.list.map((r: any) => r.body.handle));
const cargoH = new Set<number>(((sim as any).cargoSystem.items as any[]).map((i) => i.body.handle)); cargoH.add((sim as any).truck.body.handle);
const debrisH = new Set<number>(((sim as any).cargoSystem.debris as any[]).map((d) => d.body.handle));
console.log(`debris ${debrisH.size}; wrecked items ${((sim as any).cargoSystem.items as any[]).filter((i) => !i.body).length}`);
const objectBodies = new Map(sim.objects.objects.map((o) => [o.body.handle, o]));
let off = 0;
world.forEachRigidBody((b) => {
  if (!b.isEnabled() || b.isFixed()) return;
  const o = objectBodies.get(b.handle);
  const moved = o && Math.hypot(b.translation().x - o.desc.pos[0], b.translation().z - o.desc.pos[2]) > 1;
  const hit = which === 'coils' ? o?.desc.kind === 'steelCoil'
    : which === 'knocked' ? moved && o!.desc.kind !== 'steelCoil' && !o!.desc.kind.startsWith('chicken')
    : which === 'both' ? o?.desc.kind === 'steelCoil' || (moved && !o!.desc.kind.startsWith('chicken'))
    : which === 'bothAwake' ? !b.isSleeping() && (o?.desc.kind === 'steelCoil' || (moved && !o!.desc.kind.startsWith('chicken')))
    : which === 'farAsleep' ? o !== undefined && b.isSleeping() && (o.knocked || o.desc.kind === 'steelCoil') && Math.hypot(b.translation().x - (sim as any).truck.body.translation().x, b.translation().z - (sim as any).truck.body.translation().z) > 150
    : which === 'knockedFlag' ? o !== undefined && (o.knocked || o.desc.kind === 'steelCoil')
    : which === 'far100' ? o !== undefined && (o.knocked || o.desc.kind === 'steelCoil') && Math.hypot(b.translation().x - (sim as any).truck.body.translation().x, b.translation().z - (sim as any).truck.body.translation().z) > 100
    : which === 'near100' ? o !== undefined && (o.knocked || o.desc.kind === 'steelCoil') && Math.hypot(b.translation().x - (sim as any).truck.body.translation().x, b.translation().z - (sim as any).truck.body.translation().z) <= 100
    : which === 'cars' ? cars.has(b.handle)
    : which === 'carsDyn' ? cars.has(b.handle) && b.isDynamic()
    : which === 'riders' ? riders.has(b.handle)
    : which === 'rest' ? !o && !cars.has(b.handle) && !riders.has(b.handle) && !b.isSleeping()
    : which === 'restNoTruck' ? !o && !cars.has(b.handle) && !riders.has(b.handle) && !cargoH.has(b.handle)
    : which === 'debris' ? debrisH.has(b.handle)
    : which === 'unknown' ? !o
    : which === 'awakeUnknown' ? !o && !b.isSleeping()
    : false;
  if (hit) { b.setEnabled(false); off++; }
});
if (which === 'restore' || which === 'restoreRefile' || which === 'refile') {
 if (which !== 'refile') {
  const tp = (sim as any).truck.body.translation();
  let near = 1e9, n = 0;
  for (const o of sim.objects.objects) {
    if (!o.body.isEnabled()) continue;
    const p = o.body.translation();
    if (o.desc.kind === 'steelCoil') { near = Math.min(near, Math.hypot(p.x - tp.x, p.z - tp.z)); sim.objects.stow(o); n++; continue; }
    if (o.desc.kind.startsWith('chicken') || Math.hypot(p.x - o.desc.pos[0], p.z - o.desc.pos[2]) <= 1) continue;
    near = Math.min(near, Math.hypot(p.x - tp.x, p.z - tp.z));
    const [x, y, z] = o.desc.pos; o.body.setTranslation({ x, y, z }, false); o.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, false);
    o.body.setLinvel({ x: 0, y: 0, z: 0 }, false); o.body.setAngvel({ x: 0, y: 0, z: 0 }, false); o.body.sleep(); n++;
  }
  console.log(`restored ${n}, nearest was ${near.toFixed(0)} m from the truck`);
 }
 if (which !== 'restore') (sim as any).refile();
}
{
  const tp = (sim as any).truck.body.translation();
  const items = (sim as any).cargoSystem.items as { body: RAPIER.RigidBody }[];
  const off = items.filter((i) => i.body.isEnabled() && Math.hypot(i.body.translation().x - tp.x, i.body.translation().z - tp.z) > 8);
  let ev = 0; for (let i = 0; i < 60; i++) { sim.step({ throttle: 0, steer: 0, handbrake: true }); }
  const q = (sim as any).eventQueue as RAPIER.EventQueue; const w = (sim as any).world as RAPIER.World; w.step(q); q.drainContactForceEvents(() => ev++);
  console.log(`cargo ${items.length}, off the truck ${off.length} (asleep ${off.filter((i) => i.body.isSleeping()).length}), force events a step ${ev}`);
  if (which === 'cargo') for (const i of off) i.body.setEnabled(false);
}
let dyn = 0, dynAwake = 0; for (const c of S.traffic.cars) if (c.body.isEnabled() && c.body.isDynamic()) { dyn++; if (!c.body.isSleeping()) dynAwake++; }
console.log(`cars ${cars.size}, dynamic ${dyn}, awake dynamic ${dynAwake}`);
const S2 = sim.objects.objects.filter((o) => o.body.isEnabled() && !o.body.isSleeping() && (o.desc.kind === 'steelCoil' || Math.hypot(o.body.translation().x - o.desc.pos[0], o.body.translation().z - o.desc.pos[2]) > 1) && !o.desc.kind.startsWith('chicken'));
console.log(`awake knocked/coils: ${S2.length}, mean speed ${(S2.reduce((a, o) => { const v = o.body.linvel(); return a + Math.hypot(v.x, v.y, v.z); }, 0) / (S2.length || 1)).toFixed(2)}`);
if (which === 'restNoTruck') { const tp = (sim as any).truck.body.translation(); const desc: string[] = []; world.forEachRigidBody((b) => { if (b.isEnabled()) return; const p = b.translation(); if (!objectBodies.has(b.handle) && !cars.has(b.handle) && !riders.has(b.handle)) desc.push(`${b.isKinematic() ? 'K' : b.isDynamic() ? 'D' : 'F'}${b.isSleeping() ? 'z' : ''}@${Math.hypot(p.x - tp.x, p.z - tp.z).toFixed(0)}`); }); console.log(desc.slice(0, 60).join(' ')); }
console.log(`${which.padEnd(13)} off ${String(off).padStart(4)}: ${time()} ms a step`);
process.exit(0);
