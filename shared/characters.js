// The Party Panic cast. Twelve characters, each in two colourways, so up to
// 24 players can each have a unique look. Rendered as SVG strings so they are
// identical on every screen and cheap to send.

const INK = '#1b1530';
const S = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
const SKIN = ['#ffdcbf', '#f3c094', '#dba070', '#b07445', '#7a4a2b', '#553220'];

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 - amt))));
  return '#' + ((1 << 24) | (f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1);
}

// Draw overlapping circles as one "cloud" shape with a single outline.
function cloud(circles, fill) {
  const outline = circles.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${S}/>`).join('');
  const fillOnly = circles.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r - 1.2}" fill="${fill}"/>`).join('');
  return outline + fillOnly;
}

function star(cx, cy, r, fill, extra = '') {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.45 : r;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rad).toFixed(1)} ${(cy + Math.sin(a) * rad).toFixed(1)} `;
  }
  return `<path d="${d}Z" fill="${fill}" ${S} ${extra}/>`;
}

function heart(cx, cy, s, fill) {
  return `<path d="M${cx} ${cy + 5 * s} C${cx - 8 * s} ${cy - 1 * s} ${cx - 6 * s} ${cy - 7 * s} ${cx} ${cy - 3.5 * s} C${cx + 6 * s} ${cy - 7 * s} ${cx + 8 * s} ${cy - 1 * s} ${cx} ${cy + 5 * s} Z" fill="${fill}" ${S}/>`;
}

// ------------------------------------------------------------- face kit

function eyes(style, mood) {
  const line = `stroke="${INK}" stroke-width="2.4" stroke-linecap="round" fill="none"`;
  const round = (x, r = 4.4) =>
    `<ellipse cx="${x}" cy="48" rx="${r}" ry="${r + 0.6}" fill="#fff" stroke="${INK}" stroke-width="1.8"/>` +
    `<circle cx="${x + 0.5}" cy="48.6" r="2.3" fill="${INK}"/><circle cx="${x + 1.3}" cy="47.4" r=".8" fill="#fff"/>`;
  if (mood === 'happy') return `<path d="M38 49.5 Q42 44 46 49.5" ${line}/><path d="M54 49.5 Q58 44 62 49.5" ${line}/>`;
  if (mood === 'shock') {
    return [42, 58].map((x) => `<ellipse cx="${x}" cy="47.5" rx="5.2" ry="6.2" fill="#fff" stroke="${INK}" stroke-width="1.8"/><circle cx="${x}" cy="48" r="1.7" fill="${INK}"/>`).join('');
  }
  if (mood === 'sad') {
    return round(42) + round(58) + `<path d="M37 41 L46 43.5" ${line}/><path d="M63 41 L54 43.5" ${line}/>`;
  }
  switch (style) {
    case 'dots':
      return `<circle cx="42" cy="48.5" r="2.8" fill="${INK}"/><circle cx="58" cy="48.5" r="2.8" fill="${INK}"/>`;
    case 'cool':
      return `<path d="M37.5 48 H46.5" ${line}/><path d="M53.5 48 H62.5" ${line}/><circle cx="43" cy="50" r="2" fill="${INK}"/><circle cx="59" cy="50" r="2" fill="${INK}"/>`;
    case 'wink':
      return round(42) + `<path d="M54 49.5 Q58 44 62 49.5" ${line}/>`;
    default:
      return round(42) + round(58);
  }
}

function mouth(style, mood) {
  const line = `stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
  const m = mood === 'happy' ? 'grin' : mood === 'sad' ? 'frown' : mood === 'shock' ? 'o' : style;
  switch (m) {
    case 'grin':
      return `<path d="M42 58 Q50 71 58 58 Z" fill="#7a1f3d" ${line}/><path d="M44.5 59.2 H55.5 L54.6 61.2 H45.4 Z" fill="#fff"/>`;
    case 'frown':
      return `<path d="M44 64 Q50 57.5 56 64" fill="none" ${line}/>`;
    case 'o':
      return `<ellipse cx="50" cy="61.5" rx="3.6" ry="4.4" fill="#7a1f3d" ${line}/>`;
    case 'smirk':
      return `<path d="M44.5 61 Q52 63.5 57 57.8" fill="none" ${line}/>`;
    case 'tongue':
      return `<path d="M48 61.2 Q50.5 68 53.5 61.2 Z" fill="#ff6b8b" ${line} stroke-width="1.6"/><path d="M43.5 59 Q50 65 56.5 59" fill="none" ${line}/>`;
    default:
      return `<path d="M43.5 58.5 Q50 65.5 56.5 58.5" fill="none" ${line}/>`;
  }
}

