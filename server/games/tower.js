// Tower Trouble: drop sliding blocks; overhang is chopped off.
// Block movement is a pure function of server time so the server decides
// exactly where each block landed.
import { tri } from '../util.js';

const BASE = { x: 0.25, w: 0.5 };
const PERFECT_TOL = 0.018;

export default function create(api) {
  const phases = [];
  const phaseFor = (h) => (phases[h] ??= api.rng());
  const spec = (h, w, delay) => ({ h, w, t0: api.now() + delay, period: Math.max(620, 1900 - h * 75), phase0: phaseFor(h) });
  const xAt = (c, t) => (1 - c.w) * tri(c.phase0 + Math.max(0, t - c.t0) / c.period);

  const st = new Map();
  for (const id of api.pids) {
    st.set(id, { blocks: [{ ...BASE }], cur: spec(0, BASE.w, 900), height: 0, score: 0, perfects: 0, combo: 0, done: false });
  }

  return {
    playerInit(pid) {
      const s = st.get(pid);
      return { blocks: s.blocks, cur: s.cur, height: s.height, score: s.score, done: s.done };
    },
    onInput(pid, d) {
      const s = st.get(pid);
      if (!s || s.done || d.type !== 'drop' || d.h !== s.height) return;
      const c = s.cur;
      const t = Math.max(api.tapTime(pid), c.t0);
      let x = xAt(c, t);
      const top = s.blocks[s.blocks.length - 1];
      let w = c.w;
      let perfect = false;
      let chopped = null;
      if (Math.abs(x - top.x) <= PERFECT_TOL) {
        perfect = true;
        x = top.x;
        w = top.w;
        s.combo++;
        s.perfects++;
        if (s.combo >= 3) {
          w = Math.min(0.5, w + 0.03);
          x = Math.min(x, 1 - w);
        }
      } else {
        s.combo = 0;
        const left = Math.max(x, top.x);
        const right = Math.min(x + c.w, top.x + top.w);
        const overlap = right - left;
        if (overlap <= 0.004) {
          s.done = true;
          api.done(pid);
          api.toPlayer(pid, { type: 'fall', x, w: c.w, height: s.height, score: s.score });
          return;
        }
        chopped = x < top.x ? { x, w: top.x - x } : { x: right, w: x + c.w - right };
        x = left;
        w = overlap;
      }
      const block = { x, w };
      s.blocks.push(block);
      s.height++;
      s.score += 10 + (perfect ? 5 : 0) + Math.min(s.combo, 5) * 2;
      s.cur = spec(s.height, w, 250);
      api.toPlayer(pid, { type: 'placed', block, perfect, chopped, cur: s.cur, height: s.height, score: s.score, combo: s.combo });
    },
    progress() {
      const out = {};
      for (const [id, s] of st) out[id] = { v: s.score, label: `${s.height} blocks`, h: s.height, w: s.blocks[s.blocks.length - 1].w, x: s.blocks[s.blocks.length - 1].x, done: s.done };
      return out;
    },
    finish() {
      const out = {};
      for (const [id, s] of st) {
        out[id] = { raw: s.score, label: `${s.height} blocks`, perfect: s.height >= 6 && s.perfects === s.height };
      }
      return out;
    },
  };
}
