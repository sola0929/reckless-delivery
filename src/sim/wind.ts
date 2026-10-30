import type { GustDesc } from '../levels/types';
import type { ObjectDesc, ObjectKind } from '../levels/objects';
import type { Hits } from './hits';
import type { LooseObject, ObjectSystem } from './objects';

// Gusts down the alleys in a storm: the wind squeezed between the houses comes out of each alley's mouth across the
// street in gusts, on a beat of its own, seen coming as the banners at its mouth stand out straight. It blows on what is
// loose, never on the truck: whatever is piled in the alley, the most exposed of it first, a few things at a gust, and
// whatever is already out on the street, the lighter and the more of it there is to catch the wind the harder.

/** How long before a gust its banners stand out, seconds. */
export const GUST_WARN = 1.2;
/** How long a gust takes to come up to full, and to die away, seconds. */
const RISE = 0.25;
const FALL = 0.4;
/** The most it can speed something up, metres a second a second; and from what on it lifts it off the ground, by how much of that. */
const MOST = 30;
const LIFTS_FROM = 6;
const LIFT = 0.35;
/** The lightest, sped up more than this, are lifted by more: high enough to come down in the truck's bed. And none lifted once rising this fast. */
const LIFTS_HIGH_FROM = 14;
const LIFT_HIGH = 0.75;
const RISING = 2.5;
/** Above this, metres, nothing is lifted further: what is carried comes across at about the height of the load. */
const CEILING = 2.2;
/** How many things each alley's roofs have to send, in turn; and where they wait meanwhile, out of the world. */
const FEED_POOL = 60;
const WAITING_Y = -80;
/** Something sent from the roofs that has gone into the water, or is this far from its alley's mouth, may be sent again. */
const SEND_AGAIN_FROM = 45;
/** How fast the gust itself goes, metres a second: what it carries goes no faster along it than that. */
const GUST_SPEED = 16;
/** Out of the alley's mouth across the street, how much of it is left at its far end. */
const SPENT = 0.6;
/** How near the truck comes to an alley's mouth, metres, for its gusts to begin: long before it can see in, so that by the time it does they are well on. */
const WAKES = 90;

export interface GustState {
  desc: GustDesc;
  /** Seconds since its beat began, once the truck has come near; until then, null. */
  clock: number | null;
  /** How hard it is blowing now, 0 to 1; whether its banners are out. */
  strength: number;
  warned: boolean;
  /** The beats begun so far: each one takes its few from the pile. */
  begun: number;
  /** What its roofs send, and which of them goes next. */
  pool: LooseObject[];
  next: number;
}

/** How much of a thing there is for the wind to catch, square metres: the mean of the sides of what is solid of it. */
const windage = new WeakMap<ObjectKind, number>();
function catches(kind: ObjectKind): number {
  let got = windage.get(kind);
  if (got !== undefined) return got;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const part of kind.parts) {
    if (part.ghost) continue;
    const r = part.shape === 'box' ? part.size : part.shape === 'sphere' ? [part.size[0], part.size[0], part.size[0]] : [part.size[0], part.size[1], part.size[0]];
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], part.pos[i] - r[i]);
      hi[i] = Math.max(hi[i], part.pos[i] + r[i]);
    }
  }
  const [x, y, z] = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
  got = isFinite(x) ? (x * y + y * z + x * z) / 3 : 0;
  windage.set(kind, got);
  return got;
}

export class Wind {
  readonly list: GustState[];

  /** What each alley's roofs have to send, waiting out of the world, after the level's own things. */
  static waiting(descs: GustDesc[]): ObjectDesc[] {
    return descs.flatMap((desc, d) => (desc.feed ? Array.from({ length: FEED_POOL }, (_, n): ObjectDesc => ({ kind: desc.feed!.kinds[n % desc.feed!.kinds.length], pos: [desc.mouth[0] - 60, WAITING_Y - n * 3, desc.mouth[1] + d * 4] })) : []));
  }

