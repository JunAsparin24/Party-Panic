// Tug of War — phone controller and the rope on the big screen.
import { h, fill, char, icon, onTap } from '../ui.js';
import { TEAMS } from '/shared/config.js';
import { demoPhone } from './common.js';

const SIDE = {
  L: { name: 'Left', color: '#ff5a3c' },
  R: { name: 'Right', color: '#3fa7ff' },
};
const sideInfo = (s, teams) => (teams ? { name: TEAMS[s === 'L' ? 0 : 1].name, color: TEAMS[s === 'L' ? 0 : 1].color } : SIDE[s]);

export default {
  player(ctx) {
    const { root, sfx, fx } = ctx;
    const me = ctx.init.side || 'L';
    const mine = sideInfo(me, ctx.init.teams);
    const them = sideInfo(me === 'L' ? 'R' : 'L', ctx.init.teams);
    let pos = ctx.init.pos || 0;
    let taps = ctx.init.taps || 0;
    let over = !!ctx.init.winner;

    const knot = h('div', { class: 'tg-knot' });
    const rope = h('div', { class: 'tg-rope', style: { '--l': me === 'L' ? mine.color : them.color, '--r': me === 'R' ? mine.color : them.color } },
      h('div', { class: 'tg-zone left' }), h('div', { class: 'tg-zone right' }), h('div', { class: 'tg-line' }), knot);
    const statusEl = h('div', { class: 'tg-status' });
    const btn = h('button', { class: 'tg-btn', style: { '--side': mine.color } }, me === 'L' ? icon('left') : null, 'PULL', me === 'R' ? icon('right') : null);
    root.append(h('div', { class: 'tg-wrap', style: { '--side': mine.color } },
      h('div', { class: 'tg-team' }, h('span', { class: 'tg-dot' }), `You pull for `, h('b', null, mine.name)),
      h('div', { class: 'tg-sizes' }, `${ctx.init.sizes?.[me] ?? 1} vs ${ctx.init.sizes?.[me === 'L' ? 'R' : 'L'] ?? 1}`),
      rope,
      statusEl,
      btn));

    const render = () => {
      knot.style.left = `${50 + pos * 50}%`;
      const mySign = me === 'L' ? -1 : 1;
      const lead = pos * mySign;
      statusEl.textContent = over ? '' : lead > 0.15 ? 'You are winning!' : lead < -0.15 ? 'Pull harder!' : 'Dead even';
      statusEl.className = `tg-status ${lead > 0.15 ? 'good' : lead < -0.15 ? 'bad' : ''}`;
      ctx.setScore(taps);
    };
    render();

    onTap(btn, () => {
      if (over) return;
      taps++;
      ctx.send({ type: 'pull' });
      ctx.vibrate(6);
      sfx.tick();
      btn.classList.remove('hit');
      void btn.offsetWidth;
      btn.classList.add('hit');
      ctx.setScore(taps);
    });

    ctx.onMsg((m) => {
      if (m.type !== 'rope') return;
      pos = m.pos;
      if (m.winner && !over) {
        over = true;
        const won = m.winner === me;
        if (won) { sfx.fanfare(); fx.confetti(120); } else sfx.eliminated();
        ctx.vibrate(won ? [60, 60, 60] : [300]);
        ctx.finished(won ? 'Your side won!' : 'Pulled over the line', `${taps} pulls from you`);
      }
      render();
    });
  },

  host(ctx) {
    const init = ctx.init || { members: { L: [], R: [] }, pos: 0 };
    const L = sideInfo('L', init.teams);
    const R = sideInfo('R', init.teams);
    const knot = h('div', { class: 'tgh-knot' });
    const crew = (ids, side) => h('div', { class: `tgh-crew ${side}` }, ids.map((id, i) => {
      const el = char(ctx.p(id).character, { size: 64, class: 'tgh-puller' });
      el.style.animationDelay = `${-i * 0.13}s`;
      return el;
    }));
    const ropeRow = h('div', { class: 'tgh-row' },
      crew(init.members.L, 'left'),
      h('div', { class: 'tgh-rope' }, h('div', { class: 'tgh-line' }), knot),
      crew(init.members.R, 'right'));
    const shift = h('div', { class: 'tgh-shift' }, ropeRow);
    const banner = h('div', { class: 'tgh-banner' });
    ctx.root.append(h('div', { class: 'tgh', style: { '--l': L.color, '--r': R.color } },
      h('div', { class: 'tgh-heads' },
        h('div', { class: 'tgh-side left' }, h('b', null, L.name), `${init.members.L.length} players`),
        h('div', { class: 'tgh-side right' }, h('b', null, R.name), `${init.members.R.length} players`)),
      h('div', { class: 'tgh-arena' }, h('div', { class: 'tgh-mark left' }), h('div', { class: 'tgh-mark right' }), h('div', { class: 'tgh-mid' }), shift),
      banner));
    let done = false;
    const render = (pos) => {
      shift.style.transform = `translateX(${pos * 22}%)`;
      knot.classList.toggle('hot', Math.abs(pos) > 0.7);
    };
    render(init.pos || 0);
    return {
      full: true,
      msg(m) {
        if (m.type !== 'rope') return;
        render(m.pos);
        if (m.winner && !done) {
          done = true;
          const w = m.winner === 'L' ? L : R;
          fill(banner, `${w.name} win the pull!`);
          banner.style.background = w.color;
          banner.classList.add('show');
          ctx.sfx.fanfare();
          ctx.fx.confetti(160);
        }
      },
    };
  },

  demo() {
    return demoPhone(h('div', { class: 'demo-tug' }, h('div', { class: 'demo-rope' }, h('span')), h('div', { class: 'demo-run tug' }, 'PULL')));
  },
};
