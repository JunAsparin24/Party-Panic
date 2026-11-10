// The phone controller: character select, lobby, ready-up, minigames,
// results and reactions.
import { net, prefs } from './net.js';
import { h, fill, show, toast, char, charName, icon, countUp, Bag, ordinal, onTap } from './ui.js';
import { art } from './art.js';
import { sfx, vibrate } from './sound.js';
import { fx } from './fx.js';
import { GAMES } from '/shared/games.js';
import { MODES, MODS, TEAMS, REACTIONS } from '/shared/config.js';
import { SLOTS } from '/shared/characters.js';
import { GAME_CLIENTS } from './games/index.js';

export class PlayerApp {
  constructor(state, leave) {
    this.role = 'player';
    this.leave = leave;
    this.players = new Map();
    this.bag = new Bag();
    this.screenBag = new Bag();
    this.hooks = {};
    this.renderedStateId = null;
    this.state = state;
    this.picking = state.phase === 'lobby' && !this.pickedBefore(state.code);
    [
      net.on('state', (s) => this.onState(s)),
      net.on('roster', (r) => this.onRoster(r)),
      net.on('settings', (s) => { this.state.settings = s; this.hooks.settings?.(s); }),
      net.on('ready', (ids) => this.hooks.ready?.(ids)),
      net.on('g:msg', (m) => this.hooks.gameMsg?.(m)),
      net.on('endsAt', (t) => { this.state.endsAt = t; }),
    ].forEach((f) => this.bag.add(f));
    document.body.classList.add('is-player');
    this.bag.add(() => {
      document.body.classList.remove('is-player', 'upside');
      document.body.style.removeProperty('--theme');
    });
    this.onState(state);
  }

  destroy() {
    this.screenBag.run();
    this.bag.run();
  }

  pickedBefore(code) {
    try { return sessionStorage.getItem(`pp-picked-${code}`) === '1'; } catch { return false; }
  }

  markPicked() {
    try { sessionStorage.setItem(`pp-picked-${this.state.code}`, '1'); } catch { /* ignore */ }
  }

