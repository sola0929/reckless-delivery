// Ground made of pieces has joins. Does anything sliding or rolling over a join catch on it?
// Boxes are slid across a join between two pieces at the same height, and across the same
// length of a single piece, and what happens to each is compared. npx tsx dev/seam-check.ts
import RAPIER from '@dimforge/rapier3d-compat';
import { steps } from '../src/levels/steps';
import { Sim } from '../src/sim/sim';

const sim = await Sim.create(steps());
const world = (sim as unknown as { world: RAPIER.World }).world;
for (let i = 0; i < 30; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });

// In the sample, the terrace east of the street (x 8 to 26) and the low ground beyond it (x 26 on)
// are two pieces at the same height south of z 40: the join is at x 26. Inside the low ground there is none.
const runs: { name: string; x: number; z: number; round: boolean; body?: RAPIER.RigidBody; jump: number; slowest: number }[] = [];
let lane = 0;
for (const round of [false, true]) {
  for (const [name, x] of [['over the join', 24.6], ['on one piece', 40]] as const) {
    for (const speed of [5, 14]) {
      const z = -18 + lane++ * 4;
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 0.31, z).setLinvel(speed, 0, 0).setCanSleep(false));
      const shape = round ? RAPIER.ColliderDesc.roundCuboid(0.42, 0.22, 0.42, 0.08) : RAPIER.ColliderDesc.cuboid(0.5, 0.3, 0.5);
      world.createCollider(shape.setMass(120).setFriction(0.05), body);
      runs.push({ name: `${round ? 'rounded' : 'sharp'} box at ${speed} m/s, ${name}`, x, z, round, body, jump: 0, slowest: 0 });
    }
  }
}
// Follow each for as long as it takes the slower ones to cover twenty metres.
const start = runs.map((r) => r.body!.linvel().x);
const lost: number[] = runs.map(() => 0);
for (let i = 0; i < 60 * 2; i++) {
  const before = runs.map((r) => r.body!.linvel().x);
  sim.step({ throttle: 0, steer: 0, handbrake: true });
  runs.forEach((r, n) => {
    const v = r.body!.linvel();
    r.jump = Math.max(r.jump, Math.abs(v.y));
    // The most speed lost in a single step: friction takes a little each step, a snag takes a lot at once.
    lost[n] = Math.max(lost[n], before[n] - v.x);
  });
}
runs.forEach((r, n) => {
  const p = r.body!.translation();
  console.log(`${r.name.padEnd(46)} went ${(p.x - r.x).toFixed(1)} m, most lost in one step ${lost[n].toFixed(2)} m/s, most upward speed ${r.jump.toFixed(2)} m/s, started at ${start[n].toFixed(0)}`);
});

// And the truck itself: over the joins of the street, where level meets ramp, at speed.
const drive = await Sim.create(steps());
let worst = 0, was = 0;
for (let i = 0; i < 60 * 9 && drive.truck.body.translation().z < 98; i++) {
  drive.step({ throttle: i < 30 ? 0 : 1, steer: 0, handbrake: false });
  const v = drive.truck.forwardSpeed();
  if (i > 120) worst = Math.max(worst, was - v);
  was = v;
}
const at = drive.truck.body.translation();
console.log(`the truck, flat out up both ramps: reached z ${at.z.toFixed(0)}, most speed lost in one step ${worst.toFixed(2)} m/s, load ${Math.round((drive.cargoValue() / drive.fullValue) * 100)}%`);
process.exit(0);
