// Animated homepage with Create Party / Join Party.
import { h, show, avatar, Bag } from './ui.js';
import { randomAvatar } from '/shared/avatar.js';
import { prefs } from './net.js';
import { sfx } from './sound.js';
import { GAMES } from '/shared/games.js';

function logo() {
  const word = (text, cls) =>
    h('span', { class: `logo-word ${cls}` },
      [...text].map((ch, i) => h('span', { class: 'logo-letter', style: { animationDelay: `${i * 0.08}s` } }, ch)));
  return h('h1', { class: 'logo' }, word('PARTY', 'w1'), word('PANIC', 'w2'));
}

export function renderHome({ onCreate, onJoin, prefillCode }) {
  const bag = new Bag();
  let myAvatar = prefs.get('avatar', null) || randomAvatar();
  prefs.set('avatar', myAvatar);

  const crowd = h('div', { class: 'home-crowd' },
    Array.from({ length: 5 }, (_, i) =>
      avatar(i === 2 ? myAvatar : randomAvatar(), { class: 'dance', size: i === 2 ? 92 : 70 })
    ).map((el, i) => { el.style.animationDelay = `${i * 0.15}s`; return el; })
  );

  const games = h('div', { class: 'home-games' },
    Object.values(GAMES).map((g, i) =>
      h('span', { class: 'game-chip', style: { '--c': g.color, animationDelay: `${i * 0.06}s` } }, g.icon, ' ', g.name)
    )
  );

  // --- main panel
  const createBtn = h('button', { class: 'btn btn-pink btn-xl' }, '🎉 Create Party');
  const joinBtn = h('button', { class: 'btn btn-yellow btn-xl' }, '📱 Join Party');
  const mainPanel = h('div', { class: 'home-actions' },
    createBtn,
    h('div', { class: 'hint' }, 'Host on a laptop or TV — everyone plays on their phone'),
    joinBtn
  );

  // --- join panel
  const codeInput = h('input', {
    class: 'input code-input', inputmode: 'numeric', maxlength: '6', placeholder: '000000',
    autocomplete: 'off', 'aria-label': 'Room code', pattern: '[0-9]*',
  });
  const nameInput = h('input', {
    class: 'input', maxlength: '14', placeholder: 'Your name', autocomplete: 'nickname',
    'aria-label': 'Your name', enterkeyhint: 'go',
  });
  nameInput.value = prefs.get('name', '');
  const err = h('div', { class: 'form-error' });
  const goBtn = h('button', { class: 'btn btn-green btn-lg', type: 'submit' }, "Let's go!");
  const back = h('button', { class: 'btn-link', type: 'button' }, '← Back');
  const joinForm = h('form', { class: 'home-join card hidden' },
    h('label', { class: 'field-label' }, 'Room code'),
    codeInput,
    h('label', { class: 'field-label' }, 'Your name'),
    nameInput,
    err,
    goBtn,
    back
  );

  const showJoin = () => {
    mainPanel.classList.add('hidden');
    joinForm.classList.remove('hidden');
    (codeInput.value.length === 6 ? nameInput : codeInput).focus();
  };
  const showMain = () => {
    joinForm.classList.add('hidden');
    mainPanel.classList.remove('hidden');
  };

  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
    err.textContent = '';
    if (codeInput.value.length === 6 && !nameInput.value) nameInput.focus();
  });
  createBtn.addEventListener('click', async () => {
    sfx.click();
    createBtn.disabled = true;
    createBtn.textContent = 'Creating…';
    await onCreate();
    createBtn.disabled = false;
    createBtn.textContent = '🎉 Create Party';
  });
  joinBtn.addEventListener('click', () => { sfx.click(); showJoin(); });
  back.addEventListener('click', () => { sfx.click(); showMain(); });
  joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = codeInput.value.trim();
    const name = nameInput.value.trim();
    if (code.length !== 6) { err.textContent = 'Room codes have 6 digits'; codeInput.focus(); return; }
    if (!name) { err.textContent = 'Pick a name first!'; nameInput.focus(); return; }
    goBtn.disabled = true;
    goBtn.textContent = 'Joining…';
    const problem = await onJoin({ code, name, avatar: myAvatar });
    goBtn.disabled = false;
    goBtn.textContent = "Let's go!";
    if (problem) { err.textContent = problem; sfx.bad(); }
  });

  if (prefillCode && /^\d{6}$/.test(prefillCode)) {
    codeInput.value = prefillCode;
    showJoin();
  }

  const screen = h('div', { class: 'home' },
    h('div', { class: 'home-inner' },
      logo(),
      h('p', { class: 'tagline' }, '10 chaotic minigames · up to 20 players · zero chill'),
      crowd,
      mainPanel,
      joinForm,
      games
    )
  );
  show(screen, () => bag.run());
}
