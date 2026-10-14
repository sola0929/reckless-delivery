// A game controller, read once a frame: the first one plugged in with the standard layout
// (an Xbox or PlayStation pad, as the browser maps it). Sticks and triggers as numbers,
// buttons as held or just pressed.

/** The standard layout's buttons by name. */
export const PAD = {
  a: 0, b: 1, x: 2, y: 3,
  lb: 4, rb: 5, lt: 6, rt: 7,
  back: 8, start: 9,
  up: 12, down: 13, left: 14, right: 15,
} as const;
export type PadButton = keyof typeof PAD;

/** How far a stick must be pushed before it counts, and how far a trigger pulled. */
const DEADZONE = 0.18;
const TRIGGER_DEADZONE = 0.05;

/** A stick axis with the middle cut out and the rest stretched back out to the full -1 to 1. */
const stick = (v: number) => (Math.abs(v) < DEADZONE ? 0 : (Math.sign(v) * (Math.abs(v) - DEADZONE)) / (1 - DEADZONE));

export class Pad {
  private held = new Set<PadButton>();
  private pressed = new Set<PadButton>();
  /** Left and right stick, -1 to 1: right and down are positive, as the browser gives them. */
  leftX = 0;
  leftY = 0;
  rightX = 0;
  rightY = 0;
  /** The triggers, 0 to 1. */
  lt = 0;
  rt = 0;
  connected = false;
  /** The left stick last frame, for treating a push of it like a press of the d-pad in menus. */
  private wasLeftY = 0;
  private wasLeftX = 0;

  /** Read the controller as it is now. Presses not taken since the last poll are dropped. */
  poll(): void {
    // Not yet tried with a real controller: only in development until it has been.
    if (!import.meta.env.DEV) return;
    this.pressed.clear();
    const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p && p.connected && p.mapping === 'standard')
      ?? [...(navigator.getGamepads?.() ?? [])].find((p) => p && p.connected);
    this.connected = !!pad;
    if (!pad) {
      this.held.clear();
      this.leftX = this.leftY = this.rightX = this.rightY = this.lt = this.rt = 0;
      return;
    }
    this.wasLeftX = this.leftX;
    this.wasLeftY = this.leftY;
    this.leftX = stick(pad.axes[0] ?? 0);
    this.leftY = stick(pad.axes[1] ?? 0);
    this.rightX = stick(pad.axes[2] ?? 0);
    this.rightY = stick(pad.axes[3] ?? 0);
    const value = (i: number) => pad.buttons[i]?.value ?? 0;
    this.lt = value(PAD.lt) < TRIGGER_DEADZONE ? 0 : value(PAD.lt);
    this.rt = value(PAD.rt) < TRIGGER_DEADZONE ? 0 : value(PAD.rt);
    for (const name of Object.keys(PAD) as PadButton[]) {
      const down = pad.buttons[PAD[name]]?.pressed ?? false;
      if (down && !this.held.has(name)) this.pressed.add(name);
      if (down) this.held.add(name);
      else this.held.delete(name);
    }
  }

  isHeld(name: PadButton): boolean {
    return this.held.has(name);
  }

  /** Whether it was pressed since the last poll, leaving the press to be taken still. */
  wasPressed(name: PadButton): boolean {
    return this.pressed.has(name);
  }

  /** True once per press, until the next poll. */
  take(name: PadButton): boolean {
    return this.pressed.delete(name);
  }

  /** In a menu, a step up (-1) or down (+1) the list: from the d-pad, or a fresh push of the left stick. */
  takeStep(): number {
    const pushed = (now: number, was: number, sign: number) => sign * now > 0.6 && sign * was <= 0.6;
    if (this.take('down') || this.take('right') || pushed(this.leftY, this.wasLeftY, 1) || pushed(this.leftX, this.wasLeftX, 1)) return 1;
    if (this.take('up') || this.take('left') || pushed(this.leftY, this.wasLeftY, -1) || pushed(this.leftX, this.wasLeftX, -1)) return -1;
    return 0;
  }
}

/** Move the focus along a list of buttons by a step, from whichever has it now. */
export function stepFocus(list: HTMLElement[], step: number): void {
  if (!step || !list.length) return;
  const at = list.indexOf(document.activeElement as HTMLElement);
  const next = at < 0 ? (step > 0 ? 0 : list.length - 1) : (at + step + list.length) % list.length;
  list[next].focus();
}
