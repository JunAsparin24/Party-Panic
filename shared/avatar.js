// Cartoon avatar system. Avatars are stored as small objects of option
// indexes and rendered to SVG strings, so they are cheap to send over the
// network and look identical on every screen.

export const AVATAR_OPTIONS = {
  skin: ['#ffe0c2', '#f6c99b', '#e3a872', '#c68642', '#8d5524', '#5c3a21'],
  hair: ['short', 'spiky', 'long', 'bob', 'curly', 'bun', 'mohawk', 'ponytail', 'bald'],
  hairColor: ['#2b1b10', '#6b4226', '#b5651d', '#f2c94c', '#e8562a', '#1c1c1c', '#ff4f9a', '#2de2e6', '#8e5cff', '#eeeeee'],
  eyes: ['round', 'happy', 'sleepy', 'wink', 'sparkle', 'dots'],
  mouth: ['smile', 'grin', 'open', 'smirk', 'tongue', 'cat'],
  outfit: ['#ff4f9a', '#ffd23f', '#2de2e6', '#3ddc84', '#ff8c42', '#8e5cff', '#ff5964', '#4d7cff', '#ffffff', '#2b2b44'],
  acc: ['none', 'glasses', 'shades', 'cap', 'headphones', 'bow', 'beanie', 'flower'],
  bg: ['#ffd23f', '#ff9ec7', '#9be7ff', '#b8f5c9', '#ffc29b', '#d3c2ff', '#ffffff', '#ffb3b3'],
};

export const AVATAR_LABELS = {
  skin: 'Skin',
  hair: 'Hair',
  hairColor: 'Hair colour',
  eyes: 'Eyes',
  mouth: 'Mouth',
  outfit: 'Outfit',
  acc: 'Extra',
  bg: 'Backdrop',
};

export const AVATAR_KEYS = Object.keys(AVATAR_OPTIONS);

export function randomAvatar(rng = Math.random) {
  const a = {};
  for (const k of AVATAR_KEYS) a[k] = Math.floor(rng() * AVATAR_OPTIONS[k].length);
  // Accessories are fun but should not be on everyone.
  if (rng() < 0.45) a.acc = 0;
  return a;
}

export function sanitizeAvatar(input) {
  const out = randomAvatar();
  if (!input || typeof input !== 'object') return out;
  for (const k of AVATAR_KEYS) {
    const v = input[k];
    if (Number.isInteger(v) && v >= 0 && v < AVATAR_OPTIONS[k].length) out[k] = v;
  }
  return out;
}

const INK = '#1d1140';

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 - amt))));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function eyesSvg(style) {
  const s = `stroke="${INK}" stroke-width="2.2" stroke-linecap="round" fill="none"`;
  const roundEye = (x) =>
    `<ellipse cx="${x}" cy="48" rx="4.2" ry="4.8" fill="#fff" stroke="${INK}" stroke-width="1.6"/>` +
    `<circle cx="${x + 0.6}" cy="48.8" r="2.3" fill="${INK}"/><circle cx="${x + 1.4}" cy="47.6" r="0.8" fill="#fff"/>`;
  const happyEye = (x) => `<path d="M${x - 4} 49.5 Q${x} 44 ${x + 4} 49.5" ${s}/>`;
  switch (style) {
    case 'happy':
      return happyEye(42) + happyEye(58);
    case 'sleepy':
      return (
        `<path d="M38 48 Q42 51.5 46 48" ${s}/><path d="M54 48 Q58 51.5 62 48" ${s}/>` +
        `<path d="M38.5 46.5 L45.5 46.5" ${s} stroke-width="1.4"/><path d="M54.5 46.5 L61.5 46.5" ${s} stroke-width="1.4"/>`
      );
    case 'wink':
      return roundEye(42) + happyEye(58);
    case 'sparkle':
      return [42, 58]
        .map(
          (x) =>
            `<ellipse cx="${x}" cy="48" rx="4.4" ry="5.6" fill="${INK}"/>` +
            `<circle cx="${x + 1.5}" cy="46" r="1.6" fill="#fff"/><circle cx="${x - 1.4}" cy="50.5" r="0.9" fill="#fff"/>`
        )
        .join('');
    case 'dots':
      return `<circle cx="42" cy="48.5" r="2.7" fill="${INK}"/><circle cx="58" cy="48.5" r="2.7" fill="${INK}"/>`;
    case 'shock':
      return [42, 58]
        .map(
          (x) =>
            `<ellipse cx="${x}" cy="47.5" rx="5" ry="6" fill="#fff" stroke="${INK}" stroke-width="1.6"/>` +
            `<circle cx="${x}" cy="48" r="1.8" fill="${INK}"/>`
        )
        .join('');
    case 'round':
    default:
      return roundEye(42) + roundEye(58);
  }
}

