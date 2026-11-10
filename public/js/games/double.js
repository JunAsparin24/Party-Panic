// Double or Nothing — phone controller.
import { h, onTap, countUp } from '../ui.js';
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
      const el = h('button', { class: 'dn-chest' }, h('span', { class: 'dn-emoji' }, '🎁'));
      onTap(el, () => pick(i));
      return el;
    });
    const bankBtn = h('button', { class: 'btn btn-green dn-bank-btn' });
    onTap(bankBtn, () => bank());
    root.append(
      h('div', { class: 'dn-wrap' },
        h('div', { class: 'dn-top' },
          h('div', { class: 'dn-pot' }, h('div', { class: 'dn-cap' }, 'POT'), potEl),
          h('div', { class: 'dn-bank' }, h('div', { class: 'dn-cap' }, 'BANKED'), bankEl)),
        risk,
        h('div', { class: 'dn-chests' }, chests),
        bankBtn));

    const refresh = () => {
      potEl.textContent = st.pot;
      bankEl.textContent = st.bank;
      ctx.setScore(st.bank);
      const safe = 4 - st.bombCount;
      risk.replaceChildren(
        h('span', null, `💣 ×${st.bombCount}`),
        h('span', { class: 'dn-odds' }, ` · ${safe} of 4 chests are safe`)
      );
      risk.className = `dn-risk r${st.bombCount}`;
      bankBtn.textContent = st.step > 0 ? `💰 BANK ${st.pot}` : 'Pick a chest!';
      bankBtn.disabled = st.step === 0;
    };
    const resetChests = () => chests.forEach((c) => { c.className = 'dn-chest'; c.firstChild.textContent = '🎁'; });
    refresh();

    bag.raf(() => {
      const left = ctx.endsAt() - ctx.now();
      bankBtn.classList.toggle('urgent', left < 6000 && st.step > 0);
    });

    function pick(i) {
      if (busy || ctx.now() < st.lockUntil) return;
      busy = true;
      chests[i].classList.add('picked');
      ctx.send({ type: 'pick', i, step: st.step });
      sfx.tap();
      ctx.vibrate(15);
      // Safety: unlock if the server never answers.
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
        if (m.bombs.includes(j)) { c.firstChild.textContent = j === m.i ? '💥' : '💣'; c.classList.add(j === m.i ? 'boom' : 'bomb'); }
        else { c.firstChild.textContent = j === safeIdx ? '💰' : '✨'; c.classList.add(j === safeIdx ? 'win' : 'empty'); }
      });
    };

    ctx.onMsg((m) => {
      const oldPot = st.pot;
      const oldBank = st.bank;
      Object.assign(st, { bank: m.bank, pot: m.pot, step: m.step, bombCount: m.bombCount, lockUntil: m.lockUntil });
      if (m.type === 'safe') {
        reveal(m, m.i);
        sfx.coin();
        fx.burstAt(chests[m.i], { count: 20, colors: ['#ffd23f', '#fff'] });
        ctx.popup(`×2 → ${m.pot}`, 'good');
        countUp(potEl, oldPot, m.pot, 400);
        bag.timeout(() => { resetChests(); refresh(); busy = false; }, 600);
        ctx.setScore(st.bank);
        risk.textContent = '';
      } else if (m.type === 'boom') {
        reveal(m, -1);
        sfx.boom();
        fx.shake();
        fx.flash('#ff5964');
        ctx.vibrate([150, 60, 150]);
        ctx.popup(`💥 -${m.lost}`, 'bad');
        potEl.textContent = '0';
        bag.timeout(() => { resetChests(); refresh(); busy = false; }, 1500);
      } else if (m.type === 'banked') {
        sfx.coin();
        bag.timeout(() => sfx.coin(), 120);
        fx.burstAt(bankEl, { count: 40, colors: ['#ffd23f', '#3ddc84', '#fff'] });
        ctx.popup(`Banked ${m.amount}!`, 'good');
        countUp(bankEl, oldBank, m.bank, 600);
        ctx.vibrate(30);
        bag.timeout(() => { refresh(); busy = false; }, 400);
      }
    });
  },

  demo() {
    return demoPhone(h('div', { class: 'demo-chests' }, ['🎁', '💰', '🎁', '💣'].map((e, i) => h('span', { style: { animationDelay: `${i * 0.4}s` } }, e))));
  },
};
