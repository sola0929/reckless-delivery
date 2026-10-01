import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import { DRIVER, PHYSICS } from './config';
import { Hud, money } from './hud';
import { Input } from './input';
import { FIRST_LEVEL, LEVELS } from './levels';
import { Minimap } from './minimap';
import { ChaseCamera } from './render/camera';
import { CargoViews } from './render/cargoView';
import { DriverView } from './render/driverView';
import { Bursts, Smoke } from './render/effects';
import { LevelView } from './render/levelView';
import { BodySync, TruckMesh } from './render/meshes';
import { aimSun, createView } from './render/scene';
import type { CargoEvent, CargoItem } from './sim/cargo';
import type { FootInput } from './sim/driver';
import { Sim } from './sim/sim';
import type { DriveInput } from './sim/truck';

const canvas = document.getElementById('game') as HTMLCanvasElement;
// ?level=sandbox opens the test course instead of the first level.
const levelId = new URLSearchParams(location.search).get('level') ?? FIRST_LEVEL;
const level = (LEVELS[levelId] ?? LEVELS[FIRST_LEVEL])();
const sim = await Sim.create(level);
const view = createView(canvas, level);
const input = new Input(canvas);
const hud = new Hud(level);
const chase = new ChaseCamera(view.camera);
const minimap = new Minimap(document.getElementById('minimap') as HTMLCanvasElement, level);

const levelView = new LevelView(view.scene, sim);
const truckMesh = new TruckMesh();
view.scene.add(truckMesh.root);
const truckSync = new BodySync(sim.truck.body, truckMesh.root);
const driverView = new DriverView(view.scene);

const smoke = new Smoke();
const bursts = new Bursts();
view.scene.add(smoke.mesh, bursts.mesh);

const cargoViews = new CargoViews(view.scene, bursts);
cargoViews.rebuild(sim);

const forward = new Vector3();
/** The way the truck points across the ground: radians about Y. */
function truckHeading(): number {
  forward.set(0, 0, 1).applyQuaternion(truckMesh.root.quaternion);
  return Math.atan2(forward.x, forward.z);
}

truckSync.apply(1);
chase.snap(truckMesh.root.position, truckHeading());

if (import.meta.env.DEV) Object.assign(window, { game: { sim, camera: view.camera } });

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

/** Where an item is on screen, or null if it is behind the camera. */
function onScreen(item: CargoItem): { x: number; y: number } | null {
  screen.copy(item.lastPos);
  screen.y += 0.7;
  screen.project(view.camera);
  if (screen.z >= 1) return null;
  return { x: (screen.x * 0.5 + 0.5) * window.innerWidth, y: (-screen.y * 0.5 + 0.5) * window.innerHeight };
}

function noteEvent(event: CargoEvent): void {
  if (event.kind === 'recovered') {
    const at = onScreen(event.item);
    if (at && event.gain >= 1) hud.popup(`+${money(event.gain)}`, at.x, at.y, 'gain');
    return;
  }
  if (event.kind !== 'damage' && event.kind !== 'fallen' && event.kind !== 'destroyed') return;
  const entry = pendingLoss.get(event.item) ?? { loss: 0, wait: 0, label: '' };
  if (event.kind === 'fallen') entry.label = '掉落';
  else if (event.kind === 'destroyed') entry.label = '全毀';
  if (event.kind !== 'destroyed') entry.loss += event.loss;
  pendingLoss.set(event.item, entry);
}

function showPopups(dt: number): void {
  for (const [item, entry] of pendingLoss) {
    entry.wait -= dt;
    if (entry.wait > 0 || (entry.loss < 1 && !entry.label)) continue;
    const at = onScreen(item);
    if (at) {
      const amount = entry.loss >= 1 ? `-${money(entry.loss)}` : '';
      // Nudged sideways at random so popups from neighbouring items don't stack exactly.
      hud.popup([entry.label, amount].filter(Boolean).join(' '), at.x + (Math.random() - 0.5) * 50, at.y, entry.label ? 'big' : '');
    }
    entry.loss = 0;
    entry.label = '';
    entry.wait = POPUP_INTERVAL;
  }
}

let resultShown = false;

/** Point the HUD arrow at the delivery bay, relative to the way the camera faces. */
function navigate(): void {
  const finish = level.finish;
  if (!finish) return;
  const dx = finish.pos[0] - truckMesh.root.position.x;
  const dz = finish.pos[1] - truckMesh.root.position.z;
  // Bearing to the bay, minus the camera's. +X is to the left of +Z, hence the sign.
  const angle = chase.viewYaw - Math.atan2(dx, dz);
  hud.navigate(angle, Math.hypot(dx, dz));
}

const raycaster = new Raycaster();
const pointer = new Vector2();
const footPlane = new Plane(new Vector3(0, 1, 0), 0);
const aimPoint = new Vector3();

/**
 * The on-foot controls for one physics step. Walking is relative to the screen: forward is
 * up it. Key presses are only handed over when `first` is set, so each is acted on once.
 */
