// Number Rush: quick-fire maths. Answers never leave the server.
import { randInt } from '../util.js';

function gen(rng, k) {
  const r = (a, b) => randInt(rng, a, b);
  if (k < 3) {
    const a = r(1, 9), b = r(1, 9);
    return { q: `${a} + ${b}`, a: a + b };
  }
  if (k < 6) {
    if (rng() < 0.5) {
      const a = r(10, 50), b = r(5, 30);
      return { q: `${a} + ${b}`, a: a + b };
    }
    const a = r(12, 60), b = r(2, a - 2);
    return { q: `${a} − ${b}`, a: a - b };
  }
  if (k < 9) {
    const a = r(2, 9), b = r(2, 9);
    return { q: `${a} × ${b}`, a: a * b };
  }
  if (k < 12) {
    const a = r(2, 9), b = r(3, 9), c = r(1, 20);
    if (rng() < 0.5 || a * b - c < 0) return { q: `${a} × ${b} + ${c}`, a: a * b + c };
    return { q: `${a} × ${b} − ${c}`, a: a * b - c };
  }
  const roll = rng();
  if (roll < 0.35) {
    const a = r(6, 15), b = r(3, 12);
    return { q: `${a} × ${b}`, a: a * b };
  }
  if (roll < 0.7) {
    const b = r(2, 12), ans = r(2, 12);
    return { q: `${b * ans} ÷ ${b}`, a: ans };
  }
  const a = r(2, 9), b = r(2, 9), c = r(2, 6);
  return { q: `(${a} + ${b}) × ${c}`, a: (a + b) * c };
}

export default function create(api) {
  const problems = [];
  const prob = (k) => (problems[k] ||= gen(api.rng, k));
  const pub = (k) => ({ k, q: prob(k).q });

  const st = new Map();
  for (const id of api.pids) st.set(id, { k: 0, score: 0, streak: 0, best: 0, wrongs: 0, lockUntil: 0 });

  return {
    playerInit(pid) {
      const s = st.get(pid);
      return { prob: pub(s.k), score: s.score, streak: s.streak, lockUntil: s.lockUntil };
    },
    onInput(pid, d) {
      const s = st.get(pid);
      if (!s || d.type !== 'answer' || d.k !== s.k) return;
      const now = api.now();
      if (now < s.lockUntil) return;
      const value = Number(d.value);
      if (!Number.isInteger(value)) return;
      if (value === prob(s.k).a) {
        s.streak++;
        s.best = Math.max(s.best, s.streak);
        const pts = 10 + Math.min(10, (s.streak - 1) * 2) + Math.floor(s.k / 3) * 2;
        s.score += pts;
        s.k++;
        api.toPlayer(pid, { type: 'correct', pts, score: s.score, streak: s.streak, prob: pub(s.k) });
      } else {
        s.streak = 0;
        s.wrongs++;
        s.lockUntil = now + 700;
        api.toPlayer(pid, { type: 'wrong', lockUntil: s.lockUntil, streak: 0 });
      }
    },
    progress() {
      const out = {};
      for (const [id, s] of st) out[id] = { v: s.score, label: `${s.k} solved${s.streak >= 3 ? ` · 🔥${s.streak}` : ''}` };
      return out;
    },
    finish() {
      const out = {};
      for (const [id, s] of st) out[id] = { raw: s.score, label: `${s.k} solved`, perfect: s.wrongs === 0 && s.k >= 10 };
      return out;
    },
  };
}
