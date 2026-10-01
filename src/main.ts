import { Vector3 } from 'three';
import { PHYSICS } from './config';
import { Hud } from './hud';
import { Input } from './input';
import { ChaseCamera } from './render/camera';
import { Smoke } from './render/effects';
import { BodySync, TruckMesh, cargoMesh, propMesh } from './render/meshes';
import { aimSun, createView } from './render/scene';
import { Sim } from './sim/sim';
import type { DriveInput } from './sim/truck';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const sim = await Sim.create();
const view = createView(canvas);
const input = new Input(canvas);
const hud = new Hud();
const chase = new ChaseCamera(view.camera);

const syncs: BodySync[] = [];

for (const prop of sim.props) {
  const mesh = propMesh(prop.desc);
  view.scene.add(mesh);
  if (prop.desc.mass !== undefined) syncs.push(new BodySync(prop.body, mesh));
}
for (const item of sim.cargo) {
  const mesh = cargoMesh(item.desc);
  view.scene.add(mesh);
  syncs.push(new BodySync(item.body, mesh));
}
const truckMesh = new TruckMesh();
view.scene.add(truckMesh.root);
const truckSync = new BodySync(sim.truck.body, truckMesh.root);
syncs.push(truckSync);

const smoke = new Smoke();
view.scene.add(smoke.mesh);

truckSync.apply(1);
chase.snap(truckMesh.root);

if (import.meta.env.DEV) Object.assign(window, { game: { sim } });

let last = performance.now();
let accumulator = 0;

const SMOKE_INTERVAL = 0.03;
const NO_DRIFT = new Vector3();
const contact = new Vector3();
let smokeTimer = 0;

/** Tyre smoke: rear wheels spinning under boost, any wheel under hard braking or the handbrake. */
function emitSmoke(dt: number, drive: DriveInput, speed: number): void {
  smokeTimer += dt;
  if (smokeTimer < SMOKE_INTERVAL) return;
  smokeTimer = 0;
  const { truck } = sim;
  const moving = Math.abs(speed) > 4;
  const spinning = truck.boosting && speed < 16;
  const locked = truck.brakeLevel > 0.7 && moving;
  const sliding = drive.handbrake && moving;
  for (let i = 0; i < 4; i++) {
    const rear = i >= 2;
    if (!locked && !(rear && (spinning || sliding))) continue;
    if (truck.controller.wheelIsInContact(i)) smoke.emit(truckMesh.wheelContact(i, contact), NO_DRIFT);
  }
}

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  accumulator += dt;

  if (input.takeReset()) {
    sim.reset();
    for (const s of syncs) s.snap();
    truckSync.apply(1);
    chase.snap(truckMesh.root);
    smoke.clear();
    accumulator = 0;
  }

  const drive = input.drive();
  let steps = 0;
  while (accumulator >= PHYSICS.dt && steps < PHYSICS.maxStepsPerFrame) {
    sim.step(drive);
    for (const s of syncs) s.capture();
    accumulator -= PHYSICS.dt;
    steps++;
  }
  // Drop the backlog rather than spiral if the frame rate can't keep up.
  if (accumulator >= PHYSICS.dt) accumulator = 0;

  const alpha = accumulator / PHYSICS.dt;
  for (const s of syncs) s.apply(alpha);
  truckMesh.updateWheels(sim.truck);

  const speed = sim.truck.forwardSpeed();
  chase.addZoom(input.takeWheel());
  chase.update(dt, truckMesh.root, speed, sim.truck.boosting);
  emitSmoke(dt, drive, speed);
  smoke.update(dt);
  aimSun(view, truckMesh.root.position);
  hud.update(speed, sim.cargoOnTruck(), sim.cargo.length);

  view.renderer.render(view.scene, view.camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
