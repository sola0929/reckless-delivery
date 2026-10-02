// What has been done on each level so far, kept in the browser between visits: the most
// stars, the most of the load delivered, and the quickest delivery. Each is the best of any
// run; they need not all be from the same one.

export interface Best {
  stars: number;
  /** The quickest delivery, seconds. */
  seconds: number;
  /** The largest share of the load's value delivered, 0 to 1. */
  fraction: number;
}

/** Which records a run set, and what stood before it. */
export interface RecordsSet {
  value: boolean;
  time: boolean;
  before: Best | null;
}

/** Where a level stands: not built yet, shut until the one before it is passed, open, or passed. */
export type LevelState = 'soon' | 'locked' | 'open' | 'done';

const key = (levelId: string) => `cargo-best:${levelId}`;

/** The state of each level in a list that is unlocked in order. */
export function levelStates(levels: readonly { id: string; ready: boolean }[]): LevelState[] {
  let opened = true;
  return levels.map(({ id, ready }) => {
    if (!ready) return 'soon';
    const passed = loadBest(id) !== null;
    const state: LevelState = passed ? 'done' : opened ? 'open' : 'locked';
    opened = passed;
    return state;
  });
}

export function loadBest(levelId: string): Best | null {
  try {
    const raw = localStorage.getItem(key(levelId));
    return raw ? (JSON.parse(raw) as Best) : null;
  } catch {
    return null;
  }
}

/**
 * Take a finished run into the record: whichever of the most delivered and the quickest
 * time it has beaten. A run that failed, or delivered too little to pass, sets nothing.
 */
export function saveBest(levelId: string, result: { stars: number; seconds: number; fraction: number; failure?: string }): RecordsSet {
  const before = loadBest(levelId);
  if (result.failure || result.stars === 0) return { value: false, time: false, before };
  // A hair's difference is no record.
  const value = !before || result.fraction > before.fraction + 0.0005;
  const time = !before || result.seconds < before.seconds - 0.05;
  const stars = Math.max(before?.stars ?? 0, result.stars);
  if (value || time || stars !== before?.stars) {
    try {
      localStorage.setItem(key(levelId), JSON.stringify({
        stars,
        seconds: time ? result.seconds : before!.seconds,
        fraction: value ? result.fraction : before!.fraction,
      }));
    } catch {
      // No storage, no record: the game goes on without one.
    }
  }
  return { value, time, before };
}
