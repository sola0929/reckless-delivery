import { city } from './city';
import { sandbox } from './sandbox';
import type { LevelDef } from './types';

export const LEVELS: Record<string, () => LevelDef> = { city, sandbox };

export const FIRST_LEVEL = 'city';
