import { battlefield } from './battlefield';
import { bends } from './bends';
import { city } from './city';
import { hills } from './hills';
import { hillcity } from './hillcity';
import { hilltown } from './hilltown';
import { jiufen } from './jiufen';
import { steps } from './steps';
import { uptown } from './uptown';
import { tutorial } from './tutorial';
import { range } from './range';
import { reliefShow } from './reliefShow';
import { sandbox } from './sandbox';
import { slopes } from './slopes';
import { quarryLab } from './quarryLab';
import { quarry } from './quarry';
import type { LevelDef } from './types';

export const LEVELS: Record<string, () => LevelDef> = { city, hilltown, battlefield, sandbox, range, hills, steps, bends, relief: reliefShow, jiufen, hillcity, slopes, uptown, quarrylab: quarryLab, quarry, tutorial };

export const FIRST_LEVEL = 'hillcity';

/** Run from the dev server, not the published build: the proving grounds are shown only then. */
const DEV = !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;

export interface LevelEntry {
  id: string;
  name: string;
  /** What is written large on its card. */
  badge: string;
  note: string;
  /** Whether it has been built yet. One that hasn't is shown as coming. */
  ready: boolean;
  /** What the level page's preview shows: a caption to each picture, public/previews/<id>-<n>.jpg, made by dev/preview-picks.mjs. */
  previews?: string[];
  /** Its load, as the preview tells it: how many things, and their worth all told. */
  load?: [number, number];
}

/** The deliveries, in order; all of them can be played from the start. */
export const LEVEL_LIST: LevelEntry[] = [
  // Level 1 is the city on its hillside; the flat city it was first built as is kept only as what the others are made from.
  { id: 'hillcity', name: '城市配送', badge: '1', note: '穿過市區，把一車貨送到卸貨區', ready: true, previews: ['市場小路', '機車車陣', '平交道', '路邊辦桌'], load: [18, 4000] },
  { id: 'uptown', name: '山城快遞', badge: '2', note: '穿過山城：走樓梯、繞廟埕、衝上鋼捲大坡，再沿髮夾彎下山', ready: true, previews: ['走樓梯', '廟埕', '鋼捲大坡', '下山髮夾彎'], load: [19, 2500] },
  { id: 'quarry', name: '砂石場', badge: '3', note: '穿過砂石場、閃過堤道機具、渡河過便橋，衝上工地頂樓卸貨', ready: true, previews: ['裝料區落石', '堤道機具', '渡河', '工地頂樓'], load: [17, 3000] },
];

/** The tutorial: before the deliveries, never in the way of them. */
export const TUTORIAL: LevelEntry = { id: 'tutorial', name: '新手上路', badge: '新手', note: '學開車、看到火車煞車、加速飛越斷橋、下車撿貨，大約兩分鐘', ready: true, previews: ['油門與轉彎', '看到火車就煞車', '加速飛越斷橋', '下車撿貨'], load: [7, 1100] };

/** Places to drive about with nothing at stake. Always open, and they keep no record. */
export const FREE_PLAY: LevelEntry[] = !DEV ? [] : [
  { id: 'sandbox', name: '測試場', badge: '∞', note: '沒有目標，隨便開、隨便撞', ready: true },
  { id: 'quarrylab', name: '第三關試驗場', badge: '3?', note: '料堆、輸送帶落石、堤道機具、河床便橋、施工中大樓，按 1～6 跳到各站', ready: true },
  { id: 'slopes', name: '坡道試驗場', badge: '⟋', note: '大斜坡上閃車流和滾下來的瓦斯桶、鐵桶；再繞著高塔開上塔頂', ready: true },
  { id: 'city', name: '平地城市（舊版第一關）', badge: '平', note: '第一關搬上山坡以前的樣子：同樣的街道，沒有高低差', ready: true },
  { id: 'jiufen', name: '九份試作', badge: '九', note: '照真實九份的道路和地勢做的試作，還沒有設計難點', ready: true },
  { id: 'relief', name: '地形樣品集', badge: '⛰', note: '路堤、路塹、髮夾彎、峽谷和橋、階梯街、碼頭', ready: true },
  { id: 'bends', name: '山路樣品', badge: '∿', note: '不同坡度的上下坡，和靠山臨崖的彎路，看樣子用', ready: true },
  { id: 'steps', name: '階梯地形樣品', badge: '▤', note: '用格子畫的坡街、駁坎和懸崖路，看樣子用', ready: true },
  { id: 'hills', name: '地形試驗場', badge: '⛰', note: '有起伏的地面先在這裡試：連續起伏、凹路、山脊、髮夾彎、坡上的街、彈坑和壕溝', ready: true },
  { id: 'range', name: '戰場試驗場', badge: '⚑', note: '戰場的機制在這裡試：砲擊、交火、火箭筒、坦克、煙霧、地雷', ready: true },
];
