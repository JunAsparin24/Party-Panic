// Party Panic icon set: one consistent line style (24px grid, round caps).
// Use icon('name') anywhere text would otherwise need an emoji.

const P = {
  // minigames
  timing: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" class="f"/>',
  memory: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2" class="f"/>',
  spot: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 L21 21"/><path d="M8 9 A3 3 0 0 1 11 7"/>',
  numbers: '<rect x="4" y="2.5" width="16" height="19" rx="3"/><path d="M8 7.5 H16"/><circle cx="8.5" cy="12.5" r=".9" class="f"/><circle cx="12" cy="12.5" r=".9" class="f"/><circle cx="15.5" cy="12.5" r=".9" class="f"/><circle cx="8.5" cy="17" r=".9" class="f"/><circle cx="12" cy="17" r=".9" class="f"/><circle cx="15.5" cy="17" r=".9" class="f"/>',
  tower: '<rect x="3.5" y="15.5" width="17" height="5" rx="1.2"/><rect x="5.5" y="10.5" width="13" height="5" rx="1.2"/><rect x="8" y="5.5" width="10" height="5" rx="1.2"/>',
  words: '<rect x="3" y="3.5" width="18" height="17" rx="3"/><path d="M8 16.5 L12 7.5 L16 16.5 M9.6 13 H14.4"/>',
  catch: '<path d="M3.5 10 H20.5 L18.5 20 H5.5 Z"/><path d="M8 10 C8 4.5 16 4.5 16 10"/><path d="M9 13 V17 M12 13 V17 M15 13 V17"/>',
  double: '<rect x="3" y="9.5" width="18" height="11" rx="2"/><path d="M3 10 C3 4.5 21 4.5 21 10"/><path d="M3 13.5 H21"/><rect x="10.5" y="11.5" width="3" height="4" rx=".8" class="f"/>',
  maze: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 3 V13 H13 M3 18 H12 M17 8 V21 M12 8 H17"/>',
  redlight: '<rect x="7.5" y="2" width="9" height="20" rx="4.5"/><circle cx="12" cy="7" r="1.8" class="f"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="17" r="1.8"/>',
  tug: '<path d="M2.5 12 H21.5"/><path d="M6 8 L2.5 12 L6 16 M18 8 L21.5 12 L18 16"/><path d="M12 9 V15"/>',
  // modes
  trophy: '<path d="M7 4 H17 V9 A5 5 0 0 1 7 9 Z"/><path d="M7 6 H4 A3 3 0 0 0 7 11 M17 6 H20 A3 3 0 0 1 17 11"/><path d="M12 14 V18 M8 20.5 H16"/>',
  skull: '<path d="M5 11 A7 7 0 0 1 19 11 V15 H16 V19.5 H8 V15 H5 Z"/><circle cx="9.5" cy="11.5" r="1.7" class="f"/><circle cx="14.5" cy="11.5" r="1.7" class="f"/><path d="M11 19.5 V16.5 M13 19.5 V16.5"/>',
  teams: '<circle cx="8" cy="8" r="3.2"/><path d="M2 19.5 C2 14 14 14 14 19.5"/><circle cx="16.5" cy="9" r="2.6"/><path d="M15.5 14.4 C19.5 14 22 15.6 22 19.5"/>',
  bolt: '<path d="M13 2 L4.5 13.5 H11 L10 22 L19.5 9.5 H13 Z" class="f"/>',
  // chaos modifiers
  x2: '<path d="M4 8.5 L10 14.5 M10 8.5 L4 14.5"/><path d="M13.5 9.5 C13.5 6 19.5 6 19.5 9.5 C19.5 12.5 13.5 14.5 13.5 18 H19.5"/>',
  swap: '<path d="M4 8 H18.5 M14.5 4 L18.5 8 L14.5 12"/><path d="M20 16 H5.5 M9.5 12 L5.5 16 L9.5 20"/>',
  stopwatch: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5 V9.5 M10 2.5 H14 M12 2.5 V6"/>',
  crown: '<path d="M3 8 L7.5 12.5 L12 5 L16.5 12.5 L21 8 L19 19 H5 Z"/>',
  rise: '<path d="M3 17 L9 11 L13 15 L21 7"/><path d="M15 7 H21 V13"/>',
  bag: '<path d="M8.5 7 L6.5 3 H17.5 L15.5 7"/><path d="M8.5 7 H15.5 C21 10 22 21 12 21 C2 21 3 10 8.5 7 Z"/><path d="M14 11.5 C13.5 10.5 10 10.5 10 12.5 C10 14.5 14 13.5 14 15.5 C14 17.5 10.5 17.5 10 16.5 M12 9.5 V18.5"/>',
  flip: '<path d="M4 12 A8 8 0 0 1 18.2 7"/><path d="M18.5 3 V7.5 H14"/><path d="M20 12 A8 8 0 0 1 5.8 17"/><path d="M5.5 21 V16.5 H10"/>',
  // interface
  sound: '<path d="M4 9 H8 L13 5 V19 L8 15 H4 Z"/><path d="M16.5 9 C18 10.5 18 13.5 16.5 15 M19.5 6 C22.5 9 22.5 15 19.5 18"/>',
  mute: '<path d="M4 9 H8 L13 5 V19 L8 15 H4 Z"/><path d="M16.5 9.5 L21.5 14.5 M21.5 9.5 L16.5 14.5"/>',
  music: '<path d="M9 18 V5.5 L20 3.5 V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  fullscreen: '<path d="M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15"/>',
  skip: '<path d="M5 5 L14 12 L5 19 Z"/><path d="M18 5 V19"/>',
  flag: '<path d="M5 21 V3.5"/><path d="M5 4 H18 L15 8.5 L18 13 H5"/>',
  close: '<path d="M6 6 L18 18 M18 6 L6 18"/>',
  check: '<path d="M5 12.5 L10 17.5 L19 7"/>',
  heart: '<path d="M12 20 C5 15 2 11.5 4 7.5 C6 4 10 4.5 12 8 C14 4.5 18 4 20 7.5 C22 11.5 19 15 12 20 Z"/>',
  heartFull: '<path d="M12 20 C5 15 2 11.5 4 7.5 C6 4 10 4.5 12 8 C14 4.5 18 4 20 7.5 C22 11.5 19 15 12 20 Z" class="f"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11 V8 A4 4 0 0 1 16 8 V11"/>',
  star: '<path d="M12 3 L14.6 8.6 L20.6 9.2 L16 13.2 L17.4 19.2 L12 16 L6.6 19.2 L8 13.2 L3.4 9.2 L9.4 8.6 Z"/>',
  starFull: '<path d="M12 3 L14.6 8.6 L20.6 9.2 L16 13.2 L17.4 19.2 L12 16 L6.6 19.2 L8 13.2 L3.4 9.2 L9.4 8.6 Z" class="f"/>',
  refresh: '<path d="M20 12 A8 8 0 1 1 17.7 6.3"/><path d="M20 3.5 V9 H14.5"/>',
  play: '<path d="M7 4 L19 12 L7 20 Z" class="f"/>',
  back: '<path d="M15 5 L8 12 L15 19"/>',
  up: '<path d="M5 15 L12 8 L19 15"/>',
  down: '<path d="M5 9 L12 16 L19 9"/>',
  left: '<path d="M15 5 L8 12 L15 19"/>',
  right: '<path d="M9 5 L16 12 L9 19"/>',
  fire: '<path d="M12 21.5 C7 21.5 5 18 5 14.5 C5 10 9 8 9 3.5 C12 5.5 13.5 8 13.5 10.5 C14.5 9.5 15.5 8 15.5 6.5 C18.5 9 19 12 19 14.5 C19 18 16.5 21.5 12 21.5 Z"/>',
  snow: '<path d="M12 3 V21 M4.2 7.5 L19.8 16.5 M19.8 7.5 L4.2 16.5"/><path d="M9.5 4.5 L12 7 L14.5 4.5 M9.5 19.5 L12 17 L14.5 19.5"/>',
  bomb: '<circle cx="11" cy="14.5" r="7" class="f"/><rect x="13.5" y="5.5" width="5" height="4" rx="1" transform="rotate(40 16 7.5)"/><path d="M18.5 5 C19.5 3 21 3 21.5 4"/>',
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.3" class="f"/><circle cx="15.5" cy="15.5" r="1.3" class="f"/><circle cx="12" cy="12" r="1.3" class="f"/><circle cx="15.5" cy="8.5" r="1.3" class="f"/><circle cx="8.5" cy="15.5" r="1.3" class="f"/>',
  medal: '<circle cx="12" cy="15" r="5.5"/><path d="M8 3 L10.2 9.8 M16 3 L13.8 9.8"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5 H13.5"/>',
  tv: '<rect x="2.5" y="4.5" width="19" height="13" rx="2.5"/><path d="M8 21 H16 M12 17.5 V21"/>',
  users: '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20 C2.5 14 15.5 14 15.5 20"/><path d="M16 4.8 A3.2 3.2 0 0 1 16 11.2 M18 14.4 C20.5 15 22 16.8 22 20"/>',
  edit: '<path d="M4 20 L4.8 15.8 L15.5 5 A2.1 2.1 0 0 1 19 8.5 L8.2 19.2 Z"/><path d="M13.5 7 L17 10.5"/>',
  sparkle: '<path d="M12 3 C12.8 8 16 11.2 21 12 C16 12.8 12.8 16 12 21 C11.2 16 8 12.8 3 12 C8 11.2 11.2 8 12 3 Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" class="f"/>',
  turtle: '<path d="M4 15 C4 9 9 6.5 12 6.5 C15 6.5 20 9 20 15 Z"/><path d="M20 13 C21.5 13 22.5 12 22.5 11 M6 15 V18 M18 15 V18 M9.5 9 L12 12 L14.5 9"/>',
  rocket: '<path d="M12 2.5 C16 5.5 17 10 16 15 H8 C7 10 8 5.5 12 2.5 Z"/><circle cx="12" cy="9" r="1.8"/><path d="M8 13 L5 17 L8.5 17 M16 13 L19 17 L15.5 17 M10 18.5 L12 21.5 L14 18.5"/>',
  megaphone: '<path d="M3.5 10 V14 H7 L16 19 V5 L7 10 Z"/><path d="M7 14 L8.5 20 H11 L10 14.5 M19 9.5 A3.5 3.5 0 0 1 19 14.5"/>',
};

/** Returns an inline SVG icon element. */
export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = `ic ${cls}`;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = iconSvg(name);
  return span;
}

export function iconSvg(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${P[name] || P.star}</svg>`;
}

export const hasIcon = (name) => !!P[name];
