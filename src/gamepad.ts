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

/**
 * Which maker's controller is plugged in, as far as its name tells: the buttons are where they are on either, but are
 * named differently. Anything not known as a PlayStation pad is taken for an Xbox one.
 */
export type PadKind = 'xbox' | 'ps';
// In development, ?pad=ps in the address names the buttons the PlayStation way without one plugged in.
const forced = import.meta.env.DEV ? (new URLSearchParams(location.search).get('pad') as PadKind | null) : null;
let kind: PadKind = forced ?? 'xbox';
export const padKind = (): PadKind => kind;
const kindOf = (id: string): PadKind => (/054c|playstation|dualshock|dualsense|wireless controller/i.test(id) ? 'ps' : 'xbox');

/** Each button's name on each maker's controller, by where it is. */
const NAMES: Record<PadKind, Record<string, string>> = {
  xbox: { A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', LT: 'LT', RT: 'RT', Start: 'Start', Back: 'View' },
  ps: { A: '✕', B: '○', X: '□', Y: '△', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', Start: 'Options', Back: 'Create' },
};

/** A button's name on the controller plugged in, from its Xbox name. */
export const padName = (xbox: string): string => NAMES[kind][xbox] ?? xbox;

/** Write the names of the controller's buttons into whatever is marked for one (data-pad, by its Xbox name) under a node. */
export function namePadKeys(root: ParentNode = document): void {
  for (const key of root.querySelectorAll<HTMLElement>('[data-pad]')) key.textContent = padName(key.dataset.pad!);
}

/** Text that names the controller's buttons the Xbox way, with the names of the one plugged in instead. */
export const padText = (text: string): string => text.replace(/\b(LB|RB|LT|RT|Start|A|B|X|Y)\b/g, (name) => padName(name));

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
  /** The controller as the browser gave it last, for its rumble. */
  private raw: Gamepad | null = null;
  /** Whether one was plugged in at the last poll: to tell when it goes. */
  private had = false;
  /** Set when the controller in use goes (flat, out of reach): taken once by whoever pauses for it. */
  lost = false;
  /** Whether any button was pressed at the last poll: for waking the sound, which a key or a click would otherwise. */
  anyPress = false;

  /** Read the controller as it is now. Presses not taken since the last poll are dropped. */
  poll(): void {
    this.pressed.clear();
    this.anyPress = false;
    const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p && p.connected && p.mapping === 'standard')
      ?? [...(navigator.getGamepads?.() ?? [])].find((p) => p && p.connected);
    this.connected = !!pad;
    if (this.had && !pad) this.lost = true;
    // Found already held (still down from the press that changed the page, or plugged in with it down): not a press.
    const fresh = !this.had;
    this.had = !!pad;
    this.raw = pad ?? null;
    if (pad && !forced) kind = kindOf(pad.id);
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
    if (fresh) {
      this.wasLeftX = this.leftX;
      this.wasLeftY = this.leftY;
    }
    const value = (i: number) => pad.buttons[i]?.value ?? 0;
    this.lt = value(PAD.lt) < TRIGGER_DEADZONE ? 0 : value(PAD.lt);
    this.rt = value(PAD.rt) < TRIGGER_DEADZONE ? 0 : value(PAD.rt);
    for (const name of Object.keys(PAD) as PadButton[]) {
      const down = pad.buttons[PAD[name]]?.pressed ?? false;
      if (down && !this.held.has(name) && !fresh) {
        this.pressed.add(name);
        this.anyPress = true;
      }
      if (down) this.held.add(name);
      else this.held.delete(name);
    }
  }

  /**
   * Shake it, as a knock is felt through the wheel: strength 0 to 1, for so many milliseconds. A stronger one cuts in on a
   * weaker one still going; a weaker one leaves it be. Nothing on a controller without it.
   */
  rumble(strength: number, ms: number): void {
    const actuator = (this.raw as (Gamepad & { vibrationActuator?: { playEffect?: (kind: string, p: object) => Promise<unknown> } }) | null)?.vibrationActuator;
    if (!actuator?.playEffect || strength <= 0.02) return;
    const now = performance.now();
    if (now < this.rumbleUntil && strength <= this.rumbling) return;
    this.rumbling = strength;
    this.rumbleUntil = now + ms;
    actuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: Math.min(1, strength), weakMagnitude: Math.min(1, strength * 0.7) }).catch(() => {});
  }
  private rumbling = 0;
  private rumbleUntil = 0;

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

  /** In a menu, a step up (-1) or down (+1) the list: from the d-pad, or a fresh push of the left stick. Left and right too, unless asked for alone. */
  takeStep(): number {
    const v = this.takeUpDown();
    return v || this.takeLeftRight();
  }

  takeUpDown(): number {
    const pushed = (now: number, was: number, sign: number) => sign * now > 0.6 && sign * was <= 0.6;
    if (this.take('down') || pushed(this.leftY, this.wasLeftY, 1)) return 1;
    if (this.take('up') || pushed(this.leftY, this.wasLeftY, -1)) return -1;
    return 0;
  }

  takeLeftRight(): number {
    const pushed = (now: number, was: number, sign: number) => sign * now > 0.6 && sign * was <= 0.6;
    if (this.take('right') || pushed(this.leftX, this.wasLeftX, 1)) return 1;
    if (this.take('left') || pushed(this.leftX, this.wasLeftX, -1)) return -1;
    return 0;
  }
}

/**
 * A menu with the controller, the moving about of it: up and down along its buttons and settings; left and right a
 * slider's value, the next of a row of choices, or else along the list as up and down do.
 */
export function padNavigate(pad: Pad, list: HTMLElement[]): void {
  stepFocus(list, pad.takeUpDown());
  const across = pad.takeLeftRight();
  const at = document.activeElement as HTMLElement | null;
  if (across && at instanceof HTMLInputElement && at.type === 'range') {
    at.value = String(Number(at.value) + across * 5);
    at.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (across && at?.parentElement?.classList.contains('segments')) {
    const row = [...at.parentElement.querySelectorAll<HTMLElement>('button')];
    const next = row[row.indexOf(at) + across];
    if (next) {
      next.click();
      next.focus({ focusVisible: true } as FocusOptions);
    }
  } else stepFocus(list, across);
}

/** Move the focus along a list of buttons by a step, from whichever has it now. */
export function stepFocus(list: HTMLElement[], step: number): void {
  if (!step || !list.length) return;
  const at = list.indexOf(document.activeElement as HTMLElement);
  const next = at < 0 ? (step > 0 ? 0 : list.length - 1) : (at + step + list.length) % list.length;
  // Marked as focused as a key's Tab would mark it: moved there by hand, it is to be seen.
  list[next].focus({ focusVisible: true } as FocusOptions);
}
