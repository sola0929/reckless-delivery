// How loud things are, as the player has set them. Kept in the browser between visits and
// shared by the menu and the game.

export interface SoundSettings {
  /** Effects: engine, crashes, clicks. 0 to 1. */
  sfx: number;
  /** Music. 0 to 1. */
  music: number;
  muted: boolean;
}

const KEY = 'cargo-sound';
const listeners: ((settings: SoundSettings) => void)[] = [];

function load(): SoundSettings {
  const settings: SoundSettings = { sfx: 0.8, music: 0.45, muted: false };
  try {
    Object.assign(settings, JSON.parse(localStorage.getItem(KEY) ?? '{}'));
  } catch {
    // Nothing saved, or nothing readable: the defaults will do.
  }
  return settings;
}

const current = load();

export const soundSettings = {
  get(): SoundSettings {
    return current;
  },
  set(change: Partial<SoundSettings>): void {
    Object.assign(current, change);
    try {
      localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      // It still applies for this visit.
    }
    for (const listener of listeners) listener(current);
  },
  /** Call `listener` now, and again whenever anything changes. */
  watch(listener: (settings: SoundSettings) => void): void {
    listeners.push(listener);
    listener(current);
  },
};
