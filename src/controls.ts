// The controls, said once: for keyboard and mouse and for the controller. The keyboard's in groups, each a key and what
// it does, with a word more under it where one is wanted; the controller's as a drawing of it, a line from each button
// used to what it does, driving or on foot, named as the controller plugged in names them. The main menu's page and the
// pause menu's both draw them from here.

import { padKind, padName, type PadKind } from './gamepad';

type Control = [key: string, what: string, more?: string];
type Group = [title: string, controls: Control[]];

const KEYBOARD: Group[] = [
  ['開車', [
    ['W', '前進'],
    ['S', '煞車、倒車', '按住越久越重'],
    ['A / D', '左右轉向'],
    ['Shift', '急加速'],
    ['空白鍵', '手煞車'],
    ['H', '喇叭', '趕開附近的人'],
  ]],
  ['下車', [
    ['C', '上下車'],
    ['F', '舉起、放下貨物'],
    ['左鍵', '按住蓄力', '放開拋出，右鍵取消'],
    ['空白鍵', '跳躍', '拿重物時不能跳'],
  ]],
  ['其他', [
    ['Q / E', '轉視角', '開車時看側邊；下車時轉向'],
    ['右鍵拖曳', '轉視角', '看後方來車、側邊'],
    ['滾輪', '拉近、拉遠'],
    ['Esc', '暫停'],
    ['F1', '畫面下方的按鍵提示'],
  ]],
];

/** The controller's parts that do something, by their Xbox names. */
type Part = 'LT' | 'LB' | 'LS' | 'DPAD' | 'Back' | 'RT' | 'RB' | 'Y' | 'X' | 'B' | 'A' | 'RS' | 'Start';

/** What each part does, driving and on foot. */
const PAD: Record<'drive' | 'foot', Partial<Record<Part, string>>> = {
  drive: {
    LT: '煞車、倒車', LB: '喇叭', LS: '轉向', DPAD: '↑↓ 拉近、拉遠',
    RT: '油門', RB: '手煞車', Y: '下車', X: '急加速', RS: '轉視角', Start: '暫停',
  },
  foot: {
    LT: '取消拋出', LB: '向左轉視角', LS: '移動',
    RT: '按住蓄力，放開拋出', RB: '向右轉視角', Y: '上車', X: '奔跑', B: '舉起、放下', A: '跳躍', RS: '轉視角；拿著時瞄準', Start: '暫停',
  },
};

/** Where each part is on the drawing (its box 0 0 760 330), and which side its words go. The PlayStation pad has its sticks side by side below, the d-pad up where the Xbox's left stick is. */
const AT = (kind: PadKind): Record<Part, [number, number, 'L' | 'R']> => ({
  LT: [282, 58, 'L'], LB: [292, 84, 'L'],
  LS: kind === 'ps' ? [335, 205, 'L'] : [292, 148, 'L'],
  DPAD: kind === 'ps' ? [292, 148, 'L'] : [335, 205, 'L'],
  Back: [346, 128, 'L'],
  RT: [478, 58, 'R'], RB: [468, 84, 'R'],
  Y: [468, 124, 'R'], X: [446, 146, 'R'], B: [490, 146, 'R'], A: [468, 168, 'R'],
  RS: [425, 205, 'R'], Start: [414, 128, 'R'],
});

/** The face buttons' colours: the Xbox's letters, the PlayStation's shapes. */
const FACE: Record<PadKind, Record<'A' | 'B' | 'X' | 'Y', string>> = {
  xbox: { A: '#6fd08c', B: '#ff7a6b', X: '#5ea8ff', Y: '#ffd166' },
  ps: { A: '#7fb0ff', B: '#ff7a8a', X: '#f29ad8', Y: '#5fd6b8' },
};

/** What each part does in few words, where the drawing is small and its words large. */
const SHORT: Partial<Record<string, string>> = { '↑↓ 拉近、拉遠': '縮放', '按住蓄力，放開拋出': '蓄力拋出', '轉視角；拿著時瞄準': '轉視角／瞄準', '向左轉視角': '左轉視角', '向右轉視角': '右轉視角' };

/**
 * The controller drawn, with what each part does said beside it, for driving or on foot. Compact, for a narrow box, the
 * controller is drawn smaller and the words larger and fewer.
 */
