import { loadBest } from './best';
import { playMusic, soundButtons } from './jukebox';
import { FIRST_LEVEL, LEVELS, LEVEL_LIST } from './levels';

// The page is the main menu until a level is named in its address, and the game after that.
// Going back to the menu is going back to the bare address.
const chosen = new URLSearchParams(location.search).get('level');

if (chosen && LEVELS[chosen]) void import('./game');
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
    return [...page.querySelectorAll<HTMLElement>('button')];
  };
  const open = (id: string) => {
    for (const page of pages) page.hidden = page.id !== id;
    choices()[0]?.focus();
  };

  // A card for each level, with the best run so far.
  const list = document.getElementById('menu-level-list')!;
  for (const { id, name, badge, note, scored } of LEVEL_LIST) {
    const best = scored ? loadBest(id) : null;
    const record = !scored
      ? ''
      : best
        ? `<div class="level-best"><span class="stars">${'★'.repeat(best.stars)}${'☆'.repeat(3 - best.stars)}</span>最佳 ${clock(best.seconds)}　送達 ${Math.floor(best.fraction * 100)}%</div>`
        : '<div class="level-best"><span class="stars none">☆☆☆</span><span class="none">還沒有紀錄</span></div>';
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'level-card';
    card.innerHTML = `<div class="level-thumb ${id}">${badge}</div><div><div class="level-name">${name}</div><div class="level-note">${note}</div>${record}</div>`;
    card.addEventListener('click', () => play(id));
    list.append(card);
  }

  document.getElementById('menu-start')!.addEventListener('click', () => play(FIRST_LEVEL));
  for (const button of menu.querySelectorAll<HTMLElement>('[data-page]')) {
    button.addEventListener('click', () => open(button.dataset.page!));
  }

  // The arrow keys walk the list; Esc goes back to the first page.
  window.addEventListener('keydown', (e) => {
    const list = choices();
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (e.code === 'ArrowDown' || e.code === 'KeyS') list[(at + 1) % list.length]?.focus();
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') list[(at - 1 + list.length) % list.length]?.focus();
    else if (e.code === 'Escape') open('menu-home');
    else return;
    e.preventDefault();
  });

  soundButtons(menu);
  playMusic('menu');
  menu.hidden = false;
  open('menu-home');
}
