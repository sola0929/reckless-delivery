import * as THREE from 'three';
import { CAMERA } from '../config';

const FORWARD = new THREE.Vector3();
const TARGET = new THREE.Vector3();

/** Shortest signed difference between two angles. */
function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/** Fraction of the way to move toward a target this frame, for a given follow rate. */
function ease(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

/** Where a chase camera sits and where it looks, when that is not where it usually does. */
export interface ChaseView {
  height: number;
  distance: number;
  lookAhead: number;
  /** How high the ground is at a place: the camera is kept above it. Only what is no more than `reach` above the truck counts (default 3 m). */
  ground?: (x: number, z: number, reach?: number) => number;
}

/** High chase camera: sits above and behind what it follows, looking ahead of it. */
export class ChaseCamera {
  private yaw = 0;
  private speed = 0;
  private zoom = 1;
  private lastSpeed = 0;
  /** Smoothed forward acceleration, m/s². */
  private surge = 0;
  private fov = CAMERA.fov;
  /** Extra zoom while following the driver on foot, eased in and out. */
  private closeUp = 1;
  private readonly focus = new THREE.Vector3();
  private wasOnFoot = false;
  private glide = 0;
  /** How hard the camera is being shaken, metres; it dies away by itself. */
  private tremor = 0;
  /** Looking round from behind the truck, radians: dragged with the mouse, or held by the stick; it swings back when let go. */
  private look = 0;
  private lookDrag = 0;
  private lookHeld = false;
  private lookStick = 0;
  /** How far the road drops away ahead, metres, eased: the camera rises to see down it. */
  private drop = 0;
  /** And how far it climbs ahead: the camera aims up it. */
  private rise = 0;

  constructor(private readonly camera: THREE.PerspectiveCamera, private readonly view: ChaseView = CAMERA) {}

  /** Direction the camera faces across the ground: radians about Y, 0 = toward +Z. */
  get viewYaw(): number {
    return this.yaw + this.look;
  }

  /**
   * Look round while driving, for this frame: pixels dragged across with the right button and whether it is held,
   * and the controller's stick across, -1 to 1.
   */
  lookAround(drag: number, holding: boolean, stick: number): void {
    this.lookDrag += drag;
    this.lookHeld = holding;
    this.lookStick = stick;
  }

  addZoom(wheelDelta: number): void {
    this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(wheelDelta * 0.001), CAMERA.minZoom, CAMERA.maxZoom);
  }

  /** Shake the camera, as a blast nearby would: by about this many metres at first. */
  shake(amount: number): void {
    this.tremor = Math.max(this.tremor, amount);
  }

  /** Jump straight behind the truck, e.g. after a reset. */
  snap(position: THREE.Vector3, heading: number): void {
    this.yaw = heading;
    this.speed = this.lastSpeed = this.surge = 0;
    this.closeUp = 1;
    this.glide = 0;
    this.wasOnFoot = false;
    this.look = this.lookDrag = this.drop = this.rise = 0;
    this.focus.copy(position);
  }

  /**
   * @param heading the direction to swing round behind, or null to hold the present view.
   *   On foot the view is held, so that "up the screen" stays put while walking about.
   */
  update(dt: number, position: THREE.Vector3, heading: number | null, speed: number, boosting: boolean): void {
    const onFoot = heading === null;
    if (!onFoot) this.yaw += angleDelta(this.yaw, heading) * ease(CAMERA.yawFollow, dt);
    // Looking round: on foot the view is held as it is, the look taken into it, so the screen's "up" stays put.
    if (onFoot) {
      this.yaw += this.look;
      this.look = 0;
    } else if (this.lookHeld) this.look += this.lookDrag * CAMERA.lookPerPixel;
    else if (this.lookStick) this.look += (this.lookStick * CAMERA.lookMax - this.look) * ease(CAMERA.lookStickFollow, dt);
    else this.look -= this.look * ease(CAMERA.lookReturn, dt);
    this.look = THREE.MathUtils.clamp(this.look, -CAMERA.lookMax, CAMERA.lookMax);
    this.lookDrag = 0;
    this.speed += ((onFoot ? 0 : Math.abs(speed)) - this.speed) * ease(CAMERA.speedFollow, dt);
    this.closeUp += ((onFoot ? CAMERA.footZoom : 1) - this.closeUp) * ease(CAMERA.footZoomFollow, dt);
    // Glide between the truck and the driver when the view changes hands, rather than cutting.
    if (onFoot !== this.wasOnFoot) this.glide = CAMERA.handoverSeconds;
    this.wasOnFoot = onFoot;
    this.glide -= dt;
    if (this.glide > 0) this.focus.lerp(position, ease(CAMERA.handoverFollow, dt));
    else this.focus.copy(position);

    // The camera lags the truck's acceleration: the truck pulls away when it launches
    // and comes back toward the camera when it brakes.
    if (dt > 0) {
      const accel = onFoot ? 0 : THREE.MathUtils.clamp((speed - this.lastSpeed) / dt, -CAMERA.surgeLimit, CAMERA.surgeLimit);
      this.surge += (accel - this.surge) * ease(CAMERA.surgeFollow, dt);
      this.lastSpeed = speed;
    }

    const zoom = this.zoom * this.closeUp;
    const dir = FORWARD.set(Math.sin(this.yaw + this.look), 0, Math.cos(this.yaw + this.look));
    // The road dropping away ahead of the truck (not of the look), and not while on foot.
    let drop = 0;
    let rise = 0;
    if (!onFoot && this.view.ground) {
      // From the ground under the truck, so that being in the air over a dip is not a drop ahead.
      const here = this.view.ground(this.focus.x, this.focus.z);
      // A road goes up and down by slopes: a step steeper than that is a wall or an edge, and the road is not seen past it.
      let last = here;
      let before = 0;
      for (const d of CAMERA.dropScan) {
        const there = this.view.ground(this.focus.x + Math.sin(this.yaw) * d, this.focus.z + Math.cos(this.yaw) * d, 12);
        if (Math.abs(there - last) > (d - before) * CAMERA.slopeMost) break;
        drop = Math.max(drop, here - there);
        rise = Math.max(rise, there - here);
        last = there;
        before = d;
      }
      drop = Math.max(0, drop - CAMERA.dropFrom);
      rise = Math.max(0, rise - CAMERA.dropFrom);
    }
    this.drop += (drop - this.drop) * ease(CAMERA.dropFollow, dt);
    this.rise += (rise - this.rise) * ease(CAMERA.dropFollow, dt);
    const lift = Math.min(CAMERA.dropLiftMax, this.drop * CAMERA.dropLift);
    // Halved under braking, or the truck slides off the bottom of the screen.
    const lag = this.surge * CAMERA.surgeDistance * (this.surge < 0 ? 0.5 : 1) * Math.min(1, zoom);
    const distance = (this.view.distance + this.speed * CAMERA.distancePerSpeed) * zoom + lag;
    const height = (this.view.height + this.speed * CAMERA.heightPerSpeed) * zoom + lift;
    // Zoomed in, the camera sits almost over the tail, so aim at the truck itself rather
    // than the road ahead, or the back of the bed drops out of view.
    const closeness = THREE.MathUtils.clamp((1 - this.zoom) / (1 - CAMERA.minZoom), 0, 1);
    const ahead = onFoot ? 0 : THREE.MathUtils.lerp(this.view.lookAhead + this.speed * CAMERA.lookAheadPerSpeed, CAMERA.closeLookAhead, closeness);

    this.camera.position.copy(this.focus).addScaledVector(dir, -distance);
    this.camera.position.y = this.focus.y + height;
    // On a hillside the ground behind may be higher than the truck: never down into it.
    if (this.view.ground) this.camera.position.y = Math.max(this.camera.position.y, this.view.ground(this.camera.position.x, this.camera.position.z) + 3);
    this.camera.lookAt(TARGET.copy(this.focus).addScaledVector(dir, ahead).setY(this.focus.y - this.drop * CAMERA.dropAim + this.rise * CAMERA.riseAim));
    if (this.tremor > 0.01) {
      this.camera.position.x += (Math.random() - 0.5) * this.tremor;
      this.camera.position.y += (Math.random() - 0.5) * this.tremor;
      this.camera.position.z += (Math.random() - 0.5) * this.tremor;
      this.tremor *= Math.exp(-5 * dt);
    }

    const fov = CAMERA.fov + (boosting ? CAMERA.boostFov : 0);
    this.fov += (fov - this.fov) * ease(CAMERA.fovFollow, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
