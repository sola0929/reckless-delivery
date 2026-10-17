// Messages on the way, in a window like a phone's chat: a notice with a chime first, then it opens and the lines come in turn,
// each after a moment of "typing", the one writing in on the left and the driver on the right; it closes itself after.
// One conversation at a time, with a gap between them. The rest wait their turn, the most pressing first, for a while; one
// that waited too long is let go, but not counted as said, so that it can still come up another time.

import { BOSS, CUSTOMERS, type ChatCue } from './chat-lines';
import { FACES } from './chat-faces';
import { uiSound } from './jukebox';
import type { ChatDesc, Talk } from './levels/types';

/** Seconds the notice shows before the window opens. */
const NOTICE = 1.0;
/** Seconds of "typing" before each line. */
const TYPING = 0.55;
/** Seconds the window stays open after the last line, and takes to close. */
const LINGER = 2.4;
const CLOSING = 0.35;
/** Seconds after one conversation closes before the next may begin. */
const GAP = 5;
/**
 * How likely each happening is to be written about at all; those that happen all the time only now and then, so that they
 * do not crowd out the rest. One let pass is not counted as said and may come up the next time. Unlisted: always.
 * A customer's own word about one of their things wrecked is always said; this is for the boss's general one.
 */
const CHANCE: Partial<Record<ChatCue, number>> = { destroyed: 0.5, fallen: 0.4, hits: 0.3 };
/** Seconds something may wait its turn before it is no longer worth saying. */
const WAIT = 15;
/** Lines kept in sight; older ones go off the top. */
const SHOWN = 4;
/** Which goes first when several are waiting: a place's word, while the truck is still there, then the most pressing. */
const ORDER: (ChatCue | 'place')[] = ['place', 'train', 'destroyed', 'back', 'save', 'near', 'fallen', 'below30', 'below60', 'hits', 'start', 'idle'];

type Who = 'boss' | 'customer';
/** Something waiting to be written about: what it is, and the seconds it may still wait. The words are chosen when it begins. */
interface Pending { cue: ChatCue | 'place'; item?: string; place?: number; left: number }

const el = (id: string) => document.getElementById(id) as HTMLElement;

/** How long a line stays before the next comes, by its length. */
const readTime = (text: string) => Math.min(3.2, Math.max(1.3, 0.9 + text.length * 0.085));

export class Chat {
  private readonly box = el('chat');
  private readonly notice = el('chat-notice');
  private readonly window = el('chat-window');
  private readonly title = el('chat-title');
  private readonly body = el('chat-body');
  private readonly customer;
  /** Conversations already had this run: none is had twice. */
  private readonly used = new Set<Talk>();
  private queue: Pending[] = [];
  private current: { from: Who; talk: Talk } | null = null;
  /** Where the current conversation is: 'notice', then each line's typing and reading, then lingering and closing. */
  private phase: 'idle' | 'notice' | 'typing' | 'reading' | 'linger' | 'closing' = 'idle';
  private line = 0;
  private clock = 0;
  private quiet = 0;
  private bubble: HTMLElement | null = null;

  constructor(private readonly desc: ChatDesc) {
    this.customer = CUSTOMERS[desc.customer];
  }

  /** Something has happened: it is written about when its turn comes, if there is still something unsaid for it. `item` is the kind of thing wrecked. */
  cue(cue: ChatCue, item?: string): void {
    // Once in the line is enough: a second fall while the first is waiting says nothing more.
    if (this.queue.some((p) => p.cue === cue)) return;
    const own = cue === 'destroyed' && item !== undefined && this.pick(this.customer.wrecked[item]) !== null;
    if (!own && Math.random() >= (CHANCE[cue] ?? 1)) return;
    this.queue.push({ cue, item, left: WAIT });
  }

  /** Coming into one of the level's places: its word, when its turn comes. */
  place(index: number): void {
    const spot = this.desc.places?.[index];
    if (!spot || this.used.has(spot.talk)) return;
    this.queue.push({ cue: 'place', place: index, left: WAIT });
  }

  /** No longer worth saying, if it is still waiting: the truck has moved on, or is past the place. */
  drop(cue: ChatCue | 'place', place?: number): void {
    this.queue = this.queue.filter((p) => p.cue !== cue || (place !== undefined && p.place !== place));
  }

