// Why a drum does not roll straight: one drum, let go rolling down a 22% slope, on a single flat box, on two big triangles,
// and on the avenue of the proving ground; sharp-edged or rounded; with the game's settings or with none. npx tsx dev/cylinder-roll.ts
import RAPIER from '@dimforge/rapier3d-compat';
import { buildSlopes } from '../src/levels/slopes';
import { terrainMesh } from '../src/levels/terrain';

await RAPIER.init();
const GRADE = 0.22;
const lean = Math.atan(GRADE);
type Ground = 'box' | 'two triangles' | 'avenue';
const avenue = terrainMesh(buildSlopes().terrain);
function trial(ground: Ground, rounded: boolean, settings: boolean, dt = 1 / 60): string {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = dt;
  let top = 0;
  if (ground === 'box') {
    // A slab 40 wide and 400 long, tilted so that it falls toward -Z.
    const q = new RAPIER.Quaternion(Math.sin(lean / 2), 0, 0, Math.cos(lean / 2));
    world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.5, 200).setRotation(q).setTranslation(0, -0.5, 0).setFriction(0.9));
    top = 0;
  } else if (ground === 'two triangles') {
    const h = (z: number) => z * GRADE;
    const v = new Float32Array([-20, h(-200), -200, 20, h(-200), -200, 20, h(200), 200, -20, h(200), 200]);
    world.createCollider(RAPIER.ColliderDesc.trimesh(v, new Uint32Array([0, 2, 1, 0, 3, 2])).setFriction(0.9));
  } else {
    world.createCollider(RAPIER.ColliderDesc.trimesh(avenue.positions, avenue.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(0.9));
  }
  // A drum, r 0.4 and 1.1 long, lying across the slope, set rolling at 4 m/s.
  const [x0, z0] = ground === 'avenue' ? [-2, 320] : [0, 150];
  const y0 = ground === 'avenue' ? 44 + (z0 - 290) * GRADE : z0 * GRADE;
  const lying = new RAPIER.Quaternion(0, 0, -Math.SQRT1_2, Math.SQRT1_2);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x0, y0 + 0.45 + top, z0).setRotation(lying).setLinvel(0, 0, -4).setAngvel({ x: -10, y: 0, z: 0 }).setCanSleep(false)
    .setLinearDamping(settings ? 0.25 : 0).setAngularDamping(settings ? 1.8 : 0));
  world.createCollider((rounded ? RAPIER.ColliderDesc.roundCylinder(0.49, 0.34, 0.06) : RAPIER.ColliderDesc.cylinder(0.55, 0.4)).setMass(40).setFriction(0.7).setRestitution(0.15), body);
  let worstYaw = 0, worstX = 0;
  const steps = Math.round(14 / dt);
  for (let i = 0; i < steps; i++) {
    world.step();
    const r = body.rotation();
    // Which way its axis lies, across the ground: square across the slope is along X.
    const ax = 2 * (r.x * r.y - r.w * r.z), az = 2 * (r.y * r.z + r.w * r.x);
    worstYaw = Math.max(worstYaw, Math.abs(Math.atan2(az, Math.abs(ax))) * 57.3);
    worstX = Math.max(worstX, Math.abs(body.translation().x - x0));
    if (ground === 'avenue' && body.translation().z < 70) break;
  }
  const p = body.translation();
  return `${ground.padEnd(13)} ${(rounded ? 'rounded' : 'sharp').padEnd(7)} ${settings ? "game's damping" : 'no damping   '} step 1/${Math.round(1 / dt)}: went ${(z0 - p.z).toFixed(0)} m down, ${worstX.toFixed(2)} m sideways at most, axis turned ${worstYaw.toFixed(1)} deg at most, ending at ${Math.hypot(body.linvel().x, body.linvel().z).toFixed(1)} m/s`;
}
for (const ground of ['box', 'two triangles', 'avenue'] as Ground[]) for (const rounded of [false, true]) for (const settings of [true, false]) console.log(trial(ground, rounded, settings));
console.log(trial('box', false, false, 1 / 240));
console.log(trial('avenue', false, false, 1 / 240));
process.exit(0);
