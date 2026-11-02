import * as THREE from 'three';
import type { OutageDesc } from '../levels/types';

// The power gone off in the market hall: as the truck comes in past the greens' first stalls, the lights flicker and go
// out, and it is dark, the sides of the aisles all but lost; the truck's headlights come on and show a little way ahead.
// What glows on its own in there, the stalls' names, the bulbs, goes dark with the rest. The emergency lights on their
// rods come on and the exit signs glow green, pointing the way out: only to be seen, lighting nothing, a soft glow round
// each. The work light behind the cab comes on over the load, and only the load. The beams of the headlights are seen in
// the damp air. At the back door, under its shutter, the grey daylight outside. Out of the truck in the dark, the driver has
// a headlamp on, shining where they face.

/** How dark: what is left of the daylight inside, as a share. */
const LEFT = 0.012;
/** The fog in the dark: near black, from so far from the camera, behind the truck, to so far, metres. */
const DARK_FOG: [number, number] = [12, 34];
const DARK = new THREE.Color(0x07080a);
/** The flicker as it goes, seconds: on or off by turns at these times, then off for good. */
const FLICKER = [0.0, 0.12, 0.2, 0.45, 0.55, 0.62, 0.95, 1.3];
/** The work light on the back of the cab, shining back down over the load: how bright, how far it reaches, how wide, where. */
const WORK = { intensity: 14, reach: 7, decay: 2, angle: 0.75, at: [0, 2.1, 1.85] as const };
/** The beams seen in the air: how long, how wide at their ends, how bright. */
const SHAFT = { long: 11, wide: 2.4, opacity: 0.14 };
/** How bright the daylight in the doorway, seen from in the dark: a dim grey, not a lit screen. */
const DAYLIGHT = 0.45;
/** The headlights: how bright, how far they reach, how wide, where on the truck's front. */
const BEAM = { intensity: 900, reach: 30, angle: 0.55, penumbra: 0.45, decay: 1.5, at: [0.85, 0.35, 3.75] as const };
/** The headlamp on foot: how bright, how far it reaches, how wide; where it shines from and where it is aimed, both as the lamp is. */
const TORCH = { intensity: 70, reach: 12, angle: 0.4, penumbra: 0.85, decay: 1.5, at: [0, 1.62, 0.36] as const, on: [0, -0.2, 7] as const };
/** Its beam seen in the air: how long, how wide at its end, how bright. */
const TORCH_SHAFT = { long: 6, wide: 1.0, opacity: 0.05 };

export class OutageView {
  private readonly hemisphere: THREE.HemisphereLight | null;
  private readonly sun: THREE.DirectionalLight | null;
  private readonly lit: { hemisphere: number; sun: number; sky: THREE.Color; fog: THREE.Color; near: number; far: number };
  /** What glows on its own in the hall, and the colour each is when lit. */
  private readonly glowing: { material: THREE.MeshBasicMaterial; color: THREE.Color }[] = [];
  private readonly beams: THREE.SpotLight[] = [];
  private readonly work: THREE.SpotLight;
  private readonly shafts: THREE.MeshBasicMaterial;
  /** The headlamp's light, kept in the scene and only turned down while it is not wanted: a light coming and going costs a pause. */
  private readonly torch: THREE.SpotLight;
  private readonly torchShaft: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  /** The glows round the emergency lights and exit signs; the daylight at the doors. */
  /** Each glow, and how strong it is at its darkest. */
  private readonly halos: { material: THREE.SpriteMaterial; strength: number }[] = [];
  private readonly daylight: THREE.MeshBasicMaterial[] = [];
  private readonly lenses: THREE.MeshBasicMaterial;
  private readonly heads: THREE.MeshBasicMaterial;
  /** Seconds since it went, while the truck is in; whether it has. */
  private since = 0;
  private out = false;
  /** How dark it is now, 0 to 1. */
  dark = 0;

  /** Whether the power has gone, the truck in the hall; and how long since, seconds. */
  get gone(): number {
    return this.out ? this.since : -1;
  }

