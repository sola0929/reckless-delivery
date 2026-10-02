// Screenshots of the feast in the back street, the market, a fruit stall being driven
// through, and a cylinder of gas going off.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5183/?level=city');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 30000 });
await page.waitForTimeout(1500);
// Map squares are 16 m: x = (17.5 - column) * 16, z = row * 16, rows counted from the south.
const sq = (c, r) => [(17.5 - c) * 16, r * 16];
const carry = (x, z) => page.evaluate(([x, z]) => {
  const { sim } = window.game;
  const t = sim.truck.body.translation();
  const move = (body) => { const p = body.translation(); body.setTranslation({ x: p.x + x - t.x, y: p.y, z: p.z + z - t.z }, true); };
  for (const c of sim.cargo) if (c.body) move(c.body);
  move(sim.truck.body);
}, [x, z]);
const look = async (name, from, to, truck, wait = 1200) => {
  await carry(...sq(truck[0], truck[1]));
  await page.evaluate(([fx, fy, fz, tx, ty, tz]) => {
    const { camera } = window.game;
    window.game.freeze = true;
    camera.position.set(fx, fy, fz);
    camera.lookAt(tx, ty, tz);
  }, [sq(from[0], from[1])[0], from[2], sq(from[0], from[1])[1], sq(to[0], to[1])[0], to[2], sq(to[0], to[1])[1]]);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `dev/out/special-${name}.png` });
};

await look('feast', [24.2, 40.3, 16], [22.4, 41.1, 0], [25.5, 41.22]);
await look('feast-street', [23.9, 41.2, 4], [22, 41.1, 1.5], [25.5, 41.22]);
await look('market', [29.6, 15.6, 13], [29, 18.5, 0], [27, 13]);
await look('market-street', [29, 16.6, 3.5], [29, 20, 1.5], [27, 13]);

// Through a fruit stall, from behind the wheel.
await page.evaluate(() => { window.game.freeze = false; });
const stall = await page.evaluate(() => {
  // One that stands beside a lane running north, the way the truck faces.
  const o = window.game.sim.objects.objects.filter((o) => o.kind.juice !== undefined && o.kind.wrecked && Math.abs(Math.sin(o.desc.rotY)) > 0.9).sort((a, b) => b.desc.pos[2] - a.desc.pos[2])[0];
  const p = o.body.translation();
  return [p.x, p.z, o.desc.kind];
});
await carry(stall[0], stall[1] - 15);
await page.waitForTimeout(700);
await page.keyboard.down('KeyW');
await page.keyboard.down('ShiftLeft');
await page.waitForFunction(() => window.game.sim.objects.objects.some((o) => o.kind.juice !== undefined && o.knocked), null, { timeout: 8000 }).catch(() => console.log('never reached it'));
await page.waitForTimeout(250);
await page.screenshot({ path: 'dev/out/special-juice-1.png' });
await page.waitForTimeout(1300);
await page.keyboard.up('KeyW');
await page.keyboard.up('ShiftLeft');
await page.screenshot({ path: 'dev/out/special-juice-2.png' });
console.log('drove through', stall[2]);

// A cylinder of gas, set off beside the truck.
await page.keyboard.press('KeyR');
await page.waitForTimeout(800);
const gas = await page.evaluate(() => {
  const o = window.game.sim.objects.objects.find((o) => o.kind.explosive && o.desc.pos[1] > 0.5);
  const p = o.body.translation();
  return [p.x, p.z];
});
await carry(gas[0] + 6, gas[1] + 3);
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const o = window.game.sim.objects.objects.find((o) => o.kind.explosive && o.desc.pos[1] > 0.5);
  o.body.setLinvel({ x: 3, y: 0, z: 0 }, true);
});
await page.waitForTimeout(620);
await page.screenshot({ path: 'dev/out/special-blast-1.png' });
await page.waitForTimeout(500);
await page.screenshot({ path: 'dev/out/special-blast-2.png' });
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
