import type { ChatDesc, Talk } from './levels/types';

// What is written to the driver on the way: by the boss, whatever the load, and by the customer, about their own things.
// Who the customer is is never said; it is to be made out from what they write. The driver answers flat.

/** Things that happen on a run that someone has something to say about. */
export type ChatCue = 'start' | 'fallen' | 'destroyed' | 'below60' | 'below30' | 'train' | 'hits' | 'idle' | 'save' | 'back' | 'near' | 'found';

/** The boss: a different mood each time, shouting, counting the cost, uplifting, past caring, fired up. */
export const BOSS: Partial<Record<ChatCue, Talk[]>> = {
  start: [
    [['them', '今天這車很重要'], ['me', '上次價值只有100塊的單你也這麼說']],
    [['them', '出發了沒'], ['me', '出發了'], ['them', '記得我們的口號嗎'], ['me', '「保證送達」'], ['me', '「不保證完整」'], ['them', '並沒有後面那句']],
    [['them', '加油！你是公司最優秀的司機！'], ['me', '……那是因為公司只有我一個司機'], ['them', '所以最優秀啊']],
    [['them', '車我剛洗過'], ['me', '看得出來'], ['them', '回來的時候也要讓我看得出來']],
  ],
  fallen: [
    [['them', '欸 剛剛是不是有東西掉下去'], ['me', '有'], ['them', '……那你去撿啊！']],
    [['them', '我看到有件貨在路邊'], ['me', '那就當作提前送達'], ['them', '送到路邊不算送達']],
    [['them', '掉了就下車撿回來'], ['me', '撿回來有獎金嗎'], ['them', '沒撿回來有扣款']],
    [['them', '我算一下喔'], ['them', '剛掉那個，你這禮拜的薪水沒了'], ['me', '那我這個月還可以再掉3個']],
  ],
  destroyed: [
    [['them', '剛剛那聲是什麼'], ['me', '貨'], ['them', '貨怎麼會發出那種聲音'], ['them', '……我在目的地等你']],
    [['them', '沒關係'], ['them', '壞掉的是貨，不是你的夢想'], ['them', '但貨要賠'], ['me', '可以拿夢想來賠嗎']],
    [['them', '保險有保這個嗎'], ['me', '我們有保險？'], ['them', '……沒有']],
  ],
  below60: [
    [['them', '貨已經壞四成以上了'], ['me', '剩下的也快了']],
    [['them', '冷靜'], ['them', '深呼吸'], ['them', '然後不要再撞了'], ['me', '前兩個做得到']],
    [['them', '客人剛打來問貨還好嗎'], ['me', '你怎麼說'], ['them', '我說還在車上'], ['them', '但我沒說壞了多少']],
  ],
  below30: [
    [['them', '我看了一下系統'], ['them', '你車上剩的東西，比較像是回收'], ['me', '那目的地要換成垃圾場嗎']],
    [['them', '算了'], ['them', '人到就好'], ['me', '老闆今天人真好'], ['them', '我怕你連人都沒了，沒辦法扣薪補給客戶']],
    [['them', '你知道我們公司為什麼叫胡鬧快遞嗎'], ['me', '不知道'], ['them', '我本來也不知道'], ['them', '直到我請了你']],
  ],
  train: [
    [['them', '剛看新聞 有台貨車被火車撞飛'], ['them', '車身寫胡鬧快遞'], ['me', '好巧'], ['them', '……']],
    [['them', '你剛剛是不是被火車撞'], ['me', '是火車撞我，不是我撞火車'], ['them', '這有差嗎'], ['me', '你申請理賠時應該比較方便']],
    [['them', '鐵路局打來了'], ['them', '問你要不要考慮改開火車'], ['me', '因為我開得好嗎'], ['them', '因為火車只能走軌道']],
  ],
  hits: [
    [['them', '客訴電話打爆了'], ['me', '那我開慢一點？'], ['them', '不行，客人也在等'], ['me', '那你只好多接幾通了']],
    [['them', '有人打來說被我們的車撞飛'], ['them', '已經叫救護車了'], ['me', '還是我順路載他去醫院'], ['them', '你跟他有仇嗎']],
    [['them', '你知道喇叭是按H嗎'], ['me', '知道'], ['them', '那為什麼都用車頭打招呼']],
  ],
  idle: [
    [['them', '你停在那邊是在等下班嗎'], ['me', '在思考要是拖到加班能不能報加班費']],
    [['them', '車子怎麼不動了'], ['me', '欣賞風景'], ['them', '風景不會付運費，客戶才會']],
    [['them', '？'], ['them', '？？'], ['me', '抱歉，睡醒了']],
  ],
  save: [
    [['them', '好，到這裡都還算正常'], ['me', '那你還挺寬容的']],
    [['them', '我幫你記一下現在的狀況'], ['them', '等等出事可以回來這裡'], ['me', '你很篤定會出事']],
    [['them', '一半了'], ['them', '後半段要小心喔'], ['me', '怎麼說'], ['them', '上一個司機就是在那邊離職的']],
  ],
  back: [
    [['them', '好，當作剛剛什麼都沒發生'], ['me', '本來就沒發生']],
    [['them', '再給你一次機會'], ['me', '這是第幾次了'], ['them', '我也數不清了'], ['them', '但會計數得很清楚']],
    [['them', '剛剛那段我當作沒看到'], ['me', '那可以不扣薪水嗎'], ['them', '但薪資系統有看到']],
  ],
};

