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

/** High chase camera: sits above and behind the truck, looking ahead of it. */
export class ChaseCamera {
  private yaw = 0;
  private speed = 0;
  private zoom = 1;
  private lastSpeed = 0;
  /** Smoothed forward acceleration, m/s². */
  private surge = 0;
  private fov = CAMERA.fov;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  addZoom(wheelDelta: number): void {
    this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(wheelDelta * 0.001), CAMERA.minZoom, CAMERA.maxZoom);
  }

  /** Jump straight behind the truck, e.g. after a reset. */
  snap(truck: THREE.Object3D): void {
    this.yaw = this.heading(truck);
    this.speed = this.lastSpeed = this.surge = 0;
  }

  update(dt: number, truck: THREE.Object3D, speed: number, boosting: boolean): void {
    this.yaw += angleDelta(this.yaw, this.heading(truck)) * ease(CAMERA.yawFollow, dt);
    this.speed += (Math.abs(speed) - this.speed) * ease(CAMERA.speedFollow, dt);

    // The camera lags the truck's acceleration: the truck pulls away when it launches
    // and comes back toward the camera when it brakes.
    if (dt > 0) {
      const accel = THREE.MathUtils.clamp((speed - this.lastSpeed) / dt, -CAMERA.surgeLimit, CAMERA.surgeLimit);
      this.surge += (accel - this.surge) * ease(CAMERA.surgeFollow, dt);
      this.lastSpeed = speed;
    }

    const dir = FORWARD.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    // Halved under braking, or the truck slides off the bottom of the screen.
    const lag = this.surge * CAMERA.surgeDistance * (this.surge < 0 ? 0.5 : 1);
    const distance = (CAMERA.distance + this.speed * CAMERA.distancePerSpeed) * this.zoom + lag;
    const height = (CAMERA.height + this.speed * CAMERA.heightPerSpeed) * this.zoom;
    const ahead = CAMERA.lookAhead + this.speed * CAMERA.lookAheadPerSpeed;

    this.camera.position.copy(truck.position).addScaledVector(dir, -distance);
    this.camera.position.y = truck.position.y + height;
    this.camera.lookAt(TARGET.copy(truck.position).addScaledVector(dir, ahead));

    const fov = CAMERA.fov + (boosting ? CAMERA.boostFov : 0);
    this.fov += (fov - this.fov) * ease(CAMERA.fovFollow, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  private heading(truck: THREE.Object3D): number {
    FORWARD.set(0, 0, 1).applyQuaternion(truck.quaternion);
    return Math.atan2(FORWARD.x, FORWARD.z);
  }
}
