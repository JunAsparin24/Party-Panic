// Tournament configuration shared by the server and the browser.
// `icon` names refer to public/js/icons.js.

export const MAX_PLAYERS = 20;
export const ROUND_OPTIONS = [5, 10, 15, 20];

export const MODES = {
  classic: { id: 'classic', name: 'Classic', icon: 'trophy', desc: 'Everyone plays every round. Most points wins.' },
  elimination: { id: 'elimination', name: 'Elimination', icon: 'skull', desc: 'The lowest scorers are knocked out each round until a final duel.' },
  teams: { id: 'teams', name: 'Teams', icon: 'teams', desc: 'Players are split into teams. Every point counts for your crew.' },
  chaos: { id: 'chaos', name: 'Chaos', icon: 'bolt', desc: 'Every round rolls random twists: double points, heists, reversed controls and more.' },
};

export const TEAMS = [
  { id: 0, name: 'Red Rockets', short: 'Red', color: '#ff5a3c' },
  { id: 1, name: 'Blue Blasters', short: 'Blue', color: '#3fa7ff' },
  { id: 2, name: 'Green Goblins', short: 'Green', color: '#27c49a' },
  { id: 3, name: 'Gold Giants', short: 'Gold', color: '#ffc23d' },
];

// Chaos-mode round modifiers.
export const MODS = {
  double: { id: 'double', name: 'Double Points', icon: 'x2', desc: 'Every point counts twice.' },
  reversed: { id: 'reversed', name: 'Reversed Controls', icon: 'swap', desc: 'Left is right. Up is down.', needsReverse: true },
  turbo: { id: 'turbo', name: 'Turbo Timer', icon: 'stopwatch', desc: 'A third less time. Move it.' },
  golden: { id: 'golden', name: 'Golden Player', icon: 'crown', desc: 'One lucky player scores triple.' },
  underdog: { id: 'underdog', name: 'Underdog Boost', icon: 'rise', desc: 'The bottom half earns 1.5x points.', needsScores: true },
  heist: { id: 'heist', name: 'Point Heist', icon: 'bag', desc: "This round's winner steals 10% of the leader's points.", needsScores: true },
  upside: { id: 'upside', name: 'Upside Down', icon: 'flip', desc: 'Every phone screen flips over.' },
};

export const REACTIONS = ['lol', 'wow', 'fire', 'love', 'gg', 'tomato'];
