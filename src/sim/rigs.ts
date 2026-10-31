import RAPIER from '@dimforge/rapier3d-compat';
import { Euler, Quaternion, Vector3 } from 'three';
import { GROUP, PHYSICS, groups } from '../config';
import type { RigDesc } from '../levels/types';

// Machines at work beside a road, each going through the same round of work over and over: an
// excavator swinging its house from digging on one side to tipping on the other, a pile driver,
// a crane with a grab, a demolition ball, a telescopic boom. What moves is a real body of the
// weight it would be, driven by a motor with only so much force: what is in its way is struck
// and shoved as that weight, going that fast, would shove it, and what will not give stops it.

/**
 * Something drawn and, if solid, felt: a box (half sizes) or a ball (radius in the first), placed on its body; a cylinder
 * (radius, half its length) standing up unless turned; a hull lofted between two outlines.
 */
export interface RigShape {
  kind: 'box' | 'ball' | 'cyl' | 'loft';
  half: [number, number, number];
  pos: [number, number, number];
  /** Leaning about X, radians: a boom rising. */
  tilt?: number;
  /** Turned, radians about X, Y and Z in that order, as a prop is. */
  rot?: [number, number, number];
  color: number;
  solid: boolean;
  /** Felt, not drawn: what a hull's drawn shape stands for to what meets it. */
  hidden?: boolean;
  /** Faded while it stands between the camera and the truck. */
  fade?: boolean;
  /** A loft's outline at its foot, at y0, and at its top, at y1: the same number of corners, in order round. */
  lo?: [number, number][];
  hi?: [number, number][];
  y0?: number;
  y1?: number;
}

/** Where something afloat is, and how it is turned: as it stands still, or as it is at a moment. */
export interface Pose {
  x: number;
  y: number;
  z: number;
  rot: { x: number; y: number; z: number; w: number };
}

export interface RigPart {
  body: RAPIER.RigidBody;
  shapes: RigShape[];
}

export interface Rig {
  desc: RigDesc;
  parts: RigPart[];
  /**
   * A cable to draw, from a fixed place down to a part: where it hangs from, and which part, at what point on it; or, for a
   * ball (`onto` its radius), to the point on it facing up the cable.
   */
  cable?: { from: [number, number, number]; part: number; at: [number, number, number]; onto?: number };
  /** Whether its warning lamp is lit: it is about to move, or moving, across the road. */
  warn: boolean;
  /** Where its lamp is, on which part. */
  lamp: { part: number; at: [number, number, number] };
  time: number;
  joints: (RAPIER.RevoluteImpulseJoint | RAPIER.PrismaticImpulseJoint | RAPIER.ImpulseJoint)[];
  /** Where each moving part starts: to be put back there. */
  start: { body: RAPIER.RigidBody; pos: RAPIER.Vector; rot: RAPIER.Rotation }[];
  /** The grab's last drip of mud. */
  drip: number;
  /** Which way its turning part faces, counted on round past a whole turn: radians from the road. */
  angle: number;
  /** How far a ball crane slewed in its last step, radians: for how fast its jib's head is going. */
  turning?: number;
  /** Each container loose on a ship's deck: whether it is held where it is, between where across the deck, how heavy. */
  slips?: { stuck: boolean; lo: number; hi: number; heft: number }[];
  /** For a boat a wave throws up: seconds since it was taken up, unset until then. */
  surge?: number;
  /** Whether the truck has come near enough for it to be taken up by the next big wave. */
  armed?: boolean;
  /** Where a hauled part was last to be. */
  aim?: { x: number; y: number; z: number };
  /** For something afloat: where it is this step, and where it was the step before. */
  pose?: Pose;
  was?: Pose;
  /** For a plate: where each deck's edge is, in that deck's own frame, as found with both still. */
  edges?: [Vector3, Vector3];
}

const YELLOW = 0xf2b51e;
const DEEP = 0xc98d12;
const DARK = 0x2a2e34;
const STEEL = 0x8c9096;
const GLASS = 0x1b2a3a;
const RED = 0xc8372d;
const MUD = 0x5a4a38;

/** How far from the truck, metres, machines go on working; further off they stand still. */
const AWAKE_WITHIN = 160;
const G = 9.81;

const q = new Quaternion();
const v = new Vector3();

/** A ship's hatches, half across, as a share of its half beam. A container, half its size: its length across the deck. */
const SHIP_HATCH = 0.15;
/** How far down a boardwalk's piles go, from the quay's level. */
const WALK_FOOT = -6.7;
const CONTAINER: [number, number, number] = [3.03, 1.3, 1.22];

/**
 * Where something afloat is at a moment of its round: its height, and how it is turned (its yaw, rolled about its length,
 * pitched about its width). The heave and the pitch go round a little behind the roll, so that it never simply rocks.
 */
function floatPose(desc: RigDesc, time: number): { y: number; rot: { x: number; y: number; z: number; w: number } } {
  const a = ((time / desc.period + desc.phase) % 1) * 2 * Math.PI;
  // Lurching: over quickly and hanging there, but never faster through the upright than a hull can go, or the deck would
  // throw what is on it into the air.
  const k = (1 - (desc.lurch ?? 1)) * 4;
  const lean = k > 0.05 ? Math.tanh(k * Math.sin(a)) / Math.tanh(k) : Math.sin(a);
  const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), desc.yaw)
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), (desc.roll ?? 0) * lean))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), (desc.pitch ?? 0) * Math.sin(a + 2.1)));
  return { y: desc.pos[1] + (desc.heave ?? 0) * Math.sin(a + 0.9), rot: { x: turn.x, y: turn.y, z: turn.z, w: turn.w } };
}

/** The height of something's deck at a point over it as it is now: its heave, and what its roll and pitch lift there. */
function deckHeight(rig: Rig, x: number, z: number): number {
  const pose = rig.pose ?? restPose(rig.desc);
  // The deck's plane through its middle, by the way its top faces.
  const up = new Vector3(0, 1, 0).applyQuaternion(new Quaternion(pose.rot.x, pose.rot.y, pose.rot.z, pose.rot.w));
  return pose.y - (up.x * (x - pose.x) + up.z * (z - pose.z)) / Math.max(0.2, up.y);
}

/** Where something afloat is with the water still: where it was put, turned only its own way. */
function restPose(desc: RigDesc): Pose {
  const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), desc.yaw);
  return { x: desc.pos[0], y: desc.pos[1], z: desc.pos[2], rot: { x: turn.x, y: turn.y, z: turn.z, w: turn.w } };
}

/** A point in the world, in the frame of something posed so (changed in place). */
function toLocal(pose: Pose, p: Vector3): Vector3 {
  return p.set(p.x - pose.x, p.y - pose.y, p.z - pose.z).applyQuaternion(new Quaternion(pose.rot.x, pose.rot.y, pose.rot.z, pose.rot.w).invert());
}

/** A point in the frame of something posed so, in the world (changed in place). */
function toWorld(pose: Pose, p: Vector3): Vector3 {
  return p.applyQuaternion(new Quaternion(pose.rot.x, pose.rot.y, pose.rot.z, pose.rot.w)).add(new Vector3(pose.x, pose.y, pose.z));
}

/** A plate between two boats: how thick, half; how far it lies on to the lower deck, over the higher's edge, past where it rests. */
const PLATE_THICK = 0.03;
const PLATE_ONTO = 1.2;
const PLATE_OVER = 0.4;
const PLATE_PAST = 0.2;
const plateLength = (desc: RigDesc) => (desc.ends ? desc.ends[1] - desc.ends[0] : 1) + PLATE_ONTO + PLATE_OVER + PLATE_PAST;

