// Sound. The engine and the crashes are recordings (all public domain: see
// public/audio/SOURCES.md), played faster or slower, louder or softer, to fit what is happening.

import { HORN_VOICES, playHorn } from './horns';
import { soundSettings } from './sound-settings';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * How fast the idling recording is played, standing and at top speed. Kept narrow: a
 * recording played much faster than it was made stops sounding like an engine at all.
 */
const IDLE_RATE = 0.92;
const TOP_RATE = 1.4;
/** Extra, with the pedal down. */
const LOAD_RATE = 0.1;
const TOP_SPEED = 30;
/** The stretch of the idle recording that is looped, seconds, and how long its ends are blended over. */
const LOOP_FROM = 0.7;
const LOOP_SECONDS = 4.6;
const LOOP_BLEND = 0.5;
/** A change in the truck's speed smaller than this in one step, m/s, makes no sound. */
const BUMP_QUIET = 0.4;
/** And one this much above that is as loud as a crash gets. */
const BUMP_FULL = 9;
const BUMP_GAP = 0.09;
/** How loud the truck's own crashes are beside everything else. */
const BUMP_LEVEL = 0.62;

const FILES = {
  engine: 'engine-idle.wav',
  mid: ['crash-mid-0.mp3', 'crash-mid-1.mp3', 'crash-mid-2.mp3'],
  hard: ['crash-hard-0.mp3', 'crash-hard-1.mp3'],
  tree: ['tree-fall-0.wav'],
  woodBig: ['wood-big-0.wav', 'wood-big-1.wav'],
  woodSmall: ['wood-small-0.wav', 'wood-small-1.wav'],
  barrel: ['barrel-hit-0.wav', 'barrel-hit-1.wav', 'barrel-hit-2.wav', 'barrel-hit-3.wav'],
  metal: ['metal-clang-0.wav', 'metal-clang-1.wav', 'metal-clang-2.wav', 'metal-clang-3.wav'],
  soft: ['knock-soft-0.ogg', 'knock-soft-1.ogg', 'knock-soft-2.ogg'],
  potBreak: ['pot-break-0.wav', 'pot-break-1.wav'],
  // A light knock and a heavier one, in that order.
  potClink: ['pot-clink-light.wav', 'pot-clink-heavy.wav'],
  splat: ['melon-splat-0.wav'],
  splash: ['splash-0.wav'],
  skid: 'skid-loop.wav',
  train: 'train-loop.wav',
  bell: 'bell-loop.wav',
};
/** For each looping sound: where in its recording the loop starts, how long it is, and how long the join is blended over, seconds. */
const LOOPS = {
  // One squeal, of which only the steady middle is any use for going round and round.
  skid: { from: 0.18, seconds: 0.55, blend: 0.12 },
  train: { from: 0.5, seconds: 5, blend: 0.45 },
  bell: { from: 0.5, seconds: 3.6, blend: 0.3 },
};
/** The lists of one-shot recordings in FILES, as against the single looping ones. */
type Group = { [K in keyof typeof FILES]: (typeof FILES)[K] extends string[] ? K : never }[keyof typeof FILES];
/** Seconds to skip at the start of a recording, where it opens with something other than the crash. */
const LEAD_IN: Record<string, number> = { 'crash-hard-1.mp3': 0.38 };

/** What a thing by the roadside is made of, as far as the noise it makes goes. */
export type Material = 'tree' | 'wood' | 'metal' | 'barrel' | 'soft' | 'ceramic' | 'melon' | 'bone' | 'heavy';

export interface EngineState {
  /** Along the truck's nose, m/s. */
  speed: number;
  /** -1 to 1, as held. */
  throttle: number;
  boosting: boolean;
  /** Whether anyone is in the cab: on foot, the engine only ticks over. */
  driving: boolean;
  /** How hard the tyres are sliding, 0 to 1. */
  skid: number;
  /** How close the nearest train is, 0 out of earshot to 1 right alongside. */
  train: number;
  /** Whether a crossing bell is ringing within earshot. */
  bell: boolean;
}

