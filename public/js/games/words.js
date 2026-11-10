// Word Scramble — phone controller.
import { h, onTap } from '../ui.js';
import { demoPhone } from './common.js';

export default {
  player(ctx) {
    const { root, bag, sfx, fx } = ctx;
    let puzzle = ctx.init.puzzle;
    let picked = [];
    let lockUntil = ctx.init.lockUntil || 0;
    let pending = false;
    let solved = ctx.init.solved || 0;

    const info = h('div', { class: 'ws-info' });
    const slots = h('div', { class: 'ws-slots' });
    const tiles = h('div', { class: 'ws-tiles' });
    const clearBtn = h('button', { class: 'btn btn-white btn-sm' }, '↺ Clear');
    const skipBtn = h('button', { class: 'btn btn-orange btn-sm' }, '⏭ Skip');
    const lockEl = h('div', { class: 'ws-lock hidden' });
    root.append(h('div', { class: 'ws-wrap' }, info, slots, tiles, h('div', { class: 'ws-actions' }, clearBtn, skipBtn), lockEl));

    const render = () => {
      info.textContent = `${puzzle.letters.length} letters · ${solved} solved`;
      slots.replaceChildren(...puzzle.letters.map((_, i) => {
        const li = picked[i];
        const el = h('button', { class: `ws-slot ${li != null ? 'filled' : ''}` }, li != null ? puzzle.letters[li] : '');
        if (li != null) onTap(el, () => { if (pending) return; picked.splice(i, 1); sfx.click(); render(); });
        return el;
      }));
      tiles.dataset.n = puzzle.letters.length;
      tiles.replaceChildren(...puzzle.letters.map((ch, i) => {
        const used = picked.includes(i);
        const el = h('button', { class: `ws-tile ${used ? 'used' : ''}` }, ch);
        onTap(el, () => tapTile(i));
        return el;
      }));
    };

    const tapTile = (i) => {
      if (pending || picked.includes(i) || ctx.now() < lockUntil) return;
      picked.push(i);
      sfx.tap();
      ctx.vibrate(8);
      render();
      if (picked.length === puzzle.letters.length) {
        pending = true;
        ctx.send({ type: 'guess', k: puzzle.k, word: picked.map((x) => puzzle.letters[x]).join('') });
        bag.timeout(() => { pending = false; }, 2500);
      }
    };

    onTap(clearBtn, () => { if (pending) return; picked = []; sfx.click(); render(); });
    onTap(skipBtn, () => {
      if (pending || ctx.now() < lockUntil) return;
      pending = true;
      ctx.send({ type: 'skip', k: puzzle.k });
    });

    render();
    ctx.setScore(ctx.init.score || 0);

    bag.raf(() => {
      const left = lockUntil - ctx.now();
      lockEl.classList.toggle('hidden', left <= 0);
      skipBtn.disabled = left > 0;
    });

    ctx.onMsg((m) => {
      if (m.type === 'correct') {
        solved = m.solved;
        ctx.setScore(m.score);
        slots.classList.add('right');
        sfx.great();
        fx.burstAt(slots, { count: 30 });
        ctx.popup(`+${m.pts}`, 'good');
        bag.timeout(() => {
          slots.classList.remove('right');
          puzzle = m.puzzle;
          picked = [];
          pending = false;
          render();
        }, 500);
      } else if (m.type === 'wrong') {
        slots.classList.add('wrong');
        sfx.bad();
        ctx.vibrate(100);
        bag.timeout(() => {
          slots.classList.remove('wrong');
          picked = [];
          pending = false;
          render();
        }, 450);
      } else if (m.type === 'skipped') {
        lockUntil = m.lockUntil;
        lockEl.replaceChildren(h('div', null, 'It was…'), h('b', null, m.answer));
        sfx.bad();
        puzzle = m.puzzle;
        picked = [];
        pending = false;
        render();
      }
    });
  },

  demo() {
    return demoPhone(h('div', { class: 'demo-word' }, ['P', 'A', 'R', 'T', 'Y'].map((c, i) => h('span', { style: { animationDelay: `${i * 0.3}s` } }, c))));
  },
};
