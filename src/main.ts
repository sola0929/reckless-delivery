import { levelStates, loadBest } from './best';
import { loadChoice, saveChoice, type QualityChoice } from './graphics-choice';
import { playMusic, soundButtons, uiSound } from './jukebox';
import { soundSettings } from './sound-settings';
import { FIRST_LEVEL, FREE_PLAY, LEVELS, LEVEL_LIST } from './levels';

// The page is the main menu until a level is named in its address, and the game after that.
// Going back to the menu is going back to the bare address.
const chosen = new URLSearchParams(location.search).get('level');
const states = levelStates(LEVEL_LIST);
/** Whether a level may be played: free play always, a delivery once it is open. */
const playable = (id: string) => id === FREE_PLAY.id || ['open', 'done'].includes(states[LEVEL_LIST.findIndex((level) => level.id === id)]);

if (chosen && LEVELS[chosen] && playable(chosen)) void import('./game');
else showMenu();

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
    choices()[0]?.focus();
  };

  // A card for each delivery: where it stands, and the best run of it so far.
  const list = document.getElementById('menu-level-list')!;
  const LABEL = { done: '已完成', open: '可挑戰', locked: '未解鎖', soon: '待更新' };
  const LOCK = '<svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3h2v11H5V10zm2 0h6V7a3 3 0 0 0-6 0z"/></svg>';
  let earned = 0;
  LEVEL_LIST.forEach(({ id, name, badge, note }, i) => {
    const state = states[i];
    const best = state === 'done' ? loadBest(id) : null;
    earned += best?.stars ?? 0;
    const stars = [0, 1, 2].map((n) => `<span${best && n < best.stars ? ' class="on"' : ''}>★</span>`).join('');
    const record =
      state === 'done' ? `最高送達 ${Math.floor(best!.fraction * 100)}%　最快 ${clock(best!.seconds)}`
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
    card.addEventListener('click', () => play(id));
    list.append(card);
  });
  document.getElementById('menu-level-stars')!.textContent = `${earned} / ${LEVEL_LIST.length * 3}`;
  const free = document.getElementById('menu-free')!;
  free.innerHTML = `<div class="level-thumb ${FREE_PLAY.id}"><span>${FREE_PLAY.badge}</span></div><div><div class="level-name">${FREE_PLAY.name}</div><div class="level-note">${FREE_PLAY.note}</div></div><div class="level-state">自由模式</div>`;
  free.addEventListener('click', () => play(FREE_PLAY.id));

  // "Start" goes to the delivery furthest along that can be played.
  const next = LEVEL_LIST.filter((_, i) => states[i] === 'open' || states[i] === 'done').pop()?.id ?? FIRST_LEVEL;
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

  document.getElementById('menu-start')!.addEventListener('click', () => play(next));
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

  soundButtons(menu);
  playMusic('menu');
  menu.hidden = false;
  open('menu-home');
}
