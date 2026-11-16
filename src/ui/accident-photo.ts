import * as THREE from 'three';

const ANY_SIDE = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });

/** The triangles of `mesh` that come within 30 m of `target` (no candidate view is further), in world space. */
function nearbyPart(mesh: THREE.Mesh, target: THREE.Vector3): THREE.Mesh | null {
 const position = mesh.geometry.attributes.position, index = mesh.geometry.index;
 const range = mesh.geometry.drawRange;
 const count = Math.min(index ? index.count : position.count, range.start + range.count);
 const reach = 30, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
 const kept: number[] = [];
 for (let i = range.start - range.start % 3; i + 2 < count; i += 3) {
  const ia = index ? index.getX(i) : i, ib = index ? index.getX(i + 1) : i + 1, ic = index ? index.getX(i + 2) : i + 2;
  a.fromBufferAttribute(position, ia).applyMatrix4(mesh.matrixWorld);
  b.fromBufferAttribute(position, ib).applyMatrix4(mesh.matrixWorld);
  c.fromBufferAttribute(position, ic).applyMatrix4(mesh.matrixWorld);
  if (Math.max(a.x, b.x, c.x) < target.x - reach || Math.min(a.x, b.x, c.x) > target.x + reach) continue;
  if (Math.max(a.y, b.y, c.y) < target.y - reach || Math.min(a.y, b.y, c.y) > target.y + reach) continue;
  if (Math.max(a.z, b.z, c.z) < target.z - reach || Math.min(a.z, b.z, c.z) > target.z + reach) continue;
  kept.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
 }
 if (!kept.length) return null;
 const geometry = new THREE.BufferGeometry();
 geometry.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3));
 const near = new THREE.Mesh(geometry, ANY_SIDE);
 near.layers.mask = mesh.layers.mask;
 near.matrixAutoUpdate = false; near.updateMatrixWorld(true);
 return near;
}

