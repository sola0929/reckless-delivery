import { standardLoad } from './sandbox';
import type { ObjectDesc } from './objects';
import type { BattleDesc, CrowdDesc, DecalDesc, LevelDef, PitDesc, PropDesc } from './types';

// A proving ground for the battlefield: a straight road with one of each thing a battle
// throws at the truck, one after another, to try the feel of each before a level is built
// out of them. Nothing is at stake here.
//
//   z  40 - 110   shelling
//   z 130 - 205   the two armies firing across the road: wrecks to keep behind, wire in the way
//   z 225 - 290   two rocket launchers, mud in the road, walls to hide behind
//   z 310 - 380   tanks here and there, and both armies' soldiers wandering about them
//   z 400 - 450   smoke, with wrecks and fuel drums in it
//   z 470 - 530   mines
//
// None of it is to be got through by going flat out in a straight line: something is always
// standing, lying or about to land where that would take the truck. The ground itself is
// broken all the way: wrecks to go round, mounds that tip the truck, craters that jolt it.

const WRECK = 0x4a4f48;
const EARTH = 0x6e6048;
/** Wrecks: [x, z, turned]. */
const WRECKS = [
  [4, 46, 0.3], [-3, 80, -0.5], [6, 92, 1.1],
  [-3.5, 146, 0.25], [4, 162, -0.3], [-2.5, 178, 1.3], [4.5, 194, 0.1],
  [-6.5, 256, 0.2], [3, 292, 1],
  [2, 330, 0.8], [-3, 372, -0.4],
  [-4, 415, 0.4], [4.5, 428, -0.5], [-2.5, 440, 1.2],
];
/** Shell holes, a foot deep: [x, z, half across]. */
const CRATERS = [
  [3, 52, 1.5], [-5, 70, 1.8], [1.5, 88, 1.4], [6, 104, 1.6],
  [-1, 140, 1.5], [5, 172, 1.4], [-5, 190, 1.7],
  [4, 234, 1.5], [-6, 264, 1.6], [5, 284, 1.8],
  [4, 318, 1.5], [-4, 356, 1.7], [6, 368, 1.4],
  [2, 406, 1.6], [-6, 433, 1.4],
  [-4, 486, 1.4],
];
/** Mounds of thrown-up earth, low enough to drive over and steep enough to tip what does: [x, z, radius, height]. */
const MOUNDS = [
  [-5, 60, 3, 0.6], [5, 68, 2.6, 0.5], [-1, 98, 3.2, 0.6],
  [1, 156, 2.8, 0.55], [-6, 172, 3, 0.6], [2, 201, 2.6, 0.5],
  [5, 247, 3, 0.6], [-3, 269, 2.6, 0.5],
  [-6, 337, 3, 0.6], [3, 364, 2.8, 0.55],
  [5, 417, 3, 0.6], [-3, 455, 3.2, 0.6],
  [2, 498, 2.8, 0.55],
];

