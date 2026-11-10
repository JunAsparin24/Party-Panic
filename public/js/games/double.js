// Double or Nothing — phone controller.
import { h, fill, icon, onTap, countUp } from '../ui.js';
import { art } from '../art.js';
import { demoPhone } from './common.js';

export default {
  player(ctx) {
    const { root, bag, sfx, fx } = ctx;
    const st = { ...ctx.init };
    let busy = false;

    const potEl = h('div', { class: 'dn-pot-val' }, st.pot);
    const bankEl = h('div', { class: 'dn-bank-val' }, st.bank);
    const risk = h('div', { class: 'dn-risk' });
    const chests = Array.from({ length: st.chests || 4 }, (_, i) => {
      const el = h('button', { class: 'dn-chest' }, art('chest'));
      onTap(el, () => pick(i));
      return el;
    });
    const bankBtn = h('button', { class: 'btn btn-primary dn-bank-btn' });
    onTap(bankBtn, () => bank());
    root.append(
      h('div', { class: 'dn-wrap' },
        h('div', { class: 'dn-top' },
          h('div', { class: 'dn-pot' }, h('div', { class: 'dn-cap' }, 'Pot'), potEl),
          h('div', { class: 'dn-bank' }, h('div', { class: 'dn-cap' }, 'Banked'), bankEl)),
        risk,
        h('div', { class: 'dn-chests' }, chests),
        bankBtn));

    const refresh = () => {
      potEl.textContent = st.pot;
      bankEl.textContent = st.bank;
      ctx.setScore(st.bank);
      fill(risk,
        h('span', { class: 'dn-bombs' }, Array.from({ length: 4 }, (_, i) => h('span', { class: i < st.bombCount ? 'b on' : 'b' }, art('bomb')))),
        h('span', { class: 'dn-odds' }, `${4 - st.bombCount} of 4 chests are safe`));
      risk.className = `dn-risk r${st.bombCount}`;
      fill(bankBtn, st.step > 0 ? [icon('lock'), `Bank ${st.pot}`] : 'Pick a chest');
      bankBtn.disabled = st.step === 0;
    };
    const resetChests = () => chests.forEach((c) => { c.className = 'dn-chest'; fill(c, art('chest')); });
    refresh();

    bag.raf(() => {
      bankBtn.classList.toggle('urgent', ctx.endsAt() - ctx.now() < 6000 && st.step > 0);
    });

    function pick(i) {
      if (busy || ctx.now() < st.lockUntil) return;
      busy = true;
      chests[i].classList.add('picked');
      ctx.send({ type: 'pick', i, step: st.step });
      sfx.tap();
      ctx.vibrate(15);
      bag.timeout(() => { busy = false; }, 2500);
    }
    function bank() {
      if (busy || st.step === 0) return;
      busy = true;
      ctx.send({ type: 'bank' });
      bag.timeout(() => { busy = false; }, 2500);
    }

    const reveal = (m, safeIdx) => {
      chests.forEach((c, j) => {
        c.classList.remove('picked');
        if (m.bombs.includes(j)) { fill(c, art(j === m.i ? 'boom' : 'bomb')); c.classList.add(j === m.i ? 'boom' : 'bomb'); }
        else { fill(c, art(j === safeIdx ? 'chestGold' : 'chestEmpty')); c.classList.add(j === safeIdx ? 'win' : 'empty'); }
      });
    };

    ctx.onMsg((m) => {
      const oldPot = st.pot;
      const oldBank = st.bank;
      Object.assign(st, { bank: m.bank, pot: m.pot, step: m.step, bombCount: m.bombCount, lockUntil: m.lockUntil });
      if (m.type === 'safe') {
        reveal(m, m.i);
        sfx.coin();
        fx.burstAt(chests[m.i], { count: 20, colors: ['#ffc23d', '#fff6e6'] });
        ctx.popup(`×2 · ${m.pot}`, 'good');
        countUp(potEl, oldPot, m.pot, 400);
        bag.timeout(() => { resetChests(); refresh(); busy = false; }, 650);
      } else if (m.type === 'boom') {
        reveal(m, -1);
        sfx.boom();
        fx.shake();
        fx.flash('#ff5a3c');
        ctx.vibrate([150, 60, 150]);
        ctx.popup(`Boom · −${m.lost}`, 'bad');
        potEl.textContent = '0';
        bag.timeout(() => { resetChests(); refresh(); busy = false; }, 1500);
      } else if (m.type === 'banked') {
        sfx.coin();
        bag.timeout(() => sfx.coin(), 120);
        fx.burstAt(bankEl, { count: 36, colors: ['#ffc23d', '#27c49a', '#fff6e6'] });
        ctx.popup(`Banked ${m.amount}`, 'good');
        countUp(bankEl, oldBank, m.bank, 600);
        ctx.vibrate(30);
        bag.timeout(() => { refresh(); busy = false; }, 400);
      }
    });
  },

  demo() {
    return demoPhone(h('div', { class: 'demo-chests' }, ['chest', 'chestGold', 'chest', 'bomb'].map((n, i) => {
      const el = art(n);
      el.style.animationDelay = `${i * 0.4}s`;
      return el;
    })));
  },
};
