// Catch or Crash — phone controller (canvas).
import { h, avatarUrl } from '../ui.js';
import { fitCanvas, roundRect, loadImage, demoPhone, EMOJI_FONT } from './common.js';

const EMOJI = { coin: '🪙', star: '⭐', gem: '💎', bomb: '💣' };

export default {
  player(ctx) {
    const { root, bag, sfx, fx } = ctx;
    const init = ctx.init;
    const LANES = init.lanes || 5;
    const items = init.items || [];
    const values = init.values || { coin: 10, star: 25, gem: 50, bomb: -30 };
    let lane = init.lane ?? 2;
    let drawLane = lane;
    let stunUntil = init.stunUntil || 0;
    let score = init.score || 0;
    const predicted = new Set();
    const confirmed = new Set();
    const pops = [];

    const holder = h('div', { class: 'cc-holder' });
    root.append(holder, h('div', { class: 'cc-hint' }, ctx.reversed ? '🔄 Controls reversed!' : 'Tap a lane to move'));
    const { canvas, ctx: g, size } = fitCanvas(holder, bag);
    const face = loadImage(avatarUrl(ctx.avatar, { bg: false }));
    ctx.setScore(score);

    const laneOf = (clientX) => {
      const r = canvas.getBoundingClientRect();
      let l = Math.max(0, Math.min(LANES - 1, Math.floor(((clientX - r.left) / r.width) * LANES)));
      if (ctx.reversed) l = LANES - 1 - l;
      return l;
    };
    const move = (l) => {
      if (ctx.now() < stunUntil) { sfx.buzz(); return; }
      if (l === lane) return;
      lane = l;
      ctx.send({ type: 'lane', lane });
      sfx.click();
      ctx.vibrate(8);
    };
    bag.listen(canvas, 'pointerdown', (e) => { e.preventDefault(); move(laneOf(e.clientX)); });
    bag.listen(window, 'keydown', (e) => {
      if (e.key === 'ArrowLeft') move(Math.max(0, lane + (ctx.reversed ? 1 : -1)));
      if (e.key === 'ArrowRight') move(Math.min(LANES - 1, lane + (ctx.reversed ? -1 : 1)));
    });

    const effect = (item, x, y) => {
      const v = values[item.type];
      if (item.type === 'bomb') {
        sfx.boom();
        fx.shake();
        ctx.vibrate([120, 50, 120]);
        pops.push({ text: `${v}`, x, y, a: 1, color: '#ff5964' });
      } else {
        if (item.type === 'gem') sfx.great(); else sfx.coin();
        pops.push({ text: `+${v}`, x, y, a: 1, color: '#ffd23f' });
        const r = canvas.getBoundingClientRect();
        fx.burst(r.left + x, r.top + y, { count: item.type === 'gem' ? 26 : 10, speed: 5, colors: ['#ffd23f', '#fff', '#2de2e6'] });
      }
    };

    bag.raf(() => {
      const W = size.w;
      const H = size.h;
      const now = ctx.now();
      const lw = W / LANES;
      const basketY = H - 64;
      const topY = -30;
      const stunned = now < stunUntil;

      g.fillStyle = '#20135c';
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < LANES; i++) {
        const vis = ctx.reversed ? LANES - 1 - i : i;
        g.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.08)';
        if (vis === lane) g.fillStyle = 'rgba(45,226,230,.16)';
        g.fillRect(i * lw, 0, lw, H);
      }

      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const fs = Math.min(lw * 0.62, 44);
      g.font = `${fs}px ${EMOJI_FONT}`;
      for (const it of items) {
        if (now < it.spawnAt) continue;
        const land = it.spawnAt + it.fall;
        const k = (now - it.spawnAt) / it.fall;
        if (k > 1.35) continue;
        const visLane = ctx.reversed ? LANES - 1 - it.lane : it.lane;
        const x = visLane * lw + lw / 2;
        const y = topY + k * (basketY - topY);
        if (now >= land && !predicted.has(it.id)) {
          predicted.add(it.id);
          if (it.lane === lane) {
            it.caughtLocal = true;
            if (!confirmed.has(it.id)) effect(it, x, basketY);
          }
        }
        if (it.caughtLocal || confirmed.has(it.id)) continue;
        if (it.type === 'bomb') {
          g.fillStyle = 'rgba(255,89,100,.25)';
          g.beginPath();
          g.arc(x, y, fs * 0.6, 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = k > 1 ? Math.max(0, 1 - (k - 1) * 3) : 1;
        g.fillStyle = '#000'; // emoji pick up fillStyle alpha on some browsers
        g.fillText(EMOJI[it.type], x, y);
        g.globalAlpha = 1;
      }

      // basket
      const target = ctx.reversed ? LANES - 1 - lane : lane;
      drawLane += (target - drawLane) * 0.35;
      const bx = drawLane * lw + lw / 2;
      const shake = stunned ? Math.sin(now / 30) * 4 : 0;
      const bw = Math.min(lw * 0.9, 90);
      if (face.complete && face.naturalWidth) g.drawImage(face, bx - 24 + shake, basketY - 46, 48, 48);
      roundRect(g, bx - bw / 2 + shake, basketY - 4, bw, 30, 10);
      g.fillStyle = stunned ? '#888' : '#ff8c42';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = '#1d1140';
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,.4)';
      g.fillRect(bx - bw / 2 + 8 + shake, basketY + 2, bw - 16, 4);
      if (stunned) {
        g.font = `24px ${EMOJI_FONT}`;
        g.fillText('😵', bx + shake, basketY - 60);
      }

      g.font = 'bold 22px "Lilita One", sans-serif';
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i];
        p.y -= 1.4;
        p.a -= 0.025;
        if (p.a <= 0) { pops.splice(i, 1); continue; }
        g.globalAlpha = p.a;
        g.fillStyle = p.color;
        g.fillText(p.text, p.x, p.y - 30);
      }
      g.globalAlpha = 1;
    });

    ctx.onMsg((m) => {
      if (m.type !== 'hit') return;
      score = m.score;
      stunUntil = m.stunUntil;
      ctx.setScore(score);
      const it = items.find((x) => x.id === m.id);
      confirmed.add(m.id);
      if (it && !it.caughtLocal) {
        const lw = size.w / LANES;
        const visLane = ctx.reversed ? LANES - 1 - it.lane : it.lane;
        effect(it, visLane * lw + lw / 2, size.h - 64);
      }
    });
  },

  demo() {
    return demoPhone(h('div', { class: 'demo-catch' }, h('span', { class: 'f1' }, '🪙'), h('span', { class: 'f2' }, '💣'), h('span', { class: 'f3' }, '⭐'), h('span', { class: 'basket' }, '🧺')));
  },
};
