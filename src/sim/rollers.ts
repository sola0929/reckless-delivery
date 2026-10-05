import { Quaternion, Vector3 } from 'three';
import { OBJECT_KINDS, type ObjectDesc } from '../levels/objects';
import type { RollerDesc } from '../levels/types';
import type { LooseObject, ObjectSystem } from './objects';

/** How near the truck must be to a hill, metres, for things to be coming down it. */
const AWAKE_WITHIN = 420;
/** How many of them a line has to let go, at most: the first is taken back for the next when they run out. */
const MOST = 24;
/** Where they wait: well under the ground, asleep. */
const WAITING_Y = -60;

/** Gravity; the share of it that speeds up something rolling rather than sliding; what the road takes back, m/s²; and the fastest anything gets. */
const G = 9.81;
const ROLLING = 0.66;
const RESISTANCE = 0.3;
const TOP_SPEED = 24;

const UP = new Vector3(0, 1, 0);
const q = new Quaternion();
const axis = new Vector3();
const spinAxis = new Vector3();
const lying = new Quaternion();

interface Line {
  desc: RollerDesc;
  pool: LooseObject[];
  /** Which of them are out on the hill. */
  out: boolean[];
  next: number;
  clock: number;
  /** Along the line, as a direction. */
  across: [number, number];
  /** How far round each has turned since it was let go, radians. */
  turned: number[];
  /** Seconds each has been loose, no longer carried. */
  since: number[];
  /** Where along the line the last one was let go, 0 to 1. */
  last: number;
}

/**
 * Hills that things roll down. Each line across the top of one lets go a drum, a gas cylinder
 * or whatever it has, every so often, somewhere along itself, laid on its side and already
 * moving; and takes each back when it has got far enough down, to let it go again.
 */
export class Rollers {
  private readonly lines: Line[] = [];
  private seed = 7;

  /** What each line has to let go, as things placed out of the way: these go after the level's own in the list of its objects. */
  static waiting(descs: RollerDesc[]): ObjectDesc[] {
    return descs.flatMap((desc) => Array.from({ length: Rollers.count(desc) }, (_, n): ObjectDesc => ({ kind: desc.kinds[n % desc.kinds.length], rolls: !desc.sharp, pos: [desc.from[0], WAITING_Y - n * 2, desc.from[1]] })));
  }

  /** Enough that none is taken back for the next while it can still be on its way down: half a minute and more of them. */
  private static count(desc: RollerDesc): number {
    return Math.max(MOST, Math.ceil(36 / desc.every));
  }

  /** @param first where in the object system's list the first of the waiting things is */
  constructor(private readonly objects: ObjectSystem, descs: RollerDesc[], first: number, private readonly ground: (x: number, z: number) => number) {
    for (const desc of descs) {
      const count = Rollers.count(desc);
      const wide = Math.hypot(desc.to[0] - desc.from[0], desc.to[1] - desc.from[1]);
      this.lines.push({ desc, pool: objects.objects.slice(first, first + count), out: Array(count).fill(false), next: 0, clock: 0, last: 0.5, since: Array(count).fill(0), turned: Array(count).fill(0), across: [(desc.to[0] - desc.from[0]) / wide, (desc.to[1] - desc.from[1]) / wide] });
      first += count;
    }
  }

  /** Whether the truck is within a line's `within` of the strip of hill its things come down. */
  private near(desc: RollerDesc, truck: { x: number; z: number }): boolean {
    const [ax, az] = desc.from, [bx, bz] = desc.to, [dx, dz] = desc.down;
    // Across the line, and down the hill from it.
    const wide = Math.hypot(bx - ax, bz - az) || 1;
    const ux = (bx - ax) / wide, uz = (bz - az) / wide;
    const rx = truck.x - (ax + bx) / 2, rz = truck.z - (az + bz) / 2;
    const across = Math.max(0, Math.abs(rx * ux + rz * uz) - wide / 2);
    const down = rx * dx + rz * dz;
    const along = down < 0 ? -down : Math.max(0, down - desc.run);
    return Math.hypot(across, along) < desc.within!;
  }

