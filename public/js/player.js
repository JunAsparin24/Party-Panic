// The phone controller: lobby + avatar editor, ready-up, minigames, results.
import { net, prefs } from './net.js';
import { h, show, avatar, countUp, Bag, ordinal } from './ui.js';
import { sfx, vibrate } from './sound.js';
import { fx } from './fx.js';
import { GAMES } from '/shared/games.js';
import { MODES, MODS, TEAMS } from '/shared/config.js';
import { AVATAR_OPTIONS, AVATAR_LABELS, AVATAR_KEYS, randomAvatar } from '/shared/avatar.js';
import { GAME_CLIENTS } from './games/index.js';

const COLOR_KEYS = new Set(['skin', 'hairColor', 'outfit', 'bg']);
const NICE = {
  hair: ['Short', 'Spiky', 'Long', 'Bob', 'Curly', 'Bun', 'Mohawk', 'Ponytail', 'Bald'],
  eyes: ['Round', 'Happy', 'Sleepy', 'Wink', 'Sparkle', 'Dots'],
  mouth: ['Smile', 'Grin', 'Open', 'Smirk', 'Tongue', 'Cat'],
  acc: ['None', 'Glasses', 'Shades', 'Cap', 'Headphones', 'Bow', 'Beanie', 'Flower'],
};

export class PlayerApp {
  constructor(state, leave) {
    this.role = 'player';
    this.leave = leave;
    this.players = new Map();
    this.bag = new Bag();
    this.screenBag = new Bag();
    this.hooks = {};
    this.renderedStateId = null;
    const subs = [
      net.on('state', (s) => this.onState(s)),
      net.on('roster', (r) => this.onRoster(r)),
      net.on('settings', (s) => { this.state.settings = s; this.hooks.settings?.(s); }),
      net.on('ready', (ids) => this.hooks.ready?.(ids)),
      net.on('g:msg', (m) => this.hooks.gameMsg?.(m)),
      net.on('endsAt', (t) => { this.state.endsAt = t; }),
    ];
    subs.forEach((f) => this.bag.add(f));
    document.body.classList.add('is-player');
    this.bag.add(() => document.body.classList.remove('is-player', 'upside'));
    this.onState(state);
  }

  destroy() {
    this.screenBag.run();
    this.bag.run();
  }

  p(id) { return this.players.get(id) || { id, name: '???', avatar: {} }; }

  onRoster(list) {
    this.players = new Map(list.map((p) => [p.id, p]));
    this.state.players = list;
    const mine = this.players.get(this.me?.id);
    if (mine) this.me = { ...this.me, ...mine };
    this.hooks.roster?.(list);
  }

  onState(s, force = false) {
    this.state = s;
    this.me = s.me;
    this.players = new Map(s.players.map((p) => [p.id, p]));
    if (!force && s.stateId === this.renderedStateId) {
      this.hooks.roster?.(s.players);
      return;
    }
    this.renderedStateId = s.stateId;
    this.render();
  }

  render() {
    this.screenBag.run();
    const bag = new Bag();
    this.screenBag = bag;
    this.hooks = {};
    document.body.classList.remove('upside');
    const s = this.state;
    const spectating = !this.me.alive && ['wheel', 'tutorial', 'countdown', 'playing'].includes(s.phase);
    let screen;
    if (spectating) screen = this.renderSpectating();
    else {
      switch (s.phase) {
        case 'wheel': screen = this.renderWheel(); break;
        case 'tutorial': screen = this.renderTutorial(); break;
        case 'countdown': screen = this.renderCountdown(); break;
        case 'playing': screen = s.game?.spectating ? this.renderSpectating() : this.renderPlaying(); break;
        case 'results': screen = this.renderResults(); break;
        case 'leaderboard': screen = this.renderLeaderboard(); break;
        case 'final': screen = this.renderFinal(); break;
        default: screen = this.renderLobby();
      }
    }
    show(screen, () => bag.run());
  }

  topBar() {
    const me = this.me;
    const team = me.team != null ? TEAMS[me.team] : null;
    return h('div', { class: 'p-top', style: team ? { '--team': team.color } : null },
      avatar(me.avatar, { size: 36 }),
      h('div', { class: 'p-top-name' }, me.name, team ? h('span', { class: 'p-team' }, `${team.icon} ${team.name}`) : null),
      h('div', { class: 'p-top-score' }, `${me.score.toLocaleString()} pts`));
  }

  // ------------------------------------------------------------ lobby

