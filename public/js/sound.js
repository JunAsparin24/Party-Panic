// Synthesised sound effects and a tiny chiptune loop. No audio files needed.
import { prefs } from './net.js';

let ctx = null;
let master = null;
let muted = prefs.get('muted', false);

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

// Browsers only allow audio after a user gesture.
['pointerdown', 'keydown', 'touchend'].forEach((ev) => window.addEventListener(ev, initAudio, { passive: true }));

export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  prefs.set('muted', m);
  if (master) master.gain.value = m ? 0 : 0.5;
}

function tone(freq, dur = 0.12, { type = 'square', vol = 0.18, slide = null, delay = 0, attack = 0.005 } = {}) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur = 0.3, { vol = 0.3, delay = 0, filter = 1200 } = {}) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filter;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

const NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];

export const sfx = {
  click: () => tone(660, 0.05, { type: 'square', vol: 0.08 }),
  tap: () => tone(520, 0.06, { type: 'triangle', vol: 0.15, slide: 700 }),
  pop: () => tone(400, 0.09, { type: 'sine', vol: 0.25, slide: 900 }),
  join: () => { tone(523, 0.08, { type: 'triangle' }); tone(784, 0.12, { type: 'triangle', delay: 0.07 }); },
  good: () => { tone(660, 0.08, { type: 'triangle', vol: 0.2 }); tone(990, 0.14, { type: 'triangle', vol: 0.2, delay: 0.06 }); },
  great: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, { type: 'square', vol: 0.12, delay: i * 0.05 })),
  bad: () => { tone(200, 0.22, { type: 'sawtooth', vol: 0.16, slide: 110 }); },
  coin: () => { tone(988, 0.06, { type: 'square', vol: 0.12 }); tone(1319, 0.18, { type: 'square', vol: 0.12, delay: 0.06 }); },
  boom: () => { noise(0.6, { vol: 0.5, filter: 900 }); tone(120, 0.4, { type: 'sine', vol: 0.4, slide: 40 }); },
  whoosh: () => noise(0.35, { vol: 0.18, filter: 3000 }),
  tick: () => tone(1200, 0.025, { type: 'square', vol: 0.06 }),
  beep: () => tone(880, 0.12, { type: 'square', vol: 0.14 }),
  go: () => { tone(1320, 0.35, { type: 'square', vol: 0.16 }); tone(660, 0.35, { type: 'triangle', vol: 0.2 }); },
  note: (i) => tone(NOTES[i % NOTES.length], 0.25, { type: 'triangle', vol: 0.22 }),
  drop: () => tone(300, 0.12, { type: 'triangle', vol: 0.22, slide: 120 }),
  stack: (h = 0) => tone(300 + Math.min(h, 30) * 25, 0.1, { type: 'square', vol: 0.12 }),
  ding: () => { tone(1568, 0.3, { type: 'sine', vol: 0.2 }); tone(2093, 0.4, { type: 'sine', vol: 0.12, delay: 0.05 }); },
  buzz: () => tone(140, 0.35, { type: 'sawtooth', vol: 0.18 }),
  fanfare: () => {
    const seq = [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.52], [1047, 0.64]];
    seq.forEach(([f, d]) => tone(f, 0.22, { type: 'square', vol: 0.13, delay: d }));
    tone(262, 0.9, { type: 'triangle', vol: 0.2, delay: 0.36 });
  },
  drumroll: (dur = 1.6) => {
    for (let t = 0; t < dur; t += 0.05) noise(0.05, { vol: 0.12 + (t / dur) * 0.15, delay: t, filter: 700 });
  },
  crash: () => noise(1.1, { vol: 0.35, filter: 6000 }),
  splat: () => { noise(0.25, { vol: 0.4, filter: 900 }); tone(180, 0.18, { type: 'sine', vol: 0.25, slide: 60 }); },
  eliminated: () => [400, 300, 200].forEach((f, i) => tone(f, 0.25, { type: 'sawtooth', vol: 0.12, delay: i * 0.18 })),
  levelUp: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.1, { type: 'triangle', vol: 0.2, delay: i * 0.06 })),
};

// ------------------------------------------------------------- music loop

let musicTimer = null;
let musicStep = 0;
let musicNext = 0;
const BPM = 128;
const STEP = 60 / BPM / 2; // eighth notes
// Chords: C, Am, F, G (root notes for bass, arps on top)
const PROG = [[130.81, [261.63, 329.63, 392]], [110, [220, 261.63, 329.63]], [87.31, [174.61, 220, 261.63]], [98, [196, 246.94, 293.66]]];

export function startMusic() {
  if (!ctx || musicTimer || !prefs.get('music', true)) return;
  musicNext = ctx.currentTime + 0.1;
  musicStep = 0;
  musicTimer = setInterval(() => {
    if (!ctx) return;
    while (musicNext < ctx.currentTime + 0.25) {
      const bar = Math.floor(musicStep / 8) % PROG.length;
      const [bass, arp] = PROG[bar];
      const s = musicStep % 8;
      const delay = Math.max(0, musicNext - ctx.currentTime);
      if (!muted) {
        if (s % 2 === 0) tone(bass, STEP * 1.6, { type: 'triangle', vol: 0.09, delay });
        tone(arp[s % 3] * (s >= 4 ? 2 : 1), STEP * 0.8, { type: 'square', vol: 0.025, delay });
        if (s === 0 || s === 4) noise(0.06, { vol: 0.05, delay, filter: 400 });
        if (s === 2 || s === 6) noise(0.04, { vol: 0.03, delay, filter: 8000 });
      }
      musicNext += STEP;
      musicStep++;
    }
  }, 60);
}

export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

export function musicOn() { return prefs.get('music', true); }
export function setMusic(on) {
  prefs.set('music', on);
  if (on) startMusic();
  else stopMusic();
}

export function vibrate(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}
