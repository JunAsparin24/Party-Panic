// Spot the Difference — phone controller.
import { h, icon, onTap } from '../ui.js';
import { renderObject } from '/shared/spot.js';
import { demoPhone } from './common.js';

export default {
  player(ctx) {
    const { root, bag, sfx, fx } = ctx;
    let puzzle = null;
    let lockUntil = ctx.init.lockUntil || 0;
    let waiting = false;

    const found = h('div', { class: 'sp-found' });
    const grid = h('div', { class: 'sp-grid' });
    const frostText = h('span');
    const frost = h('div', { class: 'sp-frost hidden' }, icon('snow'), frostText);
    const gridWrap = h('div', { class: 'sp-gridwrap' }, grid, frost);
    root.append(h('div', { class: 'sp-wrap' }, found, gridWrap));

    const render = (p) => {
      puzzle = p;
      waiting = false;
      const box = gridWrap.getBoundingClientRect();
      const side = Math.min(box.width, box.height || box.width) - 8;
      grid.style.width = `${side}px`;
      grid.style.height = `${side}px`;
      grid.style.gridTemplateColumns = `repeat(${p.size}, 1fr)`;
      const normal = renderObject(p.obj);
      const odd = renderObject(p.obj, p.diff);
      grid.replaceChildren();
      for (let i = 0; i < p.size * p.size; i++) {
        const cell = h('button', { class: 'sp-cell', html: i === p.oddIdx ? odd : normal });
        onTap(cell, () => pickCell(i, cell));
        grid.append(cell);
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
        fx.burstAt(el, { count: 20 });
      } else {
        el.classList.add('nope');
        sfx.bad();
        ctx.vibrate(120);
      }
    };

    found.textContent = `Found ${ctx.init.found || 0}`;
    ctx.setScore(ctx.init.score || 0);
    requestAnimationFrame(() => render(ctx.init.puzzle));

    bag.raf(() => {
      const left = lockUntil - ctx.now();
      frost.classList.toggle('hidden', left <= 0);
      if (left > 0) frostText.textContent = `Frozen ${(left / 1000).toFixed(1)}s`;
    });

    ctx.onMsg((m) => {
      if (m.type === 'correct') {
        ctx.setScore(m.score);
        found.textContent = `Found ${m.found}`;
        ctx.popup(`+${m.pts}`, 'good');
        bag.timeout(() => render(m.puzzle), 220);
      } else if (m.type === 'wrong') {
        lockUntil = m.lockUntil;
        fx.shake(grid);
      }
    });
  },

  demo() {
    const normal = renderObject('cupcake');
    const odd = renderObject('cupcake', { type: 'missing', part: 'cherry' });
    return demoPhone(h('div', { class: 'demo-grid' }, Array.from({ length: 9 }, (_, i) => h('span', { class: i === 5 ? 'odd' : '', html: i === 5 ? odd : normal }))));
  },
};
