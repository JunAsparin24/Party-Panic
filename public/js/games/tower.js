// Tower Trouble — phone controller (canvas).
import { h, fill, char, icon, onTap } from '../ui.js';
import { tri, fitCanvas, roundRect, demoPhone } from './common.js';

export default {
  player(ctx) {
    const { root, bag, sfx, fx } = ctx;
    const blocks = [...(ctx.init.blocks || [{ x: 0.25, w: 0.5 }])];
    let cur = ctx.init.cur;
    let height = ctx.init.height || 0;
    let done = !!ctx.init.done;
    let frozenX = null;
    let camY = 0;
    const falling = [];
    const flashes = [];

    const holder = h('div', { class: 'tw-holder' });
    const hint = h('div', { class: 'tw-hint' }, 'Tap to drop!');
    const heightLbl = h('div', { class: 'tw-height' }, `${height}`);
    root.append(holder, hint, heightLbl);
    const { ctx: g, size } = fitCanvas(holder, bag);

    const colorFor = (i) => `hsl(${(i * 27 + 330) % 360} 85% 62%)`;
    const curX = () => (1 - cur.w) * tri(cur.phase0 + Math.max(0, ctx.now() - cur.t0) / cur.period);

    ctx.setScore(ctx.init.score || 0);
    if (done) ctx.finished('Tower complete!', `${height} blocks high`);

    bag.raf(() => {
      const W = size.w;
      const H = size.h;
      const BH = Math.max(18, Math.min(34, H / 14));
      const boardW = W * 0.84;
      const ox = (W - boardW) / 2;
      const groundY = H - 26;
      const target = Math.max(0, (blocks.length - (H / BH) * 0.55) * BH);
      camY += (target - camY) * 0.12;
      const yOf = (i) => groundY - (i + 1) * BH + camY;

      // sky
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#2b1670');
      sky.addColorStop(1, '#6b3fd6');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,.08)';
      for (let i = 0; i < 12; i++) {
        const sy = ((i * 97 + camY * 0.3) % H);
        g.fillRect((i * 53) % W, sy, 3, 3);
      }
      // ground
      g.fillStyle = '#1d1140';
      g.fillRect(0, groundY + camY, W, H);

      const drawBlock = (x, y, w, color) => {
        roundRect(g, ox + x * boardW, y, w * boardW, BH - 2, 6);
        g.fillStyle = color;
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#1d1140';
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,.35)';
        g.fillRect(ox + x * boardW + 5, y + 4, Math.max(0, w * boardW - 10), 4);
      };

      blocks.forEach((b, i) => {
        const y = yOf(i);
        if (y > H + BH || y < -BH * 2) return;
        drawBlock(b.x, y, b.w, colorFor(i));
      });

      if (!done && cur) {
        const x = frozenX ?? curX();
        drawBlock(x, yOf(blocks.length) - 4, cur.w, colorFor(blocks.length));
        if (ctx.now() < cur.t0) {
          g.globalAlpha = 0.35;
          g.fillStyle = '#fff';
          g.fillRect(ox + x * boardW, yOf(blocks.length) - 4, cur.w * boardW, BH - 2);
          g.globalAlpha = 1;
        }
      }

      for (let i = falling.length - 1; i >= 0; i--) {
        const f = falling[i];
        f.vy += 0.6;
        f.y += f.vy;
        f.rot += f.vr;
        g.save();
        g.translate(ox + (f.x + f.w / 2) * boardW, f.y + BH / 2);
        g.rotate(f.rot);
        roundRect(g, -(f.w * boardW) / 2, -BH / 2, f.w * boardW, BH - 2, 6);
        g.fillStyle = f.color;
        g.fill();
        g.strokeStyle = '#1d1140';
        g.lineWidth = 3;
        g.stroke();
        g.restore();
        if (f.y > H + 100) falling.splice(i, 1);
      }

      for (let i = flashes.length - 1; i >= 0; i--) {
        const fl = flashes[i];
        fl.a -= 0.04;
        if (fl.a <= 0) { flashes.splice(i, 1); continue; }
        g.globalAlpha = fl.a;
        g.fillStyle = '#fff';
        g.fillRect(ox + fl.x * boardW - 4, yOf(fl.i) - 4, fl.w * boardW + 8, BH + 6);
        g.globalAlpha = 1;
      }

      // Stash for the drop handler
      size.BH = BH; size.yOf = yOf; size.ox = ox; size.boardW = boardW;
    });

    onTap(root, () => {
      if (done || !cur || frozenX != null) return;
      frozenX = curX();
      ctx.send({ type: 'drop', h: cur.h });
      sfx.drop();
      ctx.vibrate(15);
      hint.classList.add('hidden');
    });

    ctx.onMsg((m) => {
      if (m.type === 'placed') {
        const i = blocks.length;
        blocks.push(m.block);
        height = m.height;
        heightLbl.textContent = `${height}`;
        if (m.chopped) {
          falling.push({ ...m.chopped, y: size.yOf(i), vy: -2, vr: (m.chopped.x < m.block.x ? -1 : 1) * 0.06, rot: 0, color: `hsl(${(i * 27 + 330) % 360} 85% 62%)` });
        }
        if (m.perfect) {
          flashes.push({ x: m.block.x, w: m.block.w, i, a: 1 });
          sfx.great();
          ctx.popup(m.combo >= 3 ? `PERFECT ×${m.combo}!` : 'PERFECT!', 'good');
          fx.burst(innerWidth / 2, innerHeight * 0.45, { count: 24, colors: ['#ffd23f', '#fff'] });
          ctx.vibrate([15, 30, 15]);
        } else sfx.stack(height);
        cur = m.cur;
        frozenX = null;
        ctx.setScore(m.score);
      } else if (m.type === 'fall') {
        done = true;
        const i = blocks.length;
        falling.push({ x: m.x, w: m.w, y: size.yOf(i), vy: -3, vr: 0.08, rot: 0, color: '#ff5964' });
        sfx.boom();
        fx.shake();
        ctx.vibrate([100, 50, 200]);
        bag.timeout(() => ctx.finished('Tower complete!', `${m.height} blocks high`), 900);
      }
    });
  },

  // Big screen: everyone's tower side by side.
  host(ctx) {
    const wrap = h('div', { class: 'tw-host' });
    ctx.root.append(wrap);
    const cols = new Map();
    for (const p of ctx.players) {
      const stack = h('div', { class: 'twh-stack' });
      const top = h('div', { class: 'twh-top' }, char(p.character, { size: 44 }));
      const label = h('div', { class: 'twh-label' }, h('b', null, '0'), h('span', null, p.name));
      const col = h('div', { class: 'twh-col' }, h('div', { class: 'twh-sky' }, top, stack), label);
      cols.set(p.id, { col, stack, top, label, h: -1 });
      wrap.append(col);
    }
    const colors = (i) => `hsl(${(i * 27 + 330) % 360} 80% 62%)`;
    return {
      full: true,
      progress(prog) {
        const maxH = Math.max(8, ...Object.values(prog).map((x) => x.h || 0));
        const room = (wrap.clientHeight || 400) - 130;
        const bh = Math.max(4, Math.min(26, room / (maxH + 1)));
        for (const [id, c] of cols) {
          const pr = prog[id];
          if (!pr) continue;
          if (pr.h !== c.h) {
            c.h = pr.h;
            // Widths shrink from the base towards the current top width.
            const blocks = [];
            for (let i = 0; i <= pr.h; i++) {
              const w = 0.5 + (pr.w - 0.5) * (pr.h ? i / pr.h : 0);
              blocks.push(h('div', { class: 'twh-block', style: { width: `${w * 180}%`, background: colors(i) } }));
            }
            fill(c.stack, blocks.reverse());
            fill(c.label, h('b', null, pr.h), h('span', null, ctx.p(id).name));
            if (pr.h > 0) { c.top.classList.remove('hop-once'); void c.top.offsetWidth; c.top.classList.add('hop-once'); }
          }
          c.stack.style.setProperty('--bh', `${bh}px`);
          c.col.classList.toggle('fallen', !!pr.done);
        }
      },
    };
  },

  demo() {
    return demoPhone(h('div', { class: 'demo-tower' }, h('span', { class: 'b1' }), h('span', { class: 'b2' }), h('span', { class: 'b3' }), h('span', { class: 'mover' })));
  },
};
