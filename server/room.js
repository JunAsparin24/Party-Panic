import { GAMES, GAME_IDS } from '../shared/games.js';
import { MODES, MODS, TEAMS, ROUND_OPTIONS, MAX_PLAYERS, REACTIONS } from '../shared/config.js';
import { SLOTS, isSlot } from '../shared/characters.js';
import { SERVER_GAMES } from './games/index.js';
import { makeRng, randSeed, randomToken, shuffle, pick } from './util.js';
import { scoreRound, assignRanks } from './scoring.js';

// PP_SPEED > 1 speeds every timer up (used by the bot test).
const SPEED = Math.max(0.05, Number(process.env.PP_SPEED) || 1);
const ms = (v) => Math.max(20, Math.round(v / SPEED));

const T = {
  wheel: 6400,
  wheelChaos: 8600,
  tutorial: 16000,
  countdown: 3500,
  results: 7500,
  leaderboard: 9500,
  endEarly: 1500,
};
const SPIN_MS = 4600;
const LOBBY_DROP_MS = 90_000; // remove players who vanish from the lobby
const PROGRESS_MS = 300;
const REACT_GAP_MS = 600;
const freshStats = () => ({ roundWins: 0, perfects: 0, bestRound: 0, bestClimb: 0, reactions: 0, tomatoes: 0 });
const TICK_MS = 50;

let nextPlayerId = 1;

function cleanName(raw) {
  let s = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  s = Array.from(s).slice(0, 14).join('');
  return s || 'Player';
}

export class Room {
  constructor(io, code, onDispose) {
    this.io = io;
    this.code = code;
    this.onDispose = onDispose;
    this.hostToken = randomToken();
    this.hostSocketId = null;
    this.hostConnected = false;
    this.players = new Map();
    this.settings = { rounds: 5, mode: 'classic', teams: 2, games: [...GAME_IDS] };
    this.lastActivity = Date.now();
    this.timer = null;
    this.loops = [];
    this.stateId = 0;
    this.reset();
  }

  // ---------------------------------------------------------------- helpers

  reset() {
    clearTimeout(this.timer);
    this.stopLoops();
    this.phase = 'lobby';
    this.data = {};
    this.endsAt = null;
    this.round = 0;
    this.current = null;
    this.recentGames = [];
    this.playCounts = {};
    this.prevRanks = new Map();
    this.lastResults = null;
    for (const [id, p] of this.players) {
      if (p.left) { this.players.delete(id); continue; }
      p.score = 0;
      p.alive = true;
      p.eliminatedRound = null;
      p.team = null;
      p.ready = false;
      p.lastPoints = 0;
      p.stats = freshStats();
    }
  }

  touch() { this.lastActivity = Date.now(); }

  get totalRounds() { return this.settings.rounds; }

  activePlayers() { return [...this.players.values()].filter((p) => !p.left); }

  participants() { return this.activePlayers().filter((p) => p.alive); }

  publicPlayer(p) {
    return {
      id: p.id,
      name: p.name,
      character: p.character,
      connected: p.connected,
      score: p.score,
      alive: p.alive,
      team: p.team,
      eliminatedRound: p.eliminatedRound,
      left: p.left,
    };
  }

  roster() { return this.activePlayers().map((p) => this.publicPlayer(p)); }

  latency(pid) {
    const p = this.players.get(pid);
    const sock = p && p.socketId && this.io.sockets.sockets.get(p.socketId);
    const rtt = sock?.data?.rtt ?? 80;
    return Math.max(0, Math.min(200, rtt / 2));
  }

  // ---------------------------------------------------------------- emitting

  toHost(ev, data) {
    if (this.hostSocketId) this.io.to(this.hostSocketId).emit(ev, data);
  }

  toPlayer(pid, ev, data) {
    const p = this.players.get(pid);
    if (p && p.connected && p.socketId) this.io.to(p.socketId).emit(ev, data);
  }

  toAll(ev, data) {
    this.io.to(`${this.code}:all`).emit(ev, data);
  }

  baseState() {
    return {
      code: this.code,
      stateId: this.stateId,
      phase: this.phase,
      endsAt: this.endsAt,
      serverNow: Date.now(),
      round: this.round,
      totalRounds: this.totalRounds,
      settings: this.settings,
      players: this.roster(),
      data: this.data,
    };
  }

