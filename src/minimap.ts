import type { LevelDef } from './levels/types';
import type { TrafficCar } from './sim/traffic';
import { TRAIN_HALF } from './sim/trains';

/** Pixels per metre of the pre-drawn map, and of the map as shown. */
const DRAWN = 1.5;
const SHOWN = 0.62;
const ROAD = '#3a4048';
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/**
 * A round map in the corner of the screen. It turns with the camera, so up on the map is
 * always the way the screen is facing, matching the arrow that points at the delivery bay.
 */
export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly background: HTMLCanvasElement;
  private readonly size: number;
  private readonly maxX: number;
  private readonly maxZ: number;
  private time = 0;

  constructor(canvas: HTMLCanvasElement, private readonly level: LevelDef) {
    const ratio = Math.min(window.devicePixelRatio, 2);
    this.size = canvas.clientWidth;
    canvas.width = canvas.height = this.size * ratio;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.scale(ratio, ratio);

    const [[minX, minZ], [maxX, maxZ]] = level.bounds;
    this.maxX = maxX;
    this.maxZ = maxZ;
    this.background = document.createElement('canvas');
    this.background.width = (maxX - minX) * DRAWN;
    this.background.height = (maxZ - minZ) * DRAWN;
    this.drawBackground();
  }

  /** Everything that never moves, drawn once. +Z is up and +X is to the left, as seen from behind the truck at the start. */
  private drawBackground(): void {
    const g = this.background.getContext('2d')!;
    g.fillStyle = ROAD;
    g.fillRect(0, 0, this.background.width, this.background.height);

    const rect = (x: number, z: number, halfX: number, halfZ: number, color: number) => {
      g.fillStyle = hex(color);
      g.fillRect((this.maxX - x - halfX) * DRAWN, (this.maxZ - z - halfZ) * DRAWN, halfX * 2 * DRAWN, halfZ * 2 * DRAWN);
    };
    const prop = (p: LevelDef['props'][number]) => {
      if (p.shape === 'box') rect(p.pos[0], p.pos[2], p.size[0], p.size[2], p.mapColor!);
      else {
        g.fillStyle = hex(p.mapColor!);
        g.beginPath();
        g.arc((this.maxX - p.pos[0]) * DRAWN, (this.maxZ - p.pos[2]) * DRAWN, p.size[0] * DRAWN, 0, Math.PI * 2);
        g.fill();
      }
    };

    // Pavements, then ground markings such as water and grass, then whatever stands on them.
    const mapped = this.level.props.filter((p) => p.mapColor !== undefined);
    for (const p of mapped) if (p.mapUnder) prop(p);
    for (const d of this.level.decals) {
      if (d.mapColor !== undefined) rect(d.pos[0], d.pos[1], d.size[0] / 2, d.size[1] / 2, d.mapColor);
    }
    for (const slick of this.level.slicks ?? []) rect(slick.pos[0], slick.pos[1], slick.half[0], slick.half[1], 0x23262e);
    for (const pit of this.level.pits ?? []) rect(pit.pos[0], pit.pos[1], pit.half[0], pit.half[1], pit.water === undefined ? 0x14110e : 0x3f7fc0);
    for (const p of mapped) if (!p.mapUnder) prop(p);

    // The intended way through, as a dotted line down the middle of the road.
    const route = this.level.route;
    if (route && route.length > 1) {
      g.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      g.lineWidth = 2.5 * DRAWN;
      g.setLineDash([5 * DRAWN, 5 * DRAWN]);
      g.lineJoin = 'round';
      g.beginPath();
      route.forEach(([x, z], i) => {
        const u = (this.maxX - x) * DRAWN;
        const v = (this.maxZ - z) * DRAWN;
        if (i === 0) g.moveTo(u, v);
        else g.lineTo(u, v);
      });
      g.stroke();
      g.setLineDash([]);
    }
  }

  /**
   * @param heading the truck's direction, radians about Y
   * @param viewYaw the camera's direction, likewise
   */
  update(
    dt: number, x: number, z: number, heading: number, viewYaw: number, cars: readonly TrafficCar[],
    fallen: readonly { x: number; z: number }[], driver: { x: number; z: number; leash: number } | null,
    trains: readonly { x: number; z: number }[] = [],
  ): void {
    this.time += dt;
    const { ctx, size } = this;
    const half = size / 2;
    const cos = Math.cos(viewYaw);
    const sin = Math.sin(viewYaw);
    /** A world position as an offset from the middle of the map, in pixels. */
    const place = (wx: number, wz: number): [number, number] => {
      const u = -(wx - x) * SHOWN;
      const v = -(wz - z) * SHOWN;
      return [u * cos - v * sin, u * sin + v * cos];
    };

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#20252b';
    ctx.fillRect(0, 0, size, size);

    ctx.translate(half, half);
    ctx.save();
    ctx.rotate(viewYaw);
    ctx.scale(SHOWN / DRAWN, SHOWN / DRAWN);
    ctx.drawImage(this.background, -(this.maxX - x) * DRAWN, -(this.maxZ - z) * DRAWN);
    ctx.restore();

    for (const car of cars) {
      const [cx, cy] = place(car.lane.from.x + car.lane.dir.x * car.s, car.lane.from.z + car.lane.dir.z * car.s);
      if (Math.hypot(cx, cy) > half) continue;
      ctx.fillStyle = car.lane.cruise > 0 ? '#ffd166' : '#aab0b8';
      ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }

    // Trains, as long bars sliding along their tracks.
    ctx.strokeStyle = '#ff7a5a';
    ctx.lineWidth = 3;
    for (const train of trains) {
      const [ax, ay] = place(train.x - TRAIN_HALF.length, train.z);
      const [bx, by] = place(train.x + TRAIN_HALF.length, train.z);
      if (Math.min(Math.hypot(ax, ay), Math.hypot(bx, by)) > half) continue;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }

    // Cargo lying off the truck, waiting to be fetched.
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#3a2a00';
    ctx.lineWidth = 1;
    for (const item of fallen) {
      const [ix, iy] = place(item.x, item.z);
      if (Math.hypot(ix, iy) > half) continue;
      ctx.beginPath();
      ctx.moveTo(ix, iy - 4);
      ctx.lineTo(ix + 4, iy);
      ctx.lineTo(ix, iy + 4);
      ctx.lineTo(ix - 4, iy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // On foot: how far the driver may go from the truck, and where they are.
    if (driver) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, driver.leash * SHOWN, 0, Math.PI * 2);
      ctx.stroke();
      const [dx, dy] = place(driver.x, driver.z);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ff3020';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(dx, dy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const finish = this.level.finish;
    if (finish) {
      let [fx, fy] = place(finish.pos[0], finish.pos[1]);
      // Off the edge of the map, pin it to the rim in the right direction.
      const far = Math.hypot(fx, fy);
      const rim = half - 9;
      if (far > rim) {
        fx *= rim / far;
        fy *= rim / far;
      }
      const pulse = 5 + Math.sin(this.time * 4) * 1.5;
      ctx.fillStyle = '#4dff88';
      ctx.strokeStyle = '#0c2a16';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx, fy, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // The truck: an arrowhead in the middle.
    ctx.rotate(viewYaw - heading);
    ctx.fillStyle = '#ff5a36';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
