// Red Light Panic: mash RUN on green, freeze on red.
// The signal schedule lives on the server and is revealed live, one change
// at a time, so nobody can see what is coming.

const TRACK = 100;
const RED_GRACE = 300; // reaction allowance after the light turns red
const STUN = 1000;
const KNOCKBACK = 10;

export default function create(api) {
  const { rng } = api;
  const schedule = [{ s: 'red', at: api.startAt }];
  let t = api.startAt + 1600;
  while (t < api.endsAt + 5000) {
    const prog = Math.min(1, (t - api.startAt) / api.duration);
    const turbo = schedule.length > 3 && rng() < 0.14;
    schedule.push({ s: turbo ? 'turbo' : 'green', at: Math.round(t) });
    t += turbo ? 1400 + rng() * 1000 : 1700 + rng() * 2600;
    schedule.push({ s: 'yellow', at: Math.round(t) });
    t += 700 - 250 * prog;
    schedule.push({ s: 'red', at: Math.round(t) });
    t += 1300 + rng() * 1900;
  }
  let shown = 0; // index of the signal currently broadcast
  const signalAt = (time) => {
    let cur = schedule[0];
    for (const sig of schedule) {
      if (sig.at <= time) cur = sig;
      else break;
    }
    return cur;
  };

  let finishers = 0;
  let lastSync = 0;
  const st = new Map();
  for (const id of api.pids) st.set(id, { pos: 0, finishedAt: null, place: null, lastTap: 0, stunUntil: 0, caught: 0 });

  return {
    playerInit(pid) {
      const s = st.get(pid);
      return { track: TRACK, signal: schedule[shown], pos: s.pos, place: s.place, stunUntil: s.stunUntil };
    },
    hostInit() {
      return { signal: schedule[shown] };
    },
    onInput(pid, d) {
      const s = st.get(pid);
      if (!s || d.type !== 'tap' || s.place) return;
      const now = api.now();
      if (now < s.stunUntil || now - s.lastTap < 55) return;
      s.lastTap = now;
      const at = api.tapTime(pid);
      const sig = signalAt(at);
      if (sig.s === 'red') {
        if (at - sig.at < RED_GRACE) return;
        s.pos = Math.max(0, s.pos - KNOCKBACK);
        s.caught++;
        s.stunUntil = now + STUN;
        api.toPlayer(pid, { type: 'caught', pos: s.pos, stunUntil: s.stunUntil });
        return;
      }
      s.pos = Math.min(TRACK, s.pos + (sig.s === 'turbo' ? 2 : 1));
      if (s.pos >= TRACK) {
        s.finishedAt = now;
        s.place = ++finishers;
        api.toPlayer(pid, { type: 'finish', place: s.place, pos: s.pos });
        api.done(pid);
      }
    },
    tick(now) {
      while (shown + 1 < schedule.length && schedule[shown + 1].at <= now) {
        shown++;
        const msg = { type: 'signal', signal: schedule[shown] };
        api.toPlayers(msg);
        api.toHost(msg);
      }
      if (now - lastSync > 400) {
        lastSync = now;
        for (const [pid, s] of st) if (!s.place) api.toPlayer(pid, { type: 'pos', pos: s.pos });
      }
    },
    progress() {
      const out = {};
      for (const [id, s] of st) {
        out[id] = s.place
          ? { v: 1000 - s.place, f: 1, label: `Finished #${s.place}` }
          : { v: s.pos, f: s.pos / TRACK, label: `${s.pos}m` };
      }
      return out;
    },
    finish() {
      const out = {};
      for (const [id, s] of st) {
        out[id] = s.place
          ? { raw: 1000 + Math.round((api.endsAt - s.finishedAt) / 100), label: `Finished #${s.place}`, perfect: s.caught === 0 }
          : { raw: s.pos, label: `${s.pos}m` };
      }
      return out;
    },
  };
}
