import type { RecordsSet } from './best';
import { soundButtons, uiSound } from './jukebox';
import type { LevelDef } from './levels/types';
import { soundSettings } from './sound-settings';
import { verdict } from './verdict';
import { CARGO_TYPES, type CargoType } from './sim/cargo-types';
import type { Failure, Result } from './sim/sim';

export const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

function clock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const el = (id: string) => document.getElementById(id)!;

const FAILURES: Record<Failure, [string, string]> = {
  overturned: ['翻車了', '貨車翻覆，配送失敗'],
  pit: ['掉進坑裡了', '貨車開不出來，配送失敗'],
  water: ['掉進河裡了', '貨車沉入水中，配送失敗'],
  fall: ['從高處摔下去了', '貨車摔壞了，配送失敗'],
};

const HELP_DRIVING =
  '<b>W</b> 前進　<b>Shift</b> 急加速　<b>S</b> 煞車（按住越久越重）、倒車　<b>A / D</b> 轉向　<b>空白鍵</b> 手煞車　<b>H</b> 喇叭　<b>C</b> 下車　<b>Esc</b> 暫停　<b>滾輪</b> 縮放　<b>右鍵拖曳</b> 轉視角';
const HELP_ON_FOOT =
  '<b>WASD</b> 移動　<b>Shift</b> 奔跑　<b>空白鍵</b> 跳躍　<b>E</b> 舉起、放下　<b>滑鼠</b> 瞄準　<b>按住左鍵</b> 蓄力拋出　<b>右鍵</b> 取消　<b>C</b> 上車　<b>Esc</b> 暫停';

const PAD_DRIVING =
  '<b>RT</b> 油門　<b>X</b> 急加速　<b>LT</b> 煞車、倒車　<b>左搖桿</b> 轉向　<b>A</b> 手煞車　<b>LB</b> 喇叭　<b>Y</b> 下車　<b>Start</b> 暫停　<b>右搖桿</b> 轉視角、縮放';
const PAD_ON_FOOT =
  '<b>左搖桿</b> 移動　<b>X</b> 奔跑　<b>A</b> 跳躍　<b>B</b> 舉起、放下　<b>右搖桿</b> 瞄準　<b>按住 RT</b> 蓄力拋出　<b>LT</b> 取消　<b>Y</b> 上車　<b>Start</b> 暫停';

export class Hud {
  private readonly speedEl = el('speed');
  private readonly cargoEl = el('cargo');
  private readonly valueEl = el('value');
  private readonly valueFullEl = el('value-full');
  private readonly valueFill = el('value-fill');
  private readonly timerEl = el('timer');
  private readonly nav = el('nav');
  private readonly navArrow = el('nav-arrow');
  private readonly navDistance = el('nav-distance');
  private readonly popups = el('popups');
  private readonly splats = el('splats');
  private readonly result = el('result');
  private readonly banner = el('banner');
  private readonly prompt = el('prompt');
  private readonly help = el('help');
  private promptText = '';
  /**
   * The key list along the bottom goes down to a small tab a while after the run starts, and after each change between
   * driving and on foot; F1 keeps it up, or lets it go again. The tutorial keeps it up throughout.
   */
  private helpUntil = performance.now() + 15000;
  private helpPinned = false;
  /** Called when a retry button is clicked, on the result page or the pause menu. */
  onRetry: (() => void) | null = null;
  /** Called by the buttons that go back to the save point, on the result page and in the pause menu. */
  onBackToSave: (() => void) | null = null;
  /** Whether the run has passed its save point, so that it can be gone back to. */
  saveAvailable = false;
  /** Called by the pause menu's resume button, and by any button that goes back to the main menu. */
  onResume: (() => void) | null = null;
  onMenu: (() => void) | null = null;
  /** The delivery after this one, offered first on the result page once this one is passed; null after the last. */
  nextLevel: { id: string; name: string } | null = null;
  onNext: (() => void) | null = null;
  /** Called by the pause button in the corner of the screen. */
  onPause: (() => void) | null = null;
  private onFoot: boolean | null = null;
  private pad = false;
  private speedText = '';
  private cargoText = '';
  private valueText = '';
  private timerText = '';
  private distanceText = '';

