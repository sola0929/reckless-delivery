// What the player has asked of the picture, kept in the browser between visits. Apart from
// the rest of the graphics so that the main menu can read and set it without the game loaded.

export type Quality = 'high' | 'medium' | 'low';
export type QualityChoice = Quality | 'auto';

export const QUALITY_KEY = 'cargo-graphics';
export const QUALITIES: Quality[] = ['high', 'medium', 'low'];

export function loadChoice(): QualityChoice {
  try {
    const saved = localStorage.getItem(QUALITY_KEY);
    if (saved === 'auto' || QUALITIES.includes(saved as Quality)) return saved as QualityChoice;
  } catch {
    // Nothing saved, or nothing readable.
  }
  return 'auto';
}

/** Set it from outside the game. Going back to automatic starts it from the top again. */
export function saveChoice(choice: QualityChoice): void {
  try {
    localStorage.setItem(QUALITY_KEY, choice);
    if (choice === 'auto') localStorage.removeItem(`${QUALITY_KEY}-auto`);
  } catch {
    // It can still be set in the game.
  }
}
