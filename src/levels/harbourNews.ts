import { Euler, Quaternion, Vector3 } from 'three';
import type { ObjectDesc } from './objects';
import type { CrowdDesc, PropDesc, SignDesc, Vec2 } from './types';

// The news, out in the storm as it always is: a crew to each channel, its reporter in a raincoat talking to the camera
// with the weather behind, the cameraman at the tripod, a light on a stand, the cable back to the satellite van. They
// stand where the picture is, which is where the lorry is going; they do not move for it.

export interface NewsCrew {
  /** The channel's name on its van, and its colours: ground, words. */
  channel: [string, string, string];
  /** The satellite van, where it is parked: [x, z, which way it faces]. */
  van?: [number, number, number];
  /** The reporter, and the camera on its tripod facing them: [x, z]. */
  reporter: Vec2;
  camera: Vec2;
  /** The light, to one side, turned on the reporter. */
  light: Vec2;
  /** The height of the ground they stand on; the van's, where it is parked lower. */
  y?: number;
  vanY?: number;
  /** Cones put out round the van. */
  cones?: Vec2[];
  /** The raincoat's colour. */
  coat: number;
  /** What the reporter says to the camera as the lorry comes, line by line. */
  says: string[];
}

export interface NewsParts {
  props: PropDesc[];
  objects: ObjectDesc[];
  signs: SignDesc[];
  crowds: CrowdDesc[];
}

export function newsCrews(crews: NewsCrew[]): NewsParts {
  const out: NewsParts = { props: [], objects: [], signs: [], crowds: [] };
  const rod = (a: [number, number, number], b: [number, number, number], r: number, color: number) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], long = Math.hypot(d[0], d[1], d[2]);
    out.props.push({ shape: 'cylinder', size: [r, long / 2, 0], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [0, Math.atan2(-d[2], d[0]), -Math.acos(d[1] / long)], color, ghost: true });
  };
  for (const c of crews) {
    const y = c.y ?? 0;
    const [rx, rz] = c.reporter, [cx, cz] = c.camera;
    const look = Math.atan2(rx - cx, rz - cz);
    // The reporter faces the camera, the cameraman stands behind it, both where they are put until knocked down.
    const person = (x: number, z: number, yaw: number, clothes: number, more: Partial<CrowdDesc>) =>
      out.crowds.push({ area: [x - 0.05, z - 0.05, x + 0.05, z + 0.05], count: 1, y, dance: yaw, clothes: [clothes], hat: clothes, ...more });
    person(rx, rz, look + Math.PI, c.coat, { motion: 'report', dress: 'coat', mic: parseInt(c.channel[1].slice(1), 16), says: c.says, shouts: ['我還在連線啊！', '麥克風！我的麥克風！', '棚內有收到嗎？！'] });
    person(cx - Math.sin(look) * 0.75, cz - Math.cos(look) * 0.75, look, 0x3a4048, { motion: 'carry', dress: 'pack', shouts: ['攝影機！', '畫面！畫面斷了！', '我的腳架啊！'] });
    out.objects.push({ kind: 'tvCamera', pos: [cx, y, cz], rotY: look });
    out.objects.push({ kind: 'lightStand', pos: [c.light[0], y, c.light[1]], rotY: Math.atan2(rx - c.light[0], rz - c.light[1]) });
    if (c.van) {
      const [vx, vz, yaw] = c.van, vy = c.vanY ?? y, s = Math.sin(yaw), k = Math.cos(yaw);
      const at = (along: number, up: number): [number, number, number] => [vx + s * along, vy + up, vz + k * along];
      // The van in the channel's colours, its name down each side above the band and across its back doors; on the platform
      // on its roof the dish, turned up to the satellite, its feed out in front of it; forward, the mast up.
      const tint = parseInt(c.channel[1].slice(1), 16);
      out.props.push({ shape: 'box', size: [1.15, 1.4, 3.7], pos: [vx, vy + 1.6, vz], rot: [0, yaw, 0], color: tint, vehicle: 'sng' });
      const across = (side: number, along: number, up: number): [number, number, number] => [vx + k * side + s * along, vy + up, vz - s * side + k * along];
      for (const side of [-1, 1]) out.signs.push({ kind: 'name', text: c.channel[0], colors: [c.channel[1], c.channel[2], c.channel[1]], wide: 3.0, pos: across(side * 1.25, -1.75, 2.15), rotY: yaw + (side * Math.PI) / 2 });
      out.signs.push({ kind: 'name', text: c.channel[0], colors: [c.channel[1], c.channel[2], c.channel[1]], wide: 1.4, pos: across(-0.2, -3.78, 2.3), rotY: yaw + Math.PI });
      out.props.push({ shape: 'box', size: [0.22, 0.16, 0.22], pos: at(-2.0, 3.31), rot: [0, yaw, 0], color: 0x5a5f66, ghost: true });
      const dish = new Quaternion().setFromEuler(new Euler(Math.PI - 0.75, yaw, 0, 'YXZ'));
      const face = new Vector3(0, -1, 0).applyQuaternion(dish), mid = at(-2.05, 3.85);
      const [ex, ey, ez] = new Euler().setFromQuaternion(dish, 'XYZ').toArray() as [number, number, number];
      out.props.push({ shape: 'cone', size: [0.9, 0.16, 0], pos: mid, rot: [ex, ey, ez], color: 0xeceae4, ghost: true });
      const feed: [number, number, number] = [mid[0] + face.x * 0.75, mid[1] + face.y * 0.75, mid[2] + face.z * 0.75];
      rod(mid, feed, 0.018, 0x8e9499);
      out.props.push({ shape: 'box', size: [0.06, 0.06, 0.09], pos: feed, rot: [ex, ey, ez], color: 0x5a5f66, ghost: true });
      out.props.push({ shape: 'cylinder', size: [0.07, 1.5, 0], pos: at(1.5, 4.5), color: 0xb8bcc0, ghost: true });
      out.props.push({ shape: 'cylinder', size: [0.045, 0.6, 0], pos: at(1.5, 6.5), color: 0xd8dcde, ghost: true });
      out.props.push({ shape: 'box', size: [0.2, 0.14, 0.2], pos: at(1.5, 7.2), rot: [0, yaw, 0], color: 0xf2f0ea, ghost: true });
      // The cable from the van's back to the camera, along the ground, where they are on the same.
      if (c.vanY === undefined) {
        const bx = vx - s * 3.7, bz = vz - k * 3.7, dx = cx - bx, dz = cz - bz, long = Math.hypot(dx, dz);
        out.props.push({ shape: 'box', size: [0.025, 0.02, long / 2], pos: [(bx + cx) / 2, y + 0.012, (bz + cz) / 2], rot: [0, Math.atan2(dx, dz), 0], color: 0x1f2124, ghost: true });
      }
    }
    for (const [x, z] of c.cones ?? []) out.objects.push({ kind: 'cone', pos: [x, c.vanY ?? y, z] });
  }
  return out;
}
