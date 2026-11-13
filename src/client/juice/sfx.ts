// Small sound effects made with the Web Audio API, so the game ships no
// extra audio files: soft footsteps as a piece moves, a coin "cha-ching" for
// rent, hammer knocks for building and a rising chime for winning an auction.
// Browsers only allow sound after the player has clicked something; until
// then these do nothing.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

const audio = (): { ac: AudioContext; out: GainNode } | null => {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) {
        return null;
      }
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => undefined);
    }
    return master ? { ac: ctx, out: master } : null;
  } catch (e) {
    return null;
  }
};

interface ToneOpts {
  freq: number;
  /** seconds from now */
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** glide to this frequency over the tone */
  toFreq?: number;
}

const tone = (ac: AudioContext, out: AudioNode, o: ToneOpts): AudioScheduledSourceNode => {
  const t0 = ac.currentTime + o.at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.toFreq) {
    osc.frequency.exponentialRampToValueAtTime(o.toFreq, t0 + o.dur);
  }
  const peak = o.gain ?? 1;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g).connect(out);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.02);
  return osc;
};

/** a short burst of filtered noise: the wood of a hammer knock or a piece touching down */
const knock = (ac: AudioContext, out: AudioNode, at: number, gain: number, freq = 1100, seconds = 0.08): AudioScheduledSourceNode => {
  const t0 = ac.currentTime + at;
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(out);
  src.start(t0);
  return src;
};

/** air rushing past during a leap between squares that aren't neighbours */
const whoosh = (ac: AudioContext, out: AudioNode, at: number, seconds: number): AudioScheduledSourceNode => {
  const t0 = ac.currentTime + at;
  const len = Math.max(1, Math.floor(ac.sampleRate * seconds));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(350, t0);
  filter.frequency.exponentialRampToValueAtTime(1600, t0 + seconds * 0.5);
  filter.frequency.exponentialRampToValueAtTime(500, t0 + seconds);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.6, t0 + seconds * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
  src.connect(filter).connect(g).connect(out);
  src.start(t0);
  return src;
};

/** the move's sounds still to play, so a move cut short can be silenced */
let moveSounds: Array<{ node: AudioScheduledSourceNode; at: number }> = [];

/**
 * Soft footsteps in time with a piece's move: a light tick each time it
 * touches down on a square, a whoosh across a leap, and a fuller tock where it
 * lands. Steps and timings are the ones the board animation uses.
 */
export const playMoveSounds = (kinds: Array<"pause" | "hop" | "jump">, seconds: number[]): void => {
  cancelMoveSounds();
  const a = audio();
  if (!a || kinds.length === 0) return;
  const now = a.ac.currentTime;
  const add = (node: AudioScheduledSourceNode, at: number) => moveSounds.push({ node, at: now + at });
  let elapsed = 0;
  let footstep = 0;
  kinds.forEach((kind, i) => {
    const start = elapsed;
    elapsed += seconds[i];
    if (kind === "pause") return;
    if (kind === "jump") add(whoosh(a.ac, a.out, start, seconds[i]), start);
    const last = i === kinds.length - 1;
    if (last) {
      add(knock(a.ac, a.out, elapsed, 1.6, 650, 0.09), elapsed);
      add(tone(a.ac, a.out, { freq: 300, toFreq: 190, at: elapsed, dur: 0.16, gain: 0.75 }), elapsed);
    } else {
      // a wooden tap per square, alternating two pitches like footsteps
      const high = footstep++ % 2 === 0;
      add(knock(a.ac, a.out, elapsed, 1.1, high ? 1500 : 1250, 0.05), elapsed);
      add(tone(a.ac, a.out, { freq: high ? 620 : 540, toFreq: high ? 430 : 380, at: elapsed, dur: 0.07, gain: 0.4 }), elapsed);
    }
  });
};

/** Silence the rest of a move (the board jumped to a new state mid-move). */
export const cancelMoveSounds = (): void => {
  // keep anything due in the next moment: the move ending normally can clear
  // a few milliseconds before its landing tock is due
  const t = ctx ? ctx.currentTime + 0.12 : Infinity;
  for (const s of moveSounds) {
    if (s.at > t) {
      try { s.node.stop(); } catch (e) { /* already stopped */ }
    }
  }
  moveSounds = [];
};

/** rent changes hands: two bright coin pings */
export const playRentSound = (): void => {
  const a = audio();
  if (!a) return;
  tone(a.ac, a.out, { freq: 1568, at: 0, dur: 0.12, type: "square", gain: 0.25 });
  tone(a.ac, a.out, { freq: 2093, at: 0.07, dur: 0.38, type: "square", gain: 0.22 });
  tone(a.ac, a.out, { freq: 4186, at: 0.07, dur: 0.25, type: "sine", gain: 0.12 });
};

/** a house goes up: two hammer knocks */
export const playBuildSound = (): void => {
  const a = audio();
  if (!a) return;
  [0, 0.15].forEach((at, i) => {
    knock(a.ac, a.out, at, i === 0 ? 1.6 : 1.3);
    tone(a.ac, a.out, { freq: 180, toFreq: 90, at, dur: 0.12, type: "sine", gain: 0.7 });
  });
};

/** you won the auction: a quick rising arpeggio */
export const playWinSound = (): void => {
  const a = audio();
  if (!a) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    tone(a.ac, a.out, { freq, at: i * 0.09, dur: i === 3 ? 0.6 : 0.2, type: "triangle", gain: 0.5 });
  });
};
