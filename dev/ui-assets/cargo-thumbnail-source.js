// Offline review asset capture only. Uses the game's complete CargoViews meshes,
// including textures, door hardware and the skeleton's face. No physics loop.
import * as THREE from 'three';
import { CargoViews } from '../../src/render/cargoView.ts';
import { CARGO_TYPES } from '../../src/sim/cargo-types.ts';

const renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true, preserveDrawingBuffer:true });
renderer.setSize(192,192);
renderer.setClearColor(0,0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
document.body.append(renderer.domElement);
window.captureCargo = id => {
 const scene = new THREE.Scene();
 scene.add(new THREE.HemisphereLight(0xfff6df,0x647d72,2.2));
 const key = new THREE.DirectionalLight(0xfff3da,3.2);
 key.position.set(-3,5,6); scene.add(key);
 const type = CARGO_TYPES[id];
 const body = { translation:()=>({x:0,y:0,z:0}), rotation:()=>({x:0,y:0,z:0,w:1}) };
 const item = { type, attached:type.parts.map(()=>true), body, stage:0, bonus:false };
 const views = new CargoViews(scene,null);
 views.rebuild({cargo:[item]});
 const model = scene.children.find(child=>child.isGroup);
 // The real skeleton is stored lying on its back; stand it up for recognition.
 if (id === 'skeleton') {
  model.rotateX(Math.PI/2);
  model.rotateOnWorldAxis(new THREE.Vector3(0,0,1),Math.PI);
 }
 model.updateMatrixWorld(true);
 const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
 model.position.sub(center); model.updateMatrixWorld(true);
 const camera = new THREE.OrthographicCamera(-1,1,1,-1,.1,50);
 camera.position.set(3,2.2,5); camera.lookAt(0,0,0); camera.updateMatrixWorld(true);
 const box = new THREE.Box3().setFromObject(model);
 let extent = 0;
 for(const x of [box.min.x,box.max.x]) for(const y of [box.min.y,box.max.y]) for(const z of [box.min.z,box.max.z]) {
  const p = new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
  extent = Math.max(extent,Math.abs(p.x),Math.abs(p.y));
 }
 // Keep small and large crates at their true relative scale, not equal size.
 const occupancy = id === 'smallCrate' ? .72 : 1;
 const half = extent * 1.15 / occupancy;
 camera.left = camera.bottom = -half; camera.right = camera.top = half; camera.updateProjectionMatrix();
 renderer.render(scene,camera);
 const png = renderer.domElement.toDataURL('image/png');
 const check = document.createElement('canvas');check.width=check.height=192;
 const ctx=check.getContext('2d');ctx.drawImage(renderer.domElement,0,0);
 const pixels=ctx.getImageData(0,0,192,192).data;
 let occupied=0,edge=0;
 for(let y=0;y<192;y++)for(let x=0;x<192;x++)if(pixels[(y*192+x)*4+3]>0){occupied++;if(x===0||y===0||x===191||y===191)edge++;}
 return {png,occupied,edge};
};