  constructor(private readonly scene: THREE.Scene, private readonly desc: OutageDesc, truck: THREE.Object3D) {
    this.hemisphere = scene.children.find((c): c is THREE.HemisphereLight => c instanceof THREE.HemisphereLight) ?? null;
    this.sun = scene.children.find((c): c is THREE.DirectionalLight => c instanceof THREE.DirectionalLight) ?? null;
    const fog = scene.fog as THREE.Fog;
    this.lit = { hemisphere: this.hemisphere?.intensity ?? 1, sun: this.sun?.intensity ?? 1, sky: (scene.background as THREE.Color).clone(), fog: fog.color.clone(), near: fog.near, far: fog.far };

    // Everything that glows of itself in the hall, a sign's face among its sides as well; what is also used outside it
    // given its own copy in here.
    const p = new THREE.Vector3();
    const basic = (m: THREE.Material | THREE.Material[]) => (Array.isArray(m) ? m : [m]).filter((x): x is THREE.MeshBasicMaterial => x instanceof THREE.MeshBasicMaterial);
    const inside: THREE.Mesh[] = [], outside = new Set<THREE.Material>();
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || !basic(o.material).length) return;
      o.getWorldPosition(p);
      if (this.within(p.x, p.z, 0)) inside.push(o);
      else for (const m of basic(o.material)) outside.add(m);
    });
    const own = new Map<THREE.MeshBasicMaterial, THREE.MeshBasicMaterial>();
    const ours = (m: THREE.Material) => {
      if (!(m instanceof THREE.MeshBasicMaterial)) return m;
      if (!outside.has(m)) return m;
      let copy = own.get(m);
      if (!copy) own.set(m, (copy = m.clone()));
      return copy;
    };
    const seen = new Set<THREE.MeshBasicMaterial>();
    for (const mesh of inside) {
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(ours) : ours(mesh.material);
      for (const m of basic(mesh.material)) if (!seen.has(m)) {
        seen.add(m);
        this.glowing.push({ material: m, color: m.color.clone() });
      }
    }

    // The headlights, on the truck's front, aimed down the way a little.
    this.lenses = new THREE.MeshBasicMaterial({ color: 0x3a3a36 });
    for (const side of [-1, 1]) {
      const [x, y, z] = BEAM.at;
      const beam = new THREE.SpotLight(0xfff1d6, 0, BEAM.reach, BEAM.angle, BEAM.penumbra, BEAM.decay);
      beam.position.set(side * x, y, z);
      beam.target.position.set(side * 0.4, -0.6, z + 14);
      truck.add(beam, beam.target);
      this.beams.push(beam);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), this.lenses);
      lens.position.set(side * x, y, z + 0.06);
      truck.add(lens);
    }
    // The beams in the air: a cone from each lamp, brightest at it, gone by its far end; aimed as the lamp is.
    this.shafts = new THREE.MeshBasicMaterial({ map: fadeTexture(), color: 0xfff1d6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (const side of [-1, 1]) {
      const [x, y, z] = BEAM.at;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(SHAFT.wide, SHAFT.long, 20, 1, true).translate(0, -SHAFT.long / 2, 0).rotateX(-Math.PI / 2), this.shafts);
      cone.position.set(side * x, y, z + 0.1);
      cone.rotation.set(Math.atan2(0.95, 14), Math.atan2(-side * (x - 0.4), 14), 0);
      cone.renderOrder = 2;
      truck.add(cone);
    }
    // The work light behind the cab: down over the load, behind it, reaching no further than its sides.
    this.work = new THREE.SpotLight(0xfff4e0, 0, WORK.reach, WORK.angle, 0.6, WORK.decay);
    this.work.position.set(...WORK.at);
    this.work.target.position.set(0, 0.4, -2.6);
    truck.add(this.work, this.work.target);
    // The headlamp's light, and its beam in the air, put where the lamp is each frame.
    this.torch = new THREE.SpotLight(0xfff1d6, 0, TORCH.reach, TORCH.angle, TORCH.penumbra, TORCH.decay);
    scene.add(this.torch, this.torch.target);
    const shaft = new THREE.MeshBasicMaterial({ map: fadeTexture(0.25), color: 0xfff1d6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.torchShaft = new THREE.Mesh(new THREE.ConeGeometry(TORCH_SHAFT.wide, TORCH_SHAFT.long, 16, 1, true).translate(0, -TORCH_SHAFT.long / 2, 0).rotateX(-Math.PI / 2), shaft);
    this.torchShaft.renderOrder = 2;
    scene.add(this.torchShaft);
    // At each door out, its shutter part down, the daylight: seen from in the dark, the fog not over it.
    for (const { pos, rotY, wide, high } of desc.daylight) {
      const light = new THREE.MeshBasicMaterial({ color: 0x9aa6b0, transparent: true, opacity: 0, fog: false, depthWrite: false });
      const door = new THREE.Mesh(new THREE.PlaneGeometry(wide, high).translate(0, high / 2, 0), light);
      door.position.set(...pos);
      door.rotation.y = rotY;
      scene.add(door);
      // And spilling in across the floor, fading.
      const spill = new THREE.MeshBasicMaterial({ map: fadeTexture(), color: 0x9aa4aa, transparent: true, opacity: 0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(wide, 9).rotateX(-Math.PI / 2).translate(0, 0.03, 4.5), spill);
      floor.position.set(...pos);
      floor.rotation.y = rotY;
      scene.add(floor);
      this.daylight.push(light, spill);
    }

    // The emergency lights: a white box on a rod from the roof, two lamp heads; lit, they are off.
    this.heads = new THREE.MeshBasicMaterial({ color: 0x8c8c88 });
    const body = new THREE.MeshStandardMaterial({ color: 0xe8e8e2 }), rod = new THREE.MeshStandardMaterial({ color: 0x55585e });
    const ledOn = new THREE.MeshBasicMaterial({ color: 0x40ff60 });
    for (const { pos, rotY } of desc.emergency) {
      const unit = new THREE.Group();
      unit.position.set(...pos);
      unit.rotation.y = rotY;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.12), body);
      const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4).translate(0, 0.5, 0), rod);
      hang.position.y = 0.08;
      hang.scale.y = Math.max(0.1, 4.5 - pos[1] - 0.08);
      unit.add(box, hang);
      for (const side of [-1, 1]) {
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), this.heads);
        head.position.set(side * 0.15, -0.1, 0.06);
        unit.add(head);
      }
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), ledOn);
      led.position.set(0, 0, 0.065);
      unit.add(led);
      unit.add(this.halo(0xfff8ec, 0.9, [0, -0.1, 0.1]));
      scene.add(unit);
    }

    // The exit signs, hung over the aisles, green, a running man and its arrow, alight whether the power is on or off.
    const faces = new Map<number, THREE.MeshBasicMaterial>();
    // Drawn with what is see-through, after the glow behind and round it: a glow turned to the camera cuts through the sign
    // when it is seen at an angle, and on the part of its face in front of that cut would lie over it, lighter.
    const edge = new THREE.MeshStandardMaterial({ color: 0xe8e8e2, transparent: true });
    for (const { pos, rotY, arrow } of desc.exits) {
      let face = faces.get(arrow);
      if (!face) faces.set(arrow, (face = new THREE.MeshBasicMaterial({ map: exitTexture(arrow), transparent: true })));
      // Big enough to be read down the aisle in the dark from behind the lorry.
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.54, 0.08), [edge, edge, edge, edge, face, edge]);
      sign.position.set(...pos);
      sign.rotation.y = rotY;
      sign.renderOrder = 1;
      // Wide and strong: the sign itself covers its middle, and from behind the lorry only what shows round it reads as light.
      sign.add(this.halo(0x30e070, 3.6, [0, 0, 0.1], 0.85));
      const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 4.5 - pos[1] - 0.27, 4), rod);
      hang.position.set(pos[0], (4.5 + pos[1] + 0.27) / 2, pos[2]);
      scene.add(sign, hang);
    }
  }

  /** A soft glow, so big, round something alight: seen only in the dark. */
  private halo(color: number, size: number, at: [number, number, number], strength = 0.55): THREE.Sprite {
    const material = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.halos.push({ material, strength });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(size, size * 0.6, 1);
    sprite.position.set(...at);
    return sprite;
  }

  private within(x: number, z: number, margin: number, y = -Infinity): boolean {
    const [x0, z0, x1, z1] = this.desc.area;
    return x > x0 - margin && x < x1 + margin && z > z0 - margin && z < z1 + margin && y < (this.desc.below ?? Infinity);
  }

  /** Each frame, by where what is followed is: the truck, or the driver on foot; and then, on foot, the lamp they wear. */
  update(dt: number, focus: THREE.Vector3, lamp: THREE.Object3D | null): void {
    const inside = this.within(focus.x, focus.z, 0.5, focus.y);
    if (!inside) this.out = false;
    else if (!this.out && focus.z > this.desc.from) {
      this.out = true;
      this.since = 0;
    }
    let want = 0;
    if (this.out) {
      this.since += dt;
      const n = FLICKER.findIndex((t) => t > this.since);
      // Off at each odd step, on at each even one; off for good after the last.
      want = n < 0 ? 1 : n % 2 ? 1 : 0;
    }
    // Back out of the door the daylight comes back over a moment; in the flicker, at once.
    this.dark = this.out ? want : Math.max(0, this.dark - dt * 1.5);
    const k = this.dark;
    if (k === 0 && !this.out) {
      // Lit: what it is when lit, as the picture's settings may have changed it.
      const fog = this.scene.fog as THREE.Fog;
      this.lit.near = fog.near;
      this.lit.far = fog.far;
    }
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.lit.fog).lerp(DARK, k);
    fog.near = this.lit.near + (DARK_FOG[0] - this.lit.near) * k;
    fog.far = this.lit.far + (DARK_FOG[1] - this.lit.far) * k;
    (this.scene.background as THREE.Color).copy(this.lit.sky).lerp(DARK, k);
    if (this.hemisphere) this.hemisphere.intensity = this.lit.hemisphere * (1 - k * (1 - LEFT));
    if (this.sun) this.sun.intensity = this.lit.sun * (1 - k * (1 - LEFT));
    for (const { material, color } of this.glowing) material.color.copy(color).multiplyScalar(1 - k * 0.94);
    // The headlights on once it has gone; the emergency lights with them.
    const on = this.out ? 1 : k;
    for (const beam of this.beams) beam.intensity = BEAM.intensity * on;
    this.lenses.color.setHex(on > 0.5 ? 0xfff6e0 : 0x3a3a36);
    this.heads.color.setHex(on > 0.5 ? 0xffffff : 0x8c8c88);
    this.work.intensity = WORK.intensity * on;
    this.shafts.opacity = SHAFT.opacity * on;
    for (const halo of this.halos) halo.material.opacity = halo.strength * k;
    // The headlamp, out of the truck in the dark; aimed down the way they face, a little down.
    const torch = lamp ? k : 0;
    this.torch.intensity = TORCH.intensity * torch;
    this.torchShaft.material.opacity = TORCH_SHAFT.opacity * torch;
    this.torchShaft.visible = torch > 0;
    if (lamp && torch > 0) {
      lamp.updateWorldMatrix(true, false);
      this.torch.position.set(...TORCH.at).applyMatrix4(lamp.matrixWorld);
      this.torch.target.position.set(...TORCH.on).applyMatrix4(lamp.matrixWorld);
      this.torch.target.updateMatrixWorld();
      this.torchShaft.position.copy(this.torch.position);
      this.torchShaft.lookAt(this.torch.target.position);
    }
    for (const day of this.daylight) day.opacity = (day.map ? 0.3 : DAYLIGHT) * k;
  }

  /** Whether it is under the hall's roof: no rain there. */
  under(focus: THREE.Vector3): boolean {
    return this.within(focus.x, focus.z, 0, focus.y);
  }
}

