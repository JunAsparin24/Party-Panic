// Catch or Crash — phone controller (canvas).
import { h, charUrl } from '../ui.js';
import { art, artImage } from '../art.js';
import { fitCanvas, roundRect, loadImage, demoPhone } from './common.js';

export default {
  player(ctx) {
    const { root, bag, sfx, fx } = ctx;
    const init = ctx.init;
    const LANES = init.lanes || 5;
    const items = init.items || [];
    const values = init.values || { coin: 10, star: 25, gem: 50, bomb: -30 };
    const IMG = { coin: artImage('coin'), star: artImage('star'), gem: artImage('gem'), bomb: artImage('bomb') };
    let lane = init.lane ?? 2;
    let drawLane = lane;
    let stunUntil = init.stunUntil || 0;
    let score = init.score || 0;
    const predicted = new Set();
    const confirmed = new Set();
    const pops = [];

    const holder = h('div', { class: 'cc-holder' });
    root.append(holder, h('div', { class: 'cc-hint' }, ctx.reversed ? 'Controls reversed!' : 'Tap a lane to move'));
    const { canvas, ctx: g, size } = fitCanvas(holder, bag);
    const face = loadImage(charUrl(ctx.character, { bg: false }));
    ctx.setScore(score);

    const vis = (l) => (ctx.reversed ? LANES - 1 - l : l);
    const laneOf = (clientX) => {
      const r = canvas.getBoundingClientRect();
      return vis(Math.max(0, Math.min(LANES - 1, Math.floor(((clientX - r.left) / r.width) * LANES))));
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
      if (e.key === 'ArrowLeft') move(Math.max(0, Math.min(LANES - 1, lane + (ctx.reversed ? 1 : -1))));
      if (e.key === 'ArrowRight') move(Math.max(0, Math.min(LANES - 1, lane + (ctx.reversed ? -1 : 1))));
    });

    const effect = (item, x, y) => {
      const v = values[item.type];
      const r = canvas.getBoundingClientRect();
      if (item.type === 'bomb') {
        sfx.boom();
        fx.shake();
        ctx.vibrate([120, 50, 120]);
        pops.push({ text: `${v}`, x, y, a: 1, color: '#ff5a3c' });
        fx.burst(r.left + x, r.top + y, { count: 22, speed: 7, colors: ['#ff5a3c', '#ffc23d', '#2f2650'] });
      } else {
        if (item.type === 'gem') sfx.great(); else sfx.coin();
        pops.push({ text: `+${v}`, x, y, a: 1, color: '#ffc23d' });
        fx.burst(r.left + x, r.top + y, { count: item.type === 'gem' ? 24 : 10, speed: 5, colors: ['#ffc23d', '#fff6e6', '#3fe0d0'] });
      }
    };

    bag.raf(() => {
      const W = size.w;
      const H = size.h;
      const now = ctx.now();
      const lw = W / LANES;
      const basketY = H - 66;
      const topY = -30;
      const stunned = now < stunUntil;

      g.fillStyle = '#1e1640';
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < LANES; i++) {
        g.fillStyle = vis(i) === lane ? 'rgba(63,224,208,.16)' : i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.07)';
        g.fillRect(i * lw, 0, lw, H);
      }
      g.fillStyle = 'rgba(255,255,255,.08)';
      g.fillRect(0, basketY + 30, W, 3);

      const sz = Math.min(lw * 0.72, 54);
      for (const it of items) {
        if (now < it.spawnAt) continue;
        const k = (now - it.spawnAt) / it.fall;
        if (k > 1.35) continue;
        const x = vis(it.lane) * lw + lw / 2;
        const y = topY + k * (basketY - topY);
        if (now >= it.spawnAt + it.fall && !predicted.has(it.id)) {
          predicted.add(it.id);
          if (it.lane === lane) {
            it.caughtLocal = true;
            if (!confirmed.has(it.id)) effect(it, x, basketY);
          }
        }
        if (it.caughtLocal || confirmed.has(it.id)) continue;
        g.globalAlpha = k > 1 ? Math.max(0, 1 - (k - 1) * 3) : 1;
        const wob = it.type === 'bomb' ? Math.sin(now / 90 + it.id) * 0.12 : 0;
        if (it.type === 'bomb') {
          g.fillStyle = 'rgba(255, 90, 60, 0.32)';
          g.beginPath();
          g.arc(x, y + sz * 0.06, sz * 0.52, 0, Math.PI * 2);
          g.fill();
        }
        g.save();
        g.translate(x, y);
        g.rotate(wob);
        if (IMG[it.type].complete) g.drawImage(IMG[it.type], -sz / 2, -sz / 2, sz, sz);
        g.restore();
        g.globalAlpha = 1;
      }

      drawLane += (vis(lane) - drawLane) * 0.35;
      const bx = drawLane * lw + lw / 2;
      const shake = stunned ? Math.sin(now / 30) * 4 : 0;
      const bw = Math.min(lw * 0.92, 92);
      if (face.complete && face.naturalWidth) g.drawImage(face, bx - 27 + shake, basketY - 50, 54, 54);
      roundRect(g, bx - bw / 2 + shake, basketY - 4, bw, 32, 10);
      g.fillStyle = stunned ? '#8a86a3' : '#ff8c42';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = '#1b1530';
      g.stroke();
      g.strokeStyle = 'rgba(27,21,48,.35)';
      g.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        g.beginPath();
        g.moveTo(bx - bw / 2 + (bw * i) / 4 + shake, basketY + 2);
        g.lineTo(bx - bw / 2 + (bw * i) / 4 + shake, basketY + 24);
        g.stroke();
      }
      if (stunned) {
        for (let i = 0; i < 3; i++) {
          const a = now / 200 + (i * Math.PI * 2) / 3;
          const sx = bx + Math.cos(a) * 26;
          const sy = basketY - 58 + Math.sin(a) * 7;
          if (IMG.star.complete) g.drawImage(IMG.star, sx - 9, sy - 9, 18, 18);
        }
      }

      g.font = '24px Bungee, sans-serif';
      g.textAlign = 'center';
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i];
        p.y -= 1.4;
        p.a -= 0.025;
        if (p.a <= 0) { pops.splice(i, 1); continue; }
        g.globalAlpha = p.a;
        g.lineWidth = 5;
        g.strokeStyle = '#1b1530';
        g.strokeText(p.text, p.x, p.y - 34);
        g.fillStyle = p.color;
        g.fillText(p.text, p.x, p.y - 34);
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
      if (it && !it.caughtLocal) effect(it, vis(it.lane) * (size.w / LANES) + size.w / LANES / 2, size.h - 66);
    });
  },

  demo() {
    return demoPhone(h('div', { class: 'demo-catch' }, art('coin', 'f1'), art('bomb', 'f2'), art('star', 'f3'), h('span', { class: 'basket' })));
  },
};