function padDrawing(mode: 'drive' | 'foot', compact: boolean): string {
  const kind = padKind();
  const at = AT(kind);
  const does = PAD[mode];
  const used = (part: Part) => does[part] !== undefined;
  const ink = (part: Part) => (used(part) ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)');
  const name = (part: Part) => (part === 'LS' ? '左搖桿' : part === 'RS' ? '右搖桿' : part === 'DPAD' ? '十字鍵' : padName(part));
  let art = '';
  let words = '';
  // The body: two grips and the bridge between, faint, its outline a little brighter.
  art += '<path d="M268 96 Q380 80 492 96 Q536 104 552 160 L574 254 Q582 298 546 300 Q520 301 500 270 L470 232 L290 232 L260 270 Q240 301 214 300 Q178 298 186 254 L208 160 Q224 104 268 96 Z" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>';
  // The triggers and the bumpers over them.
  for (const [part, x] of [['LT', 282], ['RT', 478]] as const) art += `<rect x="${x - 20}" y="46" width="40" height="22" rx="8" fill="none" stroke="${ink(part)}" stroke-width="2"/>`;
  for (const [part, x] of [['LB', 292], ['RB', 468]] as const) art += `<rect x="${x - 30}" y="78" width="60" height="12" rx="6" fill="none" stroke="${ink(part)}" stroke-width="2"/>`;
  // The sticks, the d-pad, the two small buttons in the middle.
  for (const part of ['LS', 'RS'] as const) {
    const [x, y] = at[part];
    art += `<circle cx="${x}" cy="${y}" r="22" fill="rgba(255,255,255,0.05)" stroke="${ink(part)}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="12" fill="none" stroke="${ink(part)}" stroke-width="1.5"/>`;
  }
  {
    const [x, y] = at.DPAD;
    art += `<path d="M${x - 7} ${y - 22} h14 v15 h15 v14 h-15 v15 h-14 v-15 h-15 v-14 h15 z" fill="none" stroke="${ink('DPAD')}" stroke-width="2"/>`;
  }
  for (const part of ['Back', 'Start'] as const) {
    const [x, y] = at[part];
    art += `<rect x="${x - 9}" y="${y - 5}" width="18" height="10" rx="5" fill="none" stroke="${ink(part)}" stroke-width="1.5"/>`;
  }
  // The face buttons, each in its colour, named on it.
  for (const part of ['A', 'B', 'X', 'Y'] as const) {
    const [x, y] = at[part];
    const colour = used(part) ? FACE[kind][part] : 'rgba(255,255,255,0.3)';
    art += `<circle cx="${x}" cy="${y}" r="11" fill="rgba(0,0,0,0.25)" stroke="${colour}" stroke-width="2"/><text x="${x}" y="${y + 4.5}" text-anchor="middle" font-size="12" font-weight="800" fill="${colour}">${padName(part)}</text>`;
  }
  // Compact, the controller drawn full size and the words round it in larger type, further out: the box is wider than it is tall.
  const size = compact ? 24 : 14.5;
  // What each does, its words in a column either side, in the order the lines leave the controller so that none cross.
  // Each line runs straight out sideways from its button to a rail just outside the controller, then slants to its
  // words. X, hemmed in by the other face buttons, goes up first and out over Y. The pause button's words go above.
  const leave = (part: Part): [number, number][] => (part === 'X' ? [[at.X[0], 100]] : []);
  const line = 'fill="none" stroke="rgba(255,209,102,0.55)" stroke-width="1.3"';
  const label = (part: Part) => {
    const face = (['A', 'B', 'X', 'Y'] as string[]).includes(part);
    const key = face
      ? `<tspan font-weight="800" font-size="${size * 1.15}" fill="${FACE[kind][part as 'A']}">${name(part)}</tspan>`
      : `<tspan font-weight="800" fill="#ffd166">${name(part)}</tspan>`;
    return `${key} ${compact ? SHORT[does[part]!] ?? does[part] : does[part]}`;
  };
  for (const side of ['L', 'R'] as const) {
    const exit = (part: Part) => (leave(part).at(-1) ?? at[part])[1];
    const parts = (Object.keys(at) as Part[]).filter((part) => at[part][2] === side && used(part) && part !== 'Start').sort((p, q) => exit(p) - exit(q));
    const top = compact ? 50 : 52, gap = Math.min(compact ? 46 : 42, ((compact ? 330 : 300) - top) / Math.max(1, parts.length - 1));
    // The rail just clear of the controller's sides, the words a little further out.
    const rail = side === 'L' ? 178 : 582;
    const lx = side === 'L' ? rail - 26 : rail + 26;
    parts.forEach((part, n) => {
      const [x, y] = at[part];
      const ly = top + n * gap;
      const points = [[x, y], ...leave(part), [rail, exit(part)], [lx, ly]];
      words += `<polyline points="${points.map((p) => p.join(',')).join(' ')}" ${line}/><circle cx="${x}" cy="${y}" r="2.5" fill="#ffd166"/>`;
      words += `<text x="${side === 'L' ? lx - 6 : lx + 6}" y="${ly + size / 3}" text-anchor="${side === 'L' ? 'end' : 'start'}" font-size="${size}" fill="#fff">${label(part)}</text>`;
    });
  }
  if (used('Start')) {
    const [x, y] = at.Start;
    words += `<polyline points="${x},${y} ${x},${compact ? 36 : 30}" ${line}/><circle cx="${x}" cy="${y}" r="2.5" fill="#ffd166"/>`;
    words += `<text x="${x}" y="${compact ? 28 : 22}" text-anchor="middle" font-size="${size}" fill="#fff">${label('Start')}</text>`;
  }
  return `<svg class="pad-drawing" viewBox="${compact ? '-62 0 962 346' : '-20 0 800 330'}" role="img" aria-label="手把按鍵說明">${words}${art}</svg>`;
}