/** Each customer: what they write when things happen, and when one of their own things is wrecked, by its kind. */
interface Customer {
  cues: Partial<Record<ChatCue, Talk[]>>;
  wrecked: Record<string, Talk[]>;
  /** When something of theirs hidden along the way is found and taken aboard, by its kind. */
  found?: Record<string, Talk[]>;
}

export const CUSTOMERS: Record<ChatDesc['customer'], Customer> = {
  // A student moving into a new flat: the skeleton is for a report, the melons from their grandmother.
  student: {
    cues: {
      start: [
        [['them', '你好！我的東西都在你車上了對嗎'], ['me', '嗯 目前為止'], ['them', '目前？？']],
      ],
      fallen: [
        [['them', '我室友說在路邊看到我的東西'], ['me', '那他挺厲害的'], ['me', '我以為都爛到看不出來了'], ['them', '？？']],
      ],
      below60: [
        [['them', '請問我的冰箱還好嗎'], ['me', '現在它是開放式設計了']],
        [['them', '我室友問我搬家順利嗎'], ['me', '「搬」的部分很順利'], ['me', '能不能到「家」不好說']],
      ],
      near: [
        [['them', '我看到你了！！'], ['them', '……你的車斗為什麼在冒煙'], ['me', '它很熱情']],
        [['them', '我在樓下等你'], ['them', '需要準備什麼嗎？'], ['me', '掃把跟垃圾袋吧']],
      ],
    },
    found: {
      amp: [
        [['them', '你怎麼找到我們社團的音箱的？！'], ['me', '它放在舞台後台'], ['me', '我本來想拿來當車用音響的'], ['them', '…幫我送回來 我會加錢的']],
      ],
      bicycle: [
        [['them', '我的腳踏車！我還以為被偷了'], ['me', '它在河邊等你'], ['me', '它破成那樣 你應該慶幸的不是沒小偷'], ['me', '而是清潔隊還沒來']],
      ],
      aircon: [
        [['them', '師傅說工地拆下來的舊冷氣免費拿'], ['them', '可惜已經沒了…'], ['me', '沒事 我幫你拿了一台'], ['them', '你怎麼拿到的？'], ['me', '鷹架上正好有台全新的']],
      ],
    },
    wrecked: {
      skeleton: [
        [['them', '你車上那個骨頭還好嗎'], ['me', '什麼骨頭'], ['them', '骨骼模型！我的報告需要他！'], ['me', '那你的報告題目可以換成「車禍後骨骼受損狀態實驗概論」了']],
        [['them', '我的骨骼模型呢'], ['me', '他自由了']],
      ],
      watermelon: [
        [['them', '西瓜是我阿嬤種的'], ['them', '她說要分給室友'], ['me', '我順路幫你們切好了'], ['me', '等等到車斗上挑自己喜歡的那塊']],
      ],
      fridge: [
        [['them', '我剛租的房子沒有冰箱'], ['them', '所以那台很重要'], ['me', '現在它很通風']],
      ],
      jar: [
        [['them', '水罐還好嗎'], ['them', '那是我陶藝課的期末作品'], ['me', '現在是馬賽克了']],
      ],
      wardrobe: [
        [['them', '衣櫃是我在網路上買的二手'], ['me', '你可以再轉賣了'], ['me', '記得寫「需自行組裝」']],
      ],
    },
  },
  // The owner of the canteen at the quarry's gate: sharp, quick, counts everything in lunch boxes; the washer is for the men's
  // work clothes, the rice and the soda for the canteen.
  canteen: {
    cues: {
      start: [
        [['them', '米跟汽水都上車了嗎'], ['me', '都上車了'], ['them', '中午兩百個工人等著吃飯'], ['me', '我盡量讓它們都完整下車']],
        [['them', '洗衣機是要洗工人制服的'], ['them', '他們已經三天沒換了'], ['me', '……我開快一點'], ['them', '拜託']],
      ],
      fallen: [
        [['them', '有工人打來說在路邊撿到一包米'], ['them', '是你負責送的嗎'], ['me', '曾經是']],
      ],
      below60: [
        [['them', '我一個便當賺十塊'], ['them', '你剛剛撞掉我三百個便當'], ['me', '那我買一個'], ['me', '剩下的找我們老闆']],
        [['them', '工人在問便當怎麼還沒好'], ['me', '跟他們說米還在路上'], ['me', '真的在馬路上']],
      ],
      near: [
        [['them', '看到你的車了'], ['them', '外面坐滿吃飯的工人，開慢一點'], ['me', '不能叫他們讓開嗎'], ['them', '他們在吃飯，天塌下來也不會讓']],
        [['them', '你到門口按個喇叭'], ['them', '我出來幫你卸貨'], ['me', '不用'], ['me', '很多已經自己卸好了']],
      ],
    },
    found: {
      stockpot: [
        [['them', '那是我的湯鍋嗎？！'], ['me', '它在鷹架上'], ['them', '我借給廟裡辦桌的'], ['me', '工人拿去裝水泥了'], ['them', '……洗乾淨再還我']],
      ],
      lightbox: [
        [['them', '那是我的新招牌！'], ['them', '招牌行說送到了 我等了一早上'], ['me', '送到阿玉豆花那邊了'], ['them', '……']],
      ],
      riceCooker: [
        [['them', '我的電鍋修好了？'], ['them', '修理行怎麼不送過來'], ['me', '說不定他機車被我撞了'], ['me', '或是他本人被我撞了']],
      ],
    },
    wrecked: {
      washer: [
        [['them', '洗衣機壞了？'], ['them', '那工人的制服怎麼辦'], ['me', '再穿三天'], ['them', '那你來跟他們一起吃飯']],
      ],
      soda: [
        [['them', '汽水全破了？'], ['them', '那今天的便當只能配開水了'], ['me', '健康']],
      ],
      sack: [
        [['them', '米袋破了？'], ['them', '路上到處都是米'], ['them', '我是叫你送米，不是叫你播種']],
      ],
    },
  },
  // The site foreman up on the roof: writes like the safety notices.
  foreman: {
    cues: {
      start: [
        [['them', '工安提醒：貨車不是推土機'], ['me', '我知道'], ['them', '上一個司機也說他知道']],
        [['them', '貨記得要送上頂樓'], ['me', '有電梯嗎'], ['them', '有'], ['them', '還在設計圖上']],
      ],
      fallen: [
        [['them', '監視器拍到東西從你車上掉下來'], ['me', '它下車透氣'], ['them', '透氣完記得叫它回車上']],
      ],
      below60: [
        [['them', '工安提醒：撞擊會損壞貨物'], ['me', '這是提醒還是結論'], ['them', '都是']],
        [['them', '工安提醒：貨物損壞請立即通報'], ['me', '那我要通報'], ['them', '什麼貨物壞了'], ['me', '你可以把清單上全部打勾了']],
      ],
      near: [
        [['me', '我快到了'], ['them', '太好了，工人等貨很久了'], ['me', '貨……也會到'], ['them', '可以說得有信心一點嗎']],
        [['them', '工地危險，記得小心'], ['them', '工安提醒：油門不是越大越好'], ['me', '那是什麼越大越好'], ['them', '看到你後覺得保險越大越好']],
      ],
    },
    found: {
      megaphone: [
        [['them', '那是我的大聲公'], ['them', '為什麼會被丟在那邊'], ['me', '可能是工人們想要保護耳朵']],
      ],
      toolbox: [
        [['them', '工安提醒：工具不可隨意放置'], ['me', '它放在河中間的石頭上'], ['me', '你們難道是游泳渡河上班的嗎']],
      ],
      radio: [
        [['them', '你在哪找到工人們的收音機的？'], ['them', '中午沒有它放音樂，大家只好聽我唱歌'], ['them', '我總覺得他們拿著工具盯著我的眼神怪怪的']],
      ],
    },
    wrecked: {
      toilet: [
        [['them', '馬桶破了？'], ['them', '那頂樓的工人怎麼辦'], ['me', '忍耐']],
      ],
      fridge: [
        [['them', '冰箱壞了？'], ['them', '那工人中午喝什麼'], ['me', '大門口有餐廳'], ['them', '老闆娘說她的汽水也沒到']],
      ],
      paintRed: [
        [['them', '紅色油漆灑了？'], ['them', '路人會以為出了車禍'], ['me', '是也沒有誤會']],
      ],
      paintYellow: [
        [['them', '黃色油漆是要畫警戒線的'], ['me', '我先幫你畫了'], ['them', '畫在哪'], ['me', '整條路']],
      ],
    },
  },
  // The reefer's old captain: superstitious, sure it will all come right, and forty years at sea.
  captain: {
    cues: {
      start: [
        [['them', '我早上擲過筊了'], ['them', '擲出聖筊，今天一定順'], ['me', '你擲了幾次'], ['them', '……二十次']],
        [['them', '船員在賭你幾點到'], ['me', '賭最多的是幾點'], ['them', '……他們賭你不會到']],
      ],
      fallen: [
        [['them', '路上有人撿到一箱東西，上面寫我的名字'], ['me', '好巧'], ['me', '我車上也有一箱一樣的'], ['me', '……至少剛剛還有']],
        [['them', '我眼皮從剛剛一直跳'], ['them', '你那邊發生什麼壞事了'], ['me', '也就撞了幾次車 掉了幾件貨'], ['me', '一切正常'], ['them', '……這算正常嗎']],
      ],
      below60: [
        [['them', '颱風天貨損失一點沒關係，人平安就好'], ['me', '人很平安'], ['them', '那貨呢'], ['me', '你剛剛說沒關係']],
        [['them', '貨還好嗎'], ['me', '大部分都還在'], ['them', '大部分是多少'], ['me', '九成？'], ['me', '不對 八成'], ['me', '等等 好像是七成'], ['me', '喔…現在變六成了']],
      ],
      near: [
        [['them', '我看到你了！'], ['them', '跳板很窄，慢慢開上來'], ['me', '收到'], ['them', '我說慢慢'], ['them', '……你為什麼在加速']],
        [['them', '船員都站在甲板上等你了'], ['them', '要迎接這趟的貨'], ['me', '要迎接的不多了']],
      ],
    },
    found: {
      captainCap: [
        [['them', '那是我的新船長帽！'], ['them', '舊的那頂戴了四十年'], ['me', '為什麼要換'], ['them', '船員有點受不了舊的那頂的味道'], ['me', '但新的這頂也在魚攤旁邊放了好幾天']],
      ],
      telescope: [
        [['them', '那是我的望遠鏡！'], ['me', '你用它看星星？'], ['them', '不，我用它看船員有沒有在偷懶'], ['them', '這幾天突然就找不到了'], ['me', '看來我還是把它留在原地或許比較好']],
      ],
      shipBell: [
        [['them', '那是我船上的鐘！'], ['them', '出港前要撞三下鐘，保佑一路平安'], ['me', '不用擔心'], ['me', '等一下一路上我幫你多撞幾下'], ['them', '……聽起來我的鐘不怎麼平安']],
      ],
    },
    wrecked: {
      tuna: [
        [['them', '鮪魚還好嗎'], ['me', '很新鮮'], ['me', '新鮮到不用切就看得到肉了'], ['them', '……']],
      ],
      octopus: [
        [['them', '章魚還好嗎'], ['me', '我看看'], ['me', '章魚原本應該是幾隻腳？'], ['them', '……八隻'], ['me', '嗯…至少它的頭還在']],
      ],
      kingCrab: [
        [['them', '帝王蟹還好嗎'], ['me', '腳都還在'], ['them', '那就好'], ['me', '只是不在牠身上']],
      ],
      cabbage: [
        [['them', '高麗菜摔爛了？'], ['them', '你知道颱風天一顆多少嗎'], ['me', '多少'], ['them', '比你的時薪高']],
      ],
      noodles: [
        [['them', '泡麵壓扁了？'], ['them', '你知道颱風前要搶到那幾箱有多難嗎'], ['me', '多難'], ['them', '比你準時送到還難'], ['me', '……那確實很難']],
      ],
    },
  },
};
