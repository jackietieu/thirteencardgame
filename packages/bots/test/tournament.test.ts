import { describe, expect, it } from 'vitest';
import { applyMove, createGame, nextHand, type GameState } from '@thirteen/engine';
import { greedyBot, randomBot } from '../src/index.js';

function mulberry(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    const a = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    state = a;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Plays a full game: greedy at `l1Seat`, random bots elsewhere. Returns final scores. */
function playGame(l1Seat: number, seed: number): number[] {
  const rng = mulberry(seed);
  const l0 = randomBot(rng);
  let game: GameState = createGame(seed);
  let actions = 0;
  while (game.phase !== 'gameOver') {
    if (game.phase === 'handOver') {
      game = nextHand(game);
      continue;
    }
    const bot = game.turn === l1Seat ? greedyBot : l0;
    game = applyMove(game, game.turn, bot(game, game.turn));
    if (++actions > 10_000) throw new Error(`seed ${seed}: game did not terminate`);
  }
  return game.scores;
}

const GAMES = 400;

describe('bot tournament', () => {
  it(`greedy (L1) outscores random (L0) across ${GAMES} games`, () => {
    const l1Scores: number[] = [];
    const l0Scores: number[] = [];
    for (let seed = 1; seed <= GAMES; seed++) {
      const seat = seed % 4;
      const scores = playGame(seat, seed);
      l1Scores.push(scores[seat]!);
      scores.forEach((score, s) => {
        if (s !== seat) l0Scores.push(score);
      });
    }
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(l1Scores)).toBeGreaterThan(avg(l0Scores));
  });
});
