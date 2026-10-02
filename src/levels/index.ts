import { city } from './city';
import { sandbox } from './sandbox';
import type { LevelDef } from './types';

export const LEVELS: Record<string, () => LevelDef> = { city, sandbox };

export const FIRST_LEVEL = 'city';

/** What the main menu offers, in order. */
export const LEVEL_LIST = [
  { id: 'city', name: '城市配送', badge: '1', note: '穿過市區，把一車貨送到卸貨區', scored: true },
  { id: 'sandbox', name: '測試場', badge: '∞', note: '沒有目標，隨便開、隨便撞', scored: false },
];
