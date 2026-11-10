// Spot the Difference — phone controller.
import { h, onTap } from '../ui.js';
import { demoPhone } from './common.js';

export default {
  player(ctx) {
    const { root, bag, sfx, fx } = ctx;
    let puzzle = null;
    let lockUntil = ctx.init.lockUntil || 0;
    let waiting = false;

    const found = h('div', { class: 'sp-found' });
    const grid = h('div', { class: 'sp-grid' });
    const frost = h('div', { class: 'sp-frost hidden' }, '❄️ Frozen!');
    const gridWrap = h('div', { class: 'sp-gridwrap' }, grid, frost);
    root.append(h('div', { class: 'sp-wrap' }, found, gridWrap));

    const render = (p) => {
      puzzle = p;
      waiting = false;
      const n = p.size * p.size;
      const box = gridWrap.getBoundingClientRect();
      const side = Math.min(box.width, box.height || box.width) - 8;
      const cell = side / p.size;
      grid.style.width = `${side}px`;
      grid.style.height = `${side}px`;
      grid.style.gridTemplateColumns = `repeat(${p.size}, 1fr)`;
      grid.style.setProperty('--fs', `${Math.floor(cell * 0.6)}px`);
      grid.replaceChildren();
      for (let i = 0; i < n; i++) {
        const odd = i === p.oddIdx;
        const sym = h('span', { class: 'sp-sym' }, odd ? p.odd : p.base);
        if (odd && p.type === 'rotate') sym.style.transform = `rotate(${p.angle}deg)`;
        if (odd && p.type === 'mirror') sym.style.transform = 'scaleX(-1)';
        const cellEl = h('button', { class: 'sp-cell' }, sym);
        onTap(cellEl, () => pickCell(i, cellEl));
        grid.append(cellEl);
      }
      grid.classList.remove('pop');
      void grid.offsetWidth;
      grid.classList.add('pop');
    };

    const pickCell = (i, el) => {
      if (waiting || ctx.now() < lockUntil) return;
      ctx.send({ type: 'pick', level: puzzle.level, idx: i });
      if (i === puzzle.oddIdx) {
        waiting = true;
        el.classList.add('found');
        sfx.good();
        ctx.vibrate(20);
        fx.burstAt(el, { count: 22 });
      } else {
        el.classList.add('nope');
        sfx.bad();
        ctx.vibrate(120);
      }
    };

    let foundN = ctx.init.found || 0;
    found.textContent = `Found: ${foundN}`;
    ctx.setScore(ctx.init.score || 0);
    requestAnimationFrame(() => render(ctx.init.puzzle));

    bag.raf(() => {
      const frozen = ctx.now() < lockUntil;
      frost.classList.toggle('hidden', !frozen);
      if (frozen) frost.textContent = `❄️ Frozen ${((lockUntil - ctx.now()) / 1000).toFixed(1)}s`;
    });

    ctx.onMsg((m) => {
      if (m.type === 'correct') {
        ctx.setScore(m.score);
        foundN = m.found;
        found.textContent = `Found: ${foundN}`;
        ctx.popup(`+${m.pts}`, 'good');
        bag.timeout(() => render(m.puzzle), 220);
      } else if (m.type === 'wrong') {
        lockUntil = m.lockUntil;
        fx.shake(grid);
      }
    });
  },

  demo() {
    return demoPhone(h('div', { class: 'demo-grid' }, Array.from({ length: 9 }, (_, i) => h('span', { class: i === 5 ? 'odd' : '' }, i === 5 ? '🍏' : '🍎'))));
  },
};
