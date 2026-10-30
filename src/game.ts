import { Plane, Quaternion, Raycaster, SpotLight, Vector2, Vector3, type Object3D } from 'three';
import { DRIVER, PHYSICS, TRUCK } from './config';
import { Graphics, type QualityChoice } from './graphics';
import { Hud, money } from './hud';
import { bumpControls } from './controls';
import { padNavigate, padText } from './gamepad';
import { Input } from './input';
import { LessonGuide } from './lessons';
import { Chat } from './chat';
import { finishLoading, setStage, settle } from './loading';
import { GameAudio, type Material, type StormState } from './audio';
import { saveBest } from './best';
import { playMusic, uiSound, wakeMusic } from './jukebox';
import { FIRST_LEVEL, LEVEL_LIST, LEVELS } from './levels';
import { Minimap } from './minimap';
import { ChaseCamera } from './render/camera';
import { BattleView } from './render/battleView';
import { CargoViews } from './render/cargoView';
import { DriverView } from './render/driverView';
import { Bursts, Smoke } from './render/effects';
import { LevelView } from './render/levelView';
import { BodySync, TruckMesh } from './render/meshes';
import { ObjectsView, PedestriansView } from './render/objectsView';
import { RidersView } from './render/ridersView';
import { MachinesView } from './render/machinesView';
import { RigsView } from './render/rigsView';
import { RainView } from './render/rainView';
import { StormView } from './render/stormView';
import { WavesView } from './render/wavesView';
import { WindView } from './render/windView';
import { LampsView } from './render/lampsView';
import { OutageView } from './render/outageView';
import { SkylightsView } from './render/skylightsView';
import { sheltered } from './sim/waves';
import { Wreckage } from './render/wreckage';
import { aimSun, createView } from './render/scene';
import { heightAt } from './levels/terrain';
import { OBJECT_KINDS, type ObjectKind } from './levels/objects';
import type { CargoEvent, CargoItem } from './sim/cargo';
import type { FootInput } from './sim/driver';
import type { KnockEvent } from './sim/objects';
import { Sim } from './sim/sim';
import { TRAIN_HALF } from './sim/trains';
import type { DriveInput } from './sim/truck';

const canvas = document.getElementById('game') as HTMLCanvasElement;
// ?level=sandbox opens the test course instead of the first level.
const levelId = new URLSearchParams(location.search).get('level') ?? FIRST_LEVEL;
const level = (LEVELS[levelId] ?? LEVELS[FIRST_LEVEL])();
// The loading screen is moved on between the long pieces of setting up.
setStage(1, 0.5);
await settle();
const sim = await Sim.create(level);
setStage(2);
await settle();
const view = createView(canvas, level);
const input = new Input(canvas);
const hud = new Hud(level);
// On ground that rises and falls, the view is from lower and further back, looking further ahead: from high above, a hill looks flat.
const terrain = level.terrain;
// Lower and further back where there is height to see: on terrain, and on decks afloat (their ground, the quay, is flat).
const chase = new ChaseCamera(view.camera, terrain || level.decks ? { height: 9, distance: 13, lookAhead: 7, ground: terrain ? (x, z, reach = 3) => heightAt(terrain, x, z, sim.truck.body.translation().y + reach) : undefined } : undefined);
const graphics = new Graphics(view);
// The switch in the pause menu: one of four, the one in force lit. On automatic it says what it has settled on.
const qualityButtons = [...document.querySelectorAll<HTMLButtonElement>('#gfx-quality button')];
const QUALITY_NAME = { high: '高', medium: '中', low: '低' };
function showQuality(): void {
  for (const button of qualityButtons) {
    const choice = button.dataset.quality as QualityChoice;
    button.classList.toggle('on', choice === graphics.choice);
    if (choice === 'auto') button.textContent = graphics.choice === 'auto' ? `自動 · ${QUALITY_NAME[graphics.quality]}` : '自動';
  }
}
for (const button of qualityButtons) {
  button.addEventListener('click', () => {
    graphics.choose(button.dataset.quality as QualityChoice);
    showQuality();
  });
}
showQuality();
graphics.onStepDown = (quality) => {
  showQuality();
  hud.popup(quality === 'low' ? '畫面不順，已調到最低畫質' : '畫面不順，已自動降低畫質', window.innerWidth / 2, window.innerHeight * 0.3, 'big');
};
const minimap = new Minimap(document.getElementById('minimap') as HTMLCanvasElement, level);

const levelView = new LevelView(view.scene, sim);
const truckMesh = new TruckMesh();
view.scene.add(truckMesh.root);
const truckSync = new BodySync(sim.truck.body, truckMesh.root);
const driverView = new DriverView(view.scene);

const smoke = new Smoke();
// What a hurt engine gives off: darker, and it hangs about.
const engineSmoke = new Smoke(0x3a3734, 0.34, 2.4, 1.25);
/** Wear, out of 100, at which the truck starts to look each stage worse. */
const WEAR_STAGES = [15, 45, 80];
const ENGINE_SMOKE_INTERVAL = [0, 0, 0.14, 0.04];
const RISING = new Vector3(0, 1.2, 0);
// A wreck burning: thick black smoke in a tall column that leans with the wind.
const wreckSmoke = new Smoke(0x1c1a19, 0.5, 6, 2.8);
const PLUME = new Vector3(0.6, 2.2, 0.3);
let engineTimer = 0;
const bursts = new Bursts();
view.scene.add(smoke.mesh, engineSmoke.mesh, wreckSmoke.mesh, bursts.mesh);

setStage(2, 0.45);
await settle();
const objectsView = new ObjectsView(view.scene, sim.objects.objects);
/** The tutorial's guide, on a level with lessons. */
const guide = level.lessons ? new LessonGuide(level.lessons) : null;
if (guide) {
  view.scene.add(guide.ring);
  guide.onLesson = () => uiSound('confirm');
  document.getElementById('lesson-skip')!.addEventListener('click', () => {
    location.search = '?level=hillcity';
  });
}
/** Messages from the boss and the customer on the way, on a level that has them. */
const chat = level.chat ? new Chat(level.chat) : null;
/** What has been written about already this run, and what is being watched for. */
const said = { start: false, below60: false, below30: false, near: false, hits: 0, still: 0, places: new Set<number>() };
const wreckage = new Wreckage(view.scene);
const pedestriansView = new PedestriansView(view.scene, sim.pedestrians.list);
const ridersView = new RidersView(view.scene, sim.riders.list);
const machinesView = new MachinesView(view.scene, sim.machines.list);
const lampTruck = new Vector3();
const rigsView = new RigsView(view.scene, sim.rigs.list, sim.droppers.rocks, sim.droppers.holes);
const wavesView = sim.waves.list.length ? new WavesView(view.scene, sim.waves.list) : null;
const windView = sim.wind.list.length ? new WindView(view.scene, sim.wind.list) : null;
const lampsView = level.lamps?.length ? new LampsView(view.scene, level.lamps) : null;
// After everything else in the hall is made: what glows of itself in there goes dark with it.
const outageView = level.outage ? new OutageView(view.scene, level.outage, truckMesh.root) : null;
const skylightsView = sim.skylights.lights.length ? new SkylightsView(view.scene, sim.skylights) : null;
/** How fast a gust drives the rain across, metres a second, at its hardest. */
const GUST_RAIN = 22;
/** On a level in a storm, the rain. */
const rain = level.light === 'storm' ? new RainView(view.scene) : null;
/** The top of whatever water is lying over a place on ground so high: the sea, a flood, a puddle on a roof; none, none. */
function waterOver(x: number, z: number, ground: number): number | undefined {
  let top: number | undefined;
  for (const { area: [x0, z0, x1, z1], surface } of level.pools ?? []) if (x > x0 && x < x1 && z > z0 && z < z1 && surface > ground && (top === undefined || surface > top)) top = surface;
  return top;
}
/** Where the rain comes down near the truck: the ground, or the water over it. */
function rainOn(x: number, z: number): number {
  const ground = heightAt(level.terrain, x, z, sim.truck.body.translation().y + 3);
  return waterOver(x, z, ground) ?? ground;
}
/** And the rest of the storm: the splashes, the surf, the sheets of rain, the lightning; and the thunder still to come. */
const storm = level.light === 'storm' ? new StormView({ hemi: view.hemi, scene: view.scene }, level.surf ?? [], rainOn) : null;
const thunders: { in: number; near: number }[] = [];
/** A news crew's lights, each on its stand: really lit, onto whoever is speaking, and going over with the stand if it is knocked. */
const crewLights = sim.objects.objects.filter((o) => o.desc.kind === 'lightStand').map((o) => {
  const light = new SpotLight(0xfff4e2, 40, 11, 0.5, 0.55, 2);
  view.scene.add(light, light.target);
  return { o, light };
});
const LIGHT_FACE = new Vector3(0, 2.32, 0.1), LIGHT_ON = new Vector3(0, 1.0, 3.2);
function aimCrewLights(): void {
  for (const { o, light } of crewLights) {
    const p = o.body.translation(), r = o.body.rotation(), q = new Quaternion(r.x, r.y, r.z, r.w);
    light.position.copy(LIGHT_FACE).applyQuaternion(q).add(p as Vector3);
    light.target.position.copy(LIGHT_ON).applyQuaternion(q).add(p as Vector3);
  }
}
/**
 * On a level that has them, a squall now and then: how hard it is pouring (0 to 1), how long the level has gone on, when
 * the next comes; how far it is hidden by a roof overhead; the fog as it was before the squall closed it in this frame,
 * and as the squall left it, so that it can be put back before anything else looks at it.
 */
