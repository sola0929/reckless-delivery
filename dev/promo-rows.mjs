// Rows of parked scooters on a level: runs of four or more along one line, a metre or less apart.
import { chromium } from 'playwright-core';
const level = process.argv[2];
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage();
await p.goto(`http://localhost:5183/?level=${level}`);
await p.waitForFunction(() => window.game?.sim, null, { timeout: 90000 });
console.log(await p.evaluate(() => {
  const all = window.game.sim.objects.objects.filter((o) => /^scooter/.test(o.desc.kind)).map((o) => ({ x: o.desc.pos[0], z: o.desc.pos[2], y: o.desc.pos[1] }));
  const rows = [];
  for (const axis of ['x', 'z']) {
    const other = axis === 'x' ? 'z' : 'x';
    const lines = {};
    for (const s of all) (lines[Math.round(s[other] * 2) / 2] ??= []).push(s);
    for (const [at, list] of Object.entries(lines)) {
      list.sort((a, b) => a[axis] - b[axis]);
      let run = [list[0]];
      for (let i = 1; i <= list.length; i++) {
        if (i < list.length && list[i][axis] - run.at(-1)[axis] < 1.4) run.push(list[i]);
        else { if (run.length >= 5) rows.push(`${run.length} along ${axis} at ${other}=${at}: ${run[0][axis].toFixed(1)}..${run.at(-1)[axis].toFixed(1)} y${run[0].y.toFixed(1)}`); if (i < list.length) run = [list[i]]; }
      }
    }
  }
  return rows.sort((a, b) => parseInt(b) - parseInt(a)).slice(0, 12).join('\n');
}));
await b.close();
