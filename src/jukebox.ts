// Music and the sounds of the menus. Plain audio elements: these are the same in the main
// menu, where the game and its sound engine are not loaded, as in the game itself.
import { soundSettings } from './sound-settings';

const url = (file: string) => `${import.meta.env.BASE_URL}audio/${file}`;

const UI = {
  move: 'ui-move.ogg',
  confirm: 'ui-confirm.ogg',
  back: 'ui-back.ogg',
  open: 'ui-open.ogg',
  close: 'ui-close.ogg',
  win: 'ui-win.ogg',
  fail: 'ui-fail.ogg',
};
// One tune for now, in the menu and on the road.
const TRACKS = { menu: 'music-level.mp3', level: 'music-level.mp3' };
/** Music sits well under everything else even at full. */
const MUSIC_LEVEL = 0.5;

const samples = new Map<string, HTMLAudioElement>();

/** A click, a chime: one of the small sounds a menu makes. */
export function uiSound(name: keyof typeof UI): void {
  const { sfx, muted } = soundSettings.get();
  if (muted || sfx <= 0) return;
  let sample = samples.get(name);
  if (!sample) {
    sample = new Audio(url(UI[name]));
    samples.set(name, sample);
  }
  // A copy each time, so that moving quickly down a list doesn't cut each sound off with the next.
  const voice = sample.cloneNode() as HTMLAudioElement;
  voice.volume = Math.min(1, sfx * 0.7);
  void voice.play().catch(() => {
    // Not allowed to make a sound yet: the page hasn't been clicked.
  });
}

let music: HTMLAudioElement | null = null;
let waiting = false;

function start(): void {
  if (!music) return;
  void music.play().then(
    () => {
      waiting = false;
    },
    () => {
      // Browsers hold music back until the page has been clicked or a key pressed.
      if (waiting) return;
      waiting = true;
      const retry = () => {
        window.removeEventListener('pointerdown', retry);
        window.removeEventListener('keydown', retry);
        waiting = false;
        start();
      };
      window.addEventListener('pointerdown', retry);
      window.addEventListener('keydown', retry);
    },
  );
}

/** Start a track, looping; or stop the music with null. */
export function playMusic(track: keyof typeof TRACKS | null): void {
  if (music) {
    music.pause();
    music = null;
  }
  if (!track) return;
  music = new Audio(url(TRACKS[track]));
  music.loop = true;
  soundSettings.watch(({ music: level, muted }) => {
    if (music) music.volume = muted ? 0 : Math.min(1, level * MUSIC_LEVEL);
  });
  start();
}

// Out of sight, out of hearing.
document.addEventListener('visibilitychange', () => {
  if (!music) return;
  if (document.hidden) music.pause();
  else start();
});

/** Give every button under `root` a sound: one as the cursor or the keys reach it, another when it is chosen. */
export function soundButtons(root: ParentNode): void {
  for (const button of root.querySelectorAll('button')) {
    button.addEventListener('pointerenter', () => uiSound('move'));
    button.addEventListener('focus', () => uiSound('move'));
    button.addEventListener('click', () => uiSound(button.classList.contains('back') || button.classList.contains('leave') ? 'back' : 'confirm'));
  }
}
