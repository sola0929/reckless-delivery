import * as THREE from 'three';

// Lamps hung over the way on their flexes, as over a market's aisles: a shade and a bare bulb at the end of a flex. Only
// drawn: when the truck goes under one low enough to brush it, it is knocked swinging the way the truck is going, and
// swings itself still again.

/** How long the flex is, metres; how low the bulb hangs below where it is hung from. */
const FLEX = 1.5;
/** How tall the truck and its load stand, metres: a lamp hanging lower than that is brushed. */
const TRUCK_TOP = 3.3;
/** Its swing slows by this much a second, as a share. */
const DAMP = 0.6;

interface Lamp {
  pivot: THREE.Group;
  /** Its swing, radians, about X and about Z; and how fast each is going. */
  ax: number;
  az: number;
  vx: number;
  vz: number;
  at: THREE.Vector3;
}

export class LampsView {
  private readonly lamps: Lamp[] = [];

  constructor(scene: THREE.Scene, hung: [number, number, number][]) {
    const flex = new THREE.MeshStandardMaterial({ color: 0x2a2c30 });
    // An enamelled shade, white inside and out, as over every market stall.
    const shade = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, side: THREE.DoubleSide });
    const bulb = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    const flexGeo = new THREE.CylinderGeometry(0.012, 0.012, FLEX, 4).translate(0, -FLEX / 2, 0);
    const shadeGeo = new THREE.ConeGeometry(0.28, 0.2, 12, 1, true).translate(0, -FLEX - 0.05, 0);
    const bulbGeo = new THREE.SphereGeometry(0.1, 8, 6).translate(0, -FLEX - 0.13, 0);
    for (const [x, y, z] of hung) {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);
      pivot.add(new THREE.Mesh(flexGeo, flex), new THREE.Mesh(shadeGeo, shade), new THREE.Mesh(bulbGeo, bulb));
      scene.add(pivot);
      this.lamps.push({ pivot, ax: 0, az: 0, vx: 0, vz: 0, at: new THREE.Vector3(x, y - FLEX - 0.1, z) });
    }
  }

  /** Each frame: those the truck is under knocked its way; each swinging on, slowing. */
  update(dt: number, truck: { x: number; y: number; z: number }, yaw: number, speed: number): void {
    const step = Math.min(dt, 0.05), c = Math.cos(yaw), s = Math.sin(yaw), w2 = 9.8 / FLEX;
    for (const lamp of this.lamps) {
      const dx = lamp.at.x - truck.x, dz = lamp.at.z - truck.z;
      const across = dx * c - dz * s, along = dx * s + dz * c;
      if (Math.abs(across) < 1.4 && Math.abs(along) < 3.8 && lamp.at.y < truck.y + TRUCK_TOP - 1 && Math.abs(speed) > 0.5) {
        // Brushed: going the truck's way, as fast as it is going about, a swing's worth at most.
        const kick = Math.min(2.5, Math.abs(speed) * 0.35) * Math.sign(speed);
        // Its bulb sent the way the truck faces, (sin yaw, cos yaw): about Z for along X, about X (the other way) for along Z.
        lamp.vz = kick * s;
        lamp.vx = -kick * c;
      }
      lamp.vx += -w2 * lamp.ax * step;
      lamp.vz += -w2 * lamp.az * step;
      lamp.vx *= 1 - DAMP * step;
      lamp.vz *= 1 - DAMP * step;
      lamp.ax += lamp.vx * step;
      lamp.az += lamp.vz * step;
      lamp.pivot.rotation.set(lamp.ax, 0, lamp.az);
    }
  }
}