export type ControlSet = 'keyboard' | 'pad';

/**
 * The controller's bumpers turning the drawing over where it is shown: LB to driving, RB to on foot, as tabs are turned
 * in most games. Whether one was pressed is asked of the controller by whoever reads it.
 */
export function bumpControls(root: ParentNode, left: boolean, right: boolean): void {
  if (!left && !right) return;
  const tabs = root.querySelector<HTMLElement>('.pad-set:not([hidden]) .pad-modes');
  if (!tabs || tabs.offsetParent === null) return;
  tabs.querySelector<HTMLElement>(`[data-mode="${left ? 'drive' : 'foot'}"]`)?.click();
}

/**
 * Draw the controls into a box: a choice between keyboard and mouse and the controller above them, where the controller
 * is offered (only in development until it has been tried with a real one); the keyboard's groups in two columns, the
 * controller's drawing with a choice of driving or on foot. Returns how to show one set or the other; the drawing is
 * done again each time, so that it names the buttons of whichever controller is plugged in.
 */
export function drawControls(host: HTMLElement, compact = false): (set: ControlSet) => void {
  let mode: 'drive' | 'foot' = 'drive';
  const list = (set: ControlSet, groups: Group[]) =>
    `<div class="control-set" data-set="${set}">` +
    groups.map(([title, controls]) =>
      `<section><h4>${title}</h4><div class="control-grid">` +
      controls.map(([key, what, more]) => `<div class="control"><kbd>${key}</kbd><span>${what}${more ? `<small>${more}</small>` : ''}</span></div>`).join('') +
      '</div></section>').join('') +
    '</div>';
  host.classList.add('controls');
  host.innerHTML =
    '<div class="segments control-tabs"><button type="button" data-keys="keyboard">鍵盤滑鼠</button><button type="button" data-keys="pad">手把</button></div>' +
    list('keyboard', KEYBOARD) +
    '<div class="control-set pad-set" data-set="pad"><div class="pad-modes"><button type="button" data-mode="drive"><kbd data-bumper="LB"></kbd>開車</button><button type="button" data-mode="foot">下車<kbd data-bumper="RB"></kbd></button></div><div class="pad-art"></div></div>';
  const drawPad = () => {
    const art = host.querySelector<HTMLElement>('.pad-art');
    if (!art) return;
    art.innerHTML = padDrawing(mode, compact);
    for (const tab of host.querySelectorAll<HTMLElement>('[data-mode]')) tab.classList.toggle('on', tab.dataset.mode === mode);
    for (const key of host.querySelectorAll<HTMLElement>('[data-bumper]')) key.textContent = padName(key.dataset.bumper!);
  };
  const show = (set: ControlSet) => {
    const shown = set;
    for (const tab of host.querySelectorAll<HTMLElement>('[data-keys]')) tab.classList.toggle('on', tab.dataset.keys === shown);
    for (const group of host.querySelectorAll<HTMLElement>('.control-set')) group.hidden = group.dataset.set !== shown;
    if (shown === 'pad') drawPad();
  };
  for (const tab of host.querySelectorAll<HTMLElement>('[data-keys]')) tab.addEventListener('click', () => show(tab.dataset.keys as ControlSet));
  for (const tab of host.querySelectorAll<HTMLElement>('[data-mode]')) tab.addEventListener('click', () => {
    mode = tab.dataset.mode as 'drive' | 'foot';
    drawPad();
  });
  show('keyboard');
  return show;
}
