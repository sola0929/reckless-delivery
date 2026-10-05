import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { GROUP, TRUCK, groups } from '../config';
import type { TrackDesc } from '../levels/types';
import type { Truck } from './truck';

export const TRAIN_HALF = { length: 20, height: 1.7, width: 1.45 };
const TRAIN_Y = 0.25 + TRAIN_HALF.height;
/** The signal turns red this many seconds before a train reaches the near edge of the road. */
const WARNING_SECONDS = 3.5;
/** Half the width of the road it crosses, and how far past that the tail must be before the signal clears. */
const ROAD_HALF = 8;
const CLEAR_BEYOND = 2;
const TRUCK_HALF_WIDTH = TRUCK.frame.half[0];
const TRUCK_HALF_LENGTH = TRUCK.frame.half[2];

export interface Train {
  body: RAPIER.RigidBody;
  track: number;
  /** Where its middle is: along the track, and the track's own Z. */
  x: number;
  z: number;
}

interface Track {
  desc: TrackDesc;
  /** Distance between one train and the next, and the length of the loop they go round. */
  spacing: number;
  loop: number;
  /** Where along X a train comes into being. */
  start: number;
  trains: Train[];
}

const q = new Quaternion();
const forward = new Vector3();
const side = new Vector3();

/**
 * Trains running along straight tracks, one after another at a fixed interval. Nothing
 * stops a train: it is a moving wall, and whatever it meets is swept away.
 */
export class Trains {
  readonly trains: Train[] = [];
  private readonly tracks: Track[] = [];
  private time = 0;

  constructor(world: RAPIER.World, descs: TrackDesc[], minX: number, maxX: number) {
    descs.forEach((desc, index) => {
      const spacing = desc.speed * desc.period;
      // A train starts off the map, and far enough from the road for its signal to give full
      // warning; it runs until it is off the map on the other side.
      const lead = desc.speed * (WARNING_SECONDS + 1) + TRAIN_HALF.length + ROAD_HALF;
      const off = TRAIN_HALF.length * 2;
      const start = desc.direction > 0 ? Math.min(minX - off, desc.watchX - lead) : Math.max(maxX + off, desc.watchX + lead);
      const end = desc.direction > 0 ? maxX + off : minX - off;
      const count = Math.ceil(Math.abs(end - start) / spacing);
      const track: Track = { desc, spacing, loop: count * spacing, start, trains: [] };
      for (let i = 0; i < count; i++) {
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(TRAIN_HALF.length, TRAIN_HALF.height, TRAIN_HALF.width)
            .setFriction(0.5)
            // Not solid to the truck: a train that was would bulldoze it the length of the map.
            // What happens to a truck in the way is decided by whoever asks `striking`.
            .setCollisionGroups(groups(GROUP.prop, GROUP.all & ~GROUP.truck)),
          body,
        );
        const train: Train = { body, track: index, x: 0, z: desc.z };
        track.trains.push(train);
        this.trains.push(train);
      }
      this.tracks.push(track);
    });
    this.place(true);
  }

  update(dt: number): void {
    this.time += dt;
    this.place(false);
  }

  reset(): void {
    this.time = 0;
    this.place(true);
  }

  /** Whether the signal for a track should be showing red: a train is close, or still passing. */
  warning(track: number): boolean {
    const t = this.tracks[track];
    if (!t) return false;
    const { direction, speed, watchX } = t.desc;
    return t.trains.some((train) => {
      // How far the train's middle still has to go to reach the road.
      const toGo = (watchX - train.x) * direction;
      const reach = TRAIN_HALF.length + ROAD_HALF;
      return toGo - reach < speed * WARNING_SECONDS && toGo > -(reach + CLEAR_BEYOND);
    });
  }

  /** The track whose train is running into the truck right now, if one is. */
  striking(truck: Truck): TrackDesc | null {
    const p = truck.body.translation();
    const r = truck.body.rotation();
    q.set(r.x, r.y, r.z, r.w);
    forward.set(0, 0, 1).applyQuaternion(q);
    side.set(1, 0, 0).applyQuaternion(q);
    // How far the truck reaches along and across the track, given which way it points.
    const reachX = Math.abs(forward.x) * TRUCK_HALF_LENGTH + Math.abs(side.x) * TRUCK_HALF_WIDTH;
    const reachZ = Math.abs(forward.z) * TRUCK_HALF_LENGTH + Math.abs(side.z) * TRUCK_HALF_WIDTH;
    for (const train of this.trains) {
      const desc = this.tracks[train.track].desc;
      if (Math.abs(p.z - desc.z) < TRAIN_HALF.width + reachZ && Math.abs(p.x - train.x) < TRAIN_HALF.length + reachX && p.y < (desc.y ?? 0) + TRAIN_HALF.height * 2 + 1) return desc;
    }
    return null;
  }

  /** The train bearing down on a point, if one is right on top of it: its direction and speed. */
  at(x: number, z: number, radius: number): { direction: number; speed: number } | null {
    for (const train of this.trains) {
      const desc = this.tracks[train.track].desc;
      if (Math.abs(z - desc.z) < TRAIN_HALF.width + radius && Math.abs(x - train.x) < TRAIN_HALF.length + radius) return desc;
    }
    return null;
  }

  /** Put every train where the clock says it should be. A jump when it wraps round, a smooth move otherwise. */
  private place(jump: boolean): void {
    for (const track of this.tracks) {
      const { direction, speed, phase, z } = track.desc;
      track.trains.forEach((train, i) => {
        const along = (phase * track.spacing + i * track.spacing + speed * this.time) % track.loop;
        const x = track.start + direction * along;
        const wrapped = Math.abs(x - train.x) > track.spacing / 2;
        train.x = x;
        const at = { x, y: TRAIN_Y + (track.desc.y ?? 0), z };
        if (jump || wrapped) train.body.setTranslation(at, true);
        else train.body.setNextKinematicTranslation(at);
      });
    }
  }
}