  hostState() {
    const s = { ...this.baseState(), role: 'host' };
    if (this.phase === 'playing' && this.current) {
      s.game = { host: safe(() => this.current.inst.hostInit?.()) ?? null, progress: safe(() => this.current.inst.progress()) ?? {} };
      if (this.current.ending) s.endsAt = this.current.endsAt;
    }
    return s;
  }

  playerState(p) {
    const s = { ...this.baseState(), role: 'player', me: { ...this.publicPlayer(p), ready: p.ready } };
    if (this.phase === 'playing' && this.current) {
      if (this.current.ending) s.endsAt = this.current.endsAt;
      if (this.current.pids.includes(p.id)) {
        s.game = { init: safe(() => this.current.inst.playerInit(p.id)) ?? null, done: this.current.done.has(p.id) };
      } else {
        s.game = { spectating: true };
      }
    }
    return s;
  }

  emitState() {
    this.toHost('state', this.hostState());
    for (const p of this.activePlayers()) this.toPlayer(p.id, 'state', this.playerState(p));
  }

  emitRoster() {
    this.toAll('roster', this.roster());
  }

  // ---------------------------------------------------------------- joining

  bindSocket(socket, role, pid) {
    socket.join(`${this.code}:all`);
    socket.data.room = this.code;
    socket.data.role = role;
    socket.data.pid = pid || null;
  }

  hostConnect(socket) {
    if (this.hostSocketId && this.hostSocketId !== socket.id) {
      const old = this.io.sockets.sockets.get(this.hostSocketId);
      if (old) { old.emit('replaced'); old.leave(`${this.code}:all`); old.data.room = null; }
    }
    this.hostSocketId = socket.id;
    this.hostConnected = true;
    this.bindSocket(socket, 'host');
    this.touch();
  }

  takenSlots(exceptId) {
    return new Set(this.activePlayers().filter((p) => p.id !== exceptId).map((p) => p.character));
  }

  freeSlot(preferred) {
    const taken = this.takenSlots();
    if (isSlot(preferred) && !taken.has(preferred)) return preferred;
    const free = SLOTS.filter((x) => !taken.has(x.slot));
    // Prefer an unused character over a second colourway of a used one.
    const usedChars = new Set([...taken].map((t) => t.split('-')[0]));
    const fresh = free.filter((x) => !usedChars.has(x.id));
    const pool = fresh.length ? fresh : free;
    return pool[Math.floor(Math.random() * pool.length)]?.slot || SLOTS[0].slot;
  }

  addPlayer(socket, name, character) {
    if (this.phase !== 'lobby') return { ok: false, error: 'This party has already started. Wait for the next game!' };
    if (this.activePlayers().length >= MAX_PLAYERS) return { ok: false, error: `This party is full (${MAX_PLAYERS} players max).` };
    let clean = cleanName(name);
    const taken = new Set(this.activePlayers().map((p) => p.name.toLowerCase()));
    if (taken.has(clean.toLowerCase())) {
      let i = 2;
      const base = Array.from(clean).slice(0, 12).join('');
      while (taken.has(`${base}${i}`.toLowerCase())) i++;
      clean = `${base}${i}`;
    }
    const p = {
      id: `p${nextPlayerId++}`,
      token: randomToken(),
      name: clean,
      character: this.freeSlot(character),
      stats: freshStats(),
      lastReact: 0,
      socketId: socket.id,
      connected: true,
      score: 0,
      alive: true,
      eliminatedRound: null,
      team: null,
      ready: false,
      left: false,
      lastPoints: 0,
      dropTimer: null,
    };
    this.players.set(p.id, p);
    this.bindSocket(socket, 'player', p.id);
    this.touch();
    this.emitRoster();
    return { ok: true, player: p };
  }

  resumePlayer(socket, p) {
    if (p.socketId && p.socketId !== socket.id) {
      const old = this.io.sockets.sockets.get(p.socketId);
      if (old) { old.emit('replaced'); old.leave(`${this.code}:all`); old.data.room = null; }
    }
    clearTimeout(p.dropTimer);
    p.socketId = socket.id;
    p.connected = true;
    this.bindSocket(socket, 'player', p.id);
    this.touch();
    this.emitRoster();
  }

