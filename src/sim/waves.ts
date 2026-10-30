import type RAPIER from '@dimforge/rapier3d-compat';
import type { WaveDesc } from '../levels/types';

// Waves breaking over a sea wall in a storm: not evenly, a little sooner or later each time, every so often a bigger one. Seen coming for a while out on
// the water; then it breaks over the edge, and a sheet of water runs in across the top, its front going in so far, the
// water behind it running inland and dying away. Whatever is in it is dragged the way it runs, by how much slower than
// the water it is going: a truck stood still is shoved hardest, one going with it hardly at all. What is in the truck's
// bed is not touched: the water comes no higher than its wheels.

/** How fast the front runs in, how fast the water behind it runs, metres a second; how long it runs, seconds. */
const FRONT = 11;
const FLOW = 6;
const RUNS = 1.5;
/** How long it is seen coming before it breaks, seconds. */
export const WAVE_WARN = 3;
/** How hard the water drags, a second, on whatever is in it: on a truck, on what is loose on the ground. */
const DRAG_TRUCK = 24;
const DRAG_LOOSE = 14;
/** Among piles, how high over its top the water comes, so far as a body's middle: a truck's on a deck higher by a metre and a half is dry. */
const PILES_DEEP = 1.3;
/** A wave called for, how long after it is first seen it breaks, seconds. */
const SUMMONED = WAVE_WARN + 0.5;
/** A big wave: how much harder, how much further in. */
const BIG_HARD = 1.4;
const BIG_FAR = 1.35;

export interface WaveState {
  desc: WaveDesc;
  /** Seconds since it last broke; and to the next. */
  since: number;
  until: number;
  /** Whether the one that last broke, and the one coming, are big. */
  big: boolean;
  nextBig: boolean;
  /** How far in its front has run, metres from the edge; how hard the water behind it still runs, 0 to 1. */
  front: number;
  strength: number;
  /** When each wave breaks, seconds from the start, worked out as far as needed; which was the last to. */
  times: number[];
  last: number;
  /** One called for to come big, by its place in `times`. */
  bigAt?: number;
}

/** How much the time between waves goes either way of its period, as a share of it. */
const UNEVEN = 0.3;

/** The stretches of a wave's edge it does come over, metres along it: all of it but where it is sheltered. */
export function openStretches(desc: WaveDesc): [number, number][] {
  const long = Math.hypot(desc.to[0] - desc.from[0], desc.to[1] - desc.from[1]);
  const out: [number, number][] = [];
  let at = 0;
  for (const [a, b] of [...(desc.lee ?? [])].sort((p, q) => p[0] - q[0])) {
    if (a > at) out.push([at, a]);
    at = Math.max(at, b);
  }
  if (at < long) out.push([at, long]);
  return out;
}

/** Whether a place is in the lee of what stands along a wave's edge. */
export function sheltered(desc: WaveDesc, x: number, z: number): boolean {
  const dx = desc.to[0] - desc.from[0], dz = desc.to[1] - desc.from[1];
  const along = ((x - desc.from[0]) * dx + (z - desc.from[1]) * dz) / Math.hypot(dx, dz);
  return !!desc.lee?.some(([a, b]) => along > a && along < b);
}

export class Waves {
  readonly list: WaveState[];
  /** Waves broken since the last call: along their edges, for the spray. */
  private breaks: { desc: WaveDesc; big: boolean }[] = [];
  private time = 0;

  constructor(descs: readonly WaveDesc[]) {
    this.list = descs.map((desc) => ({ desc, since: 99, until: 0, big: false, nextBig: false, front: 0, strength: 0, times: [], last: 0 }));
    this.reset();
  }

  reset(): void {
    this.time = 0;
    this.breaks = [];
    for (const wave of this.list) {
      wave.last = 0;
      wave.times = [];
      wave.bigAt = undefined;
    }
    for (const wave of this.list) this.at(wave);
  }

