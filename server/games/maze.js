// Maze Dash: every move is checked against the maze walls on the server.

const SIZES = [7, 8, 9, 10, 11, 12, 13];
// Wall bits: N=1, E=2, S=4, W=8
const DIRS = {
  U: { bit: 1, dx: 0, dy: -1, opp: 4 },
  R: { bit: 2, dx: 1, dy: 0, opp: 8 },
  D: { bit: 4, dx: 0, dy: 1, opp: 1 },
  L: { bit: 8, dx: -1, dy: 0, opp: 2 },
};

function genMaze(rng, w, h) {
  const cells = new Array(w * h).fill(15);
  const seen = new Uint8Array(w * h);
  const stack = [0];
  seen[0] = 1;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const x = cur % w, y = (cur / w) | 0;
    const opts = [];
    for (const d of Object.values(DIRS)) {
      const nx = x + d.dx, ny = y + d.dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[ny * w + nx]) opts.push([d, ny * w + nx]);
    }
    if (!opts.length) { stack.pop(); continue; }
    const [d, n] = opts[Math.floor(rng() * opts.length)];
    cells[cur] &= ~d.bit;
    cells[n] &= ~d.opp;
    seen[n] = 1;
    stack.push(n);
  }
  // Distance from every cell to the exit (bottom-right), for progress.
  const dist = new Array(w * h).fill(-1);
  const exit = w * h - 1;
  dist[exit] = 0;
  const q = [exit];
  while (q.length) {
    const c = q.shift();
    const x = c % w, y = (c / w) | 0;
    for (const d of Object.values(DIRS)) {
      if (cells[c] & d.bit) continue;
      const n = (y + d.dy) * w + (x + d.dx);
      if (dist[n] === -1) { dist[n] = dist[c] + 1; q.push(n); }
    }
  }
  return { w, h, cells, dist };
}

export default function create(api) {
  const mazes = [];
  const maze = (level) => (mazes[level] ||= genMaze(api.rng, SIZES[Math.min(level, SIZES.length - 1)], SIZES[Math.min(level, SIZES.length - 1)]));
  const pub = (level) => {
    const m = maze(level);
    return { level, w: m.w, h: m.h, cells: m.cells };
  };

  const st = new Map();
  for (const id of api.pids) st.set(id, { level: 0, x: 0, y: 0, cleared: 0, moveTimes: [] });

  const value = (s) => {
    const m = maze(s.level);
    const d0 = m.dist[0] || 1;
    const d = m.dist[s.y * m.w + s.x];
    return s.cleared * 100 + Math.max(0, Math.floor(99 * (1 - d / d0)));
  };

  return {
    playerInit(pid) {
      const s = st.get(pid);
      return { maze: pub(s.level), x: s.x, y: s.y, cleared: s.cleared, score: value(s) };
    },
    onInput(pid, d) {
      const s = st.get(pid);
      if (!s || d.type !== 'move' || d.level !== s.level || !Array.isArray(d.dirs)) return;
      const now = api.now();
      s.moveTimes = s.moveTimes.filter((t) => now - t < 1000);
      if (s.moveTimes.length > 30) return;
      const m = maze(s.level);
      for (const key of d.dirs.slice(0, 20)) {
        const dir = DIRS[key];
        if (!dir) break;
        s.moveTimes.push(now);
        if (m.cells[s.y * m.w + s.x] & dir.bit) {
          api.toPlayer(pid, { type: 'pos', level: s.level, x: s.x, y: s.y });
          return;
        }
        s.x += dir.dx;
        s.y += dir.dy;
        if (s.x === m.w - 1 && s.y === m.h - 1) {
          s.cleared++;
          s.level++;
          s.x = 0;
          s.y = 0;
          api.toPlayer(pid, { type: 'level', maze: pub(s.level), cleared: s.cleared, score: value(s) });
          return;
        }
      }
    },
    progress() {
      const out = {};
      for (const [id, s] of st) out[id] = { v: value(s), label: `${s.cleared} cleared · ${value(s) % 100}%` };
      return out;
    },
    finish() {
      const out = {};
      for (const [id, s] of st) {
        out[id] = { raw: value(s), label: `${s.cleared} maze${s.cleared === 1 ? '' : 's'} + ${value(s) % 100}%`, perfect: s.cleared >= 3 };
      }
      return out;
    },
  };
}
