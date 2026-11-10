// The shared big-screen view: lobby, wheel, tutorial, live play, results,
// standings, podium and awards. Also shows reactions sent from phones.
import { net } from './net.js';
import { h, fill, show, toast, char, icon, countUp, Bag, ordinal } from './ui.js';
import { iconSvg } from './icons.js';
import { art } from './art.js';
import { quip } from './quips.js';
import { sfx, startMusic, stopMusic, isMuted, setMuted, musicOn, setMusic } from './sound.js';
import { fx } from './fx.js';
import { GAMES, GAME_IDS } from '/shared/games.js';
import { MODES, MODS, TEAMS, ROUND_OPTIONS, MAX_PLAYERS } from '/shared/config.js';
import { GAME_CLIENTS } from './games/index.js';

const MUSIC_PHASES = new Set(['lobby', 'wheel', 'tutorial', 'results', 'leaderboard', 'final']);

export class HostApp {
  constructor(state, leave) {
    this.role = 'host';
    this.leave = leave;
    this.players = new Map();
    this.bag = new Bag();
    this.screenBag = new Bag();
    this.joinBase = location.origin;
    this.renderedStateId = null;
    this.hooks = {};

    fetch('/api/info')
      .then((r) => r.json())
      .then((info) => { this.joinBase = info.joinBase || location.origin; this.hooks.joinInfo?.(); })
      .catch(() => {});

    [
      net.on('state', (s) => this.onState(s)),
      net.on('roster', (r) => this.onRoster(r)),
      net.on('settings', (s) => { this.state.settings = s; this.hooks.settings?.(s); }),
      net.on('ready', (ids) => this.hooks.ready?.(ids)),
      net.on('progress', (p) => this.hooks.progress?.(p)),
      net.on('g:host', (m) => this.hooks.gameMsg?.(m)),
      net.on('endsAt', (t) => { this.state.endsAt = t; }),
      net.on('react', (m) => this.showReaction(m)),
    ].forEach((f) => this.bag.add(f));

    this.reactLayer = h('div', { class: 'react-layer', 'aria-hidden': 'true' });
    this.controls = this.buildControls();
    document.body.append(this.controls, this.reactLayer);
    document.body.classList.add('is-host');
    this.bag.add(() => {
      this.controls.remove();
      this.reactLayer.remove();
      document.body.classList.remove('is-host');
      document.body.style.removeProperty('--theme');
    });
    this.onState(state);
  }

  destroy() {
    this.screenBag.run();
    this.bag.run();
    stopMusic();
  }

  // ------------------------------------------------------------ state

  p(id) { return this.players.get(id) || { id, name: '???', character: 'dee-0' }; }

  onRoster(list) {
    const before = new Set(this.players.keys());
    this.players = new Map(list.map((p) => [p.id, p]));
    this.state.players = list;
    this.hooks.roster?.(list, list.filter((p) => !before.has(p.id)));
  }

  onState(s, force = false) {
    this.state = s;
    this.players = new Map(s.players.map((p) => [p.id, p]));
    this.updateControls();
    if (!force && s.stateId === this.renderedStateId) {
      this.hooks.roster?.(s.players, []);
      return;
    }
    this.renderedStateId = s.stateId;
    if (MUSIC_PHASES.has(s.phase)) startMusic(); else stopMusic();
    this.render();
  }

  render() {
    this.screenBag.run();
    const bag = new Bag();
    this.screenBag = bag;
    this.hooks = { joinInfo: this.hooks.joinInfo };
    const s = this.state;
    const gameId = s.data?.gameId;
    document.body.style.setProperty('--theme', gameId && s.phase !== 'leaderboard' ? GAMES[gameId].color : '#9b6bff');
    const renderers = {
      lobby: () => this.renderLobby(),
      wheel: () => this.renderWheel(),
      tutorial: () => this.renderTutorial(),
      countdown: () => this.renderCountdown(),
      playing: () => this.renderPlaying(),
      results: () => this.renderResults(),
      leaderboard: () => this.renderLeaderboard(),
      final: () => this.renderFinal(),
    };
    const screen = (renderers[s.phase] || renderers.lobby)();
    show(screen, () => bag.run());
  }

  action(action, payload) {
    return net.request('host:action', { action, payload });
  }

  hostLine(text) {
    return h('div', { class: 'host-line' }, icon('megaphone'), h('span', null, text));
  }

  // ------------------------------------------------------------ controls

