import { city } from './city';
import { range } from './range';
import { sandbox } from './sandbox';
import type { LevelDef } from './types';

export const LEVELS: Record<string, () => LevelDef> = { city, sandbox, range };

export const FIRST_LEVEL = 'city';

export interface LevelEntry {
  id: string;
  name: string;
  /** What is written large on its card. */
  badge: string;
  note: string;
  /** Whether it has been built yet. One that hasn't is shown as coming. */
  ready: boolean;
}

/** The deliveries, in the order they are unlocked: each one opens when the one before it has been passed. */
export const LEVEL_LIST: LevelEntry[] = [
  { id: 'city', name: '城市配送', badge: '1', note: '穿過市區，把一車貨送到卸貨區', ready: true },
  { id: 'forest', name: '森林小徑', badge: '2', note: '顛簸的林道，貨物坐不住', ready: false },
  { id: 'mountain', name: '山路', badge: '3', note: '又窄又彎，旁邊就是山谷', ready: false },
  { id: 'ice', name: '冰原', badge: '4', note: '路面結冰，煞車要提早', ready: false },
];

/** Places to drive about with nothing at stake. Always open, and they keep no record. */
export const FREE_PLAY: LevelEntry[] = [
  { id: 'sandbox', name: '測試場', badge: '∞', note: '沒有目標，隨便開、隨便撞', ready: true },
  { id: 'range', name: '戰場試驗場', badge: '⚑', note: '第二關的機制先在這裡試：砲擊、交火、火箭筒、坦克、煙霧、地雷', ready: true },
];
