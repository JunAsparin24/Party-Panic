// Particle effects on a full-screen canvas overlay, plus floating text.

const canvas = document.getElementById('fx');
const ctx = canvas.getContext('2d');
let particles = [];
let running = false;
let dpr = 1;

const COLORS = ['#ff4f9a', '#ffd23f', '#2de2e6', '#3ddc84', '#ff8c42', '#8e5cff', '#ffffff'];

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
}
resize();
addEventListener('resize', resize);

function loop() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const next = [];
  for (const p of particles) {
    p.life -= 1;
    if (p.life <= 0) continue;
    p.vx *= p.drag;
    p.vy = p.vy * p.drag + p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    const a = Math.min(1, p.life / 25);
    ctx.globalAlpha = a;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    else if (p.shape === 'star') star(p.size);
    else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    next.push(p);
  }
  ctx.globalAlpha = 1;
  particles = next;
  if (particles.length) requestAnimationFrame(loop);
  else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}

function star(r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.22 : r * 0.55;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
}

function add(list) {
  // Cap the particle count so low-end phones stay smooth.
  particles.push(...list);
  if (particles.length > 450) particles = particles.slice(-450);
  if (!running) { running = true; requestAnimationFrame(loop); }
}

export const fx = {
  confetti(count = 140) {
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push({
        x: Math.random() * innerWidth,
        y: -20 - Math.random() * innerHeight * 0.4,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        g: 0.06,
        drag: 0.995,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.3,
        size: 8 + Math.random() * 8,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        shape: Math.random() < 0.7 ? 'rect' : 'circle',
        life: 160 + Math.random() * 100,
      });
    }
    add(list);
  },
  burst(x, y, { count = 30, colors = COLORS, speed = 7, shape = 'mixed', size = 9 } = {}) {
    const list = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      list.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 2,
        g: 0.18,
        drag: 0.96,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.4,
        size: size * (0.6 + Math.random() * 0.8),
        color: colors[(Math.random() * colors.length) | 0],
        shape: shape === 'mixed' ? (Math.random() < 0.5 ? 'star' : 'circle') : shape,
        life: 45 + Math.random() * 30,
      });
    }
    add(list);
  },
  burstAt(el, opts) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    fx.burst(r.left + r.width / 2, r.top + r.height / 2, opts);
  },
  fireworks(times = 6) {
    for (let i = 0; i < times; i++) {
      setTimeout(() => {
        fx.burst(innerWidth * (0.15 + Math.random() * 0.7), innerHeight * (0.15 + Math.random() * 0.4), {
          count: 50,
          speed: 9,
          colors: [COLORS[(Math.random() * COLORS.length) | 0], '#ffffff'],
          shape: 'circle',
          size: 6,
        });
      }, i * 380);
    }
  },
  float(text, x, y, color = '#ffd23f') {
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = color;
    document.body.append(el);
    setTimeout(() => el.remove(), 1100);
  },
  floatAt(el, text, color) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    fx.float(text, r.left + r.width / 2, r.top + r.height / 3, color);
  },
  shake(el = document.getElementById('app'), cls = 'shake') {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 500);
  },
  flash(color = '#fff') {
    const el = document.createElement('div');
    el.className = 'screen-flash';
    el.style.background = color;
    document.body.append(el);
    setTimeout(() => el.remove(), 500);
  },
};
