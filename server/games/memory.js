// Memory Meltdown: Simon-style pattern repeating with growing sequences.
import { makeRng } from '../util.js';

const padsFor = (level) => (level <= 3 ? 4 : level <= 6 ? 6 : 9);

function genSeq(rng, level) {
  const n = padsFor(level);
  const len = level + 2;
  const seq = [];
  for (let i = 0; i < len; i++) {
    let v;
    do v = Math.floor(rng() * n);
    while (i >= 1 && v === seq[i - 1] && rng() < 0.7);
    seq.push(v);
  }
  return seq;
}

export default function create(api) {
  const shared = [];
  const st = new Map();

  function newRound(s, retry, delay) {
    const level = s.level;
    if (retry) s.seq = genSeq(s.rng, level);
    else s.seq = shared[level] ||= genSeq(api.rng, level);
    s.idx = 0;
    s.flash = Math.max(240, 620 - level * 36);
    s.gap = Math.round(s.flash * 0.45);
    s.showStart = api.now() + delay;
    s.inputAt = s.showStart + s.seq.length * (s.flash + s.gap);
  }

  const roundMsg = (s) => ({
    level: s.level,
    pads: padsFor(s.level),
    seq: s.seq,
    showStart: s.showStart,
    flash: s.flash,
    gap: s.gap,
    inputAt: s.inputAt,
  });

  for (const id of api.pids) {
    const s = { level: 1, lives: 3, score: 0, lost: 0, done: false, rng: makeRng(Math.floor(api.rng() * 1e9)) };
    newRound(s, false, 1000);
    st.set(id, s);
  }

  return {
    playerInit(pid) {
      const s = st.get(pid);
      return { round: roundMsg(s), idx: s.idx, lives: s.lives, score: s.score, done: s.done };
    },
    onInput(pid, d) {
      const s = st.get(pid);
      if (!s || s.done || d.type !== 'pad' || !Number.isInteger(d.i)) return;
      if (api.now() < s.inputAt - 150) return; // still showing the pattern
      if (d.i === s.seq[s.idx]) {
        s.idx++;
        if (s.idx >= s.seq.length) {
          s.score += s.seq.length * 10 + s.level * 5;
          s.level++;
          newRound(s, false, 900);
          api.toPlayer(pid, { type: 'clear', score: s.score, round: roundMsg(s) });
        }
        return;
      }
      s.lives--;
      s.lost++;
      if (s.lives <= 0) {
        s.done = true;
        api.done(pid);
        api.toPlayer(pid, { type: 'wrong', expected: s.seq[s.idx], lives: 0, done: true, score: s.score });
        return;
      }
      const expected = s.seq[s.idx];
      newRound(s, true, 1400);
      api.toPlayer(pid, { type: 'wrong', expected, lives: s.lives, score: s.score, round: roundMsg(s) });
    },
    progress() {
      const out = {};
      for (const [id, s] of st) out[id] = { v: s.score, label: `Lv ${s.level} · ${'❤'.repeat(s.lives)}` };
      return out;
    },
    finish() {
      const out = {};
      for (const [id, s] of st) out[id] = { raw: s.score, label: `Level ${s.level}`, perfect: s.lost === 0 && s.level >= 7 };
      return out;
    },
  };
}
