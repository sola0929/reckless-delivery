// The loading screen between the menu and a level: the truck drives along a road from the
// warehouse to the delivery bay as the game comes in, past a post for each stage. Shown by
// a line in the page itself the moment a level is asked for; this moves it on.

/** The stages, in order: where each one starts, as a share of the way, and what it is called. */
const STAGES = [
  { at: 0, label: '下載貨單' },
  { at: 0.6, label: '發動引擎' },
  { at: 0.8, label: '佈置路線' },
] as const;
export type Stage = 0 | 1 | 2;

const TIPS = [
  '煞車按得越久越重，急煞時車斗上的貨會往前衝。',
  '貨掉了別急著走：慢下來按 C 下車，把它搬回車斗就還算數。',
  '按 H 按喇叭，擋路的行人會讓開。',
  '開車時按住右鍵拖曳可以轉頭，看看後面有沒有來車。',
  '撞得越用力，貨損越重。保證送達，不保證完整。',
  '西瓜撞到會爆汁，擋風玻璃也逃不掉。',
  'Shift 急加速很爽，過彎前記得放開。',
  '四輪朝天不算送達：翻車就是配送失敗。',
  '送達就有一顆星，貨物剩三成拿兩顆，剩六成拿滿三顆。',
  '手把也能玩：RT 油門、LT 煞車，左搖桿轉向。',
  '看起來撞得倒的東西，大多真的撞得倒。',
];

const root = () => document.getElementById('loading');
let shown = 0;
let target = 0;
let stage = -1;
let running = false;
let tipTimer = 0;
/** When the truck last moved, ms: it is seen to drive on a moment after, rather than to stutter. */
let movedAt = 0;

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

/** Put up the level's name and set the truck going, if the page has the screen up. */
export function startLoading(level: { tag: string; name?: string; note?: string } | null): void {
  const screen = root();
  if (!screen) return;
  screen.hidden = false;
  if (level?.name) {
    el('loading-badge').textContent = level.tag;
    el('loading-name').textContent = level.name;
    el('loading-note').textContent = level.note ?? '';
    el('loading-level').classList.add('in');
  }
  // The posts along the road, one for each stage.
  const posts = el('loading-posts');
  if (!posts.childElementCount) {
    posts.innerHTML = STAGES.map((s, i) => `<div class="post" data-stage="${i}" style="left:${s.at * 100}%"><i></i><span>${s.label}</span></div>`).join('');
  }
  // A tip to read while waiting, a new one now and then.
  let tip = Math.floor(Math.random() * TIPS.length);
  const showTip = () => {
    const text = el('loading-tip-text');
    text.classList.remove('in');
    // Out, then the next one in.
    window.setTimeout(() => {
      text.textContent = TIPS[tip];
      text.classList.add('in');
      tip = (tip + 1) % TIPS.length;
    }, 250);
  };
  showTip();
  window.clearInterval(tipTimer);
  tipTimer = window.setInterval(showTip, 5200);
  setStage(0, 0);
  if (!running) {
    running = true;
    requestAnimationFrame(tick);
  }
}

/** How far it has got: a stage, and how far through it (0 to 1). */
export function setStage(at: Stage, through = 0): void {
  const from = STAGES[at].at;
  const to = at + 1 < STAGES.length ? STAGES[at + 1].at : 1;
  target = Math.max(target, from + (to - from) * Math.min(1, Math.max(0, through)));
  if (at !== stage) {
    stage = at;
    el('loading-stage').textContent = `${STAGES[at].label}…`;
    for (const post of root()?.querySelectorAll<HTMLElement>('.post') ?? []) {
      const n = Number(post.dataset.stage);
      post.classList.toggle('passed', n < at);
      post.classList.toggle('current', n === at);
    }
  }
}

/** Let the page draw what has been set, before the next long piece of work starts. */
export function settle(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/** Done: the truck runs into the bay, and the screen fades away. */
export async function finishLoading(): Promise<void> {
  const screen = root();
  if (!screen || screen.hidden) return;
  target = 1;
  el('loading-stage').textContent = '出發！';
  for (const post of screen.querySelectorAll<HTMLElement>('.post')) {
    post.classList.add('passed');
    post.classList.remove('current');
  }
  // Long enough for the truck to be seen to arrive, no longer.
  await new Promise((resolve) => window.setTimeout(resolve, 380));
  screen.classList.add('out');
  window.clearInterval(tipTimer);
  await new Promise((resolve) => window.setTimeout(resolve, 420));
  screen.hidden = true;
  running = false;
}

/** The truck eases toward how far the loading has got, and the number with it. */
function tick(): void {
  if (!running) return;
  const before = shown;
  shown += (target - shown) * 0.12;
  if (target - shown < 0.0005) shown = target;
  const screen = root();
  if (screen) {
    screen.style.setProperty('--progress', String(shown));
    el('loading-percent').textContent = `${Math.floor(shown * 100)}`;
    // Wheels turn and the load jostles while it moves; standing, it just idles.
    if (shown - before > 0.0003) movedAt = performance.now();
    screen.classList.toggle('moving', performance.now() - movedAt < 350);
  }
  requestAnimationFrame(tick);
}
