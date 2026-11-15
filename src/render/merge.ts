import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** What a part is drawn with once it is merged, and where on that material's picture its own picture now lies. */
export interface Recast {
  material: THREE.Material;
  uv?: (u: number, v: number) => [number, number];
}

/**
 * Meshes that never move, drawn together: one mesh to each material, shadow setting, draw order and side (`apart`), each
 * part baked where it stands in the world. Each merged mesh is put at the middle of its parts, so whatever goes by where a
 * mesh is (what the outage darkens in the hall) still finds it on the right side. The meshes given are taken out of the
 * scene and their geometry disposed; anything else hung on them (a glow) is moved to the scene, staying where it was.
 * The meshes' world matrices must be up to date.
 */
export function drawStillTogether(
  meshes: THREE.Mesh[],
  scene: THREE.Object3D,
  recast: (material: THREE.Material) => Recast = (material) => ({ material }),
  apart: (at: THREE.Vector3) => string = () => '',
): THREE.Mesh[] {
  const parts = new Map<string, { material: THREE.Material; castShadow: boolean; receiveShadow: boolean; renderOrder: number; geometries: THREE.BufferGeometry[] }>();
  const at = new THREE.Vector3();
  for (const mesh of meshes) {
    const source = mesh.geometry;
    const index = source.index;
    const total = index ? index.count : source.getAttribute('position').count;
    const groups = source.groups.length ? source.groups : [{ start: 0, count: total, materialIndex: 0 }];
    const side = apart(mesh.getWorldPosition(at));
    for (const { start, count, materialIndex } of groups) {
      // One material is the whole mesh's, whatever groups its geometry comes in (a cylinder's sides and ends).
      const own = Array.isArray(mesh.material) ? mesh.material[materialIndex ?? 0] : mesh.material;
      const { material, uv } = recast(own);
      // Each part on its own, unindexed: parts of all kinds then merge alike.
      const part = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'uv'] as const) {
        const from = source.getAttribute(name);
        const out = new Float32Array(count * from.itemSize);
        for (let k = 0; k < count; k++) {
          const i = index ? index.getX(start + k) : start + k;
          for (let c = 0; c < from.itemSize; c++) out[k * from.itemSize + c] = from.getComponent(i, c);
        }
        part.setAttribute(name, new THREE.BufferAttribute(out, from.itemSize));
      }
      part.applyMatrix4(mesh.matrixWorld);
      if (uv) {
        const coords = part.getAttribute('uv');
        for (let k = 0; k < coords.count; k++) coords.setXY(k, ...uv(coords.getX(k), coords.getY(k)));
      }
      const key = `${material.uuid}|${mesh.castShadow}|${mesh.receiveShadow}|${mesh.renderOrder}|${side}`;
      const entry = parts.get(key) ?? { material, castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow, renderOrder: mesh.renderOrder, geometries: [] };
      entry.geometries.push(part);
      parts.set(key, entry);
    }
  }
  for (const mesh of meshes) {
    for (const child of [...mesh.children]) scene.attach(child);
    mesh.removeFromParent();
    mesh.geometry.dispose();
  }
  const merged: THREE.Mesh[] = [];
  for (const { material, castShadow, receiveShadow, renderOrder, geometries } of parts.values()) {
    const geometry = mergeGeometries(geometries);
    for (const part of geometries) part.dispose();
    geometry.computeBoundingBox();
    const middle = geometry.boundingBox!.getCenter(new THREE.Vector3());
    geometry.translate(-middle.x, -middle.y, -middle.z);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(middle);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.renderOrder = renderOrder;
    scene.add(mesh);
    merged.push(mesh);
  }
  return merged;
}
