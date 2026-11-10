// Memory Meltdown — phone controller.
import { h, onTap } from '../ui.js';
import { demoPhone } from './common.js';

const PAD_COLORS = ['#ff4f9a', '#ffd23f', '#2de2e6', '#3ddc84', '#ff8c42', '#8e5cff', '#ff5964', '#4d7cff', '#f4f0ff'];
const PAD_ICONS = ['★', '●', '▲', '■', '♦', '♥', '✿', '☾', '⚡'];

export default {
  player(ctx) {
    const { root, bag, sfx, fx } = ctx;
    let round = ctx.init.round;
    let idx = ctx.init.idx || 0;
    let lives = ctx.init.lives ?? 3;
    let locked = false;
    let lastLit = -1;

    const status = h('div', { class: 'mm-status' });
    const level = h('div', { class: 'mm-level' });
    const hearts = h('div', { class: 'mm-lives' });
    const seqDots = h('div', { class: 'mm-seq' });
    const grid = h('div', { class: 'mm-grid' });
    root.append(h('div', { class: 'mm-wrap' }, h('div', { class: 'mm-head' }, level, hearts), status, grid, seqDots));
    let pads = [];

    const buildPads = () => {
      const n = round.pads;
      grid.dataset.n = n;
      grid.replaceChildren();
      pads = Array.from({ length: n }, (_, i) => {
        const pad = h('button', { class: 'mm-pad', style: { '--pc': PAD_COLORS[i] } }, h('span', null, PAD_ICONS[i]));
        onTap(pad, () => press(i));
        grid.append(pad);
        return pad;
      });
    };
    const renderInfo = () => {
      level.textContent = `Level ${round.level}`;
      hearts.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
      seqDots.replaceChildren(...round.seq.map((_, i) => h('span', { class: `dot ${i < idx ? 'done' : ''}` })));
    };
    const light = (i, cls = 'lit', ms = 220) => {
      const pad = pads[i];
      if (!pad) return;
      pad.classList.add(cls);
      setTimeout(() => pad.classList.remove(cls), ms);
    };

    const press = (i) => {
      if (locked || ctx.now() < round.inputAt - 150) return;
      ctx.send({ type: 'pad', i });
      sfx.note(i);
      ctx.vibrate(12);
      if (round.seq[idx] === i) {
        light(i);
        idx++;
        renderInfo();
        if (idx >= round.seq.length) {
          locked = true;
          status.textContent = 'Nailed it! ✨';
          status.className = 'mm-status good';
          fx.burstAt(grid, { count: 26 });
        }
      } else {
        light(i, 'wrong', 400);
        locked = true;
      }
    };

    const startRound = (r) => {
      const rebuild = !round || r.pads !== round.pads || !pads.length;
      round = r;
      idx = 0;
      locked = false;
      lastLit = -1;
      if (rebuild) buildPads();
      renderInfo();
    };
    startRound(round);
    ctx.setScore(ctx.init.score || 0);
    if (ctx.init.done) ctx.finished('Out of lives!', `You reached level ${round.level}`);

    bag.raf(() => {
      const now = ctx.now();
      if (now < round.showStart) {
        setStatus('Get ready…', 'wait');
        grid.classList.add('watching');
        return;
      }
      if (now < round.inputAt) {
        const step = round.flash + round.gap;
        const i = Math.floor((now - round.showStart) / step);
        const inFlash = (now - round.showStart) % step < round.flash;
        const lit = inFlash ? i : -1;
        if (lit !== lastLit) {
          pads.forEach((p) => p.classList.remove('lit'));
          if (lit >= 0 && round.seq[lit] != null) {
            pads[round.seq[lit]]?.classList.add('lit');
            sfx.note(round.seq[lit]);
          }
          lastLit = lit;
        }
        setStatus('Watch closely… 👀', 'wait');
        grid.classList.add('watching');
        return;
      }
      if (lastLit !== -2) { pads.forEach((p) => p.classList.remove('lit')); lastLit = -2; }
      grid.classList.remove('watching');
      if (!locked) setStatus('Your turn!', 'go');
    });

    function setStatus(text, cls) {
      if (status.textContent !== text) status.textContent = text;
      status.className = `mm-status ${cls}`;
    }

    ctx.onMsg((m) => {
      if (m.type === 'clear') {
        ctx.setScore(m.score);
        sfx.levelUp();
        ctx.popup(`Level ${m.round.level}!`, 'good');
        startRound(m.round);
      } else if (m.type === 'wrong') {
        lives = m.lives;
        sfx.bad();
        ctx.vibrate([80, 40, 80]);
        fx.shake(grid);
        light(m.expected, 'hint', 700);
        if (m.done) {
          renderInfo();
          ctx.finished('Out of lives!', `You reached level ${round.level}`);
          return;
        }
        ctx.popup(`Oops! ${lives} ${lives === 1 ? 'life' : 'lives'} left`, 'bad');
        startRound(m.round);
      }
    });
  },

  demo() {
    return demoPhone(h('div', { class: 'demo-pads' }, PAD_COLORS.slice(0, 4).map((c, i) => h('span', { style: { '--pc': c, animationDelay: `${i * 0.5}s` } }))));
  },
};
