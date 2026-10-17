// What has been done on each level so far, kept in the browser between visits: the most
// stars, the most of the load delivered, and the quickest delivery. Each is the best of any
// run; they need not all be from the same one.

export interface Best {
  stars: number;
  /** The quickest delivery, seconds; null while every delivery has gone back to a save point on the way. */
  seconds: number | null;
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

import { STARS } from './levels/types';

const key = (levelId: string) => `cargo-best:${levelId}`;

/** The state of each level in a list: every level that is built is open from the start, whether or not the one before it is passed. */
export function levelStates(levels: readonly { id: string; ready: boolean }[]): LevelState[] {
  return levels.map(({ id, ready }) => (!ready ? 'soon' : loadBest(id) !== null ? 'done' : 'open'));
}

export function loadBest(levelId: string): Best | null {
  try {
    const raw = localStorage.getItem(key(levelId));
    if (!raw) return null;
    const best = JSON.parse(raw) as Best;
    // Kept from when the third star was for time: what was delivered decides the stars now, and never takes one away.
    return { ...best, stars: Math.max(best.stars, STARS.filter((share) => best.fraction >= share).length) };
  } catch {
    return null;
  }
}

/**
 * Take a finished run into the record: whichever of the most delivered and the quickest
 * time it has beaten. A run that failed, or delivered too little to pass, sets nothing.
 */
export function saveBest(levelId: string, result: { stars: number; seconds: number; fraction: number; failure?: string; retries?: number }): RecordsSet {
  const before = loadBest(levelId);
  if (result.failure || result.stars === 0) return { value: false, time: false, before };
  // A hair's difference is no record.
  const value = !before || result.fraction > before.fraction + 0.0005;
  // A run that went back to its save point is no time to beat: the clock was put back with it.
  const time = !result.retries && (before?.seconds == null || result.seconds < before.seconds - 0.05);
  const stars = Math.max(before?.stars ?? 0, result.stars);
  if (value || time || stars !== before?.stars) {
    try {
      localStorage.setItem(key(levelId), JSON.stringify({
        stars,
        seconds: time ? result.seconds : before?.seconds ?? null,
        fraction: value ? result.fraction : before!.fraction,
      }));
    } catch {
      // No storage, no record: the game goes on without one.
    }
  }
  return { value, time, before };
}
