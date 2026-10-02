import type { LevelDef } from './levels/types';
import type { Result } from './sim/sim';

// What the customer has to say when the truck turns up, or doesn't: a line chosen by how
// much of the load's worth arrived and how long it took.

const pick = (lines: string[]): string => lines[Math.floor(Math.random() * lines.length)];

const FAILED: Record<NonNullable<Result['failure']>, string[]> = {
  overturned: ['貨車表演了一個漂亮的側翻，可惜評審不給分。', '四輪朝天也是一種停車方式，只是客人不接受。', '新增服務項目：貨到，車倒。'],
  pit: ['恭喜你發現了工地的隱藏地下室。', '貨物已送達地心，運費另計。', '導航說直走，但沒說下面有洞。'],
  water: ['貨物正在河底等你，魚群表示感謝。', '這趟改走水路，可惜貨車不會游泳。', '客人問貨在哪，你指了指河面上的泡泡。'],
};

/** A line for the end of a run. */
export function verdict(result: Result, level: LevelDef): string {
  if (result.failure) return pick(FAILED[result.failure]);
  const { destroyed, lost } = result.tally;
  /** How much of the load's worth arrived: the same figure the stars go by. */
  const kept = result.fraction;
  /** How long it took beside the time allowed: under 1 is inside it. */
  const pace = result.seconds / level.par;
  const fast = pace <= 0.7;
  const slow = pace > 1.25;

  // Every line below can be reached in ordinary play: none asks for a load without a mark on it, or for a truck with nothing at all left.
  if (kept < 0.1) return pick(['你準時送來了一台幾乎全空的車，客人陷入沉思。', '車斗裡只剩下空氣，而且空氣也有點受損。', '貨呢？「在路上。」哪條路？「每一條。」']);
  if (pace > 2) return pick(['慢到連路邊的行道樹都長高了一點。', '客人已經搬家了，新地址在下一關。', '這不是快遞，這是考古。']);
  if (kept >= 0.9) {
    if (fast) return pick(['又快又穩，客人懷疑你是不是偷換了一台車。', '幾乎一件沒少，還提早到。你真的是這家公司的人嗎？']);
    if (slow) return pick(['幾乎一件沒少，只是客人已經等到睡著了。', '送得很完整。慢，但完整。客人的冰淇淋另當別論。']);
    return pick(['幾乎全數送達，胡鬧快遞創業以來的第一次。', '貨都到了，客人感動到想加小費，但我們不收。']);
  }
  if (kept >= 0.6) {
    if (fast) return pick(['風一樣的司機，貨物只受了一點驚嚇。', '快到貨物還來不及掉下去。']);
    if (slow) return pick(['幾乎都在，就是到的時候天都快黑了。', '穩紮穩打，慢到客人開始懷念舊的快遞公司。']);
    return pick(['專業水準，掉的那一點就當作過路費。', '大部分都到了，剩下的客人說「算了」。']);
  }
  if (kept >= 0.4) {
    if (fast) return pick(['你確實很快，貨物用飛的跟不上而已。', '時間抓得很準，貨物抓得不太準。']);
    if (slow) return pick(['又慢又掉貨，至少你很平均。', '路上花了很久，看來是在跟貨物道別。']);
    return pick(['送到了一半，剩下一半還在市區觀光。', '客人點了點數量，又點了一次，然後嘆了口氣。']);
  }
  if (kept >= 0.2) {
    if (lost > destroyed) return pick(['送到了一小部分，其餘的都捐給了這座城市。', '沿路掉的貨，足夠開一間二手店。']);
    return pick(['車上的東西還在，只是已經看不出原本是什麼。', '客人收到了一車拼圖，沒有附說明書。']);
  }
  return pick(['客人打開車斗，裡面只剩下回憶。', '這趟的收穫是：路很熟了。', '保證送達，不保證完整。我們做到了前半句。']);
}