  buildControls() {
    const sound = h('button', { class: 'ctl', title: 'Sound effects' });
    const music = h('button', { class: 'ctl', title: 'Music' });
    const refresh = () => {
      fill(sound, icon(isMuted() ? 'mute' : 'sound'));
      fill(music, icon('music'));
      music.classList.toggle('off', !musicOn());
      sound.classList.toggle('off', isMuted());
    };
    sound.onclick = () => { setMuted(!isMuted()); refresh(); };
    music.onclick = () => {
      setMusic(!musicOn());
      if (musicOn() && MUSIC_PHASES.has(this.state.phase)) startMusic();
      refresh();
    };
    refresh();
    this.codeChip = h('div', { class: 'ctl-code' });
    this.skipBtn = h('button', { class: 'ctl ctl-text', title: 'Skip ahead' }, icon('skip'), 'Skip');
    this.skipBtn.onclick = () => { sfx.click(); this.action('skip'); };
    this.endBtn = h('button', { class: 'ctl ctl-text', title: 'End the game now' }, icon('flag'), 'End');
    this.endBtn.onclick = () => { if (confirm('End the game now and go to the podium?')) this.action('end'); };
    const fs = h('button', { class: 'ctl', title: 'Fullscreen' }, icon('fullscreen'));
    fs.onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => {});
    };
    return h('div', { class: 'host-controls' }, this.codeChip, this.skipBtn, this.endBtn, sound, music, fs);
  }

  updateControls() {
    const s = this.state;
    fill(this.codeChip, h('small', null, 'Room'), s.code);
    const midGame = !['lobby', 'final'].includes(s.phase);
    this.skipBtn.classList.toggle('hidden', !midGame);
    this.endBtn.classList.toggle('hidden', !midGame);
    this.codeChip.classList.toggle('hidden', s.phase === 'lobby');
  }

  // ------------------------------------------------------------ reactions

  showReaction({ id, r }) {
    const layer = this.reactLayer;
    if (layer.childElementCount > 40) return;
    const p = this.p(id);
    if (r === 'tomato') {
      const x = 12 + Math.random() * 76;
      const y = 18 + Math.random() * 55;
      const el = h('div', { class: 'react-tomato', style: { left: `${x}%`, top: `${y}%`, '--rot': `${Math.random() * 60 - 30}deg` } }, art('tomato'));
      layer.append(el);
      sfx.whoosh();
      setTimeout(() => {
        fill(el, art('splat'), h('span', { class: 'react-by' }, p.name));
        el.classList.add('splat');
        sfx.splat();
      }, 420);
      setTimeout(() => el.classList.add('fade'), 2400);
      setTimeout(() => el.remove(), 3000);
      return;
    }
    const el = h('div', { class: 'react-sticker', style: { left: `${4 + Math.random() * 88}%`, '--drift': `${Math.random() * 80 - 40}px` } },
      art(r), char(p.character, { size: 34, class: 'react-face' }));
    layer.append(el);
    sfx.pop();
    setTimeout(() => el.remove(), 2800);
  }

  // ------------------------------------------------------------ lobby

  renderLobby() {
    const s = this.state;
    const bag = this.screenBag;

    const url = h('div', { class: 'join-url' });
    const qr = h('img', { class: 'qr', alt: 'QR code to join' });
    const updateJoin = () => {
      url.textContent = this.joinBase.replace(/^https?:\/\//, '');
      qr.src = `/api/qr.svg?d=${encodeURIComponent(`${this.joinBase}/?code=${s.code}`)}`;
    };
    this.hooks.joinInfo = updateJoin;
    updateJoin();
    const joinPanel = h('section', { class: 'lobby-join card' },
      h('div', { class: 'eyebrow' }, 'Join on your phone'),
      qr,
      url,
      h('div', { class: 'eyebrow' }, 'Room code'),
      h('div', { class: 'room-code' }, [...s.code].map((d, i) => h('span', { style: { animationDelay: `${i * 0.06}s` } }, d))));

    const count = h('span', { class: 'count-pill' });
    const grid = h('div', { class: 'lobby-grid' });
    const empty = h('div', { class: 'lobby-empty' },
      h('div', { class: 'empty-icon' }, icon('phone')),
      h('p', { class: 'big' }, 'Waiting for players'),
      h('p', { class: 'muted' }, 'Scan the code or go to the address on the left.'));
    const cards = new Map();
    const renderPlayers = (list, joined = []) => {
      count.textContent = `${list.length}/${MAX_PLAYERS}`;
      empty.classList.toggle('hidden', list.length > 0);
      const ids = new Set(list.map((p) => p.id));
      for (const [id, el] of cards) if (!ids.has(id)) { el.classList.add('pop-out'); setTimeout(() => el.remove(), 300); cards.delete(id); }
      list.forEach((p, i) => {
        let el = cards.get(p.id);
        const fresh = !el;
        if (!el) {
          el = h('div', { class: 'lobby-player pop-in' });
          cards.set(p.id, el);
          grid.append(el);
        }
        if (el.dataset.c !== p.character || el.dataset.n !== p.name) {
          el.dataset.c = p.character;
          el.dataset.n = p.name;
          fill(el,
            char(p.character, { size: 92, class: 'idle-bob' }),
            h('div', { class: 'lp-name' }, p.name),
            h('button', {
              class: 'kick', title: `Remove ${p.name}`,
              onclick: () => { if (confirm(`Remove ${p.name} from the party?`)) this.action('kick', { id: p.id }); },
            }, icon('close')));
          el.firstChild.style.animationDelay = `${-(i % 5) * 0.4}s`;
          if (!fresh) { el.firstChild.classList.add('swap-in'); sfx.pop(); }
        }
        el.classList.toggle('offline', !p.connected);
        if (fresh && joined.some((j) => j.id === p.id)) { sfx.join(); fx.burstAt(el, { count: 16 }); }
      });
      this.hooks.updateStart?.();
    };
    this.hooks.roster = renderPlayers;

    const playersPanel = h('section', { class: 'lobby-players' },
      h('div', { class: 'panel-title' }, h('h2', null, 'Players'), count),
      empty,
      grid,
      this.hostLine(quip('lobby')));

    const settingsPanel = h('section', { class: 'lobby-settings card' });
    const startBtn = h('button', { class: 'btn btn-primary btn-xl start-btn' });
    startBtn.onclick = async () => {
      sfx.click();
      startBtn.disabled = true;
      const r = await this.action('start');
      if (!r.ok) { toast(r.error || 'Could not start', 'error'); startBtn.disabled = false; }
    };
    const renderSettings = () => {
      const st = this.state.settings;
      const set = (patch) => {
        sfx.click();
        Object.assign(this.state.settings, patch);
        net.emit('host:settings', this.state.settings);
        renderSettings();
      };
      const seg = (opts, value, fn, fmt = (v) => v) =>
        h('div', { class: 'seg' }, opts.map((o) => h('button', { class: value === o ? 'on' : '', onclick: () => fn(o) }, fmt(o))));
      fill(settingsPanel,
        h('div', { class: 'set-label' }, 'Game mode'),
        h('div', { class: 'mode-tiles' },
          Object.values(MODES).map((m) =>
            h('button', { class: `mode-tile ${st.mode === m.id ? 'on' : ''}`, onclick: () => set({ mode: m.id }) }, icon(m.icon), h('span', null, m.name)))),
        h('p', { class: 'mode-desc' }, MODES[st.mode].desc),
        st.mode === 'teams' ? [h('div', { class: 'set-label' }, 'Teams'), seg([2, 3, 4], st.teams, (v) => set({ teams: v }), (v) => `${v} teams`)] : null,
        h('div', { class: 'set-label' }, 'Rounds'),
        seg(ROUND_OPTIONS, st.rounds, (v) => set({ rounds: v })),
        h('div', { class: 'set-label row' }, `Minigames · ${st.games.length} of ${GAME_IDS.length}`,
          h('button', { class: 'btn-link small', onclick: () => set({ games: [...GAME_IDS] }) }, 'Select all')),
        h('div', { class: 'game-toggles' },
          GAME_IDS.map((id) => {
            const g = GAMES[id];
            const on = st.games.includes(id);
            return h('button', {
              class: `game-toggle ${on ? 'on' : ''}`,
              style: { '--c': g.color },
              onclick: () => {
                const games = on ? st.games.filter((x) => x !== id) : [...st.games, id];
                if (!games.length) return toast('Keep at least one minigame.', 'error');
                set({ games });
              },
            }, h('span', { class: 'gt-icon' }, icon(g.icon)), g.name);
          })),
        startBtn);
    };
    this.hooks.updateStart = () => {
      const n = this.state.players.length;
      startBtn.disabled = n < 1;
      fill(startBtn, n < 1 ? 'Waiting for players' : ['Start game', h('span', { class: 'btn-count' }, n)]);
    };
    this.hooks.settings = renderSettings;
    renderSettings();
    renderPlayers(s.players);

    const close = h('button', { class: 'btn-link' }, 'Close party');
    close.onclick = async () => {
      if (!confirm('Close this party? Everyone will be disconnected.')) return;
      await this.action('close');
      this.leave('Party closed.');
    };
    bag.add(() => { delete this.hooks.updateStart; });

    return h('div', { class: 'host host-lobby' },
      h('header', { class: 'host-head' }, h('div', { class: 'mini-logo' }, 'PARTY', h('span', null, 'PANIC')), close),
      h('div', { class: 'lobby-cols' }, joinPanel, playersPanel, settingsPanel));
  }

  // ------------------------------------------------------------ wheel

  renderWheel() {
    const d = this.state.data;
    const bag = this.screenBag;
    const options = d.options;
    const n = options.length;
    const seg = 360 / n;
    const R = 96;
    const rad = (deg) => ((deg - 90) * Math.PI) / 180;
    const xy = (deg, r) => [Math.cos(rad(deg)) * r, Math.sin(rad(deg)) * r].map((v) => v.toFixed(2));
    let svg = '';
    options.forEach((id, i) => {
      const g = GAMES[id];
      const a0 = i * seg;
      const a1 = a0 + seg;
      const mid = a0 + seg / 2;
      const [x0, y0] = xy(a0, R);
      const [x1, y1] = xy(a1, R);
      const wedge = `M0 0 L${x0} ${y0} A${R} ${R} 0 ${seg > 180 ? 1 : 0} 1 ${x1} ${y1} Z`;
      svg += `<path d="${wedge}" fill="${g.color}" stroke="#1b1530" stroke-width="2"/>`;
      if (i % 2) svg += `<path d="${wedge}" fill="rgba(255,255,255,.14)"/>`;
      const icn = iconSvg(g.icon).replace('<svg ', '<svg x="-8" y="-8" width="16" height="16" ');
      svg += `<g transform="rotate(${mid}) translate(0 -34)" color="#fff"><g transform="rotate(${-mid})">${icn}</g></g>`;
      const label = n > 6 ? g.name.split(' ').slice(-1)[0] : g.name;
      svg += `<g transform="rotate(${mid - 90})"><text x="89" y="0" text-anchor="end" dominant-baseline="central" class="wheel-label">${label.toUpperCase()}</text></g>`;
    });
    let pegs = '';
    for (let i = 0; i < n * 2; i++) {
      const [x, y] = xy(i * (seg / 2), R - 3);
      pegs += `<circle cx="${x}" cy="${y}" r="2.2" fill="${i % 2 ? '#ffc23d' : '#fff6e6'}" stroke="#1b1530" stroke-width="1"/>`;
    }
    const wheel = h('div', { class: 'wheel-stage' });
    wheel.innerHTML =
      `<svg viewBox="-104 -104 208 208" class="wheel-svg"><circle r="102" fill="#1b1530"/><g class="wheel-rot">${svg}${pegs}</g>` +
      `<circle r="17" fill="#fff6e6" stroke="#1b1530" stroke-width="3"/><text class="wheel-hub" text-anchor="middle" dominant-baseline="central" y="1">?</text></svg>`;
    wheel.append(h('div', { class: 'wheel-pointer' }));
    const rot = wheel.querySelector('.wheel-rot');

    const norm = (a) => ((a % 360) + 360) % 360;
    const target = 360 * 6 + norm(-(d.result + 0.5) * seg + (Math.random() - 0.5) * seg * 0.6);
    const spinMs = d.spinMs || 4600;
    const startT = performance.now();
    let lastSeg = -1;
    let landed = false;

    const side = h('div', { class: 'wheel-side' });
    const land = () => {
      const g = GAMES[d.gameId];
      sfx.great();
      fx.burstAt(wheel, { count: 50, speed: 11 });
      wheel.classList.add('landed');
      side.append(
        h('div', { class: 'game-card', style: { '--c': g.color } },
          h('div', { class: 'gc-icon' }, icon(g.icon)),
          h('div', { class: 'gc-eyebrow' }, 'Next up'),
          h('div', { class: 'gc-name' }, g.name),
          h('div', { class: 'gc-tag' }, g.tagline)));
      if (d.mods?.length) {
        bag.timeout(() => {
          sfx.whoosh();
          side.append(
            h('div', { class: 'chaos-title' }, icon('bolt'), 'Chaos twists'),
            ...d.mods.map((id, i) => {
              const m = MODS[id];
              const golden = id === 'golden' && d.modData?.golden
                ? h('div', { class: 'mod-target' }, char(this.p(d.modData.golden).character, { size: 36, crown: true }), this.p(d.modData.golden).name)
                : null;
              return h('div', { class: 'mod-card', style: { animationDelay: `${i * 0.25}s` } },
                h('div', { class: 'mod-icon' }, icon(m.icon)),
                h('div', null, h('div', { class: 'mod-name' }, m.name), h('div', { class: 'mod-desc' }, m.desc), golden));
            }));
        }, 900);
      }
    };
    bag.raf((t) => {
      const k = Math.min(1, (t - startT) / spinMs);
      const e = 1 - Math.pow(1 - k, 4);
      const r = target * e;
      rot.setAttribute('transform', `rotate(${r.toFixed(2)})`);
      const cur = Math.floor(norm(r + seg / 2) / seg);
      if (cur !== lastSeg) { if (lastSeg !== -1 && k < 1) sfx.tick(); lastSeg = cur; }
      if (k >= 1 && !landed) { landed = true; land(); }
    });

    return h('div', { class: 'host host-wheel' },
      h('div', { class: 'round-tag' }, `Round ${this.state.round} of ${this.state.totalRounds}`),
      d.isFinal ? h('div', { class: 'final-banner' }, d.finalDouble ? 'Final round · double points' : 'Final round') : null,
      h('div', { class: 'wheel-wrap' }, wheel, side),
      this.hostLine(quip(d.isFinal ? 'wheelFinal' : 'wheel')));
  }

  // ------------------------------------------------------------ tutorial

  modBadges(mods, modData) {
    if (!mods?.length) return null;
    return h('div', { class: 'mod-badges' },
      mods.map((id) => {
        const m = MODS[id];
        const who = id === 'golden' && modData?.golden ? ` · ${this.p(modData.golden).name}` : '';
        return h('span', { class: 'mod-badge' }, icon(m.icon), m.name + who);
      }));
  }

  timerBar(bag, cls = '') {
    const fillEl = h('div', { class: 'tb-fill' });
    const el = h('div', { class: `timer-bar ${cls}` }, fillEl);
    const total = Math.max(1, this.state.endsAt - net.now());
    bag.raf(() => {
      fillEl.style.transform = `scaleX(${Math.max(0, this.state.endsAt - net.now()) / total})`;
    });
    return el;
  }

  renderTutorial() {
    const d = this.state.data;
    const g = GAMES[d.gameId];
    const bag = this.screenBag;
    const readyRow = h('div', { class: 'ready-row' });
    const readyCount = h('div', { class: 'ready-count' });
    let lastReady = d.ready || [];
    const renderReady = (ids) => {
      const ready = new Set(ids || []);
      const parts = this.state.players.filter((p) => p.alive && !p.left);
      readyCount.textContent = `${parts.filter((p) => ready.has(p.id)).length} of ${parts.length} ready`;
      fill(readyRow, parts.map((p) =>
        h('div', { class: `ready-av ${ready.has(p.id) ? 'is-ready' : ''} ${p.connected ? '' : 'offline'}` },
          char(p.character, { size: 54, mood: ready.has(p.id) ? 'happy' : 'idle' }), h('span', { class: 'check' }, icon('check')))));
    };
    this.hooks.ready = (ids) => {
      if (ids.length > lastReady.length) sfx.pop();
      lastReady = ids;
      renderReady(ids);
    };
    this.hooks.roster = () => renderReady(lastReady);
    renderReady(lastReady);

    const demo = GAME_CLIENTS[d.gameId]?.demo?.() || null;
    return h('div', { class: 'host host-tutorial', style: { '--c': g.color } },
      h('div', { class: 'round-tag' }, `Round ${this.state.round} of ${this.state.totalRounds}`),
      d.isFinal ? h('div', { class: 'final-banner' }, d.finalDouble ? 'Final round · double points' : 'Final round') : null,
      h('div', { class: 'tut-card card' },
        h('div', { class: 'tut-head' },
          h('div', { class: 'tut-icon' }, icon(g.icon)),
          h('div', null, h('h1', { class: 'tut-name' }, g.name), h('div', { class: 'tut-tag' }, g.tagline))),
        h('div', { class: 'tut-body' },
          h('ol', { class: 'tut-steps' }, g.howTo.map((line, i) => h('li', { style: { animationDelay: `${0.2 + i * 0.22}s` } }, line))),
          h('div', { class: 'tut-demo' }, demo, h('div', { class: 'control-chip' }, icon('phone'), g.control))),
        this.modBadges(d.mods, d.modData)),
      h('div', { class: 'tut-foot' }, readyCount, readyRow, this.timerBar(bag)),
      this.hostLine(quip('tutorial')));
  }

  // ------------------------------------------------------------ countdown

  renderCountdown() {
    const g = GAMES[this.state.data.gameId];
    const num = h('div', { class: 'count-num' });
    let last = null;
    this.screenBag.raf(() => {
      const left = this.state.endsAt - net.now();
      const v = left > 2500 ? '3' : left > 1500 ? '2' : left > 500 ? '1' : 'GO';
      if (v !== last) {
        last = v;
        num.textContent = v;
        num.classList.remove('pop');
        void num.offsetWidth;
        num.classList.add('pop');
        if (v === 'GO') sfx.go(); else sfx.beep();
      }
    });
    return h('div', { class: 'host host-countdown', style: { '--c': g.color } },
      h('div', { class: 'count-game' }, icon(g.icon), g.name),
      num,
      h('div', { class: 'count-hint' }, 'Eyes on your phones'));
  }

  // ------------------------------------------------------------ playing

  renderPlaying() {
    const s = this.state;
    const d = s.data;
    const g = GAMES[d.gameId];
    const bag = this.screenBag;

    const secs = h('div', { class: 'big-timer' });
    let lastSec = null;
    bag.raf(() => {
      const sec = Math.ceil(Math.max(0, s.endsAt - net.now()) / 1000);
      if (sec !== lastSec) {
        lastSec = sec;
        secs.textContent = sec;
        secs.classList.toggle('urgent', sec <= 5);
        if (sec <= 5 && sec > 0) sfx.tick();
      }
    });

    const body = h('div', { class: 'play-body' });
    const parts = s.players.filter((p) => p.alive && !p.left);
    const client = GAME_CLIENTS[d.gameId];
    let custom = null;
    if (client?.host) {
      const view = h('div', { class: 'host-view' });
      body.append(view);
      custom = client.host({ root: view, init: s.game?.host, now: net.now, sfx, fx, bag, players: parts, p: (id) => this.p(id), endsAt: () => this.state.endsAt });
    }
    if (custom?.full) {
      this.hooks.progress = (p) => custom.progress?.(p);
      if (s.game?.progress) bag.timeout(() => custom.progress?.(s.game.progress), 30);
    } else {
      const board = this.raceBoard(parts, bag);
      body.append(board.el);
      this.hooks.progress = (p) => { board.update(p); custom?.progress?.(p); };
      bag.timeout(() => board.update(s.game?.progress || {}), 50);
    }
    this.hooks.gameMsg = (m) => custom?.msg?.(m);

    return h('div', { class: 'host host-playing', style: { '--c': g.color } },
      h('header', { class: 'play-head' },
        h('div', { class: 'ph-icon' }, icon(g.icon)),
        h('div', { class: 'ph-text' }, h('div', { class: 'ph-name' }, g.name), h('div', { class: 'ph-round' }, `Round ${s.round} of ${s.totalRounds}`)),
        this.modBadges(d.mods, d.modData),
        secs),
      this.timerBar(bag, 'thin'),
      body);
  }

  raceBoard(parts, bag) {
    const el = h('div', { class: 'race' });
    const rows = new Map();
    for (const p of parts) {
      const fillEl = h('div', { class: 'race-fill' });
      const label = h('div', { class: 'race-label' });
      const rank = h('div', { class: 'race-rank' });
      const team = p.team != null ? TEAMS[p.team] : null;
      const row = h('div', { class: 'race-row', style: team ? { '--team': team.color } : null },
        rank, char(p.character, { size: 40 }), h('div', { class: 'race-name' }, p.name), h('div', { class: 'race-track' }, fillEl), label);
      rows.set(p.id, { row, fillEl, label, rank, v: 0, last: 0, f: null });
      el.append(row);
    }
    const update = (progress = {}) => {
      const list = [...rows.entries()].map(([id, r]) => {
        const pr = progress[id];
        if (pr) { r.v = pr.v; r.f = pr.f ?? null; r.label.textContent = pr.label; }
        return { id, r };
      });
      list.sort((a, b) => b.r.v - a.r.v);
      const max = Math.max(1, ...list.map((x) => x.r.v));
      const cols = list.length > 10 ? 2 : 1;
      const perCol = Math.ceil(list.length / cols);
      const rowH = Math.min(66, Math.max(36, (el.clientHeight || innerHeight * 0.7) / perCol));
      el.style.setProperty('--row-h', `${rowH}px`);
      list.forEach(({ id, r }, i) => {
        const col = Math.floor(i / perCol);
        r.row.style.transform = `translate(${col * 100}%, ${(i % perCol) * rowH}px)`;
        r.row.style.width = `${100 / cols}%`;
        r.fillEl.style.transform = `scaleX(${Math.max(0.02, Math.min(1, r.f ?? r.v / max))})`;
        r.rank.textContent = i + 1;
        if (r.v > r.last) { r.row.classList.remove('bump'); void r.row.offsetWidth; r.row.classList.add('bump'); }
        r.last = r.v;
        r.row.classList.toggle('offline', !this.p(id).connected);
      });
    };
    bag.listen(window, 'resize', () => update());
    return { el, update };
  }

  // ------------------------------------------------------------ results

  renderResults() {
    const d = this.state.data;
    const g = GAMES[d.gameId];
    const bag = this.screenBag;
    const rows = d.rows || [];
    const n = rows.length;
    const list = h('div', { class: `results-list ${n > 8 ? 'two-col' : ''}`, style: { '--rows': Math.ceil(n / 2) } });
    const delayOf = (i) => 0.2 + (n - 1 - i) * 0.1;
    rows.forEach((r, i) => {
      const p = this.p(r.id);
      const mood = r.rank === 1 && r.points > 0 ? 'happy' : i === n - 1 && n > 2 ? 'sad' : 'idle';
      const pts = h('span', { class: 'res-pts' }, '+0');
      const place = r.points <= 0 ? '–' : r.rank <= 3 ? h('span', { class: `medal m${r.rank}` }, r.rank) : ordinal(r.rank);
      const el = h('div', { class: `res-row ${r.perfect ? 'perfect' : ''} ${r.rank === 1 && r.points > 0 ? 'first' : ''}`, style: { animationDelay: `${delayOf(i)}s` } },
        h('div', { class: 'res-rank' }, place),
        char(p.character, { size: 46, mood }),
        h('div', { class: 'res-name' }, p.name, r.perfect ? h('span', { class: 'perfect-badge' }, icon('sparkle'), 'Perfect') : null),
        h('div', { class: 'res-label' }, r.label),
        h('div', { class: 'res-tags' }, (r.tags || []).map((t) => h('span', { class: 'tag' }, t))),
        pts);
      list.append(el);
      bag.timeout(() => {
        countUp(pts, 0, r.points, 700, '+');
        if (r.perfect) { fx.burstAt(el, { count: 34, colors: ['#ffc23d', '#fff6e6', '#ff6fae'] }); sfx.ding(); }
        else if (i === 0) sfx.great();
        else sfx.pop();
      }, delayOf(i) * 1000 + 300);
    });

    const events = (d.events || []).map((e) => {
      if (e.type === 'heist') return h('div', { class: 'event-banner' }, icon('bag'), `${this.p(e.to).name} stole ${e.amount} points from ${this.p(e.from).name}`);
      if (e.type === 'golden') return h('div', { class: 'event-banner' }, icon('crown'), `${this.p(e.id).name} was the Golden Player`);
      return null;
    });
    const winner = rows[0] && rows[0].points > 0 ? this.p(rows[0].id) : null;
    if (winner) bag.timeout(() => fx.confetti(50), delayOf(0) * 1000 + 400);

    return h('div', { class: 'host host-results', style: { '--c': g.color } },
      h('h1', { class: 'screen-title' }, icon(g.icon), 'Round results'),
      h('div', { class: 'events' }, events),
      list,
      winner ? this.hostLine(quip('results', { name: winner.name })) : null);
  }

  // ------------------------------------------------------------ leaderboard

  renderLeaderboard() {
    const s = this.state;
    const d = s.data;
    const bag = this.screenBag;
    const standings = d.standings || [];
    const n = standings.length;
    const cols = n > 10 ? 2 : 1;
    const perCol = Math.ceil(n / cols);
    const board = h('div', { class: 'lb-board' });
    const eliminated = new Set(d.eliminated || []);
    const elimMode = s.settings.mode === 'elimination';

    const place = (el, pos) => {
      const i = pos - 1;
      el.style.transform = `translate(calc(${Math.floor(i / perCol)} * (100% + 16px)), calc(${i % perCol} * var(--lb-row)))`;
    };
    const prevOrder = [...standings].sort((a, b) => a.prevRank - b.prevRank || a.rank - b.rank);
    const prevPos = new Map(prevOrder.map((x, i) => [x.id, i + 1]));
    const rowEls = standings.map((st, i) => {
      const p = this.p(st.id);
      const team = st.team != null ? TEAMS[st.team] : null;
      const score = h('div', { class: 'lb-score' }, (st.score - st.lastPoints).toLocaleString());
      const delta = h('div', { class: 'lb-delta' });
      const el = h('div', {
        class: `lb-row ${!st.alive && !eliminated.has(st.id) && elimMode ? 'out' : ''}`,
        style: { width: cols > 1 ? 'calc(50% - 8px)' : '100%', ...(team ? { '--team': team.color } : {}) },
      },
        h('div', { class: 'lb-rank' }, st.rank),
        char(p.character, { size: 44 }),
        h('div', { class: 'lb-name' }, p.name),
        delta,
        h('div', { class: 'lb-gain' }, st.lastPoints ? `+${st.lastPoints}` : ''),
        score);
      place(el, prevPos.get(st.id));
      board.append(el);
      return { st, el, score, delta, i };
    });

    bag.timeout(() => {
      sfx.whoosh();
      for (const r of rowEls) {
        place(r.el, r.i + 1);
        countUp(r.score, r.st.score - r.st.lastPoints, r.st.score, 1100);
        const diff = prevPos.get(r.st.id) - (r.i + 1);
        if (diff > 0) { fill(r.delta, icon('up'), diff); r.delta.className = 'lb-delta up'; }
        else if (diff < 0) { fill(r.delta, icon('down'), -diff); r.delta.className = 'lb-delta down'; }
      }
    }, 900);
    if (eliminated.size) {
      bag.timeout(() => {
        sfx.eliminated();
        for (const r of rowEls) if (eliminated.has(r.st.id)) { r.el.classList.add('eliminated'); fx.shake(r.el); }
      }, 2600);
    }

    const callouts = h('div', { class: 'callouts' });
    (d.events || []).filter((e) => e.type !== 'eliminated').forEach((e, i) => {
      bag.timeout(() => {
        let el = null;
        if (e.type === 'comeback') el = h('div', { class: 'callout' }, icon('rocket'), 'Comeback: ', h('b', null, this.p(e.id).name), ` climbs ${e.gain} places`);
        if (e.type === 'leader') el = h('div', { class: 'callout gold' }, icon('crown'), 'New leader: ', h('b', null, this.p(e.id).name));
        if (e.type === 'close') el = h('div', { class: 'callout' }, icon('fire'), 'Neck and neck: just ', h('b', null, e.gap), ' points in it');
        if (e.type === 'perfect') el = h('div', { class: 'callout' }, icon('sparkle'), 'Perfect: ', h('b', null, e.ids.map((id) => this.p(id).name).join(', ')));
        if (!el) return;
        callouts.append(el);
        sfx.ding();
      }, 2000 + i * 900);
    });
    if (eliminated.size) {
      bag.timeout(() => callouts.append(h('div', { class: 'callout red' }, icon('skull'), 'Eliminated: ', h('b', null, [...eliminated].map((id) => this.p(id).name).join(', ')))), 2700);
    }

    const teams = d.teams
      ? h('div', { class: 'team-board' },
        d.teams.map((t, i) => {
          const T = TEAMS[t.id];
          const max = Math.max(1, d.teams[0].score);
          const bar = h('div', { class: 'tb-bar-fill', style: { background: T.color } });
          bag.timeout(() => { bar.style.width = `${(t.score / max) * 100}%`; }, 400 + i * 150);
          return h('div', { class: 'team-row' },
            h('div', { class: 'team-name', style: { color: T.color } }, T.name),
            h('div', { class: 'tb-bar' }, bar),
            h('div', { class: 'team-score' }, t.score.toLocaleString(), h('small', null, ' avg')));
        }))
      : null;

    const remaining = s.totalRounds - s.round;
    const over = remaining <= 0 || (elimMode && standings.filter((x) => x.alive).length <= 1);
    const lbRow = Math.min(62, Math.max(36, (innerHeight * (teams ? 0.5 : 0.6)) / perCol));
    return h('div', { class: 'host host-leaderboard', style: { '--lb-row': `${lbRow}px` } },
      h('h1', { class: 'screen-title' }, icon('trophy'), 'Standings', h('span', { class: 'sub' }, `Round ${s.round} of ${s.totalRounds}`)),
      teams,
      h('div', { class: 'lb-wrap', style: { height: `${perCol * lbRow}px` } }, board),
      callouts,
      this.hostLine(over ? 'And the winner is…' : remaining === 1 ? 'Next up: the final round.' : quip(eliminated.size ? 'elimination' : 'standings')));
  }

  // ------------------------------------------------------------ final

  renderFinal() {
    const d = this.state.data;
    const bag = this.screenBag;
    const st = d.standings || [];
    const pod = d.podium || [];
    const teamWin = d.winnerTeam != null ? TEAMS[d.winnerTeam] : null;
    const byId = new Map(st.map((x) => [x.id, x]));

    const order = [1, 0, 2];
    const heights = ['76%', '56%', '40%'];
    const pillars = order.map((idx) => {
      const id = pod[idx];
      if (!id) return h('div', { class: 'pillar empty', style: { '--h': heights[idx] } });
      const p = this.p(id);
      return h('div', { class: `pillar p${idx + 1}`, style: { '--h': heights[idx] } },
        h('div', { class: 'pod-top' },
          char(p.character, { size: idx === 0 ? 156 : 112, mood: 'happy', crown: idx === 0 }),
          h('div', { class: 'pod-name' }, p.name),
          h('div', { class: 'pod-score' }, `${(byId.get(id)?.score ?? 0).toLocaleString()} pts`)),
        h('div', { class: 'pod-block' }, h('span', null, idx + 1)));
    });

    const title = h('h1', { class: 'final-title' }, teamWin ? `${teamWin.name} win!` : 'Champion!');
    const reveal = (idx, delay) => bag.timeout(() => {
      pillars[order.indexOf(idx)].classList.add('revealed');
      if (idx === 0) {
        sfx.crash();
        sfx.fanfare();
        fx.confetti(220);
        fx.fireworks(8);
        title.classList.add('show');
      } else sfx.pop();
    }, delay);
    reveal(2, 700);
    reveal(1, 1700);
    bag.timeout(() => sfx.drumroll(1.8), 2300);
    reveal(0, 4200);

    const awards = h('div', { class: 'awards' });
    (d.awards || []).forEach((a, i) => {
      bag.timeout(() => {
        const p = this.p(a.player);
        awards.append(h('div', { class: 'award-card' },
          h('div', { class: 'aw-icon' }, icon(a.icon)),
          char(p.character, { size: 52, mood: 'happy' }),
          h('div', { class: 'aw-text' }, h('div', { class: 'aw-title' }, a.title), h('div', { class: 'aw-name' }, p.name), h('div', { class: 'aw-desc' }, a.text))));
        sfx.ding();
      }, 6000 + i * 650);
    });

    const rest = h('div', { class: 'final-list' },
      st.slice(3).map((x) => {
        const p = this.p(x.id);
        return h('div', { class: 'fl-row' }, h('span', { class: 'fl-rank' }, ordinal(x.rank)), char(p.character, { size: 28 }), h('span', null, p.name), h('span', { class: 'fl-score' }, x.score));
      }));

    const teams = d.teams
      ? h('div', { class: 'final-teams' }, d.teams.map((t) => {
        const T = TEAMS[t.id];
        return h('div', { class: 'ft', style: { '--team': T.color } }, h('b', null, `${ordinal(t.rank)} · ${T.name}`), ` ${t.score} avg`);
      }))
      : null;

    const again = h('button', { class: 'btn btn-primary btn-lg' }, icon('refresh'), 'Play again');
    again.onclick = () => { sfx.click(); this.action('restart'); };
    const newParty = h('button', { class: 'btn btn-light btn-lg' }, 'New party');
    newParty.onclick = async () => {
      if (!confirm('Close this party and start a fresh one?')) return;
      await this.action('close');
      this.leave();
    };

    return h('div', { class: 'host host-final' },
      title,
      d.close ? h('div', { class: 'callout photo' }, icon('fire'), 'Photo finish. What a game.') : null,
      h('div', { class: 'podium' }, pillars),
      teams,
      awards,
      rest,
      h('div', { class: 'final-actions' }, again, newParty));
  }
}
