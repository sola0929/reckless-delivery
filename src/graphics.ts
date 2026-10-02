import * as THREE from 'three';
import { QUALITIES, QUALITY_KEY, loadChoice, type Quality, type QualityChoice } from './graphics-choice';
import type { View } from './render/scene';

// How much the picture is asked to cost. On a weak graphics chip the whole game stutters at
// full quality: almost all of that is the number of pixels drawn and the shadows, so those
// are what is given up. Left on automatic, the game watches its own frame rate and steps
// down by itself when it cannot keep up.

export type { Quality, QualityChoice } from './graphics-choice';

const KEY = QUALITY_KEY;
const ORDER = QUALITIES;

const LEVELS: Record<Quality, { pixels: number; shadow: number; far: number; fog: [number, number] }> = {
  // Pixels: the most device pixels drawn per CSS pixel. Shadow: the size of the shadow map, 0 for none.
  high: { pixels: 2, shadow: 2048, far: 400, fog: [90, 260] },
  medium: { pixels: 1, shadow: 1024, far: 300, fog: [80, 230] },
  low: { pixels: 0.75, shadow: 0, far: 240, fog: [70, 190] },
};

/** Slower than this, frames a second, over a few seconds, and automatic steps down. */
const TOO_SLOW = 40;
const WINDOW_SECONDS = 3;
/** Nothing is judged this soon after starting, or after a change: everything is still loading. */
const SETTLE_SECONDS = 4;

export class Graphics {
  choice = loadChoice();
  /** What is in force at the moment. */
  quality: Quality;
  /** Called when automatic has stepped the quality down. */
  onStepDown: ((quality: Quality) => void) | null = null;
  private frames = 0;
  private seconds = 0;
  private settle = SETTLE_SECONDS;

  constructor(private readonly view: View) {
    // On automatic, start from whatever it had come down to last time rather than climbing the same hill again.
    this.quality = this.choice === 'auto' ? this.remembered() : this.choice;
    this.apply();
    window.addEventListener('resize', () => this.apply());
  }

  choose(choice: QualityChoice): void {
    this.choice = choice;
    this.quality = choice === 'auto' ? 'high' : choice;
    this.save();
    this.apply();
  }

  /** Call every frame that is drawn, with how long it took. */
  frame(dt: number): void {
    if (this.settle > 0) {
      this.settle -= dt;
      return;
    }
    this.frames++;
    this.seconds += dt;
    if (this.seconds < WINDOW_SECONDS) return;
    const rate = this.frames / this.seconds;
    this.frames = this.seconds = 0;
    const at = ORDER.indexOf(this.quality);
    if (this.choice !== 'auto' || rate >= TOO_SLOW || at === ORDER.length - 1) return;
    this.quality = ORDER[at + 1];
    this.save();
    this.apply();
    this.onStepDown?.(this.quality);
  }

  /** Nothing drawn for a while, as when paused: don't count the gap as a slow frame. */
  rest(): void {
    this.frames = this.seconds = 0;
  }

  private remembered(): Quality {
    try {
      const saved = localStorage.getItem(`${KEY}-auto`);
      if (ORDER.includes(saved as Quality)) return saved as Quality;
    } catch {
      // Start from the top.
    }
    return 'high';
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, this.choice);
      if (this.choice === 'auto') localStorage.setItem(`${KEY}-auto`, this.quality);
    } catch {
      // It still applies for this visit.
    }
  }

  private apply(): void {
    const { renderer, camera, scene, sun } = this.view;
    const level = LEVELS[this.quality];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, level.pixels));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.far = level.far;
    camera.updateProjectionMatrix();
    if (scene.fog instanceof THREE.Fog) [scene.fog.near, scene.fog.far] = level.fog;
    sun.castShadow = level.shadow > 0;
    if (level.shadow > 0 && sun.shadow.mapSize.x !== level.shadow) {
      sun.shadow.mapSize.set(level.shadow, level.shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    this.settle = SETTLE_SECONDS;
    this.rest();
  }
}
