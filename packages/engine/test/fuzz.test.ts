import { describe, expect, it } from 'vitest';
import {
  applyMove,
  canPass,
  createGame,
  legalMoves,
  nextHand,
  validateMove,
  type Action,
  type Card,
  type GameState,
} from '../src/index.js';
import { mulberry } from './helpers.js';

const GAMES = Number(process.env.FUZZ_GAMES ?? 10_000);
const MAX_ACTIONS_PER_GAME = 5000;

const key = (card: { rank: number; suit: number }) => card.rank * 4 + card.suit;

/** Plays one full game (possibly several hands) with random legal moves, checking invariants. */
function playRandomGame(seed: number): { hands: number; actions: number } {
  const rng = mulberry((seed ^ 0x9e3779b9) >>> 0);
  let game = createGame(seed);
  const played = new Set<number>();
  let hands = 1;
  let actions = 0;

  const checkFreshDeal = (g: GameState) => {
    const seen = new Set<number>();
    for (const player of g.players) {
      for (const card of player.hand) {
        expect(seen.has(key(card)), `seed ${seed}: duplicate dealt card`).toBe(false);
        seen.add(key(card));
      }
    }
    expect(seen.size).toBe(52);
  };
  checkFreshDeal(game);

  while (game.phase !== 'gameOver') {
    if (game.phase === 'handOver') {
      expect(game.players.filter((p) => p.out)).toHaveLength(3);
      expect(game.finished).toHaveLength(4);
      expect(game.scores.reduce((a, b) => a + b, 0) % 6).toBe(0);
      game = nextHand(game);
      hands++;
      played.clear();
      checkFreshDeal(game);
      continue;
    }

    const seat = game.turn;
    const moves = legalMoves(game, seat);
    let action: Action;
    if (moves.length === 0) {
      expect(game.trick.plays.length).toBeGreaterThan(0); // leader is never forced to pass
      action = { type: 'pass', cards: [] };
    } else if (canPass(game, seat) && rng() < 0.3) {
      action = { type: 'pass', cards: [] };
    } else {
      action = moves[Math.floor(rng() * moves.length)]!;
    }

    if (action.type !== 'pass') {
      for (const card of action.cards) {
        expect(played.has(key(card)), `seed ${seed}: card played twice`).toBe(false);
        played.add(key(card));
      }
      expect(validateMove(game, seat, action)).toBeNull();
    }
    game = applyMove(game, seat, action);
    if (game.phase === 'playing') {
      expect(game.trick.plays.length).toBeLessThanOrEqual(52);
      expect(game.turn).toBeGreaterThanOrEqual(0);
    }
    if (++actions > MAX_ACTIONS_PER_GAME) {
      throw new Error(`seed ${seed}: game did not terminate`);
    }
  }

  const best = Math.max(...game.scores);
  expect(best).toBeGreaterThanOrEqual(10);
  expect(game.scores.filter((score) => score === best)).toHaveLength(1);
  expect(game.winner).toBe(game.scores.indexOf(best));
  expect(game.phase).toBe('gameOver');
  return { hands, actions };
}

describe('engine fuzzer', () => {
  it(
    `plays ${GAMES} random games to completion with valid scoring`,
    () => {
      let totalActions = 0;
      let totalHands = 0;
      for (let seed = 1; seed <= GAMES; seed++) {
        const result = playRandomGame(seed);
        totalActions += result.actions;
        totalHands += result.hands;
      }
      expect(totalHands).toBeGreaterThanOrEqual(GAMES);
      expect(totalActions).toBeGreaterThan(0);
    },
    900_000,
  );
});