  /** @param first where in the object system's list the first of the roofs' things is */
  /** @param hits what follows the things let go, to tell when they strike the truck */
  constructor(descs: GustDesc[], private readonly objects?: ObjectSystem, first = 0, private readonly hits?: Hits) {
    let at = first;
    this.list = descs.map((desc) => {
      const pool = desc.feed && objects ? objects.objects.slice(at, (at += FEED_POOL)) : [];
      for (const object of pool) objects!.stow(object);
      return { desc, clock: null, strength: 0, warned: false, begun: 0, pool, next: 0 };
    });
  }

  /** Where along its way something is, metres from deep in the alley, and how far to the side; and how hard it blows there, 0 to 1. */
  private reach(desc: GustDesc, x: number, z: number): number {
    const [fx, fz] = desc.from, [mx, mz] = desc.mouth, [tx, tz] = desc.to;
    const lx = tx - fx, lz = tz - fz, long = Math.hypot(lx, lz);
    const ux = lx / long, uz = lz / long;
    const along = (x - fx) * ux + (z - fz) * uz, across = -(x - fx) * uz + (z - fz) * ux;
    const mouth = (mx - fx) * ux + (mz - fz) * uz;
    // Out of the mouth it spreads, as wind out of a slot does, to `spread` either side at the far end.
    const half = along <= mouth ? desc.half : desc.half + ((desc.spread ?? desc.half) - desc.half) * (along - mouth) / Math.max(1, long - mouth);
    if (along < 0 || along > long || Math.abs(across) > half) return 0;
    return along <= mouth ? 1 : 1 - ((1 - SPENT) * (along - mouth)) / Math.max(1, long - mouth);
  }

  /** Each step: the beats kept, from when the truck first comes near; how hard each blows; and each new gust's few taken from the pile. */
  update(dt: number, truck: { x: number; z: number }, objects: LooseObject[]): void {
    for (const gust of this.list) {
      const { desc } = gust;
      if (gust.clock === null) {
        if (Math.hypot(truck.x - desc.mouth[0], truck.z - desc.mouth[1]) > (desc.wakes ?? WAKES)) continue;
        gust.clock = 0;
      }
      const before = gust.clock;
      gust.clock += dt;
      const cycles = Math.floor(gust.clock / desc.period), t = gust.clock - cycles * desc.period;
      gust.strength = 0;
      gust.warned = false;
      for (const [start, length] of desc.beats) {
        if (t >= start - GUST_WARN && t < start + length + FALL) gust.warned = true;
        if (t >= start && t < start + length + FALL) {
          const up = Math.min(1, (t - start) / RISE), down = t > start + length ? 1 - (t - start - length) / FALL : 1;
          gust.strength = Math.max(gust.strength, Math.min(up, down));
        }
        // A gust just begun: off the pile, the few most exposed, nearest the street.
        const began = cycles * desc.period + start;
        if (before < began && gust.clock >= began) this.take(gust, objects);
      }
    }
  }

  /** A new gust takes so many of what is still piled in its alley, the ones nearest its mouth first: those behind are sheltered by them. */
  private take(gust: GustState, objects: LooseObject[]): void {
    const { desc } = gust;
    gust.begun++;
    this.send(gust);
    const [fx, fz] = desc.from, [tx, tz] = desc.to, long = Math.hypot(tx - fx, tz - fz);
    const piled = objects.filter((o) => !o.near && o.body.isEnabled() && this.reach(desc, o.body.translation().x, o.body.translation().z) > 0);
    const along = (o: LooseObject) => { const p = o.body.translation(); return ((p.x - fx) * (tx - fx) + (p.z - fz) * (tz - fz)) / long; };
    piled.sort((a, b) => along(b) - along(a) || b.body.translation().y - a.body.translation().y);
    for (const object of piled.slice(0, desc.take)) {
      if (this.pull(object, desc.force) < LIFTS_FROM / 2) continue;
      // Let go: from now on it is the wind's, and the solver's, and not to be tossed as though the truck had hit it.
      object.near = true;
      object.blown = true;
      object.body.wakeUp();
      this.hits?.track(object);
    }
  }

