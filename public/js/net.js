// Socket connection, server clock sync and session storage.
/* global io */

export const socket = io({
  transports: ['websocket', 'polling'],
  reconnectionDelay: 400,
  reconnectionDelayMax: 2500,
});

let offset = 0;

export const net = {
  socket,
  /** Current time on the server's clock (ms). */
  now: () => Date.now() + offset,
  emit(ev, data) {
    socket.emit(ev, data);
  },
  request(ev, data, timeout = 6000) {
    return new Promise((resolve) => {
      socket.timeout(timeout).emit(ev, data, (err, reply) => {
        resolve(err ? { ok: false, error: 'Connection timed out. Try again!' } : reply || { ok: false });
      });
    });
  },
  /** Subscribe; returns an unsubscribe function. */
  on(ev, fn) {
    socket.on(ev, fn);
    return () => socket.off(ev, fn);
  },
};

// The server measures our round trip time with these pings.
socket.on('pp:ping', (ack) => typeof ack === 'function' && ack());

function sample() {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const c0 = Date.now();
    socket.timeout(2000).emit('time', (err, serverTime) => {
      if (err || typeof serverTime !== 'number') return resolve(null);
      const rtt = performance.now() - t0;
      resolve({ rtt, offset: serverTime + rtt / 2 - (c0 + rtt) });
    });
  });
}

export async function syncClock(samples = 6) {
  const results = [];
  for (let i = 0; i < samples; i++) {
    const s = await sample();
    if (s) results.push(s);
    await new Promise((r) => setTimeout(r, 70));
  }
  if (!results.length) return;
  results.sort((a, b) => a.rtt - b.rtt);
  // Average the best half: low-RTT samples are the most accurate.
  const best = results.slice(0, Math.max(1, Math.ceil(results.length / 2)));
  offset = best.reduce((a, s) => a + s.offset, 0) / best.length;
}

setInterval(() => { if (socket.connected) syncClock(3); }, 20000);

const KEY = 'party-panic-session';
export const session = {
  get() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      return s && s.code && s.token ? s : null;
    } catch {
      return null;
    }
  },
  set(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
  },
  clear() {
    try { localStorage.removeItem(KEY); } catch { /* private mode */ }
  },
};

export const prefs = {
  get(k, d) {
    try {
      const v = localStorage.getItem(`pp-${k}`);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try { localStorage.setItem(`pp-${k}`, JSON.stringify(v)); } catch { /* ignore */ }
  },
};
