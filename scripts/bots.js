// Load test: starts a server, connects a host and N bot players, and plays
// full tournaments in every mode. Exercises reconnects, leaving and kicking.
//
//   node scripts/bots.js [players=20] [rounds=10] [speed=8]
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const N = Number(process.argv[2]) || 20;
const ROUNDS = Number(process.argv[3]) || 10;
const SPEED = Number(process.argv[4]) || 8;
const PORT = 3999;
const URL = `http://localhost:${PORT}`;
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
let serverErrors = 0;

const server = spawn(process.execPath, ['server/index.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT), PP_SPEED: String(SPEED) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stderr.on('data', (d) => { serverErrors++; process.stderr.write(`[server] ${d}`); });
const ready = new Promise((res) => server.stdout.on('data', (d) => { if (String(d).includes('running')) res(); }));

function connect() {
  return io(URL, { transports: ['websocket'], forceNew: true, reconnection: false });
}
const request = (sock, ev, data) => new Promise((res) => sock.timeout(5000).emit(ev, data, (err, r) => res(err ? { ok: false, error: 'timeout' } : r)));

class Bot {
  constructor(i) {
    this.i = i;
    this.name = `Bot${i}`;
    this.timers = [];
    this.stats = { inputs: 0, msgs: 0 };
  }
  async join(code) {
    this.sock = connect();
    this.wire();
    const r = await request(this.sock, 'player:join', { code, name: this.name, character: 'dee-0' });
    if (!r.ok) throw new Error(`join failed: ${r.error}`);
    this.token = r.token;
    this.code = code;
    this.onState(r.state);
  }
  async reconnect() {
    this.sock.disconnect();
    this.clear();
    await sleep(300);
    this.sock = connect();
    this.wire();
    const r = await request(this.sock, 'session:resume', { code: this.code, token: this.token });
    if (!r.ok) throw new Error(`resume failed: ${r.error}`);
    this.resumed = true;
    this.onState(r.state);
  }
  wire() {
    this.sock.on('pp:ping', (ack) => ack && ack());
    this.sock.on('state', (s) => this.onState(s));
    this.sock.on('g:msg', (m) => { this.stats.msgs++; this.onMsg(m); });
    this.sock.on('kicked', () => { this.kicked = true; });
  }
  clear() { this.timers.forEach(clearTimeout); this.timers = []; }
  later(ms, fn) { this.timers.push(setTimeout(fn, ms)); }
  send(d) { this.stats.inputs++; this.sock.emit('g:input', d); }
  onState(s) {
    this.clear();
    this.state = s;
    if (s.phase === 'tutorial' && s.me.alive) this.later(rand(100, 900) / SPEED * 3, () => this.sock.emit('player:ready'));
    if (s.phase === 'results' && Math.random() < 0.5) this.sock.emit('player:react', { r: ['lol', 'tomato', 'fire'][this.i % 3] });
    if (s.phase === 'playing' && s.game?.init) this.play(s.data.gameId, s.game.init);
  }
  play(game, init) {
    this.game = game;
    this.g = init;
    const now = Date.now();
    switch (game) {
      case 'timing': return this.timingShot(init.cur);
      case 'memory': return this.memoryRound(init.round);
      case 'spot': return this.spot(init.puzzle);
      case 'numbers': return this.numbers(init.prob);
      case 'tower': return this.tower(init.cur);
      case 'words': return this.words(init.puzzle);
      case 'catch': return this.catchLoop();
      case 'double': return this.double(init);
      case 'maze': this.mazeState = { ...init }; return this.maze();
      case 'redlight': return this.redlight();
      case 'tug': return this.tug();
      default: return now;
    }
  }
  onMsg(m) {
    switch (this.game) {
      case 'timing': if (m.next) this.timingShot(m.next); break;
      case 'memory': if (m.round) this.memoryRound(m.round); break;
      case 'spot': if (m.puzzle) this.spot(m.puzzle); else if (m.type === 'wrong') this.later(1600, () => this.spot(this.lastPuzzle)); break;
      case 'numbers': if (m.prob) this.numbers(m.prob); else this.later(800, () => this.numbers(this.lastProb)); break;
      case 'tower': if (m.cur) this.tower(m.cur); break;
      case 'words': if (m.puzzle) this.words(m.puzzle); else if (m.type === 'wrong') this.later(200, () => this.send({ type: 'skip', k: this.lastWord.k })); break;
      case 'double': this.later(m.lockUntil - Date.now() + 20, () => this.double(m)); break;
      case 'maze': if (m.maze) this.mazeState = { maze: m.maze, x: 0, y: 0 }; else if (m.type === 'pos') Object.assign(this.mazeState, { x: m.x, y: m.y }); break;
      default:
    }
  }
  timingShot(cur) {
    if (!cur) return;
    // Aim for the centre: find when the marker hits it, plus some human error.
    const tri = (p) => { p = ((p % 1) + 1) % 1; return p < 0.5 ? p * 2 : 2 - p * 2; };
    let best = 0;
    for (let dt = 0; dt < cur.period; dt += 5) {
      if (Math.abs(tri(cur.phase0 + dt / cur.period) - cur.center) < 0.01) { best = dt; break; }
    }
    const at = cur.t0 + best + rand(-60, 60);
    this.later(Math.max(0, at - Date.now()), () => this.send({ type: 'tap', shot: cur.k }));
  }
  memoryRound(r) {
    const start = r.inputAt - Date.now() + 50;
    r.seq.forEach((v, i) => {
      const wrong = Math.random() < 0.04;
      this.later(start + i * 180, () => this.send({ type: 'pad', i: wrong ? (v + 1) % r.pads : v }));
    });
  }
  spot(p) {
    this.lastPuzzle = p;
    const idx = Math.random() < 0.85 ? p.oddIdx : Math.floor(Math.random() * p.size * p.size);
    this.later(rand(500, 1800), () => this.send({ type: 'pick', level: p.level, idx }));
  }
  numbers(p) {
    this.lastProb = p;
    // eslint-disable-next-line no-new-func
    const ans = Function(`return ${p.q.replace(/×/g, '*').replace(/−/g, '-').replace(/÷/g, '/')}`)();
    const value = Math.random() < 0.9 ? ans : ans + 1;
    this.later(rand(500, 1500), () => this.send({ type: 'answer', k: p.k, value }));
  }
  tower(cur) {
    this.later(Math.max(0, cur.t0 - Date.now()) + rand(100, 900), () => this.send({ type: 'drop', h: cur.h }));
  }
  words(p) {
    this.lastWord = p;
    this.later(rand(600, 1500), () => this.send({ type: 'guess', k: p.k, word: p.letters.join('') }));
  }
  catchLoop() {
    const tick = () => {
      this.send({ type: 'lane', lane: Math.floor(Math.random() * 5) });
      this.later(rand(150, 500), tick);
    };
    tick();
  }
  double(s) {
    if (s.step >= 2 && Math.random() < 0.5) this.later(rand(100, 400), () => this.send({ type: 'bank' }));
    else this.later(rand(100, 400), () => this.send({ type: 'pick', step: s.step, i: Math.floor(Math.random() * 4) }));
  }
  maze() {
    const tick = () => {
      const ms = this.mazeState;
      if (ms?.maze) {
        const dirs = ['U', 'D', 'L', 'R'];
        const bits = { U: 1, R: 2, D: 4, L: 8 };
        const cell = ms.maze.cells[ms.y * ms.maze.w + ms.x];
        const open = dirs.filter((d) => !(cell & bits[d]));
        const d = open[Math.floor(Math.random() * open.length)] || 'R';
        ms.x += d === 'R' ? 1 : d === 'L' ? -1 : 0;
        ms.y += d === 'D' ? 1 : d === 'U' ? -1 : 0;
        this.send({ type: 'move', level: ms.maze.level, dirs: [d] });
      }
      this.later(rand(70, 140), tick);
    };
    tick();
  }
  tug() {
    const tick = () => { this.send({ type: 'pull' }); this.later(rand(60, 140), tick); };
    tick();
  }
  redlight() {
    const tick = () => { this.send({ type: 'tap' }); this.later(rand(70, 110), tick); };
    tick();
  }
}

async function runTournament(mode, players, rounds) {
  const t0 = Date.now();
  const host = connect();
  host.on('pp:ping', (ack) => ack && ack());
  const created = await request(host, 'host:create');
  if (!created.ok) throw new Error('create failed');
  const code = created.code;
  const phases = [];
  let progressEvents = 0;
  let finalState = null;
  host.on('state', (s) => {
    phases.push(`${s.phase}${s.phase === 'wheel' ? `:${s.data.gameId}` : ''}`);
    if (s.phase === 'final') finalState = s;
  });
  host.on('progress', () => progressEvents++);
  let reacts = 0;
  host.on('react', () => reacts++);

  // Extra player that gets kicked from the lobby.
  const kickMe = new Bot(99);
  await kickMe.join(code);
  await request(host, 'host:action', { action: 'kick', payload: { id: kickMe.state.me.id } });
  await sleep(100);
  if (!kickMe.kicked) throw new Error('kick did not reach player');

  const bots = Array.from({ length: players }, (_, i) => new Bot(i + 1));
  for (const b of bots) await b.join(code);

  host.emit('host:settings', { rounds, mode, teams: 3 });
  await sleep(100);
  const started = await request(host, 'host:action', { action: 'start' });
  if (!started.ok) throw new Error(`start failed: ${started.error}`);

  // Chaos testing: a reconnect and a leaver mid-tournament.
  const playStart = Date.now();
  let didReconnect = false;
  let didLeave = false;
  while (!finalState) {
    await sleep(100);
    const elapsed = Date.now() - playStart;
    const playing = phases[phases.length - 1] === 'playing';
    if (!didReconnect && playing && elapsed > 2000) {
      didReconnect = true;
      await bots[0].reconnect();
      if (!bots[0].state.game) throw new Error('resume during play did not include game state');
    }
    if (!didLeave && playing && elapsed > 6000 && players > 2) {
      didLeave = true;
      await request(bots[1].sock, 'player:leave');
    }
    if (Date.now() - t0 > 20 * 60 * 1000) throw new Error('tournament timed out');
  }

  const st = finalState.data.standings;
  const named = (id) => finalState.players.find((p) => p.id === id)?.name ?? id;
  const games = phases.filter((p) => p.startsWith('wheel')).map((p) => p.split(':')[1]);
  console.log(`\n=== ${mode.toUpperCase()} — ${players} players, ${rounds} rounds (${((Date.now() - t0) / 1000).toFixed(1)}s) ===`);
  console.log(`games: ${games.join(', ')}`);
  console.log(`podium: ${finalState.data.podium.map((id, i) => `${i + 1}. ${named(id)}`).join('  ')}`);
  console.log(`top scores: ${st.slice(0, 5).map((s) => `${named(s.id)}=${s.score}`).join(', ')}`);
  if (finalState.data.teams) console.log(`teams: ${finalState.data.teams.map((t) => `#${t.id}=${t.score}`).join(', ')}`);
  console.log(`host progress events: ${progressEvents}, inputs sent: ${bots.reduce((a, b) => a + b.stats.inputs, 0)}`);

  const problems = [];
  const chars = finalState.players.map((p) => p.character);
  if (new Set(chars).size !== chars.length) problems.push('duplicate characters');
  if (!Array.isArray(finalState.data.awards)) problems.push('no awards list');
  console.log(`awards: ${(finalState.data.awards || []).map((a) => `${a.title}=${named(a.player)}`).join(', ')}`);
  if (reacts === 0) problems.push('host never received reactions');
  if (mode !== 'elimination' && games.length !== rounds) problems.push(`expected ${rounds} rounds, got ${games.length}`);
  if (st.length !== players - 1) problems.push(`expected ${players - 1} in standings (1 left), got ${st.length}`);
  if (!st[0] || st[0].score <= 0) problems.push('winner has no points');
  if (mode === 'elimination' && st.filter((s) => s.alive).length > 2) problems.push('too many players survived elimination');
  if (progressEvents === 0) problems.push('host never got progress updates');
  if (!bots[0].resumed) problems.push('reconnect not exercised');

  host.disconnect();
  bots.forEach((b) => { b.clear(); b.sock.disconnect(); });
  kickMe.sock.disconnect();
  return problems;
}

(async () => {
  await ready;
  let failed = 0;
  try {
    for (const mode of ['classic', 'elimination', 'teams', 'chaos']) {
      const problems = await runTournament(mode, N, mode === 'classic' ? ROUNDS : 5);
      if (problems.length) { failed++; console.log(`❌ ${problems.join('; ')}`); }
      else console.log('✅ ok');
    }
  } catch (err) {
    failed++;
    console.error('❌', err);
  }
  if (serverErrors) { failed++; console.log(`❌ server wrote ${serverErrors} error chunk(s) to stderr`); }
  server.kill();
  console.log(failed ? '\nFAILED' : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
})();
