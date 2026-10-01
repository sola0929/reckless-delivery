import type { DriveInput } from './sim/truck';

const HANDLED = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight',
]);

export class Input {
  private readonly down = new Set<string>();
  private resetQueued = false;
  private wheel = 0;

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (!HANDLED.has(e.code)) return;
      e.preventDefault();
      if (e.code === 'KeyR' && !e.repeat) this.resetQueued = true;
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
    target.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheel += e.deltaY;
    }, { passive: false });
  }

  private axis(positive: string[], negative: string[]): number {
    const held = (codes: string[]) => (codes.some((c) => this.down.has(c)) ? 1 : 0);
    return held(positive) - held(negative);
  }

  drive(): DriveInput {
    // Shift accelerates hard on its own, without W. The brake key overrides it.
    const braking = this.down.has('KeyS') || this.down.has('ArrowDown');
    const boost = !braking && (this.down.has('ShiftLeft') || this.down.has('ShiftRight'));
    return {
      throttle: boost ? 1 : this.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
      steer: this.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']),
      handbrake: this.down.has('Space'),
      boost,
    };
  }

  /** True once per press of the reset key. */
  takeReset(): boolean {
    const r = this.resetQueued;
    this.resetQueued = false;
    return r;
  }

  /** Scroll wheel movement since the last call. */
  takeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }
}
