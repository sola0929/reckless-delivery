import assert from 'node:assert/strict';
import { RouteProgress } from '../src/ui/route-progress';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, FrontSide } from 'three';
import { chooseAccidentCamera } from '../src/ui/accident-photo';

const route = new RouteProgress([[0, 0], [0, 100], [100, 100]]);
route.reset(0, 0);
for (let z = 0; z <= 80; z += 5) route.update(0, z);
assert.equal(route.fraction, .4);
for (let z = 80; z >= 0; z -= 5) route.update(0, z);
assert.equal(route.fraction, .4, 'backtracking must not accumulate progress');
route.update(200, 0);
assert.equal(route.fraction, .4, 'off-route detours must not count');
route.reset(50, 100);
assert.equal(route.fraction, .75, 'checkpoint reset reprojects the route');
route.reset(0, 0);
assert.equal(route.fraction, 0, 'full retry starts over');
assert.equal(new RouteProgress().fraction, null);
const crossing = new RouteProgress([[-100, 0], [100, 0], [100, 100], [0, 100], [0, -100]]);
crossing.reset(-100, 0);
for (let x = -100; x <= 5; x++) crossing.update(x, 0);
assert.ok(crossing.fraction! < .2, 'crossing must not jump to a later branch');

const scene = new Scene(), truck = new Group();
truck.add(new Mesh(new BoxGeometry(3, 3, 6), new MeshBasicMaterial()));
truck.position.y = 2;
scene.add(truck);
const wallMaterial = new MeshBasicMaterial();
const wall = new Mesh(new BoxGeometry(20, 12, 1), wallMaterial);
wall.position.set(0, 5, 8);scene.add(wall);
const camera = new PerspectiveCamera(48, 1.6, .1, 500);
const selected = chooseAccidentCamera(scene, camera, truck);
assert.equal(selected.metrics.blockedSamples, 0, 'camera should find the clear side of a wall');
assert.ok(selected.metrics.sampleCount >= 5);
assert.equal(wallMaterial.side, FrontSide, 'camera selection must restore shared materials');
assert.equal(selected.camera.aspect, 1.6);
// A narrow river channel needs a camera inside the banks, not across their far sides.
scene.remove(wall);
for (const [x,z,w,d] of [[-7,0,1,30],[7,0,1,30],[0,-7,30,1],[0,7,30,1]]) {
  const bank = new Mesh(new BoxGeometry(w,30,d), wallMaterial);
  bank.position.set(x,10,z);scene.add(bank);
}
const channel = chooseAccidentCamera(scene,camera,truck);
assert.equal(channel.metrics.blockedSamples,0,'close overhead candidates must see into a narrow channel');
assert.ok(Math.hypot(channel.camera.position.x,channel.camera.position.z)<7);
assert.equal(wallMaterial.side,FrontSide);
// A fully enclosed/submerged subject has no clear photograph; preserve this signal for fallback.
const cover = new Mesh(new BoxGeometry(8,8,10),wallMaterial);
cover.position.copy(truck.position);scene.add(cover);
const hidden = chooseAccidentCamera(scene,camera,truck);
assert.ok(hidden.metrics.blockedSamples/hidden.metrics.sampleCount>.25,'fully obscured truck must fail the photo visibility gate');
console.log('UI logic: route continuity/reset and unobstructed accident framing passed.');