function mouthSvg(style) {
  const s = `stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;
  switch (style) {
    case 'grin':
      return (
        `<path d="M42 58 Q50 71 58 58 Z" fill="#7a1f3d" ${s}/>` +
        `<path d="M44.5 59.2 L55.5 59.2 L54.6 61.3 L45.4 61.3 Z" fill="#fff"/>` +
        `<path d="M46.5 65.2 Q50 62.6 53.5 65.2 Q50 67.3 46.5 65.2 Z" fill="#ff6b8b"/>`
      );
    case 'open':
      return `<ellipse cx="50" cy="61" rx="4" ry="4.8" fill="#7a1f3d" ${s}/><ellipse cx="50" cy="63.3" rx="2.4" ry="1.5" fill="#ff6b8b"/>`;
    case 'smirk':
      return `<path d="M44.5 61 Q52 63.5 57 57.8" fill="none" ${s}/>`;
    case 'tongue':
      return `<path d="M48 61.2 Q50.5 68 53.5 61.2 Z" fill="#ff6b8b" ${s} stroke-width="1.6"/><path d="M43.5 59 Q50 65 56.5 59" fill="none" ${s}/>`;
    case 'cat':
      return `<path d="M43.5 59 Q46.8 62.5 50 59 Q53.2 62.5 56.5 59" fill="none" ${s}/>`;
    case 'frown':
      return `<path d="M44 63.5 Q50 57.5 56 63.5" fill="none" ${s}/>`;
    case 'o':
      return `<ellipse cx="50" cy="61.5" rx="3.4" ry="4.2" fill="#7a1f3d" ${s}/>`;
    case 'smile':
    default:
      return `<path d="M43.5 58.5 Q50 65.5 56.5 58.5" fill="none" ${s}/>`;
  }
}

function hairSvg(style, color) {
  const st = `fill="${color}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"`;
  const shortFront = `<path d="M29 46 C27 26 38 20 50 20 C63 20 73 26 71 46 C69 38 64 33 58 31 C52 35 40 35 33 36 C31 39 30 42 29 46 Z" ${st}/>`;
  switch (style) {
    case 'short':
      return { back: '', front: shortFront };
    case 'spiky':
      return {
        back: '',
        front: `<path d="M29 45 L26 30 L34 31 L32 19 L41 25 L44 13 L50 21 L56 13 L59 25 L68 19 L66 31 L74 30 L71 45 C68 36 60 32 50 32 C40 32 32 36 29 45 Z" ${st}/>`,
      };
    case 'long':
      return {
        back: `<path d="M27 44 C25 22 38 17 50 17 C62 17 75 22 73 44 L76 86 C68 90 62 86 60 80 L40 80 C38 86 32 90 24 86 Z" ${st}/>`,
        front: `<path d="M29 47 C28 27 38 20 50 20 C62 20 72 27 71 47 C66 36 58 30 48 31 C40 32 33 38 29 47 Z" ${st}/>`,
      };
    case 'bob':
      return {
        back: `<path d="M25 50 C22 24 36 18 50 18 C64 18 78 24 75 50 C75 60 72 67 68 67 L32 67 C28 67 25 60 25 50 Z" ${st}/>`,
        front: `<path d="M29 44 C29 26 38 20 50 20 C62 20 71 26 71 44 C66 38 60 37 50 37 C40 37 34 38 29 44 Z" ${st}/>`,
      };
    case 'curly': {
      const back = [[32, 32, 10], [40, 23, 11], [50, 20, 11], [60, 23, 11], [68, 32, 10], [27, 43, 8], [73, 43, 8]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" ${st}/>`)
        .join('');
      const front = [[35, 33, 6], [43, 29.5, 6.2], [51, 28.5, 6.2], [59, 30, 6], [65.5, 34.5, 5.2]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`)
        .join('');
      return { back, front };
    }
    case 'bun':
      return { back: `<circle cx="50" cy="17" r="9" ${st}/>`, front: shortFront };
    case 'mohawk':
      return { back: '', front: `<path d="M45 33 C43.5 22 46 12 50 7 C54 12 56.5 22 55 33 Z" ${st}/>` };
    case 'ponytail':
      return {
        back: `<path d="M66 29 C86 28 90 52 80 74 C79 60 74 48 67 42 Z" ${st}/>`,
        front: shortFront,
      };
    case 'bald':
    default:
      return { back: '', front: `<ellipse cx="42" cy="31" rx="5" ry="2.6" fill="#fff" opacity="0.4"/>` };
  }
}

function accSvg(style) {
  const s = `stroke="${INK}" stroke-width="2" stroke-linejoin="round"`;
  switch (style) {
    case 'glasses':
      return (
        `<circle cx="42" cy="48" r="6.4" fill="rgba(255,255,255,.25)" ${s}/><circle cx="58" cy="48" r="6.4" fill="rgba(255,255,255,.25)" ${s}/>` +
        `<path d="M48.4 47.5 Q50 46 51.6 47.5 M35.6 47 L30 45.5 M64.4 47 L70 45.5" fill="none" ${s}/>`
      );
    case 'shades':
      return (
        `<rect x="34.5" y="44" width="13.5" height="8.5" rx="3.5" fill="${INK}"/><rect x="52" y="44" width="13.5" height="8.5" rx="3.5" fill="${INK}"/>` +
        `<path d="M48 46.5 L52 46.5 M34.5 46 L30 45 M65.5 46 L70 45" ${s} fill="none"/>` +
        `<path d="M37 46.5 L40 46.5 M54.5 46.5 L57.5 46.5" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>`
      );
    case 'cap':
      return (
        `<path d="M29 39 C29 22 39 17 50 17 C61 17 71 22 71 39 Z" fill="#ff5964" ${s}/>` +
        `<path d="M44 38 C56 35 74 36 83 40.5 C79 44.5 60 43.5 44 42 Z" fill="#d93d4c" ${s}/>` +
        `<circle cx="50" cy="18" r="2.2" fill="#d93d4c" ${s} stroke-width="1.4"/>`
      );
    case 'headphones':
      return (
        `<path d="M27 49 C25 20 75 20 73 49" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M27 49 C25 20 75 20 73 49" fill="none" stroke="#2b2b44" stroke-width="3.2" stroke-linecap="round"/>` +
        `<rect x="22" y="42" width="9" height="14" rx="4" fill="#ff4f9a" ${s}/><rect x="69" y="42" width="9" height="14" rx="4" fill="#ff4f9a" ${s}/>`
      );
    case 'bow':
      return (
        `<path d="M66 27 L57.5 20.5 L58.5 33 Z M66 27 L74.5 20.5 L73.5 33 Z" fill="#ff4f9a" ${s}/>` +
        `<circle cx="66" cy="27" r="2.8" fill="#ff83b7" ${s} stroke-width="1.6"/>`
      );
    case 'beanie':
      return (
        `<path d="M28.5 40 C28.5 20 40 15 50 15 C60 15 71.5 20 71.5 40 Z" fill="#4d7cff" ${s}/>` +
        `<rect x="27" y="35" width="46" height="8" rx="4" fill="#3a63d6" ${s}/>` +
        `<circle cx="50" cy="13" r="5" fill="#ffd23f" ${s}/>`
      );
    case 'flower': {
      const petals = [0, 72, 144, 216, 288]
        .map((a) => {
          const r = (a * Math.PI) / 180;
          return `<circle cx="${(68 + Math.cos(r) * 4).toFixed(1)}" cy="${(27 + Math.sin(r) * 4).toFixed(1)}" r="3.4" fill="#ffd23f" stroke="${INK}" stroke-width="1.3"/>`;
        })
        .join('');
      return petals + `<circle cx="68" cy="27" r="2.6" fill="#ff8c42" stroke="${INK}" stroke-width="1.3"/>`;
    }
    case 'crown':
      return (
        `<path d="M34 26 L36 10 L43.5 19 L50 6 L56.5 19 L64 10 L66 26 Z" fill="#ffd23f" ${s}/>` +
        `<circle cx="50" cy="20" r="2.2" fill="#ff4f9a"/><circle cx="41" cy="22" r="1.6" fill="#2de2e6"/><circle cx="59" cy="22" r="1.6" fill="#2de2e6"/>`
      );
    default:
      return '';
  }
}

