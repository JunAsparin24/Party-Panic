// The host's voice: short lines shown on the big screen between rounds.
import { pickOne } from './ui.js';

const LINES = {
  lobby: [
    'Grab your phones. Pick a face. Prepare to panic.',
    'The more the merrier. And the louder.',
    'Friendships are about to be tested.',
  ],
  wheel: [
    'Round and round it goes…',
    'Let the wheel decide your fate.',
    'Spinning up some trouble.',
    'Fingers ready?',
  ],
  wheelFinal: ['One last spin. Make it count.', 'This is it. The final round.'],
  tutorial: [
    'Read it. Learn it. Win it.',
    'Thirty seconds of school, then chaos.',
    'Phones up. Ready buttons down.',
  ],
  results: [
    '{name} came to play.',
    'Take a bow, {name}.',
    '{name} made that look easy.',
    'Nobody tell {name} it was supposed to be hard.',
  ],
  standings: [
    'The table never lies.',
    'Plenty of points still up for grabs.',
    'Somebody is sweating right now.',
  ],
  elimination: ['Not everyone survives this one.', 'The floor is opening up…'],
  final: ['Ladies, gentlemen and everyone else: your champion.', 'After all that chaos, one name stands tall.'],
};

export function quip(kind, vars = {}) {
  const line = pickOne(LINES[kind] || LINES.wheel);
  return line.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
