// Fixed things (props) about a place: npx tsx dev/what-is-here.ts x z [reach]
import { uptown } from '../src/levels/uptown';
const level = uptown();
const [x, z, reach = 4] = process.argv.slice(2).map(Number);
for (const p of level.props) {
  const hx = p.shape === 'box' ? p.size[0] : p.size[0], hz = p.shape === 'box' ? p.size[2] : p.size[0];
  if (Math.abs(p.pos[0] - x) > hx + reach || Math.abs(p.pos[2] - z) > hz + reach) continue;
  console.log(`${p.shape}${p.ghost ? ' (ghost)' : ''}${p.building ? ' house' : ''}${p.paving ? ' paving' : ''} at ${p.pos.map((v) => v.toFixed(1)).join(', ')} half ${p.size.map((v) => v.toFixed(2)).join(', ')} colour ${p.color.toString(16)}`);
}
process.exit(0);
