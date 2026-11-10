// Maze Dash — phone controller (canvas + swipe + D-pad).
import { h, icon, charUrl } from '../ui.js';
import { fitCanvas, loadImage, demoPhone } from './common.js';

const DIRS = {
  U: { bit: 1, dx: 0, dy: -1, back: 'D' },
  R: { bit: 2, dx: 1, dy: 0, back: 'L' },
  D: { bit: 4, dx: 0, dy: 1, back: 'U' },
  L: { bit: 8, dx: -1, dy: 0, back: 'R' },
};
const FLIP = { U: 'D', D: 'U', L: 'R', R: 'L' };

function distances(m) {
  const dist = new Array(m.w * m.h).fill(-1);
  const exit = m.w * m.h - 1;
  dist[exit] = 0;
  const q = [exit];
  while (q.length) {
    const c = q.shift();
    const x = c % m.w, y = (c / m.w) | 0;
    for (const d of Object.values(DIRS)) {
      if (m.cells[c] & d.bit) continue;
      const n = (y + d.dy) * m.w + (x + d.dx);
      if (dist[n] === -1) { dist[n] = dist[c] + 1; q.push(n); }
    }
  }
  return dist;
}

export default {
  player(ctx) {
    const { root, bag, sfx, fx } = ctx;
    let maze = ctx.init.maze;
    let dist = distances(maze);
    let pos = { x: ctx.init.x || 0, y: ctx.init.y || 0 };
    let draw = { ...pos };
    let cleared = ctx.init.cleared || 0;
    let waitingLevel = false;
    const trail = [];

    const holder = h('div', { class: 'mz-holder' });
    const mkBtn = (d, label) => {
      const b = h('button', { class: `mz-btn mz-${d}` }, label);
      let rep = null;
      const stop = () => { clearInterval(rep); rep = null; b.classList.remove('down'); };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.classList.add('down');
        step(d, false);
        clearInterval(rep);
        rep = setInterval(() => step(d, false), 130);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, stop));
      bag.add(stop);
      return b;
    };
    const pad = h('div', { class: 'mz-pad' }, mkBtn('U', icon('up')), mkBtn('L', icon('left')), mkBtn('R', icon('right')), mkBtn('D', icon('down')));
    const info = h('div', { class: 'mz-info' });
    root.append(info, holder, pad);
    const { canvas, ctx: g, size } = fitCanvas(holder, bag);
    const face = loadImage(charUrl(ctx.character));

    const score = () => {
      const d0 = dist[0] || 1;
      const d = dist[pos.y * maze.w + pos.x];
      return cleared * 100 + Math.max(0, Math.floor(99 * (1 - d / d0)));
    };
    const renderInfo = () => {
      info.textContent = `Maze ${maze.level + 1} · ${maze.w}×${maze.h}${ctx.reversed ? ' · reversed controls' : ''}`;
      ctx.setScore(score());
    };
    renderInfo();

    const open = (x, y, d) => !(maze.cells[y * maze.w + x] & DIRS[d].bit);
    const atExit = () => pos.x === maze.w - 1 && pos.y === maze.h - 1;

    // slide = keep running until a junction, dead end or the exit
    function step(rawDir, slide) {
      if (waitingLevel) return;
      const d = ctx.reversed ? FLIP[rawDir] : rawDir;
      const moves = [];
      let { x, y } = pos;
      let dir = d;
      for (let i = 0; i < 20; i++) {
        if (!open(x, y, dir)) break;
        x += DIRS[dir].dx;
        y += DIRS[dir].dy;
        moves.push(dir);
        if (!slide || (x === maze.w - 1 && y === maze.h - 1)) break;
        const exits = Object.keys(DIRS).filter((k) => k !== DIRS[dir].back && open(x, y, k));
        if (exits.length !== 1) break;
        dir = exits[0]; // follow corridors around corners
      }
      if (!moves.length) {
        fx.shake(holder);
        ctx.vibrate(30);
        return;
      }
      trail.push({ ...pos });
      if (trail.length > 30) trail.shift();
      pos = { x, y };
      ctx.send({ type: 'move', level: maze.level, dirs: moves });
      sfx.click();
      renderInfo();
      if (atExit()) waitingLevel = true;
    }

    // swipe
    let start = null;
    bag.listen(canvas, 'pointerdown', (e) => { e.preventDefault(); start = { x: e.clientX, y: e.clientY }; });
    bag.listen(canvas, 'pointerup', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      step(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : dy > 0 ? 'D' : 'U', true);
    });
    bag.listen(window, 'keydown', (e) => {
      const k = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R' }[e.key];
      if (k) { e.preventDefault(); step(k, true); }
    });

    bag.raf((t) => {
      const W = size.w;
      const H = size.h;
      const cs = Math.floor(Math.min(W / maze.w, H / maze.h));
      const ox = Math.floor((W - cs * maze.w) / 2);
      const oy = Math.floor((H - cs * maze.h) / 2);
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#e9fff9';
      g.fillRect(ox, oy, cs * maze.w, cs * maze.h);

      // trail
      g.fillStyle = 'rgba(0,168,143,.18)';
      for (const p of trail) g.fillRect(ox + p.x * cs + cs * 0.25, oy + p.y * cs + cs * 0.25, cs * 0.5, cs * 0.5);

      // exit
      // exit: gold tile with a waving flag
      const ex = ox + (maze.w - 1) * cs;
      const ey = oy + (maze.h - 1) * cs;
      g.fillStyle = '#ffe39a';
      g.fillRect(ex, ey, cs, cs);
      const wave = Math.sin(t / 160) * cs * 0.06;
      g.strokeStyle = '#1b1530';
      g.lineWidth = Math.max(2, cs * 0.07);
      g.beginPath();
      g.moveTo(ex + cs * 0.32, ey + cs * 0.85);
      g.lineTo(ex + cs * 0.32, ey + cs * 0.15);
      g.stroke();
      g.beginPath();
      g.moveTo(ex + cs * 0.34, ey + cs * 0.17);
      g.quadraticCurveTo(ex + cs * 0.55, ey + cs * 0.22 + wave, ex + cs * 0.78, ey + cs * 0.3);
      g.lineTo(ex + cs * 0.34, ey + cs * 0.5);
      g.closePath();
      g.fillStyle = '#ff5a3c';
      g.fill();
      g.lineWidth = Math.max(1.5, cs * 0.05);
      g.stroke();

      // walls
      g.strokeStyle = '#1d1140';
      g.lineWidth = Math.max(2, cs * 0.12);
      g.lineCap = 'round';
      g.beginPath();
      for (let y = 0; y < maze.h; y++) {
        for (let x = 0; x < maze.w; x++) {
          const c = maze.cells[y * maze.w + x];
          const X = ox + x * cs;
          const Y = oy + y * cs;
          if (c & 1) { g.moveTo(X, Y); g.lineTo(X + cs, Y); }
          if (c & 8) { g.moveTo(X, Y); g.lineTo(X, Y + cs); }
          if (y === maze.h - 1 && c & 4) { g.moveTo(X, Y + cs); g.lineTo(X + cs, Y + cs); }
          if (x === maze.w - 1 && c & 2) { g.moveTo(X + cs, Y); g.lineTo(X + cs, Y + cs); }
        }
      }
      g.stroke();

      // player
      draw.x += (pos.x - draw.x) * 0.45;
      draw.y += (pos.y - draw.y) * 0.45;
      const px = ox + (draw.x + 0.5) * cs;
      const py = oy + (draw.y + 0.5) * cs;
      const r = cs * 0.42;
      g.save();
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fillStyle = ctx.color;
      g.fill();
      g.clip();
      if (face.complete && face.naturalWidth) g.drawImage(face, px - r, py - r, r * 2, r * 2);
      g.restore();
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.lineWidth = 2.5;
      g.strokeStyle = '#1d1140';
      g.stroke();
    });

    ctx.onMsg((m) => {
      if (m.type === 'level') {
        maze = m.maze;
        dist = distances(maze);
        cleared = m.cleared;
        pos = { x: 0, y: 0 };
        draw = { x: 0, y: 0 };
        trail.length = 0;
        waitingLevel = false;
        sfx.levelUp();
        fx.confetti(40);
        ctx.popup('Maze cleared', 'good');
        ctx.vibrate([30, 40, 30]);
        renderInfo();
      } else if (m.type === 'pos' && m.level === maze.level) {
        pos = { x: m.x, y: m.y };
        waitingLevel = false;
        renderInfo();
      }
    });
  },

  demo() {
    return demoPhone(h('div', { class: 'demo-maze' }, h('span', { class: 'dot' }), h('span', { class: 'flag' })));
  },
};
