import { soundButtons } from './jukebox';
import type { LevelDef } from './levels/types';
import { soundSettings } from './sound-settings';
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
};

const HELP_DRIVING =
  '<b>W</b> 前進　<b>Shift</b> 急加速　<b>S</b> 煞車（按住越久越重）、倒車　<b>A / D</b> 轉向　<b>空白鍵</b> 手煞車　<b>C</b> 下車　<b>R</b> 重來　<b>Esc</b> 暫停　<b>滾輪</b> 縮放';
const HELP_ON_FOOT =
  '<b>WASD</b> 移動　<b>Shift</b> 奔跑　<b>空白鍵</b> 跳躍　<b>E</b> 舉起、放下　<b>滑鼠</b> 瞄準　<b>按住左鍵</b> 蓄力拋出　<b>右鍵</b> 取消　<b>C</b> 上車　<b>R</b> 重來　<b>Esc</b> 暫停';

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
  /** Called when a retry button is clicked, on the result page or the pause menu. */
  onRetry: (() => void) | null = null;
  /** Called by the pause menu's resume button, and by any button that goes back to the main menu. */
  onResume: (() => void) | null = null;
  onMenu: (() => void) | null = null;
  /** Called by the pause button in the corner of the screen. */
  onPause: (() => void) | null = null;
  private onFoot: boolean | null = null;
  private speedText = '';
  private cargoText = '';
  private valueText = '';
  private timerText = '';
  private distanceText = '';

  constructor(private readonly level: LevelDef) {
    const goal = el('value-goal');
    const freePlay = !level.finish;
    goal.hidden = freePlay;
    // The mark on the value bar is the second star: the first is for arriving at all.
    goal.style.left = `${level.stars[1] * 100}%`;
    el('timer-stat').hidden = freePlay;
    this.nav.hidden = freePlay;
    for (const id of ['result-retry', 'pause-retry']) el(id).addEventListener('click', () => this.onRetry?.());
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
  }

  /** The level's name and goal, shown briefly at the start. */
  showBanner(): void {
    el('banner-title').textContent = this.level.name;
    const [pass, two] = this.level.stars;
    const first = pass > 0 ? `送達 ${Math.round(pass * 100)}% 過關` : '抵達卸貨區即過關';
    el('banner-brief').textContent = this.level.finish
      ? `${this.level.brief}　★ ${first}　★★ 送達 ${Math.round(two * 100)}%　★★★ 並在 ${clock(this.level.par)} 內`
      : this.level.brief;
    el('banner-list').innerHTML = this.level.finish ? this.manifest() : '';
    this.banner.classList.remove('leaving');
    this.banner.hidden = false;
  }

  /** Fade the banner out: the run has begun. */
  dismissBanner(): void {
    this.banner.classList.add('leaving');
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
    if (!on || !run) return;
    el('pause-time').textContent = clock(run.seconds);
    el('pause-value').textContent = money(run.value);
    el('pause-cargo').textContent = `${run.onTruck} / ${run.total}`;
    el('pause-resume').focus();
  }

  /** The load, a line for each kind of thing: how many, and what one is worth. */
  private manifest(): string {
    const counts = new Map<CargoType, number>();
    for (const { type } of this.level.cargo) {
      const kind: CargoType = CARGO_TYPES[type];
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    const kinds = [...counts].sort(([a], [b]) => b.value - a.value);
    const rows = kinds.map(([kind, n]) => `<div class="manifest-row"><span>${kind.name}</span><span>× ${n}</span><span>${money(kind.value)}</span></div>`);
    const total = kinds.reduce((sum, [kind, n]) => sum + kind.value * n, 0);
    const items = kinds.reduce((sum, [, n]) => sum + n, 0);
    rows.push(`<div class="manifest-row total"><span>合計</span><span>${items} 件</span><span>${money(total)}</span></div>`);
    return rows.join('');
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
      const [pass, two] = this.level.stars;
      this.valueFill.style.backgroundColor = kept >= two ? '#6fd08c' : kept >= Math.max(pass, two / 2) ? '#ffd166' : '#ff6b5a';
    }

    const time = clock(seconds);
    if (time !== this.timerText) {
      this.timerEl.textContent = this.timerText = time;
      // Past the par time, the third star is gone.
      this.timerEl.classList.toggle('lost', seconds > this.level.par && !!this.level.finish);
    }
  }

  /** Point the arrow at the delivery bay. `angle` is clockwise from straight up the screen, radians. */
  navigate(angle: number, distance: number): void {
    this.navArrow.style.transform = `rotate(${angle}rad)`;
    const text = String(Math.round(distance));
    if (text !== this.distanceText) this.navDistance.textContent = this.distanceText = text;
  }

  /** The key list along the bottom, for driving or for being on foot. */
  setMode(onFoot: boolean): void {
    if (onFoot === this.onFoot) return;
    this.onFoot = onFoot;
    this.help.innerHTML = onFoot ? HELP_ON_FOOT : HELP_DRIVING;
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

  /** The page shown when a run ends: what arrived, what it was worth, and which stars that earns. */
  showResult(result: Result, fullValue: number): void {
    const failed = result.failure !== undefined;
    const passed = !failed && result.stars > 0;
    const [title, reason] = failed ? FAILURES[result.failure!] : [passed ? '送達！' : '未達標', ''];
    el('result-title').textContent = title;
    el('result-title').className = passed ? 'passed' : 'failed';
    el('result-stars').textContent = '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars);
    el('result-reason').textContent = reason;

    const { intact, damaged, destroyed, lost } = result.tally;
    const total = intact + damaged + destroyed + lost;
    const count = (n: number, bad = false) => `<span${bad && n > 0 ? ' class="bad"' : ''}>${n} 件</span>`;
    const row = (label: string, value: string, main = false) =>
      `<div class="result-row${main ? ' main' : ''}"><span>${label}</span>${value}</div>`;
    el('result-rows').innerHTML = [
      row('送達價值', `<span>${money(result.value)} / ${money(fullValue)}（${Math.floor(result.fraction * 100)}%）</span>`, true),
      row('完好送達', `<span>${intact} / ${total} 件</span>`),
      row('受損', count(damaged, true)),
      row('全毀', count(destroyed, true)),
      row('遺失', count(lost, true)),
      row('用時', `<span>${clock(result.seconds)}</span>`),
    ].join('');

    const [pass, two] = this.level.stars;
    const enough = !failed && result.fraction >= two;
    const goals: [string, boolean][] = [
      [pass > 0 ? `送達價值 ${Math.round(pass * 100)}% 以上` : '抵達卸貨區', !failed && result.fraction >= pass],
      [`送達價值 ${Math.round(two * 100)}% 以上`, enough],
      [`達成兩星，並在 ${clock(this.level.par)} 內送達`, enough && result.seconds <= this.level.par],
    ];
    el('result-goals').innerHTML = goals
      .map(([text, met], i) => `<div class="result-goal${met ? ' met' : ''}"><span class="star">${'★'.repeat(i + 1)}</span>${text}${met ? '　✓' : ''}</div>`)
      .join('');
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