function footInput(first: boolean): FootInput {
  const walk = input.walk();
  const yaw = chase.viewYaw;
  // Facing +Z, screen-right is -X.
  const moveX = Math.sin(yaw) * walk.forward - Math.cos(yaw) * walk.right;
  const moveZ = Math.cos(yaw) * walk.forward + Math.sin(yaw) * walk.right;

  // The point on the ground under the cursor, at the height of the driver's feet.
  pointer.set((input.mouseX / window.innerWidth) * 2 - 1, -(input.mouseY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, view.camera);
  footPlane.constant = -sim.driver.pos.y;
  const hit = raycaster.ray.intersectPlane(footPlane, aimPoint);

  return {
    moveX,
    moveZ,
    run: walk.run,
    vehiclePressed: first && input.take('KeyC'),
    grabPressed: first && input.take('KeyE'),
    jumpPressed: first && input.take('Space'),
    aim: hit ? { x: hit.x, z: hit.z } : null,
    charging: input.mouseDown,
    cancelPressed: first && input.takeRightClick(),
  };
}

/** The one-line hint about what the nearest action is. */
function updatePrompt(): void {
  const { driver, truck, cargoSystem } = sim;
  if (sim.result) return hud.setPrompt('');
  if (driver.mode === 'driving') {
    const slow = Math.abs(truck.forwardSpeed()) < DRIVER.exitSpeed;
    return hud.setPrompt(slow && sim.cargo.some((c) => c.fallen && c.body) ? '<b>C</b> 下車撿貨' : '');
  }
  if (driver.mode === 'down') return hud.setPrompt('被撞倒了…', true);
  if (driver.atLeash) return hud.setPrompt('離貨車太遠了', true);
  if (driver.tooHeavyLeft > 0) return hud.setPrompt('太重了，跳不起來', true);
  if (driver.charge > 0) return hud.setPrompt('放開左鍵拋出　<b>右鍵</b> 取消');
  if (driver.held) return hud.setPrompt('<b>按住左鍵</b> 蓄力拋出　<b>E</b> 放下');
  if (driver.withinReach(truck, cargoSystem)) return hud.setPrompt('<b>E</b> 舉起');
  if (driver.nearDoor(truck)) return hud.setPrompt('<b>C</b> 上車');
  hud.setPrompt('');
}

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  accumulator += dt;

  if (input.take('KeyR')) {
    sim.reset();
    levelView.snap();
    truckSync.snap();
    hud.hideResult();
    hud.showBanner();
    resultShown = false;
    cargoViews.rebuild(sim);
    truckSync.apply(1);
    chase.snap(truckMesh.root.position, truckHeading());
    smoke.clear();
    bursts.clear();
    pendingLoss.clear();
    hud.clearPopups();
    accumulator = 0;
  }

  const drive = input.drive();
  let steps = 0;
  while (accumulator >= PHYSICS.dt && steps < PHYSICS.maxStepsPerFrame) {
    sim.step(drive, footInput(steps === 0));
    for (const event of sim.drainEvents()) {
      cargoViews.handle(event);
      noteEvent(event);
    }
    levelView.capture();
    truckSync.capture();
    cargoViews.capture();
    accumulator -= PHYSICS.dt;
    steps++;
  }
  // Drop the backlog rather than spiral if the frame rate can't keep up.
  if (accumulator >= PHYSICS.dt) accumulator = 0;

  const alpha = accumulator / PHYSICS.dt;
  levelView.apply(alpha);
  truckSync.apply(alpha);
  cargoViews.apply(alpha);
  cargoViews.update(dt);
  truckMesh.updateWheels(sim.truck);

  const { driver } = sim;
  const onFoot = driver.mode !== 'driving';
  const truckAt = truckMesh.root.position;
  driverView.update(dt, driver, truckAt);
  // The camera, the see-through buildings and the shadows all centre on whoever is being played.
  const focus = onFoot ? driverView.root.position : truckAt;

  const speed = sim.truck.forwardSpeed();
  chase.addZoom(input.takeWheel());
  chase.update(dt, focus, onFoot ? null : truckHeading(), speed, sim.truck.boosting);
  if (!onFoot) emitSmoke(dt, drive, speed);
  smoke.update(dt);
  bursts.update(dt);
  levelView.update(dt, view.camera, focus);
  aimSun(view, focus);

  hud.setMode(onFoot);
  hud.update(speed, sim.cargoOnTruck(), sim.cargo.length, sim.cargoValue(), sim.fullValue, sim.time);
  updatePrompt();
  navigate();
  const fallen = sim.cargo.filter((c) => c.fallen && c.body && !c.held).map((c) => ({ x: c.lastPos.x, z: c.lastPos.z }));
  minimap.update(
    dt, truckAt.x, truckAt.z, truckHeading(), chase.viewYaw, sim.traffic.cars, fallen,
    onFoot ? { x: driver.pos.x, z: driver.pos.z, leash: DRIVER.leash } : null,
  );
  if (sim.result && !resultShown) {
    hud.showResult(sim.result, sim.fullValue);
    resultShown = true;
  }
  showPopups(dt);

  view.renderer.render(view.scene, view.camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