/**
 * Bright at one end and nothing at the other, along V: a beam fading as it goes, light fading across a floor. With `from`,
 * nothing at the very end either, coming up to its brightest that far along: a beam that starts at the eyes of whoever
 * watches it is not to be a white blade from their head.
 */
function fadeTexture(from = 0): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 128;
  const g = canvas.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 128);
  if (from) grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(from, 'rgba(255,255,255,1)');
  grad.addColorStop(from + (1 - from) * 0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(canvas);
}

let glow: THREE.Texture | null = null;
/** A soft round glow. */
function glowTexture(): THREE.Texture {
  if (glow) return glow;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return (glow = new THREE.CanvasTexture(canvas));
}

/** An exit sign's face: green, a white running man going through a door, and an arrow the way out. */
function exitTexture(arrow: -1 | 0 | 1): THREE.Texture {
  const W = 256, H = 102;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#17a24a';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#f4fff6';
  // The running man, by the door on the side the arrow points to; mirrored for the left.
  g.save();
  const flip = arrow < 0;
  if (flip) {
    g.translate(W, 0);
    g.scale(-1, 1);
  }
  g.fillRect(24, 18, 40, 66);
  g.fillStyle = '#17a24a';
  g.fillRect(30, 24, 28, 54);
  g.fillStyle = '#f4fff6';
  g.beginPath();
  g.arc(86, 26, 9, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.strokeStyle = '#f4fff6';
  const line = (pts: number[][]) => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) g.lineTo(x, y);
    g.stroke();
  };
  line([[82, 40], [74, 62]]);
  line([[74, 62], [88, 74], [84, 88]]);
  line([[74, 62], [62, 70], [54, 84]]);
  line([[80, 44], [94, 54], [102, 46]]);
  line([[80, 44], [66, 48], [60, 56]]);
  // The arrow.
  g.fillStyle = '#f4fff6';
  if (arrow !== 0) {
    g.beginPath();
    g.moveTo(232, 51);
    g.lineTo(196, 22);
    g.lineTo(196, 40);
    g.lineTo(126, 40);
    g.lineTo(126, 62);
    g.lineTo(196, 62);
    g.lineTo(196, 80);
    g.closePath();
    g.fill();
  }
  g.restore();
  if (arrow === 0) {
    // On ahead: an arrow pointing up.
    g.beginPath();
    g.moveTo(180, 12);
    g.lineTo(212, 46);
    g.lineTo(192, 46);
    g.lineTo(192, 90);
    g.lineTo(168, 90);
    g.lineTo(168, 46);
    g.lineTo(148, 46);
    g.closePath();
    g.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
