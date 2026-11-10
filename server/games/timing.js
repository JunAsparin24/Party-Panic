// Perfect Timing: a marker bounces along a bar; tap when it is in the zone.
// The marker position is a pure function of server time, so the server works
// out where the marker was when the tap happened (adjusted for lag).
import { tri } from '../util.js';

const SHOTS = 10;

export default function create(api) {
  const specs = [];
  for (let k = 0; k < SHOTS; k++) {
    const width = Math.max(0.07, 0.2 - k * 0.014);
    const center = width / 2 + 0.04 + api.rng() * (1 - width - 0.08);
    specs.push({ k, width, center, period: Math.max(640, 1700 - k * 115), phase0: api.rng() });
  }

  const st = new Map();
  for (const id of api.pids) {
    const s = { k: 0, score: 0, perfects: 0, misses: 0, results: [], done: false, cur: null };
    s.cur = { ...specs[0], t0: api.now() + 900 };
    st.set(id, s);
  }

  const posAt = (c, t) => tri(c.phase0 + Math.max(0, t - c.t0) / c.period);

  return {
    playerInit(pid) {
      const s = st.get(pid);
      return { shots: SHOTS, k: s.k, cur: s.cur, score: s.score, results: s.results, done: s.done };
    },
    onInput(pid, d) {
      const s = st.get(pid);
      if (!s || s.done || !s.cur || d.type !== 'tap' || d.shot !== s.k) return;
      const c = s.cur;
      const t = api.tapTime(pid);
      if (t < c.t0 - 80) return; // marker was not moving yet
      const p = posAt(c, t);
      const dist = Math.abs(p - c.center);
      const half = c.width / 2;
      let grade;
      let pts;
      if (dist <= Math.max(0.012, half * 0.22)) { grade = 'perfect'; pts = 100; s.perfects++; }
      else if (dist <= half) { grade = 'great'; pts = Math.round(45 + 40 * (1 - dist / half)); }
      else if (dist <= half + 0.06) { grade = 'close'; pts = 15; s.misses++; }
      else { grade = 'miss'; pts = 0; s.misses++; }
      s.score += pts;
      s.results.push(grade);
      s.k++;
      s.cur = s.k < SHOTS ? { ...specs[s.k], t0: api.now() + 850 } : null;
      if (s.k >= SHOTS) { s.done = true; api.done(pid); }
      api.toPlayer(pid, { type: 'result', shot: c.k, pos: p, grade, pts, score: s.score, next: s.cur, done: s.done });
    },
    progress() {
      const out = {};
      for (const [id, s] of st) out[id] = { v: s.score, label: `${s.score} · ${s.k}/${SHOTS}` };
      return out;
    },
    finish() {
      const out = {};
      for (const [id, s] of st) {
        out[id] = { raw: s.score, label: `${s.score} pts`, perfect: s.k >= SHOTS && s.misses === 0 && s.perfects >= 3 };
      }
      return out;
    },
  };
}
