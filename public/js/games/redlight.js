// Red Light Panic — phone controller, plus a giant traffic light on the host.
import { h, onTap, avatar } from '../ui.js';
import { demoPhone } from './common.js';

const LABELS = {
  green: 'GO GO GO!',
  turbo: '⚡ TURBO! ×2',
  yellow: 'Slow down…',
  red: 'FREEZE!',
};

function light(signal) {
  const s = signal?.s || 'red';
  return h('div', { class: `traffic ${s}` },
    h('span', { class: 'lamp red' }),
    h('span', { class: 'lamp yellow' }),
    h('span', { class: `lamp green ${s === 'turbo' ? 'turbo' : ''}` }));
}

export default {
  player(ctx) {
    const { root, bag, sfx, fx } = ctx;
    const TRACK = ctx.init.track || 100;
    let signal = ctx.init.signal || { s: 'red' };
    let pos = ctx.init.pos || 0;
    let place = ctx.init.place || null;
    let stunUntil = ctx.init.stunUntil || 0;

    const lightHolder = h('div', { class: 'rl-light' });
    const status = h('div', { class: 'rl-status' });
    const runner = avatar(ctx.avatar, { size: 44, class: 'rl-runner' });
    const fill = h('div', { class: 'rl-fill' });
    const track = h('div', { class: 'rl-track' }, fill, runner, h('span', { class: 'rl-flag' }, '🏁'));
    const dist = h('div', { class: 'rl-dist' });
    const btn = h('button', { class: 'rl-btn' }, 'RUN!');
    root.append(h('div', { class: 'rl-wrap' }, lightHolder, status, track, dist, btn));

    const renderSignal = () => {
      lightHolder.replaceChildren(light(signal));
      status.textContent = LABELS[signal.s] || '';
      root.dataset.sig = signal.s;
    };
    const renderPos = () => {
      const f = Math.min(1, pos / TRACK);
      fill.style.transform = `scaleX(${f})`;
      runner.style.left = `calc(${f * 100}% - 22px)`;
      dist.textContent = place ? `🏁 Finished #${place}!` : `${pos}m / ${TRACK}m`;
      ctx.setScore(pos);
    };
    renderSignal();
    renderPos();
    if (place) ctx.finished(`🏁 Finished #${place}!`, 'Nice running!');

    bag.raf(() => {
      const stunned = ctx.now() < stunUntil;
      btn.classList.toggle('stunned', stunned);
      btn.textContent = stunned ? '😵 STUNNED' : 'RUN!';
    });

    onTap(btn, () => {
      if (place || ctx.now() < stunUntil) return;
      ctx.send({ type: 'tap' });
      btn.classList.remove('hit');
      void btn.offsetWidth;
      btn.classList.add('hit');
      ctx.vibrate(6);
      runner.classList.remove('step');
      void runner.offsetWidth;
      runner.classList.add('step');
      if (signal.s !== 'red') {
        pos = Math.min(TRACK, pos + (signal.s === 'turbo' ? 2 : 1));
        sfx.tick();
        renderPos();
      }
    });

    ctx.onMsg((m) => {
      if (m.type === 'signal') {
        signal = m.signal;
        renderSignal();
        if (signal.s === 'red') { sfx.buzz(); ctx.vibrate(150); }
        else if (signal.s === 'green') sfx.good();
        else if (signal.s === 'turbo') { sfx.levelUp(); ctx.vibrate([20, 20, 20]); }
        else if (signal.s === 'yellow') sfx.beep();
      } else if (m.type === 'caught') {
        pos = m.pos;
        stunUntil = m.stunUntil;
        sfx.bad();
        fx.shake();
        fx.flash('#ff5964');
        ctx.vibrate([200, 80, 200]);
        ctx.popup('CAUGHT! −10m', 'bad');
        renderPos();
      } else if (m.type === 'pos') {
        // Trust the server, but don't jitter backwards for taps still in flight.
        if (Math.abs(m.pos - pos) > 3 || m.pos > pos) { pos = m.pos; renderPos(); }
      } else if (m.type === 'finish') {
        place = m.place;
        pos = m.pos;
        renderPos();
        sfx.fanfare();
        fx.confetti(100);
        ctx.finished(`🏁 Finished #${place}!`, place === 1 ? 'First across the line!' : 'Nice running!');
      }
    });
  },

  host(ctx) {
    const holder = h('div', { class: 'rl-host' });
    const label = h('div', { class: 'rl-host-label' });
    ctx.root.append(holder, label);
    const render = (sig) => {
      holder.replaceChildren(light(sig));
      label.textContent = LABELS[sig?.s] || '';
      label.dataset.sig = sig?.s;
    };
    render(ctx.init?.signal);
    return (m) => {
      if (m.type !== 'signal') return;
      render(m.signal);
      if (m.signal.s === 'red') ctx.sfx.buzz();
      else if (m.signal.s === 'green' || m.signal.s === 'turbo') ctx.sfx.good();
    };
  },

  demo() {
    return demoPhone(h('div', { class: 'demo-rl' }, light({ s: 'green' }), h('div', { class: 'demo-run' }, 'RUN!')));
  },
};