const MOODS = {
  win: { eyes: 'happy', mouth: 'grin' },
  happy: { mouth: 'grin' },
  sad: { eyes: 'round', mouth: 'frown' },
  shock: { eyes: 'shock', mouth: 'o' },
};

/**
 * Render an avatar as an SVG string.
 * @param {object} a avatar option indexes
 * @param {{mood?:string, bg?:boolean, crown?:boolean}} opts
 */
export function renderAvatar(a, opts = {}) {
  a = a || {};
  const O = AVATAR_OPTIONS;
  const get = (k) => O[k][Math.max(0, Math.min(O[k].length - 1, a[k] | 0))];
  const skin = get('skin');
  const skinDark = shade(skin, 0.14);
  const outfit = get('outfit');
  const mood = MOODS[opts.mood] || {};
  const hair = hairSvg(get('hair'), get('hairColor'));
  const acc = opts.crown ? 'crown' : get('acc');
  const showBg = opts.bg !== false;
  const s = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"`;

  const body =
    `<path d="M14 106 C16 85 30 77 50 77 C70 77 84 85 86 106 Z" fill="${outfit}" ${s}/>` +
    `<path d="M42 77.5 L50 87 L58 77.5" fill="none" stroke="${shade(outfit, 0.25)}" stroke-width="2.4" stroke-linejoin="round"/>`;
  const neck = `<path d="M44 62 L44 77 Q50 81 56 77 L56 62 Z" fill="${skinDark}" ${s}/>`;
  const ears = `<ellipse cx="30" cy="49" rx="4.2" ry="5.6" fill="${skin}" ${s}/><ellipse cx="70" cy="49" rx="4.2" ry="5.6" fill="${skin}" ${s}/>`;
  const head = `<ellipse cx="50" cy="47" rx="20.5" ry="22.5" fill="${skin}" ${s}/>`;
  const cheeks = `<circle cx="37.5" cy="56" r="3.6" fill="#ff7aa8" opacity=".45"/><circle cx="62.5" cy="56" r="3.6" fill="#ff7aa8" opacity=".45"/>`;
  const nose = `<path d="M50.5 50.5 Q47.6 54.6 50.8 55.2" fill="none" stroke="${skinDark}" stroke-width="2" stroke-linecap="round"/>`;
  const face =
    cheeks + eyesSvg(mood.eyes || get('eyes')) + nose + mouthSvg(mood.mouth || get('mouth'));

  const inner = hair.back + body + neck + ears + head + face + hair.front + accSvg(acc);
  const bg = showBg ? `<circle cx="50" cy="50" r="50" fill="${get('bg')}"/>` : '';
  const content = showBg ? `<g clip-path="url(#ppclip)">${bg}${inner}</g>` : inner;
  return (
    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="av-svg">` +
    `<defs><clipPath id="ppclip"><circle cx="50" cy="50" r="50"/></clipPath></defs>` +
    content +
    `</svg>`
  );
}
