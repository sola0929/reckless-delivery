// Level 3's dike: the ground across it, x 70 to 104, every 0.5 m, at a few places along it ('#' over 5 m, '-' over 4, '.' below).
import { quarry } from '../src/levels/quarry';
import { heightAt } from '../src/levels/terrain';
const l = quarry();
for (let z = 560; z <= 780; z += 10) {
  let line = '', top = 0;
  for (let x = 70; x <= 104; x += 0.5) { const y = heightAt(l.terrain, x, z); top = Math.max(top, y); line += y > 5 ? '#' : y > 4 ? '-' : '.'; }
  console.log(z, line, top.toFixed(1));
}
