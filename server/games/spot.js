// Spot the Difference: find the single odd drawing in a grid.
import { pick } from '../util.js';
import { OBJECTS, OBJECT_IDS } from '../../shared/spot.js';

const SIZES = [3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7];

function makeDiff(rng, id, level) {
  const o = OBJECTS[id];
  const hard = level >= 4;
  const types = ['color', 'missing', 'rotate'];
  if (o.asym) types.push('mirror');
  const type = pick(types, rng);
  if (type === 'color') return { type, part: pick(Object.keys(o.colors), rng), strength: hard ? 'subtle' : 'strong' };
  if (type === 'missing') return { type, part: pick(o.removable, rng) };
  if (type === 'rotate') return { type, angle: level < 3 ? 180 : level < 6 ? pick([90, -90], rng) : pick([25, -25, 35, -35], rng) };
  return { type };
}

export default function create(api) {
  const puzzles = [];
  let lastObj = null;
  function puzzle(level) {
    if (puzzles[level]) return puzzles[level];
    const rng = api.rng;
    const size = SIZES[Math.min(level, SIZES.length - 1)];
    let obj;
    do obj = pick(OBJECT_IDS, rng);
    while (obj === lastObj);
    lastObj = obj;
    puzzles[level] = { level, size, obj, diff: makeDiff(rng, obj, level), oddIdx: Math.floor(rng() * size * size) };
    return puzzles[level];
  }

  const st = new Map();
  for (const id of api.pids) st.set(id, { level: 0, score: 0, found: 0, wrongs: 0, lockUntil: 0, shownAt: api.now() });

  return {
    playerInit(pid) {
      const s = st.get(pid);
      return { puzzle: puzzle(s.level), score: s.score, found: s.found, lockUntil: s.lockUntil };
    },
    onInput(pid, d) {
      const s = st.get(pid);
      if (!s || d.type !== 'pick' || d.level !== s.level || !Number.isInteger(d.idx)) return;
      const now = api.now();
      if (now < s.lockUntil) return;
      const p = puzzle(s.level);
      if (d.idx === p.oddIdx) {
        const fast = now - s.shownAt < 2500 ? 5 : 0;
        const pts = 10 + p.size * 2 + fast;
        s.score += pts;
        s.found++;
        s.level++;
        s.shownAt = now;
        api.toPlayer(pid, { type: 'correct', pts, score: s.score, found: s.found, puzzle: puzzle(s.level) });
      } else {
        s.wrongs++;
        s.lockUntil = now + 1500;
        api.toPlayer(pid, { type: 'wrong', idx: d.idx, lockUntil: s.lockUntil });
      }
    },
    progress() {
      const out = {};
      for (const [id, s] of st) out[id] = { v: s.score, label: `${s.found} found` };
      return out;
    },
    finish() {
      const out = {};
      for (const [id, s] of st) out[id] = { raw: s.score, label: `${s.found} found`, perfect: s.wrongs === 0 && s.found >= 8 };
      return out;
    },
  };
}
