import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import { DRIVER, PHYSICS } from './config';
import { Graphics, type QualityChoice } from './graphics';
import { Hud, money } from './hud';
import { Input } from './input';
import { GameAudio, type Material } from './audio';
import { saveBest } from './best';
import { playMusic, uiSound } from './jukebox';
import { FIRST_LEVEL, LEVELS } from './levels';
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
const sim = await Sim.create(level);
const view = createView(canvas, level);
const input = new Input(canvas);
const hud = new Hud(level);
// On ground that rises and falls, the view is from lower and further back, looking further ahead: from high above, a hill looks flat.
const terrain = level.terrain;
const chase = new ChaseCamera(view.camera, terrain ? { height: 9, distance: 13, lookAhead: 7, ground: (x, z) => heightAt(terrain, x, z, sim.truck.body.translation().y + 3) } : undefined);
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

const objectsView = new ObjectsView(view.scene, sim.objects.objects);
const wreckage = new Wreckage(view.scene);
const pedestriansView = new PedestriansView(view.scene, sim.pedestrians.list);
const ridersView = new RidersView(view.scene, sim.riders.list);
const machinesView = new MachinesView(view.scene, sim.machines.list);
/** Testing tools: only when run locally from the dev server. The published build has none of it. */
const TESTING = import.meta.env.DEV;
if (TESTING && sim.level.checkpoints?.length) {
  const list = document.createElement('div');
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
const debug = { sim, camera: view.camera, scene: view.scene, renderer: view.renderer, freeze: false, audio };
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
/** Broken hydrants, still spouting where they stood. */
const geysers: { at: Vector3; left: number; strong?: boolean }[] = [];
const CRACKLE_SECONDS = 3.2;
/** Strings of firecrackers going off where they fell, and how long until each one's next bang. */
const crackles: { at: Vector3; left: number; next: number; laid?: boolean }[] = [];
/** Loose ends of live wire, each spitting sparks for a while yet, and how long until its next flash. */
const arcs: { at: Vector3; left: number; next: number }[] = [];
const ARC_SECONDS = 3.5;
/** Within this far of the truck, something bursting bursts over it. */
const SPLASH_REACH = 7;

/** Something has just been sent flying: throw up whatever it is made of. */
/** Things that sound of neither wood nor metal when hit. */
const SOFT = new Set(['cone', 'box', 'chair', 'umbrella', 'toilet', 'chickenWhite', 'chickenBrown', 'chickenBlack', 'trayGrain', 'trayVeg', 'riceSack', 'mattress', 'sofa']);
/** Hollow metal: a boom rather than a ring. */
const HOLLOW = new Set(['barrel', 'bin']);
/** Rock. */
const STONE = new Set(['boulder', 'rockSmall']);

/** What a roadside object sounds like, from what it is. */
function materialOfObject(object: KnockEvent['object']): Material {
  const { kind, desc } = object;
  if (kind.effect === 'shards') return 'ceramic';
  if (kind.effect === 'leaves') return 'tree';
  if (kind.effect === 'splinters') return 'wood';
  if (HOLLOW.has(desc.kind)) return 'barrel';
  // Stone: no ring to it, only the dead weight; the crash is the truck's, as against a wall.
  if (STONE.has(desc.kind)) return 'heavy';
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
  if (kind.geyser) geysers.push({ at: new Vector3(knock.at.x, knock.at.y + 0.2, knock.at.z), left: GEYSER_SECONDS });
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
    // A column of water, weakening as the pressure drops.
    else bursts.emit(g.at, 'water', 3, 5 + 5 * (g.left / GEYSER_SECONDS), 3);
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

function noteEvent(event: CargoEvent): void {
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
  hud.showPause(on, { seconds: sim.time, value: sim.cargoValue(), fullValue: sim.fullValue, onTruck: sim.cargoOnTruck(), total: sim.cargo.length });
  if (!on) input.clearPresses();
}
hud.onResume = () => setPaused(false);
hud.onPause = () => setPaused(true);
hud.onMenu = () => {
  // The menu is the page without a level chosen.
  location.href = location.pathname;
};
// Looking away pauses it.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !sim.result) setPaused(true);
});
// The retry button on the result page does what R does.
let retryAsked = false;
hud.onRetry = () => {
  retryAsked = true;
};

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
    if (truck.grip < 1) return hud.setPrompt('路面有油，小心打滑', true);
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
  const before = last;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  accumulator += dt;

  if (input.take('Escape') || input.take('KeyP')) setPaused(!paused);
  if (paused && !retryAsked) {
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
      sim.teleport(spot.pos[0], spot.pos[1], spot.yaw);
      truckSync.snap();
      cargoViews.rebuild(sim);
      truckSync.apply(1);
      chase.snap(truckMesh.root.position, truckHeading());
      hud.popup(`跳到：${spot.name}`, window.innerWidth / 2, window.innerHeight * 0.3, 'big');
    });
  }

  if (input.take('KeyR') || retryAsked) {
    retryAsked = false;
    setPaused(false);
    bannerUp = true;
    bannerAge = 0;
    closeBanner = false;
    sim.reset();
    levelView.snap();
    ridersView.snap();
    machinesView.snap();
    truckSync.snap();
    hud.hideResult();
    hud.showBanner();
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
    engineSmoke.clear();
    wreckSmoke.clear();
    bursts.clear();
    pendingLoss.clear();
    hud.clearPopups();
    accumulator = 0;
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
    sim.step(drive, footInput(steps === 0));
    for (const event of sim.drainEvents()) {
      cargoViews.handle(event);
      noteEvent(event);
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
    }
    for (const splash of sim.drainSplashes()) {
      const big = splash.mass > 400;
      bursts.emit(splashAt.set(splash.x, splash.y + 0.2, splash.z), 'water', big ? 90 : 24, big ? 9 : 5, 2);
      audio.splash(big);
    }
    for (const person of sim.drainPedestrianHits()) showHit(person.pos, SHOUTS, false);
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
  objectsView.update();
  objectsView.blink(now % 1100 < 550);
  wreckage.update(dt);
  pedestriansView.update(dt);
  spoutGeysers(dt);
  crackle(dt);
  arcWires(dt);
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
  if (hardestBump > 0) audio.bump(knockedWeight < 0 ? hardestBump : hardestBump * (0.45 + 0.55 * knockedWeight));
  knockedWeight = -1;
  audio.update(dt, {
    speed, throttle: sim.result ? 0 : drive.throttle, boosting: sim.truck.boosting, driving: !onFoot,
    skid: onFoot ? 0 : skidding(drive, speed), train: trainNearness(), bell: bellRinging(),
  });
  chase.addZoom(input.takeWheel());
  if (!debug.freeze) chase.update(dt, focus, onFoot ? null : truckHeading(), speed, sim.truck.boosting);
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

  hud.setMode(onFoot);
  hud.update(speed, sim.cargoOnTruck(), sim.cargo.length, sim.cargoValue(), sim.fullValue, sim.time);
  updatePrompt();
  navigate();
  const fallen = sim.cargo.filter((c) => c.fallen && c.body && !c.held).map((c) => ({ x: c.lastPos.x, z: c.lastPos.z }));
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
    resultShown = true;
  }
  showPopups(dt);

  view.renderer.render(view.scene, view.camera);
  // A tab in the background is hardly drawn at all: that is not the machine being slow.
  if (document.hidden) graphics.rest();
  else graphics.frame((now - before) / 1000);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
