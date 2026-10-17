import { levelStates, loadBest } from './best';
import { Pad, stepFocus } from './gamepad';
import { setStage, startLoading } from './loading';
import { loadChoice, saveChoice, type QualityChoice } from './graphics-choice';
import { playMusic, soundButtons, uiSound } from './jukebox';
import { soundSettings } from './sound-settings';
import { FIRST_LEVEL, FREE_PLAY, LEVELS, LEVEL_LIST, TUTORIAL } from './levels';

// The page is the main menu until a level is named in its address, and the game after that.
// Going back to the menu is going back to the bare address.
const chosen = new URLSearchParams(location.search).get('level');
// The controller is only switched on in development for now (see gamepad.ts): nothing is said of it elsewhere.
if (!import.meta.env.DEV) for (const el of document.querySelectorAll('.pad-only')) el.remove();
// Level 1 was the flat city until it went onto its hillside: whoever passed it then keeps that, and level 2 stays open.
try {
  const old = localStorage.getItem('cargo-best:city');
  if (old && !localStorage.getItem('cargo-best:hillcity')) localStorage.setItem('cargo-best:hillcity', old);
} catch {
  // No storage: nothing to carry over.
}
// On a phone or tablet, with nothing but a touch screen: say once a visit that it wants a keyboard or a controller.
const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
let noted = false;
try {
  noted = sessionStorage.getItem('cargo-phone-noted') === '1';
} catch {
  // No storage: it is shown again next time.
}
if (touchOnly && !noted) {
  const note = document.getElementById('phone-note')!;
  note.hidden = false;
  document.getElementById('phone-go')!.addEventListener('click', () => {
    note.hidden = true;
    try {
      sessionStorage.setItem('cargo-phone-noted', '1');
    } catch {
      // Shown again on the next page, then.
    }
  });
}

const states = levelStates(LEVEL_LIST);
/** Whether a level may be played: free play always, a delivery once it is open. */
const playable = (id: string) => id === TUTORIAL.id || FREE_PLAY.some((level) => level.id === id) || ['open', 'done'].includes(states[LEVEL_LIST.findIndex((level) => level.id === id)]);

if (chosen && LEVELS[chosen] && playable(chosen)) void loadGame(chosen);
else {
  document.getElementById('loading')!.hidden = true;
  showMenu();
}

declare const __GAME_CHUNK__: { file: string; bytes: number } | null;

/**
 * Bring in the game with the loading screen up. Its script is fetched first, counted as it comes, so the truck moves
 * with it; the import after that finds it already here. Where it cannot be counted, the truck creeps on regardless.
 */
async function loadGame(levelId: string): Promise<void> {
  // A delivery has its number; the tutorial is the tutorial; anything from free play is just free play.
  const delivery = LEVEL_LIST.find((level) => level.id === levelId);
  const entry = delivery ?? (levelId === TUTORIAL.id ? TUTORIAL : FREE_PLAY.find((level) => level.id === levelId));
  startLoading(entry ? { tag: delivery ? `第 ${delivery.badge} 關` : entry === TUTORIAL ? '教學' : '自由模式', name: entry.name, note: entry.note } : null);
  const chunk = __GAME_CHUNK__;
  let counted = false;
  if (chunk) {
    try {
      const response = await fetch(new URL(chunk.file, document.baseURI));
      const reader = response.body?.getReader();
      if (response.ok && reader) {
        let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          got += value.byteLength;
          setStage(0, got / chunk.bytes);
        }
        counted = true;
      }
    } catch {
      // Counted or not, the import still brings it.
    }
  }
  // Fetched, it still has to be read and started; not counted, it is still coming. Either way it creeps on meanwhile.
  if (counted) setStage(1);
  let creep = 0;
  const timer = window.setInterval(() => {
    creep += (0.9 - creep) * 0.05;
    if (counted) setStage(1, creep * 0.5);
    else setStage(0, creep);
  }, 100);
  await import('./game');
  window.clearInterval(timer);
}

