// The best run of each level so far, kept in the browser between visits.

export interface Best {
  stars: number;
  seconds: number;
  /** Share of the load's value delivered, 0 to 1. */
  fraction: number;
}

const key = (levelId: string) => `cargo-best:${levelId}`;

export function loadBest(levelId: string): Best | null {
  try {
    const raw = localStorage.getItem(key(levelId));
    return raw ? (JSON.parse(raw) as Best) : null;
  } catch {
    return null;
  }
}

/** Record a finished run if it beats what is on record: more stars, or as many in less time. */
export function saveBest(levelId: string, result: { stars: number; seconds: number; fraction: number; failure?: string }): void {
  if (result.failure || result.stars === 0) return;
  const old = loadBest(levelId);
  if (old && (old.stars > result.stars || (old.stars === result.stars && old.seconds <= result.seconds))) return;
  try {
    localStorage.setItem(key(levelId), JSON.stringify({ stars: result.stars, seconds: result.seconds, fraction: result.fraction }));
  } catch {
    // No storage, no record: the game goes on without one.
  }
}