  renderLobby() {
    const s = this.state;
    const bag = this.screenBag;
    let av = { ...this.me.avatar };
    const preview = h('div', { class: 'p-preview' }, avatar(av, { size: 150, class: 'bob' }));
    let sendTimer = null;
    const update = (patch) => {
      av = { ...av, ...patch };
      prefs.set('avatar', av);
      preview.replaceChildren(avatar(av, { size: 150, class: 'wiggle' }));
      clearTimeout(sendTimer);
      sendTimer = setTimeout(() => net.emit('player:avatar', av), 150);
      renderEditor();
    };
    bag.add(() => { clearTimeout(sendTimer); });

    const editor = h('div', { class: 'av-editor card' });
    const renderEditor = () => {
      editor.replaceChildren(
        ...AVATAR_KEYS.map((k) => {
          const opts = AVATAR_OPTIONS[k];
          if (COLOR_KEYS.has(k)) {
            return h('div', { class: 'av-row' },
              h('div', { class: 'av-label' }, AVATAR_LABELS[k]),
              h('div', { class: 'swatches' },
                opts.map((c, i) => h('button', {
                  class: `swatch ${av[k] === i ? 'on' : ''}`, style: { background: c }, 'aria-label': `${AVATAR_LABELS[k]} ${i + 1}`,
                  onclick: () => { sfx.click(); update({ [k]: i }); },
                }))));
          }
          const step = (dir) => () => { sfx.click(); update({ [k]: (av[k] + dir + opts.length) % opts.length }); };
          return h('div', { class: 'av-row' },
            h('div', { class: 'av-label' }, AVATAR_LABELS[k]),
            h('div', { class: 'stepper' },
              h('button', { class: 'step', onclick: step(-1), 'aria-label': 'Previous' }, '◀'),
              h('span', { class: 'step-val' }, NICE[k]?.[av[k]] ?? av[k] + 1),
              h('button', { class: 'step', onclick: step(1), 'aria-label': 'Next' }, '▶')));
        })
      );
    };
    renderEditor();

    const randomize = h('button', { class: 'btn btn-pink' }, '🎲 Randomize');
    randomize.onclick = () => { sfx.pop(); update(randomAvatar()); };

    const roster = h('div', { class: 'p-roster' });
    const info = h('div', { class: 'p-wait-info' });
    const renderRoster = (list) => {
      roster.replaceChildren(...list.map((p) =>
        h('div', { class: `pr-item ${p.id === this.me.id ? 'me' : ''} ${p.connected ? '' : 'offline'}` }, avatar(p.avatar, { size: 44 }), h('span', null, p.name))));
    };
    const renderInfo = (st) => {
      const m = MODES[st.mode];
      info.replaceChildren(h('span', { class: 'chip' }, m.icon, ' ', m.name), h('span', { class: 'chip' }, `${st.rounds} rounds`), h('span', { class: 'chip' }, `${st.games.length} games`));
    };
    this.hooks.roster = renderRoster;
    this.hooks.settings = renderInfo;
    renderRoster(s.players);
    renderInfo(s.settings);

    const leave = h('button', { class: 'btn-link' }, 'Leave');
    leave.onclick = async () => {
      if (!confirm('Leave this party?')) return;
      await net.request('player:leave');
      this.leave();
    };

    return h('div', { class: 'p-screen p-lobby' },
      h('header', { class: 'p-head' }, h('span', { class: 'chip code' }, `Room ${s.code}`), leave),
      h('h1', { class: 'p-title' }, "You're in!"),
      preview,
      h('div', { class: 'p-name' }, this.me.name),
      h('div', { class: 'p-waiting pulse' }, 'Waiting for the host to start', h('span', { class: 'dots' })),
      info,
      h('div', { class: 'section-label' }, 'Customise your look'),
      editor,
      randomize,
      h('div', { class: 'section-label' }, 'In the party'),
      roster);
  }

  // ------------------------------------------------------------ wheel