function play(levelId: string): void {
  location.search = `?level=${levelId}`;
}

function clock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function showMenu(): void {
  document.body.classList.add('in-menu');
  const menu = document.getElementById('menu')!;
  const pages = [...menu.querySelectorAll<HTMLElement>('.menu-page')];

  /** Everything on the page that can be chosen, top to bottom. */
  const choices = (): HTMLElement[] => {
    const page = pages.find((p) => !p.hidden)!;
    return [...page.querySelectorAll<HTMLElement>('button:not(:disabled)')];
  };
  const open = (id: string) => {
    for (const page of pages) page.hidden = page.id !== id;
    // The level page opens on what "Start" would play, its row under the keys.
    if (id === 'menu-levels') (rows.get(next) ?? choices()[0])?.focus();
    else choices()[0]?.focus();
  };

  // A card for each delivery: where it stands, and the best run of it so far; the tutorial as a strip above them. Choosing one
  // shows it in the preview to the right of them; going is the preview's own button, Enter, or a second click. With no room
  // for the preview, a card goes straight in, as it used to.
  const list = document.getElementById('menu-level-list')!;
  const LABEL = { done: '已完成', open: '可挑戰', locked: '未解鎖', soon: '待更新' };
  const LOCK = '<svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3h2v11H5V10zm2 0h6V7a3 3 0 0 0-6 0z"/></svg>';
  const rows = new Map<string, HTMLButtonElement>();
  const entries = [TUTORIAL, ...LEVEL_LIST];
  const stateOf = (id: string) => (id === TUTORIAL.id ? (loadBest(id) ? 'done' : 'open') : states[LEVEL_LIST.findIndex((level) => level.id === id)]);
  const previewing = () => document.getElementById('level-preview')!.offsetParent !== null;
  const hook = (id: string, button: HTMLButtonElement) => {
    // Focus chooses it, from the keys as from the mouse; a click not from the mouse (Enter, the controller's A) goes.
    button.addEventListener('focus', () => choose(id));
    button.addEventListener('click', (e) => (e.detail === 0 || !previewing() ? play(id) : choose(id)));
    button.addEventListener('dblclick', () => play(id));
    rows.set(id, button);
  };
  {
    const done = loadBest(TUTORIAL.id) !== null;
    const strip = document.createElement('button');
    strip.type = 'button';
    strip.className = 'level-free tutorial-strip';
    strip.innerHTML = `<div class="level-thumb tutorial"><span>${TUTORIAL.badge}</span></div><div><div class="level-name">${TUTORIAL.name}</div><div class="level-note">${TUTORIAL.note}</div></div><div class="level-state${done ? ' done' : ''}">${done ? '已完成' : '教學'}</div>`;
    hook(TUTORIAL.id, strip);
    list.before(strip);
  }
  let earned = 0;
  LEVEL_LIST.forEach(({ id, name, badge, note }, i) => {
    const state = states[i];
    const best = state === 'done' ? loadBest(id) : null;
    earned += best?.stars ?? 0;
    const stars = [0, 1, 2].map((n) => `<span${best && n < best.stars ? ' class="on"' : ''}>★</span>`).join('');
    const record =
      state === 'done' ? `最高送達 ${Math.floor(best!.fraction * 100)}%　最快 ${best!.seconds != null ? clock(best!.seconds) : '－'}`
      : state === 'open' ? '還沒有紀錄'
      : state === 'locked' ? '完成上一關後開放'
      : '製作中，敬請期待';
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `level-card ${state}`;
    card.disabled = state === 'locked' || state === 'soon';
    card.innerHTML =
      `<div class="level-thumb ${id}"><span>${badge}</span>${state === 'locked' ? LOCK : ''}</div>` +
      `<div class="level-state">${LABEL[state]}</div>` +
      `<div class="level-name">${name}</div><div class="level-note">${note}</div>` +
      `<div class="level-stars">${stars}</div><div class="level-best">${record}</div>`;
    hook(id, card);
    list.append(card);
  });
  document.getElementById('menu-level-stars')!.textContent = `${earned} / ${LEVEL_LIST.length * 3}`;
  // Free play, in development only, goes straight in: there is nothing to preview.
  const free = document.getElementById('menu-free')!;
  for (const { id, name, badge, note } of FREE_PLAY) {
    const strip = document.createElement('button');
    strip.type = 'button';
    strip.className = 'level-free';
    strip.innerHTML = `<div class="level-thumb ${id}"><span>${badge}</span></div><div><div class="level-name">${name}</div><div class="level-note">${note}</div></div><div class="level-state">自由模式</div>`;
    strip.addEventListener('click', () => play(id));
    free.append(strip);
  }

  // The preview: its pictures in turn, each fading into the next, with dots to go to any; what it is; and the way in.
  const preview = document.getElementById('level-preview')!;
  const shots = preview.querySelector<HTMLElement>('.preview-shots')!;
  const caption = preview.querySelector<HTMLElement>('.preview-caption')!;
  const dots = preview.querySelector<HTMLElement>('.preview-dots')!;
  const go = document.getElementById('preview-go') as HTMLButtonElement;
  let chosenId = '';
  let shown = 0;
  let turn = 0;
  const show = (n: number) => {
    const pictures = [...shots.querySelectorAll('img')];
    if (!pictures.length) return;
    shown = (n + pictures.length) % pictures.length;
    pictures.forEach((img, k) => img.classList.toggle('on', k === shown));
    [...dots.children].forEach((dot, k) => dot.classList.toggle('on', k === shown));
    caption.textContent = pictures[shown].alt;
  };
  const rotate = () => {
    window.clearInterval(turn);
    turn = window.setInterval(() => show(shown + 1), 3200);
  };
  function choose(id: string): void {
    if (id === chosenId) return;
    chosenId = id;
    const entry = entries.find((level) => level.id === id)!;
    const state = stateOf(id);
    const tutorial = entry === TUTORIAL;
    for (const [rowId, row] of rows) row.classList.toggle('chosen', rowId === id);
    for (const img of shots.querySelectorAll('img')) img.remove();
    dots.replaceChildren();
    (entry.previews ?? []).forEach((text, k) => {
      const img = document.createElement('img');
      img.src = `previews/${id}-${k}.jpg`;
      img.alt = text;
      img.addEventListener('error', () => img.remove());
      caption.before(img);
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.tabIndex = -1;
      dot.setAttribute('aria-label', text);
      dot.addEventListener('click', () => {
        show(k);
        rotate();
      });
      dots.append(dot);
    });
    show(0);
    rotate();
    const delivery = LEVEL_LIST.find((level) => level.id === id);
    preview.querySelector('.preview-tag')!.textContent = delivery ? `第 ${delivery.badge} 關` : '教學';
    preview.querySelector('.preview-name')!.textContent = entry.name;
    preview.querySelector('.preview-note')!.textContent = entry.note;
    const [count, worth] = entry.load ?? [0, 0];
    preview.querySelector('.preview-facts')!.innerHTML =
      (count ? `<span>貨物 <b>${count}</b> 件　價值 <b>$${worth.toLocaleString()}</b></span>` : '') +
      (tutorial ? '<span>不計分，隨時可以跳過</span>' : '<span><i>★</i> 抵達　<i>★★</i> 送達 30%　<i>★★★</i> 送達 60%</span>');
    const best = state === 'done' ? loadBest(id) : null;
    preview.querySelector('.preview-best')!.textContent = tutorial ? '' :
      best ? `最佳紀錄：送達 ${Math.floor(best.fraction * 100)}%　最快 ${best.seconds != null ? clock(best.seconds) : '－'}`
      : state === 'locked' ? '完成上一關後開放'
      : state === 'soon' ? '製作中，敬請期待'
      : '還沒有紀錄';
    go.disabled = state === 'locked' || state === 'soon';
  }
  go.addEventListener('click', () => play(chosenId));

  // "Start" goes to the first delivery not yet passed, or the first one when all are.
  const next = LEVEL_LIST.find((_, i) => states[i] === 'open')?.id ?? FIRST_LEVEL;
  // Said under it: where that is, and the stars so far.
  {
    const entry = LEVEL_LIST.find((level) => level.id === next)!;
    const played = states.some((state) => state === 'done');
    const all = states.every((state) => state === 'done');
    const where = `第 ${entry.badge} 關　${entry.name}`;
    document.getElementById('menu-start-note')!.innerHTML =
      (all ? `全部送達！從第 ${entry.badge} 關再跑一次` : played ? `繼續：${where}` : `從${where}開始`) +
      (played ? `<span>★ ${earned} / ${LEVEL_LIST.length * 3}</span>` : '');
  }
  // Settings: the volumes and the picture quality, the same ones the pause menu has.
  const sfx = document.getElementById('set-sfx') as HTMLInputElement;
  const music = document.getElementById('set-music') as HTMLInputElement;
  const mute = document.getElementById('set-mute') as HTMLInputElement;
  soundSettings.watch((settings) => {
    sfx.value = String(Math.round(settings.sfx * 100));
    music.value = String(Math.round(settings.music * 100));
    mute.checked = settings.muted;
  });
  sfx.addEventListener('input', () => soundSettings.set({ sfx: Number(sfx.value) / 100 }));
  // Let go of the slider, and hear how loud that is.
  sfx.addEventListener('change', () => uiSound('confirm'));
  music.addEventListener('input', () => soundSettings.set({ music: Number(music.value) / 100 }));
  mute.addEventListener('change', () => soundSettings.set({ muted: mute.checked }));
  const qualities = [...menu.querySelectorAll<HTMLButtonElement>('#set-quality button')];
  const showQuality = () => qualities.forEach((button) => button.classList.toggle('on', button.dataset.quality === loadChoice()));
  for (const button of qualities) {
    button.addEventListener('click', () => {
      saveChoice(button.dataset.quality as QualityChoice);
      showQuality();
    });
  }
  showQuality();

  // "Start", the first time, offers the tutorial first to whoever has not done it.
  document.getElementById('menu-start')!.addEventListener('click', () => {
    let offered = true;
    try {
      offered = localStorage.getItem('cargo-tutorial-offered') === '1' || loadBest(TUTORIAL.id) !== null;
      localStorage.setItem('cargo-tutorial-offered', '1');
    } catch {
      // No storage: no offer, rather than one every time.
    }
    if (offered) play(next);
    else open('menu-offer');
  });
  document.getElementById('offer-tutorial')!.addEventListener('click', () => play(TUTORIAL.id));
  document.getElementById('offer-skip')!.addEventListener('click', () => play(next));
  for (const button of menu.querySelectorAll<HTMLElement>('[data-page]')) {
    button.addEventListener('click', () => open(button.dataset.page!));
  }

  // The arrow keys walk the list; Esc goes back to the first page.
  window.addEventListener('keydown', (e) => {
    const list = choices();
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (['ArrowDown', 'KeyS', 'ArrowRight', 'KeyD'].includes(e.code)) list[(at + 1) % list.length]?.focus();
    else if (['ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA'].includes(e.code)) list[(at - 1 + list.length) % list.length]?.focus();
    else if (e.code === 'Escape') open('menu-home');
    else return;
    e.preventDefault();
  });

  // The controller: the d-pad or stick walks the list, A presses, B goes back to the first page.
  const pad = new Pad();
  const readPad = () => {
    pad.poll();
    if (pad.connected) {
      stepFocus(choices(), pad.takeStep());
      const focused = document.activeElement as HTMLElement | null;
      if (pad.take('a') && focused && choices().includes(focused)) focused.click();
      if (pad.take('b')) open('menu-home');
    }
    requestAnimationFrame(readPad);
  };
  requestAnimationFrame(readPad);

  soundButtons(menu);
  playMusic('menu');
  menu.hidden = false;
  open('menu-home');
}
