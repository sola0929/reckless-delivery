import * as THREE from 'three';

// One sheet holding every shop sign in the city, so that a whole building, signs and all,
// can be drawn with a single material.

/** A rectangle of the sheet, as texture coordinates: left, bottom, right, top. */
export type UV = readonly [number, number, number, number];

/** What kind of front a shop keeps: it decides what is seen behind the pillars. */
export type Front = 'eatery' | 'drinks' | 'grocer' | 'workshop' | 'glass' | 'plain';

/** One line of business: its name as hung out over the pavement, and in full across the shop. */
export interface Trade {
  blade: string;
  shop: string;
  front: Front;
}

const trades = (front: Front, ...names: [string, string][]): Trade[] => names.map(([blade, shop]) => ({ blade, shop, front }));

export const TRADES: Trade[] = [
  ...trades('eatery',
    ['牛肉麵', '阿明牛肉麵'], ['滷肉飯', '阿嬤滷肉飯'], ['鍋貼水餃', '三代鍋貼水餃'], ['便當', '現炒便當'], ['自助餐', '天天自助餐'], ['早餐店', '幸福早餐店'],
    ['豆漿燒餅', '老街豆漿燒餅'], ['快炒', '鐵牛快炒'], ['鹹酥雞', '大胖鹹酥雞'], ['火鍋', '暖暖火鍋'], ['素食', '家家素食']),
  ...trades('drinks', ['珍珠奶茶', '茶香珍珠奶茶'], ['冰果室', '老街冰果室'], ['檳榔', '雙星檳榔']),
  ...trades('grocer', ['水果行', '新鮮水果行'], ['中藥行', '平安中藥行'], ['茶行', '山上茶行'], ['五金行', '永興五金行'], ['花店', '小花園花店']),
  ...trades('workshop', ['機車行', '老王機車行'], ['輪胎行', '忠孝輪胎行'], ['腳踏車', '風速腳踏車'], ['機車出租', '環島機車出租']),
  ...trades('glass',
    ['眼鏡', '明亮眼鏡'], ['銀樓', '金榮銀樓'], ['麵包店', '麥香麵包店'], ['書局', '文具書局'], ['通訊行', '好運通訊行'], ['美髮', '美美髮廊'], ['藥局', '好鄰居藥局'],
    ['電器行', '光明電器行'], ['洗衣店', '快樂洗衣店'], ['彩券行', '發財彩券行'], ['鎖匙刻印', '阿福鎖匙刻印'], ['咖啡', '街角咖啡']),
  ...trades('plain',
    ['牙醫診所', '安心牙醫診所'], ['補習班', '小太陽補習班'], ['旅社', '港都旅社'], ['當鋪', '誠信當鋪'], ['卡拉OK', '歡唱卡拉OK'], ['修改衣服', '巧手修改衣服'], ['停車場', '站前停車場']),
];

/** Signs over the doors of warehouses, and one over the door of a temple. */
const DEPOTS = ['永順貨運', '大發倉儲', '信義物流', '宏昌鐵工廠', '海港冷凍', '福星紙器'];
const TEMPLE = '福德宮';

/** Long signs, for places that take up more than one house: the names it may carry, then ground, lettering, and a stripe along the edges. */
const WIDE = {
  mart: [['好鄰便利商店'], '#f4f1e6', '#2f62a8', '#f2c12e'],
  bank: [['山海銀行'], '#1f4f3f', '#e8c66a', ''],
  market: [['大豐超市'], '#c8372d', '#fff6e0', '#f2c12e'],
  clinic: [['仁愛診所'], '#f4f1e6', '#1f6f4a', '#2f8f5a'],
  telecom: [['城市電信'], '#2f62a8', '#ffffff', ''],
  store: [['太陽百貨', '星辰百貨'], '#8a2f6a', '#fff6e0', '#e8c66a'],
  hotel: [['金龍大飯店', '海灣大飯店', '明月大飯店'], '#23262b', '#e8c66a', ''],
  office: [['宏遠商業大樓', '世紀金融中心', '聯合商務大樓'], '#4a4f58', '#f0ece2', ''],
} as const;
export type WideSign = keyof typeof WIDE;

/** Hoardings and posters: a name, and a line under it. */
const BOARDS: [string, string][] = [
  ['好宅建設', '熱銷中'], ['平安人壽', '守護全家'], ['山海銀行', '安心存款'], ['鮮奶茶', '新上市'], ['城市電信', '飆速上網'],
  ['貨運到府', '快又穩'], ['高山茶', '產地直送'], ['週年慶', '全館八折'], ['新品上市', '限時優惠'], ['太陽百貨', '歡迎光臨'],
];

