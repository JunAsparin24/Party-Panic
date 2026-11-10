import crypto from 'node:crypto';

export function randomToken() {
  return crypto.randomBytes(16).toString('hex');
}

export function randSeed() {
  return crypto.randomInt(0, 2 ** 31 - 1);
}

// Small fast seeded PRNG (mulberry32). Used so every player in a round gets
// the same puzzles, which keeps minigames fair.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pick(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)];
}

export function randInt(rng, a, b) {
  return a + Math.floor(rng() * (b - a + 1));
}

// Triangle wave in [0,1]: used for things that slide back and forth.
export function tri(phase) {
  const p = ((phase % 1) + 1) % 1;
  return p < 0.5 ? p * 2 : 2 - p * 2;
}