interface Clip {
  buffer: AudioBuffer;
  /** Where in it to start. */
  from: number;
  /** What to multiply its volume by so that it is as loud as the others of its kind. */
  level: number;
}

/** The things by the roadside: their recordings are evened out, so one take isn't twice as loud as the next. */
const EVENED = new Set(['tree', 'woodBig', 'woodSmall', 'metal', 'barrel', 'soft', 'potBreak', 'potClink', 'splat']);
/** The loudness they are brought to, at their loudest moment. */
const EVEN_TO = 0.3;

export class GameAudio {
  private ctx: AudioContext | null = null;
  master!: GainNode;
  private analyser!: AnalyserNode;

  private engine: AudioBufferSourceNode | null = null;
  private engineGain!: GainNode;
  private engineFilter!: BiquadFilterNode;
  private readonly clips: Record<Group, Clip[]> = { mid: [], hard: [], tree: [], woodBig: [], woodSmall: [], metal: [], barrel: [], soft: [], potBreak: [], potClink: [], splat: [], splash: [] };
  /** The sounds that run on and on, each with its own volume: tyres, trains, the crossing bell. */
  loops: Record<'skid' | 'train' | 'bell', { source: AudioBufferSourceNode; gain: GainNode } | null> = { skid: null, train: null, bell: null };

  private lastBump = 0;
  private lastKnock = 0;
  private lastThud = 0;
  private lastCrunch = 0;
  private lastHorn = 0;
  private paused = false;
  /** How fast the engine recording is playing right now: for the dev checks. */
  engineRate = IDLE_RATE;
  /** Set once every recording has been fetched and decoded. */
  loaded = false;

  constructor() {
    // Browsers keep sound off until the page has been clicked or a key pressed.
    const unlock = () => this.unlock();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
  }

