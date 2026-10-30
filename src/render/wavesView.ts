import * as THREE from 'three';
import { WAVE_WARN, openStretches, sheltered, type WaveState } from '../sim/waves';

// Waves seen: each coming in out on the water for a few seconds before it breaks, a long dark ridge rising as it nears,
// white along its crest, a big one taller; then, once it has broken, a sheet of white water across the top as far in as
// its front has run, fading as it dies away. The spray where it breaks is the game's.

/** How far out a wave is first seen, metres from the edge; how high it stands as it reaches it, and the water's level. */
const OUT = 26;
const TALL = 1.6;
const BIG_TALL = 2.8;
const SEA = -3;

interface Seen {
  wave: WaveState;
  swell: THREE.Group;
  sheets: THREE.Mesh[];
  /** Over the low boardwalk among piles: each sheet, and how far in from the edge it starts. */
  washes: { sheet: THREE.Mesh; into: number }[];
  sheetMaterial: THREE.MeshBasicMaterial;
}

export class WavesView {
  private readonly seen: Seen[] = [];

  constructor(scene: THREE.Scene, waves: readonly WaveState[]) {
    for (const wave of waves) {
      const { from, to, inland } = wave.desc;
      const dx = to[0] - from[0], dz = to[1] - from[1];
      const long = Math.hypot(dx, dz);
      // Its own frame: X along the edge, Z inland.
      const turn = Math.atan2(-dz, dx);
      const flip = Math.sign(inland[0] * Math.sin(turn) + inland[1] * Math.cos(turn)) || 1;
      const frame = new THREE.Group();
      frame.position.set(from[0], 0, from[1]);
      frame.rotation.y = turn;
      frame.scale.z = flip;
      scene.add(frame);
      // The swell: a ridge of water the length of the edge, its back sloping off out to sea, foam on its crest.
      const swell = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(long, 1, 3), new THREE.MeshStandardMaterial({ color: 0x3c5a5c, roughness: 0.3, transparent: true, opacity: 0.92 }));
      body.position.set(long / 2, 0.5, -1.5);
      const back = new THREE.Mesh(new THREE.BoxGeometry(long, 1, 5), body.material);
      back.position.set(long / 2, 0.25, -5);
      back.scale.y = 0.5;
      const crest = new THREE.Mesh(new THREE.BoxGeometry(long, 0.18, 1.2), new THREE.MeshStandardMaterial({ color: 0xe8eef0, roughness: 0.8 }));
      crest.position.set(long / 2, 1, -0.4);
      swell.add(body, back, crest);
      swell.visible = false;
      frame.add(swell);
      // The sheet of white water over the top, from the edge in to its front.
      const sheetMaterial = new THREE.MeshBasicMaterial({ color: 0xdfe8ea, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      // Only where it comes over: none behind what shelters the top.
      const sheets = (wave.desc.piles ? [] : openStretches(wave.desc)).map(([a, b]) => {
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 1), sheetMaterial);
        sheet.rotation.x = -Math.PI / 2;
        sheet.position.set((a + b) / 2, (wave.desc.y ?? 0) + 0.06, 0.5);
        sheet.visible = false;
        frame.add(sheet);
        return sheet;
      });
      // Among piles: only over the boardwalk low enough for it, a sheet the size of each length of it.
      const washes = (wave.desc.wash ?? []).filter(({ pos }) => !sheltered(wave.desc, pos[0], pos[1])).map(({ pos, half, yaw }) => {
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(half[0] * 2 + 0.6, half[1] * 2), sheetMaterial);
        sheet.rotation.set(-Math.PI / 2, 0, yaw, 'YXZ');
        sheet.position.set(pos[0], (wave.desc.y ?? 0) + 0.08, pos[1]);
        sheet.visible = false;
        scene.add(sheet);
        const into = (pos[0] - from[0]) * inland[0] + (pos[1] - from[1]) * inland[1] - Math.abs(half[0] * Math.cos(yaw)) - Math.abs(half[1] * Math.sin(yaw));
        return { sheet, into };
      });
      this.seen.push({ wave, swell, sheets, washes, sheetMaterial });
    }
  }

  update(): void {
    for (const { wave, swell, sheets, washes, sheetMaterial } of this.seen) {
      // Coming in: out from the edge, rising, until it breaks.
      const coming = wave.until < WAVE_WARN;
      swell.visible = coming;
      if (coming) {
        const near = 1 - wave.until / WAVE_WARN;
        const tall = (wave.nextBig ? BIG_TALL : TALL) * (0.25 + 0.75 * near * near);
        swell.position.set(0, SEA, -OUT * (1 - near) - 0.5);
        swell.scale.y = tall;
      }
      // Run in over the top: as far as the front has gone, white while it still runs.
      const running = wave.strength > 0.02;
      for (const sheet of sheets) {
        sheet.visible = running;
        sheet.scale.y = Math.max(0.5, wave.front);
        sheet.position.z = wave.front / 2;
      }
      for (const { sheet, into } of washes) sheet.visible = running && wave.front > into;
      if (running) sheetMaterial.opacity = Math.min(0.75, 0.25 + wave.strength * 0.5);
    }
  }
}