  handleDisconnect(socket) {
    const { role, pid } = socket.data;
    if (role === 'host') {
      if (this.hostSocketId === socket.id) { this.hostConnected = false; this.hostSocketId = null; }
      return;
    }
    const p = this.players.get(pid);
    if (!p || p.socketId !== socket.id) return;
    p.connected = false;
    p.socketId = null;
    if (this.phase === 'lobby') {
      clearTimeout(p.dropTimer);
      p.dropTimer = setTimeout(() => {
        if (!p.connected && this.phase === 'lobby') { this.players.delete(p.id); this.emitRoster(); }
      }, LOBBY_DROP_MS);
    }
    this.emitRoster();
    if (this.phase === 'playing') this.checkAllDone();
    if (this.phase === 'tutorial') this.checkAllReady();
  }

  removePlayer(pid, reason) {
    const p = this.players.get(pid);
    if (!p) return;
    clearTimeout(p.dropTimer);
    if (p.socketId) {
      const sock = this.io.sockets.sockets.get(p.socketId);
      if (sock) {
        sock.emit('kicked', { reason });
        sock.leave(`${this.code}:all`);
        sock.data.room = null;
      }
    }
    if (this.phase === 'lobby') {
      this.players.delete(pid);
    } else {
      p.left = true;
      p.connected = false;
      p.socketId = null;
      p.alive = false;
    }
    this.emitRoster();
    if (this.phase === 'playing') this.checkAllDone();
    if (this.phase === 'tutorial') this.checkAllReady();
    if (this.phase !== 'lobby' && this.phase !== 'final' && this.settings.mode === 'elimination' && this.participants().length === 0) {
      this.goFinal();
    }
  }

  setCharacter(pid, slot) {
    const p = this.players.get(pid);
    if (!p || !isSlot(slot)) return { ok: false, error: 'Unknown character' };
    if (this.takenSlots(pid).has(slot)) return { ok: false, error: 'Someone already picked that one!' };
    p.character = slot;
    this.emitRoster();
    return { ok: true };
  }

  react(pid, r) {
    const p = this.players.get(pid);
    if (!p || p.left || !REACTIONS.includes(r)) return;
    const now = Date.now();
    if (now - p.lastReact < REACT_GAP_MS) return;
    p.lastReact = now;
    p.stats.reactions++;
    if (r === 'tomato') p.stats.tomatoes++;
    this.toHost('react', { id: pid, r });
  }

  updateSettings(input) {
    if (this.phase !== 'lobby' || !input || typeof input !== 'object') return;
    const s = this.settings;
    if (ROUND_OPTIONS.includes(input.rounds)) s.rounds = input.rounds;
    if (typeof input.mode === 'string' && MODES[input.mode]) s.mode = input.mode;
    if (Number.isInteger(input.teams) && input.teams >= 2 && input.teams <= TEAMS.length) s.teams = input.teams;
    if (Array.isArray(input.games)) {
      const games = GAME_IDS.filter((g) => input.games.includes(g));
      if (games.length) s.games = games;
    }
    this.touch();
    this.toAll('settings', this.settings);
  }

  // ---------------------------------------------------------------- phases

  setPhase(phase, duration, data = {}) {
    clearTimeout(this.timer);
    this.phase = phase;
    this.data = data;
    this.stateId++;
    this.endsAt = duration ? Date.now() + duration : null;
    if (duration) this.timer = setTimeout(() => this.advance(), duration);
    this.emitState();
  }

  advance() {
    try {
      switch (this.phase) {
        case 'wheel': return this.startTutorial();
        case 'tutorial': return this.startCountdown();
        case 'countdown': return this.startPlaying();
        case 'playing': return this.endPlaying();
        case 'results': return this.startLeaderboard();
        case 'leaderboard': return this.nextRoundOrFinal();
        default: return undefined;
      }
    } catch (err) {
      console.error(`[room ${this.code}] phase error`, err);
      // Never let one broken round kill the party: skip ahead.
      this.stopLoops();
      this.current = null;
      this.nextRoundOrFinal();
    }
  }

