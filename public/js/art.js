// Illustrated game art (SVG). Used as DOM elements and as canvas images.

const INK = '#1b1530';
const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

function starPath(cx, cy, r, inner = 0.45, n = 5) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? r * inner : r;
    const a = (i * Math.PI) / n - Math.PI / 2;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rad).toFixed(1)} ${(cy + Math.sin(a) * rad).toFixed(1)} `;
  }
  return `${d}Z`;
}

const ART = {
  coin:
    `<circle cx="32" cy="32" r="24" fill="#ffc23d" ${S}/>` +
    `<circle cx="32" cy="32" r="17" fill="#ffd970" stroke="#e09a12" stroke-width="2.5"/>` +
    `<path d="${starPath(32, 33, 9)}" fill="#e09a12"/>` +
    `<path d="M17 24 A17 17 0 0 1 26 15.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`,
  star:
    `<path d="${starPath(32, 34, 27, 0.48)}" fill="#ffc23d" ${S}/>` +
    `<path d="${starPath(32, 34, 17, 0.48)}" fill="#ffd970"/>` +
    `<circle cx="27" cy="33" r="2.4" fill="${INK}"/><circle cx="37" cy="33" r="2.4" fill="${INK}"/>` +
    `<path d="M28 39 Q32 43 36 39" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,
  gem:
    `<path d="M14 24 L22 12 H42 L50 24 L32 54 Z" fill="#3fe0d0" ${S}/>` +
    `<path d="M14 24 H50 M22 12 L27 24 L32 54 L37 24 L42 12 M27 24 L32 12 L37 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M22 12 L27 24 H14 Z" fill="#9ff3ea"/><path d="M32 12 L37 24 H27 Z" fill="#c9fbf6"/>`,
  bomb:
    `<circle cx="29" cy="37" r="20" fill="#4a3f7a" ${S}/>` +
    `<rect x="35" y="12" width="12" height="9" rx="2" fill="#5b5480" ${S} transform="rotate(35 41 16)"/>` +
    `<path d="M45 12 C48 6 53 6 55 9" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="${starPath(56, 8, 7, 0.4, 6)}" fill="#ffc23d" stroke="#ff5a3c" stroke-width="2"/>` +
    `<path d="M18 30 A12 12 0 0 1 27 22" fill="none" stroke="#8f88b8" stroke-width="4" stroke-linecap="round"/>`,
  chest:
    `<path d="M8 28 C8 12 56 12 56 28 Z" fill="#9b6bff" ${S}/>` +
    `<rect x="8" y="28" width="48" height="26" rx="4" fill="#7a52e0" ${S}/>` +
    `<path d="M8 36 H56" stroke="${INK}" stroke-width="3"/>` +
    `<path d="M20 15 V54 M44 15 V54" stroke="#ffc23d" stroke-width="4"/>` +
    `<rect x="27" y="30" width="10" height="12" rx="2.5" fill="#ffc23d" ${S}/><circle cx="32" cy="35.5" r="1.8" fill="${INK}"/>`,
  chestGold:
    `<path d="M10 20 L14 6 H50 L54 20 Z" fill="#9b6bff" ${S}/>` +
    `<circle cx="22" cy="27" r="7" fill="#ffc23d" ${S}/><circle cx="34" cy="24" r="7" fill="#ffc23d" ${S}/><circle cx="44" cy="28" r="7" fill="#ffc23d" ${S}/>` +
    `<rect x="8" y="28" width="48" height="26" rx="4" fill="#7a52e0" ${S}/>` +
    `<path d="M20 28 V54 M44 28 V54" stroke="#ffc23d" stroke-width="4"/>` +
    `<path d="M26 12 L28 16 L32 17 L28 18.5 L26 22 L24 18.5 L20 17 L24 16 Z" fill="#fff"/>`,
  chestEmpty:
    `<path d="M10 20 L14 6 H50 L54 20 Z" fill="#b9a3f0" ${S}/>` +
    `<rect x="8" y="28" width="48" height="26" rx="4" fill="#a48be6" ${S}/>` +
    `<path d="M14 28 H50" stroke="${INK}" stroke-width="2" opacity=".4"/>`,
  boom:
    `<path d="${starPath(32, 32, 30, 0.55, 10)}" fill="#ff5a3c" ${S}/>` +
    `<path d="${starPath(32, 32, 19, 0.55, 8)}" fill="#ffc23d"/>` +
    `<circle cx="32" cy="32" r="7" fill="#fff6e6"/>`,
  // reactions
  lol:
    `<circle cx="32" cy="32" r="26" fill="#ffc23d" ${S}/>` +
    `<path d="M18 26 L25 29 L18 32 M46 26 L39 29 L46 32" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M19 37 Q32 56 45 37 Z" fill="#7a1f3d" ${S}/>` +
    `<path d="M10 30 C6 36 8 42 12 41 C15 40 14 35 10 30 Z M54 30 C58 36 56 42 52 41 C49 40 50 35 54 30 Z" fill="#3fa7ff" stroke="${INK}" stroke-width="2"/>`,
  wow:
    `<circle cx="32" cy="32" r="26" fill="#ffc23d" ${S}/>` +
    `<ellipse cx="23" cy="26" rx="4.5" ry="6" fill="#fff" stroke="${INK}" stroke-width="2.4"/><circle cx="23" cy="27" r="2.4" fill="${INK}"/>` +
    `<ellipse cx="41" cy="26" rx="4.5" ry="6" fill="#fff" stroke="${INK}" stroke-width="2.4"/><circle cx="41" cy="27" r="2.4" fill="${INK}"/>` +
    `<ellipse cx="32" cy="43" rx="6" ry="7.5" fill="#7a1f3d" ${S}/>`,
  fire:
    `<path d="M32 58 C18 58 12 48 12 40 C12 28 22 24 22 10 C30 15 34 21 34 27 C37 24 39 20 39 15 C48 23 52 31 52 40 C52 50 45 58 32 58 Z" fill="#ff5a3c" ${S}/>` +
    `<path d="M32 56 C25 56 21 51 21 45 C21 38 27 35 28 28 C33 33 34 37 34 40 C36 38 38 36 38 33 C42 38 43 42 43 45 C43 52 38 56 32 56 Z" fill="#ffc23d"/>`,
  love:
    `<path d="M32 56 C14 44 6 34 10 22 C14 12 26 12 32 22 C38 12 50 12 54 22 C58 34 50 44 32 56 Z" fill="#ff5a3c" ${S}/>` +
    `<path d="M17 22 C18 18 21 17 24 17" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".85"/>`,
  gg:
    `<rect x="5" y="14" width="54" height="36" rx="10" fill="#27c49a" ${S}/>` +
    `<path d="M27 25 H19 V39 H27 V33 H23 M45 25 H37 V39 H45 V33 H41" fill="none" stroke="#fff6e6" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  tomato:
    `<circle cx="32" cy="36" r="22" fill="#ff5a3c" ${S}/>` +
    `<path d="M32 16 L27 9 M32 16 L22 18 L28 21 L32 17 L36 21 L42 18 Z" fill="#27c49a" ${S} stroke-width="2.4"/>` +
    `<path d="M18 30 A14 14 0 0 1 26 20" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".7"/>`,
  splat:
    `<path d="M32 6 C36 16 42 8 46 14 C48 20 58 16 56 24 C54 30 62 34 56 40 C50 44 58 54 48 54 C42 54 40 62 34 56 C28 50 22 60 18 52 C14 46 4 48 8 40 C10 34 2 28 10 24 C16 22 10 12 18 12 C24 12 26 4 32 6 Z" fill="#ff5a3c" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<circle cx="27" cy="27" r="4" fill="#ff9a85"/><circle cx="58" cy="10" r="3" fill="#ff5a3c" stroke="${INK}" stroke-width="2"/><circle cx="6" cy="58" r="3.5" fill="#ff5a3c" stroke="${INK}" stroke-width="2"/>`,
};

export const REACTIONS = ['lol', 'wow', 'fire', 'love', 'gg', 'tomato'];

export function artSvg(name) {
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${ART[name] || ''}</svg>`;
}

export function art(name, cls = '') {
  const el = document.createElement('span');
  el.className = `art ${cls}`;
  el.innerHTML = artSvg(name);
  return el;
}

const cache = new Map();
/** Image for drawing on canvas. */
export function artImage(name) {
  if (!cache.has(name)) {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(artSvg(name))}`;
    cache.set(name, img);
  }
  return cache.get(name);
}
