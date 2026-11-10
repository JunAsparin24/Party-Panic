// Perfect Timing — phone controller.
import { h, onTap } from '../ui.js';
import { tri, demoPhone } from './common.js';

const GRADES = {
  perfect: { text: 'PERFECT!', cls: 'perfect' },
  great: { text: 'GREAT!', cls: 'great' },
  close: { text: 'SO CLOSE', cls: 'close' },
  miss: { text: 'MISS', cls: 'miss' },
};

export default {
  player(ctx) {
    const { root, bag, sfx, fx } = ctx;
    const st = { shots: 10, k: 0, results: [], score: 0, ...ctx.init };
    let frozen = null;

    const center = h('div', { class: 'pt-center' });
    const zone = h('div', { class: 'pt-zone' }, center);
    const marker = h('div', { class: 'pt-marker' });
    const bar = h('div', { class: 'pt-bar' }, zone, marker);
    const shotLbl = h('div', { class: 'pt-shot' });
    const grade = h('div', { class: 'pt-grade' });
    const dots = h('div', { class: 'pt-dots' });
    const tapBtn = h('div', { class: 'big-tap' }, 'TAP!');
    root.append(h('div', { class: 'pt-wrap' }, shotLbl, bar, grade, dots, tapBtn));

    const renderDots = () =>
      dots.replaceChildren(...Array.from({ length: st.shots }, (_, i) => h('span', { class: `dot ${st.results[i] || ''} ${i === st.k ? 'cur' : ''}` })));
    const setShot = () => {
      if (!st.cur) return;
      zone.style.left = `${(st.cur.center - st.cur.width / 2) * 100}%`;
      zone.style.width = `${st.cur.width * 100}%`;
      shotLbl.textContent = `Shot ${st.k + 1} of ${st.shots}`;
      zone.classList.remove('pop');
      void zone.offsetWidth;
      zone.classList.add('pop');
    };
    const posNow = () => tri(st.cur.phase0 + Math.max(0, ctx.now() - st.cur.t0) / st.cur.period);

    setShot();
    renderDots();
    ctx.setScore(st.score);
    if (st.done) ctx.finished('All shots fired!', `${st.score} points`);

    bag.raf(() => {
      if (!st.cur) return;
      const p = frozen ?? posNow();
      marker.style.left = `${p * 100}%`;
      marker.classList.toggle('waiting', ctx.now() < st.cur.t0);
    });

    onTap(root, () => {
      if (!st.cur || frozen != null || ctx.now() < st.cur.t0 - 50) return;
      frozen = posNow();
      ctx.send({ type: 'tap', shot: st.cur.k });
      sfx.tap();
      ctx.vibrate(15);
      tapBtn.classList.remove('pressed');
      void tapBtn.offsetWidth;
      tapBtn.classList.add('pressed');
    });

    ctx.onMsg((m) => {
      if (m.type !== 'result') return;
      frozen = m.pos;
      st.results[m.shot] = m.grade;
      st.score = m.score;
      ctx.setScore(m.score);
      const g = GRADES[m.grade];
      grade.replaceChildren(h('span', { class: `grade ${g.cls}` }, g.text), m.pts ? h('span', { class: 'grade-pts' }, ` +${m.pts}`) : null);
      if (m.grade === 'perfect') { sfx.great(); fx.burstAt(marker, { count: 36, colors: ['#ffd23f', '#fff', '#ff4f9a'] }); ctx.vibrate([20, 30, 20]); }
      else if (m.grade === 'great') { sfx.good(); fx.burstAt(marker, { count: 14 }); }
      else { sfx.bad(); fx.shake(bar); ctx.vibrate(60); }
      renderDots();
      bag.timeout(() => {
        frozen = null;
        st.k = m.shot + 1;
        st.cur = m.next;
        grade.replaceChildren();
        setShot();
        renderDots();
        if (m.done) ctx.finished('All shots fired!', `${m.score} points`);
      }, 650);
    });
  },

  demo() {
    return demoPhone(
      h('div', { class: 'demo-bar' }, h('div', { class: 'demo-zone' }), h('div', { class: 'demo-marker' })),
      h('div', { class: 'demo-tap' })
    );
  },
};