  constructor(private readonly level: LevelDef) {
    const goal = el('value-goal'), goal3 = el('value-goal3');
    const freePlay = !level.finish;
    goal.hidden = goal3.hidden = freePlay;
    // The marks on the value bar are the second and third stars: the first is for arriving at all.
    goal.style.left = `${level.stars[1] * 100}%`;
    goal3.style.left = `${level.stars[2] * 100}%`;
    el('timer-stat').hidden = freePlay;
    this.nav.hidden = freePlay;
    // The tutorial: no clock, no stars, nothing to measure the load against; the arrow points at the next thing to do.
    if (level.practice) {
      goal.hidden = true;
      el('timer-stat').hidden = true;
      el('value-full').hidden = true;
      el('value-bar').hidden = true;
      this.nav.querySelector('.label')!.textContent = '目標';
      el('result-retry').innerHTML = '開始第 1 關';
    }
    for (const id of ['result-retry', 'pause-retry']) el(id).addEventListener('click', () => this.onRetry?.());
    el('result-next').addEventListener('click', () => this.onNext?.());
    for (const id of ['result-save', 'pause-save']) el(id).addEventListener('click', () => this.onBackToSave?.());
    // Leaving from the result page loses nothing. Leaving mid-run does, so it asks first.
    for (const id of ['result-menu', 'pause-leave']) el(id).addEventListener('click', () => this.onMenu?.());
    el('pause-menu').addEventListener('click', () => this.askToLeave(true));
    el('pause-stay').addEventListener('click', () => this.askToLeave(false));
    el('pause-resume').addEventListener('click', () => this.onResume?.());
    el('pause-button').addEventListener('click', () => this.onPause?.());
    el('pause-level').textContent = level.name;
    soundButtons(el('hud'));

    // The volume controls in the pause menu.
    const sfx = el('vol-sfx') as HTMLInputElement;
    const music = el('vol-music') as HTMLInputElement;
    const mute = el('vol-mute') as HTMLInputElement;
    soundSettings.watch((settings) => {
      sfx.value = String(Math.round(settings.sfx * 100));
      music.value = String(Math.round(settings.music * 100));
      mute.checked = settings.muted;
    });
    sfx.addEventListener('input', () => soundSettings.set({ sfx: Number(sfx.value) / 100 }));
    music.addEventListener('input', () => soundSettings.set({ music: Number(music.value) / 100 }));
    mute.addEventListener('change', () => soundSettings.set({ muted: mute.checked }));
    this.showBanner();
    el('banner-close').addEventListener('click', () => this.onBannerClose());
  }

  /** The level's name, what each star asks for and what is on the truck: up until the run begins. */
  showBanner(): void {
    // The tutorial has its own line at the top instead.
    if (this.level.practice) {
      this.banner.hidden = true;
      return;
    }
    el('banner-title').textContent = this.level.name;
    el('banner-brief').textContent = this.level.brief;
    const scored = !!this.level.finish;
    const [pass, two, three] = this.level.stars;
    const goals = [
      pass > 0 ? `送達 ${Math.round(pass * 100)}%` : '抵達卸貨區',
      `送達 ${Math.round(two * 100)}% 的價值`,
      `送達 ${Math.round(three * 100)}% 的價值`,
    ];
    el('banner-goals').innerHTML = scored ? goals.map((text, i) => `<div class="goal"><span>${'★'.repeat(i + 1)}</span>${text}</div>`).join('') : '';
    el('banner-list').innerHTML = scored ? this.manifest() : '';
    // Its way out is a button of its own, rather than a word in the corner; the clock starting is said beside it.
    el('banner-foot').innerHTML = scored
      ? `<span>共 ${this.level.cargo.length} 件</span><b>${money(this.loadValue())}</b><em>駛出柵門後開始計時</em><button id="banner-go" type="button">出發<kbd>Enter</kbd></button>`
      : '';
    el('banner-go')?.addEventListener('click', () => this.onBannerClose());
    this.banner.classList.toggle('plain', !scored);
    this.banner.classList.remove('leaving');
    this.banner.hidden = false;
  }