/** Ground and lettering. */
const SCHEMES: [string, string][] = [
  ['#c8372d', '#fff6e0'], ['#f2c12e', '#b3261e'], ['#f4f1e6', '#c8372d'], ['#2f8f5a', '#ffffff'], ['#2f62a8', '#ffffff'],
  ['#23262b', '#f2c12e'], ['#e07a28', '#ffffff'], ['#f4f1e6', '#2f62a8'], ['#7a3fa0', '#ffffff'], ['#f4f1e6', '#1f6f4a'],
];

const SIZE = 2048;
const GAP = 6;
const FONT = '"Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif';

type Box = [x: number, y: number, w: number, h: number];

/** A grid of equal boxes, filled a row at a time. */
function grid(y: number, w: number, h: number, columns: number, count: number): Box[] {
  return Array.from({ length: count }, (_, i): Box => [GAP + (i % columns) * (w + GAP), y + Math.floor(i / columns) * (h + GAP), w, h]);
}

const WIDE_KEYS = Object.keys(WIDE) as WideSign[];
const BLADE_BOXES = grid(GAP, 80, 320, 23, TRADES.length);
const SHOP_BOXES = grid(664, 320, 80, 6, TRADES.length + DEPOTS.length + 1);
/** Every long sign there is: which kind, and which of that kind's names. */
const WIDE_LIST = WIDE_KEYS.flatMap((key) => WIDE[key][0].map((name) => ({ key, name })));
const WIDE_BOXES = grid(1444, 480, 60, 4, WIDE_LIST.length);
const BOARD_BOXES = grid(1708, 320, 160, 5, BOARDS.length);
// Beside the boards: a stretch of ribbing, and a patch of plain white.
const RIB_PERIOD = 16;
const RIB_BOX: Box = [1650, 1708, 256, 64];
const BLANK_BOX: Box = [1650, 1800, 64, 64];

/** Inset a little, so that nothing of the neighbouring sign shows at the edges. */
function uvOf([x, y, w, h]: Box, inset = 1): UV {
  return [(x + inset) / SIZE, 1 - (y + h - inset) / SIZE, (x + w - inset) / SIZE, 1 - (y + inset) / SIZE];
}

const shopUVs = SHOP_BOXES.map((box) => uvOf(box));

export const SIGNS = {
  /** By trade: the sign hung out over the pavement. */
  blade: BLADE_BOXES.map((box) => uvOf(box)),
  /** By trade: the sign across the shop. */
  shop: shopUVs.slice(0, TRADES.length),
  depot: shopUVs.slice(TRADES.length, TRADES.length + DEPOTS.length),
  temple: shopUVs[TRADES.length + DEPOTS.length],
  /** By kind: one for each name there is of that kind. */
  wide: Object.fromEntries(WIDE_KEYS.map((key) => [key, WIDE_LIST.flatMap((sign, i) => (sign.key === key ? [uvOf(WIDE_BOXES[i])] : []))])) as Record<WideSign, UV[]>,
  /** The ground colour of each long sign, to carry on past its ends. */
  wideGround: Object.fromEntries(WIDE_KEYS.map((key) => [key, parseInt(WIDE[key][1].slice(1), 16)])) as Record<WideSign, number>,
  board: BOARD_BOXES.map((box) => uvOf(box)),
};

/** Plain white: what every face without a sign on it is given, so that only its own colour shows. */
export const BLANK: UV = (() => {
  const [x, y, w, h] = BLANK_BOX;
  const u = (x + w / 2) / SIZE;
  const v = 1 - (y + h / 2) / SIZE;
  return [u, v, u, v];
})();

/** Eight ribs of sheet metal side by side, running up the rectangle. */
export const RIBS: UV = (() => {
  const [x, y, w, h] = RIB_BOX;
  const left = x + w / 2 - RIB_PERIOD * 4;
  return [left / SIZE, 1 - (y + h * 0.6) / SIZE, (left + RIB_PERIOD * 8) / SIZE, 1 - (y + h * 0.4) / SIZE];
})();