/** What floats, as boxes: a pontoon's deck on its floats; a fishing boat with its wheelhouse and the plates to the next; a ship. */
function floatShapes(desc: RigDesc, box: (half: [number, number, number], pos: [number, number, number], color: number, solid?: boolean, tilt?: number) => RigShape): RigShape[] {
  const [hw, , hl] = desc.half ?? [4, 0, 10];
  const shapes: RigShape[] = [];
  if (desc.hull === 'vessel') {
    // Made as the level says, piece by piece.
    for (const p of desc.parts ?? []) {
      if (p.shape === 'loft') shapes.push({ kind: 'loft', half: [0, 0, 0], pos: [0, 0, 0], color: p.color, solid: false, lo: p.lo, hi: p.hi, y0: p.y0, y1: p.y1 });
      else shapes.push({ kind: p.shape, half: p.half ?? [0.5, 0.5, 0.5], pos: p.pos ?? [0, 0, 0], rot: p.rot, color: p.color, solid: !!p.solid, hidden: p.hidden, fade: p.fade });
    }
  } else if (desc.hull === 'walk') {
    // A boardwalk on piles: planks across it, a beam under each side, piles down into the water every four metres or so.
    // Up or down from one end to the other by its rise: the deck sloped, the piles under it each as long as it needs.
    const rise = desc.rise ?? 0;
    const tilt = -Math.atan2(rise, 2 * hl), up = (z: number) => (rise * z) / (2 * hl);
    const slope = Math.hypot(hl, rise / 2);
    shapes.push(box([hw, 0.12, slope], [0, -0.12, 0], 0x6e5a42, true, tilt));
    for (let z = -hl + 0.6; z < hl; z += 1.2) shapes.push(box([hw, 0.01, 0.03], [0, 0.01 + up(z), z], 0x4a3c2c, false, tilt));
    for (const side of [-1, 1]) shapes.push(box([0.12, 0.2, slope], [side * (hw - 0.3), -0.44, 0], 0x4f4132, false, tilt));
    const piles = Math.max(1, Math.round((2 * hl) / 4));
    for (let n = 0; n <= piles; n++) {
      const z = -hl + 0.5 + ((2 * hl - 1) * n) / piles;
      // Down to the sea bed, whatever height the deck stands at.
      const top = up(z) - 0.3, foot = WALK_FOOT - desc.pos[1];
      for (const side of [-1, 1]) shapes.push(box([0.17, (top - foot) / 2, 0.17], [side * (hw - 0.4), (top + foot) / 2, z], 0x3e3428, false));
    }
  } else if (desc.hull === 'pontoon') {
    shapes.push(box([hw, 0.25, hl], [0, -0.25, 0], 0x8a8f94));
    shapes.push(box([hw - 0.4, 0.45, hl - 0.4], [0, -0.95, 0], 0x3a3f45, false));
    for (const side of [-1, 1]) shapes.push(box([0.1, 0.1, hl], [side * (hw - 0.1), 0.1, 0], 0xe0b020, false));
    for (const end of [-1, 1]) for (const side of [-1, 1]) shapes.push(box([0.18, 0.3, 0.18], [side * (hw - 0.5), 0.3, end * (hl - 0.6)], 0x2a2c30));
  } else if (desc.hull === 'boat') {
    // Its length along z, its beam across x: crossed over its middle from one side to the other.
    const c = desc.color ?? 0x2f6fb0;
    shapes.push(box([hw, 1.1, hl], [0, -1.1, 0], c));
    shapes.push(box([hw + 0.02, 0.12, hl + 0.02], [0, -0.35, 0], 0xf2f2ee, false));
    shapes.push(box([hw - 0.12, 0.05, hl - 0.3], [0, -0.04, 0], 0x9a7a52));
    // The bow narrowed off, the wheelhouse aft of the way across, a mast with the flag.
    shapes.push(box([hw * 0.55, 0.9, 1.2], [0, -0.6, hl + 1.0], c));
    shapes.push(box([hw * 0.62, 1.0, 1.5], [0, 1.0, -hl + 2.2], 0xe8e6de));
    shapes.push(box([hw * 0.63, 0.25, 1.52], [0, 1.45, -hl + 2.2], 0x2a3440, false));
    shapes.push(box([0.07, 2.2, 0.07], [0, 2.2, hl - 3], 0x9a9a9a, false));
    shapes.push(box([0.02, 0.45, 0.7], [0, 3.9, hl - 2.3], 0xd23c2c, false));
    // A low bulwark along each side but where it is crossed; steel plates out over the gap to the next boat each side.
    for (const side of [-1, 1]) for (const end of [-1, 1]) shapes.push(box([0.08, 0.3, (hl - 3.2) / 2], [side * (hw - 0.08), 0.3, end * (3.2 + (hl - 3.2) / 2)], c));
    if (desc.planks !== false) for (const side of [-1, 1]) {
      shapes.push(box([0.55, 0.035, 2.1], [side * (hw + 0.35), 0.03, 0], 0x6f757b));
      shapes.push(box([0.04, 0.04, 2.1], [side * (hw + 0.85), 0.05, 0], 0xe0b020, false));
    }
  } else {
    // A ship: its hull down into the water, its deck, the hatch covers down its middle, bulwarks with gaps, a ramp at the stern.
    shapes.push(box([hw, 3, hl], [0, -3, 0], 0x2b3a55));
    shapes.push(box([hw + 0.03, 0.5, hl + 0.03], [0, -2.6, 0], 0xa83228, false));
    shapes.push(box([hw - 0.2, 0.05, hl - 0.2], [0, -0.04, 0], 0x6b7f6a));
    shapes.push(box([hw * SHIP_HATCH, 0.6, hl * 0.48], [0, 0.6, -hl * 0.06], 0x8a3a2a));
    for (const side of [-1, 1]) for (let z = -hl + 6; z < hl - 4; z += 14) shapes.push(box([0.12, 0.55, 4.5], [side * (hw - 0.12), 0.55, z + 4.5], 0xd8d8d0));
    shapes.push(box([hw * 0.6, 0.5, 0.12], [0, 0.5, hl - 0.12], 0xd8d8d0));
    if (desc.ramp) {
      const [long, below] = desc.ramp;
      const tilt = -Math.asin(Math.min(0.9, below / long));
      const run = Math.cos(tilt) * long;
      shapes.push(box([3.5, 0.15, long / 2], [0, -below / 2 - 0.12, -hl - run / 2], 0x7d848b, true, tilt));
    }
  }
  return shapes;
}

/** Eased from a to b as s goes from 0 to 1. */
const ease = (a: number, b: number, s: number) => a + (b - a) * (s <= 0 ? 0 : s >= 1 ? 1 : s * s * (3 - 2 * s));
/** A value held, then moving, then held, ... through a round: [at, value] pairs, eased between. */
function through(frac: number, keys: [number, number][]): number {
  for (let n = 0; n < keys.length - 1; n++) {
    const [t0, a] = keys[n];
    const [t1, b] = keys[n + 1];
    if (frac >= t0 && frac <= t1) return ease(a, b, (frac - t0) / (t1 - t0));
  }
  return keys[keys.length - 1][1];
}
/** Whether a round is moving, or about to (within `lead` of a round), between keys whose values differ. */
function moving(frac: number, keys: [number, number][], lead: number): boolean {
  for (let n = 0; n < keys.length - 1; n++) {
    const [t0, a] = keys[n];
    const [t1, b] = keys[n + 1];
    if (Math.abs(a - b) > 1e-3 && frac >= t0 - lead && frac <= t1) return true;
  }
  return false;
}

/** The slew: dig on one side, swing across the road, tip on the other side, swing back; at about the speed an excavator swings. Angle 0 points at the road. */
const SLEW: [number, number][] = [[0, -1.3], [0.12, -1.3], [0.44, 1.3], [0.56, 1.3], [0.88, -1.3], [1, -1.3]];
/** The pile driver's hammer, its middle above the ground: drawn up slowly, held, dropped. */
const PILE: [number, number][] = [[0, 1.0], [0.1, 1.0], [0.4, 5.6], [0.72, 5.6], [0.8, 1.0], [1, 1.0]];
/** The grab's crane: its jib from over the pond beyond the road (0), round over the road to the pond behind it (pi), and back the same way. */
const CRANE: [number, number][] = [[0, 0], [0.3, 0], [0.54, Math.PI], [0.7, Math.PI], [0.94, 0], [1, 0]];
/** The grab's height, bottom above the ground: down in the pond, up to go across low, down to tip, up, back. */
const GRAB: [number, number][] = [[0, -1.2], [0.2, -1.2], [0.3, 2.5], [0.54, 2.5], [0.6, 1.2], [0.64, 1.2], [0.7, 2.5], [0.94, 2.5], [1, -1.2]];
/** The boom's reach past its carrier: drawn in, pushed out across the road, held there, drawn back. */
const BOOM: [number, number][] = [[0, 0], [0.2, 0], [0.45, 8.4], [0.62, 8.4], [0.87, 0], [1, 0]];

export class Rigs {
  readonly list: Rig[] = [];
  /** Mud dropped from a grab since the last call: where. */
  mud: { x: number; y: number; z: number }[] = [];
  /** Hammers come down since the last call, on the ground or on something: where, and how fast. */
  slams: { x: number; y: number; z: number; speed: number }[] = [];
  /** A boat taken up by a wave, or come down, since the last call: where. */
  surges: { x: number; y: number; z: number; down: boolean }[] = [];

