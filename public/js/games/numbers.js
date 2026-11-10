// Number Rush — phone controller.
import { h, fill, icon, onTap } from '../ui.js';
import { demoPhone } from './common.js';

export default {
  player(ctx) {
    const { root, bag, sfx, fx } = ctx;
    let prob = ctx.init.prob;
    let value = '';
    let pending = false;
    let lockUntil = ctx.init.lockUntil || 0;
    let streak = ctx.init.streak || 0;

    const streakEl = h('div', { class: 'nr-streak' });
    const q = h('div', { class: 'nr-q' });
    const ans = h('div', { class: 'nr-ans' });
    const card = h('div', { class: 'nr-card' }, q, h('div', { class: 'nr-eq' }, '='), ans);
    let keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];
    if (ctx.reversed) keys = keys.reverse();
    const pad = h('div', { class: 'nr-pad' },
      keys.map((k) => {
        const b = h('button', { class: `nr-key ${k === '✓' ? 'go' : k === '⌫' ? 'del' : ''}` }, k === '✓' ? icon('check') : k === '⌫' ? icon('back') : k);
        onTap(b, () => press(k, b));
        return b;
      }));
    root.append(h('div', { class: 'nr-wrap' }, streakEl, card, pad));

    const render = () => {
      q.textContent = prob.q;
      ans.textContent = value || '?';
      ans.classList.toggle('empty', !value);
      if (streak >= 2) fill(streakEl, icon('fire'), `${streak} in a row`);
      else streakEl.textContent = 'Solve it';
      streakEl.classList.toggle('hot', streak >= 3);
    };
    render();
    ctx.setScore(ctx.init.score || 0);

    function press(k, btn) {
      btn.classList.remove('hit');
      void btn.offsetWidth;
      btn.classList.add('hit');
      if (pending || ctx.now() < lockUntil) return;
      ctx.vibrate(8);
      if (k === '⌫') { value = value.slice(0, -1); sfx.click(); }
      else if (k === '✓') {
        if (!value) return;
        pending = true;
        ctx.send({ type: 'answer', k: prob.k, value: Number(value) });
        bag.timeout(() => { pending = false; }, 2500);
      } else if (value.length < 4) { value += k; sfx.click(); }
      render();
    }

    ctx.onMsg((m) => {
      pending = false;
      if (m.type === 'correct') {
        streak = m.streak;
        ctx.setScore(m.score);
        card.classList.remove('right', 'wrong');
        void card.offsetWidth;
        card.classList.add('right');
        sfx.good();
        ctx.popup(`+${m.pts}`, 'good');
        if (streak > 0 && streak % 5 === 0) fx.burstAt(streakEl, { count: 30 });
        prob = m.prob;
        value = '';
        render();
      } else if (m.type === 'wrong') {
        streak = 0;
        lockUntil = m.lockUntil;
        card.classList.remove('right', 'wrong');
        void card.offsetWidth;
        card.classList.add('wrong');
        sfx.bad();
        ctx.vibrate(120);
        value = '';
        render();
      }
    });
  },

  demo() {
    return demoPhone(h('div', { class: 'demo-sum' }, '7 × 8 = ', h('b', null, '56')), h('div', { class: 'demo-keys' }, Array.from({ length: 9 }, (_, i) => h('span', null, i + 1))));
  },
};