const squalls = level.light === 'storm' ? level.squalls : undefined;
const squall = { k: 0, t: 0, next: squalls ? squalls.every[0] * 0.6 : Infinity, cover: 0, base: { near: 0, far: 0 }, set: null as { near: number; far: number } | null };
function squallUndo(): void {
  const fog = view.scene.fog as { near: number; far: number } | null;
  if (fog && squall.set && fog.near === squall.set.near && fog.far === squall.set.far) [fog.near, fog.far] = [squall.base.near, squall.base.far];
  squall.set = null;
}
function squallUpdate(dt: number, indoors: boolean): void {
  if (!squalls) return;
  const { every, last, grow } = squalls, into = (squall.t += dt) - squall.next;
  // Coming on, at its worst, passing; then a while till the next.
  let k = into < 0 ? 0 : into < grow ? into / grow : into < grow + last ? 1 : 1 - (into - grow - last) / grow;
  if (k < 0) {
    squall.next = squall.t + every[0] + Math.random() * (every[1] - every[0]);
    k = 0;
  }
  squall.k = k * k * (3 - 2 * k);
  // Under a roof it is only heard on it; out from under one the fog it brings is seen again over a moment.
  squall.cover += ((indoors ? 1 : 0) - squall.cover) * Math.min(1, dt * 2);
  const seen = squall.k * (1 - squall.cover), fog = view.scene.fog as { near: number; far: number } | null;
  if (fog && seen > 0) {
    squall.base = { near: fog.near, far: fog.far };
    fog.near *= 1 - 0.75 * seen;
    fog.far *= 1 - 0.6 * seen;
    squall.set = { near: fog.near, far: fog.far };
  }
  rain?.pour(seen);
  if (storm) storm.pour = seen;
}
/** Whether the level has a building to drive up through, seen in section. */
const cutaway = sim.level.props.some((p) => p.cutaway);
const lidded = !!sim.level.lids?.length;
/** What is on top of a roof over a hall, while the truck or the driver is in under it. */
function lidHides(p: { x: number; y: number; z: number }): boolean {
  const at = sim.driver.mode === 'driving' ? sim.truck.body.translation() : sim.driver.pos;
  return (sim.level.lids ?? []).some(({ area, below }) => at.x > area[0] && at.x < area[2] && at.z > area[1] && at.z < area[3] && at.y < below && p.x > area[0] && p.x < area[2] && p.z > area[1] && p.z < area[3] && p.y > below);
}
/** Testing tools: only when run locally from the dev server. The published build has none of it. */
const TESTING = import.meta.env.DEV;
if (TESTING && sim.level.checkpoints?.length) {
  const list = document.createElement('div');
  list.id = 'dev-jumps';
  list.style.cssText = 'position:fixed;left:12px;bottom:56px;padding:8px 12px;background:rgba(20,24,30,0.78);color:#e8eef4;font:13px/1.6 sans-serif;border-radius:8px;z-index:20;pointer-events:none';
  list.innerHTML = '<b>測試跳點</b><br>' + sim.level.checkpoints.slice(0, 10).map((spot, k) => `${(k + 1) % 10}　${spot.name}`).join('<br>');
  document.body.appendChild(list);
}
const battleView = new BattleView(view.scene, sim.battle, level.battle);
battleView.onTrail = (at) => smoke.emit(at, NO_DRIFT);
// The warning that something has the truck in its sights: a ring that closes on it, and what it is.
const lockRing = document.createElement('div');
lockRing.id = 'lock';
lockRing.innerHTML = '<i></i><span></span>';
lockRing.hidden = true;
document.getElementById('hud')!.append(lockRing);
let beepWait = 0;
let hornWait = 0;
const cargoViews = new CargoViews(view.scene, bursts);
cargoViews.markHidden = !!level.practice;
// A tin of paint burst on the bed: the truck wears it.
cargoViews.onSpill = (color) => truckMesh.stain(color);
cargoViews.rebuild(sim);

const forward = new Vector3();
/** The way the truck points across the ground: radians about Y. */
function truckHeading(): number {
  forward.set(0, 0, 1).applyQuaternion(truckMesh.root.quaternion);
  return Math.atan2(forward.x, forward.z);
}

truckSync.apply(1);
chase.snap(truckMesh.root.position, truckHeading());

// For the scripts in dev/: with `freeze` set the camera stops following, and can be put anywhere.
const audio = new GameAudio();
playMusic('level');
/** How heavy the heaviest thing the truck sent flying this frame was, 0 to 1; below 0 if it hit nothing. */
let knockedWeight = -1;
/** Where each frame's time goes, added up until a script reads and clears it: physics, everything else, drawing. */
const timing = { frames: 0, physics: 0, logic: 0, render: 0, worst: 0 };
const debug = { sim, camera: view.camera, scene: view.scene, renderer: view.renderer, freeze: false, audio, timing, input, levelView, storm, squall: () => { squall.next = squall.t; } };
if (import.meta.env.DEV) Object.assign(window, { game: debug });

let last = performance.now();
let accumulator = 0;

const SMOKE_INTERVAL = 0.03;
const NO_DRIFT = new Vector3();
const contact = new Vector3();
let smokeTimer = 0;

/** Tyre smoke: rear wheels spinning under boost, any wheel under hard braking or the handbrake. */
/** How hard the tyres are sliding, 0 to 1: locked under heavy braking, or on the handbrake. Pulling away hard makes smoke but no squeal. */
function skidding(drive: DriveInput, speed: number): number {
  const { truck } = sim;
  const moving = Math.abs(speed) > 4;
  if (![0, 1, 2, 3].some((i) => truck.controller.wheelIsInContact(i))) return 0;
  if (truck.brakeLevel > 0.7 && moving) return truck.brakeLevel;
  if (drive.handbrake && moving) return 0.8;
  return 0;
}

/** How close the nearest train is: 1 alongside, 0 at 80 m or more. */
/** Running water, heard: the rivers' fords, as rectangles [x0, z0, x1, z1]. Pools, even those drawn drifting (the
 *  settling ponds by the machines, the water under the temporary bridge), stand still enough to be silent. */
const RUNNING: [number, number, number, number][] = (level.fords ?? [])
  .filter((f) => f.flow[0] !== 0 || f.flow[1] !== 0)
  .map((f) => [f.pos[0] - f.half[0], f.pos[1] - f.half[1], f.pos[0] + f.half[0], f.pos[1] + f.half[1]]);
/** Heard from this far from the water's edge, metres. */
const RIVER_EARSHOT = 30;
/** How close the nearest running water is to whoever is being played, 0 to 1. */
function riverNearness(): number {
  if (!RUNNING.length) return 0;
  const at = sim.driver.mode === 'driving' ? sim.truck.body.translation() : sim.driver.pos;
  let nearest = Infinity;
  for (const [x0, z0, x1, z1] of RUNNING) nearest = Math.min(nearest, Math.hypot(Math.max(0, x0 - at.x, at.x - x1), Math.max(0, z0 - at.z, at.z - z1)));
  return Math.max(0, 1 - nearest / RIVER_EARSHOT);
}

// Out in a storm, its sounds: what they need to know of where the truck is.
const stormy = level.light === 'storm';
if (stormy) audio.wantStorm();
/** The sea is heard from this far off, metres; the level is measured for it in squares this big. */
const SEA_EARSHOT = 45, SEA_CELL = 4;
/** How far it is from each square of the level to open water, metres: worked out once, two passes over the squares. */
const seaFar = stormy && level.bounds && level.terrain?.surface ? (() => {
  const [[x0, z0], [x1, z1]] = level.bounds!;
  const w = Math.ceil((x1 - x0) / SEA_CELL) + 1, h = Math.ceil((z1 - z0) / SEA_CELL) + 1;
  const far = new Float32Array(w * h).fill(Infinity);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (level.terrain!.surface!(x0 + i * SEA_CELL, z0 + j * SEA_CELL)?.tag === 'water') far[j * w + i] = 0;
  const step = (i: number, j: number, di: number, dj: number) => {
    const a = i + di, b = j + dj;
    if (a < 0 || b < 0 || a >= w || b >= h) return;
    far[j * w + i] = Math.min(far[j * w + i], far[b * w + a] + Math.hypot(di, dj) * SEA_CELL);
  };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { step(i, j, -1, 0); step(i, j, 0, -1); step(i, j, -1, -1); step(i, j, 1, -1); }
  for (let j = h - 1; j >= 0; j--) for (let i = w - 1; i >= 0; i--) { step(i, j, 1, 0); step(i, j, 0, 1); step(i, j, 1, 1); step(i, j, -1, 1); }
  return (x: number, z: number) => {
    const i = Math.round((x - x0) / SEA_CELL), j = Math.round((z - z0) / SEA_CELL);
    return i < 0 || j < 0 || i >= w || j >= h ? 0 : far[j * w + i];
  };
})() : null;
/** What floats, for the hulls' creaking: not the boardwalks on piles, nor a boat up on land. */
const afloat = sim.rigs.list.filter((rig) => rig.desc.kind === 'float' && rig.desc.half && rig.desc.hull !== 'walk' && (rig.desc.heave || rig.desc.roll));
/** What the storm sounds like at a place. */
function stormAt(at: { x: number; y: number; z: number }, indoors: boolean): StormState {
  // The nearest thing afloat, measured from its sides; how fast it is turning, its roll and pitch together.
  let near = Infinity, rolling = 0, sliding = 0;
  for (const rig of afloat) {
    const pose = rig.pose, was = rig.was, half = rig.desc.half!, yaw = rig.desc.yaw ?? 0;
    const cx = pose?.x ?? rig.desc.pos[0], cz = pose?.z ?? rig.desc.pos[2];
    const dx = at.x - cx, dz = at.z - cz;
    const across = Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw)), along = Math.abs(dx * Math.sin(yaw) + dz * Math.cos(yaw));
    const d = Math.hypot(Math.max(0, across - half[0]), Math.max(0, along - half[2]));
    if (pose && was) {
      const dot = Math.abs(pose.rot.x * was.rot.x + pose.rot.y * was.rot.y + pose.rot.z * was.rot.z + pose.rot.w * was.rot.w);
      const turning = 2 * Math.acos(Math.min(1, dot)) * 60;
      if (d < near) { near = d; rolling = turning / 0.1; }
    } else near = Math.min(near, d);
    // Containers loose on its deck, sliding.
    if (rig.desc.loose) for (const part of rig.parts.slice(1)) {
      const p = part.body.translation(), v = part.body.linvel();
      const off = Math.hypot(p.x - at.x, p.z - at.z);
      if (off < 35) sliding = Math.max(sliding, (Math.hypot(v.x, v.z) / 1.5) * (1 - off / 35));
    }
  }
  const [wx, wz] = sim.wind.at(at.x, at.z), gust = Math.min(1, Math.hypot(wx, wz));
  return {
    indoors: indoors ? 1 : 0, gust,
    sea: seaFar ? Math.max(0, 1 - seaFar(at.x, at.z) / SEA_EARSHOT) : 0,
    afloat: Math.max(0, 1 - near / 25), rolling, sliding, pour: squall.k,
  };
}

function trainNearness(): number {
  const at = sim.truck.body.translation();
  let nearest = Infinity;
  for (const train of sim.trains.trains) {
    nearest = Math.min(nearest, Math.hypot(Math.max(0, Math.abs(at.x - train.x) - TRAIN_HALF.length), at.z - train.z));
  }
  return Math.max(0, 1 - nearest / 80);
}

/** Whether the truck is by a crossing whose signal is at red. */
function bellRinging(): boolean {
  const at = sim.truck.body.translation();
  return (level.tracks ?? []).some((track, i) => Math.abs(at.x - track.watchX) < 45 && Math.abs(at.z - track.z) < 45 && sim.trains.warning(i));
}

/** Rice drying on a tarp, run over: each wheel on it throws it up behind, more the faster it goes. */
let riceTimer = 0;
function kickRice(dt: number, speed: number): void {
  const spreads = level.spreads;
  if (!spreads?.length || Math.abs(speed) < 1) return;
  riceTimer += dt;
  if (riceTimer < 0.04) return;
  riceTimer = 0;
  const { truck } = sim;
  for (let i = 0; i < 4; i++) {
    if (!truck.controller.wheelIsInContact(i)) continue;
    const at = truckMesh.wheelContact(i, contact);
    if (!spreads.some(({ pos, half }) => Math.abs(at.x - pos[0]) < half[0] && Math.abs(at.z - pos[1]) < half[1])) continue;
    bursts.emit(at.setY(at.y + 0.1), 'rice', Math.min(14, 3 + Math.abs(speed) * 1.2), 1.5 + Math.abs(speed) * 0.25, 1.4);
  }
}

/** Hens in the air: a feather or two off each, every so often, while she is still going. */
const hens = sim.objects.objects.filter((o) => o.kind.flee);
function moult(): void {
  for (const hen of hens) {
    if (!hen.knocked || Math.random() > 0.35) continue;
    const v = hen.body.linvel();
    if (Math.hypot(v.x, v.y, v.z) < 1.2) continue;
    const p = hen.body.translation();
    bursts.emit(splashAt.set(p.x, p.y + 0.3, p.z), 'feathers', 2, 1.2, 0.6);
  }
}

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
  return toScreen(item.lastPos, 0.7);
}

