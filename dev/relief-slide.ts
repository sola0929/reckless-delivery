// One box slid along the showcase's level road: where, exactly, does it lose speed or leave the ground? npx tsx dev/relief-slide.ts [x] [round]
import RAPIER from '@dimforge/rapier3d-compat';
import { reliefShow } from '../src/levels/reliefShow';
import { heightAt } from '../src/levels/terrain';
import { Sim } from '../src/sim/sim';

const x = Number(process.argv[2] ?? 1.5);
const round = process.argv[3] === 'round';
const level = reliefShow();
const sim = await Sim.create(level);
const world = (sim as unknown as { world: RAPIER.World }).world;
const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, heightAt(level.terrain, x, 440) + 0.3, 440).setLinvel(0, 0, 14).setCanSleep(false));
world.createCollider((round ? RAPIER.ColliderDesc.roundCuboid(0.42, 0.22, 0.42, 0.08) : RAPIER.ColliderDesc.cuboid(0.5, 0.3, 0.5)).setMass(120).setFriction(0.05), body);
let was = 14;
for (let i = 0; i < 120; i++) {
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  const v = body.linvel();
  const p = body.translation();
  if (was - v.z > 0.3 || Math.abs(v.y) > 0.4) console.log(`step ${i}: z ${p.z.toFixed(2)} y ${p.y.toFixed(3)}  speed ${was.toFixed(2)} -> ${v.z.toFixed(2)}  upward ${v.y.toFixed(2)}`);
  was = v.z;
}
const end = body.translation();
console.log(`ended at z ${end.z.toFixed(1)}, y ${end.y.toFixed(2)} (ground ${heightAt(level.terrain, end.x, end.z).toFixed(2)})`);
process.exit(0);