  /** Called when the player closes the banner by hand. */
  onBannerClose: () => void = () => {};

  /** Fade the banner out: the run has begun. */
  dismissBanner(): void {
    this.banner.classList.add('leaving');
  }

  /** Esc in the pause menu while it asks whether to leave: back to its choices, rather than out of it. False when it is not asking. */
  cancelLeave(): boolean {
    if (el('pause-confirm').hidden) return false;
    this.askToLeave(false);
    return true;
  }

  /** Swap the pause menu's choices for the question of whether to really leave, or back again. */
  private askToLeave(asking: boolean): void {
    el('pause-choices').hidden = asking;
    el('pause-confirm').hidden = !asking;
    el(asking ? 'pause-stay' : 'pause-resume').focus();
  }

  /** Open or close the pause menu. Opening it, say how the run stands. */
  showPause(on: boolean, run?: { seconds: number; value: number; fullValue: number; onTruck: number; total: number }): void {
    el('pause').hidden = !on;
    this.askToLeave(false);
    el('pause-save').hidden = !this.saveAvailable;
    if (!on || !run) return;
    el('pause-time').textContent = clock(run.seconds);
    el('pause-value').textContent = money(run.value);
    el('pause-cargo').textContent = `${run.onTruck} / ${run.total}`;
    el('pause-resume').focus();
  }

  /** What the whole load is worth. */
  private loadValue(): number {
    return this.level.cargo.reduce((sum, { type }) => sum + (CARGO_TYPES[type] as CargoType).value, 0);
  }

