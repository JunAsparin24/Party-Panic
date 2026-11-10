// Client minigame registry. Each module exports { player(ctx), demo?(), host?(ctx) }.
import timing from './timing.js';
import memory from './memory.js';
import spot from './spot.js';
import numbers from './numbers.js';
import tower from './tower.js';
import words from './words.js';
import catchGame from './catch.js';
import double from './double.js';
import maze from './maze.js';
import redlight from './redlight.js';

export const GAME_CLIENTS = {
  timing,
  memory,
  spot,
  numbers,
  tower,
  words,
  catch: catchGame,
  double,
  maze,
  redlight,
};