/** Where a point in the world is on screen, `above` metres up from it; null if behind the camera. */
function toScreen(point: { x: number; y: number; z: number }, above: number): { x: number; y: number } | null {
  screen.set(point.x, point.y + above, point.z).project(view.camera);
  if (screen.z >= 1) return null;
  return { x: (screen.x * 0.5 + 0.5) * window.innerWidth, y: (-screen.y * 0.5 + 0.5) * window.innerHeight };
}

/** What people in the market say once the power has gone: now and then one of those near the truck, not all of them;
 * the first two first, the rest in no order, none twice. */
const DARK_SAYS = ['停電了？', '好黑喔……', '颱風把電線桿吹倒了嗎', '誰有手電筒？', '台電什麼時候來修啊', '看不到啦', '快收一收，回家了啦', '手機的燈打開啦'];
const DARK_MOST = 6;
const dark = { said: 0, next: 0, left: [] as string[] };
/** Each frame in the dark: when it is time, someone standing near the truck, in sight, says something. */
function murmur(dt: number, gone: number): void {
  if (gone < 0) {
    dark.said = 0;
    dark.next = 1.8;
    return;
  }
  if (dark.said >= DARK_MOST || (dark.next -= dt) > 0) return;
  const t = sim.truck.body.translation();
  const near = sim.pedestrians.list.filter((p) => p.state !== 'down' && p.state !== 'flee' && Math.hypot(p.pos.x - t.x, p.pos.z - t.z) < 12);
  for (const person of near.sort(() => Math.random() - 0.5)) {
    const spot = toScreen(person.pos, 2.1);
    if (!spot || spot.x < 60 || spot.x > window.innerWidth - 60 || spot.y < 60 || spot.y > window.innerHeight - 60) continue;
    if (dark.said === 0) dark.left = DARK_SAYS.slice(2).sort(() => Math.random() - 0.5);
    const words = dark.said < 2 ? DARK_SAYS[dark.said] : dark.left.pop()!;
    hud.popup(words, spot.x, spot.y, 'say');
    dark.said++;
    dark.next = 5 + Math.random() * 5;
    return;
  }
  // Nobody to say it: look again in a moment.
  dark.next = 0.5;
}

/** Those who have something to say as the truck comes near, a news crew's reporter to the camera: each line in turn,
 * while it is near and they are on their feet and in sight, until they have said it all. */
const talkers = sim.pedestrians.list.filter((p) => p.crowd.says?.length).map((p) => ({ p, said: 0, next: 0 }));
const TALK_NEAR = 38, TALK_GAP = 2.6;
function talk(dt: number): void {
  const t = sim.truck.body.translation();
  for (const talker of talkers) {
    const { p } = talker, lines = p.crowd.says!;
    if (talker.said >= lines.length || p.state === 'down' || Math.hypot(p.pos.x - t.x, p.pos.z - t.z) > TALK_NEAR || (talker.next -= dt) > 0) continue;
    const spot = toScreen(p.pos, 2.1);
    if (!spot || spot.x < 60 || spot.x > window.innerWidth - 60 || spot.y < 60 || spot.y > window.innerHeight - 60) {
      talker.next = 0.4;
      continue;
    }
    hud.popup(lines[talker.said++], spot.x, spot.y, 'say');
    talker.next = TALK_GAP;
  }
}

/** What people shout when they are sent flying. */
const SHOUTS = ['喂！', '啊啊啊！', '看路啊！', '哎唷！', '搞什麼！'];
const RIDER_SHOUTS = ['我的車！', '會不會開車啊！', '哎唷喂！', '啊啊啊！', '長眼睛沒有！'];

/**
 * Someone has been run down: the thump of it, louder the faster the truck was going, and
 * what they have to say about it. With a scooter under them there is metal in it as well.
 */
function showHit(at: { x: number; y: number; z: number }, shouts: string[], scooter: boolean): void {
  const strength = Math.min(1, Math.abs(sim.truck.forwardSpeed()) / 14);
  audio.knock(scooter ? 'metal' : 'soft', 0.35 + strength * 0.65, scooter ? 0.45 : 0.7);
  // The crash that goes with a scooter is mostly the scooter.
  if (scooter) knockedWeight = Math.max(knockedWeight, 0.6);
  const spot = toScreen(at, 1.8);
  if (spot) hud.popup(shouts[Math.floor(Math.random() * shouts.length)], spot.x, spot.y, 'big');
}
const GEYSER_SECONDS = 7;
/** How long water comes up out of a manhole each time it blows. */
const SPOUT_SECONDS = 2.5;
const splashAt = new Vector3();
const fallCarry = new Vector3();
/** Broken hydrants, still spouting where they stood. */
const geysers: { at: Vector3; left: number; strong?: boolean; style?: 'water' | 'ice' | 'spill'; from?: { translation(): { x: number; y: number; z: number } } }[] = [];
/** How long a tank burst open pours, seconds. */
const SPILL_SECONDS = 1.4;
const CRACKLE_SECONDS = 6;
/** Strings of firecrackers going off where they fell, and how long until each one's next bang. */
const crackles: { at: Vector3; left: number; next: number; laid?: boolean }[] = [];
/** Loose ends of live wire, each spitting sparks for a while yet, and how long until its next flash. */
const arcs: { at: Vector3; left: number; next: number }[] = [];
const ARC_SECONDS = 3.5;
/** Within this far of the truck, something bursting bursts over it. */
const SPLASH_REACH = 7;

/** Something has just been sent flying: throw up whatever it is made of. */
/** Things that sound of neither wood nor metal when hit. */
const SOFT = new Set(['cone', 'box', 'chair', 'umbrella', 'toilet', 'chickenWhite', 'chickenBrown', 'chickenBlack', 'trayGrain', 'trayVeg', 'riceSack', 'mattress', 'sofa',
  // Sacks, plastic and straw.
  'sandbag', 'cementBag', 'jerrycan', 'rallyPole', 'delineator', 'barrier', 'flagOrange', 'flagPurple', 'flagTeal', 'haystack',
  // The harbour's: polystyrene, plastic baskets and chests, bags of ice, nets, floats, tarpaulins.
  'foamBox', 'fishBox', 'basketBlue', 'basketYellow', 'basketRed', 'basketGreen', 'iceBag', 'iceChest', 'netHeap', 'tarpHeap', 'buoy',
  // Rope, and cartons of frozen fish.
  'ropeCoil', 'frozenCarton']);
/** Rubber: a dull bounce. */
const RUBBER = new Set(['tyre', 'tyreStack', 'yokohamaFender']);
/** Hollow metal: a boom rather than a ring. */
const HOLLOW = new Set(['barrel', 'bin']);
/** Rock. */
const STONE = new Set(['boulder', 'rockSmall', 'bricks']);
/** Dead weight: a thump. */
const WEIGHT = new Set(['gravelPile', 'culvert', 'culvertStack', 'pipe', 'concretePipe']);

/** What a roadside object sounds like, from what it is. */
function materialOfObject(object: KnockEvent['object']): Material {
  const { kind, desc } = object;
  if (kind.effect === 'shards') return 'ceramic';
  if (kind.effect === 'leaves') return 'tree';
  if (kind.effect === 'splinters') return 'wood';
  // Fruit (a melon in a field): a dull wet knock. Paint, the other thing full of juice, is in tins.
  if (kind.juice !== undefined && !desc.kind.startsWith('paint')) return 'melon';
  if (HOLLOW.has(desc.kind)) return 'barrel';
  // Stone: no ring to it; stones clattering down.
  if (STONE.has(desc.kind)) return 'stone';
  if (desc.kind === 'iceBlock') return 'ice';
  if (WEIGHT.has(desc.kind)) return 'heavy';
  if (RUBBER.has(desc.kind)) return 'rubber';
  return SOFT.has(desc.kind) ? 'soft' : 'metal';
}

/** What each kind of cargo sounds like. */
const CARGO_SOUND: Record<string, Material> = {
  crate: 'wood', smallCrate: 'wood', wardrobe: 'wood', jar: 'ceramic', skeleton: 'bone',
  fridge: 'barrel', safe: 'heavy', watermelon: 'melon',
  washer: 'barrel', sack: 'soft', soda: 'ceramic',
};
/** An item of cargo jolted by less than this, m/s, makes no sound; and one that has just made one waits this long. */
const CARGO_QUIET = 2;
const CARGO_HUSH = 0.35;
const cargoHush = new WeakMap<CargoItem, number>();
/** How much quieter a sound is for being this far from the truck, and how far is out of earshot. */
/**
 * After each step: rocks off the conveyors (grit trickling down before they go, and each one breaking where it lands);
 * mud off a crane's grab, over the truck's windscreen if it is under it; water thrown up by the wheels in a ford.
 */