  renderWheel() {
    const d = this.state.data;
    const g = GAMES[d.gameId];
    const bag = this.screenBag;
    const reveal = h('div', { class: 'p-reveal hidden', style: { '--c': g.color } },
      h('div', { class: 'pr-icon' }, g.icon), h('div', { class: 'pr-name' }, g.name), h('div', { class: 'pr-tag' }, g.tagline));
    const spinner = h('div', { class: 'mini-wheel' });
    const mods = h('div', { class: 'p-mods' });
    bag.timeout(() => {
      spinner.classList.add('hidden');
      reveal.classList.remove('hidden');
      sfx.good();
      vibrate(40);
      if (d.mods?.length) {
        bag.timeout(() => mods.replaceChildren(...d.mods.map((id) => h('div', { class: 'mod-card small' }, h('span', { class: 'mod-icon' }, MODS[id].icon), h('b', null, MODS[id].name), h('div', { class: 'mod-desc' }, MODS[id].desc)))), 800);
      }
    }, d.spinMs || 4600);
    return h('div', { class: 'p-screen p-center' },
      this.topBar(),
      h('div', { class: 'round-tag' }, `Round ${this.state.round} of ${this.state.totalRounds}`),
      d.isFinal ? h('div', { class: 'final-banner small' }, '🔥 FINAL ROUND', d.finalDouble ? ' · ×2' : '') : null,
      spinner,
      reveal,
      mods,
      h('p', { class: 'muted' }, 'Watch the big screen!'));
  }

  // ------------------------------------------------------------ tutorial

  renderTutorial() {
    const d = this.state.data;
    const g = GAMES[d.gameId];
    const bag = this.screenBag;
    const btn = h('button', { class: 'btn btn-green btn-xl ready-btn' }, "I'm Ready!");
    const status = h('div', { class: 'ready-status' });
    const setReady = () => {
      btn.disabled = true;
      btn.textContent = '✓ Ready!';
      btn.classList.add('is-ready');
    };
    if ((d.ready || []).includes(this.me.id)) setReady();
    btn.onclick = () => {
      sfx.pop();
      vibrate(25);
      net.emit('player:ready');
      setReady();
    };
    const renderStatus = (ids) => {
      const parts = this.state.players.filter((p) => p.alive && !p.left);
      status.textContent = `${ids.length}/${parts.length} players ready`;
    };
    this.hooks.ready = renderStatus;
    renderStatus(d.ready || []);
    const fill = h('div', { class: 'tb-fill' });
    const total = Math.max(1, this.state.endsAt - net.now());
    bag.raf(() => { fill.style.transform = `scaleX(${Math.max(0, this.state.endsAt - net.now()) / total})`; });

    return h('div', { class: 'p-screen p-tutorial', style: { '--c': g.color } },
      this.topBar(),
      h('div', { class: 'timer-bar' }, fill),
      h('div', { class: 'pt-icon' }, g.icon),
      h('h1', { class: 'pt-name' }, g.name),
      h('ol', { class: 'tut-steps small' }, g.howTo.map((x) => h('li', null, x))),
      h('div', { class: 'control-chip' }, '🎮 ', g.control),
      d.mods?.length ? h('div', { class: 'mod-badges' }, d.mods.map((id) => h('span', { class: 'mod-badge' }, MODS[id].icon, ' ', MODS[id].name))) : null,
      d.modData?.golden === this.me.id ? h('div', { class: 'golden-you' }, '👑 You are the Golden Player! Triple points!') : null,
      btn,
      status);
  }

  // ------------------------------------------------------------ countdown

