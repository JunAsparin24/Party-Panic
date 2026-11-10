// Word Scramble: tap tiles to unscramble words. Answers stay on the server.
import { shuffle } from '../util.js';

const WORDS = {
  4: ['GAME', 'JUMP', 'FROG', 'CAKE', 'KING', 'MOON', 'PINK', 'ROCK', 'ZOOM', 'FISH', 'BIRD', 'DUCK', 'GOLD', 'DRUM', 'KITE', 'BOOK', 'HAND', 'BABY', 'JAZZ', 'QUIZ', 'MILK', 'SOCK'],
  5: ['PARTY', 'PANIC', 'CANDY', 'TIGER', 'MAGIC', 'PIZZA', 'ROBOT', 'CLOWN', 'GHOST', 'HONEY', 'JELLY', 'QUEEN', 'SPOON', 'TRAIN', 'WHALE', 'ZEBRA', 'PIANO', 'BEACH', 'CLOUD', 'MUSIC'],
  6: ['ROCKET', 'JUNGLE', 'PLANET', 'CASTLE', 'DRAGON', 'BANANA', 'GUITAR', 'PIRATE', 'WIZARD', 'SUMMER', 'PUZZLE', 'COOKIE', 'BUTTER', 'KITTEN', 'MONKEY', 'ORANGE', 'SPIDER', 'TURTLE', 'WINTER', 'YELLOW'],
  7: ['RAINBOW', 'DOLPHIN', 'PENGUIN', 'BALLOON', 'CAPTAIN', 'DIAMOND', 'FREEDOM', 'GIRAFFE', 'HOLIDAY', 'JOURNEY', 'KITCHEN', 'LIBRARY', 'MYSTERY', 'PICTURE', 'PYRAMID', 'SUNRISE', 'THUNDER', 'VAMPIRE', 'WEEKEND', 'CHICKEN'],
  8: ['DINOSAUR', 'ELEPHANT', 'FIREWORK', 'MOUNTAIN', 'SANDWICH', 'UMBRELLA', 'MUSHROOM', 'KANGAROO', 'CHAMPION', 'SUNSHINE', 'TREASURE', 'AIRPLANE', 'BIRTHDAY', 'COMPUTER', 'FOOTBALL', 'KEYBOARD', 'NOTEBOOK', 'SNOWBALL', 'STARFISH', 'SKELETON'],
};
// A few extra real words that are anagrams of puzzle words, so they also count.
const EXTRA = ['MEGA', 'CANED', 'MEALS'];
const DICT = new Set([...Object.values(WORDS).flat(), ...EXTRA]);
const LENGTHS = [4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8];
const sorted = (w) => [...w].sort().join('');

export default function create(api) {
  const used = new Set();
  const puzzles = [];
  function puzzle(k) {
    if (puzzles[k]) return puzzles[k];
    const len = LENGTHS[Math.min(k, LENGTHS.length - 1)];
    const pool = WORDS[len].filter((w) => !used.has(w) && w.length === len);
    const word = (pool.length ? pool : WORDS[len])[Math.floor(api.rng() * (pool.length || WORDS[len].length))];
    used.add(word);
    let letters;
    let tries = 0;
    do letters = shuffle([...word], api.rng);
    while (letters.join('') === word && tries++ < 10);
    puzzles[k] = { word, letters };
    return puzzles[k];
  }
  const pub = (k) => ({ k, letters: puzzle(k).letters });

  const st = new Map();
  for (const id of api.pids) st.set(id, { k: 0, score: 0, solved: 0, skips: 0, lockUntil: 0, shownAt: api.now() });

  return {
    playerInit(pid) {
      const s = st.get(pid);
      return { puzzle: pub(s.k), score: s.score, solved: s.solved, lockUntil: s.lockUntil };
    },
    onInput(pid, d) {
      const s = st.get(pid);
      if (!s || d.k !== s.k) return;
      const now = api.now();
      if (now < s.lockUntil) return;
      const p = puzzle(s.k);
      if (d.type === 'guess') {
        const guess = String(d.word || '').toUpperCase().slice(0, 12);
        const ok = sorted(guess) === sorted(p.word) && (guess === p.word || DICT.has(guess));
        if (!ok) return api.toPlayer(pid, { type: 'wrong' });
        const pts = p.word.length * 10 + (now - s.shownAt < 6000 ? 10 : 0);
        s.score += pts;
        s.solved++;
        s.k++;
        s.shownAt = now;
        api.toPlayer(pid, { type: 'correct', pts, word: p.word, score: s.score, solved: s.solved, puzzle: pub(s.k) });
      } else if (d.type === 'skip') {
        s.skips++;
        s.k++;
        s.lockUntil = now + 2500;
        s.shownAt = s.lockUntil;
        api.toPlayer(pid, { type: 'skipped', answer: p.word, lockUntil: s.lockUntil, puzzle: pub(s.k) });
      }
    },
    progress() {
      const out = {};
      for (const [id, s] of st) out[id] = { v: s.score, label: `${s.solved} words` };
      return out;
    },
    finish() {
      const out = {};
      for (const [id, s] of st) out[id] = { raw: s.score, label: `${s.solved} words`, perfect: s.skips === 0 && s.solved >= 8 };
      return out;
    },
  };
}
