import type { LevelDef } from './levels/types';
import type { Result } from './sim/sim';

export const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

function clock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const el = (id: string) => document.getElementById(id)!;

const HELP_DRIVING =
  '<b>W</b> 前進　<b>Shift</b> 急加速　<b>S</b> 煞車（按住越久越重）、倒車　<b>A / D</b> 轉向　<b>空白鍵</b> 手煞車　<b>C</b> 下車　<b>R</b> 重來　<b>滾輪</b> 縮放';
const HELP_ON_FOOT =
  '<b>WASD</b> 移動　<b>Shift</b> 奔跑　<b>空白鍵</b> 跳躍　<b>E</b> 舉起、放下　<b>滑鼠</b> 瞄準　<b>按住左鍵</b> 蓄力拋出　<b>右鍵</b> 取消　<b>C</b> 上車　<b>R</b> 重來';

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
  private readonly result = el('result');
  private readonly banner = el('banner');
  private readonly prompt = el('prompt');
  private readonly help = el('help');
  private promptText = '';
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
    goal.style.left = `${level.stars[0] * 100}%`;
    el('timer-stat').hidden = freePlay;
    this.nav.hidden = freePlay;
    this.showBanner();
  }

  /** The level's name and goal, shown briefly at the start. */
  showBanner(): void {
    el('banner-title').textContent = this.level.name;
    el('banner-brief').textContent = this.level.finish
      ? `${this.level.brief}，送達價值需達 ${Math.round(this.level.stars[0] * 100)}%`
      : this.level.brief;
    // Restart the fade-out animation.
    this.banner.hidden = true;
    void this.banner.offsetWidth;
    this.banner.hidden = false;
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
      this.valueFill.style.backgroundColor = kept >= two ? '#6fd08c' : kept >= pass ? '#ffd166' : '#ff6b5a';
    }

    const time = clock(seconds);
    if (time !== this.timerText) this.timerEl.textContent = this.timerText = time;
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

  showResult(result: Result, fullValue: number): void {
    if (result.overturned) {
      el('result-title').textContent = '翻車了';
      el('result-title').className = 'failed';
      el('result-stars').textContent = '☆☆☆';
      el('result-value').textContent = '貨車翻覆，配送失敗';
      el('result-detail').textContent = `用時 ${clock(result.seconds)}`;
      this.result.hidden = false;
      return;
    }
    const passed = result.stars > 0;
    el('result-title').textContent = passed ? '送達！' : '未達標';
    el('result-title').className = passed ? 'passed' : 'failed';
    el('result-stars').textContent = '★'.repeat(result.stars) + '☆'.repeat(3 - result.stars);
    el('result-value').textContent = `${money(result.value)} / ${money(fullValue)}`;
    const needed = Math.round(this.level.stars[0] * 100);
    el('result-detail').textContent =
      `送達 ${Math.floor(result.fraction * 100)}%（需 ${needed}%）　用時 ${clock(result.seconds)}`;
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
  }
}