function worksite(): void {
  const t = sim.truck.body.translation();
  const now = performance.now() / 1000;
  // Of the grit trickling and the rocks landing, only the nearest of each is heard, and not again for a moment: several
  // belts at once otherwise make one long clatter.
  let tellNear = 0, rockNear = 0, rockSize = 0;
  for (const tell of sim.droppers.tells) {
    bursts.emit(splashAt.set(tell.x, tell.y - 0.5, tell.z), 'dust', 10, 0.8, 0.1, 0x9a9488);
    bursts.emit(splashAt, 'shards', 8, 0.5, 0, 0x8b8880);
    if (tell.first) tellNear = Math.max(tellNear, hearing(Math.hypot(tell.x - t.x, tell.z - t.z)));
  }
  if (tellNear > 0 && now - tellHeard > TELL_HUSH) {
    tellHeard = now;
    audio.thud('stone', 0.1 + tellNear * 0.2, 0.1);
  }
  // A skylight gone under a wheel: its sheet in bits, and the roof round it tearing as it goes down.
  for (const at of sim.skylights.breaks) {
    bursts.emit(splashAt.set(at.x, at.y + 0.2, at.z), 'shards', 30, 3, 0.6, 0xd9e2d2);
    audio.smash('ceramic', 0.5);
    audio.crunch(0.9);
  }
  for (const rock of sim.droppers.breaks) {
    bursts.emit(splashAt.set(rock.x, rock.y, rock.z), 'dust', 26, 3.5, 1);
    bursts.emit(splashAt, 'shards', 18, 4.5, 1.4, 0x8b8880);
    const near = hearing(Math.hypot(rock.x - t.x, rock.z - t.z));
    if (near > rockNear) [rockNear, rockSize] = [near, rock.size];
  }
  if (rockNear > 0 && now - rockHeard > ROCK_HUSH) {
    rockHeard = now;
    audio.thud('stone', Math.min(1, rockSize) * (0.25 + rockNear * 0.45), 0.6);
  }
  for (const slam of sim.rigs.slams) {
    bursts.emit(splashAt.set(slam.x, slam.y, slam.z), 'dust', 30, 4, 0.6, 0x8a7a5e);
    const near = hearing(Math.hypot(slam.x - t.x, slam.z - t.z));
    if (near > 0) audio.thud('heavy', Math.min(1, slam.speed / 18) * (0.5 + near * 0.5), 0.7);
  }
  // A boat taken up by a wave and thrown down on the boardwalk: the sea coming over as it goes up, and as it lands.
  for (const surge of sim.rigs.surges) {
    bursts.emit(splashAt.set(surge.x, surge.y + 1, surge.z), 'water', surge.down ? 160 : 120, surge.down ? 12 : 10, 3);
    if (surge.down) bursts.emit(splashAt.set(surge.x, surge.y + 0.5, surge.z), 'splinters', 40, 7, 1.4);
    audio.splash(true);
    if (surge.down) audio.thud('heavy', 1, 0.9);
  }
  for (const mud of sim.rigs.mud) {
    bursts.emit(splashAt.set(mud.x, mud.y, mud.z), 'juice', 10, 1.5, 0.2, 0x5a4a38);
    // Straight down on to the cab: the windscreen.
    if (sim.driver.mode === 'driving' && Math.hypot(mud.x - t.x, mud.z - t.z) < 2.6 && mud.y > t.y) hud.splat(0x5a4a38, 0.55);
  }
  // White water where a river pours over a ledge, at its foot, along the stretch near the truck.
  for (const fall of sim.level.fords ?? []) {
    if (!fall.fall || fall.surface === undefined || Math.abs(t.z - fall.pos[1]) > fall.half[1] + 30 || Math.random() < 0.5) continue;
    const z = Math.max(fall.pos[1] - fall.half[1], Math.min(fall.pos[1] + fall.half[1], t.z + (Math.random() - 0.3) * 50));
    const lip = fall.pos[0] + Math.sign(fall.flow[0]) * fall.half[0];
    // Going over: carried out off the lip.
    splashAt.set(lip, fall.surface, z);
    bursts.emit(splashAt, 'spray', 2, 0.8, 1, undefined, fallCarry.set(Math.sign(fall.flow[0]) * 2.5, 0, 0));
    // At the foot: thrown up high enough to be seen over the lip.
    splashAt.set(lip + Math.sign(fall.flow[0]) * 1.2, fall.surface - fall.fall, z);
    bursts.emit(splashAt, 'spray', 4, 2.2, 1.6);
  }
  // Fresh concrete thrown up grey off the wheels.
  if (sim.level.wet && sim.wetAt(t)) {
    const v = sim.truck.body.linvel();
    if (Math.hypot(v.x, v.z) > 1.5 && Math.random() < 0.5) bursts.emit(splashAt.set(t.x, t.y - 0.6, t.z), 'concrete', 4, 1.2, 0.6);
  }
  const ford = sim.level.fords && sim.fordAt(t);
  if (ford) {
    const v = sim.truck.body.linvel();
    const speed = Math.hypot(v.x, v.z);
    const r = sim.truck.body.rotation();
    const q = new Quaternion(r.x, r.y, r.z, r.w);
    // Thrown up by the wheels, each its own, the more the faster it goes: off its tyre at the water, up and out, carried
    // on a little after the truck; and while it goes on forward, a wave pushed out from under its bumper either side. In
    // a storm's flood the water is brown with what it has washed out of the streets; a river's is clear.
    if (speed > 1.2) {
      const surface = waterOver(t.x, t.z, t.y - 1.2) ?? ford.surface ?? t.y - 0.6;
      const style = level.light === 'storm' ? 'flood' : 'water';
      const fore = new Vector3(0, 0, 1).applyQuaternion(q), right = new Vector3(1, 0, 0).applyQuaternion(q);
      fordSpray += speed * PHYSICS.dt * FORD_SPRAY;
      for (; fordSpray >= 1; fordSpray--) {
        const [wx, , wz] = TRUCK.wheel.positions[Math.floor(Math.random() * 4)];
        const at = new Vector3(t.x, surface, t.z).addScaledVector(right, wx * 1.05).addScaledVector(fore, wz + (Math.random() - 0.5) * 0.5);
        const carry = new Vector3(v.x * 0.35, 0, v.z * 0.35).addScaledVector(right, Math.sign(wx) * (0.6 + speed * 0.12));
        bursts.emit(at, style, Math.round(2 + speed * 0.38), 0.7 + speed * 0.21, 1.7, undefined, carry);
      }
      const ahead = v.x * fore.x + v.z * fore.z;
      if (ahead > 2.5) {
        bowWave += ahead * PHYSICS.dt * BOW_WAVE;
        for (; bowWave >= 1; bowWave--) {
          const side = Math.random() < 0.5 ? -1 : 1;
          const at = new Vector3(t.x, surface, t.z).addScaledVector(right, side * 1.25).addScaledVector(fore, 3.9);
          const carry = new Vector3(v.x * 0.6, 0, v.z * 0.6).addScaledVector(right, side * ahead * 0.35);
          bursts.emit(at, style, 3, 0.55 + ahead * 0.1, 0.8, undefined, carry);
        }
      }
    }
    // Running water breaking against the truck's side that faces upstream: thrown up white along it and carried on over
    // and past, the harder the faster it comes on against the truck.
    const run = Math.hypot(ford.flow[0], ford.flow[1]);
    if (run > 0) {
      const ux = ford.flow[0] / run, uz = ford.flow[1] / run;
      const against = run - (v.x * ux + v.z * uz);
      const right = new Vector3(1, 0, 0).applyQuaternion(q);
      const side = right.x * ux + right.z * uz > 0 ? -1 : 1;
      if (against > 0.8) {
        // Going along with the truck, and thrown back off its side, up against the stream.
        const carry = new Vector3(v.x - ux * against * 0.35, 0, v.z - uz * against * 0.35);
        if (Math.random() < 0.5) {
          const at = new Vector3(side * 1.5, 0, (Math.random() - 0.5) * 6.4).applyQuaternion(q).add(new Vector3(t.x, 0, t.z));
          at.y = ford.surface ?? t.y - 0.6;
          bursts.emit(at, 'spray', Math.round(1 + against * 0.6), 0.5 + against * 0.3, 2.5, undefined, carry);
        }
      }
    }
  }
}

/** What is owed of the wheels' spray in a ford and of the wave off the bumper, bursts; and how many to the metre gone. */
let fordSpray = 0, bowWave = 0;
const FORD_SPRAY = 2.2, BOW_WAVE = 1.3;

/** When grit trickling and a rock landing were last heard, and how long before the next of each may be. */
let tellHeard = 0, rockHeard = 0;
const TELL_HUSH = 1.5, ROCK_HUSH = 0.7;
const hearing = (metres: number) => (metres > 45 ? 0 : 1 / (1 + metres / 15));

/**
 * Secondary knocks: cargo thrown about on the bed or come to rest on the road, and things
 * already sent flying coming down again. Only the hardest one or two a frame are sounded.
 */
function soundKnocks(dt: number): void {
  const truckAt = sim.truck.body.translation();
  const heard: { material: Material; strength: number; weight: number }[] = [];

  for (const item of sim.cargo) {
    const left = (cargoHush.get(item) ?? 0) - dt;
    cargoHush.set(item, left);
    if (!item.body || item.held || left > 0) continue;
    const jolt = Math.max(item.knock, item.squeeze * 0.4);
    if (jolt < CARGO_QUIET) continue;
    const near = hearing(Math.hypot(item.lastPos.x - truckAt.x, item.lastPos.z - truckAt.z));
    if (near === 0) continue;
    cargoHush.set(item, CARGO_HUSH);
    heard.push({ material: CARGO_SOUND[item.type.id] ?? 'soft', strength: Math.min(1, jolt / 9) * near, weight: Math.min(1, item.mass / 100) });
  }
  for (const { object, strength } of sim.drainLandings()) {
    const at = object.body.translation();
    const near = hearing(Math.hypot(at.x - truckAt.x, at.z - truckAt.z));
    // A hen coming down is a hen landing: nothing to hear over her wings.
    if (near === 0 || object.kind.flee) continue;
    heard.push({ material: materialOfObject(object), strength: Math.min(1, strength / 10) * near, weight: Math.min(1, object.body.mass() / 400) });
  }

  heard.sort((a, b) => b.strength - a.strength);
  for (const { material, strength, weight } of heard.slice(0, 2)) audio.thud(material, strength, weight);
}

/** A change to an item of cargo that should be heard. */
function soundCargoEvent(event: CargoEvent): void {
  const material = CARGO_SOUND[event.item.type.id] ?? 'soft';
  const weight = Math.min(1, event.item.mass / 100);
  if (event.kind === 'destroyed') audio.smash(material, weight);
  // A door or a limb coming away.
  else if (event.kind === 'detach') audio.thud(material, 0.6, weight);
}

function showKnock(knock: KnockEvent): void {
  const { kind } = knock.object;
  // Heard only if it happened near the truck, and louder the faster the truck was going.
  const truckAt = sim.truck.body.translation();
  const away = Math.hypot(knock.at.x - truckAt.x, knock.at.z - truckAt.z);
  // A hen is not hit: she flies off, and her wings and her squawking are all that is heard.
  if (away < 30 && !kind.flee) {
    const speed = Math.abs(sim.truck.forwardSpeed());
    const weight = Math.min(1, knock.object.body.mass() / 400);
    audio.knock(materialOfObject(knock.object), Math.min(1, speed / 18) / (1 + away / 15), weight);
    knockedWeight = Math.max(knockedWeight, weight);
  }
  const at = new Vector3(knock.at.x, knock.at.y + 0.6, knock.at.z);
  if (kind.juice !== undefined) {
    // Fruit, or paint: up in the air, and all over the truck if the truck is what hit it.
    bursts.emit(at.clone().setY(knock.at.y + 1), 'juice', 46, 6, 1, kind.juice);
    audio.smash('melon', 0.5);
    if (away < SPLASH_REACH && Math.abs(sim.truck.forwardSpeed()) > 2) {
      truckMesh.stain(kind.juice);
      // The windscreen only catches it when there is someone behind it to see.
      if (sim.driver.mode === 'driving') hud.splat(kind.juice, Math.min(1, Math.abs(sim.truck.forwardSpeed()) / 12) * (kind.wrecked ? 1 : 0.45));
    }
  }
  if (kind.effect === 'shards') audio.smash('ceramic', 0.5);
  if (kind.flee) audio.hen(Math.max(0, 1 - away / 35));
  if (kind.crackle) {
    const left = typeof kind.crackle === 'number' ? kind.crackle : CRACKLE_SECONDS;
    crackles.push({ at: new Vector3(knock.at.x, knock.at.y + 0.3, knock.at.z), left, next: 0, laid: kind.trip === true });
    // A string laid on the ground is heard as the recording of a whole string; a hanging one bang by bang.
    const truckAt = sim.truck.body.translation();
    if (kind.trip) audio.string(hearing(Math.hypot(knock.at.x - truckAt.x, knock.at.z - truckAt.z)), left);
  }
  if (kind.effect === 'leaves') bursts.emit(at.setY(knock.at.y + 3), 'leaves', 26, 4);
  else if (kind.effect === 'paper') bursts.emit(at.setY(knock.at.y + 0.4), 'paper', 90, 5, 1.6);
  else if (kind.effect === 'ash') {
    // A furnace knocked over: a cloud of ash and smoke, dust, burning paper and sparks.
    const from = at.setY(knock.at.y + 1.6);
    for (let k = 0; k < 26; k++) engineSmoke.emit(from, new Vector3((Math.random() - 0.5) * 3, Math.random() * 1.5, (Math.random() - 0.5) * 3));
    for (let k = 0; k < 16; k++) smoke.emit(from, new Vector3((Math.random() - 0.5) * 4, 0.5, (Math.random() - 0.5) * 4));
    bursts.emit(from, 'dust', 50, 5);
    bursts.emit(from, 'fire', 24, 4);
    bursts.emit(from, 'sparks', 40, 6);
    bursts.emit(from, 'paper', 40, 4, 1.4);
  } else if (kind.effect) bursts.emit(at, kind.effect, kind.effect === 'sparks' ? 18 : kind.effect === 'rice' || kind.effect === 'feathers' || kind.effect === 'straw' ? 40 : 14, 4);
  if (knock.object.wrecked) {
    // A stall in pieces: a cloud of splinters, and its awning and planks sent flying.
    bursts.emit(at, 'splinters', 46, 6);
    const push = sim.truck.body.linvel();
    const awning = kind.parts[kind.parts.length - 1].color;
    wreckage.stall(knock.at, awning, away < 12 ? push : { x: 0, z: 0 });
  }
  if (kind.geyser) geysers.push({ at: new Vector3(knock.at.x, knock.at.y + 0.2, knock.at.z), left: GEYSER_SECONDS, style: kind.effect === 'ice' ? 'ice' : 'water' });
  else if (kind.spills) geysers.push({ at: new Vector3(knock.at.x, knock.at.y + 0.6, knock.at.z), left: SPILL_SECONDS, style: 'spill', from: knock.object.body });
}