  constructor(private readonly world: RAPIER.World, descs: readonly RigDesc[]) {
    for (const desc of descs) this.list.push(this.make(desc));
    // Each plate's two edges, found in the frames of the decks they belong to, with both still.
    for (const rig of this.list) {
      const { desc } = rig;
      if (desc.kind !== 'plate' || desc.on === undefined || desc.rests === undefined) continue;
      const [ea, eb] = desc.ends ?? [-0.5, 0.5];
      const dx = Math.sin(desc.yaw), dz = Math.cos(desc.yaw);
      const a = this.list[desc.on].desc, b = this.list[desc.rests].desc;
      rig.edges = [
        toLocal(restPose(a), new Vector3(desc.pos[0] + dx * ea, a.pos[1], desc.pos[2] + dz * ea)),
        toLocal(restPose(b), new Vector3(desc.pos[0] + dx * eb, b.pos[1], desc.pos[2] + dz * eb)),
      ];
    }
    this.reset();
  }

  /** Where a point set on the deck of float `index` with it still (in the world) is now, as that deck has moved. */
  carried(index: number, at: { x: number; y: number; z: number }, now = true): Vector3 {
    const rig = this.list[index];
    const pose = (now ? rig.pose : rig.was) ?? restPose(rig.desc);
    return toWorld(pose, toLocal(restPose(rig.desc), new Vector3(at.x, at.y, at.z)));
  }

  /** How a thing set on the deck of float `index` turned this way with it still is turned now. */
  turned(index: number, rot: { x: number; y: number; z: number; w: number }): Quaternion {
    const rig = this.list[index];
    const rest = restPose(rig.desc).rot, pose = (rig.pose ?? restPose(rig.desc)).rot;
    return new Quaternion(pose.x, pose.y, pose.z, pose.w).multiply(new Quaternion(rest.x, rest.y, rest.z, rest.w).invert()).multiply(new Quaternion(rot.x, rot.y, rot.z, rot.w));
  }

  /** How fast the deck of float `index` is going at a point over it now, m/s: what something lying on it there goes with. */
  deckVelocity(index: number, at: { x: number; y: number; z: number }, dt: number): Vector3 {
    const rig = this.list[index];
    if (!rig.pose || !rig.was) return new Vector3();
    // The point, held to the deck as it now is, and where it was as the deck was a step ago.
    const local = toLocal(rig.pose, new Vector3(at.x, at.y, at.z));
    return toWorld(rig.pose, local.clone()).sub(toWorld(rig.was, local)).divideScalar(dt);
  }

