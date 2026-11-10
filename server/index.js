import express from 'express';
import http from 'node:http';
import os from 'node:os';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import { Room } from './room.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;
const ROOM_IDLE_MS = 15 * 60 * 1000;

const app = express();
// Hosts like Render sit behind a proxy: trust it so links use https.
app.set('trust proxy', true);
// Render sets this to the public https URL of the service.
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 10_000,
  pingTimeout: 20_000,
  maxHttpBufferSize: 64 * 1024,
  perMessageDeflate: false,
});

const noCache = { etag: true, lastModified: true, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') };
app.use(express.static(path.join(ROOT, 'public'), noCache));
app.use('/shared', express.static(path.join(ROOT, 'shared'), noCache));

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address);
    }
  }
  // Prefer typical home/office LAN ranges first.
  out.sort((a, b) => score(b) - score(a));
  return out;
  function score(ip) {
    if (ip.startsWith('192.168.')) return 3;
    if (ip.startsWith('10.')) return 2;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 1;
    return 0;
  }
}

app.get('/api/info', (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const isLocal = /^(localhost|127\.|\[::1\])/.test(host);
  const lan = lanAddresses();
  let joinBase;
  if (PUBLIC_URL) joinBase = PUBLIC_URL;
  else if (isLocal && lan.length) joinBase = `http://${lan[0]}:${PORT}`;
  else joinBase = `${req.protocol}://${host}`;
  res.json({ joinBase, lan: lan.map((ip) => `http://${ip}:${PORT}`) });
});

app.get('/api/qr.svg', async (req, res) => {
  const text = String(req.query.d || '').slice(0, 300);
  if (!text) return res.status(400).end();
  try {
    const svg = await QRCode.toString(text, { type: 'svg', margin: 1, color: { dark: '#1d1140', light: '#ffffff' } });
    res.type('image/svg+xml').setHeader('Cache-Control', 'public, max-age=3600');
    res.send(svg);
  } catch {
    res.status(500).end();
  }
});

app.get('/healthz', (req, res) => res.json({ ok: true, rooms: rooms.size, sockets: io.engine.clientsCount }));

// ---------------------------------------------------------------- rooms

const rooms = new Map();

function newCode() {
  let code;
  do code = String(crypto.randomInt(100000, 1000000));
  while (rooms.has(code));
  return code;
}

function createRoom() {
  const code = newCode();
  const room = new Room(io, code, (r) => rooms.delete(r.code));
  rooms.set(code, room);
  return room;
}

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const anyoneHere = room.hostConnected || room.activePlayers().some((p) => p.connected);
    if (anyoneHere) room.touch();
    else if (now - room.lastActivity > ROOM_IDLE_MS) room.dispose();
  }
}, 30_000).unref();

// ---------------------------------------------------------------- sockets

const RATE_LIMIT = 60; // events per second per socket

io.on('connection', (socket) => {
  socket.data.rtt = 80;
  let count = 0;
  const rateReset = setInterval(() => { count = 0; }, 1000);

  // Measure round-trip time ourselves so the client cannot lie about lag.
  const pinger = setInterval(() => {
    const t = Date.now();
    socket.timeout(4000).emit('pp:ping', (err) => {
      if (err) return;
      const rtt = Date.now() - t;
      socket.data.rtt = socket.data.rtt * 0.7 + rtt * 0.3;
    });
  }, 2500);

  const room = () => (socket.data.room ? rooms.get(socket.data.room) : null);

  // Wrap handlers: rate-limit, validate the ack, and never crash the server.
  const on = (event, handler) => {
    socket.on(event, (payload, ack) => {
      if (typeof payload === 'function') { ack = payload; payload = undefined; }
      if (++count > RATE_LIMIT) return;
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        handler(payload ?? {}, reply);
      } catch (err) {
        console.error(`[socket ${event}]`, err);
        reply({ ok: false, error: 'Server error' });
      }
    });
  };

  on('time', (_p, reply) => reply(Date.now()));

  on('host:create', (_p, reply) => {
    const old = room();
    if (old) old.handleDisconnect(socket);
    const r = createRoom();
    r.hostConnect(socket);
    reply({ ok: true, code: r.code, token: r.hostToken, role: 'host', state: r.hostState() });
  });

  on('player:join', ({ code, name, avatar }, reply) => {
    const r = rooms.get(String(code || '').trim());
    if (!r) return reply({ ok: false, error: "Couldn't find that party. Check the code!" });
    const old = room();
    if (old) old.handleDisconnect(socket);
    const res = r.addPlayer(socket, name, avatar);
    if (!res.ok) return reply(res);
    reply({ ok: true, code: r.code, token: res.player.token, role: 'player', state: r.playerState(res.player) });
  });

  on('session:resume', ({ code, token }, reply) => {
    const r = rooms.get(String(code || ''));
    if (!r || typeof token !== 'string') return reply({ ok: false, error: 'Party not found' });
    if (token === r.hostToken) {
      r.hostConnect(socket);
      return reply({ ok: true, code: r.code, role: 'host', state: r.hostState() });
    }
    const p = [...r.players.values()].find((x) => x.token === token && !x.left);
    if (!p) return reply({ ok: false, error: 'Session expired' });
    r.resumePlayer(socket, p);
    reply({ ok: true, code: r.code, role: 'player', state: r.playerState(p) });
  });

  on('player:avatar', (avatar) => {
    const r = room();
    if (r && socket.data.role === 'player') r.setAvatar(socket.data.pid, avatar);
  });

  on('player:ready', () => {
    const r = room();
    if (r && socket.data.role === 'player') r.setReady(socket.data.pid);
  });

  on('player:leave', (_p, reply) => {
    const r = room();
    if (r && socket.data.role === 'player') r.removePlayer(socket.data.pid, 'You left the party.');
    reply({ ok: true });
  });

  on('g:input', (data) => {
    const r = room();
    if (r && socket.data.role === 'player') r.input(socket.data.pid, data);
  });

  on('host:settings', (settings) => {
    const r = room();
    if (r && socket.data.role === 'host') r.updateSettings(settings);
  });

  on('host:action', ({ action, payload }, reply) => {
    const r = room();
    if (!r || socket.data.role !== 'host') return reply({ ok: false, error: 'Not the host' });
    if (action === 'close') {
      r.dispose();
      return reply({ ok: true });
    }
    reply(r.hostAction(String(action), payload) || { ok: true });
  });

  socket.on('disconnect', () => {
    clearInterval(rateReset);
    clearInterval(pinger);
    const r = room();
    if (r) r.handleDisconnect(socket);
  });
});

server.listen(PORT, () => {
  console.log(`\n🎉 Party Panic is running!\n`);
  if (PUBLIC_URL) {
    console.log(`   Public URL:   ${PUBLIC_URL}`);
  } else {
    console.log(`   Host screen:  http://localhost:${PORT}`);
    for (const url of lanAddresses()) console.log(`   Phones join:  http://${url}:${PORT}`);
  }
  console.log('');
});