  /** The load, a tile for each kind of thing: its colour, how many, and what one is worth. */
  private manifest(): string {
    const counts = new Map<CargoType, number>();
    for (const { type } of this.level.cargo) {
      const kind: CargoType = CARGO_TYPES[type];
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    const kinds = [...counts].sort(([a], [b]) => b.value - a.value);
    const swatch = (kind: CargoType) => `#${kind.parts[0].color.toString(16).padStart(6, '0')}`;
    return kinds
      .map(([kind, n]) => `<div class="manifest-item"><i style="background:${swatch(kind)}"></i><span>${kind.name}</span><em>× ${n}</em><b>${money(kind.value)}</b></div>`)
      .join('');
  }

  update(speedMps: number, cargoOnTruck: number, cargoTotal: number, value: number, fullValue: number, seconds: number): void {
    const speed = String(Math.round(Math.abs(speedMps) * 3.6));
    if (speed !== this.speedText) this.speedEl.textContent = this.speedText = speed;

    const cargo = `${cargoOnTruck} / ${cargoTotal}`;
    if (cargo !== this.cargoText) {
      this.cargoEl.textContent = this.cargoText = cargo;
      this.cargoEl.classList.toggle('lost', cargoOnTruck < cargoTotal);
    }

    const text = money(value);
    if (text !== this.valueText) {
      this.valueEl.textContent = this.valueText = text;
      this.valueFullEl.textContent = `/ ${money(fullValue)}`;
      const kept = fullValue > 0 ? value / fullValue : 0;
      this.valueFill.style.width = `${kept * 100}%`;
      const [, two, three] = this.level.stars;
      this.valueFill.style.backgroundColor = kept >= three ? '#6fd08c' : kept >= two ? '#ffd166' : '#ff6b5a';
    }

    const time = clock(seconds);
    if (time !== this.timerText) {
      this.timerEl.textContent = this.timerText = time;
    }
  }

  /** Point the arrow at the delivery bay. `angle` is clockwise from straight up the screen, radians. */
  /** Show or hide the arrow: in the tutorial it is there only while there is somewhere to go. */
  showNav(on: boolean): void {
    if (this.level.practice && this.nav.hidden === on) this.nav.hidden = !on;
  }

  navigate(angle: number, distance: number): void {
    this.navArrow.style.transform = `rotate(${angle}rad)`;
    const text = String(Math.round(distance));
    if (text !== this.distanceText) this.navDistance.textContent = this.distanceText = text;
  }

  /** The key list along the bottom, for driving or for being on foot. */
  setMode(onFoot: boolean, pad = false): void {
    if (onFoot === this.onFoot && pad === this.pad) return;
    this.onFoot = onFoot;
    this.pad = pad;
    const keys = pad ? (onFoot ? PAD_ON_FOOT : PAD_DRIVING) : onFoot ? HELP_ON_FOOT : HELP_DRIVING;
    this.help.innerHTML = `<span class="help-keys">${keys}</span><span class="help-tab">${pad ? '' : '<b>F1</b> '}操作說明</span>`;
    this.showHelp(8);
  }

  /** Bring the key list up for this many seconds, at least. */
  showHelp(seconds: number): void {
    this.helpUntil = Math.max(this.helpUntil, performance.now() + seconds * 1000);
  }

  /** F1: keep the key list up, or let it go down again. */
  toggleHelp(): void {
    this.helpPinned = !this.helpPinned;
    if (!this.helpPinned) this.helpUntil = 0;
  }

  /** Each frame: whether the key list is up or down to its tab. */
  tickHelp(): void {
    const up = this.level.practice || this.helpPinned || performance.now() < this.helpUntil;
    this.help.classList.toggle('tucked', !up);
  }

  /** A one-line hint about what can be done right now. Empty hides it. May contain <b> for key names. */
  setPrompt(html: string, warning = false): void {
    if (html !== this.promptText) {
      this.promptText = html;
      this.prompt.innerHTML = html;
      this.prompt.hidden = html === '';
    }
    this.prompt.classList.toggle('warning', warning);
  }

  /**
   * The page shown when a run ends: the stars, what arrived and what it was worth, what
   * became of the rest, and how the run stands against the best on record.
   */
  showResult(result: Result, fullValue: number, records?: RecordsSet): void {
    if (this.level.practice) return this.showGraduation(result);
    const failed = result.failure !== undefined;
    const passed = !failed && result.stars > 0;
    const [title, reason] = failed ? FAILURES[result.failure!] : [passed ? '送達！' : '未達標', ''];
    el('result-level').textContent = this.level.name;
    el('result-title').textContent = title;
    el('result-title').className = passed ? 'passed' : 'failed';
    el('result-stars').innerHTML = [0, 1, 2].map((n) => `<span class="${n < result.stars ? 'on' : ''}" style="animation-delay:${0.25 + n * 0.22}s">★</span>`).join('');
    el('result-reason').textContent = reason;
    el('result-verdict').textContent = this.level.finish ? `「${verdict(result, this.level)}」` : '';

    const [pass, two, three] = this.level.stars;
    const percent = Math.floor(result.fraction * 100);
    el('result-value').innerHTML =
      `<div class="figure"><b>${money(result.value)}</b><span>/ ${money(fullValue)}</span><em>${percent}%</em></div>` +
      `<div class="bar"><div class="fill${result.fraction >= three ? ' good' : ''}" style="width:${Math.min(100, result.fraction * 100)}%"></div><div class="mark" style="left:${two * 100}%"></div><div class="mark" style="left:${three * 100}%"></div></div>`;

    // The worth counts up from nothing as the bar fills, and each star chimes as it comes.
    this.countUp(result.value, result.fraction);
    for (let n = 0; n < result.stars; n++) window.setTimeout(() => uiSound('confirm'), (0.35 + n * 0.22) * 1000);

    // Two rows: what became of the load, then the time and what the run did on the way.
    const { intact, damaged, destroyed, lost } = result.tally;
    const { people, cars, things } = result.trip;
    const tile = (label: string, value: string, look = '') => `<div class="tile${look ? ' ' + look : ''}"><b>${value}</b><span>${label}</span></div>`;
    el('result-rows').innerHTML = [
      tile('剩餘貨物', `${intact + damaged}<small> / ${intact + damaged + destroyed + lost}</small>`),
      tile('受損', String(damaged), damaged > 0 ? 'bad' : ''),
      tile('全毀', String(destroyed), destroyed > 0 ? 'bad' : ''),
      tile('遺失', String(lost), lost > 0 ? 'bad' : ''),
      tile('用時', clock(result.seconds)),
      tile('撞倒的人', String(people), 'trip'),
      tile('撞翻車輛', String(cars), 'trip'),
      tile('撞飛物品', String(things), 'trip'),
    ].join('');

    const goals: [string, boolean][] = [
      [pass > 0 ? `送達價值 ${Math.round(pass * 100)}% 以上` : '抵達卸貨區', !failed && result.fraction >= pass],
      [`送達價值 ${Math.round(two * 100)}% 以上`, !failed && result.fraction >= two],
      [`送達價值 ${Math.round(three * 100)}% 以上`, !failed && result.fraction >= three],
    ];
    el('result-goals').innerHTML = goals
      .map(([text, met], i) => `<div class="result-goal${met ? ' met' : ''}"><span class="star">${'★'.repeat(i + 1)}</span>${text}<i>${met ? '✓' : ''}</i></div>`)
      .join('');

    // The two records, each against what stood before: the most delivered, and the quickest.
    const before = records?.before ?? null;
    const line = (label: string, now: string, was: string | null, isNew: boolean) =>
      `<div class="record${isNew ? ' new' : ''}"><span>${label}</span><b>${isNew ? now : was ?? '－'}</b>` +
      (isNew ? `<em>新紀錄</em>${was ? `<i>原 ${was}</i>` : ''}` : '') + '</div>';
    const share = (fraction: number) => `${money(fraction * fullValue)}（${Math.floor(fraction * 100)}%）`;
    el('result-record').innerHTML = records && (before || records.value || records.time)
      ? line('最高價值', share(result.fraction), before ? share(before.fraction) : null, records.value) +
        line('最短時間', clock(result.seconds), before?.seconds != null ? clock(before.seconds) : null, records.time)
      : '';
    if (result.retries > 0) {
      el('result-record').innerHTML += `<div class="record"><span>接關</span><b>${result.retries} 次</b><i>有接關，不列入最短時間</i></div>`;
    }
    // After a failure past the save point, going back to it comes first.
    const back = failed && this.saveAvailable;
    el('result-save').hidden = !back;
    // Passed, and there is another after it: going on to that comes first.
    const next = passed && this.nextLevel;
    el('result-next').hidden = !next;
    if (next) el('result-next').textContent = `下一關：${next.name}`;
    el('result-retry').textContent = back ? '從頭開始' : '再玩一次';
    el('result-retry').classList.toggle('quiet', back || !!next);
    // The card from the start has had its day, if it is somehow still up.
    this.banner.hidden = true;
    this.result.hidden = false;
    // Something to press with Enter straight away: going back to the save point when there is one, else going again.
    el(back ? 'result-save' : next ? 'result-next' : 'result-retry').focus();
  }

  /** The result page's worth, counted up from nothing over a second, and its bar filled alongside. */
  private countUp(value: number, fraction: number): void {
    const figure = el('result-value').querySelector('b')!;
    const fill = el('result-value').querySelector<HTMLElement>('.fill')!;
    const width = `${Math.min(100, fraction * 100)}%`;
    fill.style.width = '0%';
    const began = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / 1000);
      const eased = 1 - (1 - t) ** 3;
      figure.textContent = money(value * eased);
      if (t < 1 && !this.result.hidden) requestAnimationFrame(step);
    };
    requestAnimationFrame((now) => {
      fill.style.width = width;
      step(now);
    });
  }

  /** The end of the tutorial: what has been learnt, and on to level 1. */
  private showGraduation(result: Result): void {
    el('result-level').textContent = this.level.name;
    el('result-title').textContent = '結業！';
    el('result-title').className = 'passed';
    el('result-stars').innerHTML = '';
    el('result-reason').textContent = '開車、煞車、飛越、撿貨都會了，可以正式上路送貨了。';
    el('result-verdict').textContent = '「保證送達，不保證完整。歡迎加入胡鬧快遞。」';
    const learnt = ['油門與轉彎', '看到火車就煞車', '急加速飛越斷橋', '下車撿貨', '卸貨'];
    el('result-value').innerHTML = '';
    el('result-rows').innerHTML = '';
    el('result-goals').innerHTML = learnt.map((text) => `<div class="result-goal met"><span class="star">✓</span>${text}<i></i></div>`).join('');
    el('result-record').innerHTML = `<div class="record"><span>用時</span><b>${clock(result.seconds)}</b></div>`;
    this.banner.hidden = true;
    this.result.hidden = false;
  }

  hideResult(): void {
    this.result.hidden = true;
  }

  /** Floating text at a screen position, e.g. money lost. */
  popup(text: string, x: number, y: number, style: '' | 'big' | 'gain' = ''): void {
    const popup = document.createElement('div');
    popup.className = style ? `popup ${style}` : 'popup';
    popup.textContent = text;
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    popup.addEventListener('animationend', () => popup.remove());
    this.popups.appendChild(popup);
  }

  clearPopups(): void {
    this.popups.replaceChildren();
    this.splats.replaceChildren();
  }

  /**
   * Something has burst over the windscreen: blots of it across the view, biggest toward
   * the top, that run down and are gone in a few seconds. `amount` runs from 0 to 1.
   */
  splat(color: number, amount = 1): void {
    const hex = `#${color.toString(16).padStart(6, '0')}`;
    // However much is thrown at it, never so much at once that nothing can be seen through it.
    const blots = Math.min(Math.round(5 + amount * 7), 16 - this.splats.childElementCount);
    for (let i = 0; i < blots; i++) {
      const blot = document.createElement('div');
      blot.className = 'splat';
      const size = (70 + Math.random() * 190) * (0.6 + amount * 0.5);
      const corner = () => `${35 + Math.random() * 30}%`;
      blot.style.width = `${size}px`;
      blot.style.height = `${size * (0.8 + Math.random() * 0.5)}px`;
      // Anywhere but over the truck itself, in the middle of the lower half of the view.
      let left = 0;
      let top = 0;
      do {
        left = 6 + Math.random() * 88;
        top = 6 + Math.random() * Math.random() * 76;
      } while (Math.abs(left - 50) < 15 && top > 42);
      blot.style.left = `${left}%`;
      blot.style.top = `${top}%`;
      blot.style.background = hex;
      blot.style.borderRadius = `${corner()} ${corner()} ${corner()} ${corner()} / ${corner()} ${corner()} ${corner()} ${corner()}`;
      blot.style.rotate = `${Math.random() * 360}deg`;
      blot.style.setProperty('--seconds', `${2.6 + Math.random() * 1.6}s`);
      blot.style.setProperty('--run', `${30 + Math.random() * 110}px`);
      blot.style.animationDelay = `${Math.random() * 0.12}s`;
      blot.addEventListener('animationend', () => blot.remove());
      this.splats.appendChild(blot);
    }
  }
}