  renderCountdown() {
    const g = GAMES[this.state.data.gameId];
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
        vibrate(v === 'GO!' ? 80 : 20);
        if (v === 'GO!') sfx.go(); else sfx.beep();
      }
    });
    return h('div', { class: 'p-screen p-countdown', style: { '--c': g.color } }, h('div', { class: 'count-game' }, g.icon, ' ', g.name), num);
  }

  // ------------------------------------------------------------ playing

  renderPlaying() {
    const s = this.state;
    const d = s.data;
    const g = GAMES[d.gameId];
    const bag = this.screenBag;
    const mods = d.mods || [];
    if (mods.includes('upside')) document.body.classList.add('upside');

    const scoreEl = h('div', { class: 'g-score' }, '0');
    const secsEl = h('div', { class: 'g-secs' });
    const fill = h('div', { class: 'tb-fill' });
    const total = Math.max(1, (d.duration || s.endsAt - net.now()));
    let lastSec = null;
    bag.raf(() => {
      const left = Math.max(0, s.endsAt - net.now());
      fill.style.transform = `scaleX(${Math.min(1, left / total)})`;
      const sec = Math.ceil(left / 1000);
      if (sec !== lastSec) {
        lastSec = sec;
        secsEl.textContent = `${sec}s`;
        secsEl.classList.toggle('urgent', sec <= 5);
        if (sec <= 3 && sec > 0) sfx.tick();
      }
    });

    const area = h('div', { class: 'g-area' });
    const overlay = h('div', { class: 'g-overlay hidden' });
    const popLayer = h('div', { class: 'g-pops' });
    const screen = h('div', { class: `p-screen p-playing game-${d.gameId}`, style: { '--c': g.color } },
      h('div', { class: 'g-top' },
        h('div', { class: 'g-title' }, g.icon, ' ', g.name),
        mods.length ? h('div', { class: 'g-mods' }, mods.map((id) => MODS[id].icon)) : null,
        scoreEl,
        secsEl),
      h('div', { class: 'timer-bar thin' }, fill),
      area,
      popLayer,
      overlay);

    let shownScore = 0;
    const ctx = {
      root: area,
      init: s.game?.init || {},
      gameId: d.gameId,
      mods: new Set(mods),
      reversed: mods.includes('reversed'),
      color: g.color,
      avatar: this.me.avatar,
      now: net.now,
      endsAt: () => this.state.endsAt,
      bag,
      sfx,
      fx,
      vibrate,
      send: (data) => net.emit('g:input', data),
      onMsg: (fn) => { this.hooks.gameMsg = fn; },
      setScore: (v) => {
        if (v === shownScore) return;
        const up = v > shownScore;
        shownScore = v;
        scoreEl.textContent = v.toLocaleString();
        scoreEl.classList.remove('bump', 'down');
        void scoreEl.offsetWidth;
        scoreEl.classList.add(up ? 'bump' : 'down');
      },
      popup: (text, cls = '') => {
        const el = h('div', { class: `g-pop ${cls}` }, text);
        popLayer.append(el);
        setTimeout(() => el.remove(), 1000);
      },
      finished: (title, sub) => {
        overlay.replaceChildren(h('div', { class: 'go-card card' }, h('div', { class: 'go-title' }, title), sub ? h('div', { class: 'go-sub' }, sub) : null, h('div', { class: 'muted' }, 'Waiting for everyone else…')));
        overlay.classList.remove('hidden');
      },
    };
    const client = GAME_CLIENTS[d.gameId];
    // Mount after the screen is in the DOM so games can measure their area.
    requestAnimationFrame(() => {
      try {
        client.player(ctx);
      } catch (err) {
        console.error(err);
        area.replaceChildren(h('p', { class: 'muted' }, 'Something went wrong loading this game.'));
      }
    });
    if (s.game?.done) ctx.finished('Done!');
    return screen;
  }

  renderSpectating() {
    const elim = !this.me.alive;
    return h('div', { class: 'p-screen p-center' },
      this.topBar(),
      h('div', { class: 'emoji-xl bob' }, elim ? '👻' : '👀'),
      h('h1', { class: 'p-title' }, elim ? "You're out!" : 'Spectating'),
      h('p', { class: 'muted' }, elim ? 'Cheer on the survivors — watch the big screen!' : 'You will join in next round.'),
      avatar(this.me.avatar, { size: 120, mood: elim ? 'sad' : undefined }));
  }

  // ------------------------------------------------------------ results

  renderResults() {
    const d = this.state.data;
    const g = GAMES[d.gameId];
    const row = (d.rows || []).find((r) => r.id === this.me.id);
    if (!row) return this.renderSpectating();
    const pts = h('div', { class: 'big-points' }, '+0');
    const top = row.rank === 1;
    const mood = top ? 'win' : row.rank <= 3 ? 'happy' : row.rank === d.rows.length && d.rows.length > 2 ? 'sad' : undefined;
    this.screenBag.timeout(() => {
      countUp(pts, 0, row.points, 800, '+');
      if (row.perfect) { sfx.ding(); fx.confetti(80); vibrate([40, 60, 40]); }
      else if (top) { sfx.great(); fx.confetti(60); vibrate([30, 40, 30]); }
      else sfx.pop();
    }, 300);
    const events = (d.events || []).map((e) => {
      if (e.type === 'heist' && e.to === this.me.id) return h('div', { class: 'event-banner heist' }, `💰 You stole ${e.amount} points!`);
      if (e.type === 'heist' && e.from === this.me.id) return h('div', { class: 'event-banner heist' }, `😱 ${this.p(e.to).name} stole ${e.amount} of your points!`);
      return null;
    });
    return h('div', { class: 'p-screen p-center p-results', style: { '--c': g.color } },
      this.topBar(),
      h('div', { class: 'eyebrow' }, `${g.icon} ${g.name}`),
      h('h1', { class: 'p-title' }, top ? 'You won the round!' : `You came ${ordinal(row.rank)}`),
      avatar(this.me.avatar, { size: 130, mood, class: top ? 'bounce' : '' }),
      h('div', { class: 'res-label big' }, row.label),
      row.perfect ? h('div', { class: 'perfect-badge big' }, '✨ PERFECT! +25 bonus') : null,
      pts,
      row.tags?.length ? h('div', { class: 'res-tags' }, row.tags.map((t) => h('span', { class: 'tag' }, t))) : null,
      events);
  }

  // ------------------------------------------------------------ leaderboard

  renderLeaderboard() {
    const s = this.state;
    const d = s.data;
    const mine = (d.standings || []).find((x) => x.id === this.me.id);
    if (!mine) return this.renderSpectating();
    const out = (d.eliminated || []).includes(this.me.id);
    const elimMode = s.settings.mode === 'elimination';
    const diff = mine.prevRank - mine.rank;
    const rankEl = h('div', { class: 'big-rank' }, ordinal(mine.prevRank));
    const scoreEl = h('div', { class: 'big-score' }, (mine.score - mine.lastPoints).toLocaleString());
    this.screenBag.timeout(() => {
      rankEl.textContent = ordinal(mine.rank);
      rankEl.classList.add('pop');
      countUp(scoreEl, mine.score - mine.lastPoints, mine.score, 1000);
      if (out) { sfx.eliminated(); vibrate([200, 100, 200]); fx.shake(); }
      else if (diff > 0) { sfx.levelUp(); vibrate(40); }
    }, 900);
    let team = null;
    if (d.teams && this.me.team != null) {
      const t = d.teams.find((x) => x.id === this.me.team);
      const T = TEAMS[this.me.team];
      if (t) team = h('div', { class: 'p-teamcard', style: { '--team': T.color } }, `${T.icon} ${T.name}: ${ordinal(t.rank)} place (${t.score} avg)`);
    }
    let status = null;
    if (elimMode) {
      if (out) status = h('div', { class: 'elim-stamp' }, '💀 ELIMINATED');
      else if (mine.alive) status = h('div', { class: 'safe-stamp' }, '✅ SAFE!');
    }
    return h('div', { class: 'p-screen p-center p-standings' },
      this.topBar(),
      h('div', { class: 'eyebrow' }, `Standings · Round ${s.round}/${s.totalRounds}`),
      avatar(this.me.avatar, { size: 110, mood: out ? 'sad' : mine.rank === 1 ? 'win' : undefined }),
      rankEl,
      diff !== 0 ? h('div', { class: `rank-change ${diff > 0 ? 'up' : 'down'}` }, diff > 0 ? `▲ up ${diff}` : `▼ down ${-diff}`) : null,
      scoreEl,
      h('div', { class: 'muted' }, 'points'),
      status,
      team);
  }

  // ------------------------------------------------------------ final

  renderFinal() {
    const d = this.state.data;
    const mine = (d.standings || []).find((x) => x.id === this.me.id);
    const rank = mine?.rank ?? 0;
    const champ = rank === 1;
    const teamWin = d.winnerTeam != null && d.winnerTeam === this.me.team;
    this.screenBag.timeout(() => {
      if (champ || teamWin) { fx.confetti(200); sfx.fanfare(); vibrate([60, 60, 60, 60, 200]); }
      else if (rank <= 3) { fx.confetti(80); sfx.great(); }
    }, 4300);
    const title = champ ? '🏆 CHAMPION!' : rank === 2 ? '🥈 Second place!' : rank === 3 ? '🥉 Third place!' : `You finished ${ordinal(rank)}`;
    return h('div', { class: 'p-screen p-center p-final' },
      this.topBar(),
      h('div', { class: 'eyebrow' }, 'Final results'),
      avatar(this.me.avatar, { size: 150, mood: rank <= 3 ? 'win' : 'happy', crown: champ, class: champ ? 'bounce' : '' }),
      h('h1', { class: 'p-title' }, title),
      teamWin ? h('div', { class: 'p-teamcard', style: { '--team': TEAMS[this.me.team].color } }, `${TEAMS[this.me.team].icon} Your team won!`) : null,
      h('div', { class: 'big-score' }, `${mine?.score ?? 0}`),
      h('div', { class: 'muted' }, 'points'),
      h('p', { class: 'muted pulse' }, 'Thanks for playing! The host can start another game.'));
  }
}
