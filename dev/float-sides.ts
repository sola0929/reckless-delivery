// Level 2's float across the lane: what stands to each side of it, every 2 m out to 20 m, along X and along Z.
import { LEVELS } from '../src/levels';
const level = LEVELS.uptown();
const [fx, fz] = [-4, 880];
const inside = (x: number, z: number) => level.props.find((p) => !p.ghost && p.shape === 'box' && p.size[1] > 1.5 && Math.abs(x - p.pos[0]) < p.size[0] && Math.abs(z - p.pos[2]) < p.size[2]);
for (const [name, dx, dz] of [['+x', 1, 0], ['-x', -1, 0], ['+z', 0, 1], ['-z', 0, -1]] as const) {
  console.log(name, Array.from({ length: 10 }, (_, k) => (inside(fx + dx * (k + 1) * 2, fz + dz * (k + 1) * 2) ? '#' : '.')).join(''));
}
