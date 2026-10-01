import { Vector3 } from 'three';
import { PHYSICS } from './config';
import { Hud, money } from './hud';
import { Input } from './input';
import { ChaseCamera } from './render/camera';
import { CargoViews } from './render/cargoView';
import { Bursts, Smoke } from './render/effects';
import { BodySync, TruckMesh, propMesh } from './render/meshes';
import { aimSun, createView } from './render/scene';
import type { CargoEvent, CargoItem } from './sim/cargo';
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
const truckMesh = new TruckMesh();
view.scene.add(truckMesh.root);
const truckSync = new BodySync(sim.truck.body, truckMesh.root);
syncs.push(truckSync);

const smoke = new Smoke();
const bursts = new Bursts();
view.scene.add(smoke.mesh, bursts.mesh);

const cargoViews = new CargoViews(view.scene, bursts);
cargoViews.rebuild(sim);

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

// Money lost per item since its last popup, so a flurry of small hits shows as one number.
const POPUP_INTERVAL = 0.4;
const pendingLoss = new Map<CargoItem, { loss: number; wait: number; label: string }>();
const screen = new Vector3();

function noteLoss(event: CargoEvent): void {
  if (event.kind !== 'damage' && event.kind !== 'lost' && event.kind !== 'destroyed') return;
  const entry = pendingLoss.get(event.item) ?? { loss: 0, wait: 0, label: '' };
  if (event.kind === 'lost') entry.label = '遺失';
  else if (event.kind === 'destroyed') entry.label = '全毀';
  if (event.kind !== 'destroyed') entry.loss += event.loss;
  pendingLoss.set(event.item, entry);
}

function showPopups(dt: number): void {
  for (const [item, entry] of pendingLoss) {
    entry.wait -= dt;
    if (entry.wait > 0 || (entry.loss < 1 && !entry.label)) continue;
    screen.copy(item.lastPos);
    screen.y += 0.7;
    screen.project(view.camera);
    if (screen.z < 1) {
      // Nudged sideways at random so popups from neighbouring items don't stack exactly.
      const x = (screen.x * 0.5 + 0.5) * window.innerWidth + (Math.random() - 0.5) * 50;
      const y = (-screen.y * 0.5 + 0.5) * window.innerHeight;
      const amount = entry.loss >= 1 ? `-${money(entry.loss)}` : '';
      hud.popup([entry.label, amount].filter(Boolean).join(' '), x, y, entry.label !== '');
    }
    entry.loss = 0;
    entry.label = '';
    entry.wait = POPUP_INTERVAL;
  }
}

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  accumulator += dt;

  if (input.takeReset()) {
    sim.reset();
    for (const s of syncs) s.snap();
    cargoViews.rebuild(sim);
    truckSync.apply(1);
    chase.snap(truckMesh.root);
    smoke.clear();
    bursts.clear();
    pendingLoss.clear();
    hud.clearPopups();
    accumulator = 0;
  }

  const drive = input.drive();
  let steps = 0;
  while (accumulator >= PHYSICS.dt && steps < PHYSICS.maxStepsPerFrame) {
    sim.step(drive);
    for (const event of sim.drainEvents()) {
      cargoViews.handle(event);
      noteLoss(event);
    }
    for (const s of syncs) s.capture();
    cargoViews.capture();
    accumulator -= PHYSICS.dt;
    steps++;
  }
  // Drop the backlog rather than spiral if the frame rate can't keep up.
  if (accumulator >= PHYSICS.dt) accumulator = 0;

  const alpha = accumulator / PHYSICS.dt;
  for (const s of syncs) s.apply(alpha);
  cargoViews.apply(alpha);
  cargoViews.update(dt);
  truckMesh.updateWheels(sim.truck);

  const speed = sim.truck.forwardSpeed();
  chase.addZoom(input.takeWheel());
  chase.update(dt, truckMesh.root, speed, sim.truck.boosting);
  emitSmoke(dt, drive, speed);
  smoke.update(dt);
  bursts.update(dt);
  aimSun(view, truckMesh.root.position);
  hud.update(speed, sim.cargoOnTruck(), sim.cargo.length, sim.cargoValue(), sim.fullValue);
  showPopups(dt);

  view.renderer.render(view.scene, view.camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