function spoutGeysers(dt: number): void {
  for (let i = geysers.length - 1; i >= 0; i--) {
    const g = geysers[i];
    g.left -= dt;
    if (g.left <= 0) geysers.splice(i, 1);
    // A main burst under a manhole: a thick column, higher than a house, and spray drifting off it.
    else if (g.strong) {
      const f = g.left / SPOUT_SECONDS;
      bursts.emit(g.at, 'water', 12, 9 + 6 * f, 4);
      if (Math.random() < 0.3) smoke.emit(splashAt.set(g.at.x, g.at.y + 4 + Math.random() * 6, g.at.z), RISING);
    }
    // A tank burst open, as it goes over: what was in it pouring out of it, a little steam off it, hot.
    else if (g.style === 'spill') {
      const p = g.from?.translation();
      if (p) g.at.set(p.x, p.y + 0.5, p.z);
      bursts.emit(g.at, 'spray', 2, 1.2 + 1.6 * (g.left / SPILL_SECONDS), 0.6);
      if (Math.random() < 0.15) smoke.emit(splashAt.set(g.at.x, g.at.y + 0.3, g.at.z), RISING);
    }
    // A column of water, weakening as the pressure drops; or of crushed ice, still coming down a pipe knocked off its stand.
    else bursts.emit(g.at, g.style ?? 'water', g.style === 'ice' ? 6 : 3, 5 + 5 * (g.left / GEYSER_SECONDS), 3);
  }
}

/** Fires burning in the level (a paper furnace): a column of grey smoke from the chimney, until the thing is knocked over. */
function smoulder(): void {
  for (const index of sim.level.fires ?? []) {
    const thing = sim.objects.objects[index];
    if (!thing || thing.knocked || Math.random() > 0.35) continue;
    const p = thing.body.translation();
    engineSmoke.emit(splashAt.set(p.x, p.y + 5, p.z), RISING);
  }
  for (const [x, y, z] of sim.level.smokes ?? []) if (Math.random() < 0.5) wreckSmoke.emit(splashAt.set(x + (Math.random() - 0.5) * 1.5, y, z + (Math.random() - 0.5) * 1.5), PLUME);
}

/** Firecrackers: a run of flashes and bangs, jumping about as the string does. */
function crackle(dt: number): void {
  smoulder();
  const truckAt = sim.truck.body.translation();
  for (let i = crackles.length - 1; i >= 0; i--) {
    const c = crackles[i];
    c.left -= dt;
    if (c.left <= 0) {
      crackles.splice(i, 1);
      continue;
    }
    if ((c.next -= dt) > 0) continue;
    c.next = c.laid ? 0.03 + Math.random() * 0.05 : 0.05 + Math.random() * 0.09;
    splashAt.set(c.at.x + (Math.random() - 0.5) * 1.6, c.at.y, c.at.z + (Math.random() - 0.5) * 1.6);
    if (c.laid) {
      // Laid on the ground: a hard white flash on the ground, shreds of red paper jumping up, a puff of grey smoke.
      bursts.emit(splashAt.setY(c.at.y + 0.1), 'flash', 3, 0.6, 1);
      bursts.emit(splashAt, 'paper', 4, 3, 1.8, 0xd0302a);
      smoke.emit(splashAt, RISING);
    } else {
      bursts.emit(splashAt, Math.random() < 0.5 ? 'sparks' : 'fire', 5, 3.5, 1.4);
      if (Math.random() < 0.3) smoke.emit(splashAt, RISING);
    }
    const near = hearing(Math.hypot(c.at.x - truckAt.x, c.at.z - truckAt.z));
    if (near > 0) if (!c.laid) audio.pop((0.6 + Math.random() * 0.4) * near);
  }
}

/** Parted wires: flashes at each loose end, close together at first and then further apart, and the crack of each. */
function arcWires(dt: number): void {
  const truckAt = sim.truck.body.translation();
  for (let i = arcs.length - 1; i >= 0; i--) {
    const arc = arcs[i];
    arc.left -= dt;
    if (arc.left <= 0) {
      arcs.splice(i, 1);
      continue;
    }
    if ((arc.next -= dt) > 0) continue;
    arc.next = 0.06 + Math.random() * 0.35 * (1.3 - arc.left / ARC_SECONDS);
    splashAt.set(arc.at.x + (Math.random() - 0.5) * 0.5, arc.at.y + (Math.random() - 0.5) * 0.6, arc.at.z + (Math.random() - 0.5) * 0.5);
    bursts.emit(splashAt, 'arc', 14, 5, 0.7);
    bursts.emit(splashAt, 'sparks', 8, 4);
    const near = hearing(Math.hypot(arc.at.x - truckAt.x, arc.at.z - truckAt.z));
    if (near > 0) audio.thud('bone', (0.6 + Math.random() * 0.4) * near, 0.1);
  }
}

/** Live wire down in the storm, where the level has it lying: its loose ends spitting a few sparks at a time, then quiet a while. */
const liveEnds = (level.sparks ?? []).map((at) => ({ at: new Vector3(...at), next: Math.random() * 2 }));
/** Further from the truck than this, metres, none of it is worth showing. */
const LIVE_SEEN = 70;
function sparkLive(dt: number): void {
  if (!liveEnds.length) return;
  const truckAt = sim.truck.body.translation();
  for (const end of liveEnds) {
    if ((end.next -= dt) > 0) continue;
    // In runs of a few flashes close together, a pause between.
    end.next = Math.random() < 0.6 ? 0.05 + Math.random() * 0.12 : 0.9 + Math.random() * 2.6;
    const far = Math.hypot(end.at.x - truckAt.x, end.at.z - truckAt.z);
    if (far > LIVE_SEEN) continue;
    splashAt.set(end.at.x + (Math.random() - 0.5) * 0.2, end.at.y, end.at.z + (Math.random() - 0.5) * 0.2);
    bursts.emit(splashAt, 'arc', 6, 3, 0.8);
    bursts.emit(splashAt, 'sparks', 7, 3.5, 1.2);
    const near = hearing(far);
    if (near > 0) audio.thud('bone', (0.3 + Math.random() * 0.3) * near, 0.1);
  }
}

/** What is said over each kind of explosion. A shell landing says nothing: there are too many. */
const BLAST_WORDS: Record<string, string> = { gas: '瓦斯爆炸！', drum: '油桶爆炸！', mine: '地雷！', rocket: '火箭彈！', tank: '坦克砲！' };

/** Something going off: a ball of fire, smoke after it, and everything in earshot knows. */
function showBlast(at: { x: number; y: number; z: number; kind?: string }): void {
  splashAt.set(at.x, at.y + 0.6, at.z);
  bursts.emit(splashAt, 'fire', 190, 16, 1.1);
  bursts.emit(splashAt, 'sparks', 110, 20, 1);
  for (let i = 0; i < 30; i++) engineSmoke.emit(contact.set(at.x + (Math.random() - 0.5) * 4.5, at.y + 0.4 + Math.random() * 2.5, at.z + (Math.random() - 0.5) * 4.5), RISING);
  const truckAt = sim.truck.body.translation();
  const near = Math.max(0, 1 - Math.hypot(at.x - truckAt.x, at.z - truckAt.z) / 45);
  if (near === 0) return;
  audio.bump(4 + near * 10);
  audio.knock('barrel', near, 1);
  chase.shake(0.4 + near * 1.8);
  const words = BLAST_WORDS[at.kind ?? 'gas'];
  const spot = words ? toScreen(at, 2.2) : null;
  if (spot) hud.popup(words, spot.x, spot.y, 'big');
}

let fountainTimer = 0;
/** Each fountain within sight throws its water up, a little at a time. */
function playFountains(dt: number): void {
  if ((fountainTimer += dt) < 0.07) return;
  fountainTimer = 0;
  const truckAt = sim.truck.body.translation();
  for (const [x, y, z] of level.fountains ?? []) {
    if (Math.hypot(x - truckAt.x, z - truckAt.z) < 90) bursts.emit(splashAt.set(x, y, z), 'water', 4, 3.2, 2.6);
  }
}

/** How many things lie hidden along the way on this level. */
const hiddenTotal = sim.cargo.filter((c) => c.bonus).length;