  /** Off the roofs: the next few in turn that are not still to be seen, put behind a parapet and sent up over it. */
  private send(gust: GustState): void {
    const { desc, pool } = gust;
    if (!desc.feed || !this.objects) return;
    // The roofs have only so much on them: no more comes off while so many of what has are still lying about down there,
    // only as what has gone into the harbour, or been carried far off from the alley, is made up.
    const gone = (object: LooseObject) => {
      if (!object.body.isEnabled()) return true;
      const p = object.body.translation();
      return p.y < -1 || Math.hypot(p.x - desc.mouth[0], p.z - desc.mouth[1]) > SEND_AGAIN_FROM;
    };
    const out = pool.filter((object) => !gone(object)).length;
    const room = Math.min(desc.feed.each, Math.max(0, (desc.feed.most ?? Math.ceil(desc.feed.each * 1.5)) - out));
    let sent = 0;
    for (let tries = 0; tries < pool.length && sent < room; tries++) {
      const n = gust.next;
      gust.next = (gust.next + 1) % pool.length;
      const object = pool[n];
      if (!gone(object)) continue;
      const at = desc.feed.at[(gust.begun + sent) % desc.feed.at.length];
      const push = desc.feed.push[(gust.begun + sent) % desc.feed.push.length];
      this.objects.send(object, { x: at[0], y: at[1], z: at[2] }, { x: push[0], y: push[1], z: push[2] });
      object.blown = true;
      this.hits?.track(object, { x: push[0], y: push[1], z: push[2] });
      sent++;
    }
  }

  /** How hard a gust at full speeds something up, metres a second a second, by how much of it there is to catch it against its weight. */
  private pull(object: LooseObject, force: number): number {
    return Math.min(MOST, (force * catches(object.kind)) / object.body.mass());
  }

  /** Each step: whatever has been let go, in a gust's way while it blows, pushed along it, the lightest lifted. */
  blow(objects: LooseObject[], dt: number): void {
    for (const gust of this.list) {
      if (gust.strength <= 0) continue;
      const { desc } = gust;
      const lx = desc.to[0] - desc.from[0], lz = desc.to[1] - desc.from[1], long = Math.hypot(lx, lz);
      for (const object of objects) {
        if (!object.near || !object.body.isEnabled() || !object.body.isDynamic()) continue;
        const p = object.body.translation();
        const here = this.reach(desc, p.x, p.z);
        if (here <= 0) continue;
        // Pushed the harder the slower it goes beside the wind; going as fast, not at all.
        const v = object.body.linvel(), going = (v.x * lx + v.z * lz) / long;
        const full = this.pull(object, desc.force) * here * gust.strength, a = full * Math.max(0, 1 - going / GUST_SPEED);
        if (full < 1) continue;
        const m = object.body.mass();
        // Lifted by the wind getting under it, however fast it is already going along.
        const up = v.y > RISING || p.y > (desc.floor ?? 0) + CEILING ? 0 : full > LIFTS_HIGH_FROM ? full * LIFT_HIGH : full > LIFTS_FROM ? full * LIFT : 0;
        object.body.applyImpulse({ x: (lx / long) * a * m * dt, y: up * m * dt, z: (lz / long) * a * m * dt }, true);
      }
    }
  }

  /** How the wind blows at a place now, across the ground: for the rain and the banners. */
  at(x: number, z: number): [number, number] {
    let wx = 0, wz = 0;
    for (const gust of this.list) {
      if (gust.strength <= 0) continue;
      const { desc } = gust;
      const here = this.reach(desc, x, z) * gust.strength;
      const lx = desc.to[0] - desc.from[0], lz = desc.to[1] - desc.from[1], long = Math.hypot(lx, lz);
      wx += (lx / long) * here;
      wz += (lz / long) * here;
    }
    return [wx, wz];
  }

  reset(): void {
    for (const gust of this.list) {
      for (const object of gust.pool) this.objects?.stow(object);
      for (const object of this.objects?.objects ?? []) object.blown = false;
      gust.next = 0;
      gust.clock = null;
      gust.strength = 0;
      gust.warned = false;
      gust.begun = 0;
    }
  }
}
