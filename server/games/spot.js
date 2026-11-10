// Spot the Difference: find the single odd symbol in a grid.
import { pick } from '../util.js';

const EASY = [['🍎', '🍏'], ['🐶', '🐱'], ['⚽', '🏀'], ['🌞', '🌝'], ['❤️', '💙'], ['🚗', '🚕'], ['🍩', '🍪'], ['🐸', '🐢']];
const HARD = [
  ['😀', '😃'], ['😊', '🙂'], ['🍊', '🍑'], ['🌲', '🌳'], ['🐟', '🐠'], ['💜', '💙'], ['🕐', '🕜'],
  ['🌑', '🌚'], ['😐', '😑'], ['🐭', '🐹'], ['🌕', '🌖'], ['🔶', '🔸'], ['🎾', '🥎'], ['😺', '😸'],
  ['📕', '📙'], ['🟠', '🟡'], ['🐻', '🧸'], ['🍋', '🍈'],
];
const ASYM = ['🦒', '🐌', '🦖', '🚀', '🔑', '🎸', '🦆', '🐎', '🦜', '🛴', '⛵', '🐢', '🦕', '🍌', '🦩', '🐘'];
const SIZES = [3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7];

export default function create(api) {
  const puzzles = [];
  function puzzle(level) {
    if (puzzles[level]) return puzzles[level];
    const rng = api.rng;
    const size = SIZES[Math.min(level, SIZES.length - 1)];
    const cells = size * size;
    const oddIdx = Math.floor(rng() * cells);
    let p;
    const roll = rng();
    if (level < 2) {
      const [a, b] = pick(EASY, rng);
      p = { type: 'pair', base: a, odd: b };
    } else if (roll < 0.45) {
      const [a, b] = pick(HARD, rng);
      p = rng() < 0.5 ? { type: 'pair', base: a, odd: b } : { type: 'pair', base: b, odd: a };
    } else if (roll < 0.75) {
      const e = pick(ASYM, rng);
      const angle = level < 4 ? 180 : level < 7 ? 90 : 40;
      p = { type: 'rotate', base: e, odd: e, angle };
    } else {
      const e = pick(ASYM, rng);
      p = { type: 'mirror', base: e, odd: e };
    }
    puzzles[level] = { level, size, oddIdx, ...p };
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
