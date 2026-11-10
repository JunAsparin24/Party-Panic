// Helpers shared by minigame clients.
import { h } from '../ui.js';

export const tri = (phase) => {
  const p = ((phase % 1) + 1) % 1;
  return p < 0.5 ? p * 2 : 2 - p * 2;
};

/** A canvas that fills its parent and handles high-DPI screens. */
export function fitCanvas(parent, bag, onResize) {
  const canvas = h('canvas', { class: 'g-canvas' });
  parent.append(canvas);
  const ctx = canvas.getContext('2d');
  const size = { w: 0, h: 0, dpr: 1 };
  const resize = () => {
    const r = parent.getBoundingClientRect();
    size.dpr = Math.min(2, window.devicePixelRatio || 1);
    size.w = Math.max(50, r.width);
    size.h = Math.max(50, r.height);
    canvas.width = Math.round(size.w * size.dpr);
    canvas.height = Math.round(size.h * size.dpr);
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    onResize?.(size);
  };
  resize();
  bag.listen(window, 'resize', resize);
  return { canvas, ctx, size, resize };
}

export function roundRect(ctx, x, y, w, hgt, r) {
  const rr = Math.min(r, w / 2, hgt / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + hgt, rr);
  ctx.arcTo(x + w, y + hgt, x, y + hgt, rr);
  ctx.arcTo(x, y + hgt, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

/** A mini phone mock-up used for the tutorial demo on the host screen. */
export function demoPhone(...kids) {
  return h('div', { class: 'demo-phone' }, h('div', { class: 'demo-screen' }, ...kids));
}

