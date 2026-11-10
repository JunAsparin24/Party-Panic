// Double or Nothing: pick a chest to double the pot, or bank it.
// Bomb positions are rolled on the server at the moment of the pick.
import crypto from 'node:crypto';

const CHESTS = 4;
const START_POT = 10;
const bombsFor = (step) => (step < 2 ? 1 : step < 4 ? 2 : 3);

function rollBombs(n) {
  const all = [0, 1, 2, 3];
  for (let i = all.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, n).sort();
}

export default function create(api) {
  const st = new Map();
  for (const id of api.pids) st.set(id, { bank: 0, pot: START_POT, step: 0, lockUntil: 0, busts: 0, maxBank: 0 });

  const view = (s) => ({ bank: s.bank, pot: s.pot, step: s.step, bombCount: bombsFor(s.step), lockUntil: s.lockUntil });

  return {
    playerInit(pid) {
      return { chests: CHESTS, ...view(st.get(pid)) };
    },
    onInput(pid, d) {
      const s = st.get(pid);
      if (!s) return;
      const now = api.now();
      if (now < s.lockUntil) return;
      if (d.type === 'pick') {
        if (!Number.isInteger(d.i) || d.i < 0 || d.i >= CHESTS || d.step !== s.step) return;
        const bombs = rollBombs(bombsFor(s.step));
        if (bombs.includes(d.i)) {
          const lost = s.pot;
          s.busts++;
          s.pot = START_POT;
          s.step = 0;
          s.lockUntil = now + 1600;
          api.toPlayer(pid, { type: 'boom', i: d.i, bombs, lost, ...view(s) });
        } else {
          s.pot *= 2;
          s.step++;
          s.lockUntil = now + 550;
          api.toPlayer(pid, { type: 'safe', i: d.i, bombs, ...view(s) });
        }
      } else if (d.type === 'bank') {
        if (s.step === 0) return;
        const amount = s.pot;
        s.bank += amount;
        s.maxBank = Math.max(s.maxBank, amount);
        s.pot = START_POT;
        s.step = 0;
        s.lockUntil = now + 400;
        api.toPlayer(pid, { type: 'banked', amount, ...view(s) });
      }
    },
    progress() {
      const out = {};
      for (const [id, s] of st) out[id] = { v: s.bank, label: `${s.bank} banked${s.step >= 3 ? ` · risking ${s.pot}` : ''}` };
      return out;
    },
    finish() {
      const out = {};
      for (const [id, s] of st) out[id] = { raw: s.bank, label: `${s.bank} banked`, perfect: s.maxBank >= 320 };
      return out;
    },
  };
}
