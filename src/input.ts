import { Pad, type PadButton } from './gamepad';
import type { DriveInput } from './sim/truck';

const HANDLED = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyC', 'KeyE', 'KeyH',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'Escape', 'KeyP',
  'Enter',
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',
]);

/** Keys whose presses are picked up once each, rather than read as held. */
export type PressKey = 'KeyR' | 'KeyC' | 'KeyE' | 'KeyH' | 'Space' | 'Escape' | 'KeyP' | 'Enter' | `Digit${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

/** Which controller button stands for each key that is pressed once. A (jump, handbrake) also closes the start banner. */
const PAD_PRESS: [PadButton, PressKey[]][] = [
  ['a', ['Space', 'Enter']], ['b', ['KeyE']], ['y', ['KeyC']], ['lb', ['KeyH']], ['back', ['KeyR']], ['start', ['Escape']],
];

export class Input {
  /** The controller, read each frame by poll(). */
  readonly pad = new Pad();
  /** Whether the controller was the last thing touched: the hints show its buttons, and aiming follows its stick, not the cursor. */
  usingPad = false;
  /** Presses of the controller since the last poll, as the keys they stand for. */
  private readonly padPressed = new Set<string>();
  private padCancel = false;
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private wheel = 0;
  /** Cursor position in the window, and whether the left mouse button is held. */
  mouseX = 0;
  mouseY = 0;
  mouseDown = false;
  private rightPressed = false;
  /** Whether the right mouse button is held, and how far the mouse has moved across since last asked while it was: for looking round. */
  rightDown = false;
  private lookDrag = 0;

  constructor(target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (!HANDLED.has(e.code)) return;
      // Enter is left to do its usual work as well: on a focused button, it presses it.
      if (e.code !== 'Enter') e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.usingPad = false;
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouseDown = false;
      this.rightDown = false;
    });
    target.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheel += e.deltaY;
    }, { passive: false });

    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (this.rightDown) this.lookDrag += e.movementX;
      this.usingPad = false;
    });
    target.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true;
      else if (e.button === 2) {
        this.rightPressed = true;
        this.rightDown = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      else if (e.button === 2) this.rightDown = false;
    });
    // The right button cancels a throw; it shouldn't also open the browser's menu.
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Read the controller; call once a frame, before anything else asks for input. */
  poll(): void {
    const pad = this.pad;
    pad.poll();
    this.padPressed.clear();
    this.padCancel = false;
    if (!pad.connected) return;
    for (const [button, codes] of PAD_PRESS) if (pad.wasPressed(button)) for (const code of codes) this.padPressed.add(code);
    if (pad.wasPressed('lt')) this.padCancel = true;
    const touched = this.padPressed.size > 0 || pad.leftX || pad.leftY || pad.rightX || pad.rightY || pad.lt || pad.rt || pad.isHeld('x');
    if (touched) this.usingPad = true;
  }

  private held(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  private axis(positive: string[], negative: string[]): number {
    return (this.held(...positive) ? 1 : 0) - (this.held(...negative) ? 1 : 0);
  }

  drive(): DriveInput {
    // Shift accelerates hard on its own, without W. The brake key overrides it.
    const pad = this.pad;
    // The keys win over the controller when both are used at once.
    const keyThrottle = this.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
    const keySteer = this.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
    const braking = keyThrottle < 0 || (keyThrottle === 0 && pad.lt > pad.rt);
    const boost = !braking && (this.held('ShiftLeft', 'ShiftRight') || pad.isHeld('x'));
    // The stick's right is the truck's right, which is negative steer; eased in, so small pushes steer finely.
    const padSteer = -Math.sign(pad.leftX) * pad.leftX * pad.leftX;
    return {
      throttle: boost ? 1 : keyThrottle || pad.rt - pad.lt,
      steer: keySteer || padSteer,
      handbrake: this.down.has('Space') || pad.isHeld('a'),
      boost,
    };
  }

  /** Walking controls on foot: up the screen and to the right of it, each -1 to 1, and whether running. */
  walk(): { forward: number; right: number; run: boolean } {
    const forward = this.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
    const right = this.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']);
    const keys = forward !== 0 || right !== 0;
    return {
      forward: keys ? forward : -this.pad.leftY,
      right: keys ? right : this.pad.leftX,
      run: this.held('ShiftLeft', 'ShiftRight') || this.pad.isHeld('x'),
    };
  }

  /** Aiming with the right stick, on foot: up it and to the right of the screen, or null when it is let go. */
  padAim(): { forward: number; right: number } | null {
    const { rightX, rightY } = this.pad;
    return rightX || rightY ? { forward: -rightY, right: rightX } : null;
  }

  /** Charging a throw: the left mouse button, or the right trigger. */
  charging(): boolean {
    return this.mouseDown || this.pad.rt > 0.5;
  }

  /** True once per press of a key. */
  take(code: PressKey): boolean {
    const key = this.pressed.delete(code);
    return this.padPressed.delete(code) || key;
  }

  /** Forget every press not yet acted on: whatever was pressed while paused shouldn't happen on resuming. */
  clearPresses(): void {
    this.pressed.clear();
    this.padPressed.clear();
    this.rightPressed = false;
    this.padCancel = false;
  }

  /** True once per click of the right mouse button. */
  takeRightClick(): boolean {
    const r = this.rightPressed || this.padCancel;
    this.rightPressed = false;
    this.padCancel = false;
    return r;
  }

  /** How far the mouse has been dragged across with the right button held since the last call, pixels. */
  takeLookDrag(): number {
    const d = this.lookDrag;
    this.lookDrag = 0;
    return d;
  }

  /** Scroll wheel movement since the last call. */
  takeWheel(withStick = true): number {
    // The right stick, up and down, zooms as the wheel does while driving.
    const { rightX, rightY } = this.pad;
    const w = this.wheel + (withStick && Math.abs(rightY) > Math.abs(rightX) ? rightY * 30 : 0);
    this.wheel = 0;
    return w;
  }
}