  start() {
    if (this.phase !== 'lobby') return { ok: false, error: 'Already started' };
    const players = this.activePlayers();
    if (players.length < 1) return { ok: false, error: 'Need at least one player to start' };
    for (const p of players) {
      p.score = 0; p.alive = true; p.eliminatedRound = null; p.team = null; p.ready = false; p.lastPoints = 0;
      clearTimeout(p.dropTimer);
    }
    if (this.settings.mode === 'teams') {
      const nTeams = Math.min(this.settings.teams, Math.max(2, players.length));
      shuffle([...players]).forEach((p, i) => { p.team = i % nTeams; });
    }
    this.round = 0;
    this.recentGames = [];
    this.playCounts = {};
    this.prevRanks = new Map(this.standings().map((s) => [s.id, s.rank]));
    this.touch();
    this.nextRound();
    return { ok: true };
  }

  // Shuffle-bag: every enabled game is played once before any repeats, and
  // the same game never comes up twice in a row.
  pickGame() {
    const n = this.participants().length;
    let pool = this.settings.games.filter((g) => (GAMES[g].minPlayers || 1) <= n);
    if (!pool.length) pool = GAME_IDS.filter((g) => (GAMES[g].minPlayers || 1) <= n);
    const minCount = Math.min(...pool.map((g) => this.playCounts[g] || 0));
    let cands = pool.filter((g) => (this.playCounts[g] || 0) === minCount);
    const last = this.recentGames[this.recentGames.length - 1];
    if (cands.length > 1) cands = cands.filter((g) => g !== last);
    else if (cands[0] === last && pool.length > 1) cands = pool.filter((g) => g !== last);
    return pick(cands);
  }

  rollMods(gameId) {
    if (this.settings.mode !== 'chaos') return { mods: [], modData: {} };
    const meta = GAMES[gameId];
    const parts = this.participants();
    let pool = Object.values(MODS).filter((m) => {
      if (m.needsReverse && !meta.reverse) return false;
      if (m.needsScores && this.round <= 1) return false;
      if (m.id === 'golden' && parts.length < 2) return false;
      return true;
    });
    const count = Math.random() < 0.35 ? 2 : 1;
    const mods = shuffle(pool.map((m) => m.id)).slice(0, count);
    const modData = {};
    if (mods.includes('golden')) modData.golden = pick(parts).id;
    return { mods, modData };
  }

  nextRound() {
    this.round++;
    for (const p of this.activePlayers()) p.ready = false;
    const gameId = this.pickGame();
    this.recentGames.push(gameId);
    this.playCounts[gameId] = (this.playCounts[gameId] || 0) + 1;
    const { mods, modData } = this.rollMods(gameId);
    const isFinal = this.round >= this.totalRounds;
    const finalDouble = isFinal && this.settings.mode !== 'elimination' && this.totalRounds > 1;
    const options = this.settings.games;
    this.current = { gameId, mods, modData, isFinal, finalDouble };
    const dur = mods.length ? T.wheelChaos : T.wheel;
    this.setPhase('wheel', ms(dur), {
      options,
      result: options.indexOf(gameId),
      spinMs: ms(SPIN_MS),
      gameId,
      mods,
      modData,
      isFinal,
      finalDouble,
    });
  }

  roundInfo() {
    const c = this.current;
    return { gameId: c.gameId, mods: c.mods, modData: c.modData, isFinal: c.isFinal, finalDouble: c.finalDouble };
  }

  startTutorial() {
    for (const p of this.activePlayers()) p.ready = false;
    this.setPhase('tutorial', ms(T.tutorial), { ...this.roundInfo(), ready: [] });
  }

  setReady(pid) {
    if (this.phase !== 'tutorial') return;
    const p = this.players.get(pid);
    if (!p || p.ready || !p.alive) return;
    p.ready = true;
    this.data.ready = this.participants().filter((x) => x.ready).map((x) => x.id);
    this.toAll('ready', this.data.ready);
    this.checkAllReady();
  }

