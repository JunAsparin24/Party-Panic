// The shared big-screen view: lobby, wheel, tutorial, live race, results,
// animated standings and the final podium.
import { net } from './net.js';
import { h, show, toast, avatar, countUp, Bag, ordinal } from './ui.js';
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

    const subs = [
      net.on('state', (s) => this.onState(s)),
      net.on('roster', (r) => this.onRoster(r)),
      net.on('settings', (s) => { this.state.settings = s; this.hooks.settings?.(s); }),
      net.on('ready', (ids) => this.hooks.ready?.(ids)),
      net.on('progress', (p) => this.hooks.progress?.(p)),
      net.on('g:host', (m) => this.hooks.gameMsg?.(m)),
      net.on('endsAt', (t) => { this.state.endsAt = t; }),
    ];
    subs.forEach((f) => this.bag.add(f));

    this.controls = this.buildControls();
    document.body.append(this.controls);
    document.body.classList.add('is-host');
    this.bag.add(() => { this.controls.remove(); document.body.classList.remove('is-host'); });
    this.onState(state);
  }

  destroy() {
    this.screenBag.run();
    this.bag.run();
    stopMusic();
  }

  // ------------------------------------------------------------ state

  p(id) { return this.players.get(id) || { id, name: '???', avatar: {} }; }

  setRoster(list) {
    this.players = new Map(list.map((p) => [p.id, p]));
  }

  onRoster(list) {
    const before = new Set(this.players.keys());
    this.setRoster(list);
    this.state.players = list;
    const joined = list.filter((p) => !before.has(p.id));
    this.hooks.roster?.(list, joined);
  }

  onState(s, force = false) {
    this.state = s;
    this.setRoster(s.players);
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
    // Each screen gets its own cleanup bag so the outgoing screen's cleanup
    // can never stop the incoming screen's animations.
    this.screenBag.run();
    const bag = new Bag();
    this.screenBag = bag;
    this.hooks = { joinInfo: this.hooks.joinInfo };
    const s = this.state;
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

  // ------------------------------------------------------------ controls

  buildControls() {
    const sound = h('button', { class: 'ctl', title: 'Sound effects' });
    const music = h('button', { class: 'ctl', title: 'Music' });
    const refresh = () => {
      sound.textContent = isMuted() ? '🔇' : '🔊';
      music.textContent = musicOn() ? '🎵' : '🎵̸';
      music.classList.toggle('off', !musicOn());
    };
    sound.onclick = () => { setMuted(!isMuted()); refresh(); };
    music.onclick = () => {
      setMusic(!musicOn());
      if (musicOn() && MUSIC_PHASES.has(this.state.phase)) startMusic();
      refresh();
    };
    refresh();
    this.codeChip = h('div', { class: 'ctl-code' });
    this.skipBtn = h('button', { class: 'ctl ctl-text', title: 'Skip ahead' }, '⏭ Skip');
    this.skipBtn.onclick = () => { sfx.click(); this.action('skip'); };
    this.endBtn = h('button', { class: 'ctl ctl-text', title: 'End the tournament now' }, '🏁 End');
    this.endBtn.onclick = () => {
      if (confirm('End the tournament now and go to the podium?')) this.action('end');
    };
    this.fsBtn = h('button', { class: 'ctl', title: 'Fullscreen' }, '⛶');
    this.fsBtn.onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => {});
    };
    return h('div', { class: 'host-controls' }, this.codeChip, this.skipBtn, this.endBtn, sound, music, this.fsBtn);
  }

  updateControls() {
    const s = this.state;
    this.codeChip.textContent = `Room ${s.code}`;
    const midGame = !['lobby', 'final'].includes(s.phase);
    this.skipBtn.classList.toggle('hidden', !midGame);
    this.endBtn.classList.toggle('hidden', !midGame);
    this.codeChip.classList.toggle('hidden', s.phase === 'lobby');
  }

  // ------------------------------------------------------------ lobby

  renderLobby() {
    const s = this.state;
    const bag = this.screenBag;

    // Join panel
    const url = h('div', { class: 'join-url' });
    const qr = h('img', { class: 'qr', alt: 'QR code to join' });
    const updateJoin = () => {
      const link = `${this.joinBase}/?code=${s.code}`;
      url.textContent = this.joinBase.replace(/^https?:\/\//, '');
      qr.src = `/api/qr.svg?d=${encodeURIComponent(link)}`;
    };
    this.hooks.joinInfo = updateJoin;
    updateJoin();
    const digits = h('div', { class: 'room-code' }, [...s.code].map((d, i) => h('span', { style: { animationDelay: `${i * 0.07}s` } }, d)));
    const joinPanel = h('section', { class: 'lobby-join card' },
      h('div', { class: 'eyebrow' }, 'Join on your phone'),
      url,
      qr,
      h('div', { class: 'eyebrow' }, 'Room code'),
      digits
    );

    // Players
    const count = h('span', { class: 'count-pill' });
    const grid = h('div', { class: 'lobby-grid' });
    const empty = h('div', { class: 'lobby-empty' },
      h('div', { class: 'emoji-xl bob' }, '📱'),
      h('p', null, 'Waiting for players…'),
      h('p', { class: 'muted' }, 'Scan the QR code or enter the room code to join!'));
    const cards = new Map();
    const renderPlayers = (list, joined = []) => {
      count.textContent = `${list.length}/${MAX_PLAYERS}`;
      empty.classList.toggle('hidden', list.length > 0);
      const ids = new Set(list.map((p) => p.id));
      for (const [id, el] of cards) if (!ids.has(id)) { el.classList.add('pop-out'); setTimeout(() => el.remove(), 300); cards.delete(id); }
      for (const p of list) {
        let el = cards.get(p.id);
        const fresh = !el;
        if (!el) {
          el = h('div', { class: 'lobby-player pop-in' });
          cards.set(p.id, el);
          grid.append(el);
        }
        el.replaceChildren(
          avatar(p.avatar, { size: 84, class: 'bob' }),
          h('div', { class: 'lp-name' }, p.name),
          h('button', {
            class: 'kick', title: `Remove ${p.name}`,
            onclick: () => { if (confirm(`Remove ${p.name} from the party?`)) this.action('kick', { id: p.id }); },
          }, '✕')
        );
        el.classList.toggle('offline', !p.connected);
        if (fresh && joined.some((j) => j.id === p.id)) { sfx.join(); fx.burstAt(el, { count: 18 }); }
      }
      this.hooks.updateStart?.();
    };
    this.hooks.roster = renderPlayers;

    const playersPanel = h('section', { class: 'lobby-players' },
      h('div', { class: 'panel-title' }, h('h2', null, 'Players'), count),
      empty,
      grid
    );

    // Settings
    const settingsPanel = h('section', { class: 'lobby-settings card' });
    const renderSettings = () => {
      const st = this.state.settings;
      const set = (patch) => {
        sfx.click();
        Object.assign(this.state.settings, patch);
        net.emit('host:settings', this.state.settings);
        renderSettings();
      };
      const modeTiles = h('div', { class: 'mode-tiles' },
        Object.values(MODES).map((m) =>
          h('button', { class: `mode-tile ${st.mode === m.id ? 'on' : ''}`, onclick: () => set({ mode: m.id }) },
            h('span', { class: 'mt-icon' }, m.icon),
            h('span', { class: 'mt-name' }, m.name)
          )
        )
      );
      const seg = (opts, value, fn, fmt = (v) => v) =>
        h('div', { class: 'seg' }, opts.map((o) => h('button', { class: value === o ? 'on' : '', onclick: () => fn(o) }, fmt(o))));
      const gameChips = h('div', { class: 'game-toggles' },
        GAME_IDS.map((id) => {
          const g = GAMES[id];
          const on = st.games.includes(id);
          return h('button', {
            class: `game-toggle ${on ? 'on' : ''}`,
            style: { '--c': g.color },
            onclick: () => {
              const games = on ? st.games.filter((x) => x !== id) : [...st.games, id];
              if (!games.length) return toast('Keep at least one minigame!', 'error');
              set({ games });
            },
          }, h('span', null, g.icon), g.name);
        })
      );
      settingsPanel.replaceChildren(...[
        h('div', { class: 'set-label' }, 'Game mode'),
        modeTiles,
        h('p', { class: 'mode-desc' }, MODES[st.mode].desc),
        st.mode === 'teams'
          ? [h('div', { class: 'set-label' }, 'Teams'), seg([2, 3, 4], st.teams, (v) => set({ teams: v }), (v) => `${v} teams`)]
          : null,
        h('div', { class: 'set-label' }, 'Rounds'),
        seg(ROUND_OPTIONS, st.rounds, (v) => set({ rounds: v })),
        h('div', { class: 'set-label row' }, `Minigames (${st.games.length}/${GAME_IDS.length})`,
          h('button', { class: 'btn-link small', onclick: () => set({ games: [...GAME_IDS] }) }, 'All')),
        gameChips,
        startBtn,
      ].flat().filter(Boolean));
    };
    const startBtn = h('button', { class: 'btn btn-green btn-xl start-btn' }, 'Start Game ▶');
    startBtn.onclick = async () => {
      sfx.click();
      startBtn.disabled = true;
      const r = await this.action('start');
      if (!r.ok) { toast(r.error || 'Could not start', 'error'); startBtn.disabled = false; }
    };
    this.hooks.updateStart = () => {
      const n = this.state.players.length;
      startBtn.disabled = n < 1;
      startBtn.textContent = n < 1 ? 'Waiting for players…' : `Start Game ▶ (${n})`;
    };
    this.hooks.settings = renderSettings;
    renderSettings();
    renderPlayers(s.players);

    const close = h('button', { class: 'btn-link close-party' }, 'Close party');
    close.onclick = async () => {
      if (!confirm('Close this party? Everyone will be disconnected.')) return;
      await this.action('close');
      this.leave('Party closed.');
    };

    bag.add(() => { delete this.hooks.updateStart; });
    return h('div', { class: 'host host-lobby' },
      h('header', { class: 'host-head' }, h('div', { class: 'mini-logo' }, 'PARTY ', h('span', null, 'PANIC')), close),
      h('div', { class: 'lobby-cols' }, joinPanel, playersPanel, settingsPanel)
    );
  }

  // ------------------------------------------------------------ wheel

  renderWheel() {
    const d = this.state.data;
    const bag = this.screenBag;
    const options = d.options;
    const n = options.length;
    const size = Math.round(Math.min(innerHeight * 0.74, innerWidth * 0.52));
    const dpr = Math.min(2, devicePixelRatio || 1);
    const canvas = h('canvas', { class: 'wheel-canvas', width: size * dpr, height: size * dpr, style: { width: `${size}px`, height: `${size}px` } });
    const ctx = canvas.getContext('2d');
    const seg = (Math.PI * 2) / n;
    const r = size / 2;

    const draw = (rot) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(r, r);
      for (let i = 0; i < n; i++) {
        const g = GAMES[options[i]];
        const a0 = -Math.PI / 2 + i * seg + rot;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r - 8, a0, a0 + seg);
        ctx.closePath();
        ctx.fillStyle = g.color;
        ctx.fill();
        if (i % 2) { ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill(); }
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#1d1140';
        ctx.stroke();
        ctx.save();
        ctx.rotate(a0 + seg / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const fs = Math.max(12, Math.min(r * 0.085, (seg * r * 0.55) / 1.6));
        ctx.font = `${fs}px "Lilita One", system-ui, sans-serif`;
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(29,17,64,.55)';
        ctx.fillStyle = '#fff';
        const label = n > 6 ? g.name.split(' ').slice(-1)[0] : g.name;
        ctx.strokeText(label, r - 26, 0);
        ctx.fillText(label, r - 26, 0);
        ctx.font = `${fs * 1.25}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(g.icon, r * 0.3, 0);
        ctx.restore();
      }
      // rim lights
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2 + rot * 0.5;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6), 4, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 ? '#ffd23f' : '#fff';
        ctx.fill();
      }
      ctx.restore();
    };

    const norm = (a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const target = Math.PI * 2 * 6 + norm(-(d.result + 0.5) * seg + jitter);
    const spinMs = d.spinMs || 4600;
    const startT = performance.now();
    let lastSeg = -1;
    let landed = false;

    const result = h('div', { class: 'wheel-result hidden' });
    const modsEl = h('div', { class: 'wheel-mods' });
    const finalBanner = d.isFinal
      ? h('div', { class: 'final-banner' }, '🔥 FINAL ROUND', d.finalDouble ? ' · DOUBLE POINTS 🔥' : ' 🔥')
      : null;

    bag.raf((t) => {
      const k = Math.min(1, (t - startT) / spinMs);
      const e = 1 - Math.pow(1 - k, 4);
      const rot = target * e;
      draw(rot);
      const curSeg = Math.floor(norm(-rot) / seg + 0.5 + n) % n;
      if (curSeg !== lastSeg) { if (lastSeg !== -1 && k < 1) sfx.tick(); lastSeg = curSeg; }
      if (k >= 1 && !landed) {
        landed = true;
        land();
      }
    });

    const land = () => {
      const g = GAMES[d.gameId];
      sfx.great();
      fx.burstAt(canvas, { count: 60, speed: 12 });
      canvas.classList.add('landed');
      result.replaceChildren(
        h('div', { class: 'wr-icon' }, g.icon),
        h('div', { class: 'wr-name' }, g.name),
        h('div', { class: 'wr-tag' }, g.tagline)
      );
      result.style.setProperty('--c', g.color);
      result.classList.remove('hidden');
      if (d.mods?.length) {
        bag.timeout(() => {
          sfx.whoosh();
          modsEl.replaceChildren(
            h('div', { class: 'chaos-title' }, '🌪️ CHAOS MODIFIERS'),
            ...d.mods.map((id, i) => {
              const m = MODS[id];
              const extra = id === 'golden' && d.modData?.golden
                ? h('div', { class: 'mod-golden' }, avatar(this.p(d.modData.golden).avatar, { size: 44, crown: true }), this.p(d.modData.golden).name)
                : null;
              return h('div', { class: 'mod-card', style: { animationDelay: `${i * 0.25}s` } },
                h('div', { class: 'mod-icon' }, m.icon), h('div', { class: 'mod-name' }, m.name), h('div', { class: 'mod-desc' }, m.desc), extra);
            })
          );
        }, 900);
      }
    };

    return h('div', { class: 'host host-wheel' },
      h('div', { class: 'round-tag' }, `Round ${this.state.round} of ${this.state.totalRounds}`),
      finalBanner,
      h('div', { class: 'wheel-wrap' },
        h('div', { class: 'wheel-stage' }, canvas, h('div', { class: 'wheel-pointer' }), h('div', { class: 'wheel-hub' }, '?')),
        h('div', { class: 'wheel-side' }, result, modsEl)
      )
    );
  }

  // ------------------------------------------------------------ tutorial

  modBadges(mods, modData) {
    if (!mods?.length) return null;
    return h('div', { class: 'mod-badges' },
      mods.map((id) => {
        const m = MODS[id];
        const who = id === 'golden' && modData?.golden ? ` (${this.p(modData.golden).name})` : '';
        return h('span', { class: 'mod-badge' }, m.icon, ' ', m.name, who);
      }));
  }

  timerBar(bag, cls = '') {
    const fill = h('div', { class: 'tb-fill' });
    const el = h('div', { class: `timer-bar ${cls}` }, fill);
    const total = Math.max(1, this.state.endsAt - net.now());
    bag.raf(() => {
      const left = Math.max(0, this.state.endsAt - net.now());
      fill.style.transform = `scaleX(${left / total})`;
    });
    return el;
  }

  renderTutorial() {
    const d = this.state.data;
    const g = GAMES[d.gameId];
    const bag = this.screenBag;
    const readyRow = h('div', { class: 'ready-row' });
    const readyCount = h('div', { class: 'ready-count' });
    const renderReady = (ids) => {
      const ready = new Set(ids || []);
      const parts = this.state.players.filter((p) => p.alive && !p.left);
      readyCount.textContent = `${parts.filter((p) => ready.has(p.id)).length}/${parts.length} ready`;
      readyRow.replaceChildren(
        ...parts.map((p) =>
          h('div', { class: `ready-av ${ready.has(p.id) ? 'is-ready' : ''} ${p.connected ? '' : 'offline'}` },
            avatar(p.avatar, { size: 52 }), h('span', { class: 'check' }, '✓')))
      );
    };
    let lastReady = d.ready || [];
    this.hooks.ready = (ids) => {
      if (ids.length > lastReady.length) sfx.pop();
      lastReady = ids;
      renderReady(ids);
    };
    this.hooks.roster = () => renderReady(lastReady);
    renderReady(lastReady);

    const demo = GAME_CLIENTS[d.gameId]?.demo?.() || h('div', { class: 'demo-phone' }, h('div', { class: 'demo-icon' }, g.icon));

    return h('div', { class: 'host host-tutorial', style: { '--c': g.color } },
      h('div', { class: 'round-tag' }, `Round ${this.state.round} of ${this.state.totalRounds}`),
      d.isFinal ? h('div', { class: 'final-banner' }, '🔥 FINAL ROUND', d.finalDouble ? ' · DOUBLE POINTS 🔥' : ' 🔥') : null,
      h('div', { class: 'tut-card card' },
        h('div', { class: 'tut-head' },
          h('div', { class: 'tut-icon' }, g.icon),
          h('div', null, h('h1', { class: 'tut-name' }, g.name), h('div', { class: 'tut-tag' }, g.tagline))
        ),
        h('div', { class: 'tut-body' },
          h('ol', { class: 'tut-steps' }, g.howTo.map((line, i) => h('li', { style: { animationDelay: `${0.2 + i * 0.25}s` } }, line))),
          h('div', { class: 'tut-demo' }, demo, h('div', { class: 'control-chip' }, '🎮 ', g.control))
        ),
        this.modBadges(d.mods, d.modData)
      ),
      h('div', { class: 'tut-foot' }, readyCount, readyRow, this.timerBar(bag))
    );
  }

  // ------------------------------------------------------------ countdown

  renderCountdown() {
    const d = this.state.data;
    const g = GAMES[d.gameId];
    const num = h('div', { class: 'count-num' });
    let last = null;
    this.screenBag.raf(() => {
      const left = this.state.endsAt - net.now();
      const v = left > 2500 ? '3' : left > 1500 ? '2' : left > 500 ? '1' : 'GO!';
      if (v !== last) {
        last = v;
        num.textContent = v;
        num.classList.remove('pop');
        void num.offsetWidth;
        num.classList.add('pop');
        if (v === 'GO!') sfx.go(); else sfx.beep();
      }
    });
    return h('div', { class: 'host host-countdown', style: { '--c': g.color } },
      h('div', { class: 'count-game' }, g.icon, ' ', g.name),
      num,
      h('div', { class: 'count-hint' }, 'Eyes on your phones!'));
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
      const left = Math.max(0, s.endsAt - net.now());
      const sec = Math.ceil(left / 1000);
      if (sec !== lastSec) {
        lastSec = sec;
        secs.textContent = sec;
        secs.classList.toggle('urgent', sec <= 5);
        if (sec <= 5 && sec > 0) sfx.tick();
      }
    });

    // Live race board
    const board = h('div', { class: 'race' });
    const rows = new Map();
    const parts = s.players.filter((p) => p.alive && !p.left);
    const ensureRow = (p) => {
      let row = rows.get(p.id);
      if (row) return row;
      const fill = h('div', { class: 'race-fill' });
      const label = h('div', { class: 'race-label' });
      const rank = h('div', { class: 'race-rank' });
      const team = p.team != null ? TEAMS[p.team] : null;
      const el = h('div', { class: 'race-row', style: team ? { '--team': team.color } : null },
        rank,
        avatar(p.avatar, { size: 40 }),
        h('div', { class: 'race-name' }, p.name),
        h('div', { class: 'race-track' }, fill),
        label);
      row = { el, fill, label, rank, v: 0, last: 0 };
      rows.set(p.id, row);
      board.append(el);
      return row;
    };
    parts.forEach(ensureRow);

    const layout = (progress = {}) => {
      const list = [...rows.entries()].map(([id, row]) => {
        const pr = progress[id];
        if (pr) { row.v = pr.v; row.f = pr.f; row.label.textContent = pr.label; }
        return { id, row };
      });
      list.sort((a, b) => b.row.v - a.row.v);
      const max = Math.max(1, ...list.map((x) => x.row.v));
      const n = list.length;
      const cols = n > 10 ? 2 : 1;
      const perCol = Math.ceil(n / cols);
      const rowH = Math.min(64, Math.max(34, (board.clientHeight || innerHeight * 0.7) / perCol));
      board.style.setProperty('--row-h', `${rowH}px`);
      list.forEach(({ id, row }, i) => {
        const col = Math.floor(i / perCol);
        const r = i % perCol;
        row.el.style.transform = `translate(${col * 100}%, ${r * rowH}px)`;
        row.el.style.width = `${100 / cols}%`;
        const frac = row.f != null ? row.f : row.v / max;
        row.fill.style.transform = `scaleX(${Math.max(0.02, Math.min(1, frac))})`;
        row.rank.textContent = i + 1;
        if (row.v > row.last) { row.el.classList.remove('bump'); void row.el.offsetWidth; row.el.classList.add('bump'); }
        row.last = row.v;
        const p = this.p(id);
        row.el.classList.toggle('offline', !p.connected);
      });
    };
    this.hooks.progress = layout;
    bag.timeout(() => layout(s.game?.progress || {}), 50);
    bag.listen(window, 'resize', () => layout());

    // Optional game-specific host visuals
    const extra = h('div', { class: 'host-extra' });
    const client = GAME_CLIENTS[d.gameId];
    if (client?.host) {
      const hostCtx = { root: extra, init: s.game?.host, now: net.now, sfx, fx, bag };
      const handler = client.host(hostCtx);
      this.hooks.gameMsg = (m) => handler?.(m);
    }

    return h('div', { class: 'host host-playing', style: { '--c': g.color } },
      h('header', { class: 'play-head' },
        h('div', { class: 'ph-game' }, h('span', { class: 'ph-icon' }, g.icon), h('div', null, h('div', { class: 'ph-name' }, g.name), h('div', { class: 'ph-round' }, `Round ${s.round}/${s.totalRounds}`))),
        this.modBadges(d.mods, d.modData),
        secs
      ),
      this.timerBar(bag, 'thin'),
      h('div', { class: 'play-body' }, extra, board)
    );
  }

  // ------------------------------------------------------------ results

  renderResults() {
    const d = this.state.data;
    const g = GAMES[d.gameId];
    const bag = this.screenBag;
    const rows = d.rows || [];
    const n = rows.length;
    const list = h('div', { class: `results-list ${n > 8 ? 'two-col' : ''}`, style: { '--rows': Math.ceil(n / 2) } });
    const medal = (r) => (r.points <= 0 ? '–' : r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : ordinal(r.rank));
    rows.forEach((r, i) => {
      const p = this.p(r.id);
      const mood = r.rank === 1 ? 'win' : r.rank <= 3 ? 'happy' : i === n - 1 && n > 2 ? 'sad' : undefined;
      const pts = h('span', { class: 'res-pts' }, '+0');
      const el = h('div', { class: `res-row ${r.perfect ? 'perfect' : ''}`, style: { animationDelay: `${0.15 + (n - 1 - i) * 0.12}s` } },
        h('div', { class: 'res-rank' }, medal(r)),
        avatar(p.avatar, { size: 46, mood }),
        h('div', { class: 'res-name' }, p.name, r.perfect ? h('span', { class: 'perfect-badge' }, '✨ PERFECT') : null),
        h('div', { class: 'res-label' }, r.label),
        h('div', { class: 'res-tags' }, (r.tags || []).map((t) => h('span', { class: 'tag' }, t))),
        pts);
      list.append(el);
      bag.timeout(() => {
        countUp(pts, 0, r.points, 700, '+');
        if (r.perfect) { fx.burstAt(el, { count: 40, colors: ['#ffd23f', '#fff', '#ff4f9a'] }); sfx.ding(); }
        else if (i === 0) sfx.great();
        else sfx.pop();
      }, (0.15 + (n - 1 - i) * 0.12) * 1000 + 350);
    });

    const events = (d.events || []).map((e) => {
      if (e.type === 'heist') return h('div', { class: 'event-banner heist' }, `💰 ${this.p(e.to).name} stole ${e.amount} points from ${this.p(e.from).name}!`);
      if (e.type === 'golden') return h('div', { class: 'event-banner golden' }, `👑 ${this.p(e.id).name} was the Golden Player!`);
      return null;
    });
    if (rows[0]) bag.timeout(() => fx.confetti(60), (0.15 + (n - 1) * 0.12) * 1000 + 400);

    return h('div', { class: 'host host-results', style: { '--c': g.color } },
      h('h1', { class: 'screen-title' }, g.icon, ' Round Results'),
      h('div', { class: 'events' }, events),
      list);
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
    const board = h('div', { class: 'lb-board', style: { '--cols': cols } });
    const eliminated = new Set(d.eliminated || []);
    const elimMode = s.settings.mode === 'elimination';

    const place = (el, rank) => {
      const i = rank - 1;
      const col = Math.floor(i / perCol);
      const r = i % perCol;
      el.style.transform = `translate(${col * 100}%, calc(${r} * var(--lb-row)))`;
    };

    // Ranks shown before this round, unique so rows never overlap.
    const prevOrder = [...standings].sort((a, b) => a.prevRank - b.prevRank || a.rank - b.rank);
    const prevPos = new Map(prevOrder.map((x, i) => [x.id, i + 1]));
    const rowEls = standings.map((st, i) => {
      const p = this.p(st.id);
      const team = st.team != null ? TEAMS[st.team] : null;
      const score = h('div', { class: 'lb-score' }, (st.score - st.lastPoints).toLocaleString());
      const delta = h('div', { class: 'lb-delta' });
      const el = h('div', {
        class: `lb-row ${!st.alive && !eliminated.has(st.id) && elimMode ? 'out' : ''}`,
        style: { width: `${100 / cols}%`, ...(team ? { '--team': team.color } : {}) },
      },
        h('div', { class: 'lb-rank' }, st.rank),
        avatar(p.avatar, { size: 44 }),
        h('div', { class: 'lb-name' }, p.name, team ? h('span', { class: 'team-dot', title: team.name }) : null),
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
        r.el.classList.add('moved');
        countUp(r.score, r.st.score - r.st.lastPoints, r.st.score, 1100);
        const diff = prevPos.get(r.st.id) - (r.i + 1);
        if (diff > 0) { r.delta.textContent = `▲${diff}`; r.delta.className = 'lb-delta up'; }
        else if (diff < 0) { r.delta.textContent = `▼${-diff}`; r.delta.className = 'lb-delta down'; }
      }
    }, 900);

    if (eliminated.size) {
      bag.timeout(() => {
        sfx.eliminated();
        for (const r of rowEls) if (eliminated.has(r.st.id)) { r.el.classList.add('eliminated'); fx.shake(r.el); }
      }, 2600);
    }

    // Callouts
    const callouts = h('div', { class: 'callouts' });
    const evs = (d.events || []).filter((e) => e.type !== 'eliminated');
    evs.forEach((e, i) => {
      bag.timeout(() => {
        let el = null;
        if (e.type === 'comeback') el = h('div', { class: 'callout comeback' }, '🚀 COMEBACK! ', h('b', null, this.p(e.id).name), ` climbs ${e.gain} places!`);
        if (e.type === 'leader') el = h('div', { class: 'callout leader' }, '👑 NEW LEADER: ', h('b', null, this.p(e.id).name));
        if (e.type === 'close') el = h('div', { class: 'callout close' }, '😱 NECK AND NECK! Only ', h('b', null, e.gap), ' points between 1st and 2nd!');
        if (e.type === 'perfect') el = h('div', { class: 'callout perfect' }, '✨ PERFECT: ', e.ids.map((id) => this.p(id).name).join(', '));
        if (!el) return;
        callouts.append(el);
        sfx.ding();
        fx.burstAt(el, { count: 24 });
      }, 2000 + i * 900);
    });
    if (eliminated.size) {
      bag.timeout(() => {
        callouts.append(h('div', { class: 'callout elim' }, '💀 ELIMINATED: ', [...eliminated].map((id) => this.p(id).name).join(', ')));
      }, 2700);
    }

    const teams = d.teams
      ? h('div', { class: 'team-board' },
        d.teams.map((t, i) => {
          const T = TEAMS[t.id];
          const max = Math.max(1, d.teams[0].score);
          const fill = h('div', { class: 'tb-bar-fill', style: { background: T.color } });
          bag.timeout(() => { fill.style.width = `${(t.score / max) * 100}%`; }, 400 + i * 150);
          return h('div', { class: 'team-row' },
            h('div', { class: 'team-name' }, T.icon, ' ', T.name),
            h('div', { class: 'tb-bar' }, fill),
            h('div', { class: 'team-score' }, t.score.toLocaleString(), h('small', null, ' avg')));
        }))
      : null;

    const remaining = s.totalRounds - s.round;
    const lbRow = Math.min(62, Math.max(36, (innerHeight * (teams ? 0.5 : 0.66)) / perCol));
    return h('div', { class: 'host host-leaderboard', style: { '--lb-row': `${lbRow}px` } },
      h('h1', { class: 'screen-title' }, '🏆 Standings', h('span', { class: 'sub' }, ` · Round ${s.round}/${s.totalRounds}`)),
      teams,
      h('div', { class: 'lb-wrap', style: { height: `${perCol * lbRow}px` } }, board),
      callouts,
      h('div', { class: 'next-hint' }, remaining > 0 && !(elimMode && standings.filter((x) => x.alive).length <= 1)
        ? (remaining === 1 ? 'Next up: the FINAL round!' : `${remaining} rounds to go`)
        : 'And the winner is…'));
  }

  // ------------------------------------------------------------ final

  renderFinal() {
    const s = this.state;
    const d = s.data;
    const bag = this.screenBag;
    const st = d.standings || [];
    const pod = d.podium || [];
    const teamWin = d.winnerTeam != null ? TEAMS[d.winnerTeam] : null;
    const byId = new Map(st.map((x) => [x.id, x]));

    const order = [1, 0, 2]; // 2nd, 1st, 3rd
    const pillars = order.map((idx) => {
      const id = pod[idx];
      const heights = ['78%', '58%', '42%'];
      if (!id) return h('div', { class: 'pillar empty', style: { '--h': heights[idx] } });
      const p = this.p(id);
      const av = avatar(p.avatar, { size: idx === 0 ? 150 : 112, mood: idx === 0 ? 'win' : 'happy', crown: idx === 0 });
      const el = h('div', { class: `pillar p${idx + 1}`, style: { '--h': heights[idx] } },
        h('div', { class: 'pod-top' }, av, h('div', { class: 'pod-name' }, p.name), h('div', { class: 'pod-score' }, `${byId.get(id)?.score ?? 0} pts`)),
        h('div', { class: 'pod-block' }, h('span', null, idx + 1)));
      return el;
    });
    const podium = h('div', { class: 'podium' }, pillars);

    const title = h('h1', { class: 'final-title' }, teamWin ? `${teamWin.icon} ${teamWin.name} win!` : '🏆 Champion!');
    const close = d.close ? h('div', { class: 'callout close photo' }, '📸 PHOTO FINISH! What a close one!') : null;

    // Reveal 3rd, 2nd, then a drum roll for 1st.
    const reveal = (idx, delay) => bag.timeout(() => {
      const el = pillars[order.indexOf(idx)];
      el.classList.add('revealed');
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
    bag.interval(() => fx.fireworks(3), 5000);

    const full = h('div', { class: 'final-list' },
      st.slice(3).map((x) => {
        const p = this.p(x.id);
        return h('div', { class: 'fl-row' }, h('span', { class: 'fl-rank' }, ordinal(x.rank)), avatar(p.avatar, { size: 30 }), h('span', { class: 'fl-name' }, p.name), h('span', { class: 'fl-score' }, x.score));
      }));

    const teams = d.teams
      ? h('div', { class: 'final-teams' }, d.teams.map((t) => {
        const T = TEAMS[t.id];
        return h('div', { class: 'ft', style: { '--team': T.color } }, h('b', null, `${ordinal(t.rank)} ${T.icon} ${T.name}`), ` ${t.score} avg`);
      }))
      : null;

    const again = h('button', { class: 'btn btn-green btn-lg' }, '🔁 Play Again');
    again.onclick = () => { sfx.click(); this.action('restart'); };
    const newParty = h('button', { class: 'btn btn-white btn-lg' }, 'New Party');
    newParty.onclick = async () => {
      if (!confirm('Close this party and start a fresh one?')) return;
      await this.action('close');
      this.leave();
    };

    return h('div', { class: 'host host-final' },
      title,
      close,
      podium,
      teams,
      full,
      h('div', { class: 'final-actions' }, again, newParty));
  }
}