  update(dt: number, truck: { x: number; z: number }): void {
    for (const line of this.lines) {
      const { desc, pool } = line;
      const [dx, dz] = desc.down;
      // Those that have got to the bottom, or fallen off the world, are taken back.
      pool.forEach((object, n) => {
        if (!line.out[n]) return;
        const p = object.body.translation();
        const gone = (p.x - desc.from[0]) * dx + (p.z - desc.from[1]) * dz;
        if (p.y < WAITING_Y / 2) {
          this.objects.park(object);
          line.out[n] = false;
          return;
        }
        // Past the foot of the hill: let go, to roll on into whatever is there; and not counted as lingering until then.
        if (gone > desc.run && object.rolling) object.rolling = false;
        if (object.rolling) line.since[n] = 0;
        if (!object.rolling || desc.free) return;
        // Still rolling: straight down the hill, lying square across it, as fast as the slope under it has made it, and on the road.
        // Left to the road it catches on every join in it, hops, creeps round, runs off to one side and ends against a wall.
        const part = OBJECT_KINDS[object.desc.kind].parts[0];
        const radius = part.size[0];
        // Where its middle is: half its height along itself from where it is held.
        const cx = p.x + line.across[0] * part.pos[1], cz = p.z + line.across[1] * part.pos[1];
        const fall = (this.ground(cx - dx, cz - dz) - this.ground(cx + dx, cz + dz)) / 2;
        const pace = Math.max(0, Math.min(TOP_SPEED, object.pace! + (G * ROLLING * (fall / Math.hypot(1, fall)) - RESISTANCE) * dt));
        object.pace = pace;
        // What it is carried over is a slope. A step up ahead it runs into; over the edge of a drop it goes as it would; and
        // once it has come to a stop it is left to lie there, or roll back, as it likes. From then on it is like anything else.
        const here = this.ground(cx, cz);
        const ahead = this.ground(cx + dx * (radius + 0.4), cz + dz * (radius + 0.4));
        if (ahead - here > 0.25 || here - ahead > 0.6 + (radius + 0.4) * fall || pace < 0.3) {
          object.rolling = false;
          return;
        }
        const rest = here + radius;
        object.body.setLinvel({ x: dx * pace, y: -pace * fall + (rest - p.y) * 8, z: dz * pace }, true);
        // Turning about the line it lies along (up crossed with the way it is going), and lying along that line still:
        // the road would turn it round little by little, and then it would run off to one side.
        object.body.setAngvel({ x: (dz * pace) / radius, y: 0, z: (-dx * pace) / radius }, true);
        line.turned[n] += (pace / radius) * dt;
        axis.set(line.across[0], 0, line.across[1]);
        q.setFromAxisAngle(spinAxis.set(dz, 0, -dx), line.turned[n]).multiply(lying.setFromUnitVectors(UP, axis));
        object.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      });
      const mx = (desc.from[0] + desc.to[0]) / 2, mz = (desc.from[1] + desc.to[1]) / 2;
      if (desc.within === undefined ? Math.hypot(truck.x - mx, truck.z - mz) > AWAKE_WITHIN : !this.near(desc, truck)) continue;
      // Not like clockwork: each a little sooner or later than the last, but never so soon as to run into it.
      line.clock -= dt;
      while (line.clock <= 0) {
        line.clock += desc.every * (0.75 + this.random() * 0.5);
        const n = line.next++ % pool.length;
        const object = pool[n];
        // Somewhere along the line, but well to one side of where the last one went.
        let t = 0.06 + this.random() * 0.88;
        for (let tries = 0; tries < 6 && Math.abs(t - line.last) < 0.3; tries++) t = 0.06 + this.random() * 0.88;
        line.last = t;
        const x = desc.from[0] + (desc.to[0] - desc.from[0]) * t;
        const z = desc.from[1] + (desc.to[1] - desc.from[1]) * t;
        // On its side, across the hill: what was its upright is laid along the line.
        const part = OBJECT_KINDS[object.desc.kind].parts[0];
        const radius = part.size[0];
        axis.set(desc.to[0] - desc.from[0], 0, desc.to[1] - desc.from[1]).normalize();
        q.setFromUnitVectors(UP, axis);
        // All at much the same speed: a fast one let go after a slow one would catch it up.
        const speed = desc.speed * (0.92 + this.random() * 0.16);
        // Its middle is its radius above the ground: and as it lies, that is where its own middle is, half its height along itself.
        const up = part.pos[1];
        this.objects.release(
          object,
          { x: x - axis.x * up, y: this.ground(x, z) + radius + 0.15, z: z - axis.z * up },
          { x: q.x, y: q.y, z: q.z, w: q.w },
          { x: dx, z: dz },
          speed,
          radius,
        );
        line.out[n] = true;
        line.since[n] = 0;
        line.turned[n] = 0;
      }
    }
  }

  /** Everything back to waiting. The object system has already put each where it waits. */
  reset(): void {
    this.seed = 7;
    for (const line of this.lines) {
      line.out.fill(false);
      line.next = 0;
      line.clock = 0;
      line.last = 0.5;
    }
  }

  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }
}