  checkAllReady() {
    if (this.phase !== 'tutorial' || this.readyShortcut) return;
    const need = this.participants().filter((p) => p.connected);
    if (need.length && need.every((p) => p.ready)) {
      this.readyShortcut = true;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => { this.readyShortcut = false; this.advance(); }, ms(900));
    }
  }

  startCountdown() {
    this.readyShortcut = false;
    this.setPhase('countdown', ms(T.countdown), this.roundInfo());
  }

  startPlaying() {
    const c = this.current;
    const meta = GAMES[c.gameId];
    const factory = SERVER_GAMES[c.gameId];
    let duration = meta.duration * 1000;
    if (c.mods.includes('turbo')) duration = Math.round(duration * 0.67);
    duration = ms(duration);
    const pids = this.participants().map((p) => p.id);
    const startAt = Date.now();
    const endsAt = startAt + duration;
    c.pids = pids;
    c.done = new Set();
    c.startAt = startAt;
    c.endsAt = endsAt;
    c.ending = false;
    const room = this;
    const api = {
      pids,
      rng: makeRng(randSeed()),
      mods: new Set(c.mods),
      startAt,
      endsAt,
      duration,
      speed: SPEED,
      now: () => Date.now(),
      latency: (pid) => room.latency(pid),
      // Server-side estimate of when the player actually tapped: the moment
      // the message arrived minus half their measured round-trip time.
      tapTime: (pid) => Date.now() - room.latency(pid),
      toPlayer: (pid, msg) => room.toPlayer(pid, 'g:msg', msg),
      toPlayers: (msg) => { for (const id of pids) room.toPlayer(id, 'g:msg', msg); },
      toHost: (msg) => room.toHost('g:host', msg),
      done: (pid) => { c.done.add(pid); room.checkAllDone(); },
      endNow: () => room.endSoon(),
      info: (pid) => {
        const p = room.players.get(pid);
        return { team: p?.team ?? null, score: p?.score ?? 0, name: p?.name };
      },
    };
    c.inst = factory(api);
    this.stopLoops();
    if (c.inst.tick) {
      this.loops.push(setInterval(() => safe(() => c.inst.tick(Date.now())), TICK_MS));
    }
    this.loops.push(
      setInterval(() => {
        const progress = safe(() => c.inst.progress());
        if (progress) this.toHost('progress', progress);
      }, PROGRESS_MS)
    );
    this.setPhase('playing', duration, { ...this.roundInfo(), startAt, duration });
  }

  checkAllDone() {
    const c = this.current;
    if (this.phase !== 'playing' || !c || c.ending) return;
    const need = c.pids.filter((id) => {
      const p = this.players.get(id);
      return p && !p.left && p.connected;
    });
    if (need.length && need.every((id) => c.done.has(id))) this.endSoon();
  }

  endSoon() {
    const c = this.current;
    if (!c || c.ending) return;
    c.ending = true;
    const left = c.endsAt - Date.now();
    if (left <= ms(T.endEarly)) return;
    clearTimeout(this.timer);
    c.endsAt = Date.now() + ms(T.endEarly);
    this.endsAt = c.endsAt;
    this.timer = setTimeout(() => this.advance(), ms(T.endEarly));
    this.toAll('endsAt', c.endsAt);
  }

  stopLoops() {
    for (const l of this.loops) clearInterval(l);
    this.loops = [];
  }

  input(pid, data) {
    const c = this.current;
    if (this.phase !== 'playing' || !c || !c.inst) return;
    if (!c.pids.includes(pid)) return;
    if (Date.now() > c.endsAt + 250) return;
    if (!data || typeof data !== 'object') return;
    safe(() => c.inst.onInput(pid, data));
  }

  standings() {
    const list = this.activePlayers().map((p) => ({
      id: p.id,
      score: p.score,
      alive: p.alive,
      eliminatedRound: p.eliminatedRound,
      team: p.team,
      lastPoints: p.lastPoints || 0,
    }));
    if (this.settings.mode === 'elimination') {
      list.sort(
        (a, b) =>
          (b.alive - a.alive) ||
          ((b.eliminatedRound ?? 1e9) - (a.eliminatedRound ?? 1e9)) ||
          (b.score - a.score)
      );
      list.forEach((r, i) => { r.rank = i + 1; });
    } else {
      list.sort((a, b) => b.score - a.score || b.lastPoints - a.lastPoints);
      assignRanks(list);
    }
    return list;
  }

  teamStandings() {
    if (this.settings.mode !== 'teams') return null;
    const teams = new Map();
    for (const p of this.activePlayers()) {
      if (p.team == null) continue;
      if (!teams.has(p.team)) teams.set(p.team, { id: p.team, total: 0, members: [] });
      const t = teams.get(p.team);
      t.total += p.score;
      t.members.push(p.id);
    }
    const list = [...teams.values()].map((t) => ({ ...t, score: Math.round(t.total / Math.max(1, t.members.length)) }));
    list.sort((a, b) => b.score - a.score);
    return assignRanks(list);
  }

  endPlaying() {
    const c = this.current;
    this.stopLoops();
    clearTimeout(this.timer);
    const results = safe(() => c.inst.finish()) || {};
    const pids = c.pids.filter((id) => {
      const p = this.players.get(id);
      return p && !p.left;
    });
    const before = this.standings();
    this.prevRanks = new Map(before.map((s) => [s.id, s.rank]));
    const prevLeader = before[0]?.id;

    let underdogIds = null;
    if (c.mods.includes('underdog')) {
      const alive = before.filter((s) => pids.includes(s.id));
      underdogIds = new Set(alive.slice(Math.ceil(alive.length / 2)).map((s) => s.id));
    }
    const rows = scoreRound(results, pids, {
      double: c.mods.includes('double'),
      finalDouble: c.finalDouble,
      goldenId: c.modData.golden,
      underdogIds,
    });
    for (const p of this.activePlayers()) p.lastPoints = 0;
    for (const row of rows) {
      const p = this.players.get(row.id);
      p.score += row.points;
      p.lastPoints = row.points;
      if (row.rank === 1 && row.points > 0) p.stats.roundWins++;
      if (row.perfect && row.raw > 0) p.stats.perfects++;
      p.stats.bestRound = Math.max(p.stats.bestRound, row.points);
    }

    const events = [];
    if (c.mods.includes('heist') && rows[0] && rows[0].points > 0 && prevLeader && prevLeader !== rows[0].id) {
      const victim = this.players.get(prevLeader);
      const thief = this.players.get(rows[0].id);
      if (victim && thief) {
        const amount = Math.round(victim.score * 0.1);
        if (amount > 0) {
          victim.score -= amount;
          thief.score += amount;
          events.push({ type: 'heist', from: victim.id, to: thief.id, amount });
        }
      }
    }
    if (c.modData.golden) events.push({ type: 'golden', id: c.modData.golden });

    this.lastResults = rows;
    this.current.inst = null;
    this.setPhase('results', ms(T.results), { ...this.roundInfo(), rows, events });
  }

  eliminationCount(aliveCount) {
    const remaining = this.totalRounds - this.round;
    if (remaining <= 0 || aliveCount <= 2) return 0;
    // Spread knockouts so that exactly two players reach the final round.
    return Math.max(1, Math.min(aliveCount - 2, Math.ceil((aliveCount - 2) / remaining)));
  }

  startLeaderboard() {
    const events = [];
    let eliminated = [];
    if (this.settings.mode === 'elimination') {
      const alive = this.participants();
      const k = this.eliminationCount(alive.length);
      if (k > 0) {
        alive.sort((a, b) => a.score - b.score || a.lastPoints - b.lastPoints);
        eliminated = alive.slice(0, k).map((p) => p.id);
        for (const id of eliminated) {
          const p = this.players.get(id);
          p.alive = false;
          p.eliminatedRound = this.round;
        }
        events.push({ type: 'eliminated', ids: eliminated });
      }
    }

    const standings = this.standings();
    for (const s of standings) {
      s.prevRank = this.prevRanks.get(s.id) ?? s.rank;
      const p = this.players.get(s.id);
      if (p) p.stats.bestClimb = Math.max(p.stats.bestClimb, s.prevRank - s.rank);
    }

    const perfect = (this.lastResults || []).filter((r) => r.perfect && r.raw > 0).map((r) => r.id);
    if (perfect.length) events.push({ type: 'perfect', ids: perfect });

    if (standings.length >= 4 && this.round > 1) {
      const climbers = standings
        .filter((s) => s.alive || this.settings.mode !== 'elimination')
        .map((s) => ({ id: s.id, gain: s.prevRank - s.rank, to: s.rank }))
        .filter((x) => x.gain >= 3)
        .sort((a, b) => b.gain - a.gain);
      if (climbers[0]) events.push({ type: 'comeback', ...climbers[0] });
    }
    const prevLeader = [...this.prevRanks.entries()].find(([, r]) => r === 1)?.[0];
    if (this.round > 1 && standings[0] && prevLeader && standings[0].id !== prevLeader && standings[0].score > 0) {
      events.push({ type: 'leader', id: standings[0].id });
    }
    if (this.round > 1 && standings.length >= 2) {
      const [a, b] = standings;
      if (a.score > 0 && a.score - b.score <= Math.max(10, a.score * 0.04) && b.alive !== false) {
        events.push({ type: 'close', ids: [a.id, b.id], gap: a.score - b.score });
      }
    }

    this.setPhase('leaderboard', ms(T.leaderboard), {
      ...this.roundInfo(),
      standings,
      teams: this.teamStandings(),
      eliminated,
      events,
    });
  }

  nextRoundOrFinal() {
    const aliveCount = this.participants().length;
    const elimDone = this.settings.mode === 'elimination' && aliveCount <= 1;
    if (this.round >= this.totalRounds || elimDone || this.activePlayers().length === 0) return this.goFinal();
    return this.nextRound();
  }

  goFinal() {
    this.stopLoops();
    clearTimeout(this.timer);
    if (this.current) this.current.inst = null;
    const standings = this.standings();
    const teams = this.teamStandings();
    const [a, b] = standings;
    const close = !!(a && b && a.score > 0 && a.score - b.score <= Math.max(15, a.score * 0.03));
    this.setPhase('final', 0, {
      standings,
      teams,
      podium: standings.slice(0, 3).map((s) => s.id),
      champion: standings[0]?.id ?? null,
      winnerTeam: teams?.[0]?.id ?? null,
      close: this.settings.mode === 'elimination' ? false : close,
      awards: this.awards(),
    });
  }

  awards() {
    const list = this.activePlayers();
    const best = (key, min) => {
      let top = null;
      for (const p of list) if (p.stats[key] >= min && (!top || p.stats[key] > top.stats[key])) top = p;
      return top;
    };
    const defs = [
      { key: 'roundWins', min: 2, id: 'rounds', title: 'Round Machine', icon: 'trophy', text: (v) => `Won ${v} rounds` },
      { key: 'perfects', min: 1, id: 'perfect', title: 'Flawless', icon: 'sparkle', text: (v) => `${v} perfect ${v === 1 ? 'round' : 'rounds'}` },
      { key: 'bestClimb', min: 2, id: 'comeback', title: 'Comeback Kid', icon: 'rise', text: (v) => `Climbed ${v} places in one round` },
      { key: 'bestRound', min: 1, id: 'bigscore', title: 'Big Score', icon: 'starFull', text: (v) => `${v} points in a single round` },
      { key: 'tomatoes', min: 3, id: 'tomato', title: 'Tomato Thrower', icon: 'fire', text: (v) => `Threw ${v} tomatoes` },
      { key: 'reactions', min: 8, id: 'hype', title: 'Hype Machine', icon: 'megaphone', text: (v) => `Sent ${v} reactions` },
    ];
    const out = [];
    for (const d of defs) {
      const p = best(d.key, d.min);
      if (p) out.push({ id: d.id, title: d.title, icon: d.icon, player: p.id, text: d.text(p.stats[d.key]) });
    }
    return out;
  }

  // ---------------------------------------------------------------- host

  hostAction(action, payload) {
    this.touch();
    switch (action) {
      case 'start':
        return this.start();
      case 'skip':
        if (this.phase === 'playing') { clearTimeout(this.timer); this.advance(); }
        else if (['wheel', 'tutorial', 'countdown', 'results', 'leaderboard'].includes(this.phase)) this.advance();
        return { ok: true };
      case 'end':
        if (this.phase !== 'lobby' && this.phase !== 'final') this.goFinal();
        return { ok: true };
      case 'restart':
        this.reset();
        this.setPhase('lobby', 0, {});
        return { ok: true };
      case 'kick':
        if (payload && typeof payload.id === 'string') this.removePlayer(payload.id, 'You were removed by the host.');
        return { ok: true };
      default:
        return { ok: false, error: 'Unknown action' };
    }
  }

  dispose() {
    clearTimeout(this.timer);
    this.stopLoops();
    for (const p of this.players.values()) clearTimeout(p.dropTimer);
    this.toAll('closed', {});
    this.io.in(`${this.code}:all`).socketsLeave(`${this.code}:all`);
    this.onDispose?.(this);
  }
}

function safe(fn) {
  try {
    return fn();
  } catch (err) {
    console.error('[party-panic]', err);
    return undefined;
  }
}
