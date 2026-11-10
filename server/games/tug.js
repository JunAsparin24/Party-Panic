// Tug of War: two sides mash PULL. Each tap is weighted by side size so a
// smaller team is not at a disadvantage. First to drag the rope past their
// line wins; otherwise whoever is ahead when time runs out.

const PULL = 0.022; // rope movement per tap, divided by side size
const MIN_GAP = 55; // ms between counted taps (about 18/s max)

export default function create(api) {
  // Use real teams if the room has exactly two; otherwise balance by score.
  const teamsOf = api.pids.map((id) => api.info(id).team);
  const twoTeams = new Set(teamsOf).size === 2 && teamsOf.every((t) => t === 0 || t === 1);
  const side = new Map();
  if (twoTeams) {
    api.pids.forEach((id) => side.set(id, api.info(id).team === 0 ? 'L' : 'R'));
  } else {
    const sorted = [...api.pids].sort((a, b) => api.info(b).score - api.info(a).score || api.rng() - 0.5);
    // snake draft: L R R L L R R L ...
    sorted.forEach((id, i) => side.set(id, i % 4 === 0 || i % 4 === 3 ? 'L' : 'R'));
  }
  const members = { L: api.pids.filter((id) => side.get(id) === 'L'), R: api.pids.filter((id) => side.get(id) === 'R') };

  let pos = 0; // -1 = left wins, +1 = right wins
  let winner = null;
  const taps = new Map(api.pids.map((id) => [id, 0]));
  const last = new Map();
  let lastSent = 0;

  const state = () => ({ type: 'rope', pos, winner });

  return {
    playerInit(pid) {
      return { side: side.get(pid), pos, winner, taps: taps.get(pid), sizes: { L: members.L.length, R: members.R.length }, teams: twoTeams };
    },
    hostInit() {
      return { members, pos, winner, teams: twoTeams };
    },
    onInput(pid, d) {
      if (d.type !== 'pull' || winner) return;
      const now = api.now();
      if (now - (last.get(pid) || 0) < MIN_GAP) return;
      last.set(pid, now);
      const s = side.get(pid);
      taps.set(pid, taps.get(pid) + 1);
      const n = Math.max(1, members[s].length);
      pos += (s === 'L' ? -PULL : PULL) / n;
      if (Math.abs(pos) >= 1) {
        pos = Math.sign(pos);
        winner = pos < 0 ? 'L' : 'R';
        api.toPlayers(state());
        api.toHost(state());
        api.endNow();
      }
    },
    tick(now) {
      if (now - lastSent < 100) return;
      lastSent = now;
      const msg = state();
      api.toPlayers(msg);
      api.toHost(msg);
    },
    progress() {
      const out = {};
      for (const id of api.pids) out[id] = { v: taps.get(id), label: `${taps.get(id)} pulls` };
      return out;
    },
    finish() {
      const win = winner || (pos < 0 ? 'L' : pos > 0 ? 'R' : null);
      const out = {};
      for (const id of api.pids) {
        const t = taps.get(id);
        const won = win && side.get(id) === win;
        out[id] = {
          raw: (won ? 1000 : 0) + t,
          label: `${won ? 'Won' : win ? 'Lost' : 'Draw'} · ${t} pulls`,
          perfect: false,
        };
      }
      return out;
    },
  };
}
