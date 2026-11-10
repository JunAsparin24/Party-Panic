// Tournament configuration shared by the server and the browser.

export const MAX_PLAYERS = 20;
export const ROUND_OPTIONS = [5, 10, 15, 20];

export const MODES = {
  classic: {
    id: 'classic',
    name: 'Classic',
    icon: '🏆',
    desc: 'Everyone plays every round. Most points wins!',
  },
  elimination: {
    id: 'elimination',
    name: 'Elimination',
    icon: '💀',
    desc: 'The lowest scorers get knocked out each round until one champion remains.',
  },
  teams: {
    id: 'teams',
    name: 'Teams',
    icon: '🤝',
    desc: 'Players are split into teams. Every point counts for your crew.',
  },
  chaos: {
    id: 'chaos',
    name: 'Chaos',
    icon: '🌪️',
    desc: 'Random modifiers every round: double points, reversed controls, heists and more!',
  },
};

export const TEAMS = [
  { id: 0, name: 'Red Rockets', color: '#ff5964', icon: '🚀' },
  { id: 1, name: 'Blue Blasters', color: '#4d7cff', icon: '💥' },
  { id: 2, name: 'Green Goblins', color: '#21c46b', icon: '👺' },
  { id: 3, name: 'Yellow Yetis', color: '#f5b700', icon: '🦍' },
];

// Chaos-mode round modifiers.
export const MODS = {
  double: { id: 'double', name: 'Double Points', icon: '✖️', desc: 'Every point counts twice!' },
  reversed: { id: 'reversed', name: 'Reversed Controls', icon: '🔄', desc: 'Left is right, up is down!', needsReverse: true },
  turbo: { id: 'turbo', name: 'Turbo Timer', icon: '⏱️', desc: 'A third less time. Move it!' },
  golden: { id: 'golden', name: 'Golden Player', icon: '👑', desc: 'One lucky player scores TRIPLE!' },
  underdog: { id: 'underdog', name: 'Underdog Boost', icon: '🐶', desc: 'The bottom half earns 1.5× points!', needsScores: true },
  heist: { id: 'heist', name: 'Point Heist', icon: '💰', desc: "This round's winner steals 10% of the leader's points!", needsScores: true },
  upside: { id: 'upside', name: 'Upside Down', icon: '🙃', desc: 'Your phone screen flips over!' },
};