  /** Where in its round a wave is at the present time. */
  private at(wave: WaveState): void {
    const { big } = wave.desc;
    this.grow(wave, () => wave.times[wave.times.length - 1] <= this.time);
    if (wave.times[wave.last] > this.time) wave.last = 0;
    while (wave.times[wave.last + 1] <= this.time) wave.last++;
    const n = wave.last;
    wave.since = this.time - wave.times[n];
    wave.until = wave.times[n + 1] - this.time;
    const isBig = (k: number) => k === wave.bigAt || (!!big && ((k % big) + big) % big === big - 1);
    wave.big = isBig(n);
    wave.nextBig = isBig(n + 1);
    const reach = wave.desc.reach * (wave.big ? BIG_FAR : 1);
    wave.front = Math.min(reach, wave.since * FRONT);
    wave.strength = wave.since < RUNS ? (1 - wave.since / RUNS) * (wave.big ? BIG_HARD : 1) * (wave.desc.force ?? 1) : 0;
  }

  /** Work out when each wave breaks for as long as asked. */
  private grow(wave: WaveState, more: () => boolean): void {
    const { period, phase } = wave.desc;
    if (!wave.times.length) wave.times.push(-phase * period);
    // Each the next after the one before, by its period made a little longer or shorter, the same every time it is played.
    while (more()) {
      const k = wave.times.length;
      const r = Math.sin(k * 12.9898 + phase * 78.233) * 43758.5453;
      wave.times.push(wave.times[k - 1] + period * (1 - UNEVEN + 2 * UNEVEN * (r - Math.floor(r))));
    }
  }

  /** The wave whose edge a place lies off, if any. */
  near(x: number, z: number): WaveState | undefined {
    return this.list.find(({ desc: { from, to } }) => {
      const dx = to[0] - from[0], dz = to[1] - from[1];
      const along = ((x - from[0]) * dx + (z - from[1]) * dz) / Math.hypot(dx, dz);
      return along >= 0 && along <= Math.hypot(dx, dz);
    });
  }

  /**
   * Call for a big wave, soon: the next in, if it is not about to break already and comes no later than it would if
   * it were first seen now; else the one after, brought on. Seconds until it breaks.
   */
  summon(wave: WaveState): number {
    if (wave.bigAt === undefined || wave.bigAt <= wave.last) {
      let k = wave.last + 1;
      if (wave.times[k] - this.time < 1.5) k++;
      this.grow(wave, () => wave.times.length <= k);
      const soon = Math.max(this.time, wave.times[k - 1]) + SUMMONED;
      if (wave.times[k] > soon) {
        wave.times[k] = soon;
        wave.times.length = k + 1;
      }
      wave.bigAt = k;
    }
    return wave.times[wave.bigAt] - this.time;
  }

  update(dt: number): void {
    const before = this.list.map((wave) => wave.since);
    this.time += dt;
    this.list.forEach((wave, k) => {
      this.at(wave);
      if (wave.since < before[k]) this.breaks.push({ desc: wave.desc, big: wave.big });
    });
  }

  drainBreaks(): { desc: WaveDesc; big: boolean }[] {
    const out = this.breaks;
    this.breaks = [];
    return out;
  }

  /** Drag a body by the water it is standing in, if any: truck or loose. */
  push(body: RAPIER.RigidBody, dt: number, truck: boolean): void {
    const p = body.translation();
    for (const wave of this.list) {
      if (wave.strength <= 0) continue;
      const { from, to, inland } = wave.desc;
      const dx = to[0] - from[0], dz = to[1] - from[1];
      const long = Math.hypot(dx, dz);
      const along = ((p.x - from[0]) * dx + (p.z - from[1]) * dz) / long;
      const into = (p.x - from[0]) * inland[0] + (p.z - from[1]) * inland[1];
      if (along < 0 || along > long || into < -1 || into > wave.front) continue;
      // In the lee of what stands along the edge: dry.
      if (wave.desc.lee?.some(([a, b]) => along > a && along < b)) continue;
      // Not what is up out of the water: on a deck above the top, in the air.
      if (p.y > (wave.desc.y ?? 0) + (wave.desc.piles ? PILES_DEEP : 2.2)) continue;
      const v = body.linvel();
      const slower = FLOW * wave.strength - (v.x * inland[0] + v.z * inland[1]);
      if (slower <= 0) continue;
      const shove = slower * (truck ? DRAG_TRUCK : DRAG_LOOSE) * body.mass() * dt;
      body.applyImpulse({ x: inland[0] * shove, y: 0, z: inland[1] * shove }, true);
    }
  }
}
