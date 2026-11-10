// Homepage: logo, a parade of the cast, Host / Join.
import { h, show, char, icon, Bag } from './ui.js';
import { SLOTS } from '/shared/characters.js';
import { GAMES } from '/shared/games.js';
import { prefs } from './net.js';
import { sfx } from './sound.js';

function logo() {
  const word = (text, cls) =>
    h('span', { class: `logo-word ${cls}` },
      [...text].map((ch, i) => h('span', { class: 'logo-letter', style: { animationDelay: `${0.1 + i * 0.06}s` } }, ch)));
  return h('h1', { class: 'logo', 'aria-label': 'Party Panic' }, word('PARTY', 'w1'), word('PANIC', 'w2'));
}

export function renderHome({ onCreate, onJoin, prefillCode }) {
  const bag = new Bag();

  // One colourway of each character, shuffled
  const cast = SLOTS.filter((s) => s.v === 0).sort(() => Math.random() - 0.5).slice(0, 7);
  const parade = h('div', { class: 'home-cast' },
    cast.map((s, i) => char(s.slot, { size: i === 3 ? 104 : 76, class: 'hop', mood: i === 3 ? 'happy' : 'idle' })));
  [...parade.children].forEach((el, i) => { el.style.animationDelay = `${i * 0.12}s`; });

  const createBtn = h('button', { class: 'btn btn-primary btn-xl' }, icon('tv'), 'Host a party');
  const joinBtn = h('button', { class: 'btn btn-secondary btn-xl' }, icon('phone'), 'Join a party');
  const actions = h('div', { class: 'home-actions' },
    createBtn,
    h('p', { class: 'hint' }, 'Hosting? Open this on a laptop or TV. Everyone else plays on their phone.'),
    joinBtn);

  const codeInput = h('input', {
    class: 'input code-input', inputmode: 'numeric', maxlength: '6', placeholder: '······',
    autocomplete: 'off', 'aria-label': 'Room code', pattern: '[0-9]*',
  });
  const nameInput = h('input', {
    class: 'input', maxlength: '14', placeholder: 'Your name', autocomplete: 'nickname',
    'aria-label': 'Your name', enterkeyhint: 'go',
  });
  nameInput.value = prefs.get('name', '');
  const err = h('div', { class: 'form-error', role: 'alert' });
  const goBtn = h('button', { class: 'btn btn-primary btn-lg', type: 'submit' }, 'Join', icon('right'));
  const back = h('button', { class: 'btn-link', type: 'button' }, icon('back'), 'Back');
  const form = h('form', { class: 'home-join card hidden' },
    h('label', { class: 'field-label' }, 'Room code'),
    codeInput,
    h('label', { class: 'field-label' }, 'Your name'),
    nameInput,
    err,
    goBtn,
    back);

  const showJoin = () => {
    actions.classList.add('hidden');
    form.classList.remove('hidden');
    (codeInput.value.length === 6 ? nameInput : codeInput).focus();
  };
  const showMain = () => {
    form.classList.add('hidden');
    actions.classList.remove('hidden');
  };

  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
    err.textContent = '';
    if (codeInput.value.length === 6 && !nameInput.value) nameInput.focus();
  });
  createBtn.addEventListener('click', async () => {
    sfx.click();
    createBtn.disabled = true;
    await onCreate();
    createBtn.disabled = false;
  });
  joinBtn.addEventListener('click', () => { sfx.click(); showJoin(); });
  back.addEventListener('click', () => { sfx.click(); showMain(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = codeInput.value.trim();
    const name = nameInput.value.trim();
    if (code.length !== 6) { err.textContent = 'Room codes have 6 digits.'; codeInput.focus(); return; }
    if (!name) { err.textContent = 'Pick a name first.'; nameInput.focus(); return; }
    goBtn.disabled = true;
    const problem = await onJoin({ code, name, character: prefs.get('character', null) });
    goBtn.disabled = false;
    if (problem) { err.textContent = problem; sfx.bad(); }
  });

  if (prefillCode && /^\d{6}$/.test(prefillCode)) {
    codeInput.value = prefillCode;
    showJoin();
  }

  const games = h('div', { class: 'home-games' },
    Object.values(GAMES).map((g) => h('span', { class: 'game-chip', style: { '--c': g.color } }, icon(g.icon), g.name)));

  const screen = h('div', { class: 'home' },
    h('div', { class: 'home-inner' },
      logo(),
      h('p', { class: 'tagline' }, `${Object.keys(GAMES).length} minigames · up to 20 players · one very loud room`),
      parade,
      actions,
      form,
      games));
  show(screen, () => bag.run());
}
