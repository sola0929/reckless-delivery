// Level 3 in the browser: from above along its whole way, and from behind the truck at each place. node dev/quarry-shot.mjs
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e)));
await page.goto('http://localhost:5183/?level=quarry');
await page.waitForFunction(() => window.game?.sim, null, { timeout: 60000 });
await page.waitForTimeout(1500);
// node dev/quarry-shot.mjs [names...]
// [name, truck x, z, yaw, camera back, up] or [name, camera x, y, z, look x, y, z]
const shots = [
  ['top-south', 'cam', 64, 150, 120, 64, 0, 260],
  ['top-north', 'cam', 84, 150, 640, 84, 0, 760],
  ['heaps', 'cam', 32, 70, 40, 32, 0, 130],
  ['park-top', 'cam', 60, 120, 380, 100, 0, 250],
  ['plant', 'cam', 160, 60, 200, 100, 8, 150],
  ['wall', 'cam', 95, 22, 150, 50, 10, 175],
  ['gatewall', 32, 20, 0, 14, 8],
  ['bays', 112, 318, 0, 14, 8],
  ['bays-top', 'cam', 150, 45, 330, 112, 8, 400],
  ['north', 'cam', 60, 70, 300, 70, 8, 420],
  ['shed', 'cam', 55, 45, 290, 112, 12, 390],
  ['shed-east', 'cam', 175, 40, 470, 112, 12, 400],
  ['inside', 112, 372, 0, 14, 8],
  ['inside2', 112, 410, 0, 14, 8],
  ['walk-top', 'cam', 112, 30, 360, 112, 12, 400],
  ['door', 112, 338, 0, 14, 8],
  ['gate', 32, 20, 0, 14, 8],
  ['park', 50, 306, Math.PI / 2, 14, 8],
  ['descent', 112, 470, 0, 14, 9],
  ['ponds', 'cam', 60, 120, 470, 60, 0, 650],
  ['ponds-west', 'cam', -60, 45, 600, 0, 4, 690],
  ['ponds-east', 'cam', 190, 40, 610, 135, 4, 660],
  ['mouth', 'cam', 80, 15, 500, 80, 6, 560],
  ['bank', 'cam', 40, 30, 490, 70, 9, 530],
  ['pond-w', 'cam', -45, 32, 520, 5, 3, 580],
  ['pond-k', 'cam', -45, 32, 700, 12, 5, 760],
  ['pond-c', 'cam', 150, 28, 520, 125, 3, 590],
  ['pond-h', 'cam', 100, 32, 680, 132, 5, 745],
  ['dike', 80, 570, 0, 14, 9],
  ['pumps', 83, 794, 0.25, 14, 9],
  ['gate', 86, 812, 0, 14, 9],
  ['gate2', 86, 818, 0, 10, 7],
  ['ramp-end', 90, 838, 0.28, 10, 6],
  ['corner-bank', 'cam', 100, 16, 832, 78, 0, 852],
  ['dike-end', 'cam', 60, 22, 770, 84, 6, 795],
  ['ramp', 88, 828, 0.28, 14, 9],
  ['crossing', 96, 852, 0, 14, 9],
  ['bar-top', 'cam', 60, 55, 990, 90, 0, 1060],
  ['bar-drive', 96, 1034, 0, 14, 9],
  ['bar-merge', 118, 1074, 0.8, 14, 9],
  ['bridge-head', 126, 1086, 0, 14, 9],
  ['bridge-mid', 126, 1220, 0, 14, 9],
  ['bridge-top', 'cam', 175, 45, 1180, 128, 0, 1240],
  ['far-head', 126, 1356, 0, 14, 9],
  ['site-gate', 124, 1394, -Math.PI / 2, 14, 9],
  ['site-top', 'cam', 150, 70, 1340, 50, 0, 1460],
  ['yard', 96, 1396, -Math.PI / 2, 14, 9],
  ['ramp1', 79.25, 1430, 0, 14, 9],
  ['site-west', 'cam', -70, 45, 1470, 10, 5, 1460],
  ['site-north', 'cam', 30, 50, 1580, 30, 5, 1460],
  ['b1-floor', 'cam', 84, 12, 1484, 60, 6, 1472],
  ['sway', 'cam', 50, 10, 1462, 30, 6, 1468],
  ['ramp2', 'cam', 26, 9, 1470, 18, 9, 1500],
  ['landing2', 'cam', 24, 16, 1528, 0, 10, 1505],
  ['floor3', 'cam', 2, 16, 1510, -4, 10, 1470],
  ['gap', 'cam', 8, 13, 1450, -6, 8, 1425],
  ['roof3', 'cam', -6, 14, 1440, -6, 7, 1395],
  ['site-south', 'cam', 40, 30, 1360, 30, 2, 1430],
  ['drive-b1', 79.25, 1470, 0, 14, 9, 5.33],
  ['drive-b1w', 60, 1476, -1.9, 14, 9, 6],
  ['drive-sway', 44, 1468, -Math.PI / 2, 14, 9, 6],
  ['drive-p2', 24, 1470, -0.6, 14, 9, 6],
  ['drive-r2', 18.75, 1486, 0, 14, 9, 6.9],
  ['drive-l2', 10, 1518, -Math.PI / 2, 14, 9, 10.5],
  ['drive-f3', 0.4, 1494, Math.PI, 14, 9, 10.5],
  ['drive-gap', -6, 1452, Math.PI, 14, 9, 10.5],
  ['drive-roof', -6, 1414, Math.PI, 14, 9, 7.5],
  ['bar-west', 'cam', -20, 25, 1040, -50, 0, 1060],
  ['bar-exit', 96, 1012, 0, 14, 9],
  ['bar-wide', 'cam', 60, 30, 1010, 10, 0, 1070],
  ['flats', 40, 960, -0.4, 14, 9],
  ['b2-under', 2, 1482, Math.PI, 14, 9, 6],
  ['jump-side', 'cam', 22, 12, 1422, -6, 8, 1424],
  ['roof-top', 'cam', -1, 30, 1428, -1, 7, 1398],
  ['forks', 'cam', 20, 22, 1500, -2, 10, 1475],
  ['roof-land', -6, 1410, Math.PI, 14, 9, 7.5],
  ['ford-mid', 94, 930, 0, 14, 9],
  ['ford-exit', 96, 1010, 0, 14, 9],
  ['melons', 'cam', 104, 6, 1030, 98, 0, 1042],
  ['dike2', 80, 640, 0, 14, 9],
  ['dike3', 78, 720, 0, 14, 9],
  ['dike-east', 'cam', 130, 22, 600, 85, 4, 660],
  ['curtain', 'cam', 95, 16, 575, 112, 3, 600],
  ['boom', 'cam', 72, 9, 582, 84, 6, 593],
  ['balls', 'cam', 60, 9, 680, 75, 7, 700],
  ['pile', 'cam', 79, 11, 566, 81, 7, 580],
  ['equip', 'cam', 24, 30, 460, 24, 14, 505],
  ['worker-close', 'cam', 75, 15.5, 309, 75, 12.8, 315],
  ['boxes', 'cam', 112, 22, 172, 136, 12, 200],
  ['ford-end', 'cam', 120, 45, 980, 90, 0, 1040],
  ['ford-west', 'cam', 110, 30, 900, 70, 0, 950],
  ['yard-start', 32, 60, 0, 14, 9],
  ['bench-top', 'cam', 60, 50, 40, 0, 15, 110],
  ['pump-top', 'cam', 150, 70, 760, 85, 0, 830],
  ['pump-west', 'cam', 20, 40, 780, 85, 3, 825],
  ['street-top', 'cam', 72, 90, 230, 72, 10, 310],
  ['street-east', 46, 306, Math.PI / 2, 14, 8],
  ['corner', 28, 284, 0.15, 14, 8],
  ['corner-top', 'cam', 60, 45, 280, 38, 10, 304],
  ['street-north', 112, 300, 0, 14, 8],
  ['exit-top', 'cam', 33, 75, 262, 34, 10, 296],
  ['pump-down', 'cam', 90, 85, 790, 90, 4, 822],
];
// Only the shots named on the command line, if any are.
const only = process.argv.slice(2);
for (const [name, ...v] of shots) {
  if (only.length && !only.includes(name)) continue;
  await page.evaluate((v) => {
    for (const id of ['banner', 'help', 'hud']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
    const { camera, sim } = window.game;
    if (v[0] === 'cam') {
      window.game.freeze = true;
      camera.position.set(v[1], v[2], v[3]);
      camera.lookAt(v[4], v[5], v[6]);
    } else {
      const [x, z, yaw, back, up, floor] = v;
      window.game.freeze = false;
      sim.teleport(x, z, yaw, floor);
      for (let i = 0; i < 60; i++) sim.step({ throttle: 0, steer: 0, handbrake: true });
      window.game.freeze = true;
      const t = sim.truck.body.translation();
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      camera.position.set(t.x - fx * back, t.y + up, t.z - fz * back);
      camera.lookAt(t.x + fx * 20, t.y, t.z + fz * 20);
    }
    camera.updateProjectionMatrix();
  }, v);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `dev/out/quarry-${name}.png` });
}
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
