import type { DriveInput } from './sim/truck';

const HANDLED = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyC', 'KeyE',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'Escape', 'KeyP',
]);

/** Keys whose presses are picked up once each, rather than read as held. */
export type PressKey = 'KeyR' | 'KeyC' | 'KeyE' | 'Space' | 'Escape' | 'KeyP';

export class Input {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private wheel = 0;
  /** Cursor position in the window, and whether the left mouse button is held. */
  mouseX = 0;
  mouseY = 0;
  mouseDown = false;
  private rightPressed = false;

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (!HANDLED.has(e.code)) return;
      e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouseDown = false;
    });
    target.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheel += e.deltaY;
    }, { passive: false });

    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    target.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true;
      else if (e.button === 2) this.rightPressed = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    // The right button cancels a throw; it shouldn't also open the browser's menu.
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private held(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  private axis(positive: string[], negative: string[]): number {
    return (this.held(...positive) ? 1 : 0) - (this.held(...negative) ? 1 : 0);
  }

  drive(): DriveInput {
    // Shift accelerates hard on its own, without W. The brake key overrides it.
    const braking = this.held('KeyS', 'ArrowDown');
    const boost = !braking && this.held('ShiftLeft', 'ShiftRight');
    return {
      throttle: boost ? 1 : this.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
      steer: this.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']),
      handbrake: this.down.has('Space'),
      boost,
    };
  }

  /** Walking controls on foot: up the screen and to the right of it, each -1 to 1, and whether running. */
  walk(): { forward: number; right: number; run: boolean } {
    return {
      forward: this.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
      right: this.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']),
      run: this.held('ShiftLeft', 'ShiftRight'),
    };
  }

  /** True once per press of a key. */
  take(code: PressKey): boolean {
    return this.pressed.delete(code);
  }

  /** Forget every press not yet acted on: whatever was pressed while paused shouldn't happen on resuming. */
  clearPresses(): void {
    this.pressed.clear();
    this.rightPressed = false;
  }

  /** True once per click of the right mouse button. */
  takeRightClick(): boolean {
    const r = this.rightPressed;
    this.rightPressed = false;
    return r;
  }

  /** Scroll wheel movement since the last call. */
  takeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }
}
