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

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  /** Direction the camera faces across the ground: radians about Y, 0 = toward +Z. */
  get viewYaw(): number {
    return this.yaw;
  }

  addZoom(wheelDelta: number): void {
    this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(wheelDelta * 0.001), CAMERA.minZoom, CAMERA.maxZoom);
  }

  /** Jump straight behind the truck, e.g. after a reset. */
  snap(position: THREE.Vector3, heading: number): void {
    this.yaw = heading;
    this.speed = this.lastSpeed = this.surge = 0;
    this.closeUp = 1;
    this.glide = 0;
    this.wasOnFoot = false;
    this.focus.copy(position);
  }

  /**
   * @param heading the direction to swing round behind, or null to hold the present view.
   *   On foot the view is held, so that "up the screen" stays put while walking about.
   */
  update(dt: number, position: THREE.Vector3, heading: number | null, speed: number, boosting: boolean): void {
    const onFoot = heading === null;
    if (!onFoot) this.yaw += angleDelta(this.yaw, heading) * ease(CAMERA.yawFollow, dt);
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
    const dir = FORWARD.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    // Halved under braking, or the truck slides off the bottom of the screen.
    const lag = this.surge * CAMERA.surgeDistance * (this.surge < 0 ? 0.5 : 1) * Math.min(1, zoom);
    const distance = (CAMERA.distance + this.speed * CAMERA.distancePerSpeed) * zoom + lag;
    const height = (CAMERA.height + this.speed * CAMERA.heightPerSpeed) * zoom;
    // Zoomed in, the camera sits almost over the tail, so aim at the truck itself rather
    // than the road ahead, or the back of the bed drops out of view.
    const closeness = THREE.MathUtils.clamp((1 - this.zoom) / (1 - CAMERA.minZoom), 0, 1);
    const ahead = onFoot ? 0 : THREE.MathUtils.lerp(CAMERA.lookAhead + this.speed * CAMERA.lookAheadPerSpeed, CAMERA.closeLookAhead, closeness);

    this.camera.position.copy(this.focus).addScaledVector(dir, -distance);
    this.camera.position.y = this.focus.y + height;
    this.camera.lookAt(TARGET.copy(this.focus).addScaledVector(dir, ahead));

    const fov = CAMERA.fov + (boosting ? CAMERA.boostFov : 0);
    this.fov += (fov - this.fov) * ease(CAMERA.fovFollow, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