  private unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
      this.build(this.ctx);
      void this.load(this.ctx);
    }
    if (this.ctx.state === 'suspended' && !this.paused) void this.ctx.resume();
  }

  private build(ctx: AudioContext): void {
    this.master = ctx.createGain();
    // As loud as the player has asked for.
    // Set outright rather than eased: the sliders are in the pause menu, where the clock
    // that easing runs on is stopped.
    soundSettings.watch(({ sfx, muted }) => {
      this.master.gain.value = muted ? 0 : sfx;
    });
    // A limiter of sorts, so that a crash on top of the engine doesn't clip.
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -12;
    squash.ratio.value = 5;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.master.connect(squash).connect(this.analyser).connect(ctx.destination);

    // The engine goes through a filter that is nearly shut when coasting and opens under
    // load: the same recording, muffled or bright.
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 900;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter.connect(this.engineGain).connect(this.master);
  }

  private async load(ctx: AudioContext): Promise<void> {
    const fetchBuffer = async (file: string): Promise<AudioBuffer> => {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/${file}`);
      return ctx.decodeAudioData(await response.arrayBuffer());
    };
    try {
      const groups = ['mid', 'hard', 'tree', 'woodBig', 'woodSmall', 'metal', 'barrel', 'soft', 'potBreak', 'potClink', 'splat', 'splash'] as const;
      const [idle, ...sets] = await Promise.all([
        fetchBuffer(FILES.engine),
        ...groups.map((group) => Promise.all(FILES[group].map(fetchBuffer))),
      ]);
      groups.forEach((group, i) => {
        this.clips[group] = (sets[i] as AudioBuffer[]).map((buffer, n) => ({
          buffer,
          from: LEAD_IN[FILES[group][n]] ?? 0,
          level: EVENED.has(group) ? clamp(EVEN_TO / loudest(buffer), 0.25, 5) : 1,
        }));
      });

      this.engine = ctx.createBufferSource();
      this.engine.buffer = seamless(ctx, idle, LOOP_FROM, LOOP_SECONDS, LOOP_BLEND);
      this.engine.loop = true;
      this.engine.playbackRate.value = IDLE_RATE;
      this.engine.connect(this.engineFilter);
      this.engine.start();
      this.loaded = true;

      // The rest can come in a moment later without anyone noticing.
      for (const name of ['skid', 'train', 'bell'] as const) {
        const recording = await fetchBuffer(FILES[name]);
        const source = ctx.createBufferSource();
        const { from, seconds, blend } = LOOPS[name];
        source.buffer = seamless(ctx, recording, from, seconds, blend);
        source.loop = true;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        source.connect(gain).connect(this.master);
        source.start();
        this.loops[name] = { source, gain };
      }
    } catch (error) {
      // No sound is no reason to stop the game.
      console.warn('[audio] could not load the recordings', error);
    }
  }

  /**
   * Call every frame with what the truck is doing. The engine is kept in the background:
   * a low rumble that rises a little with speed and opens up under the pedal.
   */
  update(_dt: number, state: EngineState): void {
    const ctx = this.ctx;
    if (!ctx || !this.engine || this.paused) return;
    const pace = clamp(Math.abs(state.speed) / TOP_SPEED, 0, 1);
    const load = state.driving ? clamp(Math.abs(state.throttle), 0, 1) * (state.boosting ? 1.3 : 1) : 0;

    this.engineRate = IDLE_RATE + pace * (TOP_RATE - IDLE_RATE) + load * LOAD_RATE;
    const t = ctx.currentTime;
    // Slowly, so that tapping the pedal doesn't make the note jump about.
    this.engine.playbackRate.setTargetAtTime(this.engineRate, t, 0.25);
    this.engineFilter.frequency.setTargetAtTime(420 + pace * 500 + load * 1500, t, 0.15);
    const volume = state.driving ? 0.2 + pace * 0.08 + load * 0.16 : 0.09;
    this.engineGain.gain.setTargetAtTime(volume, t, 0.2);

    // Tyres squeal quickly and stop quickly; a train swells and fades as it goes by.
    const { skid, train, bell } = this.loops;
    if (skid) {
      skid.gain.gain.setTargetAtTime(clamp(state.skid, 0, 1) * 0.42, t, 0.06);
      skid.source.playbackRate.setTargetAtTime(0.9 + pace * 0.25, t, 0.2);
    }
    if (train) train.gain.gain.setTargetAtTime(clamp(state.train, 0, 1) ** 2 * 0.9, t, 0.12);
    if (bell) bell.gain.gain.setTargetAtTime(state.bell ? 0.3 : 0, t, 0.08);
  }

  /**
   * The truck has run into something, or something into it. `strength` is how much its
   * speed changed in one step, m/s. A nudge is a short dull thump; harder, and it is a
   * recorded collision; hardest, a whole car crash with the glass going.
   */
  bump(strength: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.loaded || this.paused || ctx.state !== 'running' || strength < BUMP_QUIET) return;
    const t = ctx.currentTime;
    if (t - this.lastBump < BUMP_GAP) return;
    this.lastBump = t;
    const power = clamp((strength - BUMP_QUIET) / (BUMP_FULL - BUMP_QUIET), 0, 1);

    if (power < 0.2) {
      // The same recorded collisions as a harder hit, but with the top taken off and cut
      // short: all thump and no ring. Small knocks made of small recordings only go "ting".
      const within = power / 0.2;
      this.play(pick(this.clips.mid), (0.2 + within * 0.2) * BUMP_LEVEL, 0.7 + Math.random() * 0.15, { muffle: 650 + within * 850, seconds: 0.25 + within * 0.1 });
    } else if (power < 0.5) {
      const within = (power - 0.2) / 0.3;
      // Opening up from the muffled thump to the whole recording as it gets harder.
      this.play(pick(this.clips.mid), (0.5 + within * 0.4) * BUMP_LEVEL, 0.82 + Math.random() * 0.22, { muffle: 1400 + within * 9000 });
    } else {
      const within = (power - 0.5) / 0.5;
      this.play(pick(this.clips.hard), (0.75 + within * 0.25) * BUMP_LEVEL, 0.88 + Math.random() * 0.16);
      this.play(pick(this.clips.mid), 0.7 * BUMP_LEVEL, 0.7 + Math.random() * 0.15);
    }
  }

  /**
   * Something by the road has been sent flying. `strength` runs from 0, a tap, to 1, hit at
   * full speed; `weight` from 0, a cone, to 1, a tree.
   */
  knock(material: Material, strength: number, weight: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.loaded || this.paused || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    // A row of cones is a rattle, not a roar.
    if (t - this.lastKnock < 0.04) return;
    this.lastKnock = t;
    const volume = clamp(0.3 + strength * 0.45 + weight * 0.3, 0, 1.05);
    // Bigger things sound lower: the same recording, played slower.
    const rate = 1.15 - weight * 0.4 + (Math.random() - 0.5) * 0.16;
    switch (material) {
      case 'tree':
        // First the blow itself, then the tree coming down: a long splintering fall, played
        // as it was recorded.
        this.play(pick(this.clips.mid), (0.35 + strength * 0.35) * BUMP_LEVEL, 0.8 + Math.random() * 0.1, { muffle: 2600 });
        this.play(pick(this.clips.tree), volume * 0.9, 1 + (Math.random() - 0.5) * 0.08, { delay: 0.12 });
        break;
      case 'wood':
        // Something made of wood being smashed. A stall or a bench goes with a heavy crunch;
        // a crate or a fence panel with a sharper crack.
        if (weight >= 0.15) this.play(pick(this.clips.woodBig), volume, 1 + (Math.random() - 0.5) * 0.12);
        else this.play(pick(this.clips.woodSmall), volume * 0.9, 1.05 + (Math.random() - 0.5) * 0.16);
        break;
      case 'metal':
        // A post or a sign: a pipe struck, clear and sharp. Cut off before it has rung for
        // long, so that a row of posts doesn't pile up into one long chime.
        this.play(pick(this.clips.metal), volume * 0.9, rate, { seconds: 1.0 });
        break;
      case 'barrel':
        // An empty drum: a hollow boom, not a ring.
        this.play(pick(this.clips.barrel), volume, 0.95 + (Math.random() - 0.5) * 0.2);
        break;
      case 'soft':
        this.play(pick(this.clips.soft), volume, rate, { muffle: 1200 });
        break;
      default:
        // Not something that stands by the road; but if it is hit, it sounds as it would landing.
        this.thud(material, strength, weight);
        return;
    }
    // Something heavy coming down has weight to it as well.
    if (weight > 0.5 && material !== 'barrel' && material !== 'tree') this.play(pick(this.clips.mid), volume * 0.14, 0.6, { muffle: 450, seconds: 0.3 });
  }

  /**
   * Something already loose has hit something else: cargo knocking about on the bed, a
   * felled lamp bouncing on the road. The same materials as a first knock, but smaller:
   * quieter, shorter, and with less of an edge. `strength` from 0 to 1, `weight` likewise.
   */
  thud(material: Material, strength: number, weight: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.loaded || this.paused || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    // A load of twenty things shifting at once is a rumble, not twenty separate knocks.
    if (t - this.lastThud < 0.07) return;
    this.lastThud = t;
    const v = clamp(0.14 + strength * 0.6, 0, 0.75);
    const wobble = (Math.random() - 0.5) * 0.18;
    switch (material) {
      case 'tree':
      case 'heavy':
        // Dead weight: a low thump and nothing else.
        this.play(pick(this.clips.mid), v * 0.7, 0.6 + wobble, { muffle: 480, seconds: 0.32 });
        break;
      case 'wood':
        this.play(pick(this.clips.woodSmall), v * 0.8, (weight >= 0.15 ? 0.8 : 1.05) + wobble, { muffle: 3200, seconds: 0.3 });
        break;
      case 'metal':
        this.play(pick(this.clips.metal), v * 0.55, 1.1 + wobble, { seconds: 0.4 });
        break;
      case 'barrel':
        this.play(pick(this.clips.barrel), v * 0.8, 1 + wobble);
        break;
      case 'ceramic':
        // Two jars touching, or two jars meeting hard.
        this.play(this.clips.potClink[strength > 0.35 ? 1 : 0], v * 0.9, 0.95 + wobble);
        break;
      case 'melon':
        // A dull, wet knock.
        this.play(pick(this.clips.soft), v, 0.7 + wobble, { muffle: 900 });
        break;
      case 'bone':
        // Dry and light: a wooden click, played fast.
        this.play(pick(this.clips.woodSmall), v * 0.6, 1.6 + wobble, { seconds: 0.14 });
        break;
      default:
        this.play(pick(this.clips.soft), v, 1 + wobble, { muffle: 1200 });
    }
  }

  /** Two cars coming together, somewhere near: the crash itself, and the ring of it. `strength` from 0 to 1. */
  crunch(strength: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.loaded || this.paused || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    if (t - this.lastCrunch < 0.09) return;
    this.lastCrunch = t;
    this.play(pick(strength > 0.5 ? this.clips.hard : this.clips.mid), (0.3 + strength * 0.5) * BUMP_LEVEL, 0.9 + Math.random() * 0.2);
    this.play(pick(this.clips.metal), 0.2 + strength * 0.4, 0.7 + Math.random() * 0.15);
  }

  /**
   * A car horn, somewhere near. `strength` from 0 to 1 is how near it is, `long` how hard
   * it is leant on. `car` says whose it is: each car has its own horn, tuned a little
   * differently from the next, and one in three has the cracked one.
   */
  horn(strength: number, long: number, car: number): void {
    const ctx = this.ctx;
    if (!ctx || this.paused || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    // A street full of them is a din, not a wall of sound: no more than a few a second.
    if (t - this.lastHorn < 0.12) return;
    this.lastHorn = t;
    const voice = car % 3 === 1 ? HORN_VOICES.h : HORN_VOICES.a;
    playHorn(ctx, this.master, voice, 0.22 + long * (0.35 + Math.random() * 0.35), 0.05 + strength * 0.1, 0.95 + ((car * 37) % 11) * 0.01);
  }

  /** A short note, made on the spot: the warning that something is locking on. Higher and louder the nearer it is to firing. */
  beep(urgency: number): void {
    const ctx = this.ctx;
    if (!ctx || this.paused || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.07 + urgency * 0.07, t + 0.005);
    gain.gain.linearRampToValueAtTime(0.0001, t + 0.07);
    const note = ctx.createOscillator();
    note.type = 'square';
    note.frequency.value = 880 + urgency * 660;
    note.connect(gain).connect(this.master);
    note.start(t);
    note.stop(t + 0.09);
  }

  /** A burst of noise swept down or up: a rocket leaving, a shell coming in. */
  whoosh(strength: number, falling: boolean): void {
    const ctx = this.ctx;
    if (!ctx || this.paused || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const seconds = falling ? 1.6 : 0.5;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = falling ? 9 : 2.5;
    filter.frequency.setValueAtTime(falling ? 2600 : 500, t);
    filter.frequency.exponentialRampToValueAtTime(falling ? 500 : 2400, t + seconds);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime((falling ? 0.1 : 0.22) * strength, t + (falling ? seconds * 0.8 : 0.04));
    gain.gain.linearRampToValueAtTime(0.0001, t + seconds);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(t);
  }

  /** Something has broken for good: a jar in pieces, a melon burst, a crate in planks. */
  smash(material: Material, weight: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.loaded || this.paused || ctx.state !== 'running') return;
    const wobble = (Math.random() - 0.5) * 0.14;
    switch (material) {
      case 'ceramic':
        this.play(pick(this.clips.potBreak), 0.9, 1 + wobble);
        break;
      case 'melon':
        this.play(pick(this.clips.splat), 0.9, 0.95 + wobble);
        break;
      case 'wood':
        this.play(pick(weight >= 0.15 ? this.clips.woodBig : this.clips.woodSmall), 0.85, 1 + wobble);
        break;
      case 'bone':
        // Scattering: a few dry clicks, one after another.
        for (const delay of [0, 0.07, 0.16]) this.play(pick(this.clips.woodSmall), 0.5, 1.5 + Math.random() * 0.5, { seconds: 0.16, delay });
        break;
      default:
        // Steel doesn't shatter: it is a crash.
        this.play(pick(this.clips.mid), 0.75, 0.85 + wobble);
    }
  }

  /** Something has gone into the water: the truck with a great splash, anything less with a smaller one. */
  splash(big: boolean): void {
    if (!this.ctx || !this.loaded || this.paused || this.ctx.state !== 'running') return;
    // The same splash for both, the lesser one quieter and a little higher.
    this.play(this.clips.splash[0], big ? 1 : 0.45, (big ? 0.95 : 1.25) + Math.random() * 0.15);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!this.ctx) return;
    if (paused) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  /** How loud the output is right now, 0 to about 1: for the dev checks. */
  level(): number {
    if (!this.ctx) return 0;
    const samples = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const s of samples) sum += s * s;
    return Math.sqrt(sum / samples.length);
  }

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  /**
   * Play a recording once, at a volume and a speed. With `muffle`, everything above that
   * many Hz is taken off; with `seconds`, it is cut off after that long, fading as it goes;
   * with `delay`, it starts that much later.
   */
  private play(clip: Clip | undefined, volume: number, rate: number, shape: { muffle?: number; seconds?: number; delay?: number } = {}): void {
    if (!clip) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + (shape.delay ?? 0);
    const source = ctx.createBufferSource();
    source.buffer = clip.buffer;
    source.playbackRate.value = rate;
    const gain = ctx.createGain();
    volume *= clip.level;
    // Brought in over a few thousandths of a second: a recording cut from the middle of a
    // longer one would otherwise start with a click.
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.006);
    let last: AudioNode = source;
    if (shape.muffle !== undefined) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = shape.muffle;
      filter.Q.value = 0.7;
      last = last.connect(filter);
    }
    last.connect(gain).connect(this.master);
    source.start(t, clip.from);
    if (shape.seconds !== undefined) {
      // Held at full for the first part, then let go: fading from the very start would take
      // the body out of the sound along with its tail.
      gain.gain.setValueAtTime(volume, t + shape.seconds * 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0005, t + shape.seconds);
      source.stop(t + shape.seconds + 0.02);
    }
  }
}

/** How loud a recording is at its loudest: the highest average over any twentieth of a second. */
function loudest(buffer: AudioBuffer): number {
  const samples = buffer.getChannelData(0);
  const window = Math.floor(buffer.sampleRate * 0.05);
  let top = 0.0001;
  for (let i = 0; i + window <= samples.length; i += window) {
    let sum = 0;
    for (let j = i; j < i + window; j++) sum += samples[j] * samples[j];
    top = Math.max(top, Math.sqrt(sum / window));
  }
  return top;
}

function pick<T>(list: T[]): T | undefined {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * A stretch of a recording made to loop without a seam: its last moments are faded out
 * while the moments just before its start are faded in over them, so the end runs into
 * the beginning as the original ran on.
 */
function seamless(ctx: AudioContext, source: AudioBuffer, from: number, seconds: number, blend: number): AudioBuffer {
  const rate = source.sampleRate;
  const start = Math.floor(from * rate);
  const length = Math.floor(seconds * rate);
  const fade = Math.min(Math.floor(blend * rate), start, length);
  const loop = ctx.createBuffer(source.numberOfChannels, length, rate);
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const input = source.getChannelData(channel);
    const output = loop.getChannelData(channel);
    for (let i = 0; i < length; i++) output[i] = input[start + i];
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      const tail = length - fade + i;
      // Equal power, so the blend is neither a dip nor a bump in loudness.
      output[tail] = output[tail] * Math.cos((t * Math.PI) / 2) + input[start - fade + i] * Math.sin((t * Math.PI) / 2);
    }
  }
  return loop;
}
