// The key visual, posed in the game itself: the truck stood at a place on a level's route, lifted nose-up as if over a
// crest, its load set out in the air above and behind it, gravity off so that it all holds still, then photographed
// from ahead and to one side with nothing over the picture.
// node dev/promo-pose.mjs <level> <route %> [scale] [camera ahead,side,up] [out name]   → dev/out/promo/<out>.png
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'fs';
const [level, at = '65', scale = '1', cam = '9,5.5,0.6', out = 'pose'] = process.argv.slice(2);
const [ahead, side, up] = cam.split(',').map(Number);
// Where each thing goes, in the truck's own frame: x to its right, y up from the bed, z forward; then a tumble (radians).
const layout = JSON.parse(readFileSync(process.env.LAYOUT ?? 'dev/promo/pose-layout.json', 'utf8'));
mkdirSync('dev/out/promo', { recursive: true });
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: Number(scale) });
p.on('pageerror', (e) => console.log('ERROR', String(e)));
await p.addInitScript(() => localStorage.setItem('cargo-graphics', 'high'));
await p.goto(`http://localhost:5183/?level=${level}`);
await p.waitForFunction(() => window.game?.sim && document.getElementById('loading').hidden, null, { timeout: 90000 });
await p.keyboard.press('Enter');
await p.addStyleTag({ content: '#hud, #help, #prompt, #banner, #chat, #lesson, #pause, #dev-jumps, #lock { visibility: hidden !important; } * { cursor: none !important; }' });
// To the place along the route, facing along it.
await p.evaluate((at) => {
  const { sim } = window.game;
  const route = sim.level.route;
  const legs = route.slice(1).map((q, i) => Math.hypot(q[0] - route[i][0], q[1] - route[i][1]));
  let s = (Number(at) / 100) * legs.reduce((a, b) => a + b, 0), i = 0;
  while (s > legs[i]) s -= legs[i++];
  const [a, q] = [route[i], route[i + 1]];
  const t = s / legs[i];
  sim.teleport(a[0] + (q[0] - a[0]) * t, a[1] + (q[1] - a[1]) * t, Math.atan2(q[0] - a[0], q[1] - a[1]) + Number(window.__turn ?? 0));
}, at);
await p.waitForTimeout(2500);
await p.evaluate((clear) => { window.__clear = clear; }, process.env.CLEAR ?? '');
// Gravity off, everything still, then the pose.
const ids = await p.evaluate((layout) => {
  const g = window.game, { sim } = g;
  sim.world.gravity = { x: 0, y: 0, z: 0 };
  // Traffic near the truck sent on down its lanes, out of the picture.
  { const t = sim.truck.body.translation(); for (const car of sim.traffic.cars) { const c = car.body.translation(); if (Math.hypot(c.x - t.x, c.z - t.z) < 40) { car.knocked = 1e9; car.body.setTranslation({ x: c.x, y: c.y - 200, z: c.z }, true); } } }
  const truck = sim.truck.body;
  const t0 = truck.translation();
  const q0 = truck.rotation();
  const yaw = Math.atan2(2 * (q0.x * q0.z + q0.w * q0.y), 1 - 2 * (q0.x * q0.x + q0.y * q0.y));
  // Quaternion helpers: from yaw, pitch (nose up positive), roll; and applying one to a vector.
  const quat = (yaw, pitch, roll) => {
    const [cy, sy, cp, sp, cr, sr] = [Math.cos(yaw / 2), Math.sin(yaw / 2), Math.cos(-pitch / 2), Math.sin(-pitch / 2), Math.cos(roll / 2), Math.sin(roll / 2)];
    // yaw about Y, then pitch about X, then roll about Z (intrinsic Y-X-Z)
    const qy = { w: cy, x: 0, y: sy, z: 0 }, qx = { w: cp, x: sp, y: 0, z: 0 }, qz = { w: cr, x: 0, y: 0, z: sr };
    const mul = (a, b) => ({ w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z, x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x, z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w });
    return mul(mul(qy, qx), qz);
  };
  const rot = (q, v) => {
    const u = { x: q.x, y: q.y, z: q.z }, s = q.w;
    const dot = u.x * v.x + u.y * v.y + u.z * v.z, uu = u.x * u.x + u.y * u.y + u.z * u.z;
    const cr = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
    return { x: 2 * dot * u.x + (s * s - uu) * v.x + 2 * s * cr.x, y: 2 * dot * u.y + (s * s - uu) * v.y + 2 * s * cr.y, z: 2 * dot * u.z + (s * s - uu) * v.z + 2 * s * cr.z };
  };
  const pose = quat(yaw, layout.truck.pitch, layout.truck.roll ?? 0);
  const centre = { x: t0.x, y: t0.y + layout.truck.lift, z: t0.z };
  truck.setTranslation(centre, true);
  truck.setRotation(pose, true);
  truck.setLinvel({ x: 0, y: 0, z: 0 }, true);
  truck.setAngvel({ x: 0, y: 0, z: 0 }, true);
  const used = new Set();
  const done = [];
  const hurt = [];
  for (const [type, x, y, z, rx = 0, ry = 0, rz = 0, dmg = 0] of layout.cargo) {
    const item = sim.cargo.find((c) => c.body && !c.bonus && c.type.id === type && !used.has(c));
    if (!item) { done.push('missing ' + type); continue; }
    used.add(item);
    const off = rot(pose, { x, y, z });
    item.body.setTranslation({ x: centre.x + off.x, y: centre.y + off.y, z: centre.z + off.z }, true);
    item.body.setRotation(quat(yaw + ry, rx, rz), true);
    item.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    item.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    if (dmg) hurt.push([item, dmg]);
    done.push(type);
  }
  // Some of it half wrecked as it goes: a door off, a lid off, whatever it sheds at that much damage.
  for (const [item, dmg] of hurt) sim.cargoSystem['damage'](item, dmg);
  // What is not placed stays on the bed: held still with the truck.
  for (const c of sim.cargo) if (c.body && !used.has(c)) {
    const p = c.body.translation();
    const off = rot(pose, rot({ w: q0.w, x: -q0.x, y: -q0.y, z: -q0.z }, { x: p.x - t0.x, y: p.y - t0.y, z: p.z - t0.z }));
    c.body.setTranslation({ x: centre.x + off.x, y: centre.y + off.y, z: centre.z + off.z }, true);
    const cq = c.body.rotation();
    const mul = (a, b) => ({ w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z, x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x, z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w });
    c.body.setRotation(mul(mul(pose, { w: q0.w, x: -q0.x, y: -q0.y, z: -q0.z }), cq), true);
    c.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    c.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
  // Optional: loose things standing low on the road just ahead (a parked car, a bin) moved out of the picture.
  if (window.__clear) {
    const [fwd, right, radius] = window.__clear.split(',').map(Number);
    const f = { x: Math.sin(yaw), z: Math.cos(yaw) }, r = { x: f.z, z: -f.x };
    const at = { x: centre.x + f.x * fwd + r.x * right, z: centre.z + f.z * fwd + r.z * right };
    const mine = new Set([truck.handle, ...sim.cargo.filter((c) => c.body).map((c) => c.body.handle)]);
    sim.world.bodies.forEach((body) => {
      if (body.isFixed() || mine.has(body.handle)) return;
      const q = body.translation();
      if (q.y < centre.y + 0.5 && Math.hypot(q.x - at.x, q.z - at.z) < radius) body.setTranslation({ x: q.x, y: q.y - 200, z: q.z }, true);
    });
  }
  // Nobody lying knocked off a scooter beside it.
  for (const r of sim.riders.list) if (!r.seated && Math.hypot(r.person.x - centre.x, r.person.z - centre.z) < 25) r.person.y -= 200;
  // Nobody lying knocked over on the pavement beside it.
  for (const ped of sim.pedestrians.list) if (ped.state === 'down' && Math.hypot(ped.pos.x - centre.x, ped.pos.z - centre.z) < 20) ped.pos.y -= 200;
  window.__centre = centre;
  window.__yaw = yaw;
  return done;
}, layout);
console.log(ids.join(' '));
if (process.env.NEAR) console.log(await p.evaluate(() => { const { sim } = window.game, c = window.__centre; return 'peds ' + sim.pedestrians.list.filter((q) => Math.hypot(q.pos.x - c.x, q.pos.z - c.z) < 20).map((q) => q.state + '@' + Math.hypot(q.pos.x - c.x, q.pos.z - c.z).toFixed(0) + ' y' + (q.pos.y - c.y).toFixed(1)).join(' '); }));
if (process.env.NEAR) console.log(await p.evaluate(() => { const { sim } = window.game, c = window.__centre; const near = (b) => { const q = b.translation(); return Math.hypot(q.x - c.x, q.z - c.z); }; return 'traffic ' + sim.traffic.cars.filter((k) => near(k.body) < 25).map((k) => k.kind + '@' + near(k.body).toFixed(0)).join(' ') + ' | objects ' + (sim.objects?.list ?? sim.objects ?? []).filter?.((o) => o.body && near(o.body) < 14).map((o) => (o.kind?.id ?? o.kind ?? '?') + '@' + near(o.body).toFixed(0)).join(' '); }));
// What it took off from: a road-works plate lifted at one end on sandbags, cones and a works sign by it. Drawn only, for
// the picture: in the truck's frame, from z0 on the road to z1 under its back wheels, raised to the given height.
if (process.env.RAMP) await p.evaluate(async (ramp) => {
  const [z0, z1, rise, width, ox = 0, dust = 1] = ramp.split(',').map(Number);
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('deps/three.js'));
  const THREE = await import(url);
  const g = window.game, c = window.__centre, yaw = window.__yaw;
  const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), r = new THREE.Vector3(f.z, 0, -f.x);
  const at = (x, z) => new THREE.Vector3(c.x, 0, c.z).addScaledVector(r, x + ox).addScaledVector(f, z);
  // The road's height there, found by looking straight down at it.
  const ray = new THREE.Raycaster();
  const ground = (x, z) => { const p = at(x, z); ray.set(new THREE.Vector3(p.x, c.y + 5, p.z), new THREE.Vector3(0, -1, 0)); const hit = ray.intersectObjects(g.scene.children, true).find((h) => h.object.visible && h.distance > 2 && !h.object.isPoints && !h.object.isLine); return hit ? hit.point.y : c.y - 2.5; };
  const y0 = ground(0, z0 - 1);
  const group = new THREE.Group();
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.25 });
  const box = (w, h, d, color, x, y, z, rx = 0, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.position.copy(at(x, z)).setY(y); m.rotation.set(0, 0, 0); m.rotateY(yaw + ry); m.rotateX(-rx); m.castShadow = m.receiveShadow = true; group.add(m); return m; };
  const len = Math.hypot(z1 - z0, rise), tilt = Math.atan2(rise, z1 - z0);
  // The plate, its yellow and black edge, and the sandbags it rests on.
  box(width, 0.06, len, 0x9aa3ab, 0, y0 + rise / 2 + 0.03, (z0 + z1) / 2, tilt);
  for (const side of [-1, 1]) for (let k = 0; k < 8; k++) box(0.16, 0.07, len / 8 - 0.03, k % 2 ? 0x1d1d1d : 0xf2c230, side * (width / 2 - 0.08), y0 + (rise * (k + 0.5)) / 8 + 0.04, z0 + ((z1 - z0) * (k + 0.5)) / 8, tilt);
  for (let k = 0; k < 6; k++) box(width / 6 - 0.04, 0.055, 0.25, k % 2 ? 0x1d1d1d : 0xf2c230, -width / 2 + (k + 0.5) * (width / 6), y0 + rise - 0.1, z1 - 0.12, tilt);
  for (const [x, z, y] of [[-0.8, z1 - 0.5, 0], [0.8, z1 - 0.5, 0], [0, z1 - 0.6, 0], [-0.8, z1 - 0.5, 1], [0.8, z1 - 0.5, 1], [0, z1 - 0.5, 1], [-0.4, z1 - 0.5, 2], [0.4, z1 - 0.5, 2]]) box(0.75, rise / 3.2, 0.5, 0xb59a6a, x, y0 + rise / 6.4 + y * rise / 3.3, z, 0, 0.08 * (x + y));
  // The hole it was covering, and the works round it.
  box(width + 0.6, 0.02, 2.2, 0x2a2622, 0, y0 + 0.01, z0 - 1.6);
  const cone = (x, z) => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.75, 12), mat(0xff6a1a)); m.position.copy(at(x, z)).setY(y0 + 0.37); m.castShadow = true; group.add(m); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.1, 12), mat(0xffffff)); b.position.copy(at(x, z)).setY(y0 + 0.42); group.add(b); };
  for (const [x, z] of [[-width / 2 - 0.7, z0 - 2.4], [width / 2 + 0.7, z0 - 2.4], [-width / 2 - 0.9, z0 + 1.5], [width / 2 + 0.9, z0 + 1.5], [width / 2 + 1.1, z1 - 1]]) cone(x, z);
  // A works sign on its stand, white with a red edge, 前方施工.
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c8322a'; ctx.beginPath(); ctx.moveTo(128, 10); ctx.lineTo(246, 236); ctx.lineTo(10, 236); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(128, 44); ctx.lineTo(218, 216); ctx.lineTo(38, 216); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#222'; ctx.font = 'bold 44px Microsoft JhengHei'; ctx.textAlign = 'center'; ctx.fillText('前方', 128, 150); ctx.fillText('施工', 128, 200);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, side: THREE.DoubleSide }));
  sign.position.copy(at(width / 2 + 1.6, z0 - 1)).setY(y0 + 1.25); sign.rotation.y = yaw + 0.5; group.add(sign);
  box(0.06, 0.8, 0.06, 0x888888, width / 2 + 1.6, y0 + 0.4, z0 - 1);
  g.scene.add(group);
  // Black smoke from the exhaust stack, drawn out behind as it goes flat out; dust thrown up where it left the plate.
  let tip = null;
  g.scene.traverse((o) => { const q = o.geometry?.parameters; if (o.isMesh && q && Math.abs((q.radiusTop ?? 0) - 0.085) < 1e-3 && Math.abs((q.height ?? 0) - 0.16) < 1e-3) tip = o; });
  const puff = (pos, size, color, opacity) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), new THREE.MeshStandardMaterial({ color, transparent: true, opacity, depthWrite: false, roughness: 1 })); m.position.copy(pos); m.rotation.set(Math.random() * 3, Math.random() * 3, 0); group.add(m); };
  if (tip && window.__exhaust) {
    const from = new THREE.Vector3(); tip.getWorldPosition(from);
    const back = f.clone().multiplyScalar(-1);
    for (let k = 0; k < 11; k++) {
      const d = k * 0.75 + 0.2;
      const p = from.clone().addScaledVector(back, d).add(new THREE.Vector3(0, 0.45 + k * 0.32 + Math.sin(k * 1.7) * 0.15, 0)).addScaledVector(r, Math.sin(k * 2.3) * 0.15 * k / 4);
      puff(p, 0.26 + k * 0.12, k < 4 ? 0x262626 : 0x3d3d3d, Math.max(0.18, 0.9 - k * 0.06));
    }
  }
  // The dust it kicked up off the plate's end: a long thin trail from there to each back wheel, thickest where it was
  // thrown up and thinning to wisps under the wheels, each wisp drawn out along the way it went.
  const wisp = (pos, size, opacity) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: 0xe6e1d6, transparent: true, opacity, depthWrite: false, roughness: 1 }));
    m.position.copy(pos); m.rotation.set(0, yaw, 0); m.scale.set(size, size * 0.62, size * 2.4); group.add(m);
  };
  const tread = c.y - 1.5 - 0.35;
  if (dust === 1) for (const side of [-1.15, 1.15]) for (let k = 0; k <= 12; k++) {
    const u = k / 12;
    const start = at(side, z1 + 0.2).setY(y0 + rise + 0.25);
    const end = new THREE.Vector3(c.x, 0, c.z).addScaledVector(r, side).addScaledVector(f, -2.9).setY(tread + 0.15);
    const p = start.clone().lerp(end, u);
    p.y += Math.sin(u * Math.PI) * 0.35 + Math.sin(k * 2.7 + side) * 0.08;
    p.addScaledVector(r, Math.sin(k * 1.9 + side * 3) * 0.12);
    wisp(p, 0.55 - u * 0.36, 0.42 - u * 0.26);
  }
  // A small puff off the plate's lip only.
  if (dust === 2) for (let k = 0; k < 9; k++) wisp(at(Math.sin(k * 2.2) * 1.2, z1 + 0.1 - k * 0.25).setY(y0 + rise + 0.05 + Math.abs(Math.sin(k * 1.4)) * 0.25), 0.22 + Math.abs(Math.sin(k * 3.3)) * 0.18, 0.5 - k * 0.03);
  if (dust === 1) for (let k = 0; k < 7; k++) wisp(at(Math.sin(k * 2.2) * 0.9, z1 - 0.3 - k * 0.35).setY(y0 + rise * (1 - k * 0.06) + 0.25 + Math.abs(Math.sin(k)) * 0.3), 0.5 + k * 0.06, 0.3 - k * 0.03);
}, process.env.RAMP);
// Two frames for the pictures of things to catch up, then held.
await p.waitForTimeout(Number(process.env.SETTLE ?? 120));
await p.evaluate(() => { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { code: 'Escape', key: 'Escape' })); });
await p.evaluate(([ahead, side, up, look]) => {
  const g = window.game, c = window.__centre, yaw = window.__yaw;
  const f = { x: Math.sin(yaw), z: Math.cos(yaw) }, r = { x: f.z, z: -f.x };
  g.freeze = true;
  g.camera.position.set(c.x + f.x * ahead + r.x * side, c.y + up, c.z + f.z * ahead + r.z * side);
  g.camera.lookAt(c.x - f.x * 1.2, c.y + look, c.z - f.z * 1.2);
  if (window.__fov) { g.camera.fov = window.__fov; g.camera.updateProjectionMatrix(); }
}, [ahead, side, up, Number(process.env.LOOKUP ?? 1.6)]);
await p.waitForTimeout(800);
await p.screenshot({ path: `dev/out/promo/${out}.png` });
console.log(`dev/out/promo/${out}.png`);
await b.close();
