// Catch or Crash: items fall down 5 lanes. The server records which lane
// each player was in over time and decides every catch itself.

const LANES = 5;
const VALUES = { coin: 10, star: 25, gem: 50, bomb: -30 };
const GRACE = 140; // wait this long after landing for late lane changes
const STUN = 900;

export default function create(api) {
  const { rng } = api;
  const items = [];
  let t = api.startAt + 1200;
  let id = 0;
  while (t < api.endsAt - 1400) {
    const prog = (t - api.startAt) / api.duration;
    const fall = Math.round(2300 - 1000 * prog);
    const count = rng() < 0.15 + 0.3 * prog ? 2 : 1;
    const lanes = [0, 1, 2, 3, 4].sort(() => rng() - 0.5).slice(0, count);
    for (const lane of lanes) {
      const bombChance = 0.2 + 0.18 * prog;
      const r = rng();
      const type = r < bombChance ? 'bomb' : r < bombChance + 0.07 ? 'gem' : r < bombChance + 0.27 ? 'star' : 'coin';
      items.push({ id: id++, lane, type, spawnAt: Math.round(t), fall });
    }
    t += (700 - 330 * prog) * (0.75 + rng() * 0.5);
  }
  const byLanding = [...items].sort((a, b) => a.spawnAt + a.fall - (b.spawnAt + b.fall));
  const goodTotal = items.filter((i) => i.type !== 'bomb').length;
  let next = 0;

  const st = new Map();
  for (const pid of api.pids) st.set(pid, { hist: [{ t: 0, lane: 2 }], score: 0, caught: 0, bombs: 0, stunUntil: 0, lastMove: 0 });

  const laneAt = (s, time) => {
    for (let i = s.hist.length - 1; i >= 0; i--) if (s.hist[i].t <= time) return s.hist[i].lane;
    return s.hist[0].lane;
  };

  return {
    playerInit(pid) {
      const s = st.get(pid);
      return { lanes: LANES, items, values: VALUES, lane: s.hist[s.hist.length - 1].lane, score: s.score, stunUntil: s.stunUntil };
    },
    onInput(pid, d) {
      const s = st.get(pid);
      if (!s || d.type !== 'lane' || !Number.isInteger(d.lane) || d.lane < 0 || d.lane >= LANES) return;
      const now = api.now();
      if (now - s.lastMove < 40) return;
      s.lastMove = now;
      const at = Math.max(api.tapTime(pid), s.hist[s.hist.length - 1].t);
      if (at < s.stunUntil) return;
      s.hist.push({ t: at, lane: d.lane });
    },
    tick(now) {
      while (next < byLanding.length && byLanding[next].spawnAt + byLanding[next].fall <= now - GRACE) {
        const item = byLanding[next++];
        const land = item.spawnAt + item.fall;
        for (const [pid, s] of st) {
          if (laneAt(s, land) !== item.lane) continue;
          s.score += VALUES[item.type];
          if (item.type === 'bomb') { s.bombs++; s.stunUntil = now + STUN; }
          else s.caught++;
          api.toPlayer(pid, { type: 'hit', id: item.id, item: item.type, score: s.score, stunUntil: s.stunUntil });
        }
      }
      // Trim lane history we no longer need.
      for (const s of st.values()) {
        if (s.hist.length > 40) s.hist.splice(0, s.hist.length - 30);
      }
    },
    progress() {
      const out = {};
      for (const [id, s] of st) out[id] = { v: s.score, label: `${s.score} pts${s.bombs ? ` · ${s.bombs} bomb${s.bombs === 1 ? '' : 's'}` : ''}` };
      return out;
    },
    finish() {
      const out = {};
      for (const [id, s] of st) {
        out[id] = { raw: s.score, label: `${s.score} pts`, perfect: s.bombs === 0 && s.caught >= goodTotal * 0.7 };
      }
      return out;
    },
  };
}