export function range(): LevelDef {
  const props: PropDesc[] = [];
  const objects: ObjectDesc[] = [];
  const decals: DecalDesc[] = [];
  const crowds: CrowdDesc[] = [];
  const battle: Required<BattleDesc> = { shelling: [], crossfire: [], launchers: [], tanks: [], patches: [], smoke: [] };
  const pits: PitDesc[] = CRATERS.map(([x, z, half]) => ({ pos: [x, z], half: [half, half], depth: 0.3 }));
  for (const [x, z, turn] of WRECKS) props.push({ shape: 'box', size: [1.5, 0.95, 2.8], pos: [x, 0.95, z], rot: [0, turn, 0], color: WRECK });
  for (const [x, z, radius, height] of MOUNDS) props.push({ shape: 'cone', size: [radius, height / 2, 0], pos: [x, height / 2, z], color: EARTH });

  // The road, and a line across it at the start of each stretch.
  decals.push({ pos: [0, 260], size: [18, 560], color: 0x6b6558 });
  for (const z of [40, 130, 225, 310, 400, 470]) decals.push({ pos: [0, z - 4], size: [18, 0.5], color: 0xe8e8e8 });

  battle.shelling.push({ area: [-9, 40, 9, 110], every: 0.4 });

  // The two armies, each along its own side of the road, firing across it. In the road: wrecks,
  // each of which is shelter from one side, and wire lying across the straight way through.
  battle.crossfire.push({ area: [-15, 130, 15, 205], rate: 30 });
  for (const army of [0, 1] as const) {
    const x = army ? 16.5 : -16.5;
    crowds.push({ area: [x - 1.5, 130, x + 1.5, 205], count: 12, y: 0, army, fenced: true });
    for (let z = 133; z < 205; z += 3) objects.push({ kind: 'sandbag', pos: [army ? 14.6 : -14.6, 0, z], rotY: Math.PI / 2 });
  }
  battle.patches.push({ pos: [3.5, 148], half: [2.6, 2], kind: 'wire' }, { pos: [-4, 164], half: [2.6, 2], kind: 'wire' }, { pos: [3.5, 181], half: [2.6, 2], kind: 'wire' });

  // Launchers a long way back from the road on either side: quick to lock, and their rockets slow enough to
  // be seen coming. Mud where one would want to swerve; walls that break their sight.
  battle.launchers.push({ pos: [-40, 0, 250], range: 60, side: 0 }, { pos: [40, 0, 273], range: 60, side: 1 });
  battle.patches.push({ pos: [-3, 241], half: [3, 4], kind: 'mud' }, { pos: [3.5, 259], half: [3, 4], kind: 'mud' }, { pos: [-2, 277], half: [3.5, 3], kind: 'mud' });
  for (const [x, z] of [[-8.5, 250], [8.5, 267]]) props.push({ shape: 'box', size: [0.4, 1.4, 4], pos: [x, 1.4, z], color: 0x9c9a94 });

  // Tanks standing about, off to the sides; and the soldiers of both armies all over the road
  // between them. Run one down, and the tanks of his army that are near turn their guns.
  // Until then their guns are on the other army, far off over the road, and they fire that way now and again.
  battle.tanks.push({ pos: [-11, 322], rotY: 0.6, gun: 1.1, side: 0 }, { pos: [11.5, 340], rotY: -2.2, gun: -1.9, side: 1 }, { pos: [-10.5, 362], rotY: 1.9, gun: 2, side: 0 }, { pos: [10, 376], rotY: -0.8, gun: -1.2, side: 1 });
  crowds.push({ area: [-8, 312, 2, 345], count: 9, y: 0, army: 0 }, { area: [-2, 330, 8, 360], count: 9, y: 0, army: 1 }, { area: [-8, 350, 3, 380], count: 9, y: 0, army: 0 });

  battle.smoke.push({ pos: [0, 425], radius: 24 });
  for (const [x, z] of [[2, 412], [-5.5, 425], [0.5, 432], [5.5, 442]]) objects.push({ kind: 'oilDrum', pos: [x, 0, z] });

  // Mines: few, and far enough apart to steer between, but one of them is always on the straight line.
  for (const [x, z] of [[0.5, 474], [-5, 479], [4.5, 484], [-1.5, 491], [6, 496], [-6, 500], [1.5, 505], [-3.5, 512], [4, 517], [-0.5, 524]]) objects.push({ kind: 'mine', pos: [x, 0, z] });

  return {
    id: 'range',
    name: '戰場試驗場',
    brief: '砲擊、交火、火箭筒、坦克、煙霧、地雷：一樣一樣試',
    ground: { center: [0, 250], half: [120, 340], style: 'asphalt' },
    bounds: [[-60, -30], [60, 560]],
    spawn: [0, 0.9, 0],
    heading: 0,
    props,
    pits,
    objects,
    crowds,
    decals,
    battle,
    cargo: standardLoad(),
    traffic: [],
    stars: [0.6, 0.8],
    par: 180,
  };
}