function noteEvent(event: CargoEvent): void {
  // Something hidden along the way, aboard for the first time: said large, with its worth over it, and a chime.
  if (event.kind === 'found') {
    const found = sim.cargo.filter((c) => c.bonus && c.aboardOnce).length;
    hud.popup(`找到隱藏貨物！ ${found} / ${hiddenTotal}`, window.innerWidth / 2, window.innerHeight * 0.3, 'found');
    const at = onScreen(event.item);
    if (at) hud.popup(`+${money(event.item.value)}`, at.x, at.y, 'gain');
    uiSound('win');
    return;
  }
  if (event.kind === 'recovered') {
    const at = onScreen(event.item);
    if (at && event.gain >= 1) hud.popup(`+${money(event.gain)}`, at.x, at.y, 'gain');
    return;
  }
  if (event.kind === 'scrap') {
    // Wreckage leaving the truck takes its salvage value with it.
    if (event.change < 0) {
      const entry = pendingLoss.get(event.item) ?? { loss: 0, wait: 0, label: '' };
      entry.loss -= event.change;
      pendingLoss.set(event.item, entry);
    }
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

/** Watching the run for what the boss and the customer would write about, and letting the window run. */
function converse(dt: number, speed: number): void {
  if (sim.result) return;
  const c = chat!;
  c.update(dt);
  if (!sim.started || bannerUp) return;
  if (!said.start) {
    said.start = true;
    c.cue('start');
  }
  const kept = sim.cargoValue() / sim.fullValue;
  if (!said.below60 && kept < 0.6) {
    said.below60 = true;
    c.cue('below60');
  } else if (!said.below30 && kept < 0.3) {
    said.below30 = true;
    c.cue('below30');
  }
  // Every so many people, scooters and cars run into.
  const trip = sim.trip();
  const hits = trip.people + trip.cars;
  if (hits - said.hits >= 6) {
    said.hits = hits;
    c.cue('hits');
  }
  // Standing still in the cab a while, nowhere near the end.
  if (sim.driver.mode === 'driving' && Math.abs(speed) < 0.5) said.still += dt;
  else {
    said.still = 0;
    // Going again: asking why it has stopped would be beside the point now.
    if (Math.abs(speed) > 1.5) c.drop('idle');
  }
  if (said.still > 20) {
    said.still = -60;
    c.cue('idle');
  }
  const away = sim.distanceToFinish();
  if (!said.near && away !== null && away < 70) {
    said.near = true;
    c.cue('near');
  }
  const t = sim.truck.body.translation();
  // Said on the way in to a place; let go unsaid once the truck is out of its way in, past it or turned off.
  level.chat!.places?.forEach(({ zone: [x0, z0, x1, z1] }, k) => {
    const inside = t.x >= x0 && t.x <= x1 && t.z >= z0 && t.z <= z1;
    if (!inside) c.drop('place', k);
    else if (!said.places.has(k)) {
      said.places.add(k);
      c.place(k);
    }
  });
}

let resultShown = false;
// The banner with the manifest stays up until the run begins.
let bannerUp = true;
/** Asked for by the banner's close button, or Enter. */
let closeBanner = false;
hud.onBannerClose = () => (closeBanner = true);
let bannerAge = 0;
let paused = false;
function setPaused(on: boolean): void {
  if (on !== paused) uiSound(on ? 'open' : 'close');
  paused = on;
  audio.setPaused(on);
  hud.showPause(on, { seconds: sim.time, value: sim.cargoValue(), fullValue: sim.fullValue, onTruck: sim.cargoOnTruck(), total: sim.cargo.filter((c) => !c.bonus || !c.fallen).length, hidden: hiddenTotal && !level.practice ? { found: sim.cargo.filter((c) => c.bonus && c.aboardOnce).length, total: hiddenTotal, items: sim.cargo.filter((c) => c.bonus && c.aboardOnce).map((c) => c.type.id) } : undefined }, input.usingPad);
  if (!on) input.clearPresses();
}
hud.onResume = () => setPaused(false);
hud.onPause = () => setPaused(true);
hud.onMenu = () => {
  // The menu is the page without a level chosen.
  location.href = location.pathname;
};
// The keyboard in the pause menu and on the result page, as the controller does it: up and down move along the buttons, Enter presses.
window.addEventListener('keydown', (e) => {
  const page = paused ? document.getElementById('pause') : resultShown ? document.getElementById('result') : null;
  const step = ['ArrowDown', 'KeyS'].includes(e.code) ? 1 : ['ArrowUp', 'KeyW'].includes(e.code) ? -1 : 0;
  if (!page || !step) return;
  // The pause menu's own choices, not the sound and picture settings beside them.
  const list = [...page.querySelectorAll<HTMLElement>(paused ? '.menu-item:not(:disabled)' : 'button:not(:disabled)')].filter((b) => b.offsetParent !== null);
  const at = list.indexOf(document.activeElement as HTMLElement);
  list[at < 0 ? 0 : (at + step + list.length) % list.length]?.focus();
});
// F1 keeps the key list along the bottom up, or lets it go down to its tab again.
window.addEventListener('keydown', (e) => {
  if (e.code !== 'F1') return;
  e.preventDefault();
  hud.toggleHelp();
});
// Looking away pauses it.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !sim.result) setPaused(true);
});
// On the result page of a delivery passed, the one after it.
{
  const at = LEVEL_LIST.findIndex((entry) => entry.id === levelId);
  const next = at >= 0 ? LEVEL_LIST[at + 1] : undefined;
  hud.nextLevel = next ? { id: next.id, name: `第 ${next.badge} 關　${next.name}` } : null;
  hud.onNext = () => {
    if (next) location.search = `?level=${next.id}`;
  };
}
// The retry button on the result page does what R does.
let retryAsked = false;
hud.onRetry = () => {
  // At the end of the tutorial the button goes on to level 1.
  if (level.practice && sim.result) location.search = '?level=hillcity';
  else retryAsked = true;
};

// And the buttons that go back to the save point.
let backAsked = false;
hud.onBackToSave = () => {
  backAsked = true;
};

/** Put everything back as it was at the start of the run; or, `toSave`, as it was at the save point. */
function resetRun(toSave = false): void {
  setPaused(false);
  if (toSave) sim.backToSave();
  else {
    bannerUp = true;
    bannerAge = 0;
    closeBanner = false;
    sim.reset();
    hud.showHelp(15);
  }
  hud.saveAvailable = sim.hasSave;
  levelView.snap();
  ridersView.snap();
  machinesView.snap();
  rigsView.snap();
  truckSync.snap();
  hud.hideResult();
  if (!toSave) hud.showBanner();
  resultShown = false;
  cargoViews.rebuild(sim);
  objectsView.refresh();
  wreckage.clear();
  geysers.length = 0;
  crackles.length = 0;
  arcs.length = 0;
  truckMesh.wash();
  truckSync.apply(1);
  chase.snap(truckMesh.root.position, truckHeading());
  smoke.clear();
  storm?.clear();
  thunders.length = 0;
  engineSmoke.clear();
  wreckSmoke.clear();
  bursts.clear();
  pendingLoss.clear();
  hud.clearPopups();
  if (!toSave) {
    Object.assign(said, { start: false, below60: false, below30: false, near: false, hits: 0, still: 0 });
    said.places.clear();
  }
  chat?.clear(!toSave);
  accumulator = 0;
}
/** A tutorial mishap being shown before the truck is put back: seconds left, and where it goes. */
let mishapLeft = 0;
let retrySpot: { pos: [number, number]; yaw: number } | null = null;

/** Point the HUD arrow at the delivery bay, relative to the way the camera faces. */
function navigate(): void {
  // In the tutorial, at what the lesson is about, when it has a place; at the bay otherwise.
  const target = guide ? guide.goal(sim) ?? (guide.current?.done === 'delivered' ? level.finish?.pos : null) : level.finish?.pos;
  hud.showNav(!!target);
  if (!target) return;
  const dx = target[0] - truckMesh.root.position.x;
  const dz = target[1] - truckMesh.root.position.z;
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

  // With the controller, the right stick points the way to face, a few metres out.
  if (input.usingPad) {
    const stick = input.padAim();
    const aim = stick && {
      x: sim.driver.pos.x + (Math.sin(yaw) * stick.forward - Math.cos(yaw) * stick.right) * 5,
      z: sim.driver.pos.z + (Math.cos(yaw) * stick.forward + Math.sin(yaw) * stick.right) * 5,
    };
    return {
      moveX, moveZ, run: walk.run,
      vehiclePressed: first && input.take('KeyC'),
      grabPressed: first && input.take('KeyF'),
      jumpPressed: first && input.take('Space'),
      aim,
      aimByStick: true,
      charging: input.charging(),
      cancelPressed: first && input.takeRightClick(),
    };
  }
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
    grabPressed: first && input.take('KeyF'),
    jumpPressed: first && input.take('Space'),
    aim: hit ? { x: hit.x, z: hit.z } : null,
    charging: input.charging(),
    cancelPressed: first && input.takeRightClick(),
  };
}

/** A key's name in a hint: the keyboard's, or the controller's when that is what is being used. */
const key = (keys: string, pad: string) => (input.usingPad ? padText(pad) : keys);

/** The one-line hint about what the nearest action is. */
function updatePrompt(): void {
  const { driver, truck, cargoSystem } = sim;
  if (sim.result) return hud.setPrompt('');
  if (driver.mode === 'driving') {
    if (sim.level.wet && sim.wetAt(truck.body.translation())) return hud.setPrompt('水泥還沒乾，開不快', true);
    if (truck.grip < 1 && !sim.fordAt(truck.body.translation())) {
      // Oil, unless what it is on is gravel spilt from a lorry, or crushed ice.
      const at = truck.body.translation();
      const look = sim.level.slicks?.find((k) => Math.abs(at.x - k.pos[0]) < k.half[0] && Math.abs(at.z - k.pos[1]) < k.half[1])?.look;
      return hud.setPrompt(look === 'gravel' ? '路面有砂石，小心打滑' : look === 'ice' ? '路面結冰，小心打滑' : '路面有油，小心打滑', true);
    }
    const slow = Math.abs(truck.forwardSpeed()) < DRIVER.exitSpeed;
    // Something found lying along the way is only worth getting out for once it is close.
    const t = truck.body.translation();
    const toFetch = sim.cargo.some((c) => c.fallen && c.body && (!c.bonus || (level.practice && Math.hypot(c.body.translation().x - t.x, c.body.translation().z - t.z) < 20)));
    return hud.setPrompt(slow && toFetch ? `<b>${key('C', 'Y')}</b> 下車撿貨` : '');
  }
  if (driver.mode === 'down') return hud.setPrompt('被撞倒了…', true);
  if (driver.atLeash) return hud.setPrompt('離貨車太遠了', true);
  if (driver.tooHeavyLeft > 0) return hud.setPrompt('太重了，跳不起來', true);
  if (driver.charge > 0) return hud.setPrompt(`放開${key('左鍵', ' RT ')}拋出　<b>${key('右鍵', 'LT')}</b> 取消`);
  if (driver.held) return hud.setPrompt(`<b>按住${key('左鍵', ' RT')}</b> 蓄力拋出　<b>${key('F', 'B')}</b> 放下`);
  if (driver.withinReach(truck, cargoSystem)) return hud.setPrompt(`<b>${key('F', 'B')}</b> 舉起`);
  if (driver.nearDoor(truck)) return hud.setPrompt(`<b>${key('C', 'Y')}</b> 上車`);
  hud.setPrompt('');
}

/** Whether the driver was down last frame, to feel them go down once. */
let wasDown = false;

/** Work the buttons of a page shown over the game with the controller. */
function padMenu(page: HTMLElement, back?: () => void): void {
  const { pad } = input;
  if (!pad.connected) return;
  const list = [...page.querySelectorAll<HTMLElement>('button:not(:disabled), input')].filter((b) => b.offsetParent !== null);
  bumpControls(page, pad.take('lb'), pad.take('rb'));
  padNavigate(pad, list);
  const focused = document.activeElement as HTMLElement | null;
  if (pad.take('a') && focused && list.includes(focused)) {
    focused.click();
    // What was pressed was a menu button, not the handbrake or a jump.
    input.clearPresses();
  }
  if (pad.take('b') && back) {
    back();
    input.clearPresses();
  }
}