  /** A body, fixed or moving, at a place in the rig's own frame (Z the way it works), with its shapes, the solid ones felt. */
  private part(desc: RigDesc, mode: 'fixed' | 'dynamic' | 'kinematic' | 'upright', at: [number, number, number], shapes: RigShape[], mass = 0, prop = false): RigPart {
    const [x, y, z] = this.place(desc, at);
    q.setFromAxisAngle(v.set(0, 1, 0), desc.yaw);
    const fixed = mode === 'fixed' || mode === 'kinematic';
    const made =
      mode === 'fixed' ? RAPIER.RigidBodyDesc.fixed()
      : mode === 'kinematic' ? RAPIER.RigidBodyDesc.kinematicPositionBased()
      : RAPIER.RigidBodyDesc.dynamic().setCanSleep(false).setAngularDamping(0.5);
    if (mode === 'upright') made.lockRotations();
    const body = this.world.createRigidBody(made.setTranslation(x, y, z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
    const solid = shapes.filter((s) => s.solid);
    for (const s of solid) {
      const shape = s.kind === 'ball' ? RAPIER.ColliderDesc.ball(s.half[0]) : s.kind === 'cyl' ? RAPIER.ColliderDesc.cylinder(s.half[1], s.half[0]) : RAPIER.ColliderDesc.cuboid(...s.half);
      // A bridge's deck is driven on: ground, which the wheels find. So are the decks of what floats, and a gangway.
      const driven = !prop && (desc.kind === 'sway' || desc.kind === 'float' || desc.kind === 'gangway' || desc.kind === 'plate');
      shape.setTranslation(...s.pos).setFriction(driven ? 0.8 : 0.6).setCollisionGroups(groups(driven ? GROUP.ground : GROUP.prop, GROUP.all));
      if (s.tilt) {
        q.setFromAxisAngle(v.set(1, 0, 0), s.tilt);
        shape.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      } else if (s.rot) {
        q.setFromEuler(new Euler(...s.rot));
        shape.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      }
      // One that stays put, or is moved, has no mass of its own, which the wheels' brakes and grip would take from it: see the props' in Sim.
      if (!fixed) shape.setMass(mass / solid.length);
      else shape.setDensity(0);
      this.world.createCollider(shape, body);
    }
    return { body, shapes };
  }

  /** A place in a rig's own frame, in the world. */
  private place(desc: RigDesc, [x, y, z]: [number, number, number]): [number, number, number] {
    const c = Math.cos(desc.yaw), s = Math.sin(desc.yaw);
    return [desc.pos[0] + x * c + z * s, desc.pos[1] + y, desc.pos[2] - x * s + z * c];
  }

  private joint(data: RAPIER.JointData, a: RAPIER.RigidBody, b: RAPIER.RigidBody, maxForce?: number): RAPIER.ImpulseJoint {
    const joint = this.world.createImpulseJoint(data, a, b, true);
    joint.setContactsEnabled(false);
    if (maxForce !== undefined) (joint as RAPIER.RevoluteImpulseJoint).setMotorMaxForce(maxForce);
    return joint;
  }

  private make(desc: RigDesc): Rig {
    const box = (half: [number, number, number], pos: [number, number, number], color: number, solid = true, tilt?: number): RigShape => ({ kind: 'box', half, pos, color, solid, tilt });
    const rig: Rig = { desc, parts: [], warn: false, lamp: { part: 0, at: [0, 0, 0] }, time: 0, joints: [], start: [], drip: 0, angle: 0 };
    const tracks = () => [box([1.6, 0.5, 2.3], [0, 0.5, 0], DARK), box([0.8, 0.25, 1.2], [0, 1.05, 0], 0x4a4f55, false)];
    if (desc.kind === 'forklift') {
      // Nothing fixed: what moves is the forklift, a body of its weight driven where its round has it with only so much force,
      // so that what it meets it shoves, and what will not give, the truck, stops it or shoves it back.
      rig.parts.push(this.part(desc, 'fixed', [0, -40, 0], []));
      const fork = this.part(desc, 'upright', [0, 0.7, 0], [
        box([0.6, 0.45, 1.0], [0, 0, 0.1], YELLOW),
        box([0.62, 0.3, 0.35], [0, 0.2, -0.85], DARK),
        box([0.55, 0.05, 0.55], [0, 1.4, 0.15], DARK, false),
        ...[-0.5, 0.5].flatMap((x) => [box([0.04, 0.6, 0.04], [x, 0.8, 0.6], DARK, false), box([0.04, 0.6, 0.04], [x, 0.8, -0.3], DARK, false)]),
        ...[-0.35, 0.35].map((x) => box([0.05, 1.2, 0.05], [x, 0.55, 1.15], DARK, false)),
        ...[-0.25, 0.25].map((x) => box([0.06, 0.03, 0.55], [x, -0.6, 1.75], DARK, false)),
        ...[[-0.55, 0.7], [0.55, 0.7], [-0.55, -0.6], [0.55, -0.6]].map(([x, z]) => box([0.12, 0.25, 0.25], [x, -0.42, z], 0x1c1d20, false)),
        // A pallet of blocks up on its forks.
        box([0.55, 0.06, 0.5], [0, -0.35, 1.75], 0x9a7448, false),
        box([0.5, 0.3, 0.45], [0, 0.0, 1.75], 0xb5533c, false),
      ], 3500);
      fork.body.setLinearDamping(0.5);
      rig.parts.push(fork);
      rig.lamp = { part: 1, at: [0, 1.5, 0.15] };
      for (const part of rig.parts) if (!part.body.isFixed()) rig.start.push({ body: part.body, pos: part.body.translation(), rot: part.body.rotation() });
      return rig;
    }
    if (desc.kind === 'sway') {
      // A hanging bridge's deck, steel plate on cross beams, a low kerb along each edge; its hangers up to the cables, which
      // hang from towers that do not move. It is all one body, rocking from side to side about its own length.
      const half = (desc.long ?? 30) / 2;
      const shapes: RigShape[] = [box([SWAY_WIDE / 2, 0.15, half], [0, -0.15, 0], 0x6f747a), ...[-1, 1].map((side) => box([0.08, 0.12, half], [side * (SWAY_WIDE / 2 - 0.08), 0.12, 0], 0xe0b020))];
      for (let z = -half + 0.5; z < half; z += 1.5) shapes.push(box([SWAY_WIDE / 2 + 0.15, 0.08, 0.1], [0, -0.38, z], 0x4a4f55, false));
      for (let z = -half + 1; z < half - 0.5; z += 2) {
        const up = SWAY_SAG + (SWAY_TOWER - SWAY_SAG) * (z / half) ** 2;
        for (const side of [-1, 1]) shapes.push(box([0.02, up / 2, 0.02], [side * (SWAY_WIDE / 2 + 0.1), up / 2, z], 0x2a2c30, false));
      }
      rig.parts.push(this.part(desc, 'kinematic', [0, 0, 0], shapes));
      rig.lamp = { part: 0, at: [0, -1, 0] };
      for (const part of rig.parts) rig.start.push({ body: part.body, pos: part.body.translation(), rot: part.body.rotation() });
      return rig;
    }
    if (desc.kind === 'float') {
      const deck = this.part(desc, 'kinematic', [0, 0, 0], floatShapes(desc, box));
      rig.parts.push(deck);
      // Containers loose on a ship's deck: real weights, free to slide across it only, between the hatches and the rail.
      const [hw, , ] = desc.half ?? [4, 0, 10];
      rig.slips = [];
      for (const [side, along, heft] of desc.loose ?? []) {
        const near = (desc.hatch ?? hw * SHIP_HATCH) + CONTAINER[0] + 0.05, far = hw - 0.24 - CONTAINER[0] - 0.05;
        const color = [0xc8462e, 0x2f6a9a, 0x3d8a5a, 0xd08a26][rig.parts.length % 4];
        const shapes: RigShape[] = [box(CONTAINER, [0, 0, 0], color)];
        for (let x = -CONTAINER[0] + 0.5; x < CONTAINER[0]; x += 0.62) for (const z of [-1, 1]) shapes.push(box([0.06, CONTAINER[1] - 0.08, 0.03], [x, 0, z * (CONTAINER[2] + 0.02)], color - 0x101010, false));
        for (const x of [-1, 1]) shapes.push(box([0.03, CONTAINER[1], CONTAINER[2]], [x * (CONTAINER[0] + 0.01), 0, 0], 0x5a5f66, false));
        const at: [number, number, number] = [side * (near + far) / 2, CONTAINER[1] + 0.02, along];
        const crate = this.part(desc, 'dynamic', at, shapes, 4000 + heft * 8000, true);
        crate.body.setLinearDamping(0.15);
        rig.slips.push({ stuck: true, lo: side < 0 ? -far : near, hi: side < 0 ? -near : far, heft });
        const slide = this.joint(RAPIER.JointData.prismatic({ x: at[0], y: at[1], z: at[2] }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), deck.body, crate.body) as RAPIER.PrismaticImpulseJoint;
        slide.setLimits(side * (side < 0 ? far : near) - at[0], side * (side < 0 ? near : far) - at[0]);
        rig.joints.push(slide);
        rig.parts.push(crate);
      }
      rig.lamp = { part: 0, at: [0, -5, 0] };
      for (const part of rig.parts) rig.start.push({ body: part.body, pos: part.body.translation(), rot: part.body.rotation() });
      rig.pose = restPose(desc);
      rig.was = rig.pose;
      return rig;
    }
    if (desc.kind === 'plate') {
      // A steel plate, chequered, its edges painted, a lifting eye at each corner: laid loose from one deck to the next.
      const wide = desc.half?.[0] ?? 2.1, long = plateLength(desc);
      const shapes: RigShape[] = [box([wide, PLATE_THICK, long / 2], [0, 0, 0], 0x6f757b)];
      for (let z = -long / 2 + 0.3; z < long / 2 - 0.1; z += 0.5) shapes.push(box([wide - 0.1, 0.006, 0.05], [0, PLATE_THICK + 0.004, z], 0x5d6369, false));
      for (const side of [-1, 1]) shapes.push(box([0.06, 0.008, long / 2 - 0.05], [side * (wide - 0.08), PLATE_THICK + 0.006, 0], 0xe0b020, false));
      for (const side of [-1, 1]) for (const end of [-1, 1]) shapes.push(box([0.06, 0.05, 0.06], [side * (wide - 0.25), PLATE_THICK + 0.05, end * (long / 2 - 0.25)], 0x3a3f45, false));
      rig.parts.push(this.part(desc, 'kinematic', [0, 0, 0], shapes));
      rig.lamp = { part: 0, at: [0, -5, 0] };
      for (const part of rig.parts) rig.start.push({ body: part.body, pos: part.body.translation(), rot: part.body.rotation() });
      return rig;
    }
    if (desc.kind === 'gangway') {
      // A steel ramp, a ribbed plate with a kerb along each side, out along its length from its hinge.
      const long = desc.long ?? 20, wide = desc.half?.[0] ?? 2.2;
      const shapes: RigShape[] = [box([wide, 0.1, long / 2], [0, -0.1, long / 2], 0x7d848b), ...[-1, 1].map((side) => box([0.08, 0.15, long / 2], [side * (wide - 0.08), 0.15, long / 2], 0xe0b020))];
      for (let z = 0.6; z < long; z += 0.9) shapes.push(box([wide - 0.2, 0.025, 0.04], [0, 0.02, z], 0x5d6369, false));
      rig.parts.push(this.part(desc, 'kinematic', [0, 0, 0], shapes));
      rig.lamp = { part: 0, at: [0, -5, 0] };
      for (const part of rig.parts) rig.start.push({ body: part.body, pos: part.body.translation(), rot: part.body.rotation() });
      return rig;
    }
    if (desc.kind === 'slew') {
      // Tracks, fixed; the house turning on them, its boom up and out to the elbow, the arm down to the bucket over the road.
      const base = this.part(desc, 'fixed', [0, 0, 0], tracks());
      const house = this.part(desc, 'dynamic', [0, 1.3, 0], [
        box([1.4, 0.7, 1.7], [0, 0.55, -0.4], YELLOW),
        box([1.4, 0.5, 0.35], [0, 0.4, -2.1], DARK),
        box([0.6, 0.4, 0.6], [-0.75, 1.65, 0.7], YELLOW, false),
        box([0.5, 0.25, 0.02], [-0.75, 1.7, 1.31], GLASS, false),
        box([0.28, 0.28, 2.6], [0.5, 2.1, 2.9], YELLOW, true, -0.42),
        box([0.24, 0.85, 0.28], [0.5, 2.15, 5.55], DEEP),
        box([0.65, 0.42, 0.45], [0.5, 0.95, 5.9], STEEL),
      ], 9000);
      rig.parts.push(base, house);
      // Turning about its middle: torque enough to shove a truck caught by its bucket across the dike and off it.
      rig.joints.push(this.joint(RAPIER.JointData.revolute({ x: 0, y: 1.3, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }), base.body, house.body, 420000));
      rig.lamp = { part: 1, at: [-0.75, 2.15, 0.7] };
    } else if (desc.kind === 'pile') {
      // A piling rig: its house on its tracks back from the road, a yellow leader mast standing up just off the road's edge,
      // braced back to the house; the hammer, wide, riding out on a long arm from the mast's guides over the middle of the
      // road, hung from the sheave at the mast's head. Over the road's middle it leaves 2.15 m either side, less than a truck's
      // width: only under, while it is up.
      const base = this.part(desc, 'fixed', [0, 0, 0], [
        ...tracks(),
        box([1.3, 0.75, 1.4], [0, 1.85, -0.5], YELLOW),
        box([0.9, 0.3, 0.02], [0, 2.15, 0.91], GLASS, false),
        box([1.3, 0.45, 0.4], [0, 1.6, -2.1], DARK),
        box([0.35, 4.5, 0.35], [0, 4.5, 2.5], YELLOW),
        box([0.08, 4.4, 0.08], [-0.25, 4.6, 2.88], STEEL, false),
        box([0.08, 4.4, 0.08], [0.25, 4.6, 2.88], STEEL, false),
        box([0.4, 0.28, 1.6], [0, 9.1, 4.0], STEEL, false),
        box([0.12, 0.12, 2.3], [0, 4.55, 1.17], STEEL, false, -1.01),
      ]);
      const hammer = this.part(desc, 'dynamic', [0, PILE[0][1], PILE_OUT], [
        box([0.6, 0.85, 1.1], [0, 0, 0], 0x3a3f45),
        box([0.62, 0.1, 1.12], [0, 0.5, 0], YELLOW, false),
        box([0.3, 0.25, 0.75], [0, 0.4, -1.85], STEEL, false),
      ], 6000);
      rig.parts.push(base, hammer);
      rig.joints.push(this.joint(RAPIER.JointData.prismatic({ x: 0, y: 0, z: PILE_OUT }, { x: 0, y: -PILE[0][1], z: 0 }, { x: 0, y: 1, z: 0 }), base.body, hammer.body, 90000));
      rig.cable = { from: [0, 8.9, PILE_OUT], part: 1, at: [0, 0.85, 0] };
      rig.lamp = { part: 0, at: [0, 9.5, 2.9] };
    } else if (desc.kind === 'clamshell') {
      // A crawler crane: its body turning on its tracks with the jib up and out; the grab hanging off the jib's head, drawn up and let down.
      const base = this.part(desc, 'fixed', [0, 0, 0], tracks());
      const reach = CRANE_REACH;
      const jib = this.part(desc, 'kinematic', [0, 1.3, 0], [
        box([1.3, 0.75, 1.6], [0, 0.6, -0.6], 0xd94a2a),
        box([1.3, 0.5, 0.4], [0, 0.4, -2.2], DARK),
        box([0.5, 0.45, 0.5], [-0.8, 1.6, 0.6], 0xd94a2a, false),
        box([0.25, 0.25, 5.6], [0, 4.4, 4.8], 0xd94a2a, false, -0.62),
        box([0.4, 0.3, 0.4], [0, 7.6, reach], 0xd94a2a, false),
      ], 14000);
      const grab = this.part(desc, 'upright', [0, 3.2, reach], [box([0.75, 0.55, 0.75], [0, 0.55, 0], 0x3a3f45), box([0.8, 0.12, 0.8], [0, -0.05, 0], MUD, false), box([0.1, 0.3, 0.1], [0, 1.4, 0], DARK, false)], 2500);
      // The jib turns as it is told: it is high, and meets nothing. The grab is a weight on its cable, hauled toward where
      // the jib's head and the winch would have it with only so much force: a joint to a moving jib does not hold here.
      rig.parts.push(base, jib, grab);
      rig.cable = { from: [0, 8.9, reach], part: 2, at: [0, 1.6, 0] };
      rig.lamp = { part: 1, at: [-0.8, 2.2, 0.6] };
    } else if (desc.kind === 'ball') {
      // A crane down at the foot of the dike, its jib slanting up and out over the road; the ball on a short cable from the
      // jib's head. The crane slews hard from one side to the other, and the ball, swung round on its cable, sweeps the road.
      const base = this.part(desc, 'fixed', [0, 0, 0], tracks());
      // The jib from its foot at the front of the house up steep to its head; an A-frame at the back of the house, and the
      // pendant from its top to the jib's head that holds the jib up.
      const rise = BALL_HEAD_Y - 2.6, run = BALL_REACH - 1.3;
      const frameTop: [number, number] = [3.6, -1.4], hang: [number, number] = [BALL_HEAD_Y - 1.3 - frameTop[0], BALL_REACH - frameTop[1]];
      const house = this.part(desc, 'kinematic', [0, 1.3, 0], [
        box([1.3, 0.8, 1.5], [0, 0.6, -0.4], RED),
        box([1.3, 0.45, 0.4], [0, 0.4, -2.1], DARK),
        box([0.5, 0.45, 0.5], [-0.8, 1.6, 0.6], RED, false),
        box([0.3, 0.3, Math.hypot(rise, run) / 2], [0, 1.3 + rise / 2, 1.3 + run / 2], RED, false, -Math.atan2(rise, run)),
        box([0.45, 0.25, 0.3], [0, 1.25, 1.15], DARK, false),
        ...[-0.5, 0.5].map((x) => box([0.1, 1.1, 0.1], [x, frameTop[0] - 1.1, frameTop[1]], DARK, false)),
        box([0.6, 0.08, 0.08], [0, frameTop[0], frameTop[1]], DARK, false),
        box([0.03, 0.03, Math.hypot(...hang) / 2], [0, frameTop[0] + hang[0] / 2, frameTop[1] + hang[1] / 2], 0x2a2c30, false, -Math.atan2(...hang)),
        box([0.45, 0.35, 0.45], [0, BALL_HEAD_Y - 1.3, BALL_REACH], RED, false),
      ], 14000);
      const ball = this.part(desc, 'dynamic', [0, BALL_HEAD_Y - BALL_CABLE, BALL_REACH], [{ kind: 'ball', half: [BALL_RADIUS, 0, 0], pos: [0, 0, 0], color: 0x2a2c30, solid: true }], 18000);
      // It may not spin: a sphere spinning or not looks the same, and its cable is worked out to its middle. The air holds it
      // back as it goes round, so that it trails behind the jib's head on its cable.
      ball.body.lockRotations(true, true);
      ball.body.setLinearDamping(BALL_DRAG);
      rig.parts.push(base, house, ball);
      rig.cable = { from: [0, BALL_HEAD_Y, BALL_REACH], part: 2, at: [0, 0, 0], onto: BALL_RADIUS };
      rig.lamp = { part: 1, at: [-0.8, 2.2, 0.6] };
    } else {
      // A lorry-mounted crane on its outriggers, its boom level at the height of a truck's bed sides and cab, pushed out across
      // the road: it meets the truck, not only what is on it.
      const base = this.part(desc, 'fixed', [0, 0, 0], [
        box([1.25, 0.6, 3.2], [0, 1.0, -2.0], 0xe8e2d0),
        box([1.2, 0.75, 0.8], [0, 1.55, -5.6], 0x2f6fb0),
        box([0.9, 0.5, 0.9], [0, 2.1, 0.3], YELLOW),
        ...[-1, 1].map((side) => box([0.12, 0.6, 0.12], [side * 2.0, 0.6, -1.0], STEEL)),
        // Only seen: the chassis and its three axles; the cab's glass; the outriggers' beams out to their pads, front and back;
        // the slewing ring and the operator's cabin on the turret; the boom's outer section, which the inner one slides out of.
        box([1.1, 0.18, 4.2], [0, 0.32, -2.6], DARK, false),
        ...[-5.4, -2.6, -1.4].flatMap((z) => [-1, 1].flatMap((side) => [box([0.16, 0.42, 0.42], [side * 1.2, 0.42, z], DARK, false), box([0.17, 0.18, 0.18], [side * 1.21, 0.42, z], 0x9aa0a6, false)])),
        box([1.0, 0.3, 0.02], [0, 1.85, -6.41], 0x2a3a4a, false),
        ...[-1, 1].map((side) => box([0.02, 0.28, 0.5], [side * 1.21, 1.85, -5.6], 0x2a3a4a, false)),
        ...[-1.0, -4.6].flatMap((z) => [-1, 1].flatMap((side) => [box([0.4, 0.1, 0.12], [side * 1.6, 0.95, z], YELLOW, false), box([0.36, 0.05, 0.36], [side * 2.0, 0.05, z], DARK, false)])),
        ...[-1, 1].map((side) => box([0.12, 0.6, 0.12], [side * 2.0, 0.6, -4.6], STEEL, false)),
        box([1.0, 0.1, 1.0], [0, 1.62, 0.3], DARK, false),
        box([0.35, 0.45, 0.6], [1.0, 2.25, 0.2], 0xe8e2d0, false),
        box([0.02, 0.3, 0.45], [1.36, 2.35, 0.2], 0x2a3a4a, false),
        box([0.44, 0.44, 3.4], [0, BOOM_Y, -3.2], 0xd89a1a, false),
        box([0.46, 0.08, 0.08], [0, BOOM_Y + 0.4, 0.15], DARK, false),
      ]);
      // The inner section: its end banded in red and white, a darker band where it runs in the outer, the hook block under its head.
      const boom = this.part(desc, 'dynamic', [0, BOOM_Y, -2.2], [
        box([0.32, 0.32, 4.6], [0, 0, 0], YELLOW),
        box([0.36, 0.2, 0.2], [0, 0, 4.5], RED, false),
        ...[3.6, 3.95, 4.3].map((z, n) => box([0.33, 0.33, 0.14], [0, 0, z], n % 2 ? 0xf2f2ee : RED, false)),
        box([0.33, 0.33, 0.05], [0, 0, 1.2], 0xb07a12, false),
        box([0.02, 0.2, 0.02], [0, -0.42, 4.3], DARK, false),
        box([0.18, 0.2, 0.14], [0, -0.78, 4.3], DARK, false),
        box([0.12, 0.06, 0.12], [0, -1.02, 4.3], YELLOW, false),
      ], 2500);
      rig.parts.push(base, boom);
      rig.joints.push(this.joint(RAPIER.JointData.prismatic({ x: 0, y: BOOM_Y, z: -2.2 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }), base.body, boom.body, 45000));
      rig.lamp = { part: 1, at: [0, 0.45, 4.5] };
    }
    for (const part of rig.parts) if (!part.body.isFixed()) rig.start.push({ body: part.body, pos: part.body.translation(), rot: part.body.rotation() });
    return rig;
  }

  /** Call once per physics step, before the world steps. */
  update(dt: number, truck: { x: number; z: number }): void {
    this.mud = [];
    this.slams = [];
    this.surges = [];
    for (const rig of this.list) {
      const { desc } = rig;
      const asleep = Math.hypot(truck.x - desc.pos[0], truck.z - desc.pos[2]) > AWAKE_WITHIN;
      if (asleep) {
        rig.warn = false;
        this.idle(rig);
        continue;
      }
      rig.time += dt;
      const frac = (rig.time / desc.period + desc.phase) % 1;
      const lead = 1 / desc.period;
      if (desc.kind === 'forklift') {
        this.drive(rig, frac, dt);
        rig.warn = true;
        continue;
      }
      if (desc.kind === 'float') {
        const deck = rig.parts[0].body;
        let { y, rot } = floatPose(desc, rig.time);
        let x = desc.pos[0], z = desc.pos[2];
        const surge = desc.surge;
        if (surge) {
          // Once the truck comes near, waiting for the wave to take it up (the game's waves say when: throw), carried
          // over and thrown down where it is to lie.
          if (!rig.armed && Math.hypot(truck.x - surge.at[0], truck.z - surge.at[1]) < surge.reach) rig.armed = true;
          if (rig.surge !== undefined) {
            const was = rig.surge;
            rig.surge += dt;
            const k = Math.min(1, rig.surge / surge.seconds), e = k * k * (3 - 2 * k);
            x += (surge.to[0] - x) * e;
            z += (surge.to[2] - z) * e;
            y += (surge.to[1] - y) * e + surge.lift * Math.sin(Math.PI * k);
            q.setFromAxisAngle(v.set(0, 1, 0), desc.yaw + (surge.yaw - desc.yaw) * e).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), surge.roll * e));
            rot = { x: q.x, y: q.y, z: q.z, w: q.w };
            if (was < surge.seconds && rig.surge >= surge.seconds) this.surges.push({ x, y, z, down: true });
          }
        }
        if (desc.breaks !== undefined) {
          // Under the boat thrown down on it: giving way as it lands, down into the water, one end first.
          const by = this.list[desc.breaks];
          const since = by.surge === undefined ? -1 : by.surge - (by.desc.surge?.seconds ?? 0) * 0.85;
          if (since > 0) {
            const k = Math.min(1, since / 1.4);
            y -= 4.2 * k * k;
            q.setFromAxisAngle(v.set(0, 1, 0), desc.yaw).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.45 * k)).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.2 * k));
            rot = { x: q.x, y: q.y, z: q.z, w: q.w };
          }
        }
        deck.setNextKinematicRotation(rot);
        deck.setNextKinematicTranslation({ x, y, z });
        rig.was = rig.pose;
        rig.pose = { x, y, z, rot: { ...rot } };
        if (rig.slips) this.slip(rig, rot, y);
        continue;
      }
      // Laid on what floats: after it has moved, below.
      if (desc.kind === 'gangway' || desc.kind === 'plate') continue;
      if (desc.kind === 'sway') {
        // Rocking: over to one side and back, a little rise and fall with it, as a hanging bridge does under the wind.
        const a = frac * 2 * Math.PI;
        const deck = rig.parts[0].body;
        q.setFromAxisAngle(v.set(0, 1, 0), desc.yaw).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), SWAY_ROLL * Math.sin(a)));
        deck.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
        deck.setNextKinematicTranslation({ x: desc.pos[0], y: desc.pos[1] + SWAY_BOB * Math.sin(a * 2), z: desc.pos[2] });
        continue;
      }
      if (desc.kind === 'slew') {
        this.turn(rig, rig.joints[0] as RAPIER.RevoluteImpulseJoint, rig.parts[1].body, through(frac, SLEW), 2.2);
        rig.warn = moving(frac, SLEW, lead);
      } else if (desc.kind === 'pile') {
        const y = rig.parts[1].body.translation().y - desc.pos[1];
        // Dropped on to something and stopped short of the ground: it jumps back off it, and is drawn up again from there,
        // as if the round had got that far with it.
        const hammer = rig.parts[1].body;
        const joint = rig.joints[0] as RAPIER.PrismaticImpulseJoint;
        // A pile driver's drip is whether its hammer is on its way down, and how fast it was last going.
        const fell = rig.drip;
        if (rig.drip > 0 && hammer.linvel().y > -0.5 && y < PILE[2][1] - 0.8) {
          const p = hammer.translation();
          this.slams.push({ x: p.x, y: p.y - 0.85, z: p.z, speed: fell });
          rig.drip = 0;
        }
        if (frac > 0.72 && frac < 0.98 && y < PILE[2][1] - 0.8 && y > PILE[0][1] + 0.4 && hammer.linvel().y > -0.5) {
          const rise = PILE[1][0] + (PILE[2][0] - PILE[1][0]) * Math.min(1, (y - PILE[0][1]) / (PILE[2][1] - PILE[0][1]));
          rig.time += (((rise - frac + 1) % 1) * desc.period);
          rig.parts[1].body.setLinvel({ x: 0, y: 3, z: 0 }, true);
          continue;
        }
        const target = through(frac, PILE);
        // Drawn up steadily; let go, it falls under its own weight and the motor's.
        const dropping = frac > 0.72 && frac < 0.8;
        // Let go, it comes down all at once at full speed all the way, not easing in to the ground; drawn up, steadily.
        joint.setMotorMaxForce(dropping ? 900000 : 90000);
        this.slide(joint, y - PILE[0][1], (dropping ? PILE[0][1] : target) - PILE[0][1], dropping ? 22 : 4, dropping ? 60 : 3);
        if (dropping && hammer.linvel().y < -3) rig.drip = Math.max(rig.drip, -hammer.linvel().y);
        rig.warn = moving(frac, PILE, lead) && frac > 0.6;
      } else if (desc.kind === 'clamshell') {
        const target = through(frac, CRANE);
        rig.angle += Math.max(-0.7 * dt, Math.min(0.7 * dt, target - rig.angle));
        q.setFromAxisAngle(v.set(0, 1, 0), desc.yaw + rig.angle);
        rig.parts[1].body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
        this.haul(rig, this.grabAt(rig, through(frac, GRAB)), dt);
        const grab = rig.parts[2].body.translation();
        rig.warn = moving(frac, CRANE, lead);
        // Carrying mud across: it drips.
        if (frac > 0.3 && frac < 0.54 && (rig.drip -= dt) <= 0) {
          rig.drip = 0.35;
          this.mud.push({ x: grab.x, y: grab.y - 0.2, z: grab.z });
        }
      } else if (desc.kind === 'ball') {
        // Slewing round and round, steadily: the ball flung out on its cable, carried round wide and low over the dike once a turn.
        const turned = ballAngle(frac);
        rig.turning = ((turned - rig.angle + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
        rig.angle = turned;
        q.setFromAxisAngle(v.set(0, 1, 0), desc.yaw + rig.angle);
        rig.parts[1].body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
        this.rope(rig, dt);
        // Its lamp flashing while the ball is coming round toward the road and over it.
        rig.warn = Math.abs(rig.angle) < 1.4;
      } else {
        const tip = rig.parts[1].body.translation();
        const out = (tip.x - this.place(desc, [0, 0, -2.2])[0]) * Math.sin(desc.yaw) + (tip.z - this.place(desc, [0, 0, -2.2])[2]) * Math.cos(desc.yaw);
        this.slide(rig.joints[0] as RAPIER.PrismaticImpulseJoint, out, through(frac, BOOM), 5);
        rig.warn = moving(frac, BOOM, lead);
      }
    }
    // Gangways and plates, on what floats as it is this step.
    for (const rig of this.list) {
      const { desc } = rig;
      if (desc.kind !== 'gangway' && desc.kind !== 'plate') continue;
      if (Math.hypot(truck.x - desc.pos[0], truck.z - desc.pos[2]) > AWAKE_WITHIN) continue;
      if (desc.kind === 'plate') this.lay(rig);
      else this.ramp(rig);
    }
  }

  /**
   * A gangway: its hinge on the quay, or carried by a deck as that deck now is; its far end down on the deck it rests on,
   * or on the ground. Its slope is the drop over its length. It is kept level across itself.
   */
  private ramp(rig: Rig): void {
    const { desc } = rig;
    const long = desc.long ?? 20;
    const hinge = desc.on !== undefined ? this.carried(desc.on, { x: desc.pos[0], y: desc.pos[1], z: desc.pos[2] }) : new Vector3(...desc.pos);
    const end = [hinge.x + Math.sin(desc.yaw) * long, hinge.z + Math.cos(desc.yaw) * long];
    let drop = 0;
    if (desc.rests !== undefined) drop = hinge.y - deckHeight(this.list[desc.rests], end[0], end[1]);
    else if (desc.foot !== undefined) drop = hinge.y - desc.foot;
    const tilt = Math.asin(Math.max(-0.6, Math.min(0.6, drop / long)));
    q.setFromAxisAngle(v.set(0, 1, 0), desc.yaw).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), tilt));
    const body = rig.parts[0].body;
    body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    if (desc.on !== undefined) body.setNextKinematicTranslation({ x: hinge.x, y: hinge.y, z: hinge.z });
  }

  /**
   * A plate across from one deck to the next: on the higher one's edge, down to lie on the lower one a little way in,
   * whichever deck that is as they rise and fall; over the higher edge a little, in the air.
   */
  private lay(rig: Rig): void {
    const { desc } = rig;
    if (!rig.edges || desc.on === undefined || desc.rests === undefined) return;
    const a = this.list[desc.on], b = this.list[desc.rests];
    const ea = toWorld(a.pose ?? restPose(a.desc), rig.edges[0].clone()), eb = toWorld(b.pose ?? restPose(b.desc), rig.edges[1].clone());
    const high = ea.y >= eb.y ? ea : eb, low = high === ea ? eb : ea, lower = high === ea ? b : a, sign = high === ea ? 1 : -1;
    const cx = low.x + Math.sin(desc.yaw) * sign * PLATE_ONTO, cz = low.z + Math.cos(desc.yaw) * sign * PLATE_ONTO;
    const u = new Vector3(cx - high.x, deckHeight(lower, cx, cz) - high.y, cz - high.z).normalize();
    const mid = plateLength(desc) / 2 - PLATE_OVER;
    q.setFromAxisAngle(v.set(0, 1, 0), Math.atan2(u.x, u.z)).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.asin(u.y)));
    const body = rig.parts[0].body;
    body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    body.setNextKinematicTranslation({ x: high.x + u.x * mid, y: high.y + u.y * mid + PLATE_THICK, z: high.z + u.z * mid });
  }

  /**
   * Containers on a rolling deck: each held by its grip until the deck leans steep enough that way, the heavier the steeper;
   * then off, shoved along by the lean more than its own weight alone would (the lighter, the harder), to slam into the
   * hatches or the rail and hold there again.
   */
  private slip(rig: Rig, rot: { x: number; y: number; z: number; w: number }, y: number): void {
    const axis = v.set(1, 0, 0).applyQuaternion(q.set(rot.x, rot.y, rot.z, rot.w));
    // How much of its weight the lean puts along the deck across, toward its +x.
    const pull = -axis.y;
    rig.slips!.forEach((slip, k) => {
      const crate = rig.parts[k + 1].body, joint = rig.joints[k] as RAPIER.PrismaticImpulseJoint;
      const p = crate.translation(), lv = crate.linvel();
      const at = (p.x - rig.desc.pos[0]) * axis.x + (p.y - y) * axis.y + (p.z - rig.desc.pos[2]) * axis.z;
      const going = lv.x * axis.x + lv.y * axis.y + lv.z * axis.z;
      const against = pull > 0 ? at > slip.hi - 0.15 : at < slip.lo + 0.15;
      if (slip.stuck) {
        if (Math.abs(pull) > 0.03 + slip.heft * 0.1 && !against) slip.stuck = false;
      } else if (against && Math.abs(going) < 0.4) slip.stuck = true;
      crate.resetForces(true);
      if (slip.stuck) {
        joint.configureMotorVelocity(0, 40);
        joint.setMotorMaxForce(crate.mass() * 40);
      } else {
        joint.setMotorMaxForce(0);
        const f = crate.mass() * G * pull * (2.6 - slip.heft * 1.6);
        crate.addForce({ x: axis.x * f, y: axis.y * f, z: axis.z * f }, true);
      }
    });
  }

  /** A boat waiting for its wave taken up by it, now. */
  throw(rig: Rig): void {
    if (rig.surge !== undefined) return;
    rig.surge = 0;
    const { x, y, z } = rig.parts[0].body.translation();
    this.surges.push({ x, y, z, down: false });
  }

  /** Stood still while the truck is far off: motors holding where they are, the grab hanging where it is. */
  private idle(rig: Rig): void {
    // What slides loose on a deck has no motor: held, it would be held for good.
    if (rig.desc.kind === 'float') return;
    for (const joint of rig.joints) (joint as RAPIER.PrismaticImpulseJoint).configureMotorVelocity?.(0, 40);
    if (rig.desc.kind === 'clamshell') {
      const grab = rig.parts[2].body;
      grab.resetForces(true);
      grab.addForce({ x: 0, y: grab.mass() * G, z: 0 }, true);
      grab.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rig.aim = undefined;
    }
    if (rig.desc.kind === 'ball') this.rope(rig, PHYSICS.dt);
  }

  /** Where along its way a forklift should be, so far through its round; and which way it goes there. */
  private along(desc: RigDesc, frac: number): { x: number; z: number; dx: number; dz: number } {
    const pts = desc.path ?? [[desc.pos[0], desc.pos[2]]];
    const legs = desc.back ? pts.slice(0, -1).map((p, i) => [p, pts[i + 1]]) : pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
    const lengths = legs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
    const total = lengths.reduce((a, b) => a + b, 0) || 1;
    // Along and back: out over the first half of the round, back over the second, facing the same way.
    let d = desc.back ? (frac < 0.5 ? frac * 2 : 2 - frac * 2) * total : frac * total;
    for (let n = 0; n < legs.length; n++) {
      if (d <= lengths[n] || n === legs.length - 1) {
        const [a, b] = legs[n], t = Math.min(1, d / (lengths[n] || 1));
        return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: (b[0] - a[0]) / (lengths[n] || 1), dz: (b[1] - a[1]) / (lengths[n] || 1) };
      }
      d -= lengths[n];
    }
    return { x: pts[0][0], z: pts[0][1], dx: 0, dz: 1 };
  }

  /** A forklift driven toward where its round has it now, with no more than its own engine's push; turned to face its way. */
  private drive(rig: Rig, frac: number, dt: number): void {
    const body = rig.parts[1].body;
    const at = this.along(rig.desc, frac), ahead = this.along(rig.desc, (frac + dt / rig.desc.period) % 1);
    const p = body.translation(), v = body.linvel(), m = body.mass();
    const want = [(ahead.x - at.x) / dt + (at.x - p.x) * 2, (ahead.z - at.z) / dt + (at.z - p.z) * 2];
    const f = [(want[0] - v.x) * 6 * m, (want[1] - v.z) * 6 * m];
    const size = Math.hypot(f[0], f[1]), scale = size > FORK_FORCE ? FORK_FORCE / size : 1;
    body.resetForces(true);
    body.addForce({ x: f[0] * scale, y: 0, z: f[1] * scale }, true);
    // Round the corners it turns to its new way; going back along it, it keeps facing the way it came, reversing.
    const yaw = Math.atan2(at.dx, at.dz);
    q.setFromAxisAngle(v3.set(0, 1, 0), yaw);
    const r = body.rotation();
    const now = new Quaternion(r.x, r.y, r.z, r.w).slerp(q, Math.min(1, dt * 4));
    body.setRotation({ x: now.x, y: now.y, z: now.z, w: now.w }, true);
  }

  /** Where a crane's grab hangs, its bottom this high, under its jib's head as the jib now faces. */
  private grabAt(rig: Rig, height: number): { x: number; y: number; z: number } {
    const turned = rig.desc.yaw + rig.angle;
    return { x: rig.desc.pos[0] + Math.sin(turned) * CRANE_REACH, y: rig.desc.pos[1] + height, z: rig.desc.pos[2] + Math.cos(turned) * CRANE_REACH };
  }

  /** The grab hauled toward a place, keeping up with it as it moves, with no more than the winch's and the jib's force. */
  private haul(rig: Rig, to: { x: number; y: number; z: number }, dt: number): void {
    const body = rig.parts[2].body;
    const p = body.translation();
    const vel = body.linvel();
    const was = rig.aim ?? to;
    const m = body.mass();
    const want = [(to.x - was.x) / dt + (to.x - p.x) * 3, (to.y - was.y) / dt + (to.y - p.y) * 3, (to.z - was.z) / dt + (to.z - p.z) * 3];
    const f = [(want[0] - vel.x) * 8 * m, (want[1] - vel.y) * 8 * m + m * G, (want[2] - vel.z) * 8 * m];
    const size = Math.hypot(f[0], f[1], f[2]);
    const scale = size > GRAB_FORCE ? GRAB_FORCE / size : 1;
    body.resetForces(true);
    body.addForce({ x: f[0] * scale, y: f[1] * scale, z: f[2] * scale }, true);
    rig.aim = to;
  }

  /**
   * How hard the machines have just hit the truck, as a car's run into it is measured: the speed the part meeting it had
   * against it, by how much of the two together it weighs. 0 when nothing of them is touching it.
   */
  struck(truck: RAPIER.RigidBody): number {
    const tv = truck.linvel();
    const truckMass = truck.mass();
    let worst = 0;
    for (const rig of this.list) {
      for (let n = 1; n < rig.parts.length; n++) {
        const { body } = rig.parts[n];
        if (body.isFixed()) continue;
        const lv = body.linvel(), av = body.angvel(), o = body.translation();
        const mass = body.isKinematic() ? 20000 : body.mass();
        for (let k = 0; k < body.numColliders(); k++) {
          const own = body.collider(k);
          this.world.contactPairsWith(own, (other) => {
            if (other.parent()?.handle !== truck.handle) return;
            this.world.contactPair(own, other, (manifold) => {
              if (manifold.numContacts() === 0) return;
              // The part's own speed where it meets the truck: its travel, and its turning about its middle.
              const c = own.translation();
              const rx = c.x - o.x, ry = c.y - o.y, rz = c.z - o.z;
              const vx = lv.x + av.y * rz - av.z * ry, vy = lv.y + av.z * rx - av.x * rz, vz = lv.z + av.x * ry - av.y * rx;
              const impact = Math.hypot(vx - tv.x, vy - tv.y, vz - tv.z);
              worst = Math.max(worst, (impact * mass) / (truckMass + mass));
            });
          });
        }
      }
    }
    return worst;
  }

  /** Turn a part about its joint toward an angle (0 = toward the road), no faster than `rate` radians a second. */
  private turn(rig: Rig, joint: RAPIER.RevoluteImpulseJoint, body: RAPIER.RigidBody, target: number, rate: number): void {
    const r = body.rotation();
    v.set(0, 0, 1).applyQuaternion(q.set(r.x, r.y, r.z, r.w));
    const facing = Math.atan2(v.x, v.z) - rig.desc.yaw;
    // Counted on round, not taken the short way: a crane that has to go half a turn goes the way it was told.
    rig.angle += Math.atan2(Math.sin(facing - rig.angle), Math.cos(facing - rig.angle));
    const off = target - rig.angle;
    joint.configureMotorVelocity(Math.max(-rate, Math.min(rate, off * 3)), 40);
  }

  /** Slide a part along its joint toward a place, no faster than `rate` metres a second. */
  private slide(joint: RAPIER.PrismaticImpulseJoint, now: number, target: number, rate: number, gain = 3): void {
    joint.configureMotorVelocity(Math.max(-rate, Math.min(rate, (target - now) * gain)), 40);
  }

  /** Where the ball crane's jib head is, with the crane slewed this far. */
  private ballHead(rig: Rig, angle: number): { x: number; y: number; z: number } {
    const turned = rig.desc.yaw + angle;
    return { x: rig.desc.pos[0] + Math.sin(turned) * BALL_REACH, y: rig.desc.pos[1] + BALL_HEAD_Y, z: rig.desc.pos[2] + Math.cos(turned) * BALL_REACH };
  }

  /**
   * The ball's cable: it holds the ball no further than its length from the jib's head, wherever the head is going this
   * step. Going out past that, the ball loses what it had of its speed away from the head, and is drawn back to it; so,
   * swung round, it is dragged round after the head, flung out on its cable.
   */
  private rope(rig: Rig, dt: number): void {
    const ball = rig.parts[2].body;
    const now = this.ballHead(rig, rig.angle - (rig.turning ?? 0));
    const head = this.ballHead(rig, rig.angle);
    const p = ball.translation();
    const dx = p.x - head.x, dy = p.y - head.y, dz = p.z - head.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist <= BALL_CABLE) return;
    const nx = dx / dist, ny = dy / dist, nz = dz / dist;
    const hv = { x: (head.x - now.x) / dt, y: 0, z: (head.z - now.z) / dt };
    const lv = ball.linvel();
    const out = (lv.x - hv.x) * nx + (lv.y - hv.y) * ny + (lv.z - hv.z) * nz;
    // Only its speed outward along the cable is taken off, and it is drawn in by a little of how far it is past the end,
    // no more: anything more throws it about.
    const cut = Math.max(0, out + ((dist - BALL_CABLE) / dt) * 0.1);
    ball.setLinvel({ x: lv.x - nx * cut, y: lv.y - ny * cut, z: lv.z - nz * cut }, true);
  }

  /** Everything back where it started, at the start of its round. */
  reset(): void {
    for (const rig of this.list) {
      rig.time = 0;
      rig.warn = false;
      rig.drip = 0;
      rig.angle = 0;
      rig.aim = undefined;
      for (const slip of rig.slips ?? []) slip.stuck = true;
      if (rig.desc.kind === 'float') rig.pose = rig.was = restPose(rig.desc);
      rig.surge = undefined;
      rig.armed = false;
      for (const { body, pos, rot } of rig.start) {
        body.setTranslation(pos, true);
        body.setRotation(rot, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      if (rig.desc.kind === 'clamshell') {
        q.setFromAxisAngle(v.set(0, 1, 0), rig.desc.yaw);
        rig.parts[1].body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
        rig.parts[2].body.setTranslation(this.grabAt(rig, GRAB[0][1] + 1.5), true);
      }
      // The ball's crane starts where its round has it, already going round, the ball flung out on its cable as it would be.
      if (rig.desc.kind === 'ball') {
        rig.angle = ballAngle(rig.desc.phase);
        rig.turning = 0;
        q.setFromAxisAngle(v.set(0, 1, 0), rig.desc.yaw + rig.angle);
        rig.parts[1].body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
        const spin = (2 * Math.PI) / rig.desc.period;
        // Round steadily, the cable at the angle at which it carries the ball round: its pull inward is what keeps it going round.
        let tilt = 1;
        for (let n = 0; n < 30; n++) tilt = Math.atan((spin * spin * (BALL_REACH + BALL_CABLE * Math.sin(tilt))) / G);
        const r = BALL_REACH + BALL_CABLE * Math.sin(tilt);
        const turned = rig.desc.yaw + rig.angle;
        const [cx, cy, cz] = rig.desc.pos;
        const ball = rig.parts[2].body;
        ball.setTranslation({ x: cx + Math.sin(turned) * r, y: cy + BALL_HEAD_Y - BALL_CABLE * Math.cos(tilt), z: cz + Math.cos(turned) * r }, true);
        ball.setLinvel({ x: spin * Math.cos(turned) * r, y: 0, z: -spin * Math.sin(turned) * r }, true);
      }
    }
  }
}

/** The most a forklift's engine pushes it with, newtons. */
const FORK_FORCE = 70000;
const v3 = new Vector3();
/** A hanging bridge's deck: how wide; how far it rocks to either side, radians, and how far it rises and falls, metres; how
 * high its cables are over it at the towers and in the middle. */
const SWAY_WIDE = 4.4;
const SWAY_ROLL = 0.1;
const SWAY_BOB = 0.08;
const SWAY_TOWER = 6;
const SWAY_SAG = 1.2;
/** How high the boom's middle is above the ground it stands on. */
const BOOM_Y = 1.55;
/** How far out from the pile driver's middle its hammer is. */
const PILE_OUT = 5.4;
/**
 * The ball crane's jib head: how high above the crane's feet, how far out; and the cable from it to the ball's middle. The
 * jib stands up steep and the cable is long, worked out (dev/ball-path.ts) with the air's drag below so that, going round
 * as it does, the ball settles on the same round as it always did but comes over the dike's road with its middle 2.0 to
 * 2.8 m above it, low enough to hit a truck's side rather than skim its top. Much longer and it falls in.
 */
const BALL_HEAD_Y = 7.6;
const BALL_REACH = 5.0;
const BALL_CABLE = 8;
/** The ball's size: big enough that, flung out high going round, it still comes at the height of a truck's sides. */
const BALL_RADIUS = 1.5;
/** The air against the ball going round, a share of its speed a second: what has it trail behind the jib's head. */
const BALL_DRAG = 0.8;
/** The ball crane's jib, round from straight at the road (0), as far through its turn as it is: at the far side of it to begin with. */
const ballAngle = (frac: number) => frac * 2 * Math.PI - Math.PI;
/** How far out a crane's grab hangs; and the most force its winch and jib put on it, newtons. */
const CRANE_REACH = 10.5;
const GRAB_FORCE = 70000;
