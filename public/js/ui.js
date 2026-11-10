// Small DOM helpers shared by every screen.
import { renderCharacter, slotInfo } from '/shared/characters.js';
import { icon } from './icons.js';

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      } else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  appendKids(el, kids);
  return el;
}

function appendKids(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

/** Like replaceChildren but skips null/false and flattens arrays. */
export function fill(el, ...kids) {
  el.replaceChildren();
  appendKids(el, kids);
  return el;
}

export { icon };

let current = null;
let currentCleanup = null;

/** Swap the visible screen with a transition. */
export function show(screen, cleanup) {
  const app = document.getElementById('app');
  if (currentCleanup) {
    try { currentCleanup(); } catch (e) { console.error(e); }
  }
  currentCleanup = cleanup || null;
  const old = current;
  current = screen;
  screen.classList.add('screen');
  if (old) {
    old.classList.add('out');
    old.style.pointerEvents = 'none';
    setTimeout(() => old.remove(), 380);
  }
  app.append(screen);
  return screen;
}

export function toast(msg, kind = 'info', ms = 3200) {
  const el = h('div', { class: `toast ${kind}` }, msg);
  document.getElementById('toasts').append(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 400);
}

/** A character portrait. opts: size (px), mood, crown, class, ring (colour). */
export function char(slot, opts = {}) {
  const el = h('div', { class: `char ${opts.class || ''}`, html: renderCharacter(slot, opts) });
  if (opts.size) el.style.setProperty('--size', typeof opts.size === 'number' ? `${opts.size}px` : opts.size);
  if (opts.ring) el.style.setProperty('--ring', opts.ring);
  return el;
}

export function charUrl(slot, opts = {}) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderCharacter(slot, opts))}`;
}

export const charName = (slot) => slotInfo(slot).name;

/** Animate a number in an element. */
export function countUp(el, from, to, dur = 900, prefix = '') {
  const start = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - start) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = prefix + Math.round(from + (to - from) * e).toLocaleString();
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** requestAnimationFrame loop with a stop function. */
export function rafLoop(fn) {
  let id = 0;
  let alive = true;
  const step = (t) => {
    if (!alive) return;
    try { fn(t); } catch (e) { console.error(e); }
    id = requestAnimationFrame(step);
  };
  id = requestAnimationFrame(step);
  return () => { alive = false; cancelAnimationFrame(id); };
}

/** Collects cleanup functions so screens can tidy up in one call. */
export class Bag {
  constructor() { this.fns = []; }
  add(fn) { if (typeof fn === 'function') this.fns.push(fn); return fn; }
  timeout(fn, ms) { const id = setTimeout(fn, ms); this.add(() => clearTimeout(id)); return id; }
  interval(fn, ms) { const id = setInterval(fn, ms); this.add(() => clearInterval(id)); return id; }
  raf(fn) { return this.add(rafLoop(fn)); }
  listen(el, ev, fn, opts) { el.addEventListener(ev, fn, opts); this.add(() => el.removeEventListener(ev, fn, opts)); }
  run() { const f = this.fns; this.fns = []; f.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Tap handler that fires on pointerdown for snappy mobile input. */
export function onTap(el, fn) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button > 0) return;
    e.preventDefault();
    fn(e);
  });
}

export function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}