function draw(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, SIZE, SIZE);
  g.textAlign = 'center';
  g.textBaseline = 'middle';

  const plate = ([x, y, w, h]: Box, ground: string, ink: string) => {
    // Run the colour out into the gap, so that it is its own colour that bleeds in at a distance.
    g.fillStyle = ground;
    g.fillRect(x - GAP / 2, y - GAP / 2, w + GAP, h + GAP);
    g.strokeStyle = ink;
    g.lineWidth = 3;
    g.strokeRect(x + 6, y + 6, w - 12, h - 12);
    g.fillStyle = ink;
  };
  /** A name spelt out across a box, one letter to each equal share of its width. */
  const across = (name: string, [x, y, w, h]: Box, margin: number, tallest: number) => {
    const letters = [...name];
    const cell = (w - margin * 2) / letters.length;
    g.font = `900 ${Math.min(tallest, cell * 0.94)}px ${FONT}`;
    letters.forEach((letter, k) => g.fillText(letter, x + margin + cell * (k + 0.5), y + h / 2 + 3));
  };

  TRADES.forEach(({ blade, shop }, i) => {
    // A shop's two signs are painted alike.
    const [ground, ink] = SCHEMES[(i * 7 + 3) % SCHEMES.length];
    const [x, y, w, h] = BLADE_BOXES[i];
    plate(BLADE_BOXES[i], ground, ink);
    const letters = [...blade];
    const cell = (h - 30) / letters.length;
    g.font = `900 ${Math.min(w * 0.72, cell * 0.92)}px ${FONT}`;
    letters.forEach((letter, k) => g.fillText(letter, x + w / 2, y + 15 + cell * (k + 0.5) + 2));
    plate(SHOP_BOXES[i], ground, ink);
    across(shop, SHOP_BOXES[i], 18, 80 * 0.66);
  });

  DEPOTS.forEach((name, i) => {
    const box = SHOP_BOXES[TRADES.length + i];
    plate(box, ...SCHEMES[(i * 3 + 1) % SCHEMES.length]);
    across(name, box, 18, 80 * 0.66);
  });
  const temple = SHOP_BOXES[TRADES.length + DEPOTS.length];
  plate(temple, '#8a1f1a', '#e8c66a');
  across(TEMPLE, temple, 50, 80 * 0.7);

  WIDE_LIST.forEach(({ key, name }, i) => {
    const [, ground, ink, stripe] = WIDE[key];
    const [x, y, w, h] = WIDE_BOXES[i];
    g.fillStyle = ground;
    g.fillRect(x - GAP / 2, y - GAP / 2, w + GAP, h + GAP);
    if (stripe) {
      g.fillStyle = stripe;
      g.fillRect(x - GAP / 2, y, w + GAP, 7);
      g.fillRect(x - GAP / 2, y + h - 7, w + GAP, 7);
    }
    g.fillStyle = ink;
    across(name, WIDE_BOXES[i], 64, h * 0.66);
  });

  BOARDS.forEach(([name, line], i) => {
    const [x, y, w, h] = BOARD_BOXES[i];
    const [ground, ink] = SCHEMES[(i * 7 + 2) % SCHEMES.length];
    plate(BOARD_BOXES[i], ground, ink);
    g.font = `900 ${Math.min(h * 0.44, ((w - 40) / name.length) * 0.95)}px ${FONT}`;
    g.fillText(name, x + w / 2, y + h * 0.36);
    // The second line in a band of the lettering's colour.
    g.fillRect(x + 16, y + h * 0.64, w - 32, h * 0.26);
    g.fillStyle = ground;
    g.font = `900 ${h * 0.19}px ${FONT}`;
    g.fillText(line, x + w / 2, y + h * 0.775);
  });

  // Ribbing: light along each crest, darker down in each trough.
  const [rx, ry, rw, rh] = RIB_BOX;
  for (let px = 0; px < rw; px += RIB_PERIOD) {
    g.fillStyle = '#ffffff';
    g.fillRect(rx + px, ry, RIB_PERIOD, rh);
    g.fillStyle = '#d6d6d6';
    g.fillRect(rx + px + 9, ry, 3, rh);
    g.fillStyle = '#b4b4b4';
    g.fillRect(rx + px + 12, ry, 4, rh);
  }
  return canvas;
}

let sheet: THREE.Texture | null = null;

/** The sheet itself, drawn the first time it is asked for. */
export function signSheet(): THREE.Texture {
  if (!sheet) {
    sheet = new THREE.CanvasTexture(draw());
    sheet.colorSpace = THREE.SRGBColorSpace;
    sheet.anisotropy = 8;
  }
  return sheet;
}