// ------------------------------------------------------------- the cast

const CAST = [
  {
    id: 'dee', name: 'Disco Dee', skin: SKIN[4], hair: '#2a1a12', mouth: 'grin', hideEyes: true,
    palettes: [
      { main: '#ff5a3c', accent: '#ffc23d', bg: '#ffe2a8' },
      { main: '#9b6bff', accent: '#3fe0d0', bg: '#e2d6ff' },
    ],
    back: (c, k) => cloud([[50, 28, 20], [31, 35, 14], [69, 35, 14], [36, 20, 12], [64, 20, 12], [27, 50, 9], [73, 50, 9]], k.hair),
    face: (c) => star(41.5, 48, 8.5, c.accent) + star(58.5, 48, 8.5, c.accent) + `<path d="M48 47 H52" stroke="${INK}" stroke-width="2.2"/>`,
  },
  {
    id: 'kip', name: 'Captain Kip', skin: SKIN[1], hair: '#6b4226', mouth: 'smile',
    palettes: [
      { main: '#2f4bd6', accent: '#ffc23d', bg: '#cfe3ff' },
      { main: '#1f9e7d', accent: '#fff6e6', bg: '#cff5e8' },
    ],
    face: (c, k) =>
      `<path d="M39 57.5 C42 52.5 47.5 53.5 50 56 C52.5 53.5 58 52.5 61 57.5 C57 59 53 58.5 50 57.5 C47 58.5 43 59 39 57.5 Z" fill="${k.hair}" ${S}/>`,
    front: (c) =>
      `<path d="M27 37 C27 17 73 17 73 37 Z" fill="${c.main}" ${S}/>` +
      `<path d="M27.5 31 H72.5 V37 H27.5 Z" fill="${shade(c.main, 0.3)}" ${S}/>` +
      `<path d="M23 37.5 Q50 44 77 37.5 L77 40.5 Q50 48.5 23 40.5 Z" fill="${INK}"/>` +
      `<path d="M41 25 L50 21 L59 25 L50 28.5 Z" fill="${c.accent}" ${S} stroke-width="1.6"/>`,
  },
  {
    id: 'rosa', name: 'Rosa Rocket', skin: SKIN[0], hair: '#e8562a', mouth: 'smile', freckles: true,
    palettes: [
      { main: '#f4f2fb', accent: '#ff5a3c', bg: '#ffd1c2' },
      { main: '#f4f2fb', accent: '#3fa7ff', bg: '#cde8ff' },
    ],
    back: (c, k) => `<circle cx="27" cy="27" r="8.5" fill="${k.hair}" ${S}/><circle cx="73" cy="27" r="8.5" fill="${k.hair}" ${S}/>`,
    front: (c, k) =>
      `<path d="M30 43 C29 26 40 22 50 22 C60 22 71 26 70 43 C64 33 57 31 50 33 C43 31 36 33 30 43 Z" fill="${k.hair}" ${S}/>`,
    over: (c) =>
      `<circle cx="50" cy="46" r="33" fill="rgba(190,230,255,.16)" stroke="${INK}" stroke-width="2.6"/>` +
      `<path d="M28 33 A25 25 0 0 1 45 20" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".85"/>` +
      `<ellipse cx="50" cy="79" rx="27" ry="6" fill="${c.accent}" ${S}/>`,
  },
  {
    id: 'gus', name: 'Chef Gus', skin: SKIN[2], hair: '#3a2a1e', mouth: 'smile',
    palettes: [
      { main: '#fff6e6', accent: '#ff5a3c', bg: '#ffd7c9' },
      { main: '#fff6e6', accent: '#1f9e7d', bg: '#d3f5e6' },
    ],
    bodyExtra: (c) => `<path d="M41 77 H59 L50 89 Z" fill="${c.accent}" ${S}/>`,
    face: (c, k) =>
      `<path d="M38 56 C41 52 47 53 50 55.5 C53 53 59 52 62 56 C63.5 58.5 60 59.5 58 57.5 C55 56 52.5 57 50 57.6 C47.5 57 45 56 42 57.5 C40 59.5 36.5 58.5 38 56 Z" fill="${k.hair}" ${S} stroke-width="1.6"/>`,
    front: () =>
      cloud([[37, 21, 9.5], [50, 14, 11], [63, 21, 9.5]], '#ffffff') +
      `<rect x="32" y="22" width="36" height="13" rx="3" fill="#ffffff" ${S}/>`,
  },
  {
    id: 'lulu', name: 'Lulu', skin: SKIN[3], hair: '#2a1a12', mouth: 'tongue',
    palettes: [
      { main: '#ff6fae', accent: '#fff6e6', bg: '#ffd3e6' },
      { main: '#ffc23d', accent: '#ff6fae', bg: '#fff0c2' },
    ],
    back: (c, k) =>
      `<path d="M31 44 C24 58 27 72 22 86" fill="none" stroke="${INK}" stroke-width="12.5" stroke-linecap="round"/>` +
      `<path d="M31 44 C24 58 27 72 22 86" fill="none" stroke="${k.hair}" stroke-width="8" stroke-linecap="round"/>` +
      `<path d="M69 44 C76 58 73 72 78 86" fill="none" stroke="${INK}" stroke-width="12.5" stroke-linecap="round"/>` +
      `<path d="M69 44 C76 58 73 72 78 86" fill="none" stroke="${k.hair}" stroke-width="8" stroke-linecap="round"/>` +
      `<ellipse cx="39" cy="10" rx="6.5" ry="15" fill="${c.accent}" ${S} transform="rotate(-14 39 10)"/>` +
      `<ellipse cx="39" cy="11" rx="3" ry="10" fill="${c.main}" transform="rotate(-14 39 11)"/>` +
      `<ellipse cx="61" cy="10" rx="6.5" ry="15" fill="${c.accent}" ${S} transform="rotate(14 61 10)"/>` +
      `<ellipse cx="61" cy="11" rx="3" ry="10" fill="${c.main}" transform="rotate(14 61 11)"/>`,
    front: (c, k) =>
      `<path d="M30 46 C28 26 40 21 50 21 C60 21 72 26 70 46 C66 36 58 30 50 29 C42 30 34 36 30 46 Z" fill="${k.hair}" ${S}/>` +
      `<path d="M30 33 C36 22 64 22 70 33" fill="none" stroke="${c.accent}" stroke-width="4" stroke-linecap="round"/>`,
  },
  {
    id: 'tex', name: 'Big Tex', skin: SKIN[1], hair: '#8a5a2b', mouth: 'grin', mouthOver: true,
    palettes: [
      { main: '#3f7fd9', accent: '#ffc23d', hat: '#a0632e', bg: '#ffe2b8' },
      { main: '#d6453a', accent: '#fff6e6', hat: '#3a2a1e', bg: '#f6d3c8' },
    ],
    face: (c, k) =>
      `<path d="M29.5 50 C30.5 63 38 73 50 73 C62 73 69.5 63 70.5 50 C66 56 61 58 57 57.5 C54 61.5 46 61.5 43 57.5 C39 58 34 56 29.5 50 Z" fill="${k.hair}" ${S}/>`,
    front: (c) =>
      `<path d="M32 35 C32 14 40 11 50 17 C60 11 68 14 68 35 Z" fill="${c.hat}" ${S}/>` +
      `<path d="M32.5 29.5 C44 32 56 32 67.5 29.5 L67.8 34.5 C56 37 44 37 32.2 34.5 Z" fill="${c.accent}" ${S} stroke-width="1.6"/>` +
      `<path d="M12 36 C22 46 78 46 88 36 C82 31 70 34 50 34 C30 34 18 31 12 36 Z" fill="${c.hat}" ${S}/>`,
  },
  {
    id: 'nova', name: 'Nova', skin: SKIN[0], mouth: 'smirk', eyes: 'cool',
    palettes: [
      { main: '#2f2650', accent: '#ff6fae', hair: '#ff6fae', bg: '#ffc9e0' },
      { main: '#2f2650', accent: '#3fe0d0', hair: '#3fe0d0', bg: '#c8f6ef' },
    ],
    bodyExtra: (c) => `<path d="M30 82 L40 96 M70 82 L60 96" stroke="${c.accent}" stroke-width="3" stroke-linecap="round"/>`,
    face: () => `<circle cx="70.5" cy="57" r="3.2" fill="none" stroke="#ffc23d" stroke-width="2.2"/>`,
    front: (c, k) =>
      `<path d="M30.5 41 C31 31 38 26.5 44 26 L44 30.5 C38 31.5 33.5 35.5 31.5 41.5 Z" fill="${shade(k.skin, 0.2)}"/>` +
      `<path d="M69.5 41 C69 31 62 26.5 56 26 L56 30.5 C62 31.5 66.5 35.5 68.5 41.5 Z" fill="${shade(k.skin, 0.2)}"/>` +
      `<path d="M43 31 L37 5 L46 15 L50 0 L54 15 L63 5 L57 31 Z" fill="${c.hair}" ${S}/>`,
  },
  {
    id: 'pim', name: 'Prof. Pim', skin: SKIN[2], hair: '#d9d4c8', mouth: 'smile',
    palettes: [
      { main: '#7a52e0', accent: '#ffc23d', bg: '#e2d6ff' },
      { main: '#1f9e7d', accent: '#ff5a3c', bg: '#cff5e8' },
    ],
    bodyExtra: (c) =>
      `<path d="M41 77.5 L50 82 L41 87 Z M59 77.5 L50 82 L59 87 Z" fill="${c.accent}" ${S}/><circle cx="50" cy="82" r="2.6" fill="${shade(c.accent, 0.2)}" ${S} stroke-width="1.6"/>`,
    face: () =>
      `<circle cx="42" cy="48" r="7.2" fill="rgba(255,255,255,.3)" stroke="${INK}" stroke-width="2.4"/>` +
      `<circle cx="58" cy="48" r="7.2" fill="rgba(255,255,255,.3)" stroke="${INK}" stroke-width="2.4"/>` +
      `<path d="M49 47 Q50 45.5 51 47 M34.8 46.5 L30 45 M65.2 46.5 L70 45" fill="none" stroke="${INK}" stroke-width="2.2"/>`,
    front: (c, k) =>
      `<path d="M29.5 47 C25.5 40 27.5 34 33 35 C30.5 39 31 43 31.5 47 Z" fill="${k.hair}" ${S}/>` +
      `<path d="M70.5 47 C74.5 40 72.5 34 67 35 C69.5 39 69 43 68.5 47 Z" fill="${k.hair}" ${S}/>` +
      `<path d="M47 25.5 C44 19 48 16.5 50 21 C51 15 56 16.5 53 25.5" fill="${k.hair}" ${S}/>`,
  },
  {
    id: 'ziggy', name: 'Ziggy', skin: SKIN[1], hair: '#f4f1ea', mouth: 'smile',
    palettes: [
      { main: '#3a2f8f', accent: '#ffc23d', bg: '#d4d0ff' },
      { main: '#b8325a', accent: '#3fe0d0', bg: '#ffd0dc' },
    ],
    face: (c, k) =>
      `<path d="M29.5 52 C29.5 72 40 88 50 92 C60 88 70.5 72 70.5 52 C64 58.5 58 60 50 60 C42 60 36 58.5 29.5 52 Z" fill="${k.hair}" ${S}/>` +
      `<path d="M39 57.5 C44 52.5 56 52.5 61 57.5 C55 60 45 60 39 57.5 Z" fill="${k.hair}" ${S}/>` +
      `<path d="M36 41.5 C39 38.5 44 38.5 47 41 M53 41 C56 38.5 61 38.5 64 41.5" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
    front: (c) =>
      `<path d="M31 35 C40 22 46 9 64 1 C59 12 63 22 69 35 Z" fill="${c.main}" ${S}/>` +
      star(52, 22, 5, c.accent, 'stroke-width="1.4"') +
      `<path d="M21 34.5 C35 29 65 29 79 34.5 L75 39.5 C62 35 38 35 25 39.5 Z" fill="${shade(c.main, 0.25)}" ${S}/>`,
  },
  {
    id: 'jojo', name: 'Jojo', skin: SKIN[3], hair: '#2a1a12', mouth: 'grin', eyes: 'dots',
    palettes: [
      { main: '#1f9e7d', accent: '#ff5a3c', hat: '#ffc23d', bg: '#cff5e8' },
      { main: '#d6453a', accent: '#3fa7ff', hat: '#f4f2fb', bg: '#ffd7cf' },
    ],
    front: (c) =>
      `<path d="M28.5 40 C28.5 20 40 15 50 15 C60 15 71.5 20 71.5 40 Z" fill="${c.hat}" ${S}/>` +
      `<rect x="27" y="34" width="46" height="8" rx="4" fill="${shade(c.hat, 0.15)}" ${S}/>` +
      `<circle cx="50" cy="12.5" r="5" fill="${c.accent}" ${S}/>` +
      `<path d="M25.5 50 C23.5 17 76.5 17 74.5 50" fill="none" stroke="${INK}" stroke-width="6.5" stroke-linecap="round"/>` +
      `<path d="M25.5 50 C23.5 17 76.5 17 74.5 50" fill="none" stroke="${c.accent}" stroke-width="3" stroke-linecap="round"/>` +
      `<rect x="20.5" y="42" width="10" height="16" rx="4" fill="${c.accent}" ${S}/><rect x="69.5" y="42" width="10" height="16" rx="4" fill="${c.accent}" ${S}/>`,
  },
  {
    id: 'bea', name: 'Bea', skin: SKIN[4], hair: '#251a33', mouth: 'smile', hideEyes: true,
    palettes: [
      { main: '#ffc23d', accent: '#ff5a3c', bg: '#fff0c2' },
      { main: '#3fa7ff', accent: '#ff6fae', bg: '#d3ecff' },
    ],
    back: (c, k) =>
      `<path d="M24.5 50 C21.5 23 36 17 50 17 C64 17 78.5 23 75.5 50 C75.5 61 72 68 67.5 68 L32.5 68 C28 68 24.5 61 24.5 50 Z" fill="${k.hair}" ${S}/>`,
    face: (c) =>
      heart(42, 48, 1.15, c.accent) + heart(58, 48, 1.15, c.accent) +
      `<path d="M48 46.5 H52" stroke="${INK}" stroke-width="2.2"/>` +
      `<circle cx="30" cy="59" r="3.6" fill="${c.main}" ${S} stroke-width="1.6"/><circle cx="70" cy="59" r="3.6" fill="${c.main}" ${S} stroke-width="1.6"/>`,
    front: (c, k) =>
      `<path d="M29 42 C29 25 38 20 50 20 C62 20 71 25 71 42 L68 39.5 C60 37.5 40 37.5 32 39.5 Z" fill="${k.hair}" ${S}/>`,
  },
  {
    id: 'ben', name: 'Bandit Ben', skin: SKIN[1], hair: '#b5651d', mouth: 'smirk', eyesOver: true,
    palettes: [
      { main: '#4a4a6a', accent: '#ffc23d', bg: '#e4e2f2' },
      { main: '#1f9e7d', accent: '#ff6fae', bg: '#cff5e8' },
    ],
    face: () => `<path d="M27.5 44 C40 39.5 60 39.5 72.5 44 L72.5 53 C60 49.5 40 49.5 27.5 53 Z" fill="${INK}"/>`,
    front: (c, k) =>
      `<path d="M29 38 C29 21 39 16 50 16 C61 16 71 21 71 38 Z" fill="${c.accent}" ${S}/>` +
      `<path d="M30.5 35.5 C24 34 15.5 36 12 39.5 C17.5 42 26 41.2 31 40 Z" fill="${shade(c.accent, 0.25)}" ${S}/>` +
      `<path d="M58 37 C60 31.5 64.5 31 66.5 35" fill="${k.hair}" ${S} stroke-width="1.6"/>`,
  },
];

export const CHARACTERS = CAST.map(({ id, name }) => ({ id, name }));

/** Every pickable look: `${characterId}-${colourway}`. */
export const SLOTS = CAST.flatMap((c) => c.palettes.map((p, v) => ({ slot: `${c.id}-${v}`, id: c.id, v, name: c.name, bg: p.bg, main: p.main })));
const SLOT_MAP = new Map(SLOTS.map((s) => [s.slot, s]));
const CAST_MAP = new Map(CAST.map((c) => [c.id, c]));

export const isSlot = (slot) => SLOT_MAP.has(slot);
export const slotInfo = (slot) => SLOT_MAP.get(slot) || SLOTS[0];

/**
 * @param {string} slot  e.g. "dee-0"
 * @param {{mood?: 'idle'|'happy'|'sad'|'shock', bg?: boolean, crown?: boolean}} opts
 */
export function renderCharacter(slot, opts = {}) {
  const info = slotInfo(slot);
  const ch = CAST_MAP.get(info.id);
  const pal = ch.palettes[info.v];
  const c = { ...pal, hair: pal.hair || ch.hair };
  const k = { skin: ch.skin, hair: c.hair };
  const mood = opts.mood || 'idle';
  const skin = ch.skin;
  const skinDark = shade(skin, 0.14);

  const body =
    `<path d="M12 106 C14 85 30 77 50 77 C70 77 86 85 88 106 Z" fill="${c.main}" ${S}/>` +
    `<path d="M42 77.5 L50 86 L58 77.5" fill="none" stroke="${shade(c.main, 0.3)}" stroke-width="2.4" stroke-linejoin="round"/>`;
  const neck = `<path d="M44 62 L44 77 Q50 81 56 77 L56 62 Z" fill="${skinDark}" ${S}/>`;
  const ears = `<ellipse cx="30" cy="49" rx="4.2" ry="5.6" fill="${skin}" ${S}/><ellipse cx="70" cy="49" rx="4.2" ry="5.6" fill="${skin}" ${S}/>`;
  const head = `<ellipse cx="50" cy="47" rx="20.5" ry="22.5" fill="${skin}" ${S}/>`;
  const cheeks = `<circle cx="37" cy="56" r="3.6" fill="#ff7aa8" opacity=".4"/><circle cx="63" cy="56" r="3.6" fill="#ff7aa8" opacity=".4"/>`;
  const freckles = ch.freckles
    ? [[35, 53], [38, 55], [36, 57], [65, 53], [62, 55], [64, 57]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9" fill="#c4683e"/>`).join('')
    : '';
  const nose = `<path d="M50.5 50.5 Q47.6 54.6 50.8 55.2" fill="none" stroke="${skinDark}" stroke-width="2" stroke-linecap="round"/>`;
  const eyeSvg = ch.hideEyes ? '' : eyes(ch.eyes, mood);
  const mouthSvg = mouth(ch.mouth, mood);

  const parts = [
    ch.back?.(c, k) || '',
    body,
    ch.bodyExtra?.(c, k) || '',
    neck,
    ears,
    head,
    cheeks,
    freckles,
    ch.eyesOver ? '' : eyeSvg,
    nose,
    ch.mouthOver ? '' : mouthSvg,
    ch.face?.(c, k) || '',
    ch.eyesOver ? eyeSvg : '',
    ch.mouthOver ? mouthSvg : '',
    ch.front?.(c, k) || '',
    ch.over?.(c, k) || '',
  ].join('');
  const crown = opts.crown
    ? `<g transform="translate(0 -8)"><path d="M33 22 L35.5 6 L43.5 15 L50 3 L56.5 15 L64.5 6 L67 22 Z" fill="#ffc23d" ${S}/><circle cx="50" cy="16" r="2.3" fill="#ff5a3c"/></g>`
    : '';

  const showBg = opts.bg !== false;
  const content = (showBg ? `<g clip-path="url(#ppc)"><circle cx="50" cy="50" r="50" fill="${pal.bg}"/>${parts}</g>` : parts) + crown;
  return (
    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="char-svg">` +
    `<defs><clipPath id="ppc"><circle cx="50" cy="50" r="50"/></clipPath></defs>${content}</svg>`
  );
}
