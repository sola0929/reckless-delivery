// Car horns, made up out of oscillators: there is no recording of one. Kept apart from the
// rest of the sound so that the page for trying them out (dev/horns) plays exactly what the
// game does.

export interface HornVoice {
  /** What it is called on the page for trying them out. */
  name: string;
  /** The notes sounded together, Hz. */
  notes: number[];
  wave: OscillatorType;
  /** Nothing above this gets through, Hz: lower is duller. */
  lowpass: number;
  /** Nothing below this gets through, Hz: higher is thinner, more of a blare. */
  highpass?: number;
  /** How many times it sounds for one press: a scooter goes beep-beep. */
  beeps?: number;
  /** How long one press lasts beside the others: 1 as asked. */
  length?: number;
}

/** The two that sound like horns. Others were tried on the page in dev/horns and thrown out. */
export const HORN_VOICES = {
  a: { name: 'A　雙音', notes: [390, 491], wave: 'sawtooth', lowpass: 2400 },
  h: { name: 'H　不和諧的破喇叭', notes: [400, 428, 520], wave: 'sawtooth', lowpass: 2200, highpass: 200 },
} satisfies Record<string, HornVoice>;

export type HornId = keyof typeof HORN_VOICES;

/**
 * Sound a horn. `seconds` is how long it is leant on, `volume` its loudness, and `tune`
 * shifts every note together, so that no two cars with the same horn sound quite alike.
 */
export function playHorn(ctx: AudioContext, out: AudioNode, voice: HornVoice, seconds: number, volume: number, tune = 1): void {
  const beeps = voice.beeps ?? 1;
  const each = (seconds * (voice.length ?? 1)) / beeps;
  for (let n = 0; n < beeps; n++) {
    const t = ctx.currentTime + n * each * 1.45;
    const gain = ctx.createGain();
    // Louder waves are turned down, so that every voice is about as loud as the next.
    const level = volume * (voice.wave === 'square' ? 0.7 : 1) / Math.sqrt(voice.notes.length / 2);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.012);
    gain.gain.setValueAtTime(level, t + each);
    gain.gain.linearRampToValueAtTime(0.0001, t + each + 0.04);
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = voice.lowpass;
    let last: AudioNode = low;
    if (voice.highpass) {
      const high = ctx.createBiquadFilter();
      high.type = 'highpass';
      high.frequency.value = voice.highpass;
      last = low.connect(high);
    }
    for (const pitch of voice.notes) {
      const note = ctx.createOscillator();
      note.type = voice.wave;
      note.frequency.value = pitch * tune;
      note.connect(low);
      note.start(t);
      note.stop(t + each + 0.06);
    }
    last.connect(gain).connect(out);
  }
}