function frame(now: number): void {
  const began = performance.now();
  const before = last;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  accumulator += dt;

  input.poll();
  // A key or a click starts the sound; the controller's buttons do too.
  if (input.pad.anyPress) {
    audio.unlock();
    wakeMusic();
  }
  // The controller in use gone, flat or out of reach: the run waits for it, paused, and says why.
  if (input.pad.lost) {
    input.pad.lost = false;
    if (input.usingPad && !resultShown) {
      if (!paused) setPaused(true);
      hud.padLost(true);
    }
  }
  if (input.pad.connected) hud.padLost(false);
  // The controller's View: the key list along the bottom kept up, or let go, as F1 does.
  if (input.pad.take('back')) hud.toggleHelp();
  // Esc pauses and resumes; asked whether to leave, it goes back to the choices; over the result page, nothing.
  if ((input.take('Escape') || input.take('KeyP')) && !resultShown && !(paused && hud.cancelLeave())) setPaused(!paused);
  // The controller in the pause menu and on the result page: the d-pad or stick moves along the buttons, A presses, B goes on.
  if (paused) padMenu(document.getElementById('pause')!, () => setPaused(false));
  else if (resultShown) {
    // On the result page, besides A for the one chosen: X goes again, B to the menu, as said on them.
    const retry = document.getElementById('result-retry')!;
    if (input.pad.connected && input.pad.take('x') && retry.querySelector('[data-pad="X"]')) retry.click();
    padMenu(document.getElementById('result')!, () => document.getElementById('result-menu')!.click());
  }
  if (paused && !retryAsked && !backAsked) {
    // Nothing moves; the picture stays as it was.
    accumulator = 0;
    graphics.rest();
    view.renderer.render(view.scene, view.camera);
    requestAnimationFrame(frame);
    return;
  }

  // For testing: a number key puts the truck down just before that part of the level.
  if (TESTING && sim.driver.mode === 'driving') {
    const spots = sim.level.checkpoints ?? [];
    spots.forEach((spot, k) => {
      if (k > 9 || !input.take(`Digit${(k + 1) % 10}` as `Digit${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`)) return;
      sim.teleport(spot.pos[0], spot.pos[1], spot.yaw, spot.y);
      truckSync.snap();
      // Moved with it, not made again: what has been wrecked on the way has no body to be made from.
      cargoViews.snap();
      truckSync.apply(1);
      chase.snap(truckMesh.root.position, truckHeading());
      hud.popup(`跳到：${spot.name}`, window.innerWidth / 2, window.innerHeight * 0.3, 'big');
    });
  }

  // Starting over is only from the pause menu or the result page: no key for it, so that it is never pressed by mistake.
  if (retryAsked) {
    retryAsked = false;
    backAsked = false;
    resetRun();
    guide?.restart();
  }
  if (backAsked) {
    backAsked = false;
    if (sim.hasSave) {
      resetRun(true);
      chat?.cue('back');
    }
  }
  // Through the save point: said so, once.
  if (sim.takeSaved()) {
    hud.saveAvailable = true;
    hud.popup('已記錄存檔點', window.innerWidth / 2, window.innerHeight * 0.3, 'big');
    uiSound('confirm');
    chat?.cue('save');
  }

  // Fallen in the water on foot: dark for the moment they are fished out, and light again after.
  if (!guide || !mishapLeft) document.getElementById('fade')!.classList.toggle('on', sim.driver.sinking > 0 && sim.driver.sinking < 0.5);

  // The tutorial: a mishap puts the truck back to try that part again, after a moment to see what happened.
  if (guide && !mishapLeft) {
    const mishap = sim.takeMishap();
    if (mishap) {
      mishapLeft = mishap === 'train' ? 1.4 : 0.5;
      retrySpot = guide.mishap();
    }
  } else if (guide && mishapLeft > 0) {
    mishapLeft -= dt;
    // Dark for the last moment before it is put back, and light again after.
    if (mishapLeft < 0.45) document.getElementById('fade')!.classList.add('on');
    if (mishapLeft <= 0) {
      mishapLeft = 0;
      resetRun();
      if (retrySpot) {
        sim.teleport(retrySpot.pos[0], retrySpot.pos[1], retrySpot.yaw);
        truckSync.snap();
        cargoViews.snap();
        truckSync.apply(1);
        chase.snap(truckMesh.root.position, truckHeading());
      }
      document.getElementById('fade')!.classList.remove('on');
    }
  }

  bannerAge += dt;
  // Closed by hand, with its button or Enter; or of itself, once the run has begun.
  if (input.take('Enter')) closeBanner = true;
  if (bannerUp && (closeBanner || (level.startLine ? sim.started : bannerAge > 6))) {
    closeBanner = false;
    bannerUp = false;
    hud.dismissBanner();
  }

  const drive = input.drive();
  // One crash is spread over several steps: it is heard once, as hard as its hardest.
  let hardestBump = 0;
  let steps = 0;
  while (accumulator >= PHYSICS.dt && steps < PHYSICS.maxStepsPerFrame) {
    const stepBegan = performance.now();
    sim.step(drive, footInput(steps === 0));
    timing.physics += performance.now() - stepBegan;
    for (const event of sim.drainEvents()) {
      cargoViews.handle(event);
      noteEvent(event);
      if (event.kind === 'fallen' && !event.item.bonus) chat?.cue('fallen');
      else if (event.kind === 'destroyed') chat?.cue('destroyed', event.item.type.id);
      if (event.kind === 'destroyed' && input.usingPad) input.pad.rumble(0.45, 160);
      else if (event.kind === 'found') chat?.cue('found', event.item.type.id);
      soundCargoEvent(event);
    }
    for (const knock of sim.drainKnocks()) showKnock(knock);
    for (const blast of sim.drainBlasts()) showBlast(blast);
    for (const end of sim.drainArcs()) {
      arcs.push({ at: new Vector3(end.x, end.y, end.z), left: ARC_SECONDS * (0.7 + Math.random() * 0.5), next: 0 });
      bursts.emit(splashAt.set(end.x, end.y, end.z), 'arc', 40, 9, 0.8);
    }
    for (const sound of sim.drainBattleSounds()) {
      const from = sim.truck.body.translation();
      const near = hearing(Math.hypot(sound.x - from.x, sound.z - from.z));
      if (near === 0) continue;
      if (sound.kind === 'gun') audio.thud('bone', 0.5 + near * 0.5, 0.1);
      else if (sound.kind === 'launch') audio.whoosh(near, false);
      else if (sound.kind === 'whistle') audio.whoosh(near, true);
      else audio.bump(5 + near * 8);
    }
    if (sim.drainShots() > 0) {
      // Rounds going into the load: chips off whatever they hit, and the sound of it.
      const from = sim.truck.body.translation();
      bursts.emit(splashAt.set(from.x, from.y + 1.2, from.z), 'splinters', 8, 4);
      audio.thud('wood', 0.7, 0.2);
    }
    for (const crash of sim.drainPileups()) {
      // One car into the back of another: metal on metal, with weight behind it.
      const at = sim.truck.body.translation();
      const near = hearing(Math.hypot(crash.x - at.x, crash.z - at.z));
      if (near > 0) audio.crunch(Math.min(1, crash.speed / 12) * near);
      // Something of tonnes into it: a crash as loud as a wall, and the ground shakes.
      if (crash.heavy && near > 0) {
        audio.crunch(near);
        audio.thud('heavy', near, 1);
        audio.bump(near);
      }
      const y = (terrain ? heightAt(terrain, crash.x, crash.z) : 0) + 0.8;
      bursts.emit(splashAt.set(crash.x, y, crash.z), 'sparks', crash.heavy ? 30 : 12, crash.heavy ? 7 : 4);
    }
    for (const horn of sim.drainHorns()) {
      const at = sim.truck.body.translation();
      const near = hearing(Math.hypot(horn.x - at.x, horn.z - at.z));
      if (near > 0 && !sim.result) audio.horn(near, horn.long, horn.car);
    }
    for (const gate of levelView.takeBroken()) {
      bursts.emit(splashAt.set(gate.x, gate.y, gate.z), 'splinters', 30, 6);
      audio.knock('wood', 0.9, 0.3);
    }
    hardestBump = Math.max(hardestBump, ...sim.drainBumps());
    for (const strike of sim.drainStrikes()) {
      bursts.emit(splashAt.set(strike.x, strike.y + 0.5, strike.z), 'sparks', 60, 9);
      const at = toScreen(strike, 2);
      if (at) hud.popup('被火車撞飛！', at.x, at.y, 'big');
      chat?.cue('train');
    }
    // A wave breaking over a sea wall: spray all along it, where it is near enough to be seen and heard.
    for (const { desc, big } of sim.waves.drainBreaks()) {
      const t = sim.truck.body.translation();
      const long = Math.hypot(desc.to[0] - desc.from[0], desc.to[1] - desc.from[1]);
      let heard = false;
      for (let d = 2; d < long; d += 5) {
        if (desc.lee?.some(([a, b]) => d > a && d < b)) continue;
        const x = desc.from[0] + ((desc.to[0] - desc.from[0]) * d) / long, z = desc.from[1] + ((desc.to[1] - desc.from[1]) * d) / long;
        if (Math.hypot(x - t.x, z - t.z) > 80) continue;
        heard = true;
        bursts.emit(splashAt.set(x, (desc.y ?? 0) + 0.4, z), 'water', big ? 40 : 22, big ? 10 : 7, 2);
      }
      // Over the boardwalk low enough for it: up over its seaward side and across it.
      for (const { pos, half, yaw } of desc.wash ?? []) {
        if (Math.hypot(pos[0] - t.x, pos[1] - t.z) > 80 || sheltered(desc, pos[0], pos[1])) continue;
        heard = true;
        const c = Math.cos(yaw), s = Math.sin(yaw);
        for (let d = -half[1]; d <= half[1]; d += 4) for (const across of [half[0], 0]) {
          const side = Math.sign(-desc.inland[0] * c + desc.inland[1] * s) * across;
          bursts.emit(splashAt.set(pos[0] + side * c + d * s, (desc.y ?? 0) + 0.5, pos[1] - side * s + d * c), 'water', big ? 30 : 16, big ? 8 : 5, 2);
        }
      }
      if (heard) audio.splash(true);
    }
    for (const splash of sim.drainSplashes()) {
      // Something knocked into a settling pond far off by a machine, unseen: unheard too.
      const at = sim.truck.body.translation();
      if (splash.muddy && Math.hypot(splash.x - at.x, splash.z - at.z) > 70) continue;
      const big = splash.mass > 400;
      if (splash.still) {
        // Into standing water, where things lie about in it to be knocked in one after another: heard as near as it is and
        // as big as it was, a polystyrene box a plop, the far ones not at all; thrown up as much.
        const near = hearing(Math.hypot(splash.x - at.x, splash.z - at.z)), size = Math.min(1, Math.max(0.15, splash.mass / 120));
        bursts.emit(splashAt.set(splash.x, splash.y + 0.1, splash.z), splash.muddy ? 'mud' : level.light === 'storm' ? 'flood' : 'water', big ? 40 : Math.round(4 + 10 * size), big ? 6 : 2 + 2 * size, 2);
        if (near > 0) audio.splash(big, (0.45 + 0.55 * near) * (big ? 1 : 0.55 + 0.45 * size));
        continue;
      }
      bursts.emit(splashAt.set(splash.x, splash.y + 0.2, splash.z), splash.muddy ? 'mud' : 'water', big ? 90 : 24, big ? 9 : 5, 2);
      audio.splash(big);
    }
    for (const person of sim.drainPedestrianHits()) showHit(person.pos, person.crowd.shouts ?? SHOUTS, false);
    // Water up out of the road: a column, for a while, and the sound of it.
    for (const spout of sim.drainSpouts()) {
      geysers.push({ at: new Vector3(spout.x, spout.y + 0.1, spout.z), left: SPOUT_SECONDS, strong: true });
      const t = sim.truck.body.translation();
      const away = Math.hypot(spout.x - t.x, spout.z - t.z);
      if (away < 40) {
        audio.splash(true);
        // The iron lid knocked up off its seat.
        if (spout.lifted) audio.thud('metal', Math.max(0.2, 1 - away / 40), 0.6);
      }
    }
    for (const rider of sim.drainRiderHits()) {
      if (rider.kind !== 'scooter') {
        // A god's chair, or a mover's sofa or wardrobe: wood splitting, stuffing, and the bearers' cries.
        const load: ObjectKind | undefined = rider.load ? OBJECT_KINDS[rider.load] : undefined;
        const metal = load?.effect === 'sparks';
        audio.smash(metal ? 'metal' : 'wood', 0.8);
        audio.thud(metal ? 'metal' : 'wood', 0.9, 0.8);
        bursts.emit(splashAt.set(rider.person.x, rider.person.y + 1.5, rider.person.z), load?.effect && load.effect !== 'ash' ? load.effect : 'splinters', 30, 5);
        const spot = toScreen(rider.person, 1.8);
        if (spot) hud.popup(RIDER_SHOUTS[Math.floor(Math.random() * RIDER_SHOUTS.length)], spot.x, spot.y, 'big');
      } else showHit(rider.person, RIDER_SHOUTS, true);
    }
    levelView.capture();
    ridersView.capture();
    machinesView.capture();
    rigsView.capture();
    worksite();
    truckSync.capture();
    cargoViews.capture();
    accumulator -= PHYSICS.dt;
    steps++;
  }
  // Drop the backlog rather than spiral if the frame rate can't keep up.
  if (accumulator >= PHYSICS.dt) accumulator = 0;

  const alpha = accumulator / PHYSICS.dt;
  levelView.apply(alpha);
  ridersView.apply(alpha);
  machinesView.apply(alpha);
  truckSync.apply(alpha);
  cargoViews.apply(alpha);
  cargoViews.update(dt);
  // In a building driven up through, what is on the storeys above the truck is not drawn, as the storeys are not.
  // Under a roof over a hall, what is up on top of it is not drawn either.
  objectsView.update(cutaway ? sim.truck.body.translation().y + 2.7 : undefined, lidded ? lidHides : undefined);
  skylightsView?.update(lidded ? lidHides : undefined);
  {
    const t = sim.truck.body.translation();
    rigsView.apply(alpha, now / 1000, view.camera.position, lampTruck.set(t.x, t.y, t.z));
  }
  objectsView.blink(now % 1100 < 550);
  wreckage.update(dt);
  pedestriansView.update(dt);
  spoutGeysers(dt);
  crackle(dt);
  arcWires(dt);
  sparkLive(dt);
  battleView.update(dt, truckMesh.root.position, level.battle);
  // The truck's horn: from the cab only, and not again until it has finished. Whoever is near on foot runs.
  hornWait -= dt;
  if (input.take('KeyH') && sim.driver.mode === 'driving' && !sim.result && hornWait <= 0) {
    hornWait = 0.7;
    sim.honk();
    audio.truckHorn();
  }
  // Locked on to: the ring closes in on the truck as the moment comes, and the beeps crowd together.
  const threat = sim.result ? null : sim.battle.threat;
  const ringAt = threat ? toScreen(truckMesh.root.position, 1) : null;
  lockRing.hidden = !ringAt;
  if (threat && ringAt) {
    lockRing.style.left = `${ringAt.x}px`;
    lockRing.style.top = `${ringAt.y}px`;
    lockRing.style.setProperty('--close', String(1 - threat.lock));
    lockRing.lastElementChild!.textContent = threat.kind === 'tank' ? '坦克瞄準中' : '火箭筒鎖定中';
    if ((beepWait -= dt) <= 0) {
      beepWait = 0.5 - threat.lock * 0.42;
      audio.beep(threat.lock);
    }
  }
  playFountains(dt);
  truckMesh.updateWheels(sim.truck);
  // The truck shows what it has been through: battered, then smoking. It drives the same.
  const wearStage = WEAR_STAGES.filter((wear) => sim.truckWear >= wear).length;
  truckMesh.setDamage(wearStage, view.scene, sim.truck.body.linvel());
  truckMesh.updatePieces(dt);
  engineTimer += dt;
  if (wearStage >= 2 && engineTimer >= ENGINE_SMOKE_INTERVAL[wearStage]) {
    engineTimer = 0;
    engineSmoke.emit(truckMesh.smokePoint(contact), RISING);
  }

  const { driver } = sim;
  const onFoot = driver.mode !== 'driving';
  const truckAt = truckMesh.root.position;
  driverView.update(dt, driver, truckAt);
  // The camera, the see-through buildings and the shadows all centre on whoever is being played.
  const focus = onFoot ? driverView.root.position : truckAt;

  const speed = sim.truck.forwardSpeed();
  // Hitting a tree is a crash like hitting a wall, bent metal and all, with the tree's own
  // noise on top. Hitting a cone is mostly the cone.
  soundKnocks(dt);
  // Felt through the controller: the truck's knocks by how hard, the hardest crashes hardest.
  if (sim.driver.mode === 'down' && !wasDown && input.usingPad) input.pad.rumble(0.8, 350);
  wasDown = sim.driver.mode === 'down';
  if (hardestBump > 0 && input.usingPad) input.pad.rumble(Math.min(1, hardestBump / 14), 120 + Math.min(1, hardestBump / 14) * 180);
  if (hardestBump > 0) audio.bump(knockedWeight < 0 ? hardestBump : hardestBump * (0.45 + 0.55 * knockedWeight));
  knockedWeight = -1;
  audio.update(dt, {
    speed, throttle: sim.result ? 0 : drive.throttle, boosting: sim.truck.boosting, driving: !onFoot,
    skid: onFoot ? 0 : skidding(drive, speed), train: trainNearness(), bell: bellRinging(), river: riverNearness(),
    roof: outageView?.under(focus) ? 1 : 0,
    storm: stormy ? stormAt(focus, !!outageView?.under(focus)) : undefined,
  });
  // On foot, the right stick aims rather than zooms or looks round; the right button cancels a throw.
  chase.addZoom(input.takeWheel(!onFoot));
  const lookDrag = input.takeLookDrag();
  // On foot the right button still turns the view, unless a throw is being wound up, when it cancels it; the stick aims.
  // Q and E turn the view as the stick does: held round while driving, turned for good on foot.
  chase.lookAround(lookDrag, input.rightDown, onFoot ? 0 : input.pad.rightX || input.turnKeys(), !onFoot && !!input.pad.rightX);
  chase.turnOnFoot(onFoot ? input.footTurn(!!driver.held) : 0);
  if (!debug.freeze) chase.update(dt, focus, onFoot ? null : truckHeading(), speed, sim.truck.boosting);
  if (rain && windView) {
    // Out of an alley's mouth in a gust, the rain goes near flat along it.
    const t = sim.truck.body.translation(), [wx, wz] = sim.wind.at(t.x, t.z);
    rain.blow(wx * GUST_RAIN, wz * GUST_RAIN, dt);
  }
  squallUndo();
  if (outageView) {
    const was = outageView.gone;
    outageView.update(dt, focus);
    if (was < 0 && outageView.gone >= 0) audio.powerCut();
    murmur(dt, outageView.gone);
    // No rain under the hall's roof.
    rain?.show(!outageView.under(focus));
  }
  rain?.update(dt, view.camera.position);
  if (storm) {
    const indoors = !!outageView?.under(focus), [wx, wz] = sim.wind.at(focus.x, focus.z);
    const flash = storm.update(dt, view.camera, view.renderer.domElement.height, focus, indoors, [5 + wx * GUST_RAIN, 2 + wz * GUST_RAIN]);
    // The thunder as long after as it is far off: a near one hard on the flash, a far one seconds later.
    if (flash) thunders.push({ in: 0.25 + (1 - flash.near) * 6, near: flash.near });
    for (let i = thunders.length - 1; i >= 0; i--) if ((thunders[i].in -= dt) <= 0) {
      audio.thunder(thunders[i].near, indoors);
      thunders.splice(i, 1);
    }
  }
  squallUpdate(dt, !!outageView?.under(focus));
  if (crewLights.length) aimCrewLights();
  if (talkers.length) talk(dt);
  windView?.update(dt);
  if (lampsView) {
    const r = sim.truck.body.rotation();
    lampsView.update(dt, sim.truck.body.translation(), Math.atan2(2 * (r.w * r.y + r.x * r.z), 1 - 2 * (r.y * r.y + r.x * r.x)), sim.truck.forwardSpeed());
  }
  wavesView?.update();
  if (!onFoot) {
    emitSmoke(dt, drive, speed);
    kickRice(dt, speed);
  }
  moult();
  smoke.update(dt);
  engineSmoke.update(dt);
  wreckSmoke.update(dt);
  bursts.update(dt);
  levelView.update(dt, view.camera, focus);
  aimSun(view, focus);

  hud.setMode(onFoot, input.usingPad);
  if (hiddenTotal && !level.practice) hud.setHidden(sim.cargo.filter((c) => c.bonus && c.aboardOnce).length, hiddenTotal);
  hud.tickHelp();
  // Something found along the way counts toward the load once it is aboard, not while it still lies where it was found.
  hud.update(speed, sim.cargoOnTruck(), sim.cargo.filter((c) => !c.bonus || !c.fallen).length, sim.cargoValue(), sim.fullValue, sim.time);
  updatePrompt();
  guide?.update(dt, sim, input.usingPad);
  if (chat) converse(dt, speed);
  // The bay only takes the load once the last lesson, delivering, is the one being taught.
  if (guide) sim.finishShut = !!guide.current && guide.current.done !== 'delivered';
  navigate();
  // Nothing hidden along the way is given away: it is on the map only once it has been aboard.
  const fallen = sim.cargo.filter((c) => c.fallen && c.body && !c.held && (!c.bonus || c.aboardOnce || level.practice)).map((c) => ({ x: c.lastPos.x, z: c.lastPos.z }));
  minimap.saved = sim.hasSave;
  minimap.update(
    dt, truckAt.x, truckAt.z, truckHeading(), chase.viewYaw, sim.traffic.cars, fallen,
    onFoot ? { x: driver.pos.x, z: driver.pos.z, leash: DRIVER.leash } : null,
    sim.trains.trains,
  );
  if (sim.result && !resultShown) {
    // Only deliveries keep a record.
    const records = level.finish ? saveBest(levelId, sim.result) : undefined;
    uiSound(sim.result.failure || sim.result.stars === 0 ? 'fail' : 'win');
    hud.showResult(sim.result, sim.fullValue, records);
    chat?.clear(false);
    resultShown = true;
  }
  showPopups(dt);

  const drawBegan = performance.now();
  view.renderer.render(view.scene, view.camera);
  const drawn = performance.now();
  timing.render += drawn - drawBegan;
  timing.logic += drawBegan - began;
  timing.frames++;
  timing.worst = Math.max(timing.worst, drawn - began);
  // A tab in the background is hardly drawn at all: that is not the machine being slow.
  if (document.hidden) graphics.rest();
  else graphics.frame((now - before) / 1000);
  requestAnimationFrame(frame);
}

// Every material the level uses made ready to draw before the first frame, not during the first seconds of driving.
setStage(2, 0.8);
await settle();
view.renderer.compile(view.scene, view.camera);
// And one frame drawn behind the loading screen with everything in it, seen or not, hidden for now or not: the shadow's own
// shaders, which compiling leaves out, and every shape and picture sent to the graphics card now rather than on the way.
{
  const was: [Object3D, boolean, boolean][] = [];
  view.scene.traverse((o) => { was.push([o, o.visible, o.frustumCulled]); o.visible = true; o.frustumCulled = false; });
  view.renderer.render(view.scene, view.camera);
  // Again with what fades faded: its see-through shaders.
  levelView.seeThrough(true);
  view.renderer.render(view.scene, view.camera);
  levelView.seeThrough(false);
  for (const [o, visible, culled] of was) { o.visible = visible; o.frustumCulled = culled; }
}
// Going before the loading screen fades: what it fades off is the game as it is, not the picture drawn to make ready,
// everything in it, roofs and all, see-through, from wherever the camera began.
last = performance.now();
requestAnimationFrame(frame);
await finishLoading();