  p(id) { return this.players.get(id) || { id, name: '???', character: 'dee-0' }; }

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
    if (s.phase !== 'lobby') this.picking = false;
    this.render();
  }

  render() {
    this.screenBag.run();
    const bag = new Bag();
    this.screenBag = bag;
    this.hooks = {};
    document.body.classList.remove('upside');
    const s = this.state;
    const gameId = s.data?.gameId;
    document.body.style.setProperty('--theme', gameId && ['tutorial', 'countdown', 'playing', 'results'].includes(s.phase) ? GAMES[gameId].color : '#9b6bff');
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
        default: screen = this.picking ? this.renderPicker() : this.renderLobby();
      }
    }
    show(screen, () => bag.run());
  }

  topBar() {
    const me = this.me;
    const team = me.team != null ? TEAMS[me.team] : null;
    return h('div', { class: 'p-top', style: team ? { '--team': team.color } : null },
      char(me.character, { size: 38 }),
      h('div', { class: 'p-top-name' }, me.name, team ? h('span', { class: 'p-team' }, team.name) : null),
      h('div', { class: 'p-top-score' }, me.score.toLocaleString(), h('small', null, 'pts')));
  }

  reactionBar() {
    const bar = h('div', { class: 'react-bar' });
    let cool = 0;
    for (const r of REACTIONS) {
      const b = h('button', { class: 'react-btn', 'aria-label': r }, art(r));
      onTap(b, () => {
        const now = Date.now();
        if (now < cool) return;
        cool = now + 650;
        net.emit('player:react', { r });
        vibrate(12);
        b.classList.remove('sent');
        void b.offsetWidth;
        b.classList.add('sent');
        bar.classList.add('cooling');
        setTimeout(() => bar.classList.remove('cooling'), 650);
      });
      bar.append(b);
    }
    return h('div', { class: 'react-dock' }, h('div', { class: 'react-label' }, 'React on the big screen'), bar);
  }

  // ------------------------------------------------------------ character select

  renderPicker() {
    const grid = h('div', { class: 'pick-grid' });
    const preview = h('div', { class: 'pick-preview' });
    const renderPreview = () => {
      fill(preview,
        char(this.me.character, { size: 128, class: 'swap-in', mood: 'happy' }),
        h('div', { class: 'pick-name' }, charName(this.me.character)));
    };
    let busy = false;
    const renderGrid = () => {
      const takenBy = new Map(this.state.players.filter((p) => p.id !== this.me.id).map((p) => [p.character, p.name]));
      fill(grid, SLOTS.map((s) => {
        const taker = takenBy.get(s.slot);
        const mine = s.slot === this.me.character;
        const b = h('button', { class: `pick-tile ${mine ? 'mine' : ''} ${taker ? 'taken' : ''}`, 'aria-label': s.name },
          char(s.slot, { size: 62 }),
          taker ? h('span', { class: 'pick-taker' }, taker) : null);
        onTap(b, async () => {
          if (busy || mine) return;
          if (taker) { sfx.bad(); toast(`${taker} already picked ${s.name}.`, 'error', 1800); return; }
          busy = true;
          sfx.click();
          const r = await net.request('player:character', { slot: s.slot });
          busy = false;
          if (!r.ok) { toast(r.error || 'Try another one.', 'error'); return; }
          this.me.character = s.slot;
          prefs.set('character', s.slot);
          vibrate(15);
          sfx.pop();
          renderPreview();
          renderGrid();
        });
        return b;
      }));
    };
    this.hooks.roster = () => {
      const mine = this.players.get(this.me.id);
      if (mine) this.me.character = mine.character;
      renderGrid();
    };
    renderPreview();
    renderGrid();
    const done = h('button', { class: 'btn btn-primary btn-xl pick-done' }, "That's me", icon('check'));
    done.onclick = () => {
      sfx.join();
      prefs.set('character', this.me.character);
      this.markPicked();
      this.picking = false;
      this.render();
    };
    return h('div', { class: 'p-screen p-picker' },
      h('header', { class: 'p-head' }, h('span', { class: 'chip code' }, `Room ${this.state.code}`), h('span', { class: 'muted' }, this.me.name)),
      h('h1', { class: 'p-title' }, 'Pick your character'),
      preview,
      grid,
      done);
  }

  // ------------------------------------------------------------ lobby

  renderLobby() {
    const s = this.state;
    const roster = h('div', { class: 'p-roster' });
    const info = h('div', { class: 'p-wait-info' });
    const renderRoster = (list) => {
      fill(roster, list.map((p) =>
        h('div', { class: `pr-item ${p.id === this.me.id ? 'me' : ''} ${p.connected ? '' : 'offline'}` }, char(p.character, { size: 46 }), h('span', null, p.name))));
    };
    const renderInfo = (st) => {
      const m = MODES[st.mode];
      fill(info, h('span', { class: 'chip' }, icon(m.icon), m.name), h('span', { class: 'chip' }, `${st.rounds} rounds`), h('span', { class: 'chip' }, `${st.games.length} games`));
    };
    this.hooks.roster = renderRoster;
    this.hooks.settings = renderInfo;
    renderRoster(s.players);
    renderInfo(s.settings);

    const change = h('button', { class: 'btn btn-light btn-sm' }, icon('edit'), 'Change character');
    change.onclick = () => { sfx.click(); this.picking = true; this.render(); };
    const leave = h('button', { class: 'btn-link' }, 'Leave');
    leave.onclick = async () => {
      if (!confirm('Leave this party?')) return;
      await net.request('player:leave');
      this.leave();
    };

    return h('div', { class: 'p-screen p-lobby' },
      h('header', { class: 'p-head' }, h('span', { class: 'chip code' }, `Room ${s.code}`), leave),
      h('div', { class: 'p-hero' },
        char(this.me.character, { size: 150, class: 'idle-bob' }),
        h('div', { class: 'p-name' }, this.me.name),
        h('div', { class: 'muted' }, charName(this.me.character)),
        change),
      h('div', { class: 'p-waiting' }, h('span', { class: 'pulse-dot' }), 'Waiting for the host to start'),
      info,
      h('div', { class: 'section-label' }, 'In the party'),
      roster,
      this.reactionBar());
  }

  // ------------------------------------------------------------ wheel

  renderWheel() {
    const d = this.state.data;
    const g = GAMES[d.gameId];
    const bag = this.screenBag;
    const reveal = h('div', { class: 'p-reveal hidden', style: { '--c': g.color } },
      h('div', { class: 'pr-icon' }, icon(g.icon)), h('div', { class: 'pr-name' }, g.name), h('div', { class: 'pr-tag' }, g.tagline));
    const spinner = h('div', { class: 'mini-wheel' });
    const mods = h('div', { class: 'p-mods' });
    bag.timeout(() => {
      spinner.classList.add('hidden');
      reveal.classList.remove('hidden');
      sfx.good();
      vibrate(40);
      if (d.mods?.length) {
        bag.timeout(() => fill(mods, d.mods.map((id) =>
          h('div', { class: 'mod-card small' }, h('div', { class: 'mod-icon' }, icon(MODS[id].icon)), h('div', null, h('div', { class: 'mod-name' }, MODS[id].name), h('div', { class: 'mod-desc' }, MODS[id].desc))))), 800);
      }
    }, d.spinMs || 4600);
    return h('div', { class: 'p-screen p-center' },
      this.topBar(),
      h('div', { class: 'round-tag' }, `Round ${this.state.round} of ${this.state.totalRounds}`),
      d.isFinal ? h('div', { class: 'final-banner small' }, d.finalDouble ? 'Final round · ×2' : 'Final round') : null,
      spinner,
      reveal,
      mods,
      h('p', { class: 'muted' }, 'Watch the big screen'),
      this.reactionBar());
  }

  // ------------------------------------------------------------ tutorial

  renderTutorial() {
    const d = this.state.data;
    const g = GAMES[d.gameId];
    const bag = this.screenBag;
    const btn = h('button', { class: 'btn btn-primary btn-xl ready-btn' }, "I'm ready");
    const status = h('div', { class: 'ready-status' });
    const setReady = () => {
      btn.disabled = true;
      fill(btn, icon('check'), 'Ready');
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
      status.textContent = `${ids.length} of ${parts.length} players ready`;
    };
    this.hooks.ready = renderStatus;
    renderStatus(d.ready || []);
    const fillEl = h('div', { class: 'tb-fill' });
    const total = Math.max(1, this.state.endsAt - net.now());
    bag.raf(() => { fillEl.style.transform = `scaleX(${Math.max(0, this.state.endsAt - net.now()) / total})`; });

    return h('div', { class: 'p-screen p-tutorial', style: { '--c': g.color } },
      this.topBar(),
      h('div', { class: 'timer-bar' }, fillEl),
      h('div', { class: 'pt-icon' }, icon(g.icon)),
      h('h1', { class: 'pt-name' }, g.name),
      h('ol', { class: 'tut-steps small' }, g.howTo.map((x) => h('li', null, x))),
      h('div', { class: 'control-chip' }, icon('phone'), g.control),
      d.mods?.length ? h('div', { class: 'mod-badges' }, d.mods.map((id) => h('span', { class: 'mod-badge' }, icon(MODS[id].icon), MODS[id].name))) : null,
      d.modData?.golden === this.me.id ? h('div', { class: 'golden-you' }, icon('crown'), 'You are the Golden Player. Triple points!') : null,
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
      const v = left > 2500 ? '3' : left > 1500 ? '2' : left > 500 ? '1' : 'GO';
      if (v !== last) {
        last = v;
        num.textContent = v;
        num.classList.remove('pop');
        void num.offsetWidth;
        num.classList.add('pop');
        vibrate(v === 'GO' ? 80 : 20);
        if (v === 'GO') sfx.go(); else sfx.beep();
      }
    });
    return h('div', { class: 'p-screen p-countdown', style: { '--c': g.color } }, h('div', { class: 'count-game' }, icon(g.icon), g.name), num);
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
    const fillEl = h('div', { class: 'tb-fill' });
    const total = Math.max(1, d.duration || s.endsAt - net.now());
    let lastSec = null;
    bag.raf(() => {
      const left = Math.max(0, s.endsAt - net.now());
      fillEl.style.transform = `scaleX(${Math.min(1, left / total)})`;
      const sec = Math.ceil(left / 1000);
      if (sec !== lastSec) {
        lastSec = sec;
        secsEl.textContent = sec;
        secsEl.classList.toggle('urgent', sec <= 5);
        if (sec <= 3 && sec > 0) sfx.tick();
      }
    });

    const area = h('div', { class: 'g-area' });
    const overlay = h('div', { class: 'g-overlay hidden' });
    const popLayer = h('div', { class: 'g-pops' });
    const screen = h('div', { class: `p-screen p-playing game-${d.gameId}`, style: { '--c': g.color } },
      h('div', { class: 'g-top' },
        h('div', { class: 'g-title' }, icon(g.icon), h('span', null, g.name)),
        mods.length ? h('div', { class: 'g-mods' }, mods.map((id) => icon(MODS[id].icon))) : null,
        scoreEl,
        secsEl),
      h('div', { class: 'timer-bar thin' }, fillEl),
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
      character: this.me.character,
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
        fill(overlay, h('div', { class: 'go-card card' },
          char(this.me.character, { size: 84, mood: 'happy' }),
          h('div', { class: 'go-title' }, title),
          sub ? h('div', { class: 'go-sub' }, sub) : null,
          h('div', { class: 'muted' }, 'Waiting for everyone else…')),
        this.reactionBar());
        overlay.classList.remove('hidden');
      },
    };
    requestAnimationFrame(() => {
      try {
        GAME_CLIENTS[d.gameId].player(ctx);
      } catch (err) {
        console.error(err);
        fill(area, h('p', { class: 'muted' }, 'Something went wrong loading this game.'));
      }
    });
    if (s.game?.done) ctx.finished('Done!');
    return screen;
  }

  renderSpectating() {
    const elim = !this.me.alive;
    return h('div', { class: 'p-screen p-center' },
      this.topBar(),
      char(this.me.character, { size: 130, mood: elim ? 'sad' : 'idle', class: 'idle-bob' }),
      h('h1', { class: 'p-title' }, elim ? "You're out" : 'Spectating'),
      h('p', { class: 'muted' }, elim ? 'Cheer on the survivors (or heckle them) from here.' : 'You will join in next round.'),
      this.reactionBar());
  }

  // ------------------------------------------------------------ results

  renderResults() {
    const d = this.state.data;
    const g = GAMES[d.gameId];
    const row = (d.rows || []).find((r) => r.id === this.me.id);
    if (!row) return this.renderSpectating();
    const pts = h('div', { class: 'big-points' }, '+0');
    const top = row.rank === 1 && row.points > 0;
    const mood = top ? 'happy' : row.points <= 0 || (row.rank === d.rows.length && d.rows.length > 2) ? 'sad' : 'idle';
    this.screenBag.timeout(() => {
      countUp(pts, 0, row.points, 800, '+');
      if (row.perfect) { sfx.ding(); fx.confetti(80); vibrate([40, 60, 40]); }
      else if (top) { sfx.great(); fx.confetti(60); vibrate([30, 40, 30]); }
      else sfx.pop();
    }, 300);
    const events = (d.events || []).map((e) => {
      if (e.type === 'heist' && e.to === this.me.id) return h('div', { class: 'event-banner' }, icon('bag'), `You stole ${e.amount} points!`);
      if (e.type === 'heist' && e.from === this.me.id) return h('div', { class: 'event-banner' }, icon('bag'), `${this.p(e.to).name} stole ${e.amount} of your points`);
      return null;
    });
    return h('div', { class: 'p-screen p-center p-results', style: { '--c': g.color } },
      this.topBar(),
      h('div', { class: 'eyebrow' }, icon(g.icon), g.name),
      h('h1', { class: 'p-title' }, top ? 'You won the round!' : row.points <= 0 ? 'No points this time' : `You came ${ordinal(row.rank)}`),
      char(this.me.character, { size: 130, mood, class: top ? 'hop' : '' }),
      h('div', { class: 'res-label big' }, row.label),
      row.perfect ? h('div', { class: 'perfect-badge big' }, icon('sparkle'), 'Perfect · +25 bonus') : null,
      pts,
      row.tags?.length ? h('div', { class: 'res-tags' }, row.tags.map((t) => h('span', { class: 'tag' }, t))) : null,
      events,
      this.reactionBar());
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
      if (t) team = h('div', { class: 'p-teamcard', style: { '--team': T.color } }, `${T.name}: ${ordinal(t.rank)} place · ${t.score} avg`);
    }
    let status = null;
    if (elimMode) {
      if (out) status = h('div', { class: 'stamp red' }, icon('skull'), 'Eliminated');
      else if (mine.alive) status = h('div', { class: 'stamp green' }, icon('check'), 'Safe');
    }
    return h('div', { class: 'p-screen p-center p-standings' },
      this.topBar(),
      h('div', { class: 'eyebrow' }, `Standings · Round ${s.round} of ${s.totalRounds}`),
      char(this.me.character, { size: 110, mood: out ? 'sad' : mine.rank === 1 ? 'happy' : 'idle' }),
      rankEl,
      diff !== 0 ? h('div', { class: `rank-change ${diff > 0 ? 'up' : 'down'}` }, icon(diff > 0 ? 'up' : 'down'), diff > 0 ? `Up ${diff}` : `Down ${-diff}`) : null,
      scoreEl,
      h('div', { class: 'muted' }, 'points'),
      status,
      team,
      this.reactionBar());
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
    const title = champ ? 'Champion!' : rank === 2 ? 'Second place' : rank === 3 ? 'Third place' : `You finished ${ordinal(rank)}`;
    const myAwards = (d.awards || []).filter((a) => a.player === this.me.id);
    return h('div', { class: 'p-screen p-center p-final' },
      this.topBar(),
      h('div', { class: 'eyebrow' }, 'Final results'),
      char(this.me.character, { size: 150, mood: rank <= 3 ? 'happy' : 'idle', crown: champ, class: champ ? 'hop' : '' }),
      h('h1', { class: 'p-title' }, title),
      teamWin ? h('div', { class: 'p-teamcard', style: { '--team': TEAMS[this.me.team].color } }, `${TEAMS[this.me.team].name} won!`) : null,
      h('div', { class: 'big-score' }, `${(mine?.score ?? 0).toLocaleString()}`),
      h('div', { class: 'muted' }, 'points'),
      myAwards.length
        ? h('div', { class: 'my-awards' }, myAwards.map((a) => h('div', { class: 'award-card small' }, h('div', { class: 'aw-icon' }, icon(a.icon)), h('div', { class: 'aw-text' }, h('div', { class: 'aw-title' }, a.title), h('div', { class: 'aw-desc' }, a.text)))))
        : null,
      h('p', { class: 'muted' }, 'Thanks for playing. The host can start another game.'),
      this.reactionBar());
  }
}
