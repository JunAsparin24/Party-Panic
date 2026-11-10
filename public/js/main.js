// Entry point: background, routing between home / host / player, reconnects.
import { net, socket, session, syncClock, prefs } from './net.js';
import { h, show, toast, icon } from './ui.js';
import { renderHome } from './home.js';
import { HostApp } from './host.js';
import { PlayerApp } from './player.js';
import { sfx } from './sound.js';

let app = null;
let onHome = false;

// ---------------------------------------------------------------- background
document.getElementById('bg').append(
  Object.assign(document.createElement('div'), { className: 'bg-rays' }),
  Object.assign(document.createElement('div'), { className: 'bg-dots' }),
);

// ---------------------------------------------------------------- routing
function startApp(role, state) {
  onHome = false;
  if (app && app.role === role) {
    // Resumed after a drop: redraw from the server's state so nothing is stale.
    app.onState(state, true);
    return;
  }
  app?.destroy();
  app = role === 'host' ? new HostApp(state, leaveApp) : new PlayerApp(state, leaveApp);
}

function leaveApp(message, kind = 'info') {
  session.clear();
  app?.destroy();
  app = null;
  if (message) toast(message, kind);
  goHome();
}

function goHome(prefill) {
  onHome = true;
  history.replaceState(null, '', location.pathname);
  renderHome({ onCreate, onJoin, prefillCode: prefill });
}

async function onCreate() {
  const r = await net.request('host:create');
  if (!r.ok) return toast(r.error || 'Could not create a party', 'error');
  session.set({ code: r.code, token: r.token, role: 'host' });
  sfx.join();
  startApp('host', r.state);
}

async function onJoin({ code, name, character }) {
  const r = await net.request('player:join', { code, name, character });
  if (!r.ok) return r.error || 'Could not join';
  session.set({ code: r.code, token: r.token, role: 'player' });
  prefs.set('name', name);
  sfx.join();
  startApp('player', r.state);
  return null;
}

// ---------------------------------------------------------------- connection
const conn = document.getElementById('conn');
let firstConnect = true;

// A join link for a different room beats an old saved session.
const linkCode = new URLSearchParams(location.search).get('code');
if (linkCode && session.get() && session.get().code !== linkCode) session.clear();

socket.on('connect', async () => {
  conn.classList.add('hidden');
  await syncClock();
  const saved = session.get();
  if (saved) {
    const r = await net.request('session:resume', { code: saved.code, token: saved.token });
    if (r.ok) {
      if (!firstConnect) toast('Reconnected!', 'good', 1500);
      firstConnect = false;
      startApp(r.role, r.state);
      return;
    }
    session.clear();
    if (app) leaveApp('That party has ended.');
  }
  firstConnect = false;
  if (!app && !onHome) goHome(new URLSearchParams(location.search).get('code'));
});

socket.on('disconnect', () => {
  if (app) conn.classList.remove('hidden');
});

socket.on('kicked', ({ reason } = {}) => leaveApp(reason || 'You were removed from the party.'));
socket.on('closed', () => leaveApp('The host closed the party.'));
socket.on('replaced', () => {
  app?.destroy();
  app = null;
  onHome = false;
  show(
    h('div', { class: 'center-screen' },
      h('div', { class: 'card big-msg' },
        h('div', { class: 'empty-icon' }, icon('phone')),
        h('h2', null, 'Opened somewhere else'),
        h('p', null, 'This party is now open in another tab or device.'),
        h('button', { class: 'btn btn-primary', onclick: () => location.reload() }, 'Use it here instead')
      )
    )
  );
});

// Show something instantly while the socket connects.
if (session.get()) {
  show(h('div', { class: 'center-screen' }, h('div', { class: 'loader-logo' }, 'PARTY', h('br'), 'PANIC'), h('p', { class: 'muted pulse' }, 'Rejoining your party…')));
} else {
  goHome(new URLSearchParams(location.search).get('code'));
}

// Keep phones awake during play where supported.
let wakeLock = null;
async function keepAwake() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch { /* not allowed */ }
}
document.addEventListener('visibilitychange', keepAwake);
window.addEventListener('pointerdown', keepAwake, { once: true });

// Block pinch zoom / double tap zoom on iOS.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