  update(dt: number): void {
    this.quiet = Math.max(0, this.quiet - dt);
    for (const p of this.queue) p.left -= dt;
    this.queue = this.queue.filter((p) => p.left > 0);
    if (this.phase === 'idle') {
      if (this.quiet > 0) return;
      this.queue.sort((a, b) => ORDER.indexOf(a.cue) - ORDER.indexOf(b.cue));
      // The first in the line that still has something unsaid; those that have nothing left go.
      while (this.queue.length) {
        const next = this.words(this.queue.shift()!);
        if (next) {
          this.begin(next.from, next.talk);
          break;
        }
      }
      return;
    }
    this.clock -= dt;
    if (this.clock > 0) return;
    const talk = this.current!.talk;
    switch (this.phase) {
      case 'notice':
        this.notice.classList.remove('on');
        this.window.classList.add('on');
        this.typeLine();
        break;
      case 'typing':
        this.bubble!.classList.remove('typing');
        this.bubble!.textContent = talk[this.line][1];
        // Each line that comes in chimes, as on a phone; the driver's own make none.
        if (talk[this.line][0] === 'them') uiSound('message');
        this.phase = 'reading';
        this.clock = readTime(talk[this.line][1]);
        break;
      case 'reading':
        this.line++;
        if (this.line < talk.length) this.typeLine();
        else {
          this.phase = 'linger';
          this.clock = LINGER;
        }
        break;
      case 'linger':
        this.window.classList.remove('on');
        this.phase = 'closing';
        this.clock = CLOSING;
        break;
      case 'closing':
        this.end();
        break;
    }
  }

  /** Everything put away: after the run, or starting it over. Back at the start, everything may be said again. */
  clear(again: boolean): void {
    this.queue = [];
    this.end();
    this.quiet = 0;
    if (again) this.used.clear();
  }

  private pick(pool: Talk[] | undefined): Talk | null {
    const left = (pool ?? []).filter((t) => !this.used.has(t));
    return left.length ? left[Math.floor(Math.random() * left.length)] : null;
  }

  /** Who says what about something that has been waiting: null when there is nothing left unsaid for it. */
  private words(p: Pending): { from: Who; talk: Talk } | null {
    if (p.cue === 'place') {
      const spot = this.desc.places![p.place!];
      return this.used.has(spot.talk) ? null : { from: spot.from ?? 'customer', talk: spot.talk };
    }
    const cue = p.cue;
    if (cue === 'destroyed' && p.item) {
      const talk = this.pick(this.customer.wrecked[p.item]);
      if (talk) return { from: 'customer', talk };
    }
    if (cue === 'near') {
      const talk = this.pick(this.customer.cues.near);
      return talk ? { from: 'customer', talk } : null;
    }
    // The customer and the boss both have something for most things: the customer now and then, the boss otherwise.
    const mine = Math.random() < 0.4 ? this.pick(this.customer.cues[cue]) : null;
    if (mine) return { from: 'customer', talk: mine };
    const boss = this.pick(BOSS[cue]);
    return boss ? { from: 'boss', talk: boss } : null;
  }

  private begin(from: Who, talk: Talk): void {
    this.used.add(talk);
    this.current = { from, talk };
    const boss = from === 'boss';
    const name = boss ? '老闆' : '客戶';
    const face = boss ? FACES.boss : FACES[this.desc.customer];
    this.notice.innerHTML = `<span class="chat-face">${face}</span><span><b>${name}</b> 傳來訊息</span>`;
    this.title.textContent = name;
    this.body.replaceChildren();
    this.box.hidden = false;
    // As wide as the figures above it, whatever they come to.
    this.box.style.width = `${el('stats').offsetWidth}px`;
    this.notice.classList.add('on');
    uiSound('notify');
    this.phase = 'notice';
    this.clock = NOTICE;
    this.line = 0;
  }

  private typeLine(): void {
    const [who, ] = this.current!.talk[this.line];
    const boss = this.current!.from === 'boss';
    const row = document.createElement('div');
    row.className = `chat-row ${who}`;
    const face = who === 'me' ? FACES.me : boss ? FACES.boss : FACES[this.desc.customer];
    row.innerHTML = `<span class="chat-face">${face}</span><span class="chat-bubble typing"><i></i><i></i><i></i></span>`;
    this.bubble = row.querySelector('.chat-bubble');
    this.body.append(row);
    while (this.body.children.length > SHOWN) this.body.firstElementChild!.remove();
    this.phase = 'typing';
    this.clock = TYPING;
  }

  private end(): void {
    if (this.current) this.quiet = GAP;
    this.current = null;
    this.bubble = null;
    this.phase = 'idle';
    this.notice.classList.remove('on');
    this.window.classList.remove('on');
    this.box.hidden = true;
  }
}