// Score nearby views without rendering them; capture only the best view once per failure.
export function chooseAccidentCamera(scene: THREE.Scene, gameplayCamera: THREE.PerspectiveCamera, truck: THREE.Object3D) {
 const start = performance.now();
 scene.updateMatrixWorld(true);
 const rotation = truck.getWorldQuaternion(new THREE.Quaternion());
 const truckBox = new THREE.Box3().setFromObject(truck);
 const target = truckBox.getCenter(new THREE.Vector3());
 const ownMeshes = new Set<THREE.Object3D>(); truck.traverse(object => ownMeshes.add(object));
 const obstacles: THREE.Mesh[] = [];
 const scratch: THREE.BufferGeometry[] = [];
 const instanceMatrix=new THREE.Matrix4(),worldMatrix=new THREE.Matrix4(),instanceSphere=new THREE.Sphere();
 scene.traverseVisible(object => {
  if (!(object instanceof THREE.Mesh) || ownMeshes.has(object)) return;
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  if (!materials.some(material => material.visible && material.opacity > .35)) return;
  // Instanced buildings/wires need their combined bounds, not the source geometry's origin.
  if (object instanceof THREE.InstancedMesh && !object.boundingSphere) object.computeBoundingSphere();
  if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
  const sphere = (object instanceof THREE.InstancedMesh ? object.boundingSphere : object.geometry.boundingSphere)!.clone().applyMatrix4(object.matrixWorld);
  if (sphere.center.distanceTo(target) - sphere.radius >= 30) return;
  if (!(object instanceof THREE.InstancedMesh)) {
   // Level-wide merged meshes would be scanned triangle by triangle for every ray: keep only the part near the truck.
   if (sphere.radius > 40) { const near = nearbyPart(object, target); if (near) { obstacles.push(near); scratch.push(near.geometry); } return; }
   obstacles.push(object);return;
  }
  // InstancedMesh.raycast scans the entire town for every ray. Restrict it once to nearby instances.
  for(let i=0;i<object.count;i++) {
   object.getMatrixAt(i,instanceMatrix);worldMatrix.multiplyMatrices(object.matrixWorld,instanceMatrix);
   instanceSphere.copy(object.geometry.boundingSphere!).applyMatrix4(worldMatrix);
   if(instanceSphere.center.distanceTo(target)-instanceSphere.radius>=30)continue;
   const proxy=new THREE.Mesh(object.geometry,object.material);
   proxy.matrixAutoUpdate=false;proxy.matrixWorld.copy(worldMatrix);obstacles.push(proxy);
  }
 });
 // Test both sides of walls, including a camera that would have ended up inside one.
 const sides = new Map<THREE.Material, THREE.Side>();
 obstacles.forEach(object => (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => {
  if (!sides.has(material)) sides.set(material, material.side);
  material.side = THREE.DoubleSide;
 }));
 const forward = new THREE.Vector3(0,0,1).applyQuaternion(rotation);forward.y=0;forward.normalize();
 const roof = new THREE.Vector3(0,1,0).applyQuaternion(rotation);
 const yaw = Math.atan2(forward.x,forward.z);
 const truckMeshes: THREE.Mesh[]=[];truck.traverseVisible(object=>{if(object instanceof THREE.Mesh)truckMeshes.push(object);});
 const corners=[];
 for(const x of [truckBox.min.x,truckBox.max.x]) for(const y of [truckBox.min.y,truckBox.max.y]) for(const z of [truckBox.min.z,truckBox.max.z]) corners.push(new THREE.Vector3(x,y,z));
 const ray = new THREE.Raycaster();
 const hits: THREE.Intersection[] = [];
 const choices: { camera: THREE.PerspectiveCamera; preference: number; height: number; turn: number; blocked: number; samples: number; score?: number }[] = [];
 try {
  for (const [height,radius] of [[6,13],[10,13],[15,10],[9,4],[5,5]]) for (const turn of [-.8,.8,-1.6,1.6,-2.4,2.4,0,Math.PI]) {
   const candidate=gameplayCamera.clone();
   candidate.position.copy(target).add(new THREE.Vector3(Math.sin(yaw+turn)*radius,height,Math.cos(yaw+turn)*radius));
   candidate.aspect=1.6;candidate.fov=48;candidate.lookAt(target);candidate.updateProjectionMatrix();candidate.updateMatrixWorld();
   const facing=candidate.position.clone().sub(target).normalize();
   // Prefer the cab/front and painted roof side over a photograph dominated by the chassis.
   const preference=height*.5-Math.max(0,roof.dot(facing))*12-Math.max(0,forward.dot(facing))*4;
   choices.push({camera:candidate,preference,height,turn,blocked:0,samples:0});
  }
  choices.sort((a,b)=>a.preference-b.preference);
  for(const choice of choices) {
   const projected=corners.map(p=>p.clone().project(choice.camera));
   const minX=Math.min(...projected.map(p=>p.x)),maxX=Math.max(...projected.map(p=>p.x));
   const minY=Math.min(...projected.map(p=>p.y)),maxY=Math.max(...projected.map(p=>p.y));
   choice.blocked=0;choice.samples=0;
   for(let row=0;row<5;row++) for(let col=0;col<5;col++) {
    ray.setFromCamera(new THREE.Vector2(minX+(maxX-minX)*(col+.5)/5,minY+(maxY-minY)*(row+.5)/5),choice.camera);
    ray.near=0;ray.far=100;
    const surface=ray.intersectObjects(truckMeshes,false)[0];
    if(!surface)continue;
    choice.samples++;
    ray.far=surface.distance-.06;
    // Any one hit is enough to call the sample blocked.
    for(const obstacle of obstacles) { if(!obstacle.layers.test(ray.layers))continue;hits.length=0;obstacle.raycast(ray,hits);if(hits.length){choice.blocked++;break;} }
   }
   choice.score=(choice.samples ? choice.blocked/choice.samples : 1)*1000+choice.preference;
   if(choice.blocked===0 && choice.samples>=5)break;
  }
 } finally { for(const [material,side] of sides) material.side=side; scratch.forEach(geometry=>geometry.dispose()); }
 const evaluated=choices.filter(choice=>choice.score!==undefined).sort((a,b)=>a.score!-b.score!);
 const selected=evaluated[0];
 return { camera:selected.camera, target, metrics:{ candidates:choices.length,evaluated: evaluated.length, blockedSamples:selected.blocked, sampleCount:selected.samples, height:selected.height, turn:selected.turn, selectionMs:performance.now()-start, fallbackNeeded:selected.blocked>0 } };
}


/** Temporary 640 × 400 target; no rolling buffer or recurring readback during driving. */
export async function captureAccidentPhoto(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, truck: THREE.Object3D): Promise<Blob | null> {
 const selected = chooseAccidentCamera(scene, camera, truck);
 // A submerged truck cannot be recovered by choosing the least bad view of a bridge or riverbank.
 // Keep the recent clear image instead of publishing an unreadable photograph.
 if (selected.metrics.sampleCount < 5 || selected.metrics.blockedSamples / selected.metrics.sampleCount > .25) return null;
 const width = 640, height = 400;
 const target = new THREE.WebGLRenderTarget(width, height, { colorSpace: THREE.SRGBColorSpace });
 const previous = renderer.getRenderTarget();
 const viewport = renderer.getViewport(new THREE.Vector4()), scissor = renderer.getScissor(new THREE.Vector4());
 const scissorTest = renderer.getScissorTest();
 const pixels = new Uint8Array(width * height * 4);
 try {
  renderer.setRenderTarget(target);
  renderer.setViewport(0, 0, width, height);
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.render(scene, selected.camera);
  renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
 } finally {
  renderer.setRenderTarget(previous);
  renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
  target.dispose();
 }
 const canvas = document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx = canvas.getContext('2d')!;
 const image = ctx.createImageData(width, height);
 for(let y=0;y<height;y++) image.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4), y*width*4);
 ctx.putImageData(image,0,0);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Photo encoding failed')), 'image/jpeg', .86));
}
