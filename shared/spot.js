// Drawn objects for Spot the Difference. One cell in each grid differs:
// a part is recoloured, a part is missing, or the object is mirrored/rotated.

const INK = '#1b1530';
const S = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`;
const thick = (d, color, w = 7) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 4.5}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

export const OBJECTS = {
  cupcake: {
    asym: false,
    colors: {
      wrapper: { base: '#3fa7ff', strong: '#ff5a3c', subtle: '#6fbfff' },
      frosting: { base: '#ff8fc2', strong: '#9ff3ea', subtle: '#ffadd4' },
      cherry: { base: '#ff3b3b', strong: '#3fa7ff', subtle: '#ff6a5a' },
    },
    removable: ['cherry', 'sprinkles'],
    draw: (c, m) =>
      `<path d="M15 36 H49 L44.5 58 H19.5 Z" fill="${c.wrapper}" ${S}/>` +
      `<path d="M23 38 L25 56 M32 38 V56 M41 38 L39 56" stroke="${INK}" stroke-width="2" opacity=".45"/>` +
      `<path d="M11 38 C6 30 14 23 19 25.5 C19 15 32 13 34 19.5 C38 13 51 17 46.5 25.5 C55 25 57 36 51 38.5 Z" fill="${c.frosting}" ${S}/>` +
      (m === 'sprinkles' ? '' : `<path d="M20 30 L23 28 M29 24 L31 27 M38 28 L41 26 M44 33 L46 30 M26 34 L29 33" stroke="#fff6e6" stroke-width="2.4" stroke-linecap="round"/>`) +
      (m === 'cherry' ? '' : `<path d="M33 13 Q35 6 40 4" fill="none" stroke="${INK}" stroke-width="2.2"/><circle cx="32" cy="15" r="5.5" fill="${c.cherry}" ${S}/>`),
  },
  fish: {
    asym: true,
    colors: {
      body: { base: '#ff9a3c', strong: '#9b6bff', subtle: '#ffb05f' },
      stripe: { base: '#fff6e6', strong: '#1b1530', subtle: '#ffe2b8' },
    },
    removable: ['eye', 'fin', 'stripe'],
    draw: (c, m) =>
      (m === 'fin' ? '' : `<path d="M24 22 Q31 9 40 22 Z" fill="${c.body}" ${S}/>`) +
      `<path d="M45 32 L60 19 L57 32 L60 45 Z" fill="${c.body}" ${S}/>` +
      `<ellipse cx="29" cy="32" rx="19" ry="13.5" fill="${c.body}" ${S}/>` +
      (m === 'stripe' ? '' : `<path d="M33 19.5 Q28 32 33 44.5 M40 22 Q36 32 40 42" fill="none" stroke="${c.stripe}" stroke-width="3.4" stroke-linecap="round"/>`) +
      (m === 'eye' ? '' : `<circle cx="19" cy="29" r="4" fill="#fff" ${S} stroke-width="2"/><circle cx="18.2" cy="29" r="1.9" fill="${INK}"/>`) +
      `<path d="M12 36 Q16 38.5 19 36" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
  },
  cactus: {
    asym: true,
    colors: {
      body: { base: '#27c49a', strong: '#3fa7ff', subtle: '#3ed6ab' },
      pot: { base: '#ff8c42', strong: '#9b6bff', subtle: '#ffa35e' },
      flower: { base: '#ff6fae', strong: '#ffc23d', subtle: '#ff8cc0' },
    },
    removable: ['flower', 'armL', 'armR'],
    draw: (c, m) =>
      (m === 'armL' ? '' : thick('M28 38 H20 Q17 38 17 34 V25', c.body)) +
      (m === 'armR' ? '' : thick('M36 32 H44 Q47 32 47 28 V21', c.body)) +
      `<rect x="25" y="13" width="14" height="38" rx="7" fill="${c.body}" ${S}/>` +
      `<path d="M30 20 V44 M34 24 V48" stroke="${INK}" stroke-width="1.8" opacity=".35"/>` +
      `<path d="M15 48 H49 L45 61 H19 Z" fill="${c.pot}" ${S}/><path d="M13.5 46 H50.5 V51 H13.5 Z" fill="${c.pot}" ${S}/>` +
      (m === 'flower' ? '' : `<circle cx="32" cy="11" r="5.2" fill="${c.flower}" ${S}/><circle cx="32" cy="11" r="1.8" fill="#ffc23d"/>`),
  },
  icecream: {
    asym: false,
    colors: {
      scoopA: { base: '#ff8fc2', strong: '#7a4a2b', subtle: '#ffa6cf' },
      scoopB: { base: '#9ff3ea', strong: '#ffc23d', subtle: '#b8f7f0' },
      cone: { base: '#f3c094', strong: '#9b6bff', subtle: '#e8b07e' },
    },
    removable: ['cherry', 'drip'],
    draw: (c, m) =>
      `<path d="M19 34 H45 L32 61 Z" fill="${c.cone}" ${S}/>` +
      `<path d="M24 38 L36 52 M30 37 L40 46 M40 37 L28 52 M34 37 L24 46" stroke="${INK}" stroke-width="1.8" opacity=".4"/>` +
      `<circle cx="32" cy="29" r="12.5" fill="${c.scoopA}" ${S}/>` +
      (m === 'drip' ? '' : `<path d="M22 34 Q23 41 26 38 Q27 35 28 39 Q29 42 31 37" fill="${c.scoopA}" ${S} stroke-width="2"/>`) +
      `<circle cx="32" cy="15.5" r="10" fill="${c.scoopB}" ${S}/>` +
      (m === 'cherry' ? '' : `<circle cx="32" cy="5.5" r="4.2" fill="#ff3b3b" ${S} stroke-width="2.2"/>`),
  },
  mushroom: {
    asym: true,
    colors: {
      cap: { base: '#ff5a3c', strong: '#3fa7ff', subtle: '#ff7558' },
      stem: { base: '#fff6e6', strong: '#ffc23d', subtle: '#f6e8cf' },
    },
    removable: ['spot1', 'spot2', 'spot3'],
    draw: (c, m) =>
      `<path d="M24 32 H40 L42 57 Q32 61 22 57 Z" fill="${c.stem}" ${S}/>` +
      `<path d="M7 35 C7 9 57 9 57 35 Q32 41 7 35 Z" fill="${c.cap}" ${S}/>` +
      (m === 'spot1' ? '' : `<circle cx="20" cy="24" r="4.5" fill="#fff6e6" ${S} stroke-width="1.8"/>`) +
      (m === 'spot2' ? '' : `<circle cx="35" cy="17" r="5.5" fill="#fff6e6" ${S} stroke-width="1.8"/>`) +
      (m === 'spot3' ? '' : `<circle cx="47" cy="28" r="3.6" fill="#fff6e6" ${S} stroke-width="1.8"/>`) +
      `<circle cx="28.5" cy="46" r="1.6" fill="${INK}"/><circle cx="35.5" cy="46" r="1.6" fill="${INK}"/>`,
  },
  robot: {
    asym: false,
    colors: {
      head: { base: '#9b6bff', strong: '#ff5a3c', subtle: '#ab80ff' },
      eyes: { base: '#3fe0d0', strong: '#ff5a3c', subtle: '#6fe9dd' },
    },
    removable: ['antenna', 'mouth', 'ears'],
    draw: (c, m) =>
      (m === 'antenna' ? '' : `<path d="M32 18 V8" stroke="${INK}" stroke-width="2.6"/><circle cx="32" cy="7" r="4" fill="#ffc23d" ${S} stroke-width="2.2"/>`) +
      (m === 'ears' ? '' : `<rect x="7" y="29" width="7" height="13" rx="2" fill="${c.head}" ${S}/><rect x="50" y="29" width="7" height="13" rx="2" fill="${c.head}" ${S}/>`) +
      `<rect x="13" y="18" width="38" height="34" rx="8" fill="${c.head}" ${S}/>` +
      `<circle cx="24" cy="32" r="5" fill="${c.eyes}" ${S} stroke-width="2.2"/><circle cx="40" cy="32" r="5" fill="${c.eyes}" ${S} stroke-width="2.2"/>` +
      (m === 'mouth' ? '' : `<rect x="22" y="41" width="20" height="6" rx="2" fill="#fff6e6" ${S} stroke-width="2"/><path d="M27 41 V47 M32 41 V47 M37 41 V47" stroke="${INK}" stroke-width="1.6"/>`),
  },
};

export const OBJECT_IDS = Object.keys(OBJECTS);

/**
 * @param {string} id object id
 * @param {null|{type:'color'|'missing'|'mirror'|'rotate', part?:string, strength?:'strong'|'subtle', angle?:number}} diff
 */
export function renderObject(id, diff = null) {
  const o = OBJECTS[id];
  const colors = {};
  for (const [k, v] of Object.entries(o.colors)) colors[k] = v.base;
  if (diff?.type === 'color' && o.colors[diff.part]) colors[diff.part] = o.colors[diff.part][diff.strength || 'strong'];
  const missing = diff?.type === 'missing' ? diff.part : null;
  let inner = o.draw(colors, missing);
  if (diff?.type === 'mirror') inner = `<g transform="translate(64 0) scale(-1 1)">${inner}</g>`;
  if (diff?.type === 'rotate') inner = `<g transform="rotate(${diff.angle || 180} 32 32)">${inner}</g>`;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}
