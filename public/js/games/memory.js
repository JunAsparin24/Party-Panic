// Memory Meltdown — phone controller.
import { h, fill, icon, onTap } from '../ui.js';
import { demoPhone } from './common.js';

const PAD_COLORS = ['#ff6fae', '#ffc23d', '#3fe0d0', '#27c49a', '#ff8c42', '#9b6bff', '#ff5a3c', '#3fa7ff', '#f4f0ff'];
// Every pad also has a shape so it works for colour-blind players.
const SHAPES = [
  '<path d="M12 3 L14.6 8.6 L20.6 9.2 L16 13.2 L17.4 19.2 L12 16 L6.6 19.2 L8 13.2 L3.4 9.2 L9.4 8.6 Z"/>',
  '<circle cx="12" cy="12" r="8"/>',
  '<path d="M12 3.5 L21 19.5 H3 Z"/>',
  '<rect x="4.5" y="4.5" width="15" height="15" rx="1.5"/>',
  '<path d="M12 2.5 L21 12 L12 21.5 L3 12 Z"/>',
  '<path d="M12 20 C5 15 2 11.5 4 7.5 C6 4 10 4.5 12 8 C14 4.5 18 4 20 7.5 C22 11.5 19 15 12 20 Z"/>',
  '<path d="M12 3 V21 M3 12 H21 M5.6 5.6 L18.4 18.4 M18.4 5.6 L5.6 18.4" stroke-width="3.4" fill="none"/>',
  '<path d="M15 3 A9 9 0 1 0 21 15 A7 7 0 0 1 15 3 Z"/>',
  '<path d="M13 2 L4.5 13.5 H11 L10 22 L19.5 9.5 H13 Z"/>',
];
const shapeSvg = (i) => `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">${SHAPES[i]}</svg>`;

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
      grid.dataset.n = round.pads;
      grid.replaceChildren();
      pads = Array.from({ length: round.pads }, (_, i) => {
        const pad = h('button', { class: 'mm-pad', style: { '--pc': PAD_COLORS[i] }, html: shapeSvg(i) });
        onTap(pad, () => press(i));
        grid.append(pad);
        return pad;
      });
    };
    const renderInfo = () => {
      level.textContent = `Level ${round.level}`;
      fill(hearts, [0, 1, 2].map((i) => icon(i < lives ? 'heartFull' : 'heart', i < lives ? 'life' : 'life lost')));
      fill(seqDots, round.seq.map((_, i) => h('span', { class: `dot ${i < idx ? 'done' : ''}` })));
    };
    const light = (i, cls = 'lit', ms = 220) => {
      const pad = pads[i];
      if (!pad) return;
      pad.classList.add(cls);
      setTimeout(() => pad.classList.remove(cls), ms);
    };
    function setStatus(text, cls) {
      if (status.textContent !== text) status.textContent = text;
      status.className = `mm-status ${cls}`;
    }

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
          setStatus('Nailed it', 'good');
          fx.burstAt(grid, { count: 24 });
        }
      } else {
        light(i, 'wrong', 400);
        locked = true;
      }
    };

    const startRound = (r) => {
      const rebuild = !pads.length || r.pads !== round.pads;
      round = r;
      idx = 0;
      locked = false;
      lastLit = -1;
      if (rebuild) buildPads();
      renderInfo();
    };
    buildPads();
    startRound(round);
    ctx.setScore(ctx.init.score || 0);
    if (ctx.init.done) ctx.finished('Out of lives', `You reached level ${round.level}`);

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
        const lit = (now - round.showStart) % step < round.flash ? i : -1;
        if (lit !== lastLit) {
          pads.forEach((p) => p.classList.remove('lit'));
          if (lit >= 0 && round.seq[lit] != null) {
            pads[round.seq[lit]]?.classList.add('lit');
            sfx.note(round.seq[lit]);
          }
          lastLit = lit;
        }
        setStatus('Watch closely', 'wait');
        grid.classList.add('watching');
        return;
      }
      if (lastLit !== -2) { pads.forEach((p) => p.classList.remove('lit')); lastLit = -2; }
      grid.classList.remove('watching');
      if (!locked) setStatus('Your turn', 'go');
    });

    ctx.onMsg((m) => {
      if (m.type === 'clear') {
        ctx.setScore(m.score);
        sfx.levelUp();
        ctx.popup(`Level ${m.round.level}`, 'good');
        startRound(m.round);
      } else if (m.type === 'wrong') {
        lives = m.lives;
        sfx.bad();
        ctx.vibrate([80, 40, 80]);
        fx.shake(grid);
        light(m.expected, 'hint', 700);
        if (m.done) {
          renderInfo();
          ctx.finished('Out of lives', `You reached level ${round.level}`);
          return;
        }
        ctx.popup(`${lives} ${lives === 1 ? 'life' : 'lives'} left`, 'bad');
        startRound(m.round);
      }
    });
  },

  demo() {
    return demoPhone(h('div', { class: 'demo-pads' }, PAD_COLORS.slice(0, 4).map((c, i) => h('span', { style: { '--pc': c, animationDelay: `${i * 0.5}s` }, html: shapeSvg(i) }))));
  },
};
